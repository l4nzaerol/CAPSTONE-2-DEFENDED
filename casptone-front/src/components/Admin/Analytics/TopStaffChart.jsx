import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const TopStaffChart = ({ data }) => {
  const COLORS = ['#8b5e34', '#a67c52', '#c19a6b', '#d4a574', '#e6b98c'];
  const [chartHeight, setChartHeight] = useState(250);

  useEffect(() => {
    const updateHeight = () => {
      setChartHeight(window.innerWidth < 768 ? 220 : 250);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  return (
    <div className="card shadow-sm" style={{ borderTop: '3px solid #8b5e34', height: '100%' }}>
      <div className="card-body">
        <h5 className="card-title mb-3" style={{ color: '#8b5e34', fontWeight: 'bold' }}>
          <i className="fas fa-users me-2"></i>
          Top Staff Performance
        </h5>
        <p className="text-muted small mb-3">Staff members who completed the most processes</p>
        
        {!data || data.length === 0 ? (
          <div className="text-center py-5">
            <i className="fas fa-user-slash fa-3x text-muted mb-3"></i>
            <p className="text-muted">No staff data available</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #8b5e34',
                    borderRadius: '8px'
                  }}
                  formatter={(value) => [`${value} processes`, 'Completed']}
                />
                <Bar dataKey="completed_processes" radius={[8, 8, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Staff List */}
            <div className="mt-3">
              <div className="list-group list-group-flush">
                {data.slice(0, 5).map((staff, index) => (
                  <div key={index} className="list-group-item d-flex justify-content-between align-items-center px-0 py-2 border-0">
                    <div className="d-flex align-items-center">
                      <div 
                        className="rounded-circle me-2" 
                        style={{ 
                          width: '10px', 
                          height: '10px', 
                          backgroundColor: COLORS[index % COLORS.length] 
                        }}
                      ></div>
                      <span className="small fw-bold" style={{ color: '#6b4423' }}>
                        {staff.name}
                      </span>
                    </div>
                    <span className="badge" style={{ backgroundColor: '#8b5e34' }}>
                      {staff.completed_processes} completed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TopStaffChart;
