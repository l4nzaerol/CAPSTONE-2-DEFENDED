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
        // Add indexes for better performance
        Schema::table('products', function (Blueprint $table) {
            $table->index('name');
            $table->index('price');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->index('checkout_date');
            $table->index('status');
            $table->index('payment_status');
            $table->index(['checkout_date', 'status']);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->index('product_id');
            $table->index('order_id');
            $table->index(['product_id', 'order_id']);
        });

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->index('category');
            $table->index('name');
            $table->index(['category', 'name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_name_index');
            $table->dropIndex('products_price_index');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_checkout_date_index');
            $table->dropIndex('orders_status_index');
            $table->dropIndex('orders_payment_status_index');
            $table->dropIndex('orders_checkout_date_status_index');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropIndex('order_items_product_id_index');
            $table->dropIndex('order_items_order_id_index');
            $table->dropIndex('order_items_product_id_order_id_index');
        });

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropIndex('inventory_items_category_index');
            $table->dropIndex('inventory_items_name_index');
            $table->dropIndex('inventory_items_category_name_index');
        });
    }
};

