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
        // Fix inventory table foreign key constraint
        try {
            DB::statement('ALTER TABLE inventory DROP FOREIGN KEY inventory_material_id_foreign');
        } catch (Exception $e) {
            // Ignore if constraint doesn't exist
        }
        
        DB::statement('ALTER TABLE inventory ADD CONSTRAINT inventory_material_id_foreign FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE CASCADE');
        
        // Fix inventory_transactions table foreign key constraint (only if table exists)
        if (Schema::hasTable('inventory_transactions')) {
            try {
                DB::statement('ALTER TABLE inventory_transactions DROP FOREIGN KEY inventory_transactions_material_id_foreign');
            } catch (Exception $e) {
                // Ignore if constraint doesn't exist
            }
            
            DB::statement('ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_material_id_foreign FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE CASCADE');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Note: This migration should not be rolled back as it fixes critical foreign key constraints
        // Rolling back would break the system by pointing to the wrong table (raw_materials)
        // The down method is intentionally left empty to prevent accidental rollback
    }
};
