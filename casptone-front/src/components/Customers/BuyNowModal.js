// src/components/Customers/BuyNowModal.js
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { authUtils } from "../../utils/auth";
import { formatPrice } from "../../utils/currency";
import philippineLocations from "../../data/philippineLocations.json";
import { getShippingFee } from "../../utils/shipping";
import "./BuyNowModal.css";

const BuyNowModal = ({ show, onClose, product, onOrderSuccess, position = { x: 0, y: 0 } }) => {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    phone: "",
    selectedProvince: "",
    selectedCity: "",
    selectedBarangay: "",
    houseUnit: "",
    paymentMethod: "cod"
  });
  const [errors, setErrors] = useState({});

  // Helper function to get image URL (matching ProductCatalog implementation)
  const getImageUrl = (product) => {
    if (!product?.image) return "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=No+Image";
    
    // Use the same URL construction as ProductCatalog
    return `http://localhost:8000/${product.image}`;
  };


  useEffect(() => {
    if (show && product) {
      setQuantity(1);
      setFormData({
        phone: "",
        selectedProvince: "",
        selectedCity: "",
        selectedBarangay: "",
        houseUnit: "",
        paymentMethod: "cod"
      });
      setErrors({});
    }
  }, [show, product]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.phone) {
      newErrors.phone = "Contact number is required";
    } else if (!formData.phone.startsWith("09") || formData.phone.length !== 11) {
      newErrors.phone = "Contact number must start with 09 and be 11 digits";
    }

    if (!formData.selectedProvince) {
      newErrors.selectedProvince = "Province is required";
    }

    if (!formData.selectedCity) {
      newErrors.selectedCity = "City is required";
    }

    if (!formData.selectedBarangay) {
      newErrors.selectedBarangay = "Barangay is required";
    }

    if (!formData.houseUnit) {
      newErrors.houseUnit = "House/Unit number is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleProvinceChange = (provinceId) => {
    setFormData(prev => ({
      ...prev,
      selectedProvince: provinceId,
      selectedCity: "",
      selectedBarangay: ""
    }));
    if (errors.selectedProvince) {
      setErrors(prev => ({ ...prev, selectedProvince: "" }));
    }
  };

  const handleCityChange = (cityId) => {
    setFormData(prev => ({
      ...prev,
      selectedCity: cityId,
      selectedBarangay: ""
    }));
    if (errors.selectedCity) {
      setErrors(prev => ({ ...prev, selectedCity: "" }));
    }
  };

  const handleBarangayChange = (barangayId) => {
    setFormData(prev => ({
      ...prev,
      selectedBarangay: barangayId
    }));
    if (errors.selectedBarangay) {
      setErrors(prev => ({ ...prev, selectedBarangay: "" }));
    }
  };

  const handlePhoneChange = (value) => {
    // Only allow digits
    const numericValue = value.replace(/\D/g, '');
    
    // Limit to 11 digits maximum
    const limitedValue = numericValue.slice(0, 11);
    
    // Allow typing if it's empty, starts with 0, or starts with 09
    if (limitedValue.length === 0 || 
        limitedValue === '0' || 
        limitedValue.startsWith('09')) {
      setFormData(prev => ({ ...prev, phone: limitedValue }));
      if (errors.phone) {
        setErrors(prev => ({ ...prev, phone: "" }));
      }
    }
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("You need to be logged in to place an order");
        return;
      }

      // Create structured address
      const structuredAddress = `${formData.houseUnit}, ${philippineLocations.barangays[formData.selectedCity]?.find(b => b.id === formData.selectedBarangay)?.name || formData.selectedBarangay}, ${philippineLocations.cities[formData.selectedProvince]?.find(c => c.id === formData.selectedCity)?.name || formData.selectedCity}, ${philippineLocations.provinces.find(p => p.id === formData.selectedProvince)?.name || formData.selectedProvince}`;

      const orderData = {
        product_id: product.id,
        quantity: quantity,
        payment_method: formData.paymentMethod,
        shipping_address: structuredAddress,
        contact_phone: formData.phone,
        shipping_fee: shippingFee,
        buy_now: true // Flag to indicate this is a direct order
      };

      const response = await axios.post("http://localhost:8000/api/orders", orderData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      toast.success("Order placed successfully!", {
        description: `Order ID: #${response.data.order_id || response.data.id}`,
        duration: 5000
      });

      // Close modal and trigger success callback
      onClose();
      if (onOrderSuccess) {
        onOrderSuccess(response.data);
      }

    } catch (error) {
      console.error("Order placement error:", error);
      const errorMessage = error.response?.data?.message || "Failed to place order";
      toast.error("Order failed", {
        description: errorMessage,
        duration: 4000
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate shipping fee
  const shippingInfo = getShippingFee(
    product,
    quantity,
    formData.selectedProvince,
    formData.selectedCity
  );
  
  const subtotal = product ? (product.price * quantity) : 0;
  const shippingFee = formData.selectedProvince ? shippingInfo.shippingFee : 0;
  const totalPrice = subtotal + shippingFee;

  if (!show || !product) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="buy-now-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="buy-now-modal-card"
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="buy-now-modal-header">
            <h3>🛒 Buy Now - {product.name}</h3>
            <button className="buy-now-close-btn" onClick={onClose} disabled={loading}>
              ×
            </button>
          </div>

          <div className="buy-now-modal-content">
            {/* Selected Items Section - Matching Image 2 Design */}
            <div className="selected-items-section">
              <h4>Selected Items (1)</h4>
              <div className="selected-items-list">
                <div className="selected-item-card">
                  <div className="selected-item-image-container">
                    <img 
                      src={getImageUrl(product)} 
                      alt={product.name}
                      className="selected-item-image"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                  </div>
                  <div className="selected-item-details">
                    <h5 className="selected-item-name">{product.name}</h5>
                    <div className="selected-item-meta">
                      <span className="selected-item-quantity">Qty: {quantity}</span>
                      <span className="selected-item-price">{formatPrice(product.price)} each</span>
                    </div>
                    <div className="selected-item-subtotal">
                      Subtotal: {formatPrice(product.price * quantity)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Form Section */}
            <div className="order-form-section">
              <h4>Order Details</h4>
              
              {/* Contact Number */}
              <div className="form-group">
                <label className="form-label">
                  <i className="fas fa-phone"></i>
                  Contact Number *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="09XXXXXXXXX"
                  className={`form-control ${errors.phone ? "error" : ""}`}
                  maxLength="11"
                />
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>

              {/* Address Selection */}
              <div className="address-selection-section">
                <div className="section-title">
                  <i className="fas fa-map-marker-alt"></i>
                  Shipping Address *
                </div>
                
                <div className="address-form-grid">
                  <div className="form-group">
                    <label className="form-label">Province *</label>
                    <select
                      value={formData.selectedProvince}
                      onChange={(e) => handleProvinceChange(e.target.value)}
                      className={`form-control ${errors.selectedProvince ? "error" : ""}`}
                    >
                      <option value="">Select Province</option>
                      {philippineLocations.provinces
                        .filter(province => province.functional === true)
                        .map(province => (
                          <option key={province.id} value={province.id}>
                            {province.name}
                          </option>
                        ))}
                    </select>
                    {errors.selectedProvince && <span className="error-message">{errors.selectedProvince}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">City/Municipality *</label>
                    <select
                      value={formData.selectedCity}
                      onChange={(e) => handleCityChange(e.target.value)}
                      disabled={!formData.selectedProvince}
                      className={`form-control ${errors.selectedCity ? "error" : ""}`}
                    >
                      <option value="">Select City</option>
                      {formData.selectedProvince && philippineLocations.cities[formData.selectedProvince]?.map(city => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                    {errors.selectedCity && <span className="error-message">{errors.selectedCity}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Barangay *</label>
                    <select
                      value={formData.selectedBarangay}
                      onChange={(e) => handleBarangayChange(e.target.value)}
                      disabled={!formData.selectedCity}
                      className={`form-control ${errors.selectedBarangay ? "error" : ""}`}
                    >
                      <option value="">Select Barangay</option>
                      {formData.selectedCity && philippineLocations.barangays[formData.selectedCity]?.map(barangay => (
                        <option key={barangay.id} value={barangay.id}>
                          {barangay.name}
                        </option>
                      ))}
                    </select>
                    {errors.selectedBarangay && <span className="error-message">{errors.selectedBarangay}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">House/Unit Number *</label>
                    <input
                      type="text"
                      value={formData.houseUnit}
                      onChange={(e) => handleInputChange("houseUnit", e.target.value)}
                      placeholder="e.g., 123, Unit 4A, Lot 5"
                      className={`form-control ${errors.houseUnit ? "error" : ""}`}
                    />
                    {errors.houseUnit && <span className="error-message">{errors.houseUnit}</span>}
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="form-group">
                <label className="form-label">
                  <i className="fas fa-credit-card"></i>
                  Payment Method *
                </label>
                <div className="payment-methods-grid">
                  <div className={`payment-option-card ${formData.paymentMethod === "cod" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={formData.paymentMethod === "cod"}
                      onChange={(e) => handleInputChange("paymentMethod", e.target.value)}
                    />
                    <div className="payment-content">
                      <div className="payment-icon">💰</div>
                      <div className="payment-text">
                        <div className="payment-title">Cash on Delivery</div>
                        <div className="payment-desc">Pay when you receive</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Total Section */}
            <div className="order-total-section">
              <div className="order-total-card">
                <h4>Order Total</h4>
                <div className="total-breakdown">
                  <div className="total-row">
                    <span>Product:</span>
                    <span>{product.name}</span>
                  </div>
                  <div className="total-row">
                    <span>Quantity:</span>
                    <span>{quantity}</span>
                  </div>
                  <div className="total-row">
                    <span>Unit Price:</span>
                    <span>{formatPrice(product.price)}</span>
                  </div>
                  <div className="total-row">
                    <span>Subtotal:</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="total-row">
                    <span>Shipping Fee:</span>
                    <span>
                      {shippingInfo.isFreeShipping ? (
                        <span style={{ color: '#28a745', fontWeight: 600 }}>
                          FREE
                        </span>
                      ) : formData.selectedProvince ? (
                        formatPrice(shippingFee)
                      ) : (
                        <span style={{ color: '#999', fontStyle: 'italic' }}>Select address</span>
                      )}
                    </span>
                  </div>
                  {shippingInfo.isFreeShipping && (
                    <div className="total-row" style={{ fontSize: '0.9rem', color: '#28a745', fontStyle: 'italic' }}>
                      <span>🎉 Free shipping for 3+ alkansya!</span>
                    </div>
                  )}
                  <div className="total-row final-total">
                    <span>Total:</span>
                    <span className="final-amount">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="buy-now-modal-footer">
            <button className="btn-cancel-order" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button 
              className="btn-place-order"
              onClick={handlePlaceOrder}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="btn-spinner"></div>
                  Placing Order...
                </>
              ) : (
                <>
                  Place Order • {formatPrice(totalPrice)}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BuyNowModal;
