<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory', function (Blueprint $table) {
            $table->id('inventory_id');
            $table->unsignedBigInteger('material_id');
            $table->unsignedBigInteger('location_id')->nullable();
            $table->decimal('quantity_on_hand', 10, 2)->default(0);
            $table->decimal('quantity_reserved', 10, 2)->default(0);
            $table->timestamp('last_updated')->useCurrent();
            $table->timestamps();
            
            $table->foreign('material_id')->references('material_id')->on('raw_materials')->onDelete('cascade');
            
            $table->index(['material_id', 'location_id']);
            $table->index(['last_updated']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory');
    }
};
