<?php

require_once 'vendor/autoload.php';

use Illuminate\Http\Request;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Validator;

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

echo "Testing validation rules:\n";

// Test validation rules directly
$rules = [
    'name' => 'sometimes|required|string|max:255',
    'product_name' => 'sometimes|required|string|max:255',
    'product_code' => 'required|string|unique:products,product_code',
    'description' => 'nullable|string',
    'category_name' => 'nullable|string',
    'price' => 'required|numeric|min:0',
    'image' => 'nullable|string',
    'bom' => 'nullable|array',
    'bom.*.material_id' => 'required|exists:materials,material_id',
    'bom.*.quantity_per_product' => 'required|numeric|min:0',
    'bom.*.unit_of_measure' => 'required|string',
    'is_available_for_order' => 'nullable|boolean',
];

$validator = Validator::make($testData, $rules);

if ($validator->fails()) {
    echo "Validation failed:\n";
    print_r($validator->errors()->toArray());
} else {
    echo "Validation passed!\n";
}

// Check if material_id 1 exists
echo "\nChecking if material_id 1 exists:\n";
try {
    $material = \App\Models\Material::find(1);
    if ($material) {
        echo "Material found: " . $material->material_name . "\n";
    } else {
        echo "Material with ID 1 not found!\n";
    }
} catch (Exception $e) {
    echo "Error checking material: " . $e->getMessage() . "\n";
}
