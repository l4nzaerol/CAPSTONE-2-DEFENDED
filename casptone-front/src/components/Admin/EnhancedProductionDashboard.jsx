import React, { useState, useEffect } from "react";
import AppLayout from "../Header";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from "recharts";
import {
  FaChartLine,
  FaUsers,
  FaCogs,
  FaClock,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSpinner,
  FaChartBar,
  FaTruck,
  FaTools
} from "react-icons/fa";
import api from "../../api/client";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const EnhancedProductionDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Use Production-based analytics for accurate, seeded data
      const response = await api.get('/productions/analytics');
      const d = response.data || {};

      // Transform API to local dashboard structure
      const metrics = {
        active_productions: (d.kpis?.in_progress ?? 0),
        completed_productions: d.kpis?.completed ?? 0,
        efficiency_score: (() => {
          const total = d.kpis?.total ?? 0;
          const completed = d.kpis?.completed ?? 0;
          return total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
        })(),
      };

      const workload = Array.isArray(d.stage_workload) ? d.stage_workload.map(w => ({
        stage: w.stage,
        capacity: w.capacity,
        current_workload: w.current_workload,
        utilization_percentage: w.utilization_percentage,
        status: w.status,
        bottleneck_risk: (w.utilization_percentage ?? 0) > 85,
      })) : [];

      const resource_allocation = Array.isArray(d.resource_allocation) ? d.resource_allocation.map(r => ({
        priority: r.priority || 'medium',
        message: r.message,
        action: r.priority === 'high' ? 'Reallocate resources to this stage' : 'Monitor and adjust as needed',
      })) : [];

      const daily_outputs = Array.isArray(d.daily_output) ? d.daily_output.map(item => ({
        date: item.date,
        completed_items: item.quantity,
      })) : [];

      const capacity_utilization = d.capacity_utilization || { utilization_percentage: 0, total_capacity: 0, current_utilization: 0, available_capacity: 0 };

      setAnalytics({
        metrics,
        workload,
        resource_allocation,
        daily_outputs,
        capacity_utilization,
        predictions: null,
        generated_at: new Date().toISOString(),
      });
      setError("");
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError("Failed to load production analytics");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'overloaded': return 'danger';
      case 'busy': return 'warning';
      case 'available': return 'success';
      default: return 'secondary';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container-fluid py-4">
          <div className="text-center">
            <FaSpinner className="fa-spin text-primary" style={{ fontSize: '3rem' }} />
            <h4 className="mt-3">Loading Production Analytics...</h4>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container-fluid py-4">
          <div className="alert alert-danger text-center">
            <FaExclamationTriangle className="me-2" />
            {error}
          </div>
        </div>
      </AppLayout>
    );
  }

  const { metrics, workload, resource_allocation, daily_outputs, capacity_utilization, predictions } = analytics || {};

  return (
    <AppLayout>
      <div className="container-fluid py-4">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="text-primary mb-1">
              <FaChartLine className="me-3" />
              Production Analytics Dashboard
            </h1>
            <p className="text-muted mb-0">Real-time monitoring and optimization insights</p>
          </div>
          <div>
            <button className="btn btn-outline-primary me-2" onClick={fetchAnalytics}>
              <FaSpinner className="me-2" />
              Refresh
            </button>
            <span className="badge bg-success">Live Updates</span>
          </div>
        </div>

        {/* Key Metrics */}
        {metrics && (
          <div className="row mb-4">
            <div className="col-lg-3 col-md-6 mb-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <FaCogs className="text-primary mb-3" style={{ fontSize: '2.5rem' }} />
                  <h3 className="text-primary mb-1">{metrics.active_productions}</h3>
                  <p className="text-muted mb-0">Active Productions</p>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-md-6 mb-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <FaCheckCircle className="text-success mb-3" style={{ fontSize: '2.5rem' }} />
                  <h3 className="text-success mb-1">{metrics.completed_productions}</h3>
                  <p className="text-muted mb-0">Completed Today</p>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-md-6 mb-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <FaChartBar className="text-info mb-3" style={{ fontSize: '2.5rem' }} />
                  <h3 className="text-info mb-1">{metrics.efficiency_score}%</h3>
                  <p className="text-muted mb-0">Efficiency Score</p>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-md-6 mb-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <FaTruck className="text-warning mb-3" style={{ fontSize: '2.5rem' }} />
                  <h3 className="text-warning mb-1">{capacity_utilization?.utilization_percentage || 0}%</h3>
                  <p className="text-muted mb-0">Capacity Utilization</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Capacity Utilization */}
        {capacity_utilization && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-primary text-white">
                  <h5 className="mb-0">
                    <FaUsers className="me-2" />
                    Capacity Utilization Overview
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row align-items-center">
                    <div className="col-md-8">
                      <div className="progress mb-3" style={{ height: '30px' }}>
                        <div 
                          className={`progress-bar ${capacity_utilization.utilization_percentage > 90 ? 'bg-danger' : 
                                 capacity_utilization.utilization_percentage > 70 ? 'bg-warning' : 'bg-success'}`}
                          role="progressbar" 
                          style={{ width: `${capacity_utilization.utilization_percentage}%` }}
                        >
                          {capacity_utilization.utilization_percentage}%
                        </div>
                      </div>
                      <div className="row text-center">
                        <div className="col-4">
                          <div className="h4 text-primary mb-0">{capacity_utilization.total_capacity}</div>
                          <small className="text-muted">Total Capacity</small>
                        </div>
                        <div className="col-4">
                          <div className="h4 text-info mb-0">{capacity_utilization.current_utilization}</div>
                          <small className="text-muted">Currently Used</small>
                        </div>
                        <div className="col-4">
                          <div className="h4 text-success mb-0">{capacity_utilization.available_capacity}</div>
                          <small className="text-muted">Available</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4 text-center">
                      <div className="p-3 bg-light rounded">
                        <FaClock className="text-primary mb-2" style={{ fontSize: '2rem' }} />
                        <div className="h6 text-primary mb-1">Status</div>
                        <div className={`h5 mb-0 ${
                          capacity_utilization.utilization_percentage > 90 ? 'text-danger' : 
                          capacity_utilization.utilization_percentage > 70 ? 'text-warning' : 'text-success'
                        }`}>
                          {capacity_utilization.utilization_percentage > 90 ? 'Overloaded' : 
                           capacity_utilization.utilization_percentage > 70 ? 'Busy' : 'Optimal'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="row">
          {/* Stage Workload */}
          <div className="col-lg-6 mb-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-success text-white">
                <h5 className="mb-0">
                  <FaTools className="me-2" />
                  Stage Workload Analysis
                </h5>
              </div>
              <div className="card-body">
                {workload && workload.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Stage</th>
                          <th>Workload</th>
                          <th>Capacity</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workload.map((stage, index) => (
                          <tr key={index}>
                            <td>
                              <div>
                                <strong>{stage.stage}</strong>
                                {stage.bottleneck_risk && (
                                  <FaExclamationTriangle className="text-danger ms-2" title="Bottleneck Risk" />
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="progress" style={{ height: '20px' }}>
                                <div 
                                  className={`progress-bar bg-${getStatusColor(stage.status)}`}
                                  style={{ width: `${stage.utilization_percentage}%` }}
                                >
                                  {stage.current_workload}/{stage.capacity}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge bg-info">{stage.capacity}</span>
                            </td>
                            <td>
                              <span className={`badge bg-${getStatusColor(stage.status)}`}>
                                {stage.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted">No workload data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Daily Outputs Chart */}
          <div className="col-lg-6 mb-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-info text-white">
                <h5 className="mb-0">
                  <FaChartLine className="me-2" />
                  Daily Production Outputs
                </h5>
              </div>
              <div className="card-body">
                {daily_outputs && daily_outputs.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={daily_outputs}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="completed_items" stroke="#8884d8" fill="#8884d8" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted">No daily output data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resource Allocation Suggestions */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-warning text-dark">
                <h5 className="mb-0">
                  <FaExclamationTriangle className="me-2" />
                  Resource Allocation Suggestions
                </h5>
              </div>
              <div className="card-body">
                {resource_allocation && resource_allocation.length > 0 ? (
                  <div className="row">
                    {resource_allocation.map((suggestion, index) => (
                      <div key={index} className="col-md-6 mb-3">
                        <div className={`alert alert-${getPriorityColor(suggestion.priority)} border-start border-4`}>
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <h6 className="alert-heading">
                                <span className={`badge bg-${getPriorityColor(suggestion.priority)} me-2`}>
                                  {suggestion.priority.toUpperCase()}
                                </span>
                                {suggestion.message}
                              </h6>
                              <p className="mb-0">{suggestion.action}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <FaCheckCircle className="text-success mb-3" style={{ fontSize: '3rem' }} />
                    <h5 className="text-success">All systems optimal!</h5>
                    <p className="text-muted">No resource allocation adjustments needed at this time.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Predictive Analytics */}
        {predictions && (
          <div className="row">
            <div className="col-lg-6 mb-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-dark text-white">
                  <h5 className="mb-0">
                    <FaChartBar className="me-2" />
                    Completion Predictions
                  </h5>
                </div>
                <div className="card-body">
                  {predictions.completion_predictions && predictions.completion_predictions.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Product</th>
                            <th>Stage</th>
                            <th>Progress</th>
                            <th>ETA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {predictions.completion_predictions.map((prediction, index) => (
                            <tr key={index}>
                              <td>#{prediction.order_id}</td>
                              <td>{prediction.product_name}</td>
                              <td>
                                <span className="badge bg-info">{prediction.current_stage}</span>
                              </td>
                              <td>
                                <div className="progress" style={{ height: '15px' }}>
                                  <div 
                                    className="progress-bar bg-primary" 
                                    style={{ width: `${prediction.progress_percentage}%` }}
                                  >
                                    {prediction.progress_percentage}%
                                  </div>
                                </div>
                              </td>
                              <td>
                                <small>
                                  {prediction.estimated_completion_date ? 
                                    new Date(prediction.estimated_completion_date).toLocaleDateString() : 
                                    'TBD'}
                                </small>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted">No active productions to predict</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-lg-6 mb-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-secondary text-white">
                  <h5 className="mb-0">
                    <FaChartLine className="me-2" />
                    Capacity Forecast
                  </h5>
                </div>
                <div className="card-body">
                  {predictions.capacity_forecast ? (
                    <div className="text-center">
                      <div className="mb-4">
                        <h3 className="text-primary">{predictions.capacity_forecast.upcoming_orders}</h3>
                        <p className="text-muted">Upcoming Orders</p>
                      </div>
                      <div className="mb-3">
                        <span className={`badge bg-${
                          predictions.capacity_forecast.capacity_adequacy === 'sufficient' ? 'success' : 'warning'
                        } fs-6`}>
                          {predictions.capacity_forecast.capacity_adequacy === 'sufficient' ? 
                            'Capacity Adequate' : 'May Need Expansion'}
                        </span>
                      </div>
                      {predictions.capacity_forecast.recommended_action && (
                        <div className="alert alert-info">
                          <strong>Recommendation:</strong> {predictions.capacity_forecast.recommended_action}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted">No capacity forecast available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-muted mt-4">
          <small>Last updated: {analytics?.generated_at ? new Date(analytics.generated_at).toLocaleString() : 'Unknown'}</small>
        </div>
      </div>
    </AppLayout>
  );
};

export default EnhancedProductionDashboard;