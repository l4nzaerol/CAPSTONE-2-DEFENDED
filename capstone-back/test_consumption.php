<?php

require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use App\Models\InventoryItem;
use App\Models\InventoryUsage;
use App\Models\AlkansyaDailyOutput;
use Carbon\Carbon;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Creating test consumption data...\n";

try {
    // Get some inventory items
    $inventoryItems = InventoryItem::take(5)->get();
    echo "Found " . $inventoryItems->count() . " inventory items\n";

    if ($inventoryItems->isEmpty()) {
        echo "No inventory items found!\n";
        exit(1);
    }

    // Create some test consumption data for the last 7 days
    for ($i = 1; $i <= 7; $i++) {
        $date = Carbon::now()->subDays($i)->format('Y-m-d');
        
        foreach ($inventoryItems as $item) {
            $consumption = rand(1, 5);
            
            InventoryUsage::create([
                'inventory_item_id' => $item->id,
                'qty_used' => $consumption,
                'date' => $date,
            ]);
        }
    }

    // Create some Alkansya daily output
    for ($i = 1; $i <= 7; $i++) {
        $date = Carbon::now()->subDays($i)->format('Y-m-d');
        
        AlkansyaDailyOutput::create([
            'date' => $date,
            'quantity_produced' => rand(10, 20),
            'produced_by' => 'Test Data',
            'materials_used' => []
        ]);
    }

    echo "Created test consumption data successfully!\n";
    echo "Consumption records: " . InventoryUsage::count() . "\n";
    echo "Alkansya output records: " . AlkansyaDailyOutput::count() . "\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}