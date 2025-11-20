<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryTransaction extends Model
{
    protected $table = 'inventory_transactions';
    protected $primaryKey = 'transaction_id';
    
    protected $fillable = [
        'material_id',
        'product_id',
        'order_id',
        'production_id',
        'user_id',
        'location_id',
        'transaction_type',
        'quantity',
        'unit_cost',
        'total_cost',
        'batch_number',
        'expiry_date',
        'status',
        'priority',
        'reference',
        'timestamp',
        'remarks',
        'metadata',
        'source_data',
        'cost_breakdown',
        'quality_metrics'
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'timestamp' => 'datetime',
        'expiry_date' => 'date',
        'metadata' => 'array',
        'source_data' => 'array',
        'cost_breakdown' => 'array',
        'quality_metrics' => 'array'
    ];

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class, 'material_id', 'material_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id', 'id');
    }

    public function production(): BelongsTo
    {
        return $this->belongsTo(Production::class, 'production_id', 'id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id', 'id');
    }

    // Scope for different transaction types
    public function scopePurchases($query)
    {
        return $query->where('transaction_type', 'PURCHASE');
    }

    public function scopeConsumptions($query)
    {
        return $query->where('transaction_type', 'CONSUMPTION');
    }

    public function scopeAdjustments($query)
    {
        return $query->where('transaction_type', 'ADJUSTMENT');
    }

    public function scopeReturns($query)
    {
        return $query->where('transaction_type', 'RETURN');
    }

    public function scopeProductionOutput($query)
    {
        return $query->where('transaction_type', 'PRODUCTION_OUTPUT');
    }

    public function scopeDailyOutput($query)
    {
        return $query->where('transaction_type', 'DAILY_OUTPUT');
    }

    public function scopeOrderAcceptance($query)
    {
        return $query->where('transaction_type', 'ORDER_ACCEPTANCE');
    }

    public function scopeOrderFulfillment($query)
    {
        return $query->where('transaction_type', 'ORDER_FULFILLMENT');
    }

    public function scopeProductionCompletion($query)
    {
        return $query->where('transaction_type', 'PRODUCTION_COMPLETION');
    }

    public function scopeAlkansyaConsumption($query)
    {
        return $query->where('transaction_type', 'ALKANSYA_CONSUMPTION');
    }

    public function scopeStockTransfer($query)
    {
        return $query->where('transaction_type', 'STOCK_TRANSFER');
    }

    public function scopeDefectReturn($query)
    {
        return $query->where('transaction_type', 'DEFECT_RETURN');
    }

    public function scopeSalesReturn($query)
    {
        return $query->where('transaction_type', 'SALES_RETURN');
    }

    // Status scopes
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeCancelled($query)
    {
        return $query->where('status', 'cancelled');
    }

    public function scopeReversed($query)
    {
        return $query->where('status', 'reversed');
    }

    // Priority scopes
    public function scopeHighPriority($query)
    {
        return $query->whereIn('priority', ['high', 'urgent']);
    }

    public function scopeUrgent($query)
    {
        return $query->where('priority', 'urgent');
    }

    // Date scopes
    public function scopeToday($query)
    {
        return $query->whereDate('timestamp', today());
    }

    public function scopeThisWeek($query)
    {
        return $query->whereBetween('timestamp', [now()->startOfWeek(), now()->endOfWeek()]);
    }

    public function scopeThisMonth($query)
    {
        return $query->whereBetween('timestamp', [now()->startOfMonth(), now()->endOfMonth()]);
    }

    // Cost scopes
    public function scopeWithCosts($query)
    {
        return $query->whereNotNull('total_cost');
    }

    public function scopeAboveCost($query, $amount)
    {
        return $query->where('total_cost', '>', $amount);
    }

    // Batch scopes
    public function scopeByBatch($query, $batchNumber)
    {
        return $query->where('batch_number', $batchNumber);
    }

    public function scopeExpiringSoon($query, $days = 30)
    {
        return $query->whereNotNull('expiry_date')
                    ->where('expiry_date', '<=', now()->addDays($days));
    }
}
