import React, { useState } from 'react';
import api from '../../api/client';
import { toast } from 'sonner';

const AlkansyaDailyOutputModal = ({ show, onHide, onSuccess }) => {
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!quantity || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/inventory/alkansya-daily-output', {
        quantity: parseInt(quantity),
        date: date,
        notes: notes
      });

      toast.success(`Successfully added ${quantity} Alkansya to inventory!`);
      setQuantity('');
      setNotes('');
      onSuccess && onSuccess(response.data);
      onHide();
    } catch (error) {
      console.error('Error adding daily output:', error);
      toast.error(error.response?.data?.error || 'Failed to add daily output');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onHide}>
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header bg-info text-white">
            <h5 className="modal-title">
              <i className="fas fa-piggy-bank me-2"></i>
              Add Daily Alkansya Output
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onHide}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Quantity Produced</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Enter number of Alkansya produced"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
                  required
                />
                <small className="text-muted">This will be added to your Alkansya inventory</small>
              </div>
              <div className="mb-3">
                <label className="form-label">Notes (Optional)</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Add any notes about today's production..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onHide} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-info" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Adding...
                  </>
                ) : (
                  <>
                    <i className="fas fa-plus me-2"></i>
                    Add to Inventory
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AlkansyaDailyOutputModal;
