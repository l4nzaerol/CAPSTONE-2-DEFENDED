<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use App\Models\StockLevel;

class Material extends Model
{
    protected $table = 'materials';
    protected $primaryKey = 'material_id';
    
    protected $fillable = [
        'material_name',
        'material_code',
        'description',
        'unit_of_measure',
        'reorder_level',
        'standard_cost',
        'current_stock',
        'location',
        'critical_stock',
        'max_level',
        'lead_time_days',
        'supplier',
        'category'
    ];

    protected $casts = [
        'reorder_level' => 'decimal:2',
        'standard_cost' => 'decimal:2',
        'current_stock' => 'decimal:2',
        'critical_stock' => 'decimal:2',
        'max_level' => 'decimal:2',
        'lead_time_days' => 'integer'
    ];

    // Material can have multiple inventory records (different locations)
    public function inventory(): HasMany
    {
        return $this->hasMany(Inventory::class, 'material_id', 'material_id');
    }

    // Material can have multiple transactions
    public function transactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class, 'material_id', 'material_id');
    }

    // Material has stock level record
    public function stockLevel(): HasMany
    {
        return $this->hasMany(StockLevel::class, 'material_id', 'material_id');
    }

    // BOM relationships
    public function bomProducts(): HasMany
    {
        return $this->hasMany(BOM::class, 'material_id', 'material_id');
    }

    // Many-to-many relationship with products through BOM
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(
            Product::class,
            'bom',
            'material_id',
            'product_id',
            'material_id',
            'product_id'
        )->withPivot('quantity_per_product', 'unit_of_measure')
         ->withTimestamps();
    }

    // Get total quantity on hand across all locations
    public function getTotalQuantityOnHandAttribute()
    {
        return $this->inventory()->sum('current_stock');
    }

    // Get total reserved quantity across all locations
    public function getTotalQuantityReservedAttribute()
    {
        return $this->inventory()->sum('quantity_reserved');
    }

    // Get available quantity (on hand - reserved)
    public function getAvailableQuantityAttribute()
    {
        return $this->total_quantity_on_hand - $this->total_quantity_reserved;
    }

    /**
     * Sync the current_stock field with the sum of inventory records
     */
    public function syncCurrentStock()
    {
        $totalStock = $this->inventory()->sum('current_stock');
        $this->update(['current_stock' => $totalStock]);
        return $totalStock;
    }

    /**
     * Sync current stock for all materials
     */
    public static function syncAllCurrentStock()
    {
        $materials = self::with('inventory')->get();
        foreach ($materials as $material) {
            $material->syncCurrentStock();
        }
    }
}
