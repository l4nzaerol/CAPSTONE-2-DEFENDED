import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  FunnelChart, Funnel, LabelList
} from 'recharts';
import api from '../../../api/client';

const SalesProcessAnalytics = ({ processData, loading, error, onRefresh }) => {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Use props data if available, otherwise fetch
  const [localProcessData, setLocalProcessData] = useState(processData);
  const [localLoading, setLocalLoading] = useState(loading);
  const [localError, setLocalError] = useState(error);

  useEffect(() => {
    if (processData) {
      setLocalProcessData(processData);
      setLocalLoading(false);
      setLocalError('');
    } else {
      fetchProcessData();
    }
  }, [processData]);

  const fetchProcessData = async () => {
    setLocalLoading(true);
    try {
      const timestamp = Date.now();
      const response = await api.get('/analytics/sales-process', {
        params: {
          start_date: dateRange.start,
          end_date: dateRange.end,
          _t: timestamp, // Add timestamp to prevent caching
          _force: 'true' // Force fresh data
        }
      });
      setLocalProcessData(response.data);
      console.log('Sales Process - Fresh data loaded:', response.data);
    } catch (err) {
      setLocalError('Failed to load sales process data');
      console.error('Sales process data error:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-PH').format(num);
  };

  const formatHours = (hours) => {
    if (hours < 24) {
      return `${Math.round(hours)} hours`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return `${days}d ${remainingHours}h`;
    }
  };

  const formatDays = (days) => {
    return `${Math.round(days)} days`;
  };

  if (localLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading sales process data...</span>
        </div>
      </div>
    );
  }

  if (localError) {
    return (
      <div className="alert alert-danger">
        <h4>Error Loading Sales Process Data</h4>
        <p>{localError}</p>
        <button className="btn btn-primary" onClick={onRefresh || fetchProcessData}>
          Retry
        </button>
      </div>
    );
  }

  if (!localProcessData) {
    return (
      <div className="alert alert-info">
        <h4>No Sales Process Data Available</h4>
        <p>No sales process data found for the selected date range.</p>
        <button className="btn btn-primary" onClick={onRefresh || fetchProcessData}>
          Refresh Data
        </button>
      </div>
    );
  }

  const { order_funnel, payment_funnel, time_to_payment, completion_time } = localProcessData;

  // Prepare funnel data for visualization
  const orderFunnelData = [
    { name: 'Total Orders', value: order_funnel.total_orders, fill: '#8884d8' },
    { name: 'Pending', value: order_funnel.pending_orders, fill: '#ffc658' },
    { name: 'Processing', value: order_funnel.processing_orders, fill: '#82ca9d' },
    { name: 'Completed', value: order_funnel.completed_orders, fill: '#ff7300' },
    { name: 'Delivered', value: order_funnel.delivered_orders, fill: '#00ff00' }
  ];

  const paymentFunnelData = [
    { name: 'Unpaid', value: payment_funnel.unpaid_orders, fill: '#ff6b6b' },
    { name: 'Paid', value: payment_funnel.paid_orders, fill: '#51cf66' },
    { name: 'Failed', value: payment_funnel.failed_payments, fill: '#ffd43b' }
  ];

  return (
    <div className="sales-process-analytics">
      {/* Header */}

      {/* Key Metrics - Production Style */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #0d6efd' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Total Orders</div>
              <div className="h3 mb-0 text-primary">{formatNumber(order_funnel.total_orders)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #28a745' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Paid Orders</div>
              <div className="h3 mb-0 text-success">{formatNumber(payment_funnel.paid_orders)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #17a2b8' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Avg Time to Payment</div>
              <div className="h3 mb-0 text-info">{formatHours(time_to_payment)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #ffc107' }}>
            <div className="card-body">
              <div className="text-muted small mb-1">Avg Completion Time</div>
              <div className="h3 mb-0 text-warning">{formatDays(completion_time)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Funnel */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Order Status Funnel</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(order_funnel).map(([key, value]) => (
                      <tr key={key}>
                        <td className="text-capitalize">{key.replace('_', ' ')}</td>
                        <td>{formatNumber(value)}</td>
                        <td>
                          {order_funnel.total_orders > 0 
                            ? `${Math.round((value / order_funnel.total_orders) * 100)}%`
                            : '0%'
                          }
                        </td>
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
              <h5 className="mb-0">Order Status Visualization</h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={orderFunnelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatNumber(value), 'Orders']} />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Funnel */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Payment Status Funnel</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(payment_funnel).map(([key, value]) => (
                      <tr key={key}>
                        <td className="text-capitalize">{key.replace('_', ' ')}</td>
                        <td>{formatNumber(value)}</td>
                        <td>
                          {payment_funnel.unpaid_orders + payment_funnel.paid_orders + payment_funnel.failed_payments > 0 
                            ? `${Math.round((value / (payment_funnel.unpaid_orders + payment_funnel.paid_orders + payment_funnel.failed_payments)) * 100)}%`
                            : '0%'
                          }
                        </td>
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
              <h5 className="mb-0">Payment Status Visualization</h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentFunnelData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label={({ name, value }) => `${name}: ${formatNumber(value)}`}
                  >
                    {paymentFunnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatNumber(value), 'Orders']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Process Efficiency Metrics */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Process Efficiency</h5>
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col-6">
                  <div className="p-3">
                    <h4 className="text-primary">{formatHours(time_to_payment)}</h4>
                    <p className="text-muted mb-0">Average Time to Payment</p>
                    <small className="text-muted">From order to payment confirmation</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-3">
                    <h4 className="text-success">{formatDays(completion_time)}</h4>
                    <p className="text-muted mb-0">Average Completion Time</p>
                    <small className="text-muted">From acceptance to completion</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Conversion Rates</h5>
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col-6">
                  <div className="p-3">
                    <h4 className="text-info">
                      {order_funnel.total_orders > 0 
                        ? `${Math.round((order_funnel.completed_orders / order_funnel.total_orders) * 100)}%`
                        : '0%'
                      }
                    </h4>
                    <p className="text-muted mb-0">Order Completion Rate</p>
                    <small className="text-muted">Orders completed vs total</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-3">
                    <h4 className="text-warning">
                      {payment_funnel.unpaid_orders + payment_funnel.paid_orders > 0 
                        ? `${Math.round((payment_funnel.paid_orders / (payment_funnel.unpaid_orders + payment_funnel.paid_orders)) * 100)}%`
                        : '0%'
                      }
                    </h4>
                    <p className="text-muted mb-0">Payment Success Rate</p>
                    <small className="text-muted">Paid vs total payment attempts</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Process Flow Diagram */}
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Sales Process Flow</h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-2 text-center">
                  <div className="p-3 border rounded bg-light">
                    <h6>Order Placed</h6>
                    <h4 className="text-primary">{formatNumber(order_funnel.total_orders)}</h4>
                  </div>
                </div>
                <div className="col-md-1 d-flex align-items-center justify-content-center">
                  <i className="fas fa-arrow-right text-muted"></i>
                </div>
                <div className="col-md-2 text-center">
                  <div className="p-3 border rounded bg-warning text-white">
                    <h6>Pending</h6>
                    <h4>{formatNumber(order_funnel.pending_orders)}</h4>
                  </div>
                </div>
                <div className="col-md-1 d-flex align-items-center justify-content-center">
                  <i className="fas fa-arrow-right text-muted"></i>
                </div>
                <div className="col-md-2 text-center">
                  <div className="p-3 border rounded bg-info text-white">
                    <h6>Processing</h6>
                    <h4>{formatNumber(order_funnel.processing_orders)}</h4>
                  </div>
                </div>
                <div className="col-md-1 d-flex align-items-center justify-content-center">
                  <i className="fas fa-arrow-right text-muted"></i>
                </div>
                <div className="col-md-2 text-center">
                  <div className="p-3 border rounded bg-success text-white">
                    <h6>Completed</h6>
                    <h4>{formatNumber(order_funnel.completed_orders)}</h4>
                  </div>
                </div>
                <div className="col-md-1 d-flex align-items-center justify-content-center">
                  <i className="fas fa-arrow-right text-muted"></i>
                </div>
                <div className="col-md-2 text-center">
                  <div className="p-3 border rounded bg-dark text-white">
                    <h6>Delivered</h6>
                    <h4>{formatNumber(order_funnel.delivered_orders)}</h4>
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

export default SalesProcessAnalytics;
