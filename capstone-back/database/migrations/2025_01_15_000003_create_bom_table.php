<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bom', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('material_id');
            $table->decimal('quantity_per_product', 10, 4);
            $table->string('unit_of_measure');
            $table->timestamps();
            
            // Foreign key constraints will be added in a separate migration
            // after all referenced tables are created
            
            $table->unique(['product_id', 'material_id']);
            $table->index(['product_id']);
            $table->index(['material_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bom');
    }
};
