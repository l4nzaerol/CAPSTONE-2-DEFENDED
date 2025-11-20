<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\AlkansyaDailyOutput;
use App\Models\Product;
use App\Models\BOM;
use App\Models\Material;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AlkansyaDailyOutputController extends Controller
{
    /**
     * Display a listing of daily outputs
     */
    public function index(Request $request)
    {
        $query = AlkansyaDailyOutput::query();

        // Filter by date range if provided
        if ($request->has('start_date')) {
            $query->where('date', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->where('date', '<=', $request->end_date);
        }

        // Get last 3 months by default
        if (!$request->has('start_date') && !$request->has('end_date')) {
            $query->where('date', '>=', Carbon::now()->subMonths(3));
        }

        $outputs = $query->orderBy('date', 'desc')->get();

        // Check for missing transactions and add metadata
        $outputsWithTransactionStatus = $outputs->map(function($output) {
            $hasTransactions = InventoryTransaction::where('transaction_type', 'ALKANSYA_CONSUMPTION')
                ->where('reference', 'Alkansya Daily Output - ' . $output->date)
                ->exists();
            
            $outputArray = $output->toArray();
            $outputArray['has_transactions'] = $hasTransactions;
            
            return $outputArray;
        });

        return response()->json($outputsWithTransactionStatus);
    }

    /**
     * Store a newly created daily output with automatic material deduction
     */
    public function store(Request $request)
    {
        $request->validate([
            'date' => 'required|date',
            'quantity' => 'required|integer|min:0',
            'produced_by' => 'nullable|string'
        ]);

        try {
            DB::beginTransaction();

            // Get all Alkansya products
            $alkansyaProducts = Product::where('category_name', 'Stocked Products')
                ->where('name', 'Alkansya')
                ->get();

            if ($alkansyaProducts->isEmpty()) {
                Log::error('No Alkansya products found in database');
                return response()->json(['error' => 'No Alkansya products found. Please ensure the products exist in the database.'], 404);
            }

            Log::info('Found ' . $alkansyaProducts->count() . ' Alkansya products');

            // Use the first Alkansya product for BOM calculation (they all have the same BOM)
            $alkansyaProduct = $alkansyaProducts->first();
            $bomMaterials = BOM::where('product_id', $alkansyaProduct->id)
                ->with('material')
                ->get();

            Log::info('Found ' . $bomMaterials->count() . ' BOM materials for Alkansya');

            if ($bomMaterials->isEmpty()) {
                Log::error('No BOM materials found for Alkansya product ID: ' . $alkansyaProduct->id);
                return response()->json([
                    'error' => 'Alkansya BOM not found. Please run the database seeders to create the Bill of Materials.',
                    'details' => 'Product ID: ' . $alkansyaProduct->id . ', Product Name: ' . $alkansyaProduct->name
                ], 404);
            }

            $quantity = $request->quantity;
            $materialsUsed = [];
            $totalCost = 0;
            $dateObj = Carbon::parse($request->date);

            // Check if transactions already exist for this date (when updating)
            $existingRecord = AlkansyaDailyOutput::where('date', $request->date)->first();
            $hasExistingTransactions = false;
            if ($existingRecord) {
                $existingTransactions = InventoryTransaction::where('transaction_type', 'ALKANSYA_CONSUMPTION')
                    ->where('reference', 'Alkansya Daily Output - ' . $request->date)
                    ->count();
                $hasExistingTransactions = $existingTransactions > 0;
                
                if ($hasExistingTransactions) {
                    Log::info("Existing transactions found for date {$request->date}, will not create duplicates");
                }
            }

            // Calculate materials needed and deduct from inventory
            foreach ($bomMaterials as $bomMaterial) {
                $material = $bomMaterial->material;
                
                if (!$material) {
                    Log::error('Material not found for BOM material ID: ' . $bomMaterial->id);
                    DB::rollBack();
                    return response()->json([
                        'error' => 'Material not found for BOM material. Please check the database setup.'
                    ], 500);
                }
                
                $requiredQuantity = $bomMaterial->quantity_per_product * $quantity;
                
                Log::info("Processing material: {$material->material_name} (Code: {$material->material_code}), Required: {$requiredQuantity}, Available: {$material->current_stock}");
                
                if ($requiredQuantity > 0) {
                    // Check if enough stock
                    if ($material->current_stock < $requiredQuantity) {
                        DB::rollBack();
                        Log::error("Insufficient stock for {$material->material_name}. Required: {$requiredQuantity}, Available: {$material->current_stock}");
                        return response()->json([
                            'error' => "Insufficient stock for {$material->material_name}",
                            'details' => [
                                'material' => $material->material_name,
                                'code' => $material->material_code,
                                'required' => $requiredQuantity,
                                'available' => $material->current_stock,
                                'shortage' => $requiredQuantity - $material->current_stock
                            ]
                        ], 400);
                    }

                    // Deduct from material stock
                    $material->current_stock -= $requiredQuantity;
                    $material->save();

                    // Update inventory record
                    $inventory = Inventory::where('material_id', $material->material_id)->first();
                    if ($inventory) {
                        $inventory->current_stock -= $requiredQuantity;
                        $inventory->last_updated = now();
                        $inventory->save();
                    }

                    // Record material usage
                    $materialsUsed[] = [
                        'material_id' => $material->material_id,
                        'material_name' => $material->material_name,
                        'material_code' => $material->material_code,
                        'quantity_used' => $requiredQuantity,
                        'unit_cost' => $material->standard_cost,
                        'total_cost' => $material->standard_cost * $requiredQuantity,
                    ];

                    $totalCost += $material->standard_cost * $requiredQuantity;

                    // Create inventory transaction only if it doesn't already exist (for new records or when updating without existing transactions)
                    if (!$hasExistingTransactions) {
                        InventoryTransaction::create([
                            'material_id' => $material->material_id,
                            'product_id' => $alkansyaProduct->id,
                            'transaction_type' => 'ALKANSYA_CONSUMPTION',
                            'quantity' => -$requiredQuantity,
                            'reference' => 'Alkansya Daily Output - ' . $request->date,
                            'remarks' => "Material consumption for Alkansya production - {$quantity} units produced on {$request->date}",
                            'timestamp' => $dateObj,
                            'unit_cost' => $material->standard_cost,
                            'total_cost' => $material->standard_cost * $requiredQuantity,
                            'status' => 'completed',
                            'metadata' => [
                                'product_id' => $alkansyaProduct->id,
                                'product_name' => $alkansyaProduct->product_name ?? $alkansyaProduct->name,
                                'quantity_produced' => $quantity,
                                'date' => $request->date,
                            ],
                        ]);
                        Log::info("Created transaction for {$material->material_name} - {$quantity} units produced on {$request->date}");
                    }

                    Log::info("Auto-deducted {$requiredQuantity} {$material->unit_of_measure} of {$material->material_name} for Alkansya daily output");
                }
            }

            // Log the action
            if ($existingRecord) {
                Log::info("Updating existing record for date: {$request->date}. Previous quantity: {$existingRecord->quantity_produced}");
            } else {
                Log::info("Creating new record for date: {$request->date}");
            }

            // Create or update daily output record
            $dailyOutput = AlkansyaDailyOutput::updateOrCreate(
                ['date' => $request->date],
                [
                    'quantity_produced' => $quantity,
                    'produced_by' => $request->produced_by,
                    'materials_used' => $materialsUsed,
                ]
            );

            // Update stock for ALL Alkansya products
            foreach ($alkansyaProducts as $alkansyaProduct) {
                $alkansyaProduct->increment('stock', $quantity);
                Log::info("Updated stock for {$alkansyaProduct->product_name}: +{$quantity} units");
            }

            // Update finished goods inventory
            $alkansyaInventoryItem = InventoryItem::where('name', 'LIKE', '%Alkansya%')
                ->where('category', 'finished')
                ->first();
            
            if ($alkansyaInventoryItem) {
                $alkansyaInventoryItem->quantity_on_hand += $quantity;
                $alkansyaInventoryItem->save();
                
                // Create inventory transaction for finished goods
                InventoryTransaction::create([
                    'inventory_item_id' => $alkansyaInventoryItem->id,
                    'transaction_type' => 'PRODUCTION_OUTPUT',
                    'quantity' => $quantity,
                    'reference' => 'Alkansya Daily Output - ' . $request->date,
                    'remarks' => "Produced {$quantity} units of Alkansya",
                    'timestamp' => now(),
                    'unit_cost' => 0, // Will be calculated based on material costs
                    'total_cost' => $totalCost
                ]);
                
                Log::info("Updated inventory for Alkansya finished goods: +{$quantity} units");
            }

            DB::commit();

            return response()->json([
                'message' => 'Daily output added and materials automatically deducted successfully',
                'data' => $dailyOutput,
                'materials_used' => $materialsUsed,
                'total_cost' => $totalCost
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Alkansya daily output auto deduction failed: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            
            // Check if it's a validation error
            if ($e instanceof \Illuminate\Validation\ValidationException) {
                return response()->json([
                    'error' => 'Validation failed',
                    'details' => $e->errors()
                ], 400);
            }
            
            // Check if it's a database constraint error
            if (strpos($e->getMessage(), 'constraint') !== false || strpos($e->getMessage(), 'duplicate') !== false) {
                return response()->json([
                    'error' => 'Database constraint error',
                    'details' => $e->getMessage()
                ], 400);
            }
            
            return response()->json([
                'error' => 'Failed to add daily output: ' . $e->getMessage(),
                'type' => get_class($e)
            ], 500);
        }
    }

    /**
     * Get statistics for Alkansya production
     */
    public function statistics()
    {
        // Get 3 months of data for accurate statistics
        $threeMonthsAgo = Carbon::now()->subMonths(3);
        
        $totalOutput = AlkansyaDailyOutput::where('date', '>=', $threeMonthsAgo)->sum('quantity_produced');
        $totalDays = AlkansyaDailyOutput::where('date', '>=', $threeMonthsAgo)->count();
        $averageDaily = $totalDays > 0 ? $totalOutput / $totalDays : 0;
        
        $last7Days = AlkansyaDailyOutput::where('date', '>=', Carbon::now()->subDays(7))
            ->sum('quantity_produced');
        
        $last30Days = AlkansyaDailyOutput::where('date', '>=', Carbon::now()->subDays(30))
            ->sum('quantity_produced');

        // Get monthly output for the last 6 months
        $monthlyOutput = AlkansyaDailyOutput::select(
                DB::raw('YEAR(date) as year'),
                DB::raw('MONTH(date) as month'),
                DB::raw('SUM(quantity_produced) as total')
            )
            ->where('date', '>=', Carbon::now()->subMonths(6))
            ->groupBy('year', 'month')
            ->orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->get()
            ->map(function($item) {
                $date = Carbon::create($item->year, $item->month, 1);
                return [
                    'month' => $date->format('M Y'),
                    'total' => $item->total
                ];
            });

        // Get production efficiency metrics
        $productionDays = AlkansyaDailyOutput::where('date', '>=', $threeMonthsAgo)
            ->where('quantity_produced', '>', 0)
            ->count();
        
        $totalWorkingDays = $threeMonthsAgo->diffInDays(Carbon::now());
        $efficiency = $totalWorkingDays > 0 ? round(($productionDays / $totalWorkingDays) * 100, 2) : 0;

        return response()->json([
            'total_output' => $totalOutput,
            'total_days' => $totalDays,
            'average_daily' => round($averageDaily, 2),
            'last_7_days' => $last7Days,
            'last_30_days' => $last30Days,
            'monthly_output' => $monthlyOutput,
            'production_efficiency' => $efficiency,
            'period' => [
                'start_date' => $threeMonthsAgo->format('Y-m-d'),
                'end_date' => Carbon::now()->format('Y-m-d'),
                'days' => $totalWorkingDays
            ]
        ]);
    }

    /**
     * Clear daily output for a specific date (for testing/debugging)
     */
    public function clearDate(Request $request)
    {
        $request->validate([
            'date' => 'required|date'
        ]);

        try {
            $deleted = AlkansyaDailyOutput::where('date', $request->date)->delete();
            
            return response()->json([
                'message' => "Cleared {$deleted} record(s) for date {$request->date}",
                'deleted_count' => $deleted
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to clear daily output for date: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to clear daily output: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Backfill missing transactions for existing daily outputs
     * This method creates transactions for daily outputs that don't have corresponding transactions
     */
    public function backfillTransactions(Request $request)
    {
        try {
            DB::beginTransaction();

            // Get all daily outputs
            $dailyOutputs = AlkansyaDailyOutput::orderBy('date', 'desc')->get();
            
            $createdCount = 0;
            $skippedCount = 0;
            $errors = [];

            foreach ($dailyOutputs as $dailyOutput) {
                // Check if transactions already exist for this date
                $existingTransactions = InventoryTransaction::where('transaction_type', 'ALKANSYA_CONSUMPTION')
                    ->where('reference', 'Alkansya Daily Output - ' . $dailyOutput->date)
                    ->count();

                if ($existingTransactions > 0) {
                    $skippedCount++;
                    continue; // Skip if transactions already exist
                }

                // Get Alkansya products and BOM
                $alkansyaProducts = Product::where('category_name', 'Stocked Products')
                    ->where(function($query) {
                        $query->where('name', 'LIKE', '%Alkansya%')
                              ->orWhere('product_name', 'LIKE', '%Alkansya%');
                    })
                    ->get();

                if ($alkansyaProducts->isEmpty()) {
                    $errors[] = "No Alkansya products found for date {$dailyOutput->date}";
                    continue;
                }

                $alkansyaProduct = $alkansyaProducts->first();
                $bomMaterials = BOM::where('product_id', $alkansyaProduct->id)
                    ->with('material')
                    ->get();

                if ($bomMaterials->isEmpty()) {
                    $errors[] = "No BOM materials found for date {$dailyOutput->date}";
                    continue;
                }

                $quantity = $dailyOutput->quantity_produced;
                $dateObj = Carbon::parse($dailyOutput->date);

                // Create transactions for each material
                foreach ($bomMaterials as $bomMaterial) {
                    $material = $bomMaterial->material;
                    
                    if (!$material) {
                        continue;
                    }
                    
                    $requiredQuantity = $bomMaterial->quantity_per_product * $quantity;
                    
                    if ($requiredQuantity > 0) {
                        try {
                            InventoryTransaction::create([
                                'material_id' => $material->material_id,
                                'product_id' => $alkansyaProduct->id,
                                'transaction_type' => 'ALKANSYA_CONSUMPTION',
                                'quantity' => -$requiredQuantity,
                                'reference' => 'Alkansya Daily Output - ' . $dailyOutput->date,
                                'remarks' => "Material consumption for Alkansya production - {$quantity} units produced on {$dailyOutput->date}",
                                'timestamp' => $dateObj,
                                'unit_cost' => $material->standard_cost ?? 0,
                                'total_cost' => ($material->standard_cost ?? 0) * $requiredQuantity,
                                'status' => 'completed',
                                'metadata' => [
                                    'product_id' => $alkansyaProduct->id,
                                    'product_name' => $alkansyaProduct->product_name ?? $alkansyaProduct->name,
                                    'quantity_produced' => $quantity,
                                    'date' => $dailyOutput->date,
                                    'backfilled' => true, // Mark as backfilled
                                ],
                            ]);
                        } catch (\Exception $e) {
                            $errors[] = "Failed to create transaction for {$material->material_name} on {$dailyOutput->date}: " . $e->getMessage();
                        }
                    }
                }

                $createdCount++;
                Log::info("Backfilled transactions for daily output date: {$dailyOutput->date}");
            }

            DB::commit();

            return response()->json([
                'message' => 'Transaction backfill completed',
                'created' => $createdCount,
                'skipped' => $skippedCount,
                'errors' => $errors,
                'total_processed' => $dailyOutputs->count()
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Transaction backfill failed: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to backfill transactions: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get materials consumption analysis
     */
public function materialsAnalysis()
    {
        $alkansyaProduct = Product::where('name', 'Alkansya')->first();
        if (!$alkansyaProduct) {
            return response()->json(['error' => 'Alkansya product not found'], 404);
        }

        $bomMaterials = ProductMaterial::where('product_id', $alkansyaProduct->id)
            ->with('inventoryItem')
            ->get();

        $materialsAnalysis = [];
        foreach ($bomMaterials as $bomMaterial) {
            $inventoryItem = $bomMaterial->inventoryItem;
            $totalUsed = InventoryUsage::where('inventory_item_id', $inventoryItem->id)
                ->where('date', '>=', Carbon::now()->subMonths(3))
                ->sum('qty_used');

            $materialsAnalysis[] = [
                'material_name' => $inventoryItem->name,
                'sku' => $inventoryItem->sku,
                'qty_per_unit' => $bomMaterial->qty_per_unit,
                'current_stock' => $inventoryItem->quantity_on_hand,
                'total_used_3months' => $totalUsed,
                'unit_cost' => $inventoryItem->unit_cost,
                'reorder_point' => $inventoryItem->reorder_point,
                'safety_stock' => $inventoryItem->safety_stock,
                'status' => $inventoryItem->quantity_on_hand <= $inventoryItem->reorder_point ? 'reorder' : 'ok'
            ];
        }

        return response()->json($materialsAnalysis);
    }

}