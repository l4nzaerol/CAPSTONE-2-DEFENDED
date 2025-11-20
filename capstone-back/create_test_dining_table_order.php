<?php
// create_test_dining_table_order.php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;

echo "=== Creating Test Dining Table Order ===" . PHP_EOL;

// Get a user (first user)
$user = User::first();
if (!$user) {
    echo "No users found. Please run user seeder first." . PHP_EOL;
    exit;
}

// Get Dining Table product
$diningTable = Product::where('name', 'Dining Table')->first();
if (!$diningTable) {
    echo "Dining Table product not found. Please run product seeder first." . PHP_EOL;
    exit;
}

// Create order
$order = Order::create([
    'user_id' => $user->id,
    'status' => 'pending',
    'acceptance_status' => 'pending',
    'total_amount' => $diningTable->price * 1,
    'total_price' => $diningTable->price * 1,
    'payment_status' => 'cod_pending',
    'shipping_address' => 'Test Address',
    'notes' => 'Test order for Dining Table'
]);

// Create order item
OrderItem::create([
    'order_id' => $order->id,
    'product_id' => $diningTable->id,
    'quantity' => 1,
    'price' => $diningTable->price
]);

echo "Created order #{$order->id} for Dining Table" . PHP_EOL;
echo "Order status: {$order->status}" . PHP_EOL;
echo "Acceptance status: {$order->acceptance_status}" . PHP_EOL;
echo "Total amount: {$order->total_amount}" . PHP_EOL;

echo PHP_EOL . "=== Order Created ===" . PHP_EOL;
