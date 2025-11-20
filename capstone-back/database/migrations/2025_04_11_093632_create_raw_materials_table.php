<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('raw_materials', function (Blueprint $table) {
            $table->id('material_id');
            $table->unsignedBigInteger('product_id');
            $table->string('material_name');
            $table->string('material_code')->unique();
            $table->decimal('quantity_needed', 10, 4);
            $table->string('unit_of_measure');
            $table->decimal('unit_cost', 10, 2);
            $table->decimal('total_cost', 10, 2);
            $table->text('description')->nullable();
            $table->timestamps();
            
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->index(['product_id', 'material_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('raw_materials');
    }
};