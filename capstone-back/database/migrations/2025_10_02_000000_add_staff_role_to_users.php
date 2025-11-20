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
        // Modify the role enum to include 'staff'
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('customer', 'employee', 'staff') NOT NULL DEFAULT 'customer'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // First, update any 'staff' users to 'employee' before reverting
        DB::table('users')->where('role', 'staff')->update(['role' => 'employee']);
        
        // Then revert back to original enum values
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('customer', 'employee') NOT NULL DEFAULT 'customer'");
    }
};
