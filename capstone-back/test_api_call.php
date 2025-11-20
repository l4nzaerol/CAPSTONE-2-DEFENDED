<?php

// Simple test to check product creation
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

echo "Testing with data:\n";
print_r($testData);

// Test the API endpoint directly
$url = 'http://localhost:8000/api/products';
$options = [
    'http' => [
        'header' => "Content-type: application/json\r\n",
        'method' => 'POST',
        'content' => json_encode($testData)
    ]
];

$context = stream_context_create($options);
$result = file_get_contents($url, false, $context);

if ($result === FALSE) {
    echo "Error: Could not connect to API\n";
} else {
    echo "API Response:\n";
    echo $result . "\n";
}
