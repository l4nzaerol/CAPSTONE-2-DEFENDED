<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use App\Models\Product;
use App\Models\Material;
use App\Models\BOM;
use App\Models\Inventory;
use App\Models\InventoryTransaction;

class SetupNormalizedInventory extends Command
{
    protected $signature = 'inventory:setup-normalized';
    protected $description = 'Setup the normalized inventory system with materials, BOM, and transactions';

    public function handle()
    {
        $this->info('🚀 Setting up Normalized Inventory System...');
        $this->newLine();

        try {
            // 1. Create materials table
            $this->createMaterialsTable();
            
            // 2. Modify products table
            $this->modifyProductsTable();
            
            // 3. Create BOM table
            $this->createBOMTable();
            
            // 4. Create inventory table
            $this->createInventoryTable();
            
            // 5. Create inventory_transactions table
            $this->createInventoryTransactionsTable();
            
            // 6. Update existing products
            $this->updateExistingProducts();
            
            // 7. Seed with sample data
            $this->seedSampleData();

            $this->newLine();
            $this->info('🎉 Normalized Inventory System setup completed successfully!');
            $this->info('You can now access the normalized inventory at: /normalized-inventory');
            
        } catch (\Exception $e) {
            $this->error('❌ Error: ' . $e->getMessage());
            return 1;
        }

        return 0;
    }

    private function createMaterialsTable()
    {
        $this->info('📦 Creating materials table...');
        
        if (!Schema::hasTable('materials')) {
            Schema::create('materials', function (Blueprint $table) {
                $table->id('material_id');
                $table->string('material_name');
                $table->string('material_code')->unique();
                $table->text('description')->nullable();
                $table->string('unit_of_measure');
                $table->decimal('reorder_level', 10, 2)->default(0);
                $table->decimal('standard_cost', 10, 2)->default(0);
                $table->decimal('current_stock', 10, 2)->default(0);
                $table->timestamps();
                
                $table->index(['material_code']);
            });
            $this->info('✅ Materials table created');
        } else {
            $this->info('ℹ️  Materials table already exists');
        }
    }

    private function modifyProductsTable()
    {
        $this->info('🔧 Modifying products table...');
        
        if (Schema::hasTable('products')) {
            if (!Schema::hasColumn('products', 'product_code')) {
                Schema::table('products', function (Blueprint $table) {
                    $table->string('product_code')->unique()->after('id');
                    $table->string('product_name')->after('product_code');
                    $table->unsignedBigInteger('category_id')->nullable()->after('description');
                    $table->string('unit_of_measure')->default('pcs')->after('category_id');
                    $table->decimal('standard_cost', 10, 2)->default(0)->after('unit_of_measure');
                    
                    $table->index(['product_code']);
                    $table->index(['category_id']);
                });
                $this->info('✅ Products table updated with new columns');
            } else {
                $this->info('ℹ️  Products table already has new columns');
            }
        }
    }

