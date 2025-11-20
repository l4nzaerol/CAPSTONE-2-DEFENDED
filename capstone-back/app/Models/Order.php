<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'tracking_number',
        'total_price',
        'shipping_fee',
        'status',
        'acceptance_status',
        'accepted_by',
        'accepted_at',
        'rejection_reason',
        'admin_notes',
        'checkout_date',
        'payment_method',
        'payment_status',
        'transaction_ref',
        'shipping_address',
        'contact_phone',
        'cancellation_reason',
        'cancelled_at',
        'receipt_confirmed',
        'receipt_confirmed_at',
        'not_received_reason',
        'not_received_at',
    ];

    protected $casts = [
        'accepted_at' => 'datetime',
        'checkout_date' => 'datetime',
        'cancelled_at' => 'datetime',
        'receipt_confirmed_at' => 'datetime',
        'not_received_at' => 'datetime',
    ];

    // An order belongs to a user
    public function user() {
        return $this->belongsTo(User::class);   
    }

    // An order can have multiple order items
    public function items() {
        return $this->hasMany(OrderItem::class);
    }

    // An order can have tracking information
    public function tracking()
    {
        return $this->hasMany(OrderTracking::class);
    }

    // Relationship to admin who accepted the order
    public function acceptedBy()
    {
        return $this->belongsTo(User::class, 'accepted_by');
    }

    // Check if order is accepted
    public function isAccepted()
    {
        return $this->acceptance_status === 'accepted';
    }

    // Check if order is pending acceptance
    public function isPendingAcceptance()
    {
        return $this->acceptance_status === 'pending';
    }

    // Check if order is rejected
    public function isRejected()
    {
        return $this->acceptance_status === 'rejected';
    }

    // An order can have multiple productions
    public function productions()
    {
        return $this->hasMany(Production::class);
    }

    /**
     * Get status message for customer display
     */
    public function getStatusMessage()
    {
        $hasOnlyAlkansya = $this->items->every(function($item) {
            return str_contains(strtolower($item->product->name), 'alkansya');
        });

        if ($hasOnlyAlkansya) {
            switch ($this->status) {
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
            switch ($this->status) {
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