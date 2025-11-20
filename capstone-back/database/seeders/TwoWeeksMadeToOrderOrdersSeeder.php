<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Production;
use App\Models\ProductionProcess;
use App\Models\Product;
use App\Models\User;
use App\Models\BOM;
use App\Models\Material;
use App\Models\Inventory;
use App\Models\InventoryTransaction;
use App\Models\OrderTracking;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TwoWeeksMadeToOrderOrdersSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Creating completed made-to-order orders for the past two weeks...');

        // Get products
        $diningTable = Product::where(function($query) {
            $query->where('name', 'LIKE', '%Dining Table%')
                  ->orWhere('product_name', 'LIKE', '%Dining Table%');
        })->where(function($query) {
            $query->where('category_name', 'Made to Order')
                  ->orWhere('category_name', 'made_to_order');
        })->first();

        $woodenChair = Product::where(function($query) {
            $query->where('name', 'LIKE', '%Wooden Chair%')
                  ->orWhere('product_name', 'LIKE', '%Wooden Chair%')
                  ->orWhere('name', 'LIKE', '%Chair%');
        })->where(function($query) {
            $query->where('category_name', 'Made to Order')
                  ->orWhere('category_name', 'made_to_order');
        })->first();

        if (!$diningTable || !$woodenChair) {
            $this->command->error('Dining Table or Wooden Chair products not found. Please run product seeders first.');
            return;
        }

        // Get users (customers and admin)
        $customers = User::where('role', 'customer')->get();
        $admin = User::where('role', 'admin')->first();

        if ($customers->isEmpty()) {
            $this->command->warn('No customer users found. Creating a test customer...');
            $customers = collect([User::create([
                'name' => 'Test Customer',
                'email' => 'testcustomer@example.com',
                'password' => bcrypt('password'),
                'role' => 'customer'
            ])]);
        }

        if (!$admin) {
            $this->command->warn('No admin user found. Using first user as admin...');
            $admin = User::first();
        }

        // Clean up old completed orders from the past two weeks
        $twoWeeksAgo = Carbon::now()->subDays(14)->startOfDay();
        $today = Carbon::now()->endOfDay();

        $this->command->info('Cleaning up old completed orders from the past two weeks...');
        $oldOrders = Order::where('status', 'completed')
            ->whereBetween('created_at', [$twoWeeksAgo, $today])
            ->get();

        foreach ($oldOrders as $oldOrder) {
            // Delete related records
            OrderItem::where('order_id', $oldOrder->id)->delete();
            Production::where('order_id', $oldOrder->id)->delete();
            OrderTracking::where('order_id', $oldOrder->id)->delete();
            InventoryTransaction::where('order_id', $oldOrder->id)
                ->where('transaction_type', 'ORDER_FULFILLMENT')
                ->delete();
        }
        Order::where('status', 'completed')
            ->whereBetween('created_at', [$twoWeeksAgo, $today])
            ->delete();

        $this->command->info('Old completed orders cleaned up.');

        // Generate orders for the past 14 days
        $ordersCreated = 0;
        $totalRevenue = 0;

        for ($day = 0; $day < 14; $day++) {
            $orderDate = Carbon::now()->subDays(13 - $day); // Start from 13 days ago to today

            // Random number of orders per day (0-1 orders, fewer due to build time)
            $ordersPerDay = rand(0, 1);

            for ($orderNum = 0; $orderNum < $ordersPerDay; $orderNum++) {
                try {
                    DB::beginTransaction();

                    $customer = $customers->random();
                    $orderTime = $orderDate->copy()->addHours(rand(8, 18))->addMinutes(rand(0, 59));

                    // Create order
                    $order = Order::create([
                        'user_id' => $customer->id,
                        'tracking_number' => 'MTO-' . strtoupper(uniqid()),
                        'total_price' => 0, // Will be calculated
                        'status' => 'completed', // Order is completed
                        'acceptance_status' => 'accepted',
                        'accepted_by' => $admin->id,
                        'accepted_at' => $orderTime->copy()->addHours(rand(1, 3)),
                        'checkout_date' => $orderTime,
                        'payment_method' => 'cod', // COD only
                        'payment_status' => 'paid',
                        'transaction_ref' => 'TXN-' . strtoupper(uniqid()),
                        'shipping_address' => 'Sample Address ' . rand(1, 100),
                        'contact_phone' => '09' . rand(100000000, 999999999),
                        'created_at' => $orderTime,
                        'updated_at' => $orderTime, // Will be updated when production completes
                    ]);

                    $orderTotal = 0;
                    $orderItems = [];

                    // Add products to order (with quantity limits)
                    $hasDiningTable = rand(0, 1) === 1; // 50% chance
                    $hasWoodenChair = rand(0, 1) === 1; // 50% chance

                    // Ensure at least one product
                    if (!$hasDiningTable && !$hasWoodenChair) {
                        $hasWoodenChair = true;
                    }

                    // Add Dining Table (quantity = 1)
                    if ($hasDiningTable) {
                        $diningTablePrice = $diningTable->price ?? 12500;
                        OrderItem::create([
                            'order_id' => $order->id,
                            'product_id' => $diningTable->id,
                            'quantity' => 1, // Fixed to 1
                            'price' => $diningTablePrice,
                        ]);
                        $orderTotal += $diningTablePrice * 1;
                        $orderItems[] = ['product' => $diningTable, 'quantity' => 1];
                    }

                    // Add Wooden Chair (quantity 1-4)
                    if ($hasWoodenChair) {
                        $chairQuantity = rand(1, 4); // Max 4
                        $woodenChairPrice = $woodenChair->price ?? 7500;
                        OrderItem::create([
                            'order_id' => $order->id,
                            'product_id' => $woodenChair->id,
                            'quantity' => $chairQuantity,
                            'price' => $woodenChairPrice,
                        ]);
                        $orderTotal += $woodenChairPrice * $chairQuantity;
                        $orderItems[] = ['product' => $woodenChair, 'quantity' => $chairQuantity];
                    }

                    // Update order total
                    $order->total_price = $orderTotal;
                    $order->save();

                    $totalRevenue += $orderTotal;

                    // Track latest completion date for order update
                    $latestCompletionDate = $orderTime;
                    
                    // Create production records for each product
                    foreach ($orderItems as $item) {
                        $product = $item['product'];
                        $quantity = $item['quantity'];

                        // Determine build time and product type based on product
                        $productName = strtolower($product->name ?? $product->product_name ?? '');
                        $isDiningTable = str_contains($productName, 'dining table') || str_contains($productName, 'table');
                        $isWoodenChair = str_contains($productName, 'wooden chair') || str_contains($productName, 'chair');
                        
                        // Set product_type based on product name for accurate tracking
                        $productType = 'custom';
                        if ($isDiningTable) {
                            $productType = 'table';
                        } elseif ($isWoodenChair) {
                            $productType = 'chair';
                        }
                        
                        // Build times: Dining Table = 14 days, Wooden Chair = 7 days
                        $buildDays = $isDiningTable ? 14 : ($isWoodenChair ? 7 : 7);
                        
                        $productionStartDate = $orderTime->copy()->addDays(1); // Start 1 day after order
                        $productionCompletionDate = $orderTime->copy()->addDays($buildDays); // Complete after build time
                        
                        // Track the latest completion date
                        if ($productionCompletionDate->gt($latestCompletionDate)) {
                            $latestCompletionDate = $productionCompletionDate;
                        }

                        $production = Production::create([
                            'order_id' => $order->id,
                            'user_id' => $admin->id,
                            'product_id' => $product->id,
                            'product_name' => $product->name ?? $product->product_name,
                            'date' => $productionStartDate->format('Y-m-d'),
                            'current_stage' => 'Completed',
                            'status' => 'Completed',
                            'quantity' => $quantity,
                            'production_started_at' => $productionStartDate,
                            'estimated_completion_date' => $productionCompletionDate,
                            'actual_completion_date' => $productionCompletionDate,
                            'overall_progress' => 100.00,
                            'product_type' => $productType, // Set to 'table', 'chair', or 'custom' based on product
                            'requires_tracking' => true,
                            'created_at' => $productionStartDate,
                            'updated_at' => $productionCompletionDate,
                        ]);

                        // Create ProductionProcess records for staff performance tracking
                        $defaultStages = [
                            'Material Preparation',
                            'Cutting & Shaping',
                            'Assembly',
                            'Sanding & Surface Preparation',
                            'Finishing',
                            'Quality Check & Packaging'
                        ];
                        
                        // Get some staff members (or use admin name if no staff)
                        $staffMembers = User::where('role', 'admin')
                            ->orWhere('role', 'staff')
                            ->get();
                        
                        if ($staffMembers->isEmpty()) {
                            $staffMembers = collect([$admin]);
                        }
                        
                        // Distribute processes across staff members
                        $processOrder = 0;
                        foreach ($defaultStages as $stageName) {
                            $processOrder++;
                            $assignedStaff = $staffMembers->random();
                            $processStartDate = $productionStartDate->copy()->addDays($processOrder - 1);
                            $processEndDate = $processStartDate->copy()->addHours(rand(4, 8));
                            
                            // Ensure process doesn't end after production completion
                            if ($processEndDate->gt($productionCompletionDate)) {
                                $processEndDate = $productionCompletionDate->copy();
                            }
                            
                            ProductionProcess::create([
                                'production_id' => $production->id,
                                'process_name' => $stageName,
                                'process_order' => $processOrder,
                                'status' => 'completed',
                                'started_at' => $processStartDate,
                                'completed_at' => $processEndDate,
                                'actual_completion_date' => $processEndDate,
                                'duration_minutes' => $processStartDate->diffInMinutes($processEndDate),
                                'estimated_duration_minutes' => rand(240, 480), // 4-8 hours
                                'completed_by_name' => $assignedStaff->name,
                                'assigned_worker' => $assignedStaff->name,
                                'is_delayed' => false,
                                'created_at' => $processStartDate,
                                'updated_at' => $processEndDate,
                            ]);
                        }

                        // Record material consumption for this production
                        $this->recordMaterialConsumption($order->id, $product->id, $quantity, $productionStartDate, $admin->id);
                    }

                    // Update order with latest completion date
                    $order->updated_at = $latestCompletionDate;
                    $order->save();
                    
                    // Create order tracking
                    foreach ($orderItems as $item) {
                        $product = $item['product'];
                        
                        // Determine completion date for this specific product
                        $productName = strtolower($product->name ?? $product->product_name ?? '');
                        $isDiningTable = str_contains($productName, 'dining table');
                        $isWoodenChair = str_contains($productName, 'wooden chair') || str_contains($productName, 'chair');
                        $buildDays = $isDiningTable ? 14 : ($isWoodenChair ? 7 : 7);
                        $productCompletionDate = $orderTime->copy()->addDays($buildDays);
                        
                        OrderTracking::create([
                            'order_id' => $order->id,
                            'product_id' => $product->id,
                            'tracking_type' => 'custom',
                            'current_stage' => 'Completed',
                            'status' => 'completed',
                            'estimated_start_date' => $orderTime,
                            'estimated_completion_date' => $productCompletionDate,
                            'actual_start_date' => $orderTime,
                            'actual_completion_date' => $productCompletionDate,
                            'progress_percentage' => 100,
                            'created_at' => $orderTime,
                            'updated_at' => $productCompletionDate,
                        ]);
                    }

                    DB::commit();
                    $ordersCreated++;

                } catch (\Exception $e) {
                    DB::rollBack();
                    $this->command->error("Error creating order: " . $e->getMessage());
                    Log::error("Error in TwoWeeksMadeToOrderOrdersSeeder: " . $e->getMessage());
                }
            }
        }

        // Sync all material current_stock
        Material::syncAllCurrentStock();

        $this->command->info("==========================================");
        $this->command->info("Completed Made-to-Order Orders Seeder Summary:");
        $this->command->info("Orders Created: {$ordersCreated}");
        $this->command->info("Total Revenue: ₱" . number_format($totalRevenue, 2));
        $this->command->info("==========================================");
    }

    /**
     * Record material consumption for an order
     */
    private function recordMaterialConsumption($orderId, $productId, $quantity, $timestamp, $userId)
    {
        try {
            // Get BOM materials for this product
            $bomMaterials = BOM::where('product_id', $productId)
                ->with('material')
                ->get();

            if ($bomMaterials->isEmpty()) {
                $this->command->warn("No BOM found for product ID {$productId}");
                return;
            }

            $product = Product::find($productId);
            if (!$product) {
                return;
            }

            foreach ($bomMaterials as $bomItem) {
                $material = $bomItem->material;
                if (!$material) {
                    continue;
                }

                $qtyPerUnit = $bomItem->quantity_per_product ?? $bomItem->qty_per_unit ?? 0;
                $requiredQty = $qtyPerUnit * $quantity;

                if ($requiredQty <= 0) {
                    continue;
                }

                // Get or create inventory record for this material
                $inventory = Inventory::firstOrCreate(
                    [
                        'material_id' => $material->material_id,
                        'location_id' => 1, // Default location
                    ],
                    [
                        'current_stock' => 0,
                        'quantity_reserved' => 0,
                        'last_updated' => now(),
                    ]
                );

                // Deduct from inventory
                if ($inventory->current_stock >= $requiredQty) {
                    $inventory->decrement('current_stock', $requiredQty);
                } else {
                    // If insufficient stock, set to 0 (for seeder purposes)
                    $inventory->current_stock = max(0, $inventory->current_stock - $requiredQty);
                    $inventory->save();
                }

                // Create inventory transaction
                InventoryTransaction::create([
                    'material_id' => $material->material_id,
                    'product_id' => $productId,
                    'order_id' => $orderId,
                    'user_id' => $userId,
                    'transaction_type' => 'ORDER_FULFILLMENT',
                    'quantity' => -$requiredQty, // Negative for consumption
                    'unit_cost' => $material->standard_cost ?? 0,
                    'total_cost' => ($material->standard_cost ?? 0) * $requiredQty,
                    'reference' => 'Order #' . $orderId,
                    'timestamp' => $timestamp,
                    'remarks' => "Material consumption for order fulfillment - {$product->name} (Qty: {$quantity})",
                    'status' => 'completed',
                    'priority' => 'normal',
                    'metadata' => [
                        'product_name' => $product->name ?? $product->product_name,
                        'product_id' => $productId,
                        'order_quantity' => $quantity,
                        'material_consumed' => $requiredQty,
                        'material_name' => $material->material_name,
                        'material_code' => $material->material_code,
                        'unit_cost' => $material->standard_cost ?? 0,
                        'total_cost' => ($material->standard_cost ?? 0) * $requiredQty,
                    ],
                    'source_data' => [
                        'order_id' => $orderId,
                        'product_id' => $productId,
                        'material_id' => $material->material_id,
                        'bom_ratio' => $qtyPerUnit,
                    ],
                ]);
            }

            // Sync material current_stock
            $material->syncCurrentStock();

        } catch (\Exception $e) {
            $this->command->error("Error recording material consumption: " . $e->getMessage());
            Log::error("Error recording material consumption for order {$orderId}: " . $e->getMessage());
        }
    }
}

