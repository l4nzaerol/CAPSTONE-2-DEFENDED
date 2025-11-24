<?php

namespace App\Http\Controllers;

use App\Models\Wishlist;
use App\Models\Product;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class WishlistController extends Controller
{
    /**
     * Get user's wishlist
     */
    public function index()
    {
        $user = Auth::user();
        
        $wishlist = Wishlist::forUser($user->id)
            ->with('product')
            ->orderBy('created_at', 'desc')
            ->get();
        
        return response()->json([
            'wishlist' => $wishlist
        ]);
    }

    /**
     * Add product to wishlist
     */
    public function store(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id'
        ]);

        $user = Auth::user();
        $product = Product::findOrFail($request->product_id);

        // Check if product is already in wishlist
        $existingWishlist = Wishlist::where('user_id', $user->id)
            ->where('product_id', $request->product_id)
            ->first();

        if ($existingWishlist) {
            return response()->json([
                'message' => 'Product is already in your wishlist',
                'wishlist' => $existingWishlist
            ], 200);
        }

        // Allow all products to be added to wishlist (removed availability restrictions)

        $wishlist = Wishlist::create([
            'user_id' => $user->id,
            'product_id' => $request->product_id,
            'notified' => false,
        ]);

        return response()->json([
            'message' => 'Product added to wishlist successfully',
            'wishlist' => $wishlist->load('product')
        ], 201);
    }

    /**
     * Remove product from wishlist
     */
    public function destroy($id)
    {
        $user = Auth::user();
        
        $wishlist = Wishlist::forUser($user->id)->findOrFail($id);
        $wishlist->delete();

        return response()->json([
            'message' => 'Product removed from wishlist'
        ]);
    }

    /**
     * Check and notify users when products become available
     * This should be called periodically (e.g., via cron job or when product stock/availability changes)
     */
    public function checkAndNotifyAvailableProducts()
    {
        // Get all wishlist items that haven't been notified yet
        $wishlistItems = Wishlist::notNotified()
            ->with(['product', 'user'])
            ->get();

        foreach ($wishlistItems as $wishlistItem) {
            $product = $wishlistItem->product;
            if (!$product) continue;

            $categoryName = $product->category_name ?? '';
            $isAlkansya = str_contains(strtolower($product->product_name ?? $product->name ?? ''), 'alkansya') 
                          || $categoryName === 'stocked products';
            $isMadeToOrder = $categoryName === 'Made to Order' || $categoryName === 'made_to_order';

            $isNowAvailable = false;

            // Check if Alkansya product now has stock
            if ($isAlkansya && $product->stock > 0) {
                $isNowAvailable = true;
            }
            // Check if Made-to-Order product is now available
            elseif ($isMadeToOrder && $product->is_available_for_order !== false) {
                $isNowAvailable = true;
            }

            if ($isNowAvailable) {
                // Create notification
                Notification::create([
                    'user_id' => $wishlistItem->user_id,
                    'type' => 'wishlist_product_available',
                    'title' => 'Product Available!',
                    'message' => "Great news! '{$product->product_name}' is now available. Add it to your cart now!",
                    'is_read' => false,
                ]);

                // Mark wishlist item as notified
                $wishlistItem->update([
                    'notified' => true,
                    'notified_at' => now(),
                ]);
            }
        }

        return response()->json([
            'message' => 'Wishlist availability check completed'
        ]);
    }
}

