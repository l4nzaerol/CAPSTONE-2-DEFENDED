<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    protected $table = 'inventory_items';
    // Using default 'id' as primary key
    
    protected $fillable = [
        'name',
        'sku',
        'description',
        'unit',
        'quantity_on_hand',
        'current_stock',
        'unit_cost',
        'reorder_point',
        'safety_stock',
        'location',
        'category',
        'supplier',
        'lead_time_days',
        'status',
        'production_status',
        'production_count'
    ];

    public function usage(): HasMany {
        return $this->hasMany(InventoryUsage::class, 'inventory_item_id', 'id');
    }

    public function usages(): HasMany {
        return $this->hasMany(InventoryUsage::class, 'inventory_item_id', 'id');
    }
}