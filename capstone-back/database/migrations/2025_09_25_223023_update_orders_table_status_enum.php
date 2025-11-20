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
        // First, update any existing status values that don't match the new enum
        // Map any old status values to the new ones
        $statusMapping = [
            'processing' => 'pending',
            'in_progress' => 'pending',
            'shipped' => 'ready_for_delivery',
            'delivered' => 'delivered',
            'canceled' => 'cancelled',
            'cancelled' => 'cancelled'
        ];

        foreach ($statusMapping as $oldStatus => $newStatus) {
            DB::table('orders')
                ->where('status', $oldStatus)
                ->update(['status' => $newStatus]);
        }

        // Now update the enum values for the status column
        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'completed', 'ready_for_delivery', 'delivered', 'cancelled') DEFAULT 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // First, update status values to match the original enum
        $reverseStatusMapping = [
            'ready_for_delivery' => 'completed',
            'delivered' => 'completed',
            'cancelled' => 'completed'
        ];

        foreach ($reverseStatusMapping as $oldStatus => $newStatus) {
            DB::table('orders')
                ->where('status', $oldStatus)
                ->update(['status' => $newStatus]);
        }

        // Revert back to original enum values
        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'completed') DEFAULT 'pending'");
    }
};
