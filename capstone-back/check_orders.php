<?php
// check_orders.php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Order;

echo "=== Checking Existing Orders ===" . PHP_EOL;

$orders = Order::select('id', 'payment_status', 'status', 'acceptance_status')->get();

foreach ($orders as $order) {
    echo "Order #{$order->id}:" . PHP_EOL;
    echo "  Status: {$order->status}" . PHP_EOL;
    echo "  Payment Status: {$order->payment_status}" . PHP_EOL;
    echo "  Acceptance Status: {$order->acceptance_status}" . PHP_EOL;
    echo PHP_EOL;
}

echo "=== Check Complete ===" . PHP_EOL;
