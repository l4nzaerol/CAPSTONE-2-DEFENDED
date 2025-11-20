<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Inventory extends Model
{
    protected $table = 'inventory';
    protected $primaryKey = 'inventory_id';
    
    protected $fillable = [
        'material_id',
        'location_id',
        'current_stock',
        'quantity_reserved',
        'last_updated'
    ];

    protected $casts = [
        'current_stock' => 'decimal:2',
        'quantity_reserved' => 'decimal:2',
        'last_updated' => 'datetime'
    ];

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class, 'material_id', 'material_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class, 'material_id', 'material_id');
    }

    // Get available quantity (on hand - reserved)
    public function getAvailableQuantityAttribute()
    {
        return $this->current_stock - $this->quantity_reserved;
    }

    /**
     * Deduct materials based on BOM for production
     */
    public static function deductMaterialsForProduction($productId, $quantity, $date = null)
    {
        $date = $date ?: now();
        
        // Get BOM materials for the product
        $bomMaterials = BOM::where('product_id', $productId)
            ->with('material')
            ->get();

        $deductedMaterials = [];
        $totalCost = 0;

        DB::beginTransaction();
        try {
            foreach ($bomMaterials as $bomMaterial) {
                $requiredQuantity = $bomMaterial->quantity_per_product * $quantity;
                
                if ($requiredQuantity > 0) {
                    // Get or create inventory record for the material
                    $inventory = self::firstOrCreate(
                        [
                            'material_id' => $bomMaterial->material_id,
                            'location_id' => 1, // Default location
                        ],
                        [
                            'current_stock' => 0,
                            'quantity_reserved' => 0,
                            'last_updated' => $date,
                        ]
                    );

                    // Check if enough stock
                    if ($inventory->current_stock < $requiredQuantity) {
                        throw new \Exception("Insufficient stock for {$bomMaterial->material->material_name}. Required: {$requiredQuantity}, Available: {$inventory->current_stock}");
                    }

                    // Deduct from inventory
                    $inventory->current_stock -= $requiredQuantity;
                    $inventory->last_updated = $date;
                    $inventory->save();

                    // Record material usage
                    $deductedMaterials[] = [
                        'material_id' => $bomMaterial->material_id,
                        'material_name' => $bomMaterial->material->material_name,
                        'material_code' => $bomMaterial->material->material_code,
                        'quantity_used' => $requiredQuantity,
                        'unit_cost' => $bomMaterial->material->standard_cost,
                        'total_cost' => $bomMaterial->material->standard_cost * $requiredQuantity,
                    ];

                    $totalCost += $bomMaterial->material->standard_cost * $requiredQuantity;

                    // Create inventory transaction
                    InventoryTransaction::create([
                        'material_id' => $bomMaterial->material_id,
                        'transaction_type' => 'CONSUMPTION',
                        'quantity' => -$requiredQuantity,
                        'reference' => 'PRODUCTION_CONSUMPTION',
                        'timestamp' => $date,
                        'remarks' => "Material consumption for product production (Qty: {$quantity})",
                        'metadata' => [
                            'product_id' => $productId,
                            'quantity_produced' => $quantity,
                            'unit_cost' => $bomMaterial->material->standard_cost,
                            'total_cost' => $bomMaterial->material->standard_cost * $requiredQuantity,
                        ],
                    ]);
                }
            }

            // Add finished goods to inventory
            $product = Product::find($productId);
            if ($product) {
                $productInventory = self::firstOrCreate(
                    [
                        'product_id' => $productId,
                        'location_id' => 1,
                    ],
                    [
                        'current_stock' => 0,
                        'quantity_reserved' => 0,
                        'last_updated' => $date,
                    ]
                );

                $productInventory->current_stock += $quantity;
                $productInventory->last_updated = $date;
                $productInventory->save();

                // Create production output transaction
                InventoryTransaction::create([
                    'material_id' => null, // This is for finished goods
                    'product_id' => $productId,
                    'transaction_type' => 'PRODUCTION_OUTPUT',
                    'quantity' => $quantity,
                    'reference' => 'PRODUCTION_OUTPUT',
                    'timestamp' => $date,
                    'remarks' => "Production output for {$product->name}",
                    'metadata' => [
                        'product_id' => $productId,
                        'product_name' => $product->name,
                        'unit_cost' => $product->standard_cost,
                        'total_cost' => $product->standard_cost * $quantity,
                        'materials_cost' => $totalCost,
                    ],
                ]);
            }

            DB::commit();
            return [
                'success' => true,
                'deducted_materials' => $deductedMaterials,
                'total_material_cost' => $totalCost,
                'quantity_produced' => $quantity,
            ];

        } catch (\Exception $e) {
            DB::rollback();
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get inventory summary for a product
     */
    public static function getProductInventorySummary($productId)
    {
        $product = Product::find($productId);
        if (!$product) {
            return null;
        }

        // Get BOM materials for the product
        $bomMaterials = BOM::where('product_id', $productId)
            ->with(['material', 'material.inventory'])
            ->get();

        // Get inventory records for all materials used in this product
        $materialIds = $bomMaterials->pluck('material_id')->toArray();
        $inventoryRecords = self::whereIn('material_id', $materialIds)->get();

        return [
            'product' => $product,
            'inventory_records' => $inventoryRecords,
            'bom_materials' => $bomMaterials,
            'total_materials' => $bomMaterials->count(),
        ];
    }
}
