import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { authUtils } from "../utils/auth";
import "./login.css";

const RegisterModal = ({ onRegisterSuccess, onShowLogin }) => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ 
        name: "", 
        email: "", 
        password: "", 
        confirmPassword: "",
        role: "customer" 
    });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            toast.error("Passwords do not match");
            return;
        }

        // Validate password strength
        if (formData.password.length < 6) {
            setError("Password must be at least 6 characters long");
            setLoading(false);
            toast.error("Password must be at least 6 characters long");
            return;
        }

        // Show loading toast
        toast.loading("Creating your account...", {
            id: "register-loading"
        });

        try {
            const response = await axios.post("http://127.0.0.1:8000/api/register", {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: formData.role
            }, {
                headers: {
                    "Content-Type": "application/json"
                }
            });
            
            // Store authentication data using utility
            authUtils.setAuth(response.data);
            
            setSuccess("Registration successful!");
            
            // Dismiss loading toast and show success
            toast.dismiss("register-loading");
            toast.success("Account created successfully!", {
                description: "Welcome to Unick Furniture! Redirecting to dashboard...",
                duration: 1000
            });
            
            // Immediate redirect without delay
            if (onRegisterSuccess) {
                onRegisterSuccess();
            } else {
                // Force immediate redirect using window.location
                window.location.href = '/dashboard';
            }
            
        } catch (err) {
            // Dismiss loading toast and show error
            toast.dismiss("register-loading");
            const errorMessage = err.response?.data?.message || "Registration failed";
            setError(errorMessage);
            toast.error("Registration failed", {
                description: errorMessage,
                duration: 4000
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowLogin = () => {
        if (onShowLogin) {
            onShowLogin();
        } else {
            navigate("/login");
        }
    };

    return (
        <div className="modal-login-container">
            <div className="wood-login-card">
                <div className="wood-login-visual">
                    <div className="logo-container">
                        <div className="unick-logo">
                            <span className="logo-text">UNICK</span>
                        </div>
                    </div>
                </div>
                <div className="wood-login-form-area">
                    <div className="form-header">
                        <h1 className="brand-name">Unick Furniture</h1>
                        <p className="brand-tagline">Join Our Community</p>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {success && (
                        <div className="success-message">
                            <CheckCircle className="success-icon" size={20} />
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="wood-form">
                        <div className="input-group">
                            <input
                                type="text"
                                name="name"
                                placeholder="Full Name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="wood-input"
                                disabled={loading}
                            />
                        </div>
                        <div className="input-group">
                            <input
                                type="email"
                                name="email"
                                placeholder="Email Address"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="wood-input"
                                disabled={loading}
                            />
                        </div>
                        <div className="input-group">
                            <input
                                type="password"
                                name="password"
                                placeholder="Password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className="wood-input"
                                disabled={loading}
                            />
                        </div>
                        <div className="input-group">
                            <input
                                type="password"
                                name="confirmPassword"
                                placeholder="Confirm Password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                className="wood-input"
                                disabled={loading}
                            />
                        </div>
                        <button 
                            type="submit" 
                            className="wood-button"
                            disabled={loading}
                        >
                            {loading ? "Creating Account..." : "Create Account"}
                        </button>
                        <p className="signup-text">
                            Already have an account?{" "}
                            <button 
                                type="button" 
                                className="signup-link"
                                onClick={handleShowLogin}
                            >
                                Sign In
                            </button>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RegisterModal;
