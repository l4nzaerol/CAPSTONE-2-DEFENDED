<?php

require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use App\Models\InventoryItem;
use App\Models\InventoryUsage;
use App\Models\AlkansyaDailyOutput;
use App\Models\Product;
use App\Models\ProductMaterial;
use App\Models\Order;
use App\Models\OrderItem;
use Carbon\Carbon;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Creating test consumption data for enhanced replenishment system...\n";

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

    // Get made-to-order products
    $madeToOrderProducts = Product::where('category_name', 'Made-to-Order')
        ->with(['productMaterials.inventoryItem'])
        ->get();
    echo "Found " . $madeToOrderProducts->count() . " made-to-order products\n";

    // Get historical Alkansya daily output
    $historicalOutput = AlkansyaDailyOutput::orderBy('date')->get();
    echo "Found " . $historicalOutput->count() . " Alkansya daily output records\n";

    // Get historical orders
    $historicalOrders = Order::with(['orderItems' => function($query) use ($madeToOrderProducts) {
        $query->whereIn('product_id', $madeToOrderProducts->pluck('id'));
    }])->get();
    echo "Found " . $historicalOrders->count() . " historical orders\n";

    // Clear existing usage data for the last 90 days
    $startDate = Carbon::now()->subDays(90);
    InventoryUsage::where('date', '>=', $startDate)->delete();
    echo "Cleared existing usage data from " . $startDate->format('Y-m-d') . "\n";

    // Generate consumption data for the last 90 days
    $consumptionData = [];
    $currentDate = $startDate->copy();

    while ($currentDate->lte(Carbon::now())) {
        $dateStr = $currentDate->format('Y-m-d');
        
        // Get Alkansya output for this date
        $dailyOutput = $historicalOutput->where('date', $dateStr)->first();
        $outputQuantity = $dailyOutput ? $dailyOutput->quantity_produced : 0;
        
        // If no output for this date, generate some random production (weekdays only)
        if ($outputQuantity == 0 && $currentDate->isWeekday()) {
            $outputQuantity = rand(5, 25); // Random production between 5-25 units
        }

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

        // Generate made-to-order material consumption
        $dayOrders = $historicalOrders->filter(function($order) use ($currentDate) {
            return Carbon::parse($order->created_at)->format('Y-m-d') === $currentDate->format('Y-m-d');
        });

        foreach ($dayOrders as $order) {
            foreach ($order->orderItems as $orderItem) {
                $product = $madeToOrderProducts->find($orderItem->product_id);
                if ($product) {
                    foreach ($product->productMaterials as $productMaterial) {
                        $inventoryItem = $productMaterial->inventoryItem;
                        $qtyPerUnit = $productMaterial->qty_per_unit;
                        $consumption = $orderItem->quantity * $qtyPerUnit;
                        
                        if ($consumption > 0) {
                            // Add some variation (±15%)
                            $variation = rand(85, 115) / 100;
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
                }
            }
        }

        // Generate some random consumption for other materials (maintenance, etc.)
        if ($currentDate->isWeekday() && rand(1, 3) == 1) { // 33% chance on weekdays
            $randomItems = $inventoryItems->random(rand(1, 3));
            foreach ($randomItems as $item) {
                // Skip if already consumed by production
                $alreadyConsumed = collect($consumptionData)->where('inventory_item_id', $item->id)
                    ->where('date', $dateStr)->isNotEmpty();
                
                if (!$alreadyConsumed) {
                    $randomConsumption = rand(1, 5); // Random consumption 1-5 units
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

    // Generate some additional Alkansya daily output if needed
    if ($historicalOutput->count() < 30) {
        echo "Generating additional Alkansya daily output records...\n";
        
        $currentDate = Carbon::now()->subDays(60);
        while ($currentDate->lte(Carbon::now())) {
            if ($currentDate->isWeekday()) {
                $existingOutput = AlkansyaDailyOutput::where('date', $currentDate->format('Y-m-d'))->first();
                if (!$existingOutput) {
                    $quantity = rand(10, 30);
                    AlkansyaDailyOutput::create([
                        'date' => $currentDate->format('Y-m-d'),
                        'quantity_produced' => $quantity,
                        'produced_by' => 'System Generated',
                        'materials_used' => []
                    ]);
                }
            }
            $currentDate->addDay();
        }
    }

    DB::commit();
    echo "Test consumption data created successfully!\n";
    echo "You can now test the enhanced replenishment system.\n";

} catch (Exception $e) {
    DB::rollBack();
    echo "Error creating test data: " . $e->getMessage() . "\n";
    exit(1);
}