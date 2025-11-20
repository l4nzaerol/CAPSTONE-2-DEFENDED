<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\AlkansyaDailyOutput;
use App\Models\InventoryItem;
use App\Models\InventoryUsage;
use App\Models\ProductMaterial;
use Carbon\Carbon;

class VerifyInventoryData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inventory:verify-data';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Verify inventory reports have accurate data based on Alkansya production';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔧 Ensuring Inventory Reports Have Accurate Data');
        $this->info('===============================================');
        $this->newLine();

        // Check Alkansya production data
        $this->info('1. Checking Alkansya Daily Output Data...');
        $alkansyaCount = AlkansyaDailyOutput::count();
        $alkansyaTotal = AlkansyaDailyOutput::sum('quantity_produced');
        $this->line("   - Total records: {$alkansyaCount}");
        $this->line("   - Total production: {$alkansyaTotal}");

        if ($alkansyaCount == 0) {
            $this->warn('   ⚠️  No Alkansya production data found. Running seeder...');
            $this->call('db:seed', ['--class' => 'AlkansyaFactorySeeder']);
            $this->info('   ✅ Seeder completed');
        }

        // Check inventory items
        $this->newLine();
        $this->info('2. Checking Inventory Items...');
        $inventoryCount = InventoryItem::count();
        $this->line("   - Total inventory items: {$inventoryCount}");

        if ($inventoryCount == 0) {
            $this->warn('   ⚠️  No inventory items found. Running seeder...');
            $this->call('db:seed', ['--class' => 'EnhancedInventorySeeder']);
            $this->info('   ✅ Seeder completed');
        }

        // Check inventory usage data
        $this->newLine();
        $this->info('3. Checking Inventory Usage Data...');
        $usageCount = InventoryUsage::count();
        $usageTotal = InventoryUsage::sum('qty_used');
        $this->line("   - Total usage records: {$usageCount}");
        $this->line("   - Total usage quantity: {$usageTotal}");

        // Check BOM data
        $this->newLine();
        $this->info('4. Checking BOM (Bill of Materials) Data...');
        $bomCount = ProductMaterial::count();
        $this->line("   - Total BOM records: {$bomCount}");

        // Get recent statistics
        $this->newLine();
        $this->info('5. Recent Statistics (Last 7 Days):');
        $last7Days = AlkansyaDailyOutput::where('date', '>=', Carbon::now()->subDays(7))
            ->sum('quantity_produced');
        $this->line("   - Alkansya production (last 7 days): {$last7Days}");

        $recentUsage = InventoryUsage::where('date', '>=', Carbon::now()->subDays(7))
            ->sum('qty_used');
        $this->line("   - Material usage (last 7 days): {$recentUsage}");

        $this->newLine();
        $this->info('🏁 Data verification completed!');
        $this->info('If all data is present, the inventory reports should display accurate information.');
    }
}
