<?php

require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use App\Models\InventoryItem;
use App\Models\InventoryUsage;
use App\Models\AlkansyaDailyOutput;
use App\Models\Product;
use App\Models\ProductMaterial;
use Carbon\Carbon;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Creating basic consumption data for enhanced replenishment system...\n";

try {
    DB::beginTransaction();

    // Get all inventory items
    $inventoryItems = InventoryItem::all();
    if ($inventoryItems->isEmpty()) {
        echo "No inventory items found. Please run inventory seeders first.\n";
        exit(1);
    }

    echo "Found " . $inventoryItems->count() . " inventory items\n";

    // Get Alkansya product and BOM materials
    $alkansyaProduct = Product::where('name', 'Alkansya')->first();
    $alkansyaBomMaterials = [];
    if ($alkansyaProduct) {
        $alkansyaBomMaterials = ProductMaterial::where('product_id', $alkansyaProduct->id)
            ->with('inventoryItem')
            ->get();
        echo "Found " . $alkansyaBomMaterials->count() . " Alkansya BOM materials\n";
    }

    // Clear existing usage data for the last 90 days
    $startDate = Carbon::now()->subDays(90);
    InventoryUsage::where('date', '>=', $startDate)->delete();
    echo "Cleared existing usage data from " . $startDate->format('Y-m-d') . "\n";

    // Generate consumption data for the last 90 days
    $consumptionData = [];
    $currentDate = $startDate->copy();

    while ($currentDate->lte(Carbon::now())) {
        $dateStr = $currentDate->format('Y-m-d');
        
        // Generate Alkansya production (weekdays only)
        if ($currentDate->isWeekday()) {
            $outputQuantity = rand(8, 20); // Random production between 8-20 units
            
            // Generate Alkansya material consumption
            foreach ($alkansyaBomMaterials as $bomMaterial) {
                $inventoryItem = $bomMaterial->inventoryItem;
                $qtyPerUnit = $bomMaterial->qty_per_unit;
                $consumption = $outputQuantity * $qtyPerUnit;
                
                if ($consumption > 0) {
                    // Add some variation (±10%)
                    $variation = rand(90, 110) / 100;
                    $actualConsumption = round($consumption * $variation, 2);
                    
                    $consumptionData[] = [
                        'inventory_item_id' => $inventoryItem->id,
                        'qty_used' => $actualConsumption,
                        'date' => $dateStr,
                        'created_at' => $currentDate->toDateTimeString(),
                        'updated_at' => $currentDate->toDateTimeString(),
                    ];
                }
            }

            // Create Alkansya daily output record
            $existingOutput = AlkansyaDailyOutput::where('date', $dateStr)->first();
            if (!$existingOutput) {
                AlkansyaDailyOutput::create([
                    'date' => $dateStr,
                    'quantity_produced' => $outputQuantity,
                    'produced_by' => 'System Generated',
                    'materials_used' => []
                ]);
            }
        }

        // Generate some random consumption for other materials (maintenance, etc.)
        if ($currentDate->isWeekday() && rand(1, 4) == 1) { // 25% chance on weekdays
            $randomItems = $inventoryItems->random(rand(1, 5));
            foreach ($randomItems as $item) {
                // Skip if already consumed by Alkansya production
                $alreadyConsumed = collect($consumptionData)->where('inventory_item_id', $item->id)
                    ->where('date', $dateStr)->isNotEmpty();
                
                if (!$alreadyConsumed) {
                    $randomConsumption = rand(1, 8); // Random consumption 1-8 units
                    $consumptionData[] = [
                        'inventory_item_id' => $item->id,
                        'qty_used' => $randomConsumption,
                        'date' => $dateStr,
                        'created_at' => $currentDate->toDateTimeString(),
                        'updated_at' => $currentDate->toDateTimeString(),
                    ];
                }
            }
        }

        $currentDate->addDay();
    }

    // Insert consumption data in batches
    $chunks = array_chunk($consumptionData, 1000);
    foreach ($chunks as $chunk) {
        InventoryUsage::insert($chunk);
    }

    echo "Created " . count($consumptionData) . " consumption records\n";

    // Update inventory quantities based on consumption
    $usageByItem = collect($consumptionData)->groupBy('inventory_item_id');
    foreach ($usageByItem as $itemId => $usages) {
        $totalUsed = $usages->sum('qty_used');
        $item = InventoryItem::find($itemId);
        if ($item) {
            // Ensure we don't go below 0
            $newQuantity = max(0, $item->quantity_on_hand - $totalUsed);
            $item->update(['quantity_on_hand' => $newQuantity]);
        }
    }

    echo "Updated inventory quantities based on consumption\n";

    DB::commit();
    echo "Basic consumption data created successfully!\n";
    echo "You can now test the enhanced replenishment system.\n";
    echo "\nTo run this script, use: php create_basic_consumption_data.php\n";

} catch (Exception $e) {
    DB::rollBack();
    echo "Error creating test data: " . $e->getMessage() . "\n";
    exit(1);
}
