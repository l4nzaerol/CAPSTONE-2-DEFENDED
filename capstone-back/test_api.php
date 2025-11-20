<?php

require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use App\Models\InventoryTransaction;
use App\Models\Material;
use App\Models\Product;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Testing API endpoint...\n";

try {
    // Test the controller method directly
    $controller = new \App\Http\Controllers\EnhancedInventoryReportsController();
    $request = new \Illuminate\Http\Request();
    
    // Set default parameters
    $request->merge([
        'start_date' => now()->subDays(30)->format('Y-m-d'),
        'end_date' => now()->format('Y-m-d'),
        'transaction_type' => 'all',
        'limit' => 100
    ]);
    
    echo "Calling getEnhancedTransactions method...\n";
    $response = $controller->getEnhancedTransactions($request);
    
    echo "Response status: " . $response->getStatusCode() . "\n";
    $data = $response->getData(true);
    
    if (isset($data['error'])) {
        echo "Error: " . $data['error'] . "\n";
        echo "Message: " . $data['message'] . "\n";
    } else {
        echo "Success! Found " . count($data['transactions']) . " transactions\n";
        echo "Summary: " . json_encode($data['summary'], JSON_PRETTY_PRINT) . "\n";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}
