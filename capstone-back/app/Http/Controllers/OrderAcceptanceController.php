<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Production;
use App\Models\OrderTracking;
use App\Models\ProductionProcess;
use App\Models\InventoryItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class OrderAcceptanceController extends Controller
{
    /**
     * Get all pending orders for acceptance
     */
    public function getPendingOrders()
    {
        try {
            \Log::info('getPendingOrders called');
            
            $orders = Order::where('acceptance_status', 'pending')
                ->with(['user', 'items.product'])
                ->orderBy('checkout_date', 'desc')
                ->get()
                ->map(function($order) {
                    return [
                        'id' => $order->id,
                        'order_number' => '#' . str_pad($order->id, 5, '0', STR_PAD_LEFT),
                        'customer_name' => $order->user ? $order->user->name : 'Unknown',
                        'customer_email' => $order->user ? $order->user->email : 'N/A',
                        'customer_phone' => $order->contact_phone ?? 'N/A',
                        'total_price' => (float) $order->total_price,
                        'checkout_date' => $order->checkout_date ? $order->checkout_date->toISOString() : null,
                        'payment_method' => $order->payment_method ?? 'N/A',
                        'payment_status' => $order->payment_status ?? 'pending',
                        'shipping_address' => $order->shipping_address ?? 'N/A',
                        'items' => $order->items->map(function($item) {
                            return [
                                'product_name' => $item->product ? $item->product->name : 'Unknown Product',
                                'quantity' => $item->quantity,
                                'price' => (float) $item->price,
                                'subtotal' => (float) ($item->quantity * $item->price),
                                'requires_production' => $item->product ? !str_contains(strtolower($item->product->name), 'alkansya') : true,
                            ];
                        })->toArray(),
                        'items_count' => $order->items->count(),
                        'requires_production' => $order->items->some(function($item) {
                            return $item->product && !str_contains(strtolower($item->product->name), 'alkansya');
                        }),
                        'days_waiting' => $order->checkout_date ? now()->diffInDays($order->checkout_date) : 0,
                    ];
                });

            \Log::info('Pending orders count: ' . $orders->count());
            
            return response()->json($orders->values());
            
        } catch (\Exception $e) {
            \Log::error('Error in getPendingOrders: ' . $e->getMessage());
            \Log::error($e->getTraceAsString());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get all accepted orders
     */
    public function getAcceptedOrders()
    {
        $orders = Order::where('acceptance_status', 'accepted')
            ->with(['user', 'items.product', 'acceptedBy'])
            ->orderBy('accepted_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json($orders);
    }

    /**
     * Get all rejected orders
     */
    public function getRejectedOrders()
    {
        $orders = Order::where('acceptance_status', 'rejected')
            ->with(['user', 'items.product', 'acceptedBy'])
            ->orderBy('updated_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json($orders);
    }

    /**
     * Accept an order and create production records
     */
    public function acceptOrder(Request $request, $orderId)
    {
        $data = $request->validate([
            'admin_notes' => 'nullable|string|max:1000',
        ]);

        $admin = Auth::user();
        if (!$admin || !in_array($admin->role, ['admin', 'employee'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order = Order::with(['items.product', 'user'])->findOrFail($orderId);

        if ($order->acceptance_status !== 'pending') {
            return response()->json([
                'message' => 'Order has already been ' . $order->acceptance_status
            ], 400);
        }

        DB::beginTransaction();
        try {
            \Log::info("Accepting order #{$orderId}");
            
            // Update order acceptance status
            // All orders (including Alkansya) go to 'processing' when accepted
            // Alkansya orders will be manually updated to 'ready_for_delivery' when ready
            $order->update([
                'acceptance_status' => 'accepted',
                'accepted_by' => $admin->id,
                'accepted_at' => now(),
                'admin_notes' => $data['admin_notes'] ?? null,
                'status' => 'processing', // All orders go to processing when accepted
            ]);
            
            \Log::info("Order #{$orderId} status updated to accepted and processing");

            // Create production records for each item that requires production
            foreach ($order->items as $item) {
                $product = $item->product;
                $isAlkansya = str_contains(strtolower($product->name), 'alkansya');

                \Log::info("Creating production for product: {$product->name}, isAlkansya: " . ($isAlkansya ? 'yes' : 'no'));

                // Deduct materials from inventory when order is accepted
                // For made-to-order products: deduct raw materials when order is accepted (production starts)
                // For stocked products (like Alkansya): finished product stock was deducted during checkout, no raw materials deducted
                $isMadeToOrder = $product->category_name === 'Made to Order' || $product->category_name === 'made_to_order';
                
                if ($isMadeToOrder) {
                    \Log::info("Deducting materials for made-to-order product: {$product->name}");
                    $this->deductMaterialsFromInventory($product, $item->quantity, $order->id);
                } else {
                    \Log::info("Skipping raw material deduction for stocked product: {$product->name} (finished product stock was deducted during checkout, no raw materials needed)");
                }

                // Determine product type and tracking requirements
                // Made-to-order products always require tracking
                $productType = $isAlkansya ? 'alkansya' : 
                    (str_contains(strtolower($product->name ?? $product->product_name ?? ''), 'table') ? 'table' : 
                    (str_contains(strtolower($product->name ?? $product->product_name ?? ''), 'chair') ? 'chair' : 'custom'));
                
                // Made-to-order products always require production tracking
                $requiresTracking = $isMadeToOrder;

                // Create production record
                // IMPORTANT: Production starts at 0% progress when order is accepted
                $production = Production::create([
                    'order_id' => $order->id,
                    'user_id' => $admin->id,
                    'product_id' => $product->id,
                    'product_name' => $product->name ?? $product->product_name,
                    'date' => now()->format('Y-m-d'),
                    'current_stage' => $isAlkansya ? 'Ready for Delivery' : 'Material Preparation',
                    'status' => $isAlkansya ? 'Completed' : 'In Progress',
                    'quantity' => $item->quantity,
                    'priority' => 'medium',
                    'requires_tracking' => $requiresTracking, // Made-to-order products always require tracking
                    'product_type' => $productType,
                    'production_started_at' => now(), // Set to now when order is accepted
                    'estimated_completion_date' => $isAlkansya ? now() : now()->addWeeks(2),
                    'overall_progress' => $isAlkansya ? 100 : 0, // Alkansya is instant, others start at 0%
                ]);

                \Log::info("Production #{$production->id} created successfully with requires_tracking: " . ($requiresTracking ? 'true' : 'false'));

                // Create production processes for made-to-order items (non-alkansya)
                if ($requiresTracking && !$isAlkansya) {
                    \Log::info("Creating 6 production processes for production #{$production->id}");
                    $this->createProductionProcesses($production);
                    \Log::info("Production processes created");
                }

                // Create or update order tracking
                $trackingType = $isAlkansya ? 'alkansya' : 'custom';
                $tracking = OrderTracking::updateOrCreate(
                    [
                        'order_id' => $order->id,
                        'product_id' => $product->id,
                    ],
                    [
                        'tracking_type' => $trackingType,
                        'current_stage' => $isAlkansya ? 'Ready for Delivery' : 'Material Preparation',
                        'status' => $isAlkansya ? 'ready_for_delivery' : 'in_production', // Changed from 'pending' to 'in_production'
                        'estimated_start_date' => now(),
                        'estimated_completion_date' => $isAlkansya ? now() : now()->addWeeks(2),
                        'actual_start_date' => now(), // Production starts now
                        'process_timeline' => $this->generateProcessTimeline($trackingType),
                    ]
                );
            }

            // Update inventory status for made-to-order products
            $this->updateInventoryStatusForOrder($order);

            \Log::info("Committing transaction for order #{$orderId}");
            DB::commit();
            \Log::info("Transaction committed successfully");

            // Send Pusher event for inventory updates (optional)
            try {
                $pusherKey = config('broadcasting.connections.pusher.key');
                $pusherSecret = config('broadcasting.connections.pusher.secret');
                $pusherAppId = config('broadcasting.connections.pusher.app_id');
                
                // Only attempt Pusher if all required config is available
                if ($pusherKey && $pusherSecret && $pusherAppId) {
                    $pusher = new \Pusher\Pusher(
                        $pusherKey,
                        $pusherSecret,
                        $pusherAppId,
                        config('broadcasting.connections.pusher.options')
                    );
                    
                    $pusher->trigger('inventory-channel', 'order-accepted', [
                        'message' => 'Order accepted - inventory status updated',
                        'order_id' => $order->id,
                        'timestamp' => now()->toISOString()
                    ]);
                    
                    \Log::info("Pusher event sent for order acceptance");
                } else {
                    \Log::info("Pusher not configured - skipping real-time notification");
                }
            } catch (\Exception $e) {
                \Log::warning("Failed to send Pusher event: " . $e->getMessage());
            }

            // Count productions created
            $productionCount = Production::where('order_id', $order->id)->count();
            \Log::info("Total productions created for order #{$orderId}: {$productionCount}");

            // Send notification to customer (optional)
            // $order->user->notify(new OrderAcceptedNotification($order));

            return response()->json([
                'message' => 'Order accepted successfully and production records created',
                'order' => $order->load(['items.product', 'acceptedBy']),
                'productions_created' => $productionCount,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Order acceptance failed: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'message' => 'Failed to accept order: ' . $e->getMessage(),
                'error' => $e->getMessage(),
                'trace' => config('app.debug') ? $e->getTraceAsString() : null,
            ], 500);
        }
    }

    /**
     * Reject an order
     */
    public function rejectOrder(Request $request, $orderId)
    {
        $data = $request->validate([
            'rejection_reason' => 'required|string|max:1000',
            'admin_notes' => 'nullable|string|max:1000',
        ]);

        $admin = Auth::user();
        if (!$admin || !in_array($admin->role, ['admin', 'employee'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order = Order::with(['items.product', 'user'])->findOrFail($orderId);

        if ($order->acceptance_status !== 'pending') {
            return response()->json([
                'message' => 'Order has already been ' . $order->acceptance_status
            ], 400);
        }

        $order->update([
            'acceptance_status' => 'rejected',
            'accepted_by' => $admin->id,
            'accepted_at' => now(),
            'rejection_reason' => $data['rejection_reason'],
            'admin_notes' => $data['admin_notes'] ?? null,
        ]);

        // Send notification to customer (optional)
        // $order->user->notify(new OrderRejectedNotification($order));

        return response()->json([
            'message' => 'Order rejected successfully',
            'order' => $order->load(['items.product', 'acceptedBy']),
        ]);
    }

    /**
     * Get order acceptance statistics
     */
    public function getStatistics()
    {
        $stats = [
            'pending' => Order::where('acceptance_status', 'pending')->count(),
            'accepted_today' => Order::where('acceptance_status', 'accepted')
                ->whereDate('accepted_at', today())
                ->count(),
            'accepted_this_week' => Order::where('acceptance_status', 'accepted')
                ->whereBetween('accepted_at', [now()->startOfWeek(), now()->endOfWeek()])
                ->count(),
            'rejected' => Order::where('acceptance_status', 'rejected')->count(),
            'total_orders' => Order::count(),
            'average_acceptance_time' => Order::where('acceptance_status', 'accepted')
                ->whereNotNull('accepted_at')
                ->get()
                ->avg(function($order) {
                    return $order->checkout_date->diffInHours($order->accepted_at);
                }),
        ];

        return response()->json($stats);
    }

    /**
     * Create production processes for a production
     */
    private function createProductionProcesses($production)
    {
        $totalMinutes = 14 * 24 * 60; // 2 weeks in minutes
        $processes = [
            ['name' => 'Material Preparation', 'order' => 1, 'estimated_duration' => (int) round($totalMinutes * 0.10)],
            ['name' => 'Cutting & Shaping', 'order' => 2, 'estimated_duration' => (int) round($totalMinutes * 0.20)],
            ['name' => 'Assembly', 'order' => 3, 'estimated_duration' => (int) round($totalMinutes * 0.30)],
            ['name' => 'Sanding & Surface Preparation', 'order' => 4, 'estimated_duration' => (int) round($totalMinutes * 0.15)],
            ['name' => 'Finishing', 'order' => 5, 'estimated_duration' => (int) round($totalMinutes * 0.20)],
            ['name' => 'Quality Check & Packaging', 'order' => 6, 'estimated_duration' => (int) round($totalMinutes * 0.05)],
        ];

        foreach ($processes as $proc) {
            ProductionProcess::create([
                'production_id' => $production->id,
                'process_name' => $proc['name'],
                'process_order' => $proc['order'],
                'status' => $proc['order'] === 1 ? 'in_progress' : 'pending', // First process starts immediately
                'estimated_duration_minutes' => $proc['estimated_duration'],
                'started_at' => $proc['order'] === 1 ? now() : null, // Set started_at for first process
            ]);
        }
    }

    /**
     * Generate process timeline for tracking
     */
    private function generateProcessTimeline($trackingType)
    {
        if ($trackingType === 'alkansya') {
            return [
                ['stage' => 'Design', 'description' => 'Creating design specifications', 'estimated_duration' => '30 minutes', 'status' => 'pending'],
                ['stage' => 'Preparation', 'description' => 'Preparing materials and tools', 'estimated_duration' => '45 minutes', 'status' => 'pending'],
                ['stage' => 'Cutting', 'description' => 'Cutting wood to specifications', 'estimated_duration' => '60 minutes', 'status' => 'pending'],
                ['stage' => 'Assembly', 'description' => 'Assembling components', 'estimated_duration' => '90 minutes', 'status' => 'pending'],
                ['stage' => 'Finishing', 'description' => 'Applying finish and polish', 'estimated_duration' => '45 minutes', 'status' => 'pending'],
                ['stage' => 'Quality Control', 'description' => 'Final inspection and testing', 'estimated_duration' => '30 minutes', 'status' => 'pending'],
            ];
        } else {
            return [
                ['stage' => 'Material Preparation', 'description' => 'Selecting and preparing high-quality materials', 'estimated_duration' => '1.4 days', 'status' => 'pending'],
                ['stage' => 'Cutting & Shaping', 'description' => 'Precise cutting and shaping of wood components', 'estimated_duration' => '2.8 days', 'status' => 'pending'],
                ['stage' => 'Assembly', 'description' => 'Careful assembly of furniture components', 'estimated_duration' => '4.2 days', 'status' => 'pending'],
                ['stage' => 'Sanding & Surface Preparation', 'description' => 'Sanding and preparing surfaces for finishing', 'estimated_duration' => '2.1 days', 'status' => 'pending'],
                ['stage' => 'Finishing', 'description' => 'Applying professional finish, stain, and polish', 'estimated_duration' => '2.8 days', 'status' => 'pending'],
                ['stage' => 'Quality Check & Packaging', 'description' => 'Final quality inspection and packaging', 'estimated_duration' => '0.7 days', 'status' => 'pending'],
            ];
        }
    }

    /**
     * Deduct materials from inventory when order is accepted
     */
    private function deductMaterialsFromInventory($product, $quantity, $orderId = null)
    {
        // Get BOM (Bill of Materials) for the product using new normalized inventory system
        $bomItems = \App\Models\BOM::where('product_id', $product->id)
            ->with(['material.inventory'])
            ->get();

        if ($bomItems->isEmpty()) {
            \Log::warning("No BOM found for {$product->name}");
            return;
        }

        \Log::info("Deducting materials for {$product->name} (Qty: {$quantity}) using normalized inventory system");

        foreach ($bomItems as $bomItem) {
            $material = $bomItem->material;
            if (!$material) {
                \Log::warning("Material not found for BOM item");
                continue;
            }

            $requiredQty = $bomItem->quantity_per_product * $quantity;
            
            // Get total available stock across all inventory locations
            $totalAvailableStock = $material->inventory->sum('current_stock');
            
            // Check if sufficient stock
            if ($totalAvailableStock < $requiredQty) {
                \Log::warning("Insufficient stock for {$material->material_name}. Required: {$requiredQty}, Available: {$totalAvailableStock}");
                throw new \Exception("Insufficient stock for {$material->material_name}. Required: {$requiredQty}, Available: {$totalAvailableStock}");
            }

            // Deduct from inventory (distribute across locations)
            $remainingToDeduct = $requiredQty;
            foreach ($material->inventory as $inventoryRecord) {
                if ($remainingToDeduct <= 0) break;
                
                $deductFromThisLocation = min($remainingToDeduct, $inventoryRecord->current_stock);
                if ($deductFromThisLocation > 0) {
                    $inventoryRecord->decrement('current_stock', $deductFromThisLocation);
                    $remainingToDeduct -= $deductFromThisLocation;
                    
                    \Log::info("Deducted {$deductFromThisLocation} from location {$inventoryRecord->location_id} for {$material->material_name}");
                }
            }
            
            // Refresh the material relationship to get updated inventory levels
            $material->load('inventory');
            
            // Sync the material's current_stock field
            $material->syncCurrentStock();

            // Create inventory transaction
            \App\Models\InventoryTransaction::create([
                'material_id' => $material->material_id,
                'product_id' => $product->id,
                'order_id' => $orderId,
                'user_id' => auth()->id(),
                'transaction_type' => 'ORDER_ACCEPTANCE',
                'quantity' => -$requiredQty, // Negative for consumption
                'unit_cost' => $material->standard_cost,
                'total_cost' => $material->standard_cost * $requiredQty,
                'reference' => 'ORDER_ACCEPTANCE',
                'timestamp' => now(),
                'remarks' => "Material consumption for order acceptance - {$product->name} (Qty: {$quantity})",
                'status' => 'completed',
                'priority' => 'normal',
                'metadata' => [
                    'product_name' => $product->name,
                    'product_id' => $product->id,
                    'order_quantity' => $quantity,
                    'material_consumed' => $requiredQty,
                    'material_name' => $material->material_name,
                    'material_code' => $material->material_code,
                    'unit_cost' => $material->standard_cost,
                    'total_cost' => $material->standard_cost * $requiredQty,
                ],
                'source_data' => [
                    'order_id' => $orderId,
                    'product_id' => $product->id,
                    'material_id' => $material->material_id,
                    'bom_ratio' => $bomItem->quantity_per_product,
                ],
                'cost_breakdown' => [
                    'material_cost' => $material->standard_cost * $requiredQty,
                    'unit_cost' => $material->standard_cost,
                    'quantity_used' => $requiredQty,
                ]
            ]);

            \Log::info("Deducted {$requiredQty} {$material->unit_of_measure} of {$material->material_name} (Remaining: {$material->fresh()->inventory->sum('current_stock')})");
        }
    }

    /**
     * Update inventory status for made-to-order products when orders are accepted
     */
    private function updateInventoryStatusForOrder($order)
    {
        foreach ($order->items as $item) {
            $product = $item->product;
            
            // Check if this is a made-to-order product
            $isMadeToOrder = str_contains(strtolower($product->name), 'table') || 
                           str_contains(strtolower($product->name), 'chair') ||
                           str_contains(strtolower($product->name), 'dining');
            
            if ($isMadeToOrder) {
                \Log::info("Processing made-to-order product: {$product->name}");
                
                // Find the corresponding inventory item using more specific matching
                $inventoryItem = null;
                
                // Try exact product name matching first
                $inventoryItem = InventoryItem::where('category', 'made-to-order')
                    ->where('name', 'like', '%' . $product->name . '%')
                    ->first();
                
                // If not found, try more specific matching based on product type
                if (!$inventoryItem) {
                    if (str_contains(strtolower($product->name), 'table')) {
                        $inventoryItem = InventoryItem::where('category', 'made-to-order')
                            ->where('name', 'like', '%Dining Table%')
                            ->first();
                    } elseif (str_contains(strtolower($product->name), 'chair')) {
                        $inventoryItem = InventoryItem::where('category', 'made-to-order')
                            ->where('name', 'like', '%Wooden Chair%')
                            ->first();
                    }
                }
                
                if ($inventoryItem) {
                    \Log::info("Found inventory item: {$inventoryItem->name} for product: {$product->name}");
                    
                    try {
                        // Calculate total production count for this specific product
                        $totalProductionCount = DB::table('orders')
                            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
                            ->join('products', 'order_items.product_id', '=', 'products.id')
                            ->whereIn('orders.status', ['processing', 'in_production'])
                            ->where('products.id', $product->id) // Use product ID for exact matching
                            ->sum('order_items.quantity');
                        
                        \Log::info("Total production count for {$product->name}: {$totalProductionCount}");
                        
                        // Update inventory status - use direct assignment to ensure save
                        $inventoryItem->status = 'in_production';
                        $inventoryItem->production_status = 'in_production';
                        $inventoryItem->production_count = $totalProductionCount;
                        $inventoryItem->save();
                        
                        \Log::info("Updated inventory status for {$inventoryItem->name}: in_production, count: {$totalProductionCount}");
                    } catch (\Exception $e) {
                        \Log::error("Failed to update inventory status for {$inventoryItem->name}: " . $e->getMessage());
                        // Don't throw - this is just inventory tracking
                    }
                } else {
                    \Log::warning("No inventory item found for made-to-order product: {$product->name}");
                }
            }
        }
    }
}
