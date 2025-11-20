import React, { useState, useEffect } from "react";
import axios from "axios";
import AppLayout from "../Header";
import { FaCheckCircle, FaClock, FaHammer, FaTools, FaPaintBrush, FaBox, FaTruck, FaPlay, FaSpinner } from "react-icons/fa";

const SimpleOrderProgress = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("User not authenticated.");

      const response = await axios.get(`http://localhost:8000/api/my-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Fetch tracking for each order
      const ordersWithTracking = await Promise.all(
        response.data.map(async (order) => {
          try {
            const trackingResponse = await axios.get(`http://localhost:8000/api/orders/${order.id}/tracking`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            return { ...order, tracking: trackingResponse.data };
          } catch (err) {
            return { ...order, tracking: null };
          }
        })
      );

      setOrders(ordersWithTracking);
    } catch (err) {
      setError("Failed to load orders. Please try again.");
    } finally {
      setLoading(false);
    }
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
      default:
        return 'light';
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

  const getOrderStatus = (order) => {
    if (!order.tracking || !order.tracking.overall) {
      return {
        status: order.status,
        progress: order.status === 'completed' ? 100 : 0,
        message: order.status === 'completed' ? 'Order completed' : 
                 order.status === 'pending' ? 'Awaiting acceptance - Production tracking will be available once your order is accepted' :
                 'Order processing - Production tracking will be available soon'
      };
    }

    const overall = order.tracking.overall;
    if (overall.progress_pct === 100) {
      return { status: 'completed', progress: 100, message: 'Ready for delivery!' };
    } else if (overall.progress_pct > 0) {
      return { status: 'in_progress', progress: overall.progress_pct, message: 'In production' };
    } else {
      return { status: 'pending', progress: 0, message: 'Preparing to start' };
    }
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
                  My Orders
                </h1>
                <p className="lead text-muted mb-0">
                  Track your furniture orders at a glance
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
                  <div className="card border-0 shadow-sm">
                    <div className="card-body">
                      {/* Order Header */}
                      <div className="row align-items-center mb-3">
                        <div className="col-md-6">
                          <h4 className="text-primary mb-1">Order #{order.id}</h4>
                          <p className="text-muted mb-0">
                            Placed on {new Date(order.checkout_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="col-md-6 text-end">
                          <span className={`badge bg-${getStatusColor(orderStatus.status)} fs-6 px-3 py-2`}>
                            {orderStatus.message}
                          </span>
                          <div className="mt-2">
                            <strong>Total: ₱{Number(order.total_price).toLocaleString()}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="fw-bold">Overall Progress</span>
                          <span className="text-primary fw-bold">{orderStatus.progress}%</span>
                        </div>
                        <div className="progress" style={{ height: '20px' }}>
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

                      {/* Current Stage */}
                      {orderStatus.status !== 'completed' && (
                        <div className="row align-items-center">
                          <div className="col-md-8">
                            <div className="d-flex align-items-center">
                              <div className="me-3">
                                {orderStatus.status === 'in_progress' ? (
                                  <FaSpinner className="text-primary fa-spin" style={{ fontSize: '1.5rem' }} />
                                ) : !order.tracking || !order.tracking.overall ? (
                                  <FaClock className="text-warning" style={{ fontSize: '1.5rem' }} />
                                ) : (
                                  getStageIcon(currentStage.stage)
                                )}
                              </div>
                              <div>
                                <h5 className="mb-1">
                                  {!order.tracking || !order.tracking.overall ? 
                                    'Awaiting Production Start' : 
                                    `Currently: ${currentStage.stage}`
                                  }
                                </h5>
                                <p className="text-muted mb-0">
                                  {order.tracking?.overall?.eta ? (
                                    <>Estimated completion: {order.tracking.overall.eta}</>
                                  ) : (
                                    <>Production tracking will be available once your order is accepted by our team</>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-4 text-end">
                            <div className="p-3 bg-light rounded">
                              <div className="h6 text-primary mb-1">Items</div>
                              <div className="row text-center">
                                {order.tracking?.overall ? (
                                  <>
                                    <div className="col-4">
                                      <div className="h5 text-success mb-0">{order.tracking.overall.completed}</div>
                                      <small className="text-muted">Done</small>
                                    </div>
                                    <div className="col-4">
                                      <div className="h5 text-info mb-0">{order.tracking.overall.in_progress}</div>
                                      <small className="text-muted">Active</small>
                                    </div>
                                    <div className="col-4">
                                      <div className="h5 text-warning mb-0">{order.tracking.overall.pending}</div>
                                      <small className="text-muted">Pending</small>
                                    </div>
                                  </>
                                ) : (
                                  <div className="col-12">
                                    <div className="h5 text-primary mb-0">{order.items?.length || 0}</div>
                                    <small className="text-muted">Total Items</small>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Completed Status */}
                      {orderStatus.status === 'completed' && (
                        <div className="text-center py-3">
                          <FaCheckCircle className="text-success mb-3" style={{ fontSize: '3rem' }} />
                          <h5 className="text-success">Your order is ready!</h5>
                          <p className="text-muted">All items have been completed and are ready for delivery.</p>
                        </div>
                      )}

                      {/* Order Items Summary */}
                      <div className="mt-3 pt-3 border-top">
                        <h6 className="text-muted mb-2">Order Items:</h6>
                        <div className="row">
                          {order.items?.map((item) => (
                            <div key={item.id} className="col-md-6">
                              <div className="d-flex justify-content-between">
                                <span>{item.product?.name} × {item.quantity}</span>
                                <span className="text-primary">₱{(item.product?.price * item.quantity).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
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

      <style jsx>{`
        .progress-bar {
          transition: width 0.6s ease;
        }
        
        .card {
          transition: all 0.3s ease;
        }
        
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15) !important;
        }
        
        .badge {
          border-radius: 20px;
        }
      `}</style>
    </AppLayout>
  );
};

export default SimpleOrderProgress;
