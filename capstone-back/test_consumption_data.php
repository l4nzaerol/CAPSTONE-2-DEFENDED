<?php

require_once 'vendor/autoload.php';

use App\Models\AlkansyaDailyOutput;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Material;
use App\Models\BOM;
use Carbon\Carbon;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== Consumption Data Test ===\n\n";

// Check Alkansya daily output records
echo "1. Checking Alkansya Daily Output Records:\n";
$alkansyaRecords = AlkansyaDailyOutput::count();
echo "   Total records: $alkansyaRecords\n";

if ($alkansyaRecords > 0) {
    $recentRecords = AlkansyaDailyOutput::orderBy('date', 'desc')->limit(5)->get();
    echo "   Recent records:\n";
    foreach ($recentRecords as $record) {
        echo "   - Date: {$record->date}, Quantity: {$record->quantity_produced}\n";
    }
} else {
    echo "   No Alkansya daily output records found.\n";
}

echo "\n";

// Check accepted orders
echo "2. Checking Accepted Orders:\n";
$acceptedOrders = Order::where('acceptance_status', 'accepted')->count();
echo "   Total accepted orders: $acceptedOrders\n";

if ($acceptedOrders > 0) {
    $recentOrders = Order::where('acceptance_status', 'accepted')
        ->orderBy('accepted_at', 'desc')
        ->limit(5)
        ->get();
    echo "   Recent accepted orders:\n";
    foreach ($recentOrders as $order) {
        echo "   - Order #{$order->id}, Date: {$order->accepted_at}, Total: ₱{$order->total_price}\n";
    }
} else {
    echo "   No accepted orders found.\n";
}

echo "\n";

// Check all orders
echo "3. Checking All Orders:\n";
$allOrders = Order::count();
$pendingOrders = Order::where('acceptance_status', 'pending')->count();
$rejectedOrders = Order::where('acceptance_status', 'rejected')->count();

echo "   Total orders: $allOrders\n";
echo "   Pending orders: $pendingOrders\n";
echo "   Rejected orders: $rejectedOrders\n";

echo "\n";

// Check products
echo "4. Checking Products:\n";
$alkansyaProducts = Product::where('category_name', 'Stocked Products')
    ->where('name', 'Alkansya')
    ->count();
$madeToOrderProducts = Product::where('category_name', 'Made-to-Order Products')->count();

echo "   Alkansya products: $alkansyaProducts\n";
echo "   Made-to-order products: $madeToOrderProducts\n";

echo "\n";

// Check materials
echo "5. Checking Materials:\n";
$materials = Material::count();
echo "   Total materials: $materials\n";

if ($materials > 0) {
    $sampleMaterials = Material::limit(3)->get();
    echo "   Sample materials:\n";
    foreach ($sampleMaterials as $material) {
        echo "   - {$material->material_name} (ID: {$material->material_id})\n";
    }
}

echo "\n";

// Check BOMs
echo "6. Checking BOMs:\n";
$boms = BOM::count();
echo "   Total BOMs: $boms\n";

if ($boms > 0) {
    $sampleBoms = BOM::with('product', 'material')->limit(3)->get();
    echo "   Sample BOMs:\n";
    foreach ($sampleBoms as $bom) {
        echo "   - Product: {$bom->product->name}, Material: {$bom->material->material_name}, Qty: {$bom->quantity_per_product}\n";
    }
}

echo "\n=== Test Complete ===\n";
