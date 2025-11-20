<?php
// test_order_acceptance.php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Order;
use App\Models\InventoryItem;

echo "=== Testing Order Acceptance ===" . PHP_EOL . PHP_EOL;

// Check if there are any orders that can be accepted
$orders = Order::where('acceptance_status', 'pending')
    ->with(['items.product'])
    ->get();

echo "Orders pending acceptance: " . $orders->count() . PHP_EOL;

foreach ($orders as $order) {
    echo "Order #{$order->id}:" . PHP_EOL;
    foreach ($order->items as $item) {
        echo "  - {$item->product->name} (Qty: {$item->quantity})" . PHP_EOL;
    }
    echo PHP_EOL;
}

// Check current inventory status
echo "Current inventory status:" . PHP_EOL;
$inventoryItems = InventoryItem::where('category', 'made-to-order')->get();
foreach ($inventoryItems as $item) {
    echo "  {$item->name}: {$item->status} (Count: {$item->production_count})" . PHP_EOL;
}

echo PHP_EOL . "=== Test Complete ===" . PHP_EOL;
