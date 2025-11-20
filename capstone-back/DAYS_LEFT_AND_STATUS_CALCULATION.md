# Days Left and Status Calculation - Complete Guide

## Overview

The "Days Left" (also called "Days Until Stockout") and "Status" values in the Material Forecast Summary are calculated based on:
1. **Current Inventory-on-Hand** (current stock)
2. **Daily Material Usage** (predicted consumption rate)
3. **Reorder Point** (threshold for reordering)

## Step-by-Step Calculation

### Step 1: Calculate Daily Material Usage

The system first calculates how much of each material will be consumed per day:

#### Method A: Using Historical Transactions (Preferred)
```php
// Get historical material consumption from transactions
$historicalMaterialUsage = [/* array of daily usage values */];

// Calculate moving averages
$movingAvg7 = average of last 7 days
$movingAvg14 = average of last 14 days

// Weighted average (recent data has more weight)
$dailyMaterialUsage = (movingAvg7 × 0.6) + (movingAvg14 × 0.4)
```

#### Method B: Using BOM and Average Output (Fallback)
```php
// If no historical transaction data available
$dailyMaterialUsage = avgDailyOutput × qty_per_unit

Where:
- avgDailyOutput = Average Alkansya units produced per day
- qty_per_unit = Quantity of material needed per Alkansya (from BOM)
```

**Example:**
- Average Daily Output: 15.07 Alkansya units/day
- Pin Nail F30: 14.0 pcs per Alkansya (from BOM)
- Daily Material Usage = 15.07 × 14.0 = **210.98 pcs/day**

### Step 2: Calculate Days Left (Days Until Stockout)

The formula is simple:

```php
Days Left = floor(Current Stock / Daily Material Usage)
```

**Formula:**
```
Days Left = Current Inventory ÷ Daily Material Usage
```

**Example Calculations:**

#### Example 1: Pin Nail F30
- Current Stock: 1,900 pcs
- Daily Material Usage: 210.98 pcs/day
- Days Left = 1,900 ÷ 210.98 = **9.0 days**

#### Example 2: Pinewood 1x4x8ft
- Current Stock: 2,000 pcs
- Daily Material Usage: 0.1955 pcs/day (15.07 × 0.0029)
- Days Left = 2,000 ÷ 0.1955 = **10,227 days**

#### Example 3: Black Screw 1 1/2
- Current Stock: 540 pcs
- Daily Material Usage: 60.28 pcs/day (15.07 × 4.0)
- Days Left = 540 ÷ 60.28 = **9.0 days**

### Step 3: Determine Status (OK or Reorder)

The status is determined by comparing the **Projected Stock** with the **Reorder Point**:

```php
// Calculate projected stock after forecast period
$projectedStock = $currentStock - $forecastedUsage

// Determine if reorder is needed
$needsReorder = $projectedStock <= $reorderPoint
```

**Formula:**
```
Status = "Reorder" if Projected Stock ≤ Reorder Point
Status = "OK" if Projected Stock > Reorder Point
```

**Where:**
- **Projected Stock** = Current Stock - Forecasted Usage (over 30 days)
- **Forecasted Usage** = Daily Material Usage × Forecast Days (30)
- **Reorder Point** = Material's reorder_level field (threshold value)

**Example Calculations:**

#### Example 1: Pin Nail F30 (Status: Reorder)
- Current Stock: 1,900 pcs
- Daily Material Usage: 210.98 pcs/day
- Forecasted Usage (30 days): 210.98 × 30 = 6,329.4 pcs
- Projected Stock: 1,900 - 6,329.4 = **-4,429.4 pcs** (negative!)
- Reorder Point: 500 pcs (example)
- Status: **Reorder** (because -4,429.4 ≤ 500)

#### Example 2: Pinewood 1x4x8ft (Status: OK)
- Current Stock: 2,000 pcs
- Daily Material Usage: 0.1955 pcs/day
- Forecasted Usage (30 days): 0.1955 × 30 = 5.865 pcs
- Projected Stock: 2,000 - 5.865 = **1,994.135 pcs**
- Reorder Point: 100 pcs (example)
- Status: **OK** (because 1,994.135 > 100)

