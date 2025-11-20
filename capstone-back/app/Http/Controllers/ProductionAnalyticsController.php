<?php

namespace App\Http\Controllers;

use App\Models\Production;
use App\Models\ProductionAnalytics;
use App\Models\OrderTracking;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ProductionAnalyticsController extends Controller
{
    public function analytics(Request $request)
    {
        $dateRange = $request->get('date_range', '30');
        $startDate = Carbon::now()->subDays($dateRange);
        $endDate = Carbon::now();

        return response()->json([
            'metrics' => $this->getProductionMetrics($startDate, $endDate),
            'workload' => $this->getStageWorkload(),
            'resource_allocation' => $this->getResourceAllocationSuggestions(),
            'daily_outputs' => $this->getDailyProductionOutputs($startDate, $endDate),
            'capacity_utilization' => $this->getCapacityUtilization(),
            'predictions' => $this->getPredictiveAnalytics(),
            'generated_at' => now()->toISOString()
        ]);
    }

    private function getProductionMetrics($startDate, $endDate)
    {
        $activeProductions = Production::whereIn('status', ['In Progress', 'Pending'])
            ->whereBetween('created_at', [$startDate, $endDate])
            ->count();

        $completedProductions = Production::where('status', 'Completed')
            ->whereBetween('actual_completion_date', [$startDate, $endDate])
            ->count();

        return [
            'active_productions' => $activeProductions,
            'completed_productions' => $completedProductions,
            'efficiency_score' => $completedProductions > 0 ? round(($completedProductions / ($activeProductions + $completedProductions)) * 100, 1) : 0
        ];
    }

    private function getStageWorkload()
    {
        $stages = ['Planning', 'Material Selection', 'Cutting and Shaping', 'Assembly', 'Finishing', 'Quality Assurance'];
        $capacities = [3, 2, 4, 5, 3, 2];

        $workload = [];
        foreach ($stages as $index => $stage) {
            $currentWorkload = OrderTracking::where('current_stage', $stage)
                ->whereIn('status', ['pending', 'in_production'])
                ->count();

            $utilization = ($currentWorkload / $capacities[$index]) * 100;

            $workload[] = [
                'stage' => $stage,
                'capacity' => $capacities[$index],
                'current_workload' => $currentWorkload,
                'utilization_percentage' => round($utilization, 1),
                'status' => $utilization > 90 ? 'overloaded' : ($utilization > 70 ? 'busy' : 'available'),
                'bottleneck_risk' => $utilization > 85
            ];
        }

        return $workload;
    }

    private function getResourceAllocationSuggestions()
    {
        $overloadedStages = OrderTracking::select('current_stage', DB::raw('count(*) as workload'))
            ->whereIn('status', ['pending', 'in_production'])
            ->groupBy('current_stage')
            ->having('workload', '>', 3)
            ->get();

        $suggestions = [];
        foreach ($overloadedStages as $stage) {
            $suggestions[] = [
                'type' => 'redistribute_workload',
                'priority' => 'high',
                'message' => "Stage '{$stage->current_stage}' is overloaded with {$stage->workload} items",
                'action' => 'Consider redistributing workload to available stages'
            ];
        }

        return $suggestions;
    }

    private function getDailyProductionOutputs($startDate, $endDate)
    {
        // Use ProductionAnalytics table which includes Alkansya daily output
        return ProductionAnalytics::whereBetween('date', [$startDate, $endDate])
            ->select(
                'date',
                DB::raw('SUM(actual_output) as total_quantity'),
                DB::raw('COUNT(DISTINCT product_id) as product_count')
            )
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(function($item) {
                return [
                    'date' => $item->date,
                    'quantity' => $item->total_quantity,
                    'completed_items' => $item->product_count
                ];
            });
    }

    private function getCapacityUtilization()
    {
        $totalCapacity = 19;
        $currentUtilization = OrderTracking::whereIn('status', ['pending', 'in_production'])->count();
        
        return [
            'total_capacity' => $totalCapacity,
            'current_utilization' => $currentUtilization,
            'utilization_percentage' => round(($currentUtilization / $totalCapacity) * 100, 1),
            'available_capacity' => $totalCapacity - $currentUtilization
        ];
    }

    private function getPredictiveAnalytics()
    {
        $activeOrders = OrderTracking::where('status', 'in_production')
            ->with(['order', 'product'])
            ->get();

        $predictions = [];
        foreach ($activeOrders as $tracking) {
            $predictions[] = [
                'order_id' => $tracking->order_id,
                'product_name' => $tracking->product->name ?? 'Unknown',
                'current_stage' => $tracking->current_stage,
                'progress_percentage' => $tracking->progress_percentage ?? 0,
                'estimated_completion_date' => $tracking->estimated_completion_date
            ];
        }

        return [
            'completion_predictions' => $predictions,
            'capacity_forecast' => [
                'upcoming_orders' => Order::where('status', 'pending')->count(),
                'capacity_adequacy' => 'sufficient'
            ]
        ];
    }
}