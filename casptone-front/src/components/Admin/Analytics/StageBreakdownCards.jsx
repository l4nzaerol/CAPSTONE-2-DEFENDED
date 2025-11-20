import React from "react";
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from "recharts";

// Define distinct colors for each stage (matching StageBreakdownCards)
const stageColors = {
  'Material Preparation': '#8b5e34',    // Brown
  'Cutting & Shaping': '#e74c3c',       // Red
  'Assembly': '#3498db',                 // Blue
  'Sanding & Surface Preparation': '#f39c12', // Orange
  'Finishing': '#9b59b6',                // Purple
  'Quality Check & Packaging': '#27ae60' // Green
};

// Fallback colors for any additional stages
const FALLBACK_COLORS = ["#8b5e34", "#6f4518", "#cbb79a", "#b5835a", "#a06b3b", "#d9c7ae"];

const getStageColor = (stageName, index) => {
  return stageColors[stageName] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
};

// Custom label for pie chart showing only percentage
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  const percentage = `${(percent * 100).toFixed(1)}%`;

  // Only show percentage if it's significant enough (> 5%)
  if (percent < 0.05) return null;

  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor="middle" 
      dominantBaseline="central"
      style={{ 
        fontSize: '14px', 
        fontWeight: 'bold',
        textShadow: '2px 2px 4px rgba(0,0,0,0.9)',
        pointerEvents: 'none'
      }}
    >
      {percentage}
    </text>
  );
};

export default function StagePieChart({ stageData }) {
  // Validate data first
  if (!stageData || !Array.isArray(stageData) || stageData.length === 0) {
    return (
      <div className="text-center text-muted py-5">
        <i className="fas fa-chart-pie fa-3x mb-3 opacity-25"></i>
        <div className="mb-2 fw-bold">No Active Production Stages</div>
        <small>Start production to see stage breakdown</small>
      </div>
    );
  }

  // Calculate total for percentage calculation
  const total = stageData.reduce((sum, item) => sum + (item.value || 0), 0);

  return (
    <div className="p-4 wood-card">
      <h2 className="text-lg font-semibold mb-4" style={{color:'var(--accent-dark)'}}>Production Stage Breakdown</h2>
      
      {/* Two Column Layout: Pie Chart Left, Legend Right */}
      <div className="row">
        {/* Left Column - Pie Chart */}
        <div className="col-md-6 d-flex align-items-center justify-content-center">
          <div style={{ height: 320, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stageData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={110}
                  innerRadius={0}
                  fill="#8884d8"
                  dataKey="value"
                  paddingAngle={2}
                >
                  {stageData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getStageColor(entry.name, index)}
                      stroke="#fff"
                      strokeWidth={3}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name) => {
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return [`${value} order${value !== 1 ? 's' : ''} (${percentage}%)`, name];
                  }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: '2px solid #ddd',
                    borderRadius: '10px',
                    padding: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column - Stage Legend with Enhanced Design */}
        <div className="col-md-6">
          <div className="d-flex flex-column justify-content-center h-100 px-2">
            {stageData.map((stage, index) => {
              const percentage = total > 0 ? ((stage.value / total) * 100).toFixed(1) : 0;
              const color = getStageColor(stage.name, index);
              
              return (
                <div key={stage.name} className="mb-3">
                  <div 
                    className="d-flex justify-content-between align-items-center p-3 rounded shadow-sm"
                    style={{ 
                      backgroundColor: '#ffffff',
                      border: `3px solid ${color}`,
                      borderLeft: `8px solid ${color}`,
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(5px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = '';
                    }}
                  >
                    <div className="d-flex align-items-center gap-3 flex-grow-1">
                      {/* Color Indicator Circle */}
                      <div 
                        style={{ 
                          width: 24, 
                          height: 24, 
                          backgroundColor: color, 
                          borderRadius: '50%',
                          flexShrink: 0,
                          boxShadow: `0 2px 4px ${color}66`
                        }}
                      ></div>
                      {/* Stage Name */}
                      <div className="flex-grow-1">
                        <div 
                          className="fw-bold" 
                          style={{ fontSize: '0.9rem', color: '#2c3e50', lineHeight: '1.2' }}
                        >
                          {stage.name}
                        </div>
                        <div className="small text-muted mt-1">
                          {stage.value} order{stage.value !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    
                    {/* Percentage Display */}
                    <div className="text-end ms-2">
                      <div 
                        className="fw-bold" 
                        style={{ 
                          fontSize: '1.5rem', 
                          color: color,
                          lineHeight: '1',
                          textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
                        }}
                      >
                        {percentage}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-3 p-3 rounded" style={{ backgroundColor: '#2c3e50', color: 'white' }}>
        <div className="d-flex justify-content-between align-items-center">
          <span className="fw-semibold">Total Orders in Production</span>
          <span className="badge bg-light text-dark fs-6">{total}</span>
        </div>
      </div>
    </div>
  );
}
