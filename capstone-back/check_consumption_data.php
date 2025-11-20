<?php

require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use App\Models\InventoryItem;
use App\Models\InventoryUsage;
use App\Models\AlkansyaDailyOutput;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Checking consumption data...\n";

try {
    // Check inventory items
    $inventoryItems = InventoryItem::count();
    echo "Inventory items: $inventoryItems\n";

    // Check consumption data
    $consumptionCount = InventoryUsage::count();
    echo "Consumption records: $consumptionCount\n";

    // Check Alkansya daily output
    $alkansyaOutput = AlkansyaDailyOutput::count();
    echo "Alkansya daily output records: $alkansyaOutput\n";

    // Check recent consumption (last 30 days)
    $recentConsumption = InventoryUsage::where('date', '>=', now()->subDays(30))->count();
    echo "Recent consumption (last 30 days): $recentConsumption\n";

    // Show some sample data
    if ($consumptionCount > 0) {
        echo "\nSample consumption data:\n";
        $sample = InventoryUsage::with('inventoryItem')->latest()->take(5)->get();
        foreach ($sample as $usage) {
            echo "- {$usage->inventoryItem->name}: {$usage->qty_used} on {$usage->date}\n";
        }
    }

    if ($alkansyaOutput > 0) {
        echo "\nSample Alkansya output:\n";
        $sample = AlkansyaDailyOutput::latest()->take(5)->get();
        foreach ($sample as $output) {
            echo "- {$output->date}: {$output->quantity_produced} units\n";
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
