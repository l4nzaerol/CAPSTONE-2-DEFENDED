<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\AlkansyaDailyOutput;
use Carbon\Carbon;

echo "=== Trend Calculation from Actual 14 Days Daily Output ===\n\n";

// Get the actual 14 days of data
$historicalOutput = AlkansyaDailyOutput::where('date', '>=', Carbon::now()->subDays(30))
    ->orderBy('date', 'asc')
    ->get();

if ($historicalOutput->isEmpty()) {
    echo "No daily output data found.\n";
    exit;
}

echo "Historical Daily Output Data (Last 14 Days):\n";
echo str_repeat("=", 80) . "\n";
echo sprintf("%-12s | %-15s | %-10s | %-10s | %-10s | %-10s\n", 
    "Date", 
    "Output (y)", 
    "Day # (x)", 
    "x × y", 
    "x²", 
    "x × x"
);
echo str_repeat("-", 80) . "\n";

$productionData = [];
$sumX = 0;
$sumY = 0;
$sumXY = 0;
$sumX2 = 0;
$n = 0;

foreach ($historicalOutput as $index => $output) {
    $n++;
    $x = $n;  // Day number (1, 2, 3, ...)
    $date = is_string($output->date) ? $output->date : $output->date->format('Y-m-d');
    $y = $output->quantity_produced;  // Output quantity
    
    $xy = $x * $y;    // Day × Output
    $x2 = $x * $x;    // Day²
    
    $sumX += $x;
    $sumY += $y;
    $sumXY += $xy;
    $sumX2 += $x2;
    
    $productionData[] = [
        'date' => $date,
        'day' => $x,
        'output' => $y,
        'xy' => $xy,
        'x2' => $x2
    ];
    
    echo sprintf("%-12s | %-15s | %-10s | %-10s | %-10s | %-10s\n", 
        $date, 
        $y . " units", 
        $x, 
        $xy, 
        $x2,
        "($x × $x)"
    );
}

echo str_repeat("-", 80) . "\n";
echo sprintf("%-12s | %-15s | %-10s | %-10s | %-10s | %-10s\n", 
    "TOTAL", 
    $sumY . " units", 
    $sumX, 
    $sumXY, 
    $sumX2,
    "($sumX × $sumX = " . ($sumX * $sumX) . ")"
);
echo str_repeat("=", 80) . "\n\n";

echo "STEP-BY-STEP TREND CALCULATION:\n";
echo str_repeat("=", 80) . "\n\n";

echo "Step 1: Count the data points\n";
echo "  n = number of days with output = $n\n\n";

echo "Step 2: Calculate the sums\n";
echo "  Σx  = Sum of day numbers = $sumX\n";
echo "  Σy  = Sum of output quantities = $sumY units\n";
echo "  Σxy = Sum of (day × output) = $sumXY\n";
echo "  Σx² = Sum of (day²) = $sumX2\n\n";

echo "Step 3: Calculate (Σx)²\n";
$sumXSquared = $sumX * $sumX;
echo "  (Σx)² = $sumX × $sumX = $sumXSquared\n\n";

echo "Step 4: Apply the Linear Regression Formula\n";
echo "  Formula: Slope (m) = (n × Σxy - Σx × Σy) / (n × Σx² - (Σx)²)\n\n";

echo "  Numerator calculation:\n";
$numerator = ($n * $sumXY) - ($sumX * $sumY);
echo "    n × Σxy = $n × $sumXY = " . ($n * $sumXY) . "\n";
echo "    Σx × Σy = $sumX × $sumY = " . ($sumX * $sumY) . "\n";
echo "    Numerator = (n × Σxy) - (Σx × Σy) = " . ($n * $sumXY) . " - " . ($sumX * $sumY) . " = $numerator\n\n";

echo "  Denominator calculation:\n";
$denominator = ($n * $sumX2) - ($sumX * $sumX);
echo "    n × Σx² = $n × $sumX2 = " . ($n * $sumX2) . "\n";
echo "    (Σx)² = $sumXSquared\n";
echo "    Denominator = (n × Σx²) - (Σx)² = " . ($n * $sumX2) . " - $sumXSquared = $denominator\n\n";

echo "  Final calculation:\n";
$slope = $denominator != 0 ? $numerator / $denominator : 0;
echo "    Slope (m) = $numerator / $denominator\n";
echo "    Slope (m) = " . round($slope, 6) . "\n";
echo "    Slope (m) = " . round($slope, 4) . " (rounded to 4 decimal places)\n\n";

echo str_repeat("=", 80) . "\n";
echo "TREND INTERPRETATION:\n";
echo str_repeat("=", 80) . "\n\n";

