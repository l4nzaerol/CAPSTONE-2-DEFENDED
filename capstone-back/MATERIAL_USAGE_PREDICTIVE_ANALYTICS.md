# Material Usage Predictive Analytics - Technical Documentation

## Overview

The Material Usage Predictive Analytics system forecasts future inventory consumption based on historical Alkansya daily output data and material consumption transactions. This system meets the objective: **"utilize predictive analytics to forecast material usage - establish current inventory-on-hand and forecast future use of inventory"**.

## How It Works

### 1. Data Sources

The system uses **two primary data sources** for accurate forecasting:

#### A. Historical Daily Output Records (`alkansya_daily_outputs` table)
- Contains actual production quantities per day
- Includes both seeded data and manually entered records
- Provides the foundation for output prediction

#### B. Historical Material Consumption Transactions (`inventory_transactions` table)
- Records actual material consumption from production
- Transaction type: `ALKANSYA_CONSUMPTION`
- Contains material quantities consumed per day
- More accurate than theoretical calculations

### 2. Predictive Analytics Methodology

#### Step 1: Historical Data Collection
```php
// Get daily output records
$historicalOutput = AlkansyaDailyOutput::where('date', '>=', Carbon::now()->subDays($historicalDays))
    ->orderBy('date', 'asc')
    ->get();

// Get material consumption transactions
$historicalTransactions = InventoryTransaction::where('transaction_type', 'ALKANSYA_CONSUMPTION')
    ->where('timestamp', '>=', Carbon::now()->subDays($historicalDays))
    ->with('material')
    ->get();
```

#### Step 2: Calculate Average Daily Output
- Sum all historical daily outputs
- Divide by number of days with actual output
- Formula: `avgDailyOutput = totalOutput / actualDaysWithOutput`

#### Step 3: Material Usage Calculation (Two Methods)

**Method A: Using Historical Transactions (Preferred - More Accurate)**
- Extract material consumption from actual transactions
- Group by date and material
- Calculate moving averages:
  - 7-day moving average (60% weight)
  - 14-day moving average (40% weight)
- Formula: `dailyMaterialUsage = (movingAvg7 * 0.6) + (movingAvg14 * 0.4)`

**Method B: Using BOM and Average Output (Fallback)**
- If no transaction data available
- Formula: `dailyMaterialUsage = avgDailyOutput * qty_per_unit`
- Where `qty_per_unit` comes from Bill of Materials (BOM)

#### Step 4: Trend Analysis
- Uses linear regression to detect trends in output
- Calculates slope of output over time
- Applies trend to future predictions
- Formula: `predictedOutput = avgDailyOutput + (trend * days_into_future)`

#### Step 5: Forecast Generation

For each day in the forecast period:
1. **Predict Output**: Apply trend-adjusted average daily output
2. **Calculate Material Usage**: For each material in BOM:
   - `materialUsage = predictedOutput * qty_per_unit`
3. **Total Material Usage**: Sum all material usages for that day
   - `totalMaterialUsage = Σ(predictedOutput * qty_per_unit) for all materials`

### 3. Material Forecast Summary

For each material, the system calculates:

- **Current Stock**: Current inventory-on-hand
- **Daily Material Usage**: Predicted daily consumption
- **Forecasted Usage**: Total usage over forecast period
- **Projected Stock**: `currentStock - forecastedUsage`
- **Days Until Stockout**: `currentStock / dailyMaterialUsage`
- **Needs Reorder**: `projectedStock <= reorder_point`

### 4. Key Features

#### A. Accuracy Improvements
- Uses actual transaction data when available (more accurate)
- Falls back to BOM calculations when transaction data is missing
- Applies trend analysis for better future predictions

#### B. Predictive Analytics Techniques
1. **Moving Averages**: Smooths out daily variations
2. **Weighted Averages**: Recent data has more influence
3. **Linear Regression**: Detects and applies trends
4. **Historical Pattern Recognition**: Learns from past consumption

#### C. Inventory Management Integration
- Establishes current inventory-on-hand (from Material model)
- Forecasts future use (based on historical patterns)
- Identifies materials needing reorder
- Calculates days until stockout

## Data Flow

```
Historical Data Sources
    ↓
[Daily Output Records] + [Material Consumption Transactions]
    ↓
Calculate Average Daily Output
    ↓
Calculate Material Usage Patterns (Moving Averages)
    ↓
Apply Trend Analysis
    ↓
Generate Daily Forecast Timeline
    ↓
Calculate Material Forecast Summary
    ↓
Return Forecast Data (Output + Material Usage)
```

## API Endpoint

**GET** `/api/inventory/alkansya-material-forecast`

**Parameters:**
- `forecast_days` (default: 30) - Number of days to forecast
- `historical_days` (default: 30) - Number of historical days to analyze

**Response Structure:**
```json
{
  "forecast_type": "alkansya_materials",
  "forecast_period": 30,
  "historical_period": 30,
  "avg_daily_output": 15.5,
  "total_historical_output": 465,
  "actual_days_with_output": 30,
  "material_forecasts": [
    {
      "material_id": 1,
      "material_name": "Plywood",
      "daily_material_usage": 0.2,
      "forecasted_usage": 6.0,
      "current_stock": 50.0,
      "projected_stock": 44.0,
      "days_until_stockout": 250,
      "needs_reorder": false
    }
  ],
  "daily_forecast": [
    {
      "date": "2025-11-07",
      "predicted_output": 15.5,
      "total_material_usage": 2.5
    }
  ],
  "summary": {
    "materials_analyzed": 13,
    "materials_needing_reorder": 2,
    "total_daily_material_usage": 2.5
  },
  "predictive_analytics": {
    "method": "Moving Average with Trend Analysis",
    "data_source": "Historical Transactions + Daily Output Records"
  }
}
```

## Benefits

1. **Accurate Forecasting**: Uses actual historical consumption data
2. **Proactive Inventory Management**: Identifies materials needing reorder before stockout
3. **Cost Optimization**: Helps plan purchases based on predicted needs
4. **Data-Driven Decisions**: Based on real production patterns, not estimates

## Maintenance

- Ensure daily output records are created (seeder or manual entry)
- Ensure material consumption transactions are created automatically
- Run backfill command if transactions are missing: `php artisan alkansya:backfill-transactions`

