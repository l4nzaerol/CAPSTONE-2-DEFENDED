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
        Schema::table('production_processes', function (Blueprint $table) {
            // Add delay tracking columns
            $table->text('delay_reason')->nullable()->after('completed_at');
            $table->boolean('is_delayed')->default(false)->after('delay_reason');
            $table->timestamp('actual_completion_date')->nullable()->after('is_delayed');
            $table->string('completed_by_name')->nullable()->after('actual_completion_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('production_processes', function (Blueprint $table) {
            $table->dropColumn([
                'delay_reason',
                'is_delayed',
                'actual_completion_date',
                'completed_by_name'
            ]);
        });
    }
};
