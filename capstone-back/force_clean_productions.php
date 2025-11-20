<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== Force Clean Invalid Productions ===\n\n";

// Get ALL productions
$allProductions = App\Models\Production::all();
echo "Total productions in database: " . $allProductions->count() . "\n\n";

// Show all productions with their order IDs
echo "All productions:\n";
foreach ($allProductions as $p) {
    $order = App\Models\Order::find($p->order_id);
    echo sprintf(
        "Production #%d | Order #%d | %s | Order Status: %s | Acceptance: %s\n",
        $p->id,
        $p->order_id,
        $p->product_name,
        $order ? $order->status : 'ORDER NOT FOUND',
        $order ? $order->acceptance_status : 'N/A'
    );
}

// Find and delete productions for orders 1 and 2
echo "\n=== Checking for Productions with Order ID 1 or 2 ===\n\n";

$invalidProds = App\Models\Production::whereIn('order_id', [1, 2])->get();

if ($invalidProds->count() > 0) {
    echo "❌ FOUND " . $invalidProds->count() . " invalid productions:\n";
    foreach ($invalidProds as $p) {
        echo "  - Production #$p->id | Order #$p->order_id | $p->product_name\n";
        
        // Delete processes first
        $processCount = $p->processes()->count();
        $p->processes()->delete();
        
        // Delete production
        $p->delete();
        
        echo "    ✓ Deleted production and $processCount processes\n";
    }
    echo "\n✓ Cleanup complete!\n";
} else {
    echo "✓ No invalid productions found!\n";
}

// Final count
echo "\n=== Final Count ===\n\n";
$finalCount = App\Models\Production::count();
echo "Total productions remaining: $finalCount\n";

// Show remaining productions
$remaining = App\Models\Production::orderBy('id')->get();
echo "\nRemaining productions:\n";
foreach ($remaining as $p) {
    echo "  Production #$p->id | Order #$p->order_id | $p->product_name\n";
}