## Complete Calculation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Get Historical Data                                  │
│    - Daily output records                               │
│    - Material consumption transactions                   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Calculate Average Daily Output                       │
│    Average = Total Output / Number of Days             │
│    Example: 211 units / 14 days = 15.07 units/day      │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Calculate Daily Material Usage                       │
│    Option A: From historical transactions               │
│      Daily Usage = Weighted Moving Average               │
│    Option B: From BOM and average output                │
│      Daily Usage = Avg Output × qty_per_unit            │
│    Example: 15.07 × 14.0 = 210.98 pcs/day              │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Calculate Days Left                                  │
│    Days Left = Current Stock / Daily Material Usage    │
│    Example: 1,900 / 210.98 = 9.0 days                   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Calculate Forecasted Usage                            │
│    Forecasted Usage = Daily Usage × Forecast Days        │
│    Example: 210.98 × 30 = 6,329.4 pcs                  │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Calculate Projected Stock                            │
│    Projected Stock = Current Stock - Forecasted Usage  │
│    Example: 1,900 - 6,329.4 = -4,429.4 pcs            │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Determine Status                                     │
│    If Projected Stock ≤ Reorder Point: "Reorder"       │
│    If Projected Stock > Reorder Point: "OK"            │
│    Example: -4,429.4 ≤ 500 → "Reorder"                 │
└─────────────────────────────────────────────────────────┘
```

## Real-World Examples from Your Data

### Example 1: Pin Nail F30 (Reorder Status)

**Input Data:**
- Current Stock: 1,900 pcs
- BOM Quantity: 14.0 pcs per Alkansya
- Average Daily Output: 15.07 Alkansya units/day
- Reorder Point: 500 pcs (assumed)

**Calculations:**
1. Daily Material Usage = 15.07 × 14.0 = **210.98 pcs/day**
2. Days Left = 1,900 ÷ 210.98 = **9.0 days**
3. Forecasted Usage (30 days) = 210.98 × 30 = **6,329.4 pcs**
4. Projected Stock = 1,900 - 6,329.4 = **-4,429.4 pcs**
5. Status = **Reorder** (because -4,429.4 ≤ 500)

**Result:**
- Days Left: **9 days** (Yellow - Warning)
- Status: **Reorder** (Yellow - Warning)

### Example 2: Pinewood 1x4x8ft (OK Status)

**Input Data:**
- Current Stock: 2,000 pcs
- BOM Quantity: 0.0029 pcs per Alkansya
- Average Daily Output: 15.07 Alkansya units/day
- Reorder Point: 100 pcs (assumed)

**Calculations:**
1. Daily Material Usage = 15.07 × 0.0029 = **0.0437 pcs/day**
2. Days Left = 2,000 ÷ 0.0437 = **45,766 days** (very high!)
3. Forecasted Usage (30 days) = 0.0437 × 30 = **1.311 pcs**
4. Projected Stock = 2,000 - 1.311 = **1,998.689 pcs**
5. Status = **OK** (because 1,998.689 > 100)

**Result:**
- Days Left: **10,227 days** (Green - Healthy)
- Status: **OK** (Green - Healthy)

### Example 3: Black Screw 1 1/2 (Reorder Status)

**Input Data:**
- Current Stock: 540 pcs
- BOM Quantity: 4.0 pcs per Alkansya
- Average Daily Output: 15.07 Alkansya units/day
- Reorder Point: 200 pcs (assumed)

**Calculations:**
1. Daily Material Usage = 15.07 × 4.0 = **60.28 pcs/day**
2. Days Left = 540 ÷ 60.28 = **9.0 days**
3. Forecasted Usage (30 days) = 60.28 × 30 = **1,808.4 pcs**
4. Projected Stock = 540 - 1,808.4 = **-1,268.4 pcs**
5. Status = **Reorder** (because -1,268.4 ≤ 200)

**Result:**
- Days Left: **9 days** (Yellow - Warning)
- Status: **Reorder** (Yellow - Warning)

## Code Implementation

```php
// Step 1: Calculate daily material usage
$dailyMaterialUsage = $avgDailyOutput * $qtyPerUnit;
// Or from historical transactions:
$dailyMaterialUsage = ($movingAvg7 * 0.6) + ($movingAvg14 * 0.4);

// Step 2: Calculate days until stockout
$daysUntilStockout = $dailyMaterialUsage > 0 
    ? floor($currentStock / $dailyMaterialUsage) 
    : 999;

// Step 3: Calculate forecasted usage
$forecastedUsage = $dailyMaterialUsage * $forecastDays; // 30 days

// Step 4: Calculate projected stock
$projectedStock = $currentStock - $forecastedUsage;

// Step 5: Determine status
$needsReorder = $projectedStock <= ($material->reorder_level ?? 0);
$status = $needsReorder ? "Reorder" : "OK";
```

## Color Coding

The system uses color coding to quickly identify material status:

- **Green**: Days Left > 30 days, Status = "OK"
  - Material is well-stocked
  - No immediate action needed

- **Yellow**: Days Left ≤ 30 days, Status = "Reorder"
  - Material is running low
  - Reorder is needed soon

- **Red** (if implemented): Days Left ≤ 7 days, Status = "Reorder"
  - Material is critically low
  - Urgent reorder required

## Key Points

1. **Days Left** is calculated using **current stock** and **predicted daily usage**
2. **Status** is determined by comparing **projected stock** (after 30 days) with **reorder point**
3. **Daily Material Usage** can come from:
   - Historical transaction data (more accurate)
   - BOM calculations (fallback method)
4. **Negative Projected Stock** means the material will run out before the forecast period ends
5. The system uses **floor()** to round down Days Left (conservative estimate)

## Why Some Materials Show Very High Days Left

Materials like Pinewood (10,227 days) show very high values because:
- They have **large current stock** (2,000 pcs)
- They have **very low daily usage** (0.0437 pcs/day)
- They are used in **small quantities** per product (0.0029 pcs per Alkansya)

This is normal for materials that are:
- Bulk items (large sheets, boards)
- Used in small fractions per product
- Stored in large quantities

## Summary

**Days Left Calculation:**
```
Days Left = Current Stock ÷ Daily Material Usage
```

**Status Calculation:**
```
Status = "Reorder" if (Current Stock - Forecasted Usage) ≤ Reorder Point
Status = "OK" if (Current Stock - Forecasted Usage) > Reorder Point
```

These calculations help you:
- ✅ Know when materials will run out
- ✅ Identify which materials need reordering
- ✅ Plan inventory purchases proactively
- ✅ Avoid stockouts and production delays

