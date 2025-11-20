# Predictive Output Analytics - How It Works

## Overview

The predictive output system forecasts future Alkansya production quantities using historical daily output data and statistical analysis techniques including moving averages and linear regression.

## Step-by-Step Process

### Step 1: Historical Data Collection

The system collects historical daily output records from the `alkansya_daily_outputs` table:

```php
$historicalOutput = AlkansyaDailyOutput::where('date', '>=', Carbon::now()->subDays($historicalDays))
    ->orderBy('date', 'asc')
    ->get();
```

**Example Data:**
```
Date        | Quantity Produced
------------|------------------
2025-10-23  | 15
2025-10-24  | 18
2025-10-25  | 12
2025-10-26  | 20
2025-10-27  | 16
...         | ...
2025-11-05  | 14
2025-11-06  | 17
```

### Step 2: Calculate Average Daily Output

The system calculates the average daily output from actual historical data:

```php
$actualDaysWithOutput = $historicalOutput->count();  // Number of days with production
$totalOutput = $historicalOutput->sum('quantity_produced');  // Sum of all production
$avgDailyOutput = $actualDaysWithOutput > 0 ? $totalOutput / $actualDaysWithOutput : 0;
```

**Formula:**
```
Average Daily Output = Total Output / Number of Days with Output
```

**Example Calculation:**
- Total Output (14 days): 210 units
- Days with Output: 14 days
- Average Daily Output: 210 / 14 = **15.0 units/day**

### Step 3: Trend Analysis (Linear Regression)

The system uses **linear regression** to detect trends in production output over time:

```php
private function calculateOutputTrend($outputData)
{
    // Linear regression formula: y = mx + b
    // Where m (slope) indicates the trend direction and magnitude
    
    $n = count($outputData);
    $sumX = 0;   // Sum of day numbers (1, 2, 3, ...)
    $sumY = 0;   // Sum of output quantities
    $sumXY = 0;  // Sum of (day × quantity)
    $sumX2 = 0;  // Sum of (day²)
    
    foreach ($outputData as $index => $value) {
        $x = $index + 1;  // Day number (1, 2, 3, ...)
        $y = $value;      // Output quantity
        
        $sumX += $x;
        $sumY += $y;
        $sumXY += $x * $y;
        $sumX2 += $x * $x;
    }
    
    // Calculate slope (trend)
    $slope = ($n * $sumXY - $sumX * $sumY) / ($n * $sumX2 - $sumX * $sumX);
    
    return $slope;
}
```

**What the Trend Means:**
- **Positive slope** (e.g., +0.2): Production is **increasing** over time
- **Negative slope** (e.g., -0.1): Production is **decreasing** over time
- **Zero slope** (0): Production is **stable** (no trend)

**Example:**
If historical data shows: [12, 14, 15, 16, 17, 18]
- Trend (slope) = +1.0 (increasing by ~1 unit per day)

### Step 4: Apply Trend to Future Predictions

For each day in the forecast period, the system applies the trend to the average daily output:

```php
for ($i = 1; $i <= $forecastDays; $i++) {
    $date = Carbon::now()->addDays($i)->format('Y-m-d');
    
    // Start with average daily output
    $predictedOutput = $avgDailyOutput;
    
    // Apply trend if it exists
    if ($predictedOutputTrend != 0 && $i > 1) {
        // Apply trend gradually over the forecast period
        $predictedOutput = $avgDailyOutput + ($predictedOutputTrend * ($i / $forecastDays));
    }
    
    $dailyForecast[] = [
        'date' => $date,
        'predicted_output' => round($predictedOutput, 2)
    ];
}
```

**Formula:**
```
Predicted Output = Average Daily Output + (Trend × Days into Future / Total Forecast Days)
```

**Example Calculation:**

**Scenario 1: No Trend (Stable Production)**
- Average Daily Output: 15.0 units
- Trend: 0
- Day 1: 15.0 + (0 × 1/30) = **15.0 units**
- Day 7: 15.0 + (0 × 7/30) = **15.0 units**
- Day 30: 15.0 + (0 × 30/30) = **15.0 units**

