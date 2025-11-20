<?php

namespace App\Http\Controllers;

use App\Models\Production;
use App\Models\ProductionAnalytics;
use App\Models\AlkansyaDailyOutput;
use App\Models\InventoryItem;
use App\Models\InventoryUsage;
use App\Models\ProductMaterial;
use App\Models\Product;
use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdvancedAnalyticsController extends Controller
{
    /**
     * Get comprehensive production analytics by product type
     */
    public function getProductionOutputAnalytics(Request $request)
    {
        $startDate = $request->get('start_date', Carbon::now()->subMonths(3)->format('Y-m-d'));
        $endDate = $request->get('end_date', Carbon::now()->format('Y-m-d'));
        $timeframe = $request->get('timeframe', 'daily'); // daily, weekly, monthly

        // Get production data by product type - use both actual_completion_date and date fields
        $tableProductions = Production::where('product_type', 'table')
            ->where('status', 'Completed')
            ->where(function($query) use ($startDate, $endDate) {
                $query->whereBetween('actual_completion_date', [$startDate, $endDate])
                      ->orWhereBetween('date', [$startDate, $endDate]);
            })
            ->get();

        $chairProductions = Production::where('product_type', 'chair')
            ->where('status', 'Completed')
            ->where(function($query) use ($startDate, $endDate) {
                $query->whereBetween('actual_completion_date', [$startDate, $endDate])
                      ->orWhereBetween('date', [$startDate, $endDate]);
            })
            ->get();

        // Get Alkansya from AlkansyaDailyOutput (the correct data source)
        $alkansyaProductions = AlkansyaDailyOutput::whereBetween('date', [$startDate, $endDate])
            ->get();
        // Get ALL Alkansya production for accurate total (matching dashboard/inventory)
        $allAlkansyaProductions = AlkansyaDailyOutput::all();    

        // Aggregate by timeframe - use actual_completion_date if available, otherwise use date
        $tableOutput = $this->aggregateByTimeframe($tableProductions, 'actual_completion_date', $timeframe, 'date');
        $chairOutput = $this->aggregateByTimeframe($chairProductions, 'actual_completion_date', $timeframe, 'date');
        $alkansyaOutput = $this->aggregateAlkansyaByTimeframe($alkansyaProductions, $timeframe);

        // Calculate totals and averages
        $tableTotals = [
            'total_output' => $tableProductions->sum('quantity'),
            'total_productions' => $tableProductions->count(),
            'avg_per_period' => $tableOutput->isNotEmpty() ? round($tableProductions->sum('quantity') / $tableOutput->count(), 2) : 0,
        ];

        $chairTotals = [
            'total_output' => $chairProductions->sum('quantity'),
            'total_productions' => $chairProductions->count(),
            'avg_per_period' => $chairOutput->isNotEmpty() ? round($chairProductions->sum('quantity') / $chairOutput->count(), 2) : 0,
        ];

        $alkansyaTotals = [
            'total_output' => $allAlkansyaProductions->sum('quantity_produced'),  // Use quantity_produced from AlkansyaDailyOutput
            'total_productions' => $allAlkansyaProductions->count(),
            'avg_per_period' => $alkansyaOutput->isNotEmpty() ? round($alkansyaProductions->sum('quantity_produced') / $alkansyaOutput->count(), 2) : 0,
        ];

        // Top performing products
        $topPerforming = [
            ['product' => 'Alkansya', 'output' => $alkansyaTotals['total_output'], 'efficiency' => 85], // Default efficiency for Alkansya
            ['product' => 'Dining Table', 'output' => $tableTotals['total_output'], 'efficiency' => $this->calculateEfficiency($tableProductions)],
            ['product' => 'Wooden Chair', 'output' => $chairTotals['total_output'], 'efficiency' => $this->calculateEfficiency($chairProductions)],
        ];

        usort($topPerforming, function($a, $b) {
            return $b['output'] <=> $a['output'];
        });

        return response()->json([
            'period' => ['start' => $startDate, 'end' => $endDate],
            'timeframe' => $timeframe,
            'products' => [
                'table' => [
                    'name' => 'Dining Table',
                    'output_trend' => $tableOutput,
                    'totals' => $tableTotals,
                ],
                'chair' => [
                    'name' => 'Wooden Chair',
                    'output_trend' => $chairOutput,
                    'totals' => $chairTotals,
                ],
                'alkansya' => [
                    'name' => 'Alkansya',
                    'output_trend' => $alkansyaOutput,
                    'totals' => $alkansyaTotals,
                ],
            ],
            'top_performing' => $topPerforming,
        ]);
    }

    /**
     * Get resource utilization analytics
     */
    public function getResourceUtilization(Request $request)
    {
        try {
            $startDate = $request->get('start_date', Carbon::now()->subMonths(3)->format('Y-m-d'));
            $endDate = $request->get('end_date', Carbon::now()->format('Y-m-d'));

            // Get material usage by product type
            $materialUsage = DB::table('inventory_usages as iu')
                ->join('inventory_items as ii', 'iu.inventory_item_id', '=', 'ii.id')
                ->join('product_materials as pm', 'ii.id', '=', 'pm.inventory_item_id')
                ->join('products as p', 'pm.product_id', '=', 'p.id')
                ->whereBetween('iu.date', [$startDate, $endDate])
                ->select(
                    'p.name as product_name',
                    'ii.name as material_name',
                    'ii.sku as material_sku',
                    DB::raw('SUM(iu.qty_used) as total_used'),
                    DB::raw('AVG(iu.qty_used) as avg_used'),
                    'ii.unit'
                )
                ->groupBy('p.name', 'ii.name', 'ii.sku', 'ii.unit')
                ->get();

            // Group by product
            $byProduct = $materialUsage->groupBy('product_name')->map(function($materials, $productName) {
                return [
                    'product' => $productName,
                    'materials' => $materials->map(function($m) {
                        return [
                            'material' => $m->material_name,
                            'sku' => $m->material_sku,
                            'total_used' => (float) $m->total_used,
                            'avg_used' => round((float) $m->avg_used, 2),
                            'unit' => $m->unit,
                        ];
                    })->values(),
                    'total_materials' => $materials->count(),
                ];
            })->values();

            // Calculate efficiency (actual vs estimated)
            $efficiencyData = $this->calculateMaterialEfficiency($startDate, $endDate);

            return response()->json([
                'period' => ['start' => $startDate, 'end' => $endDate],
                'material_usage_by_product' => $byProduct,
                'efficiency' => $efficiencyData,
            ]);
        } catch (\Exception $e) {
            \Log::error('Resource Utilization Error: ' . $e->getMessage());
            return response()->json([
                'period' => ['start' => $startDate ?? null, 'end' => $endDate ?? null],
                'material_usage_by_product' => [],
                'efficiency' => [],
                'error' => $e->getMessage()
            ], 200); // Return 200 with empty data instead of 500
        }
    }

    /**
     * Get production performance analytics
     */
    public function getProductionPerformance(Request $request)
    {
        $startDate = $request->get('start_date', Carbon::now()->subMonths(3)->format('Y-m-d'));
        $endDate = $request->get('end_date', Carbon::now()->format('Y-m-d'));

        $completedProductions = Production::where('status', 'Completed')
            ->whereNotNull('actual_completion_date')
            ->whereNotNull('production_started_at')
            ->whereBetween('actual_completion_date', [$startDate, $endDate])
            ->get();

        // Calculate cycle time by product
        $cycleTimeByProduct = $completedProductions->groupBy('product_type')->map(function($prods, $type) {
            $cycleTimes = $prods->map(function($p) {
                $start = Carbon::parse($p->production_started_at);
                $end = Carbon::parse($p->actual_completion_date);
                return $end->diffInDays($start);
            });

            return [
                'product_type' => ucfirst($type),
                'avg_cycle_time_days' => round($cycleTimes->avg(), 2),
                'min_cycle_time_days' => $cycleTimes->min(),
                'max_cycle_time_days' => $cycleTimes->max(),
                'total_completed' => $prods->count(),
            ];
        })->values();

        // Calculate throughput rate (products per day)
        $totalDays = Carbon::parse($startDate)->diffInDays(Carbon::parse($endDate)) + 1;
        $throughputByProduct = $completedProductions->groupBy('product_type')->map(function($prods, $type) use ($totalDays) {
            $totalOutput = $prods->sum('quantity');
            return [
                'product_type' => ucfirst($type),
                'total_output' => $totalOutput,
                'throughput_per_day' => round($totalOutput / max(1, $totalDays), 2),
                'throughput_per_week' => round(($totalOutput / max(1, $totalDays)) * 7, 2),
                'throughput_per_month' => round(($totalOutput / max(1, $totalDays)) * 30, 2),
            ];
        })->values();

        return response()->json([
            'period' => ['start' => $startDate, 'end' => $endDate, 'total_days' => $totalDays],
            'cycle_time_analysis' => $cycleTimeByProduct,
            'throughput_rate' => $throughputByProduct,
        ]);
    }

    /**
     * Get predictive analytics and forecasting
     */
    public function getPredictiveAnalytics(Request $request)
    {
        $forecastDays = $request->get('forecast_days', 30);

        // Get historical data (last 90 days)
        $historicalStart = Carbon::now()->subDays(90)->format('Y-m-d');
        $historicalEnd = Carbon::now()->format('Y-m-d');

        // Forecast material usage
        $materialForecast = $this->forecastMaterialUsage($forecastDays);

        // Forecast production capacity
        $capacityForecast = $this->forecastProductionCapacity($forecastDays);

        // Inventory replenishment needs
        $replenishmentNeeds = $this->calculateReplenishmentNeeds($forecastDays);

        // Trend analysis
        $trends = $this->analyzeTrends();

        return response()->json([
            'forecast_period_days' => $forecastDays,
            'forecast_end_date' => Carbon::now()->addDays($forecastDays)->format('Y-m-d'),
            'material_usage_forecast' => $materialForecast,
            'production_capacity_forecast' => $capacityForecast,
            'inventory_replenishment_needs' => $replenishmentNeeds,
            'trend_analysis' => $trends,
        ]);
    }

    /**
     * Get material usage trends
     */
    public function getMaterialUsageTrends(Request $request)
    {
        $startDate = $request->get('start_date', Carbon::now()->subMonths(3)->format('Y-m-d'));
        $endDate = $request->get('end_date', Carbon::now()->format('Y-m-d'));
        $timeframe = $request->get('timeframe', 'daily');

        $usageData = InventoryUsage::with('inventoryItem')
            ->whereBetween('date', [$startDate, $endDate])
            ->get();

        // Group by material and timeframe
        $trends = $usageData->groupBy(function($usage) use ($timeframe) {
            $date = Carbon::parse($usage->date);
            switch($timeframe) {
                case 'weekly':
                    return $date->format('Y-W');
                case 'monthly':
                    return $date->format('Y-m');
                default:
                    return $date->format('Y-m-d');
            }
        })->map(function($usages, $period) {
            $byMaterial = $usages->groupBy('inventory_item_id')->map(function($items) {
                $item = $items->first()->inventoryItem;
                return [
                    'material' => $item->name,
                    'sku' => $item->sku,
                    'total_used' => $items->sum('qty_used'),
                    'unit' => $item->unit,
                ];
            })->values();

            return [
                'period' => $period,
                'materials' => $byMaterial,
                'total_materials_used' => $byMaterial->count(),
            ];
        })->values();

        return response()->json([
            'period' => ['start' => $startDate, 'end' => $endDate],
            'timeframe' => $timeframe,
            'usage_trends' => $trends,
        ]);
    }

    /**
     * Get automated stock report
     */
    public function getAutomatedStockReport()
    {
        $inventoryItems = InventoryItem::all();
        
        $report = $inventoryItems->map(function($item) {
            // Calculate daily usage rate
            $recentUsage = InventoryUsage::where('inventory_item_id', $item->id)
                ->where('date', '>=', Carbon::now()->subDays(30))
                ->get();

            $dailyUsageRate = $recentUsage->isNotEmpty() 
                ? $recentUsage->sum('qty_used') / 30 
                : 0;

            $daysUntilDepletion = $dailyUsageRate > 0 
                ? round($item->quantity_on_hand / $dailyUsageRate, 1)
                : null;

            $depletionDate = $daysUntilDepletion 
                ? Carbon::now()->addDays($daysUntilDepletion)->format('Y-m-d')
                : null;

            $status = 'healthy';
            if ($item->quantity_on_hand <= $item->reorder_point) {
                $status = 'critical';
            } elseif ($item->quantity_on_hand <= $item->safety_stock * 1.5) {
                $status = 'low';
            }

            $suggestedReorderQty = max(0, ($item->max_level ?? $item->safety_stock * 3) - $item->quantity_on_hand);

            return [
                'material' => $item->name,
                'sku' => $item->sku,
                'category' => $item->category,
                'current_stock' => $item->quantity_on_hand,
                'unit' => $item->unit,
                'safety_stock' => $item->safety_stock,
                'reorder_point' => $item->reorder_point,
                'max_level' => $item->max_level,
                'daily_usage_rate' => round($dailyUsageRate, 2),
                'days_until_depletion' => $daysUntilDepletion,
                'predicted_depletion_date' => $depletionDate,
                'status' => $status,
                'suggested_reorder_qty' => $suggestedReorderQty,
                'lead_time_days' => $item->lead_time_days,
            ];
        });

        // Group by status
        $byStatus = [
            'critical' => $report->where('status', 'critical')->values(),
            'low' => $report->where('status', 'low')->values(),
            'healthy' => $report->where('status', 'healthy')->values(),
        ];

        return response()->json([
            'generated_at' => now()->toDateTimeString(),
            'total_items' => $report->count(),
            'summary' => [
                'critical_items' => $byStatus['critical']->count(),
                'low_stock_items' => $byStatus['low']->count(),
                'healthy_items' => $byStatus['healthy']->count(),
            ],
            'items_by_status' => $byStatus,
            'all_items' => $report,
        ]);
    }

    // Helper methods

    private function aggregateByTimeframe($productions, $dateField, $timeframe, $fallbackDateField = null)
    {
        return $productions->groupBy(function($prod) use ($dateField, $timeframe, $fallbackDateField) {
            // Use primary date field if available, otherwise use fallback
            $dateValue = $prod->$dateField ?? ($fallbackDateField ? $prod->$fallbackDateField : null);
            if (!$dateValue) {
                return 'unknown';
            }
            
            $date = Carbon::parse($dateValue);
            switch($timeframe) {
                case 'weekly':
                    return $date->format('Y-W');
                case 'monthly':
                    return $date->format('Y-m');
                default:
                    return $date->format('Y-m-d');
            }
        })->map(function($prods, $period) {
            return [
                'period' => $period,
                'output' => $prods->sum('quantity'),
                'count' => $prods->count(),
            ];
        })->values();
    }

    private function aggregateAlkansyaByTimeframe($analytics, $timeframe)
    {
        return $analytics->groupBy(function($item) use ($timeframe) {
            $date = Carbon::parse($item->date);
            switch($timeframe) {
                case 'weekly':
                    return $date->format('Y-W');
                case 'monthly':
                    return $date->format('Y-m');
                default:
                    return $date->format('Y-m-d');
            }
        })->map(function($items, $period) {
            return [
                'period' => $period,
                'output' => $items->sum('quantity_produced'),
                'count' => $items->count(),
            ];
        })->values();
    }

    private function calculateEfficiency($productions)
    {
        if ($productions->isEmpty()) return 0;

        $completedProductions = $productions->filter(function($prod) {
            return $prod->status === 'Completed' && 
                   $prod->production_started_at && 
                   $prod->actual_completion_date;
        });

        if ($completedProductions->isEmpty()) return 0;

        $totalEfficiency = $completedProductions->sum(function($prod) {
            $estimated = $prod->estimated_completion_date 
                ? Carbon::parse($prod->production_started_at)->diffInDays(Carbon::parse($prod->estimated_completion_date))
                : 14;
            
            $actual = Carbon::parse($prod->production_started_at)->diffInDays(Carbon::parse($prod->actual_completion_date));
            
            return $actual > 0 ? min(100, ($estimated / $actual) * 100) : 0;
        });

        return round($totalEfficiency / $completedProductions->count(), 2);
    }

    private function calculateMaterialEfficiency($startDate, $endDate)
    {
        // Compare actual usage vs BOM estimates
        $productions = Production::where('status', 'Completed')
            ->whereBetween('actual_completion_date', [$startDate, $endDate])
            ->with('product')
            ->get();

        return $productions->groupBy('product_id')->map(function($prods, $productId) {
            $product = $prods->first()->product;
            $totalQty = $prods->sum('quantity');
            
            // Get BOM
            $bom = ProductMaterial::where('product_id', $productId)->with('inventoryItem')->get();
            $estimatedUsage = $bom->sum(function($mat) use ($totalQty) {
                return $mat->qty_per_unit * $totalQty;
            });

            // Get actual usage
            $actualUsage = InventoryUsage::whereIn('inventory_item_id', $bom->pluck('inventory_item_id'))
                ->whereIn('date', $prods->pluck('actual_completion_date')->map(fn($d) => Carbon::parse($d)->format('Y-m-d')))
                ->sum('qty_used');

            $efficiency = $estimatedUsage > 0 ? round(($estimatedUsage / max(1, $actualUsage)) * 100, 2) : 100;

            return [
                'product' => $product->name,
                'estimated_usage' => $estimatedUsage,
                'actual_usage' => $actualUsage,
                'efficiency_percentage' => $efficiency,
                'variance' => $actualUsage - $estimatedUsage,
            ];
        })->values();
    }

    private function forecastMaterialUsage($days)
    {
        // Get historical usage (last 30 days)
        $historicalUsage = InventoryUsage::where('date', '>=', Carbon::now()->subDays(30))
            ->with('inventoryItem')
            ->get()
            ->groupBy('inventory_item_id');

        return $historicalUsage->map(function($usages, $itemId) use ($days) {
            $item = $usages->first()->inventoryItem;
            $dailyAvg = $usages->sum('qty_used') / 30;
            $forecastedUsage = $dailyAvg * $days;

            return [
                'material' => $item->name,
                'sku' => $item->sku,
                'current_stock' => $item->quantity_on_hand,
                'daily_avg_usage' => round($dailyAvg, 2),
                'forecasted_usage_' . $days . '_days' => round($forecastedUsage, 2),
                'remaining_after_forecast' => max(0, $item->quantity_on_hand - $forecastedUsage),
                'unit' => $item->unit,
            ];
        })->values();
    }

    private function forecastProductionCapacity($days)
    {
        // Get historical production rates
        $recentProductions = Production::where('status', 'Completed')
            ->where('actual_completion_date', '>=', Carbon::now()->subDays(30))
            ->get()
            ->groupBy('product_type');

        return $recentProductions->map(function($prods, $type) use ($days) {
            $dailyAvg = $prods->sum('quantity') / 30;
            $forecastedOutput = $dailyAvg * $days;

            return [
                'product_type' => ucfirst($type),
                'daily_avg_output' => round($dailyAvg, 2),
                'forecasted_output_' . $days . '_days' => round($forecastedOutput, 0),
                'weekly_capacity' => round($dailyAvg * 7, 0),
                'monthly_capacity' => round($dailyAvg * 30, 0),
            ];
        })->values();
    }

    private function calculateReplenishmentNeeds($forecastDays)
    {
        $forecast = $this->forecastMaterialUsage($forecastDays);
        
        return $forecast->filter(function($item) {
            return $item['remaining_after_forecast'] <= 0 || 
                   $item['current_stock'] <= ($item['daily_avg_usage'] * 7); // Less than 1 week supply
        })->map(function($item) use ($forecastDays) {
            $daysUntilDepletion = $item['daily_avg_usage'] > 0 
                ? round($item['current_stock'] / $item['daily_avg_usage'], 1)
                : null;

            return [
                'material' => $item['material'],
                'sku' => $item['sku'],
                'current_stock' => $item['current_stock'],
                'days_until_depletion' => $daysUntilDepletion,
                'urgency' => $daysUntilDepletion <= 7 ? 'critical' : 'moderate',
                'recommended_order_qty' => round($item['daily_avg_usage'] * 30, 0), // 30 days supply
                'unit' => $item['unit'],
            ];
        })->values();
    }

    private function analyzeTrends()
    {
        // Analyze last 90 days
        $data = ProductionAnalytics::where('date', '>=', Carbon::now()->subDays(90))
            ->get();

        $byMonth = $data->groupBy(function($item) {
            return Carbon::parse($item->date)->format('Y-m');
        });

        $monthlyTrends = $byMonth->map(function($items, $month) {
            return [
                'month' => $month,
                'total_output' => $items->sum('actual_output'),
                'avg_efficiency' => round($items->avg('efficiency_percentage'), 2),
            ];
        })->values();

        // Detect patterns
        $outputs = $monthlyTrends->pluck('total_output');
        $trend = 'stable';
        if ($outputs->count() >= 2) {
            $first = $outputs->first();
            $last = $outputs->last();
            if ($last > $first * 1.1) $trend = 'increasing';
            if ($last < $first * 0.9) $trend = 'decreasing';
        }

        return [
            'monthly_trends' => $monthlyTrends,
            'overall_trend' => $trend,
            'avg_monthly_output' => round($outputs->avg(), 0),
        ];
    }
}
