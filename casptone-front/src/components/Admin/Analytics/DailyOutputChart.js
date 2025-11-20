import React, { useMemo, useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useNavigate } from "react-router-dom";

// Helper functions
const parseDate = (s) => {
  // s expected 'YYYY-MM-DD'
  const [y, m, d] = (s || "").split("-").map(Number);
  return new Date(y || 0, (m || 1) - 1, d || 1);
};

const getYear = (d) => d.getFullYear();
const getMonth = (d) => d.getMonth() + 1; // 1..12

// ISO week number (1..53)
const getISOWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Thursday in current week decides the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return weekNo;
};

const aggregate = (rows, timeframe) => {
  const map = new Map();
  for (const r of rows) {
    const d = parseDate(r.date);
    if (isNaN(d)) continue;

    let key = "";
    let label = "";

    if (timeframe === "daily") {
      key = r.date;
      label = r.date;
    } else if (timeframe === "weekly") {
      const y = getYear(d);
      const w = getISOWeek(d);
      key = `${y}-W${w.toString().padStart(2, "0")}`;
      label = key;
    } else if (timeframe === "monthly") {
      const y = getYear(d);
      const m = getMonth(d);
      key = `${y}-${m.toString().padStart(2, "0")}`;
      label = key;
    } else if (timeframe === "yearly") {
      const y = getYear(d);
      key = `${y}`;
      label = key;
    }

    const prev = map.get(key) || { label, quantity: 0, alkansya: 0, furniture: 0 };
    prev.quantity += Number(r.quantity || 0);
    prev.alkansya += Number(r.alkansya || 0);
    prev.furniture += Number(r.furniture || 0);
    map.set(key, prev);
  }
  // Sort by label in natural order
  return Array.from(map.values()).sort((a, b) => (a.label > b.label ? 1 : -1));
};

