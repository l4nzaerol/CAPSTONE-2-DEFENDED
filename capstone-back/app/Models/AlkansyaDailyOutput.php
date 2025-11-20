<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class AlkansyaDailyOutput extends Model
{
    use HasFactory;

    protected $table = 'alkansya_daily_output';

    protected $fillable = [
        'date',
        'quantity_produced',
        'produced_by',
        'materials_used',
    ];

    protected $casts = [
        'date' => 'date',
        'materials_used' => 'array',
    ];

    /**
     * Get the total output for a specific date range
     */
    public static function getTotalOutput($startDate = null, $endDate = null)
    {
        $query = self::query();
        
        if ($startDate) {
            $query->where('date', '>=', $startDate);
        }
        
        if ($endDate) {
            $query->where('date', '<=', $endDate);
        }
        
        return $query->sum('quantity_produced');
    }

    /**
     * Get daily output for a specific date
     */
    public static function getDailyOutput($date)
    {
        return self::where('date', $date)->first();
    }

    /**
     * Add daily output and automatically deduct materials using BOM
     */
    public static function addDailyOutput($date, $quantity, $producedBy = null)
    {
        // Get all Alkansya products
        $alkansyaProducts = Product::where('category_name', 'Stocked Products')
            ->where('name', 'Alkansya')
            ->get();

        if ($alkansyaProducts->isEmpty()) {
            throw new \Exception('No Alkansya products found');
        }

        // Use the first Alkansya product for BOM calculation (they all have the same BOM)
        $alkansyaProduct = $alkansyaProducts->first();

        // Use the new inventory system to deduct materials and add finished goods
        $result = Inventory::deductMaterialsForProduction($alkansyaProduct->id, $quantity, $date);
        
        if (!$result['success']) {
            throw new \Exception($result['error']);
        }

        // Create or update daily output record
        $dailyOutput = self::updateOrCreate(
            ['date' => $date],
            [
                'quantity_produced' => $quantity,
                'produced_by' => $producedBy,
                'materials_used' => $result['deducted_materials'],
            ]
        );

        // Update stock for ALL Alkansya products
        foreach ($alkansyaProducts as $alkansyaProduct) {
            $alkansyaProduct->increment('stock', $quantity);
        }

        return $dailyOutput;
    }

    /**
     * Get materials used for a specific date
     */
    public function getMaterialsUsedAttribute($value)
    {
        return json_decode($value, true) ?? [];
    }

    /**
     * Get total cost of materials used
     */
    public function getTotalMaterialCostAttribute()
    {
        $materialsUsed = $this->materials_used ?? [];
        return collect($materialsUsed)->sum('total_cost');
    }
}