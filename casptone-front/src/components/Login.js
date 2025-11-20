import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { authUtils } from "../utils/auth";
import "./login.css";

const Login = ({ onLoginSuccess, onShowRegister }) => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        
        // Show loading toast
        toast.loading("Signing you in...", {
            id: "login-loading"
        });
        
        try {
            const response = await axios.post("http://127.0.0.1:8000/api/login", formData);
            
            // Store authentication data using utility
            authUtils.setAuth(response.data);
            
            // Dismiss loading toast and show success
            toast.dismiss("login-loading");
            toast.success("Welcome back!", {
                description: "Redirecting to your dashboard...",
                duration: 1000
            });
            
            // Immediate redirect without delay
            if (onLoginSuccess) {
                onLoginSuccess();
            } else {
                // Force immediate redirect using window.location
                window.location.href = '/dashboard';
            }
            
        } catch (err) {
            // Dismiss loading toast and show error
            toast.dismiss("login-loading");
            const errorMessage = err.response?.data?.message || "Login failed";
            setError(errorMessage);
            toast.error("Login failed", {
                description: errorMessage,
                duration: 4000
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowRegister = () => {
        if (onShowRegister) {
            onShowRegister();
        } else {
            navigate("/register");
        }
    };

    return (
        <div className={onLoginSuccess ? "modal-login-container" : "wood-login-container"}>
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
                        <p className="brand-tagline">Crafting Quality Every Day</p>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <form onSubmit={handleSubmit} className="wood-form">
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
                        <button 
                            type="submit" 
                            className="wood-button"
                            disabled={loading}
                        >
                            {loading ? "Signing In..." : "Sign In"}
                        </button>
                        <p className="signup-text">
                            Don't have an account?{" "}
                            <button 
                                type="button" 
                                className="signup-link"
                                onClick={handleShowRegister}
                            >
                                Sign Up
                            </button>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;