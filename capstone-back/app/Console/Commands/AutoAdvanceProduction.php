<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Production;
use App\Models\ProductionProcess;
use App\Events\ProductionUpdated;
use Carbon\Carbon;

class AutoAdvanceProduction extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'production:auto-advance';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Automatically advance production process progress based on elapsed time and configured durations';

    public function handle()
    {
        // Only consider in-progress productions with processes
        $productions = Production::where('status', 'In Progress')
            ->with('processes')
            ->get();

        $advancedCount = 0;

        foreach ($productions as $production) {
            // Skip items on hold
            if (strtolower($production->status) === 'hold') {
                continue;
            }

            // Determine the current active process (first in_progress, else next pending)
            $current = $production->processes
                ->sortBy('process_order')
                ->firstWhere('status', 'in_progress');

            if (!$current) {
                $current = $production->processes
                    ->sortBy('process_order')
                    ->firstWhere('status', 'pending');
            }

            if (!$current) {
                // All processes may be completed
                continue;
            }

            // If not started, start it now
            if (!$current->started_at) {
                $current->started_at = Carbon::now();
                $current->status = $current->status === 'pending' ? 'in_progress' : $current->status;
            }

            // Compute expected completion based on estimated_duration_minutes
            $estimatedMinutes = (int) ($current->estimated_duration_minutes ?? 0);
            if ($estimatedMinutes <= 0) {
                $estimatedMinutes = 60; // fallback 1 hour
            }

            $elapsedMinutes = $current->started_at ? $current->started_at->diffInMinutes(Carbon::now()) : 0;
            $progress = min(100, max(0, ($elapsedMinutes / $estimatedMinutes) * 100));

            // Mark complete if elapsed >= estimated
            if ($elapsedMinutes >= $estimatedMinutes) {
                $current->status = 'completed';
                $current->completed_at = Carbon::now();

                // Start the next process automatically
                $next = ProductionProcess::where('production_id', $production->id)
                    ->where('process_order', $current->process_order + 1)
                    ->first();

                if ($next && $next->status === 'pending') {
                    $next->status = 'in_progress';
                    $next->started_at = Carbon::now();
                    $next->save();
                } else {
                    // If no next, mark production completed
                    $production->status = 'Completed';
                    $production->actual_completion_date = Carbon::now();
                }
            }

            // Update production current stage label
            $active = ProductionProcess::where('production_id', $production->id)
                ->whereIn('status', ['in_progress', 'pending'])
                ->orderBy('process_order')
                ->first();
            $stageName = $active?->process_name ?? $current->process_name;

            $production->stage = $stageName;
            $production->current_stage = $stageName;

            // Save models
            $current->save();
            $production->save();

            // Broadcast update to UI
            broadcast(new ProductionUpdated($production->fresh(['processes'])))->toOthers();

            $advancedCount++;
        }

        $this->info("Auto-advanced {$advancedCount} productions.");
        return self::SUCCESS;
    }
}




