<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('material_forecasts', function (Blueprint $table) {
            $table->id();
            // Material reference - will be updated to material_id by later migration
            $table->unsignedBigInteger('material_id')->nullable();
            
            // Core forecast data matching table display
            $table->decimal('current_stock', 12, 2)->default(0)->comment('Current Stock - Material inventory on hand');
            $table->decimal('daily_usage', 12, 2)->default(0)->comment('Daily Usage - Average daily material consumption');
            $table->decimal('forecasted_usage', 12, 2)->default(0)->comment('Forecasted Usage - Total usage over forecast period');
            $table->integer('days_until_stockout')->nullable()->comment('Days Left - Days until stock runs out');
            $table->string('status')->default('in_stock')->comment('Status - Stock status (out_of_stock, critical, low_stock, in_stock, overstocked)');
            $table->string('status_label')->nullable()->comment('Status Label - Human-readable status');
            
            // Forecast metadata
            $table->string('forecast_method')->default('bom_calculation'); 
            $table->integer('forecast_days')->default(30);
            $table->decimal('confidence_score', 5, 2)->default(70); 
            $table->string('confidence_level')->default('medium'); 
            $table->json('method_details')->nullable()->comment('Detailed calculation method and parameters'); 
            $table->json('forecast_breakdown')->nullable()->comment('Daily breakdown of forecast projections'); 
            
            // Forecast period
            $table->date('forecast_date')->comment('Date when forecast was generated');
            $table->date('forecast_period_start');
            $table->date('forecast_period_end');
            
            // Additional calculated fields
            $table->decimal('projected_stock', 12, 2)->nullable()->comment('Projected stock after forecast period');
            $table->boolean('needs_reorder')->default(false)->comment('Whether material needs reordering');
            $table->boolean('is_active')->default(true);
            
            $table->timestamps();
            
            // Indexes
            $table->index(['material_id', 'forecast_date']);
            $table->index(['forecast_method', 'confidence_level']);
            $table->index(['status', 'needs_reorder']);
            $table->index('days_until_stockout');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_forecasts');
    }
};
