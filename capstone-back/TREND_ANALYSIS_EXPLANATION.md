# Trend Analysis - How It Works

## Overview

The trend analysis uses **Linear Regression** to detect if production is increasing, decreasing, or stable over time. It calculates a "slope" that indicates the direction and rate of change.

## What is Linear Regression?

Linear regression finds the "best fit" straight line through your data points. The slope of this line tells us:
- **Positive slope**: Production is **increasing** over time
- **Negative slope**: Production is **decreasing** over time  
- **Zero slope**: Production is **stable** (no trend)

## The Formula

The system uses the **Least Squares Method** to calculate the slope:

```
Slope (m) = (n × Σ(xy) - Σ(x) × Σ(y)) / (n × Σ(x²) - (Σ(x))²)
```

Where:
- `n` = number of data points
- `x` = day number (1, 2, 3, ...)
- `y` = output quantity for that day
- `Σ` = sum of

## Step-by-Step Calculation

### Example Data:
```
Day | Date       | Output (y) | Day # (x) | x × y  | x²
----|------------|------------|-----------|--------|----
1   | 2025-10-27 | 8          | 1         | 8      | 1
2   | 2025-10-28 | 13         | 2         | 26     | 4
3   | 2025-10-29 | 24         | 3         | 72     | 9
4   | 2025-10-30 | 26         | 4         | 104    | 16
5   | 2025-10-31 | 16         | 5         | 80     | 25
6   | 2025-11-01 | 19         | 6         | 114    | 36
7   | 2025-11-03 | 6          | 7         | 42     | 49
8   | 2025-11-04 | 9          | 8         | 72     | 64
9   | 2025-11-05 | 17         | 9         | 153    | 81
10  | 2025-11-06 | 25         | 10        | 250    | 100
```

### Calculation:

1. **Count data points (n):**
   ```
   n = 10
   ```

2. **Sum of day numbers (Σx):**
   ```
   Σx = 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 = 55
   ```

3. **Sum of output quantities (Σy):**
   ```
   Σy = 8 + 13 + 24 + 26 + 16 + 19 + 6 + 9 + 17 + 25 = 157
   ```

4. **Sum of (day × output) (Σxy):**
   ```
   Σxy = 8 + 26 + 72 + 104 + 80 + 114 + 42 + 72 + 153 + 250 = 921
   ```

5. **Sum of (day²) (Σx²):**
   ```
   Σx² = 1 + 4 + 9 + 16 + 25 + 36 + 49 + 64 + 81 + 100 = 385
   ```

6. **Calculate slope:**
   ```
   Slope = (n × Σxy - Σx × Σy) / (n × Σx² - (Σx)²)
   Slope = (10 × 921 - 55 × 157) / (10 × 385 - 55²)
   Slope = (9210 - 8635) / (3850 - 3025)
   Slope = 575 / 825
   Slope = 0.697
   ```

### Result Interpretation:

- **Slope = +0.697**: Production is **increasing** by approximately **0.7 units per day** on average
- This is a **positive trend** - production is going up over time

## Visual Representation

```
Output
 30 |                          ●
    |                     ●
 25 |                          ●
    |              ●
 20 |         ●
    |    ●
 15 |              ●
    |         ●
 10 |    ●
    |●
  5 |
    |
  0 +----+----+----+----+----+----+----+----+----+----+ Days
    1    2    3    4    5    6    7    8    9    10

    The line shows the trend (increasing upward)
```

## How Trend is Applied to Predictions

Once the trend (slope) is calculated, it's applied to future predictions:

### Formula:
```
Predicted Output = Average Daily Output + (Trend × Days into Future / Total Forecast Days)
```

### Example:

**Given:**
- Average Daily Output: 15.07 units
- Trend (slope): +0.697 units/day
- Forecast Period: 30 days

