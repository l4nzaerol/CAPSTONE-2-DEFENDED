<?php

require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use App\Models\InventoryTransaction;
use App\Models\Material;
use App\Models\Product;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Testing transactions data...\n";

try {
    // Check counts
    $transactionCount = InventoryTransaction::count();
    $materialCount = Material::count();
    $productCount = Product::count();
    
    echo "InventoryTransaction count: $transactionCount\n";
    echo "Material count: $materialCount\n";
    echo "Product count: $productCount\n";
    
    if ($transactionCount > 0) {
        echo "\nSample transactions:\n";
        $transactions = InventoryTransaction::with(['material', 'product'])->take(3)->get();
        foreach ($transactions as $transaction) {
            echo "- ID: {$transaction->transaction_id}, Type: {$transaction->transaction_type}, Material: " . 
                 ($transaction->material ? $transaction->material->material_name : 'N/A') . 
                 ", Product: " . ($transaction->product ? $transaction->product->name : 'N/A') . "\n";
        }
    }
    
    if ($materialCount > 0) {
        echo "\nSample materials:\n";
        $materials = Material::take(3)->get();
        foreach ($materials as $material) {
            echo "- ID: {$material->material_id}, Name: {$material->material_name}, Code: {$material->material_code}\n";
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}
