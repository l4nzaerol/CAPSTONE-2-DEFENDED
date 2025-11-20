<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Check if inventory_item_id column exists
        if (Schema::hasColumn('material_forecasts', 'inventory_item_id')) {
            // Drop foreign key constraint if it exists
            try {
                DB::statement('ALTER TABLE material_forecasts DROP FOREIGN KEY material_forecasts_inventory_item_id_foreign');
            } catch (\Exception $e) {
                // Ignore if constraint doesn't exist
            }
            
            // Drop the old column
            Schema::table('material_forecasts', function (Blueprint $table) {
                $table->dropColumn('inventory_item_id');
            });
        }
        
        // Add material_id column if it doesn't exist
        if (!Schema::hasColumn('material_forecasts', 'material_id')) {
            Schema::table('material_forecasts', function (Blueprint $table) {
                $table->unsignedBigInteger('material_id')->after('id');
            });
        }
        
        // Add foreign key constraint if it doesn't exist
        $foreignKeys = DB::select("
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'material_forecasts' 
            AND COLUMN_NAME = 'material_id' 
            AND REFERENCED_TABLE_NAME IS NOT NULL
        ");
        
        if (empty($foreignKeys)) {
            Schema::table('material_forecasts', function (Blueprint $table) {
                $table->foreign('material_id')->references('material_id')->on('materials')->onDelete('cascade');
            });
        }
        
        // Add new columns for table display if they don't exist
        Schema::table('material_forecasts', function (Blueprint $table) {
            if (!Schema::hasColumn('material_forecasts', 'current_stock')) {
                $table->decimal('current_stock', 12, 2)->default(0)->after('material_id')->comment('Current Stock - Material inventory on hand');
            }
            if (!Schema::hasColumn('material_forecasts', 'daily_usage')) {
                $table->decimal('daily_usage', 12, 2)->default(0)->after('current_stock')->comment('Daily Usage - Average daily material consumption');
            }
            if (!Schema::hasColumn('material_forecasts', 'days_until_stockout')) {
                $table->integer('days_until_stockout')->nullable()->after('forecasted_usage')->comment('Days Left - Days until stock runs out');
            }
            if (!Schema::hasColumn('material_forecasts', 'status')) {
                $table->string('status')->default('in_stock')->after('days_until_stockout')->comment('Status - Stock status');
            }
            if (!Schema::hasColumn('material_forecasts', 'status_label')) {
                $table->string('status_label')->nullable()->after('status')->comment('Status Label - Human-readable status');
            }
            if (!Schema::hasColumn('material_forecasts', 'projected_stock')) {
                $table->decimal('projected_stock', 12, 2)->nullable()->after('status_label')->comment('Projected stock after forecast period');
            }
            if (!Schema::hasColumn('material_forecasts', 'needs_reorder')) {
                $table->boolean('needs_reorder')->default(false)->after('projected_stock')->comment('Whether material needs reordering');
            }
        });
        
        // Add indexes if they don't exist
        Schema::table('material_forecasts', function (Blueprint $table) {
            $indexes = DB::select("SHOW INDEX FROM material_forecasts WHERE Key_name = 'material_forecasts_status_needs_reorder_index'");
            if (empty($indexes)) {
                $table->index(['status', 'needs_reorder'], 'material_forecasts_status_needs_reorder_index');
            }
            $indexes = DB::select("SHOW INDEX FROM material_forecasts WHERE Key_name = 'material_forecasts_days_until_stockout_index'");
            if (empty($indexes)) {
                $table->index('days_until_stockout', 'material_forecasts_days_until_stockout_index');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Note: This migration should not be rolled back as it fixes the table structure
    }
};

