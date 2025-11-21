import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../Header";
import EnhancedInventoryReports from "./EnhancedInventoryReports";
import ProductionReports from "./ProductionReports";
import SalesAnalytics from "./SalesAnalytics";

// Simple CSS for clean white theme
const simpleStyles = `
    .nav-tabs .nav-link {
        border: none;
        border-bottom: 3px solid transparent;
        transition: all 0.3s ease;
    }
    
    .nav-tabs .nav-link.active {
        border-bottom: 3px solid #007bff;
        background-color: #007bff;
        color: white;
    }
    
    .nav-tabs .nav-link:hover {
        border-bottom: 3px solid #0056b3;
        background-color: #f8f9fa;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = simpleStyles;
    document.head.appendChild(styleSheet);
}

const Report = () => {
    const navigate = useNavigate();
    const [activeReport, setActiveReport] = useState("inventory");
    const [dataLoading, setDataLoading] = useState(true);

    const reportTabs = [
        { 
            id: "inventory", 
            name: "Inventory Reports", 
            icon: "📊",
            description: "Predictive analytics for material usage and inventory management"
        },
        { 
            id: "production", 
            name: "Production Reports", 
            icon: "🏭",
            description: "Advanced performance metrics and production analytics"
        },
        { 
            id: "sales", 
            name: "Sales Reports", 
            icon: "💰",
            description: "Revenue analysis and customer behavior insights"
        }
    ];


    useEffect(() => {
        // Simulate data loading
        const timer = setTimeout(() => {
            setDataLoading(false);
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <AppLayout>
            <div className="container-fluid py-4">
                {/* Header */}
                <div className="row mb-4">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                            <div className="card-body p-4">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h2 className="mb-1 fw-bold">Reports & Analytics</h2>
                                        <p className="text-muted mb-0">Comprehensive reporting and predictive analytics</p>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <button className="btn btn-light" onClick={() => navigate("/dashboard")} style={{ borderRadius: '8px' }}>
                                            <i className="fas fa-arrow-left me-2"></i>
                                            Dashboard
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="row mb-4">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                            <div className="card-body p-0">
                                <div className="d-flex" style={{ borderBottom: '2px solid #dee2e6' }}>
                                    {reportTabs.map((tab) => {
                                        let activeColor = '';
                                        let inactiveColor = '#6c757d';
                                        
                                        if (tab.id === 'inventory') {
                                            activeColor = '#0dcaf0';
                                        } else if (tab.id === 'production') {
                                            activeColor = '#198754';
                                        } else if (tab.id === 'sales') {
                                            activeColor = '#ffc107';
                                        }
                                        
                                        return (
                                            <button 
                                                key={tab.id}
                                                className={`btn btn-lg flex-fill ${activeReport === tab.id ? `text-${activeColor === '#0dcaf0' ? 'info' : activeColor === '#198754' ? 'success' : 'warning'} fw-bold` : 'text-dark'} border-0 py-3`}
                                                onClick={() => setActiveReport(tab.id)}
                                                style={{ 
                                                    borderBottom: activeReport === tab.id ? `3px solid ${activeColor}` : 'none',
                                                    marginBottom: activeReport === tab.id ? '-2px' : '0',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            >
                                                <i className={`fas fa-${tab.id === 'inventory' ? 'boxes' : tab.id === 'production' ? 'industry' : 'chart-bar'} me-2`} style={{ color: activeReport === tab.id ? activeColor : inactiveColor, fontSize: '18px' }}></i>
                                                {tab.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Report Content */}
                <div className="row">
                    <div className="col-12">
                        {dataLoading ? (
                            <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                <div className="card-body text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Loading reports...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {activeReport === 'inventory' && <EnhancedInventoryReports />}
                                {activeReport === 'production' && <ProductionReports />}
                                {activeReport === 'sales' && <SalesAnalytics />}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default Report;