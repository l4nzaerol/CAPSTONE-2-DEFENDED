import React, { useEffect, useState, useCallback } from "react";
import api from "../../api/client";
import { 
  BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, 
  ScatterChart, Scatter, ComposedChart
} from "recharts";
import { 
  FaDollarSign, FaChartLine, FaShoppingCart, FaUsers, 
  FaBoxes, FaClipboardList, FaHistory, FaExclamationTriangle,
  FaDownload, FaSync, FaFilter, FaSearch, FaEye, FaEdit,
  FaChartBar, FaArrowUp, FaPercent, FaCreditCard
} from "react-icons/fa";
import { toast } from "sonner";

const SalesAnalytics = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("overview");
    const [windowDays, setWindowDays] = useState(30);
    const [refreshKey, setRefreshKey] = useState(0);
    
    // Enhanced data states
    const [dashboardData, setDashboardData] = useState(null);
    const [salesReports, setSalesReports] = useState(null);
    const [orders, setOrders] = useState([]);
    
    // Loading states for each tab
    const [tabLoadingStates, setTabLoadingStates] = useState({
        overview: false,
        reports: false
    });

    const colors = {
        primary: '#8B4513',
        secondary: '#A0522D',
        accent: '#CD853F',
        success: '#28a745',
        warning: '#ffc107',
        danger: '#dc3545',
        info: '#17a2b8',
        light: '#F5DEB3',
        dark: '#2F1B14'
    };

    const chartColors = [
        '#8B4513', '#A0522D', '#CD853F', '#F5DEB3', '#D2691E',
        '#B8860B', '#DAA520', '#B22222', '#228B22', '#4169E1'
    ];

    const fetchAllReports = useCallback(async () => {
        setLoading(true);
        setError("");
        
        try {
            const dateRange = {
                start_date: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0]
            };

            const safeFetch = async (endpoint, params = {}) => {
                try {
                    const response = await api.get(endpoint, { params });
                    return response.data;
                } catch (error) {
                    console.warn(`Failed to fetch ${endpoint}:`, error.message);
                    return null;
                }
            };

            // Only load overview data initially for fast loading
            const salesAnalyticsData = await safeFetch('/analytics/sales-dashboard', dateRange);
            
            // Fetch all orders - ensure we always get orders data
            let ordersData = await safeFetch('/orders', {});
            
            // If ordersData is null or not an array, set to empty array
            if (!ordersData || !Array.isArray(ordersData)) {
                ordersData = [];
            }
            
            // Filter to only show accepted orders for sales reports
            const acceptedOrders = ordersData.filter(order => 
                order.acceptance_status === 'accepted' && order.accepted_at
            );
            
            console.log('Fetched orders:', ordersData);
            console.log('Total orders:', ordersData.length);
            console.log('Accepted orders:', acceptedOrders.length);
            console.log('Orders is array?', Array.isArray(ordersData));

            // Set data with proper fallbacks - using zero values since no actual records exist
            const analyticsData = salesAnalyticsData || { 
                overview: {
                    total_revenue: 0,
                    total_orders: 0,
                    paid_orders: 0,
                    pending_orders: 0,
                    average_order_value: 0,
                    conversion_rate: 0
                },
                revenue_trends: [],
                top_products: [],
                sales_by_status: [],
                payment_method_analysis: [],
                customer_analysis: {
                    new_customers: 0,
                    returning_customers: 0,
                    total_customers: 0,
                    avg_lifetime_value: 0
                },
                monthly_comparison: {
                    current_month: { revenue: 0, orders: 0 },
                    last_month: { revenue: 0, orders: 0 },
                    growth: { revenue_growth: 0, orders_growth: 0 }
                }
            };
            
            setDashboardData(analyticsData);
            setOrders(acceptedOrders);

        } catch (error) {
            console.error('Error fetching sales analytics:', error);
            setError('Failed to load sales analytics. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [windowDays, refreshKey]);

    useEffect(() => {
        fetchAllReports();
    }, [fetchAllReports]);

    // Load orders when overview tab is active (but avoid infinite loop)
    useEffect(() => {
        if (activeTab === 'overview' && !loading && orders.length === 0) {
            // Only load if we don't have orders yet
            const fetchOrders = async () => {
                try {
                    const response = await api.get('/orders');
                    if (response.data && Array.isArray(response.data)) {
                        // Filter to only show accepted orders
                        const acceptedOrders = response.data.filter(order => 
                            order.acceptance_status === 'accepted' && order.accepted_at
                        );
                        setOrders(acceptedOrders);
                        console.log('Loaded accepted orders on overview tab:', acceptedOrders.length, 'out of', response.data.length, 'total');
                    }
                } catch (error) {
                    console.error('Error fetching orders:', error);
                }
            };
            fetchOrders();
        }
    }, [activeTab, loading]);

    const handleGlobalRefresh = () => {
        setRefreshKey(prev => prev + 1);
        toast.success("Sales analytics refreshed successfully!");
    };

    // Lazy loading function for each tab
    const loadTabData = async (tabName) => {
        setTabLoadingStates(prev => ({ ...prev, [tabName]: true }));
        
        try {
            const dateRange = {
                start_date: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0]
            };

            const safeFetch = async (endpoint, params = {}) => {
                try {
                    const response = await api.get(endpoint, { params });
                    return response.data;
                } catch (error) {
                    console.warn(`Failed to fetch ${endpoint}:`, error.message);
                    return null;
                }
            };

            switch (tabName) {
                case 'overview':
                    // Overview data is already loaded initially, but refresh orders
                    const overviewOrdersData = await safeFetch('/orders', {});
                    if (overviewOrdersData && Array.isArray(overviewOrdersData)) {
                        // Filter to only show accepted orders
                        const acceptedOrders = overviewOrdersData.filter(order => 
                            order.acceptance_status === 'accepted' && order.accepted_at
                        );
                        setOrders(acceptedOrders);
                        console.log('Overview: Loaded', acceptedOrders.length, 'accepted orders out of', overviewOrdersData.length, 'total orders');
                    } else {
                        setOrders([]);
                    }
                    break;
                    
                case 'reports':
                    // Fetch sales dashboard data for reports tab (same as overview)
                    const reportsDashboardData = await safeFetch('/analytics/sales-dashboard', dateRange);
                    const reportsOrdersData = await safeFetch('/orders', {});
                    
                    setSalesReports(reportsDashboardData || dashboardData);
                    if (reportsOrdersData && Array.isArray(reportsOrdersData)) {
                        // Filter to only show accepted orders
                        const acceptedOrders = reportsOrdersData.filter(order => 
                            order.acceptance_status === 'accepted' && order.accepted_at
                        );
                        setOrders(acceptedOrders);
                        console.log('Reports: Loaded', acceptedOrders.length, 'accepted orders out of', reportsOrdersData.length, 'total orders');
                    } else {
                        setOrders([]);
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error loading ${tabName} data:`, error);
        } finally {
            setTabLoadingStates(prev => ({ ...prev, [tabName]: false }));
        }
    };

    // Handle tab change with lazy loading
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        loadTabData(tabId);
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <h5>Loading Sales Analytics...</h5>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-danger" role="alert">
                <FaExclamationTriangle className="me-2" />
                <strong>Error:</strong> {error}
                <button 
                    className="btn btn-outline-danger btn-sm ms-3"
                    onClick={handleGlobalRefresh}
                >
                    <FaSync className="me-1" />
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="enhanced-sales-analytics">
            {/* Enhanced Navigation Tabs */}
            <div className="mb-4">
                <ul className="nav nav-pills nav-fill" role="tablist">
                    {[
                        { id: 'overview', name: 'Overview', icon: FaChartLine, color: colors.primary },
                        { id: 'reports', name: 'Sales Reports', icon: FaClipboardList, color: colors.dark }
                    ].map(tab => (
                        <li className="nav-item" key={tab.id}>
                            <button
                                className={`nav-link d-flex align-items-center justify-content-center ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => handleTabChange(tab.id)}
                                disabled={tabLoadingStates[tab.id]}
                                style={{
                                    border: 'none',
                                    backgroundColor: activeTab === tab.id ? tab.color : 'transparent',
                                    color: activeTab === tab.id ? 'white' : colors.dark,
                                    fontWeight: activeTab === tab.id ? '600' : '400',
                                    borderRadius: '8px',
                                    margin: '0 2px',
                                    padding: '12px 16px',
                                    transition: 'all 0.3s ease',
                                    opacity: tabLoadingStates[tab.id] ? 0.6 : 1
                                }}
                            >
                                <tab.icon className="me-2" />
                                {tab.name}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'overview' && (
                <div className="row">
                    {/* Key Metrics Cards */}
                    <div className="col-lg-3 col-md-6 mb-4">
                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.success}15, ${colors.info}15)` }}>
                            <div className="card-body text-center p-4">
                                <div className="d-flex align-items-center justify-content-center mb-3">
                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.success}20` }}>
                                        <FaDollarSign style={{ color: colors.success }} className="fs-4" />
                                        </div>
                                        <div>
                                        <h3 className="mb-0 fw-bold" style={{ color: colors.success }}>
                                            ₱{dashboardData?.overview?.total_revenue?.toLocaleString() || '0'}
                                        </h3>
                                        <small className="text-muted fw-medium">Total Revenue</small>
                                    </div>
                                </div>
                                <p className="text-muted small mb-0">
                                    This period
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-3 col-md-6 mb-4">
                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.primary}15, ${colors.accent}15)` }}>
                            <div className="card-body text-center p-4">
                                <div className="d-flex align-items-center justify-content-center mb-3">
                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.primary}20` }}>
                                        <FaShoppingCart style={{ color: colors.primary }} className="fs-4" />
                                        </div>
                                        <div>
                                        <h3 className="mb-0 fw-bold" style={{ color: colors.primary }}>
                                            {dashboardData?.overview?.total_orders || 0}
                                        </h3>
                                        <small className="text-muted fw-medium">Total Orders</small>
                                    </div>
                                </div>
                                <p className="text-muted small mb-0">
                                    Orders placed
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-3 col-md-6 mb-4">
                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.info}15, ${colors.secondary}15)` }}>
                            <div className="card-body text-center p-4">
                                <div className="d-flex align-items-center justify-content-center mb-3">
                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.info}20` }}>
                                        <FaChartBar style={{ color: colors.info }} className="fs-4" />
                                        </div>
                                        <div>
                                        <h3 className="mb-0 fw-bold" style={{ color: colors.info }}>
                                            ₱{dashboardData?.overview?.average_order_value?.toLocaleString() || '0'}
                                        </h3>
                                        <small className="text-muted fw-medium">Avg Order Value</small>
                                    </div>
                                </div>
                                <p className="text-muted small mb-0">
                                    Per order
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-3 col-md-6 mb-4">
                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.warning}15, ${colors.accent}15)` }}>
                            <div className="card-body text-center p-4">
                                <div className="d-flex align-items-center justify-content-center mb-3">
                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.warning}20` }}>
                                        <FaPercent style={{ color: colors.warning }} className="fs-4" />
                                        </div>
                                        <div>
                                        <h3 className="mb-0 fw-bold" style={{ color: colors.warning }}>
                                            {dashboardData?.overview?.conversion_rate || 0}%
                                        </h3>
                                        <small className="text-muted fw-medium">Conversion Rate</small>
                                    </div>
                                </div>
                                <p className="text-muted small mb-0">
                                    Visitor to customer
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Additional Metrics Row */}
                    <div className="col-lg-3 col-md-6 mb-4">
                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.danger}15, ${colors.warning}15)` }}>
                            <div className="card-body text-center p-4">
                                <div className="d-flex align-items-center justify-content-center mb-3">
                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.danger}20` }}>
                                        <FaUsers style={{ color: colors.danger }} className="fs-4" />
                                    </div>
                                    <div>
                                        <h3 className="mb-0 fw-bold" style={{ color: colors.danger }}>
                                            {dashboardData?.customer_analysis?.total_customers || 0}
                                        </h3>
                                        <small className="text-muted fw-medium">Total Customers</small>
                                    </div>
                                </div>
                                <p className="text-muted small mb-0">
                                    {dashboardData?.customer_analysis?.new_customers || 0} new, {dashboardData?.customer_analysis?.returning_customers || 0} returning
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-3 col-md-6 mb-4">
                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.info}15, ${colors.primary}15)` }}>
                            <div className="card-body text-center p-4">
                                <div className="d-flex align-items-center justify-content-center mb-3">
                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.info}20` }}>
                                        <FaCreditCard style={{ color: colors.info }} className="fs-4" />
                                    </div>
                                    <div>
                                        <h3 className="mb-0 fw-bold" style={{ color: colors.info }}>
                                            {dashboardData?.overview?.paid_orders || 0}
                                        </h3>
                                        <small className="text-muted fw-medium">Paid Orders</small>
                                    </div>
                                </div>
                                <p className="text-muted small mb-0">
                                    {dashboardData?.overview?.pending_orders || 0} pending
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-3 col-md-6 mb-4">
                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.accent}15, ${colors.secondary}15)` }}>
                            <div className="card-body text-center p-4">
                                <div className="d-flex align-items-center justify-content-center mb-3">
                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.accent}20` }}>
                                        <FaArrowUp style={{ color: colors.accent }} className="fs-4" />
                                    </div>
                                    <div>
                                        <h3 className="mb-0 fw-bold" style={{ color: colors.accent }}>
                                            {dashboardData?.monthly_comparison?.growth?.revenue_growth || 0}%
                                        </h3>
                                        <small className="text-muted fw-medium">Revenue Growth</small>
                                    </div>
                                </div>
                                <p className="text-muted small mb-0">
                                    vs last month
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-3 col-md-6 mb-4">
                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.dark}15, ${colors.primary}15)` }}>
                            <div className="card-body text-center p-4">
                                <div className="d-flex align-items-center justify-content-center mb-3">
                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.dark}20` }}>
                                        <FaDollarSign style={{ color: colors.dark }} className="fs-4" />
                                    </div>
                                    <div>
                                        <h3 className="mb-0 fw-bold" style={{ color: colors.dark }}>
                                            ₱{dashboardData?.customer_analysis?.avg_lifetime_value?.toLocaleString() || '0'}
                                        </h3>
                                        <small className="text-muted fw-medium">Avg Customer Value</small>
                                    </div>
                                </div>
                                <p className="text-muted small mb-0">
                                    Lifetime value
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="col-lg-8 mb-4">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaChartLine className="me-2" style={{ color: colors.primary }} />
                                    Revenue Trends Overview
                                </h5>
                            </div>
                            <div className="card-body">
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={dashboardData?.revenue_trends || []}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis />
                                        <Tooltip formatter={(value) => [`₱${value.toLocaleString()}`, 'Revenue']} />
                                        <Legend />
                                        <Line type="monotone" dataKey="revenue" stroke={colors.success} name="Daily Revenue" />
                                        <Line type="monotone" dataKey="orders" stroke={colors.primary} name="Orders" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Sales Status Chart */}
                    <div className="col-lg-4 mb-4">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaChartBar className="me-2" style={{ color: colors.secondary }} />
                                    Sales by Status
                                </h5>
                            </div>
                            <div className="card-body">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={dashboardData?.sales_by_status || []}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="count"
                                        >
                                            {(dashboardData?.sales_by_status || []).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Payment Method Analysis */}
                    <div className="col-lg-6 mb-4">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaCreditCard className="me-2" style={{ color: colors.warning }} />
                                    Payment Methods
                                </h5>
                            </div>
                            <div className="card-body">
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={dashboardData?.payment_method_analysis || []}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="payment_method" />
                                        <YAxis />
                                        <Tooltip formatter={(value) => [`₱${value.toLocaleString()}`, 'Revenue']} />
                                        <Legend />
                                        <Bar dataKey="revenue" fill={colors.warning} name="Revenue" />
                                        <Bar dataKey="count" fill={colors.accent} name="Order Count" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Monthly Comparison */}
                    <div className="col-lg-6 mb-4">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaArrowUp className="me-2" style={{ color: colors.danger }} />
                                    Monthly Comparison
                                </h5>
                            </div>
                            <div className="card-body">
                                <div className="row">
                                    <div className="col-6 text-center">
                                        <h6 className="text-muted mb-2">Current Month</h6>
                                        <h4 className="text-success mb-1">
                                            ₱{dashboardData?.monthly_comparison?.current_month?.revenue?.toLocaleString() || '0'}
                                        </h4>
                                        <small className="text-muted">
                                            {dashboardData?.monthly_comparison?.current_month?.orders || 0} orders
                                        </small>
                                    </div>
                                    <div className="col-6 text-center">
                                        <h6 className="text-muted mb-2">Last Month</h6>
                                        <h4 className="text-primary mb-1">
                                            ₱{dashboardData?.monthly_comparison?.last_month?.revenue?.toLocaleString() || '0'}
                                        </h4>
                                        <small className="text-muted">
                                            {dashboardData?.monthly_comparison?.last_month?.orders || 0} orders
                                        </small>
                                    </div>
                                </div>
                                <hr />
                                <div className="row">
                                    <div className="col-6 text-center">
                                        <h6 className="text-muted mb-2">Revenue Growth</h6>
                                        <h4 className={`mb-0 ${(dashboardData?.monthly_comparison?.growth?.revenue_growth || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {dashboardData?.monthly_comparison?.growth?.revenue_growth || 0}%
                                        </h4>
                                    </div>
                                    <div className="col-6 text-center">
                                        <h6 className="text-muted mb-2">Order Growth</h6>
                                        <h4 className={`mb-0 ${(dashboardData?.monthly_comparison?.growth?.orders_growth || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {dashboardData?.monthly_comparison?.growth?.orders_growth || 0}%
                                        </h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Products */}
                    <div className="col-12 mb-4">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaBoxes className="me-2" style={{ color: colors.secondary }} />
                                    Top Performing Products
                                </h5>
                            </div>
                            <div className="card-body">
                                {dashboardData?.top_products && dashboardData.top_products.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={dashboardData.top_products}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip formatter={(value) => [`₱${value.toLocaleString()}`, 'Revenue']} />
                                            <Legend />
                                            <Bar dataKey="total_revenue" fill={colors.primary} name="Revenue" />
                                            <Bar dataKey="total_quantity" fill={colors.accent} name="Quantity Sold" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="text-center py-5">
                                        <FaBoxes className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                        <h5 className="text-muted">No Product Sales Data</h5>
                                        <p className="text-muted">Product performance data will appear here when orders are placed</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* All Orders Table */}
                    <div className="col-12">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaShoppingCart className="me-2" style={{ color: colors.primary }} />
                                    All Orders
                                </h5>
                                <span className="badge bg-primary">
                                    {Array.isArray(orders) ? orders.length : 0} {orders.length === 1 ? 'Order' : 'Orders'}
                                </span>
                            </div>
                            <div className="card-body">
                                {Array.isArray(orders) && orders.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="table table-hover">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Order ID</th>
                                                    <th>Customer</th>
                                                    <th>Date</th>
                                                    <th>Status</th>
                                                    <th>Payment Status</th>
                                                    <th>Total Amount</th>
                                                    <th>Items</th>
                                                    <th>Payment Method</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {orders.map((order) => (
                                                    <tr key={order.id}>
                                                        <td><strong>#{order.id}</strong></td>
                                                        <td>
                                                            <div>
                                                                <div className="fw-bold">{order.user?.name || 'Unknown Customer'}</div>
                                                                <small className="text-muted">{order.user?.email || 'No email'}</small>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {order.checkout_date ? (
                                                                <div>
                                                                    <div>{new Date(order.checkout_date).toLocaleDateString()}</div>
                                                                    <small className="text-muted">{new Date(order.checkout_date).toLocaleTimeString()}</small>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted">N/A</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <span className={`badge bg-${
                                                                order.status === 'completed' ? 'success' :
                                                                order.status === 'delivered' ? 'primary' :
                                                                order.status === 'processing' ? 'info' :
                                                                order.status === 'ready_for_delivery' ? 'warning' :
                                                                'secondary'
                                                            }`}>
                                                                {order.status || 'pending'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`badge bg-${
                                                                order.payment_status === 'paid' ? 'success' :
                                                                order.payment_status === 'unpaid' ? 'warning' :
                                                                'danger'
                                                            }`}>
                                                                {order.payment_status || 'pending'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <strong>₱{parseFloat(order.total_price || 0).toLocaleString()}</strong>
                                                        </td>
                                                        <td>
                                                            <div className="small">
                                                                {order.items && order.items.length > 0 ? (
                                                                    <>
                                                                        {order.items.slice(0, 2).map((item, index) => (
                                                                            <div key={index} className="mb-1">
                                                                                {item.product?.name || 'Unknown'} (x{item.quantity || 0})
                                                                            </div>
                                                                        ))}
                                                                        {order.items.length > 2 && (
                                                                            <small className="text-muted">+{order.items.length - 2} more items</small>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-muted">No items</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className={`badge bg-${
                                                                order.payment_method === 'cod' ? 'secondary' :
                                                                order.payment_method === 'maya' ? 'primary' :
                                                                'dark'
                                                            }`}>
                                                                {order.payment_method?.toUpperCase() || 'COD'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-5">
                                        <FaShoppingCart className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                        <h5 className="text-muted">No Orders Found</h5>
                                        <p className="text-muted">Orders will appear here once customers place orders</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sales Reports Tab */}
            {activeTab === 'reports' && (
                <div className="row">
                    {tabLoadingStates.reports ? (
                        <div className="col-12">
                            <div className="text-center py-5">
                                <div className="spinner-border text-dark mb-3" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <h5>Loading Reports...</h5>
                                <p className="text-muted">Generating comprehensive sales reports</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Key Metrics Cards - Same as Overview */}
                            <div className="col-lg-3 col-md-6 mb-4">
                                <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.success}15, ${colors.info}15)` }}>
                                    <div className="card-body text-center p-4">
                                        <div className="d-flex align-items-center justify-content-center mb-3">
                                            <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.success}20` }}>
                                                <FaDollarSign style={{ color: colors.success }} className="fs-4" />
                                            </div>
                                            <div>
                                                <h3 className="mb-0 fw-bold" style={{ color: colors.success }}>
                                                    ₱{(salesReports?.overview?.total_revenue || dashboardData?.overview?.total_revenue || 0).toLocaleString()}
                                                </h3>
                                                <small className="text-muted fw-medium">Total Revenue</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-3 col-md-6 mb-4">
                                <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.primary}15, ${colors.accent}15)` }}>
                                    <div className="card-body text-center p-4">
                                        <div className="d-flex align-items-center justify-content-center mb-3">
                                            <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.primary}20` }}>
                                                <FaShoppingCart style={{ color: colors.primary }} className="fs-4" />
                                            </div>
                                            <div>
                                                <h3 className="mb-0 fw-bold" style={{ color: colors.primary }}>
                                                    {(salesReports?.overview?.total_orders || dashboardData?.overview?.total_orders || 0)}
                                                </h3>
                                                <small className="text-muted fw-medium">Total Orders</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-3 col-md-6 mb-4">
                                <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.info}15, ${colors.secondary}15)` }}>
                                    <div className="card-body text-center p-4">
                                        <div className="d-flex align-items-center justify-content-center mb-3">
                                            <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.info}20` }}>
                                                <FaChartBar style={{ color: colors.info }} className="fs-4" />
                                            </div>
                                            <div>
                                                <h3 className="mb-0 fw-bold" style={{ color: colors.info }}>
                                                    ₱{(salesReports?.overview?.average_order_value || dashboardData?.overview?.average_order_value || 0).toLocaleString()}
                                                </h3>
                                                <small className="text-muted fw-medium">Avg Order Value</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-3 col-md-6 mb-4">
                                <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.warning}15, ${colors.accent}15)` }}>
                                    <div className="card-body text-center p-4">
                                        <div className="d-flex align-items-center justify-content-center mb-3">
                                            <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.warning}20` }}>
                                                <FaPercent style={{ color: colors.warning }} className="fs-4" />
                                            </div>
                                            <div>
                                                <h3 className="mb-0 fw-bold" style={{ color: colors.warning }}>
                                                    {(salesReports?.overview?.conversion_rate || dashboardData?.overview?.conversion_rate || 0)}%
                                                </h3>
                                                <small className="text-muted fw-medium">Conversion Rate</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Revenue Trends Chart */}
                            <div className="col-lg-8 mb-4">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-header bg-white border-0">
                                        <h5 className="mb-0 d-flex align-items-center">
                                            <FaChartLine className="me-2" style={{ color: colors.primary }} />
                                            Revenue Trends
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        {(salesReports?.revenue_trends || dashboardData?.revenue_trends || []).length > 0 ? (
                                            <ResponsiveContainer width="100%" height={300}>
                                                <LineChart data={salesReports?.revenue_trends || dashboardData?.revenue_trends || []}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="date" />
                                                    <YAxis />
                                                    <Tooltip formatter={(value) => [`₱${value.toLocaleString()}`, 'Revenue']} />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="revenue" stroke={colors.success} name="Daily Revenue" />
                                                    <Line type="monotone" dataKey="orders" stroke={colors.primary} name="Orders" />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="text-center py-5">
                                                <FaChartLine className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                                <h5 className="text-muted">No Revenue Data</h5>
                                                <p className="text-muted">Revenue trends will appear here when orders are placed</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sales by Status Chart */}
                            <div className="col-lg-4 mb-4">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-header bg-white border-0">
                                        <h5 className="mb-0 d-flex align-items-center">
                                            <FaChartBar className="me-2" style={{ color: colors.secondary }} />
                                            Sales by Status
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        {(salesReports?.sales_by_status || dashboardData?.sales_by_status || []).length > 0 ? (
                                            <ResponsiveContainer width="100%" height={300}>
                                                <PieChart>
                                                    <Pie
                                                        data={salesReports?.sales_by_status || dashboardData?.sales_by_status || []}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={false}
                                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                        outerRadius={80}
                                                        fill="#8884d8"
                                                        dataKey="count"
                                                    >
                                                        {(salesReports?.sales_by_status || dashboardData?.sales_by_status || []).map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="text-center py-5">
                                                <FaChartBar className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                                <h5 className="text-muted">No Status Data</h5>
                                                <p className="text-muted">Sales status data will appear here</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* All Orders Table */}
                            <div className="col-12">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                                        <h5 className="mb-0 d-flex align-items-center">
                                            <FaShoppingCart className="me-2" style={{ color: colors.primary }} />
                                            All Orders
                                        </h5>
                                        <span className="badge bg-primary">
                                            {Array.isArray(orders) ? orders.length : 0} {orders.length === 1 ? 'Order' : 'Orders'}
                                        </span>
                                    </div>
                                    <div className="card-body">
                                        {Array.isArray(orders) && orders.length > 0 ? (
                                            <div className="table-responsive">
                                                <table className="table table-hover">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>Order ID</th>
                                                            <th>Customer</th>
                                                            <th>Date</th>
                                                            <th>Status</th>
                                                            <th>Payment Status</th>
                                                            <th>Total Amount</th>
                                                            <th>Items</th>
                                                            <th>Payment Method</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {orders.map((order) => (
                                                            <tr key={order.id}>
                                                                <td><strong>#{order.id}</strong></td>
                                                                <td>
                                                                    <div>
                                                                        <div className="fw-bold">{order.user?.name || 'Unknown Customer'}</div>
                                                                        <small className="text-muted">{order.user?.email || 'No email'}</small>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    {order.checkout_date ? (
                                                                        <div>
                                                                            <div>{new Date(order.checkout_date).toLocaleDateString()}</div>
                                                                            <small className="text-muted">{new Date(order.checkout_date).toLocaleTimeString()}</small>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-muted">N/A</span>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    <span className={`badge bg-${
                                                                        order.status === 'completed' ? 'success' :
                                                                        order.status === 'delivered' ? 'primary' :
                                                                        order.status === 'processing' ? 'info' :
                                                                        order.status === 'ready_for_delivery' ? 'warning' :
                                                                        'secondary'
                                                                    }`}>
                                                                        {order.status || 'pending'}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <span className={`badge bg-${
                                                                        order.payment_status === 'paid' ? 'success' :
                                                                        order.payment_status === 'unpaid' ? 'warning' :
                                                                        'danger'
                                                                    }`}>
                                                                        {order.payment_status || 'pending'}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <strong>₱{parseFloat(order.total_price || 0).toLocaleString()}</strong>
                                                                </td>
                                                                <td>
                                                                    <div className="small">
                                                                        {order.items && order.items.length > 0 ? (
                                                                            <>
                                                                                {order.items.slice(0, 2).map((item, index) => (
                                                                                    <div key={index} className="mb-1">
                                                                                        {item.product?.name || 'Unknown'} (x{item.quantity || 0})
                                                                                    </div>
                                                                                ))}
                                                                                {order.items.length > 2 && (
                                                                                    <small className="text-muted">+{order.items.length - 2} more items</small>
                                                                                )}
                                                                            </>
                                                                        ) : (
                                                                            <span className="text-muted">No items</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span className={`badge bg-${
                                                                        order.payment_method === 'cod' ? 'secondary' :
                                                                        order.payment_method === 'maya' ? 'primary' :
                                                                        'dark'
                                                                    }`}>
                                                                        {order.payment_method?.toUpperCase() || 'COD'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-5">
                                                <FaShoppingCart className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                                <h5 className="text-muted">No Orders Found</h5>
                                                <p className="text-muted">Orders will appear here once customers place orders</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

        </div>
    );
};

export default SalesAnalytics;