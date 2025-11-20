<?php

/**
 * Interactive Demo: How Trend Analysis Works
 * 
 * This script demonstrates step-by-step how the trend (slope) is calculated
 * using linear regression on production data.
 */

echo "=== Trend Analysis Step-by-Step Demo ===\n\n";

// Example production data (your actual recent data)
$productionData = [
    8,   // Day 1: 2025-10-27
    13,  // Day 2: 2025-10-28
    24,  // Day 3: 2025-10-29
    26,  // Day 4: 2025-10-30
    16,  // Day 5: 2025-10-31
    19,  // Day 6: 2025-11-01
    6,   // Day 7: 2025-11-03
    9,   // Day 8: 2025-11-04
    17,  // Day 9: 2025-11-05
    25,  // Day 10: 2025-11-06
];

echo "Production Data:\n";
echo str_repeat("-", 50) . "\n";
echo sprintf("%-8s | %-10s | %-10s | %-10s | %-10s\n", "Day", "Output (y)", "Day # (x)", "x × y", "x²");
echo str_repeat("-", 50) . "\n";

$sumX = 0;
$sumY = 0;
$sumXY = 0;
$sumX2 = 0;
$n = count($productionData);

foreach ($productionData as $index => $value) {
    $x = $index + 1;  // Day number
    $y = $value;      // Output quantity
    $xy = $x * $y;    // Day × Output
    $x2 = $x * $x;    // Day²
    
    $sumX += $x;
    $sumY += $y;
    $sumXY += $xy;
    $sumX2 += $x2;
    
    echo sprintf("%-8s | %-10s | %-10s | %-10s | %-10s\n", 
        "Day $x", 
        $y . " units", 
        $x, 
        $xy, 
        $x2
    );
}

echo str_repeat("-", 50) . "\n";
echo sprintf("%-8s | %-10s | %-10s | %-10s | %-10s\n", 
    "TOTAL", 
    $sumY . " units", 
    $sumX, 
    $sumXY, 
    $sumX2
);
echo str_repeat("-", 50) . "\n\n";

echo "Step 1: Count data points\n";
echo "  n = $n\n\n";

echo "Step 2: Calculate sums\n";
echo "  Σx  = Sum of day numbers = $sumX\n";
echo "  Σy  = Sum of output quantities = $sumY\n";
echo "  Σxy = Sum of (day × output) = $sumXY\n";
echo "  Σx² = Sum of (day²) = $sumX2\n\n";

echo "Step 3: Apply linear regression formula\n";
echo "  Slope (m) = (n × Σxy - Σx × Σy) / (n × Σx² - (Σx)²)\n";
$sumXSquared = $sumX * $sumX;
echo "  Slope (m) = ($n × $sumXY - $sumX × $sumY) / ($n × $sumX2 - $sumXSquared)\n";

$numerator = ($n * $sumXY) - ($sumX * $sumY);
$denominator = ($n * $sumX2) - ($sumX * $sumX);
$slope = $denominator != 0 ? $numerator / $denominator : 0;

echo "  Slope (m) = $numerator / $denominator\n";
echo "  Slope (m) = " . round($slope, 4) . "\n\n";

echo "Step 4: Interpret the result\n";
if ($slope > 0.1) {
    echo "  ✓ POSITIVE TREND: Production is INCREASING\n";
    echo "  → Production is going up by approximately " . round($slope, 2) . " units per day\n";
} elseif ($slope < -0.1) {
    echo "  ✓ NEGATIVE TREND: Production is DECREASING\n";
    echo "  → Production is going down by approximately " . round(abs($slope), 2) . " units per day\n";
} else {
    echo "  ✓ STABLE: No significant trend detected\n";
    echo "  → Production is relatively stable\n";
}
echo "\n";

echo "Step 5: Calculate average daily output\n";
$avgDailyOutput = $sumY / $n;
echo "  Average = Total Output / Number of Days\n";
echo "  Average = $sumY / $n = " . round($avgDailyOutput, 2) . " units/day\n\n";

echo "Step 6: Apply trend to predictions\n";
echo "  Formula: Predicted = Average + (Trend × Days into Future / Total Forecast Days)\n";
echo "  Forecast Period: 30 days\n\n";

echo "Example Predictions:\n";
echo str_repeat("-", 60) . "\n";
echo sprintf("%-10s | %-20s | %-25s\n", "Day", "Predicted Output", "Calculation");
echo str_repeat("-", 60) . "\n";

$forecastDays = 30;
for ($i = 1; $i <= 5; $i++) {
    $trendAdjustment = $slope * ($i / $forecastDays);
    $predicted = $avgDailyOutput + $trendAdjustment;
    
    $calculation = round($avgDailyOutput, 2) . " + (" . round($slope, 4) . " × $i/$forecastDays)";
    $calculation .= " = " . round($predicted, 2);
    
    echo sprintf("%-10s | %-20s | %s\n", 
        "Day $i", 
        round($predicted, 2) . " units",
        $calculation
    );
}

echo str_repeat("-", 60) . "\n\n";

echo "Visual Representation:\n";
echo "  Output\n";
echo "   30 |\n";
echo "      |\n";
echo "   25 |\n";
echo "      |\n";
echo "   20 |\n";
echo "      |\n";
echo "   15 |\n";
echo "      |\n";
echo "   10 |\n";
echo "      |\n";
echo "    5 |\n";
echo "      |\n";
echo "    0 +----+----+----+----+----+----+----+----+----+----+ Days\n";
echo "      1    2    3    4    5    6    7    8    9    10\n";
echo "\n";
echo "  The trend line shows: " . ($slope > 0 ? "INCREASING" : ($slope < 0 ? "DECREASING" : "STABLE")) . "\n";
echo "  Slope: " . round($slope, 4) . " units per day\n\n";

echo "=== Summary ===\n";
echo "The trend analysis detected a " . ($slope > 0 ? "positive" : ($slope < 0 ? "negative" : "neutral")) . " trend.\n";
echo "This means production is " . ($slope > 0 ? "increasing" : ($slope < 0 ? "decreasing" : "stable")) . " over time.\n";
echo "Future predictions will account for this trend, gradually adjusting the average.\n";

