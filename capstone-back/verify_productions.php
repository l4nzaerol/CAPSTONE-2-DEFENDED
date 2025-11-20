<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== Productions Verification ===\n\n";

$productions = App\Models\Production::with('order')->orderBy('id')->get();

echo "Total Productions: " . $productions->count() . "\n\n";

foreach ($productions as $p) {
    $order = $p->order;
    echo sprintf(
        "Production #%d | Order #%d | %s | Progress: %d%% | Order Acceptance: %s\n",
        $p->id,
        $p->order_id,
        $p->product_name,
        $p->overall_progress,
        $order ? $order->acceptance_status : 'N/A'
    );
}

echo "\n=== Orders Summary ===\n\n";

$orders = App\Models\Order::orderBy('id')->get();
foreach ($orders as $order) {
    $hasProduction = App\Models\Production::where('order_id', $order->id)->exists();
    echo sprintf(
        "Order #%d | Status: %s | Acceptance: %s | Has Production: %s\n",
        $order->id,
        $order->status,
        $order->acceptance_status,
        $hasProduction ? 'YES' : 'NO'
    );
}

echo "\n=== Production Controller Filter Test ===\n\n";

// Simulate what ProductionController does
$filteredProductions = App\Models\Production::with(['order'])
    ->whereHas('order', function($q) {
        $q->where('acceptance_status', 'accepted');
    })
    ->get();

echo "Productions with accepted orders: " . $filteredProductions->count() . "\n";
foreach ($filteredProductions as $p) {
    echo sprintf(
        "  - Production #%d | Order #%d | %s\n",
        $p->id,
        $p->order_id,
        $p->product_name
    );
}
