import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  ScatterChart, Scatter
} from 'recharts';
import api from '../../../api/client';

const ProductPerformance = ({ performanceData, loading, error, onRefresh }) => {
  // Removed unused dateRange state since we use pre-loaded data

  // Use props data if available, otherwise fetch
  const [localPerformanceData, setLocalPerformanceData] = useState(performanceData);
  const [localLoading, setLocalLoading] = useState(loading);
  const [localError, setLocalError] = useState(error);

  const fetchPerformanceData = useCallback(async (force = false) => {
    setLocalLoading(true);
    setLocalError('');
    try {
      // Always fetch fresh data with timestamp to prevent caching
      const timestamp = Date.now();
      const response = await api.get('/analytics/product-performance', {
        params: {
          start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          _t: timestamp, // Add timestamp to prevent caching
          _force: 'true' // Force fresh data
        }
      });
      setLocalPerformanceData(response.data);
      console.log('Product Performance - Fresh data loaded:', response.data);
      console.log('Product Performance - Total products from API:', response.data.product_performance?.length);
    } catch (err) {
      setLocalError('Failed to load product performance data');
      console.error('Product performance data error:', err);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (performanceData) {
      setLocalPerformanceData(performanceData);
      setLocalLoading(false);
      setLocalError('');
    } else {
      fetchPerformanceData();
    }
  }, [performanceData, fetchPerformanceData]);

  // Removed unused handleRefresh function since we use onRefresh prop

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
          <span className="visually-hidden">Loading product performance data...</span>
        </div>
      </div>
    );
  }

  if (localError) {
    return (
      <div className="alert alert-danger">
        <h4>Error Loading Product Performance Data</h4>
        <p>{localError}</p>
        <button className="btn btn-primary" onClick={onRefresh || fetchPerformanceData}>
          Retry
        </button>
      </div>
    );
  }

  if (!localPerformanceData) {
    return (
      <div className="alert alert-info">
        <h4>No Product Performance Data Available</h4>
        <p>No product performance data found for the selected date range.</p>
        <button className="btn btn-primary" onClick={onRefresh || fetchPerformanceData}>
          Refresh Data
        </button>
      </div>
    );
  }

  const { product_performance, category_analysis } = localPerformanceData;

  // Prepare data for charts
  const topProductsChart = product_performance.slice(0, 10).map(product => ({
    name: product.name.length > 15 ? product.name.substring(0, 15) + '...' : product.name,
    fullName: product.name,
    revenue: parseFloat(product.total_revenue),
    quantity: parseInt(product.total_sold),
    orders: parseInt(product.order_count),
    avgValue: parseFloat(product.total_revenue) / parseInt(product.total_sold)
  }));

  const categoryChart = category_analysis.map(category => ({
    name: category.category || 'Uncategorized',
    revenue: parseFloat(category.total_revenue),
    quantity: parseInt(category.total_sold),
    orders: parseInt(category.order_count)
  }));

  return (
    <div className="product-performance">
      {/* Header */}
      

      {/* Summary Cards - Production Style */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #0d6efd' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Products Sold</div>
              <div className="h3 mb-0 text-primary">{formatNumber(product_performance.length)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #28a745' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Total Revenue</div>
              <div className="h3 mb-0 text-success">
                {formatCurrency(product_performance.reduce((sum, p) => sum + parseFloat(p.total_revenue), 0))}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #17a2b8' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Total Units Sold</div>
              <div className="h3 mb-0 text-info">
                {formatNumber(product_performance.reduce((sum, p) => sum + parseInt(p.total_sold), 0))}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #ffc107' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Categories</div>
              <div className="h3 mb-0 text-warning">
                {formatNumber(category_analysis.length)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Products Chart */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Top Products by Revenue</h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topProductsChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'revenue' ? formatCurrency(value) : formatNumber(value),
                      name === 'revenue' ? 'Revenue' : name === 'quantity' ? 'Quantity' : 'Orders'
                    ]}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullName;
                      }
                      return label;
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" name="Revenue" />
                  <Bar yAxisId="right" dataKey="quantity" fill="#82ca9d" name="Quantity" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Product Performance Table */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Detailed Product Performance</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Units Sold</th>
                      <th>Revenue</th>
                      <th>Orders</th>
                      <th>Avg Qty/Order</th>
                      <th>Performance Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product_performance.map((product, index) => {
                      const performanceScore = Math.round(
                        (parseFloat(product.total_revenue) / Math.max(...product_performance.map(p => parseFloat(p.total_revenue)))) * 100
                      );
                      return (
                        <tr key={index}>
                          <td>
                            <strong>{product.name}</strong>
                          </td>
                          <td>
                            <span className="badge bg-secondary">{product.category || 'Uncategorized'}</span>
                          </td>
                          <td>{formatCurrency(parseFloat(product.price))}</td>
                          <td>{formatNumber(parseInt(product.total_sold))}</td>
                          <td>
                            <strong>{formatCurrency(parseFloat(product.total_revenue))}</strong>
                          </td>
                          <td>{formatNumber(parseInt(product.order_count))}</td>
                          <td>{formatNumber(product.avg_quantity_per_order)}</td>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="progress me-2" style={{ width: '60px', height: '8px' }}>
                                <div 
                                  className="progress-bar" 
                                  style={{ width: `${performanceScore}%` }}
                                ></div>
                              </div>
                              <small>{performanceScore}%</small>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Analysis */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Category Performance</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Revenue</th>
                      <th>Units</th>
                      <th>Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category_analysis.map((category, index) => (
                      <tr key={index}>
                        <td>
                          <span className="badge bg-primary">{category.category || 'Uncategorized'}</span>
                        </td>
                        <td>{formatCurrency(category.total_revenue)}</td>
                        <td>{formatNumber(category.total_sold)}</td>
                        <td>{formatNumber(category.order_count)}</td>
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
              <h5 className="mb-0">Category Revenue Distribution</h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryChart}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label={({ name, revenue }) => `${name}: ${formatCurrency(revenue)}`}
                  >
                    {categoryChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatCurrency(value), 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue vs Quantity Scatter Plot */}
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Revenue vs Quantity Analysis</h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart data={topProductsChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="quantity" 
                    name="Quantity Sold"
                    label={{ value: 'Quantity Sold', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    dataKey="revenue" 
                    name="Revenue"
                    label={{ value: 'Revenue (₱)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'revenue' ? formatCurrency(value) : formatNumber(value),
                      name === 'revenue' ? 'Revenue' : 'Quantity'
                    ]}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullName;
                      }
                      return '';
                    }}
                  />
                  <Scatter dataKey="revenue" fill="#8884d8" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPerformance;
