<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('sku')->unique();
            $table->string('name');
            $table->enum('category', ['raw', 'finished', 'made-to-order'])->default('raw');
            $table->string('status', 50)->default('in_stock');
            $table->integer('production_count')->default(0);
            $table->string('production_status', 50)->nullable();
            $table->string('location')->nullable();
            $table->integer('quantity_on_hand')->default(0);
            $table->integer('safety_stock')->default(0);
            $table->integer('reorder_point')->nullable();
            $table->integer('max_level')->nullable();
            $table->integer('lead_time_days')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('inventory_items');
        Schema::enableForeignKeyConstraints();
    }
};
