// src/components/Security/OrderValidation.js
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "../../api/client";

const OrderValidation = ({ orderData, onValidationComplete }) => {
  const [validationResults, setValidationResults] = useState({
    addressValid: false,
    phoneValid: false,
    paymentValid: false,
    inventoryValid: false,
    customerValid: false
  });
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    validateOrder();
  }, [orderData]);

  const validateOrder = async () => {
    try {
      setLoading(true);
      const errors = [];
      const results = { ...validationResults };

      // 1. Address Validation
      const addressValidation = await validateAddress(orderData.shippingAddress);
      if (!addressValidation.valid) {
        errors.push(`Address validation failed: ${addressValidation.error}`);
        results.addressValid = false;
      } else {
        results.addressValid = true;
      }

      // 2. Phone Validation
      const phoneValidation = await validatePhone(orderData.contactPhone);
      if (!phoneValidation.valid) {
        errors.push(`Phone validation failed: ${phoneValidation.error}`);
        results.phoneValid = false;
      } else {
        results.phoneValid = true;
      }

      // 3. Payment Method Validation
      const paymentValidation = await validatePayment(orderData.paymentMethod, orderData.totalAmount);
      if (!paymentValidation.valid) {
        errors.push(`Payment validation failed: ${paymentValidation.error}`);
        results.paymentValid = false;
      } else {
        results.paymentValid = true;
      }

      // 4. Inventory Validation
      const inventoryValidation = await validateInventory(orderData.items);
      if (!inventoryValidation.valid) {
        errors.push(`Inventory validation failed: ${inventoryValidation.error}`);
        results.inventoryValid = false;
      } else {
        results.inventoryValid = true;
      }

      // 5. Customer Validation
      const customerValidation = await validateCustomer(orderData.user);
      if (!customerValidation.valid) {
        errors.push(`Customer validation failed: ${customerValidation.error}`);
        results.customerValid = false;
      } else {
        results.customerValid = true;
      }

      setValidationResults(results);
      setValidationErrors(errors);

      // Check if all validations passed
      const allValid = Object.values(results).every(valid => valid);
      
      if (allValid) {
        onValidationComplete({ valid: true, results, errors: [] });
      } else {
        onValidationComplete({ valid: false, results, errors });
      }

    } catch (error) {
      console.error("Order validation error:", error);
      toast.error("Error validating order");
    } finally {
      setLoading(false);
    }
  };

  const validateAddress = async (address) => {
    try {
      // Check if address is complete
      if (!address || address.length < 10) {
        return { valid: false, error: "Address too short" };
      }

      // Check for suspicious patterns
      const suspiciousPatterns = ['test', 'sample', 'fake', 'dummy'];
      const lowerAddress = address.toLowerCase();
      
      for (const pattern of suspiciousPatterns) {
        if (lowerAddress.includes(pattern)) {
          return { valid: false, error: "Suspicious address detected" };
        }
      }

      // Validate address format (basic check)
      const addressParts = address.split(',');
      if (addressParts.length < 3) {
        return { valid: false, error: "Incomplete address format" };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: "Address validation error" };
    }
  };

  const validatePhone = async (phone) => {
    try {
      // Check phone format
      if (!phone || !phone.startsWith('09') || phone.length !== 11) {
        return { valid: false, error: "Invalid phone number format" };
      }

      // Check if phone is already used by another account
      const response = await api.get(`/auth/check-phone/${phone}`);
      if (response.data.exists && response.data.userId !== orderData.user.id) {
        return { valid: false, error: "Phone number already registered" };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: "Phone validation error" };
    }
  };

  const validatePayment = async (paymentMethod, amount) => {
    try {
      // COD validation for high amounts
      if (paymentMethod === 'cod' && amount > 50000) {
        return { valid: false, error: "COD not allowed for orders over ₱50,000" };
      }

      // Maya validation
      if (paymentMethod === 'maya') {
        // Check if Maya payment is properly configured
        const response = await api.get('/payment/maya/status');
        if (!response.data.available) {
          return { valid: false, error: "Maya payment not available" };
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: "Payment validation error" };
    }
  };

  const validateInventory = async (items) => {
    try {
      for (const item of items) {
        // Check if item exists and is available
        const response = await api.get(`/products/${item.productId}/availability`);
        
        if (!response.data.available) {
          return { valid: false, error: `Product ${item.name} is not available` };
        }

        if (response.data.stock < item.quantity) {
          return { valid: false, error: `Insufficient stock for ${item.name}` };
        }

        // Check if item is not discontinued
        if (response.data.discontinued) {
          return { valid: false, error: `Product ${item.name} is discontinued` };
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: "Inventory validation error" };
    }
  };

  const validateCustomer = async (user) => {
    try {
      // Check if user account is active
      if (!user.active) {
        return { valid: false, error: "Customer account is inactive" };
      }

      // Check if user is verified
      if (!user.verified) {
        return { valid: false, error: "Customer account not verified" };
      }

      // Check for suspicious activity
      if (user.suspiciousActivity) {
        return { valid: false, error: "Customer account flagged for suspicious activity" };
      }

      // Check order limits
      const response = await api.get(`/users/${user.id}/order-limits`);
      if (response.data.exceeded) {
        return { valid: false, error: "Customer has exceeded order limits" };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: "Customer validation error" };
    }
  };

  if (loading) {
    return (
      <div className="order-validation-loading">
        <div className="loading-spinner"></div>
        <p>Validating order...</p>
      </div>
    );
  }

  return (
    <div className="order-validation-container">
      <div className="validation-header">
        <h3>✅ Order Validation</h3>
        <p>Comprehensive order validation results</p>
      </div>

      <div className="validation-results">
        <div className="validation-item">
          <span className="validation-label">Address:</span>
          <span className={`validation-status ${validationResults.addressValid ? 'valid' : 'invalid'}`}>
            {validationResults.addressValid ? '✅ Valid' : '❌ Invalid'}
          </span>
        </div>

        <div className="validation-item">
          <span className="validation-label">Phone:</span>
          <span className={`validation-status ${validationResults.phoneValid ? 'valid' : 'invalid'}`}>
            {validationResults.phoneValid ? '✅ Valid' : '❌ Invalid'}
          </span>
        </div>

        <div className="validation-item">
          <span className="validation-label">Payment:</span>
          <span className={`validation-status ${validationResults.paymentValid ? 'valid' : 'invalid'}`}>
            {validationResults.paymentValid ? '✅ Valid' : '❌ Invalid'}
          </span>
        </div>

        <div className="validation-item">
          <span className="validation-label">Inventory:</span>
          <span className={`validation-status ${validationResults.inventoryValid ? 'valid' : 'invalid'}`}>
            {validationResults.inventoryValid ? '✅ Valid' : '❌ Invalid'}
          </span>
        </div>

        <div className="validation-item">
          <span className="validation-label">Customer:</span>
          <span className={`validation-status ${validationResults.customerValid ? 'valid' : 'invalid'}`}>
            {validationResults.customerValid ? '✅ Valid' : '❌ Invalid'}
          </span>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="validation-errors">
          <h4>❌ Validation Errors:</h4>
          <ul>
            {validationErrors.map((error, index) => (
              <li key={index} className="error-item">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="validation-summary">
        <div className="summary-status">
          {Object.values(validationResults).every(valid => valid) ? (
            <div className="status-success">
              <h4>✅ Order Validated Successfully</h4>
              <p>All validation checks passed. Order can proceed.</p>
            </div>
          ) : (
            <div className="status-error">
              <h4>❌ Validation Failed</h4>
              <p>Please fix the validation errors before proceeding.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderValidation;
