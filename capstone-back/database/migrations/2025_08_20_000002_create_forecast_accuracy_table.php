<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('forecast_accuracy', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_forecast_id')->constrained('material_forecasts')->onDelete('cascade');
            $table->foreignId('inventory_item_id')->constrained('inventory_items')->onDelete('cascade');
            $table->decimal('actual_usage', 12, 2);
            $table->decimal('forecasted_usage', 12, 2);
            $table->decimal('accuracy_percentage', 5, 2); // -100 to 100
            $table->decimal('absolute_error', 12, 2);
            $table->decimal('percentage_error', 5, 2);
            $table->date('actual_date');
            $table->string('forecast_method');
            $table->json('accuracy_metrics'); // Store additional metrics like MAPE, MAE, etc.
            $table->timestamps();
            
            $table->index(['inventory_item_id', 'actual_date']);
            $table->index(['forecast_method', 'accuracy_percentage']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('forecast_accuracy');
    }
};
