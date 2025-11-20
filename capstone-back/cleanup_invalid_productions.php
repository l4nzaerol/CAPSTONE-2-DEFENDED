<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== Checking for Invalid Productions ===\n\n";

// Check for productions linked to pending orders
$invalidProductions = App\Models\Production::whereHas('order', function($q) {
    $q->where('acceptance_status', '!=', 'accepted');
})->with('order')->get();

echo "Found " . $invalidProductions->count() . " productions linked to non-accepted orders:\n\n";

foreach ($invalidProductions as $prod) {
    echo sprintf(
        "Production #%d | Order #%d | Product: %s | Order Status: %s | Acceptance: %s\n",
        $prod->id,
        $prod->order_id,
        $prod->product_name,
        $prod->order->status ?? 'N/A',
        $prod->order->acceptance_status ?? 'N/A'
    );
}

if ($invalidProductions->count() > 0) {
    echo "\n=== Deleting Invalid Productions ===\n\n";
    
    foreach ($invalidProductions as $prod) {
        // Delete production processes first
        $processCount = $prod->processes()->count();
        $prod->processes()->delete();
        
        // Delete the production
        $prod->delete();
        
        echo "✓ Deleted Production #$prod->id (Order #$prod->order_id) and $processCount processes\n";
    }
    
    echo "\n✓ Cleanup complete!\n";
} else {
    echo "\n✓ No invalid productions found. Database is clean!\n";
}

echo "\n=== Current Valid Productions ===\n\n";

$validProductions = App\Models\Production::whereHas('order', function($q) {
    $q->where('acceptance_status', 'accepted');
})->with('order')->get();

echo "Total valid productions: " . $validProductions->count() . "\n\n";

foreach ($validProductions as $prod) {
    echo sprintf(
        "Production #%d | Order #%d | %s | Progress: %d%%\n",
        $prod->id,
        $prod->order_id,
        $prod->product_name,
        $prod->overall_progress
    );
}
