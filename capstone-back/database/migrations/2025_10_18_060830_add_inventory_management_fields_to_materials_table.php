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
        Schema::table('materials', function (Blueprint $table) {
            $table->string('location')->nullable()->after('current_stock');
            $table->decimal('critical_stock', 10, 2)->default(0)->after('reorder_level');
            $table->decimal('max_level', 10, 2)->default(0)->after('critical_stock');
            $table->integer('lead_time_days')->default(0)->after('max_level');
            $table->string('supplier')->nullable()->after('lead_time_days');
            $table->enum('category', ['raw', 'packaging'])->default('raw')->after('supplier');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->dropColumn([
                'location',
                'critical_stock',
                'max_level',
                'lead_time_days',
                'supplier',
                'category'
            ]);
        });
    }
};
