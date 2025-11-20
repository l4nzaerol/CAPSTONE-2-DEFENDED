import React, { useEffect, useState } from "react";
import axios from "axios";
import Pusher from "pusher-js";

const API_URL = "http://localhost:8000/api";

const stages = ["Design","Preparation","Cutting","Assembly","Finishing","Quality Control"];

const OrderTracking = ({ orderId }) => {
  const [data, setData] = useState(null);
  const [trackingType, setTrackingType] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_URL}/order-tracking/${orderId}/customer`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTrackingType(res.data.tracking_type);
        setData(res.data.data);
      } catch (e) {
        setError("Failed to load tracking.");
      } finally {
        setLoading(false);
      }
    };
    if (orderId) run();
    // Subscribe to tracking updates for live refresh
    try {
      const pusherKey = process.env.REACT_APP_PUSHER_KEY || "";
      const cluster = process.env.REACT_APP_PUSHER_CLUSTER || "mt1";
      if (pusherKey) {
        const pusher = new Pusher(pusherKey, { cluster });
        const channel = pusher.subscribe("order-tracking-channel");
        const handler = () => run();
        channel.bind("order-tracking-updated", handler);
        return () => {
          channel.unbind("order-tracking-updated", handler);
          pusher.unsubscribe("order-tracking-channel");
          pusher.disconnect();
        };
      }
    } catch (e) {
      // ignore
    }
  }, [orderId]);

  if (!orderId) return <div className="alert alert-warning wood-card p-2">No order selected.</div>;
  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-danger">{error}</div>;

  // Render simple status for Alkansya and other products
  if (trackingType === 'simple') {
    return (
      <div className="card p-4 wood-card wood-animated">
        <h5 className="mb-4">Order #{data?.order_id} Status</h5>
        
        {/* Product List */}
        <div className="mb-4">
          <h6 className="text-muted mb-3">Products:</h6>
          {data?.products?.map((product, index) => (
            <div key={index} className="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
              <div>
                <strong>{product.name}</strong>
                <span className="text-muted ms-2">x{product.quantity}</span>
              </div>
              <span className="fw-bold">₱{product.price?.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Simple Status Timeline */}
        <div className="mb-3">
          <h6 className="text-muted mb-3">Order Status:</h6>
          <div className="d-flex justify-content-between align-items-center position-relative">
            {/* Progress Line */}
            <div 
              className="position-absolute top-50 start-0 translate-middle-y bg-secondary" 
              style={{ height: '2px', width: '100%', zIndex: 0 }}
            ></div>
            
            {/* Status Steps */}
            {['pending', 'processing', 'ready_for_delivery', 'delivered', 'completed'].map((status, index) => {
              const isActive = getStatusIndex(data?.status) >= index;
              const isCurrent = getStatusIndex(data?.status) === index;
              
              return (
                <div key={status} className="text-center position-relative" style={{ zIndex: 1, flex: 1 }}>
                  <div 
                    className={`rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center ${
                      isActive ? 'bg-success text-white' : 'bg-light border'
                    }`}
                    style={{ width: '40px', height: '40px' }}
                  >
                    {isActive ? '✓' : index + 1}
                  </div>
                  <small className={`d-block ${isCurrent ? 'fw-bold text-success' : 'text-muted'}`}>
                    {getStatusLabel(status)}
                  </small>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Status Badge */}
        <div className="alert alert-info mt-4 text-center">
          <h5 className="mb-0">
            <span className="badge bg-success fs-6">{data?.status_label}</span>
          </h5>
        </div>

        {/* Order Dates */}
        <div className="mt-3 text-muted small">
          <div className="d-flex justify-content-between">
            <span>Order Placed:</span>
            <span>{new Date(data?.created_at).toLocaleDateString()}</span>
          </div>
          <div className="d-flex justify-content-between">
            <span>Last Updated:</span>
            <span>{new Date(data?.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    );
  }

  // Render detailed production tracking for Table and Chair
  const { order, stage_summary = [], overall = {} } = data || {};

  return (
    <div className="card p-3 wood-card wood-animated">
      <h5>Order #{order?.id} Production Tracking</h5>
      <div className="mb-2 text-muted">ETA: {overall.eta} • Progress: {overall.progress_pct}%</div>
      <div className="progress mb-3" role="progressbar" aria-valuenow={overall.progress_pct} aria-valuemin="0" aria-valuemax="100">
        <div className="progress-bar" style={{ width: `${overall.progress_pct}%` }}>{overall.progress_pct}%</div>
      </div>
      <div className="table-responsive">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Stage</th>
              <th className="text-end">Pending</th>
              <th className="text-end">In Progress</th>
              <th className="text-end">Completed</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => {
              const row = stage_summary.find((r) => r.stage === s) || { pending: 0, in_progress: 0, completed: 0 };
              return (
                <tr key={s}>
                  <td>{s}</td>
                  <td className="text-end">{row.pending}</td>
                  <td className="text-end">{row.in_progress}</td>
                  <td className="text-end">{row.completed}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Helper functions
function getStatusIndex(status) {
  const statusMap = {
    'pending': 0,
    'accepted': 1,
    'processing': 1,
    'in_production': 1,
    'ready_for_delivery': 2,
    'out_for_delivery': 3,
    'delivered': 3,
    'completed': 4
  };
  return statusMap[status] ?? 0;
}

function getStatusLabel(status) {
  const labels = {
    'pending': 'Pending',
    'processing': 'Processing',
    'ready_for_delivery': 'Ready',
    'delivered': 'Delivered',
    'completed': 'Complete'
  };
  return labels[status] ?? status;
}

export default OrderTracking;

