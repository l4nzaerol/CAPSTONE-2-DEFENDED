<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Add acceptance workflow fields
            $table->enum('acceptance_status', ['pending', 'accepted', 'rejected'])->default('pending')->after('status');
            $table->foreignId('accepted_by')->nullable()->constrained('users')->onDelete('set null')->after('acceptance_status');
            $table->timestamp('accepted_at')->nullable()->after('accepted_by');
            $table->text('rejection_reason')->nullable()->after('accepted_at');
            $table->text('admin_notes')->nullable()->after('rejection_reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['accepted_by']);
            $table->dropColumn([
                'acceptance_status',
                'accepted_by',
                'accepted_at',
                'rejection_reason',
                'admin_notes'
            ]);
        });
    }
};
