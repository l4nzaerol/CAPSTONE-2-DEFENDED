<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('materials', function (Blueprint $table) {
            $table->id('material_id');
            $table->string('material_name');
            $table->string('material_code')->unique();
            $table->text('description')->nullable();
            $table->string('unit_of_measure');
            $table->decimal('reorder_level', 10, 6)->default(0);
            $table->decimal('standard_cost', 10, 6)->default(0);
            $table->decimal('current_stock', 10, 6)->default(0);
            $table->timestamps();
            
            $table->index(['material_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('materials');
    }
};
