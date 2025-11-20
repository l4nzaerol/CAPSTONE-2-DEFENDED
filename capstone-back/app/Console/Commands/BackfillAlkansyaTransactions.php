<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\AlkansyaDailyOutput;
use App\Models\Product;
use App\Models\BOM;
use App\Models\InventoryTransaction;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BackfillAlkansyaTransactions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'alkansya:backfill-transactions {--date-from=} {--date-to=}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Backfill missing inventory transactions for Alkansya daily outputs';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting Alkansya transaction backfill...');

        try {
            DB::beginTransaction();

            // Get date range from options or use all records
            $dateFrom = $this->option('date-from');
            $dateTo = $this->option('date-to');

            $query = AlkansyaDailyOutput::orderBy('date', 'desc');
            
            if ($dateFrom) {
                $query->where('date', '>=', $dateFrom);
            }
            
            if ($dateTo) {
                $query->where('date', '<=', $dateTo);
            }

            $dailyOutputs = $query->get();
            
            $this->info("Found {$dailyOutputs->count()} daily output records to process");

            $createdCount = 0;
            $skippedCount = 0;
            $errors = [];

            // Get Alkansya products and BOM (same for all)
            $alkansyaProducts = Product::where('category_name', 'Stocked Products')
                ->where(function($query) {
                    $query->where('name', 'LIKE', '%Alkansya%')
                          ->orWhere('product_name', 'LIKE', '%Alkansya%');
                })
                ->get();

            if ($alkansyaProducts->isEmpty()) {
                $this->error('No Alkansya products found. Please run product seeders first.');
                DB::rollBack();
                return 1;
            }

            $alkansyaProduct = $alkansyaProducts->first();
            $bomMaterials = BOM::where('product_id', $alkansyaProduct->id)
                ->with('material')
                ->get();

            if ($bomMaterials->isEmpty()) {
                $this->error('No BOM materials found for Alkansya. Please run BOM seeders first.');
                DB::rollBack();
                return 1;
            }

            $this->info("Processing daily outputs...");
            $progressBar = $this->output->createProgressBar($dailyOutputs->count());
            $progressBar->start();

            foreach ($dailyOutputs as $dailyOutput) {
                // Check if transactions already exist for this date
                $existingTransactions = InventoryTransaction::where('transaction_type', 'ALKANSYA_CONSUMPTION')
                    ->where('reference', 'Alkansya Daily Output - ' . $dailyOutput->date)
                    ->count();

                if ($existingTransactions > 0) {
                    $skippedCount++;
                    $progressBar->advance();
                    continue; // Skip if transactions already exist
                }

                $quantity = $dailyOutput->quantity_produced;
                $dateObj = Carbon::parse($dailyOutput->date);

                // Create transactions for each material
                $transactionCreated = false;
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
                                    'backfilled' => true,
                                ],
                            ]);
                            $transactionCreated = true;
                        } catch (\Exception $e) {
                            $errors[] = "Failed to create transaction for {$material->material_name} on {$dailyOutput->date}: " . $e->getMessage();
                        }
                    }
                }

                if ($transactionCreated) {
                    $createdCount++;
                }

                $progressBar->advance();
            }

            $progressBar->finish();
            $this->newLine(2);

            DB::commit();

            $this->info("==========================================");
            $this->info("Transaction backfill completed!");
            $this->info("Created: {$createdCount} sets of transactions");
            $this->info("Skipped: {$skippedCount} (already exist)");
            $this->info("Errors: " . count($errors));
            $this->info("==========================================");

            if (!empty($errors)) {
                $this->warn("Errors encountered:");
                foreach ($errors as $error) {
                    $this->error("  - {$error}");
                }
            }

            return 0;

        } catch (\Exception $e) {
            DB::rollBack();
            $this->error('Transaction backfill failed: ' . $e->getMessage());
            Log::error('Transaction backfill failed: ' . $e->getMessage());
            return 1;
        }
    }
}