**Predictions:**
- **Day 1**: 15.07 + (0.697 × 1/30) = 15.07 + 0.023 = **15.09 units**
- **Day 7**: 15.07 + (0.697 × 7/30) = 15.07 + 0.163 = **15.23 units**
- **Day 15**: 15.07 + (0.697 × 15/30) = 15.07 + 0.349 = **15.42 units**
- **Day 30**: 15.07 + (0.697 × 30/30) = 15.07 + 0.697 = **15.77 units**

## Different Trend Scenarios

### Scenario 1: Strong Increasing Trend
```
Data: [10, 12, 14, 16, 18, 20, 22, 24]
Slope: +2.0
Interpretation: Production increasing by 2 units per day
```

### Scenario 2: Decreasing Trend
```
Data: [25, 23, 21, 19, 17, 15, 13, 11]
Slope: -2.0
Interpretation: Production decreasing by 2 units per day
```

### Scenario 3: Stable (No Trend)
```
Data: [15, 16, 15, 15, 16, 15, 15, 16]
Slope: ~0.0
Interpretation: Production is stable, no significant trend
```

### Scenario 4: Volatile (Variable Trend)
```
Data: [10, 25, 8, 20, 12, 18, 6, 22]
Slope: ~0.5 (small positive)
Interpretation: Production varies but slightly increasing overall
```

## Code Implementation

```php
private function calculateOutputTrend($outputData)
{
    if (count($outputData) < 2) return 0;
    
    $n = count($outputData);
    $sumX = 0;   // Sum of day numbers
    $sumY = 0;   // Sum of output quantities
    $sumXY = 0;  // Sum of (day × output)
    $sumX2 = 0;  // Sum of (day²)
    
    foreach ($outputData as $index => $value) {
        $x = $index + 1;  // Day number (1, 2, 3, ...)
        $y = $value;      // Output quantity
        
        $sumX += $x;
        $sumY += $y;
        $sumXY += $x * $y;
        $sumX2 += $x * $x;
    }
    
    // Calculate slope using linear regression formula
    $slope = ($n * $sumXY - $sumX * $sumY) / ($n * $sumX2 - $sumX * $sumX);
    
    return $slope;
}
```

## Why Gradual Application?

The trend is applied **gradually** over the forecast period, not all at once:

```
Day 1:  Average + (Trend × 1/30)   = Small adjustment
Day 15: Average + (Trend × 15/30)  = Medium adjustment
Day 30: Average + (Trend × 30/30) = Full trend applied
```

**Reason:** This prevents unrealistic jumps in predictions. A gradual application is more realistic and accounts for the fact that trends may not continue indefinitely.

## Real-World Example from Your Data

From your actual data:
- **Historical Output**: [8, 13, 24, 26, 16, 19, 6, 9, 17, 25, ...]
- **Calculated Trend**: +0.5253
- **Interpretation**: Production is increasing by about 0.53 units per day

**What this means:**
- Your production has been **increasing** over the last 14 days
- The system predicts this trend will continue (gradually)
- Future predictions will be slightly higher than the average

## Limitations

1. **Assumes Linear Trend**: Uses straight-line regression, not exponential or seasonal patterns
2. **Requires Minimum Data**: Needs at least 2 data points (more is better)
3. **No External Factors**: Doesn't account for holidays, supply issues, or demand changes
4. **Short-term Focus**: Best for short-term predictions (30 days)

## Improving Trend Accuracy

1. **More Historical Data**: More data points = more accurate trend
2. **Consistent Recording**: Ensure daily outputs are recorded consistently
3. **Remove Outliers**: Consider removing unusual days (holidays, shutdowns)
4. **Seasonal Adjustments**: For seasonal businesses, use separate models

## Summary

The trend analysis:
1. ✅ Uses **linear regression** to find the best-fit line through your data
2. ✅ Calculates a **slope** that indicates direction and rate of change
3. ✅ Applies the trend **gradually** to future predictions
4. ✅ Helps predict if production will increase, decrease, or stay stable
5. ✅ Makes predictions more accurate by accounting for patterns in your data

**Your Current Trend: +0.5253** means production is **increasing** and will likely continue to increase gradually over the next 30 days.

