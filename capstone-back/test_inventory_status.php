<?php
// test_inventory_status.php
// This script tests the inventory status for made-to-order products

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Facades\DB;

echo "=== Testing Made-to-Order Inventory Status ===" . PHP_EOL . PHP_EOL;

// Check made-to-order inventory items
echo "1. Made-to-Order Inventory Items:" . PHP_EOL;
$madeToOrderItems = InventoryItem::where('category', 'made-to-order')->get();
foreach ($madeToOrderItems as $item) {
    echo "   - {$item->name} (SKU: {$item->sku})" . PHP_EOL;
    echo "     Status: {$item->status}" . PHP_EOL;
    echo "     Production Status: {$item->production_status}" . PHP_EOL;
    echo "     Production Count: {$item->production_count}" . PHP_EOL;
    echo "     Quantity on Hand: {$item->quantity_on_hand}" . PHP_EOL;
    echo PHP_EOL;
}

// Check products
echo "2. Products:" . PHP_EOL;
$products = Product::whereIn('name', ['Dining Table', 'Wooden Chair'])->get();
foreach ($products as $product) {
    echo "   - {$product->name} (ID: {$product->id})" . PHP_EOL;
}
echo PHP_EOL;

// Check orders with made-to-order products
echo "3. Orders with Made-to-Order Products:" . PHP_EOL;
$orders = Order::whereHas('items.product', function($query) {
    $query->whereIn('name', ['Dining Table', 'Wooden Chair']);
})->with(['items.product'])->get();

foreach ($orders as $order) {
    echo "   Order #{$order->id} - Status: {$order->status}, Acceptance: {$order->acceptance_status}" . PHP_EOL;
    foreach ($order->items as $item) {
        echo "     - {$item->product->name} (Qty: {$item->quantity})" . PHP_EOL;
    }
}
echo PHP_EOL;

// Check production count calculation
echo "4. Production Count Calculation:" . PHP_EOL;
$diningTableProduct = Product::where('name', 'Dining Table')->first();
$woodenChairProduct = Product::where('name', 'Wooden Chair')->first();

if ($diningTableProduct) {
    $tableCount = DB::table('orders')
        ->join('order_items', 'orders.id', '=', 'order_items.order_id')
        ->join('products', 'order_items.product_id', '=', 'products.id')
        ->whereIn('orders.status', ['processing', 'in_production'])
        ->where('products.id', $diningTableProduct->id)
        ->sum('order_items.quantity');
    echo "   Dining Table orders in production: {$tableCount}" . PHP_EOL;
}

if ($woodenChairProduct) {
    $chairCount = DB::table('orders')
        ->join('order_items', 'orders.id', '=', 'order_items.order_id')
        ->join('products', 'order_items.product_id', '=', 'products.id')
        ->whereIn('orders.status', ['processing', 'in_production'])
        ->where('products.id', $woodenChairProduct->id)
        ->sum('order_items.quantity');
    echo "   Wooden Chair orders in production: {$chairCount}" . PHP_EOL;
}

echo PHP_EOL . "=== Test Complete ===" . PHP_EOL;
