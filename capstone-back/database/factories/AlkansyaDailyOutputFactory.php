<?php

namespace Database\Factories;

use App\Models\AlkansyaDailyOutput;
use App\Models\Product;
use App\Models\ProductMaterial;
use App\Models\InventoryItem;
use Illuminate\Database\Eloquent\Factories\Factory;
use Carbon\Carbon;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AlkansyaDailyOutput>
 */
class AlkansyaDailyOutputFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = AlkansyaDailyOutput::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // Generate realistic production quantity (300-500 range)
        $baseProduction = $this->faker->numberBetween(300, 500);
        $variation = $this->faker->numberBetween(-50, 50);
        $quantityProduced = max(300, min(500, $baseProduction + $variation));

        // Generate materials used data
        $materialsUsed = $this->generateMaterialsUsed($quantityProduced);

        return [
            'date' => $this->faker->dateTimeBetween('-3 months', 'now')->format('Y-m-d'),
            'quantity_produced' => $quantityProduced,
            'produced_by' => $this->faker->randomElement([
                'Production Team A',
                'Production Team B', 
                'Production Team C',
                'John Santos',
                'Maria Garcia',
                'Production Supervisor',
                'Quality Control Team',
                'Senior Production Lead',
                'Production Manager',
            ]),
            'materials_used' => $materialsUsed,
        ];
    }

    /**
     * Generate materials used based on BOM
     */
    private function generateMaterialsUsed($quantityProduced): array
    {
        // Get Alkansya BOM materials
        $alkansyaProduct = Product::where('name', 'Alkansya')->first();
        if (!$alkansyaProduct) {
            return [];
        }

        $bomMaterials = ProductMaterial::where('product_id', $alkansyaProduct->id)
            ->with('inventoryItem')
            ->get();

        $materialsUsed = [];

        foreach ($bomMaterials as $bomMaterial) {
            $inventoryItem = $bomMaterial->inventoryItem;
            $requiredQuantity = $bomMaterial->qty_per_unit * $quantityProduced;
            
            if ($requiredQuantity > 0) {
                // Simulate material usage with some variation (95-105% of required)
                $actualUsage = $requiredQuantity * (0.95 + ($this->faker->numberBetween(0, 10) / 100));
                
                $materialsUsed[] = [
                    'inventory_item_id' => $inventoryItem->id,
                    'item_name' => $inventoryItem->name,
                    'sku' => $inventoryItem->sku,
                    'quantity_used' => round($actualUsage, 2),
                    'unit_cost' => $inventoryItem->unit_cost,
                    'total_cost' => round($inventoryItem->unit_cost * $actualUsage, 2),
                ];
            }
        }

        return $materialsUsed;
    }


    /**
     * Create data for a specific date range
     */
    public function forDateRange($startDate, $endDate)
    {
        return $this->state(function (array $attributes) use ($startDate, $endDate) {
            return [
                'date' => $this->faker->dateTimeBetween($startDate, $endDate)->format('Y-m-d'),
            ];
        });
    }

    /**
     * Create data for weekdays only
     */
    public function weekdaysOnly()
    {
        return $this->state(function (array $attributes) {
            $date = Carbon::parse($attributes['date']);
            
            // Skip weekends
            while ($date->isWeekend()) {
                $date = $date->addDay();
            }
            
            return [
                'date' => $date->format('Y-m-d'),
            ];
        });
    }

    /**
     * Create high production day
     */
    public function highProduction()
    {
        return $this->state(function (array $attributes) {
            return [
                'quantity_produced' => $this->faker->numberBetween(450, 500),
            ];
        });
    }

    /**
     * Create low production day
     */
    public function lowProduction()
    {
        return $this->state(function (array $attributes) {
            return [
                'quantity_produced' => $this->faker->numberBetween(300, 350),
            ];
        });
    }
}
