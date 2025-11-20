<?php
// fix_inventory_status.php
// This script manually updates inventory status for made-to-order products

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\InventoryItem;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

echo "=== Fixing Made-to-Order Inventory Status ===" . PHP_EOL . PHP_EOL;

// Get made-to-order inventory items
$madeToOrderItems = InventoryItem::where('category', 'made-to-order')->get();

foreach ($madeToOrderItems as $inventoryItem) {
    echo "Processing: {$inventoryItem->name}" . PHP_EOL;
    
    // Find the corresponding product
    $product = null;
    if (str_contains($inventoryItem->name, 'Dining Table')) {
        $product = Product::where('name', 'Dining Table')->first();
    } elseif (str_contains($inventoryItem->name, 'Wooden Chair')) {
        $product = Product::where('name', 'Wooden Chair')->first();
    }
    
    if ($product) {
        echo "  Found product: {$product->name}" . PHP_EOL;
        
        // Calculate total production count for this specific product
        $totalProductionCount = DB::table('orders')
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->whereIn('orders.status', ['processing', 'in_production'])
            ->where('products.id', $product->id)
            ->sum('order_items.quantity');
        
        echo "  Production count: {$totalProductionCount}" . PHP_EOL;
        
        // Debug: Let's also check what orders exist
        $debugOrders = DB::table('orders')
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('products.id', $product->id)
            ->select('orders.id', 'orders.status', 'orders.acceptance_status', 'order_items.quantity')
            ->get();
        
        echo "  Debug - Orders for this product:" . PHP_EOL;
        foreach ($debugOrders as $debugOrder) {
            echo "    Order #{$debugOrder->id} - Status: {$debugOrder->status}, Acceptance: {$debugOrder->acceptance_status}, Qty: {$debugOrder->quantity}" . PHP_EOL;
        }
        
        // Update inventory status
        $inventoryItem->update([
            'status' => $totalProductionCount > 0 ? 'in_production' : 'not_in_production',
            'production_status' => $totalProductionCount > 0 ? 'in_production' : 'not_in_production',
            'production_count' => $totalProductionCount
        ]);
        
        echo "  Updated status: " . ($totalProductionCount > 0 ? 'in_production' : 'not_in_production') . PHP_EOL;
    } else {
        echo "  No corresponding product found" . PHP_EOL;
    }
    
    echo PHP_EOL;
}

echo "=== Fix Complete ===" . PHP_EOL;
