<?php

namespace App\Http\Controllers;

use App\Models\InventoryTransaction;
use App\Models\Material;
use App\Models\Product;
use App\Models\Order;
use App\Models\Production;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class InventoryTransactionController extends Controller
{
    /**
     * Get inventory transactions with comprehensive filtering
     */
    public function index(Request $request)
    {
        $query = InventoryTransaction::with([
            'material',
            'product',
            'order',
            'production',
            'user',
            'location'
        ]);

        // Apply filters
        if ($request->filled('transaction_type')) {
            $query->where('transaction_type', $request->transaction_type);
        }

        if ($request->filled('material_id')) {
            $query->where('material_id', $request->material_id);
        }

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        if ($request->filled('order_id')) {
            $query->where('order_id', $request->order_id);
        }

        if ($request->filled('production_id')) {
            $query->where('production_id', $request->production_id);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('timestamp', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('timestamp', '<=', $request->date_to);
        }

        if ($request->filled('cost_min')) {
            $query->where('total_cost', '>=', $request->cost_min);
        }

        if ($request->filled('cost_max')) {
            $query->where('total_cost', '<=', $request->cost_max);
        }

        if ($request->filled('batch_number')) {
            $query->where('batch_number', $request->batch_number);
        }

        if ($request->filled('reference')) {
            $query->where('reference', 'like', '%' . $request->reference . '%');
        }

        if ($request->filled('remarks')) {
            $query->where('remarks', 'like', '%' . $request->remarks . '%');
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'timestamp');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Pagination
        $perPage = $request->get('per_page', 50);
        $transactions = $query->paginate($perPage);

        return response()->json($transactions);
    }

    /**
     * Get transaction statistics
     */
    public function getStatistics(Request $request)
    {
        $query = InventoryTransaction::query();

        // Apply date filters if provided
        if ($request->filled('date_from')) {
            $query->whereDate('timestamp', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('timestamp', '<=', $request->date_to);
        }

        $stats = [
            'total_transactions' => $query->count(),
            'total_cost' => $query->sum('total_cost'),
            'average_cost' => $query->avg('total_cost'),
            'by_type' => $query->select('transaction_type', DB::raw('count(*) as count'), DB::raw('sum(total_cost) as total_cost'))
                ->groupBy('transaction_type')
                ->get(),
            'by_status' => $query->select('status', DB::raw('count(*) as count'))
                ->groupBy('status')
                ->get(),
            'by_priority' => $query->select('priority', DB::raw('count(*) as count'))
                ->groupBy('priority')
                ->get(),
            'daily_totals' => $query->select(DB::raw('DATE(timestamp) as date'), DB::raw('count(*) as count'), DB::raw('sum(total_cost) as total_cost'))
                ->groupBy(DB::raw('DATE(timestamp)'))
                ->orderBy('date', 'desc')
                ->limit(30)
                ->get(),
        ];

        return response()->json($stats);
    }

    /**
     * Get transaction summary by material
     */
    public function getMaterialSummary(Request $request)
    {
        $query = InventoryTransaction::with('material')
            ->whereNotNull('material_id');

        if ($request->filled('date_from')) {
            $query->whereDate('timestamp', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('timestamp', '<=', $request->date_to);
        }

        $summary = $query->select(
                'material_id',
                DB::raw('sum(quantity) as total_quantity'),
                DB::raw('sum(total_cost) as total_cost'),
                DB::raw('count(*) as transaction_count'),
                DB::raw('avg(unit_cost) as avg_unit_cost')
            )
            ->groupBy('material_id')
            ->with('material')
            ->get();

        return response()->json($summary);
    }

    /**
     * Get transaction summary by product
     */
    public function getProductSummary(Request $request)
    {
        $query = InventoryTransaction::with('product')
            ->whereNotNull('product_id');

        if ($request->filled('date_from')) {
            $query->whereDate('timestamp', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('timestamp', '<=', $request->date_to);
        }

        $summary = $query->select(
                'product_id',
                DB::raw('sum(quantity) as total_quantity'),
                DB::raw('sum(total_cost) as total_cost'),
                DB::raw('count(*) as transaction_count'),
                DB::raw('avg(unit_cost) as avg_unit_cost')
            )
            ->groupBy('product_id')
            ->with('product')
            ->get();

        return response()->json($summary);
    }

    /**
     * Get order-related transactions
     */
    public function getOrderTransactions($orderId)
    {
        $transactions = InventoryTransaction::with([
            'material',
            'product',
            'user',
            'location'
        ])
        ->where('order_id', $orderId)
        ->orderBy('timestamp', 'desc')
        ->get();

        return response()->json($transactions);
    }

    /**
     * Get production-related transactions
     */
    public function getProductionTransactions($productionId)
    {
        $transactions = InventoryTransaction::with([
            'material',
            'product',
            'user',
            'location'
        ])
        ->where('production_id', $productionId)
        ->orderBy('timestamp', 'desc')
        ->get();

        return response()->json($transactions);
    }

    /**
     * Get alkansya consumption summary
     */
    public function getAlkansyaConsumption(Request $request)
    {
        $query = InventoryTransaction::with(['material', 'product'])
            ->where('transaction_type', 'ALKANSYA_CONSUMPTION');

        if ($request->filled('date_from')) {
            $query->whereDate('timestamp', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('timestamp', '<=', $request->date_to);
        }

        $consumption = $query->select(
                'material_id',
                'product_id',
                DB::raw('sum(ABS(quantity)) as total_consumed'),
                DB::raw('sum(total_cost) as total_cost'),
                DB::raw('count(*) as consumption_count'),
                DB::raw('DATE(timestamp) as consumption_date')
            )
            ->groupBy('material_id', 'product_id', DB::raw('DATE(timestamp)'))
            ->orderBy('consumption_date', 'desc')
            ->get();

        return response()->json($consumption);
    }

    /**
     * Get cost analysis
     */
    public function getCostAnalysis(Request $request)
    {
        $query = InventoryTransaction::query();

        if ($request->filled('date_from')) {
            $query->whereDate('timestamp', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('timestamp', '<=', $request->date_to);
        }

        $analysis = [
            'total_cost' => $query->sum('total_cost'),
            'average_transaction_cost' => $query->avg('total_cost'),
            'cost_by_type' => $query->select('transaction_type', DB::raw('sum(total_cost) as total_cost'))
                ->groupBy('transaction_type')
                ->get(),
            'cost_trend' => $query->select(
                    DB::raw('DATE(timestamp) as date'),
                    DB::raw('sum(total_cost) as daily_cost'),
                    DB::raw('count(*) as transaction_count')
                )
                ->groupBy(DB::raw('DATE(timestamp)'))
                ->orderBy('date', 'desc')
                ->limit(30)
                ->get(),
            'high_cost_transactions' => $query->where('total_cost', '>', 1000)
                ->orderBy('total_cost', 'desc')
                ->limit(20)
                ->get(),
        ];

        return response()->json($analysis);
    }

    /**
     * Export transactions to CSV
     */
    public function export(Request $request)
    {
        $query = InventoryTransaction::with([
            'material',
            'product',
            'order',
            'production',
            'user'
        ]);

        // Apply same filters as index method
        $this->applyFilters($query, $request);

        $transactions = $query->orderBy('timestamp', 'desc')->get();

        $csvData = [];
        $csvData[] = [
            'Transaction ID',
            'Date',
            'Type',
            'Material',
            'Product',
            'Order',
            'Production',
            'User',
            'Quantity',
            'Unit Cost',
            'Total Cost',
            'Status',
            'Priority',
            'Reference',
            'Remarks'
        ];

        foreach ($transactions as $transaction) {
            $csvData[] = [
                $transaction->transaction_id,
                $transaction->timestamp->format('Y-m-d H:i:s'),
                $transaction->transaction_type,
                $transaction->material ? $transaction->material->material_name : 'N/A',
                $transaction->product ? $transaction->product->name : 'N/A',
                $transaction->order ? '#' . $transaction->order->id : 'N/A',
                $transaction->production ? '#' . $transaction->production->id : 'N/A',
                $transaction->user ? $transaction->user->name : 'N/A',
                $transaction->quantity,
                $transaction->unit_cost,
                $transaction->total_cost,
                $transaction->status,
                $transaction->priority,
                $transaction->reference,
                $transaction->remarks
            ];
        }

        $filename = 'inventory_transactions_' . now()->format('Y-m-d_H-i-s') . '.csv';
        
        return response()->streamDownload(function () use ($csvData) {
            $file = fopen('php://output', 'w');
            foreach ($csvData as $row) {
                fputcsv($file, $row);
            }
            fclose($file);
        }, $filename, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"'
        ]);
    }

    /**
     * Apply filters to query
     */
    private function applyFilters($query, Request $request)
    {
        if ($request->filled('transaction_type')) {
            $query->where('transaction_type', $request->transaction_type);
        }

        if ($request->filled('material_id')) {
            $query->where('material_id', $request->material_id);
        }

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        if ($request->filled('order_id')) {
            $query->where('order_id', $request->order_id);
        }

        if ($request->filled('production_id')) {
            $query->where('production_id', $request->production_id);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('timestamp', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('timestamp', '<=', $request->date_to);
        }

        if ($request->filled('cost_min')) {
            $query->where('total_cost', '>=', $request->cost_min);
        }

        if ($request->filled('cost_max')) {
            $query->where('total_cost', '<=', $request->cost_max);
        }

        if ($request->filled('batch_number')) {
            $query->where('batch_number', $request->batch_number);
        }

        if ($request->filled('reference')) {
            $query->where('reference', 'like', '%' . $request->reference . '%');
        }

        if ($request->filled('remarks')) {
            $query->where('remarks', 'like', '%' . $request->remarks . '%');
        }
    }
}
