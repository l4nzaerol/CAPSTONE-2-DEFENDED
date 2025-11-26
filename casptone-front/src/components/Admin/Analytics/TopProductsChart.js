import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

// Brown theme colors - gradient for top products
const COLORS = ['#7F5112', '#9d6a1a', '#b87d22', '#d4902a', '#e6a332'];

export default function TopProductsChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="card shadow-sm h-100 w-100" style={{ border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#ffffff', minHeight: '550px', height: '100%' }}>
        <div className="card-body" style={{ padding: '1rem 1rem 0 1rem', paddingBottom: 0 }}>
          <div className="d-flex align-items-center mb-3">
            <div className="rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '48px', height: '48px', backgroundColor: '#f5f5f0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <i className="fas fa-box" style={{ color: '#7F5112', fontSize: '20px' }}></i>
            </div>
            <h5 className="mb-0 fw-bold" style={{ color: '#6b4423', fontSize: '1.1rem' }}>Top Products</h5>
          </div>
          <div className="text-center text-muted py-5">
            <i className="fas fa-box-open fa-2x mb-2 opacity-25"></i>
            <div style={{ fontSize: '0.875rem' }}>No product data available</div>
          </div>
        </div>
      </div>
    );
  }

  // Get top 5 products and prepare data with truncated names for display
  const topProducts = data.slice(0, 5).map(item => ({
    ...item,
    displayName: item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name,
    fullName: item.name
  }));

  return (
      <div className="card shadow-sm h-100 w-100" style={{ 
      border: '1px solid #e5e7eb', 
      borderRadius: '12px', 
      backgroundColor: '#ffffff',
      display: 'flex', 
      flexDirection: 'column',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      minHeight: '550px',
      height: '100%'
    }}>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '1rem 1rem 0 1rem', height: '100%', paddingBottom: 0 }}>
        {/* Header - Minimal spacing */}
        <div className="d-flex align-items-center" style={{ flexShrink: 0, marginBottom: '0.5rem' }}>
          <div className="rounded-circle d-flex align-items-center justify-content-center me-3" style={{ 
            width: '48px', 
            height: '48px', 
            background: 'linear-gradient(135deg, #f5f5f0 0%, #e8e5e0 100%)',
            boxShadow: '0 2px 6px rgba(127, 81, 18, 0.15)'
          }}>
            <i className="fas fa-box" style={{ color: '#7F5112', fontSize: '20px' }}></i>
          </div>
          <h5 className="mb-0 fw-bold" style={{ color: '#6b4423', fontSize: '1.1rem', letterSpacing: '0.3px' }}>Top Products</h5>
        </div>

        {/* Bar Chart - Fills remaining space with no bottom margin */}
        <div style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={topProducts} 
              margin={{ top: 5, right: 20, left: 10, bottom: 80 }}
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
                  border: '2px solid #7F5112',
                  borderRadius: '8px',
                  padding: '12px',
                  boxShadow: '0 4px 16px rgba(127, 81, 18, 0.25)',
                  fontSize: '13px'
                }}
                labelStyle={{ color: '#6b4423', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}
                formatter={(value, name) => {
                  if (name === 'quantity') {
                    return [value, 'Quantity Ordered'];
                  }
                  return [value, name];
                }}
                labelFormatter={(label) => {
                  const item = topProducts.find(p => p.displayName === label);
                  return item ? item.fullName : label;
                }}
              />
              <Bar 
                dataKey="quantity" 
                radius={[8, 8, 0, 0]}
                fill="#7F5112"
              >
                {topProducts.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(127, 81, 18, 0.2))' }}
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
