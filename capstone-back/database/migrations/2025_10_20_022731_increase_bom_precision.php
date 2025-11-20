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
        Schema::table('bom', function (Blueprint $table) {
            // Increase precision from decimal(10,4) to decimal(12,6)
            // This allows for more accurate BOM calculations
            $table->decimal('quantity_per_product', 12, 6)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bom', function (Blueprint $table) {
            // Revert back to decimal(10,4)
            $table->decimal('quantity_per_product', 10, 4)->change();
        });
    }
};
