<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\InventoryItem;
use App\Models\InventoryUsage;
use App\Models\AlkansyaDailyOutput;
use App\Models\ProductMaterial;
use App\Models\Order;
use App\Models\OrderItem;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * Get material usage forecast for predictive analytics
     */
    public function getMaterialUsageForecast(Request $request)
    {
        try {
            $startDate = $request->get('start_date', Carbon::now()->subDays(90)->format('Y-m-d'));
            $endDate = $request->get('end_date', Carbon::now()->format('Y-m-d'));
            $forecastDays = $request->get('forecast_days', 30);

            // Get historical usage data with more comprehensive analysis
            $usageData = InventoryUsage::with('inventoryItem')
                ->whereBetween('date', [$startDate, $endDate])
                ->get()
                ->groupBy('inventory_item_id');

            $forecasts = [];

            foreach ($usageData as $itemId => $usages) {
                $item = $usages->first()->inventoryItem;
                $dailyUsages = $usages->pluck('qty_used')->toArray();
                
                // Calculate multiple moving averages for better forecasting
                $movingAverage7 = $this->calculateMovingAverage($dailyUsages, 7);
                $movingAverage14 = $this->calculateMovingAverage($dailyUsages, 14);
                $movingAverage30 = $this->calculateMovingAverage($dailyUsages, 30);
                
                // Calculate consumption rate with trend analysis
                $consumptionRate = $this->calculateConsumptionRate($dailyUsages);
                $trend = $this->calculateTrend($dailyUsages);
                
                // Predict future usage with confidence intervals
                $predictedUsage = $consumptionRate * $forecastDays;
                $confidenceUpper = $predictedUsage * 1.15; // 15% upper bound
                $confidenceLower = $predictedUsage * 0.85; // 15% lower bound
                
                // Get current stock
                $currentStock = $item->quantity_on_hand;
                
                // Calculate days until stockout with multiple scenarios
                $daysUntilStockout = $consumptionRate > 0 ? floor($currentStock / $consumptionRate) : null;
                $daysUntilReorder = $this->calculateDaysUntilReorder($currentStock, $item->reorder_point, $consumptionRate);
                
                // Determine status with more granular levels
                $status = $this->determineStockStatus($currentStock, $item->reorder_point, $daysUntilStockout, $item->safety_stock);
                $priority = $this->calculatePriority($currentStock, $item->reorder_point, $daysUntilStockout);
                
                // Calculate recommended order quantity
                $recommendedOrderQty = $this->calculateRecommendedOrderQty($item, $consumptionRate, $forecastDays);

                $forecasts[] = [
                    'material_id' => $item->id,
                    'material_name' => $item->name,
                    'sku' => $item->sku,
                    'current_stock' => $currentStock,
                    'consumption_rate' => round($consumptionRate, 2),
                    'trend' => round($trend, 2),
                    'predicted_usage' => round($predictedUsage, 2),
                    'confidence_upper' => round($confidenceUpper, 2),
                    'confidence_lower' => round($confidenceLower, 2),
                    'days_until_stockout' => $daysUntilStockout,
                    'days_until_reorder' => $daysUntilReorder,
                    'status' => $status,
                    'priority' => $priority,
                    'reorder_point' => $item->reorder_point,
                    'safety_stock' => $item->safety_stock,
                    'lead_time_days' => $item->lead_time_days,
                    'recommended_order_qty' => $recommendedOrderQty,
                    'moving_averages' => [
                        '7_day' => round($movingAverage7, 2),
                        '14_day' => round($movingAverage14, 2),
                        '30_day' => round($movingAverage30, 2),
                    ]
                ];
            }

            return response()->json([
                'success' => true,
                'forecasts' => $forecasts,
                'forecast_period' => $forecastDays,
                'analysis_date' => Carbon::now()->format('Y-m-d'),
                'total_materials' => count($forecasts),
                'critical_items' => count(array_filter($forecasts, fn($f) => $f['priority'] === 'Critical')),
                'warning_items' => count(array_filter($forecasts, fn($f) => $f['priority'] === 'High')),
                'safe_items' => count(array_filter($forecasts, fn($f) => $f['priority'] === 'Low'))
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error generating material usage forecast: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get inventory replenishment forecast
     */
    public function getInventoryReplenishmentForecast(Request $request)
    {
        try {
            $startDate = $request->get('start_date', Carbon::now()->subDays(30)->format('Y-m-d'));
            $endDate = $request->get('end_date', Carbon::now()->format('Y-m-d'));
            $forecastDays = $request->get('forecast_days', 30);

            // Get all inventory items with their usage patterns
            $items = InventoryItem::where('category', 'raw')->get();
            $replenishmentForecast = [];

            foreach ($items as $item) {
                // Get historical usage
                $usageData = InventoryUsage::where('inventory_item_id', $item->id)
                    ->whereBetween('date', [$startDate, $endDate])
                    ->get();

                if ($usageData->count() > 0) {
                    $dailyUsages = $usageData->pluck('qty_used')->toArray();
                    $avgDailyUsage = array_sum($dailyUsages) / count($dailyUsages);
                    
                    // Calculate reorder point based on lead time and safety stock
                    $leadTimeDays = $item->lead_time_days ?? 7;
                    $safetyStock = $item->safety_stock ?? 0;
                    $recommendedReorderPoint = ($avgDailyUsage * $leadTimeDays) + $safetyStock;
                    
                    // Calculate when to reorder
                    $currentStock = $item->quantity_on_hand;
                    $daysUntilReorder = $avgDailyUsage > 0 ? floor(($currentStock - $recommendedReorderPoint) / $avgDailyUsage) : null;
                    
                    // Calculate recommended order quantity
                    $maxLevel = $item->max_level ?? ($recommendedReorderPoint * 2);
                    $recommendedOrderQty = $maxLevel - $currentStock;

                    $replenishmentForecast[] = [
                        'item_id' => $item->id,
                        'item_name' => $item->name,
                        'sku' => $item->sku,
                        'current_stock' => $currentStock,
                        'avg_daily_usage' => round($avgDailyUsage, 2),
                        'recommended_reorder_point' => round($recommendedReorderPoint, 2),
                        'days_until_reorder' => $daysUntilReorder,
                        'recommended_order_qty' => max(0, round($recommendedOrderQty, 2)),
                        'lead_time_days' => $leadTimeDays,
                        'priority' => $this->calculatePriority($currentStock, $recommendedReorderPoint, $daysUntilReorder)
                    ];
                }
            }

            return response()->json([
                'success' => true,
                'replenishment_forecast' => $replenishmentForecast,
                'forecast_period' => $forecastDays,
                'analysis_date' => Carbon::now()->format('Y-m-d')
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error generating replenishment forecast: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get stock status predictions
     */
    public function getStockStatusPredictions(Request $request)
    {
        try {
            $startDate = $request->get('start_date', Carbon::now()->subDays(30)->format('Y-m-d'));
            $endDate = $request->get('end_date', Carbon::now()->format('Y-m-d'));
            $forecastDays = $request->get('forecast_days', 30);

            $items = InventoryItem::where('category', 'raw')->get();
            $predictions = [];

            foreach ($items as $item) {
                // Get usage history
                $usageData = InventoryUsage::where('inventory_item_id', $item->id)
                    ->whereBetween('date', [$startDate, $endDate])
                    ->get();

                if ($usageData->count() > 0) {
                    $dailyUsages = $usageData->pluck('qty_used')->toArray();
                    $avgDailyUsage = array_sum($dailyUsages) / count($dailyUsages);
                    
                    $currentStock = $item->quantity_on_hand;
                    $predictedStockoutDate = null;
                    
                    if ($avgDailyUsage > 0) {
                        $daysUntilStockout = floor($currentStock / $avgDailyUsage);
                        $stockoutDate = Carbon::now()->addDays($daysUntilStockout);
                        $predictedStockoutDate = $stockoutDate->format('Y-m-d');
                    }

                    // Calculate recommended order quantity
                    $leadTimeDays = $item->lead_time_days ?? 7;
                    $safetyStock = $item->safety_stock ?? 0;
                    $recommendedOrderQty = ($avgDailyUsage * $leadTimeDays) + $safetyStock;

                    $predictions[] = [
                        'item_id' => $item->id,
                        'item_name' => $item->name,
                        'sku' => $item->sku,
                        'current_stock' => $currentStock,
                        'predicted_stockout_date' => $predictedStockoutDate,
                        'days_until_stockout' => $avgDailyUsage > 0 ? floor($currentStock / $avgDailyUsage) : null,
                        'recommended_order_qty' => round($recommendedOrderQty, 2),
                        'status' => $this->getStockStatus($currentStock, $item->reorder_point, $predictedStockoutDate)
                    ];
                }
            }

            return response()->json([
                'success' => true,
                'predictions' => $predictions,
                'forecast_period' => $forecastDays,
                'analysis_date' => Carbon::now()->format('Y-m-d')
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error generating stock predictions: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get seasonal trends analysis
     */
    public function getSeasonalTrends(Request $request)
    {
        try {
            $startDate = $request->get('start_date', Carbon::now()->subYear()->format('Y-m-d'));
            $endDate = $request->get('end_date', Carbon::now()->format('Y-m-d'));
            $analysisPeriod = $request->get('analysis_period', 'yearly');

            // Get usage data grouped by month
            $usageData = InventoryUsage::with('inventoryItem')
                ->whereBetween('date', [$startDate, $endDate])
                ->selectRaw('MONTH(date) as month, SUM(qty_used) as total_usage')
                ->groupBy('month')
                ->get();

            $trends = [];
            $monthNames = [
                1 => 'January', 2 => 'February', 3 => 'March', 4 => 'April',
                5 => 'May', 6 => 'June', 7 => 'July', 8 => 'August',
                9 => 'September', 10 => 'October', 11 => 'November', 12 => 'December'
            ];

            foreach ($usageData as $data) {
                $trends[] = [
                    'month' => $monthNames[$data->month] ?? $data->month,
                    'usage' => $data->total_usage,
                    'forecast' => $this->calculateSeasonalForecast($data->total_usage, $data->month)
                ];
            }

            return response()->json([
                'success' => true,
                'trends' => $trends,
                'analysis_period' => $analysisPeriod,
                'analysis_date' => Carbon::now()->format('Y-m-d')
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error analyzing seasonal trends: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get demand patterns analysis
     */
    public function getDemandPatterns(Request $request)
    {
        try {
            $startDate = $request->get('start_date', Carbon::now()->subDays(90)->format('Y-m-d'));
            $endDate = $request->get('end_date', Carbon::now()->format('Y-m-d'));
            $analysisPeriod = $request->get('analysis_period', 'monthly');

            // Get order data for demand analysis
            $orderData = Order::whereBetween('created_at', [$startDate, $endDate])
                ->with('orderItems.product')
                ->get();

            $demandPatterns = [];
            $productDemand = [];

            foreach ($orderData as $order) {
                foreach ($order->orderItems as $item) {
                    $productName = $item->product->name ?? 'Unknown';
                    if (!isset($productDemand[$productName])) {
                        $productDemand[$productName] = 0;
                    }
                    $productDemand[$productName] += $item->quantity;
                }
            }

            // Convert to array format
            foreach ($productDemand as $product => $demand) {
                $demandPatterns[] = [
                    'product' => $product,
                    'demand' => $demand,
                    'trend' => $this->calculateDemandTrend($product, $orderData)
                ];
            }

            return response()->json([
                'success' => true,
                'demand_patterns' => $demandPatterns,
                'analysis_period' => $analysisPeriod,
                'analysis_date' => Carbon::now()->format('Y-m-d')
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error analyzing demand patterns: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Helper method to calculate moving average
     */
    private function calculateMovingAverage($data, $period)
    {
        if (count($data) < $period) {
            return array_sum($data) / count($data);
        }
        
        $recentData = array_slice($data, -$period);
        return array_sum($recentData) / $period;
    }

    /**
     * Helper method to calculate consumption rate
     */
    private function calculateConsumptionRate($dailyUsages)
    {
        if (empty($dailyUsages)) {
            return 0;
        }
        
        return array_sum($dailyUsages) / count($dailyUsages);
    }


    /**
     * Helper method to get stock status
     */
    private function getStockStatus($currentStock, $reorderPoint, $predictedStockoutDate)
    {
        if ($currentStock <= 0) {
            return 'Out of Stock';
        } elseif ($currentStock <= $reorderPoint) {
            return 'Low Stock';
        } elseif ($predictedStockoutDate && Carbon::parse($predictedStockoutDate)->isBefore(Carbon::now()->addDays(14))) {
            return 'At Risk';
        } else {
            return 'In Stock';
        }
    }

    /**
     * Helper method to calculate seasonal forecast
     */
    private function calculateSeasonalForecast($currentUsage, $month)
    {
        // Simple seasonal adjustment based on month
        $seasonalFactors = [
            1 => 0.8, 2 => 0.9, 3 => 1.1, 4 => 1.2,
            5 => 1.1, 6 => 1.0, 7 => 0.9, 8 => 0.8,
            9 => 0.9, 10 => 1.0, 11 => 1.1, 12 => 1.2
        ];
        
        $factor = $seasonalFactors[$month] ?? 1.0;
        return $currentUsage * $factor;
    }

    /**
     * Helper method to calculate demand trend
     */
    private function calculateDemandTrend($product, $orderData)
    {
        // Simple trend calculation based on recent vs older orders
        $recentOrders = $orderData->where('created_at', '>=', Carbon::now()->subDays(30));
        $olderOrders = $orderData->where('created_at', '<', Carbon::now()->subDays(30));
        
        $recentDemand = $recentOrders->sum(function($order) use ($product) {
            return $order->orderItems->where('product.name', $product)->sum('quantity');
        });
        
        $olderDemand = $olderOrders->sum(function($order) use ($product) {
            return $order->orderItems->where('product.name', $product)->sum('quantity');
        });
        
        if ($olderDemand > 0) {
            $trend = (($recentDemand - $olderDemand) / $olderDemand) * 100;
            return round($trend, 1);
        }
        
        return 0;
    }

    /**
     * Calculate trend in consumption data
     */
    private function calculateTrend($dailyUsages)
    {
        if (count($dailyUsages) < 2) {
            return 0;
        }

        $recent = array_slice($dailyUsages, -7); // Last 7 days
        $older = array_slice($dailyUsages, 0, -7); // Previous days

        if (empty($older)) {
            return 0;
        }

        $recentAvg = array_sum($recent) / count($recent);
        $olderAvg = array_sum($older) / count($older);

        if ($olderAvg > 0) {
            return (($recentAvg - $olderAvg) / $olderAvg) * 100;
        }

        return 0;
    }

    /**
     * Calculate days until reorder point is reached
     */
    private function calculateDaysUntilReorder($currentStock, $reorderPoint, $consumptionRate)
    {
        if ($consumptionRate <= 0 || $currentStock <= $reorderPoint) {
            return 0;
        }

        return floor(($currentStock - $reorderPoint) / $consumptionRate);
    }

    /**
     * Determine stock status with more granular levels
     */
    private function determineStockStatus($currentStock, $reorderPoint, $daysUntilStockout, $safetyStock)
    {
        if ($currentStock <= 0) {
            return 'Out of Stock';
        } elseif ($currentStock <= $safetyStock) {
            return 'Critical';
        } elseif ($currentStock <= $reorderPoint) {
            return 'Low Stock';
        } elseif ($daysUntilStockout && $daysUntilStockout < 7) {
            return 'At Risk';
        } elseif ($daysUntilStockout && $daysUntilStockout < 14) {
            return 'Warning';
        } else {
            return 'In Stock';
        }
    }

    /**
     * Calculate priority level (enhanced version)
     */
    private function calculatePriorityEnhanced($currentStock, $reorderPoint, $daysUntilStockout)
    {
        if ($currentStock <= 0) {
            return 'Critical';
        } elseif ($currentStock <= $reorderPoint) {
            return 'Critical';
        } elseif ($daysUntilStockout && $daysUntilStockout < 7) {
            return 'Critical';
        } elseif ($daysUntilStockout && $daysUntilStockout < 14) {
            return 'High';
        } elseif ($daysUntilStockout && $daysUntilStockout < 30) {
            return 'Medium';
        } else {
            return 'Low';
        }
    }

    /**
     * Calculate recommended order quantity
     */
    private function calculateRecommendedOrderQty($item, $consumptionRate, $forecastDays)
    {
        $leadTimeDays = $item->lead_time_days ?? 7;
        $safetyStock = $item->safety_stock ?? 0;
        $maxLevel = $item->max_level ?? ($item->reorder_point * 2);
        
        // Calculate economic order quantity
        $eoq = sqrt((2 * $consumptionRate * 365 * $item->unit_cost) / ($item->unit_cost * 0.1)); // 10% holding cost
        
        // Calculate based on lead time and safety stock
        $leadTimeQuantity = $consumptionRate * $leadTimeDays;
        $recommendedQty = $leadTimeQuantity + $safetyStock;
        
        // Don't exceed max level
        $recommendedQty = min($recommendedQty, $maxLevel);
        
        // Use EOQ if it's reasonable
        if ($eoq > $recommendedQty * 0.5 && $eoq < $recommendedQty * 2) {
            $recommendedQty = $eoq;
        }
        
        return max(1, round($recommendedQty));
    }
}
