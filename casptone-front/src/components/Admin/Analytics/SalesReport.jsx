import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  AreaChart, Area
} from 'recharts';
import api from '../../../api/client';

const SalesReport = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    status: 'all',
    payment_status: 'all'
  });

  useEffect(() => {
    fetchReportData();
  }, [filters]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const timestamp = Date.now();
      const response = await api.get('/analytics/sales-report', {
        params: {
          ...filters,
          _t: timestamp, // Add timestamp to prevent caching
          _force: 'true' // Force fresh data
        }
      });
      setReportData(response.data);
      console.log('Sales Report - Fresh data loaded:', response.data);
      console.log('Sales Report - Total orders from API:', response.data.summary?.total_orders);
    } catch (err) {
      setError('Failed to load sales report data');
      console.error('Sales report data error:', err);
    } finally {
      setLoading(false);
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

  const exportToCSV = async () => {
    try {
      const response = await api.get('/analytics/sales-export', {
        params: {
          start_date: filters.start_date,
          end_date: filters.end_date,
          format: 'csv'
        },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sales_report_${filters.start_date}_to_${filters.end_date}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data');
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading sales report data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <h4>Error Loading Sales Report Data</h4>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={fetchReportData}>
          Retry
        </button>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="alert alert-info">
        <h4>No Sales Report Data Available</h4>
        <p>No sales report data found for the selected filters.</p>
      </div>
    );
  }

  const { orders, summary, filters: appliedFilters } = reportData;

  // Prepare data for charts - Only count revenue from paid, delivered, and completed orders
  const ordersByDate = orders.reduce((acc, order) => {
    const date = new Date(order.checkout_date).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = { date, orders: 0, revenue: 0, paidOrders: 0, completedOrders: 0 };
    }
    acc[date].orders += 1;
    
    // Only count revenue from orders that are paid AND (delivered OR completed)
    const isPaid = order.payment_status === 'paid';
    const isDeliveredOrCompleted = order.status === 'delivered' || order.status === 'completed';
    
    if (isPaid) {
      acc[date].paidOrders += 1;
    }
    
    if (isDeliveredOrCompleted) {
      acc[date].completedOrders += 1;
    }
    
    // Revenue only from paid AND (delivered OR completed) orders
    if (isPaid && isDeliveredOrCompleted) {
      acc[date].revenue += parseFloat(order.total_price);
    }
    
    return acc;
  }, {});

  const chartData = Object.values(ordersByDate).sort((a, b) => new Date(a.date) - new Date(b.date));

  const statusData = orders.reduce((acc, order) => {
    if (!acc[order.status]) {
      acc[order.status] = 0;
    }
    acc[order.status] += 1;
    return acc;
  }, {});

  const statusChartData = Object.entries(statusData).map(([status, count]) => ({
    name: status,
    value: count
  }));

  const paymentStatusData = orders.reduce((acc, order) => {
    if (!acc[order.payment_status]) {
      acc[order.payment_status] = 0;
    }
    acc[order.payment_status] += 1;
    return acc;
  }, {});

  const paymentStatusChartData = Object.entries(paymentStatusData).map(([status, count]) => ({
    name: status,
    value: count
  }));

  return (
    <div className="sales-report">
      {/* Header */}
  
      {/* Enhanced Summary Cards with Accurate Revenue Calculation */}
      <div className="row g-3 mb-4">
        <div className="col-lg-2 col-md-4 col-sm-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderLeft: '4px solid #0d6efd' }}>
            <div className="card-body d-flex flex-column">
              <div className="text-muted small mb-1">Total Orders</div>
              <div className="h3 mb-0 text-primary">{formatNumber(summary.total_orders)}</div>
              <small className="text-muted">All orders</small>
            </div>
          </div>
        </div>
        <div className="col-lg-2 col-md-4 col-sm-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderLeft: '4px solid #28a745' }}>
            <div className="card-body d-flex flex-column">
              <div className="text-muted small mb-1">Confirmed Revenue</div>
              <div className="h4 mb-0 text-success" style={{ fontSize: '1.1rem', lineHeight: '1.2' }}>
                {formatCurrency(orders.filter(order => 
                  order.payment_status === 'paid' && 
                  (order.status === 'delivered' || order.status === 'completed')
                ).reduce((sum, order) => sum + parseFloat(order.total_price), 0))}
              </div>
              <small className="text-muted">Paid + Delivered/Completed</small>
            </div>
          </div>
        </div>
        <div className="col-lg-2 col-md-4 col-sm-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderLeft: '4px solid #17a2b8' }}>
            <div className="card-body d-flex flex-column">
              <div className="text-muted small mb-1">Paid Orders</div>
              <div className="h3 mb-0 text-info">{formatNumber(summary.paid_orders)}</div>
              <small className="text-muted">Payment received</small>
            </div>
          </div>
        </div>
        <div className="col-lg-2 col-md-4 col-sm-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderLeft: '4px solid #ffc107' }}>
            <div className="card-body d-flex flex-column">
              <div className="text-muted small mb-1">Pending Orders</div>
              <div className="h3 mb-0 text-warning">{formatNumber(summary.pending_orders)}</div>
              <small className="text-muted">Awaiting payment</small>
            </div>
          </div>
        </div>
        <div className="col-lg-2 col-md-4 col-sm-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderLeft: '4px solid #6c757d' }}>
            <div className="card-body d-flex flex-column">
              <div className="text-muted small mb-1">Avg Order Value</div>
              <div className="h4 mb-0 text-secondary" style={{ fontSize: '1.1rem', lineHeight: '1.2' }}>
                {formatCurrency(summary.average_order_value)}
              </div>
              <small className="text-muted">Per order</small>
            </div>
          </div>
        </div>
        <div className="col-lg-2 col-md-4 col-sm-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderLeft: '4px solid #dc3545' }}>
            <div className="card-body d-flex flex-column">
              <div className="text-muted small mb-1">Completion Rate</div>
              <div className="h3 mb-0 text-danger">
                {summary.total_orders > 0 ? Math.round((summary.completed_orders || 0) / summary.total_orders * 100) : 0}%
              </div>
              <small className="text-muted">Delivered/Completed</small>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Charts with Accurate Revenue Analytics */}
      <div className="row mb-4">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Sales Performance Over Time</h5>
              <small className="text-muted">Revenue from paid + delivered/completed orders only</small>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'revenue' ? formatCurrency(value) : formatNumber(value),
                      name === 'revenue' ? 'Confirmed Revenue' : 
                      name === 'orders' ? 'Total Orders' :
                      name === 'paidOrders' ? 'Paid Orders' :
                      name === 'completedOrders' ? 'Completed Orders' : name
                    ]}
                    labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
                  />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="orders" stackId="1" stroke="#0d6efd" fill="#0d6efd" fillOpacity={0.3} name="Total Orders" />
                  <Area yAxisId="left" type="monotone" dataKey="paidOrders" stackId="2" stroke="#17a2b8" fill="#17a2b8" fillOpacity={0.3} name="Paid Orders" />
                  <Area yAxisId="left" type="monotone" dataKey="completedOrders" stackId="3" stroke="#28a745" fill="#28a745" fillOpacity={0.3} name="Completed Orders" />
                  <Area yAxisId="right" type="monotone" dataKey="revenue" stackId="4" stroke="#ffc107" fill="#ffc107" fillOpacity={0.6} name="Confirmed Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Order Status Distribution</h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#0d6efd', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8'][index % 6]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatNumber(value), 'Orders']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Payment & Revenue Analytics */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Payment Status Distribution</h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentStatusChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                  >
                    {paymentStatusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#28a745', '#ffc107', '#dc3545', '#6c757d'][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatNumber(value), 'Orders']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Revenue vs Orders Trend</h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'revenue' ? formatCurrency(value) : formatNumber(value),
                      name === 'revenue' ? 'Confirmed Revenue' : 'Orders'
                    ]}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="orders" fill="#0d6efd" name="Total Orders" />
                  <Bar yAxisId="right" dataKey="revenue" fill="#28a745" name="Confirmed Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Analytics Summary */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Revenue Analytics Summary</h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-3">
                  <div className="text-center p-3 border rounded">
                    <h4 className="text-success mb-1">
                      {formatCurrency(orders.filter(order => 
                        order.payment_status === 'paid' && 
                        (order.status === 'delivered' || order.status === 'completed')
                      ).reduce((sum, order) => sum + parseFloat(order.total_price), 0))}
                    </h4>
                    <small className="text-muted">Confirmed Revenue</small>
                    <p className="small mb-0">Paid + Delivered/Completed</p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-center p-3 border rounded">
                    <h4 className="text-warning mb-1">
                      {formatCurrency(orders.filter(order => 
                        order.payment_status === 'paid' && 
                        order.status !== 'delivered' && 
                        order.status !== 'completed'
                      ).reduce((sum, order) => sum + parseFloat(order.total_price), 0))}
                    </h4>
                    <small className="text-muted">Pending Delivery</small>
                    <p className="small mb-0">Paid but not delivered</p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-center p-3 border rounded">
                    <h4 className="text-danger mb-1">
                      {formatCurrency(orders.filter(order => 
                        order.payment_status !== 'paid'
                      ).reduce((sum, order) => sum + parseFloat(order.total_price), 0))}
                    </h4>
                    <small className="text-muted">Unpaid Orders</small>
                    <p className="small mb-0">Awaiting payment</p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-center p-3 border rounded">
                    <h4 className="text-info mb-1">
                      {formatCurrency(orders.reduce((sum, order) => sum + parseFloat(order.total_price), 0))}
                    </h4>
                    <small className="text-muted">Total Order Value</small>
                    <p className="small mb-0">All orders combined</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Detailed Orders Table */}
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div>
                <h5 className="mb-0">Detailed Orders Report</h5>
                <small className="text-muted">
                  Showing {orders.length} orders | 
                  Confirmed Revenue: {formatCurrency(orders.filter(order => 
                    order.payment_status === 'paid' && 
                    (order.status === 'delivered' || order.status === 'completed')
                  ).reduce((sum, order) => sum + parseFloat(order.total_price), 0))}
                </small>
              </div>
              <div className="d-flex gap-2">
                <button 
                  className="btn btn-outline-primary btn-sm"
                  onClick={exportToCSV}
                >
                  <i className="fas fa-download me-1"></i>
                  Export CSV
                </button>
                <button 
                  className="btn btn-outline-success btn-sm"
                  onClick={fetchReportData}
                >
                  <i className="fas fa-sync me-1"></i>
                  Refresh
                </button>
              </div>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead className="table-dark">
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Payment Status</th>
                      <th>Total</th>
                      <th>Revenue Status</th>
                      <th>Items</th>
                      <th>Payment Method</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const isConfirmedRevenue = order.payment_status === 'paid' && 
                        (order.status === 'delivered' || order.status === 'completed');
                      const isPaidPendingDelivery = order.payment_status === 'paid' && 
                        order.status !== 'delivered' && order.status !== 'completed';
                      
                      return (
                        <tr key={order.id} className={isConfirmedRevenue ? 'table-success' : ''}>
                          <td>
                            <strong>#{order.id}</strong>
                          </td>
                          <td>
                            <div>
                              <div className="fw-bold">{order.user?.name || 'Unknown Customer'}</div>
                              <small className="text-muted">{order.user?.email || 'No email'}</small>
                            </div>
                          </td>
                          <td>
                            <div>
                              <div>{new Date(order.checkout_date).toLocaleDateString()}</div>
                              <small className="text-muted">{new Date(order.checkout_date).toLocaleTimeString()}</small>
                            </div>
                          </td>
                          <td>
                            <span className={`badge bg-${
                              order.status === 'completed' ? 'success' :
                              order.status === 'delivered' ? 'primary' :
                              order.status === 'processing' ? 'info' :
                              'warning'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td>
                            <span className={`badge bg-${
                              order.payment_status === 'paid' ? 'success' :
                              order.payment_status === 'unpaid' ? 'warning' :
                              'danger'
                            }`}>
                              {order.payment_status}
                            </span>
                          </td>
                          <td>
                            <strong>{formatCurrency(order.total_price)}</strong>
                          </td>
                          <td>
                            {isConfirmedRevenue ? (
                              <span className="badge bg-success">
                                <i className="fas fa-check me-1"></i>
                                Confirmed
                              </span>
                            ) : isPaidPendingDelivery ? (
                              <span className="badge bg-warning">
                                <i className="fas fa-clock me-1"></i>
                                Pending Delivery
                              </span>
                            ) : (
                              <span className="badge bg-danger">
                                <i className="fas fa-times me-1"></i>
                                Not Confirmed
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="small">
                              {order.items?.slice(0, 2).map((item, index) => (
                                <div key={index} className="mb-1">
                                  {item.product?.name} (x{item.quantity})
                                </div>
                              ))}
                              {order.items?.length > 2 && (
                                <small className="text-muted">+{order.items.length - 2} more items</small>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`badge bg-${
                              order.payment_method === 'cod' ? 'secondary' :
                              order.payment_method === 'maya' ? 'primary' :
                              'dark'
                            }`}>
                              {order.payment_method?.toUpperCase() || 'COD'}
                            </span>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button 
                                className="btn btn-outline-primary btn-sm"
                                title="View Details"
                              >
                                <i className="fas fa-eye"></i>
                              </button>
                              <button 
                                className="btn btn-outline-success btn-sm"
                                title="Edit Order"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Summary Footer */}
              <div className="mt-3 p-3 bg-light rounded">
                <div className="row text-center">
                  <div className="col-md-3">
                    <div className="fw-bold text-success">
                      {formatCurrency(orders.filter(order => 
                        order.payment_status === 'paid' && 
                        (order.status === 'delivered' || order.status === 'completed')
                      ).reduce((sum, order) => sum + parseFloat(order.total_price), 0))}
                    </div>
                    <small className="text-muted">Confirmed Revenue</small>
                  </div>
                  <div className="col-md-3">
                    <div className="fw-bold text-warning">
                      {formatCurrency(orders.filter(order => 
                        order.payment_status === 'paid' && 
                        order.status !== 'delivered' && 
                        order.status !== 'completed'
                      ).reduce((sum, order) => sum + parseFloat(order.total_price), 0))}
                    </div>
                    <small className="text-muted">Pending Delivery</small>
                  </div>
                  <div className="col-md-3">
                    <div className="fw-bold text-danger">
                      {formatCurrency(orders.filter(order => 
                        order.payment_status !== 'paid'
                      ).reduce((sum, order) => sum + parseFloat(order.total_price), 0))}
                    </div>
                    <small className="text-muted">Unpaid Orders</small>
                  </div>
                  <div className="col-md-3">
                    <div className="fw-bold text-info">
                      {formatCurrency(orders.reduce((sum, order) => sum + parseFloat(order.total_price), 0))}
                    </div>
                    <small className="text-muted">Total Order Value</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesReport;
