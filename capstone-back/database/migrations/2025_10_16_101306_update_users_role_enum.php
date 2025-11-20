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
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['customer', 'employee', 'staff'])->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // First, update any 'staff' roles to 'employee' before changing the enum
        DB::table('users')
            ->where('role', 'staff')
            ->update(['role' => 'employee']);
            
        // Then change the enum to only allow 'customer' and 'employee'
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['customer', 'employee'])->change();
        });
    }
};
