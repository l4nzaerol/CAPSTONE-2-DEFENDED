import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

// Brown theme colors - gradient for top staff
const COLORS = ['#4A2C2A', '#5d3a37', '#704844', '#835651', '#96645e'];

const TopStaffChart = ({ data }) => {
  // Fixed height to prevent movement
  const chartHeight = 350;

  if (!data || data.length === 0) {
    return (
      <div className="card shadow-sm h-100" style={{ border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#ffffff', minHeight: '400px' }}>
        <div className="card-body p-4">
          <div className="d-flex align-items-center mb-3">
            <div className="rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '48px', height: '48px', backgroundColor: '#f5f5f0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <i className="fas fa-user-tie" style={{ color: '#4A2C2A', fontSize: '20px' }}></i>
            </div>
            <h5 className="mb-0 fw-bold" style={{ color: '#6b4423', fontSize: '1.1rem' }}>Top Staff</h5>
          </div>
          <div className="text-center text-muted py-5">
            <i className="fas fa-user-slash fa-2x mb-2 opacity-25"></i>
            <div style={{ fontSize: '0.875rem' }}>No staff data available</div>
          </div>
        </div>
      </div>
    );
  }

  // Get top 5 staff and prepare data with truncated names for display
  const topStaff = data.slice(0, 5).map(item => ({
    ...item,
    completed_processes: item.completed_processes || item.quantity || 0,
    displayName: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
    fullName: item.name
  }));

  return (
    <div className="card shadow-sm h-100" style={{ 
      border: '1px solid #e5e7eb', 
      borderRadius: '12px', 
      backgroundColor: '#ffffff',
      display: 'flex', 
      flexDirection: 'column',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      minHeight: '450px'
    }}>
      <div className="card-body p-3" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '400px' }}>
        {/* Enhanced Header */}
        <div className="d-flex align-items-center mb-2" style={{ flexShrink: 0 }}>
          <div className="rounded-circle d-flex align-items-center justify-content-center me-3" style={{ 
            width: '48px', 
            height: '48px', 
            background: 'linear-gradient(135deg, #f5f5f0 0%, #e8e5e0 100%)',
            boxShadow: '0 2px 6px rgba(74, 44, 42, 0.15)'
          }}>
            <i className="fas fa-user-tie" style={{ color: '#4A2C2A', fontSize: '20px' }}></i>
          </div>
          <h5 className="mb-0 fw-bold" style={{ color: '#6b4423', fontSize: '1.1rem', letterSpacing: '0.3px' }}>Top Staff</h5>
        </div>

        {/* Enhanced Bar Chart - Takes remaining space */}
        <div style={{ flex: 1, minHeight: '300px', width: '100%', marginTop: '8px' }}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart 
              data={topStaff} 
              margin={{ top: 10, right: 20, left: 10, bottom: 100 }}
              animationDuration={0}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e5e0" vertical={false} opacity={0.6} />
              <XAxis 
                dataKey="displayName" 
                stroke="#6b4423" 
                style={{ fontSize: '11px', fontWeight: '500' }}
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fill: '#6b4423' }}
                interval={0}
                tickLine={{ stroke: '#6b4423', strokeWidth: 1 }}
              />
              <YAxis 
                stroke="#6b4423" 
                style={{ fontSize: '12px', fontWeight: '500' }}
                tick={{ fill: '#6b4423' }}
                width={45}
                tickLine={{ stroke: '#6b4423', strokeWidth: 1 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff',
                  border: '2px solid #4A2C2A',
                  borderRadius: '8px',
                  padding: '12px',
                  boxShadow: '0 4px 16px rgba(74, 44, 42, 0.25)',
                  fontSize: '13px'
                }}
                labelStyle={{ color: '#6b4423', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}
                formatter={(value) => [`${value} processes`, 'Completed']}
                labelFormatter={(label) => {
                  const item = topStaff.find(s => s.displayName === label);
                  return item ? item.fullName : label;
                }}
              />
              <Bar 
                dataKey="completed_processes" 
                radius={[8, 8, 0, 0]}
                fill="#4A2C2A"
              >
                {topStaff.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(74, 44, 42, 0.2))' }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default TopStaffChart;
