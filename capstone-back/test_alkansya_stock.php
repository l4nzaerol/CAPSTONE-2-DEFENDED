<?php

require_once 'vendor/autoload.php';

$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Product;
use App\Models\AlkansyaDailyOutput;

echo "=== Testing Alkansya Stock Update ===\n\n";

// Check current stock before daily output
echo "Before daily output:\n";
$alkansyaProducts = Product::where('category_name', 'Stocked Products')
    ->where('name', 'Alkansya')
    ->get();

foreach($alkansyaProducts as $product) {
    echo "{$product->product_code} - {$product->product_name}: {$product->stock} units\n";
}

echo "\n";

// Test daily output
echo "Adding daily output of 10 units...\n";
try {
    $result = AlkansyaDailyOutput::addDailyOutput('2024-01-15', 10, 'Test User');
    echo "Daily output added successfully!\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

echo "\n";

// Check stock after daily output
echo "After daily output:\n";
$alkansyaProducts = Product::where('category_name', 'Stocked Products')
    ->where('name', 'Alkansya')
    ->get();

foreach($alkansyaProducts as $product) {
    echo "{$product->product_code} - {$product->product_name}: {$product->stock} units\n";
}

echo "\n=== Test Complete ===\n";
