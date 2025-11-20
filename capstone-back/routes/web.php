<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EnhancedInventoryReportsController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

// Public API routes for inventory reports (bypassing API middleware)
Route::prefix('api/public')->group(function () {
    Route::get('/inventory/consumption-trends', [EnhancedInventoryReportsController::class, 'getConsumptionTrends']);
    Route::get('/inventory/debug-consumption', [EnhancedInventoryReportsController::class, 'debugConsumptionData']);
});

// Sanctum CSRF cookie route for stateful authentication
Route::get('/sanctum/csrf-cookie', function () {
    return response()->json(['message' => 'CSRF cookie set']);
})->middleware('web');

// Add a simple login route to prevent route not found errors
Route::get('/login', function () {
    return response()->json(['message' => 'Please login via the API'], 401);
})->name('login');
