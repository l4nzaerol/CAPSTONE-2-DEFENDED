<?php

require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use App\Models\InventoryTransaction;
use App\Models\Material;
use App\Models\Product;
use Carbon\Carbon;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Creating test transaction data...\n";

try {
    // Get some materials and products
    $materials = Material::take(5)->get();
    $products = Product::take(3)->get();
    
    if ($materials->isEmpty()) {
        echo "No materials found. Please run material seeders first.\n";
        exit(1);
    }
    
    if ($products->isEmpty()) {
        echo "No products found. Please run product seeders first.\n";
        exit(1);
    }
    
    echo "Found " . $materials->count() . " materials and " . $products->count() . " products\n";
    
    // Clear existing test transactions
    InventoryTransaction::where('reference', 'like', 'TEST_%')->delete();
    echo "Cleared existing test transactions\n";
    
    $transactionTypes = [
        'PURCHASE',
        'CONSUMPTION', 
        'ADJUSTMENT',
        'PRODUCTION_OUTPUT',
        'ALKANSYA_CONSUMPTION',
        'ORDER_CONSUMPTION',
        'ORDER_FULFILLMENT'
    ];
    
    $testTransactions = [];
    $currentDate = Carbon::now()->subDays(30);
    
    // Generate transactions for the last 30 days
    for ($i = 0; $i < 30; $i++) {
        $date = $currentDate->copy();
        
        // Generate 2-5 transactions per day
        $transactionsPerDay = rand(2, 5);
        
        for ($j = 0; $j < $transactionsPerDay; $j++) {
            $material = $materials->random();
            $product = $products->random();
            $transactionType = $transactionTypes[array_rand($transactionTypes)];
            
            // Determine quantity and direction
            $quantity = rand(1, 20);
            $isInbound = in_array($transactionType, ['PURCHASE', 'PRODUCTION_OUTPUT', 'ORDER_FULFILLMENT']);
            $finalQuantity = $isInbound ? $quantity : -$quantity;
            
            // Generate reference
            $reference = 'TEST_' . strtoupper($transactionType) . '_' . $date->format('Ymd') . '_' . rand(1000, 9999);
            
            // Generate costs
            $unitCost = rand(10, 100);
            $totalCost = $quantity * $unitCost;
            
            $testTransactions[] = [
                'material_id' => $material->material_id,
                'product_id' => $product->id,
                'transaction_type' => $transactionType,
                'quantity' => $finalQuantity,
                'unit_cost' => $unitCost,
                'total_cost' => $totalCost,
                'reference' => $reference,
                'timestamp' => $date->addMinutes(rand(0, 1439))->toDateTimeString(),
                'remarks' => 'Test transaction for ' . $material->material_name,
                'status' => 'completed',
                'priority' => 'normal',
                'metadata' => json_encode([
                    'test_data' => true,
                    'created_by' => 'test_script',
                    'material_name' => $material->material_name,
                    'product_name' => $product->name
                ]),
                'created_at' => now(),
                'updated_at' => now()
            ];
        }
        
        $currentDate->addDay();
    }
    
    // Insert transactions in batches
    $chunks = array_chunk($testTransactions, 100);
    foreach ($chunks as $chunk) {
        InventoryTransaction::insert($chunk);
    }
    
    echo "Created " . count($testTransactions) . " test transactions\n";
    
    // Update material stock based on transactions
    foreach ($materials as $material) {
        $materialTransactions = collect($testTransactions)->where('material_id', $material->material_id);
        $netQuantity = $materialTransactions->sum('quantity');
        
        $newStock = max(0, $material->current_stock + $netQuantity);
        $material->update(['current_stock' => $newStock]);
    }
    
    echo "Updated material stock based on transactions\n";
    echo "Test transaction data created successfully!\n";
    echo "You can now test the enhanced transactions system.\n";

} catch (Exception $e) {
    echo "Error creating test data: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}