export default function DailyOutputChart({ data }) {
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState("daily"); // daily | weekly | monthly | yearly
  const [chartHeight, setChartHeight] = useState(280);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateDimensions = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Make chart taller on mobile for better visibility
      setChartHeight(mobile ? 350 : 280);
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const title = useMemo(() => ({
    daily: "Daily Production Output",
    weekly: "Weekly Production Output",
    monthly: "Monthly Production Output",
    yearly: "Yearly Production Output",
  })[timeframe], [timeframe]);

  const series = useMemo(() => aggregate(data || [], timeframe), [data, timeframe]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalAlkansya = series.reduce((sum, item) => sum + item.alkansya, 0);
    const totalFurniture = series.reduce((sum, item) => sum + item.furniture, 0);
    const totalOutput = totalAlkansya + totalFurniture;
    
    return {
      alkansya: totalAlkansya,
      furniture: totalFurniture,
      total: totalOutput,
      avgAlkansya: series.length > 0 ? Math.round(totalAlkansya / series.length) : 0,
      avgFurniture: series.length > 0 ? Math.round(totalFurniture / series.length) : 0,
      avgTotal: series.length > 0 ? Math.round(totalOutput / series.length) : 0,
    };
  }, [series]);

  return (
    <div className="card shadow-sm h-100 daily-output-chart-card" style={{ borderTop: '3px solid #8b5e34' }}>
      <div className="card-body p-2 p-sm-3 p-md-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-2 mb-md-3">
          <div className="mb-2 mb-md-0">
            <h5 className="card-title mb-1 fw-bold daily-chart-title" style={{color:'#8b5e34', fontSize: 'clamp(0.9rem, 3vw, 1.25rem)'}}>
              <i className="fas fa-chart-line me-2"></i>
              {title}
            </h5>
            <p className="text-muted small mb-0 daily-chart-subtitle" style={{fontSize: 'clamp(0.7rem, 2vw, 0.875rem)'}}>
              Includes completed Alkansya, Tables & Chairs
            </p>
          </div>
          <select 
            className="form-select form-select-sm daily-chart-select" 
            style={{width: 'clamp(100px, 25vw, 140px)', fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'}} 
            value={timeframe} 
            onChange={(e)=>setTimeframe(e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {/* Summary Stats */}
        <div className="row g-1 g-md-2 mb-2 mb-md-3">
          <div className="col-4">
            <div 
              className="text-center p-1 p-md-2 rounded daily-stat-card" 
              style={{ 
                backgroundColor: '#e8f5e9',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onClick={() => navigate('/inventory')}
              title="View Alkansya production details"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="small text-muted" style={{fontSize: 'clamp(0.65rem, 2vw, 0.75rem)'}}>🐷 Alkansya</div>
              <div className="h5 mb-0 fw-bold daily-stat-value" style={{ color: '#17a2b8', fontSize: 'clamp(0.9rem, 3vw, 1.25rem)' }}>{totals.alkansya}</div>
              <div className="small text-muted" style={{fontSize: 'clamp(0.6rem, 1.8vw, 0.7rem)'}}>Avg: {totals.avgAlkansya}</div>
            </div>
          </div>
          <div className="col-4">
            <div 
              className="text-center p-1 p-md-2 rounded daily-stat-card" 
              style={{ 
                backgroundColor: '#fff3e0',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onClick={() => navigate('/productions')}
              title="View furniture production details"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="small text-muted" style={{fontSize: 'clamp(0.65rem, 2vw, 0.75rem)'}}>🪑 Furniture</div>
              <div className="h5 mb-0 fw-bold daily-stat-value" style={{ color: '#8b5e34', fontSize: 'clamp(0.9rem, 3vw, 1.25rem)' }}>{totals.furniture}</div>
              <div className="small text-muted" style={{fontSize: 'clamp(0.6rem, 1.8vw, 0.7rem)'}}>Avg: {totals.avgFurniture}</div>
            </div>
          </div>
          <div className="col-4">
            <div 
              className="text-center p-1 p-md-2 rounded daily-stat-card" 
              style={{ 
                backgroundColor: '#f3e5f5',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onClick={() => navigate('/reports')}
              title="View comprehensive production reports"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="small text-muted" style={{fontSize: 'clamp(0.65rem, 2vw, 0.75rem)'}}>📊 Total</div>
              <div className="h5 mb-0 fw-bold daily-stat-value text-success" style={{fontSize: 'clamp(0.9rem, 3vw, 1.25rem)'}}>{totals.total}</div>
              <div className="small text-muted" style={{fontSize: 'clamp(0.6rem, 1.8vw, 0.7rem)'}}>Avg: {totals.avgTotal}</div>
            </div>
          </div>
        </div>

        <div className="daily-chart-container" style={{ width: '100%', height: chartHeight, minHeight: isMobile ? '350px' : '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 10, right: 10, left: isMobile ? -10 : -15, bottom: isMobile ? 50 : 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="label" 
                stroke="#666" 
              style={{ fontSize: 'clamp(9px, 2vw, 11px)' }}
              angle={-15}
              textAnchor="end"
              height={isMobile ? 50 : 60}
            />
              <YAxis stroke="#666" style={{ fontSize: 'clamp(9px, 2vw, 11px)' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                border: '2px solid #8b5e34',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
              formatter={(value, name) => {
                if (name === 'alkansya') return [`${value} units`, '🐷 Alkansya'];
                if (name === 'furniture') return [`${value} units`, '🪑 Furniture'];
                return [`${value} units`, name];
              }}
            />
            <Legend 
              wrapperStyle={{ 
                paddingTop: '10px', 
                fontSize: isMobile ? '10px' : '14px',
                lineHeight: isMobile ? '1.2' : '1.5'
              }}
              iconSize={isMobile ? 8 : 12}
              formatter={(value) => {
                if (value === 'alkansya') return '🐷 Alkansya';
                if (value === 'furniture') return '🪑 Table & Chair';
                return value;
              }}
            />
            <Line 
              type="monotone" 
              dataKey="alkansya" 
              stroke="#17a2b8" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#17a2b8', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6 }}
              name="alkansya"
            />
            <Line 
              type="monotone" 
              dataKey="furniture" 
              stroke="#8b5e34" 
              strokeWidth={isMobile ? 2 : 3} 
              dot={{ r: isMobile ? 3 : 4, fill: '#8b5e34', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: isMobile ? 5 : 6 }}
              name="furniture"
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
