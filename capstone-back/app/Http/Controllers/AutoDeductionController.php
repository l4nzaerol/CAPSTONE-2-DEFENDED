<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\ProductMaterial;
use App\Models\InventoryItem;
use App\Models\InventoryUsage;
use App\Models\Production;
use App\Models\Order;
use App\Models\AlkansyaDailyOutput;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AutoDeductionController extends Controller
{
    /**
     * Automatically deduct materials based on production start
     * This is called when production starts for any product
     */
    public function deductForProduction(Request $request)
    {
        $request->validate([
            'production_id' => 'required|exists:productions,id',
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1'
        ]);

        try {
            DB::beginTransaction();

            $production = Production::findOrFail($request->production_id);
            $product = Product::findOrFail($request->product_id);
            $quantity = $request->quantity;

            // Get BOM for the product
            $bomMaterials = ProductMaterial::where('product_id', $product->id)
                ->with('inventoryItem')
                ->get();

            if ($bomMaterials->isEmpty()) {
                return response()->json(['error' => 'No BOM found for this product'], 404);
            }

            $materialsUsed = [];
            $totalCost = 0;

            // Calculate and deduct materials
            foreach ($bomMaterials as $bomMaterial) {
                $inventoryItem = $bomMaterial->inventoryItem;
                $requiredQuantity = $bomMaterial->qty_per_unit * $quantity;
                
                if ($requiredQuantity > 0) {
                    // Check if enough stock
                    if ($inventoryItem->quantity_on_hand < $requiredQuantity) {
                        DB::rollBack();
                        return response()->json([
                            'error' => "Insufficient stock for {$inventoryItem->name}. Required: {$requiredQuantity}, Available: {$inventoryItem->quantity_on_hand}"
                        ], 400);
                    }

                    // Deduct from inventory
                    $inventoryItem->quantity_on_hand -= $requiredQuantity;
                    $inventoryItem->save();

                    // Record material usage
                    $materialsUsed[] = [
                        'inventory_item_id' => $inventoryItem->id,
                        'item_name' => $inventoryItem->name,
                        'sku' => $inventoryItem->sku,
                        'quantity_used' => $requiredQuantity,
                        'unit_cost' => $inventoryItem->unit_cost,
                        'total_cost' => $inventoryItem->unit_cost * $requiredQuantity,
                    ];

                    $totalCost += $inventoryItem->unit_cost * $requiredQuantity;

                    // Log usage in inventory_usages table
                    InventoryUsage::create([
                        'inventory_item_id' => $inventoryItem->id,
                        'qty_used' => $requiredQuantity,
                        'date' => now()->format('Y-m-d'),
                    ]);

                    Log::info("Auto-deducted {$requiredQuantity} {$inventoryItem->unit} of {$inventoryItem->name} for {$product->name} production");
                }
            }

            // Update production record with materials used
            $production->materials_used = $materialsUsed;
            $production->material_cost = $totalCost;
            $production->save();

            DB::commit();

            return response()->json([
                'message' => 'Materials automatically deducted successfully',
                'materials_used' => $materialsUsed,
                'total_cost' => $totalCost
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Auto deduction failed: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to deduct materials: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Automatically deduct materials for Alkansya daily output
     * This is called when daily output is added
     */
    public function deductForAlkansyaDailyOutput(Request $request)
    {
        $request->validate([
            'date' => 'required|date',
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string',
            'produced_by' => 'nullable|string'
        ]);

        try {
            DB::beginTransaction();

            // Get Alkansya product and BOM
            $alkansyaProduct = Product::where('name', 'Alkansya')->first();
            if (!$alkansyaProduct) {
                return response()->json(['error' => 'Alkansya product not found'], 404);
            }

            $bomMaterials = ProductMaterial::where('product_id', $alkansyaProduct->id)
                ->with('inventoryItem')
                ->get();

            if ($bomMaterials->isEmpty()) {
                return response()->json(['error' => 'Alkansya BOM not found'], 404);
            }

            $quantity = $request->quantity;
            $materialsUsed = [];
            $totalCost = 0;

            // Calculate materials needed and deduct from inventory
            foreach ($bomMaterials as $bomMaterial) {
                $inventoryItem = $bomMaterial->inventoryItem;
                $requiredQuantity = $bomMaterial->qty_per_unit * $quantity;
                
                if ($requiredQuantity > 0) {
                    // Check if enough stock
                    if ($inventoryItem->quantity_on_hand < $requiredQuantity) {
                        DB::rollBack();
                        return response()->json([
                            'error' => "Insufficient stock for {$inventoryItem->name}. Required: {$requiredQuantity}, Available: {$inventoryItem->quantity_on_hand}"
                        ], 400);
                    }

                    // Deduct from inventory
                    $inventoryItem->quantity_on_hand -= $requiredQuantity;
                    $inventoryItem->save();

                    // Record material usage
                    $materialsUsed[] = [
                        'inventory_item_id' => $inventoryItem->id,
                        'item_name' => $inventoryItem->name,
                        'sku' => $inventoryItem->sku,
                        'quantity_used' => $requiredQuantity,
                        'unit_cost' => $inventoryItem->unit_cost,
                        'total_cost' => $inventoryItem->unit_cost * $requiredQuantity,
                    ];

                    $totalCost += $inventoryItem->unit_cost * $requiredQuantity;

                    // Log usage in inventory_usages table
                    InventoryUsage::create([
                        'inventory_item_id' => $inventoryItem->id,
                        'qty_used' => $requiredQuantity,
                        'date' => $request->date,
                    ]);

                    Log::info("Auto-deducted {$requiredQuantity} {$inventoryItem->unit} of {$inventoryItem->name} for Alkansya daily output");
                }
            }

            // Create or update daily output record
            $dailyOutput = AlkansyaDailyOutput::updateOrCreate(
                ['date' => $request->date],
                [
                    'quantity_produced' => $quantity,
                    'notes' => $request->notes,
                    'produced_by' => $request->produced_by,
                    'materials_used' => $materialsUsed,
                    'efficiency_percentage' => 100.00,
                    'defects' => 0,
                ]
            );

            // Update finished goods inventory
            $alkansyaFinishedGood = InventoryItem::where('sku', 'FG-ALKANSYA')->first();
            if ($alkansyaFinishedGood) {
                $alkansyaFinishedGood->quantity_on_hand += $quantity;
                $alkansyaFinishedGood->save();
            }

            DB::commit();

            return response()->json([
                'message' => 'Alkansya daily output added and materials deducted successfully',
                'data' => $dailyOutput,
                'materials_used' => $materialsUsed,
                'total_cost' => $totalCost
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Alkansya daily output auto deduction failed: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to add daily output: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get deduction history for a specific product
     */
    public function getDeductionHistory(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date'
        ]);

        $product = Product::findOrFail($request->product_id);
        
        $query = InventoryUsage::whereHas('inventoryItem', function($q) use ($product) {
            $q->whereIn('id', function($subQuery) use ($product) {
                $subQuery->select('inventory_item_id')
                    ->from('product_materials')
                    ->where('product_id', $product->id);
            });
        })->with('inventoryItem');

        if ($request->start_date) {
            $query->where('date', '>=', $request->start_date);
        }
        if ($request->end_date) {
            $query->where('date', '<=', $request->end_date);
        }

        $deductions = $query->orderBy('date', 'desc')->get();

        return response()->json([
            'product' => $product,
            'deductions' => $deductions,
            'total_deductions' => $deductions->count(),
            'total_quantity' => $deductions->sum('qty_used')
        ]);
    }

    /**
     * Get material consumption analysis for all products
     */
    public function getConsumptionAnalysis()
    {
        $products = Product::with(['materials.inventoryItem'])->get();
        
        $analysis = [];
        
        foreach ($products as $product) {
            $productAnalysis = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'materials' => []
            ];

            foreach ($product->materials as $material) {
                $inventoryItem = $material->inventoryItem;
                
                // Get usage for last 30 days
                $usage = InventoryUsage::where('inventory_item_id', $inventoryItem->id)
                    ->where('date', '>=', Carbon::now()->subDays(30))
                    ->sum('qty_used');

                $productAnalysis['materials'][] = [
                    'material_name' => $inventoryItem->name,
                    'sku' => $inventoryItem->sku,
                    'qty_per_unit' => $material->qty_per_unit,
                    'current_stock' => $inventoryItem->quantity_on_hand,
                    'usage_30_days' => $usage,
                    'unit_cost' => $inventoryItem->unit_cost,
                    'reorder_point' => $inventoryItem->reorder_point,
                    'safety_stock' => $inventoryItem->safety_stock,
                    'status' => $inventoryItem->quantity_on_hand <= $inventoryItem->reorder_point ? 'reorder' : 'ok'
                ];
            }

            $analysis[] = $productAnalysis;
        }

        return response()->json($analysis);
    }
}
