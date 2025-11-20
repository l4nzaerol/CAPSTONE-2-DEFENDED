import React, { useState, useEffect } from 'react';

const AlkansyaDailyOutputModal = ({ show, onHide, onSuccess }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    quantity: 0,
    notes: '',
    produced_by: 'Production Staff'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dailyOutputData, setDailyOutputData] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const apiBase = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000/api";
  
  const apiCall = async (path, options = {}) => {
    const token = localStorage.getItem("token");
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    };

    const url = path.startsWith('http') ? path : `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  };

  useEffect(() => {
    if (show) {
      fetchDailyOutputHistory();
    }
  }, [show]);

  const fetchDailyOutputHistory = async () => {
    try {
      const data = await apiCall('/inventory/alkansya-daily-output');
      setDailyOutputData(data);
    } catch (err) {
      console.error('Failed to fetch daily output history:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiCall('/inventory/alkansya-daily-output', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      
      onSuccess();
      onHide();
      setFormData({
        date: new Date().toISOString().split('T')[0],
        quantity: 0,
        notes: '',
        produced_by: 'Production Staff'
      });
    } catch (err) {
      setError(err.message || 'Failed to add daily output');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getTotalOutput = () => {
    return dailyOutputData.reduce((sum, item) => sum + (item.quantity_produced || 0), 0);
  };

  const getAverageOutput = () => {
    if (dailyOutputData.length === 0) return 0;
    return (getTotalOutput() / dailyOutputData.length).toFixed(1);
  };

  const getLast7DaysOutput = () => {
    const last7Days = dailyOutputData
      .filter(item => {
        const itemDate = new Date(item.date);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return itemDate >= sevenDaysAgo;
      })
      .reduce((sum, item) => sum + (item.quantity_produced || 0), 0);
    return last7Days;
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-piggy-bank me-2"></i>
              Alkansya Daily Output Management
            </h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>
          <div className="modal-body">
            <div className="row">
              {/* Add Daily Output Form */}
              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-header">
                    <h6 className="mb-0">Add Daily Output</h6>
                  </div>
                  <div className="card-body">
                    <form onSubmit={handleSubmit}>
                      <div className="mb-3">
                        <label className="form-label">Date *</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.date}
                          onChange={(e) => handleChange('date', e.target.value)}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Quantity Produced *</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.quantity}
                          onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 0)}
                          min="0"
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Produced By</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.produced_by}
                          onChange={(e) => handleChange('produced_by', e.target.value)}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Notes</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          value={formData.notes}
                          onChange={(e) => handleChange('notes', e.target.value)}
                          placeholder="Additional notes about today's production..."
                        />
                      </div>
                      {error && (
                        <div className="alert alert-danger">{error}</div>
                      )}
                      <button
                        type="submit"
                        className="btn btn-primary w-100"
                        disabled={loading}
                      >
                        {loading ? 'Adding...' : 'Add Daily Output'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {/* Statistics and History */}
              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Production Statistics</h6>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => setShowHistory(!showHistory)}
                    >
                      {showHistory ? 'Hide' : 'Show'} History
                    </button>
                  </div>
                  <div className="card-body">
                    {/* Statistics Cards */}
                    <div className="row g-3 mb-3">
                      <div className="col-6">
                        <div className="card bg-primary text-white">
                          <div className="card-body text-center">
                            <h5 className="mb-1">{getTotalOutput()}</h5>
                            <small>Total Output</small>
                          </div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="card bg-success text-white">
                          <div className="card-body text-center">
                            <h5 className="mb-1">{getAverageOutput()}</h5>
                            <small>Avg Daily</small>
                          </div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="card bg-info text-white">
                          <div className="card-body text-center">
                            <h5 className="mb-1">{getLast7DaysOutput()}</h5>
                            <small>Last 7 Days</small>
                          </div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="card bg-warning text-white">
                          <div className="card-body text-center">
                            <h5 className="mb-1">{dailyOutputData.length}</h5>
                            <small>Production Days</small>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent History */}
                    {showHistory && (
                      <div className="mt-3">
                        <h6>Recent Production History</h6>
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Quantity</th>
                                <th>Efficiency</th>
                                <th>Defects</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dailyOutputData
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .slice(0, 10)
                                .map((item, index) => (
                                <tr key={index}>
                                  <td>{new Date(item.date).toLocaleDateString()}</td>
                                  <td>
                                    <span className="badge bg-primary">
                                      {item.quantity_produced}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="badge bg-success">
                                      {item.efficiency_percentage}%
                                    </span>
                                  </td>
                                  <td>
                                    <span className="badge bg-warning">
                                      {item.defects || 0}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlkansyaDailyOutputModal;
