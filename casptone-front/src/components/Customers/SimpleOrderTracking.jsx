import React, { useState, useEffect } from "react";
import axios from "axios";
import AppLayout from "../Header";
import { useParams } from "react-router-dom";
import { FaCheckCircle, FaClock, FaHammer, FaTools, FaPaintBrush, FaBox, FaTruck, FaTimes } from "react-icons/fa";
import { toast } from "sonner";

const SimpleOrderTracking = ({ orderId: propOrderId }) => {
  const { orderId: paramOrderId } = useParams();
  const orderId = propOrderId || paramOrderId;
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (orderId) {
      fetchTrackingData();
    }
  }, [orderId]);

  const fetchTrackingData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`http://localhost:8000/api/orders/${orderId}/tracking`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('=== TRACKING DATA RECEIVED ===');
      console.log('Full response:', response.data);
      console.log('Trackings array:', response.data.trackings);
      
      // Check each tracking for processes
      if (response.data.trackings) {
        response.data.trackings.forEach((tracking, idx) => {
          console.log(`Tracking ${idx} - ${tracking.product_name}:`, {
            has_processes: !!tracking.processes,
            processes_count: tracking.processes?.length || 0,
            processes: tracking.processes
          });
          
          // Check for delayed processes
          if (tracking.processes) {
            const delayed = tracking.processes.filter(p => p.delay_reason);
            console.log(`Delayed processes in ${tracking.product_name}:`, delayed);
          }
        });
      }
      
      setTrackingData(response.data);
    } catch (err) {
      console.error('Error fetching tracking:', err);
      setError("Failed to load tracking information");
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("User not authenticated.");

      const confirmed = window.confirm(
        "Are you sure you want to cancel this order?\n\n" +
        ""
      );

      if (!confirmed) return;

      const response = await axios.patch(`http://localhost:8000/api/orders/${orderId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Order cancelled successfully!", {
        description: "Your order has been cancelled and materials have been restored.",
        duration: 4000,
      });

      // Refresh tracking data to show updated status
      await fetchTrackingData();
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to cancel order. Please try again.";
      toast.error("Cancellation failed", {
        description: errorMessage,
        duration: 4000,
      });
    }
  };

  const canCancelOrder = (order) => {
    if (!order) return false;
    
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

  const getProductionProcesses = (trackingType) => {
    if (trackingType === 'alkansya') {
      return [
        {
          stage: 'Design',
          description: 'Creating detailed design specifications and measurements',
          duration: '30 minutes'
        },
        {
          stage: 'Preparation',
          description: 'Preparing materials and setting up tools',
          duration: '45 minutes'
        },
        {
          stage: 'Cutting',
          description: 'Precise cutting of wood to specifications',
          duration: '60 minutes'
        },
        {
          stage: 'Assembly',
          description: 'Careful assembly of components',
          duration: '90 minutes'
        },
        {
          stage: 'Finishing',
          description: 'Applying finish, polish, and final touches',
          duration: '45 minutes'
        },
        {
          stage: 'Quality Control',
          description: 'Final inspection and quality assurance',
          duration: '30 minutes'
        }
      ];
    } else {
      // Tables and Chairs
      return [
        {
          stage: 'Planning',
          description: 'Detailed planning and design development',
          duration: '2-3 days'
        },
        {
          stage: 'Material Selection',
          description: 'Selecting high-quality wood and materials',
          duration: '1 day'
        },
        {
          stage: 'Cutting and Shaping',
          description: 'Precise cutting and shaping of components',
          duration: '3-4 days'
        },
        {
          stage: 'Assembly',
          description: 'Careful assembly and joinery work',
          duration: '4-5 days'
        },
        {
          stage: 'Finishing',
          description: 'Professional finishing and treatment',
          duration: '2-3 days'
        },
        {
          stage: 'Quality Assurance',
          description: 'Comprehensive quality check and testing',
          duration: '1 day'
        }
      ];
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
            <p className="mt-3">Loading your order tracking...</p>
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

  if (!trackingData) {
    return (
      <AppLayout>
        <div className="container mt-5">
          <div className="alert alert-info text-center">
            <h4>No tracking information available</h4>
            <p>Your order tracking will appear here once production begins.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const { order, overall, trackings, stage_summary } = trackingData;

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
                  Order #{order.id} Tracking
                </h1>
                <p className="lead text-muted mb-0">
                  Track your furniture production in real-time
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        {overall && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="row align-items-center">
                    <div className="col-md-8">
                      <h3 className="text-primary mb-2">Overall Progress</h3>
                      <div className="progress mb-3" style={{ height: '20px' }}>
                        <div 
                          className="progress-bar bg-primary" 
                          role="progressbar" 
                          style={{ width: `${overall.progress_pct}%` }}
                          aria-valuenow={overall.progress_pct}
                          aria-valuemin="0" 
                          aria-valuemax="100"
                        >
                          {overall.progress_pct}%
                        </div>
                      </div>
                      <div className="row text-center">
                        <div className="col-3">
                          <div className="h4 text-primary mb-0">{overall.total}</div>
                          <small className="text-muted">Total Items</small>
                        </div>
                        <div className="col-3">
                          <div className="h4 text-success mb-0">{overall.completed}</div>
                          <small className="text-muted">Completed</small>
                        </div>
                        <div className="col-3">
                          <div className="h4 text-info mb-0">{overall.in_progress}</div>
                          <small className="text-muted">In Progress</small>
                        </div>
                        <div className="col-3">
                          <div className="h4 text-warning mb-0">{overall.pending}</div>
                          <small className="text-muted">Pending</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4 text-center">
                      <div className="p-3 bg-light rounded">
                        <FaClock className="text-primary mb-2" style={{ fontSize: '2rem' }} />
                        <div className="h5 text-primary mb-0">Estimated Delivery</div>
                        <div className="h4 text-primary">{overall.eta}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Production Stages */}
        {trackings && trackings.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-info text-white">
                  <h4 className="mb-0">
                    <FaTools className="me-2" />
                    Current Production Status
                  </h4>
                </div>
                <div className="card-body">
                  <div className="row">
                    {trackings.map((tracking, index) => {
                      return (
                        <div key={index} className="col-md-6 col-lg-4 mb-3">
                          <div className="card h-100 border-primary">
                            <div className="card-body text-center">
                              <div className="mb-3">
                                <div className="text-primary" style={{ fontSize: '2.5rem' }}>
                                  {getStageIcon(tracking.current_stage)}
                                </div>
                              </div>
                              <h6 className="card-title text-primary mb-2">{tracking.product_name}</h6>
                              <h6 className="text-primary mb-2">{tracking.current_stage}</h6>
                              <p className="card-text small text-muted mb-2">
                                Production in progress
                              </p>
                              <div className="mb-2">
                                <small className="text-muted">
                                  Progress: {tracking.progress_percentage}%
                                </small>
                              </div>
                              <div className="progress mb-2" style={{ height: '20px' }}>
                                <div 
                                  className="progress-bar bg-primary" 
                                  role="progressbar" 
                                  style={{ width: `${tracking.progress_percentage}%` }}
                                >
                                  {tracking.progress_percentage}%
                                </div>
                              </div>
                              <span className={`badge bg-${getStatusColor(tracking.status)}`}>
                                {tracking.status === 'completed' ? 'Completed' : 
                                 tracking.status === 'in_progress' ? 'In Progress' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fallback Stage Information */}
        {(!stage_summary || stage_summary.length === 0) && trackings && trackings.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-warning text-dark">
                  <h4 className="mb-0">
                    <FaTools className="me-2" />
                    Production Status
                  </h4>
                </div>
                <div className="card-body">
                  <div className="alert alert-info">
                    <div className="d-flex align-items-center">
                      <FaClock className="me-3 text-info" style={{ fontSize: '1.5rem' }} />
                      <div>
                        <h6 className="mb-1">Production in Progress</h6>
                        <p className="mb-0">Your order is currently being processed. Detailed stage breakdown will be available as production progresses.</p>
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    {trackings.map((tracking, index) => {
                      // Get delayed processes for this tracking
                      const delayedProcesses = tracking.processes?.filter(p => 
                        p.delay_reason && p.delay_reason.trim() && p.status === 'completed'
                      ) || [];
                      
                      return (
                        <div key={index} className="col-md-12 mb-3">
                          <div className="card">
                            <div className="card-body">
                              <h6 className="card-title">{tracking.product_name}</h6>
                              
                              {/* Current Stage Info */}
                              <div className="d-flex align-items-center mb-2">
                                <div className="me-2">
                                  {getStageIcon(tracking.current_stage)}
                                </div>
                                <div>
                                  <strong>Current Stage:</strong> {tracking.current_stage}
                                </div>
                              </div>
                              
                              {/* Current Stage Description */}
                              <div className="small text-muted mb-2">
                                Joining and assembling all components together, ensuring structural integrity and proper alignment.
                              </div>
                              
                              {/* Progress Bar */}
                              <div className="progress mb-2">
                                <div 
                                  className="progress-bar bg-primary" 
                                  role="progressbar" 
                                  style={{ width: `${tracking.progress_percentage}%` }}
                                >
                                  {tracking.progress_percentage}%
                                </div>
                              </div>
                              
                              {/* Status Badge */}
                              <div className="small text-muted mb-3">
                                <span className={`badge bg-${getStatusColor(tracking.status)}`}>
                                  {tracking.status === 'completed' ? 'Completed' : 
                                   tracking.status === 'in_progress' ? 'In Production' : 'Pending'}
                                </span>
                              </div>
                              
                              {/* Previous Completed Stages */}
                              {tracking.processes && tracking.processes.length > 0 && (
                                <div className="mt-3">
                                  <h6 className="text-muted mb-2">
                                    <i className="fas fa-history me-2"></i>
                                    Previous Stages
                                  </h6>
                                  {tracking.processes
                                    .filter(p => p.status === 'completed')
                                    .map((process, idx) => {
                                      const isDelayed = process.delay_reason && process.delay_reason.trim();
                                      return (
                                        <div key={idx} className={`card mb-2 ${isDelayed ? 'border-warning' : 'border-success'}`}>
                                          <div className="card-body p-2">
                                            <div className="d-flex align-items-start">
                                              <div className="me-2">
                                                {isDelayed ? (
                                                  <i className="fas fa-exclamation-triangle text-warning"></i>
                                                ) : (
                                                  <i className="fas fa-check-circle text-success"></i>
                                                )}
                                              </div>
                                              <div className="flex-grow-1">
                                                <div className="d-flex justify-content-between align-items-start">
                                                  <strong className="small">{process.process_name}</strong>
                                                  {isDelayed && (
                                                    <span className="badge bg-danger">DELAYED</span>
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
                              
                              {/* Debug Info */}
                              {console.log('Rendering tracking:', tracking.product_name)}
                              {console.log('Has processes:', !!tracking.processes)}
                              {console.log('Processes:', tracking.processes)}
                              {console.log('Delayed processes:', delayedProcesses)}
                              
                              {/* Delay Information */}
                              {delayedProcesses.length > 0 ? (
                                <div className="alert alert-warning mb-0">
                                  <h6 className="alert-heading text-danger">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    Previous Stage Delays
                                  </h6>
                                  {delayedProcesses.map((process, idx) => (
                                    <div key={idx} className="mb-2 pb-2 border-bottom">
                                      <div className="fw-bold">{process.process_name}</div>
                                      <div className="small">
                                        <strong>Reason:</strong> {process.delay_reason}
                                      </div>
                                      {process.completed_by_name && (
                                        <div className="small text-muted">
                                          <strong>Completed by:</strong> {process.completed_by_name}
                                        </div>
                                      )}
                                      {process.completed_at && (
                                        <div className="small text-muted">
                                          <strong>Completed:</strong> {new Date(process.completed_at).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : tracking.processes ? (
                                <div className="alert alert-success mb-0">
                                  <small>
                                    <i className="fas fa-check-circle me-2"></i>
                                    All previous stages completed on time!
                                  </small>
                                </div>
                              ) : (
                                <div className="alert alert-info mb-0">
                                  <small>
                                    <i className="fas fa-info-circle me-2"></i>
                                    Process details loading... (Check console for debug info)
                                  </small>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">
                  <FaBox className="me-2" />
                  Your Order Items
                </h4>
              </div>
              <div className="card-body">
                <div>
                  {order.items.map((item) => (
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
                <div className="mt-2 pt-2 border-top">
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

        {/* Current Production Status */}
        {trackings && trackings.length > 0 && (
          <div className="row">
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-success text-white">
                  <h4 className="mb-0">
                    <FaCheckCircle className="me-2" />
                    Production Process & Current Status
                  </h4>
                </div>
                <div className="card-body">
                  {trackings.map((tracking, index) => {
                    return (
                      <div key={index} className="mb-4">
                        <div className="card">
                          <div className="card-body">
                            {/* Product Header */}
                            <div className="row align-items-center mb-4">
                              <div className="col-md-8">
                                <h5 className="text-primary mb-2">{tracking.product_name}</h5>
                                <div className="d-flex align-items-center mb-3">
                                  <div className="me-3">
                                    {getStageIcon(tracking.current_stage)}
                                  </div>
                                  <div>
                                    <h6 className="mb-1">Currently: {tracking.current_stage}</h6>
                                    <span className={`badge bg-${getStatusColor(tracking.status)}`}>
                                      {tracking.status === 'completed' ? 'Completed' : 
                                       tracking.status === 'in_progress' ? 'In Production' : 'Pending'}
                                    </span>
                                  </div>
                                </div>
                                <div className="progress mb-3" style={{ height: '25px' }}>
                                  <div 
                                    className="progress-bar bg-primary" 
                                    role="progressbar" 
                                    style={{ width: `${tracking.progress_percentage}%` }}
                                    aria-valuenow={tracking.progress_percentage}
                                    aria-valuemin="0" 
                                    aria-valuemax="100"
                                  >
                                    {tracking.progress_percentage}%
                                  </div>
                                </div>
                              </div>
                              <div className="col-md-4 text-center">
                                <div className="p-3 bg-light rounded">
                                  <FaClock className="text-primary mb-2" style={{ fontSize: '2rem' }} />
                                  <div className="h6 text-primary mb-1">Estimated Completion</div>
                                  <div className="h5 text-primary">
                                    {tracking.estimated_completion_date ? 
                                      new Date(tracking.estimated_completion_date).toLocaleDateString() : 
                                      'TBD'}
                                  </div>
                                  {tracking.days_remaining !== undefined && (
                                    <small className="text-muted">
                                      {tracking.days_remaining > 0 ? 
                                        `${tracking.days_remaining} days remaining` : 
                                        'Ready for delivery'}
                                    </small>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Current Production Process */}
                            <div className="mt-4">
                              <h6 className="text-primary mb-3">Current Production Process</h6>
                              <div className="row">
                                <div className="col-12">
                                  <div className="card border-primary">
                                    <div className="card-body text-center">
                                      <div className="mb-3">
                                        <div className="text-primary" style={{ fontSize: '3rem' }}>
                                          {getStageIcon(tracking.current_stage)}
                                        </div>
                                      </div>
                                      <h5 className="card-title text-primary mb-3">{tracking.current_stage}</h5>
                                      <p className="card-text text-muted mb-3">
                                        Production in progress
                                      </p>
                                      <div className="mb-3">
                                        <small className="text-muted">
                                          Progress: {tracking.progress_percentage}%
                                        </small>
                                      </div>
                                      <div className="progress mb-3" style={{ height: '25px' }}>
                                        <div 
                                          className="progress-bar bg-primary" 
                                          role="progressbar" 
                                          style={{ width: `${tracking.progress_percentage}%` }}
                                        >
                                          {tracking.progress_percentage}% Complete
                                        </div>
                                      </div>
                                      <span className={`badge bg-${getStatusColor(tracking.status)} fs-6`}>
                                        {tracking.status === 'completed' ? 'Completed' : 
                                         tracking.status === 'in_progress' ? 'In Progress' : 'Pending'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Information */}
        <div className="row mt-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="text-primary mb-0">Order Information</h5>
                  {canCancelOrder(order) && (
                    <span
                      className="badge bg-danger"
                      onClick={cancelOrder}
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
                <div className="row">
                  <div className="col-md-6">
                    <p><strong>Order Date:</strong> {new Date(order.created_at).toLocaleDateString()}</p>
                    <p><strong>Payment Method:</strong> {(order.payment_method || 'COD').toUpperCase()}</p>
                    <p><strong>Payment Status:</strong> {order.payment_status || 'Unpaid'}</p>
                    <p>
                      <strong>Shipping Fee:</strong>{" "}
                      <span className={order.shipping_fee > 0 ? '' : 'text-success'}>
                        {order.shipping_fee > 0 ? (
                          `₱${Number(order.shipping_fee || 0).toLocaleString()}`
                        ) : (
                          'FREE'
                        )}
                      </span>
                    </p>
                    <p>
                      <strong>Total Amount:</strong>{" "}
                      <span className="text-primary">
                        ₱{Number(order.total_price).toLocaleString()}
                      </span>
                    </p>
                  </div>
                  <div className="col-md-6">
                    {order.transaction_ref && (
                      <p><strong>Reference:</strong> {order.transaction_ref}</p>
                    )}
                    <p><strong>Delivery Address:</strong> {order.shipping_address || 'Not specified'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .timeline-item {
          position: relative;
        }
        
        .timeline-item:not(:last-child)::after {
          content: '';
          position: absolute;
          left: 20px;
          top: 40px;
          bottom: -15px;
          width: 2px;
          background: #dee2e6;
        }
        
        .timeline-icon {
          z-index: 1;
        }
      `}</style>
    </AppLayout>
  );
};

export default SimpleOrderTracking;
