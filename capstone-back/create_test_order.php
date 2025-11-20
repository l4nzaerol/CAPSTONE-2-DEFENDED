<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Models\OrderTracking;

echo "=== Creating Test Order ===\n\n";

$customer = User::where('email', 'customer@gmail.com')->first();
$product = Product::where('name', 'Dining Table')->first();

if (!$customer || !$product) {
    echo "Customer or product not found!\n";
    exit;
}

$order = Order::create([
    'user_id' => $customer->id,
    'total_price' => $product->price,
    'status' => 'pending',
    'acceptance_status' => 'pending',
    'checkout_date' => now(),
    'payment_method' => 'maya',
    'payment_status' => 'paid',
    'shipping_address' => '123 Test Street',
    'contact_phone' => '+63 917 123 4567',
]);

OrderItem::create([
    'order_id' => $order->id,
    'product_id' => $product->id,
    'quantity' => 1,
    'price' => $product->price,
]);

OrderTracking::create([
    'order_id' => $order->id,
    'product_id' => $product->id,
    'tracking_type' => 'custom',
    'current_stage' => 'Material Preparation',
    'status' => 'pending',
    'estimated_start_date' => now(),
    'estimated_completion_date' => now()->addWeeks(2),
    'process_timeline' => [],
]);

echo "✅ Test order created!\n";
echo "Order ID: {$order->id}\n";
echo "Product: {$product->name}\n";
echo "Status: pending acceptance\n\n";
echo "Now go to Order Acceptance page and accept this order!\n";
