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
        // Add 'processing' status to orders table enum
        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'processing', 'completed', 'ready_for_delivery', 'delivered', 'cancelled') DEFAULT 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // First update any 'processing' status to 'pending' before removing it from enum
        DB::table('orders')->where('status', 'processing')->update(['status' => 'pending']);
        
        // Then revert back to previous enum values
        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'completed', 'ready_for_delivery', 'delivered', 'cancelled') DEFAULT 'pending'");
    }
};
