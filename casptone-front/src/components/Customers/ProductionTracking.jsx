import React, { useState, useEffect } from "react";
import axios from "axios";
import AppLayout from "../Header";
import { FaCheckCircle, FaClock, FaHammer, FaTools, FaPaintBrush, FaBox, FaTruck, FaSpinner, FaCalendarAlt, FaExclamationTriangle, FaTimes } from "react-icons/fa";
import { toast } from "sonner";

const ProductionTracking = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log('🚀 ProductionTracking component mounted');
  console.warn('⚠️ CUSTOMER VIEW - This should appear in console!');

  useEffect(() => {
    console.log('🔄 useEffect triggered - fetching orders');
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("User not authenticated.");

      console.log('🔍 Fetching customer orders...');
      const response = await axios.get(`http://localhost:8000/api/my-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('📦 Orders received:', response.data.length, 'orders');

      // Fetch tracking for each order
      const ordersWithTracking = await Promise.all(
        response.data.map(async (order) => {
          try {
            console.log(`🔍 Fetching tracking for order #${order.id}...`);
            const trackingResponse = await axios.get(`http://localhost:8000/api/orders/${order.id}/tracking`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            console.log(`✅ Tracking for order ${order.id}:`, trackingResponse.data);
            
            // Log processes data specifically
            if (trackingResponse.data.trackings) {
              trackingResponse.data.trackings.forEach(tracking => {
                if (tracking.processes) {
                  console.log(`Processes for ${tracking.product_name}:`, tracking.processes);
                  tracking.processes.forEach(process => {
                    if (process.delay_reason) {
                      console.log(`⚠️ DELAYED PROCESS FOUND:`, {
                        name: process.process_name,
                        reason: process.delay_reason,
                        completed_by: process.completed_by_name
                      });
                    }
                  });
                }
              });
            }
            
            return { ...order, tracking: trackingResponse.data };
          } catch (err) {
            console.error(`Failed to fetch tracking for order ${order.id}:`, err.response?.data || err.message);
            return { ...order, tracking: { error: "Failed to fetch tracking", details: err.response?.data?.message || err.message } };
          }
        })
      );

      console.log('💾 Setting orders state with:', ordersWithTracking.length, 'orders');
      setOrders(ordersWithTracking);
      
      // Log each order's tracking details and status
      ordersWithTracking.forEach(order => {
        console.log(`📋 Order #${order.id} details:`, {
          status: order.status,
          receipt_confirmed: order.receipt_confirmed,
          has_tracking: !!order.tracking,
          has_trackings_array: !!order.tracking?.trackings,
          trackings_count: order.tracking?.trackings?.length || 0,
          trackings: order.tracking?.trackings
        });
      });
    } catch (err) {
      console.error('❌ Error fetching orders:', err);
      setError("Failed to load orders. Please try again.");
    } finally {
      setLoading(false);
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

      const response = await axios.patch(`http://localhost:8000/api/orders/${orderId}/cancel`, {}, {
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
        return <FaCheckCircle className="text-primary" />;
      case 'Ready for Delivery':
        return <FaTruck className="text-success" />;
      default:
        return <FaClock className="text-muted" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'pending':
        return 'secondary';
      case 'awaiting_acceptance':
        return 'warning';
      case 'rejected':
        return 'danger';
      default:
        return 'light';
    }
  };

  const getOrderStatus = (order) => {
    // Check acceptance status first
    if (order.tracking?.acceptance_status === 'pending') {
      return {
        status: 'awaiting_acceptance',
        progress: 0,
        message: 'Awaiting admin acceptance'
      };
    }

    if (order.tracking?.acceptance_status === 'rejected') {
      return {
        status: 'rejected',
        progress: 0,
        message: 'Order rejected'
      };
    }

    if (!order.tracking || !order.tracking.overall) {
      return {
        status: order.status,
        progress: order.status === 'completed' ? 100 : 0,
        message: order.status === 'completed' ? 'Order completed' : 'Order processing'
      };
    }

    const overall = order.tracking.overall;
    if (overall.progress_pct === 100) {
      return { status: 'completed', progress: 100, message: 'Ready for delivery!' };
    } else if (overall.progress_pct > 0) {
      return { status: 'in_progress', progress: overall.progress_pct, message: 'In production' };
    } else {
      return { status: 'pending', progress: 0, message: 'Production pending' };
    }
  };

  const getCurrentStageInfo = (tracking) => {
    if (!tracking || !tracking.trackings || tracking.trackings.length === 0) {
      return { stage: 'Order Received', status: 'pending', progress: 0 };
    }

    const firstTracking = tracking.trackings[0];
    return {
      stage: firstTracking.current_stage,
      status: firstTracking.status,
      progress: firstTracking.progress_percentage
    };
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mt-5">
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading your orders...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mt-5">
          <div className="alert alert-danger text-center">
            <h4>Oops! Something went wrong</h4>
            <p>{error}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mt-4">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center py-4">
                <h1 className="display-6 text-primary mb-3">
                  <FaTruck className="me-3" />
                  Production Tracking
                </h1>
                <p className="lead text-muted mb-0">
                  Track your furniture production progress in real-time
                </p>
              </div>
            </div>
          </div>
        </div>

        {orders.length > 0 ? (
          orders.map((order) => {
            const orderStatus = getOrderStatus(order);
            const currentStage = getCurrentStageInfo(order.tracking);

            return (
              <div key={order.id} className="row mb-4">
                <div className="col-12">
                  <div className="card border-0 shadow-sm production-card">
                    <div className="card-body">
                  {/* Order Header */}
                  <div className="row align-items-center mb-4">
                    <div className="col-md-6">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <h4 className="text-primary mb-0">Order #{order.id}</h4>
                        {order.tracking_number && (
                          <span className="badge bg-info" style={{ fontSize: '0.9rem' }}>
                            📦 {order.tracking_number}
                          </span>
                        )}
                      </div>
                      <p className="text-muted mb-0">
                        Placed on {new Date(order.checkout_date).toLocaleDateString()}
                      </p>
                    </div>
                        <div className="col-md-6 text-end">
                          <div className="d-flex flex-column align-items-end gap-2">
                          <span className={`badge bg-${getStatusColor(orderStatus.status)} fs-6 px-3 py-2`}>
                            {orderStatus.message}
                          </span>
                            <div className="text-end text-muted small">
                              <p className="mb-1">
                                <strong>Shipping Fee:</strong>{" "}
                                <span className={order.shipping_fee > 0 ? '' : 'text-success'}>
                                  {order.shipping_fee > 0 ? (
                                    `₱${Number(order.shipping_fee || 0).toLocaleString()}`
                                  ) : (
                                    'FREE'
                                  )}
                                </span>
                              </p>
                              <p className="mb-0">
                                <strong>Total:</strong>{" "}
                                <span className="text-primary">
                                  ₱{Number(order.total_price).toLocaleString()}
                                </span>
                              </p>
                            </div>
                            {canCancelOrder(order) && (
                              <span
                                className="badge bg-danger"
                                onClick={() => cancelOrder(order.id)}
                                title="Cancel this order"
                                style={{
                                  cursor: 'pointer',
                                  padding: '0.35em 0.65em',
                                  fontSize: '0.875rem'
                                }}
                              >
                                <FaTimes className="me-1" />
                                Cancel Order
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tracking Error Alert */}
                      {order.tracking?.error && (
                        <div className="alert alert-danger mb-4">
                          <div className="d-flex align-items-center">
                            <FaExclamationTriangle className="me-3" style={{ fontSize: '2rem' }} />
                            <div>
                              <h5 className="alert-heading mb-1">Tracking Error</h5>
                              <p className="mb-0">{order.tracking.error}</p>
                              {order.tracking.details && (
                                <small className="text-muted d-block mt-1">Details: {order.tracking.details}</small>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Acceptance Status Alert */}
                      {orderStatus.status === 'awaiting_acceptance' && (
                        <div className="alert alert-warning mb-4">
                          <div className="d-flex align-items-center">
                            <FaClock className="me-3" style={{ fontSize: '2rem' }} />
                            <div>
                              <h5 className="alert-heading mb-1">Order Awaiting Acceptance</h5>
                              <p className="mb-0">
                                Your order has been received and is awaiting admin review. 
                                Production will begin once the order is accepted.
                              </p>
                              {order.tracking?.accepted_at && (
                                <small className="text-muted">
                                  Submitted: {new Date(order.checkout_date).toLocaleString()}
                                </small>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {orderStatus.status === 'rejected' && (
                        <div className="alert alert-danger mb-4">
                          <div className="d-flex align-items-center">
                            <FaExclamationTriangle className="me-3" style={{ fontSize: '2rem' }} />
                            <div>
                              <h5 className="alert-heading mb-1">Order Rejected</h5>
                              <p className="mb-0">
                                {order.tracking?.rejection_reason || 'Unfortunately, we cannot process this order at this time.'}
                              </p>
                              {order.tracking?.accepted_at && (
                                <small className="text-muted">
                                  Reviewed: {new Date(order.tracking.accepted_at).toLocaleString()}
                                </small>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {orderStatus.status === 'pending' && order.tracking?.acceptance_status === 'accepted' && (
                        <div className="alert alert-info mb-4">
                          <div className="d-flex align-items-center">
                            <FaCheckCircle className="me-3" style={{ fontSize: '2rem' }} />
                            <div>
                              <h5 className="alert-heading mb-1">Order Accepted!</h5>
                              <p className="mb-0">
                                Your order has been accepted and production will begin shortly.
                              </p>
                              {order.tracking?.accepted_at && (
                                <small className="text-muted">
                                  Accepted: {new Date(order.tracking.accepted_at).toLocaleString()}
                                  {order.tracking?.accepted_by && ` by ${order.tracking.accepted_by}`}
                                </small>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Progress Section */}
                      {orderStatus.status !== 'awaiting_acceptance' && orderStatus.status !== 'rejected' && (
                        <div className="mb-4">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <h5 className="text-primary mb-0">Overall Progress</h5>
                            <div className="text-end">
                              <div className="h3 text-primary mb-0">{orderStatus.progress}%</div>
                              {order.tracking?.overall?.eta && (
                                <small className="text-muted">
                                  <FaCalendarAlt className="me-1" />
                                  ETA: {order.tracking.overall.eta}
                                </small>
                              )}
                            </div>
                          </div>
                          <div className="progress mb-3" style={{ height: '25px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              role="progressbar" 
                              style={{ width: `${orderStatus.progress}%` }}
                              aria-valuenow={orderStatus.progress}
                              aria-valuemin="0" 
                              aria-valuemax="100"
                            >
                              {orderStatus.progress}%
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Current Stage */}
                      {orderStatus.status !== 'completed' && (
                        <div className="row align-items-center mb-4">
                          <div className="col-md-8">
                            <div className="d-flex align-items-center p-3 bg-light rounded">
                              <div className="me-3">
                                {orderStatus.status === 'in_progress' ? (
                                  <FaSpinner className="text-primary fa-spin" style={{ fontSize: '2rem' }} />
                                ) : (
                                  <div style={{ fontSize: '2rem' }}>
                                    {getStageIcon(currentStage.stage)}
                                  </div>
                                )}
                              </div>
                              <div>
                                <h5 className="mb-1 text-dark">Currently: {currentStage.stage}</h5>
                                <p className="text-muted mb-0">
                                  {order.tracking?.overall?.eta && (
                                    <>Estimated completion: {order.tracking.overall.eta}</>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="p-3 bg-primary text-white rounded text-center">
                              <div className="h5 mb-1">Items Status</div>
                              <div className="row text-center">
                                {order.tracking?.overall ? (
                                  <>
                                    <div className="col-4">
                                      <div className="h4 text-white mb-0">{order.tracking.overall.completed}</div>
                                      <small>Done</small>
                                    </div>
                                    <div className="col-4">
                                      <div className="h4 text-white mb-0">{order.tracking.overall.in_progress}</div>
                                      <small>Active</small>
                                    </div>
                                    <div className="col-4">
                                      <div className="h4 text-white mb-0">{order.tracking.overall.pending}</div>
                                      <small>Pending</small>
                                    </div>
                                  </>
                                ) : (
                                  <div className="col-12">
                                    <div className="h4 text-white mb-0">{order.items?.length || 0}</div>
                                    <small>Total Items</small>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Ready for Delivery - Receipt Confirmation */}
                      {(() => {
                        const isReadyForDelivery = order.status === 'ready_for_delivery';
                        const isNotConfirmed = order.receipt_confirmed === null || order.receipt_confirmed === undefined;
                        const shouldShow = isReadyForDelivery && isNotConfirmed;
                        
                        // Debug logging
                        if (isReadyForDelivery) {
                          console.log('Order ready for delivery:', {
                            orderId: order.id,
                            status: order.status,
                            receipt_confirmed: order.receipt_confirmed,
                            shouldShow: shouldShow
                          });
                        }
                        
                        return shouldShow;
                      })() && (
                        <div className="alert alert-info mb-4">
                          <div className="text-center">
                            <FaTruck className="text-info mb-3" style={{ fontSize: '3rem' }} />
                            <h4 className="text-info mb-3">Your order is ready for delivery!</h4>
                            <p className="mb-4">Have you received your order?</p>
                            <div className="d-flex justify-content-center gap-3">
                              <button
                                className="btn btn-success btn-lg px-5"
                                onClick={async () => {
                                  try {
                                    const token = localStorage.getItem("token");
                                    const response = await axios.post(
                                      `http://localhost:8000/api/orders/${order.id}/confirm-receipt`,
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
                              </button>
                              <button
                                className="btn btn-warning btn-lg px-5"
                                onClick={async () => {
                                  try {
                                    const token = localStorage.getItem("token");
                                    const response = await axios.post(
                                      `http://localhost:8000/api/orders/${order.id}/confirm-receipt`,
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
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Not Received - Show Reason if Available */}
                      {order.status === 'ready_for_delivery' && order.receipt_confirmed === false && order.not_received_reason && (
                        <div className="alert alert-warning mb-4">
                          <div className="d-flex align-items-start">
                            <FaExclamationTriangle className="me-3 mt-1" style={{ fontSize: '2rem' }} />
                            <div className="flex-grow-1">
                              <h5 className="alert-heading mb-2">Order Not Delivered</h5>
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

                      {/* Completed Status */}
                      {orderStatus.status === 'completed' && (
                        <div className="text-center py-4 mb-4">
                          <FaCheckCircle className="text-success mb-3" style={{ fontSize: '4rem' }} />
                          <h4 className="text-success">Your order is ready!</h4>
                          <p className="text-muted">All items have been completed and are ready for delivery.</p>
                        </div>
                      )}

                      {/* Debug: Check why process timeline might not show */}
                      {console.log('=== ORDER TRACKING DEBUG ===')}
                      {console.log('Order ID:', order.id)}
                      {console.log('Has tracking:', !!order.tracking)}
                      {console.log('Has trackings array:', !!order.tracking?.trackings)}
                      {console.log('Trackings count:', order.tracking?.trackings?.length || 0)}
                      {order.tracking?.trackings && order.tracking.trackings.forEach((t, i) => {
                        console.log(`Tracking ${i}:`, {
                          product: t.product_name,
                          is_tracked: t.is_tracked_product,
                          has_processes: !!t.processes,
                          process_count: t.processes?.length || 0
                        });
                      })}
                      {console.log('================================')}

                      {/* Production Process Tracking - Only for Table and Chair */}
                      {order.tracking?.trackings && order.tracking.trackings.some(t => t.is_tracked_product && t.processes && t.processes.length > 0) ? (
                        <div className="mb-4">
                          <h6 className="text-primary mb-3">
                            <FaHammer className="me-2" />
                            Production Stages
                          </h6>
                          {order.tracking.trackings
                            .filter(t => t.is_tracked_product && t.processes && t.processes.length > 0)
                            .map((tracking, idx) => {
                              // Check if there are any delayed processes
                              const delayedProcesses = (tracking.processes || []).filter(p => 
                                p.delay_reason && p.delay_reason.trim() !== '' && p.status === 'completed'
                              );
                              
                              return (
                                <div key={idx} className="card border-0 bg-light mb-3">
                                  <div className="card-body">
                                    <h6 className="text-dark mb-3">
                                      {tracking.product_name} - Production Timeline
                                    </h6>
                                    
                                    {/* Debug Info - Shows in browser console */}
                                    {console.log('=== PRODUCTION TRACKING DEBUG ===')}
                                    {console.log('Product:', tracking.product_name)}
                                    {console.log('Total processes:', tracking.processes?.length || 0)}
                                    {console.log('All processes:', tracking.processes)}
                                    {console.log('Delayed processes found:', delayedProcesses.length)}
                                    {delayedProcesses.length > 0 && console.log('Delay details:', delayedProcesses.map(p => ({
                                      name: p.process_name,
                                      reason: p.delay_reason,
                                      status: p.status,
                                      completed_by: p.completed_by_name
                                    })))}
                                    {console.log('================================')}
                                    
                                    {/* Delay Summary Alert - Show if any processes were delayed */}
                                    {delayedProcesses.length > 0 ? (
                                      <div className="alert alert-warning mb-3">
                                        <div className="d-flex align-items-start">
                                          <FaExclamationTriangle className="text-danger me-2" style={{ fontSize: '1.5rem' }} />
                                          <div className="flex-grow-1">
                                            <h6 className="alert-heading text-danger mb-2">
                                              Production Delays Occurred
                                            </h6>
                                            <p className="mb-2 small">
                                              {delayedProcesses.length} process{delayedProcesses.length > 1 ? 'es were' : ' was'} completed late. 
                                              See details below for each delayed stage.
                                            </p>
                                            <div className="small">
                                              <strong>Delayed Stages:</strong>
                                              <ul className="mb-0 mt-1">
                                                {delayedProcesses.map(p => (
                                                  <li key={p.id}>{p.process_name} - {p.delay_reason}</li>
                                                ))}
                                              </ul>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="alert alert-info mb-3">
                                        <small>
                                          <FaCheckCircle className="me-2" />
                                          All processes completed on time so far!
                                        </small>
                                      </div>
                                    )}
                                    
                                    <div className="d-flex flex-column gap-2">
                                    {tracking.processes.map((process) => {
                                      // Check if process is delayed
                                      const expectedDate = process.started_at ? 
                                        new Date(new Date(process.started_at).getTime() + (process.estimated_duration_minutes || 0) * 60000) : null;
                                      const actualDate = process.completed_at ? new Date(process.completed_at) : new Date();
                                      const isDelayed = (process.delay_reason && process.delay_reason.trim()) || 
                                                       (expectedDate && actualDate > expectedDate && process.status !== 'pending');
                                      
                                      return (
                                        <div key={process.id} className={`d-flex align-items-start gap-3 p-3 rounded ${isDelayed ? 'bg-warning bg-opacity-10 border border-warning' : 'bg-white'}`}>
                                          <div className="mt-1">
                                            {process.status === 'completed' ? (
                                              <FaCheckCircle className={isDelayed ? 'text-warning' : 'text-success'} style={{ fontSize: '1.5rem' }} />
                                            ) : process.status === 'in_progress' ? (
                                              <FaSpinner className="text-primary fa-spin" style={{ fontSize: '1.5rem' }} />
                                            ) : (
                                              <FaClock className="text-muted" style={{ fontSize: '1.5rem' }} />
                                            )}
                                          </div>
                                          <div className="flex-grow-1">
                                            <div className="d-flex justify-content-between align-items-start">
                                              <div className="flex-grow-1">
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                  <span className={`fw-bold ${process.status === 'completed' && !isDelayed ? 'text-decoration-line-through text-muted' : 'text-dark'}`}>
                                                    {process.process_name}
                                                  </span>
                                                  {isDelayed && process.status !== 'pending' && (
                                                    <span className="badge bg-danger">
                                                      <FaExclamationTriangle className="me-1" />
                                                      DELAYED
                                                    </span>
                                                  )}
                                                </div>
                                                {process.estimated_duration_minutes && (
                                                  <div className="text-muted small">
                                                    Duration: {Math.floor(process.estimated_duration_minutes / 60)}h {process.estimated_duration_minutes % 60}m
                                                  </div>
                                                )}
                                              </div>
                                              <span className={`badge ${
                                                process.status === 'completed' ? (isDelayed ? 'bg-warning' : 'bg-success') : 
                                                process.status === 'in_progress' ? 'bg-info' : 
                                                'bg-secondary'
                                              } text-capitalize`}>
                                                {process.status === 'in_progress' ? 'In Progress' : process.status}
                                              </span>
                                            </div>
                                            
                                            {/* Date Information */}
                                            {process.started_at && (
                                              <div className="small text-muted mt-2">
                                                <div>
                                                  <strong>Started:</strong> {new Date(process.started_at).toLocaleDateString()}
                                                </div>
                                                {expectedDate && (
                                                  <div>
                                                    <strong>Expected Completion:</strong> {expectedDate.toLocaleDateString()}
                                                  </div>
                                                )}
                                                {process.completed_at && (
                                                  <div className={isDelayed ? 'text-danger fw-bold' : 'text-success'}>
                                                    <strong>Actual Completion:</strong> {new Date(process.completed_at).toLocaleDateString()}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                            
                                            {/* Delay Reason */}
                                            {process.delay_reason && process.delay_reason.trim() && (
                                              <div className="alert alert-warning mt-2 mb-0 py-2">
                                                <div className="d-flex align-items-start">
                                                  <FaExclamationTriangle className="text-danger me-2 mt-1" />
                                                  <div className="flex-grow-1">
                                                    <strong className="text-danger">Delay Reason:</strong>
                                                    <div className="small">{process.delay_reason}</div>
                                                    {process.completed_by_name && (
                                                      <div className="small text-muted mt-1">
                                                        <strong>Completed by:</strong> {process.completed_by_name}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* Completed By (for on-time completions) */}
                                            {process.completed_by_name && !process.delay_reason && process.status === 'completed' && (
                                              <div className="small text-success mt-2">
                                                <FaCheckCircle className="me-1" />
                                                <strong>Completed by:</strong> {process.completed_by_name}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="mt-3 p-2 bg-info bg-opacity-10 rounded">
                                    <small className="text-muted">
                                      <FaCalendarAlt className="me-2" />
                                      <strong>Estimated Delivery:</strong> 2 weeks from production start
                                    </small>
                                  </div>
                                </div>
                              </div>
                              );
                            })}
                        </div>
                      ) : order.tracking?.trackings && order.tracking.trackings.length > 0 && (
                        <div className="mb-4">
                          <div className="alert alert-info">
                            <h6 className="mb-2">
                              <FaHammer className="me-2" />
                              Production Information
                            </h6>
                            <p className="mb-2 small">
                              Detailed process tracking is available for Tables and Chairs. 
                              {order.tracking.trackings.map((t, i) => (
                                <div key={i} className="mt-2">
                                  <strong>{t.product_name}:</strong>
                                  {t.is_tracked_product ? (
                                    t.processes && t.processes.length > 0 ? (
                                      <span className="text-success ms-2">✓ Process tracking active</span>
                                    ) : (
                                      <span className="text-warning ms-2">⚠ Processes not yet created</span>
                                    )
                                  ) : (
                                    <span className="text-muted ms-2">Standard tracking (not Table/Chair)</span>
                                  )}
                                </div>
                              ))}
                            </p>
                            <small className="text-muted">
                              Current stage: {order.tracking.trackings[0]?.current_stage || 'Processing'}
                            </small>
                          </div>
                        </div>
                      )}

                      {/* Order Items Summary */}
                      <div className="pt-3 border-top">
                        <h6 className="text-muted mb-3">Order Items:</h6>
                        <div>
                          {order.items?.map((item) => (
                            <div key={item.id} className="d-flex justify-content-between border-bottom py-2">
                              <span>
                                {item.product?.name} × {item.quantity}
                              </span>
                              <span className="fw-bold text-success">
                                ₱{((item.price || item.product?.price || 0) * item.quantity).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* Shipping Fee and Total - Right Aligned */}
                        {(() => {
                          // Check if order has any made-to-order items
                          const hasMadeToOrder = order.items?.some(item => 
                            item.product?.category_name === 'Made to Order' || 
                            item.product?.category_name === 'made_to_order'
                          );
                          
                          return (
                            <>
                              <div className="d-flex justify-content-between border-bottom py-2">
                                <span>Shipping Fee:</span>
                                <span className={hasMadeToOrder ? 'fw-bold text-info' : (order.shipping_fee > 0 ? 'fw-bold text-success' : 'fw-bold text-success')}>
                                  {hasMadeToOrder ? (
                                    <span style={{ fontSize: '0.9rem', fontStyle: 'italic', color: '#0066cc' }}>
                                      To be finalized
                                    </span>
                                  ) : order.shipping_fee > 0 ? (
                                    `₱${Number(order.shipping_fee || 0).toLocaleString()}`
                                  ) : (
                                    'FREE'
                                  )}
                                </span>
                              </div>
                              {hasMadeToOrder && (
                                <div className="d-flex justify-content-end py-1" style={{ fontSize: '0.85rem', color: '#0066cc', fontStyle: 'italic' }}>
                                  <span>
                                    ℹ️ The shipping fee will be finalized according to our mutual agreement at the time of delivery by our staff
                                  </span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                        <div className="d-flex justify-content-between py-2">
                          <span className="fw-bold">Total:</span>
                          <span className="fw-bold text-primary">
                            ₱{Number(order.total_price || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="row">
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-body text-center py-5">
                  <FaBox className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                  <h5 className="text-muted">No orders found</h5>
                  <p className="text-muted">You haven't placed any orders yet.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .production-card {
          transition: all 0.3s ease;
          border-left: 4px solid #007bff;
        }
        
        .production-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15) !important;
        }
        
        .progress-bar {
          transition: width 0.6s ease;
          font-weight: bold;
        }
        
        .badge {
          border-radius: 20px;
        }
        
        .card {
          border-radius: 15px;
        }
      `}</style>
    </AppLayout>
  );
};

export default ProductionTracking;
