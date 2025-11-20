import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../../api/client';
import { toast } from 'sonner';
import AppLayout from '../Header';

const AdvancedReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });
  const [timeframe, setTimeframe] = useState('daily');
  
  // Analytics data
  const [productionOutput, setProductionOutput] = useState(null);
  const [resourceUtilization, setResourceUtilization] = useState(null);
  const [productionPerformance, setProductionPerformance] = useState(null);
  const [predictiveAnalytics, setPredictiveAnalytics] = useState(null);
  const [materialTrends, setMaterialTrends] = useState(null);
  const [stockReport, setStockReport] = useState(null);

  const COLORS = {
    table: '#8b5e34',
    chair: '#d4a574',
    alkansya: '#17a2b8',
    critical: '#dc3545',
    low: '#ffc107',
    healthy: '#28a745',
  };

  useEffect(() => {
    fetchAllAnalytics();
  }, [dateRange, timeframe]);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    try {
      const [output, resource, performance, predictive, trends, stock] = await Promise.all([
        api.get('/analytics/production-output', { params: { ...dateRange, timeframe } }),
        api.get('/analytics/resource-utilization', { params: dateRange }),
        api.get('/analytics/production-performance', { params: dateRange }),
        api.get('/analytics/predictive', { params: { forecast_days: 30 } }),
        api.get('/analytics/material-usage-trends', { params: { ...dateRange, timeframe } }),
        api.get('/analytics/automated-stock-report'),
      ]);

      setProductionOutput(output.data);
      setResourceUtilization(resource.data);
      setProductionPerformance(performance.data);
      setPredictiveAnalytics(predictive.data);
      setMaterialTrends(trends.data);
      setStockReport(stock.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data, filename) => {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    return [headers, ...rows].join('\n');
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container-fluid py-4">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="mt-3">Loading Advanced Analytics...</div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container-fluid py-4">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm" style={{ borderTop: '4px solid #8b5e34' }}>
              <div className="card-body">
                <h2 className="mb-3">
                  <i className="fas fa-chart-line me-2" style={{ color: '#8b5e34' }}></i>
                  Advanced Production & Inventory Analytics
                </h2>
                <p className="text-muted mb-0">
                  Comprehensive insights for Tables, Chairs, and Alkansya production with predictive forecasting
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Date Range & Timeframe Filters */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label small fw-bold">Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={dateRange.start_date}
                      onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-bold">End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={dateRange.end_date}
                      onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-bold">Timeframe</label>
                    <select
                      className="form-select"
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="col-md-3 d-flex align-items-end">
                    <button className="btn btn-primary w-100" onClick={fetchAllAnalytics}>
                      <i className="fas fa-sync-alt me-2"></i>
                      Refresh Data
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Production Output Analytics */}
        {productionOutput && (
          <>
            <div className="row mb-4">
              <div className="col-12">
                <h4 className="mb-3">
                  <i className="fas fa-industry me-2"></i>
                  Production Output Analytics
                </h4>
              </div>
            </div>

            {/* Top Performing Products */}
            <div className="row mb-4">
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h6 className="card-title mb-3">🏆 Top Performing Products</h6>
                    {productionOutput.top_performing.map((product, idx) => (
                      <div key={idx} className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-bold">{product.product}</span>
                          <span className="badge bg-success">{product.output} units</span>
                        </div>
                        <div className="progress" style={{ height: '8px' }}>
                          <div
                            className="progress-bar"
                            style={{ 
                              width: `${product.efficiency}%`,
                              backgroundColor: idx === 0 ? '#28a745' : idx === 1 ? '#17a2b8' : '#6c757d'
                            }}
                          ></div>
                        </div>
                        <small className="text-muted">{product.efficiency}% efficiency</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Product Totals */}
              <div className="col-md-8">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h6 className="card-title mb-3">📊 Production Summary by Product</h6>
                    <div className="row">
                      <div className="col-md-4">
                        <div className="text-center p-3 rounded" style={{ backgroundColor: '#fff3e0' }}>
                          <div className="text-muted small">Dining Table</div>
                          <div className="h3 fw-bold" style={{ color: COLORS.table }}>
                            {productionOutput.products.table.totals.total_output}
                          </div>
                          <div className="small text-muted">
                            Avg: {productionOutput.products.table.totals.avg_per_period}
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-center p-3 rounded" style={{ backgroundColor: '#f3e5f5' }}>
                          <div className="text-muted small">Wooden Chair</div>
                          <div className="h3 fw-bold" style={{ color: COLORS.chair }}>
                            {productionOutput.products.chair.totals.total_output}
                          </div>
                          <div className="small text-muted">
                            Avg: {productionOutput.products.chair.totals.avg_per_period}
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-center p-3 rounded" style={{ backgroundColor: '#e8f5e9' }}>
                          <div className="text-muted small">🐷 Alkansya</div>
                          <div className="h3 fw-bold" style={{ color: COLORS.alkansya }}>
                            {productionOutput.products.alkansya.totals.total_output}
                          </div>
                          <div className="small text-muted">
                            Avg: {productionOutput.products.alkansya.totals.avg_per_period}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Production Output Trends */}
            <div className="row mb-4">
              <div className="col-12">
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white border-0">
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="mb-0">📈 Production Output Trends</h6>
                      <button 
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => exportToCSV(
                          productionOutput.products.table.output_trend,
                          'production_output_trends'
                        )}
                      >
                        <i className="fas fa-download me-1"></i> Export
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis 
                          dataKey="period" 
                          stroke="#666"
                          angle={-15}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis stroke="#666" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            border: '2px solid #8b5e34',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Line 
                          data={productionOutput.products.table.output_trend}
                          type="monotone" 
                          dataKey="output" 
                          stroke={COLORS.table}
                          strokeWidth={3}
                          name="🪑 Dining Table"
                          dot={{ r: 4, fill: COLORS.table }}
                        />
                        <Line 
                          data={productionOutput.products.chair.output_trend}
                          type="monotone" 
                          dataKey="output" 
                          stroke={COLORS.chair}
                          strokeWidth={3}
                          name="🪑 Wooden Chair"
                          dot={{ r: 4, fill: COLORS.chair }}
                        />
                        <Line 
                          data={productionOutput.products.alkansya.output_trend}
                          type="monotone" 
                          dataKey="output" 
                          stroke={COLORS.alkansya}
                          strokeWidth={3}
                          name="🐷 Alkansya"
                          dot={{ r: 4, fill: COLORS.alkansya }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Production Performance */}
        {productionPerformance && (
          <>
            <div className="row mb-4">
              <div className="col-12">
                <h4 className="mb-3">
                  <i className="fas fa-tachometer-alt me-2"></i>
                  Production Performance
                </h4>
              </div>
            </div>

            <div className="row mb-4">
              {/* Cycle Time Analysis */}
              <div className="col-md-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-white border-0">
                    <h6 className="mb-0">⏱️ Cycle Time Analysis (Days)</h6>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={productionPerformance.cycle_time_analysis}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="product_type" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="avg_cycle_time_days" fill={COLORS.table} name="Avg Cycle Time" />
                        <Bar dataKey="min_cycle_time_days" fill={COLORS.healthy} name="Min Time" />
                        <Bar dataKey="max_cycle_time_days" fill={COLORS.critical} name="Max Time" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Throughput Rate */}
              <div className="col-md-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-white border-0">
                    <h6 className="mb-0">🚀 Throughput Rate</h6>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={productionPerformance.throughput_rate}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="product_type" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="throughput_per_day" fill={COLORS.alkansya} name="Per Day" />
                        <Bar dataKey="throughput_per_week" fill={COLORS.table} name="Per Week" />
                        <Bar dataKey="throughput_per_month" fill={COLORS.chair} name="Per Month" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Resource Utilization */}
        {resourceUtilization && resourceUtilization.material_usage_by_product.length > 0 && (
          <>
            <div className="row mb-4">
              <div className="col-12">
                <h4 className="mb-3">
                  <i className="fas fa-boxes me-2"></i>
                  Resource Utilization & Material Efficiency
                </h4>
              </div>
            </div>

            <div className="row mb-4">
              {resourceUtilization.material_usage_by_product.map((product, idx) => (
                <div key={idx} className="col-md-4 mb-3">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-header bg-white border-0">
                      <h6 className="mb-0">{product.product}</h6>
                      <small className="text-muted">{product.total_materials} materials used</small>
                    </div>
                    <div className="card-body">
                      <div className="table-responsive">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>Material</th>
                              <th className="text-end">Used</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.materials.slice(0, 5).map((mat, midx) => (
                              <tr key={midx}>
                                <td className="small">{mat.material}</td>
                                <td className="text-end small">
                                  {mat.total_used} {mat.unit}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Material Efficiency */}
            {resourceUtilization.efficiency.length > 0 && (
              <div className="row mb-4">
                <div className="col-12">
                  <div className="card border-0 shadow-sm">
                    <div className="card-header bg-white border-0">
                      <h6 className="mb-0">📊 Material Usage Efficiency (Actual vs Estimated)</h6>
                    </div>
                    <div className="card-body">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={resourceUtilization.efficiency}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="product" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="estimated_usage" fill={COLORS.low} name="Estimated" />
                          <Bar dataKey="actual_usage" fill={COLORS.alkansya} name="Actual" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Predictive Analytics */}
        {predictiveAnalytics && (
          <>
            <div className="row mb-4">
              <div className="col-12">
                <h4 className="mb-3">
                  <i className="fas fa-crystal-ball me-2"></i>
                  Predictive Analytics & Forecasting
                </h4>
              </div>
            </div>

            {/* Production Capacity Forecast */}
            {predictiveAnalytics.production_capacity_forecast.length > 0 && (
              <div className="row mb-4">
                <div className="col-md-6">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-header bg-white border-0">
                      <h6 className="mb-0">🔮 Production Capacity Forecast (30 Days)</h6>
                    </div>
                    <div className="card-body">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={predictiveAnalytics.production_capacity_forecast}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="product_type" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="forecasted_output_30_days" fill={COLORS.table} name="Forecasted Output" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Trend Analysis */}
                <div className="col-md-6">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-header bg-white border-0">
                      <h6 className="mb-0">📈 Monthly Trend Analysis</h6>
                    </div>
                    <div className="card-body">
                      <div className="text-center mb-3">
                        <h3 className="mb-0">
                          <span className={`badge ${
                            predictiveAnalytics.trend_analysis.overall_trend === 'increasing' ? 'bg-success' :
                            predictiveAnalytics.trend_analysis.overall_trend === 'decreasing' ? 'bg-danger' :
                            'bg-secondary'
                          }`}>
                            {predictiveAnalytics.trend_analysis.overall_trend.toUpperCase()}
                          </span>
                        </h3>
                        <p className="text-muted small mb-0">Overall Trend</p>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={predictiveAnalytics.trend_analysis.monthly_trends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="total_output" 
                            stroke={COLORS.alkansya}
                            strokeWidth={3}
                            name="Total Output"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Replenishment Needs */}
            {predictiveAnalytics.inventory_replenishment_needs.length > 0 && (
              <div className="row mb-4">
                <div className="col-12">
                  <div className="card border-0 shadow-sm">
                    <div className="card-header bg-danger text-white">
                      <h6 className="mb-0">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        Inventory Replenishment Needs
                      </h6>
                    </div>
                    <div className="card-body">
                      <div className="table-responsive">
                        <table className="table table-hover">
                          <thead>
                            <tr>
                              <th>Material</th>
                              <th>SKU</th>
                              <th className="text-end">Current Stock</th>
                              <th className="text-end">Days Until Depletion</th>
                              <th>Urgency</th>
                              <th className="text-end">Recommended Order</th>
                            </tr>
                          </thead>
                          <tbody>
                            {predictiveAnalytics.inventory_replenishment_needs.map((item, idx) => (
                              <tr key={idx}>
                                <td>{item.material}</td>
                                <td><code>{item.sku}</code></td>
                                <td className="text-end">{item.current_stock} {item.unit}</td>
                                <td className="text-end">
                                  <span className={`badge ${
                                    item.days_until_depletion <= 3 ? 'bg-danger' :
                                    item.days_until_depletion <= 7 ? 'bg-warning' :
                                    'bg-info'
                                  }`}>
                                    {item.days_until_depletion} days
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${
                                    item.urgency === 'critical' ? 'bg-danger' : 'bg-warning'
                                  }`}>
                                    {item.urgency}
                                  </span>
                                </td>
                                <td className="text-end fw-bold">
                                  {item.recommended_order_qty} {item.unit}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Automated Stock Report */}
        {stockReport && (
          <>
            <div className="row mb-4">
              <div className="col-12">
                <h4 className="mb-3">
                  <i className="fas fa-warehouse me-2"></i>
                  Automated Stock Report
                </h4>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="row mb-4">
              <div className="col-md-4">
                <div className="card border-0 shadow-sm border-start border-danger border-4">
                  <div className="card-body text-center">
                    <h2 className="text-danger mb-0">{stockReport.summary.critical_items}</h2>
                    <p className="text-muted mb-0">Critical Items</p>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card border-0 shadow-sm border-start border-warning border-4">
                  <div className="card-body text-center">
                    <h2 className="text-warning mb-0">{stockReport.summary.low_stock_items}</h2>
                    <p className="text-muted mb-0">Low Stock Items</p>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card border-0 shadow-sm border-start border-success border-4">
                  <div className="card-body text-center">
                    <h2 className="text-success mb-0">{stockReport.summary.healthy_items}</h2>
                    <p className="text-muted mb-0">Healthy Items</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Critical Items Table */}
            {stockReport.items_by_status.critical.length > 0 && (
              <div className="row mb-4">
                <div className="col-12">
                  <div className="card border-0 shadow-sm">
                    <div className="card-header bg-danger text-white">
                      <h6 className="mb-0">
                        <i className="fas fa-exclamation-circle me-2"></i>
                        Critical Stock Items - Immediate Action Required
                      </h6>
                    </div>
                    <div className="card-body">
                      <div className="table-responsive">
                        <table className="table table-hover">
                          <thead>
                            <tr>
                              <th>Material</th>
                              <th>SKU</th>
                              <th className="text-end">Current Stock</th>
                              <th className="text-end">Safety Stock</th>
                              <th className="text-end">Daily Usage</th>
                              <th className="text-end">Days Left</th>
                              <th>Depletion Date</th>
                              <th className="text-end">Reorder Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stockReport.items_by_status.critical.map((item, idx) => (
                              <tr key={idx} className="table-danger">
                                <td className="fw-bold">{item.material}</td>
                                <td><code>{item.sku}</code></td>
                                <td className="text-end">{item.current_stock} {item.unit}</td>
                                <td className="text-end">{item.safety_stock}</td>
                                <td className="text-end">{item.daily_usage_rate}</td>
                                <td className="text-end">
                                  <span className="badge bg-danger">{item.days_until_depletion}</span>
                                </td>
                                <td>{item.predicted_depletion_date}</td>
                                <td className="text-end fw-bold text-danger">
                                  {item.suggested_reorder_qty} {item.unit}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Export All Button */}
        <div className="row mb-4">
          <div className="col-12 text-center">
            <button className="btn btn-lg btn-primary" onClick={() => window.print()}>
              <i className="fas fa-print me-2"></i>
              Print Full Report
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdvancedReportsPage;
