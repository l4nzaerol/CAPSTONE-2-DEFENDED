<?php

// app/Http/Controllers/ReportController.php
namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Models\InventoryUsage;
use App\Models\Production;
use App\Models\ProductionProcess;
use App\Models\AlkansyaDailyOutput;
use App\Models\Product;
use App\Models\Order;
use Illuminate\Http\Request;
use App\Services\InventoryForecastService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class ReportController extends Controller
{
    public function replenishment() {
        $items = InventoryItem::with('usage')->get();

        $report = $items->map(function($item) {
            $avgDaily = $item->usage()
                ->where('date','>=',now()->subDays(30))
                ->avg('qty_used') ?? 0;

            $rop = $item->reorder_point ??
                ($avgDaily * $item->lead_time_days + $item->safety_stock);

            $suggestOrder = ($item->quantity_on_hand <= $rop)
                ? max(0, ($item->max_level ?? $rop + $item->safety_stock) - $item->quantity_on_hand)
                : 0;

            return [
                'sku' => $item->sku,
                'name' => $item->name,
                'on_hand' => $item->quantity_on_hand,
                'avg_daily_usage' => round($avgDaily,2),
                'rop' => $rop,
                'suggested_order' => $suggestOrder,
            ];
        });

        return response()->json($report);
    }

    public function forecast(Request $request, InventoryForecastService $svc)
    {
        $window = (int) $request->query('window', 30);
        $items = InventoryItem::with('usage')->get();

        $data = $items->map(function(InventoryItem $item) use ($svc, $window) {
            $avg = $svc->calculateMovingAverageDailyUsage($item, $window);
            $days = $svc->estimateDaysToDepletion($item, $window);
            $rop = $svc->computeReorderPoint($item, $window);
            $suggest = $svc->suggestReplenishmentQty($item, $window);
            return [
                'sku' => $item->sku,
                'name' => $item->name,
                'on_hand' => $item->quantity_on_hand,
                'avg_daily_usage' => round($avg,2),
                'days_to_depletion' => $days,
                'reorder_point' => $rop,
                'suggested_order' => $suggest,
            ];
        })->values();

        return response()->json($data);
    }

    public function stockCsv()
    {
        $rows = InventoryItem::all()->map(function($i){
            return [
                'sku' => $i->sku,
                'name' => $i->name,
                'category' => $i->category,
                'location' => $i->location,
                'quantity_on_hand' => $i->quantity_on_hand,
                'safety_stock' => $i->safety_stock,
                'reorder_point' => $i->reorder_point,
                'max_level' => $i->max_level,
                'lead_time_days' => $i->lead_time_days,
            ];
        })->toArray();

        return $this->arrayToCsvResponse($rows, 'stock.csv');
    }

    public function usageCsv(Request $request)
    {
        $days = (int) $request->query('days', 90);
        $since = now()->subDays($days);
        $rows = \App\Models\InventoryUsage::with('inventoryItem')
            ->where('date','>=',$since)
            ->get()
            ->map(function($u){
                return [
                    'date' => optional($u->date)->format('Y-m-d'),
                    'sku' => optional($u->inventoryItem)->sku,
                    'name' => optional($u->inventoryItem)->name,
                    'qty_used' => $u->qty_used,
                ];
            })->toArray();

        return $this->arrayToCsvResponse($rows, 'usage.csv');
    }

    public function replenishmentCsv(InventoryForecastService $svc)
    {
        $items = InventoryItem::with('usage')->get();
        $rows = $items->map(function($item) use ($svc) {
            return [
                'sku' => $item->sku,
                'name' => $item->name,
                'on_hand' => $item->quantity_on_hand,
                'avg_daily_usage' => round($svc->calculateMovingAverageDailyUsage($item),2),
                'reorder_point' => $svc->computeReorderPoint($item),
                'suggested_order' => $svc->suggestReplenishmentQty($item),
            ];
        })->toArray();

        return $this->arrayToCsvResponse($rows, 'replenishment.csv');
    }

    // New: Inventory overview JSON and CSV
    public function inventoryOverview()
    {
        $items = InventoryItem::all();
        $summary = [
            'total_items' => $items->count(),
            'raw_materials' => $items->where('category','raw')->count(),
            'finished_goods' => $items->where('category','finished')->count(),
            'low_stock' => $items->filter(fn($i)=>!is_null($i->reorder_point) && $i->quantity_on_hand <= $i->reorder_point)->count(),
            'out_of_stock' => $items->where('quantity_on_hand', 0)->count(),
        ];

        return response()->json([
            'summary' => $summary,
            'items' => $items,
        ]);
    }

    public function inventoryOverviewCsv()
    {
        $rows = InventoryItem::all()->map(function($i){
            return [
                'sku' => $i->sku,
                'name' => $i->name,
                'category' => $i->category,
                'location' => $i->location,
                'on_hand' => $i->quantity_on_hand,
                'safety_stock' => $i->safety_stock,
                'reorder_point' => $i->reorder_point,
                'lead_time_days' => $i->lead_time_days,
            ];
        })->toArray();
        return $this->arrayToCsvResponse($rows, 'inventory_overview.csv');
    }

    // New: Turnover metrics and CSV
    public function turnover(Request $request, InventoryForecastService $svc)
    {
        $window = (int) $request->query('window', 30);
        $items = InventoryItem::with('usage')->get();
        $data = $items->map(function(InventoryItem $item) use ($svc, $window){
            $avg = $svc->calculateMovingAverageDailyUsage($item, $window);
            $daysToDepletion = $svc->estimateDaysToDepletion($item, $window);
            $rop = $svc->computeReorderPoint($item, $window);
            $turnover = $avg > 0 ? round(($item->quantity_on_hand / max(1,$avg)), 2) : null;
            return [
                'sku' => $item->sku,
                'name' => $item->name,
                'avg_daily_usage' => round($avg,2),
                'on_hand' => $item->quantity_on_hand,
                'inventory_turnover_days' => $turnover,
                'reorder_point' => $rop,
                'days_to_depletion' => $daysToDepletion,
            ];
        })->values();
        return response()->json($data);
    }

    public function turnoverCsv(Request $request, InventoryForecastService $svc)
    {
        $json = $this->turnover($request, $svc)->getData(true);
        $rows = $json;
        return $this->arrayToCsvResponse($rows, 'inventory_turnover.csv');
    }

    // New: Replenishment schedule and CSV
    public function replenishmentSchedule(Request $request, InventoryForecastService $svc)
    {
        $window = (int) $request->query('window', 30);
        $items = InventoryItem::with('usage')->get();
        $schedule = $items->map(function(InventoryItem $item) use ($svc, $window){
            $avg = $svc->calculateMovingAverageDailyUsage($item, $window);
            $rop = $svc->computeReorderPoint($item, $window);
            $daysToRop = $avg > 0 ? max(0, ceil(($item->quantity_on_hand - $rop) / max($avg, 1e-6))) : null;
            $eta = is_null($daysToRop) ? null : now()->addDays($daysToRop)->toDateString();
            $suggest = $svc->suggestReplenishmentQty($item, $window);
            return [
                'sku' => $item->sku,
                'name' => $item->name,
                'reorder_on_or_before' => $eta,
                'suggested_order_qty' => $suggest,
            ];
        })->filter(fn($r) => ($r['suggested_order_qty'] ?? 0) > 0)->values();
        return response()->json($schedule);
    }

    public function replenishmentScheduleCsv(Request $request, InventoryForecastService $svc)
    {
        $json = $this->replenishmentSchedule($request, $svc)->getData(true);
        $rows = $json;
        return $this->arrayToCsvResponse($rows, 'replenishment_schedule.csv');
    }
    /**
     * Export production report as CSV (efficiency, progress, bottlenecks)
     */
    public function productionCsv(Request $request)
    {
        $start = $request->query('start_date');
        $end = $request->query('end_date');
        
        // Get regular production data (excluding alkansya)
        $q = Production::with('product');
        if ($start && $end) {
            $q->whereBetween('date', [$start, $end]);
        }
        $productionRows = $q->get()->map(function($p){
            return [
                'id' => $p->id,
                'date' => optional($p->date)->format('Y-m-d'),
                'product' => optional($p->product)->name ?? $p->product_name,
                'stage' => $p->current_stage,
                'status' => $p->status,
                'quantity' => $p->quantity,
            ];
        })->toArray();

        // Get alkansya production data from AlkansyaDailyOutput
        $alkansyaQuery = AlkansyaDailyOutput::query();
        if ($start && $end) {
            $alkansyaQuery->whereBetween('date', [$start, $end]);
        }
        
        // Get alkansya product name
        $alkansyaProduct = Product::where('category_name', 'Stocked Products')
            ->where(function($query) {
                $query->where('name', 'LIKE', '%Alkansya%')
                      ->orWhere('product_name', 'LIKE', '%Alkansya%');
            })
            ->first();
        
        $alkansyaProductName = $alkansyaProduct ? ($alkansyaProduct->product_name ?? $alkansyaProduct->name) : 'Alkansya';
        
        $alkansyaRows = $alkansyaQuery->get()->map(function($alkansya, $index) use ($alkansyaProductName) {
            return [
                'id' => 'ALK-' . ($alkansya->id ?? $index + 1),
                'date' => optional($alkansya->date)->format('Y-m-d'),
                'product' => $alkansyaProductName,
                'stage' => 'Completed', // Alkansya is pre-made, so always completed
                'status' => 'Completed',
                'quantity' => $alkansya->quantity_produced ?? 0,
            ];
        })->toArray();

        // Merge both arrays
        $rows = array_merge($productionRows, $alkansyaRows);
        
        // Sort by date (most recent first) and then by id
        usort($rows, function($a, $b) {
            $dateCompare = strcmp($b['date'] ?? '', $a['date'] ?? '');
            if ($dateCompare !== 0) {
                return $dateCompare;
            }
            return strcmp($a['id'] ?? '', $b['id'] ?? '');
        });

        return $this->arrayToCsvResponse($rows, 'production.csv');
    }

    private function arrayToCsvResponse(array $rows, string $filename)
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        $callback = function() use ($rows) {
            $out = fopen('php://output', 'w');
            if (empty($rows)) {
                fclose($out);
                return;
            }
            // header
            fputcsv($out, array_keys($rows[0]));
            foreach ($rows as $row) {
                fputcsv($out, $row);
            }
            fclose($out);
        };

        return response()->stream($callback, 200, $headers);
    }

    // PDF Export Methods - Using actual data from database (seeders + manual)
    public function stockPdf()
    {
        // Use Material model to get actual stock data (same as EnhancedInventoryReports)
        $materials = \App\Models\Material::with('inventory')->get();
        
        $rows = $materials->map(function($material) {
            $totalStock = $material->inventory->sum('current_stock');
            $reorderPoint = $material->reorder_point ?? 10;
            
            // Determine stock status
            $stockStatus = 'In Stock';
            if ($totalStock <= 0) {
                $stockStatus = 'Out of Stock';
            } elseif ($totalStock <= $reorderPoint) {
                $stockStatus = 'Low Stock';
            }
            
            return [
                'Material Name' => $material->material_name,
                'SKU' => $material->material_code ?: 'MAT-' . str_pad($material->material_id, 3, '0', STR_PAD_LEFT),
                'Category' => $material->category ?? 'Material',
                'Current Stock' => number_format($totalStock, 2),
                'Safety Stock' => $material->safety_stock ?? 0,
                'Reorder Point' => $reorderPoint,
                'Unit Cost' => '₱' . number_format($material->unit_cost ?? 0, 2),
                'Total Value' => '₱' . number_format($totalStock * ($material->unit_cost ?? 0), 2),
                'Status' => $stockStatus,
            ];
        })->toArray();

        $pdf = Pdf::loadView('pdf.inventory-report', [
            'data' => $rows,
            'reportType' => 'Stock Levels Report',
            'dateRange' => null
        ]);

        return $pdf->download('stock_levels_report_' . now()->format('Y-m-d') . '.pdf');
    }

    public function usagePdf(Request $request)
    {
        // Use EnhancedInventoryReportsController method to get actual usage data (matches CSV format)
        $enhancedController = new \App\Http\Controllers\EnhancedInventoryReportsController();
        $usageRequest = new Request(['days' => $request->query('days', 90), 'report_type' => 'usage']);
        return $enhancedController->exportInventoryPdf($usageRequest);
    }

    public function replenishmentPdf(Request $request)
    {
        // Use EnhancedInventoryReportsController method to get actual replenishment data
        $enhancedController = new \App\Http\Controllers\EnhancedInventoryReportsController();
        $replenishmentResponse = $enhancedController->getEnhancedReplenishmentSchedule($request);
        $replenishmentData = $replenishmentResponse->getData(true);
        
        $rows = [];
        
        // Combine Alkansya and Made-to-Order replenishment schedules
        if (isset($replenishmentData['alkansya_replenishment']['schedule']) && is_array($replenishmentData['alkansya_replenishment']['schedule'])) {
            foreach ($replenishmentData['alkansya_replenishment']['schedule'] as $item) {
                $rows[] = [
                    'Material Name' => $item['material_name'] ?? 'N/A',
                    'Category' => 'Alkansya',
                    'Current Stock' => number_format($item['current_stock'] ?? 0, 2),
                    'Reorder Point' => number_format($item['reorder_point'] ?? 0, 2),
                    'Recommended Quantity' => number_format($item['recommended_quantity'] ?? 0, 2),
                    'Days Until Reorder' => $item['days_until_reorder'] ?? 'N/A',
                    'Priority' => $item['priority'] ?? 'Normal',
                    'Status' => ($item['needs_reorder'] ?? false) ? 'Need Reorder' : 'In Stock',
                    'Unit Cost' => '₱' . number_format($item['unit_cost'] ?? 0, 2),
                    'Estimated Cost' => '₱' . number_format(($item['recommended_quantity'] ?? 0) * ($item['unit_cost'] ?? 0), 2),
                ];
            }
        }
        
        if (isset($replenishmentData['made_to_order_replenishment']['schedule']) && is_array($replenishmentData['made_to_order_replenishment']['schedule'])) {
            foreach ($replenishmentData['made_to_order_replenishment']['schedule'] as $item) {
                $rows[] = [
                    'Material Name' => $item['material_name'] ?? 'N/A',
                    'Category' => 'Made to Order',
                    'Current Stock' => number_format($item['current_stock'] ?? 0, 2),
                    'Reorder Point' => number_format($item['reorder_point'] ?? 0, 2),
                    'Recommended Quantity' => number_format($item['recommended_quantity'] ?? 0, 2),
                    'Days Until Reorder' => $item['days_until_reorder'] ?? 'N/A',
                    'Priority' => $item['priority'] ?? 'Normal',
                    'Status' => ($item['needs_reorder'] ?? false) ? 'Need Reorder' : 'In Stock',
                    'Unit Cost' => '₱' . number_format($item['unit_cost'] ?? 0, 2),
                    'Estimated Cost' => '₱' . number_format(($item['recommended_quantity'] ?? 0) * ($item['unit_cost'] ?? 0), 2),
                ];
            }
        }

        $pdf = Pdf::loadView('pdf.inventory-report', [
            'data' => $rows,
            'reportType' => 'Replenishment Schedule Report',
            'dateRange' => null
        ]);

        return $pdf->download('replenishment_schedule_report_' . now()->format('Y-m-d') . '.pdf');
    }

    public function productionPdf(Request $request)
    {
        $start = $request->query('start_date');
        $end = $request->query('end_date');
        
        // Get regular production data (excluding alkansya)
        $q = Production::with('product');
        if ($start && $end) {
            $q->whereBetween('date', [$start, $end]);
        }
        $productionRows = $q->get()->map(function($p){
            return [
                'id' => $p->id,
                'date' => optional($p->date)->format('Y-m-d'),
                'product' => optional($p->product)->name ?? $p->product_name,
                'stage' => $p->current_stage,
                'status' => $p->status,
                'quantity' => $p->quantity,
            ];
        })->toArray();

        // Get alkansya production data from AlkansyaDailyOutput
        $alkansyaQuery = AlkansyaDailyOutput::query();
        if ($start && $end) {
            $alkansyaQuery->whereBetween('date', [$start, $end]);
        }
        
        // Get alkansya product name
        $alkansyaProduct = Product::where('category_name', 'Stocked Products')
            ->where(function($query) {
                $query->where('name', 'LIKE', '%Alkansya%')
                      ->orWhere('product_name', 'LIKE', '%Alkansya%');
            })
            ->first();
        
        $alkansyaProductName = $alkansyaProduct ? ($alkansyaProduct->product_name ?? $alkansyaProduct->name) : 'Alkansya';
        
        $alkansyaRows = $alkansyaQuery->get()->map(function($alkansya, $index) use ($alkansyaProductName) {
            return [
                'id' => 'ALK-' . ($alkansya->id ?? $index + 1),
                'date' => optional($alkansya->date)->format('Y-m-d'),
                'product' => $alkansyaProductName,
                'stage' => 'Completed', // Alkansya is pre-made, so always completed
                'status' => 'Completed',
                'quantity' => $alkansya->quantity_produced ?? 0,
            ];
        })->toArray();

        // Merge both arrays
        $rows = array_merge($productionRows, $alkansyaRows);
        
        // Sort by date (most recent first) and then by id
        usort($rows, function($a, $b) {
            $dateCompare = strcmp($b['date'] ?? '', $a['date'] ?? '');
            if ($dateCompare !== 0) {
                return $dateCompare;
            }
            return strcmp($a['id'] ?? '', $b['id'] ?? '');
        });

        $pdf = Pdf::loadView('pdf.production-report', [
            'data' => $rows,
            'reportType' => 'Production Report',
            'dateRange' => $start && $end ? [
                'start' => $start,
                'end' => $end
            ] : null
        ]);

        return $pdf->download('production_report_' . now()->format('Y-m-d') . '.pdf');
    }

    /**
     * Get product-level production performance data
     * Returns detailed performance metrics for each product (both Alkansya and Made-to-Order)
     */
    public function getProductPerformanceData(Request $request)
    {
        $start = $request->query('start_date', Carbon::now()->subDays(30)->format('Y-m-d'));
        $end = $request->query('end_date', Carbon::now()->format('Y-m-d'));
        
        $products = [];
        
        // Get Alkansya product
        $alkansyaProduct = Product::where('category_name', 'Stocked Products')
            ->where(function($query) {
                $query->where('name', 'LIKE', '%Alkansya%')
                      ->orWhere('product_name', 'LIKE', '%Alkansya%');
            })
            ->first();
        
        if ($alkansyaProduct) {
            // Get Alkansya daily output data
            $alkansyaOutput = AlkansyaDailyOutput::whereBetween('date', [$start, $end])
                ->orderBy('date', 'desc')
                ->get();
            
            $totalProduced = $alkansyaOutput->sum('quantity_produced');
            $daysWithOutput = $alkansyaOutput->count();
            $avgDailyOutput = $daysWithOutput > 0 ? round($totalProduced / $daysWithOutput, 2) : 0;
            $maxDailyOutput = $alkansyaOutput->max('quantity_produced') ?? 0;
            $minDailyOutput = $alkansyaOutput->min('quantity_produced') ?? 0;
            
            // Calculate efficiency (based on target if available, or use average)
            $targetDaily = 20; // Default target
            $efficiency = $targetDaily > 0 ? round(($avgDailyOutput / $targetDaily) * 100, 2) : 0;
            
            // Get recent production dates
            $firstProductionDate = $alkansyaOutput->min('date');
            $lastProductionDate = $alkansyaOutput->max('date');
            
            $products[] = [
                'product_id' => $alkansyaProduct->id,
                'product_name' => $alkansyaProduct->product_name ?? $alkansyaProduct->name,
                'category' => 'Alkansya',
                'total_quantity_produced' => $totalProduced,
                'days_with_production' => $daysWithOutput,
                'average_daily_output' => $avgDailyOutput,
                'max_daily_output' => $maxDailyOutput,
                'min_daily_output' => $minDailyOutput,
                'efficiency_percentage' => $efficiency,
                'first_production_date' => $firstProductionDate ? $firstProductionDate->format('Y-m-d') : null,
                'last_production_date' => $lastProductionDate ? $lastProductionDate->format('Y-m-d') : null,
                'production_trend' => $this->calculateProductionTrend($alkansyaOutput),
                'recent_output' => $alkansyaOutput->take(5)->map(function($output) {
                    return [
                        'date' => $output->date->format('Y-m-d'),
                        'quantity' => $output->quantity_produced,
                        'produced_by' => $output->produced_by ?? 'N/A'
                    ];
                })->values()
            ];
        }
        
        // Get Made-to-Order products
        $madeToOrderProducts = Product::where(function($query) {
            $query->where('category_name', 'Made-to-Order')
                  ->orWhere('category_name', 'Made to Order');
        })->get();
        
        foreach ($madeToOrderProducts as $product) {
            // Get orders for this product
            $orders = \App\Models\Order::whereBetween('created_at', [$start, $end])
                ->whereHas('items', function($query) use ($product) {
                    $query->where('product_id', $product->id);
                })
                ->with(['items' => function($query) use ($product) {
                    $query->where('product_id', $product->id);
                }])
                ->get();
            
            // Get production records for this product
            $productions = Production::whereBetween('date', [$start, $end])
                ->where('product_id', $product->id)
                ->get();
            
            $totalOrdered = $orders->sum(function($order) use ($product) {
                return $order->items->where('product_id', $product->id)->sum('quantity');
            });
            
            $totalProduced = $productions->sum('quantity');
            $completedProductions = $productions->where('status', 'completed')->count();
            $inProgressProductions = $productions->whereIn('status', ['in_progress', 'processing'])->count();
            $pendingProductions = $productions->where('status', 'pending')->count();
            
            $completionRate = $productions->count() > 0 
                ? round(($completedProductions / $productions->count()) * 100, 2) 
                : 0;
            
            // Calculate average production time (if we have completion data)
            $avgProductionTime = 0;
            if ($completedProductions > 0) {
                // Estimate based on order dates and completion dates
                $avgDays = $productions->where('status', 'completed')
                    ->filter(function($p) {
                        return $p->date && $p->created_at;
                    })
                    ->map(function($p) {
                        return Carbon::parse($p->date)->diffInDays(Carbon::parse($p->created_at));
                    })
                    ->avg();
                $avgProductionTime = $avgDays ? round($avgDays, 1) : 0;
            }
            
            // Calculate efficiency (based on completion rate and production time)
            $efficiency = $completionRate; // Use completion rate as efficiency metric
            
            $firstOrderDate = $orders->min('created_at');
            $lastOrderDate = $orders->max('created_at');
            $firstProductionDate = $productions->min('date');
            $lastProductionDate = $productions->max('date');
            
            $products[] = [
                'product_id' => $product->id,
                'product_name' => $product->product_name ?? $product->name,
                'category' => 'Made-to-Order',
                'total_quantity_ordered' => $totalOrdered,
                'total_quantity_produced' => $totalProduced,
                'orders_count' => $orders->count(),
                'completed_productions' => $completedProductions,
                'in_progress_productions' => $inProgressProductions,
                'pending_productions' => $pendingProductions,
                'completion_rate' => $completionRate,
                'efficiency_percentage' => $efficiency,
                'average_production_time_days' => $avgProductionTime,
                'first_order_date' => $firstOrderDate ? Carbon::parse($firstOrderDate)->format('Y-m-d') : null,
                'last_order_date' => $lastOrderDate ? Carbon::parse($lastOrderDate)->format('Y-m-d') : null,
                'first_production_date' => $firstProductionDate ? Carbon::parse($firstProductionDate)->format('Y-m-d') : null,
                'last_production_date' => $lastProductionDate ? Carbon::parse($lastProductionDate)->format('Y-m-d') : null,
                'recent_orders' => $orders->take(5)->map(function($order) use ($product) {
                    $item = $order->items->where('product_id', $product->id)->first();
                    return [
                        'order_id' => $order->id,
                        'date' => $order->created_at->format('Y-m-d'),
                        'quantity' => $item ? $item->quantity : 0,
                        'status' => $order->acceptance_status
                    ];
                })->values()
            ];
        }
        
        // Sort products by total quantity produced (descending)
        usort($products, function($a, $b) {
            $aQty = $a['total_quantity_produced'] ?? 0;
            $bQty = $b['total_quantity_produced'] ?? 0;
            return $bQty <=> $aQty;
        });
        
        return response()->json([
            'products' => $products,
            'summary' => [
                'total_products' => count($products),
                'alkansya_products' => count(array_filter($products, fn($p) => $p['category'] === 'Alkansya')),
                'made_to_order_products' => count(array_filter($products, fn($p) => $p['category'] === 'Made-to-Order')),
                'total_quantity_produced' => array_sum(array_column($products, 'total_quantity_produced')),
                'average_efficiency' => count($products) > 0 
                    ? round(array_sum(array_column($products, 'efficiency_percentage')) / count($products), 2)
                    : 0
            ],
            'date_range' => [
                'start_date' => $start,
                'end_date' => $end
            ]
        ]);
    }
    
    private function calculateProductionTrend($alkansyaOutput)
    {
        if ($alkansyaOutput->count() < 2) {
            return 'stable';
        }
        
        $recent = $alkansyaOutput->take(7)->avg('quantity_produced');
        $previous = $alkansyaOutput->skip(7)->take(7)->avg('quantity_produced');
        
        if ($recent > $previous * 1.1) {
            return 'increasing';
        } elseif ($recent < $previous * 0.9) {
            return 'decreasing';
        } else {
            return 'stable';
        }
    }
}
