import React, { useState, useEffect, useCallback } from 'react';
import { 
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  AreaChart, Area
} from 'recharts';
import api from '../../../api/client';
import { clearRequestCache } from '../../../utils/apiRetry';

const SalesDashboard = ({ salesData, loading, error, onRefresh }) => {
  // Removed unused timeframe and dateRange state since we use pre-loaded data

  // Use props data if available, otherwise fetch
  const [localSalesData, setLocalSalesData] = useState(salesData);
  const [localLoading, setLocalLoading] = useState(loading);
  const [localError, setLocalError] = useState(error);

  const fetchSalesData = useCallback(async (force = false) => {
    setLocalLoading(true);
    setLocalError('');
    try {
      // Always fetch fresh data with timestamp to prevent caching
      const timestamp = Date.now();
      const response = await api.get('/analytics/sales-dashboard', {
        params: {
          start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          timeframe: 'daily',
          _t: timestamp, // Add timestamp to prevent caching
          _force: 'true' // Force fresh data
        }
      });
      setLocalSalesData(response.data);
      console.log('Sales Dashboard - Fresh data loaded:', response.data);
      console.log('Sales Dashboard - Total orders from API:', response.data.overview?.total_orders);
    } catch (err) {
      setLocalError('Failed to load sales data');
      console.error('Sales data error:', err);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (salesData) {
      setLocalSalesData(salesData);
      setLocalLoading(false);
      setLocalError('');
    } else {
      fetchSalesData();
    }
  }, [salesData, fetchSalesData]);

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      clearRequestCache();
      fetchSalesData(true);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-PH').format(num);
  };

  if (localLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading sales data...</span>
        </div>
      </div>
    );
  }

  if (localError) {
    return (
      <div className="alert alert-danger">
        <h4>Error Loading Sales Data</h4>
        <p>{localError}</p>
        <button className="btn btn-primary" onClick={handleRefresh}>
          Retry
        </button>
      </div>
    );
  }

  if (!localSalesData) {
    return (
      <div className="alert alert-info">
        <h4>No Sales Data Available</h4>
        <p>No sales data found for the selected date range.</p>
        <button className="btn btn-primary" onClick={handleRefresh}>
          Refresh Data
        </button>
      </div>
    );
  }

  const { overview, revenue_trends, top_products, sales_by_status, payment_method_analysis, customer_analysis, monthly_comparison } = localSalesData;

  return (
    <div className="sales-dashboard">
    
      {/* Overview Cards - Production Style */}
      <div className="row g-3 mb-4">
        <div className="col-md-2">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #0d6efd' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Total Revenue</div>
              <div className="h3 mb-0 text-primary">{formatCurrency(parseFloat(overview.total_revenue))}</div>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #28a745' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Total Orders</div>
              <div className="h3 mb-0 text-success">{formatNumber(overview.total_orders)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #17a2b8' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Paid Orders</div>
              <div className="h3 mb-0 text-info">{formatNumber(overview.paid_orders)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #ffc107' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Pending Orders</div>
              <div className="h3 mb-0 text-warning">{formatNumber(overview.pending_orders)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #6c757d' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Avg Order Value</div>
              <div className="h3 mb-0 text-secondary">{formatCurrency(parseFloat(overview.average_order_value))}</div>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #343a40' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Conversion Rate</div>
              <div className="h3 mb-0 text-dark">{overview.conversion_rate}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Comparison */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Monthly Comparison</h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-4">
                  <div className="text-center">
                    <h6 className="text-muted">Current Month</h6>
                    <h4 className="text-primary">{formatCurrency(monthly_comparison.current_month.revenue)}</h4>
                    <small>{formatNumber(monthly_comparison.current_month.orders)} orders</small>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="text-center">
                    <h6 className="text-muted">Last Month</h6>
                    <h4 className="text-secondary">{formatCurrency(monthly_comparison.last_month.revenue)}</h4>
                    <small>{formatNumber(monthly_comparison.last_month.orders)} orders</small>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="text-center">
                    <h6 className="text-muted">Growth</h6>
                    <h4 className={monthly_comparison.growth.revenue_growth >= 0 ? 'text-success' : 'text-danger'}>
                      {monthly_comparison.growth.revenue_growth >= 0 ? '+' : ''}{monthly_comparison.growth.revenue_growth}%
                    </h4>
                    <small className={monthly_comparison.growth.orders_growth >= 0 ? 'text-success' : 'text-danger'}>
                      {monthly_comparison.growth.orders_growth >= 0 ? '+' : ''}{monthly_comparison.growth.orders_growth}% orders
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Trends Chart */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Revenue Trends</h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={revenue_trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'revenue' ? formatCurrency(value) : formatNumber(value),
                      name === 'revenue' ? 'Revenue' : 'Orders'
                    ]}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.3}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Top Products and Sales Analysis */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Top Selling Products</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top_products.slice(0, 5).map((product, index) => (
                      <tr key={index}>
                        <td>{product.name}</td>
                        <td>{formatNumber(product.total_quantity)}</td>
                        <td>{formatCurrency(product.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Sales by Status</h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sales_by_status}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label={({ status, count }) => `${status}: ${count}`}
                  >
                    {sales_by_status.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method Analysis */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Payment Method Analysis</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                      <th>Avg Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payment_method_analysis.map((method, index) => (
                      <tr key={index}>
                        <td className="text-capitalize">{method.payment_method}</td>
                        <td>{formatNumber(method.count)}</td>
                        <td>{formatCurrency(method.revenue)}</td>
                        <td>{formatCurrency(method.average_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Customer Analysis</h5>
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col-6">
                  <h4 className="text-primary">{formatNumber(customer_analysis.new_customers)}</h4>
                  <p className="text-muted">New Customers</p>
                </div>
                <div className="col-6">
                  <h4 className="text-success">{formatNumber(customer_analysis.returning_customers)}</h4>
                  <p className="text-muted">Returning Customers</p>
                </div>
              </div>
              <hr />
              <div className="text-center">
                <h4 className="text-info">{formatCurrency(customer_analysis.avg_lifetime_value)}</h4>
                <p className="text-muted">Average Lifetime Value</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
