import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

// Brown theme colors - gradient for top customers
const COLORS = ['#C3B091', '#d0c4a5', '#ddd8b9', '#eaeccd', '#f5f0e1'];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div 
        className="p-3" 
        style={{ 
          backgroundColor: '#ffffff', 
          border: '2px solid #C3B091', 
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(195, 176, 145, 0.25)',
          padding: '12px',
          fontSize: '13px'
        }}
      >
        <p className="mb-1 fw-bold" style={{ color: '#6b4423', marginBottom: '8px', fontSize: '14px' }}>{data.payload.fullName || data.payload.name}</p>
        <p className="mb-0" style={{ fontSize: '13px', color: '#6b4423' }}>Total Orders: <strong>{data.value}</strong></p>
      </div>
    );
  }
  return null;
};

export default function TopUsersChart({ data }) {
  // Fixed height to prevent movement
  const chartHeight = 350;

  if (!data || data.length === 0) {
    return (
      <div className="card shadow-sm h-100" style={{ border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#ffffff', minHeight: '400px' }}>
        <div className="card-body p-4">
          <div className="d-flex align-items-center mb-3">
            <div className="rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '48px', height: '48px', backgroundColor: '#f5f5f0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <i className="fas fa-users" style={{ color: '#C3B091', fontSize: '20px' }}></i>
            </div>
            <h5 className="mb-0 fw-bold" style={{ color: '#6b4423', fontSize: '1.1rem' }}>Top Customers</h5>
          </div>
          <div className="text-center text-muted py-5">
            <i className="fas fa-users fa-2x mb-2 opacity-25"></i>
            <div style={{ fontSize: '0.875rem' }}>No customer data available</div>
          </div>
        </div>
      </div>
    );
  }

  // Get top 5 customers and prepare data with truncated names for display
  const topCustomers = data.slice(0, 5).map(item => ({
    ...item,
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
            boxShadow: '0 2px 6px rgba(195, 176, 145, 0.15)'
          }}>
            <i className="fas fa-users" style={{ color: '#C3B091', fontSize: '20px' }}></i>
          </div>
          <h5 className="mb-0 fw-bold" style={{ color: '#6b4423', fontSize: '1.1rem', letterSpacing: '0.3px' }}>Top Customers</h5>
        </div>

        {/* Enhanced Bar Chart - Takes remaining space */}
        <div style={{ flex: 1, minHeight: '300px', width: '100%', marginTop: '8px' }}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart 
              data={topCustomers} 
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
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="quantity" 
                radius={[8, 8, 0, 0]}
                fill="#C3B091"
              >
                {topCustomers.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(195, 176, 145, 0.2))' }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
