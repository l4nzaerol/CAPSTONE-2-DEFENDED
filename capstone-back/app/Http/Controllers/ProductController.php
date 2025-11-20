<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\BOM;
use App\Models\Material;
use App\Models\AlkansyaDailyOutput;
use App\Models\OrderItem;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    /**
     * Generate a new product code based on category
     */
    public function generateProductCode(Request $request)
    {
        $category = $request->input('category', 'Stocked Products');
        
        // Determine prefix based on category
        $prefix = 'PROD'; // Default prefix
        if (str_contains(strtolower($category), 'alkansya') || $category === 'Stocked Products') {
            $prefix = 'ALK';
        } elseif (str_contains(strtolower($category), 'table') || str_contains(strtolower($category), 'dining')) {
            $prefix = 'DT';
        } elseif (str_contains(strtolower($category), 'chair') || str_contains(strtolower($category), 'wooden')) {
            $prefix = 'WC';
        }
        
        // Find the next available number for this prefix
        $lastProduct = Product::where('product_code', 'like', $prefix . '%')
            ->orderBy('product_code', 'desc')
            ->first();
        
        $nextNumber = 1;
        if ($lastProduct) {
            // Extract number from product code (e.g., "ALK001" -> 1)
            preg_match('/' . $prefix . '(\d+)/', $lastProduct->product_code, $matches);
            if (isset($matches[1])) {
                $nextNumber = intval($matches[1]) + 1;
            }
        }
        
        $productCode = $prefix . str_pad($nextNumber, 3, '0', STR_PAD_LEFT);
        
        return response()->json(['product_code' => $productCode]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'product_name' => 'sometimes|required|string|max:255',
            'product_code' => 'required|string|unique:products,product_code',
            'description' => 'nullable|string',
            'category_name' => 'nullable|string',
            'price' => 'required|numeric|min:0.01',
            'image' => 'nullable|string',
            'bom' => 'nullable|array',
            'bom.*.material_id' => 'required|exists:materials,material_id',
            'bom.*.quantity_per_product' => 'required|numeric|min:0',
            'bom.*.unit_of_measure' => 'required|string',
            'is_available_for_order' => 'nullable|boolean',
        ]);

        // Ensure product_name is set (handle both old and new column names)
        if (!isset($data['product_name']) && isset($data['name'])) {
            $data['product_name'] = $data['name'];
        }
        if (!isset($data['name']) && isset($data['product_name'])) {
            $data['name'] = $data['product_name'];
        }
        
        // Validate: Stocked Products must have "Alkansya" in the name
        if (isset($data['category_name']) && 
            ($data['category_name'] === 'Stocked Products' || $data['category_name'] === 'stocked_products')) {
            $productName = strtolower($data['product_name'] ?? $data['name'] ?? '');
            if (!str_contains($productName, 'alkansya')) {
                return response()->json([
                    'error' => 'Stocked Products must have "Alkansya" in the product name.'
                ], 422);
            }
        }
        
        // For Stocked Products (Alkansya), calculate stock from daily output records minus orders
        // This ensures new Alkansya products have the same stock as existing ones
        if (isset($data['category_name']) && 
            ($data['category_name'] === 'Stocked Products' || $data['category_name'] === 'stocked_products')) {
            // Try to get stock from an existing Alkansya product first (most accurate)
            $existingAlkansya = Product::where('category_name', 'Stocked Products')
                ->where(function($query) {
                    $query->where('name', 'LIKE', '%Alkansya%')
                          ->orWhere('product_name', 'LIKE', '%Alkansya%');
                })
                ->first();
            
            if ($existingAlkansya) {
                // Use the stock from existing Alkansya product (already accounts for daily output and orders)
                $data['stock'] = $existingAlkansya->stock ?? 0;
            } else {
                // If no existing Alkansya product, calculate from daily output minus orders
                $totalDailyOutput = AlkansyaDailyOutput::sum('quantity_produced');
                
                // Get total quantity sold from orders for Alkansya products
                $totalSold = OrderItem::whereHas('product', function($query) {
                    $query->where('category_name', 'Stocked Products')
                          ->where(function($q) {
                              $q->where('name', 'LIKE', '%Alkansya%')
                                ->orWhere('product_name', 'LIKE', '%Alkansya%');
                          });
                })->sum('quantity');
                
                $data['stock'] = max(0, $totalDailyOutput - $totalSold);
            }
        } elseif (!isset($data['stock'])) {
            // For other products, set stock to 0 if not provided
            $data['stock'] = 0;
        }

        DB::beginTransaction();
        try {
            $product = Product::create($data);
            
            // Handle BOM if provided
            if (isset($data['bom']) && is_array($data['bom'])) {
                foreach ($data['bom'] as $bomItem) {
                    BOM::create([
                        'product_id' => $product->id,
                        'material_id' => $bomItem['material_id'],
                        'quantity_per_product' => $bomItem['quantity_per_product'],
                        'unit_of_measure' => $bomItem['unit_of_measure']
                    ]);
                }
            }
            
            DB::commit();
            return response()->json($product, 201);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json(['error' => 'Failed to create product: ' . $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $product = Product::findOrFail($id);
        
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'product_name' => 'sometimes|required|string|max:255',
            'product_code' => 'sometimes|required|string|unique:products,product_code,' . $id,
            'description' => 'nullable|string',
            'category_name' => 'nullable|string',
            'unit_of_measure' => 'nullable|string',
            'standard_cost' => 'sometimes|required|numeric|min:0',
            'price' => 'sometimes|required|numeric|min:0',
            'stock' => 'sometimes|required|integer|min:0',
            'image' => 'nullable|string',
            'bom' => 'nullable|array',
            'bom.*.material_id' => 'required|exists:materials,material_id',
            'bom.*.quantity_per_product' => 'required|numeric|min:0',
            'bom.*.unit_of_measure' => 'required|string',
            'is_available_for_order' => 'nullable|boolean',
        ]);

        // Ensure product_name is set (handle both old and new column names)
        if (!isset($data['product_name']) && isset($data['name'])) {
            $data['product_name'] = $data['name'];
        }
        if (!isset($data['name']) && isset($data['product_name'])) {
            $data['name'] = $data['product_name'];
        }
        
        // Validate: Stocked Products must have "Alkansya" in the name
        if (isset($data['category_name']) && 
            ($data['category_name'] === 'Stocked Products' || $data['category_name'] === 'stocked_products')) {
            $productName = strtolower($data['product_name'] ?? $data['name'] ?? $product->product_name ?? $product->name ?? '');
            if (!str_contains($productName, 'alkansya')) {
                return response()->json([
                    'error' => 'Stocked Products must have "Alkansya" in the product name.'
                ], 422);
            }
        }
        
        // For Stocked Products (Alkansya), don't allow manual stock updates
        // Stock is managed through daily output records
        $isStockedProduct = ($data['category_name'] ?? $product->category_name) === 'Stocked Products' || 
                           ($data['category_name'] ?? $product->category_name) === 'stocked_products';
        
        if ($isStockedProduct) {
            // Remove stock from update data - it's managed by daily output
            unset($data['stock']);
        } elseif (!isset($data['stock'])) {
            // For other products, set stock to 0 if not provided
            $data['stock'] = 0;
        }

        DB::beginTransaction();
        try {
            $product->update($data);
            
            // Handle BOM if provided
            if (isset($data['bom']) && is_array($data['bom'])) {
                // Delete existing BOM
                BOM::where('product_id', $product->id)->delete();
                
                // Create new BOM entries
                foreach ($data['bom'] as $bomItem) {
                    BOM::create([
                        'product_id' => $product->id,
                        'material_id' => $bomItem['material_id'],
                        'quantity_per_product' => $bomItem['quantity_per_product'],
                        'unit_of_measure' => $bomItem['unit_of_measure']
                    ]);
                }
            }
            
            DB::commit();
            return response()->json($product);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json(['error' => 'Failed to update product: ' . $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        $product = Product::findOrFail($id);
        $product->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function index()
    {
        // Get all products with enhanced fields and BOM data
        $products = Product::with('bomMaterials.material')->get()->map(function($product) {
            // Ensure product_name is available (handle both old and new column names)
            if (!isset($product->product_name) && isset($product->name)) {
                $product->product_name = $product->name;
            }
            
            // Generate product_code if not exists
            if (!isset($product->product_code) || empty($product->product_code)) {
                $product->product_code = 'PROD-' . str_pad($product->id, 3, '0', STR_PAD_LEFT);
            }
            
            // Set default values for new columns if they don't exist
            if (!isset($product->unit_of_measure)) {
                $product->unit_of_measure = 'pcs';
            }
            if (!isset($product->standard_cost)) {
                $product->standard_cost = 0;
            }
            if (!isset($product->category_name)) {
                $product->category_name = 'Stocked Products';
            }
            
            // Calculate availability based on category and stock
            if ($product->category_name === 'Made to Order' || $product->category_name === 'made_to_order') {
                $isAvailableForOrder = $product->is_available_for_order ?? true; // Default to true if not set
                $product->is_available = $isAvailableForOrder;
                $product->availability_text = $isAvailableForOrder ? 'Available for Order' : 'Not Available';
                $product->availability_variant = $isAvailableForOrder ? 'success' : 'danger';
            } else {
                $stock = $product->stock || 0;
                if ($stock > 10) {
                    $product->is_available = true;
                    $product->availability_text = 'In Stock';
                    $product->availability_variant = 'success';
                } else if ($stock > 0) {
                    $product->is_available = true;
                    $product->availability_text = 'Low Stock';
                    $product->availability_variant = 'warning';
                } else {
                    $product->is_available = false;
                    $product->availability_text = 'Out of Stock';
                    $product->availability_variant = 'danger';
                }
            }
            
            // Calculate profit margin
            if ($product->standard_cost > 0 && $product->price > 0) {
                $product->profit_margin = round((($product->price - $product->standard_cost) / $product->price) * 100, 1);
                $product->profit_amount = $product->price - $product->standard_cost;
            } else {
                $product->profit_margin = 0;
                $product->profit_amount = 0;
            }
            
            // Add BOM data
            $product->bom = $product->bomMaterials->map(function($bomItem) {
                return [
                    'id' => $bomItem->id,
                    'material_id' => $bomItem->material_id,
                    'material_name' => $bomItem->material->material_name ?? 'Unknown Material',
                    'material_code' => $bomItem->material->material_code ?? '',
                    'quantity_per_product' => $bomItem->quantity_per_product,
                    'unit_of_measure' => $bomItem->unit_of_measure,
                    'standard_cost' => $bomItem->material->standard_cost ?? 0,
                    'total_cost' => $bomItem->quantity_per_product * ($bomItem->material->standard_cost ?? 0)
                ];
            });
            
            return $product;
        });
        
        return response()->json($products);
    }

    public function show($id)
    {
        return response()->json(Product::findOrFail($id));
    }

    // BOM endpoints
    public function getAllBOMs()
    {
        $boms = BOM::with(['material', 'product'])
            ->orderBy('product_id')
            ->orderBy('material_id')
            ->get()
            ->map(function($bomItem) {
                return [
                    'id' => $bomItem->id,
                    'product_id' => $bomItem->product_id,
                    'product_name' => $bomItem->product->name ?? 'Unknown Product',
                    'material_id' => $bomItem->material_id,
                    'material_name' => $bomItem->material->material_name ?? 'Unknown Material',
                    'material_code' => $bomItem->material->material_code ?? '',
                    'quantity_per_product' => $bomItem->quantity_per_product,
                    'unit_of_measure' => $bomItem->unit_of_measure,
                    'standard_cost' => $bomItem->material->standard_cost ?? 0,
                    'total_cost' => $bomItem->quantity_per_product * ($bomItem->material->standard_cost ?? 0)
                ];
            });
        return response()->json($boms);
    }

    public function getBOM($id)
    {
        $product = Product::findOrFail($id);
        $bom = BOM::with('material')->where('product_id', $product->id)->get()->map(function($bomItem) {
            return [
                'id' => $bomItem->id,
                'material_id' => $bomItem->material_id,
                'material_name' => $bomItem->material->material_name ?? 'Unknown Material',
                'material_code' => $bomItem->material->material_code ?? '',
                'quantity_per_product' => $bomItem->quantity_per_product,
                'unit_of_measure' => $bomItem->unit_of_measure,
                'standard_cost' => $bomItem->material->standard_cost ?? 0,
                'total_cost' => $bomItem->quantity_per_product * ($bomItem->material->standard_cost ?? 0)
            ];
        });
        return response()->json($bom);
    }

    public function setBOM(Request $request, $id)
    {
        $product = Product::findOrFail($id);
        $data = $request->validate([
            'materials' => 'required|array',
            'materials.*.material_id' => 'required|exists:materials,material_id',
            'materials.*.quantity_per_product' => 'required|numeric|min:0',
            'materials.*.unit_of_measure' => 'required|string',
        ]);

        DB::beginTransaction();
        try {
            // Delete existing BOM
            BOM::where('product_id', $product->id)->delete();

            // Create new BOM entries
            foreach ($data['materials'] as $material) {
                BOM::create([
                    'product_id' => $product->id,
                    'material_id' => $material['material_id'],
                    'quantity_per_product' => $material['quantity_per_product'],
                    'unit_of_measure' => $material['unit_of_measure']
                ]);
            }

            DB::commit();
            return response()->json(['message' => 'BOM saved successfully']);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json(['error' => 'Failed to save BOM: ' . $e->getMessage()], 500);
        }
    }

    public function exportBOMCsv($id)
    {
        $product = Product::findOrFail($id);
        $rows = BOM::with('material')->where('product_id', $product->id)->get();
        $csv = "material_id,material_name,quantity_per_product,unit_of_measure\n";
        foreach ($rows as $r) {
            $csv .= $r->material_id . "," . $r->material->material_name . "," . $r->quantity_per_product . "," . $r->unit_of_measure . "\n";
        }
        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="product_'.$product->id.'_bom.csv"'
        ]);
    }

    public function importBOMCsv(Request $request, $id)
    {
        $product = Product::findOrFail($id);
        $request->validate(['file' => 'required|file|mimes:csv,txt']);
        $text = $request->file('file')->get();
        $lines = preg_split("/\r?\n/", trim($text));
        array_shift($lines); // header
        
        DB::beginTransaction();
        try {
            BOM::where('product_id', $product->id)->delete();
            foreach ($lines as $line) {
                if (!strlen(trim($line))) continue;
                [$materialId, $materialName, $qty, $unit] = array_map('trim', explode(',', $line));
                BOM::create([
                    'product_id' => $product->id,
                    'material_id' => (int)$materialId,
                    'quantity_per_product' => (float)$qty,
                    'unit_of_measure' => $unit,
                ]);
            }
            DB::commit();
            return response()->json(['message' => 'BOM imported successfully']);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json(['error' => 'Failed to import BOM: ' . $e->getMessage()], 500);
        }
    }

    public function toggleAvailability($id)
    {
        $product = Product::findOrFail($id);
        
        // Only allow toggling for made-to-order products
        if ($product->category_name !== 'Made to Order' && $product->category_name !== 'made_to_order') {
            return response()->json(['error' => 'Only made-to-order products can have their availability toggled'], 400);
        }
        
        $product->is_available_for_order = !$product->is_available_for_order;
        $product->save();
        
        return response()->json([
            'message' => 'Product availability updated successfully',
            'is_available_for_order' => $product->is_available_for_order
        ]);
    }

}