**Scenario 2: Increasing Trend**
- Average Daily Output: 15.0 units
- Trend: +0.1 (increasing by 0.1 units per day)
- Day 1: 15.0 + (0.1 × 1/30) = **15.003 ≈ 15.0 units**
- Day 7: 15.0 + (0.1 × 7/30) = **15.023 ≈ 15.02 units**
- Day 30: 15.0 + (0.1 × 30/30) = **15.1 units**

**Scenario 3: Decreasing Trend**
- Average Daily Output: 15.0 units
- Trend: -0.05 (decreasing by 0.05 units per day)
- Day 1: 15.0 + (-0.05 × 1/30) = **14.998 ≈ 15.0 units**
- Day 7: 15.0 + (-0.05 × 7/30) = **14.988 ≈ 14.99 units**
- Day 30: 15.0 + (-0.05 × 30/30) = **14.95 units**

## Real-World Example

### Historical Data (Last 14 Days):
```
Date        | Output
------------|-------
2025-10-23  | 15
2025-10-24  | 16
2025-10-25  | 14
2025-10-26  | 17
2025-10-27  | 15
2025-10-28  | 18
2025-10-29  | 16
2025-10-30  | 15
2025-10-31  | 17
2025-11-01  | 14
2025-11-02  | 16
2025-11-03  | 15
2025-11-04  | 18
2025-11-05  | 16
2025-11-06  | 17
```

### Calculations:

1. **Average Daily Output:**
   - Total: 230 units
   - Days: 14
   - Average: 230 / 14 = **16.43 units/day**

2. **Trend Analysis:**
   - Using linear regression on [15, 16, 14, 17, 15, 18, 16, 15, 17, 14, 16, 15, 18, 16, 17]
   - Slope ≈ **+0.07** (slight increasing trend)

3. **Prediction for 2025-11-07 (Day 1 of forecast):**
   - Predicted = 16.43 + (0.07 × 1/30)
   - Predicted = 16.43 + 0.0023
   - Predicted = **16.43 units** (rounded to 16.43)

4. **Prediction for 2025-11-15 (Day 9 of forecast):**
   - Predicted = 16.43 + (0.07 × 9/30)
   - Predicted = 16.43 + 0.021
   - Predicted = **16.45 units**

5. **Prediction for 2025-12-06 (Day 30 of forecast):**
   - Predicted = 16.43 + (0.07 × 30/30)
   - Predicted = 16.43 + 0.07
   - Predicted = **16.50 units**

## Why 15.07 Units?

If you're seeing **15.07 units** as the predicted output, it means:

1. **Average Daily Output** from historical data = ~15.0 units
2. **Trend** is slightly positive (increasing)
3. The prediction is for a day early in the forecast period (Day 1-2)
4. The trend adjustment adds a small increment: 15.0 + (small trend × small day ratio) = **15.07**

## Key Features

### 1. **Data-Driven Predictions**
- Uses actual historical production data
- No assumptions or estimates

### 2. **Trend Detection**
- Automatically detects if production is increasing, decreasing, or stable
- Applies trend gradually over the forecast period

### 3. **Adaptive**
- If no historical data exists, uses default estimate (15 units/day)
- Adjusts predictions based on recent patterns

### 4. **Gradual Trend Application**
- Trend is applied gradually, not all at once
- Prevents unrealistic jumps in predictions
- Formula: `(Trend × Days into Future / Total Forecast Days)`

## Limitations and Considerations

1. **Assumes Continuity**: Predictions assume production patterns will continue
2. **No External Factors**: Doesn't account for holidays, supply chain issues, or demand changes
3. **Linear Trend Only**: Uses linear regression (straight line), not exponential or seasonal patterns
4. **Historical Period**: Default is 30 days; may need adjustment for seasonal businesses

## Improving Accuracy

To improve prediction accuracy:

1. **More Historical Data**: Increase `historical_days` parameter
2. **Regular Updates**: Ensure daily output records are consistently entered
3. **Manual Adjustments**: Consider external factors (holidays, events) when interpreting predictions
4. **Seasonal Analysis**: For seasonal patterns, consider separate models for different periods

