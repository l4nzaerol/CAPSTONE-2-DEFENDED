import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const ProductFormWithPricing = ({ onClose, onSave, existingProduct = null }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: 0,
  });

  const [materials, setMaterials] = useState([]);
  const [availableMaterials, setAvailableMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [quantity, setQuantity] = useState(0);
  
  const [pricingPresets, setPricingPresets] = useState({});
  const [selectedPreset, setSelectedPreset] = useState('custom');
  const [laborPercentage, setLaborPercentage] = useState(30);
  const [profitMargin, setProfitMargin] = useState(25);
  
  const [priceCalculation, setPriceCalculation] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

  // Load available materials and pricing presets
  useEffect(() => {
    loadAvailableMaterials();
    loadPricingPresets();
  }, []);

  // Auto-calculate price when materials change
  useEffect(() => {
    if (materials.length > 0) {
      calculatePrice();
    } else {
      setPriceCalculation(null);
    }
  }, [materials, laborPercentage, profitMargin]);

  const loadAvailableMaterials = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableMaterials(response.data.filter(item => item.category === 'raw'));
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  };

  const loadPricingPresets = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/price-calculator/presets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPricingPresets(response.data.presets);
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  };

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    if (pricingPresets[preset]) {
      setLaborPercentage(pricingPresets[preset].labor_percentage);
      setProfitMargin(pricingPresets[preset].profit_margin);
    }
  };

  const addMaterial = () => {
    if (!selectedMaterial || quantity <= 0) {
      toast.warning("⚠️ Material Selection Required", {
        description: "Please select a material and enter a valid quantity.",
        duration: 3000,
        style: {
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          color: '#92400e'
        }
      });
      return;
    }

    const material = availableMaterials.find(m => m.sku === selectedMaterial);
    if (!material) return;

    // Check if material already added
    const existingIndex = materials.findIndex(m => m.sku === selectedMaterial);
    if (existingIndex >= 0) {
      // Update quantity
      const updated = [...materials];
      updated[existingIndex].quantity = quantity;
      setMaterials(updated);
    } else {
      // Add new material
      setMaterials([...materials, {
        sku: material.sku,
        name: material.name,
        unit_cost: material.unit_cost || 0,
        quantity: quantity,
        unit: material.unit
      }]);
    }

    setSelectedMaterial('');
    setQuantity(0);
  };

  const removeMaterial = (sku) => {
    setMaterials(materials.filter(m => m.sku !== sku));
  };

  const calculatePrice = async () => {
    if (materials.length === 0) return;

    setCalculating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE}/price-calculator/calculate`,
        {
          materials: materials.map(m => ({
            sku: m.sku,
            quantity: m.quantity
          })),
          labor_percentage: laborPercentage,
          profit_margin: profitMargin
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setPriceCalculation(response.data);
      
      // Auto-fill the price field with suggested price
      setFormData(prev => ({
        ...prev,
        price: Math.round(response.data.suggested_price)
      }));
      
      setShowPriceBreakdown(true);
    } catch (error) {
      console.error('Error calculating price:', error);
      toast.error("💸 Price Calculation Failed", {
        description: "Unable to calculate price. Please check your materials and try again.",
        duration: 4000,
        style: {
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626'
        }
      });
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (materials.length === 0) {
      toast.warning("⚠️ Materials Required", {
        description: "Please add at least one material to create the product.",
        duration: 3000,
        style: {
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          color: '#92400e'
        }
      });
      return;
    }

    if (!formData.price || formData.price <= 0) {
      toast.warning("💰 Valid Price Required", {
        description: "Please set a valid price for the product.",
        duration: 3000,
        style: {
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          color: '#92400e'
        }
      });
      return;
    }

    const productData = {
      ...formData,
      materials: materials
    };

    onSave(productData);
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {existingProduct ? 'Edit Product' : 'Add New Product'} with Price Calculator
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row">
                {/* Left Column - Product Details */}
                <div className="col-md-6">
                  <h6 className="mb-3">Product Information</h6>
                  
                  <div className="mb-3">
                    <label className="form-label">Product Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Category</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Pricing Preset</label>
                    <select
                      className="form-select"
                      value={selectedPreset}
                      onChange={(e) => handlePresetChange(e.target.value)}
                    >
                      <option value="custom">Custom</option>
                      <option value="alkansya">Alkansya (25% labor, 30% profit)</option>
                      <option value="table">Dining Table (40% labor, 35% profit)</option>
                      <option value="chair">Chair (35% labor, 30% profit)</option>
                    </select>
                  </div>

                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label">Labor %</label>
                      <input
                        type="number"
                        className="form-control"
                        value={laborPercentage}
                        onChange={(e) => setLaborPercentage(Number(e.target.value))}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label">Profit %</label>
                      <input
                        type="number"
                        className="form-control"
                        value={profitMargin}
                        onChange={(e) => setProfitMargin(Number(e.target.value))}
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Selling Price *</label>
                    <div className="input-group">
                      <span className="input-group-text">₱</span>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                        required
                        min="0"
                        step="0.01"
                      />
                    </div>
                    {priceCalculation && (
                      <small className="text-muted">
                        Suggested: ₱{priceCalculation.suggested_price.toFixed(2)}
                      </small>
                    )}
                  </div>
                </div>

                {/* Right Column - Materials & Price Calculation */}
                <div className="col-md-6">
                  <h6 className="mb-3">Materials (Bill of Materials)</h6>
                  
                  {/* Add Material Form */}
                  <div className="card mb-3">
                    <div className="card-body">
                      <div className="row g-2">
                        <div className="col-7">
                          <select
                            className="form-select form-select-sm"
                            value={selectedMaterial}
                            onChange={(e) => setSelectedMaterial(e.target.value)}
                          >
                            <option value="">Select Material...</option>
                            {availableMaterials.map(material => (
                              <option key={material.sku} value={material.sku}>
                                {material.name} (₱{material.unit_cost || 0})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-3">
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            placeholder="Qty"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="col-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary w-100"
                            onClick={addMaterial}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Materials List */}
                  <div className="card mb-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <div className="card-body p-2">
                      {materials.length === 0 ? (
                        <p className="text-muted text-center mb-0 py-3">
                          No materials added yet
                        </p>
                      ) : (
                        <table className="table table-sm mb-0">
                          <thead>
                            <tr>
                              <th>Material</th>
                              <th className="text-end">Qty</th>
                              <th className="text-end">Cost</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {materials.map((material, index) => (
                              <tr key={index}>
                                <td className="small">{material.name}</td>
                                <td className="text-end small">{material.quantity} {material.unit}</td>
                                <td className="text-end small">
                                  ₱{(material.unit_cost * material.quantity).toFixed(2)}
                                </td>
                                <td className="text-end">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger py-0 px-1"
                                    onClick={() => removeMaterial(material.sku)}
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Price Calculation Display */}
                  {calculating && (
                    <div className="alert alert-info">
                      <div className="spinner-border spinner-border-sm me-2"></div>
                      Calculating price...
                    </div>
                  )}

                  {priceCalculation && showPriceBreakdown && (
                    <div className="card border-success">
                      <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                        <strong>💰 Price Calculation</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-light"
                          onClick={() => setShowPriceBreakdown(!showPriceBreakdown)}
                        >
                          {showPriceBreakdown ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <div className="card-body">
                        <table className="table table-sm mb-0">
                          <tbody>
                            <tr>
                              <td>Material Cost:</td>
                              <td className="text-end">
                                <strong>₱{priceCalculation.material_cost.toFixed(2)}</strong>
                              </td>
                            </tr>
                            <tr>
                              <td>Labor ({priceCalculation.labor_percentage}%):</td>
                              <td className="text-end">₱{priceCalculation.labor_cost.toFixed(2)}</td>
                            </tr>
                            <tr className="table-active">
                              <td><strong>Production Cost:</strong></td>
                              <td className="text-end">
                                <strong>₱{priceCalculation.production_cost.toFixed(2)}</strong>
                              </td>
                            </tr>
                            <tr>
                              <td>Profit ({priceCalculation.profit_margin}%):</td>
                              <td className="text-end text-success">
                                +₱{priceCalculation.profit_amount.toFixed(2)}
                              </td>
                            </tr>
                            <tr className="table-success">
                              <td><strong>Suggested Price:</strong></td>
                              <td className="text-end">
                                <strong className="fs-5">₱{priceCalculation.suggested_price.toFixed(2)}</strong>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="mt-3">
                          <button
                            type="button"
                            className="btn btn-sm btn-success w-100"
                            onClick={() => setFormData({ ...formData, price: Math.round(priceCalculation.suggested_price) })}
                          >
                            Use Suggested Price (₱{Math.round(priceCalculation.suggested_price)})
                          </button>
                        </div>

                        <div className="mt-2 small text-muted">
                          <strong>Profit Margin:</strong> {((priceCalculation.profit_amount / priceCalculation.production_cost) * 100).toFixed(1)}%
                          <br />
                          <strong>Break-even:</strong> ₱{priceCalculation.production_cost.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}

                  {materials.length > 0 && !priceCalculation && (
                    <div className="alert alert-warning">
                      <small>💡 Price will be calculated automatically</small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {existingProduct ? 'Update' : 'Create'} Product
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProductFormWithPricing;
