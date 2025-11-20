<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductionProcess extends Model
{
    use HasFactory;

    protected $fillable = [
        'production_id',
        'process_name',
        'process_order',
        'status',
        'started_at',
        'completed_at',
        'duration_minutes',
        'estimated_duration_minutes',
        'notes',
        'materials_used',
        'quality_checks',
        'assigned_worker',
        'delay_reason',
        'is_delayed',
        'actual_completion_date',
        'completed_by_name',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'actual_completion_date' => 'datetime',
        'is_delayed' => 'boolean',
        'materials_used' => 'array',
        'quality_checks' => 'array',
    ];

    public function production()
    {
        return $this->belongsTo(Production::class);
    }

    // Helper method to calculate duration
    public function getDurationAttribute()
    {
        if ($this->started_at && $this->completed_at) {
            return $this->started_at->diffInMinutes($this->completed_at);
        }
        return $this->duration_minutes ?? 0;
    }

    // Helper method to check if process is delayed
    public function getIsDelayedAttribute()
    {
        if ($this->estimated_duration_minutes && $this->duration_minutes) {
            return $this->duration_minutes > $this->estimated_duration_minutes;
        }
        return false;
    }
}
