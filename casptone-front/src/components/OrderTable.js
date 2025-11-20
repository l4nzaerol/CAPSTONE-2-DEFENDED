// src/components/OrderTable.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Spinner, Badge, Collapse, Card, ProgressBar, Button } from "react-bootstrap";
import { FaBox, FaClock, FaTruck, FaCheckCircle, FaHammer, FaTools, FaPaintBrush, FaCut, FaTimes } from "react-icons/fa";
import { toast } from "sonner";
import "./OrderTable.css";

const API = "http://localhost:8000/api";

// Stage descriptions and estimated days
const stageDetails = {
  "Material Preparation": {
    description: "Selecting and preparing high-quality wood materials, checking inventory, and organizing materials for production.",
    estimatedDays: 1,
    icon: "📦"
  },
  "Cutting & Shaping": {
    description: "Cutting wood pieces to precise measurements and shaping components according to design specifications.",
    estimatedDays: 2,
    icon: "✂️"
  },
  "Assembly": {
    description: "Joining and assembling all components together, ensuring structural integrity and proper alignment.",
    estimatedDays: 3,
    icon: "🔨"
  },
  "Sanding & Surface Preparation": {
    description: "Smoothing all surfaces, removing imperfections, and preparing the furniture for finishing treatments.",
    estimatedDays: 2,
    icon: "⚙️"
  },
  "Finishing": {
    description: "Applying stains, varnish, or paint to protect and enhance the wood's natural beauty.",
    estimatedDays: 3,
    icon: "🎨"
  },
  "Quality Check & Packaging": {
    description: "Thorough inspection for quality assurance, final touch-ups, and careful packaging for delivery.",
    estimatedDays: 1,
    icon: "✅"
  }
};

