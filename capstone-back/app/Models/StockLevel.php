<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockLevel extends Model
{
    protected $table = 'stock_levels';
    protected $primaryKey = 'stock_level_id';
    
    protected $fillable = [
        'material_id',
        'material_name',
        'sku',
        'category',
        'location',
        'supplier',
        'unit_of_measure',
        'available_quantity',
        'quantity_on_hand',
        'quantity_reserved',
        'safety_stock',
        'reorder_point',
        'reorder_level',
        'critical_stock',
        'max_level',
        'daily_usage',
        'days_until_stockout',
        'unit_cost',
        'total_value',
        'lead_time_days',
        'stock_status',
        'is_alkansya_material',
        'is_made_to_order_material',
        'needs_reorder',
        'last_calculated_at'
    ];

    protected $casts = [
        'available_quantity' => 'decimal:2',
        'quantity_on_hand' => 'decimal:2',
        'quantity_reserved' => 'decimal:2',
        'safety_stock' => 'decimal:2',
        'reorder_point' => 'decimal:2',
        'reorder_level' => 'decimal:2',
        'critical_stock' => 'decimal:2',
        'max_level' => 'decimal:2',
        'daily_usage' => 'decimal:2',
        'days_until_stockout' => 'integer',
        'unit_cost' => 'decimal:2',
        'total_value' => 'decimal:2',
        'lead_time_days' => 'integer',
        'is_alkansya_material' => 'boolean',
        'is_made_to_order_material' => 'boolean',
        'needs_reorder' => 'boolean',
        'last_calculated_at' => 'datetime'
    ];

    /**
     * Get the material that owns this stock level
     */
    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class, 'material_id', 'material_id');
    }

    /**
     * Scope to filter by stock status
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('stock_status', $status);
    }

    /**
     * Scope to filter materials needing reorder
     */
    public function scopeNeedsReorder($query)
    {
        return $query->where('needs_reorder', true);
    }

    /**
     * Scope to filter Alkansya materials
     */
    public function scopeAlkansya($query)
    {
        return $query->where('is_alkansya_material', true);
    }

    /**
     * Scope to filter Made-to-Order materials
     */
    public function scopeMadeToOrder($query)
    {
        return $query->where('is_made_to_order_material', true);
    }

    /**
     * Scope to filter overstocked items
     */
    public function scopeOverstocked($query)
    {
        return $query->where('stock_status', 'Overstocked');
    }

    /**
     * Scope to filter critical stock items
     */
    public function scopeCritical($query)
    {
        return $query->where('stock_status', 'Critical');
    }

    /**
     * Scope to filter low stock items
     */
    public function scopeLowStock($query)
    {
        return $query->whereIn('stock_status', ['Low Stock', 'Critical', 'Needs Reorder']);
    }
}


