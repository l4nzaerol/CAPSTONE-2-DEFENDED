<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BOM extends Model
{
    protected $table = 'bom';
    
    protected $fillable = [
        'product_id',
        'material_id',
        'quantity_per_product',
        'unit_of_measure'
    ];

    protected $casts = [
        'quantity_per_product' => 'decimal:4'
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class, 'material_id', 'material_id');
    }
}
