<?php

namespace App\Observers;

use App\Models\Product;
use App\Models\Wishlist;
use App\Models\Notification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class ProductObserver
{
    /**
     * Handle the Product "updated" event.
     */
    public function updated(Product $product)
    {
        try {
            // Check if wishlist table exists (in case migrations haven't run)
            if (!Schema::hasTable('wishlists')) {
                return;
            }

            // Check if stock or availability changed
            if ($product->wasChanged('stock') || $product->wasChanged('is_available_for_order')) {
                // Check wishlist and notify users for this specific product
                // Run this asynchronously to avoid blocking the update
                $this->checkAndNotifyForProduct($product);
            }
        } catch (\Exception $e) {
            // Log the error but don't break the product update
            Log::error('ProductObserver error: ' . $e->getMessage(), [
                'product_id' => $product->id,
                'trace' => $e->getTraceAsString()
            ]);
        }
    }

    /**
     * Check wishlist items for a specific product and notify users
     */
    private function checkAndNotifyForProduct(Product $product)
    {
        try {
            // Get all wishlist items for this product that haven't been notified yet
            $wishlistItems = Wishlist::where('product_id', $product->id)
                ->notNotified()
                ->with('user')
                ->get();

            if ($wishlistItems->isEmpty()) {
                return;
            }

            $categoryName = $product->category_name ?? '';
            $productName = $product->product_name ?? $product->name ?? 'Product';
            $isAlkansya = str_contains(strtolower($productName), 'alkansya') 
                          || $categoryName === 'stocked products';
            $isMadeToOrder = $categoryName === 'Made to Order' || $categoryName === 'made_to_order';

            $isNowAvailable = false;

            // Check if Alkansya product now has stock
            if ($isAlkansya && $product->stock > 0) {
                $isNowAvailable = true;
            }
            // Check if Made-to-Order product is now available
            elseif ($isMadeToOrder && $product->is_available_for_order === true) {
                $isNowAvailable = true;
            }

            if ($isNowAvailable) {
                foreach ($wishlistItems as $wishlistItem) {
                    // Skip if user doesn't exist
                    if (!$wishlistItem->user) {
                        continue;
                    }

                    try {
                        // Create notification
                        Notification::create([
                            'user_id' => $wishlistItem->user_id,
                            'type' => 'wishlist_product_available',
                            'title' => 'Product Available!',
                            'message' => "Great news! '{$productName}' is now available. Add it to your cart now!",
                            'is_read' => false,
                        ]);

                        // Mark wishlist item as notified
                        $wishlistItem->update([
                            'notified' => true,
                            'notified_at' => now(),
                        ]);
                    } catch (\Exception $e) {
                        // Log error for individual wishlist item but continue with others
                        Log::error('Failed to notify wishlist user: ' . $e->getMessage(), [
                            'wishlist_id' => $wishlistItem->id,
                            'user_id' => $wishlistItem->user_id,
                            'product_id' => $product->id
                        ]);
                    }
                }
            }
        } catch (\Exception $e) {
            // Log the error but don't break the product update
            Log::error('checkAndNotifyForProduct error: ' . $e->getMessage(), [
                'product_id' => $product->id,
                'trace' => $e->getTraceAsString()
            ]);
        }
    }
}

