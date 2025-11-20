// src/components/Security/AdminMonitoring.js
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "../../api/client";

const AdminMonitoring = () => {
  const [suspiciousOrders, setSuspiciousOrders] = useState([]);
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [systemStats, setSystemStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchMonitoringData();
    // Set up real-time monitoring
    const interval = setInterval(fetchMonitoringData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      
      // Fetch suspicious orders
      const ordersResponse = await api.get('/admin/suspicious-orders');
      setSuspiciousOrders(ordersResponse.data);

      // Fetch fraud alerts
      const alertsResponse = await api.get('/admin/fraud-alerts');
      setFraudAlerts(alertsResponse.data);

      // Fetch system statistics
      const statsResponse = await api.get('/admin/system-stats');
      setSystemStats(statsResponse.data);

    } catch (error) {
      console.error("Error fetching monitoring data:", error);
      toast.error("Error loading monitoring data");
    } finally {
      setLoading(false);
    }
  };

  const handleOrderAction = async (orderId, action) => {
    try {
      setLoading(true);
      
      const response = await api.post(`/admin/orders/${orderId}/${action}`);
      
      if (response.data.success) {
        toast.success(`Order ${action} successfully`);
        fetchMonitoringData(); // Refresh data
      } else {
        toast.error(`Failed to ${action} order`);
      }
    } catch (error) {
      toast.error(`Error ${action}ing order`);
    } finally {
      setLoading(false);
    }
  };

  const handleFraudAlert = async (alertId, action) => {
    try {
      setLoading(true);
      
      const response = await api.post(`/admin/fraud-alerts/${alertId}/${action}`);
      
      if (response.data.success) {
        toast.success(`Fraud alert ${action} successfully`);
        fetchMonitoringData(); // Refresh data
      } else {
        toast.error(`Failed to ${action} fraud alert`);
      }
    } catch (error) {
      toast.error(`Error ${action}ing fraud alert`);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case "high": return "#dc3545";
      case "medium": return "#ffc107";
      case "low": return "#28a745";
      default: return "#6c757d";
    }
  };

  return (
    <div className="admin-monitoring-container">
      <div className="monitoring-header">
        <h2>🛡️ Security Monitoring Dashboard</h2>
        <button 
          className="btn-refresh" 
          onClick={fetchMonitoringData}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* System Statistics */}
      <div className="system-stats">
        <h3>📊 System Statistics</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <h4>Total Orders Today</h4>
            <span className="stat-value">{systemStats.totalOrders || 0}</span>
          </div>
          <div className="stat-card">
            <h4>Suspicious Orders</h4>
            <span className="stat-value" style={{ color: "#dc3545" }}>
              {systemStats.suspiciousOrders || 0}
            </span>
          </div>
          <div className="stat-card">
            <h4>Blocked Orders</h4>
            <span className="stat-value" style={{ color: "#dc3545" }}>
              {systemStats.blockedOrders || 0}
            </span>
          </div>
          <div className="stat-card">
            <h4>Fraud Alerts</h4>
            <span className="stat-value" style={{ color: "#ffc107" }}>
              {systemStats.fraudAlerts || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Suspicious Orders */}
      <div className="suspicious-orders">
        <h3>🚨 Suspicious Orders</h3>
        <div className="orders-list">
          {suspiciousOrders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <span className="order-id">Order #{order.id}</span>
                <span 
                  className="risk-level"
                  style={{ color: getRiskColor(order.riskLevel) }}
                >
                  {order.riskLevel.toUpperCase()} RISK
                </span>
              </div>
              
              <div className="order-details">
                <p><strong>Customer:</strong> {order.customerName}</p>
                <p><strong>Amount:</strong> ₱{order.totalAmount.toLocaleString()}</p>
                <p><strong>Payment:</strong> {order.paymentMethod.toUpperCase()}</p>
                <p><strong>Address:</strong> {order.shippingAddress}</p>
                <p><strong>Phone:</strong> {order.contactPhone}</p>
              </div>

              <div className="fraud-indicators">
                <h4>Risk Indicators:</h4>
                <ul>
                  {order.fraudIndicators.map((indicator, index) => (
                    <li key={index}>{indicator}</li>
                  ))}
                </ul>
              </div>

              <div className="order-actions">
                <button 
                  className="btn-approve"
                  onClick={() => handleOrderAction(order.id, 'approve')}
                  disabled={loading}
                >
                  Approve
                </button>
                <button 
                  className="btn-reject"
                  onClick={() => handleOrderAction(order.id, 'reject')}
                  disabled={loading}
                >
                  Reject
                </button>
                <button 
                  className="btn-review"
                  onClick={() => setSelectedOrder(order)}
                  disabled={loading}
                >
                  Review Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fraud Alerts */}
      <div className="fraud-alerts">
        <h3>⚠️ Fraud Alerts</h3>
        <div className="alerts-list">
          {fraudAlerts.map(alert => (
            <div key={alert.id} className="alert-card">
              <div className="alert-header">
                <span className="alert-type">{alert.type}</span>
                <span className="alert-time">{new Date(alert.createdAt).toLocaleString()}</span>
              </div>
              
              <div className="alert-content">
                <p><strong>Description:</strong> {alert.description}</p>
                <p><strong>Severity:</strong> {alert.severity}</p>
                <p><strong>Status:</strong> {alert.status}</p>
              </div>

              <div className="alert-actions">
                <button 
                  className="btn-acknowledge"
                  onClick={() => handleFraudAlert(alert.id, 'acknowledge')}
                  disabled={loading}
                >
                  Acknowledge
                </button>
                <button 
                  className="btn-resolve"
                  onClick={() => handleFraudAlert(alert.id, 'resolve')}
                  disabled={loading}
                >
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="order-details-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Order Details - #{selectedOrder.id}</h3>
              <button 
                className="btn-close"
                onClick={() => setSelectedOrder(null)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="order-info">
                <h4>Order Information</h4>
                <p><strong>Customer:</strong> {selectedOrder.customerName}</p>
                <p><strong>Email:</strong> {selectedOrder.customerEmail}</p>
                <p><strong>Phone:</strong> {selectedOrder.contactPhone}</p>
                <p><strong>Total Amount:</strong> ₱{selectedOrder.totalAmount.toLocaleString()}</p>
                <p><strong>Payment Method:</strong> {selectedOrder.paymentMethod}</p>
                <p><strong>Shipping Address:</strong> {selectedOrder.shippingAddress}</p>
              </div>

              <div className="fraud-analysis">
                <h4>Fraud Analysis</h4>
                <p><strong>Risk Level:</strong> {selectedOrder.riskLevel}</p>
                <p><strong>Fraud Score:</strong> {selectedOrder.fraudScore}/100</p>
                <div className="indicators">
                  <h5>Risk Indicators:</h5>
                  <ul>
                    {selectedOrder.fraudIndicators.map((indicator, index) => (
                      <li key={index}>{indicator}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="order-items">
                <h4>Order Items</h4>
                <ul>
                  {selectedOrder.items.map((item, index) => (
                    <li key={index}>
                      {item.name} - Qty: {item.quantity} - ₱{item.price.toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-approve"
                onClick={() => {
                  handleOrderAction(selectedOrder.id, 'approve');
                  setSelectedOrder(null);
                }}
                disabled={loading}
              >
                Approve Order
              </button>
              <button 
                className="btn-reject"
                onClick={() => {
                  handleOrderAction(selectedOrder.id, 'reject');
                  setSelectedOrder(null);
                }}
                disabled={loading}
              >
                Reject Order
              </button>
              <button 
                className="btn-cancel"
                onClick={() => setSelectedOrder(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMonitoring;
