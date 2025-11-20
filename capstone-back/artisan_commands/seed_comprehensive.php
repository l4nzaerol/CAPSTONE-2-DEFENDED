<?php

/**
 * Comprehensive Seeder Command
 * 
 * This script runs the comprehensive seeder to create 3 months of realistic data
 * for predictive analytics testing.
 * 
 * Usage: php artisan_commands/seed_comprehensive.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;

echo "🚀 Starting Comprehensive Database Seeding...\n";
echo "This will create 3 months of realistic data for predictive analytics testing.\n\n";

try {
    // Run the comprehensive seeder
    Artisan::call('db:seed', ['--class' => 'ComprehensiveSeeder']);
    
    echo "✅ Comprehensive seeding completed successfully!\n";
    echo "📊 You now have:\n";
    echo "   - 3 months of Alkansya daily output data\n";
    echo "   - 3 months of manual orders (Alkansya + MTO products)\n";
    echo "   - Realistic inventory usage patterns\n";
    echo "   - Production analytics data\n";
    echo "   - Sales analytics data\n\n";
    
    echo "🔍 Next steps:\n";
    echo "   1. Start your Laravel application: php artisan serve\n";
    echo "   2. Start your React application: npm start\n";
    echo "   3. Navigate to the Reports section\n";
    echo "   4. Explore the predictive analytics features:\n";
    echo "      - Material Usage Forecasting\n";
    echo "      - Stock Status Predictions\n";
    echo "      - Inventory Replenishment Forecasting\n";
    echo "      - Seasonal Trends Analysis\n";
    echo "      - Demand Pattern Analysis\n\n";
    
    echo "📈 The system will now provide accurate predictions based on the historical data!\n";
    
} catch (Exception $e) {
    echo "❌ Error during seeding: " . $e->getMessage() . "\n";
    echo "Please check your database connection and try again.\n";
    exit(1);
}