    private function createBOMTable()
    {
        $this->info('🔗 Creating BOM table...');
        
        if (!Schema::hasTable('bom')) {
            Schema::create('bom', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('product_id');
                $table->unsignedBigInteger('material_id');
                $table->decimal('quantity_per_product', 10, 4);
                $table->string('unit_of_measure');
                $table->timestamps();
                
                $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
                $table->foreign('material_id')->references('material_id')->on('materials')->onDelete('cascade');
                
                $table->unique(['product_id', 'material_id']);
                $table->index(['product_id']);
                $table->index(['material_id']);
            });
            $this->info('✅ BOM table created');
        } else {
            $this->info('ℹ️  BOM table already exists');
        }
    }

    private function createInventoryTable()
    {
        $this->info('📊 Creating inventory table...');
        
        if (!Schema::hasTable('inventory')) {
            Schema::create('inventory', function (Blueprint $table) {
                $table->id('inventory_id');
                $table->unsignedBigInteger('material_id');
                $table->unsignedBigInteger('location_id')->nullable();
                $table->decimal('current_stock', 10, 2)->default(0);
                $table->decimal('quantity_reserved', 10, 2)->default(0);
                $table->timestamp('last_updated')->useCurrent();
                $table->timestamps();
                
                $table->foreign('material_id')->references('material_id')->on('materials')->onDelete('cascade');
                
                $table->index(['material_id', 'location_id']);
                $table->index(['last_updated']);
            });
            $this->info('✅ Inventory table created');
        } else {
            $this->info('ℹ️  Inventory table already exists');
        }
    }

    private function createInventoryTransactionsTable()
    {
        $this->info('📝 Creating inventory_transactions table...');
        
        if (!Schema::hasTable('inventory_transactions')) {
            Schema::create('inventory_transactions', function (Blueprint $table) {
                $table->id('transaction_id');
                $table->unsignedBigInteger('material_id');
                $table->enum('transaction_type', ['PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'RETURN', 'PRODUCTION_OUTPUT', 'DAILY_OUTPUT']);
                $table->decimal('quantity', 10, 2);
                $table->string('reference')->nullable();
                $table->timestamp('timestamp')->useCurrent();
                $table->text('remarks')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
                
                $table->foreign('material_id')->references('material_id')->on('materials')->onDelete('cascade');
                
                $table->index(['material_id', 'transaction_type']);
                $table->index(['timestamp']);
                $table->index(['reference']);
            });
            $this->info('✅ Inventory transactions table created');
        } else {
            $this->info('ℹ️  Inventory transactions table already exists');
        }
    }

    private function updateExistingProducts()
    {
        $this->info('🔄 Updating existing products...');
        
        $products = Product::all();
        foreach ($products as $product) {
            $product->update([
                'product_name' => $product->name,
                'product_code' => $product->product_code ?? 'PROD-' . str_pad($product->id, 3, '0', STR_PAD_LEFT),
                'unit_of_measure' => $product->unit_of_measure ?? 'pcs',
                'standard_cost' => $product->standard_cost ?? 0
            ]);
        }
        $this->info('✅ Products updated with normalized data');
    }

    private function seedSampleData()
    {
        $this->info('🌱 Seeding sample data...');
        
        // Create materials
        $materials = [
            [
                'material_name' => 'Plywood 1/2 inch',
                'material_code' => 'PLY-001',
                'description' => 'High quality plywood for furniture construction',
                'unit_of_measure' => 'sqm',
                'reorder_level' => 50,
                'standard_cost' => 800.00,
                'current_stock' => 100
            ],
            [
                'material_name' => 'Wood Screws 2 inch',
                'material_code' => 'WS-002',
                'description' => 'Stainless steel wood screws',
                'unit_of_measure' => 'pcs',
                'reorder_level' => 500,
                'standard_cost' => 2.50,
                'current_stock' => 1000
            ],
            [
                'material_name' => 'Alkansya Clay',
                'material_code' => 'AC-006',
                'description' => 'Premium clay for Alkansya production',
                'unit_of_measure' => 'kg',
                'reorder_level' => 100,
                'standard_cost' => 25.00,
                'current_stock' => 500
            ],
            [
                'material_name' => 'Alkansya Glaze',
                'material_code' => 'AG-007',
                'description' => 'Traditional glaze for Alkansya',
                'unit_of_measure' => 'L',
                'reorder_level' => 20,
                'standard_cost' => 120.00,
                'current_stock' => 50
            ]
        ];

        foreach ($materials as $materialData) {
            Material::firstOrCreate(
                ['material_code' => $materialData['material_code']],
                $materialData
            );
        }

        // Create inventory records and transactions
        $materials = Material::all();
        foreach ($materials as $material) {
            $inventory = Inventory::firstOrCreate(
                ['material_id' => $material->material_id],
                [
                    'material_id' => $material->material_id,
                    'location_id' => 1,
                    'current_stock' => $material->current_stock,
                    'quantity_reserved' => 0,
                    'last_updated' => now()
                ]
            );

            // Create initial stock transaction
            InventoryTransaction::firstOrCreate(
                [
                    'material_id' => $material->material_id,
                    'transaction_type' => 'PURCHASE',
                    'reference' => 'Initial Stock'
                ],
                [
                    'material_id' => $material->material_id,
                    'transaction_type' => 'PURCHASE',
                    'quantity' => $material->current_stock,
                    'reference' => 'Initial Stock',
                    'remarks' => 'Initial material stock from seeder',
                    'timestamp' => now(),
                    'unit_cost' => $material->standard_cost,
                    'total_cost' => $material->standard_cost * $material->current_stock
                ]
            );
        }

        $this->info('✅ Sample data seeded');
    }
}