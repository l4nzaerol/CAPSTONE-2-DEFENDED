<?php

require_once 'vendor/autoload.php';

$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== Checking Inventory Table Structure ===\n\n";

try {
    $columns = DB::select('DESCRIBE inventory');
    echo "Inventory table columns:\n";
    foreach($columns as $column) {
        echo "  {$column->Field} - {$column->Type}\n";
    }
} catch (Exception $e) {
    echo "Error checking inventory table: " . $e->getMessage() . "\n";
}

echo "\n=== Checking Materials Table Structure ===\n\n";

try {
    $columns = DB::select('DESCRIBE materials');
    echo "Materials table columns:\n";
    foreach($columns as $column) {
        echo "  {$column->Field} - {$column->Type}\n";
    }
} catch (Exception $e) {
    echo "Error checking materials table: " . $e->getMessage() . "\n";
}

echo "\n=== Checking BOM Table Structure ===\n\n";

try {
    $columns = DB::select('DESCRIBE bom');
    echo "BOM table columns:\n";
    foreach($columns as $column) {
        echo "  {$column->Field} - {$column->Type}\n";
    }
} catch (Exception $e) {
    echo "Error checking BOM table: " . $e->getMessage() . "\n";
}
