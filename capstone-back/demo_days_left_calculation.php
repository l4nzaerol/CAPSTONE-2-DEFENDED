<?php

/**
 * Interactive Demo: Days Left and Status Calculation
 * 
 * This script demonstrates step-by-step how "Days Left" and "Status"
 * are calculated for materials in the forecast summary.
 */

echo "=== Days Left and Status Calculation Demo ===\n";
echo "NOTE: This demo uses ACTUAL database values, not hardcoded examples.\n\n";

// Get actual materials from database
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Material;
use App\Models\Product;
use App\Models\BOM;

// Get Alkansya product
$alkansyaProduct = Product::where(function($query) {
    $query->where('name', 'Alkansya')
          ->orWhere('product_name', 'LIKE', '%Alkansya%');
})->first();

if (!$alkansyaProduct) {
    echo "Alkansya product not found\n";
    exit;
}

// Get BOM materials with actual database values
$bomMaterials = BOM::where('product_id', $alkansyaProduct->id)
    ->with('material')
    ->get();

// Convert to materials array with actual database values
$materials = [];
foreach ($bomMaterials as $bom) {
    $material = $bom->material;
    if ($material) {
        $materials[] = [
            'name' => $material->material_name,
            'current_stock' => $material->current_stock ?? 0, // FROM DATABASE
            'qty_per_unit' => $bom->quantity_per_product ?? $bom->qty_per_unit ?? 0,
            'reorder_point' => $material->reorder_level ?? 10,
            'unit' => $material->unit_of_measure ?? 'pcs',
            'material_code' => $material->material_code
        ];
    }
}

// Limit to first 4 materials for demo
$materials = array_slice($materials, 0, 4);

// Average daily output (from previous calculations)
$avgDailyOutput = 15.07;
$forecastDays = 30;

echo "Input Parameters:\n";
echo str_repeat("-", 60) . "\n";
echo "Average Daily Output: {$avgDailyOutput} Alkansya units/day\n";
echo "Forecast Period: {$forecastDays} days\n";
echo str_repeat("-", 60) . "\n\n";

echo "CALCULATION FOR EACH MATERIAL:\n";
echo str_repeat("=", 100) . "\n\n";

foreach ($materials as $material) {
    echo "Material: {$material['name']}\n";
    echo str_repeat("-", 100) . "\n";
    
    // Step 1: Calculate daily material usage
    $dailyMaterialUsage = $avgDailyOutput * $material['qty_per_unit'];
    echo "Step 1: Calculate Daily Material Usage\n";
    echo "  Formula: Daily Usage = Avg Daily Output × qty_per_unit\n";
    echo "  Calculation: {$avgDailyOutput} × {$material['qty_per_unit']} = " . round($dailyMaterialUsage, 4) . " {$material['unit']}/day\n\n";
    
    // Step 2: Calculate days left
    $daysLeft = $dailyMaterialUsage > 0 ? floor($material['current_stock'] / $dailyMaterialUsage) : 999;
    echo "Step 2: Calculate Days Left\n";
    echo "  Formula: Days Left = Current Stock ÷ Daily Material Usage\n";
    echo "  Calculation: {$material['current_stock']} ÷ " . round($dailyMaterialUsage, 4) . " = " . round($material['current_stock'] / $dailyMaterialUsage, 2) . " days\n";
    echo "  Rounded down (floor): {$daysLeft} days\n\n";
    
    // Step 3: Calculate forecasted usage
    $forecastedUsage = $dailyMaterialUsage * $forecastDays;
    echo "Step 3: Calculate Forecasted Usage (30 days)\n";
    echo "  Formula: Forecasted Usage = Daily Usage × Forecast Days\n";
    echo "  Calculation: " . round($dailyMaterialUsage, 4) . " × {$forecastDays} = " . round($forecastedUsage, 2) . " {$material['unit']}\n\n";
    
    // Step 4: Calculate projected stock
    $projectedStock = $material['current_stock'] - $forecastedUsage;
    echo "Step 4: Calculate Projected Stock\n";
    echo "  Formula: Projected Stock = Current Stock - Forecasted Usage\n";
    echo "  Calculation: {$material['current_stock']} - " . round($forecastedUsage, 2) . " = " . round($projectedStock, 2) . " {$material['unit']}\n\n";
    
    // Step 5: Determine status
    $needsReorder = $projectedStock <= $material['reorder_point'];
    $status = $needsReorder ? "Reorder" : "OK";
    $statusColor = $needsReorder ? "YELLOW" : "GREEN";
    
    echo "Step 5: Determine Status\n";
    echo "  Formula: Status = 'Reorder' if Projected Stock ≤ Reorder Point\n";
    echo "  Formula: Status = 'OK' if Projected Stock > Reorder Point\n";
    echo "  Comparison: " . round($projectedStock, 2) . " ≤ {$material['reorder_point']} ? " . ($needsReorder ? "YES" : "NO") . "\n";
    echo "  Status: {$status} ({$statusColor})\n\n";
    
    // Summary
    echo "SUMMARY:\n";
    echo str_repeat("-", 100) . "\n";
    echo sprintf("  Material: %s\n", $material['name']);
    echo sprintf("  Current Stock: %s %s\n", number_format($material['current_stock'], 2), $material['unit']);
    echo sprintf("  Daily Usage: %s %s/day\n", round($dailyMaterialUsage, 4), $material['unit']);
    echo sprintf("  Days Left: %s days\n", $daysLeft);
    echo sprintf("  Forecasted Usage (30 days): %s %s\n", round($forecastedUsage, 2), $material['unit']);
    echo sprintf("  Projected Stock: %s %s\n", round($projectedStock, 2), $material['unit']);
    echo sprintf("  Reorder Point: %s %s\n", $material['reorder_point'], $material['unit']);
    echo sprintf("  Status: %s (%s)\n", $status, $statusColor);
    echo str_repeat("=", 100) . "\n\n";
}

echo "KEY INSIGHTS:\n";
echo str_repeat("-", 100) . "\n";
echo "1. Days Left shows how long current stock will last at predicted usage rate\n";
echo "2. Status is based on projected stock after 30 days, not just current stock\n";
echo "3. Materials with high qty_per_unit (like Pin Nail F30: 14.0) consume faster\n";
echo "4. Materials with low qty_per_unit (like Pinewood: 0.0029) last much longer\n";
echo "5. Negative projected stock means material will run out before 30 days\n";
echo "6. The system uses floor() to round down Days Left (conservative estimate)\n";

