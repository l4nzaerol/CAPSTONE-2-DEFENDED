<?php

namespace App\Http\Controllers;

use App\Models\Production;
use App\Models\Order;
use App\Models\ProductionStageLog;
use Illuminate\Http\Request;
use Carbon\Carbon;

class StaffController extends Controller
{
    /**
     * Get staff dashboard statistics
     */
    public function getDashboard()
    {
        $stats = [
            'active_productions' => Production::whereIn('status', ['pending', 'in_progress'])->count(),
            'completed_today' => Production::where('status', 'completed')
                ->whereDate('actual_end_date', Carbon::today())
                ->count(),
            'pending_stages' => ProductionStageLog::where('status', 'pending')->count(),
            'in_progress_stages' => ProductionStageLog::where('status', 'in_progress')->count(),
        ];

        // Get recent productions
        $recentProductions = Production::with(['order', 'product'])
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        // Get today's tasks
        $todayTasks = ProductionStageLog::with(['production.product', 'production.order'])
            ->whereIn('status', ['pending', 'in_progress'])
            ->whereDate('created_at', Carbon::today())
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'stats' => $stats,
            'recent_productions' => $recentProductions,
            'today_tasks' => $todayTasks
        ]);
    }

    /**
     * Update production stage (staff can update progress)
     */
    public function updateProductionStage(Request $request, $stageId)
    {
        $data = $request->validate([
            'status' => 'required|in:pending,in_progress,completed,on_hold',
            'progress_percentage' => 'nullable|numeric|min:0|max:100',
            'notes' => 'nullable|string',
        ]);

        $stage = ProductionStageLog::findOrFail($stageId);
        
        // Add staff user ID to notes
        $data['assigned_worker_id'] = auth()->id();
        
        // Update timestamps based on status
        if ($data['status'] === 'in_progress' && !$stage->actual_start_time) {
            $data['actual_start_time'] = Carbon::now();
        } elseif ($data['status'] === 'completed' && !$stage->actual_end_time) {
            $data['actual_end_time'] = Carbon::now();
            $data['progress_percentage'] = 100;
        }

        $stage->update($data);

        // Update production overall progress
        $this->updateProductionProgress($stage->production_id);

        return response()->json([
            'message' => 'Stage updated successfully',
            'stage' => $stage->load('production.product')
        ]);
    }

    /**
     * Update overall production progress based on stages
     */
    private function updateProductionProgress($productionId)
    {
        $production = Production::findOrFail($productionId);
        $stages = ProductionStageLog::where('production_id', $productionId)->get();

        if ($stages->isEmpty()) {
            return;
        }

        // Calculate average progress
        $totalProgress = $stages->sum('progress_percentage');
        $averageProgress = $totalProgress / $stages->count();

        // Update production status based on stages
        $allCompleted = $stages->every(fn($stage) => $stage->status === 'completed');
        $anyInProgress = $stages->contains(fn($stage) => $stage->status === 'in_progress');

        if ($allCompleted) {
            $production->update([
                'status' => 'completed',
                'progress_percentage' => 100,
                'actual_end_date' => Carbon::now()
            ]);
        } elseif ($anyInProgress) {
            $production->update([
                'status' => 'in_progress',
                'progress_percentage' => $averageProgress
            ]);
        }
    }

    /**
     * Get staff's assigned tasks
     */
    public function getMyTasks()
    {
        $tasks = ProductionStageLog::with(['production.product', 'production.order'])
            ->where('assigned_worker_id', auth()->id())
            ->whereIn('status', ['pending', 'in_progress'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($tasks);
    }
}
