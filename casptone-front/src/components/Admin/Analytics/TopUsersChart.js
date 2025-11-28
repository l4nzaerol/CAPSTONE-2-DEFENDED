import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, LabelList } from "recharts";

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
  if (!data || data.length === 0) {
    return (
      <div className="card shadow-sm h-100 w-100" style={{ border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#ffffff', minHeight: '550px', height: '100%' }}>
        <div className="card-body" style={{ padding: '1rem 1rem 0 1rem', paddingBottom: 0 }}>
          <div className="d-flex align-items-center mb-3">
            <div className="rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '48px', height: '48px', backgroundColor: '#f5f5f0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <i className="fas fa-users" style={{ color: '#161513ff', fontSize: '20px' }}></i>
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
  const highlightCustomers = topCustomers.slice(0, 3);

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
            boxShadow: '0 2px 6px rgba(195, 176, 145, 0.15)'
          }}>
            <i className="fas fa-users" style={{ color: '#C3B091', fontSize: '20px' }}></i>
          </div>
          <h5 className="mb-0 fw-bold" style={{ color: '#6b4423', fontSize: '1.1rem', letterSpacing: '0.3px' }}>Top Customers</h5>
        </div>

        {/* Bar Chart - Fills remaining space with no bottom margin */}
        <div style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={topCustomers} 
              margin={{ top: 5, right: 20, left: 10, bottom: 80 }}
              animationDuration={0}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e5e0" vertical={false} opacity={0.6} />
              <XAxis 
                dataKey="displayName" 
                stroke="#6b4423" 
                style={{ fontSize: '12px', fontWeight: '600' }}
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fill: '#6b4423' }}
                interval={0}
                tickLine={{ stroke: '#6b4423', strokeWidth: 1 }}
              />
              <YAxis 
                stroke="#6b4423" 
                style={{ fontSize: '12px', fontWeight: '600' }}
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
                <LabelList 
                  dataKey="quantity" 
                  position="top" 
                  style={{ fill: '#6b4423', fontWeight: '700', fontSize: '12px' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ marginTop: '1rem', flexShrink: 0 }}>
          <div className="d-flex flex-column gap-2">
            {highlightCustomers.map((customer, index) => (
              <div
                key={`${customer.fullName}-${index}`}
                className="d-flex justify-content-between align-items-center rounded-3 px-3 py-2"
                style={{
                  backgroundColor: '#fbf8f1',
                  border: '1px solid #ede4ce'
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle fw-bold text-white d-flex align-items-center justify-content-center"
                    style={{ width: 32, height: 32, backgroundColor: COLORS[index % COLORS.length] }}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>
                      {customer.fullName}
                    </div>
                    <small className="text-muted">
                      {customer.quantity} total orders
                    </small>
                  </div>
                </div>
                <span className="fw-bold" style={{ color: '#6b4423', fontSize: '1rem' }}>
                  {customer.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
