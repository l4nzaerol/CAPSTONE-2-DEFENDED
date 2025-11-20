import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

const COLORS = ['#9b59b6', '#3498db', '#e74c3c', '#f39c12', '#27ae60'];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div 
        className="p-3" 
        style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.98)', 
          border: '2px solid #ddd', 
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}
      >
        <p className="mb-1 fw-bold" style={{ color: '#2c3e50' }}>{data.payload.name}</p>
        <p className="mb-0" style={{ fontSize: '14px' }}>Total Orders: <strong>{data.value}</strong></p>
      </div>
    );
  }
  return null;
};

export default function TopUsersChart({ data }) {
  const [chartHeight, setChartHeight] = useState(280);

  useEffect(() => {
    const updateHeight = () => {
      setChartHeight(window.innerWidth < 768 ? 250 : 280);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="card shadow-sm h-100">
        <div className="card-body p-4">
          <h5 className="card-title mb-3 fw-bold" style={{color:'#2c3e50'}}>Top Customers</h5>
          <div className="text-center text-muted py-5">
            <i className="fas fa-users fa-3x mb-3 opacity-25"></i>
            <div>No customer data available</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body p-4">
        <h5 className="card-title mb-3 fw-bold" style={{color:'#2c3e50'}}>Top Customers</h5>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="name" 
              stroke="#666" 
              style={{ fontSize: '11px' }}
              angle={-15}
              textAnchor="end"
              height={60}
            />
            <YAxis stroke="#666" style={{ fontSize: '11px' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="quantity" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
