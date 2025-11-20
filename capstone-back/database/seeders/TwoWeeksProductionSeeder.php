<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Production;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;

class TwoWeeksProductionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Creating production data for the past two weeks...');

        // Get products and users
        $products = Product::all();
        $users = User::where('role', 'employee')->get();

        if ($products->isEmpty()) {
            $this->command->warn('No products found. Please run product seeders first.');
            return;
        }

        if ($users->isEmpty()) {
            $this->command->warn('No employee users found. Please run UsersTableSeeder first.');
            return;
        }

        // Clear existing production data from the past two weeks
        $twoWeeksAgo = Carbon::now()->subDays(14);
        Production::where('date', '>=', $twoWeeksAgo->format('Y-m-d'))->delete();
        $this->command->info('Cleared existing production data from the past two weeks.');

        $stages = [
            'Material Preparation',
            'Cutting & Shaping',
            'Assembly',
            'Sanding & Surface Preparation',
            'Finishing',
            'Quality Check & Packaging',
            'Ready for Delivery',
            'Completed'
        ];

        $statuses = ['Pending', 'In Progress', 'Completed', 'Hold'];
        $priorities = ['low', 'medium', 'high', 'urgent'];
        
        $productionCount = 0;
        $currentDate = $twoWeeksAgo->copy();

        // Generate production data for each day in the past two weeks
        while ($currentDate->lte(Carbon::now())) {
            $dateStr = $currentDate->format('Y-m-d');
            
            // Skip weekends for most products (alkansya can be produced on weekends)
            if (!$currentDate->isWeekday() && rand(1, 3) > 1) {
                $currentDate->addDay();
                continue;
            }

            // Generate 2-8 production records per day
            $productionsPerDay = rand(2, 8);
            
            for ($i = 0; $i < $productionsPerDay; $i++) {
                $product = $products->random();
                $user = $users->random();
                
                // Determine product type based on product name
                $productName = strtolower($product->name ?? $product->product_name ?? '');
                $productType = 'custom';
                $requiresTracking = true;
                
                if (strpos($productName, 'alkansya') !== false) {
                    $productType = 'alkansya';
                    $requiresTracking = false; // Alkansya doesn't require stage tracking
                } elseif (strpos($productName, 'table') !== false) {
                    $productType = 'table';
                } elseif (strpos($productName, 'chair') !== false) {
                    $productType = 'chair';
                }

                // Determine status based on date
                $daysAgo = $currentDate->diffInDays(Carbon::now());
                $status = 'Pending';
                $currentStage = $stages[0];
                $overallProgress = 0.00;
                
                if ($daysAgo <= 2) {
                    // Recent productions: mostly pending or in progress
                    $status = rand(1, 3) == 1 ? 'Pending' : 'In Progress';
                    if ($status === 'In Progress' && $requiresTracking) {
                        $stageIndex = rand(0, min(4, count($stages) - 1));
                        $currentStage = $stages[$stageIndex];
                        $overallProgress = ($stageIndex / (count($stages) - 1)) * 100;
                    }
                } elseif ($daysAgo <= 7) {
                    // Week old: mix of in progress and completed
                    $rand = rand(1, 10);
                    if ($rand <= 3) {
                        $status = 'Completed';
                        $currentStage = 'Completed';
                        $overallProgress = 100.00;
                    } elseif ($rand <= 7) {
                        $status = 'In Progress';
                        if ($requiresTracking) {
                            $stageIndex = rand(2, min(6, count($stages) - 1));
                            $currentStage = $stages[$stageIndex];
                            $overallProgress = ($stageIndex / (count($stages) - 1)) * 100;
                        }
                    } else {
                        $status = 'Pending';
                    }
                } else {
                    // Older productions: mostly completed
                    $rand = rand(1, 10);
                    if ($rand <= 8) {
                        $status = 'Completed';
                        $currentStage = 'Completed';
                        $overallProgress = 100.00;
                    } else {
                        $status = 'In Progress';
                        if ($requiresTracking) {
                            $stageIndex = rand(4, min(6, count($stages) - 1));
                            $currentStage = $stages[$stageIndex];
                            $overallProgress = ($stageIndex / (count($stages) - 1)) * 100;
                        }
                    }
                }

                // For alkansya (no tracking), set appropriate status
                if (!$requiresTracking) {
                    if ($status === 'Completed') {
                        $currentStage = 'Ready for Delivery';
                        $overallProgress = 100.00;
                    } else {
                        $currentStage = 'Ready for Delivery';
                        $overallProgress = rand(50, 100);
                    }
                }

                // Generate production dates
                $productionStartedAt = $currentDate->copy()
                    ->setTime(rand(7, 9), rand(0, 59), 0); // Start between 7-9 AM
                
                $estimatedCompletionDate = null;
                $actualCompletionDate = null;
                
                if ($status === 'Completed') {
                    $actualCompletionDate = $productionStartedAt->copy()
                        ->addDays(rand(1, 5))
                        ->setTime(rand(15, 17), rand(0, 59), 0); // Complete between 3-5 PM
                } else {
                    $estimatedCompletionDate = $productionStartedAt->copy()
                        ->addDays(rand(3, 7))
                        ->setTime(rand(15, 17), rand(0, 59), 0);
                }

                // Generate batch number
                $batchNumber = 'BATCH-' . $currentDate->format('Ymd') . '-' . str_pad($i + 1, 3, '0', STR_PAD_LEFT);

                // Generate quantity (1-10 for custom items, 5-25 for alkansya)
                $quantity = $productType === 'alkansya' ? rand(5, 25) : rand(1, 10);

                // Generate priority (mostly medium, some high/urgent)
                $priorityRand = rand(1, 10);
                $priority = 'medium';
                if ($priorityRand <= 2) {
                    $priority = 'high';
                } elseif ($priorityRand <= 1) {
                    $priority = 'urgent';
                } elseif ($priorityRand >= 9) {
                    $priority = 'low';
                }

                // Create production record
                Production::create([
                    'user_id' => $user->id,
                    'product_id' => $product->id,
                    'product_name' => $product->product_name ?? $product->name ?? 'Unknown Product',
                    'date' => $dateStr,
                    'current_stage' => $currentStage,
                    'status' => $status,
                    'quantity' => $quantity,
                    'resources_used' => [
                        'materials' => [],
                        'labor_hours' => rand(2, 8),
                        'tools' => []
                    ],
                    'notes' => $this->generateNotes($status, $currentStage),
                    'production_started_at' => $productionStartedAt,
                    'estimated_completion_date' => $estimatedCompletionDate,
                    'actual_completion_date' => $actualCompletionDate,
                    'priority' => $priority,
                    'production_batch_number' => $batchNumber,
                    'requires_tracking' => $requiresTracking,
                    'product_type' => $productType,
                    'overall_progress' => round($overallProgress, 2),
                    'production_metrics' => [
                        'efficiency' => rand(85, 100),
                        'quality_score' => rand(90, 100),
                        'waste_percentage' => rand(2, 8) / 100
                    ],
                ]);

                $productionCount++;
            }

            $currentDate->addDay();
        }

        $this->command->info("Created {$productionCount} production records for the past two weeks.");
        $this->command->info('TwoWeeksProductionSeeder completed successfully!');
    }

    /**
     * Generate realistic notes based on status and stage
     */
    private function generateNotes($status, $stage): string
    {
        $notes = [
            'Pending' => [
                'Awaiting material delivery',
                'Scheduled for production',
                'Pending approval',
                'Waiting for resources'
            ],
            'In Progress' => [
                'Production in progress',
                'On schedule',
                'Proceeding as planned',
                'Materials allocated'
            ],
            'Completed' => [
                'Production completed successfully',
                'Ready for quality check',
                'Completed on time',
                'All stages completed'
            ],
            'Hold' => [
                'Production on hold - awaiting materials',
                'Temporarily paused',
                'Waiting for customer approval',
                'On hold due to quality concerns'
            ]
        ];

        $stageNotes = [
            'Material Preparation' => 'Materials being prepared and verified',
            'Cutting & Shaping' => 'Cutting and shaping in progress',
            'Assembly' => 'Assembly stage ongoing',
            'Sanding & Surface Preparation' => 'Sanding and surface preparation',
            'Finishing' => 'Applying finish and final touches',
            'Quality Check & Packaging' => 'Quality inspection and packaging',
            'Ready for Delivery' => 'Production complete, ready for delivery',
            'Completed' => 'Production fully completed'
        ];

        $statusNote = $notes[$status][array_rand($notes[$status])] ?? '';
        $stageNote = $stageNotes[$stage] ?? '';

        return trim($statusNote . '. ' . $stageNote);
    }
}

