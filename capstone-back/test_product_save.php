<?php

require_once 'vendor/autoload.php';

use Illuminate\Http\Request;
use App\Http\Controllers\ProductController;

// Test data for creating a product
$testData = [
    'product_name' => 'Test Product',
    'product_code' => 'TEST001',
    'description' => 'Test product description',
    'category_name' => 'Stocked Products',
    'price' => 100.00,
    'image' => 'test-image.jpg',
    'bom' => [
        [
            'material_id' => 1,
            'quantity_per_product' => 2,
            'unit_of_measure' => 'pcs'
        ]
    ]
];

echo "Testing product creation with data:\n";
print_r($testData);

try {
    $request = new Request($testData);
    $controller = new ProductController();
    
    echo "\nAttempting to create product...\n";
    $result = $controller->store($request);
    
    echo "Product created successfully!\n";
    echo "Response: " . json_encode($result->getData()) . "\n";
    
} catch (Exception $e) {
    echo "Error creating product: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}
