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
            $table->boolean('receipt_confirmed')->nullable()->after('status');
            $table->timestamp('receipt_confirmed_at')->nullable()->after('receipt_confirmed');
            $table->text('not_received_reason')->nullable()->after('receipt_confirmed_at');
            $table->timestamp('not_received_at')->nullable()->after('not_received_reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['receipt_confirmed', 'receipt_confirmed_at', 'not_received_reason', 'not_received_at']);
        });
    }
};
