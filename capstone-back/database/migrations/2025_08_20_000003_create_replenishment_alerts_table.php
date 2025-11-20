<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('replenishment_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained('inventory_items')->onDelete('cascade');
            $table->string('alert_type'); // reorder_point, forecast_based, critical_stock
            $table->string('urgency_level'); // low, medium, high, urgent
            $table->decimal('current_stock', 12, 2);
            $table->decimal('reorder_point', 12, 2);
            $table->decimal('suggested_order_qty', 12, 2);
            $table->decimal('forecasted_usage', 12, 2);
            $table->integer('days_until_stockout');
            $table->text('recommended_action');
            $table->json('alert_metadata'); // Store additional alert details
            $table->boolean('is_resolved')->default(false);
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamps();
            
            $table->index(['inventory_item_id', 'is_resolved']);
            $table->index(['urgency_level', 'alert_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('replenishment_alerts');
    }
};
