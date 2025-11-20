import React, { useState, useEffect } from "react";
import axios from "axios";
import AppLayout from "../Header";
import { 
  FaCheckCircle, 
  FaTimesCircle, 
  FaClock, 
  FaBox, 
  FaUser, 
  FaPhone, 
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaSpinner,
  FaExclamationTriangle
} from "react-icons/fa";

const OrderAcceptance = () => {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [acceptedOrders, setAcceptedOrders] = useState([]);
  const [rejectedOrders, setRejectedOrders] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const API_URL = 'http://localhost:8000/api';
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      console.log('Fetching order acceptance data...');
      console.log('API URL:', API_URL);
      console.log('Token:', token ? 'Present' : 'Missing');
      
      const [pending, accepted, rejected, stats] = await Promise.all([
        axios.get(`${API_URL}/orders/pending-acceptance`, { headers }),
        axios.get(`${API_URL}/orders/accepted`, { headers }),
        axios.get(`${API_URL}/orders/rejected`, { headers }),
        axios.get(`${API_URL}/orders/acceptance/statistics`, { headers }),
      ]);

      console.log('Pending orders:', pending.data);
      console.log('Accepted orders:', accepted.data);
      console.log('Rejected orders:', rejected.data);
      console.log('Statistics:', stats.data);

      setPendingOrders(pending.data || []);
      setAcceptedOrders(accepted.data || []);
      setRejectedOrders(rejected.data || []);
      setStatistics(stats.data || {});
    } catch (error) {
      console.error('Error fetching orders:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async () => {
    if (!selectedOrder) return;

    setProcessing(true);
    try {
      const response = await axios.post(
        `${API_URL}/orders/${selectedOrder.id}/accept`,
        { admin_notes: adminNotes },
        { headers }
      );

      console.log('Accept order response:', response.data);
      
      const productionsCreated = response.data.productions_created || 0;
      alert(`Order accepted successfully! ${productionsCreated} production record(s) have been created.`);
      
      setShowAcceptModal(false);
      setAdminNotes('');
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      console.error('Error accepting order:', error);
      console.error('Error response:', error.response?.data);
      alert('Failed to accept order: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!selectedOrder || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setProcessing(true);
    try {
      await axios.post(
        `${API_URL}/orders/${selectedOrder.id}/reject`,
        { 
          rejection_reason: rejectionReason,
          admin_notes: adminNotes 
        },
        { headers }
      );

      alert('Order rejected successfully.');
      setShowRejectModal(false);
      setRejectionReason('');
      setAdminNotes('');
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      console.error('Error rejecting order:', error);
      alert('Failed to reject order: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  };

  const openAcceptModal = (order) => {
    setSelectedOrder(order);
    setShowAcceptModal(true);
  };

  const openRejectModal = (order) => {
    setSelectedOrder(order);
    setShowRejectModal(true);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mt-5 text-center">
          <FaSpinner className="fa-spin text-primary" style={{ fontSize: '3rem' }} />
          <p className="mt-3">Loading orders...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container-fluid mt-4">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12">
            <h1 className="text-primary">
              <FaCheckCircle className="me-3" />
              Order Acceptance Management
            </h1>
            <p className="text-muted">Review and accept customer orders before production</p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center">
                <FaClock className="text-warning mb-2" style={{ fontSize: '2rem' }} />
                <h3 className="text-warning">{statistics.pending || 0}</h3>
                <p className="text-muted mb-0">Pending Review</p>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center">
                <FaCheckCircle className="text-success mb-2" style={{ fontSize: '2rem' }} />
                <h3 className="text-success">{statistics.accepted_today || 0}</h3>
                <p className="text-muted mb-0">Accepted Today</p>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center">
                <FaCheckCircle className="text-info mb-2" style={{ fontSize: '2rem' }} />
                <h3 className="text-info">{statistics.accepted_this_week || 0}</h3>
                <p className="text-muted mb-0">Accepted This Week</p>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center">
                <FaTimesCircle className="text-danger mb-2" style={{ fontSize: '2rem' }} />
                <h3 className="text-danger">{statistics.rejected || 0}</h3>
                <p className="text-muted mb-0">Rejected</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Pending ({pendingOrders.length})
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === 'accepted' ? 'active' : ''}`}
              onClick={() => setActiveTab('accepted')}
            >
              Accepted ({acceptedOrders.length})
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === 'rejected' ? 'active' : ''}`}
              onClick={() => setActiveTab('rejected')}
            >
              Rejected ({rejectedOrders.length})
            </button>
          </li>
        </ul>

        {/* Pending Orders */}
        {activeTab === 'pending' && (
          <div className="row">
            {pendingOrders.length > 0 ? (
              pendingOrders.map((order) => (
                <div key={order.id} className="col-md-6 mb-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-header bg-warning text-dark">
                      <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">
                          <FaClock className="me-2" />
                          Order {order.order_number}
                        </h5>
                        <span className="badge bg-light text-dark">
                          {order.days_waiting} days waiting
                        </span>
                      </div>
                    </div>
                    <div className="card-body">
                      {/* Customer Info */}
                      <div className="mb-3">
                        <h6 className="text-primary">Customer Information</h6>
                        <div className="small">
                          <div><FaUser className="me-2" />{order.customer_name}</div>
                          <div><FaPhone className="me-2" />{order.customer_phone}</div>
                          <div><FaMapMarkerAlt className="me-2" />{order.shipping_address}</div>
                        </div>
                      </div>

                      {/* Order Items */}
                      <div className="mb-3">
                        <h6 className="text-primary">Order Items</h6>
                        {order.items.map((item, idx) => (
                          <div key={idx} className="d-flex justify-content-between small mb-1">
                            <span>
                              {item.product_name} x{item.quantity}
                              {item.requires_production && (
                                <span className="badge bg-info ms-2">Production Required</span>
                              )}
                            </span>
                            <span>₱{item.subtotal.toLocaleString()}</span>
                          </div>
                        ))}
                        <hr />
                        <div className="d-flex justify-content-between fw-bold">
                          <span>Total:</span>
                          <span>₱{order.total_price.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Payment Info */}
                      <div className="mb-3">
                        <small className="text-muted">
                          <FaMoneyBillWave className="me-2" />
                          Payment: {order.payment_method?.toUpperCase()} - {order.payment_status}
                        </small>
                      </div>

                      {/* Action Buttons */}
                      <div className="d-grid gap-2">
                        <button 
                          className="btn btn-success"
                          onClick={() => openAcceptModal(order)}
                        >
                          <FaCheckCircle className="me-2" />
                          Accept Order
                        </button>
                        <button 
                          className="btn btn-outline-danger"
                          onClick={() => openRejectModal(order)}
                        >
                          <FaTimesCircle className="me-2" />
                          Reject Order
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-12">
                <div className="alert alert-info text-center">
                  <FaCheckCircle className="me-2" />
                  No pending orders to review
                </div>
              </div>
            )}
          </div>
        )}

        {/* Accepted Orders */}
        {activeTab === 'accepted' && (
          <div className="row">
            {acceptedOrders.length > 0 ? (
              acceptedOrders.slice(0, 20).map((order) => (
                <div key={order.id} className="col-md-6 mb-3">
                  <div className="card border-0 shadow-sm">
                    <div className="card-body">
                      <div className="d-flex justify-content-between">
                        <div>
                          <h6>Order #{order.id}</h6>
                          <small className="text-muted">{order.user?.name}</small>
                        </div>
                        <div className="text-end">
                          <span className="badge bg-success">Accepted</span>
                          <div className="small text-muted">
                            {new Date(order.accepted_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-12">
                <div className="alert alert-info text-center">No accepted orders</div>
              </div>
            )}
          </div>
        )}

        {/* Rejected Orders */}
        {activeTab === 'rejected' && (
          <div className="row">
            {rejectedOrders.length > 0 ? (
              rejectedOrders.slice(0, 20).map((order) => (
                <div key={order.id} className="col-md-6 mb-3">
                  <div className="card border-0 shadow-sm">
                    <div className="card-body">
                      <div className="d-flex justify-content-between">
                        <div>
                          <h6>Order #{order.id}</h6>
                          <small className="text-muted">{order.user?.name}</small>
                          {order.rejection_reason && (
                            <div className="small text-danger mt-2">
                              <FaExclamationTriangle className="me-1" />
                              {order.rejection_reason}
                            </div>
                          )}
                        </div>
                        <div className="text-end">
                          <span className="badge bg-danger">Rejected</span>
                          <div className="small text-muted">
                            {new Date(order.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-12">
                <div className="alert alert-info text-center">No rejected orders</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accept Modal */}
      {showAcceptModal && selectedOrder && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <FaCheckCircle className="me-2" />
                  Accept Order {selectedOrder.order_number}
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setShowAcceptModal(false)}
                  disabled={processing}
                ></button>
              </div>
              <div className="modal-body">
                <p>
                  You are about to accept this order. Production records will be created automatically
                  for all items that require production.
                </p>
                <div className="mb-3">
                  <label className="form-label">Admin Notes (Optional)</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add any notes about this order..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowAcceptModal(false)}
                  disabled={processing}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-success" 
                  onClick={handleAcceptOrder}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <FaSpinner className="fa-spin me-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FaCheckCircle className="me-2" />
                      Accept Order
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedOrder && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">
                  <FaTimesCircle className="me-2" />
                  Reject Order {selectedOrder.order_number}
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setShowRejectModal(false)}
                  disabled={processing}
                ></button>
              </div>
              <div className="modal-body">
                <p className="text-danger">
                  <FaExclamationTriangle className="me-2" />
                  You are about to reject this order. The customer will be notified.
                </p>
                <div className="mb-3">
                  <label className="form-label">Rejection Reason *</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this order is being rejected..."
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Admin Notes (Optional)</label>
                  <textarea 
                    className="form-control"
                    rows="2"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Internal notes..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowRejectModal(false)}
                  disabled={processing}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={handleRejectOrder}
                  disabled={processing || !rejectionReason.trim()}
                >
                  {processing ? (
                    <>
                      <FaSpinner className="fa-spin me-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FaTimesCircle className="me-2" />
                      Reject Order
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default OrderAcceptance;
