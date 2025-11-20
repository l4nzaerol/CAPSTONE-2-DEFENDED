<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Material;

class SyncMaterialsStock extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'materials:sync-stock';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync materials table current_stock field with inventory table';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔄 Syncing materials stock with inventory table...');
        
        $materials = Material::with('inventory')->get();
        $synced = 0;
        $errors = 0;
        
        foreach ($materials as $material) {
            try {
                $oldStock = $material->current_stock;
                $newStock = $material->syncCurrentStock();
                
                if ($oldStock != $newStock) {
                    $this->line("✅ {$material->material_name}: {$oldStock} → {$newStock}");
                    $synced++;
                } else {
                    $this->line("ℹ️  {$material->material_name}: {$newStock} (no change)");
                }
            } catch (\Exception $e) {
                $this->error("❌ {$material->material_name}: {$e->getMessage()}");
                $errors++;
            }
        }
        
        $this->info("\n📊 Sync completed:");
        $this->info("   ✅ Synced: {$synced} materials");
        $this->info("   ❌ Errors: {$errors} materials");
        $this->info("   📦 Total: {$materials->count()} materials");
    }
}
