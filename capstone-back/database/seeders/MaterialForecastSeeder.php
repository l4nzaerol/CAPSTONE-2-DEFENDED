<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Material;
use App\Models\BOM;
use App\Models\Product;
use App\Models\AlkansyaDailyOutput;
use App\Models\InventoryTransaction;
use Carbon\Carbon;

class MaterialForecastSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Generating accurate material forecasts from Alkansya production data...');
        
        // Deactivate all old forecasts first
        DB::table('material_forecasts')->update(['is_active' => false]);
        $this->command->info('Deactivated old forecasts');
        
        // Get Alkansya product
        $alkansyaProduct = Product::where(function($query) {
            $query->where('name', 'LIKE', '%Alkansya%')
                  ->orWhere('product_name', 'LIKE', '%Alkansya%');
        })->first();
        
        if (!$alkansyaProduct) {
            $this->command->warn('Alkansya product not found. Skipping forecast generation.');
            return;
        }
        
        // Get BOM materials for Alkansya
        $bomMaterials = BOM::where('product_id', $alkansyaProduct->id)
            ->with('material')
            ->get();
        
        if ($bomMaterials->isEmpty()) {
            $this->command->warn('No BOM materials found for Alkansya. Skipping forecast generation.');
            return;
        }
        
        // Get historical Alkansya output data (all data, not just recent)
        $historicalOutput = AlkansyaDailyOutput::orderBy('date', 'asc')->get();
        
        // Calculate average daily output
        $uniqueDays = $historicalOutput->groupBy(function($output) {
            return $output->date->format('Y-m-d');
        })->count();
        
        $totalOutput = $historicalOutput->sum('quantity_produced');
        $avgDailyOutput = $uniqueDays > 0 ? $totalOutput / $uniqueDays : 15; // Default to 15 if no data
        
        $this->command->info("Average daily Alkansya output: " . round($avgDailyOutput, 2) . " units/day");
        $this->command->info("Total output: {$totalOutput} units over {$uniqueDays} days");
        
        // Get historical material consumption from transactions
        $historicalTransactions = InventoryTransaction::where('transaction_type', 'ALKANSYA_CONSUMPTION')
            ->with('material')
            ->get();
        
        // Group transactions by material and date
        $materialUsageByDate = [];
        foreach ($historicalTransactions as $transaction) {
            if (!$transaction->material_id) continue;
            
            $date = Carbon::parse($transaction->timestamp)->format('Y-m-d');
            $materialId = $transaction->material_id;
            
            if (!isset($materialUsageByDate[$date])) {
                $materialUsageByDate[$date] = [];
            }
            
            if (!isset($materialUsageByDate[$date][$materialId])) {
                $materialUsageByDate[$date][$materialId] = 0;
            }
            
            $materialUsageByDate[$date][$materialId] += abs($transaction->quantity);
        }
        
        // Forecast parameters - use current date
        $forecastDays = 30;
        $forecastDate = Carbon::today(); // Use today's date, not now()
        $forecastPeriodStart = Carbon::today();
        $forecastPeriodEnd = Carbon::today()->addDays($forecastDays);
        
        $forecastCount = 0;
        
        // Generate forecasts for each material
        foreach ($bomMaterials as $bomMaterial) {
            $material = $bomMaterial->material;
            if (!$material) continue;
            
            $qtyPerUnit = $bomMaterial->quantity_per_product ?? $bomMaterial->qty_per_unit ?? 0;
            
            // Calculate historical daily material usage from transactions
            $historicalMaterialUsage = [];
            foreach ($materialUsageByDate as $date => $materials) {
                if (isset($materials[$material->material_id])) {
                    $historicalMaterialUsage[] = $materials[$material->material_id];
                }
            }
            
            // Calculate expected daily usage from BOM
            $expectedDailyUsage = $avgDailyOutput * $qtyPerUnit;
            
            // Use historical data if available, otherwise use BOM calculation
            if (!empty($historicalMaterialUsage)) {
                $avgDailyMaterialUsage = array_sum($historicalMaterialUsage) / count($historicalMaterialUsage);
                
                // Calculate moving averages for trend analysis
                $movingAvg7 = count($historicalMaterialUsage) >= 7 
                    ? array_sum(array_slice($historicalMaterialUsage, -7)) / 7 
                    : $avgDailyMaterialUsage;
                $movingAvg14 = count($historicalMaterialUsage) >= 14 
                    ? array_sum(array_slice($historicalMaterialUsage, -14)) / 14 
                    : $avgDailyMaterialUsage;
                
                // Weighted average (recent data has more weight)
                $calculatedFromTransactions = ($movingAvg7 * 0.6) + ($movingAvg14 * 0.4);
                
                // Validate: If calculated usage is more than 2x expected, use expected instead
                if ($calculatedFromTransactions > 0 && $expectedDailyUsage > 0) {
                    $ratio = $calculatedFromTransactions / $expectedDailyUsage;
                    if ($ratio > 2.0 || $ratio < 0.5) {
                        $dailyMaterialUsage = $expectedDailyUsage;
                    } else {
                        $dailyMaterialUsage = $calculatedFromTransactions;
                    }
                } else {
                    $dailyMaterialUsage = $expectedDailyUsage;
                }
            } else {
                // Fallback: Use BOM calculation
                $dailyMaterialUsage = $expectedDailyUsage;
            }
            
            // Round to 2 decimal places for consistency
            // Ensure daily usage is never negative
            $dailyMaterialUsage = max(0, round($dailyMaterialUsage, 2));
            $forecastedUsage = round($dailyMaterialUsage * $forecastDays, 2);
            
            // Log calculation for debugging
            $this->command->line("  Material: {$material->material_name}");
            $this->command->line("  - Qty per unit: {$qtyPerUnit}");
            $this->command->line("  - Expected daily usage: " . round($expectedDailyUsage, 2));
            $this->command->line("  - Calculated daily usage: {$dailyMaterialUsage}");
            $this->command->line("  - Historical data points: " . count($historicalMaterialUsage));
            
            // Get current stock from Material model - prioritize inventory sum for accuracy
            $currentStock = 0;
            $inventorySum = 0;
            
            // Try to get from inventory records first (most accurate)
            if ($material->inventory && $material->inventory->count() > 0) {
                $inventorySum = $material->inventory->sum('current_stock') ?? 0;
            }
            
            // Fallback to direct field if inventory sum is 0
            if ($inventorySum > 0) {
                $currentStock = $inventorySum;
            } else {
                $currentStock = $material->current_stock ?? 0;
            }
            
            // If still 0, try to get from inventory table directly
            if ($currentStock == 0) {
                $inventoryRecords = DB::table('inventory')
                    ->where('material_id', $material->material_id)
                    ->sum('current_stock');
                if ($inventoryRecords > 0) {
                    $currentStock = $inventoryRecords;
                }
            }
            
            // Ensure we have a valid current stock value
            $currentStock = max(0, round($currentStock, 2));
            
            // Calculate projected stock after forecast period
            $projectedStock = $currentStock - $forecastedUsage;
            
            // Calculate days until stockout (Days Left) - use exact formula
            // Formula: Days Left = Current Stock ÷ Daily Material Usage
            if ($dailyMaterialUsage > 0) {
                $daysUntilStockout = floor($currentStock / $dailyMaterialUsage);
                // Cap at reasonable maximum (999 days) to avoid overflow
                $daysUntilStockout = min($daysUntilStockout, 99999);
            } else {
                $daysUntilStockout = 99999; // No usage, stock won't deplete
            }
            
            // Determine status with proper priority order
            // Priority: Out of Stock > Critical > Low > Overstocked > In Stock
            // For Alkansya materials, use projected stock (after 30 days) for status calculation
            $availableQty = $projectedStock;
            $criticalStock = $material->critical_stock ?? 0;
            $reorderLevel = $material->reorder_level ?? 0;
            $maxLevel = $material->max_level ?? 0;
            
            // Initialize status
            $status = 'in_stock';
            $statusLabel = 'In Stock';
            
            // Check status in priority order - use projected stock for Alkansya materials
            // If projected stock will be negative or zero after 30 days, mark as Out of Stock
            if ($availableQty <= 0) {
                $status = 'out_of_stock';
                $statusLabel = 'Out of Stock';
            } elseif ($daysUntilStockout <= 0) {
                // Already out of stock or will be out immediately
                $status = 'out_of_stock';
                $statusLabel = 'Out of Stock';
            } elseif ($daysUntilStockout <= 7) {
                // Very low days left - critical situation
                if ($criticalStock > 0 && $availableQty <= $criticalStock) {
                    $status = 'critical';
                    $statusLabel = 'Critical';
                } else {
                    $status = 'out_of_stock';
                    $statusLabel = 'Out of Stock';
                }
            } elseif ($criticalStock > 0 && $availableQty <= $criticalStock) {
                $status = 'critical';
                $statusLabel = 'Critical';
            } elseif ($reorderLevel > 0 && $availableQty <= $reorderLevel) {
                $status = 'low_stock';
                $statusLabel = 'Low Stock';
            } elseif ($maxLevel > 0 && $availableQty > $maxLevel) {
                $status = 'overstocked';
                $statusLabel = 'Overstocked';
            }
            
            // Also check if current stock is already at critical levels
            if ($currentStock <= 0) {
                $status = 'out_of_stock';
                $statusLabel = 'Out of Stock';
            }
            
            $needsReorder = ($projectedStock <= $reorderLevel) || ($daysUntilStockout <= 30);
            
            // Calculate confidence score based on data quality
            $confidenceScore = 70; // Base confidence
            if (!empty($historicalMaterialUsage)) {
                $confidenceScore += 20; // Historical data available
                if (count($historicalMaterialUsage) >= 14) {
                    $confidenceScore += 10; // Sufficient historical data
                }
            }
            $confidenceScore = min(100, $confidenceScore);
            
            // Determine confidence level
            $confidenceLevel = 'medium';
            if ($confidenceScore >= 90) {
                $confidenceLevel = 'high';
            } elseif ($confidenceScore >= 70) {
                $confidenceLevel = 'medium';
            } else {
                $confidenceLevel = 'low';
            }
            
            // Forecast method
            $forecastMethod = !empty($historicalMaterialUsage) ? 'historical_transactions' : 'bom_calculation';
            
            // Method details
            $methodDetails = [
                'avg_daily_output' => $avgDailyOutput,
                'qty_per_unit' => $qtyPerUnit,
                'expected_daily_usage' => $expectedDailyUsage,
                'calculated_daily_usage' => $dailyMaterialUsage,
                'historical_data_points' => count($historicalMaterialUsage),
                'unique_days_with_output' => $uniqueDays,
                'total_output' => $totalOutput
            ];
            
            // Forecast breakdown (daily projections)
            $forecastBreakdown = [];
            for ($day = 0; $day < $forecastDays; $day++) {
                $forecastBreakdown[] = [
                    'day' => $day + 1,
                    'date' => Carbon::today()->addDays($day)->format('Y-m-d'),
                    'projected_usage' => round($dailyMaterialUsage, 2),
                    'cumulative_usage' => round($dailyMaterialUsage * ($day + 1), 2)
                ];
            }
            
            // Delete old forecasts for this material and create new one
            DB::table('material_forecasts')
                ->where('material_id', $material->material_id)
                ->delete();
            
            // Create new forecast with current date
            DB::table('material_forecasts')->insert([
                'material_id' => $material->material_id,
                // Core display columns
                'current_stock' => round($currentStock, 2),
                'daily_usage' => $dailyMaterialUsage,
                'forecasted_usage' => $forecastedUsage,
                'days_until_stockout' => $daysUntilStockout,
                'status' => $status,
                'status_label' => $statusLabel,
                'projected_stock' => round($projectedStock, 2),
                'needs_reorder' => $needsReorder,
                // Forecast metadata
                'forecast_method' => $forecastMethod,
                'forecast_days' => $forecastDays,
                'confidence_score' => $confidenceScore,
                'confidence_level' => $confidenceLevel,
                'method_details' => json_encode($methodDetails),
                'forecast_breakdown' => json_encode($forecastBreakdown),
                'forecast_date' => $forecastDate->format('Y-m-d'),
                'forecast_period_start' => $forecastPeriodStart->format('Y-m-d'),
                'forecast_period_end' => $forecastPeriodEnd->format('Y-m-d'),
                'is_active' => true,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now()
            ]);
            
            $forecastCount++;
            $this->command->info("Generated forecast for {$material->material_name}: {$dailyMaterialUsage} units/day, {$forecastedUsage} units over {$forecastDays} days (Confidence: {$confidenceLevel})");
        }
        
        $this->command->info("Successfully generated {$forecastCount} material forecasts!");
    }
}

