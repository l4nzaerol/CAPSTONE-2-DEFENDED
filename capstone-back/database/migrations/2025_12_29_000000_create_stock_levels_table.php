<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('stock_levels', function (Blueprint $table) {
            $table->id('stock_level_id');
            $table->unsignedBigInteger('material_id');
            $table->string('material_name');
            $table->string('sku'); // Material code/SKU
            $table->string('category')->default('raw'); // raw, packaging
            $table->string('location')->nullable();
            $table->string('supplier')->nullable();
            $table->string('unit_of_measure')->default('pcs');
            
            // Stock quantities
            $table->decimal('available_quantity', 10, 2)->default(0);
            $table->decimal('quantity_on_hand', 10, 2)->default(0);
            $table->decimal('quantity_reserved', 10, 2)->default(0);
            
            // Stock management thresholds
            $table->decimal('safety_stock', 10, 2)->default(0);
            $table->decimal('reorder_point', 10, 2)->default(0);
            $table->decimal('reorder_level', 10, 2)->default(0); // Backend reorder level
            $table->decimal('critical_stock', 10, 2)->default(0);
            $table->decimal('max_level', 10, 2)->default(0);
            
            // Calculated metrics
            $table->decimal('daily_usage', 10, 2)->default(0);
            $table->integer('days_until_stockout')->nullable(); // Days left
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->decimal('total_value', 12, 2)->default(0); // available_quantity * unit_cost
            
            // Lead time
            $table->integer('lead_time_days')->default(0);
            
            // Status
            $table->enum('stock_status', [
                'In Stock',
                'Low Stock',
                'Critical',
                'Out of Stock',
                'Overstocked',
                'Needs Reorder'
            ])->default('In Stock');
            
            // Flags
            $table->boolean('is_alkansya_material')->default(false);
            $table->boolean('is_made_to_order_material')->default(false);
            $table->boolean('needs_reorder')->default(false);
            
            // Timestamps
            $table->timestamp('last_calculated_at')->useCurrent();
            $table->timestamps();
            
            // Foreign key
            $table->foreign('material_id')->references('material_id')->on('materials')->onDelete('cascade');
            
            // Indexes for performance
            $table->index(['material_id']);
            $table->index(['sku']);
            $table->index(['stock_status']);
            $table->index(['needs_reorder']);
            $table->index(['is_alkansya_material', 'is_made_to_order_material'], 'stock_levels_material_type_idx');
            $table->index(['last_calculated_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_levels');
    }
};

