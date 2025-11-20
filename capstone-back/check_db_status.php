<?php
// check_db_status.php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\InventoryItem;

echo "=== Database Status Check ===" . PHP_EOL;

$items = InventoryItem::where('category', 'made-to-order')->get();
foreach ($items as $item) {
    echo "Item: {$item->name}" . PHP_EOL;
    echo "  Status: {$item->status}" . PHP_EOL;
    echo "  Production Status: {$item->production_status}" . PHP_EOL;
    echo "  Production Count: {$item->production_count}" . PHP_EOL;
    echo "  Updated At: {$item->updated_at}" . PHP_EOL;
    echo PHP_EOL;
}
