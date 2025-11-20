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
        // Add indexes for orders performance
        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (!Schema::hasColumn('orders', 'status')) return;
                $table->index(['status', 'created_at'], 'idx_orders_status_date');
                $table->index(['created_at'], 'idx_orders_created_at');
                $table->index(['status'], 'idx_orders_status');
            });
        }
        
        // Add indexes for order items performance
        if (Schema::hasTable('order_items')) {
            Schema::table('order_items', function (Blueprint $table) {
                if (!Schema::hasColumn('order_items', 'order_id')) return;
                $table->index(['order_id', 'product_id'], 'idx_order_items_order_product');
                $table->index(['product_id'], 'idx_order_items_product');
            });
        }
        
        // Add indexes for productions performance
        if (Schema::hasTable('productions')) {
            Schema::table('productions', function (Blueprint $table) {
                if (!Schema::hasColumn('productions', 'order_id')) return;
                $table->index(['order_id', 'status'], 'idx_productions_order_status');
                $table->index(['status'], 'idx_productions_status');
                $table->index(['created_at'], 'idx_productions_created_at');
            });
        }
        
        // Add indexes for production processes performance
        if (Schema::hasTable('production_processes')) {
            Schema::table('production_processes', function (Blueprint $table) {
                if (!Schema::hasColumn('production_processes', 'production_id')) return;
                $table->index(['production_id', 'status'], 'idx_processes_production_status');
                $table->index(['status'], 'idx_processes_status');
                $table->index(['process_order'], 'idx_processes_order');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Disable foreign key checks temporarily to avoid constraint issues
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        
        try {
            // Remove indexes safely - check if they exist before dropping
            if (Schema::hasTable('orders')) {
                Schema::table('orders', function (Blueprint $table) {
                    // Check if indexes exist before dropping
                    if (Schema::hasIndex('orders', 'idx_orders_status_date')) {
                        $table->dropIndex('idx_orders_status_date');
                    }
                    if (Schema::hasIndex('orders', 'idx_orders_created_at')) {
                        $table->dropIndex('idx_orders_created_at');
                    }
                    if (Schema::hasIndex('orders', 'idx_orders_status')) {
                        $table->dropIndex('idx_orders_status');
                    }
                });
            }
            
            if (Schema::hasTable('order_items')) {
                Schema::table('order_items', function (Blueprint $table) {
                    // Only drop indexes that are not used by foreign key constraints
                    // The idx_order_items_order_product index might be used by foreign keys
                    // so we'll skip it to avoid the constraint error
                    if (Schema::hasIndex('order_items', 'idx_order_items_product')) {
                        $table->dropIndex('idx_order_items_product');
                    }
                    // Skip idx_order_items_order_product as it's likely used by foreign key
                });
            }
            
            if (Schema::hasTable('productions')) {
                Schema::table('productions', function (Blueprint $table) {
                    if (Schema::hasIndex('productions', 'idx_productions_order_status')) {
                        $table->dropIndex('idx_productions_order_status');
                    }
                    if (Schema::hasIndex('productions', 'idx_productions_status')) {
                        $table->dropIndex('idx_productions_status');
                    }
                    if (Schema::hasIndex('productions', 'idx_productions_created_at')) {
                        $table->dropIndex('idx_productions_created_at');
                    }
                });
            }
            
            if (Schema::hasTable('production_processes')) {
                Schema::table('production_processes', function (Blueprint $table) {
                    if (Schema::hasIndex('production_processes', 'idx_processes_production_status')) {
                        $table->dropIndex('idx_processes_production_status');
                    }
                    if (Schema::hasIndex('production_processes', 'idx_processes_status')) {
                        $table->dropIndex('idx_processes_status');
                    }
                    if (Schema::hasIndex('production_processes', 'idx_processes_order')) {
                        $table->dropIndex('idx_processes_order');
                    }
                });
            }
        } catch (Exception $e) {
            // Log the error but don't fail the migration
            \Log::error('Error dropping indexes: ' . $e->getMessage());
        } finally {
            // Re-enable foreign key checks
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        }
    }
};
