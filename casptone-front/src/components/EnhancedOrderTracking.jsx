import React, { useState, useEffect } from "react";
import axios from "axios";
import { Spinner, Badge, Collapse, Card, ProgressBar, Alert, Button } from "react-bootstrap";
import { FaBox, FaClock, FaTruck, FaCheckCircle, FaHammer, FaTools, FaPaintBrush, FaClipboardCheck, FaCalendarAlt, FaTimes } from "react-icons/fa";
import { toast } from "sonner";
import "./EnhancedOrderTracking.css";

const API = "http://localhost:8000/api";

const EnhancedOrderTracking = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [tracking, setTracking] = useState({});

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("User not authenticated.");

      const response = await axios.get(`${API}/my-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setOrders(response.data || []);
    } catch (err) {
      setError("Failed to load orders. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTracking = async (orderId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/orders/${orderId}/tracking`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTracking((prev) => ({ ...prev, [orderId]: res.data }));
    } catch (e) {
      setTracking((prev) => ({ ...prev, [orderId]: { error: "Failed to fetch tracking" } }));
    }
  };

  const toggleExpand = (orderId) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      fetchTracking(orderId);
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("User not authenticated.");

      const confirmed = window.confirm(
        "Are you sure you want to cancel this order?\n\n" +
        "This action cannot be undone and any materials already deducted will be restored to inventory."
      );

      if (!confirmed) return;

      const response = await axios.patch(`${API}/orders/${orderId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Order cancelled successfully!", {
        description: "Your order has been cancelled and materials have been restored.",
        duration: 4000,
      });

      // Refresh orders to show updated status
      await fetchOrders();
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to cancel order. Please try again.";
      toast.error("Cancellation failed", {
        description: errorMessage,
        duration: 4000,
      });
    }
  };

  const canCancelOrder = (order) => {
    // Check if order is already cancelled or completed
    if (order.status === 'cancelled' || order.status === 'delivered' || order.status === 'completed') {
      return false;
    }

    // For Alkansya (stocked products) - can cancel anytime EXCEPT when ready for delivery
    const hasAlkansya = order.items?.some(item => 
      item.product?.category_name === 'Alkansya' || 
      item.product?.category_name === 'Stocked Products'
    );

    if (hasAlkansya) {
      // Alkansya cannot be cancelled if ready for delivery
      if (order.status === 'ready_for_delivery') {
        return false;
      }
      return true;
    }

    // For made-to-order products - only within 3 days and not accepted
    const hasMadeToOrder = order.items?.some(item => 
      item.product?.category_name === 'Made to Order' || 
      item.product?.category_name === 'made_to_order'
    );

    if (hasMadeToOrder) {
      // Check if order is not accepted
      if (order.tracking?.acceptance_status === 'accepted') {
        return false;
      }

      // Check if within 3 days
      const orderDate = new Date(order.checkout_date);
      const now = new Date();
      const daysDiff = (now - orderDate) / (1000 * 60 * 60 * 24);

      return daysDiff <= 3;
    }

    return false;
  };

  const getStageIcon = (stage) => {
    switch (stage) {
      case 'Design':
      case 'Planning':
        return <FaTools className="text-primary" />;
      case 'Preparation':
      case 'Material Selection':
        return <FaHammer className="text-warning" />;
      case 'Cutting':
      case 'Cutting and Shaping':
        return <FaTools className="text-danger" />;
      case 'Assembly':
        return <FaBox className="text-info" />;
      case 'Finishing':
        return <FaPaintBrush className="text-success" />;
      case 'Quality Control':
      case 'Quality Assurance':
        return <FaClipboardCheck className="text-primary" />;
      default:
        return <FaClock className="text-muted" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "warning";
      case "processing":
      case "in_production":
        return "info";
      case "completed":
        return "success";
      case "canceled":
        return "danger";
      default:
        return "secondary";
    }
  };

  const getStageStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "in_progress":
        return "primary";
      case "pending":
        return "secondary";
      default:
        return "light";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading)
    return (
      <div className="d-flex justify-content-center mt-4">
        <Spinner animation="border" variant="primary" />
        <span className="ms-3 text-muted">Loading your orders...</span>
      </div>
    );

  if (error) return <Alert variant="danger" className="text-center fw-bold">{error}</Alert>;

  return (
    <div className="enhanced-order-tracking">
      <div className="mb-4">
        <h2 className="fw-bold text-primary">
          <FaTruck className="me-2" />
          Order Tracking
        </h2>
        <p className="text-muted">Track the progress of your furniture orders in real-time</p>
      </div>

      {orders.length > 0 ? (
        orders.map((order) => {
          const track = tracking[order.id] || {};
          return (
            <Card key={order.id} className="mb-4 shadow-sm order-card">
              <Card.Header
                className="d-flex justify-content-between align-items-center order-header"
                onClick={() => toggleExpand(order.id)}
                style={{ cursor: "pointer" }}
              >
                <div className="d-flex align-items-center">
                  <FaBox className="me-3 text-primary" style={{ fontSize: '1.2rem' }} />
                  <div>
                    <span className="fw-bold fs-5">Order #{order.id}</span>
                    <div className="small text-muted">
                      Placed on {formatDate(order.checkout_date)}
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Badge bg={getStatusColor(order.status)} className="fs-6 px-3 py-2">
                    {order.status}
                  </Badge>
                  {order.payment_status && (
                    <Badge bg={order.payment_status === 'paid' ? 'success' : (order.payment_status === 'cod_pending' ? 'warning' : 'secondary')}>
                      {order.payment_status}
                    </Badge>
                  )}
                  {canCancelOrder(order) && (
                    <Button 
                      variant="outline-danger" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelOrder(order.id);
                      }}
                      title="Cancel this order"
                    >
                      <FaTimes className="me-1" />
                      Cancel Order
                    </Button>
                  )}
                  <Button variant="outline-primary" size="sm">
                    {expandedOrder === order.id ? 'Hide Details' : 'View Details'}
                  </Button>
                </div>
              </Card.Header>

              <Collapse in={expandedOrder === order.id}>
                <div>
                  <Card.Body>
                    {/* Overall Progress */}
                    {track.overall && !track.error && (
                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h5 className="fw-bold mb-0">
                            <FaCalendarAlt className="me-2 text-primary" />
                            Overall Progress
                          </h5>
                          <div className="text-end">
                            <div className="fw-bold text-primary fs-4">{track.overall.progress_pct}%</div>
                            <div className="small text-muted">ETA: {track.overall.eta}</div>
                          </div>
                        </div>
                        <ProgressBar
                          now={track.overall.progress_pct}
                          variant="primary"
                          className="mb-3"
                          style={{ height: '12px' }}
                        />
                        <div className="row text-center">
                          <div className="col-3">
                            <div className="fw-bold text-primary">{track.overall.total}</div>
                            <div className="small text-muted">Total Items</div>
                          </div>
                          <div className="col-3">
                            <div className="fw-bold text-success">{track.overall.completed}</div>
                            <div className="small text-muted">Completed</div>
                          </div>
                          <div className="col-3">
                            <div className="fw-bold text-info">{track.overall.in_progress}</div>
                            <div className="small text-muted">In Progress</div>
                          </div>
                          <div className="col-3">
                            <div className="fw-bold text-warning">{track.overall.pending}</div>
                            <div className="small text-muted">Pending</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Order Items */}
                    <div className="mb-4">
                      <h5 className="fw-bold mb-3">
                        <FaBox className="me-2 text-primary" />
                        Order Items
                      </h5>
                      <div className="row">
                        {order.items.map((item) => (
                          <div key={item.id} className="col-md-6 mb-3">
                            <Card className="h-100">
                              <Card.Body>
                                <div className="d-flex justify-content-between align-items-start">
                                  <div>
                                    <h6 className="fw-bold mb-1">{item.product?.name || "Unknown Product"}</h6>
                                    <div className="small text-muted">Quantity: {item.quantity}</div>
                                    <div className="small text-muted">Unit Price: ₱{item.product?.price?.toLocaleString()}</div>
                                  </div>
                                  <div className="text-end">
                                    <div className="fw-bold text-success fs-5">
                                      ₱{(item.product?.price * item.quantity).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              </Card.Body>
                            </Card>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stage Breakdown */}
                    {track.stage_summary && track.stage_summary.length > 0 && (
                      <div className="mb-4">
                        <h5 className="fw-bold mb-3">
                          <FaClipboardCheck className="me-2 text-primary" />
                          Production Stages
                        </h5>
                        <div className="row">
                          {track.stage_summary.map((stage, index) => (
                            <div key={stage.stage} className="col-md-6 col-lg-4 mb-3">
                              <Card className="h-100 stage-card">
                                <Card.Body className="text-center">
                                  <div className="mb-2">
                                    {getStageIcon(stage.stage)}
                                  </div>
                                  <h6 className="fw-bold mb-2">{stage.stage}</h6>
                                  <div className="row text-center">
                                    <div className="col-4">
                                      <div className="fw-bold text-warning">{stage.pending}</div>
                                      <div className="small text-muted">Pending</div>
                                    </div>
                                    <div className="col-4">
                                      <div className="fw-bold text-info">{stage.in_progress}</div>
                                      <div className="small text-muted">Active</div>
                                    </div>
                                    <div className="col-4">
                                      <div className="fw-bold text-success">{stage.completed}</div>
                                      <div className="small text-muted">Done</div>
                                    </div>
                                  </div>
                                </Card.Body>
                              </Card>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detailed Tracking */}
                    {track.trackings && track.trackings.length > 0 && (
                      <div className="mb-4">
                        <h5 className="fw-bold mb-3">
                          <FaTruck className="me-2 text-primary" />
                          Detailed Tracking
                        </h5>
                        {track.trackings.map((tracking, index) => (
                          <Card key={index} className="mb-3">
                            <Card.Header className="bg-light">
                              <div className="d-flex justify-content-between align-items-center">
                                <h6 className="fw-bold mb-0">{tracking.product_name}</h6>
                                <div className="d-flex align-items-center gap-2">
                                  <Badge bg={getStageStatusColor(tracking.status)}>
                                    {tracking.current_stage}
                                  </Badge>
                                  <Badge bg="info">
                                    {tracking.progress_percentage}%
                                  </Badge>
                                </div>
                              </div>
                            </Card.Header>
                            <Card.Body>
                              {tracking.process_timeline && (
                                <div className="timeline">
                                  {tracking.process_timeline.map((process, processIndex) => (
                                    <div key={processIndex} className="timeline-item d-flex align-items-center mb-3">
                                      <div className="timeline-icon me-3">
                                        {getStageIcon(process.stage)}
                                      </div>
                                      <div className="flex-grow-1">
                                        <div className="d-flex justify-content-between align-items-center">
                                          <h6 className="mb-1">{process.stage}</h6>
                                          <Badge bg={getStageStatusColor(process.status)}>
                                            {process.status}
                                          </Badge>
                                        </div>
                                        <p className="small text-muted mb-1">{process.description}</p>
                                        <div className="small text-muted">
                                          Duration: {process.estimated_duration}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {tracking.estimated_completion_date && (
                                <div className="mt-3 p-2 bg-light rounded">
                                  <small className="text-muted">
                                    <FaCalendarAlt className="me-1" />
                                    Estimated completion: {formatDate(tracking.estimated_completion_date)}
                                  </small>
                                </div>
                              )}
                            </Card.Body>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Order Information */}
                    <div className="mt-4 p-3 bg-light rounded">
                      <h6 className="fw-bold mb-2">Order Information</h6>
                      <div className="row">
                        <div className="col-md-6">
                          <p className="mb-1">
                            <FaClock className="me-2 text-muted" />
                            <strong>Placed on:</strong> {new Date(order.created_at).toLocaleString()}
                          </p>
                          <p className="mb-1">
                            <strong>Payment:</strong> {(order.payment_method || 'cod').toUpperCase()}
                          </p>
                          <p className="mb-1">
                            <strong>Status:</strong> {order.payment_status || 'unpaid'}
                          </p>
                        </div>
                        <div className="col-md-6">
                          <p className="mb-1">
                            <strong>Total Amount:</strong> ₱{Number(order.total_price).toLocaleString()}
                          </p>
                          {order.transaction_ref && (
                            <p className="mb-1">
                              <strong>Reference:</strong> {order.transaction_ref}
                            </p>
                          )}
                          <p className="mb-1">
                            <FaTruck className="me-2 text-muted" />
                            <strong>Delivery:</strong> {order.delivery_date || 'TBD'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {track.error && (
                      <Alert variant="warning" className="mt-3">
                        <FaClock className="me-2" />
                        {track.error}
                      </Alert>
                    )}
                  </Card.Body>
                </div>
              </Collapse>
            </Card>
          );
        })
      ) : (
        <Card>
          <Card.Body className="text-center py-5">
            <FaBox className="text-muted mb-3" style={{ fontSize: '3rem' }} />
            <h5 className="text-muted">No orders found</h5>
            <p className="text-muted">You haven't placed any orders yet.</p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default EnhancedOrderTracking;
