<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RawMaterial extends Model
{
    use HasFactory;

    protected $primaryKey = 'material_id';

    protected $fillable = [
        'product_id',
        'material_name',
        'material_code',
        'quantity_needed',
        'unit_of_measure',
        'unit_cost',
        'total_cost',
        'description'
    ];

    protected $casts = [
        'quantity_needed' => 'decimal:4',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2'
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}