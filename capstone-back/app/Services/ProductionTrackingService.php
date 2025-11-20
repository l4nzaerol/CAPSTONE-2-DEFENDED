<?php

namespace App\Services;

use App\Models\Production;
use App\Models\OrderTracking;
use App\Models\ProductionProcess;
use Carbon\Carbon;

class ProductionTrackingService
{
    /**
     * Sync OrderTracking with Production data for accurate customer-facing progress
     */
    public function syncOrderTrackingWithProduction($orderId)
    {
        $productions = Production::where('order_id', $orderId)
            ->with(['processes', 'stageLogs.productionStage'])
            ->get();

        foreach ($productions as $production) {
            $tracking = OrderTracking::where('order_id', $orderId)
                ->where('product_id', $production->product_id)
                ->first();

            if (!$tracking) {
                // Create tracking if it doesn't exist
                $tracking = $this->createTrackingFromProduction($production);
            }

            // Update tracking with production data
            $this->updateTrackingFromProduction($tracking, $production);
        }
    }

    /**
     * Create OrderTracking from Production
     */
    private function createTrackingFromProduction($production)
    {
        $trackingType = $production->product_type === 'alkansya' ? 'alkansya' : 'custom';
        
        return OrderTracking::create([
            'order_id' => $production->order_id,
            'product_id' => $production->product_id,
            'tracking_type' => $trackingType,
            'current_stage' => $production->current_stage,
            'status' => $this->mapProductionStatusToTrackingStatus($production->status),
            'estimated_start_date' => $production->production_started_at ?? now(),
            'estimated_completion_date' => $production->estimated_completion_date,
            'actual_start_date' => $production->production_started_at,
            'actual_completion_date' => $production->actual_completion_date,
            'process_timeline' => $this->generateTimelineFromProduction($production),
        ]);
    }

    /**
     * Update OrderTracking from Production
     */
    private function updateTrackingFromProduction($tracking, $production)
    {
        $progress = $this->calculateProgressFromProduction($production);
        
        // IMPORTANT: Always sync current_stage from production to tracking
        // This ensures customer tracking matches production dashboard
        $tracking->update([
            'current_stage' => $production->current_stage,
            'status' => $this->mapProductionStatusToTrackingStatus($production->status),
            'actual_start_date' => $production->production_started_at,
            'actual_completion_date' => $production->actual_completion_date,
            'process_timeline' => $this->generateTimelineFromProduction($production),
            'updated_at' => now(), // Force update timestamp
        ]);

        return $tracking;
    }

    /**
     * Calculate progress from Production processes
     */
    public function calculateProgressFromProduction($production)
    {
        if ($production->status === 'Completed') {
            return 100;
        }

        if (!$production->requires_tracking) {
            return $production->status === 'Completed' ? 100 : 0;
        }

        // Use overall_progress if available
        if ($production->overall_progress !== null) {
            return round($production->overall_progress, 2);
        }

        // Calculate from processes
        $processes = $production->processes;
        if ($processes->isEmpty()) {
            return 0;
        }

        $totalProcesses = $processes->count();
        $completedProcesses = $processes->where('status', 'completed')->count();
        $inProgressProcesses = $processes->where('status', 'in_progress')->count();

        // Each completed process = 100%, in_progress = 50%
        $progress = (($completedProcesses * 100) + ($inProgressProcesses * 50)) / $totalProcesses;

        return round($progress, 2);
    }

    /**
     * Generate process timeline from Production
     */
    private function generateTimelineFromProduction($production)
    {
        $processes = $production->processes()->orderBy('process_order')->get();
        
        if ($processes->isEmpty()) {
            // Fallback to stage logs if available
            return $this->generateTimelineFromStageLogs($production);
        }

        return $processes->map(function($process) {
            return [
                'stage' => $process->process_name,
                'description' => $this->getProcessDescription($process->process_name),
                'estimated_duration' => $this->formatDuration($process->estimated_duration_minutes),
                'status' => $process->status,
                'started_at' => $process->started_at?->toISOString(),
                'completed_at' => $process->completed_at?->toISOString(),
                'progress_percentage' => $this->getProcessProgress($process),
            ];
        })->toArray();
    }

