<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\ProductMaterial;
use App\Models\InventoryItem;

class PriceCalculatorController extends Controller
{
    /**
     * Calculate suggested price for a product based on materials, labor, and profit margin
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function calculatePrice(Request $request)
    {
        $request->validate([
            'product_id' => 'nullable|exists:products,id',
            'materials' => 'required|array',
            'materials.*.sku' => 'required|string',
            'materials.*.quantity' => 'required|numeric|min:0',
            'labor_percentage' => 'nullable|numeric|min:0|max:100',
            'profit_margin' => 'nullable|numeric|min:0|max:100',
        ]);

        $materials = $request->input('materials');
        $laborPercentage = $request->input('labor_percentage', 30); // Default 30% labor
        $profitMargin = $request->input('profit_margin', 25); // Default 25% profit

        // Calculate material cost
        $materialCost = 0;
        $materialBreakdown = [];

        foreach ($materials as $material) {
            $inventoryItem = InventoryItem::where('sku', $material['sku'])->first();
            
            if (!$inventoryItem) {
                return response()->json([
                    'error' => "Material with SKU {$material['sku']} not found"
                ], 404);
            }

            $unitCost = $inventoryItem->unit_cost ?? 0;
            $quantity = $material['quantity'];
            $itemCost = $unitCost * $quantity;
            
            $materialCost += $itemCost;
            
            $materialBreakdown[] = [
                'sku' => $material['sku'],
                'name' => $inventoryItem->name,
                'unit_cost' => $unitCost,
                'quantity' => $quantity,
                'total_cost' => round($itemCost, 2),
                'unit' => $inventoryItem->unit,
            ];
        }

        // Calculate labor cost (percentage of material cost)
        $laborCost = $materialCost * ($laborPercentage / 100);

        // Calculate total production cost
        $productionCost = $materialCost + $laborCost;

        // Calculate suggested selling price with profit margin
        $suggestedPrice = $productionCost * (1 + ($profitMargin / 100));

        // Round to nearest peso
        $suggestedPrice = round($suggestedPrice, 2);

        return response()->json([
            'material_cost' => round($materialCost, 2),
            'labor_cost' => round($laborCost, 2),
            'labor_percentage' => $laborPercentage,
            'production_cost' => round($productionCost, 2),
            'profit_margin' => $profitMargin,
            'suggested_price' => $suggestedPrice,
            'profit_amount' => round($suggestedPrice - $productionCost, 2),
            'material_breakdown' => $materialBreakdown,
        ]);
    }

    /**
     * Calculate price for existing product based on its BOM
     * 
     * @param int $productId
     * @return \Illuminate\Http\JsonResponse
     */
    public function calculateProductPrice($productId)
    {
        $product = Product::findOrFail($productId);
        
        // Get product materials (BOM)
        $productMaterials = ProductMaterial::where('product_id', $productId)->get();

        if ($productMaterials->isEmpty()) {
            return response()->json([
                'error' => 'No materials defined for this product. Please add materials first.'
            ], 400);
        }

        $materials = [];
        foreach ($productMaterials as $pm) {
            $materials[] = [
                'sku' => $pm->material_sku,
                'quantity' => $pm->quantity_needed,
            ];
        }

        // Use default labor and profit margins
        $request = new Request([
            'product_id' => $productId,
            'materials' => $materials,
            'labor_percentage' => 30,
            'profit_margin' => 25,
        ]);

        return $this->calculatePrice($request);
    }

    /**
     * Get pricing presets for different product types
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function getPricingPresets()
    {
        return response()->json([
            'presets' => [
                'alkansya' => [
                    'name' => 'Alkansya',
                    'labor_percentage' => 25,
                    'profit_margin' => 30,
                    'description' => 'Small decorative items with moderate labor'
                ],
                'table' => [
                    'name' => 'Dining Table',
                    'labor_percentage' => 40,
                    'profit_margin' => 35,
                    'description' => 'Large furniture with high labor cost'
                ],
                'chair' => [
                    'name' => 'Chair',
                    'labor_percentage' => 35,
                    'profit_margin' => 30,
                    'description' => 'Medium furniture with upholstery work'
                ],
                'custom' => [
                    'name' => 'Custom',
                    'labor_percentage' => 30,
                    'profit_margin' => 25,
                    'description' => 'Standard pricing for custom products'
                ],
            ]
        ]);
    }

    /**
     * Bulk calculate prices for multiple products
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function bulkCalculate(Request $request)
    {
        $request->validate([
            'product_ids' => 'required|array',
            'product_ids.*' => 'exists:products,id',
        ]);

        $results = [];
        foreach ($request->input('product_ids') as $productId) {
            $product = Product::find($productId);
            $calculation = $this->calculateProductPrice($productId);
            
            $results[] = [
                'product_id' => $productId,
                'product_name' => $product->name,
                'current_price' => $product->price,
                'calculation' => $calculation->getData(),
            ];
        }

        return response()->json(['results' => $results]);
    }
}
