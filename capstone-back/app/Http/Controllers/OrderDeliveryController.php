<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class OrderDeliveryController extends Controller
{
    /**
     * Mark Alkansya order as ready for delivery
     */
    public function markReadyForDelivery(Request $request, $orderId)
    {
        $admin = Auth::user();
        if (!$admin || $admin->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order = Order::with(['items.product'])->findOrFail($orderId);

        // Check if order contains only Alkansya items
        $hasOnlyAlkansya = $order->items->every(function($item) {
            return str_contains(strtolower($item->product->name), 'alkansya');
        });

        if (!$hasOnlyAlkansya) {
            return response()->json(['message' => 'This endpoint is only for Alkansya orders'], 422);
        }

        if ($order->status !== 'processing') {
            return response()->json(['message' => 'Order is not in processing status'], 422);
        }

        DB::beginTransaction();
        try {
            $order->update([
                'status' => 'ready_for_delivery',
                'updated_at' => now(),
            ]);

            // Update production status if exists
            $production = \App\Models\Production::where('order_id', $order->id)->first();
            if ($production) {
                $production->update([
                    'status' => 'Completed',
                    'current_stage' => 'Ready for Delivery',
                    'actual_completion_date' => now(),
                    'overall_progress' => 100,
                ]);
            }

            // Update order tracking if exists
            $tracking = \App\Models\OrderTracking::where('order_id', $order->id)->first();
            if ($tracking) {
                $tracking->update([
                    'status' => 'ready_for_delivery',
                    'current_stage' => 'Ready for Delivery',
                    'actual_completion_date' => now(),
                ]);
            }

            DB::commit();

            Log::info("Order #{$orderId} (Alkansya) marked as ready for delivery by admin #{$admin->id}");

            return response()->json([
                'message' => 'Alkansya order marked as ready for delivery',
                'order' => $order->fresh(['items.product']),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to mark order #{$orderId} as ready for delivery: " . $e->getMessage());
            return response()->json(['message' => 'Failed to update order status'], 500);
        }
    }

    /**
     * Mark order as delivered
     */
    public function markDelivered(Request $request, $orderId)
    {
        $admin = Auth::user();
        if (!$admin || $admin->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order = Order::findOrFail($orderId);

        if (!in_array($order->status, ['ready_for_delivery', 'processing'])) {
            return response()->json(['message' => 'Order is not ready for delivery'], 422);
        }

        DB::beginTransaction();
        try {
            $order->update([
                'status' => 'delivered',
                'updated_at' => now(),
            ]);

            // Update production status if exists
            $production = \App\Models\Production::where('order_id', $order->id)->first();
            if ($production) {
                $production->update([
                    'status' => 'Completed',
                    'current_stage' => 'Delivered',
                    'actual_completion_date' => now(),
                    'overall_progress' => 100,
                ]);
            }

            // Update order tracking if exists
            $tracking = \App\Models\OrderTracking::where('order_id', $order->id)->first();
            if ($tracking) {
                $tracking->update([
                    'status' => 'delivered',
                    'current_stage' => 'Delivered',
                    'actual_completion_date' => now(),
                ]);
            }

            // Handle inventory for made-to-order products
            $inventoryController = new \App\Http\Controllers\NormalizedInventoryController();
            foreach ($order->items as $item) {
                $product = $item->product;
                if ($product->category_name === 'Made to Order' || $product->category_name === 'made_to_order') {
                    $inventoryController->handleOrderDelivery($order->id, $product->id, $item->quantity);
                }
            }

            DB::commit();

            Log::info("Order #{$orderId} marked as delivered by admin #{$admin->id}");

            return response()->json([
                'message' => 'Order marked as delivered',
                'order' => $order->fresh(['items.product']),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to mark order #{$orderId} as delivered: " . $e->getMessage());
            return response()->json(['message' => 'Failed to update order status'], 500);
        }
    }

    /**
     * Get order status message for customer display
     */
    public function getOrderStatusMessage($order)
    {
        $hasOnlyAlkansya = $order->items->every(function($item) {
            return str_contains(strtolower($item->product->name), 'alkansya');
        });

        if ($hasOnlyAlkansya) {
            switch ($order->status) {
                case 'pending':
                    return 'Your Alkansya order is being reviewed. We\'ll notify you once it\'s accepted.';
                case 'processing':
                    return 'Wait for your Alkansya! We are now processing your order and we\'ll deliver it as soon as possible.';
                case 'ready_for_delivery':
                    return 'Your Alkansya is ready! We\'ll deliver it to you soon.';
                case 'delivered':
                    return 'Your Alkansya has been delivered! Thank you for your order.';
                case 'completed':
                    return 'Order completed successfully!';
                default:
                    return 'Your order is being processed.';
            }
        } else {
            // Custom furniture messages
            switch ($order->status) {
                case 'pending':
                    return 'Your custom furniture order is being reviewed. We\'ll notify you once it\'s accepted.';
                case 'processing':
                    return 'Your custom furniture is being crafted with care. We\'ll update you on the progress.';
                case 'ready_for_delivery':
                    return 'Your custom furniture is ready! We\'ll deliver it to you soon.';
                case 'delivered':
                    return 'Your custom furniture has been delivered! Thank you for your order.';
                case 'completed':
                    return 'Order completed successfully!';
                default:
                    return 'Your order is being processed.';
            }
        }
    }
}
