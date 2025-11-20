<?php
// test_alkansya_factory_seeder.php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\AlkansyaDailyOutput;
use App\Models\InventoryItem;
use App\Models\ProductionAnalytics;
use App\Models\Product;

echo "=== Testing Alkansya Factory Seeder Results ===" . PHP_EOL . PHP_EOL;

// Check Alkansya daily output records
$dailyOutputCount = AlkansyaDailyOutput::count();
echo "1. Alkansya Daily Output Records: {$dailyOutputCount}" . PHP_EOL;

if ($dailyOutputCount > 0) {
    $recentOutput = AlkansyaDailyOutput::orderBy('date', 'desc')->first();
    echo "   Latest record: {$recentOutput->date} - {$recentOutput->quantity_produced} pieces" . PHP_EOL;
    
    $totalProduced = AlkansyaDailyOutput::sum('quantity_produced');
    echo "   Total produced: {$totalProduced} pieces" . PHP_EOL;
}

// Check finished goods inventory
echo PHP_EOL . "2. Finished Goods Inventory:" . PHP_EOL;
$alkansyaFinishedGoods = InventoryItem::where('sku', 'FG-ALKANSYA')->first();
if ($alkansyaFinishedGoods) {
    echo "   ✅ Alkansya (Finished Good) found:" . PHP_EOL;
    echo "   - SKU: {$alkansyaFinishedGoods->sku}" . PHP_EOL;
    echo "   - Name: {$alkansyaFinishedGoods->name}" . PHP_EOL;
    echo "   - Category: {$alkansyaFinishedGoods->category}" . PHP_EOL;
    echo "   - Quantity on Hand: {$alkansyaFinishedGoods->quantity_on_hand} pieces" . PHP_EOL;
    echo "   - Status: {$alkansyaFinishedGoods->status}" . PHP_EOL;
    echo "   - Unit Cost: ₱{$alkansyaFinishedGoods->unit_cost}" . PHP_EOL;
} else {
    echo "   ❌ Alkansya finished goods not found in inventory" . PHP_EOL;
}

// Check ProductionAnalytics sync
echo PHP_EOL . "3. ProductionAnalytics Sync:" . PHP_EOL;
$alkansyaProduct = Product::where('name', 'Alkansya')->first();
if ($alkansyaProduct) {
    $analyticsCount = ProductionAnalytics::where('product_id', $alkansyaProduct->id)->count();
    echo "   ✅ ProductionAnalytics records: {$analyticsCount}" . PHP_EOL;
    
    if ($analyticsCount > 0) {
        $totalAnalyticsOutput = ProductionAnalytics::where('product_id', $alkansyaProduct->id)->sum('actual_output');
        echo "   Total analytics output: {$totalAnalyticsOutput} pieces" . PHP_EOL;
        
        $recentAnalytics = ProductionAnalytics::where('product_id', $alkansyaProduct->id)
            ->orderBy('date', 'desc')
            ->first();
        echo "   Latest analytics: {$recentAnalytics->date} - {$recentAnalytics->actual_output} pieces" . PHP_EOL;
    }
} else {
    echo "   ❌ Alkansya product not found" . PHP_EOL;
}

// Check raw materials consumption
echo PHP_EOL . "4. Raw Materials Consumption:" . PHP_EOL;
$rawMaterials = InventoryItem::where('category', 'raw')->get();
foreach ($rawMaterials as $material) {
    echo "   - {$material->name}: {$material->quantity_on_hand} {$material->unit}" . PHP_EOL;
}

echo PHP_EOL . "=== Test Complete ===" . PHP_EOL;
