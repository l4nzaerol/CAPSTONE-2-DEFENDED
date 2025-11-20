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
        Schema::create('inventory_transactions', function (Blueprint $table) {
            $table->id('transaction_id');
            
            // Core transaction fields
            $table->unsignedBigInteger('material_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->enum('transaction_type', [
                'PURCHASE',
                'CONSUMPTION', 
                'ADJUSTMENT',
                'STOCK_ADJUSTMENT',
                'RETURN',
                'PRODUCTION_OUTPUT',
                'DAILY_OUTPUT',
                'ORDER_ACCEPTANCE',
                'ORDER_FULFILLMENT',
                'PRODUCTION_COMPLETION',
                'ALKANSYA_CONSUMPTION',
                'STOCK_TRANSFER',
                'DEFECT_RETURN',
                'SALES_RETURN',
                'PRODUCTION_USAGE',
                'ALKANSYA_PRODUCTION',
                'ORDER_CONSUMPTION',
                'ORDER_PRODUCTION',
                'MANUAL_ADJUSTMENT',
                'QUALITY_CHECK'
            ]);
            
            $table->decimal('quantity', 10, 2);
            $table->string('reference')->nullable();
            $table->timestamp('timestamp')->useCurrent();
            $table->text('remarks')->nullable();
            $table->json('metadata')->nullable();
            
            // Reference fields
            $table->unsignedBigInteger('order_id')->nullable();
            $table->unsignedBigInteger('production_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('location_id')->nullable();
            
            // Cost tracking
            $table->decimal('unit_cost', 10, 2)->nullable();
            $table->decimal('total_cost', 12, 2)->nullable();
            
            // Batch/lot tracking
            $table->string('batch_number')->nullable();
            $table->date('expiry_date')->nullable();
            
            // Status and priority
            $table->enum('status', ['pending', 'completed', 'cancelled', 'reversed'])->default('completed');
            $table->enum('priority', ['low', 'normal', 'high', 'urgent'])->default('normal');
            
            // Additional metadata fields
            $table->json('source_data')->nullable();
            $table->json('cost_breakdown')->nullable();
            $table->json('quality_metrics')->nullable();
            
            $table->timestamps();
            
            // Foreign key constraints
            $table->foreign('material_id')->references('material_id')->on('materials')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->foreign('production_id')->references('id')->on('productions')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            
            // Indexes for better performance
            $table->index(['material_id', 'transaction_type']);
            $table->index(['product_id', 'transaction_type']);
            $table->index(['order_id', 'transaction_type']);
            $table->index(['production_id', 'transaction_type']);
            $table->index(['user_id', 'timestamp']);
            $table->index(['location_id', 'timestamp']);
            $table->index(['status', 'timestamp']);
            $table->index(['priority', 'timestamp']);
            $table->index(['timestamp']);
            $table->index(['reference']);
            $table->index(['batch_number']);
            $table->index(['expiry_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_transactions');
    }
};