const OrderTable = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [tracking, setTracking] = useState({}); // store tracking data per order

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("User not authenticated.");

      const response = await axios.get(`${API}/my-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const ordersData = response.data || [];
      
      // Debug logging for receipt confirmation
      ordersData.forEach(order => {
        if (order.status === 'ready_for_delivery') {
          console.log(`📦 [OrderTable] Order #${order.id} ready for delivery:`, {
            status: order.status,
            receipt_confirmed: order.receipt_confirmed,
            not_received_reason: order.not_received_reason
          });
        }
      });

      setOrders(ordersData);
    } catch (err) {
      setError("Failed to load orders. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTracking = async (orderId) => {
    try {
      const token = localStorage.getItem("token");
      console.log(`🔍 [OrderTable] Fetching tracking for order #${orderId}...`);
      const res = await axios.get(`${API}/orders/${orderId}/tracking`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`✅ [OrderTable] Tracking data received for order #${orderId}:`, res.data);
      
      // Log process details
      if (res.data.trackings) {
        res.data.trackings.forEach(tracking => {
          console.log(`📦 Product: ${tracking.product_name}`, {
            is_tracked: tracking.is_tracked_product,
            has_processes: !!tracking.processes,
            process_count: tracking.processes?.length || 0
          });
          
          if (tracking.processes) {
            const delayed = tracking.processes.filter(p => p.delay_reason);
            if (delayed.length > 0) {
              console.log(`⚠️ DELAYED PROCESSES FOUND:`, delayed.map(p => ({
                name: p.process_name,
                reason: p.delay_reason,
                completed_by: p.completed_by_name
              })));
            }
          }
        });
      }
      
      setTracking((prev) => ({ ...prev, [orderId]: res.data }));
    } catch (e) {
      console.error(`❌ [OrderTable] Failed to fetch tracking for order #${orderId}:`, e);
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
        ""
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
      if (order.acceptance_status === 'accepted') {
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

  if (loading)
    return (
      <div className="d-flex justify-content-center mt-4">
        <Spinner animation="border" variant="primary" />
        <span className="ms-3 text-muted">Loading your orders...</span>
      </div>
    );

  if (error) return <p className="text-danger text-center fw-bold">{error}</p>;

  return (
    <div className="order-container" style={{ padding: '0 0.5rem' }}>
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
                <div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <FaBox className="text-primary" />
                    <span className="fw-bold">Order #{order.id}</span>
                    {order.tracking_number && (
                      <span className="badge bg-info" style={{ fontSize: '0.85rem' }}>
                        📦 {order.tracking_number}
                      </span>
                    )}
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <Badge bg={getStatusVariant(order.status)}>{order.status}</Badge>
                  {order.payment_status && (
                    <Badge bg={order.payment_status==='paid' ? 'success' : (order.payment_status==='cod_pending' ? 'warning' : 'secondary')}>
                      {order.payment_status}
                    </Badge>
                  )}
                  {canCancelOrder(order) && (
                    <Badge 
                      bg="danger"
                      as="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelOrder(order.id);
                      }}
                      title="Cancel this order"
                      style={{
                        cursor: 'pointer',
                        border: 'none',
                        padding: '0.35em 0.65em',
                        fontSize: '0.875rem'
                      }}
                    >
                      <FaTimes className="me-1" />
                      Cancel Order
                    </Badge>
                  )}
                </div>
              </Card.Header>

              <Collapse in={expandedOrder === order.id}>
                <div>
                  <Card.Body>
                    {/* === STATUS TRACKER === */}
                    <div className="mb-3">
                      <strong>Status Tracker:</strong>
                      <div className="d-flex align-items-center mt-2 status-tracker" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                        {renderStatusSteps(order.status)}
                      </div>
                    </div>

                    {/* === RECEIPT CONFIRMATION === */}
                    {order.status === 'ready_for_delivery' && (order.receipt_confirmed === null || order.receipt_confirmed === undefined) && (
                      <div className="alert alert-info mb-3">
                        <div className="text-center">
                          <FaTruck className="mb-3" style={{ fontSize: '3rem', color: '#0dcaf0' }} />
                          <h5 className="mb-3">Your order is ready for delivery!</h5>
                          <p className="mb-4">Have you received your order?</p>
                          <div className="d-flex justify-content-center gap-3 flex-wrap">
                            <Button
                              variant="success"
                              size="lg"
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem("token");
                                  const response = await axios.post(
                                    `${API}/orders/${order.id}/confirm-receipt`,
                                    { received: true },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  toast.success("Order receipt confirmed!", {
                                    description: "Thank you for confirming. Your order is now marked as completed.",
                                    duration: 4000,
                                  });
                                  await fetchOrders();
                                } catch (err) {
                                  toast.error("Failed to confirm receipt", {
                                    description: err.response?.data?.message || "Please try again.",
                                    duration: 4000,
                                  });
                                }
                              }}
                            >
                              <FaCheckCircle className="me-2" />
                              Yes, I Received It
                            </Button>
                            <Button
                              variant="warning"
                              size="lg"
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem("token");
                                  const response = await axios.post(
                                    `${API}/orders/${order.id}/confirm-receipt`,
                                    { received: false },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  toast.info("Noted", {
                                    description: "We have noted that you have not received the order. Our team will investigate and contact you soon.",
                                    duration: 5000,
                                  });
                                  await fetchOrders();
                                } catch (err) {
                                  toast.error("Failed to submit", {
                                    description: err.response?.data?.message || "Please try again.",
                                    duration: 4000,
                                  });
                                }
                              }}
                            >
                              <FaTimes className="me-2" />
                              No, I Haven't Received It
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* === NOT RECEIVED REASON === */}
                    {order.status === 'ready_for_delivery' && order.receipt_confirmed === false && order.not_received_reason && (
                      <div className="alert alert-warning mb-3">
                        <div className="d-flex align-items-start">
                          <FaTimes className="me-3 mt-1" style={{ fontSize: '2rem' }} />
                          <div className="flex-grow-1">
                            <h6 className="alert-heading mb-2">Order Not Delivered</h6>
                            <p className="mb-0">
                              <strong>Reason:</strong> {order.not_received_reason}
                            </p>
                            {order.not_received_at && (
                              <small className="text-muted d-block mt-2">
                                Updated: {new Date(order.not_received_at).toLocaleString()}
                              </small>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* === ORDER ITEMS === */}
                    <h6 className="fw-bold mb-3">Order Items</h6>
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="d-flex justify-content-between border-bottom py-2"
                      >
                        <span>
                          {item.product?.name || "Unknown Product"} ×{" "}
                          {item.quantity}
                        </span>
                        <span className="fw-bold text-success">
                          ₱
                          {(item.product?.price * item.quantity).toLocaleString(
                            "en-PH",
                            { minimumFractionDigits: 2 }
                          )}
                        </span>
                      </div>
                    ))}
                    
                    {/* Shipping Fee and Total - Right Aligned */}
                    <div className="d-flex justify-content-between border-bottom py-2">
                      <span>Shipping Fee:</span>
                      <span className={order.shipping_fee > 0 ? 'fw-bold text-success' : 'fw-bold text-success'}>
                        {order.shipping_fee > 0 ? (
                          `₱${Number(order.shipping_fee || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                        ) : (
                          'FREE'
                        )}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between py-2">
                      <span className="fw-bold">Total:</span>
                      <span className="fw-bold text-primary">
                        ₱{Number(order.total_price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    {/* === BASIC INFO === */}
                    <div className="mt-3 text-muted small">
                      <p>
                        <FaClock className="me-2" />
                        Placed on: {new Date(order.created_at).toLocaleString()}
                      </p>
                      <p>
                        Payment: <strong>{(order.payment_method || 'cod').toUpperCase()}</strong>
                        {order.transaction_ref && (<span className="ms-2">Ref: {order.transaction_ref}</span>)}
                      </p>
                      <p>
                        <FaTruck className="me-2" />
                        Estimated Delivery:{" "}
                        {order.delivery_date ||
                          new Date(
                            new Date(order.created_at).getTime() +
                              14 * 24 * 60 * 60 * 1000
                          ).toLocaleDateString()}
                      </p>
                    </div>

                    {/* === ACCEPTANCE STATUS === */}
                    {order.acceptance_status && (
                      <div className="mt-3">
                        <h6 className="fw-bold">Order Acceptance Status</h6>
                        <div className={`alert ${order.acceptance_status === 'accepted' ? 'alert-success' : order.acceptance_status === 'rejected' ? 'alert-danger' : 'alert-info'}`}>
                          {order.acceptance_status === 'pending' && (
                            <>
                              <FaClock className="me-2" />
                              Your order is <strong>pending acceptance</strong> by our team. Production will start once accepted.
                            </>
                          )}
                          {order.acceptance_status === 'accepted' && (
                            <>
                              <FaCheckCircle className="me-2" />
                              Your order has been <strong>accepted</strong> and is now in production!
                            </>
                          )}
                          {order.acceptance_status === 'rejected' && (
                            <>
                              ❌ Your order has been <strong>rejected</strong>.
                              {order.rejection_reason && <div className="mt-2">Reason: {order.rejection_reason}</div>}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* === PRODUCTION TRACKING === */}
                    {/* Show current production stage for Table and Chair orders */}
                    {track && !track.error && order.acceptance_status === 'accepted' && track.trackings && (
                      <div className="mt-4">
                        <h6 className="fw-bold">Production Tracking</h6>

                        {/* Current Production Stage for each item */}
                        {track.trackings.filter(t => t.is_tracked_product).length > 0 && (
                          <div className="mt-3">
                            {track.trackings
                              .filter(t => t.is_tracked_product)
                              .map((item, idx) => {
                                const currentStage = item.current_stage || 'Pending';
                                const stageInfo = stageDetails[currentStage] || {
                                  description: 'Production in progress',
                                  estimatedDays: 1,
                                  icon: '🔧'
                                };

                                return (
                                  <div key={idx} className="card border-primary mb-3">
                                    <div className="card-header bg-primary text-white">
                                      <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                          <strong>{item.product_name}</strong>
                                        </div>
                                        <Badge bg={item.status === 'completed' ? 'success' : item.status === 'in_production' ? 'light' : 'secondary'}>
                                          {item.status === 'in_production' ? 'In Progress' : item.status}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="card-body">
                                      <div className="mb-3">
                                        <h5 className="text-primary mb-2">
                                          <span className="me-2" style={{ fontSize: '1.5rem' }}>{stageInfo.icon}</span>
                                          Current Stage: {currentStage}
                                        </h5>
                                        <p className="text-muted mb-2">
                                          {stageInfo.description}
                                        </p>
                                        <div className="d-flex align-items-center">
                                          <FaClock className="me-2 text-info" />
                                          <span className="fw-bold">
                                            Estimated Duration: {stageInfo.estimatedDays} {stageInfo.estimatedDays === 1 ? 'day' : 'days'}
                                          </span>
                                        </div>
                                      </div>
                                      
                                      {item.estimated_completion_date && (
                                        <div className="alert alert-info mb-0">
                                          <FaTruck className="me-2" />
                                          <strong>Estimated Completion:</strong> {new Date(item.estimated_completion_date).toLocaleDateString()}
                                        </div>
                                      )}

                                      {/* === PREVIOUS COMPLETED STAGES WITH DELAYS === */}
                                      {item.processes && item.processes.length > 0 && (
                                        <div className="mt-3">
                                          <h6 className="text-muted mb-2">
                                            <FaHammer className="me-2" />
                                            Previous Stages
                                          </h6>
                                          {item.processes
                                            .filter(p => p.status === 'completed')
                                            .map((process, pidx) => {
                                              const isDelayed = process.delay_reason && process.delay_reason.trim();
                                              return (
                                                <div key={pidx} className={`card mb-2 ${isDelayed ? 'border-warning' : 'border-success'}`}>
                                                  <div className="card-body p-2">
                                                    <div className="d-flex align-items-start">
                                                      <div className="me-2">
                                                        {isDelayed ? (
                                                          <span className="text-warning">⚠️</span>
                                                        ) : (
                                                          <FaCheckCircle className="text-success" />
                                                        )}
                                                      </div>
                                                      <div className="flex-grow-1">
                                                        <div className="d-flex justify-content-between align-items-start">
                                                          <strong className="small">{process.process_name}</strong>
                                                          {isDelayed && (
                                                            <Badge bg="danger">DELAYED</Badge>
                                                          )}
                                                        </div>
                                                        {process.completed_at && (
                                                          <div className="small text-muted">
                                                            Completed: {new Date(process.completed_at).toLocaleDateString()}
                                                          </div>
                                                        )}
                                                        {isDelayed && (
                                                          <div className="alert alert-warning p-2 mt-2 mb-0">
                                                            <div className="small">
                                                              <strong>Delay Reason:</strong> {process.delay_reason}
                                                            </div>
                                                            {process.completed_by_name && (
                                                              <div className="small text-muted">
                                                                Completed by: {process.completed_by_name}
                                                              </div>
                                                            )}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}

                        {/* Show message if no tracked products */}
                        {track.trackings.filter(t => t.is_tracked_product).length === 0 && (
                          <div className="alert alert-info">
                            <FaClock className="me-2" />
                            This order contains items that don't require detailed production tracking.
                          </div>
                        )}
                      </div>
                    )}

                    {track && track.error && (
                      <p className="text-danger small mt-2">{track.error}</p>
                    )}
                  </Card.Body>
                </div>
              </Collapse>
            </Card>
          );
        })
      ) : (
        <p className="text-center text-muted fw-bold">No orders found.</p>
      )}
    </div>
  );
};

const getStatusVariant = (status) => {
  switch (status.toLowerCase()) {
    case "pending":
      return "warning";
    case "processing":
      return "info";
    case "completed":
      return "success";
    case "canceled":
      return "danger";
    default:
      return "secondary";
  }
};

const renderStatusSteps = (status) => {
  const steps = ["Pending", "Processing", "Ready for Delivery", "Delivered"];
  const statusIndex = steps.findIndex(
    (s) => s.toLowerCase() === status.toLowerCase().replace('_', ' ')
  );

  // Use shorter labels on mobile
  const getStepLabel = (step) => {
    if (window.innerWidth <= 768) {
      return step === "Ready for Delivery" ? "Ready" : 
             step === "Delivered" ? "Delivered" : 
             step === "Processing" ? "Processing" : 
             step;
    }
    return step;
  };

  return (
    <div className="d-flex flex-wrap gap-2 align-items-center">
      {steps.map((step, idx) => (
        <div key={step} className="d-flex align-items-center flex-wrap">
          {idx < statusIndex ? (
            <FaCheckCircle className="text-success me-1" style={{ fontSize: '1rem' }} />
          ) : idx === statusIndex ? (
            <FaClock className="text-warning me-1" style={{ fontSize: '1rem' }} />
          ) : (
            <FaBox className="text-muted me-1" style={{ fontSize: '1rem' }} />
          )}
          <small
            className={`${idx <= statusIndex ? "fw-bold text-dark" : "text-muted"} text-nowrap`}
            style={{ fontSize: '0.75rem' }}
          >
            {getStepLabel(step)}
          </small>
        </div>
      ))}
    </div>
  );
};

export default OrderTable;

