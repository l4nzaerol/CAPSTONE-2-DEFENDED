<?php

namespace App\Http\Controllers;

use App\Models\Production;
use App\Models\ProductionProcess;
use App\Models\ProductionAnalytics;
use App\Models\AlkansyaDailyOutput;
use App\Models\Product;
use App\Models\InventoryItem;
use App\Models\InventoryUsage;
use App\Models\ProductMaterial;
use App\Models\User;
use Illuminate\Http\Request;
use App\Events\ProductionUpdated;
use App\Events\ProductionProcessUpdated;
use App\Notifications\OrderStageUpdated;
use App\Notifications\LowStockAlert;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderTracking;
use App\Models\Notification;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ProductionController extends Controller
{
    public function index(Request $request)
    {
        try {
            \Log::info('Productions index called');
            
            $query = Production::with(['user', 'product', 'processes', 'order'])
                // IMPORTANT: Only show productions for accepted orders
                ->whereHas('order', function($q) {
                    $q->where('acceptance_status', 'accepted');
                });

            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            if ($request->has('start_date') && $request->has('end_date')) {
                $query->whereBetween('date', [$request->start_date, $request->end_date]);
            }

            $productions = $query->orderBy('date', 'desc')->get();
            
            // Add BOM and process details for each production
            foreach ($productions as $production) {
                // Add BOM (Bill of Materials) for the product
                $production->bom = $this->getProductBOM($production->product_id);
                
                // Add current process details
                $production->current_process = $this->getCurrentProcess($production);
            }
            
            \Log::info('Productions count: ' . $productions->count());
            
            return response()->json($productions);
            
        } catch (\Exception $e) {
            \Log::error('Productions index error: ' . $e->getMessage());
            \Log::error($e->getTraceAsString());
            return response()->json([
                'error' => 'Failed to fetch productions',
                'message' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Get Bill of Materials for a product
     */
    private function getProductBOM($productId)
    {
        return ProductMaterial::where('product_id', $productId)
            ->with('inventoryItem:id,sku,name,unit,quantity_on_hand')
            ->get()
            ->map(function($material) {
                return [
                    'inventory_item_id' => $material->inventory_item_id,
                    'sku' => $material->inventoryItem->sku ?? 'N/A',
                    'name' => $material->inventoryItem->name ?? 'Unknown',
                    'qty_per_unit' => $material->qty_per_unit,
                    'unit' => $material->inventoryItem->unit ?? 'unit',
                    'quantity_on_hand' => $material->inventoryItem->quantity_on_hand ?? 0,
                ];
            });
    }
    
    /**
     * Get current process details
     */
    private function getCurrentProcess($production)
    {
        if (!$production->processes || $production->processes->isEmpty()) {
            return null;
        }
        
        // Find the current in-progress process
        $currentProcess = $production->processes->firstWhere('status', 'in_progress');
        
        if (!$currentProcess) {
            // If no in-progress, find the next pending process
            $currentProcess = $production->processes
                ->where('status', 'pending')
                ->sortBy('process_order')
                ->first();
        }
        
        return $currentProcess;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id'       => 'required|exists:users,id',
            'product_id'    => 'required|exists:products,id',
            'product_name'  => 'required|string|max:255', // keep for quick display
            'date'          => 'required|date',
            'current_stage' => 'required|string|in:Material Preparation,Cutting & Shaping,Assembly,Sanding & Surface Preparation,Finishing,Quality Check & Packaging,Ready for Delivery,Completed',
            'status'        => 'required|string|in:Pending,In Progress,Completed,Hold',
            'quantity'      => 'required|integer|min:0',
            'resources_used'=> 'nullable|array',
            'notes'         => 'nullable|string',
        ]);

        $production = Production::create($data)->load(['user','product']);

        broadcast(new ProductionUpdated($production))->toOthers();

        return response()->json($production, 201);
    }

    public function show($id)
    {
        $production = Production::with(['user', 'product'])->findOrFail($id);
        return response()->json($production);
    }

    /**
     * Sync ProductionProcess statuses to reflect a manually selected stage.
     */
    private function syncProcessesToStage(\App\Models\Production $production, ?string $normalizedStage): void
    {
        // Only applies when processes exist and product is tracked (non-alkansya typically)
        if (!$normalizedStage) return;

        $processOrderMap = [
            'Material Preparation' => 1,
            'Cutting & Shaping' => 2,
            'Assembly' => 3,
            'Sanding & Surface Preparation' => 4,
            'Finishing' => 5,
            'Quality Check & Packaging' => 6,
            'Ready for Delivery' => 7,
            'Completed' => 7,
        ];

        $targetOrder = $processOrderMap[$normalizedStage] ?? null;
        if (!$targetOrder) return;

        $processes = $production->processes()->get();
        if ($processes->isEmpty()) return;

        foreach ($processes as $proc) {
            if (!isset($proc->process_order)) continue;

            if ($proc->process_order < $targetOrder) {
                // Mark previous processes as completed
                $proc->update([
                    'status' => 'completed',
                    'completed_at' => $proc->completed_at ?? now(),
                ]);
            } elseif ($proc->process_order === $targetOrder) {
                // Set current process as in progress
                $proc->update([
                    'status' => 'in_progress',
                    'started_at' => $proc->started_at ?? now(),
                ]);
            } else {
                // Next processes pending
                $proc->update([
                    'status' => 'pending',
                ]);
            }
        }
    }

    /**
     * Sync ProductionStageLogs statuses to reflect a manually selected stage.
     */
    private function syncStageLogsToStage(\App\Models\Production $production, ?string $normalizedStage): void
    {
        if (!$normalizedStage) return;

        // Guard if relation not loaded/available
        if (!method_exists($production, 'stageLogs')) return;

        try {
            $logs = $production->stageLogs()->with('productionStage')->get();
            if ($logs->isEmpty()) return;

            // Determine order from ProductionStage by name
            $targetLog = $logs->first(function($l) use ($normalizedStage) {
                return $l->productionStage && $l->productionStage->name === $normalizedStage;
            });
            
            $targetOrder = $targetLog && $targetLog->productionStage ? $targetLog->productionStage->order_sequence : null;
            if (!$targetOrder) return;

            foreach ($logs as $log) {
                if (!$log->productionStage) continue;
                
                $order = $log->productionStage->order_sequence;
                if (!$order) continue;

                if ($order < $targetOrder) {
                    $log->update([
                        'status' => 'completed',
                        'progress_percentage' => 100,
                        'completed_at' => $log->completed_at ?? now(),
                    ]);
                } elseif ($order === $targetOrder) {
                    $log->update([
                        'status' => 'in_progress',
                        'progress_percentage' => max(20, (int) ($log->progress_percentage ?? 0)),
                        'started_at' => $log->started_at ?? now(),
                    ]);
                } else {
                    $log->update([
                        'status' => 'pending',
                        'progress_percentage' => min(10, (int) ($log->progress_percentage ?? 0)),
                    ]);
                }
            }
        } catch (\Exception $e) {
            \Log::warning("Error in syncStageLogsToStage: " . $e->getMessage());
        }
    }

    public function update(Request $request, $id)
    {
        $production = Production::findOrFail($id);

        // Accept both legacy and enhanced stage names
        $legacyStages = ['Design','Preparation','Cutting','Assembly','Finishing','Quality Control'];
        $enhancedStages = [
            'Material Preparation',
            'Cutting & Shaping',
            'Assembly',
            'Sanding & Surface Preparation',
            'Finishing',
            'Quality Check & Packaging',
            'Ready for Delivery',
            'Completed',
        ];

        $allAllowedStages = array_values(array_unique(array_merge($legacyStages, $enhancedStages)));

        // Use Rule::in() for proper validation of values with special characters
        $data = $request->validate([
            'user_id'       => 'sometimes|exists:users,id',
            'product_id'    => 'sometimes|exists:products,id',
            'product_name'  => 'sometimes|string|max:255',
            'date'          => 'sometimes|date',
            'stage'         => ['sometimes', 'string', \Illuminate\Validation\Rule::in($allAllowedStages)],
            'current_stage' => ['sometimes', 'string', \Illuminate\Validation\Rule::in($allAllowedStages)],
            'status'        => 'sometimes|string|in:Pending,In Progress,Completed,Hold',
            'quantity'      => 'sometimes|integer|min:0',
            'resources_used'=> 'nullable|array',
            'notes'         => 'nullable|string',
        ]);

        $old = $production->replicate();
        
        try {
            // Normalize stage updates: if either stage or current_stage is provided
            if (array_key_exists('stage', $data) || array_key_exists('current_stage', $data)) {
                $targetStage = $data['current_stage'] ?? $data['stage'] ?? null;

                // Map legacy stages to enhanced equivalents where possible
                $stageMap = [
                    'Design' => 'Material Preparation',
                    'Preparation' => 'Material Preparation',
                    'Cutting' => 'Cutting & Shaping',
                    'Assembly' => 'Assembly',
                    'Finishing' => 'Finishing',
                    'Quality Control' => 'Quality Check & Packaging',
                ];
                $normalizedStage = $stageMap[$targetStage] ?? $targetStage;

                // Store old stage for logging
                $oldStage = $production->current_stage;
                
                // Only update current_stage (stage column was removed in migration)
                $production->current_stage = $normalizedStage;

                // If moved to Completed or Ready for Delivery, also update status accordingly
                if ($normalizedStage === 'Completed' || $normalizedStage === 'Ready for Delivery') {
                    $production->status = 'Completed';
                    $production->actual_completion_date = now();
                    $production->overall_progress = 100;
                    
                    // Create inventory transaction for production completion
                    $this->createProductionCompletionTransaction($production);
                    
                    // Update order status to 'ready_for_delivery' when production is done
                    if ($production->order_id) {
                        $order = Order::find($production->order_id);
                        if ($order && $order->status === 'processing') {
                            $order->status = 'ready_for_delivery';
                            $order->save();
                            \Log::info("Order #{$order->id} status updated to 'ready_for_delivery' because production reached Ready for Delivery");
                            
                            // Update order tracking status
                            OrderTracking::where('order_id', $order->id)->update([
                                'status' => 'ready_for_delivery',
                                'current_stage' => 'Ready for Delivery',
                                'progress_percentage' => 100,
                            ]);
                        }
                    }
                } elseif (!in_array($production->status, ['Hold'])) {
                    // Keep as in progress unless explicitly set otherwise
                    $production->status = $production->status ?? 'In Progress';
                }

                $production->save();
                
                // Log stage change
                if ($oldStage !== $normalizedStage) {
                    $this->logStageChange($production, $oldStage, $normalizedStage);
                }

            // Sync ProductionProcess records to match the selected stage (for tracked items)
            try {
                $this->syncProcessesToStage($production, $normalizedStage);
            } catch (\Exception $e) {
                \Log::warning("Failed to sync processes for production {$production->id}: " . $e->getMessage());
            }

            // Attempt to sync ProductionStageLogs if they exist (enhanced tracking)
            try {
                $this->syncStageLogsToStage($production, $normalizedStage);
            } catch (\Exception $e) {
                \Log::warning("Failed to sync stage logs for production {$production->id}: " . $e->getMessage());
            }

            // Recompute overall progress if available, but only if not using process-based tracking
            // Process-based completion takes precedence over stage-based completion
            if (method_exists($production, 'updateOverallProgress') && !$production->processes()->exists()) {
                try {
                    $production->updateOverallProgress();
                } catch (\Exception $e) {
                    \Log::warning("Failed to update overall progress for production {$production->id}: " . $e->getMessage());
                }
            }

                // Remove handled keys from $data to avoid double-setting later
                unset($data['stage'], $data['current_stage']);
            }

            // Apply other updatable fields
            if (!empty($data)) {
                $production->update($data);
            }

            $production->load(['user', 'product', 'processes', 'stageLogs']); // reload relationships

            broadcast(new ProductionUpdated($production))->toOthers();

            // Notify customer on stage or status change (compare old vs new to catch normalized updates)
            if (($old->current_stage !== $production->current_stage) || ($old->status !== $production->status)) {
                $order = $production->order_id ? Order::with('user')->find($production->order_id) : null;
                if ($order && $order->user) {
                    $order->user->notify(new OrderStageUpdated(
                        $order->id,
                        $production->product_name,
                        $production->current_stage,
                        $production->status
                    ));
                }
            }

            return response()->json($production);
            
        } catch (\Exception $e) {
            \Log::error("Production update error for ID {$id}: " . $e->getMessage());
            \Log::error($e->getTraceAsString());
            
            return response()->json([
                'message' => 'Failed to update production: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function destroy($id)
    {
        $production = Production::findOrFail($id);
        $production->delete();

        return response()->json(['message' => 'Production deleted']);
    }

    /**
     * Manually update a specific process status
     */
    public function updateProcess(Request $request, $productionId, $processId)
    {
        try {
            $data = $request->validate([
                'status' => 'required|string|in:pending,in_progress,completed',
                'delay_reason' => 'nullable|string',
                'is_delayed' => 'nullable|boolean',
                'actual_completion_date' => 'nullable|date',
                'remarks' => 'nullable|string',
                'notes' => 'nullable|string',
            ]);

            $production = Production::findOrFail($productionId);
            $process = ProductionProcess::where('production_id', $productionId)
                ->where('id', $processId)
                ->firstOrFail();

            $oldStatus = $process->status;
            $newStatus = $data['status'];

            // Update process status
            $updateData = ['status' => $newStatus];
            
            if ($newStatus === 'in_progress' && !$process->started_at) {
                $updateData['started_at'] = now();
            }
            
            if ($newStatus === 'completed') {
                // Ensure started_at is set if not already set
                if (!$process->started_at) {
                    $updateData['started_at'] = now();
                }
                
                // Set completion time
                $updateData['completed_at'] = $data['actual_completion_date'] ?? now();
                
                // Add delay tracking data if provided
                if (isset($data['delay_reason'])) {
                    $updateData['delay_reason'] = $data['delay_reason'];
                }
                if (isset($data['is_delayed'])) {
                    $updateData['is_delayed'] = $data['is_delayed'];
                }
                if (isset($data['actual_completion_date'])) {
                    $updateData['actual_completion_date'] = $data['actual_completion_date'];
                }
                
                // Add remarks/notes if provided
                if (isset($data['remarks'])) {
                    $updateData['notes'] = $data['remarks'];
                } elseif (isset($data['notes'])) {
                    $updateData['notes'] = $data['notes'];
                }
                
                // Add completed by user name
                if ($request->user()) {
                    $updateData['completed_by_name'] = $request->user()->name;
                }
                
                // Log the completion for debugging
                \Log::info("Process {$process->id} ({$process->process_name}) completed successfully", [
                    'production_id' => $productionId,
                    'process_id' => $processId,
                    'started_at' => $updateData['started_at'] ?? $process->started_at,
                    'completed_at' => $updateData['completed_at'],
                    'completed_by' => $updateData['completed_by_name'] ?? 'Unknown',
                    'remarks' => $updateData['notes'] ?? ''
                ]);
            }

            $process->update($updateData);

            // Update production current_stage based on processes
            // This ensures process-based completion takes precedence
            $this->updateProductionStageFromProcesses($production);

            // Reload production with relationships
            $production->load(['processes', 'order']);

            // Broadcast update - use ProductionUpdated instead
            try {
                broadcast(new ProductionUpdated($production))->toOthers();
            } catch (\Exception $e) {
                \Log::warning("Failed to broadcast production update: " . $e->getMessage());
            }

            // Notify customer when process is completed (for made-to-order products)
            try {
                if ($newStatus === 'completed' && $production->order_id) {
                    $order = Order::with(['user', 'items.product'])->find($production->order_id);
                    
                    if ($order && $order->user) {
                        // Check if this is a made-to-order product
                        $isMadeToOrder = $this->isMadeToOrderProduct($order, $production);
                        
                        if ($isMadeToOrder) {
                            // Send notification for process completion
                            $this->notifyProcessCompletion($order, $production, $process);
                            
                            // Check if all processes are completed
                            $allProcessesCompleted = $this->checkAllProcessesCompleted($production);
                            
                            if ($allProcessesCompleted) {
                                // Send notification for production completion
                                $this->notifyProductionCompletion($order, $production);
                            }
                        }
                    }
                }
            } catch (\Exception $e) {
                \Log::warning("Failed to send customer notification: " . $e->getMessage());
                // Don't fail the request if notification fails
            }

            return response()->json([
                'message' => 'Process updated successfully',
                'process' => $process,
                'production' => $production
            ]);

        } catch (\Exception $e) {
            \Log::error("Error updating process: " . $e->getMessage());
            return response()->json([
                'error' => 'Failed to update process',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update production stage and status based on current processes
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
            
            \Log::info("Production {$production->id} stage updated to: {$currentProcess->process_name}");
        } else {
            // Check if all completed
            $completedCount = $processes->where('status', 'completed')->count();
            
            if ($completedCount === $processes->count()) {
                // All processes completed - production is done
                $production->current_stage = 'Completed';
                $production->status = 'Completed';
                $production->overall_progress = 100;
                $production->actual_completion_date = now();
                
                // Create inventory transaction for production completion
                $this->createProductionCompletionTransaction($production);
                
                // Update order status to 'ready_for_delivery' when production is done
                if ($production->order_id) {
                    $order = Order::with(['user', 'items.product'])->find($production->order_id);
                    if ($order && $order->status === 'processing') {
                        $order->status = 'ready_for_delivery';
                        $order->save();
                        \Log::info("Order #{$order->id} status updated to 'ready_for_delivery' because all production processes completed");
                        
                        // Update order tracking status
                        OrderTracking::where('order_id', $order->id)->update([
                            'status' => 'ready_for_delivery',
                            'current_stage' => 'Ready for Delivery',
                            'progress_percentage' => 100,
                        ]);

                        // Notify customer if this is a made-to-order product
                        if ($order->user) {
                            $isMadeToOrder = $this->isMadeToOrderProduct($order, $production);
                            if ($isMadeToOrder) {
                                $this->notifyProductionCompletion($order, $production);
                            }
                        }
                    }
                }
                
                \Log::info("Production {$production->id} completed - all processes finished");
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

    public function analytics(Request $request)
    {
        // Get Production data (main source with 30 records)
        $productionQuery = Production::query();

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $productionQuery->whereBetween('date', [$request->start_date, $request->end_date]);
        }

        $productionData = $productionQuery->get();

        // Get Order data for additional metrics
        // Note: For order counts, we want to show ALL orders regardless of date filters
        // because pending orders are important to see at all times
        $allOrders = Order::all();
        
        // But if date filters are applied, also get filtered orders for other metrics
        $orderQuery = Order::query();
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $orderQuery->whereBetween('created_at', [$request->start_date, $request->end_date]);
        }
        $orderData = $orderQuery->get();

        // Calculate total sales revenue from completed orders
        $totalSalesRevenue = $allOrders->where('status', 'completed')
            ->where('payment_status', 'paid')
            ->sum('total_price');

        // KPIs from Production data + Order data
        // Use allOrders for pending/completed counts to show current state
        // Only count Table/Chair productions (exclude Alkansya)
        $kpis = [
            'total'       => $productionData->where('product_type', '!=', 'alkansya')->count(),
            'in_progress' => $productionData->where('status', 'In Progress')->where('product_type', '!=', 'alkansya')->count(),
            'completed'   => $productionData->where('status', 'Completed')->where('product_type', '!=', 'alkansya')->count(),
            'hold'        => $productionData->where('status', 'Hold')->where('product_type', '!=', 'alkansya')->count(),
            'pending_orders' => $allOrders->where('acceptance_status', 'pending')->count(),
            'completed_orders' => $allOrders->where('status', 'completed')->count(),
            'completed_productions' => $productionData->where('status', 'Completed')->where('product_type', '!=', 'alkansya')->count(),
            'total_sales_revenue' => '₱' . number_format($totalSalesRevenue, 2),
        ];

        // Daily output - SEPARATED by product type
        // Get Alkansya data from AlkansyaDailyOutput (the correct data source)
        $alkansyaQuery = AlkansyaDailyOutput::query();
        
        // Only apply date filter if explicitly provided
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $alkansyaQuery->whereBetween('date', [$request->start_date, $request->end_date]);
        }
        
        // Alkansya output from AlkansyaDailyOutput (includes all historical data)
        $alkansyaData = $alkansyaQuery->get()
            ->groupBy(function($item) {
                return Carbon::parse($item->date)->format('Y-m-d');
            })
            ->map(fn($items, $date) => [
                'date' => $date,
                'alkansya' => $items->sum('quantity_produced'),
                'furniture' => 0,
                'quantity' => $items->sum('quantity_produced'), // Total for backward compatibility
            ]);

        // Completed Table/Chair productions
        // Count the number of completed productions (not sum of quantities) to match the KPI
        $completedProductions = Production::where('status', 'Completed')
            ->where('product_type', '!=', 'alkansya')
            ->whereNotNull('actual_completion_date')
            ->get()
            ->groupBy(function($prod) {
                return Carbon::parse($prod->actual_completion_date)->format('Y-m-d');
            })
            ->map(fn($items, $date) => [
                'date' => $date,
                'alkansya' => 0,
                'furniture' => $items->count(), // Count of completed productions, not sum of quantities
                'quantity' => $items->count(), // Count for consistency
            ]);

        // Merge both datasets
        $allDates = collect($alkansyaData->keys())->merge($completedProductions->keys())->unique();
        
        $daily = $allDates->map(function($date) use ($alkansyaData, $completedProductions) {
            $alkansyaQty = $alkansyaData->get($date)['alkansya'] ?? 0;
            $furnitureQty = $completedProductions->get($date)['furniture'] ?? 0;
            
            return [
                'date' => $date,
                'alkansya' => $alkansyaQty,
                'furniture' => $furnitureQty,
                'quantity' => $alkansyaQty + $furnitureQty, // Total
            ];
        })->sortBy('date')->values();

        // Stage breakdown from Production data (using actual stages from data)
        $actualStages = $productionData->whereNotNull('current_stage')
            ->where('current_stage', '!=', '')
            ->pluck('current_stage')
            ->unique()
            ->values()
            ->toArray();
        
        // If no stages found, use default stages
        if (empty($actualStages)) {
            $actualStages = [
                'Material Preparation',
                'Cutting & Shaping', 
                'Assembly',
                'Sanding & Surface Preparation',
                'Finishing',
                'Quality Check & Packaging'
            ];
        }
        
        $stageBreakdown = collect($actualStages)->map(fn($stage) => [
            'name'  => $stage,
            'value' => $productionData->where('current_stage', $stage)->count(),
        ])->values();

        // Resource allocation suggestions based on Production data
        $resourceAllocation = [];
        foreach ($actualStages as $stage) {
            $stageCount = $productionData->where('current_stage', $stage)->whereIn('status', ['In Progress', 'Pending'])->count();
            if ($stageCount > 3) {
                $resourceAllocation[] = [
                    'stage' => $stage,
                    'workload' => $stageCount,
                    'message' => "Stage '{$stage}' is overloaded with {$stageCount} items",
                    'priority' => 'high'
                ];
            }
        }

        // Stage workload analysis based on Production data
        $capacities = [
            'Material Preparation' => 3, 
            'Cutting & Shaping' => 4, 
            'Assembly' => 5, 
            'Sanding & Surface Preparation' => 3, 
            'Finishing' => 3, 
            'Quality Check & Packaging' => 2
        ];
        
        $stageWorkload = collect($actualStages)->map(function($stage) use ($productionData, $capacities) {
            $currentWorkload = $productionData->where('current_stage', $stage)->whereIn('status', ['In Progress', 'Pending'])->count();
            $capacity = $capacities[$stage] ?? 1;
            $utilization = ($currentWorkload / $capacity) * 100;
            
            return [
                'stage' => $stage,
                'capacity' => $capacity,
                'current_workload' => $currentWorkload,
                'utilization_percentage' => round($utilization, 1),
                'status' => $utilization > 90 ? 'overloaded' : ($utilization > 70 ? 'busy' : 'available')
            ];
        })->values();

        // Get top products from OrderItems (actual orders) to show individual product names
        // This ensures we show specific products, not general categories grouped together
        $topProductsQuery = OrderItem::select(
                'products.id',
                'products.name',
                'products.product_name',
                DB::raw('SUM(order_items.quantity) as total_quantity'),
                DB::raw('COUNT(DISTINCT order_items.order_id) as order_count')
            )
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->whereIn('orders.status', ['ready_for_delivery', 'delivered', 'completed', 'processing']);
        
        // Apply date filter if provided
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $topProductsQuery->whereBetween('orders.checkout_date', [$request->start_date, $request->end_date]);
        }
        
        $topProducts = $topProductsQuery
            ->groupBy('products.id', 'products.name', 'products.product_name')
            ->orderByDesc('total_quantity')
            ->limit(10)
            ->get()
            ->map(function($item) {
                return [
                    'name' => $item->product_name ?: $item->name, // Use product_name if available, else name
                    'quantity' => (int) $item->total_quantity,
                    'order_count' => (int) $item->order_count,
                ];
            })
            ->values();

        // Get top customers (users with most orders)
        $topUsers = Order::with('user')
            ->select('user_id', DB::raw('COUNT(*) as order_count'), DB::raw('SUM(total_price) as total_spent'))
            ->groupBy('user_id')
            ->orderByDesc('order_count')
            ->limit(5)
            ->get()
            ->map(function($order) {
                return [
                    'name' => $order->user ? $order->user->name : 'Unknown Customer',
                    'quantity' => $order->order_count,
                ];
            })
            ->values();

        // Top Staff - Staff members who completed the most processes
        $topStaff = ProductionProcess::whereNotNull('completed_by_name')
            ->where('completed_by_name', '!=', '')
            ->where('status', 'completed')
            ->select('completed_by_name', DB::raw('COUNT(*) as completed_processes'))
            ->groupBy('completed_by_name')
            ->orderByDesc('completed_processes')
            ->limit(5)
            ->get()
            ->map(function($staff) {
                return [
                    'name' => $staff->completed_by_name,
                    'completed_processes' => $staff->completed_processes,
                ];
            })
            ->values();

        return response()->json([
            'kpis'             => $kpis,
            'daily_output'     => $daily,
            'stage_breakdown'  => $stageBreakdown,
            'top_products'     => $topProducts,
            'top_users'        => $topUsers,
            'top_staff'        => $topStaff,
            'resource_allocation' => $resourceAllocation,
            'stage_workload'   => $stageWorkload,
            'capacity_utilization' => [
                'total_capacity' => array_sum($capacities),
                'current_utilization' => $productionData->whereIn('status', ['In Progress', 'Pending'])->count(),
                'utilization_percentage' => round(($productionData->whereIn('status', ['In Progress', 'Pending'])->count() / max(1, array_sum($capacities))) * 100, 1)
            ]
        ]);
    }

    /**
     * Get predictive analytics for production
     */
    public function predictiveAnalytics(Request $request)
    {
        $productId = $request->get('product_id');
        $days = $request->get('days', 7);

        // Get historical data for the product
        $historicalData = ProductionAnalytics::where('product_id', $productId)
            ->orderBy('date', 'desc')
            ->limit(30)
            ->get();

        // Calculate moving averages for prediction
        $avgOutput = $historicalData->avg('actual_output');
        $avgEfficiency = $historicalData->avg('efficiency_percentage');
        $avgDuration = $historicalData->avg('total_duration_minutes');

        // Predict next day's output based on historical data
        $predictedOutput = round($avgOutput * (1 + ($avgEfficiency - 100) / 100));
        
        // Calculate trend
        $recentData = $historicalData->take(7);
        $olderData = $historicalData->slice(7, 7);
        $trend = $recentData->avg('actual_output') - $olderData->avg('actual_output');

        // Generate daily predictions
        $predictions = [];
        $currentDate = Carbon::now();
        
        for ($i = 1; $i <= $days; $i++) {
            $predictedDate = $currentDate->copy()->addDays($i);
            $dayOfWeek = $predictedDate->dayOfWeek;
            
            // Adjust prediction based on day of week (weekends might have different output)
            $dayAdjustment = in_array($dayOfWeek, [0, 6]) ? 0.8 : 1.0; // Weekend adjustment
            
            $dailyPrediction = round($predictedOutput * $dayAdjustment);
            
            $predictions[] = [
                'date' => $predictedDate->format('Y-m-d'),
                'predicted_output' => $dailyPrediction,
                'confidence_level' => 85, // Based on historical accuracy
                'factors' => [
                    'historical_average' => round($avgOutput),
                    'efficiency_trend' => round($trend, 2),
                    'day_of_week_adjustment' => $dayAdjustment
                ]
            ];
        }

        return response()->json([
            'product_id' => $productId,
            'historical_data' => $historicalData,
            'predictions' => $predictions,
            'summary' => [
                'avg_daily_output' => round($avgOutput),
                'avg_efficiency' => round($avgEfficiency, 2),
                'trend' => round($trend, 2),
                'prediction_confidence' => 85
            ]
        ]);
    }

    /**
     * Start a production process for Alkansya (6 processes)
     */
    public function startProduction(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1',
            'user_id' => 'required|exists:users,id',
            'order_id' => 'nullable|exists:orders,id',
        ]);

        $product = Product::findOrFail($data['product_id']);

        // Pre-check: ensure raw materials are sufficient for requested quantity using BOM
        $bom = ProductMaterial::where('product_id', $product->id)->get();
        $shortages = [];
        foreach ($bom as $mat) {
            $inv = InventoryItem::find($mat->inventory_item_id);
            if ($inv) {
                $required = (int) ($mat->qty_per_unit * $data['quantity']);
                if ($inv->quantity_on_hand < $required) {
                    $shortages[] = [
                        'sku' => $inv->sku,
                        'name' => $inv->name,
                        'required' => $required,
                        'on_hand' => $inv->quantity_on_hand,
                        'deficit' => max(0, $required - $inv->quantity_on_hand),
                    ];
                }
            }
        }
        if (!empty($shortages)) {
            return response()->json([
                'message' => 'Insufficient raw materials to start production',
                'shortages' => $shortages,
            ], 422);
        }
        
        // Create production record
        $production = Production::create([
            'user_id' => $data['user_id'],
            'product_id' => $data['product_id'],
            'product_name' => $product->name,
            'date' => Carbon::now()->format('Y-m-d'),
            'current_stage' => 'Material Preparation',
            'status' => 'In Progress',
            'quantity' => $data['quantity'],
            'order_id' => $data['order_id'] ?? null,
        ]);

        // Create process records for Tables and Chairs (6 processes)
        // Exclude alkansya from production tracking as they are pre-made inventory
        if (!str_contains(strtolower($product->name), 'alkansya')) {
            $processes = [
                ['name' => 'Material Preparation', 'order' => 1, 'estimated_duration' => 120], // 2 hours
                ['name' => 'Cutting & Shaping', 'order' => 2, 'estimated_duration' => 240], // 4 hours
                ['name' => 'Assembly', 'order' => 3, 'estimated_duration' => 360], // 6 hours
                ['name' => 'Sanding & Surface Preparation', 'order' => 4, 'estimated_duration' => 180], // 3 hours
                ['name' => 'Finishing', 'order' => 5, 'estimated_duration' => 240], // 4 hours
                ['name' => 'Quality Check & Packaging', 'order' => 6, 'estimated_duration' => 60], // 1 hour
            ];

            foreach ($processes as $process) {
                ProductionProcess::create([
                    'production_id' => $production->id,
                    'process_name' => $process['name'],
                    'process_order' => $process['order'],
                    'status' => $process['order'] === 1 ? 'in_progress' : 'pending',
                    'estimated_duration_minutes' => $process['estimated_duration'],
                    'started_at' => $process['order'] === 1 ? Carbon::now() : null,
                ]);
            }

            // Set estimated completion date (2 weeks for tables and chairs)
            $estimatedCompletionDate = Carbon::now()->addWeeks(2);
            $production->update(['estimated_completion_date' => $estimatedCompletionDate]);
        } else {
            // For alkansya, mark as ready for delivery immediately since they're pre-made
            $production->update([
                'status' => 'Completed',
                'current_stage' => 'Ready for Delivery',
                'estimated_completion_date' => Carbon::now(),
            ]);
        }

        // Automatically reduce inventory materials only if not created from an order (to avoid double deduction)
        if (empty($data['order_id'])) {
            $this->reduceInventoryMaterials($production);
        }

        return response()->json($production->load('processes'));
    }

    /**
     * Get daily production summary with predictive analytics
     */
    public function dailySummary(Request $request)
    {
        $date = $request->get('date', Carbon::now()->format('Y-m-d'));
        
        // Get today's productions
        $todayProductions = Production::where('date', $date)->get();
        
        // Calculate daily metrics
        $totalOutput = $todayProductions->sum('quantity');
        $completedProductions = $todayProductions->where('status', 'Completed')->count();
        $inProgressProductions = $todayProductions->where('status', 'In Progress')->count();
        
        // Get process breakdown
        $processBreakdown = ProductionProcess::whereHas('production', function($query) use ($date) {
            $query->where('date', $date);
        })->get()->groupBy('process_name')->map(function($processes) {
            return [
                'total' => $processes->count(),
                'completed' => $processes->where('status', 'completed')->count(),
                'in_progress' => $processes->where('status', 'in_progress')->count(),
                'delayed' => $processes->where('status', 'delayed')->count(),
            ];
        });

        // Calculate efficiency
        $targetOutput = 50; // Assuming 50 units per day target
        $efficiency = $targetOutput > 0 ? round(($totalOutput / $targetOutput) * 100, 2) : 0;

        // Get predictive forecast for tomorrow
        $tomorrow = Carbon::parse($date)->addDay()->format('Y-m-d');
        $predictedOutput = $this->predictTomorrowOutput($date);

        return response()->json([
            'date' => $date,
            'summary' => [
                'total_output' => $totalOutput,
                'completed_productions' => $completedProductions,
                'in_progress_productions' => $inProgressProductions,
                'efficiency_percentage' => $efficiency,
                'target_output' => $targetOutput,
            ],
            'process_breakdown' => $processBreakdown,
            'prediction' => [
                'tomorrow_date' => $tomorrow,
                'predicted_output' => $predictedOutput,
                'confidence_level' => 85,
            ],
            'productions' => $todayProductions->load('processes')
        ]);
    }

    /**
     * Reduce inventory materials when production starts
     */
    private function reduceInventoryMaterials($production)
    {
        // Use BOM to compute material usage
        $bom = ProductMaterial::where('product_id', $production->product_id)->get();
        foreach ($bom as $mat) {
            $inventoryItem = InventoryItem::find($mat->inventory_item_id);
            if (!$inventoryItem) {
                continue;
            }
            $quantityNeeded = (int) ($mat->qty_per_unit * $production->quantity);

            // Reduce inventory
            $inventoryItem->decrement('quantity_on_hand', $quantityNeeded);

            // Record usage (migration uses qty_used field)
            InventoryUsage::create([
                'inventory_item_id' => $inventoryItem->id,
                'qty_used' => $quantityNeeded,
                'date' => Carbon::now()->format('Y-m-d'),
            ]);

            // Low stock notifications when hitting ROP
            $inventoryItem->refresh();
            if (!is_null($inventoryItem->reorder_point) && $inventoryItem->quantity_on_hand <= $inventoryItem->reorder_point) {
                User::where('role', 'employee')->get()->each(function ($u) use ($inventoryItem) {
                    $u->notify(new LowStockAlert($inventoryItem));
                });
            }
        }
    }

    /**
     * Predict tomorrow's output based on historical data
     */
    private function predictTomorrowOutput($currentDate)
    {
        // Get last 7 days of production data
        $historicalData = Production::where('date', '>=', Carbon::parse($currentDate)->subDays(7))
            ->where('date', '<', $currentDate)
            ->get()
            ->groupBy('date')
            ->map(function($productions) {
                return $productions->sum('quantity');
            });

        if ($historicalData->count() < 3) {
            return 40; // Default prediction if not enough data
        }

        // Calculate moving average
        $avgOutput = $historicalData->avg();
        
        // Apply trend adjustment
        $recentDays = $historicalData->take(3);
        $olderDays = $historicalData->slice(3, 3);
        $trend = $recentDays->avg() - $olderDays->avg();
        
        $prediction = round($avgOutput + ($trend * 0.5)); // Apply 50% of trend
        
        return max(0, $prediction);
    }

    /**
     * Get comprehensive production dashboard data
     */
    public function dashboard(Request $request)
    {
        $dateRange = $request->get('date_range', 7); // Default 7 days
        $startDate = Carbon::now()->subDays($dateRange);
        
        // Get active productions (excluding alkansya)
        $activeProductions = Production::whereHas('product', function($query) {
                $query->where('name', 'NOT LIKE', '%alkansya%');
            })
            ->where('status', '!=', 'Completed')
            ->with(['product', 'processes', 'user'])
            ->get();

        // Get completed productions in date range
        $completedProductions = Production::whereHas('product', function($query) {
                $query->where('name', 'NOT LIKE', '%alkansya%');
            })
            ->where('status', 'Completed')
            ->where('updated_at', '>=', $startDate)
            ->count();

        // Calculate workload distribution
        $workloadByStage = $activeProductions->groupBy('current_stage')
            ->map(function($productions, $stage) {
                return [
                    'stage' => $stage,
                    'count' => $productions->count(),
                    'total_quantity' => $productions->sum('quantity'),
                    'avg_days_in_stage' => $productions->avg(function($p) {
                        return $p->updated_at->diffInDays(Carbon::now());
                    })
                ];
            })->values();

        // Resource utilization
        $resourceUtilization = $this->calculateResourceUtilization($activeProductions);

        // Production efficiency trends
        $efficiencyTrends = $this->getEfficiencyTrends($dateRange);

        return response()->json([
            'overview' => [
                'active_productions' => $activeProductions->count(),
                'completed_this_period' => $completedProductions,
                'total_quantity_in_production' => $activeProductions->sum('quantity'),
                'avg_completion_time' => $this->getAverageCompletionTime(),
                'on_time_delivery_rate' => $this->getOnTimeDeliveryRate($dateRange),
            ],
            'workload_by_stage' => $workloadByStage,
            'resource_utilization' => $resourceUtilization,
            'efficiency_trends' => $efficiencyTrends,
            'active_productions' => $activeProductions,
            'priority_breakdown' => $activeProductions->groupBy('priority')
                ->map->count(),
        ]);
    }

    /**
     * Get efficiency report with detailed metrics
     */
    public function efficiencyReport(Request $request)
    {
        $startDate = $request->get('start_date', Carbon::now()->subMonth());
        $endDate = $request->get('end_date', Carbon::now());

        $productions = Production::whereHas('product', function($query) {
                $query->where('name', 'NOT LIKE', '%alkansya%');
            })
            ->whereBetween('created_at', [$startDate, $endDate])
            ->with(['processes', 'product'])
            ->get();

        $processEfficiency = [];
        $processNames = ['Material Preparation', 'Cutting & Shaping', 'Assembly', 
                        'Sanding & Surface Preparation', 'Finishing', 'Quality Check & Packaging'];

        foreach ($processNames as $processName) {
            $processes = ProductionProcess::whereHas('production', function($query) use ($startDate, $endDate) {
                    $query->whereHas('product', function($subQuery) {
                        $subQuery->where('name', 'NOT LIKE', '%alkansya%');
                    })
                    ->whereBetween('created_at', [$startDate, $endDate]);
                })
                ->where('process_name', $processName)
                ->whereNotNull('completed_at')
                ->get();

            $avgDuration = $processes->avg('duration');
            $avgEstimated = $processes->avg('estimated_duration_minutes');
            $efficiency = $avgEstimated > 0 ? ($avgEstimated / $avgDuration) * 100 : 100;

            $processEfficiency[] = [
                'process_name' => $processName,
                'avg_actual_duration' => round($avgDuration, 2),
                'avg_estimated_duration' => round($avgEstimated, 2),
                'efficiency_percentage' => round($efficiency, 2),
                'total_completed' => $processes->count(),
                'delayed_count' => $processes->where('is_delayed', true)->count(),
            ];
        }

        return response()->json([
            'date_range' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
            'overall_metrics' => [
                'total_productions' => $productions->count(),
                'completed_productions' => $productions->where('status', 'Completed')->count(),
                'avg_production_time' => $this->getAverageProductionTime($productions),
                'overall_efficiency' => $this->getOverallEfficiency($productions),
            ],
            'process_efficiency' => $processEfficiency,
        ]);
    }

    /**
     * Get capacity utilization report
     */
    public function capacityUtilization(Request $request)
    {
        $dateRange = $request->get('days', 30);
        $startDate = Carbon::now()->subDays($dateRange);

        // Assume 8 hours per day, 5 days per week capacity
        $dailyCapacityMinutes = 8 * 60; // 480 minutes
        $weeklyCapacityMinutes = $dailyCapacityMinutes * 5; // 2400 minutes

        $utilizationData = [];
        $currentDate = $startDate->copy();

        while ($currentDate->lte(Carbon::now())) {
            $dayProductions = Production::whereHas('product', function($query) {
                    $query->where('name', 'NOT LIKE', '%alkansya%');
                })
                ->whereDate('created_at', $currentDate)
                ->with('processes')
                ->get();

            $totalTimeUsed = $dayProductions->sum(function($production) {
                return $production->processes->sum('duration');
            });

            $utilizationPercentage = $dailyCapacityMinutes > 0 
                ? ($totalTimeUsed / $dailyCapacityMinutes) * 100 
                : 0;

            $utilizationData[] = [
                'date' => $currentDate->format('Y-m-d'),
                'capacity_minutes' => $dailyCapacityMinutes,
                'used_minutes' => $totalTimeUsed,
                'utilization_percentage' => round($utilizationPercentage, 2),
                'productions_count' => $dayProductions->count(),
            ];

            $currentDate->addDay();
        }

        $avgUtilization = collect($utilizationData)->avg('utilization_percentage');
        $maxUtilization = collect($utilizationData)->max('utilization_percentage');
        $minUtilization = collect($utilizationData)->min('utilization_percentage');

        return response()->json([
            'date_range' => $dateRange,
            'summary' => [
                'average_utilization' => round($avgUtilization, 2),
                'peak_utilization' => round($maxUtilization, 2),
                'lowest_utilization' => round($minUtilization, 2),
                'daily_capacity_hours' => 8,
            ],
            'daily_utilization' => $utilizationData,
        ]);
    }

    /**
     * Get resource allocation optimization suggestions
     */
    public function resourceAllocation(Request $request)
    {
        $activeProductions = Production::whereHas('product', function($query) {
                $query->where('name', 'NOT LIKE', '%alkansya%');
            })
            ->where('status', '!=', 'Completed')
            ->with(['processes', 'product'])
            ->get();

        // Analyze bottlenecks by counting productions in each stage
        $stageAnalysis = $activeProductions->groupBy('current_stage')
            ->map(function($productions, $stage) {
                $totalQuantity = $productions->sum('quantity');
                $avgTimeInStage = $productions->avg(function($p) {
                    return $p->updated_at->diffInHours(Carbon::now());
                });
                
                return [
                    'stage' => $stage,
                    'productions_count' => $productions->count(),
                    'total_quantity' => $totalQuantity,
                    'avg_time_in_stage_hours' => round($avgTimeInStage, 1),
                    'urgency_score' => $this->calculateUrgencyScore($productions),
                ];
            })->sortByDesc('urgency_score')->values();

        // Resource optimization suggestions
        $suggestions = $this->generateResourceOptimizationSuggestions($stageAnalysis);

        return response()->json([
            'current_allocation' => $stageAnalysis,
            'bottlenecks' => $stageAnalysis->take(3), // Top 3 bottlenecks
            'optimization_suggestions' => $suggestions,
            'total_active_productions' => $activeProductions->count(),
        ]);
    }

    /**
     * Get comprehensive performance metrics
     */
    public function performanceMetrics(Request $request)
    {
        $period = $request->get('period', 'month'); // week, month, quarter
        $startDate = match($period) {
            'week' => Carbon::now()->subWeek(),
            'quarter' => Carbon::now()->subQuarter(),
            default => Carbon::now()->subMonth(),
        };

        $productions = Production::whereHas('product', function($query) {
                $query->where('name', 'NOT LIKE', '%alkansya%');
            })
            ->where('created_at', '>=', $startDate)
            ->with(['processes', 'product'])
            ->get();

        $completedProductions = $productions->where('status', 'Completed');
        $inProgressProductions = $productions->where('status', 'In Progress');

        // Calculate KPIs
        $throughput = $completedProductions->sum('quantity');
        $averageLeadTime = $this->getAverageLeadTime($completedProductions);
        $qualityRate = $this->getQualityRate($completedProductions);
        $onTimeDelivery = $this->getOnTimeDeliveryRate(null, $completedProductions);
        $resourceUtilization = $this->getResourceUtilization($productions);

        return response()->json([
            'period' => $period,
            'date_range' => [
                'start' => $startDate->format('Y-m-d'),
                'end' => Carbon::now()->format('Y-m-d'),
            ],
            'kpis' => [
                'throughput' => $throughput,
                'average_lead_time_days' => round($averageLeadTime, 1),
                'quality_rate_percentage' => round($qualityRate, 2),
                'on_time_delivery_percentage' => round($onTimeDelivery, 2),
                'resource_utilization_percentage' => round($resourceUtilization, 2),
            ],
            'production_summary' => [
                'total_started' => $productions->count(),
                'completed' => $completedProductions->count(),
                'in_progress' => $inProgressProductions->count(),
                'completion_rate' => $productions->count() > 0 
                    ? round(($completedProductions->count() / $productions->count()) * 100, 2) 
                    : 0,
            ],
            'trends' => $this->getPerformanceTrends($startDate),
        ]);
    }

    /**
     * Create batch production
     */
    public function createBatch(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'batch_quantity' => 'required|integer|min:1',
            'orders' => 'required|array',
            'orders.*.order_id' => 'required|exists:orders,id',
            'orders.*.quantity' => 'required|integer|min:1',
            'priority' => 'in:low,medium,high,urgent',
            'user_id' => 'required|exists:users,id',
        ]);

        $product = Product::findOrFail($data['product_id']);
        $batchNumber = 'BATCH-' . Carbon::now()->format('YmdHis');

        // Check if product should be tracked (not alkansya)
        if (str_contains(strtolower($product->name), 'alkansya')) {
            return response()->json([
                'message' => 'Alkansya products do not require production tracking as they are pre-made inventory items.',
                'batch_number' => $batchNumber,
                'status' => 'ready_for_delivery'
            ]);
        }

        $productions = [];
        foreach ($data['orders'] as $orderData) {
            $production = Production::create([
                'order_id' => $orderData['order_id'],
                'user_id' => $data['user_id'],
                'product_id' => $data['product_id'],
                'product_name' => $product->name,
                'date' => Carbon::now()->format('Y-m-d'),
                'current_stage' => 'Material Preparation',
                'status' => 'In Progress',
                'quantity' => $orderData['quantity'],
                'priority' => $data['priority'] ?? 'medium',
                'production_batch_number' => $batchNumber,
                'estimated_completion_date' => Carbon::now()->addWeeks(2),
            ]);

            // Create process records
            $this->createProductionProcesses($production);
            $productions[] = $production;
        }

        return response()->json([
            'batch_number' => $batchNumber,
            'total_productions' => count($productions),
            'total_quantity' => array_sum(array_column($data['orders'], 'quantity')),
            'estimated_completion' => Carbon::now()->addWeeks(2),
            'productions' => $productions
        ]);
    }

    /**
     * Update production priority
     */
    public function updatePriority(Request $request, $id)
    {
        $data = $request->validate([
            'priority' => 'required|in:low,medium,high,urgent',
            'reason' => 'nullable|string'
        ]);

        $production = Production::findOrFail($id);
        $production->update([
            'priority' => $data['priority'],
            'notes' => $production->notes . "\n[" . Carbon::now() . "] Priority changed to {$data['priority']}. Reason: " . ($data['reason'] ?? 'Not specified')
        ]);

        return response()->json($production->fresh());
    }

    /**
     * Get production timeline
     */
    public function getTimeline($id)
    {
        $production = Production::with(['processes' => function($query) {
                $query->orderBy('process_order');
            }])->findOrFail($id);

        $timeline = $production->processes->map(function($process) {
            return [
                'process_name' => $process->process_name,
                'process_order' => $process->process_order,
                'status' => $process->status,
                'estimated_duration' => $process->estimated_duration_minutes,
                'actual_duration' => $process->duration,
                'started_at' => $process->started_at,
                'completed_at' => $process->completed_at,
                'is_delayed' => $process->is_delayed,
                'notes' => $process->notes,
            ];
        });

        return response()->json([
            'production' => $production,
            'timeline' => $timeline,
            'overall_progress' => $this->calculateOverallProgress($production),
        ]);
    }

    // Helper methods
    private function calculateResourceUtilization($productions)
    {
        // Implementation for resource utilization calculation
        return [
            'workers' => 85,
            'equipment' => 75,
            'materials' => 90,
        ];
    }

    private function getEfficiencyTrends($days)
    {
        // Implementation for efficiency trends
        return [];
    }

    private function getAverageCompletionTime()
    {
        $recentCompletions = Production::where('status', 'Completed')
            ->where('created_at', '>=', Carbon::now()->subMonth())
            ->get();

        return $recentCompletions->avg(function($production) {
            return $production->created_at->diffInDays($production->updated_at);
        }) ?? 14; // Default 14 days
    }

    private function getOnTimeDeliveryRate($days = null, $productions = null)
    {
        if (!$productions) {
            $query = Production::where('status', 'Completed');
            if ($days) {
                $query->where('created_at', '>=', Carbon::now()->subDays($days));
            }
            $productions = $query->get();
        }

        $onTimeCount = $productions->filter(function($production) {
            return $production->actual_completion_date && 
                   $production->estimated_completion_date &&
                   $production->actual_completion_date <= $production->estimated_completion_date;
        })->count();

        return $productions->count() > 0 ? ($onTimeCount / $productions->count()) * 100 : 100;
    }

    private function calculateUrgencyScore($productions)
    {
        return $productions->sum(function($production) {
            $priorityWeight = match($production->priority) {
                'urgent' => 4,
                'high' => 3,
                'medium' => 2,
                'low' => 1,
                default => 2,
            };
            
            $timeWeight = $production->updated_at->diffInHours(Carbon::now()) / 24;
            return $priorityWeight * (1 + $timeWeight);
        });
    }

    private function generateResourceOptimizationSuggestions($stageAnalysis)
    {
        $suggestions = [];
        $topBottleneck = $stageAnalysis->first();
        
        if ($topBottleneck && $topBottleneck['productions_count'] > 3) {
            $suggestions[] = [
                'type' => 'bottleneck_alert',
                'message' => "Consider allocating additional resources to {$topBottleneck['stage']} stage",
                'priority' => 'high',
                'impact' => 'Reduce production delays by up to 25%'
            ];
        }

        return $suggestions;
    }

    private function getAverageProductionTime($productions)
    {
        return $productions->where('status', 'Completed')
            ->avg(function($production) {
                return $production->created_at->diffInDays($production->updated_at);
            }) ?? 14;
    }

    private function getOverallEfficiency($productions)
    {
        // Calculate based on estimated vs actual completion times
        $completedProductions = $productions->where('status', 'Completed')
            ->filter(function($p) {
                return $p->estimated_completion_date && $p->actual_completion_date;
            });

        if ($completedProductions->count() === 0) return 100;

        $efficiencyScores = $completedProductions->map(function($production) {
            $estimatedDays = $production->created_at->diffInDays($production->estimated_completion_date);
            $actualDays = $production->created_at->diffInDays($production->actual_completion_date);
            
            return $estimatedDays > 0 ? min(100, ($estimatedDays / $actualDays) * 100) : 100;
        });

        return $efficiencyScores->avg();
    }

    private function getAverageLeadTime($productions)
    {
        return $productions->avg(function($production) {
            return $production->created_at->diffInDays($production->updated_at);
        }) ?? 14;
    }

    private function getQualityRate($productions)
    {
        // Assume quality checks are passed if no quality issues noted
        $passedQuality = $productions->filter(function($production) {
            return $production->processes
                ->where('process_name', 'Quality Check & Packaging')
                ->where('status', 'completed')
                ->count() > 0;
        })->count();

        return $productions->count() > 0 ? ($passedQuality / $productions->count()) * 100 : 100;
    }

    private function getResourceUtilization($productions)
    {
        // Simplified resource utilization calculation
        return 80; // Placeholder
    }

    private function getPerformanceTrends($startDate)
    {
        // Implementation for performance trends over time
        return [];
    }

    private function createProductionProcesses($production)
    {
        $processes = [
            ['name' => 'Material Preparation', 'order' => 1, 'estimated_duration' => 120],
            ['name' => 'Cutting & Shaping', 'order' => 2, 'estimated_duration' => 240],
            ['name' => 'Assembly', 'order' => 3, 'estimated_duration' => 360],
            ['name' => 'Sanding & Surface Preparation', 'order' => 4, 'estimated_duration' => 180],
            ['name' => 'Finishing', 'order' => 5, 'estimated_duration' => 240],
            ['name' => 'Quality Check & Packaging', 'order' => 6, 'estimated_duration' => 60],
        ];

        foreach ($processes as $process) {
            ProductionProcess::create([
                'production_id' => $production->id,
                'process_name' => $process['name'],
                'process_order' => $process['order'],
                'status' => $process['order'] === 1 ? 'in_progress' : 'pending',
                'estimated_duration_minutes' => $process['estimated_duration'],
                'started_at' => $process['order'] === 1 ? Carbon::now() : null,
            ]);
        }
    }

    private function calculateOverallProgress($production)
    {
        $totalProcesses = $production->processes->count();
        $completedProcesses = $production->processes->where('status', 'completed')->count();
        $inProgressProcesses = $production->processes->where('status', 'in_progress')->count();
        
        $progress = $totalProcesses > 0 
            ? (($completedProcesses + ($inProgressProcesses * 0.5)) / $totalProcesses) * 100
            : 0;
            
        return round($progress, 2);
    }

    /**
     * Update production progress based on time elapsed
     */
    private function updateTimeBasedProgress($production)
    {
        try {
            // Skip if production hasn't started or is already completed
            if (!$production->production_started_at || $production->status === 'Completed') {
                return;
            }

            $processes = $production->processes;
            if ($processes->isEmpty()) {
                return;
            }

            $now = Carbon::now();
            $startTime = Carbon::parse($production->production_started_at);
            $estimatedEnd = Carbon::parse($production->estimated_completion_date);
            
            // Calculate total elapsed time vs total estimated time
            $totalEstimatedMinutes = $startTime->diffInMinutes($estimatedEnd);
            $elapsedMinutes = $startTime->diffInMinutes($now);
            
            // Don't exceed 100%
            if ($elapsedMinutes >= $totalEstimatedMinutes) {
                $elapsedMinutes = $totalEstimatedMinutes;
            }
            
            $overallProgressPercent = $totalEstimatedMinutes > 0 
                ? ($elapsedMinutes / $totalEstimatedMinutes) * 100 
                : 0;
            
            // Update each process based on time
            $cumulativeMinutes = 0;
            $updated = false;
            
            foreach ($processes as $process) {
                $processStart = $cumulativeMinutes;
                $processEnd = $cumulativeMinutes + $process->estimated_duration_minutes;
                
                if ($elapsedMinutes >= $processEnd && $process->status !== 'completed') {
                    // Process should be completed
                    $process->update([
                        'status' => 'completed',
                        'started_at' => $process->started_at ?? $startTime->copy()->addMinutes($processStart),
                        'completed_at' => $startTime->copy()->addMinutes($processEnd),
                    ]);
                    $updated = true;
                } elseif ($elapsedMinutes > $processStart && $elapsedMinutes < $processEnd && $process->status === 'pending') {
                    // Process should be in progress
                    $process->update([
                        'status' => 'in_progress',
                        'started_at' => $startTime->copy()->addMinutes($processStart),
                    ]);
                    $updated = true;
                }
                
                $cumulativeMinutes += $process->estimated_duration_minutes;
            }
            
            // Update production overall progress and status
            if ($updated || $production->overall_progress != $overallProgressPercent) {
                $completedCount = $processes->where('status', 'completed')->count();
                $totalCount = $processes->count();
                
                $newStatus = $production->status;
                $newStage = $production->current_stage;
                
                if ($completedCount === $totalCount) {
                    $newStatus = 'Completed';
                    $newStage = 'Completed';
                } elseif ($completedCount > 0) {
                    $newStatus = 'In Progress';
                    // Find current in-progress process
                    $currentProcess = $processes->firstWhere('status', 'in_progress');
                    if ($currentProcess) {
                        $newStage = $currentProcess->process_name;
                    }
                }
                
                $production->update([
                    'overall_progress' => round($overallProgressPercent, 2),
                    'status' => $newStatus,
                    'current_stage' => $newStage,
                    'actual_completion_date' => $newStatus === 'Completed' ? $now : null,
                ]);
                
                // Log analytics data
                $this->logProductionAnalytics($production);
            }
            
        } catch (\Exception $e) {
            \Log::error("Error updating time-based progress for production #{$production->id}: " . $e->getMessage());
        }
    }

    /**
     * Log production analytics data
     */
    private function logProductionAnalytics($production)
    {
        try {
            $today = Carbon::now()->format('Y-m-d');
            
            // Calculate efficiency
            $processes = $production->processes;
            $totalEstimatedMinutes = $processes->sum('estimated_duration_minutes');
            $totalActualMinutes = 0;
            
            foreach ($processes as $process) {
                if ($process->started_at && $process->completed_at) {
                    $totalActualMinutes += Carbon::parse($process->started_at)->diffInMinutes($process->completed_at);
                }
            }
            
            $efficiency = $totalEstimatedMinutes > 0 
                ? ($totalEstimatedMinutes / max($totalActualMinutes, 1)) * 100 
                : 100;
            
            // Check if analytics record exists for today
            $analytics = ProductionAnalytics::firstOrCreate(
                [
                    'date' => $today,
                    'product_id' => $production->product_id,
                ],
                [
                    'target_output' => 10,
                    'actual_output' => 0,
                    'efficiency_percentage' => 0,
                    'total_duration_minutes' => 0,
                    'avg_process_duration_minutes' => 0,
                ]
            );
            
            // Update analytics
            if ($production->status === 'Completed' && $production->actual_completion_date) {
                $analytics->increment('actual_output', $production->quantity);
            }
            
            $analytics->update([
                'efficiency_percentage' => round($efficiency, 2),
                'total_duration_minutes' => $totalActualMinutes,
            ]);
            
            \Log::info("Analytics logged for production #{$production->id}");
            
        } catch (\Exception $e) {
            \Log::error("Error logging analytics for production #{$production->id}: " . $e->getMessage());
        }
    }

    /**
     * Log production stage changes
     */
    private function logStageChange($production, $oldStage, $newStage)
    {
        try {
            // Find or create production stage
            $stage = \App\Models\ProductionStage::firstOrCreate(
                ['name' => $newStage],
                [
                    'description' => "Production stage: {$newStage}",
                    'order' => $this->getStageOrder($newStage),
                ]
            );
            
            // Create stage log
            \App\Models\ProductionStageLog::create([
                'production_id' => $production->id,
                'production_stage_id' => $stage->id,
                'status' => 'completed',
                'started_at' => Carbon::now(),
                'completed_at' => Carbon::now(),
                'notes' => "Stage changed from {$oldStage} to {$newStage}",
            ]);
            
            \Log::info("Stage log created for production #{$production->id}: {$oldStage} → {$newStage}");
            
        } catch (\Exception $e) {
            \Log::error("Error logging stage change for production #{$production->id}: " . $e->getMessage());
        }
    }

    /**
     * Get stage order number
     */
    private function getStageOrder($stageName)
    {
        $stageOrder = [
            'Material Preparation' => 1,
            'Cutting & Shaping' => 2,
            'Assembly' => 3,
            'Sanding & Surface Preparation' => 4,
            'Finishing' => 5,
            'Quality Check & Packaging' => 6,
            'Completed' => 7,
            'Ready for Delivery' => 8,
        ];
        
        return $stageOrder[$stageName] ?? 0;
    }

    /**
     * Create inventory transaction for production completion
     */
    private function createProductionCompletionTransaction($production)
    {
        try {
            // Get product details
            $product = Product::find($production->product_id);
            if (!$product) {
                \Log::warning("Product not found for production completion: {$production->product_id}");
                return;
            }

            // For made-to-order products, add completed items to stock
            if ($product->category_name === 'Made to Order' || $product->category_name === 'made_to_order') {
                $product->increment('stock', $production->quantity);
                \Log::info("Added {$production->quantity} {$product->name} to stock after production completion");
            }

            // Create production completion transaction
            \App\Models\InventoryTransaction::create([
                'product_id' => $production->product_id,
                'order_id' => $production->order_id,
                'production_id' => $production->id,
                'user_id' => auth()->id(),
                'transaction_type' => 'PRODUCTION_COMPLETION',
                'quantity' => $production->quantity,
                'unit_cost' => $product->standard_cost ?? 0,
                'total_cost' => ($product->standard_cost ?? 0) * $production->quantity,
                'reference' => 'PRODUCTION_COMPLETION',
                'timestamp' => now(),
                'remarks' => "Production completed for {$product->name} (Qty: {$production->quantity})",
                'status' => 'completed',
                'priority' => 'normal',
                'metadata' => [
                    'production_id' => $production->id,
                    'product_name' => $product->name,
                    'product_id' => $product->id,
                    'quantity_completed' => $production->quantity,
                    'completion_date' => $production->actual_completion_date,
                    'production_stage' => $production->current_stage,
                    'production_type' => $production->product_type,
                ],
                'source_data' => [
                    'production_id' => $production->id,
                    'order_id' => $production->order_id,
                    'product_id' => $production->product_id,
                    'completion_date' => $production->actual_completion_date,
                ],
                'cost_breakdown' => [
                    'product_cost' => ($product->standard_cost ?? 0) * $production->quantity,
                    'unit_cost' => $product->standard_cost ?? 0,
                    'quantity_completed' => $production->quantity,
                ]
            ]);

            \Log::info("Created production completion transaction for production #{$production->id}");
        } catch (\Exception $e) {
            \Log::error("Failed to create production completion transaction: " . $e->getMessage());
        }
    }

    /**
     * Check if the product is a made-to-order product
     */
    private function isMadeToOrderProduct($order, $production)
    {
        // Check if product has made-to-order category
        if ($production->product_id) {
            $product = \App\Models\Product::find($production->product_id);
            if ($product) {
                $categoryName = strtolower($product->category_name ?? '');
                if (str_contains($categoryName, 'made to order') || str_contains($categoryName, 'made-to-order')) {
                    return true;
                }
            }
        }

        // Check order items for made-to-order products
        if ($order->items) {
            foreach ($order->items as $item) {
                if ($item->product) {
                    $categoryName = strtolower($item->product->category_name ?? '');
                    if (str_contains($categoryName, 'made to order') || str_contains($categoryName, 'made-to-order')) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Check if all processes are completed
     */
    private function checkAllProcessesCompleted($production)
    {
        $processes = $production->processes()->get();
        
        if ($processes->isEmpty()) {
            return false;
        }

        $completedCount = $processes->where('status', 'completed')->count();
        return $completedCount === $processes->count();
    }

    /**
     * Notify customer when a production process is completed
     */
    private function notifyProcessCompletion($order, $production, $process)
    {
        try {
            $customer = $order->user;
            
            // Create database notification
            Notification::create([
                'user_id' => $customer->id,
                'order_id' => $order->id,
                'type' => 'production_process_completed',
                'title' => 'Production Progress Update',
                'message' => "The '{$process->process_name}' process for your order #{$order->id} ({$production->product_name}) has been completed successfully.",
            ]);

            // Send email notification
            $customer->notify(new OrderStageUpdated(
                $order->id,
                $production->product_name,
                $process->process_name . ' (Completed)',
                'In Progress'
            ));

            \Log::info("Sent process completion notification to customer {$customer->id} for order #{$order->id}, process: {$process->process_name}");
        } catch (\Exception $e) {
            \Log::error("Failed to send process completion notification: " . $e->getMessage());
        }
    }

    /**
     * Notify customer when production is fully completed
     */
    private function notifyProductionCompletion($order, $production)
    {
        try {
            $customer = $order->user;
            
            // Create database notification
            Notification::create([
                'user_id' => $customer->id,
                'order_id' => $order->id,
                'type' => 'production_completed',
                'title' => 'Production Completed!',
                'message' => "Great news! Your order #{$order->id} ({$production->product_name}) has completed all production processes and is ready for delivery.",
            ]);

            // Send email notification
            $customer->notify(new OrderStageUpdated(
                $order->id,
                $production->product_name,
                'Production Completed',
                'Ready for Delivery'
            ));

            \Log::info("Sent production completion notification to customer {$customer->id} for order #{$order->id}");
        } catch (\Exception $e) {
            \Log::error("Failed to send production completion notification: " . $e->getMessage());
        }
    }

}