    /**
     * Generate timeline from stage logs
     */
    private function generateTimelineFromStageLogs($production)
    {
        $stageLogs = $production->stageLogs()
            ->with('productionStage')
            ->orderBy(function($query) {
                $query->select('order_sequence')
                    ->from('production_stages')
                    ->whereColumn('production_stages.id', 'production_stage_logs.production_stage_id');
            })
            ->get();

        if ($stageLogs->isEmpty()) {
            return [];
        }

        return $stageLogs->map(function($log) {
            return [
                'stage' => $log->productionStage->name,
                'description' => $this->getProcessDescription($log->productionStage->name),
                'estimated_duration' => $this->formatDuration($log->productionStage->duration_hours * 60),
                'status' => $log->status,
                'started_at' => $log->started_at?->toISOString(),
                'completed_at' => $log->completed_at?->toISOString(),
                'progress_percentage' => $log->progress_percentage,
            ];
        })->toArray();
    }

    /**
     * Get process description
     */
    private function getProcessDescription($processName)
    {
        $descriptions = [
            'Material Preparation' => 'Selecting and preparing high-quality materials',
            'Cutting & Shaping' => 'Precise cutting and shaping of wood components',
            'Assembly' => 'Careful assembly of furniture components',
            'Sanding & Surface Preparation' => 'Sanding and preparing surfaces for finishing',
            'Finishing' => 'Applying professional finish, stain, and polish',
            'Quality Check & Packaging' => 'Final quality inspection and packaging',
        ];

        return $descriptions[$processName] ?? 'Processing';
    }

    /**
     * Format duration in minutes to readable format
     */
    private function formatDuration($minutes)
    {
        if ($minutes < 60) {
            return round($minutes) . ' minutes';
        } elseif ($minutes < 1440) {
            return round($minutes / 60, 1) . ' hours';
        } else {
            return round($minutes / 1440, 1) . ' days';
        }
    }

    /**
     * Get process progress percentage
     */
    private function getProcessProgress($process)
    {
        switch ($process->status) {
            case 'completed':
                return 100;
            case 'in_progress':
                // Estimate based on time elapsed
                if ($process->started_at && $process->estimated_duration_minutes) {
                    $elapsed = now()->diffInMinutes($process->started_at);
                    $progress = ($elapsed / $process->estimated_duration_minutes) * 100;
                    return min(95, round($progress, 2)); // Cap at 95% until actually completed
                }
                return 50;
            default:
                return 0;
        }
    }

    /**
     * Map Production status to OrderTracking status
     */
    private function mapProductionStatusToTrackingStatus($productionStatus)
    {
        $map = [
            'Pending' => 'pending',
            'In Progress' => 'in_production',
            'Completed' => 'completed',
            'Hold' => 'pending',
        ];

        return $map[$productionStatus] ?? 'pending';
    }

    /**
     * Calculate predictive ETA based on current progress
     */
    public function calculatePredictiveETA($production)
    {
        if ($production->status === 'Completed') {
            return $production->actual_completion_date;
        }

        $progress = $this->calculateProgressFromProduction($production);
        
        if ($progress == 0) {
            return $production->estimated_completion_date;
        }

        // Calculate based on actual progress rate
        $startDate = $production->production_started_at ?? $production->created_at;
        $elapsedDays = now()->diffInDays($startDate);
        
        if ($elapsedDays > 0 && $progress > 0) {
            $daysPerPercent = $elapsedDays / $progress;
            $remainingProgress = 100 - $progress;
            $estimatedRemainingDays = $daysPerPercent * $remainingProgress;
            
            return now()->addDays(ceil($estimatedRemainingDays));
        }

        return $production->estimated_completion_date;
    }
}
