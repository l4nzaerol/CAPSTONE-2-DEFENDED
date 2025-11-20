<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Order;
use App\Models\Production;
use App\Models\ProductionProcess;
use App\Models\User;
use Illuminate\Support\Facades\DB;

echo "=== Testing Order Acceptance ===\n\n";

// Get first pending order
$order = Order::where('acceptance_status', 'pending')
    ->with(['items.product', 'user'])
    ->first();

if (!$order) {
    echo "No pending orders found!\n";
    exit;
}

echo "Found Order #{$order->id}\n";
echo "Customer: {$order->user->name}\n";
echo "Items: {$order->items->count()}\n";
foreach ($order->items as $item) {
    echo "  - {$item->product->name} x{$item->quantity}\n";
}

// Get admin or employee user
$admin = User::whereIn('role', ['admin', 'employee'])->first();
if (!$admin) {
    echo "No admin/employee user found!\n";
    exit;
}

echo "\nAccepting order as {$admin->role}: {$admin->name}\n\n";

DB::beginTransaction();
try {
    // Update order
    $order->update([
        'acceptance_status' => 'accepted',
        'accepted_by' => $admin->id,
        'accepted_at' => now(),
        'admin_notes' => 'Test acceptance',
    ]);
    
    echo "✅ Order status updated\n";
    
    // Create productions
    foreach ($order->items as $item) {
        $product = $item->product;
        $isAlkansya = str_contains(strtolower($product->name), 'alkansya');
        
        echo "\nCreating production for: {$product->name}\n";
        
        $production = Production::create([
            'order_id' => $order->id,
            'user_id' => $admin->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'date' => now()->format('Y-m-d'),
            'current_stage' => $isAlkansya ? 'Ready for Delivery' : 'Material Preparation',
            'status' => $isAlkansya ? 'Completed' : 'Pending',
            'quantity' => $item->quantity,
            'priority' => 'medium',
            'requires_tracking' => !$isAlkansya,
            'product_type' => $isAlkansya ? 'alkansya' : (str_contains(strtolower($product->name), 'table') ? 'table' : 'chair'),
            'production_started_at' => null,
            'estimated_completion_date' => $isAlkansya ? now() : now()->addWeeks(2),
            'overall_progress' => 0,
        ]);
        
        echo "✅ Production #{$production->id} created\n";
        
        // Create processes for non-alkansya
        if (!$isAlkansya) {
            $totalMinutes = 14 * 24 * 60;
            $processes = [
                ['name' => 'Material Preparation', 'order' => 1, 'pct' => 0.10],
                ['name' => 'Cutting & Shaping', 'order' => 2, 'pct' => 0.20],
                ['name' => 'Assembly', 'order' => 3, 'pct' => 0.30],
                ['name' => 'Sanding & Surface Preparation', 'order' => 4, 'pct' => 0.15],
                ['name' => 'Finishing', 'order' => 5, 'pct' => 0.20],
                ['name' => 'Quality Check & Packaging', 'order' => 6, 'pct' => 0.05],
            ];
            
            foreach ($processes as $proc) {
                ProductionProcess::create([
                    'production_id' => $production->id,
                    'process_name' => $proc['name'],
                    'process_order' => $proc['order'],
                    'status' => 'pending',
                    'estimated_duration_minutes' => (int) round($totalMinutes * $proc['pct']),
                ]);
            }
            
            echo "✅ 6 processes created\n";
        }
    }
    
    DB::commit();
    echo "\n✅ Transaction committed!\n\n";
    
    // Verify
    $productionCount = Production::where('order_id', $order->id)->count();
    $processCount = ProductionProcess::whereIn('production_id', 
        Production::where('order_id', $order->id)->pluck('id')
    )->count();
    
    echo "=== Verification ===\n";
    echo "Order #{$order->id} acceptance_status: {$order->fresh()->acceptance_status}\n";
    echo "Productions created: {$productionCount}\n";
    echo "Processes created: {$processCount}\n";
    
} catch (\Exception $e) {
    DB::rollBack();
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}

echo "\n=== Done ===\n";
