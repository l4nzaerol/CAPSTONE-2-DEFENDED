<?php
// test_daily_output_api.php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\AlkansyaDailyOutput;
use App\Models\ProductionAnalytics;
use App\Models\Production;
use Carbon\Carbon;

echo "=== Testing Daily Output API Endpoints ===" . PHP_EOL . PHP_EOL;

// Test 1: Check Alkansya Daily Output data
echo "1. Alkansya Daily Output Data:" . PHP_EOL;
$alkansyaCount = AlkansyaDailyOutput::count();
$alkansyaTotal = AlkansyaDailyOutput::sum('quantity_produced');
echo "   - Records: {$alkansyaCount}" . PHP_EOL;
echo "   - Total Produced: {$alkansyaTotal}" . PHP_EOL;

if ($alkansyaCount > 0) {
    $recentOutput = AlkansyaDailyOutput::orderBy('date', 'desc')->first();
    echo "   - Latest: {$recentOutput->date} - {$recentOutput->quantity_produced} units" . PHP_EOL;
}

// Test 2: Check ProductionAnalytics data
echo PHP_EOL . "2. ProductionAnalytics Data:" . PHP_EOL;
$analyticsCount = ProductionAnalytics::count();
$analyticsTotal = ProductionAnalytics::sum('actual_output');
echo "   - Records: {$analyticsCount}" . PHP_EOL;
echo "   - Total Output: {$analyticsTotal}" . PHP_EOL;

if ($analyticsCount > 0) {
    $recentAnalytics = ProductionAnalytics::orderBy('date', 'desc')->first();
    echo "   - Latest: {$recentAnalytics->date} - {$recentAnalytics->actual_output} units" . PHP_EOL;
}

// Test 3: Check Production data (Tables/Chairs)
echo PHP_EOL . "3. Production Data (Tables/Chairs):" . PHP_EOL;
$productionCount = Production::where('status', 'Completed')->count();
$productionTotal = Production::where('status', 'Completed')->sum('quantity');
echo "   - Completed Productions: {$productionCount}" . PHP_EOL;
echo "   - Total Quantity: {$productionTotal}" . PHP_EOL;

// Test 4: Check date range coverage
echo PHP_EOL . "4. Date Range Coverage:" . PHP_EOL;
$oldestAlkansya = AlkansyaDailyOutput::orderBy('date', 'asc')->first();
$newestAlkansya = AlkansyaDailyOutput::orderBy('date', 'desc')->first();

if ($oldestAlkansya && $newestAlkansya) {
    echo "   - Alkansya Date Range: {$oldestAlkansya->date} to {$newestAlkansya->date}" . PHP_EOL;
    
    $startDate = Carbon::parse($oldestAlkansya->date);
    $endDate = Carbon::parse($newestAlkansya->date);
    $daysDiff = $startDate->diffInDays($endDate);
    echo "   - Total Days: {$daysDiff}" . PHP_EOL;
}

// Test 5: Check daily averages
echo PHP_EOL . "5. Daily Averages:" . PHP_EOL;
if ($alkansyaCount > 0) {
    $avgAlkansya = round($alkansyaTotal / $alkansyaCount, 2);
    echo "   - Alkansya Average: {$avgAlkansya} units/day" . PHP_EOL;
}

if ($analyticsCount > 0) {
    $avgAnalytics = round($analyticsTotal / $analyticsCount, 2);
    echo "   - ProductionAnalytics Average: {$avgAnalytics} units/day" . PHP_EOL;
}

// Test 6: Check recent 7 days
echo PHP_EOL . "6. Recent 7 Days Output:" . PHP_EOL;
$sevenDaysAgo = Carbon::now()->subDays(7)->format('Y-m-d');
$recentAlkansya = AlkansyaDailyOutput::where('date', '>=', $sevenDaysAgo)->sum('quantity_produced');
$recentAnalytics = ProductionAnalytics::where('date', '>=', $sevenDaysAgo)->sum('actual_output');
echo "   - Alkansya (7 days): {$recentAlkansya} units" . PHP_EOL;
echo "   - ProductionAnalytics (7 days): {$recentAnalytics} units" . PHP_EOL;

echo PHP_EOL . "=== Test Complete ===" . PHP_EOL;
