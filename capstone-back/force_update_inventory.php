<?php
// force_update_inventory.php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\InventoryItem;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

echo "=== Force Updating Inventory Status ===" . PHP_EOL;

// Get the Wooden Chair inventory item
$woodenChairItem = InventoryItem::where('name', 'Wooden Chair (Made-to-Order)')->first();
if ($woodenChairItem) {
    echo "Found Wooden Chair item: {$woodenChairItem->name}" . PHP_EOL;
    echo "Current status: {$woodenChairItem->status}" . PHP_EOL;
    echo "Current production status: {$woodenChairItem->production_status}" . PHP_EOL;
    echo "Current production count: {$woodenChairItem->production_count}" . PHP_EOL;
    
    // Force update
    $woodenChairItem->status = 'in_production';
    $woodenChairItem->production_status = 'in_production';
    $woodenChairItem->production_count = 1;
    $woodenChairItem->save();
    
    echo "Updated status to: {$woodenChairItem->fresh()->status}" . PHP_EOL;
    echo "Updated production status to: {$woodenChairItem->fresh()->production_status}" . PHP_EOL;
    echo "Updated production count to: {$woodenChairItem->fresh()->production_count}" . PHP_EOL;
} else {
    echo "Wooden Chair inventory item not found!" . PHP_EOL;
}

echo "=== Update Complete ===" . PHP_EOL;
