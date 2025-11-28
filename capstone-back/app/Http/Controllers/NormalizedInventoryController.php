<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Material;
use App\Models\RawMaterial;
use App\Models\BOM;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\AlkansyaDailyOutput;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class NormalizedInventoryController extends Controller
{
    /**
     * Get all products with their materials and inventory status
     */
    public function getProducts()
    {
        $products = Product::with(['materials', 'bomMaterials.material'])
            ->get()
            ->map(function ($product) {
                $product->materials_count = $product->materials->count();
                $product->total_material_cost = $product->bomMaterials->sum(function ($bom) {
                    return $bom->quantity_per_product * $bom->material->standard_cost;
                });
                
                // Ensure product_name is available (handle both old and new column names)
                if (!isset($product->product_name) && isset($product->name)) {
                    $product->product_name = $product->name;
                }
                
                // Generate product_code if not exists
                if (!isset($product->product_code) || empty($product->product_code)) {
                    $product->product_code = 'PROD-' . str_pad($product->id, 3, '0', STR_PAD_LEFT);
                }
                
                // Set default values for new columns if they don't exist
                if (!isset($product->unit_of_measure)) {
                    $product->unit_of_measure = 'pcs';
                }
                if (!isset($product->standard_cost)) {
                    $product->standard_cost = 0;
                }
                
                // Get inventory status and stock information
                $this->addInventoryStatus($product);
                
                return $product;
            });

        return response()->json($products);
    }
    
    /**
     * Add inventory status and stock information to product
     */
    private function addInventoryStatus($product)
    {
        // For Alkansya products (Stocked Products)
        if ($product->category_name === 'Stocked Products' && str_contains(strtolower($product->name), 'alkansya')) {
            // Use product stock directly for Alkansya
            $product->current_stock = $product->stock;
            $product->status = $product->stock > 0 ? 'in_stock' : 'out_of_stock';
            $product->status_label = $product->stock > 0 ? 'In Stock' : 'Out of Stock';
            $product->status_variant = $product->stock > 0 ? 'success' : 'danger';
            return;
        }
        
        // For Made to Order products
        if ($product->category_name === 'Made to Order' || $product->category_name === 'made_to_order') {
            // Find corresponding inventory item
            $inventoryItem = InventoryItem::where('name', 'like', '%' . $product->name . '%')
                ->where('category', 'made-to-order')
                ->first();
            
            if ($inventoryItem) {
                $product->current_stock = $inventoryItem->quantity_on_hand;
                $product->production_count = $inventoryItem->production_count ?? 0;
                $product->production_status = $inventoryItem->production_status ?? 'not_in_production';
                
                // Set status based on production status
                if ($inventoryItem->production_status === 'completed') {
                    $product->status = 'completed';
                    $product->status_label = 'Completed';
                    $product->status_variant = 'success';
                } elseif ($inventoryItem->production_status === 'ready_to_deliver') {
                    $product->status = 'ready_to_deliver';
                    $product->status_label = 'Ready to Deliver';
                    $product->status_variant = 'info';
                } elseif ($inventoryItem->production_count > 0 || $inventoryItem->production_status === 'in_production') {
                    $product->status = 'in_production';
                    $product->status_label = $inventoryItem->production_count . ' Order' . ($inventoryItem->production_count > 1 ? 's' : '') . ' in Production';
                    $product->status_variant = 'warning';
                } else {
                    $product->status = 'not_in_production';
                    $product->status_label = 'No Production';
                    $product->status_variant = 'secondary';
                }
            } else {
                // No inventory item found, create one
                $inventoryItem = InventoryItem::create([
                    'sku' => 'MTO-' . strtoupper(substr($product->name, 0, 3)) . '-' . $product->id,
                    'name' => $product->name . ' (Made-to-Order)',
                    'category' => 'made-to-order',
                    'status' => 'not_in_production',
                    'production_count' => 0,
                    'production_status' => 'not_in_production',
                    'location' => 'Production Area',
                    'unit' => 'pcs',
                    'unit_cost' => $product->price,
                    'quantity_on_hand' => 0,
                    'safety_stock' => 0,
                    'reorder_point' => null,
                    'max_level' => null,
                    'lead_time_days' => 14,
                    'description' => $product->description
                ]);
                
                $product->current_stock = 0;
                $product->production_count = 0;
                $product->production_status = 'not_in_production';
                $product->status = 'not_in_production';
                $product->status_label = 'No Production';
                $product->status_variant = 'secondary';
            }
            return;
        }
        
        // For other products, use product stock
        $product->current_stock = $product->stock;
        $product->status = $product->stock > 0 ? 'in_stock' : 'out_of_stock';
        $product->status_label = $product->stock > 0 ? 'In Stock' : 'Out of Stock';
        $product->status_variant = $product->stock > 0 ? 'success' : 'danger';
    }

    /**
     * Get all materials with inventory status
     * Returns only from the materials table (including migrated raw materials)
     */
    public function getMaterials()
    {
        // Get ALL materials from the materials table - NO JOINS, NO FILTERS
        $materials = Material::orderBy('material_code')
            ->get()
            ->map(function ($material) {
                // Safe calculation of inventory quantities using direct DB queries
                $totalOnHand = DB::table('inventory')
                    ->where('material_id', $material->material_id)
                    ->sum('current_stock');
                    
                $totalReserved = DB::table('inventory')
                    ->where('material_id', $material->material_id)
                    ->sum('quantity_reserved');
                
                $material->total_quantity_on_hand = $totalOnHand ?? 0;
                $material->total_quantity_reserved = $totalReserved ?? 0;
                $material->available_quantity = $material->total_quantity_on_hand - $material->total_quantity_reserved;
                
                // Calculate status based on stock levels
                // Priority order: Out of Stock > Critical > Need Reorder > Overstocked > In Stock
                if ($material->available_quantity <= 0) {
                    $material->status = 'out_of_stock';
                    $material->status_label = 'Out of Stock';
                    $material->status_variant = 'danger';
                    $material->needs_reorder = true;
                } elseif ($material->critical_stock && $material->available_quantity <= $material->critical_stock) {
                    // Critical: Stock is at or below critical level (also needs reorder)
                    $material->status = 'critical';
                    $material->status_label = 'Critical';
                    $material->status_variant = 'danger';
                    $material->needs_reorder = true;
                } elseif ($material->reorder_level && $material->available_quantity <= $material->reorder_level) {
                    // Need Reorder: Stock is at or below reorder level
                    $material->status = 'need_reorder';
                    $material->status_label = 'Need Reorder';
                    $material->status_variant = 'warning';
                    $material->needs_reorder = true;
                } elseif ($material->max_level && $material->available_quantity > $material->max_level) {
                    // Overstocked: Current stock exceeds max level
                    $material->status = 'overstocked';
                    $material->status_label = 'Overstocked';
                    $material->status_variant = 'info';
                    $material->needs_reorder = false;
                } else {
                    $material->status = 'in_stock';
                    $material->status_label = 'In Stock';
                    $material->status_variant = 'success';
                    $material->needs_reorder = false;
                }

                return $material;
            });

        \Log::info('Returning ' . $materials->count() . ' materials from materials table');

        return response()->json($materials);
    }

    /**
     * Get BOM for a specific product
     */
    public function getBOM($productId)
    {
        $bom = BOM::with(['material', 'product'])
            ->where('product_id', $productId)
            ->get()
            ->map(function ($item) {
                $item->total_cost = $item->quantity_per_product * $item->material->standard_cost;
                $item->material->available_quantity = $item->material->inventory->sum('quantity_on_hand') - $item->material->inventory->sum('quantity_reserved');
                return $item;
            });

        return response()->json($bom);
    }

    /**
     * Create or update BOM
     */
    public function saveBOM(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'materials' => 'required|array',
            'materials.*.material_id' => 'required|exists:materials,material_id',
            'materials.*.quantity_per_product' => 'required|numeric|min:0',
            'materials.*.unit_of_measure' => 'required|string'
        ]);

        DB::beginTransaction();
        try {
            // Delete existing BOM for this product
            BOM::where('product_id', $request->product_id)->delete();

            // Create new BOM entries
            foreach ($request->materials as $material) {
                BOM::create([
                    'product_id' => $request->product_id,
                    'material_id' => $material['material_id'],
                    'quantity_per_product' => $material['quantity_per_product'],
                    'unit_of_measure' => $material['unit_of_measure']
                ]);
            }

            DB::commit();
            return response()->json(['message' => 'BOM updated successfully']);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json(['error' => 'Failed to update BOM'], 500);
        }
    }

    /**
     * Add material to inventory
     */
    public function addMaterial(Request $request)
    {
        $request->validate([
            'material_name' => 'required|string',
            'material_code' => 'required|string|unique:materials,material_code',
            'description' => 'nullable|string',
            'unit_of_measure' => 'required|string',
            'reorder_level' => 'required|numeric|min:0',
            'standard_cost' => 'required|numeric|min:0',
            'initial_quantity' => 'required|numeric|min:0',
            'location_id' => 'nullable|integer',
            'product_id' => 'nullable|integer', // Optional: if this material belongs to a specific product
            'critical_stock' => 'nullable|numeric|min:0',
            'max_level' => 'nullable|numeric|min:0'
        ]);
        
        // Validate that reorder_level is greater than critical_stock
        if ($request->has('reorder_level') && $request->has('critical_stock') && 
            $request->reorder_level > 0 && $request->critical_stock > 0) {
            if ($request->reorder_level <= $request->critical_stock) {
                return response()->json([
                    'error' => 'Reorder level must be greater than critical stock level. This ensures proper inventory management hierarchy.'
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            // Create material in materials table
            $material = Material::create([
                'material_name' => $request->material_name,
                'material_code' => $request->material_code,
                'description' => $request->description,
                'unit_of_measure' => $request->unit_of_measure,
                'reorder_level' => $request->reorder_level,
                'standard_cost' => $request->standard_cost,
                'current_stock' => $request->initial_quantity
            ]);

            // If product_id is provided, also create a raw_material entry
            if ($request->product_id) {
                RawMaterial::create([
                    'product_id' => $request->product_id,
                    'material_name' => $request->material_name,
                    'material_code' => $request->material_code,
                    'description' => $request->description ?? 'Material for production',
                    'unit_of_measure' => $request->unit_of_measure,
                    'quantity_needed' => 1, // Default to 1, can be updated later
                    'unit_cost' => $request->standard_cost,
                    'total_cost' => $request->standard_cost
                ]);
            }

            // Create inventory record
            Inventory::create([
                'material_id' => $material->material_id,
                'location_id' => $request->location_id,
                'current_stock' => $request->initial_quantity,
                'quantity_reserved' => 0,
                'last_updated' => now()
            ]);

            // Create transaction record
            InventoryTransaction::create([
                'material_id' => $material->material_id,
                'transaction_type' => 'PURCHASE',
                'quantity' => $request->initial_quantity,
                'reference' => 'Initial Stock',
                'remarks' => 'Initial material stock',
                'timestamp' => now()
            ]);

            DB::commit();
            return response()->json($material->load('inventory'), 201);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json(['error' => 'Failed to add material: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Update material
     */
    public function updateMaterial(Request $request, $materialId)
    {
        $material = Material::findOrFail($materialId);
        
        $request->validate([
            'material_name' => 'sometimes|string',
            'material_code' => 'sometimes|string|unique:materials,material_code,' . $materialId . ',material_id',
            'description' => 'nullable|string',
            'unit_of_measure' => 'sometimes|string',
            'reorder_level' => 'sometimes|numeric|min:0',
            'standard_cost' => 'sometimes|numeric|min:0',
            'max_level' => 'sometimes|numeric|min:0',
            'lead_time_days' => 'sometimes|integer|min:0',
            'critical_stock' => 'sometimes|numeric|min:0',
            'supplier' => 'nullable|string',
            'category' => 'sometimes|string',
            'location' => 'nullable|string',
            'quantity' => 'sometimes|numeric|min:0' // For updating inventory quantity
        ]);
        
        // Validate that reorder_level is greater than critical_stock
        $reorderLevel = $request->has('reorder_level') ? $request->reorder_level : $material->reorder_level;
        $criticalStock = $request->has('critical_stock') ? $request->critical_stock : $material->critical_stock;
        
        if ($reorderLevel !== null && $criticalStock !== null && $reorderLevel > 0 && $criticalStock > 0) {
            if ($reorderLevel <= $criticalStock) {
                return response()->json([
                    'error' => 'Reorder level must be greater than critical stock level. This ensures proper inventory management hierarchy.'
                ], 422);
            }
        }
        
        // Also validate if only one is being updated
        if ($request->has('reorder_level') && !$request->has('critical_stock') && $material->critical_stock > 0) {
            if ($request->reorder_level <= $material->critical_stock) {
                return response()->json([
                    'error' => 'Reorder level must be greater than critical stock level (' . $material->critical_stock . '). This ensures proper inventory management hierarchy.'
                ], 422);
            }
        }
        
        if ($request->has('critical_stock') && !$request->has('reorder_level') && $material->reorder_level > 0) {
            if ($material->reorder_level <= $request->critical_stock) {
                return response()->json([
                    'error' => 'Critical stock level must be less than reorder level (' . $material->reorder_level . '). This ensures proper inventory management hierarchy.'
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            // Update material with all provided fields
            $updateData = $request->only([
                'material_name', 'material_code', 'description', 
                'unit_of_measure', 'reorder_level', 'standard_cost',
                'max_level', 'lead_time_days', 'critical_stock',
                'supplier', 'category', 'location'
            ]);
            
            // Remove null values to avoid overwriting with null
            $updateData = array_filter($updateData, function($value) {
                return $value !== null;
            });

            $material->update($updateData);

            // If quantity is provided, update inventory records
            if ($request->has('quantity') && $request->quantity !== null) {
                $newQuantity = $request->quantity;
                
                // Get or create inventory record (default location)
                $inventory = Inventory::firstOrCreate(
                    [
                        'material_id' => $materialId,
                        'location_id' => 1, // Default location
                    ],
                    [
                        'current_stock' => 0,
                        'quantity_reserved' => 0,
                        'last_updated' => now(),
                    ]
                );
                
                $oldStock = $inventory->current_stock;
                $adjustmentQuantity = $newQuantity - $oldStock;
                
                // Update inventory
                $inventory->current_stock = $newQuantity;
                $inventory->last_updated = now();
                $inventory->save();
                
                // Create transaction record if quantity changed
                if ($adjustmentQuantity != 0) {
                    InventoryTransaction::create([
                        'material_id' => $materialId,
                        'transaction_type' => 'MANUAL_ADJUSTMENT',
                        'quantity' => $adjustmentQuantity,
                        'timestamp' => now(),
                        'reference' => 'Material Quantity Update',
                        'remarks' => "Manual quantity adjustment from {$oldStock} to {$newQuantity}",
                        'user_id' => auth()->id() ?? null
                    ]);
                }
            }

            // Sync current stock to ensure accuracy
            $material->syncCurrentStock();

            DB::commit();
            return response()->json($material->load('inventory'));
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error updating material: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to update material: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Delete material
     */
    public function deleteMaterial($materialId)
    {
        $material = Material::findOrFail($materialId);
        
        DB::beginTransaction();
        try {
            // Delete related records
            Inventory::where('material_id', $materialId)->delete();
            InventoryTransaction::where('material_id', $materialId)->delete();
            BOM::where('material_id', $materialId)->delete();
            
            // Delete material
            $material->delete();
            
            DB::commit();
            return response()->json(['message' => 'Material deleted successfully']);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json(['error' => 'Failed to delete material'], 500);
        }
    }

    /**
     * Record Alkansya daily output and update material consumption
     */
    public function recordAlkansyaOutput(Request $request)
    {
        $request->validate([
            'output_date' => 'required|date',
            'quantity_produced' => 'required|numeric|min:0',
            'remarks' => 'nullable|string'
        ]);

        DB::beginTransaction();
        try {
            // Find all Alkansya products (case-insensitive search)
            $alkansyaProducts = Product::where('category_name', 'Stocked Products')
                ->where(function($query) {
                    $query->whereRaw('LOWER(name) LIKE ?', ['%alkansya%'])
                          ->orWhereRaw('LOWER(product_name) LIKE ?', ['%alkansya%'])
                          ->orWhere('name', 'Alkansya')
                          ->orWhere('product_name', 'Alkansya');
                })
                ->get();
            
            \Log::info("Found " . $alkansyaProducts->count() . " Alkansya products to update stock");
            foreach ($alkansyaProducts as $product) {
                \Log::info("Alkansya product found: ID={$product->id}, name={$product->name}, product_name={$product->product_name}, current_stock={$product->stock}");
            }

            if ($alkansyaProducts->isEmpty()) {
                throw new \Exception('No Alkansya products found');
            }

            // Use the first Alkansya product for BOM calculation (they all have the same BOM)
            $alkansyaProduct = $alkansyaProducts->first();

            // Get BOM for Alkansya
            $bomItems = BOM::with('material')->where('product_id', $alkansyaProduct->id)->get();

            foreach ($bomItems as $bomItem) {
                $consumedQuantity = $bomItem->quantity_per_product * $request->quantity_produced;
                
                // Update inventory
                $inventory = Inventory::where('material_id', $bomItem->material_id)->first();
                if ($inventory) {
                    $inventory->current_stock -= $consumedQuantity;
                    $inventory->last_updated = now();
                    $inventory->save();
                    
                    // Sync material stock
                    $bomItem->material->syncCurrentStock();
                }

                // Create comprehensive transaction record
                InventoryTransaction::create([
                    'material_id' => $bomItem->material_id,
                    'product_id' => $alkansyaProduct->id,
                    'user_id' => auth()->id(),
                    'transaction_type' => 'ALKANSYA_CONSUMPTION',
                    'quantity' => -$consumedQuantity, // Negative for consumption
                    'unit_cost' => $bomItem->material->standard_cost,
                    'total_cost' => $bomItem->material->standard_cost * $consumedQuantity,
                    'reference' => 'ALKANSYA_DAILY_OUTPUT',
                    'timestamp' => $request->output_date,
                    'remarks' => "Alkansya daily output - consumed {$consumedQuantity} {$bomItem->material->material_name} for {$request->quantity_produced} units",
                    'status' => 'completed',
                    'priority' => 'normal',
                    'metadata' => [
                        'product_id' => $alkansyaProduct->id,
                        'product_name' => $alkansyaProduct->name,
                        'output_date' => $request->output_date,
                        'quantity_produced' => $request->quantity_produced,
                        'consumed_quantity' => $consumedQuantity,
                        'material_name' => $bomItem->material->material_name,
                        'material_code' => $bomItem->material->material_code,
                        'bom_ratio' => $bomItem->quantity_per_product,
                    ],
                    'source_data' => [
                        'alkansya_output_id' => null, // Will be set after alkansya record creation
                        'product_id' => $alkansyaProduct->id,
                        'material_id' => $bomItem->material_id,
                        'output_date' => $request->output_date,
                        'quantity_produced' => $request->quantity_produced,
                    ],
                    'cost_breakdown' => [
                        'material_cost' => $bomItem->material->standard_cost * $consumedQuantity,
                        'unit_cost' => $bomItem->material->standard_cost,
                        'quantity_used' => $consumedQuantity,
                        'bom_ratio' => $bomItem->quantity_per_product,
                    ]
                ]);
            }

            // Check if daily output already exists for this date
            $existingOutput = AlkansyaDailyOutput::where('date', $request->output_date)->first();
            
            if ($existingOutput) {
                // Update existing record - add to quantity
                $existingOutput->quantity_produced += $request->quantity_produced;
                $existingOutput->produced_by = auth()->user()->name ?? $existingOutput->produced_by;
                
                // Update materials used (add to existing)
                $existingMaterials = $existingOutput->materials_used ?? [];
                $newMaterials = $bomItems->map(function($item) use ($request) {
                    return [
                        'material_id' => $item->material_id,
                        'material_name' => $item->material->material_name,
                        'quantity_used' => $item->quantity_per_product * $request->quantity_produced,
                        'unit_cost' => $item->material->standard_cost ?? 0,
                        'total_cost' => ($item->material->standard_cost ?? 0) * $item->quantity_per_product * $request->quantity_produced
                    ];
                })->toArray();
                
                // Merge materials (add quantities for same materials)
                $mergedMaterials = [];
                foreach (array_merge($existingMaterials, $newMaterials) as $material) {
                    $key = $material['material_id'];
                    if (isset($mergedMaterials[$key])) {
                        $mergedMaterials[$key]['quantity_used'] += $material['quantity_used'];
                        $mergedMaterials[$key]['total_cost'] += $material['total_cost'];
                    } else {
                        $mergedMaterials[$key] = $material;
                    }
                }
                
                $existingOutput->materials_used = array_values($mergedMaterials);
                $existingOutput->save();
                $dailyOutput = $existingOutput;
            } else {
                // Create new record
                $dailyOutput = AlkansyaDailyOutput::create([
                    'date' => $request->output_date,
                    'quantity_produced' => $request->quantity_produced,
                    'produced_by' => auth()->user()->name ?? 'System',
                    'materials_used' => $bomItems->map(function($item) use ($request) {
                        return [
                            'material_id' => $item->material_id,
                            'material_name' => $item->material->material_name,
                            'quantity_used' => $item->quantity_per_product * $request->quantity_produced,
                            'unit_cost' => $item->material->standard_cost ?? 0,
                            'total_cost' => ($item->material->standard_cost ?? 0) * $item->quantity_per_product * $request->quantity_produced
                        ];
                    })->toArray()
                ]);
            }

            // Update stock for ALL Alkansya products
            foreach ($alkansyaProducts as $alkansyaProduct) {
                $oldStock = $alkansyaProduct->stock;
                $newStock = $oldStock + $request->quantity_produced;
                
                // Use increment method (automatically saves)
                $alkansyaProduct->increment('stock', $request->quantity_produced);
                
                // Refresh to get the updated value
                $alkansyaProduct->refresh();
                
                \Log::info("Updated stock for product ID {$alkansyaProduct->id} ({$alkansyaProduct->name}): {$oldStock} + {$request->quantity_produced} = {$alkansyaProduct->stock}");
                
                // Double-check: if increment didn't work, use direct update
                if ($alkansyaProduct->stock != $newStock) {
                    \Log::warning("Stock mismatch detected! Expected: {$newStock}, Got: {$alkansyaProduct->stock}. Forcing update...");
                    $alkansyaProduct->stock = $newStock;
                    $alkansyaProduct->save();
                    $alkansyaProduct->refresh();
                    \Log::info("Forced stock update: {$alkansyaProduct->stock}");
                }
            }

            // Create production output transaction
            InventoryTransaction::create([
                'material_id' => null, // No specific material for product output
                'product_id' => $alkansyaProduct->id,
                'user_id' => auth()->id(),
                'transaction_type' => 'PRODUCTION_OUTPUT',
                'quantity' => $request->quantity_produced,
                'unit_cost' => $alkansyaProduct->price ?? 0,
                'total_cost' => ($alkansyaProduct->price ?? 0) * $request->quantity_produced,
                'reference' => 'ALKANSYA_DAILY_OUTPUT',
                'timestamp' => $request->output_date,
                'remarks' => "Alkansya daily output - produced {$request->quantity_produced} units",
                'status' => 'completed',
                'priority' => 'normal',
                'metadata' => [
                    'product_id' => $alkansyaProduct->id,
                    'product_name' => $alkansyaProduct->name,
                    'output_date' => $request->output_date,
                    'quantity_produced' => $request->quantity_produced,
                    'daily_output_id' => $dailyOutput->id,
                ],
                'source_data' => [
                    'alkansya_output_id' => $dailyOutput->id,
                    'product_id' => $alkansyaProduct->id,
                    'output_date' => $request->output_date,
                    'quantity_produced' => $request->quantity_produced,
                ]
            ]);

            DB::commit();
            return response()->json(['message' => 'Alkansya output recorded successfully']);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get inventory transactions
     */
    public function getTransactions(Request $request)
    {
        $query = InventoryTransaction::with('material')
            ->orderBy('timestamp', 'desc');

        if ($request->material_id) {
            $query->where('material_id', $request->material_id);
        }

        if ($request->transaction_type) {
            $query->where('transaction_type', $request->transaction_type);
        }

        if ($request->date_from) {
            $query->whereDate('timestamp', '>=', $request->date_from);
        }

        if ($request->date_to) {
            $query->whereDate('timestamp', '<=', $request->date_to);
        }

        $transactions = $query->paginate(50);
        return response()->json($transactions);
    }

    /**
     * Adjust material stock
     */
    public function adjustStock(Request $request)
    {
        $request->validate([
            'material_id' => 'required|exists:materials,material_id',
            'adjustment_type' => 'required|in:add,subtract,set',
            'quantity' => 'required|numeric|min:0',
            'reason' => 'required|string',
            'reference' => 'nullable|string'
        ]);

        DB::beginTransaction();
        try {
            $material = Material::findOrFail($request->material_id);
            
            // Get or create inventory record
            $inventory = Inventory::firstOrCreate(
                [
                    'material_id' => $request->material_id,
                    'location_id' => 1, // Default location
                ],
                [
                    'current_stock' => 0,
                    'quantity_reserved' => 0,
                    'last_updated' => now(),
                ]
            );

            $oldStock = $inventory->current_stock;
            $adjustmentQuantity = $request->quantity;

            // Calculate new stock based on adjustment type
            switch ($request->adjustment_type) {
                case 'add':
                    $newStock = $oldStock + $adjustmentQuantity;
                    $transactionQuantity = $adjustmentQuantity;
                    break;
                case 'subtract':
                    $newStock = max(0, $oldStock - $adjustmentQuantity);
                    $transactionQuantity = -$adjustmentQuantity;
                    break;
                case 'set':
                    $newStock = $adjustmentQuantity;
                    $transactionQuantity = $adjustmentQuantity - $oldStock;
                    break;
            }

            // Update inventory
            $inventory->current_stock = $newStock;
            $inventory->last_updated = now();
            $inventory->save();

            // Create transaction record
            InventoryTransaction::create([
                'material_id' => $request->material_id,
                'user_id' => auth()->id(),
                'transaction_type' => 'STOCK_ADJUSTMENT',
                'quantity' => $transactionQuantity,
                'unit_cost' => $material->standard_cost,
                'total_cost' => $material->standard_cost * abs($transactionQuantity),
                'reference' => $request->reference ?: 'MANUAL_ADJUSTMENT',
                'timestamp' => now(),
                'remarks' => $request->reason,
                'status' => 'completed',
                'priority' => 'normal',
                'metadata' => [
                    'adjustment_type' => $request->adjustment_type,
                    'old_stock' => $oldStock,
                    'new_stock' => $newStock,
                    'adjustment_quantity' => $adjustmentQuantity,
                    'reason' => $request->reason,
                    'reference' => $request->reference,
                ]
            ]);

            DB::commit();
            return response()->json([
                'message' => 'Stock adjusted successfully',
                'old_stock' => $oldStock,
                'new_stock' => $newStock,
                'adjustment' => $transactionQuantity
            ]);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json(['error' => 'Failed to adjust stock: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get inventory summary
     */
    public function getInventorySummary()
    {
        try {
            // Get total materials count
            $totalMaterials = Material::count();
            
            // Get total products count
            $totalProducts = Product::count();
            
            // Calculate low stock materials using a simpler approach
            $lowStockMaterials = 0;
            $outOfStockMaterials = 0;
            $totalInventoryValue = 0;
            
            $materials = Material::with('inventory')->get();
            
            foreach ($materials as $material) {
                $totalOnHand = $material->inventory->sum('current_stock');
                $totalReserved = $material->inventory->sum('quantity_reserved');
                $availableQuantity = $totalOnHand - $totalReserved;
                
                // Calculate inventory value
                $totalInventoryValue += $availableQuantity * $material->standard_cost;
                
                // Check stock status
                if ($availableQuantity <= 0) {
                    $outOfStockMaterials++;
                } elseif ($material->reorder_level && $availableQuantity <= $material->reorder_level) {
                    $lowStockMaterials++;
                }
            }
            
            $summary = [
                'total_materials' => $totalMaterials,
                'total_products' => $totalProducts,
                'low_stock_materials' => $lowStockMaterials,
                'out_of_stock_materials' => $outOfStockMaterials,
                'total_inventory_value' => $totalInventoryValue
            ];

            return response()->json($summary);
        } catch (\Exception $e) {
            \Log::error('Error in getInventorySummary: ' . $e->getMessage());
            return response()->json([
                'total_materials' => 0,
                'total_products' => 0,
                'low_stock_materials' => 0,
                'out_of_stock_materials' => 0,
                'total_inventory_value' => 0
            ]);
        }
    }

    /**
     * Get daily output records
     */
    public function getDailyOutput(Request $request)
    {
        try {
            $query = AlkansyaDailyOutput::orderBy('date', 'desc')
                ->orderBy('created_at', 'desc');

            // Filter by date range if provided
            if ($request->start_date) {
                $query->whereDate('date', '>=', $request->start_date);
            }
            if ($request->end_date) {
                $query->whereDate('date', '<=', $request->end_date);
            }

            $dailyOutputs = $query->get();

            return response()->json([
                'daily_outputs' => $dailyOutputs,
                'summary' => [
                    'total_outputs' => $dailyOutputs->count(),
                    'total_quantity' => $dailyOutputs->sum('quantity_produced'),
                    'date_range' => [
                        'start_date' => $request->start_date ?? $dailyOutputs->min('date'),
                        'end_date' => $request->end_date ?? $dailyOutputs->max('date')
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching daily output: ' . $e->getMessage());
            return response()->json([
                'daily_outputs' => [],
                'summary' => [
                    'total_outputs' => 0,
                    'total_quantity' => 0,
                    'date_range' => [
                        'start_date' => null,
                        'end_date' => null
                    ]
                ]
            ], 500);
        }
    }
}
