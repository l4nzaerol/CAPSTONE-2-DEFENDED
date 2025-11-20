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
        // For MariaDB compatibility, we need to use raw SQL for column renaming
        DB::statement('ALTER TABLE `inventory` CHANGE `quantity_on_hand` `current_stock` DECIMAL(10,2) DEFAULT 0');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // For MariaDB compatibility, we need to use raw SQL for column renaming
        DB::statement('ALTER TABLE `inventory` CHANGE `current_stock` `quantity_on_hand` DECIMAL(10,2) DEFAULT 0');
    }
};
