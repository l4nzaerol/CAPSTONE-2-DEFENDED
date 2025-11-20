<?php
/**
 * Script to ensure inventory reports have accurate data
 * Run this from the backend directory: php ensure_inventory_data.php
 */

echo "🔧 Ensuring Inventory Reports Have Accurate Data\n";
echo "===============================================\n\n";

// Check if we have Alkansya production data
echo "1. Checking Alkansya Daily Output Data...\n";
$alkansyaCount = \App\Models\AlkansyaDailyOutput::count();
$alkansyaTotal = \App\Models\AlkansyaDailyOutput::sum('quantity_produced');
echo "   - Total records: {$alkansyaCount}\n";
echo "   - Total production: {$alkansyaTotal}\n";

if ($alkansyaCount == 0) {
    echo "   ⚠️  No Alkansya production data found. Running seeder...\n";
    \Artisan::call('db:seed', ['--class' => 'AlkansyaFactorySeeder']);
    echo "   ✅ Seeder completed\n";
}

// Check inventory items
echo "\n2. Checking Inventory Items...\n";
$inventoryCount = \App\Models\InventoryItem::count();
echo "   - Total inventory items: {$inventoryCount}\n";

if ($inventoryCount == 0) {
    echo "   ⚠️  No inventory items found. Running seeder...\n";
    \Artisan::call('db:seed', ['--class' => 'EnhancedInventorySeeder']);
    echo "   ✅ Seeder completed\n";
}

// Check inventory usage data
echo "\n3. Checking Inventory Usage Data...\n";
$usageCount = \App\Models\InventoryUsage::count();
$usageTotal = \App\Models\InventoryUsage::sum('qty_used');
echo "   - Total usage records: {$usageCount}\n";
echo "   - Total usage quantity: {$usageTotal}\n";

// Check if we have BOM data
echo "\n4. Checking BOM (Bill of Materials) Data...\n";
$bomCount = \App\Models\ProductMaterial::count();
echo "   - Total BOM records: {$bomCount}\n";

// Get recent statistics
echo "\n5. Recent Statistics (Last 7 Days):\n";
$last7Days = \App\Models\AlkansyaDailyOutput::where('date', '>=', \Carbon\Carbon::now()->subDays(7))
    ->sum('quantity_produced');
echo "   - Alkansya production (last 7 days): {$last7Days}\n";

$recentUsage = \App\Models\InventoryUsage::where('date', '>=', \Carbon\Carbon::now()->subDays(7))
    ->sum('qty_used');
echo "   - Material usage (last 7 days): {$recentUsage}\n";

// Test API endpoints
echo "\n6. Testing API Endpoints...\n";
$endpoints = [
    '/inventory/dashboard',
    '/inventory/report',
    '/inventory/alkansya-daily-output/statistics',
    '/inventory/alkansya-daily-output/materials-analysis'
];

foreach ($endpoints as $endpoint) {
    $url = 'http://localhost:8000/api' . $endpoint;
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => 'Content-Type: application/json',
            'timeout' => 5
        ]
    ]);
    
    $response = @file_get_contents($url, false, $context);
    if ($response !== false) {
        $data = json_decode($response, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            echo "   ✅ {$endpoint} - Working\n";
        } else {
            echo "   ⚠️  {$endpoint} - Invalid JSON\n";
        }
    } else {
        echo "   ❌ {$endpoint} - Failed\n";
    }
}

echo "\n🏁 Data verification completed!\n";
echo "If all endpoints are working, the inventory reports should display accurate data.\n";
?>
