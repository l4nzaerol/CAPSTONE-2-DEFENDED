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
        Schema::table('products', function (Blueprint $table) {
            // Add raw_materials column to store materials needed for each product
            $table->json('raw_materials')->nullable()->after('description');
            
            // Change category_id to category_name
            $table->string('category_name')->nullable()->after('raw_materials');
            
            // Add total BOM cost column
            $table->decimal('total_bom_cost', 10, 2)->default(0)->after('standard_cost');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['raw_materials', 'category_name', 'total_bom_cost']);
        });
    }
};
