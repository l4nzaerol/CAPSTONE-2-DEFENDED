<?php

namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Models\InventoryUsage;
use App\Models\ProductMaterial;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use App\Events\InventoryUpdated;
use App\Services\InventoryForecastService;

class InventoryController extends Controller
{
    public function index() {
        $items = InventoryItem::all();
        
        // Update production status for made-to-order products based on actual orders
        foreach ($items as $item) {
            if ($item->category === 'made-to-order') {
                $productionStatus = $this->getProductionStatus($item);
                $productionCount = $this->getProductionCount($item);
                
                // Update status in database
                $item->update([
                    'production_status' => $productionStatus,
                    'production_count' => $productionCount,
                    'status' => $productionStatus
                ]);
                
                \Log::info("Updated inventory status for {$item->name}: {$productionStatus}, count: {$productionCount}");
                
                // Refresh the item to get updated values
                $item->refresh();
            }
        }
        
        return response()->json($items);
    }
    
    private function getProductionStatus($item) {
        // Check if there are any active orders for this product
        // Extract the base product name from inventory item name
        $baseName = str_replace([' (Made-to-Order)', ' (Finished Good)'], '', $item->name);
        
        $activeOrders = DB::table('orders')
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.status', '!=', 'cancelled')
            ->where('orders.status', '!=', 'delivered')
            ->where('products.name', 'like', '%' . $baseName . '%')
            ->whereIn('orders.status', ['accepted', 'processing', 'in_production', 'ready_for_delivery'])
            ->count();
            
        if ($activeOrders > 0) {
            // Check if any orders are ready for delivery
            $readyForDelivery = DB::table('orders')
                ->join('order_items', 'orders.id', '=', 'order_items.order_id')
                ->join('products', 'order_items.product_id', '=', 'products.id')
                ->where('orders.status', 'ready_for_delivery')
                ->where('products.name', 'like', '%' . $baseName . '%')
                ->count();
                
            if ($readyForDelivery > 0) {
                return 'ready_to_deliver';
            }
            
            return 'in_production';
        }
        
        return 'not_in_production';
    }
    
    private function getProductionCount($item) {
        // Extract the base product name from inventory item name
        $baseName = str_replace([' (Made-to-Order)', ' (Finished Good)'], '', $item->name);
        
        return DB::table('orders')
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->whereIn('orders.status', ['processing', 'in_production'])
            ->where('products.name', 'like', '%' . $baseName . '%')
            ->sum('order_items.quantity');
    }

    public function store(Request $request) {
        $data = $request->validate([
            'sku' => 'required|unique:inventory_items',
            'name' => 'required',
            'category' => 'required|in:raw,finished,made-to-order',
            'location' => 'nullable',
            'unit' => 'nullable|string',
            'unit_cost' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string',
            'description' => 'nullable|string',
            'quantity_on_hand' => 'integer|min:0',
            'safety_stock' => 'integer|min:0',
            'reorder_point' => 'nullable|integer|min:0',
            'max_level' => 'nullable|integer|min:0',
            'lead_time_days' => 'integer|min:0',
        ]);
        $item = InventoryItem::create($data);
        broadcast(new InventoryUpdated($item))->toOthers();
        return response()->json($item, 201);
    }

