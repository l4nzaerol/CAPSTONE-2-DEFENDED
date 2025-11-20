<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrderTracking extends Model
{
    use HasFactory;

    protected $table = 'order_tracking';

    protected $fillable = [
        'order_id',
        'product_id',
        'tracking_type',
        'current_stage',
        'status',
        'estimated_start_date',
        'estimated_completion_date',
        'actual_start_date',
        'actual_completion_date',
        'process_timeline',
        'production_updates',
        'customer_notes',
        'internal_notes',
    ];

    protected $casts = [
        'estimated_start_date' => 'datetime',
        'estimated_completion_date' => 'datetime',
        'actual_start_date' => 'datetime',
        'actual_completion_date' => 'datetime',
        'process_timeline' => 'array',
        'production_updates' => 'array',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    // Helper method to get progress percentage based on time elapsed
    public function getProgressPercentageAttribute()
    {
        if ($this->status === 'completed') {
            return 100;
        }

        // Calculate progress based on time elapsed since order was placed
        $orderDate = $this->order->checkout_date;
        $totalDays = $this->getTotalProductionDays();
        $elapsedDays = now()->diffInDays($orderDate);
        
        // Calculate progress percentage based on elapsed time
        $progress = min(100, ($elapsedDays / $totalDays) * 100);
        
        return round($progress, 2);
    }

    // Get total production days based on product type
    private function getTotalProductionDays()
    {
        if ($this->tracking_type === 'alkansya') {
            return 2; // 2 days for alkansya
        } else {
            return 14; // 2 weeks for tables and chairs
        }
    }

    // Update current stage based on actual production data (NOT time-based)
    public function updateCurrentStageBasedOnProgress($progress = null)
    {
        // DO NOT auto-update stage based on time/progress
        // Stage should only update when admin/staff actually completes a process
        // This prevents auto-advancing when dates change
        
        // Only update if there's actual production data
        $production = Production::where('order_id', $this->order_id)
            ->where('product_id', $this->product_id)
            ->first();
        
        if ($production) {
            // Force update the production stage from processes first
            $this->updateProductionStageFromProcesses($production);
            
            // Use the actual current stage from production (set by admin when completing processes)
            $this->current_stage = $production->current_stage;
            $this->status = $production->status === 'Completed' ? 'completed' : 
                           ($production->status === 'In Progress' ? 'in_production' : 'pending');
            
            // Save changes if they're different
            if ($this->isDirty(['current_stage', 'status'])) {
                $this->save();
            }
        }
        // If no production exists, don't change anything - keep current stage as is
    }
    
    /**
     * Update production stage and status based on current processes
     * This is a copy of the method from ProductionController to ensure consistency
     */
    private function updateProductionStageFromProcesses($production)
    {
        $processes = $production->processes()->orderBy('process_order')->get();
        
        if ($processes->isEmpty()) {
            return;
        }

        // Find current in-progress process
        $currentProcess = $processes->firstWhere('status', 'in_progress');
        
        if ($currentProcess) {
            // If there's a process in progress, that's the current stage
            $production->current_stage = $currentProcess->process_name;
            $production->status = 'In Progress';
        } else {
            // Check if all completed
            $completedCount = $processes->where('status', 'completed')->count();
            
            if ($completedCount === $processes->count()) {
                // All processes completed - production is done
                $production->current_stage = 'Completed';
                $production->status = 'Completed';
                $production->overall_progress = 100;
                $production->actual_completion_date = now();
            } else {
                // Find the next process that should be started
                // Look for the first process that's not completed
                $nextProcess = $processes->where('status', '!=', 'completed')->first();
                if ($nextProcess) {
                    $production->current_stage = $nextProcess->process_name;
                    $production->status = 'In Progress';
                } else {
                    // Fallback: find next pending process
                    $nextProcess = $processes->where('status', 'pending')->first();
                    if ($nextProcess) {
                        $production->current_stage = $nextProcess->process_name;
                        $production->status = 'Pending';
                    }
                }
            }
        }

        // Calculate overall progress
        $completedCount = $processes->where('status', 'completed')->count();
        $totalCount = $processes->count();
        $production->overall_progress = ($completedCount / $totalCount) * 100;

        $production->save();
    }
}