if ($slope > 0.1) {
    echo "  ✓ POSITIVE TREND: Production is INCREASING\n";
    echo "  → Production is going up by approximately " . round($slope, 2) . " units per day\n";
    echo "  → This means production is trending upward over time\n";
} elseif ($slope < -0.1) {
    echo "  ✓ NEGATIVE TREND: Production is DECREASING\n";
    echo "  → Production is going down by approximately " . round(abs($slope), 2) . " units per day\n";
    echo "  → This means production is trending downward over time\n";
} else {
    echo "  ✓ STABLE: No significant trend detected\n";
    echo "  → Production is relatively stable (slope is close to zero)\n";
    echo "  → This means production is consistent over time\n";
}
echo "\n";

echo str_repeat("=", 80) . "\n";
echo "AVERAGE DAILY OUTPUT CALCULATION:\n";
echo str_repeat("=", 80) . "\n\n";
$avgDailyOutput = $sumY / $n;
echo "  Average = Total Output / Number of Days\n";
echo "  Average = $sumY / $n\n";
echo "  Average = " . round($avgDailyOutput, 6) . " units/day\n";
echo "  Average = " . round($avgDailyOutput, 2) . " units/day (rounded)\n\n";

echo str_repeat("=", 80) . "\n";
echo "HOW TREND IS APPLIED TO PREDICTIONS:\n";
echo str_repeat("=", 80) . "\n\n";
echo "  Formula: Predicted Output = Average + (Trend × Days into Future / Total Forecast Days)\n";
echo "  Forecast Period: 30 days\n\n";

echo "  Example Predictions:\n";
echo str_repeat("-", 80) . "\n";
echo sprintf("%-10s | %-20s | %-45s\n", "Day", "Predicted Output", "Calculation");
echo str_repeat("-", 80) . "\n";

$forecastDays = 30;
$exampleDays = [1, 2, 3, 7, 15, 30];

foreach ($exampleDays as $i) {
    $trendAdjustment = $slope * ($i / $forecastDays);
    $predicted = $avgDailyOutput + $trendAdjustment;
    
    $trendPart = round($slope, 4) . " × $i/$forecastDays";
    $adjustmentValue = round($trendAdjustment, 4);
    $calculation = round($avgDailyOutput, 2) . " + ($trendPart) = " . round($avgDailyOutput, 2) . " + " . $adjustmentValue . " = " . round($predicted, 2);
    
    echo sprintf("%-10s | %-20s | %s\n", 
        "Day $i", 
        round($predicted, 2) . " units",
        $calculation
    );
}

echo str_repeat("-", 80) . "\n\n";

echo str_repeat("=", 80) . "\n";
echo "VISUAL REPRESENTATION:\n";
echo str_repeat("=", 80) . "\n\n";

// Find min and max for scaling
$minOutput = min(array_column($productionData, 'output'));
$maxOutput = max(array_column($productionData, 'output'));
$range = $maxOutput - $minOutput;
$scale = max(20, $range);

echo "  Output (units)\n";
for ($i = $maxOutput + 2; $i >= max(0, $minOutput - 2); $i -= max(1, floor($range / 10))) {
    $line = sprintf("%4d |", $i);
    foreach ($productionData as $data) {
        $rounded = round($data['output']);
        if ($rounded == $i || ($rounded > $i - 0.5 && $rounded < $i + 0.5)) {
            $line .= " ●";
        } else {
            $line .= "  ";
        }
    }
    echo $line . "\n";
}

echo "      +";
for ($i = 1; $i <= $n; $i++) {
    echo "--";
}
echo "\n";
echo "       ";
for ($i = 1; $i <= $n; $i++) {
    echo sprintf("%2d", $i);
}
echo " (Days)\n\n";

echo "  Trend Line: " . ($slope > 0 ? "INCREASING ↗" : ($slope < 0 ? "DECREASING ↘" : "STABLE →")) . "\n";
echo "  Slope: " . round($slope, 4) . " units per day\n\n";

echo str_repeat("=", 80) . "\n";
echo "SUMMARY:\n";
echo str_repeat("=", 80) . "\n\n";
echo "  • Total Days Analyzed: $n days\n";
echo "  • Total Output: $sumY units\n";
echo "  • Average Daily Output: " . round($avgDailyOutput, 2) . " units/day\n";
echo "  • Trend (Slope): " . round($slope, 4) . " units/day\n";
echo "  • Trend Direction: " . ($slope > 0.1 ? "INCREASING" : ($slope < -0.1 ? "DECREASING" : "STABLE")) . "\n";
echo "  • Impact on Predictions: " . ($slope > 0 ? "Future predictions will be slightly higher than average" : ($slope < 0 ? "Future predictions will be slightly lower than average" : "Future predictions will match the average")) . "\n\n";

