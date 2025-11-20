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
        Schema::table('alkansya_daily_output', function (Blueprint $table) {
            $table->dropColumn(['notes', 'efficiency_percentage', 'defects']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('alkansya_daily_output', function (Blueprint $table) {
            $table->text('notes')->nullable();
            $table->decimal('efficiency_percentage', 5, 2)->default(100.00);
            $table->integer('defects')->default(0);
        });
    }
};
