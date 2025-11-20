<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

echo "=== Testing Production API Endpoint ===\n\n";

// Simulate the API call
$query = App\Models\Production::with(['user', 'product', 'processes', 'order'])
    ->whereHas('order', function($q) {
        $q->where('acceptance_status', 'accepted');
    });

$productions = $query->orderBy('date', 'desc')->get();

echo "Total productions returned by API: " . $productions->count() . "\n\n";

foreach ($productions as $p) {
    echo sprintf(
        "ID: %d | Order: %d | Product: %s | Progress: %d%% | Status: %s | Acceptance: %s\n",
        $p->id,
        $p->order_id,
        $p->product_name,
        $p->overall_progress,
        $p->status,
        $p->order->acceptance_status ?? 'N/A'
    );
}

echo "\n=== Checking for Productions with Order ID 1 or 2 ===\n\n";

$prod1or2 = App\Models\Production::whereIn('order_id', [1, 2])->get();

if ($prod1or2->count() > 0) {
    echo "❌ FOUND " . $prod1or2->count() . " productions for Orders 1-2:\n";
    foreach ($prod1or2 as $p) {
        echo "  - Production #$p->id | Order #$p->order_id | $p->product_name\n";
    }
} else {
    echo "✓ No productions found for Orders 1-2 (correct!)\n";
}
