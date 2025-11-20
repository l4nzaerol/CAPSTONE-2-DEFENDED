// src/components/Security/FraudDetection.js
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "../../api/client";

const FraudDetection = ({ orderData, onFraudDetected, onOrderApproved }) => {
  const [fraudScore, setFraudScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState("low");
  const [fraudIndicators, setFraudIndicators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requiresManualReview, setRequiresManualReview] = useState(false);

  useEffect(() => {
    analyzeOrder();
  }, [orderData]);

  const analyzeOrder = async () => {
    try {
      setLoading(true);
      
      // Calculate fraud score based on multiple factors
      let score = 0;
      const indicators = [];

      // 1. New user analysis
      if (orderData.user?.accountAge < 24) {
        score += 30;
        indicators.push("New account (less than 24 hours)");
      }

      // 2. Order value analysis
      if (orderData.totalAmount > 50000) {
        score += 25;
        indicators.push("High-value order");
      }

      // 3. Multiple orders analysis
      if (orderData.user?.recentOrders > 3) {
        score += 20;
        indicators.push("Multiple recent orders");
      }

      // 4. Payment method analysis
      if (orderData.paymentMethod === 'cod' && orderData.totalAmount > 20000) {
        score += 35;
        indicators.push("High-value COD order");
      }

      // 5. Address analysis
      if (orderData.shippingAddress?.includes('test') || 
          orderData.shippingAddress?.includes('sample')) {
        score += 40;
        indicators.push("Suspicious address");
      }

      // 6. Phone number analysis
      if (orderData.contactPhone?.startsWith('09') && 
          orderData.contactPhone?.length === 11) {
        // Valid phone format - no penalty
      } else {
        score += 30;
        indicators.push("Invalid phone number format");
      }

      // 7. Time-based analysis
      const orderHour = new Date().getHours();
      if (orderHour >= 22 || orderHour <= 6) {
        score += 15;
        indicators.push("Order placed during unusual hours");
      }

      // 8. IP address analysis (if available)
      if (orderData.user?.ipAddress) {
        // Check for VPN/Proxy indicators
        if (orderData.user.isVpn || orderData.user.isProxy) {
          score += 25;
          indicators.push("Suspicious IP address (VPN/Proxy detected)");
        }
      }

      // 9. Device fingerprinting
      if (orderData.user?.deviceFingerprint) {
        // Check for suspicious device patterns
        if (orderData.user.suspiciousDevice) {
          score += 20;
          indicators.push("Suspicious device fingerprint");
        }
      }

      // 10. Email domain analysis
      if (orderData.user?.email) {
        const suspiciousDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
        const emailDomain = orderData.user.email.split('@')[1];
        if (suspiciousDomains.includes(emailDomain)) {
          score += 35;
          indicators.push("Suspicious email domain");
        }
      }

      setFraudScore(score);
      setFraudIndicators(indicators);

      // Determine risk level
      if (score >= 70) {
        setRiskLevel("high");
        setRequiresManualReview(true);
        onFraudDetected({
          score,
          level: "high",
          indicators,
          action: "block"
        });
      } else if (score >= 40) {
        setRiskLevel("medium");
        setRequiresManualReview(true);
        onFraudDetected({
          score,
          level: "medium",
          indicators,
          action: "review"
        });
      } else {
        setRiskLevel("low");
        setRequiresManualReview(false);
        onOrderApproved();
      }

    } catch (error) {
      console.error("Fraud detection error:", error);
      toast.error("Error analyzing order for fraud");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = () => {
    switch (riskLevel) {
      case "high": return "#dc3545";
      case "medium": return "#ffc107";
      case "low": return "#28a745";
      default: return "#6c757d";
    }
  };

  const getRiskMessage = () => {
    switch (riskLevel) {
      case "high": return "HIGH RISK - Order blocked";
      case "medium": return "MEDIUM RISK - Manual review required";
      case "low": return "LOW RISK - Order approved";
      default: return "Analyzing...";
    }
  };

  if (loading) {
    return (
      <div className="fraud-detection-loading">
        <div className="loading-spinner"></div>
        <p>Analyzing order for fraud...</p>
      </div>
    );
  }

  return (
    <div className="fraud-detection-container">
      <div className="fraud-header">
        <h3>🛡️ Fraud Detection Analysis</h3>
        <div className="risk-indicator" style={{ color: getRiskColor() }}>
          {getRiskMessage()}
        </div>
      </div>

      <div className="fraud-score">
        <div className="score-display">
          <span className="score-label">Fraud Score:</span>
          <span className="score-value" style={{ color: getRiskColor() }}>
            {fraudScore}/100
          </span>
        </div>
        <div className="score-bar">
          <div 
            className="score-fill" 
            style={{ 
              width: `${fraudScore}%`,
              backgroundColor: getRiskColor()
            }}
          ></div>
        </div>
      </div>

      {fraudIndicators.length > 0 && (
        <div className="fraud-indicators">
          <h4>Risk Indicators:</h4>
          <ul>
            {fraudIndicators.map((indicator, index) => (
              <li key={index} className="indicator-item">
                ⚠️ {indicator}
              </li>
            ))}
          </ul>
        </div>
      )}

      {requiresManualReview && (
        <div className="manual-review-notice">
          <h4>🔍 Manual Review Required</h4>
          <p>This order requires manual review before processing.</p>
          <div className="review-actions">
            <button 
              className="btn-approve"
              onClick={() => onOrderApproved()}
            >
              Approve Order
            </button>
            <button 
              className="btn-reject"
              onClick={() => onFraudDetected({
                score: fraudScore,
                level: riskLevel,
                indicators: fraudIndicators,
                action: "reject"
              })}
            >
              Reject Order
            </button>
          </div>
        </div>
      )}

      <div className="fraud-prevention-tips">
        <h4>💡 Fraud Prevention Tips:</h4>
        <ul>
          <li>Verify customer identity before processing high-value orders</li>
          <li>Check delivery address against customer's registered address</li>
          <li>Contact customer directly for orders over ₱20,000</li>
          <li>Monitor for multiple orders from same address</li>
          <li>Verify payment method authenticity</li>
        </ul>
      </div>
    </div>
  );
};

export default FraudDetection;
