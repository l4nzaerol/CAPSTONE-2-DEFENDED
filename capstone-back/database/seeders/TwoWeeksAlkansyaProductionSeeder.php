<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AlkansyaDailyOutput;
use App\Models\Product;
use App\Models\BOM;
use App\Models\Material;
use App\Models\Inventory;
use App\Models\InventoryTransaction;
use App\Models\InventoryItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TwoWeeksAlkansyaProductionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Creating 2 weeks of daily Alkansya production output...');

        try {
            DB::beginTransaction();

            // Get Alkansya products
            $alkansyaProducts = Product::where('category_name', 'Stocked Products')
                ->where(function($query) {
                    $query->where('name', 'LIKE', '%Alkansya%')
                          ->orWhere('product_name', 'LIKE', '%Alkansya%');
                })
                ->get();

            if ($alkansyaProducts->isEmpty()) {
                $this->command->warn('No Alkansya products found. Please run product seeders first.');
                DB::rollBack();
                return;
            }

            $this->command->info('Found ' . $alkansyaProducts->count() . ' Alkansya product(s)');

            // Use the first Alkansya product for BOM calculation
            $alkansyaProduct = $alkansyaProducts->first();
            $bomMaterials = BOM::where('product_id', $alkansyaProduct->id)
                ->with('material')
                ->get();

            if ($bomMaterials->isEmpty()) {
                $this->command->warn('No BOM materials found for Alkansya. Please run BOM seeders first.');
                DB::rollBack();
                return;
            }

            $this->command->info('Found ' . $bomMaterials->count() . ' BOM materials for Alkansya');

            // Get users for produced_by field
            $users = User::where('role', 'employee')->get();
            if ($users->isEmpty()) {
                $users = User::all();
            }
            $defaultProducer = $users->isNotEmpty() ? $users->first()->name : 'System';

            // Clear existing daily output from the past 2 weeks
            $twoWeeksAgo = Carbon::now()->subDays(14);
            $deleted = AlkansyaDailyOutput::where('date', '>=', $twoWeeksAgo->format('Y-m-d'))->delete();
            $this->command->info("Cleared {$deleted} existing daily output record(s) from the past 2 weeks.");
            
            // Also clear related inventory transactions from the past 2 weeks to avoid duplicate/incorrect remarks
            $deletedTransactions = InventoryTransaction::where('transaction_type', 'ALKANSYA_CONSUMPTION')
                ->where('reference', 'LIKE', 'Alkansya Daily Output - %')
                ->where('timestamp', '>=', $twoWeeksAgo->format('Y-m-d 00:00:00'))
                ->delete();
            $this->command->info("Cleared {$deletedTransactions} existing inventory transaction(s) from the past 2 weeks.");

            // Ensure materials have sufficient stock before starting
            $this->ensureMaterialStock($bomMaterials);

            // Generate production data for each day in the past 2 weeks
            $currentDate = $twoWeeksAgo->copy();
            $totalProduced = 0;
            $totalDays = 0;

            while ($currentDate->lte(Carbon::now())) {
                $dateStr = $currentDate->format('Y-m-d');
                
                // Skip weekends occasionally (70% chance to produce on weekends)
                if (!$currentDate->isWeekday() && rand(1, 10) > 7) {
                    $currentDate->addDay();
                    continue;
                }

                // Generate quantity for the day (5-30 units, with some variation)
                $quantity = rand(5, 30);
                
                // Slightly lower production on weekends
                if (!$currentDate->isWeekday()) {
                    $quantity = rand(3, 20);
                }

                // Select random producer
                $producedBy = $users->isNotEmpty() ? $users->random()->name : $defaultProducer;

                // Process daily output
                $result = $this->createDailyOutput(
                    $dateStr,
                    $quantity,
                    $producedBy,
                    $alkansyaProduct,
                    $alkansyaProducts,
                    $bomMaterials
                );

                if ($result['success']) {
                    $totalProduced += $quantity;
                    $totalDays++;
                    $this->command->info("Created daily output for {$dateStr}: {$quantity} units (Total cost: ₱" . number_format($result['total_cost'], 2) . ")");
                } else {
                    $this->command->error("Failed to create daily output for {$dateStr}: " . $result['error']);
                }

                $currentDate->addDay();
            }

            DB::commit();

            $this->command->info("==========================================");
            $this->command->info("Successfully created {$totalDays} days of Alkansya production!");
            $this->command->info("Total units produced: {$totalProduced}");
            $this->command->info("Average daily production: " . ($totalDays > 0 ? round($totalProduced / $totalDays, 2) : 0) . " units");
            $this->command->info("==========================================");
            
            // Verify transactions were created
            $transactionCount = InventoryTransaction::where('transaction_type', 'ALKANSYA_CONSUMPTION')
                ->where('reference', 'LIKE', 'Alkansya Daily Output - %')
                ->where('timestamp', '>=', $twoWeeksAgo->format('Y-m-d 00:00:00'))
                ->count();
            
            $this->command->info("Total transactions created: {$transactionCount}");
            
            if ($transactionCount < $totalDays * $bomMaterials->count()) {
                $this->command->warn("Warning: Expected more transactions. Some may be missing.");
                $this->command->info("Run 'php artisan alkansya:backfill-transactions' to backfill missing transactions.");
            }
            
            $this->command->info('TwoWeeksAlkansyaProductionSeeder completed successfully!');

        } catch (\Exception $e) {
            DB::rollBack();
            $this->command->error('Error creating Alkansya production data: ' . $e->getMessage());
            $this->command->error('Stack trace: ' . $e->getTraceAsString());
            throw $e;
        }
    }

    /**
     * Ensure materials have sufficient stock
     */
    private function ensureMaterialStock($bomMaterials): void
    {
        $this->command->info('Checking material stock levels...');

        foreach ($bomMaterials as $bomMaterial) {
            $material = $bomMaterial->material;
            if (!$material) {
                continue;
            }

            // Calculate maximum needed for 2 weeks (assuming max 30 units/day)
            $maxNeeded = $bomMaterial->quantity_per_product * 30 * 14;
            
            // Get current stock from inventory
            $inventory = Inventory::where('material_id', $material->material_id)->first();
            $currentStock = $inventory ? $inventory->current_stock : 0;
            
            // Also check material's current_stock field
            $materialStock = $material->current_stock ?? 0;
            $totalStock = max($currentStock, $materialStock);

            if ($totalStock < $maxNeeded) {
                // Add stock to ensure we have enough
                $stockToAdd = $maxNeeded - $totalStock + ($maxNeeded * 0.2); // Add 20% buffer
                
                if ($inventory) {
                    $inventory->current_stock += $stockToAdd;
                    $inventory->last_updated = now();
                    $inventory->save();
                } else {
                    // Create inventory record
                    Inventory::create([
                        'material_id' => $material->material_id,
                        'location_id' => 1,
                        'current_stock' => $stockToAdd,
                        'quantity_reserved' => 0,
                        'last_updated' => now(),
                    ]);
                }

                // Update material's current_stock
                $material->current_stock = ($material->current_stock ?? 0) + $stockToAdd;
                $material->save();

                // Create purchase transaction for the added stock
                InventoryTransaction::create([
                    'material_id' => $material->material_id,
                    'transaction_type' => 'PURCHASE',
                    'quantity' => $stockToAdd,
                    'reference' => 'SEEDER_STOCK_ADDITION',
                    'remarks' => "Stock added by seeder to ensure sufficient inventory for 2 weeks production",
                    'timestamp' => now(),
                    'unit_cost' => $material->standard_cost ?? 0,
                    'total_cost' => ($material->standard_cost ?? 0) * $stockToAdd,
                    'status' => 'completed',
                ]);

                $this->command->info("Added {$stockToAdd} units of {$material->material_name} to inventory");
            }
        }
    }

    /**
     * Create daily output with material consumption
     */
    private function createDailyOutput(
        string $date,
        int $quantity,
        string $producedBy,
        Product $alkansyaProduct,
        $alkansyaProducts,
        $bomMaterials
    ): array {
        try {
            $materialsUsed = [];
            $totalCost = 0;
            $dateObj = Carbon::parse($date);

            // Calculate materials needed and deduct from inventory
            foreach ($bomMaterials as $bomMaterial) {
                $material = $bomMaterial->material;
                
                if (!$material) {
                    continue;
                }
                
                $requiredQuantity = $bomMaterial->quantity_per_product * $quantity;
                
                if ($requiredQuantity > 0) {
                    // Get or create inventory record
                    $inventory = Inventory::firstOrCreate(
                        [
                            'material_id' => $material->material_id,
                            'location_id' => 1,
                        ],
                        [
                            'current_stock' => 0,
                            'quantity_reserved' => 0,
                            'last_updated' => $dateObj,
                        ]
                    );

                    // Check if enough stock
                    if ($inventory->current_stock < $requiredQuantity) {
                        // If not enough, add more stock (for seeder purposes)
                        $shortage = $requiredQuantity - $inventory->current_stock;
                        $inventory->current_stock += $shortage + ($requiredQuantity * 0.1); // Add 10% buffer
                        $this->command->warn("Insufficient stock for {$material->material_name}. Added {$shortage} units.");
                    }

                    // Deduct from inventory
                    $inventory->current_stock -= $requiredQuantity;
                    $inventory->last_updated = $dateObj;
                    $inventory->save();

                    // Update material's current_stock
                    $material->current_stock = max(0, ($material->current_stock ?? 0) - $requiredQuantity);
                    $material->save();

                    // Record material usage
                    $unitCost = $material->standard_cost ?? 0;
                    $materialTotalCost = $unitCost * $requiredQuantity;
                    
                    $materialsUsed[] = [
                        'material_id' => $material->material_id,
                        'material_name' => $material->material_name,
                        'material_code' => $material->material_code,
                        'quantity_used' => $requiredQuantity,
                        'unit_cost' => $unitCost,
                        'total_cost' => $materialTotalCost,
                    ];

                    $totalCost += $materialTotalCost;

                    // Create inventory transaction for material consumption
                    // Ensure we use the actual daily quantity produced, not a fixed value
                    $dailyQuantityProduced = $quantity; // Explicitly capture the daily quantity
                    InventoryTransaction::create([
                        'material_id' => $material->material_id,
                        'product_id' => $alkansyaProduct->id,
                        'transaction_type' => 'ALKANSYA_CONSUMPTION',
                        'quantity' => -$requiredQuantity,
                        'reference' => 'Alkansya Daily Output - ' . $date,
                        'remarks' => "Material consumption for Alkansya production - {$dailyQuantityProduced} units produced on {$date}",
                        'timestamp' => $dateObj,
                        'unit_cost' => $unitCost,
                        'total_cost' => $materialTotalCost,
                        'status' => 'completed',
                        'metadata' => [
                            'product_id' => $alkansyaProduct->id,
                            'product_name' => $alkansyaProduct->product_name ?? $alkansyaProduct->name,
                            'quantity_produced' => $dailyQuantityProduced,
                            'date' => $date,
                        ],
                    ]);
                }
            }

            // Create or update daily output record
            $dailyOutput = AlkansyaDailyOutput::updateOrCreate(
                ['date' => $date],
                [
                    'quantity_produced' => $quantity,
                    'produced_by' => $producedBy,
                    'materials_used' => $materialsUsed,
                ]
            );

            // Update stock for ALL Alkansya products
            foreach ($alkansyaProducts as $product) {
                $product->increment('stock', $quantity);
            }

            // Update finished goods inventory (if InventoryItem exists)
            $alkansyaInventoryItem = InventoryItem::where('name', 'LIKE', '%Alkansya%')
                ->where('category', 'finished')
                ->first();
            
            if ($alkansyaInventoryItem) {
                $alkansyaInventoryItem->quantity_on_hand += $quantity;
                $alkansyaInventoryItem->save();
                
                // Create inventory transaction for finished goods
                InventoryTransaction::create([
                    'inventory_item_id' => $alkansyaInventoryItem->id,
                    'product_id' => $alkansyaProduct->id,
                    'transaction_type' => 'PRODUCTION_OUTPUT',
                    'quantity' => $quantity,
                    'reference' => 'Alkansya Daily Output - ' . $date,
                    'remarks' => "Produced {$quantity} units of Alkansya on {$date}",
                    'timestamp' => $dateObj,
                    'unit_cost' => 0,
                    'total_cost' => $totalCost,
                    'status' => 'completed',
                    'metadata' => [
                        'product_id' => $alkansyaProduct->id,
                        'product_name' => $alkansyaProduct->product_name ?? $alkansyaProduct->name,
                        'quantity_produced' => $quantity,
                        'date' => $date,
                        'produced_by' => $producedBy,
                    ],
                ]);
            }

            return [
                'success' => true,
                'daily_output' => $dailyOutput,
                'materials_used' => $materialsUsed,
                'total_cost' => $totalCost
            ];

        } catch (\Exception $e) {
            Log::error('Failed to create daily output for ' . $date . ': ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
}

