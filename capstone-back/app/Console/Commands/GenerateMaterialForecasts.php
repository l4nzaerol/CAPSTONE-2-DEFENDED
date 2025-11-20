<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Database\Seeders\MaterialForecastSeeder;

class GenerateMaterialForecasts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'forecasts:generate';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate accurate material forecasts from Alkansya production data';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Generating material forecasts...');
        
        $seeder = new MaterialForecastSeeder();
        $seeder->setCommand($this);
        $seeder->run();
        
        $this->info('Material forecasts generated successfully!');
        
        return 0;
    }
}
