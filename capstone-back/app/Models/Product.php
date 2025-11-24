<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\Schema;

class Product extends Model
{
    use HasFactory;

    protected $table = 'products';
    protected $primaryKey = 'id';
    
    protected $fillable = [
        'name', // Original column
        'product_name', // New column
        'product_code',
        'description',
        'category_id',
        'category_name', // New column
        'is_available_for_order', // New column for availability toggle
        'raw_materials', // New JSON column
        'total_bom_cost', // New column
        'price',
        'stock', // Original column
        'image' // Keep existing column
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'total_bom_cost' => 'decimal:2',
        'raw_materials' => 'array',
        'is_available_for_order' => 'boolean'
    ];

    // Accessor to handle both old and new column names for backward compatibility
    public function getProductNameAttribute()
    {
        return $this->attributes['product_name'] ?? $this->attributes['name'] ?? '';
    }

    public function setProductNameAttribute($value)
    {
        $this->attributes['product_name'] = $value;
        // Only set name if the column exists
        if (Schema::hasColumn('products', 'name')) {
            $this->attributes['name'] = $value;
        }
    }

    // A product can be in multiple cart items
    public function cartItems(): HasMany
    {
        return $this->hasMany(Cart::class, 'product_id', 'id');
    }

    // A product can be part of multiple orders
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'product_id', 'id');
    }
    
    // A product can have multiple production records
    public function productions(): HasMany
    {
        return $this->hasMany(Production::class, 'product_id', 'id');
    }

    // A product can be in multiple wishlists
    public function wishlists(): HasMany
    {
        return $this->hasMany(Wishlist::class, 'product_id', 'id');
    }

    // BOM relationships
    public function bomMaterials(): HasMany
    {
        return $this->hasMany(BOM::class, 'product_id', 'id');
    }

    // Many-to-many relationship with materials through BOM
    public function materials(): BelongsToMany
    {
        return $this->belongsToMany(
            Material::class,
            'bom',
            'product_id',
            'material_id',
            'id',
            'material_id'
        )->withPivot('quantity_per_product', 'unit_of_measure', 'material_name')
         ->withTimestamps();
    }

    // Relationship with raw materials
    public function rawMaterials(): HasMany
    {
        return $this->hasMany(RawMaterial::class, 'product_id', 'id');
    }
}