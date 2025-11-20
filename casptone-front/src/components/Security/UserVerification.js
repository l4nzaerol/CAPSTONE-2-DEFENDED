// src/components/Security/UserVerification.js
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "../../api/client";

const UserVerification = ({ user, onVerificationComplete }) => {
  const [verificationStep, setVerificationStep] = useState(1);
  const [verificationData, setVerificationData] = useState({
    phoneVerified: false,
    emailVerified: false,
    identityVerified: false,
    addressVerified: false
  });
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const [maxAttempts] = useState(3);

  // Phone verification
  const sendPhoneOTP = async () => {
    try {
      setLoading(true);
      const response = await api.post("/auth/send-phone-otp", {
        phone: user.phone
      });
      
      if (response.data.success) {
        toast.success("OTP sent to your phone number");
        setVerificationStep(2);
      } else {
        toast.error("Failed to send OTP. Please try again.");
      }
    } catch (error) {
      toast.error("Error sending OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Email verification
  const sendEmailVerification = async () => {
    try {
      setLoading(true);
      const response = await api.post("/auth/send-email-verification", {
        email: user.email
      });
      
      if (response.data.success) {
        toast.success("Verification email sent");
        setVerificationStep(3);
      } else {
        toast.error("Failed to send verification email");
      }
    } catch (error) {
      toast.error("Error sending verification email");
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const verifyOTP = async () => {
    if (verificationAttempts >= maxAttempts) {
      toast.error("Maximum verification attempts reached. Please contact support.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/auth/verify-phone-otp", {
        phone: user.phone,
        otp: otpCode
      });
      
      if (response.data.success) {
        setVerificationData(prev => ({ ...prev, phoneVerified: true }));
        toast.success("Phone number verified successfully");
        setVerificationStep(3);
        setOtpCode("");
      } else {
        setVerificationAttempts(prev => prev + 1);
        toast.error(`Invalid OTP. ${maxAttempts - verificationAttempts - 1} attempts remaining`);
        setOtpCode("");
      }
    } catch (error) {
      setVerificationAttempts(prev => prev + 1);
      toast.error("Error verifying OTP");
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  };

  // Identity verification
  const submitIdentityVerification = async (formData) => {
    try {
      setLoading(true);
      const response = await api.post("/auth/verify-identity", formData);
      
      if (response.data.success) {
        setVerificationData(prev => ({ ...prev, identityVerified: true }));
        toast.success("Identity verification submitted for review");
        setVerificationStep(4);
      } else {
        toast.error("Failed to submit identity verification");
      }
    } catch (error) {
      toast.error("Error submitting identity verification");
    } finally {
      setLoading(false);
    }
  };

  // Address verification
  const verifyAddress = async (addressData) => {
    try {
      setLoading(true);
      const response = await api.post("/auth/verify-address", addressData);
      
      if (response.data.success) {
        setVerificationData(prev => ({ ...prev, addressVerified: true }));
        toast.success("Address verified successfully");
        onVerificationComplete(verificationData);
      } else {
        toast.error("Address verification failed");
      }
    } catch (error) {
      toast.error("Error verifying address");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verification-container">
      <div className="verification-header">
        <h2>Account Verification</h2>
        <p>Complete verification to secure your account and enable ordering</p>
      </div>

      <div className="verification-steps">
        {/* Step 1: Phone Verification */}
        {verificationStep === 1 && (
          <div className="verification-step">
            <h3>📱 Phone Verification</h3>
            <p>Verify your phone number to secure your account</p>
            <button 
              className="btn-verify" 
              onClick={sendPhoneOTP}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </div>
        )}

        {/* Step 2: OTP Verification */}
        {verificationStep === 2 && (
          <div className="verification-step">
            <h3>🔐 Enter OTP Code</h3>
            <p>Enter the 6-digit code sent to {user.phone}</p>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Enter OTP"
              maxLength="6"
              className="otp-input"
            />
            <button 
              className="btn-verify" 
              onClick={verifyOTP}
              disabled={loading || otpCode.length !== 6}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button 
              className="btn-resend" 
              onClick={sendPhoneOTP}
              disabled={loading}
            >
              Resend OTP
            </button>
          </div>
        )}

        {/* Step 3: Email Verification */}
        {verificationStep === 3 && (
          <div className="verification-step">
            <h3>📧 Email Verification</h3>
            <p>Verify your email address</p>
            <button 
              className="btn-verify" 
              onClick={sendEmailVerification}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Verification Email"}
            </button>
          </div>
        )}

        {/* Step 4: Identity Verification */}
        {verificationStep === 4 && (
          <div className="verification-step">
            <h3>🆔 Identity Verification</h3>
            <p>Upload a valid ID for identity verification</p>
            <IdentityVerificationForm onSubmit={submitIdentityVerification} />
          </div>
        )}

        {/* Step 5: Address Verification */}
        {verificationStep === 5 && (
          <div className="verification-step">
            <h3>🏠 Address Verification</h3>
            <p>Verify your delivery address</p>
            <AddressVerificationForm onSubmit={verifyAddress} />
          </div>
        )}
      </div>

      <div className="verification-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(verificationStep / 5) * 100}%` }}
          ></div>
        </div>
        <p>Step {verificationStep} of 5</p>
      </div>
    </div>
  );
};

// Identity Verification Form Component
const IdentityVerificationForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    idType: "",
    idNumber: "",
    idImage: null,
    selfieImage: null
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="identity-form">
      <div className="form-group">
        <label>ID Type</label>
        <select 
          value={formData.idType}
          onChange={(e) => setFormData(prev => ({ ...prev, idType: e.target.value }))}
          required
        >
          <option value="">Select ID Type</option>
          <option value="drivers-license">Driver's License</option>
          <option value="passport">Passport</option>
          <option value="national-id">National ID</option>
          <option value="voters-id">Voter's ID</option>
          <option value="postal-id">Postal ID</option>
        </select>
      </div>

      <div className="form-group">
        <label>ID Number</label>
        <input
          type="text"
          value={formData.idNumber}
          onChange={(e) => setFormData(prev => ({ ...prev, idNumber: e.target.value }))}
          placeholder="Enter ID number"
          required
        />
      </div>

      <div className="form-group">
        <label>ID Photo</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFormData(prev => ({ ...prev, idImage: e.target.files[0] }))}
          required
        />
      </div>

      <div className="form-group">
        <label>Selfie with ID</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFormData(prev => ({ ...prev, selfieImage: e.target.files[0] }))}
          required
        />
      </div>

      <button type="submit" className="btn-submit">Submit for Verification</button>
    </form>
  );
};

// Address Verification Form Component
const AddressVerificationForm = ({ onSubmit }) => {
  const [addressData, setAddressData] = useState({
    address: "",
    proofOfAddress: null
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(addressData);
  };

  return (
    <form onSubmit={handleSubmit} className="address-form">
      <div className="form-group">
        <label>Delivery Address</label>
        <textarea
          value={addressData.address}
          onChange={(e) => setAddressData(prev => ({ ...prev, address: e.target.value }))}
          placeholder="Enter your complete delivery address"
          required
        />
      </div>

      <div className="form-group">
        <label>Proof of Address (Utility Bill, Bank Statement, etc.)</label>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setAddressData(prev => ({ ...prev, proofOfAddress: e.target.files[0] }))}
          required
        />
      </div>

      <button type="submit" className="btn-submit">Verify Address</button>
    </form>
  );
};

export default UserVerification;
