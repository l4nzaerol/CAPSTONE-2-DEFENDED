// src/components/CartTable.js
import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import api from "../../api/client";
import philippineLocations from "../../data/philippineLocations.json";
import { calculateTotalShippingFee } from "../../utils/shipping";

const CartTable = () => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [payLoading, setPayLoading] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [removingItems, setRemovingItems] = useState(new Set());
  const [updatingItems, setUpdatingItems] = useState(new Set());
  const [redirecting, setRedirecting] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  
  // Address selection states
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [houseUnit, setHouseUnit] = useState("");
  const [provinceError, setProvinceError] = useState("");
  const [cityError, setCityError] = useState("");
  const [barangayError, setBarangayError] = useState("");
  const [houseUnitError, setHouseUnitError] = useState("");

  useEffect(() => {
    fetchCartItems();
    
    // Check if cart should be cleared due to successful payment
    const cartClearedFlag = localStorage.getItem('cart_cleared_on_payment_success');
    if (cartClearedFlag === 'true') {
      setCartItems([]);
      localStorage.removeItem('cart_cleared_on_payment_success');
    }
  }, []);

  // Close checkout modal on Escape for better accessibility
  useEffect(() => {
    if (!showCheckout) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowCheckout(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCheckout]);

  const fetchCartItems = async () => {
    try {
      const response = await api.get("/cart");
      const items = response.data || [];
      setCartItems(items);
      // Initialize quantities state
      const initialQuantities = {};
      items.forEach(item => {
        initialQuantities[item.id] = item.quantity;
      });
      setQuantities(initialQuantities);
    } catch (err) {
      setError("Failed to load cart items.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    
    // Find the item to check its properties
    const item = cartItems.find(item => item.id === itemId);
    if (!item) return;
    
    const productName = (item.product?.name || item.name || '').toLowerCase();
    const categoryName = item.product?.category_name || '';
    const isMadeToOrderDiningTable = 
      (categoryName === 'Made to Order' || categoryName === 'made_to_order') &&
      productName.includes('dining table');
    const isWoodenChair = productName.includes('wooden chair');
    
    // Prevent quantity changes for made-to-order Dining Table
    if (isMadeToOrderDiningTable) {
      toast.error("Dining Table (Made to Order) quantity is fixed to 1 and cannot be changed.");
      return;
    }
    
    // Enforce max quantity for Wooden Chair
    if (isWoodenChair && newQuantity > 4) {
      toast.error("Wooden Chair maximum quantity is 4");
      return;
    }
    
    // Store original quantity for rollback
    const originalQuantity = item.quantity;
    
    // Set loading state briefly to prevent rapid clicks (removed immediately after optimistic update)
    setUpdatingItems(prev => new Set(prev).add(itemId));
    
    // Optimistic update - update both quantities state and cartItems state immediately
    // This gives instant UI feedback without waiting for the API call
    setQuantities(prev => ({
      ...prev,
      [itemId]: newQuantity
    }));
    
    // Update cartItems state immediately for instant UI feedback
    setCartItems(prev => prev.map(cartItem => 
      cartItem.id === itemId 
        ? { ...cartItem, quantity: newQuantity }
        : cartItem
    ));
    
    // Remove loading state immediately after optimistic update for instant feedback
    // The UI is already updated, so no need to wait for API response
    setUpdatingItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });
    
    // Update on server in the background (fire and forget for UI responsiveness)
    // The UI is already updated optimistically above
    api.put(`/cart/${itemId}`, { quantity: newQuantity })
      .catch(err => {
        // Revert on error
        setQuantities(prev => ({
          ...prev,
          [itemId]: originalQuantity
        }));
        setCartItems(prev => prev.map(cartItem => 
          cartItem.id === itemId 
            ? { ...cartItem, quantity: originalQuantity }
            : cartItem
        ));
        const errorMsg = err.response?.data?.message || "Failed to update item quantity.";
        toast.error(errorMsg);
      });
  };

  const handleRemoveItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to remove this item from your cart?')) {
      return;
    }
    
    setRemovingItems(prev => new Set(prev).add(itemId));
    
    try {
      await api.delete(`/cart/${itemId}`);
      await fetchCartItems();
      // Remove from selected items if it was selected
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    } catch (err) {
      toast.error("Failed to remove item.");
      setRemovingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  // Handle item selection for checkout
  const handleItemSelection = (itemId, isSelected) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  };

  // Select all items
  const handleSelectAll = () => {
    const allItemIds = cartItems.map(item => item.id);
    setSelectedItems(new Set(allItemIds));
  };

  // Deselect all items
  const handleDeselectAll = () => {
    setSelectedItems(new Set());
  };

  // Validation functions

  const validatePhone = (phone) => {
    if (!phone.trim()) {
      setPhoneError("Contact number is required");
      return false;
    }
    
    const trimmedPhone = phone.trim();
    
    // Check if it starts with 09
    if (!trimmedPhone.startsWith('09')) {
      setPhoneError("Contact number must start with 09");
      return false;
    }
    
    // Check if it contains only digits
    if (!/^\d+$/.test(trimmedPhone)) {
      setPhoneError("Contact number must contain only numbers");
      return false;
    }
    
    // Check length - must be exactly 11 digits
    if (trimmedPhone.length !== 11) {
      if (trimmedPhone.length > 11) {
        setPhoneError("Contact number is too long. Please enter exactly 11 digits");
      } else {
        setPhoneError("Contact number is too short. Please enter exactly 11 digits");
      }
      return false;
    }
    
    setPhoneError("");
    return true;
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
      setPhone(limitedValue);
      if (phoneError) {
        validatePhone(limitedValue);
      }
    }
  };

  // Address validation functions
  const validateProvince = (province) => {
    if (!province) {
      setProvinceError("Please select a province");
      return false;
    }
    setProvinceError("");
    return true;
  };

  const validateCity = (city) => {
    if (!city) {
      setCityError("Please select a city");
      return false;
    }
    setCityError("");
    return true;
  };

  const validateBarangay = (barangay) => {
    if (!barangay) {
      setBarangayError("Please select a barangay");
      return false;
    }
    setBarangayError("");
    return true;
  };

  const validateHouseUnit = (houseUnit) => {
    if (!houseUnit.trim()) {
      setHouseUnitError("House/Unit number is required");
      return false;
    }
    if (houseUnit.trim().length < 3) {
      setHouseUnitError("House/Unit number must be at least 3 characters");
      return false;
    }
    setHouseUnitError("");
    return true;
  };

  // Address selection handlers
  const handleProvinceChange = (provinceId) => {
    setSelectedProvince(provinceId);
    setSelectedCity(""); // Reset city when province changes
    setSelectedBarangay(""); // Reset barangay when province changes
    if (provinceError) validateProvince(provinceId);
  };

  const handleCityChange = (cityId) => {
    setSelectedCity(cityId);
    setSelectedBarangay(""); // Reset barangay when city changes
    if (cityError) validateCity(cityId);
  };

  const handleBarangayChange = (barangayId) => {
    setSelectedBarangay(barangayId);
    if (barangayError) validateBarangay(barangayId);
  };

  const handleHouseUnitChange = (value) => {
    setHouseUnit(value);
    if (houseUnitError) validateHouseUnit(value);
  };


  // Handle proceed to order summary
  const handleProceedToOrderSummary = () => {
    if (selectedItems.size === 0) {
      toast.error("Please select at least one item to checkout");
      return;
    }
    setShowOrderSummary(true);
  };


  const handleCheckout = async () => {
    // Validate all address fields
    const isProvinceValid = validateProvince(selectedProvince);
    const isCityValid = validateCity(selectedCity);
    const isBarangayValid = validateBarangay(selectedBarangay);
    const isHouseUnitValid = validateHouseUnit(houseUnit);
    const isPhoneValid = validatePhone(phone);
    
    if (!isProvinceValid || !isCityValid || !isBarangayValid || !isHouseUnitValid || !isPhoneValid) {
      toast.error("Please complete all required fields before proceeding");
      return;
    }

    try {
      setPayLoading(true);
      
      // Create structured address
      const structuredAddress = `${houseUnit}, ${philippineLocations.barangays[selectedCity]?.find(b => b.id === selectedBarangay)?.name || selectedBarangay}, ${philippineLocations.cities[selectedProvince]?.find(c => c.id === selectedCity)?.name || selectedCity}, ${philippineLocations.provinces.find(p => p.id === selectedProvince)?.name || selectedProvince}`;
      
      const response = await api.post("/checkout", {
        payment_method: paymentMethod,
        shipping_address: structuredAddress,
        contact_phone: phone,
        shipping_fee: shippingInfo.shippingFee,
        selected_items: Array.from(selectedItems), // Include selected items
      });

      // Show success message with clear instructions
      const orderId = response.data?.order?.id || response.data?.id;
      console.log("🎉 CHECKOUT SUCCESS - Showing NEW message!");
      toast.success(`Order placed successfully! Order ID: #${orderId}`, {
        duration: 5000,
        description: 'Your order is being processed and will appear in the admin dashboard.'
      });

      // Clear form and close modal
      setPhone("");
      setSelectedProvince("");
      setSelectedCity("");
      setSelectedBarangay("");
      setHouseUnit("");
      setShowOrderSummary(false);
      
      // Clear cart
      setCartItems([]);
      setSelectedItems(new Set());

    } catch (err) {
      console.error("Checkout failed:", err);
      const msg = err.response?.data?.message || err.message || "Unknown error";
      const shortages = err.response?.status === 422 ? (err.response?.data?.shortages || []) : [];
      if (shortages.length > 0) {
        const lines = shortages.map(s => `• ${s.material_name} (SKU ${s.sku}): need ${s.required}, on hand ${s.on_hand}, deficit ${s.deficit} for ${s.product_name}`).join("\n");
        toast.error(`Cannot place order due to insufficient materials: ${lines}`, {
          duration: 8000,
          description: 'Please reduce quantity or wait for replenishment.'
        });
      } else {
        toast.error(`Checkout failed: ${msg}`);
      }
    } finally {
      setPayLoading(false);
    }
  };

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + (item.product?.price || item.price || 0) * item.quantity,
    0
  );

  // Calculate selected items totals
  const selectedItemsList = cartItems.filter(item => selectedItems.has(item.id));
  const selectedItemsCount = selectedItemsList.reduce((sum, item) => sum + (quantities[item.id] || item.quantity), 0);
  const selectedItemsPrice = selectedItemsList.reduce(
    (sum, item) => sum + (item.product?.price || item.price || 0) * (quantities[item.id] || item.quantity),
    0
  );

  // Calculate shipping fee for selected items
  const shippingInfo = calculateTotalShippingFee(
    selectedItemsList,
    selectedProvince,
    selectedCity,
    quantities
  );
  
  const totalWithShipping = selectedItemsPrice + shippingInfo.shippingFee;

  // Helper function to get image URL
  const getImageUrl = (item) => {
    const imagePath = item.product?.image || item.image;
    if (!imagePath) return "https://via.placeholder.com/150";
    
    // If image path already includes the full URL, use it as is
    if (imagePath.startsWith('http')) return imagePath;
    
    // Try both possible path formats to match your AdminProductsTable
    if (imagePath.startsWith('storage/')) {
      return `http://localhost:8000/${imagePath}`;
    } else {
      return `http://localhost:8000/storage/${imagePath}`;
    }
  };

  // Helper function to get product name
  const getProductName = (item) => {
    return item.product?.name || item.name || "Unknown Product";
  };

  // Helper function to get product price
  const getProductPrice = (item) => {
    return item.product?.price || item.price || 0;
  };

  if (loading) return <p>Loading cart...</p>;
  if (error) return <p className="text-danger">{error}</p>;

  return (
    <div className="modern-cart-container">
      {loading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading your cart...</p>
        </div>
      )}
      
      {redirecting ? (
        <div className="redirecting-state">
          <div className="redirecting-spinner"></div>
          <h3>Redirecting to {paymentMethod.toUpperCase()} Payment...</h3>
          <p>Please wait while we redirect you to complete your payment securely.</p>
          <div className="redirect-tips">
            💡 <strong>Tip:</strong> If you're not redirected automatically, please check if your browser is blocking the redirect.
          </div>
        </div>
      ) : !loading && cartItems.length > 0 ? (
        <>
          {/* Cart Items Header */}
          <div className="cart-header">
            <div className="cart-header-left">
              <h3>🛒 Items in your cart</h3>
              <span className="items-count">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</span>
            </div>
            <div className="cart-header-right">
              <div className="selection-controls">
                <button 
                  className="btn-select-all" 
                  onClick={handleSelectAll}
                  disabled={selectedItems.size === cartItems.length}
                >
                  Select All
                </button>
                <button 
                  className="btn-deselect-all" 
                  onClick={handleDeselectAll}
                  disabled={selectedItems.size === 0}
                >
                  Deselect All
                </button>
              </div>
              {selectedItems.size > 0 && (
                <div className="selected-info">
                  {selectedItems.size} item{selectedItems.size === 1 ? '' : 's'} selected
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Cart List */}
          <div className="enhanced-cart-list">
            {cartItems.map((item) => {
              const isRemoving = removingItems.has(item.id);
              const isUpdating = updatingItems.has(item.id);
              const currentQuantity = quantities[item.id] || item.quantity;
              
              // Check if this is a made-to-order Dining Table (quantity should be fixed to 1)
              const productName = (item.product?.name || item.name || '').toLowerCase();
              const categoryName = item.product?.category_name || '';
              const isMadeToOrderDiningTable = 
                (categoryName === 'Made to Order' || categoryName === 'made_to_order') &&
                (productName.includes('dining table'));
              const isWoodenChair = productName.includes('wooden chair');
              
              return (
                <div 
                  key={item.id} 
                  className={`enhanced-cart-item wood-card wood-animated ${
                    isRemoving ? 'removing' : ''
                  } ${isUpdating ? 'updating' : ''} ${
                    selectedItems.has(item.id) ? 'selected' : ''
                  }`}
                >
                  {/* Selection Checkbox */}
                  <div className="item-selection">
                    <input
                      type="checkbox"
                      id={`select-${item.id}`}
                      checked={selectedItems.has(item.id)}
                      onChange={(e) => handleItemSelection(item.id, e.target.checked)}
                      className="selection-checkbox"
                    />
                  </div>

                  {/* Product Image */}
                  <div className="item-image-container">
                    <img
                      src={getImageUrl(item)}
                      alt={getProductName(item)}
                      className="item-image"
                      onError={(e) => {
                        e.target.src = "https://via.placeholder.com/150?text=No+Image";
                      }}
                    />
                  </div>

                  {/* Product Details */}
                  <div className="item-details">
                    <h4 className="item-name">{getProductName(item)}</h4>
                    <div className="item-price">₱{getProductPrice(item).toLocaleString()}</div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="quantity-controls">
                    <label className="quantity-label">Quantity</label>
                    {isMadeToOrderDiningTable ? (
                      <div className="quantity-selector">
                        <div className="qty-display qty-display-fixed" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                          <span className="qty-number">1</span>
                        </div>
                      </div>
                    ) : (
                      <div className="quantity-selector">
                        <button
                          className="qty-btn qty-decrease"
                          onClick={() => handleEditQuantity(item.id, Math.max(currentQuantity - 1, 1))}
                          disabled={isUpdating || currentQuantity <= 1}
                          title="Decrease quantity"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                            <rect x="2" y="5" width="8" height="2" rx="1"/>
                          </svg>
                        </button>
                        
                        <div className="qty-display">
                          {isUpdating ? (
                            <div className="qty-spinner"></div>
                          ) : (
                            <span className="qty-number">{currentQuantity}</span>
                          )}
                        </div>
                        
                        <button
                          className="qty-btn qty-increase"
                          onClick={() => {
                            const newQty = currentQuantity + 1;
                            if (isWoodenChair && newQty > 4) {
                              toast.error("Wooden Chair maximum quantity is 4");
                              return;
                            }
                            handleEditQuantity(item.id, newQty);
                          }}
                          disabled={isUpdating || (isWoodenChair && currentQuantity >= 4)}
                          title={isWoodenChair && currentQuantity >= 4 ? "Maximum quantity is 4" : "Increase quantity"}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                            <rect x="5" y="2" width="2" height="8" rx="1"/>
                            <rect x="2" y="5" width="8" height="2" rx="1"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="item-actions">
                    <button
                      className="btn-remove-enhanced"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={isRemoving}
                      title="Remove from cart"
                    >
                      {isRemoving ? (
                        <div className="remove-spinner"></div>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 5.885 16h4.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-4.23a1 1 0 0 1-.997-.92L5.042 3.5h7.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .471-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        !loading && (
          <div className="empty-cart-state">
            <div className="empty-cart-icon">🛍️</div>
            <h3>Your cart is empty</h3>
            <p>Add some products to get started!</p>
            <button className="btn-wood" onClick={() => window.location.href = '/dashboard'}>
              Continue Shopping
            </button>
          </div>
        )
      )}
      
      {/* Enhanced Order Summary - Only show when items are selected */}
      {!loading && cartItems.length > 0 && selectedItems.size > 0 && (
        <div className="enhanced-summary wood-card wood-animated">
          <div className="summary-header">
            <h3>📋 Order Summary</h3>
          </div>
          
          <div className="summary-details">
            <div className="summary-row">
              <span>Total Items:</span>
              <strong>{selectedItemsCount} {selectedItemsCount === 1 ? 'item' : 'items'}</strong>
            </div>
            <div className="summary-row">
              <span>Subtotal:</span>
              <strong>₱{selectedItemsPrice.toLocaleString()}</strong>
            </div>
            {selectedProvince && (
              <div className="summary-row">
                <span>Shipping:</span>
                <strong style={{ color: shippingInfo.isFreeShipping ? '#28a745' : 'inherit' }}>
                  {shippingInfo.isFreeShipping ? 'FREE' : `₱${shippingInfo.shippingFee.toLocaleString()}`}
                </strong>
              </div>
            )}
            <div className="summary-row total-row">
              <span>Total Amount:</span>
              <strong className="total-amount">
                ₱{selectedProvince ? totalWithShipping.toLocaleString() : selectedItemsPrice.toLocaleString()}
              </strong>
            </div>
          </div>
          
          <button 
            className="btn-checkout-enhanced btn-wood" 
            onClick={handleProceedToOrderSummary}
          >
            <span>
              {selectedItems.size === 1 
                ? 'Checkout Item'
                : `Checkout Selected Items (${selectedItems.size})`
              }
            </span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Enhanced Checkout Modal */}
      {showCheckout && (
        <div className="enhanced-modal-backdrop" onClick={() => setShowCheckout(false)}>
          <div className="enhanced-modal-card wood-card" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="checkout-title">Checkout</h3>
              <button 
                className="modal-close-btn"
                onClick={() => setShowCheckout(false)}
                disabled={payLoading}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              {/* Order Summary in Modal */}
              <div className="checkout-summary">
                <h4>Order Summary</h4>
                <div className="checkout-items">
                  {cartItems.slice(0, 3).map(item => (
                    <div key={item.id} className="checkout-item">
                      <img src={getImageUrl(item)} alt={getProductName(item)} className="checkout-item-img" />
                      <div className="checkout-item-details">
                        <span className="checkout-item-name">{getProductName(item)}</span>
                        <span className="checkout-item-qty">x{quantities[item.id] || item.quantity}</span>
                      </div>
                      <span className="checkout-item-price">₱{(getProductPrice(item) * (quantities[item.id] || item.quantity)).toLocaleString()}</span>
                    </div>
                  ))}
                  {cartItems.length > 3 && (
                    <div className="checkout-item-more">
                      +{cartItems.length - 3} more {cartItems.length - 3 === 1 ? 'item' : 'items'}
                    </div>
                  )}
                </div>
                <div className="checkout-total">
                  <strong>Total: ₱{totalPrice.toLocaleString()}</strong>
                </div>
              </div>
              
              {/* Shipping Form */}
              <div className="checkout-form">
                <div className="form-group">
                  <label className="form-label">Shipping Address *</label>
                  <textarea 
                    className="form-control" 
                    rows="2" 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)} 
                    placeholder="House/Unit, Street, Barangay, City, Province, ZIP" 
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Contact Phone *</label>
                  <input 
                    className={`form-control ${phoneError ? 'error' : ''}`}
                    type="tel"
                    value={phone} 
                    onChange={(e) => handlePhoneChange(e.target.value)} 
                    placeholder="09xxxxxxxxx (11 digits)" 
                    maxLength="11"
                    required
                  />
                  {phoneError && <div className="error-message">{phoneError}</div>}
                </div>
                
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <div className="payment-methods">
                    <label className={`payment-option ${paymentMethod==='cod'?'selected':''}`}>
                      <input 
                        type="radio" 
                        name="payment" 
                        value="cod" 
                        checked={paymentMethod==='cod'} 
                        onChange={() => setPaymentMethod('cod')} 
                      />
                      <div className="payment-content">
                        <div className="payment-icon">📦</div>
                        <div className="payment-text">
                          <span className="payment-title">Cash on Delivery</span>
                          <span className="payment-desc">Pay when your order arrives</span>
                        </div>
                      </div>
                    </label>
                    
                    
                    <label className={`payment-option ${paymentMethod==='maya'?'selected':''}`}>
                      <input 
                        type="radio" 
                        name="payment" 
                        value="maya" 
                        checked={paymentMethod==='maya'} 
                        onChange={() => setPaymentMethod('maya')} 
                      />
                      <div className="payment-content">
                        <div className="payment-icon">💳</div>
                        <div className="payment-text">
                          <span className="payment-title">Maya</span>
                          <span className="payment-desc">Pay with Maya wallet</span>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
                
                {paymentMethod !== 'cod' && (
                  <div className="payment-notice">
                    🔒 You will be redirected to the {paymentMethod.toUpperCase()} payment page after placing your order.
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary-enhanced" 
                onClick={() => setShowCheckout(false)} 
                disabled={payLoading}
              >
                Cancel
              </button>
              
              <button 
                className="btn-primary-enhanced btn-wood" 
                onClick={async () => {
                  if (!address.trim() || !phone.trim()) {
                    toast.error('Please fill in all required fields.');
                    return;
                  }
                  
                  try {
                    setPayLoading(true);
                    if (paymentMethod === 'cod') {
                      await handleCheckout();
                    } else {
                      // Create order
                      const orderRes = await api.post('/checkout', {
                        payment_method: paymentMethod,
                        shipping_address: address,
                        contact_phone: phone,
                      });
                      
                      const orderId = orderRes?.data?.order_id || orderRes?.data?.order?.id;
                      if (!orderId) {
                        throw new Error('Failed to create order');
                      }
                      
                      // Initialize payment
                      const paymentRes = await api.post('/payments/init', {
                        order_id: orderId,
                        provider: paymentMethod,
                      });
                      
                      const paymentUrl = paymentRes?.data?.checkout_url;
                      if (!paymentUrl) {
                        throw new Error('Failed to get payment URL');
                      }
                      
                      // Set redirecting state
                      setRedirecting(true);
                      
                      // Success message
                      toast.success(`Order #${orderId} created successfully! Redirecting to ${paymentMethod.toUpperCase()} payment...`, {
                        duration: 4000
                      });
                      
                      // Close modal but DON'T clear cart yet - wait for payment success
                      setShowCheckout(false);
                      
                      // Small delay to show the redirect message, then redirect
                      setTimeout(() => {
                        window.location.href = paymentUrl;
                      }, 1000);
                      
                      // Fallback: If redirect doesn't happen in 10 seconds, show manual link
                      setTimeout(() => {
                        if (redirecting) {
                          const userChoice = window.confirm(
                            `Redirect is taking longer than expected. Would you like to open the payment page manually?\n\nClick OK to open payment page, or Cancel to copy the payment link.`
                          );
                          if (userChoice) {
                            window.open(paymentUrl, '_blank');
                          } else {
                            navigator.clipboard.writeText(paymentUrl).then(() => {
                              toast.success(`Payment link copied to clipboard!`, {
                                description: 'You can now paste it in your browser.'
                              });
                            }).catch(() => {
                              prompt('Payment URL (copy this):', paymentUrl);
                            });
                          }
                          setRedirecting(false);
                        }
                      }, 10000);
                    }
                  } catch (e) {
                    const msg = e?.response?.data?.message || e.message || 'Payment failed';
                    toast.error(`Checkout failed: ${msg}`);
                  } finally {
                    setPayLoading(false);
                  }
                }} 
                disabled={payLoading || !address.trim() || !phone.trim()}
              >
                {payLoading ? (
                  <>
                    <div className="btn-spinner"></div>
                    {redirecting ? `Redirecting to ${paymentMethod.toUpperCase()}...` : 'Processing...'}
                  </>
                ) : (
                  <>
                    {paymentMethod === 'cod' ? 'Place Order' : `Pay with ${paymentMethod.toUpperCase()}`} • ₱{totalPrice.toLocaleString()}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Order Summary Modal */}
      {showOrderSummary && (
        <div className="order-summary-modal-backdrop" onClick={() => setShowOrderSummary(false)}>
          <div className="order-summary-modal-card" role="dialog" aria-modal="true" aria-labelledby="order-summary-title" onClick={(e) => e.stopPropagation()}>
            <div className="order-summary-header">
              <h3 id="order-summary-title">📋 Order Summary</h3>
              <button 
                className="order-summary-close-btn"
                onClick={() => setShowOrderSummary(false)}
                disabled={payLoading}
              >
                ×
              </button>
            </div>
            
            <div className="order-summary-content">
              {/* Selected Items Display */}
              <div className="selected-items-section">
                <h4>Selected Items ({selectedItems.size})</h4>
                <div className="selected-items-list">
                  {selectedItemsList.map(item => (
                    <div key={item.id} className="selected-item-card">
                      <img 
                        src={getImageUrl(item)} 
                        alt={getProductName(item)} 
                        className="selected-item-image"
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/80?text=No+Image";
                        }}
                      />
                      <div className="selected-item-details">
                        <h5 className="selected-item-name">{getProductName(item)}</h5>
                        <div className="selected-item-meta">
                          <span className="selected-item-quantity">Qty: {quantities[item.id] || item.quantity}</span>
                          <span className="selected-item-price">₱{getProductPrice(item).toLocaleString()} each</span>
                        </div>
                        <div className="selected-item-subtotal">
                          Subtotal: ₱{((getProductPrice(item) * (quantities[item.id] || item.quantity))).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Form */}
              <div className="order-form-section">
                <h4>Order Information</h4>
                
                {/* Address Selection */}
                <div className="address-selection-section">
                  <h4 className="section-title">
                    <i className="fas fa-map-marker-alt"></i>
                    Shipping Address *
                  </h4>
                  
                  <div className="address-form-grid">
                    {/* Province Selection */}
                    <div className="form-group">
                      <label className="form-label">Province *</label>
                      <select 
                        className={`form-control ${provinceError ? 'error' : ''}`}
                        value={selectedProvince}
                        onChange={(e) => handleProvinceChange(e.target.value)}
                        required
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
                      {provinceError && <div className="error-message">{provinceError}</div>}
                    </div>

                    {/* City Selection */}
                    <div className="form-group">
                      <label className="form-label">City/Municipality *</label>
                      <select 
                        className={`form-control ${cityError ? 'error' : ''}`}
                        value={selectedCity}
                        onChange={(e) => handleCityChange(e.target.value)}
                        disabled={!selectedProvince}
                        required
                      >
                        <option value="">Select City</option>
                        {selectedProvince && philippineLocations.cities[selectedProvince]?.map(city => (
                          <option key={city.id} value={city.id}>
                            {city.name}
                          </option>
                        ))}
                      </select>
                      {cityError && <div className="error-message">{cityError}</div>}
                    </div>

                    {/* Barangay Selection */}
                    <div className="form-group">
                      <label className="form-label">Barangay *</label>
                      <select 
                        className={`form-control ${barangayError ? 'error' : ''}`}
                        value={selectedBarangay}
                        onChange={(e) => handleBarangayChange(e.target.value)}
                        disabled={!selectedCity}
                        required
                      >
                        <option value="">Select Barangay</option>
                        {selectedCity && philippineLocations.barangays[selectedCity]?.map(barangay => (
                          <option key={barangay.id} value={barangay.id}>
                            {barangay.name}
                          </option>
                        ))}
                      </select>
                      {barangayError && <div className="error-message">{barangayError}</div>}
                    </div>

                    {/* House/Unit Number */}
                    <div className="form-group">
                      <label className="form-label">House/Unit Number *</label>
                      <input 
                        className={`form-control ${houseUnitError ? 'error' : ''}`}
                        type="text"
                        value={houseUnit}
                        onChange={(e) => handleHouseUnitChange(e.target.value)}
                        placeholder="e.g., 123, Unit 4A, Lot 5"
                        required
                      />
                      {houseUnitError && <div className="error-message">{houseUnitError}</div>}
                    </div>
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    <i className="fas fa-phone"></i>
                    Contact Number *
                  </label>
                  <input 
                    className={`form-control ${phoneError ? 'error' : ''}`}
                    type="tel"
                    value={phone} 
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="09xxxxxxxxx (11 digits)" 
                    maxLength="11"
                    required
                  />
                  {phoneError && <div className="error-message">{phoneError}</div>}
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    <i className="fas fa-credit-card"></i>
                    Payment Method
                  </label>
                  <div className="payment-methods-grid">
                    <label className={`payment-option-card ${paymentMethod === 'cod' ? 'selected' : ''}`}>
                      <input 
                        type="radio" 
                        name="payment" 
                        value="cod" 
                        checked={paymentMethod === 'cod'} 
                        onChange={() => setPaymentMethod('cod')} 
                      />
                      <div className="payment-content">
                        <div className="payment-icon">📦</div>
                        <div className="payment-text">
                          <span className="payment-title">Cash on Delivery</span>
                          <span className="payment-desc">Pay when your order arrives</span>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Order Total */}
              <div className="order-total-section">
                <div className="order-total-card">
                  <h4>Order Total</h4>
                  <div className="total-breakdown">
                    <div className="total-row">
                      <span>Items ({selectedItemsCount}):</span>
                      <span>₱{selectedItemsPrice.toLocaleString()}</span>
                    </div>
                    <div className="total-row">
                      <span>Shipping Fee:</span>
                      <span>
                        {shippingInfo.isFreeShipping ? (
                          <span style={{ color: '#28a745', fontWeight: 600 }}>
                            FREE
                          </span>
                        ) : selectedProvince ? (
                          `₱${shippingInfo.shippingFee.toLocaleString()}`
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
                      <span>Total Amount:</span>
                      <span className="final-amount">₱{totalWithShipping.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="order-summary-footer">
              <button 
                className="btn-cancel-order" 
                onClick={() => setShowOrderSummary(false)} 
                disabled={payLoading}
              >
                Cancel
              </button>
              
                <button 
                  className="btn-place-order btn-wood" 
                  onClick={handleCheckout}
                  disabled={payLoading || !selectedProvince || !selectedCity || !selectedBarangay || !houseUnit.trim() || !phone.trim()}
                >
                {payLoading ? (
                  <>
                    <div className="btn-spinner"></div>
                    Processing Order...
                  </>
                ) : (
                  <>
                    <i className="fas fa-shopping-bag"></i>
                    Place Order • ₱{totalWithShipping.toLocaleString()}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
  
      <style jsx>{`
        /* Modern Cart Container */
        .modern-cart-container {
          padding: 0;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Loading State */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: var(--ink);
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--wood-panel);
          border-top: 3px solid var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        /* Redirecting State */
        .redirecting-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 40px;
          text-align: center;
          color: var(--ink);
          background: linear-gradient(135deg, #e8f5e8, #f0f9ff);
          border-radius: 16px;
          border: 2px solid var(--accent);
          box-shadow: 0 8px 24px rgba(139, 94, 52, 0.1);
        }

        .redirecting-spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(139, 94, 52, 0.2);
          border-top: 4px solid var(--accent);
          border-radius: 50%;
          animation: spin 1.2s linear infinite;
          margin-bottom: 24px;
        }

        .redirecting-state h3 {
          color: var(--accent-dark);
          margin: 0 0 16px 0;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .redirecting-state p {
          color: #666;
          font-size: 1.1rem;
          margin: 0 0 24px 0;
          line-height: 1.5;
        }

        .redirect-tips {
          background: rgba(139, 94, 52, 0.05);
          border: 1px solid rgba(139, 94, 52, 0.2);
          border-radius: 8px;
          padding: 12px 16px;
          color: var(--accent-dark);
          font-size: 0.9rem;
          max-width: 400px;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Cart Header */
        .cart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding: 0 4px;
        }

        .cart-header h3 {
          color: var(--accent-dark);
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .items-count {
          background: var(--accent);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 500;
        }

        /* Enhanced Cart List */
        .enhanced-cart-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 32px;
        }

        .enhanced-cart-item {
          display: flex;
          gap: 16px;
          padding: 16px;
          align-items: center;
          transition: all 0.3s ease;
          border: 2px solid transparent;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #ffffff, #fafafa);
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(139, 94, 52, 0.06);
        }

        .enhanced-cart-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(107, 66, 38, 0.15);
          border-color: var(--accent);
        }

        .enhanced-cart-item.updating {
          opacity: 0.7;
          pointer-events: none;
        }

        .enhanced-cart-item.removing {
          animation: slideOut 0.3s ease-in-out forwards;
        }

        @keyframes slideOut {
          to {
            transform: translateX(-100%);
            opacity: 0;
            height: 0;
            padding: 0;
            margin: 0;
          }
        }

        /* Product Image */
        .item-image-container {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          background: #fafafa;
          border: 2px solid var(--wood-panel);
          flex-shrink: 0;
          width: 120px;
          height: 120px;
          box-shadow: 0 2px 8px rgba(139, 94, 52, 0.1);
        }

        .item-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .enhanced-cart-item:hover .item-image {
          transform: scale(1.05);
        }

        /* Product Details */
        .item-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          padding: 4px 0;
        }

        .item-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--ink);
          margin: 0;
          line-height: 1.3;
        }

        .item-price {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--accent);
          margin: 4px 0;
        }


        /* Quantity Controls */
        .quantity-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          min-width: 80px;
        }

        .quantity-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .quantity-selector {
          display: flex;
          align-items: center;
          background: white;
          border: 2px solid var(--wood-panel);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(139, 94, 52, 0.1);
        }

        .qty-btn {
          background: transparent;
          border: none;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--accent);
          transition: all 0.2s ease;
        }

        .qty-btn:hover:not(:disabled) {
          background: var(--accent);
          color: white;
        }

        .qty-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .qty-display {
          min-width: 48px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-left: 1px solid var(--wood-panel);
          border-right: 1px solid var(--wood-panel);
          background: #fafafa;
        }

        .qty-number {
          font-weight: 600;
          color: var(--ink);
        }
        
        .qty-display-fixed {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
        }
        
        .qty-fixed-label {
          font-size: 12px;
          color: #666;
          font-style: italic;
        }

        .qty-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid var(--wood-panel);
          border-top: 2px solid var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }


        /* Item Actions */
        .item-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 60px;
        }

        .btn-remove-enhanced {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          position: relative;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }


        .btn-remove-enhanced {
          background: #fff5f5;
          color: #dc3545;
          border: 2px solid #f5c6cb;
        }

        .btn-remove-enhanced:hover:not(:disabled) {
          background: #dc3545;
          color: white;
          transform: scale(1.05);
        }

        .btn-remove-enhanced:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .remove-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #f5c6cb;
          border-top: 2px solid #dc3545;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* Empty Cart State */
        .empty-cart-state {
          text-align: center;
          padding: 80px 20px;
          color: var(--ink);
        }

        .empty-cart-icon {
          font-size: 4rem;
          margin-bottom: 20px;
        }

        .empty-cart-state h3 {
          font-size: 1.5rem;
          margin-bottom: 12px;
          color: var(--accent-dark);
        }

        .empty-cart-state p {
          font-size: 1.1rem;
          color: #666;
          margin-bottom: 32px;
        }

        /* Enhanced Summary */
        .enhanced-summary {
          margin-top: 32px;
          padding: 24px;
          max-width: 400px;
          margin-left: auto;
          margin-right: 0;
        }

        .summary-header h3 {
          color: var(--accent-dark);
          margin: 0 0 20px 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .summary-details {
          margin-bottom: 24px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid var(--wood-panel);
        }

        .summary-row:last-child {
          border-bottom: none;
        }

        .delivery-estimate {
          color: #28a745;
          font-weight: 500;
        }

        .summary-divider {
          border: none;
          border-top: 2px solid var(--accent);
          margin: 16px 0;
        }

        .total-row {
          font-size: 1.125rem;
          font-weight: 600;
          border-bottom: none !important;
        }

        .total-amount {
          color: var(--accent);
          font-size: 1.25rem;
        }

        .btn-checkout-enhanced {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px 24px;
          font-size: 1rem;
          font-weight: 600;
          border: none;
          border-radius: 12px;
        }

        /* Enhanced Modal */
        .enhanced-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .enhanced-modal-card {
          width: 96vw;
          max-width: 900px;
          background: #ffffff;
          border: 1px solid #eee;
          border-radius: 14px;
          animation: slideUp 0.22s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(50px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #eee;
        }

        .modal-header h3 {
          margin: 0;
          color: var(--accent-dark);
          font-size: 1.5rem;
        }

        .modal-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: #f8f9fa;
          color: #6c757d;
          font-size: 1.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .modal-close-btn:hover:not(:disabled) {
          background: #e9ecef;
          transform: scale(1.1);
        }

        .modal-content {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        @media (min-width: 768px) {
          .modal-content {
            grid-template-columns: 1.3fr 0.7fr;
            gap: 20px;
            margin-bottom: 16px;
          }
        }

        /* Checkout Summary */
        .checkout-summary {
          padding: 12px;
          background: #fafafa;
          border-radius: 10px;
          border: 1px solid var(--wood-panel);
        }

        .checkout-summary h4 {
          margin: 0 0 8px 0;
          color: var(--accent-dark);
          font-size: 1rem;
        }

        .checkout-items {
          margin-bottom: 8px;
        }

        .checkout-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
        }

        .checkout-item:last-child {
          border-bottom: none;
        }

        .checkout-item-img {
          width: 32px;
          height: 32px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid #dee2e6;
        }

        .checkout-item-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .checkout-item-name {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--ink);
        }

        .checkout-item-qty {
          font-size: 0.75rem;
          color: #666;
        }

        .checkout-item-price {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--accent);
        }

        .checkout-item-more {
          padding: 8px 0;
          font-size: 0.875rem;
          color: #666;
          font-style: italic;
          text-align: center;
        }

        .checkout-total {
          padding-top: 8px;
          border-top: 1px solid var(--wood-panel);
          text-align: right;
        }

        .checkout-total strong {
          color: var(--accent);
          font-size: 1rem;
        }

        /* Checkout Form */
        .checkout-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-weight: 600;
          color: var(--accent-dark);
          font-size: 0.875rem;
        }

        .form-control {
          padding: 10px 12px;
          border: 2px solid var(--wood-panel);
          border-radius: 8px;
          font-size: 0.95rem;
          transition: border-color 0.2s ease;
          background: white;
        }

        .form-control:focus {
          outline: none;
          border-color: var(--accent);
        }

        /* Payment Methods */
        .payment-methods {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          gap: 8px;
        }

        .payment-option {
          display: flex;
          align-items: center;
          padding: 12px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: white;
          flex: 1 1 30%;
          min-width: 180px;
        }

        .payment-option:hover {
          border-color: var(--accent);
          background: #fafafa;
        }

        .payment-option.selected {
          border-color: var(--accent);
          background: rgba(139, 94, 52, 0.05);
          box-shadow: inset 0 0 0 2px var(--accent);
        }

        .payment-option input[type="radio"] {
          margin-right: 12px;
          accent-color: var(--accent);
        }

        .payment-content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .payment-icon {
          font-size: 1.2rem;
        }

        .payment-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .payment-title {
          font-weight: 600;
          color: var(--ink);
          font-size: 0.95rem;
        }

        .payment-desc {
          font-size: 0.8rem;
          color: #666;
        }

        .payment-notice {
          padding: 6px 0;
          background: transparent;
          border: none;
          color: #666;
          font-size: 0.8rem;
        }

        /* Modal Footer */
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding-top: 12px;
          border-top: 1px solid #eee;
        }

        .btn-secondary-enhanced {
          padding: 12px 24px;
          background: #f8f9fa;
          color: #6c757d;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .btn-secondary-enhanced:hover:not(:disabled) {
          background: #e9ecef;
          border-color: #adb5bd;
        }

        .btn-primary-enhanced {
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .btn-primary-enhanced:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* Cart Header Updates */
        .cart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding: 0 4px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .cart-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .cart-header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .selection-controls {
          display: flex;
          gap: 8px;
        }

        .btn-select-all,
        .btn-deselect-all {
          padding: 6px 12px;
          border: 1px solid var(--accent);
          background: white;
          color: var(--accent);
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-select-all:hover:not(:disabled),
        .btn-deselect-all:hover:not(:disabled) {
          background: var(--accent);
          color: white;
        }

        .btn-select-all:disabled,
        .btn-deselect-all:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .selected-info {
          background: var(--accent);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 500;
        }

        /* Item Selection */
        .item-selection {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 60px;
          padding: 12px;
        }

        .selection-checkbox {
          width: 20px;
          height: 20px;
          accent-color: var(--accent);
          cursor: pointer;
          transform: scale(1.1);
        }

        .enhanced-cart-item.selected {
          border-color: var(--accent);
          background: rgba(139, 94, 52, 0.05);
          box-shadow: 0 0 0 2px rgba(139, 94, 52, 0.1);
        }

        .selected-row {
          color: var(--accent);
          font-weight: 600;
        }

        /* Order Summary Modal */
        .order-summary-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          animation: fadeIn 0.3s ease-out;
        }

        .order-summary-modal-card {
          width: 95vw;
          max-width: 1000px;
          max-height: 90vh;
          background: linear-gradient(135deg, #ffffff, #fafafa);
          border: 2px solid var(--accent);
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(139, 94, 52, 0.2);
          animation: slideUp 0.3s ease-out;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .order-summary-header {
          background: linear-gradient(135deg, var(--accent), #8B4513);
          color: white;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .order-summary-header h3 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .order-summary-close-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .order-summary-close-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }

        .order-summary-content {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Selected Items Section */
        .selected-items-section h4 {
          color: var(--accent-dark);
          margin: 0 0 16px 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .selected-items-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .selected-item-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: white;
          border: 2px solid var(--wood-panel);
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .selected-item-card:hover {
          border-color: var(--accent);
          box-shadow: 0 4px 12px rgba(139, 94, 52, 0.1);
        }

        .selected-item-image {
          width: 80px;
          height: 80px;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid var(--wood-panel);
        }

        .selected-item-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .selected-item-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--ink);
          margin: 0;
        }

        .selected-item-meta {
          display: flex;
          gap: 16px;
          font-size: 0.9rem;
          color: #666;
        }

        .selected-item-subtotal {
          font-size: 1rem;
          font-weight: 600;
          color: var(--accent);
        }

        /* Order Form Section */
        .order-form-section h4 {
          color: var(--accent-dark);
          margin: 0 0 16px 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: var(--accent-dark);
          margin-bottom: 8px;
          font-size: 0.95rem;
        }

        .form-label i {
          color: var(--accent);
        }

        .form-control {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid var(--wood-panel);
          border-radius: 10px;
          font-size: 1rem;
          transition: all 0.2s ease;
          background: white;
        }

        .form-control:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(139, 94, 52, 0.1);
        }

        .form-control.error {
          border-color: #dc3545;
          box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
        }

        .error-message {
          color: #dc3545;
          font-size: 0.875rem;
          margin-top: 4px;
          font-weight: 500;
        }

        /* Payment Methods Grid */
        .payment-methods-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .payment-option-card {
          display: flex;
          align-items: center;
          padding: 16px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: white;
        }

        .payment-option-card:hover {
          border-color: var(--accent);
          background: #fafafa;
        }

        .payment-option-card.selected {
          border-color: var(--accent);
          background: rgba(139, 94, 52, 0.05);
          box-shadow: 0 0 0 2px var(--accent);
        }

        .payment-option-card input[type="radio"] {
          margin-right: 12px;
          accent-color: var(--accent);
        }

        /* Order Total Section */
        .order-total-section {
          margin-top: auto;
        }

        .order-total-card {
          background: linear-gradient(135deg, var(--accent), #8B4513);
          color: white;
          padding: 20px;
          border-radius: 12px;
        }

        .order-total-card h4 {
          margin: 0 0 16px 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .total-breakdown {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
        }

        .final-total {
          border-top: 2px solid rgba(255, 255, 255, 0.3);
          font-size: 1.1rem;
          font-weight: 700;
          margin-top: 8px;
        }

        .final-amount {
          font-size: 1.25rem;
          font-weight: 700;
        }

        /* Order Summary Footer */
        .order-summary-footer {
          padding: 20px 24px;
          background: #f8f9fa;
          border-top: 1px solid #dee2e6;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .btn-cancel-order {
          padding: 12px 24px;
          background: #f8f9fa;
          color: #6c757d;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .btn-cancel-order:hover:not(:disabled) {
          background: #e9ecef;
          border-color: #adb5bd;
        }

        .btn-place-order {
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .btn-place-order:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Address Selection Styles */
        .address-selection-section {
          margin-bottom: 24px;
        }

        .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--accent);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .address-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .address-form-grid .form-group:last-child {
          grid-column: 1 / -1;
        }

        .form-control:disabled {
          background-color: #f8f9fa;
          color: #6c757d;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .form-control:disabled::placeholder {
          color: #adb5bd;
        }

        select.form-control {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
          background-position: right 12px center;
          background-repeat: no-repeat;
          background-size: 16px;
          padding-right: 40px;
          appearance: none;
        }

        select.form-control:disabled {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23adb5bd' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .enhanced-cart-item {
            flex-direction: column;
            gap: 12px;
            padding: 16px;
            text-align: center;
          }

          .item-image-container {
            width: 100%;
            height: 200px;
            align-self: center;
            max-width: 300px;
          }

          .item-details {
            order: 2;
          }

          .quantity-controls,
          .item-actions {
            flex-direction: row;
            justify-content: center;
            gap: 12px;
            min-width: auto;
          }

          .item-actions {
            flex-direction: row;
            justify-content: center;
            gap: 12px;
          }

          .item-selection {
            order: -1;
            justify-content: center;
            min-width: auto;
            padding: 6px;
          }

          .modal-content {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .address-form-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .enhanced-summary {
            margin-left: 0;
            margin-right: 0;
            max-width: none;
          }

          .cart-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .cart-header-right {
            width: 100%;
            justify-content: space-between;
          }

          .order-summary-modal-card {
            width: 98vw;
            max-height: 95vh;
          }

          .order-summary-content {
            padding: 16px;
          }

          .selected-item-card {
            flex-direction: column;
            text-align: center;
          }

          .selected-item-image {
            width: 100px;
            height: 100px;
          }

          .payment-methods-grid {
            grid-template-columns: 1fr;
          }

          .order-summary-footer {
            flex-direction: column;
          }

          .btn-cancel-order,
          .btn-place-order {
            width: 100%;
            justify-content: center;
          }
        }

      `}</style>

    </div>
  );
};

export default CartTable;