    public function update(Request $request, $id) {
        $item = InventoryItem::findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|string',
            'category' => 'sometimes|in:raw,finished,made-to-order',
            'location' => 'nullable',
            'unit' => 'nullable|string',
            'unit_cost' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string',
            'description' => 'nullable|string',
            'quantity_on_hand' => 'sometimes|integer|min:0',
            'safety_stock' => 'sometimes|integer|min:0',
            'reorder_point' => 'nullable|integer|min:0',
            'max_level' => 'nullable|integer|min:0',
            'lead_time_days' => 'sometimes|integer|min:0',
        ]);
        $item->update($data);
        broadcast(new InventoryUpdated($item))->toOthers();
        return response()->json($item);
    }

    public function destroy($id) {
        $item = InventoryItem::find($id);
        if ($item) {
            $item->delete();
            broadcast(new InventoryUpdated($item))->toOthers();
        }
        return response()->json(['message'=>'Deleted']);
    }

    /**
     * Get inventory items that need reordering
     */
    public function getReorderItems()
    {
        $svc = app(InventoryForecastService::class);
        $items = InventoryItem::all();

        $reorderItems = $items->map(function($item) use ($svc) {
            // Compute dynamic ROP when not explicitly set
            $rop = $svc->computeReorderPoint($item);
            $onHand = (int) $item->quantity_on_hand;
            $suggest = $svc->suggestReplenishmentQty($item);

            if ($onHand <= $rop || $suggest > 0) {
                $item->reorder_point = $rop;
                $item->reorder_quantity = $suggest;
                $item->days_until_stockout = $svc->estimateDaysToDepletion($item) ?? 999;
                return $item;
            }
            return null;
        })->filter()->values();

        return response()->json($reorderItems);
    }

    /**
     * Add daily Alkansya production output to inventory
     */
    public function addAlkansyaDailyOutput(Request $request)
    {
        $data = $request->validate([
            'quantity' => 'required|integer|min:1',
            'date' => 'required|date',
            'notes' => 'nullable|string'
        ]);

        // Find Alkansya inventory item
        $alkansya = InventoryItem::where('name', 'LIKE', '%Alkansya%')
            ->where('category', 'finished')
            ->first();

        if (!$alkansya) {
            return response()->json([
                'error' => 'Alkansya not found in inventory. Please add it first.'
            ], 404);
        }

        // Add quantity to inventory
        $alkansya->quantity_on_hand += $data['quantity'];
        $alkansya->save();

        // Log the addition
        DB::table('inventory_transactions')->insert([
            'inventory_item_id' => $alkansya->id,
            'transaction_type' => 'production_output',
            'quantity' => $data['quantity'],
            'date' => $data['date'],
            'notes' => $data['notes'] ?? 'Daily Alkansya production output',
            'created_at' => now(),
            'updated_at' => now()
        ]);

        broadcast(new InventoryUpdated($alkansya))->toOthers();

        return response()->json([
            'message' => 'Daily output added successfully',
            'item' => $alkansya,
            'added_quantity' => $data['quantity']
        ]);
    }

    /**
     * Get daily material usage report
     */
    public function getDailyUsage(Request $request)
    {
        $date = $request->get('date', Carbon::now()->format('Y-m-d'));
        
        $usage = InventoryUsage::where('date', $date)
            ->with(['inventoryItem'])
            ->get()
            ->groupBy('inventory_item_id')
            ->map(function($usages, $itemId) {
                $totalUsed = $usages->sum('qty_used');
                $item = $usages->first()->inventoryItem;
                
                return [
                    'item_id' => $itemId,
                    'item_name' => $item->name,
                    'sku' => $item->sku,
                    'total_used' => $totalUsed,
                    'remaining_stock' => $item->quantity_on_hand,
                    'usage_details' => $usages->map(function($usage) {
                        return [
                            'qty_used' => $usage->qty_used,
                            'created_at' => optional($usage->created_at)->toDateTimeString(),
                        ];
                    })
                ];
            });

        return response()->json([
            'date' => $date,
            'usage_summary' => $usage,
            'total_items_used' => $usage->count(),
            'total_quantity_used' => $usage->sum('total_used')
        ]);
    }

    /**
     * Get material consumption trends
     */
    public function getConsumptionTrends(Request $request)
    {
        $days = $request->get('days', 30);
        $startDate = Carbon::now()->subDays($days);

        $trends = InventoryUsage::where('date', '>=', $startDate)
            ->with(['inventoryItem'])
            ->get()
            ->groupBy('inventory_item_id')
            ->map(function($usages, $itemId) {
                $item = $usages->first()->inventoryItem;
                $dailyUsage = $usages->groupBy('date')
                    ->map(function($dayUsages) {
                        return $dayUsages->sum('qty_used');
                    });

                $avgDailyUsage = $dailyUsage->avg();
                $trend = $this->calculateTrend($dailyUsage->values()->toArray());

                return [
                    'item_id' => $itemId,
                    'item_name' => $item->name,
                    'sku' => $item->sku,
                    'avg_daily_usage' => round($avgDailyUsage, 2),
                    'total_usage_period' => $usages->sum('qty_used'),
                    'trend' => $trend,
                    'days_until_stockout' => $this->calculateDaysUntilStockout($item, $avgDailyUsage),
                    'daily_usage_data' => $dailyUsage
                ];
            });

        return response()->json([
            'period_days' => $days,
            'start_date' => $startDate->format('Y-m-d'),
            'trends' => $trends
        ]);
    }

    /**
     * Calculate days until stockout
     */
    private function calculateDaysUntilStockout($item, $dailyUsage = null)
    {
        if (!$dailyUsage) {
            // Get recent usage data
            $recentUsage = InventoryUsage::where('inventory_item_id', $item->id)
                ->where('date', '>=', Carbon::now()->subDays(7))
                ->sum('qty_used');
            $dailyUsage = $recentUsage / 7;
        }

        if ($dailyUsage <= 0) {
            return 999; // No usage, won't stockout
        }

        return floor($item->quantity_on_hand / $dailyUsage);
    }

    /**
     * Calculate trend (positive = increasing, negative = decreasing)
     */
    private function calculateTrend($values)
    {
        if (count($values) < 2) {
            return 0;
        }

        $n = count($values);
        $sumX = 0;
        $sumY = 0;
        $sumXY = 0;
        $sumX2 = 0;

        for ($i = 0; $i < $n; $i++) {
            $sumX += $i;
            $sumY += $values[$i];
            $sumXY += $i * $values[$i];
            $sumX2 += $i * $i;
        }

        $slope = ($n * $sumXY - $sumX * $sumY) / ($n * $sumX2 - $sumX * $sumX);
        return round($slope, 2);
    }

    /**
     * Get inventory dashboard data
     */
    public function getDashboardData()
    {
        // Cache dashboard data for 5 minutes to improve performance
        return cache()->remember('inventory_dashboard', 300, function () {
            $totalItems = InventoryItem::count();
            $lowStockItems = InventoryItem::whereRaw('quantity_on_hand <= reorder_point')
                ->where('category', '!=', 'made-to-order')
                ->count();
            $outOfStockItems = InventoryItem::where('quantity_on_hand', 0)
                ->where('category', '!=', 'made-to-order')
                ->count();
            
            // Get Alkansya production statistics for better insights
            $alkansyaStats = \App\Models\AlkansyaDailyOutput::where('date', '>=', Carbon::now()->subMonths(3))
                ->selectRaw('
                    COUNT(*) as total_days,
                    SUM(quantity_produced) as total_output,
                    AVG(quantity_produced) as avg_daily,
                    SUM(CASE WHEN date >= ? THEN quantity_produced ELSE 0 END) as last_7_days
                ', [Carbon::now()->subDays(7)])
                ->first();
            
            // Get recent usage from Alkansya production
            $recentUsage = InventoryUsage::where('date', '>=', Carbon::now()->subDays(7))->sum('qty_used');
            $totalUsage3Months = InventoryUsage::where('date', '>=', Carbon::now()->subMonths(3))->sum('qty_used');

            // Get items that need immediate attention (excluding made-to-order)
            $criticalItems = InventoryItem::whereRaw('quantity_on_hand <= safety_stock')
                ->where('category', '!=', 'made-to-order')
                ->get()
                ->map(function($item) {
                    $item->urgency = 'critical';
                    $item->days_until_stockout = $this->calculateDaysUntilStockout($item);
                    return $item;
                });

            return [
                'summary' => [
                    'total_items' => $totalItems,
                    'low_stock_items' => $lowStockItems,
                    'out_of_stock_items' => $outOfStockItems,
                    'recent_usage' => $recentUsage,
                    'total_usage_3months' => $totalUsage3Months,
                    'alkansya_production' => [
                        'total_output' => $alkansyaStats->total_output ?? 0,
                        'avg_daily' => round($alkansyaStats->avg_daily ?? 0, 2),
                        'last_7_days' => $alkansyaStats->last_7_days ?? 0,
                        'production_days' => $alkansyaStats->total_days ?? 0
                    ]
                ],
                'critical_items' => $criticalItems
            ];
        });
    }

    /**
     * Get comprehensive inventory report
     */
    public function getInventoryReport(Request $request)
    {
        $startDate = $request->get('start_date', Carbon::now()->subDays(30)->format('Y-m-d'));
        $endDate = $request->get('end_date', Carbon::now()->format('Y-m-d'));
        $productFilter = $request->get('product_filter', 'all');
        
        // Cache report data for 2 minutes to improve performance
        $cacheKey = "inventory_report_{$startDate}_{$endDate}_{$productFilter}";
        
        return cache()->remember($cacheKey, 120, function () use ($startDate, $endDate, $productFilter) {
            $items = InventoryItem::with(['usages' => function($query) use ($startDate, $endDate) {
                $query->whereBetween('date', [$startDate, $endDate]);
            }])->get();

            // Filter items based on product relationship
            if ($productFilter !== 'all') {
                $items = $this->filterItemsByProduct($items, $productFilter);
            }

        $report = $items->map(function($item) use ($startDate, $endDate) {
            $totalUsage = $item->usages->sum('qty_used');
            $avgDailyUsage = $totalUsage / max(1, Carbon::parse($startDate)->diffInDays($endDate));
            
            return [
                'sku' => $item->sku,
                'name' => $item->name,
                'category' => $item->category,
                'current_stock' => $item->quantity_on_hand,
                'safety_stock' => $item->safety_stock,
                'reorder_point' => $item->reorder_point,
                'total_usage' => $totalUsage,
                'avg_daily_usage' => round($avgDailyUsage, 2),
                'days_until_stockout' => $avgDailyUsage > 0 ? floor($item->quantity_on_hand / $avgDailyUsage) : 999,
                'stock_status' => $this->getStockStatus($item),
                'reorder_needed' => $item->quantity_on_hand <= $item->reorder_point,
                'unit' => $item->unit,
                'location' => $item->location,
            ];
        });

            return [
                'period' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'days' => Carbon::parse($startDate)->diffInDays($endDate)
                ],
                'summary' => [
                    'total_items' => $items->count(),
                    'items_needing_reorder' => $report->where('reorder_needed', true)
                        ->where('category', '!=', 'made-to-order')
                        ->count(),
                    'critical_items' => $report->where('stock_status', 'critical')
                        ->where('category', '!=', 'made-to-order')
                        ->count(),
                    'total_usage' => $report->sum('total_usage'),
                ],
                'items' => $report
            ];
        });
    }

    /**
     * Filter inventory items by product relationship
     */
    private function filterItemsByProduct($items, $productFilter)
    {
        // Get product IDs based on filter
        $productIds = [];
        
        switch ($productFilter) {
            case 'alkansya':
                $productIds = \App\Models\Product::where('name', 'like', '%alkansya%')
                    ->orWhere('name', 'like', '%Alkansya%')
                    ->pluck('id')->toArray();
                break;
            case 'dining-table':
                $productIds = \App\Models\Product::where('name', 'like', '%table%')
                    ->orWhere('name', 'like', '%Table%')
                    ->pluck('id')->toArray();
                break;
            case 'wooden-chair':
                $productIds = \App\Models\Product::where('name', 'like', '%chair%')
                    ->orWhere('name', 'like', '%Chair%')
                    ->pluck('id')->toArray();
                break;
            default:
                return $items;
        }

        if (empty($productIds)) {
            return collect();
        }

        // Get inventory item IDs that are used by these products
        $inventoryItemIds = \App\Models\ProductMaterial::whereIn('product_id', $productIds)
            ->pluck('inventory_item_id')
            ->toArray();

        // Filter items to only include those used by the selected products
        return $items->filter(function($item) use ($inventoryItemIds) {
            return in_array($item->id, $inventoryItemIds);
        });
    }

    /**
     * Get stock turnover report
     */
    public function getStockTurnoverReport(Request $request)
    {
        $days = $request->get('days', 30);
        $startDate = Carbon::now()->subDays($days);

        $items = InventoryItem::with(['usages' => function($query) use ($startDate) {
            $query->where('date', '>=', $startDate);
        }])->get();

        $turnoverData = $items->map(function($item) use ($days) {
            $totalUsage = $item->usages->sum('qty_used');
            $avgStock = ($item->quantity_on_hand + $totalUsage) / 2; // Simplified average
            $turnoverRate = $avgStock > 0 ? $totalUsage / $avgStock : 0;
            $turnoverDays = $turnoverRate > 0 ? $days / $turnoverRate : 999;

            return [
                'sku' => $item->sku,
                'name' => $item->name,
                'total_usage' => $totalUsage,
                'avg_stock_level' => round($avgStock, 2),
                'turnover_rate' => round($turnoverRate, 2),
                'turnover_days' => round($turnoverDays, 1),
                'turnover_category' => $this->getTurnoverCategory($turnoverDays),
                'current_stock' => $item->quantity_on_hand,
            ];
        })->sortByDesc('turnover_rate')->values();

        return response()->json([
            'period_days' => $days,
            'summary' => [
                'fast_moving' => $turnoverData->where('turnover_category', 'fast')->count(),
                'medium_moving' => $turnoverData->where('turnover_category', 'medium')->count(),
                'slow_moving' => $turnoverData->where('turnover_category', 'slow')->count(),
                'avg_turnover_rate' => round($turnoverData->avg('turnover_rate'), 2),
            ],
            'items' => $turnoverData
        ]);
    }

    /**
     * Get material usage forecast
     */
    public function getMaterialForecast(Request $request)
    {
        $days = $request->get('forecast_days', 30);
        $historicalDays = $request->get('historical_days', 30);
        
        $startDate = Carbon::now()->subDays($historicalDays);
        
        $items = InventoryItem::where('category', '!=', 'made-to-order')
            ->with(['usages' => function($query) use ($startDate) {
                $query->where('date', '>=', $startDate);
            }])->get();

        $forecasts = $items->map(function($item) use ($days, $historicalDays) {
            $totalUsage = $item->usages->sum('qty_used');
            $avgDailyUsage = $totalUsage / max(1, $historicalDays);
            $forecastedUsage = $avgDailyUsage * $days;
            $projectedStock = $item->quantity_on_hand - $forecastedUsage;
            
            return [
                'sku' => $item->sku,
                'name' => $item->name,
                'current_stock' => $item->quantity_on_hand,
                'avg_daily_usage' => round($avgDailyUsage, 2),
                'forecasted_usage_' . $days . '_days' => round($forecastedUsage, 2),
                'projected_stock' => round($projectedStock, 2),
                'reorder_point' => $item->reorder_point,
                'will_need_reorder' => $projectedStock <= $item->reorder_point,
                'days_until_stockout' => $avgDailyUsage > 0 ? floor($item->quantity_on_hand / $avgDailyUsage) : 999,
                'recommended_order_qty' => $projectedStock < $item->reorder_point ? 
                    max(0, $item->max_level - $projectedStock) : 0,
            ];
        })->sortBy('days_until_stockout')->values();

        return response()->json([
            'forecast_period_days' => $days,
            'based_on_historical_days' => $historicalDays,
            'summary' => [
                'items_will_need_reorder' => $forecasts->where('will_need_reorder', true)->count(),
                'total_forecasted_usage' => round($forecasts->sum('forecasted_usage_' . $days . '_days'), 2),
                'items_critical' => $forecasts->where('days_until_stockout', '<', 7)->count(),
            ],
            'forecasts' => $forecasts
        ]);
    }

    /**
     * Get replenishment schedule
     */
    public function getReplenishmentSchedule(Request $request)
    {
        $items = InventoryItem::where('category', '!=', 'made-to-order')
            ->with(['usages' => function($query) {
                $query->where('date', '>=', Carbon::now()->subDays(30));
            }])->get();

        $schedule = $items->map(function($item) {
            $totalUsage = $item->usages->sum('qty_used');
            $avgDailyUsage = $totalUsage / 30;
            $daysUntilReorder = $avgDailyUsage > 0 ? 
                floor(($item->quantity_on_hand - $item->reorder_point) / $avgDailyUsage) : 999;
            
            $needsReorder = $item->quantity_on_hand <= $item->reorder_point;
            $reorderDate = $needsReorder ? Carbon::now() : Carbon::now()->addDays(max(0, $daysUntilReorder));
            $orderQty = $needsReorder ? ($item->max_level - $item->quantity_on_hand) : 0;

            return [
                'sku' => $item->sku,
                'name' => $item->name,
                'current_stock' => $item->quantity_on_hand,
                'reorder_point' => $item->reorder_point,
                'needs_immediate_reorder' => $needsReorder,
                'estimated_reorder_date' => $reorderDate->format('Y-m-d'),
                'days_until_reorder' => max(0, $daysUntilReorder),
                'recommended_order_qty' => round($orderQty, 2),
                'lead_time_days' => $item->lead_time_days,
                'order_by_date' => $reorderDate->subDays($item->lead_time_days)->format('Y-m-d'),
                'supplier' => $item->supplier,
                'priority' => $this->getReorderPriority($daysUntilReorder),
            ];
        })->sortBy('days_until_reorder')->values();

        return response()->json([
            'generated_at' => Carbon::now()->toDateTimeString(),
            'summary' => [
                'immediate_reorders' => $schedule->where('needs_immediate_reorder', true)->count(),
                'high_priority' => $schedule->where('priority', 'high')->count(),
                'medium_priority' => $schedule->where('priority', 'medium')->count(),
                'total_reorder_value' => $schedule->sum('recommended_order_qty'),
            ],
            'schedule' => $schedule
        ]);
    }

    /**
     * Get ABC analysis (inventory classification)
     */
    public function getABCAnalysis(Request $request)
    {
        $days = $request->get('days', 90);
        $startDate = Carbon::now()->subDays($days);

        $items = InventoryItem::with(['usages' => function($query) use ($startDate) {
            $query->where('date', '>=', $startDate);
        }])->get();

        // Calculate usage value for each item
        $itemsWithValue = $items->map(function($item) {
            $totalUsage = $item->usages->sum('qty_used');
            $usageValue = $totalUsage * ($item->unit_cost ?? 0);
            
            return [
                'item' => $item,
                'total_usage' => $totalUsage,
                'usage_value' => $usageValue,
            ];
        })->sortByDesc('usage_value');

        $totalValue = $itemsWithValue->sum('usage_value');
        $cumulativeValue = 0;
        
        $classified = $itemsWithValue->map(function($data) use ($totalValue, &$cumulativeValue) {
            $item = $data['item'];
            $cumulativeValue += $data['usage_value'];
            $cumulativePercent = ($cumulativeValue / max(1, $totalValue)) * 100;
            
            $classification = 'C';
            if ($cumulativePercent <= 80) {
                $classification = 'A';
            } elseif ($cumulativePercent <= 95) {
                $classification = 'B';
            }

            return [
                'sku' => $item->sku,
                'name' => $item->name,
                'total_usage' => $data['total_usage'],
                'usage_value' => round($data['usage_value'], 2),
                'percent_of_total' => round(($data['usage_value'] / max(1, $totalValue)) * 100, 2),
                'cumulative_percent' => round($cumulativePercent, 2),
                'classification' => $classification,
                'current_stock' => $item->quantity_on_hand,
                'recommendation' => $this->getABCRecommendation($classification),
            ];
        });

        return response()->json([
            'period_days' => $days,
            'summary' => [
                'class_a_items' => $classified->where('classification', 'A')->count(),
                'class_b_items' => $classified->where('classification', 'B')->count(),
                'class_c_items' => $classified->where('classification', 'C')->count(),
                'total_value' => round($totalValue, 2),
            ],
            'items' => $classified
        ]);
    }

    // Helper methods
    private function getStockStatus($item)
    {
        if ($item->quantity_on_hand == 0) return 'out_of_stock';
        if ($item->quantity_on_hand <= $item->safety_stock) return 'critical';
        if ($item->quantity_on_hand <= $item->reorder_point) return 'low';
        if ($item->quantity_on_hand >= $item->max_level) return 'overstock';
        return 'normal';
    }

    private function getTurnoverCategory($turnoverDays)
    {
        if ($turnoverDays < 30) return 'fast';
        if ($turnoverDays < 90) return 'medium';
        return 'slow';
    }

    private function getReorderPriority($daysUntilReorder)
    {
        if ($daysUntilReorder <= 0) return 'urgent';
        if ($daysUntilReorder <= 7) return 'high';
        if ($daysUntilReorder <= 14) return 'medium';
        return 'low';
    }

    private function getABCRecommendation($classification)
    {
        $recommendations = [
            'A' => 'High priority - Monitor closely, maintain optimal stock levels',
            'B' => 'Medium priority - Regular monitoring, standard reorder procedures',
            'C' => 'Low priority - Periodic review, bulk ordering acceptable',
        ];
        return $recommendations[$classification] ?? 'Review required';
    }

    /**
     * Get stock turnover report
     */
    public function getTurnoverReport(Request $request)
    {
        $days = $request->get('days', 30);
        $startDate = Carbon::now()->subDays($days);
        
        $items = InventoryItem::where('category', '!=', 'made-to-order')
            ->with(['usages' => function($query) use ($startDate) {
                $query->where('date', '>=', $startDate);
            }])->get();

        $turnoverData = $items->map(function($item) use ($days) {
            $totalUsage = $item->usages->sum('qty_used');
            $avgInventory = $item->quantity_on_hand;
            $turnoverRate = $avgInventory > 0 ? ($totalUsage / $avgInventory) * (365 / $days) : 0;
            
            $category = 'slow';
            if ($turnoverRate >= 12) $category = 'fast';
            elseif ($turnoverRate >= 6) $category = 'medium';
            
            return [
                'sku' => $item->sku,
                'name' => $item->name,
                'category' => $item->category,
                'current_stock' => $item->quantity_on_hand,
                'total_usage' => $totalUsage,
                'turnover_rate' => round($turnoverRate, 2),
                'turnover_category' => $category,
                'unit' => $item->unit,
            ];
        })->sortByDesc('turnover_rate')->values();

        return response()->json([
            'period_days' => $days,
            'summary' => [
                'fast_moving' => $turnoverData->where('turnover_category', 'fast')->count(),
                'medium_moving' => $turnoverData->where('turnover_category', 'medium')->count(),
                'slow_moving' => $turnoverData->where('turnover_category', 'slow')->count(),
                'avg_turnover_rate' => round($turnoverData->avg('turnover_rate'), 2),
            ],
            'items' => $turnoverData
        ]);
    }

}