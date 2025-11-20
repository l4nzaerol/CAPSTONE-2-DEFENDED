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
        Schema::create('alkansya_daily_output', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->integer('quantity_produced');
            $table->text('notes')->nullable();
            $table->string('produced_by')->nullable(); // Staff member who produced
            $table->json('materials_used')->nullable(); // Store materials consumed for this day
            $table->decimal('efficiency_percentage', 5, 2)->default(100.00);
            $table->integer('defects')->default(0);
            $table->timestamps();
            
            // Indexes for better performance
            $table->index('date');
            $table->unique('date'); // Only one record per day
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alkansya_daily_output');
    }
};