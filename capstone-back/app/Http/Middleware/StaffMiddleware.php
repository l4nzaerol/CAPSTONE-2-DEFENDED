<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class StaffMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        if (!auth()->check()) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $user = auth()->user();
        
        // Allow both staff and employee (admin) to access
        if ($user->role !== 'staff' && $user->role !== 'employee') {
            return response()->json(['message' => 'Access denied. Staff role required.'], 403);
        }

        return $next($request);
    }
}
