<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Product;
use App\Models\ProductMaterial;
use App\Models\InventoryItem;

class ProductsTableSeeder extends Seeder
{
    public function run()
    {
        $this->command->info('Creating products with BOM-calculated prices...');

        // Create products first
        $diningTable = Product::updateOrCreate(
            ['name' => 'Dining Table'],
            [
                'product_code' => 'DT001',
                'product_name' => 'Dining Table',
                'description' => 'High-quality mahogany dining table',
                'price' => 12500.00, // Will be updated after BOM calculation
                'stock' => 50,
                'image' => 'storage/products/Table.jpg',
                'unit_of_measure' => 'pcs',
                'standard_cost' => 12500.00,
                'category_id' => 2, // made-to-order category
            ]
        );

        $woodenChair = Product::updateOrCreate(
            ['name' => 'Wooden Chair'],
            [
                'product_code' => 'WC001',
                'product_name' => 'Wooden Chair',
                'description' => 'Comfortable mahogany wooden chair',
                'price' => 7500.00, // Will be updated after BOM calculation
                'stock' => 50,
                'image' => 'storage/products/Chair.jpg',
                'unit_of_measure' => 'pcs',
                'standard_cost' => 20000.00,
                'category_id' => 2, // made-to-order category
            ]
        );

        $alkansya = Product::updateOrCreate(
            ['name' => 'Alkansya'],
            [
                'product_code' => 'ALK001',
                'product_name' => 'Alkansya',
                'description' => 'Traditional Filipino wooden chest',
                'price' => 159.00, // Will be updated after BOM calculation
                'stock' => 50,
                'image' => 'storage/products/Alkansya.jpg',
                'unit_of_measure' => 'pcs',
                'standard_cost' => 159.00,
                'category_id' => 1, // alkansya category
            ]
        );

        $alkansya = Product::updateOrCreate(
            ['name' => 'Alkansya (Forda Iphone)'],
            [
                'product_code' => 'ALK002',
                'product_name' => 'Alkansya (Forda Iphone)',
                'description' => 'Traditional Filipino wooden chest',
                'price' => 279, // Will be updated after BOM calculation
                'stock' => 50,
                'image' => 'storage/products/Forda.webp',
                'unit_of_measure' => 'pcs',
                'standard_cost' => 159.00,
                'category_id' => 1, // alkansya category
            ]
        );

        $alkansya = Product::updateOrCreate(
            ['name' => 'Alkansya (For Rhinoplasty)'],
            [
                'product_code' => 'ALK003',
                'product_name' => 'Alkansya (For Rhinoplasty)',
                'description' => 'Traditional Filipino wooden chest',
                'price' => 279.00, // Will be updated after BOM calculation
                'stock' => 50,
                'image' => 'storage/products/Rhino.webp',
                'unit_of_measure' => 'pcs',
                'standard_cost' => 159.00,
                'category_id' => 1, // alkansya category
            ]
        );

        $alkansya = Product::updateOrCreate(
            ['name' => 'Alkansya (100k Challenge)'],
            [
                'product_code' => 'ALK004',
                'product_name' => 'Alkansya (100k Challenge)',
                'description' => 'Traditional Filipino wooden chest',
                'price' => 279.00, // Will be updated after BOM calculation
                'stock' => 50,
                'image' => 'storage/products/100kyaw.webp',
                'unit_of_measure' => 'pcs',
                'standard_cost' => 159.00,
                'category_id' => 1, // alkansya category
            ]
        );

        $this->command->info('Products created. Attempting to calculate BOM-based prices...');

        // Try to calculate and update prices based on BOM (if available)
        $this->updateProductPrice($diningTable);
        $this->updateProductPrice($woodenChair);
        // Skip Alkansya - it uses fixed pricing of ₱159

        $this->command->info('Products created successfully!');
    }

    /**
     * Calculate and update product price based on BOM
     */
    private function updateProductPrice($product)
    {
        $bomPrice = $this->calculateBomPrice($product->id);
        
        if ($bomPrice) {
            $oldPrice = $product->price;
            $product->price = $bomPrice;
            $product->save();
            
            $this->command->info("Updated {$product->name}: ₱{$oldPrice} → ₱{$bomPrice}");
        } else {
            $this->command->warn("No BOM price calculated for {$product->name} - keeping original price ₱{$product->price}");
        }
    }

    /**
     * Calculate BOM-based price for a product
     */
    private function calculateBomPrice($productId)
    {
        try {
            // Get product materials (BOM)
            $productMaterials = ProductMaterial::where('product_id', $productId)->get();

            if ($productMaterials->isEmpty()) {
                return null;
            }

            $materialCost = 0;

            foreach ($productMaterials as $pm) {
                $inventoryItem = InventoryItem::find($pm->inventory_item_id);
                
                if (!$inventoryItem || !$inventoryItem->unit_cost) {
                    continue;
                }

                $unitCost = $inventoryItem->unit_cost;
                $quantity = $pm->qty_per_unit;
                $itemCost = $unitCost * $quantity;
                
                $materialCost += $itemCost;
            }

            if ($materialCost == 0) {
                return null;
            }

            // Use default labor and profit margins based on product type
            $laborPercentage = $this->getLaborPercentage($productId);
            $profitMargin = $this->getProfitMargin($productId);

            // Calculate labor cost (percentage of material cost)
            $laborCost = $materialCost * ($laborPercentage / 100);

            // Calculate total production cost
            $productionCost = $materialCost + $laborCost;

            // Calculate suggested selling price with profit margin
            $suggestedPrice = $productionCost * (1 + ($profitMargin / 100));

            // Round to nearest peso
            return round($suggestedPrice, 2);

        } catch (\Exception $e) {
            \Log::error('Error calculating BOM price for product ' . $productId . ': ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Get labor percentage based on product type
     */
    private function getLaborPercentage($productId)
    {
        $product = Product::find($productId);
        if (!$product) {
            return 30; // Default
        }

        $productName = strtolower($product->name);
        
        if (strpos($productName, 'alkansya') !== false) {
            return 25; // Alkansya: 25% labor
        } elseif (strpos($productName, 'table') !== false) {
            return 40; // Table: 40% labor
        } elseif (strpos($productName, 'chair') !== false) {
            return 35; // Chair: 35% labor
        }
        
        return 30; // Default
    }

    /**
     * Get profit margin based on product type
     */
    private function getProfitMargin($productId)
    {
        $product = Product::find($productId);
        if (!$product) {
            return 25; // Default
        }

        $productName = strtolower($product->name);
        
        if (strpos($productName, 'alkansya') !== false) {
            return 30; // Alkansya: 30% profit
        } elseif (strpos($productName, 'table') !== false) {
            return 35; // Table: 35% profit
        } elseif (strpos($productName, 'chair') !== false) {
            return 30; // Chair: 30% profit
        }
        
        return 25; // Default
    }
}