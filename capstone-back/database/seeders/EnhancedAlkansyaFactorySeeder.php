<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AlkansyaDailyOutput;
use App\Models\Product;
use App\Models\BOM;
use App\Models\Material;
use App\Models\Inventory;
use App\Models\InventoryTransaction;
use App\Models\ProductionAnalytics;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class EnhancedAlkansyaFactorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     * Creates 3 months of Alkansya daily output data with normalized inventory integration
     */
    public function run(): void
    {
        $this->log('🌱 Seeding 3 months of Alkansya daily output with normalized inventory integration...');

        // Get Alkansya product
        $alkansyaProduct = Product::where('name', 'Alkansya')->first();
        if (!$alkansyaProduct) {
            $this->log('❌ Alkansya product not found. Please run ProductSeeder first.');
            return;
        }

        // Get Alkansya BOM materials from the normalized inventory system
        $bomMaterials = BOM::where('product_id', $alkansyaProduct->id)
            ->with('material')
            ->get();

        if ($bomMaterials->isEmpty()) {
            $this->log('❌ No BOM materials found for Alkansya. Please run ComprehensiveInventorySeeder first.');
            return;
        }

        // Create 3 months of data (excluding Sundays)
        $startDate = Carbon::now()->subMonths(3);
        $endDate = Carbon::now()->subDay(); // Previous day

        $this->log("📅 Creating data from {$startDate->format('Y-m-d')} to {$endDate->format('Y-m-d')}");

        // Initialize stock levels for normalized inventory
        $stockLevels = [];
        foreach ($bomMaterials as $bomMaterial) {
            $material = $bomMaterial->material;
            $inventory = Inventory::where('material_id', $material->material_id)->first();
            if ($inventory) {
                $stockLevels[$material->material_id] = $inventory->current_stock;
            } else {
                // Create inventory record if it doesn't exist
                $inventory = Inventory::create([
                    'material_id' => $material->material_id,
                    'location_id' => 1,
                    'current_stock' => 1000, // Initial stock
                    'quantity_reserved' => 0,
                    'last_updated' => $startDate
                ]);
                $stockLevels[$material->material_id] = 1000;
            }
        }

        $totalCreated = 0;
        $currentDate = $startDate->copy();

        while ($currentDate->lte($endDate)) {
            // Skip Sundays (dayOfWeek = 0)
            if ($currentDate->dayOfWeek !== 0) {
                $result = $this->createDailyOutputWithNormalizedInventory($currentDate, $bomMaterials, $stockLevels, $alkansyaProduct);
                if ($result) {
                    $totalCreated++;
                }
            }
            
            $currentDate->addDay();
        }

        $this->log("✅ Created {$totalCreated} days of Alkansya daily output data");
        
        // Display final inventory status
        $this->displayFinalInventoryStatus($bomMaterials, $stockLevels);
        
        // Display transaction summary
        $this->displayTransactionSummary();
    }

    /**
     * Create daily output with normalized inventory integration
     */
    private function createDailyOutputWithNormalizedInventory($date, $bomMaterials, &$stockLevels, $alkansyaProduct)
    {
        // Generate realistic production quantity (200-400 range)
        $baseProduction = $this->getBaseProduction($date);
        $variation = $this->getProductionVariation($date);
        $quantityProduced = max(200, min(400, $baseProduction + $variation));

        // Check if we have enough materials before production
        $canProduce = $this->checkMaterialAvailability($bomMaterials, $quantityProduced, $stockLevels);
        
        if (!$canProduce) {
            // Reduce production to what we can actually make
            $quantityProduced = $this->calculateMaxProduction($bomMaterials, $stockLevels);
            if ($quantityProduced <= 0) {
                $this->log("⚠️  No production on {$date->format('Y-m-d')} - insufficient materials");
                return false;
            }
        }

        DB::beginTransaction();
        try {
            // Calculate materials used and update normalized inventory
            $materialsUsed = [];
            $totalCost = 0;

            foreach ($bomMaterials as $bomMaterial) {
                $material = $bomMaterial->material;
                $requiredQuantity = $bomMaterial->quantity_per_product * $quantityProduced;
                
                if ($requiredQuantity > 0) {
                    // Simulate material usage with some variation (95-105% of required)
                    $actualUsage = $requiredQuantity * (0.95 + (rand(0, 10) / 100));
                    
                    // Ensure we don't go below zero stock
                    $actualUsage = min($actualUsage, $stockLevels[$material->material_id]);
                    
                    if ($actualUsage > 0) {
                        $materialsUsed[] = [
                            'material_id' => $material->material_id,
                            'material_name' => $material->material_name,
                            'material_code' => $material->material_code,
                            'quantity_used' => round($actualUsage, 2),
                            'unit_cost' => $material->standard_cost,
                            'total_cost' => round($material->standard_cost * $actualUsage, 2),
                        ];

                        $totalCost += $material->standard_cost * $actualUsage;

                        // Update normalized inventory
                        $inventory = Inventory::where('material_id', $material->material_id)->first();
                        if ($inventory) {
                            $inventory->current_stock -= $actualUsage;
                            $inventory->last_updated = $date;
                            $inventory->save();
                        }

                        // Update stock levels tracking
                        $stockLevels[$material->material_id] -= $actualUsage;

                        // Create consumption transaction
                        InventoryTransaction::create([
                            'material_id' => $material->material_id,
                            'transaction_type' => 'ALKANSYA_CONSUMPTION',
                            'quantity' => -$actualUsage, // Negative for consumption
                            'reference' => 'ALK-' . $date->format('Ymd') . '-' . rand(1000, 9999),
                            'remarks' => "Material consumed for Alkansya production on {$date->format('Y-m-d')}",
                            'timestamp' => $date->setTime(rand(8, 17), rand(0, 59)),
                            'unit_cost' => $material->standard_cost,
                            'total_cost' => $material->standard_cost * $actualUsage,
                            'user_id' => 1,
                            'metadata' => json_encode([
                                'production_date' => $date->format('Y-m-d'),
                                'quantity_produced' => $quantityProduced,
                                'material_usage_variation' => round(($actualUsage / $requiredQuantity) * 100, 2)
                            ])
                        ]);
                    }
                }
            }

            // Create daily output record
            $dailyOutput = AlkansyaDailyOutput::factory()->create([
                'date' => $date->format('Y-m-d'),
                'quantity_produced' => $quantityProduced,
                'materials_used' => $materialsUsed,
                'produced_by' => $this->getRandomProducer(),
            ]);

            // Add finished goods to inventory (if Alkansya is tracked as inventory)
            $this->addFinishedGoodsToNormalizedInventory($quantityProduced, $date, $alkansyaProduct);

            // Create production output transaction
            InventoryTransaction::create([
                'product_id' => $alkansyaProduct->id,
                'transaction_type' => 'PRODUCTION_OUTPUT',
                'quantity' => $quantityProduced,
                'reference' => 'ALK-OUTPUT-' . $date->format('Ymd') . '-' . rand(1000, 9999),
                'remarks' => "Alkansya production output for {$date->format('Y-m-d')}",
                'timestamp' => $date->setTime(rand(16, 18), rand(0, 59)),
                'unit_cost' => 150.00, // Standard Alkansya cost
                'total_cost' => 150.00 * $quantityProduced,
                'user_id' => 1,
                'metadata' => json_encode([
                    'production_date' => $date->format('Y-m-d'),
                    'materials_consumed' => count($materialsUsed),
                    'total_material_cost' => $totalCost,
                    'production_efficiency' => round(($quantityProduced / 300) * 100, 2) // Based on target of 300
                ])
            ]);

            // Sync to ProductionAnalytics for dashboard display
            $this->syncToProductionAnalytics($dailyOutput, $alkansyaProduct);

            DB::commit();
            return true;

        } catch (\Exception $e) {
            DB::rollback();
            $this->log("❌ Error creating daily output for {$date->format('Y-m-d')}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Check if we have enough materials for production
     */
    private function checkMaterialAvailability($bomMaterials, $quantityProduced, $stockLevels)
    {
        foreach ($bomMaterials as $bomMaterial) {
            $material = $bomMaterial->material;
            $requiredQuantity = $bomMaterial->quantity_per_product * $quantityProduced;
            
            if ($stockLevels[$material->material_id] < $requiredQuantity) {
                return false;
            }
        }
        return true;
    }

    /**
     * Calculate maximum production based on available materials
     */
    private function calculateMaxProduction($bomMaterials, $stockLevels)
    {
        $maxProduction = PHP_INT_MAX;
        
        foreach ($bomMaterials as $bomMaterial) {
            $material = $bomMaterial->material;
            if ($bomMaterial->quantity_per_product > 0) {
                $availableForThisMaterial = floor($stockLevels[$material->material_id] / $bomMaterial->quantity_per_product);
                $maxProduction = min($maxProduction, $availableForThisMaterial);
            }
        }
        
        return max(0, $maxProduction);
    }

    /**
     * Get base production quantity based on day of week and season (200-400 range)
     */
    private function getBaseProduction($date)
    {
        $dayOfWeek = $date->dayOfWeek;
        $month = $date->month;
        
        // Base production by day of week (200-400 range)
        $baseByDay = [
            1 => 250, // Monday
            2 => 300, // Tuesday
            3 => 350, // Wednesday
            4 => 350, // Thursday
            5 => 300, // Friday
            6 => 200, // Saturday
        ];

        $baseProduction = $baseByDay[$dayOfWeek] ?? 300;

        // Seasonal adjustments
        $seasonalMultiplier = 1.0;
        if ($month >= 11 || $month <= 2) {
            // Winter months - higher production
            $seasonalMultiplier = 1.1;
        } elseif ($month >= 6 && $month <= 8) {
            // Summer months - slightly lower production
            $seasonalMultiplier = 0.95;
        }

        return round($baseProduction * $seasonalMultiplier);
    }

    /**
     * Get production variation for the day
     */
    private function getProductionVariation($date)
    {
        // Random variation between -30 and +30
        return rand(-30, 30);
    }

    /**
     * Get random producer name
     */
    private function getRandomProducer()
    {
        $producers = [
            'Production Team A',
            'Production Team B',
            'Production Team C',
            'John Santos',
            'Maria Garcia',
            'Production Supervisor',
            'Quality Control Team',
            'Senior Production Lead',
            'Production Manager',
        ];

        return $producers[array_rand($producers)];
    }

    /**
     * Add finished goods to normalized inventory
     */
    private function addFinishedGoodsToNormalizedInventory($quantityProduced, $date, $alkansyaProduct)
    {
        // Create or update product inventory
        $productInventory = Inventory::where('product_id', $alkansyaProduct->id)->first();
        
        if (!$productInventory) {
            $productInventory = Inventory::create([
                'product_id' => $alkansyaProduct->id,
                'location_id' => 1,
                'current_stock' => 0,
                'quantity_reserved' => 0,
                'last_updated' => $date
            ]);
        }

        // Add produced quantity
        $productInventory->current_stock += $quantityProduced;
        $productInventory->last_updated = $date;
        $productInventory->save();

        // Update product stock
        $alkansyaProduct->stock = $productInventory->current_stock;
        $alkansyaProduct->save();

        $this->log("✅ Added {$quantityProduced} Alkansya finished goods to inventory (Total: {$productInventory->current_stock})");
    }

    /**
     * Sync daily output to ProductionAnalytics for dashboard display
     */
    private function syncToProductionAnalytics($dailyOutput, $alkansyaProduct)
    {
        // Create or update ProductionAnalytics record
        ProductionAnalytics::updateOrCreate(
            [
                'date' => $dailyOutput->date,
                'product_id' => $alkansyaProduct->id,
            ],
            [
                'actual_output' => $dailyOutput->quantity_produced,
                'target_output' => 300, // Target production
                'efficiency_percentage' => round(($dailyOutput->quantity_produced / 300) * 100, 2),
                'total_duration_minutes' => 480, // 8 hours
                'avg_process_duration_minutes' => 60, // 1 hour per batch
            ]
        );

        $this->log("📊 Synced daily output to ProductionAnalytics for {$dailyOutput->date}");
    }

    /**
     * Display final inventory status
     */
    private function displayFinalInventoryStatus($bomMaterials, $stockLevels)
    {
        $this->log("\n📦 Final Raw Materials Stock Levels:");
        foreach ($bomMaterials as $bomMaterial) {
            $material = $bomMaterial->material;
            $stock = $stockLevels[$material->material_id] ?? 0;
            $status = $stock > $material->reorder_level ? '✅' : ($stock > 0 ? '⚠️' : '❌');
            $this->log("   {$status} {$material->material_name}: {$stock} {$material->unit_of_measure}");
        }
    }

    /**
     * Display transaction summary
     */
    private function displayTransactionSummary()
    {
        $this->log("\n📊 Transaction Summary:");
        
        $transactionCounts = InventoryTransaction::select('transaction_type', DB::raw('count(*) as total'))
            ->groupBy('transaction_type')
            ->get();
            
        foreach ($transactionCounts as $count) {
            $this->log("   - {$count->transaction_type}: {$count->total} transactions");
        }
        
        $totalTransactions = InventoryTransaction::count();
        $this->log("\n📈 Total transactions: {$totalTransactions}");
        
        // Recent transactions
        $recentTransactions = InventoryTransaction::with('material')
            ->orderBy('timestamp', 'desc')
            ->limit(5)
            ->get();
            
        $this->log("\n🕒 Recent Transactions:");
        foreach ($recentTransactions as $transaction) {
            $materialName = $transaction->material ? $transaction->material->material_name : 'N/A';
            $this->log("   - {$transaction->transaction_type}: {$transaction->quantity} {$materialName} ({$transaction->reference}) - {$transaction->timestamp->format('Y-m-d H:i:s')}");
        }
    }

    /**
     * Log message helper
     */
    private function log($message)
    {
        if ($this->command) {
            $this->command->info($message);
        } else {
            echo $message . "\n";
        }
    }
}