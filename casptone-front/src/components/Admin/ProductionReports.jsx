import React, { useEffect, useState, useCallback, useMemo } from "react";
import api from "../../api/client";
import { 
  BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, 
  ScatterChart, Scatter, ComposedChart
} from "recharts";
import { 
  FaIndustry, FaChartLine, FaClipboardList, FaHistory, 
  FaTruck, FaExclamationTriangle, FaCheckCircle,
  FaDownload, FaSync, FaFilter, FaSearch, FaEye, FaEdit,
  FaCogs, FaUsers, FaBoxes, FaChartBar, FaTachometerAlt, FaTasks
} from "react-icons/fa";
import { toast } from "sonner";

const ProductionReports = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("overview");
    const [windowDays, setWindowDays] = useState(30);
    const [refreshKey, setRefreshKey] = useState(0);
    const [productionFilter, setProductionFilter] = useState('all'); // all, alkansya, made_to_order
    
    // Enhanced filter states for reports
    const [reportDateRange, setReportDateRange] = useState('days'); // 'days', 'weeks', 'months', 'year', 'custom'
    const [reportDateValue, setReportDateValue] = useState(30); // Number of days/weeks/months
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [reportCategoryFilter, setReportCategoryFilter] = useState('all'); // 'all', 'alkansya', 'made_to_order'
    const [reportStatusFilter, setReportStatusFilter] = useState('all'); // 'all', 'in_progress', 'completed', 'pending'
    const [reportProductFilter, setReportProductFilter] = useState('all'); // Product-specific filter
    
    // Enhanced data states
    const [dashboardData, setDashboardData] = useState(null);
    const [productionOverview, setProductionOverview] = useState(null);
    const [productionOutput, setProductionOutput] = useState(null);
    const [madeToOrderStatus, setMadeToOrderStatus] = useState(null);
    const [alkansyaDailyOutput, setAlkansyaDailyOutput] = useState([]);
    const [productionAnalytics, setProductionAnalytics] = useState(null);
    const [efficiencyMetrics, setEfficiencyMetrics] = useState(null);
    const [resourceUtilization, setResourceUtilization] = useState(null);
    const [stageBreakdown, setStageBreakdown] = useState(null);
    
    // New accurate data states
    const [alkansyaProductionData, setAlkansyaProductionData] = useState(null);
    const [madeToOrderProductionData, setMadeToOrderProductionData] = useState(null);
    const [productionOutputData, setProductionOutputData] = useState(null);
    
    // Modal states for report preview
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewTitle, setPreviewTitle] = useState('');
    
    // Modal states for PDF preview
    const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
    const [pdfPreviewTitle, setPdfPreviewTitle] = useState('');
    
    // Product performance data
    const [productPerformanceData, setProductPerformanceData] = useState(null);
    
    // Work Progress tab data
    const [allProducts, setAllProducts] = useState([]);
    const [mtoOrders, setMtoOrders] = useState([]);
    const [workProgressSearch, setWorkProgressSearch] = useState('');
    const [workProgressFilter, setWorkProgressFilter] = useState('all'); // all, alkansya, mto
    const [workProgressStatusFilter, setWorkProgressStatusFilter] = useState('all'); // all, not_started, in_progress, completed
    
    // Loading states for each tab
    const [tabLoadingStates, setTabLoadingStates] = useState({
        overview: false,
        productionPerformance: false,
        workProgress: false,
        output: false,
        madeToOrder: false,
        alkansya: false,
        analytics: false,
        efficiency: false,
        utilization: false,
        stages: false
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
            const productionAnalyticsData = await safeFetch('/production/analytics', dateRange);

            // Set data with proper fallbacks
            const analyticsData = productionAnalyticsData || { 
                in_progress: [], 
                completed_today: 0, 
                efficiency: 0, 
                average_cycle_time: 0 
            };
            
            setDashboardData({
                total_productions: analyticsData.in_progress?.length || 0,
                completed_today: analyticsData.completed_today || 0,
                efficiency: analyticsData.efficiency || 0,
                average_cycle_time: analyticsData.average_cycle_time || 0,
                in_progress_productions: analyticsData.in_progress || []
            });
            
            setProductionAnalytics(analyticsData);

        } catch (error) {
            console.error('Error fetching production reports:', error);
            setError('Failed to load production reports. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [windowDays, refreshKey]);

    useEffect(() => {
        fetchAllReports();
        // Load overview data initially
        fetchProductionOverview();
    }, [fetchAllReports]);

    const handleGlobalRefresh = () => {
        setRefreshKey(prev => prev + 1);
        toast.success("Production reports refreshed successfully!");
    };

    // Calculate date range based on filter selection
    const getDateRange = () => {
        const today = new Date();
        let startDate, endDate;

        if (reportDateRange === 'custom' && reportStartDate && reportEndDate) {
            startDate = new Date(reportStartDate);
            endDate = new Date(reportEndDate);
        } else {
            endDate = new Date(today);
            
            switch (reportDateRange) {
                case 'days':
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - reportDateValue);
                    break;
                case 'weeks':
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - (reportDateValue * 7));
                    break;
                case 'months':
                    startDate = new Date(today);
                    startDate.setMonth(today.getMonth() - reportDateValue);
                    break;
                case 'year':
                    startDate = new Date(today);
                    startDate.setFullYear(today.getFullYear() - 1);
                    break;
                default:
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - 30);
            }
        }

        return {
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0]
        };
    };


    // Preview Report Function
    const previewReport = (reportType) => {
        try {
            const dateRange = getDateRange();
            let data = null;
            let title = '';

            switch(reportType) {
                case 'performance':
                    title = `Production Performance Report (${dateRange.start_date} to ${dateRange.end_date})`;
                    data = generatePerformanceReportData(productionOverview, dateRange, reportCategoryFilter, reportStatusFilter);
                    break;
                case 'workprogress':
                    title = `Work Progress Report (${dateRange.start_date} to ${dateRange.end_date})`;
                    data = generateWorkProgressReportData(productionOverview, alkansyaProductionData, madeToOrderProductionData, dateRange, reportCategoryFilter, reportStatusFilter);
                    break;
                case 'comprehensive':
                    title = `Comprehensive Production Report (${dateRange.start_date} to ${dateRange.end_date})`;
                    data = generateComprehensiveReportData(productionOverview, productionOutputData, alkansyaProductionData, madeToOrderProductionData, dateRange, reportCategoryFilter, reportStatusFilter);
                    break;
                default:
                    return;
            }

            setPreviewData(data);
            setPreviewTitle(title);
            setShowPreviewModal(true);
        } catch (error) {
            console.error('Error generating preview:', error);
            toast.error('Failed to generate report preview. Please try again.');
        }
    };

    // Download Report Function
    const downloadReport = (reportType) => {
        try {
            const dateRange = getDateRange();
            let content = '';
            let filename = '';

            switch(reportType) {
                case 'performance':
                    filename = `Production_Performance_Report_${dateRange.start_date}_to_${dateRange.end_date}.csv`;
                    content = generatePerformanceReportCSV(productionOverview, productPerformanceData, dateRange, reportCategoryFilter, reportStatusFilter);
                    break;
                case 'workprogress':
                    filename = `Work_Progress_Report_${dateRange.start_date}_to_${dateRange.end_date}.csv`;
                    content = generateWorkProgressReportCSV(productionOverview, alkansyaProductionData, madeToOrderProductionData, dateRange, reportCategoryFilter, reportStatusFilter);
                    break;
                case 'comprehensive':
                    filename = `Comprehensive_Production_Report_${dateRange.start_date}_to_${dateRange.end_date}.csv`;
                    content = generateComprehensiveReportCSV(productionOverview, productionOutputData, alkansyaProductionData, madeToOrderProductionData, dateRange, reportCategoryFilter, reportStatusFilter);
                    break;
                default:
                    return;
            }

            // Create and download file
            const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success(`${reportType === 'performance' ? 'Performance' : reportType === 'workprogress' ? 'Work Progress' : 'Comprehensive'} report downloaded successfully!`);
        } catch (error) {
            console.error('Error downloading report:', error);
            toast.error('Failed to generate report. Please try again.');
        }
    };

    // Preview PDF Report Function
    const previewPdfReport = async (reportType) => {
        try {
            const token = localStorage.getItem('token');
            const dateRange = getDateRange();
            let url = '';
            let title = '';

            switch(reportType) {
                case 'performance':
                    url = `http://localhost:8000/api/reports/production.pdf?report_type=performance&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}&status=${reportStatusFilter}`;
                    title = 'Production Performance Report - PDF Preview';
                    break;
                case 'workprogress':
                    url = `http://localhost:8000/api/reports/production.pdf?report_type=workprogress&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}&status=${reportStatusFilter}`;
                    title = 'Work Progress Report - PDF Preview';
                    break;
                case 'comprehensive':
                    url = `http://localhost:8000/api/reports/production.pdf?report_type=comprehensive&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}&status=${reportStatusFilter}`;
                    title = 'Comprehensive Production Report - PDF Preview';
                    break;
                default:
                    return;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/pdf'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to generate PDF');
            }

            const blob = await response.blob();
            const pdfUrl = window.URL.createObjectURL(blob);
            setPdfPreviewUrl(pdfUrl);
            setPdfPreviewTitle(title);
            setShowPdfPreviewModal(true);
        } catch (error) {
            console.error('Error previewing PDF:', error);
            toast.error('Failed to generate PDF preview. Please try again.');
        }
    };

    // Download PDF Report Function
    const downloadPdfReport = async (reportType) => {
        try {
            const token = localStorage.getItem('token');
            const dateRange = getDateRange();
            let url = '';

            switch(reportType) {
                case 'performance':
                    url = `http://localhost:8000/api/reports/production.pdf?report_type=performance&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}&status=${reportStatusFilter}`;
                    break;
                case 'workprogress':
                    url = `http://localhost:8000/api/reports/production.pdf?report_type=workprogress&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}&status=${reportStatusFilter}`;
                    break;
                case 'comprehensive':
                    url = `http://localhost:8000/api/reports/production.pdf?report_type=comprehensive&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}&status=${reportStatusFilter}`;
                    break;
                default:
                    return;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/pdf'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to generate PDF');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `production_${reportType}_report_${dateRange.start_date}_to_${dateRange.end_date}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            
            toast.success(`PDF report downloaded successfully!`);
        } catch (error) {
            console.error('Error downloading PDF:', error);
            toast.error('Failed to generate PDF report. Please try again.');
        }
    };

    // Generate Performance Report CSV
    const generatePerformanceReportCSV = (data, productPerformanceData = null, dateRange = null, categoryFilter = 'all', statusFilter = 'all') => {
        if (!data) return '';
        
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        
        // Helper function to get display name for category filter
        const getCategoryDisplayName = (filter) => {
            const categoryMap = {
                'all': 'All Categories',
                'alkansya': 'Alkansya',
                'made_to_order': 'Made to Order'
            };
            return categoryMap[filter] || filter;
        };
        
        // Helper function to get display name for status filter
        const getStatusDisplayName = (filter) => {
            const statusMap = {
                'all': 'All Status',
                'in_progress': 'In Progress',
                'completed': 'Completed',
                'pending': 'Pending'
            };
            return statusMap[filter] || filter;
        };
        
        let content = 'Production Performance Report\n';
        content += `Generated: ${new Date().toLocaleString()}\n`;
        content += `Date Range: ${dateRangeStr}\n`;
        content += `Category Filter: ${getCategoryDisplayName(categoryFilter)}\n`;
        content += `Status Filter: ${getStatusDisplayName(statusFilter)}\n\n`;
        
        // Apply category filter to product performance data
        let filteredProducts = productPerformanceData?.products || [];
        if (categoryFilter !== 'all' && productPerformanceData?.products) {
            filteredProducts = productPerformanceData.products.filter(product => {
                if (categoryFilter === 'alkansya') {
                    return product.category === 'Alkansya' || product.category === 'Stocked Products';
                }
                if (categoryFilter === 'made_to_order') {
                    return product.category === 'Made to Order' || product.category === 'made_to_order';
                }
                return false;
            });
        }
        
        // Overall Metrics - apply category filter
        content += '=== OVERALL METRICS ===\n';
        if (categoryFilter === 'alkansya') {
            content += `Total Units Produced,${data.alkansya?.total_units_produced || 0}\n`;
            content += `Production Efficiency,${data.alkansya?.efficiency || data.overall?.production_efficiency || 0}%\n`;
            content += `Average Daily Output,${data.alkansya?.average_daily_output || 0}\n`;
            content += `Production Days,${data.alkansya?.total_days || 0}\n\n`;
        } else if (categoryFilter === 'made_to_order') {
            content += `Total Products Ordered,${data.made_to_order?.total_products_ordered || 0}\n`;
            content += `Production Efficiency,${data.made_to_order?.efficiency || data.overall?.production_efficiency || 0}%\n`;
            content += `Products In Progress,${data.made_to_order?.in_progress || 0}\n`;
            content += `Products Completed,${data.made_to_order?.completed || 0}\n\n`;
        } else {
            content += `Total Units Produced,${data.overall?.total_units_produced || 0}\n`;
            content += `Production Efficiency,${data.overall?.production_efficiency || 0}%\n`;
            content += `Average Daily Output,${data.overall?.average_daily_output || 0}\n`;
            content += `Total Production Days,${data.overall?.total_production_days || 0}\n\n`;
        }
        
        // Product-Level Performance Data
        if (filteredProducts.length > 0) {
            content += '=== PRODUCT-LEVEL PERFORMANCE ===\n';
            content += 'Product Name,Category,Total Produced,Days with Production,Avg Daily Output,Max Daily,Min Daily,Efficiency %,First Production,Last Production,Trend,Date Range\n';
            filteredProducts.forEach(product => {
                content += `${product.product_name},${product.category},${product.total_quantity_produced || 0},${product.days_with_production || product.orders_count || 0},${product.average_daily_output?.toFixed(2) || product.average_production_time_days || '-'},${product.max_daily_output || '-'},${product.min_daily_output || '-'},${product.efficiency_percentage?.toFixed(1) || product.completion_rate?.toFixed(1) || 0},${product.first_production_date || product.first_order_date || '-'},${product.last_production_date || product.last_order_date || '-'},${product.production_trend || '-'},"${dateRangeStr}"\n`;
            });
            content += '\n';
            
            if (productPerformanceData.summary) {
                content += '=== SUMMARY ===\n';
                content += `Total Products,${filteredProducts.length}\n`;
                content += `Alkansya Products,${filteredProducts.filter(p => p.category === 'Alkansya' || p.category === 'Stocked Products').length}\n`;
                content += `Made-to-Order Products,${filteredProducts.filter(p => p.category === 'Made to Order' || p.category === 'made_to_order').length}\n`;
                content += `Average Efficiency,${productPerformanceData.summary.average_efficiency?.toFixed(1) || 0}%\n\n`;
            }
        }
        
        // Alkansya Metrics (only if category filter allows)
        if (categoryFilter === 'all' || categoryFilter === 'alkansya') {
            content += '=== ALKANSYA PRODUCTION ===\n';
            content += `Total Units Produced,${data.alkansya?.total_units_produced || 0}\n`;
            content += `Average Daily Output,${data.alkansya?.average_daily_output || 0}\n`;
            content += `Max Daily Output,${data.alkansya?.max_daily_output || 0}\n`;
            content += `Min Daily Output,${data.alkansya?.min_daily_output || 0}\n`;
            content += `Production Days,${data.alkansya?.total_days || 0}\n`;
            content += `Production Trend,${data.alkansya?.production_trend || 'stable'}\n\n`;
        }
        
        // Made-to-Order Metrics (only if category filter allows)
        if (categoryFilter === 'all' || categoryFilter === 'made_to_order') {
            content += '=== MADE-TO-ORDER PRODUCTION ===\n';
            content += `Total Products Ordered,${data.made_to_order?.total_products_ordered || 0}\n`;
            content += `Products In Progress,${data.made_to_order?.in_progress || 0}\n`;
            content += `Products Completed,${data.made_to_order?.completed || 0}\n`;
            content += `Completion Rate,${data.made_to_order?.completion_rate || 0}%\n\n`;
        }
        
        // Efficiency Metrics
        content += '=== EFFICIENCY METRICS ===\n';
        content += `Overall Efficiency,${data.overall?.production_efficiency || 0}%\n`;
        if (categoryFilter === 'all' || categoryFilter === 'alkansya') {
            content += `Alkansya Efficiency,${data.alkansya?.efficiency || 0}%\n`;
        }
        if (categoryFilter === 'all' || categoryFilter === 'made_to_order') {
            content += `Made-to-Order Efficiency,${data.made_to_order?.efficiency || 0}%\n`;
        }
        content += '\n';
        
        return content;
    };

    // Generate Work Progress Report CSV
    const generateWorkProgressReportCSV = (overview, alkansya, madeToOrder, dateRange = null, categoryFilter = 'all', statusFilter = 'all') => {
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        
        // Helper function to get display name for category filter
        const getCategoryDisplayName = (filter) => {
            const categoryMap = {
                'all': 'All Categories',
                'alkansya': 'Alkansya',
                'made_to_order': 'Made to Order'
            };
            return categoryMap[filter] || filter;
        };
        
        // Helper function to get display name for status filter
        const getStatusDisplayName = (filter) => {
            const statusMap = {
                'all': 'All Status',
                'in_progress': 'In Progress',
                'completed': 'Completed',
                'pending': 'Pending'
            };
            return statusMap[filter] || filter;
        };
        
        let content = 'Work Progress Report\n';
        content += `Generated: ${new Date().toLocaleString()}\n`;
        content += `Date Range: ${dateRangeStr}\n`;
        content += `Category Filter: ${getCategoryDisplayName(categoryFilter)}\n`;
        content += `Status Filter: ${getStatusDisplayName(statusFilter)}\n\n`;
        
        // Apply category filter to data
        let filteredAlkansya = overview?.alkansya?.recent_output || [];
        let filteredMadeToOrder = madeToOrder?.items || [];
        
        if (categoryFilter === 'alkansya') {
            filteredMadeToOrder = [];
        } else if (categoryFilter === 'made_to_order') {
            filteredAlkansya = [];
        }
        
        // Apply status filter for made-to-order
        if (statusFilter !== 'all' && filteredMadeToOrder.length > 0) {
            filteredMadeToOrder = filteredMadeToOrder.filter(item => {
                const status = item.status?.toLowerCase() || '';
                if (statusFilter === 'in_progress') return status === 'in progress' || status === 'in_progress';
                if (statusFilter === 'completed') return status === 'completed';
                if (statusFilter === 'pending') return status === 'pending';
                return true;
            });
        }
        
        content += '=== ALKANSYA RECENT OUTPUT ===\n';
        content += 'Date,Quantity,Produced By\n';
        if (filteredAlkansya.length > 0) {
            filteredAlkansya.forEach(output => {
                content += `${output.date},${output.quantity},${output.produced_by}\n`;
            });
        } else {
            content += 'No data available\n';
        }
        content += '\n';
        
        content += '=== MADE-TO-ORDER STATUS ===\n';
        content += `Total Orders,${filteredMadeToOrder.length}\n`;
        content += `In Progress,${filteredMadeToOrder.filter(item => (item.status?.toLowerCase() || '') === 'in progress' || (item.status?.toLowerCase() || '') === 'in_progress').length}\n`;
        content += `Completed,${filteredMadeToOrder.filter(item => (item.status?.toLowerCase() || '') === 'completed').length}\n`;
        content += `Pending,${filteredMadeToOrder.filter(item => (item.status?.toLowerCase() || '') === 'pending').length}\n\n`;
        
        if (filteredMadeToOrder.length > 0) {
            content += '=== ORDER DETAILS ===\n';
            content += 'Order ID,Product,Status,Quantity,Progress,Date Range\n';
            filteredMadeToOrder.slice(0, 20).forEach(item => {
                content += `${item.order_id || 'N/A'},${item.product_name || 'N/A'},${item.status || 'N/A'},${item.quantity || 0},${item.progress || 0}%,"${dateRangeStr}"\n`;
            });
        }
        
        return content;
    };

    // Generate Comprehensive Report CSV
    const generateComprehensiveReportCSV = (overview, output, alkansya, madeToOrder, dateRange = null, categoryFilter = 'all', statusFilter = 'all') => {
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : `Last ${windowDays} days`;
        
        // Helper function to get display name for category filter
        const getCategoryDisplayName = (filter) => {
            const categoryMap = {
                'all': 'All Categories',
                'alkansya': 'Alkansya',
                'made_to_order': 'Made to Order'
            };
            return categoryMap[filter] || filter;
        };
        
        // Helper function to get display name for status filter
        const getStatusDisplayName = (filter) => {
            const statusMap = {
                'all': 'All Status',
                'in_progress': 'In Progress',
                'completed': 'Completed',
                'pending': 'Pending'
            };
            return statusMap[filter] || filter;
        };
        
        let content = 'COMPREHENSIVE PRODUCTION REPORT\n';
        content += `Generated: ${new Date().toLocaleString()}\n`;
        content += `Report Period: ${dateRangeStr}\n`;
        content += `Category Filter: ${getCategoryDisplayName(categoryFilter)}\n`;
        content += `Status Filter: ${getStatusDisplayName(statusFilter)}\n\n`;
        
        // Apply filters
        let filteredMadeToOrder = madeToOrder?.items || [];
        if (categoryFilter === 'alkansya') {
            filteredMadeToOrder = [];
        } else if (categoryFilter === 'made_to_order') {
            // Keep only made-to-order items
        }
        
        if (statusFilter !== 'all' && filteredMadeToOrder.length > 0) {
            filteredMadeToOrder = filteredMadeToOrder.filter(item => {
                const status = item.status?.toLowerCase() || '';
                if (statusFilter === 'in_progress') return status === 'in progress' || status === 'in_progress';
                if (statusFilter === 'completed') return status === 'completed';
                if (statusFilter === 'pending') return status === 'pending';
                return true;
            });
        }
        
        // Section 1: Overview
        content += '=== PRODUCTION OVERVIEW ===\n';
        if (overview) {
            // Apply category filter to overview metrics
            if (categoryFilter === 'alkansya') {
                content += `Total Units Produced,${overview.alkansya?.total_units_produced || 0}\n`;
                content += `Production Efficiency,${overview.alkansya?.efficiency || overview.overall?.production_efficiency || 0}%\n`;
                content += `Average Daily Output,${overview.alkansya?.average_daily_output || 0}\n`;
                content += `Production Days,${overview.alkansya?.total_days || 0}\n\n`;
            } else if (categoryFilter === 'made_to_order') {
                content += `Total Products Ordered,${overview.made_to_order?.total_products_ordered || 0}\n`;
                content += `Production Efficiency,${overview.made_to_order?.efficiency || overview.overall?.production_efficiency || 0}%\n`;
                content += `Products In Progress,${overview.made_to_order?.in_progress || 0}\n`;
                content += `Products Completed,${overview.made_to_order?.completed || 0}\n\n`;
            } else {
                content += `Total Units Produced,${overview.overall?.total_units_produced || 0}\n`;
                content += `Production Efficiency,${overview.overall?.production_efficiency || 0}%\n`;
                content += `Average Daily Output,${overview.overall?.average_daily_output || 0}\n`;
                content += `Total Production Days,${overview.overall?.total_production_days || 0}\n\n`;
            }
        }
        
        // Section 2: Output Data
        content += '=== PRODUCTION OUTPUT ===\n';
        if (output?.metrics) {
            content += `Total Units Produced,${output.metrics.total_units_produced || 0}\n`;
            if (categoryFilter === 'all' || categoryFilter === 'alkansya') {
                content += `Alkansya Units,${output.metrics.alkansya_units || 0}\n`;
            }
            if (categoryFilter === 'all' || categoryFilter === 'made_to_order') {
                content += `Made-to-Order Units,${output.metrics.made_to_order_units || 0}\n`;
            }
            content += '\n';
        }
        
        // Section 3: Recent Alkansya Output (only if category filter allows)
        let filteredAlkansyaOutput = overview?.alkansya?.recent_output || [];
        if (categoryFilter === 'made_to_order') {
            filteredAlkansyaOutput = [];
        }
        
        if (filteredAlkansyaOutput.length > 0) {
            content += '=== RECENT PRODUCTION OUTPUT ===\n';
            content += 'Date,Quantity,Produced By\n';
            filteredAlkansyaOutput.forEach(output => {
                content += `${output.date},${output.quantity},${output.produced_by}\n`;
            });
            content += '\n';
        }
        
        // Section 4: Made-to-Order Progress (only if category filter allows)
        if ((categoryFilter === 'all' || categoryFilter === 'made_to_order') && filteredMadeToOrder.length > 0) {
            content += '=== MADE-TO-ORDER PROGRESS ===\n';
            content += 'Order ID,Product Name,Status,Quantity,Progress,Start Date,Date Range\n';
            filteredMadeToOrder.forEach(item => {
                content += `${item.order_id || 'N/A'},${item.product_name || 'N/A'},${item.status || 'N/A'},${item.quantity || 0},${item.progress || 0}%,${item.start_date || 'N/A'},"${dateRangeStr}"\n`;
            });
        }
        
        return content;
    };

    // Generate Performance Report Data for Preview
    const generatePerformanceReportData = (data, dateRange = null, categoryFilter = 'all', statusFilter = 'all') => {
        if (!data) return { sections: [] };
        
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        
        // Helper function to get display name for category filter
        const getCategoryDisplayName = (filter) => {
            const categoryMap = {
                'all': 'All Categories',
                'alkansya': 'Alkansya',
                'made_to_order': 'Made to Order'
            };
            return categoryMap[filter] || filter;
        };
        
        // Helper function to get display name for status filter
        const getStatusDisplayName = (filter) => {
            const statusMap = {
                'all': 'All Status',
                'in_progress': 'In Progress',
                'completed': 'Completed',
                'pending': 'Pending'
            };
            return statusMap[filter] || filter;
        };
        
        const sections = [
            {
                title: 'Report Filters',
                data: [
                    { label: 'Date Range', value: dateRangeStr },
                    { label: 'Category Filter', value: getCategoryDisplayName(categoryFilter) },
                    { label: 'Status Filter', value: getStatusDisplayName(statusFilter) }
                ]
            }
        ];
        
        // Overall Metrics - apply category filter
        if (categoryFilter === 'alkansya') {
            sections.push({
                title: 'Alkansya Production Metrics',
                data: [
                    { label: 'Total Units Produced', value: data.alkansya?.total_units_produced || 0 },
                    { label: 'Production Efficiency', value: `${data.alkansya?.efficiency || data.overall?.production_efficiency || 0}%` },
                    { label: 'Average Daily Output', value: data.alkansya?.average_daily_output || 0 },
                    { label: 'Max Daily Output', value: data.alkansya?.max_daily_output || 0 },
                    { label: 'Min Daily Output', value: data.alkansya?.min_daily_output || 0 },
                    { label: 'Production Days', value: data.alkansya?.total_days || 0 },
                    { label: 'Production Trend', value: data.alkansya?.production_trend || 'stable' }
                ]
            });
        } else if (categoryFilter === 'made_to_order') {
            sections.push({
                title: 'Made-to-Order Production Metrics',
                data: [
                    { label: 'Total Products Ordered', value: data.made_to_order?.total_products_ordered || 0 },
                    { label: 'Production Efficiency', value: `${data.made_to_order?.efficiency || data.overall?.production_efficiency || 0}%` },
                    { label: 'Products In Progress', value: data.made_to_order?.in_progress || 0 },
                    { label: 'Products Completed', value: data.made_to_order?.completed || 0 },
                    { label: 'Completion Rate', value: `${data.made_to_order?.completion_rate || 0}%` }
                ]
            });
        } else {
            sections.push({
                title: 'Overall Metrics',
                data: [
                    { label: 'Total Units Produced', value: data.overall?.total_units_produced || 0 },
                    { label: 'Production Efficiency', value: `${data.overall?.production_efficiency || 0}%` },
                    { label: 'Average Daily Output', value: data.overall?.average_daily_output || 0 },
                    { label: 'Total Production Days', value: data.overall?.total_production_days || 0 }
                ]
            });
            
            if (categoryFilter === 'all') {
                sections.push({
                    title: 'Alkansya Production',
                    data: [
                        { label: 'Total Units Produced', value: data.alkansya?.total_units_produced || 0 },
                        { label: 'Average Daily Output', value: data.alkansya?.average_daily_output || 0 },
                        { label: 'Max Daily Output', value: data.alkansya?.max_daily_output || 0 },
                        { label: 'Min Daily Output', value: data.alkansya?.min_daily_output || 0 },
                        { label: 'Production Days', value: data.alkansya?.total_days || 0 },
                        { label: 'Production Trend', value: data.alkansya?.production_trend || 'stable' }
                    ]
                });
                
                sections.push({
                    title: 'Made-to-Order Production',
                    data: [
                        { label: 'Total Products Ordered', value: data.made_to_order?.total_products_ordered || 0 },
                        { label: 'Products In Progress', value: data.made_to_order?.in_progress || 0 },
                        { label: 'Products Completed', value: data.made_to_order?.completed || 0 },
                        { label: 'Completion Rate', value: `${data.made_to_order?.completion_rate || 0}%` }
                    ]
                });
            }
        }
        
        sections.push({
            title: 'Efficiency Metrics',
            data: [
                { label: 'Overall Efficiency', value: `${data.overall?.production_efficiency || 0}%` },
                ...(categoryFilter === 'all' || categoryFilter === 'alkansya' ? [{ label: 'Alkansya Efficiency', value: `${data.alkansya?.efficiency || 0}%` }] : []),
                ...(categoryFilter === 'all' || categoryFilter === 'made_to_order' ? [{ label: 'Made-to-Order Efficiency', value: `${data.made_to_order?.efficiency || 0}%` }] : [])
            ]
        });
        
        return { sections };
    };

    // Generate Work Progress Report Data for Preview
    const generateWorkProgressReportData = (overview, alkansya, madeToOrder, dateRange = null, categoryFilter = 'all', statusFilter = 'all') => {
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        
        // Helper function to get display name for category filter
        const getCategoryDisplayName = (filter) => {
            const categoryMap = {
                'all': 'All Categories',
                'alkansya': 'Alkansya',
                'made_to_order': 'Made to Order'
            };
            return categoryMap[filter] || filter;
        };
        
        // Helper function to get display name for status filter
        const getStatusDisplayName = (filter) => {
            const statusMap = {
                'all': 'All Status',
                'in_progress': 'In Progress',
                'completed': 'Completed',
                'pending': 'Pending'
            };
            return statusMap[filter] || filter;
        };
        
        // Apply filters
        let filteredAlkansya = overview?.alkansya?.recent_output || [];
        let filteredMadeToOrder = madeToOrder?.items || [];
        
        if (categoryFilter === 'alkansya') {
            filteredMadeToOrder = [];
        } else if (categoryFilter === 'made_to_order') {
            filteredAlkansya = [];
        }
        
        if (statusFilter !== 'all' && filteredMadeToOrder.length > 0) {
            filteredMadeToOrder = filteredMadeToOrder.filter(item => {
                const status = item.status?.toLowerCase() || '';
                if (statusFilter === 'in_progress') return status === 'in progress' || status === 'in_progress';
                if (statusFilter === 'completed') return status === 'completed';
                if (statusFilter === 'pending') return status === 'pending';
                return true;
            });
        }
        
        return {
            sections: [
                {
                    title: 'Report Filters',
                    data: [
                        { label: 'Date Range', value: dateRangeStr },
                        { label: 'Category Filter', value: getCategoryDisplayName(categoryFilter) },
                        { label: 'Status Filter', value: getStatusDisplayName(statusFilter) }
                    ]
                },
                {
                    title: 'Alkansya Recent Output',
                    type: 'table',
                    headers: ['Date', 'Quantity', 'Produced By'],
                    data: filteredAlkansya.map(output => [
                        output.date,
                        output.quantity,
                        output.produced_by
                    ])
                },
                {
                    title: 'Made-to-Order Status',
                    data: [
                        { label: 'Total Orders', value: filteredMadeToOrder.length },
                        { label: 'In Progress', value: filteredMadeToOrder.filter(item => (item.status?.toLowerCase() || '') === 'in progress' || (item.status?.toLowerCase() || '') === 'in_progress').length },
                        { label: 'Completed', value: filteredMadeToOrder.filter(item => (item.status?.toLowerCase() || '') === 'completed').length },
                        { label: 'Pending', value: filteredMadeToOrder.filter(item => (item.status?.toLowerCase() || '') === 'pending').length }
                    ]
                },
                {
                    title: 'Order Details',
                    type: 'table',
                    headers: ['Order ID', 'Product', 'Status', 'Quantity', 'Progress'],
                    data: filteredMadeToOrder.slice(0, 20).map(item => [
                        item.order_id || 'N/A',
                        item.product_name || 'N/A',
                        item.status || 'N/A',
                        item.quantity || 0,
                        `${item.progress || 0}%`
                    ])
                }
            ]
        };
    };

    // Generate Comprehensive Report Data for Preview
    const generateComprehensiveReportData = (overview, output, alkansya, madeToOrder, dateRange = null, categoryFilter = 'all', statusFilter = 'all') => {
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        
        // Helper function to get display name for category filter
        const getCategoryDisplayName = (filter) => {
            const categoryMap = {
                'all': 'All Categories',
                'alkansya': 'Alkansya',
                'made_to_order': 'Made to Order'
            };
            return categoryMap[filter] || filter;
        };
        
        // Helper function to get display name for status filter
        const getStatusDisplayName = (filter) => {
            const statusMap = {
                'all': 'All Status',
                'in_progress': 'In Progress',
                'completed': 'Completed',
                'pending': 'Pending'
            };
            return statusMap[filter] || filter;
        };
        
        // Apply filters
        let filteredAlkansya = overview?.alkansya?.recent_output || [];
        let filteredMadeToOrder = madeToOrder?.items || [];
        
        if (categoryFilter === 'alkansya') {
            filteredMadeToOrder = [];
        } else if (categoryFilter === 'made_to_order') {
            filteredAlkansya = [];
        }
        
        if (statusFilter !== 'all' && filteredMadeToOrder.length > 0) {
            filteredMadeToOrder = filteredMadeToOrder.filter(item => {
                const status = item.status?.toLowerCase() || '';
                if (statusFilter === 'in_progress') return status === 'in progress' || status === 'in_progress';
                if (statusFilter === 'completed') return status === 'completed';
                if (statusFilter === 'pending') return status === 'pending';
                return true;
            });
        }
        
        return {
            sections: [
                {
                    title: 'Report Filters',
                    data: [
                        { label: 'Date Range', value: dateRangeStr },
                        { label: 'Category Filter', value: getCategoryDisplayName(categoryFilter) },
                        { label: 'Status Filter', value: getStatusDisplayName(statusFilter) }
                    ]
                },
                {
                    title: 'Production Overview',
                    data: [
                        { label: 'Total Units Produced', value: overview?.overall?.total_units_produced || 0 },
                        { label: 'Production Efficiency', value: `${overview?.overall?.production_efficiency || 0}%` },
                        { label: 'Average Daily Output', value: overview?.overall?.average_daily_output || 0 },
                        { label: 'Total Production Days', value: overview?.overall?.total_production_days || 0 }
                    ]
                },
                {
                    title: 'Production Output',
                    data: [
                        { label: 'Total Units Produced', value: output?.metrics?.total_units_produced || 0 },
                        { label: 'Alkansya Units', value: output?.metrics?.alkansya_units || 0 },
                        { label: 'Made-to-Order Units', value: output?.metrics?.made_to_order_units || 0 }
                    ]
                },
                {
                    title: categoryFilter === 'made_to_order' ? 'Made-to-Order Production Output' : 'Alkansya Recent Output',
                    type: 'table',
                    headers: ['Date', 'Quantity', 'Produced By'],
                    data: filteredAlkansya.map(output => [
                        output.date,
                        output.quantity,
                        output.produced_by
                    ])
                },
                {
                    title: 'Made-to-Order Progress',
                    type: 'table',
                    headers: ['Order ID', 'Product Name', 'Status', 'Quantity', 'Progress', 'Start Date'],
                    data: filteredMadeToOrder.map(item => [
                        item.order_id || 'N/A',
                        item.product_name || 'N/A',
                        item.status || 'N/A',
                        item.quantity || 0,
                        `${item.progress || 0}%`,
                        item.start_date || 'N/A'
                    ])
                }
            ]
        };
    };

    // Filter production output data based on selected filter
    const filteredProductionOutput = useMemo(() => {
        if (!productionOutputData || productionFilter === 'all') {
            return productionOutputData;
        }

        const filtered = {
            ...productionOutputData,
            daily_summary: productionOutputData.daily_summary?.map(day => {
                if (productionFilter === 'alkansya') {
                    return {
                        date: day.date,
                        alkansya_units: day.alkansya_units,
                        made_to_order_units: 0,
                        total_units: day.alkansya_units
                    };
                } else if (productionFilter === 'made_to_order') {
                    return {
                        date: day.date,
                        alkansya_units: 0,
                        made_to_order_units: day.made_to_order_units,
                        total_units: day.made_to_order_units
                    };
                }
                return day;
            }) || [],
            weekly_trends: productionOutputData.weekly_trends?.map(week => {
                if (productionFilter === 'alkansya') {
                    return {
                        week: week.week,
                        alkansya_units: week.alkansya_units,
                        made_to_order_units: 0,
                        total_units: week.alkansya_units
                    };
                } else if (productionFilter === 'made_to_order') {
                    return {
                        week: week.week,
                        alkansya_units: 0,
                        made_to_order_units: week.made_to_order_units,
                        total_units: week.made_to_order_units
                    };
                }
                return week;
            }) || [],
            metrics: {
                ...productionOutputData.metrics,
                total_units_produced: productionFilter === 'alkansya' 
                    ? productionOutputData.metrics.alkansya_units 
                    : productionFilter === 'made_to_order'
                    ? productionOutputData.metrics.made_to_order_units
                    : productionOutputData.metrics.total_units_produced
            }
        };

        return filtered;
    }, [productionOutputData, productionFilter]);

    // Fetch production overview data
    const fetchProductionOverview = async () => {
        setTabLoadingStates(prev => ({ ...prev, overview: true }));
        
        try {
            const params = {
                start_date: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0]
            };

            const response = await api.get('/production/overview', { params });
            setProductionOverview(response.data);

        } catch (error) {
            console.error('Error fetching production overview:', error);
            toast.error('Failed to load production overview data');
        } finally {
            setTabLoadingStates(prev => ({ ...prev, overview: false }));
        }
    };

    // Fetch product-level performance data
    const fetchProductPerformanceData = async () => {
        try {
            const params = {
                start_date: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0]
            };

            const response = await api.get('/production/product-performance', { params });
            setProductPerformanceData(response.data || []);
        } catch (error) {
            console.error('Error fetching product performance data:', error);
            toast.error('Failed to load product performance data');
            setProductPerformanceData([]);
        }
    };

    // Fetch Alkansya production data
    const fetchAlkansyaProductionData = async () => {
        setTabLoadingStates(prev => ({ ...prev, alkansya: true }));
        
        try {
            const params = {
                start_date: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0]
            };

            const response = await api.get('/production/alkansya-data', { params });
            setAlkansyaProductionData(response.data);

        } catch (error) {
            console.error('Error fetching Alkansya production data:', error);
            toast.error('Failed to load Alkansya production data');
        } finally {
            setTabLoadingStates(prev => ({ ...prev, alkansya: false }));
        }
    };

    // Fetch Made-to-Order production data
    const fetchMadeToOrderProductionData = async () => {
        setTabLoadingStates(prev => ({ ...prev, madeToOrder: true }));
        
        try {
            const params = {
                start_date: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0],
                include_in_progress: true // Ensure in-progress orders are included
            };

            const response = await api.get('/production/made-to-order-data', { params });
            console.log('Made-to-Order Production Data:', response.data);
            setMadeToOrderProductionData(response.data);

        } catch (error) {
            console.error('Error fetching Made-to-Order production data:', error);
            toast.error('Failed to load Made-to-Order production data');
            // Set empty data structure to prevent crashes
            setMadeToOrderProductionData({
                metrics: {
                    total_accepted_orders: 0,
                    total_products_ordered: 0,
                    total_revenue: 0,
                    average_order_value: 0,
                    unique_products: 0,
                    average_products_per_order: 0
                },
                current_orders: [],
                daily_order_summary: [],
                product_breakdown: [],
                recent_orders: [],
                customer_analysis: {
                    total_customers: 0,
                    repeat_customers: 0,
                    new_customers: 0
                },
                efficiency_metrics: {
                    completion_rate: 0,
                    avg_completion_time: 0,
                    total_orders: 0,
                    on_time_delivery: 0
                },
                capacity_utilization: {
                    active_orders: 0,
                    max_capacity: 0,
                    processing_rate: 0,
                    workforce_utilization: 0
                },
                orders: []
            });
        } finally {
            setTabLoadingStates(prev => ({ ...prev, madeToOrder: false }));
        }
    };

    // Fetch production output analytics
    const fetchProductionOutputData = async () => {
        setTabLoadingStates(prev => ({ ...prev, output: true }));
        
        try {
            const params = {
                start_date: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0]
            };

            const response = await api.get('/production/output-analytics', { params });
            setProductionOutputData(response.data);

        } catch (error) {
            console.error('Error fetching production output data:', error);
            toast.error('Failed to load production output data');
        } finally {
            setTabLoadingStates(prev => ({ ...prev, output: false }));
        }
    };

    // Fetch all products for work progress
    const fetchAllProducts = async () => {
        try {
            const response = await api.get('/products');
            const products = response.data || [];
            
            // Enhance products with production status
            const enhancedProducts = products.map(product => {
                const categoryName = product.category_name || '';
                const productName = (product.name || product.product_name || '').toLowerCase();
                const isAlkansya = categoryName === 'Stocked Products' && 
                    (productName.includes('alkansya'));
                const isMTO = categoryName === 'Made to Order' || categoryName === 'made_to_order';
                
                // Default values
                let status = 'Not Started';
                let progress = 0;
                let completedToday = 0;
                let completedForOrder = 0;
                let lastUpdatedBy = null;
                let lastUpdatedAt = null;
                
                return {
                    ...product,
                    category: isAlkansya ? 'Alkansya' : isMTO ? 'Made-to-Order' : 'Other',
                    status,
                    progress,
                    completedToday,
                    completedForOrder,
                    lastUpdatedBy,
                    lastUpdatedAt
                };
            });
            
            setAllProducts(enhancedProducts);
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error('Failed to load products');
            setAllProducts([]);
        }
    };

    // Fetch Alkansya daily output
    const fetchAlkansyaDailyOutputData = async () => {
        try {
            const response = await api.get('/alkansya-daily-output');
            // Handle different response formats
            let outputData = [];
            if (Array.isArray(response.data)) {
                outputData = response.data;
            } else if (response.data?.data && Array.isArray(response.data.data)) {
                outputData = response.data.data;
            } else if (response.data && typeof response.data === 'object') {
                // Try to extract array from response
                outputData = Object.values(response.data).find(val => Array.isArray(val)) || [];
            }
            
            // Sort by date descending
            const sortedData = outputData.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB - dateA;
            });
            
            setAlkansyaDailyOutput(sortedData);
        } catch (error) {
            console.error('Error fetching Alkansya daily output:', error);
            toast.error('Failed to load Alkansya daily output');
            setAlkansyaDailyOutput([]);
        }
    };

    // Fetch Made-to-Order orders with production status
    const fetchMTOOrders = async () => {
        try {
            // Fetch accepted orders
            const ordersResponse = await api.get('/orders/accepted');
            const orders = ordersResponse.data?.data || ordersResponse.data || [];
            
            // Filter for Made-to-Order products and enhance with production data
            const mtoOrdersData = [];
            
            for (const order of orders) {
                if (order.items && Array.isArray(order.items)) {
                    for (const item of order.items) {
                        const product = item.product || {};
                        const categoryName = product.category_name || '';
                        const isMTO = categoryName === 'Made to Order' || categoryName === 'made_to_order';
                        
                        if (isMTO) {
                            // Fetch production status for this order
                            let productionStatus = 'Not Accepted';
                            let completedQuantity = 0;
                            let requiredQuantity = item.quantity || 0;
                            let progress = 0;
                            let deadline = null;
                            let lastUpdatedAt = order.updated_at || order.created_at;
                            
                            try {
                                const statusResponse = await api.get(`/orders/${order.id}/production-status`);
                                const statusData = statusResponse.data;
                                
                                if (statusData.isCompleted) {
                                    productionStatus = 'Completed';
                                    progress = 100;
                                    completedQuantity = requiredQuantity;
                                } else if (statusData.progress !== undefined) {
                                    productionStatus = 'In Progress';
                                    progress = statusData.progress || 0;
                                    completedQuantity = Math.round((progress / 100) * requiredQuantity);
                                } else {
                                    productionStatus = 'Not Started';
                                }
                                
                                // Calculate deadline (14 days from acceptance)
                                if (order.accepted_at) {
                                    const acceptedDate = new Date(order.accepted_at);
                                    acceptedDate.setDate(acceptedDate.getDate() + 14);
                                    deadline = acceptedDate.toISOString().split('T')[0];
                                }
                            } catch (err) {
                                console.warn(`Could not fetch production status for order ${order.id}:`, err);
                            }
                            
                            mtoOrdersData.push({
                                orderId: order.id,
                                orderNumber: order.order_number || `ORD-${order.id}`,
                                productName: product.name || product.product_name || 'N/A',
                                productId: product.id,
                                requiredQuantity,
                                completedQuantity,
                                progress,
                                deadline,
                                status: productionStatus,
                                lastUpdatedAt,
                                order: order
                            });
                        }
                    }
                }
            }
            
            setMtoOrders(mtoOrdersData);
        } catch (error) {
            console.error('Error fetching MTO orders:', error);
            toast.error('Failed to load Made-to-Order orders');
            setMtoOrders([]);
        }
    };

    // Lazy loading function for each tab
    const loadTabData = async (tabName) => {
        setTabLoadingStates(prev => ({ ...prev, [tabName]: true }));
        
        // Simulate 2-second delay for fast loading experience
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
            const dateRange = {
                start_date: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0]
            };

            switch (tabName) {
                case 'overview':
                    // Fetch both Alkansya and Made-to-Order data for comprehensive overview
                    await fetchAlkansyaProductionData();
                    await fetchMadeToOrderProductionData();
                    await fetchProductionOverview();
                    break;
                    
                case 'output':
                    // Use accurate production output analytics
                    await fetchProductionOutputData();
                    break;
                    
                case 'madeToOrder':
                    // Use accurate Made-to-Order production data
                    await fetchMadeToOrderProductionData();
                    break;
                    
                case 'alkansya':
                    // Use accurate Alkansya production data
                    await fetchAlkansyaProductionData();
                    break;
                    
                case 'analytics':
                    // Fetch Alkansya production data for analytics
                    await fetchAlkansyaProductionData();
                    // Fetch Made-to-Order production data for analytics
                    await fetchMadeToOrderProductionData();
                    break;
                    
                case 'productionPerformance':
                    // Fetch all data for production performance report
                    await fetchAlkansyaProductionData();
                    await fetchMadeToOrderProductionData();
                    await fetchProductionOverview();
                    await fetchProductionOutputData();
                    await fetchProductPerformanceData();
                    break;
                    
                case 'workProgress':
                    // Fetch all data for work progress report
                    await fetchAllProducts();
                    await fetchAlkansyaDailyOutputData();
                    await fetchMTOOrders();
                    await fetchAlkansyaProductionData();
                    await fetchMadeToOrderProductionData();
                    await fetchProductionOverview();
                    break;
                    
                case 'efficiency':
                    // Fetch Alkansya production data for efficiency metrics
                    await fetchAlkansyaProductionData();
                    // Fetch Made-to-Order production data for efficiency metrics
                    await fetchMadeToOrderProductionData();
                    break;
                    
                case 'utilization':
                    // Fetch Alkansya production data for resource utilization
                    await fetchAlkansyaProductionData();
                    // Fetch Made-to-Order production data for resource utilization
                    await fetchMadeToOrderProductionData();
                    break;
                    
                case 'stages':
                    const stagesResponse = await api.get('/production/stage-breakdown', { params: dateRange });
                    setStageBreakdown(stagesResponse.data);
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
                    <h5>Loading Production Reports...</h5>
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
        <div className="enhanced-production-reports">
            {/* Enhanced Navigation Tabs - Horizontal Layout like Inventory Reports */}
            <div className="mb-4">
                <ul className="nav nav-pills nav-fill" role="tablist">
                    {[
                        { id: 'overview', name: 'Overview', icon: FaChartLine, color: colors.primary },
                        { id: 'productionPerformance', name: 'Production Performance', icon: FaTachometerAlt, color: '#8B4513' },
                        { id: 'workProgress', name: 'Work Progress', icon: FaTasks, color: '#6B4423' },
                        { id: 'output', name: 'Production Output', icon: FaIndustry, color: colors.secondary },
                        { id: 'madeToOrder', name: 'Made-to-Order', icon: FaClipboardList, color: colors.accent },
                        { id: 'alkansya', name: 'Alkansya Output', icon: FaBoxes, color: colors.success },
                        { id: 'analytics', name: 'Analytics', icon: FaChartBar, color: colors.info },
                        { id: 'efficiency', name: 'Efficiency', icon: FaChartLine, color: colors.warning },
                        { id: 'utilization', name: 'Resources', icon: FaCogs, color: colors.dark },
                        { id: 'stages', name: 'Stages', icon: FaHistory, color: colors.danger }
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

            {/* Enhanced Production Overview Tab */}
            {activeTab === 'overview' && (
                <div className="row">
                    {tabLoadingStates.overview ? (
                        <div className="col-12">
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary mb-3" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <h5>Loading Production Overview...</h5>
                                <p className="text-muted">Analyzing Alkansya and Made-to-Order production data</p>
                            </div>
                        </div>
                    ) : productionOverview ? (
                        <>
                            {/* Overall Production Metrics */}
                            <div className="col-12 mb-4">
                                <div className="row">
                                    <div className="col-lg-3 col-md-6 mb-4">
                                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.primary}15, ${colors.secondary}15)` }}>
                                            <div className="card-body text-center p-4">
                                                <div className="d-flex align-items-center justify-content-center mb-3">
                                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.primary}20` }}>
                                                        <FaIndustry style={{ color: colors.primary }} className="fs-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="mb-0 fw-bold" style={{ color: colors.primary }}>
                                                            {productionOverview?.overall?.total_units_produced || 0}
                                                        </h3>
                                                        <small className="text-muted fw-medium">Total Units Produced</small>
                                                    </div>
                                                </div>
                                                <p className="text-muted small mb-0">
                                                    Last {windowDays} days
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-lg-3 col-md-6 mb-4">
                                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.success}15, ${colors.info}15)` }}>
                                            <div className="card-body text-center p-4">
                                                <div className="d-flex align-items-center justify-content-center mb-3">
                                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.success}20` }}>
                                                        <FaBoxes style={{ color: colors.success }} className="fs-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="mb-0 fw-bold" style={{ color: colors.success }}>
                                                            {productionOverview?.alkansya?.total_units_produced || 0}
                                                        </h3>
                                                        <small className="text-muted fw-medium">Alkansya Units</small>
                                                    </div>
                                                </div>
                                                <p className="text-muted small mb-0">
                                                    Daily production output
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-lg-3 col-md-6 mb-4">
                                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.accent}15, ${colors.warning}15)` }}>
                                            <div className="card-body text-center p-4">
                                                <div className="d-flex align-items-center justify-content-center mb-3">
                                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.accent}20` }}>
                                                        <FaClipboardList style={{ color: colors.accent }} className="fs-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="mb-0 fw-bold" style={{ color: colors.accent }}>
                                                            {productionOverview?.made_to_order?.total_products_ordered || 0}
                                                        </h3>
                                                        <small className="text-muted fw-medium">Made-to-Order Units</small>
                                                    </div>
                                                </div>
                                                <p className="text-muted small mb-0">
                                                    Custom order products
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-lg-3 col-md-6 mb-4">
                                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.info}15, ${colors.primary}15)` }}>
                                            <div className="card-body text-center p-4">
                                                <div className="d-flex align-items-center justify-content-center mb-3">
                                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.info}20` }}>
                                                        <FaChartLine style={{ color: colors.info }} className="fs-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="mb-0 fw-bold" style={{ color: colors.info }}>
                                                            {productionOverview?.overall?.production_efficiency || 0}%
                                                        </h3>
                                                        <small className="text-muted fw-medium">Efficiency</small>
                                                    </div>
                                                </div>
                                                <p className="text-muted small mb-0">
                                                    Overall production efficiency
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Download Reports Section */}
                            <div className="col-12 mb-4">
                                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', background: 'white' }}>
                                    <div className="card-body p-4">
                                        <div className="d-flex align-items-center mb-3">
                                            <div className="rounded-circle bg-primary bg-opacity-10 p-3 me-3">
                                                <i className="fas fa-file-export text-primary" style={{ fontSize: '24px' }}></i>
                                            </div>
                                            <div>
                                                <h5 className="mb-0 fw-bold">Automated Reports & Analytics</h5>
                                                <small className="text-muted">Download comprehensive production reports</small>
                                            </div>
                                        </div>
                                        <p className="text-muted mb-4">Generate detailed reports for production performance, work progress, and efficiency metrics</p>
                                        
                                        {/* Minimalist Report Filters */}
                                        <div className="mb-4">
                                            <div className="card border shadow-sm" style={{ borderRadius: '12px' }}>
                                                <div className="card-body p-3">
                                                    <div className="d-flex align-items-center mb-3">
                                                        <i className="fas fa-filter text-primary me-2"></i>
                                                        <h6 className="mb-0 fw-bold">Report Filters</h6>
                                                        <small className="text-muted ms-2">(Applies to all reports)</small>
                                                    </div>
                                                    
                                                    <div className="row g-2 align-items-end">
                                                        {/* Date Range */}
                                                        <div className="col-lg-2 col-md-3 col-sm-6">
                                                            <label className="form-label small fw-semibold mb-1 d-flex align-items-center">
                                                                <i className="fas fa-calendar-alt me-1 text-primary"></i>
                                                                Date Range
                                                            </label>
                                                            <select
                                                                className="form-select form-select-sm"
                                                                value={reportDateRange}
                                                                onChange={(e) => {
                                                                    setReportDateRange(e.target.value);
                                                                    if (e.target.value !== 'custom') {
                                                                        setReportStartDate('');
                                                                        setReportEndDate('');
                                                                    }
                                                                }}
                                                            >
                                                                <option value="days">Days</option>
                                                                <option value="weeks">Weeks</option>
                                                                <option value="months">Months</option>
                                                                <option value="year">Year</option>
                                                                <option value="custom">Custom Range</option>
                                                            </select>
                                                        </div>
                                                        
                                                        {/* Period */}
                                                        {reportDateRange !== 'custom' && reportDateRange !== 'year' && (
                                                            <div className="col-lg-1 col-md-2 col-sm-6">
                                                                <label className="form-label small fw-semibold mb-1 d-flex align-items-center">
                                                                    <i className="fas fa-hashtag me-1 text-primary"></i>
                                                                    Period
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    className="form-control form-control-sm"
                                                                    value={reportDateValue}
                                                                    onChange={(e) => setReportDateValue(parseInt(e.target.value) || 1)}
                                                                    min="1"
                                                                    style={{ height: '31px' }}
                                                                />
                                                            </div>
                                                        )}
                                                        
                                                        {/* Custom Dates */}
                                                        {reportDateRange === 'custom' && (
                                                            <>
                                                                <div className="col-lg-2 col-md-3 col-sm-6">
                                                                    <label className="form-label small fw-semibold mb-1 d-flex align-items-center">
                                                                        <i className="fas fa-calendar-check me-1 text-primary"></i>
                                                                        Start Date
                                                                    </label>
                                                                    <input
                                                                        type="date"
                                                                        className="form-control form-control-sm"
                                                                        value={reportStartDate}
                                                                        onChange={(e) => setReportStartDate(e.target.value)}
                                                                        style={{ height: '31px' }}
                                                                    />
                                                                </div>
                                                                <div className="col-lg-2 col-md-3 col-sm-6">
                                                                    <label className="form-label small fw-semibold mb-1 d-flex align-items-center">
                                                                        <i className="fas fa-calendar-times me-1 text-primary"></i>
                                                                        End Date
                                                                    </label>
                                                                    <input
                                                                        type="date"
                                                                        className="form-control form-control-sm"
                                                                        value={reportEndDate}
                                                                        onChange={(e) => setReportEndDate(e.target.value)}
                                                                        style={{ height: '31px' }}
                                                                    />
                                                                </div>
                                                            </>
                                                        )}
                                                        
                                                        {/* Category */}
                                                        <div className="col-lg-2 col-md-3 col-sm-6">
                                                            <label className="form-label small fw-semibold mb-1 d-flex align-items-center">
                                                                <i className="fas fa-tags me-1 text-primary"></i>
                                                                Category
                                                            </label>
                                                            <select
                                                                className="form-select form-select-sm"
                                                                value={reportCategoryFilter}
                                                                onChange={(e) => setReportCategoryFilter(e.target.value)}
                                                            >
                                                                <option value="all">All Categories</option>
                                                                <option value="alkansya">Alkansya</option>
                                                                <option value="made_to_order">Made to Order</option>
                                                            </select>
                                                        </div>
                                                        
                                                        {/* Status */}
                                                        <div className="col-lg-2 col-md-3 col-sm-6">
                                                            <label className="form-label small fw-semibold mb-1 d-flex align-items-center">
                                                                <i className="fas fa-info-circle me-1 text-primary"></i>
                                                                Status
                                                            </label>
                                                            <select
                                                                className="form-select form-select-sm"
                                                                value={reportStatusFilter}
                                                                onChange={(e) => setReportStatusFilter(e.target.value)}
                                                            >
                                                                <option value="all">All Status</option>
                                                                <option value="in_progress">In Progress</option>
                                                                <option value="completed">Completed</option>
                                                                <option value="pending">Pending</option>
                                                            </select>
                                                        </div>
                                                        
                                                        {/* Apply Button */}
                                                        <div className="col-lg-2 col-md-3 col-sm-6">
                                                            <button
                                                                className="btn btn-primary btn-sm w-100 d-flex align-items-center justify-content-center"
                                                                onClick={() => {
                                                                    const dateRange = getDateRange();
                                                                    console.log('Filters applied:', { dateRange, reportCategoryFilter, reportStatusFilter });
                                                                    toast.success('Filters applied to all reports!');
                                                                }}
                                                            >
                                                                <i className="fas fa-check me-1"></i>
                                                                Apply Filters
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* CSV Reports Section */}
                                        <div className="mb-4">
                                            <div className="d-flex align-items-center mb-3">
                                                <div style={{ 
                                                    width: '3px', 
                                                    height: '18px', 
                                                    background: 'linear-gradient(135deg, #0d6efd, #0a58ca)',
                                                    borderRadius: '2px',
                                                    marginRight: '8px'
                                                }}></div>
                                                <h6 className="mb-0 fw-bold" style={{ color: '#0d6efd', fontSize: '0.9rem' }}>
                                                    CSV Reports
                                                </h6>
                                            </div>
                                            
                                            <div className="row g-3">
                                                {/* Production Performance Report */}
                                                <div className="col-md-4">
                                                    <div className="card border-0 shadow-sm h-100" style={{ 
                                                        background: 'linear-gradient(135deg, rgba(139, 69, 19, 0.05), rgba(139, 69, 19, 0.02))',
                                                        borderRadius: '12px',
                                                        border: '1px solid rgba(139, 69, 19, 0.1)'
                                                    }}>
                                                        <div className="card-body p-3">
                                                            <div className="d-flex align-items-center mb-3">
                                                                <div className="rounded-circle p-2 me-2" style={{ 
                                                                    background: 'linear-gradient(135deg, #8B4513, #6B4423)',
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    <FaTachometerAlt className="text-white" style={{ fontSize: '14px' }} />
                                                                </div>
                                                                <h6 className="mb-0 fw-bold" style={{ color: '#8B4513', fontSize: '0.85rem' }}>
                                                                    Production Performance Report
                                                                </h6>
                                                            </div>
                                                            <div className="btn-group w-100" role="group">
                                                                <button 
                                                                    className="btn btn-outline-primary"
                                                                    onClick={() => previewReport('performance')}
                                                                    style={{ borderRadius: '8px 0 0 8px', transition: 'all 0.3s', borderWidth: '2px', flex: 1 }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#8B4513';
                                                                        e.currentTarget.style.color = 'white';
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                                        e.currentTarget.style.color = '#8B4513';
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                    }}
                                                                >
                                                                    <i className="fas fa-eye me-2"></i>
                                                                    Preview
                                                                </button>
                                                                <button 
                                                                    className="btn btn-primary"
                                                                    onClick={() => downloadReport('performance')}
                                                                    style={{ borderRadius: '0 8px 8px 0', transition: 'all 0.3s', flex: 1, backgroundColor: '#8B4513', borderColor: '#8B4513' }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#6B3410';
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#8B4513';
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                    }}
                                                                >
                                                                    <i className="fas fa-file-csv me-2"></i>
                                                                    CSV
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Work Progress Report */}
                                                <div className="col-md-4">
                                                    <div className="card border-0 shadow-sm h-100" style={{ 
                                                        background: 'linear-gradient(135deg, rgba(23, 162, 184, 0.05), rgba(23, 162, 184, 0.02))',
                                                        borderRadius: '12px',
                                                        border: '1px solid rgba(23, 162, 184, 0.1)'
                                                    }}>
                                                        <div className="card-body p-3">
                                                            <div className="d-flex align-items-center mb-3">
                                                                <div className="rounded-circle p-2 me-2" style={{ 
                                                                    background: 'linear-gradient(135deg, #17a2b8, #138496)',
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    <FaTasks className="text-white" style={{ fontSize: '14px' }} />
                                                                </div>
                                                                <h6 className="mb-0 fw-bold" style={{ color: '#17a2b8', fontSize: '0.85rem' }}>
                                                                    Work Progress Report
                                                                </h6>
                                                            </div>
                                                            <div className="btn-group w-100" role="group">
                                                                <button 
                                                                    className="btn btn-outline-info"
                                                                    onClick={() => previewReport('workprogress')}
                                                                    style={{ borderRadius: '8px 0 0 8px', transition: 'all 0.3s', borderWidth: '2px', flex: 1 }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#17a2b8';
                                                                        e.currentTarget.style.color = 'white';
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                                        e.currentTarget.style.color = '#17a2b8';
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                    }}
                                                                >
                                                                    <i className="fas fa-eye me-2"></i>
                                                                    Preview
                                                                </button>
                                                                <button 
                                                                    className="btn btn-info"
                                                                    onClick={() => downloadReport('workprogress')}
                                                                    style={{ borderRadius: '0 8px 8px 0', transition: 'all 0.3s', flex: 1 }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#138496';
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#17a2b8';
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                    }}
                                                                >
                                                                    <i className="fas fa-file-csv me-2"></i>
                                                                    CSV
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>

                                        {/* PDF Reports Section */}
                                        <div>
                                            <div className="d-flex align-items-center mb-3">
                                                <div style={{ 
                                                    width: '3px', 
                                                    height: '18px', 
                                                    background: 'linear-gradient(135deg, #dc3545, #c82333)',
                                                    borderRadius: '2px',
                                                    marginRight: '8px'
                                                }}></div>
                                                <h6 className="mb-0 fw-bold" style={{ color: '#dc3545', fontSize: '0.9rem' }}>
                                                    PDF Reports
                                                </h6>
                                            </div>
                                            
                                            <div className="row g-3">
                                                {/* Production Performance Report PDF */}
                                                <div className="col-md-4">
                                                    <div className="card border-0 shadow-sm h-100" style={{ 
                                                        background: 'linear-gradient(135deg, rgba(220, 53, 69, 0.05), rgba(220, 53, 69, 0.02))',
                                                        borderRadius: '12px',
                                                        border: '1px solid rgba(220, 53, 69, 0.1)'
                                                    }}>
                                                        <div className="card-body p-3">
                                                            <div className="d-flex align-items-center mb-3">
                                                                <div className="rounded-circle p-2 me-2" style={{ 
                                                                    background: 'linear-gradient(135deg, #dc3545, #c82333)',
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    <FaTachometerAlt className="text-white" style={{ fontSize: '14px' }} />
                                                                </div>
                                                                <h6 className="mb-0 fw-bold" style={{ color: '#dc3545', fontSize: '0.85rem' }}>
                                                                    Production Performance Report
                                                                </h6>
                                                            </div>
                                                            <div className="btn-group w-100" role="group">
                                                                <button 
                                                                    className="btn btn-outline-danger"
                                                                    onClick={() => previewPdfReport('performance')}
                                                                    style={{ borderRadius: '8px 0 0 8px', transition: 'all 0.3s', borderWidth: '2px', flex: 1 }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#dc3545';
                                                                        e.currentTarget.style.color = 'white';
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                                        e.currentTarget.style.color = '#dc3545';
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                    }}
                                                                >
                                                                    <i className="fas fa-eye me-2"></i>
                                                                    Preview
                                                                </button>
                                                                <button 
                                                                    className="btn btn-danger"
                                                                    onClick={() => downloadPdfReport('performance')}
                                                                    style={{ borderRadius: '0 8px 8px 0', transition: 'all 0.3s', flex: 1 }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#c82333';
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#dc3545';
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                    }}
                                                                >
                                                                    <i className="fas fa-file-pdf me-2"></i>
                                                                    PDF
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Work Progress Report PDF */}
                                                <div className="col-md-4">
                                                    <div className="card border-0 shadow-sm h-100" style={{ 
                                                        background: 'linear-gradient(135deg, rgba(220, 53, 69, 0.05), rgba(220, 53, 69, 0.02))',
                                                        borderRadius: '12px',
                                                        border: '1px solid rgba(220, 53, 69, 0.1)'
                                                    }}>
                                                        <div className="card-body p-3">
                                                            <div className="d-flex align-items-center mb-3">
                                                                <div className="rounded-circle p-2 me-2" style={{ 
                                                                    background: 'linear-gradient(135deg, #dc3545, #c82333)',
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    <FaTasks className="text-white" style={{ fontSize: '14px' }} />
                                                                </div>
                                                                <h6 className="mb-0 fw-bold" style={{ color: '#dc3545', fontSize: '0.85rem' }}>
                                                                    Work Progress Report
                                                                </h6>
                                                            </div>
                                                            <div className="btn-group w-100" role="group">
                                                                <button 
                                                                    className="btn btn-outline-danger"
                                                                    onClick={() => previewPdfReport('workprogress')}
                                                                    style={{ borderRadius: '8px 0 0 8px', transition: 'all 0.3s', borderWidth: '2px', flex: 1 }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#dc3545';
                                                                        e.currentTarget.style.color = 'white';
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                                        e.currentTarget.style.color = '#dc3545';
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                    }}
                                                                >
                                                                    <i className="fas fa-eye me-2"></i>
                                                                    Preview
                                                                </button>
                                                                <button 
                                                                    className="btn btn-danger"
                                                                    onClick={() => downloadPdfReport('workprogress')}
                                                                    style={{ borderRadius: '0 8px 8px 0', transition: 'all 0.3s', flex: 1 }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#c82333';
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#dc3545';
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                    }}
                                                                >
                                                                    <i className="fas fa-file-pdf me-2"></i>
                                                                    PDF
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Alkansya Daily Output - Enhanced Display */}
                            <div className="col-12 mb-4">
                                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                    <div className="card-header bg-white border-0" style={{ borderRadius: '12px 12px 0 0', borderBottom: '3px solid #28a745' }}>
                                        <h5 className="mb-0 d-flex align-items-center">
                                            <i className="fas fa-box text-success me-2" style={{ fontSize: '24px' }}></i>
                                            Alkansya Daily Production Output
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-8">
                                                <div className="row mb-3">
                                                    <div className="col-6">
                                                        <div className="text-center">
                                                            <h4 className="text-success mb-1">{productionOverview?.alkansya?.average_daily_output || 0}</h4>
                                                            <small className="text-muted">Avg Daily Output</small>
                                                        </div>
                                                    </div>
                                                    <div className="col-6">
                                                        <div className="text-center">
                                                            <h4 className="text-info mb-1">{productionOverview?.alkansya?.total_days || 0}</h4>
                                                            <small className="text-muted">Production Days</small>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mb-3">
                                                    <div className="d-flex justify-content-between mb-1">
                                                        <span>Production Trend</span>
                                                        <span className={`badge ${
                                                            productionOverview?.alkansya?.production_trend === 'increasing' ? 'bg-success' :
                                                            productionOverview?.alkansya?.production_trend === 'decreasing' ? 'bg-danger' :
                                                            'bg-secondary'
                                                        }`}>
                                                            {productionOverview?.alkansya?.production_trend || 'stable'}
                                                        </span>
                                                    </div>
                                                    <div className="d-flex justify-content-between mb-1">
                                                        <span>Max Daily Output</span>
                                                        <span className="fw-bold">{productionOverview?.alkansya?.max_daily_output || 0}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between">
                                                        <span>Min Daily Output</span>
                                                        <span className="fw-bold">{productionOverview?.alkansya?.min_daily_output || 0}</span>
                                                    </div>
                                                </div>
                                                <div className="mt-3">
                                                    <h6 className="text-muted mb-2">Recent Production</h6>
                                                    <div className="table-responsive">
                                                        <table className="table table-sm">
                                                            <thead>
                                                                <tr>
                                                                    <th>Date</th>
                                                                    <th>Units</th>
                                                                    <th>By</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {productionOverview.alkansya.recent_output?.slice(0, 5).map((output, index) => (
                                                                    <tr key={index}>
                                                                        <td>{output.date}</td>
                                                                        <td className="text-success fw-bold">{output.quantity}</td>
                                                                        <td className="text-muted">{output.produced_by}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                                
                                                {/* Summary Stats Row */}
                                                <div className="row mt-4">
                                                    <div className="col-4">
                                                        <div className="text-center p-3 rounded" style={{ backgroundColor: '#e8f5e9' }}>
                                                            <div className="d-flex align-items-center justify-content-center mb-2">
                                                                <i className="fas fa-arrow-up text-success" style={{ fontSize: '24px' }}></i>
                                                            </div>
                                                            <h4 className="text-success mb-1">{productionOverview?.alkansya?.max_daily_output || 0}</h4>
                                                            <small className="text-muted">Max Daily</small>
                                                        </div>
                                                    </div>
                                                    <div className="col-4">
                                                        <div className="text-center p-3 rounded" style={{ backgroundColor: '#fff3e0' }}>
                                                            <div className="d-flex align-items-center justify-content-center mb-2">
                                                                <i className="fas fa-arrow-down text-warning" style={{ fontSize: '24px' }}></i>
                                                            </div>
                                                            <h4 className="text-warning mb-1">{productionOverview?.alkansya?.min_daily_output || 0}</h4>
                                                            <small className="text-muted">Min Daily</small>
                                                        </div>
                                                    </div>
                                                    <div className="col-4">
                                                        <div className="text-center p-3 rounded" style={{ backgroundColor: '#e3f2fd' }}>
                                                            <div className="d-flex align-items-center justify-content-center mb-2">
                                                                <i className="fas fa-chart-line text-info" style={{ fontSize: '24px' }}></i>
                                                            </div>
                                                            <h4 className="text-info mb-1">
                                                                <span className={`badge ${
                                                                    productionOverview?.alkansya?.production_trend === 'increasing' ? 'bg-success' :
                                                                    productionOverview?.alkansya?.production_trend === 'decreasing' ? 'bg-danger' :
                                                                    'bg-secondary'
                                                                }`}>
                                                                    {productionOverview?.alkansya?.production_trend || 'stable'}
                                                                </span>
                                                            </h4>
                                                            <small className="text-muted">Trend</small>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Recent Production Table */}
                                            <div className="col-md-4">
                                                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                                                    <div className="card-header bg-light border-0">
                                                        <h6 className="mb-0">
                                                            <i className="fas fa-history text-success me-2"></i>
                                                            Recent Production
                                                        </h6>
                                                    </div>
                                                    <div className="card-body p-0">
                                                        <div className="table-responsive" style={{ maxHeight: '280px' }}>
                                                            <table className="table table-sm table-hover mb-0">
                                                                <thead className="table-light">
                                                                    <tr>
                                                                        <th>Date</th>
                                                                        <th>Qty</th>
                                                                        <th>By</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {productionOverview?.alkansya?.recent_output?.slice(0, 6).map((output, index) => (
                                                                        <tr key={index}>
                                                                            <td>
                                                                                <small>{output.date}</small>
                                                                            </td>
                                                                            <td>
                                                                                <span className="badge bg-success" style={{ borderRadius: '8px' }}>
                                                                                    {output.quantity}
                                                                                </span>
                                                                            </td>
                                                                            <td>
                                                                                <small className="text-muted">{output.produced_by}</small>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Made-to-Order Products - Enhanced Display */}
                            <div className="col-12 mb-4">
                                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                    <div className="card-header bg-white border-0" style={{ borderRadius: '12px 12px 0 0', borderBottom: '3px solid #CD853F' }}>
                                        <h5 className="mb-0 d-flex align-items-center">
                                            <i className="fas fa-clipboard-list text-warning me-2" style={{ fontSize: '24px' }}></i>
                                            Made-to-Order Products Overview
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-4 mb-3">
                                                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #CD853F15, #F5DEB315)' }}>
                                                    <div className="card-body text-center">
                                                        <div className="mb-3">
                                                            <div className="rounded-circle bg-warning bg-opacity-20 d-inline-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px' }}>
                                                                <i className="fas fa-clipboard-list text-warning fa-2x"></i>
                                                            </div>
                                                        </div>
                                                        <h3 className="text-warning mb-2">{productionOverview?.made_to_order?.total_orders || 0}</h3>
                                                        <h6 className="text-muted mb-3">Total Orders</h6>
                                                        <div className="d-flex justify-content-between">
                                                            <span className="text-muted">Unique Products</span>
                                                            <span className="fw-bold">{productionOverview?.made_to_order?.unique_products || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="col-md-4 mb-3">
                                                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #17a2b815, #4169E115)' }}>
                                                    <div className="card-body text-center">
                                                        <div className="mb-3">
                                                            <div className="rounded-circle bg-info bg-opacity-20 d-inline-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px' }}>
                                                                <i className="fas fa-peso-sign text-info fa-2x"></i>
                                                            </div>
                                                        </div>
                                                        <h3 className="text-info mb-2">₱{productionOverview?.made_to_order?.total_revenue?.toLocaleString() || 0}</h3>
                                                        <h6 className="text-muted mb-3">Total Revenue</h6>
                                                        <div className="d-flex justify-content-between">
                                                            <span className="text-muted">Avg Order Value</span>
                                                            <span className="fw-bold">₱{productionOverview?.made_to_order?.average_order_value?.toLocaleString() || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="col-md-4 mb-3">
                                                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                                                    <div className="card-body">
                                                        <h6 className="text-muted mb-3">Order Status Breakdown</h6>
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <div className="d-flex align-items-center">
                                                                <i className="fas fa-check-circle text-success me-2"></i>
                                                                <span className="text-muted">Completed</span>
                                                            </div>
                                                            <span className="badge bg-success" style={{ borderRadius: '8px', fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                                                                {productionOverview?.made_to_order?.order_status_breakdown?.completed || 0}
                                                            </span>
                                                        </div>
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <div className="d-flex align-items-center">
                                                                <i className="fas fa-hourglass-half text-warning me-2"></i>
                                                                <span className="text-muted">In Progress</span>
                                                            </div>
                                                            <span className="badge bg-warning" style={{ borderRadius: '8px', fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                                                                {productionOverview?.made_to_order?.order_status_breakdown?.in_progress || 0}
                                                            </span>
                                                        </div>
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <div className="d-flex align-items-center">
                                                                <i className="fas fa-clock text-info me-2"></i>
                                                                <span className="text-muted">Pending</span>
                                                            </div>
                                                            <span className="badge bg-info" style={{ borderRadius: '8px', fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                                                                {productionOverview?.made_to_order?.order_status_breakdown?.pending || 0}
                                                            </span>
                                                        </div>
                                                        <div className="d-flex justify-content-between align-items-center">
                                                            <div className="d-flex align-items-center">
                                                                <i className="fas fa-times-circle text-danger me-2"></i>
                                                                <span className="text-muted">Cancelled</span>
                                                            </div>
                                                            <span className="badge bg-danger" style={{ borderRadius: '8px', fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                                                                {productionOverview?.made_to_order?.order_status_breakdown?.cancelled || 0}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Current In-Progress Made-to-Order Orders */}
                            {(madeToOrderProductionData?.current_orders?.length > 0 || alkansyaProductionData?.recent_productions?.length > 0) && (
                                <div className="col-12 mb-4">
                                    <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                        <div className="card-header bg-white border-0" style={{ borderRadius: '12px 12px 0 0', borderBottom: '3px solid #ffc107' }}>
                                            <h5 className="mb-0 d-flex align-items-center">
                                                <i className="fas fa-cog fa-spin text-warning me-2" style={{ fontSize: '24px' }}></i>
                                                Current In-Progress Production
                                            </h5>
                                        </div>
                                        <div className="card-body">
                                            {madeToOrderProductionData?.current_orders?.length > 0 && (
                                                <div className="mb-4">
                                                    <h6 className="text-muted mb-3 d-flex align-items-center">
                                                        <i className="fas fa-clipboard-list text-warning me-2"></i>
                                                        Made-to-Order Orders in Production
                                                    </h6>
                                                    <div className="table-responsive">
                                                        <table className="table table-hover table-sm">
                                                            <thead className="table-light">
                                                                <tr>
                                                                    <th>Order ID</th>
                                                                    <th>Product</th>
                                                                    <th>Quantity</th>
                                                                    <th>Customer</th>
                                                                    <th>Production Stage</th>
                                                                    <th>Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {madeToOrderProductionData.current_orders.map((order, index) => (
                                                                    <tr key={index}>
                                                                        <td className="fw-bold">#{order.id}</td>
                                                                        <td>{order.product_name || 'N/A'}</td>
                                                                        <td><span className="badge bg-primary">{order.quantity || 0}</span></td>
                                                                        <td>{order.customer_name || 'N/A'}</td>
                                                                        <td>
                                                                            <span className="badge bg-info">{order.production_stage || 'In Progress'}</span>
                                                                        </td>
                                                                        <td>
                                                                            <span className="badge bg-warning">In Progress</span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {alkansyaProductionData?.recent_productions?.length > 0 && (
                                                <div>
                                                    <h6 className="text-muted mb-3 d-flex align-items-center">
                                                        <i className="fas fa-box text-success me-2"></i>
                                                        Recent Alkansya Daily Output
                                                    </h6>
                                                    <div className="table-responsive">
                                                        <table className="table table-hover table-sm">
                                                            <thead className="table-light">
                                                                <tr>
                                                                    <th>Date</th>
                                                                    <th>Quantity Produced</th>
                                                                    <th>Produced By</th>
                                                                    <th>Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {alkansyaProductionData.recent_productions.slice(0, 5).map((output, index) => (
                                                                    <tr key={index}>
                                                                        <td>{output.date || output.output_date}</td>
                                                                        <td className="text-success fw-bold">{output.quantity || output.quantity_produced || 0}</td>
                                                                        <td>{output.produced_by || 'N/A'}</td>
                                                                        <td><span className="badge bg-success">Completed</span></td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Production Charts */}
                            <div className="col-12 mb-4">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-header bg-white border-0">
                                        <h5 className="mb-0 d-flex align-items-center">
                                            <FaChartLine className="me-2" style={{ color: colors.primary }} />
                                            Daily Production Comparison
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={productionOverview.daily_summary}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" />
                                                <YAxis />
                                                <Tooltip />
                                                <Legend />
                                                <Line type="monotone" dataKey="alkansya_units" stroke={colors.success} strokeWidth={2} name="Alkansya Units" />
                                                <Line type="monotone" dataKey="made_to_order_units" stroke={colors.accent} strokeWidth={2} name="Made-to-Order Units" />
                                                <Line type="monotone" dataKey="total_units" stroke={colors.primary} strokeWidth={2} name="Total Units" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Material Utilization */}
                            <div className="col-12 mb-4">
                                <div className="row">
                                    <div className="col-md-6">
                                        <div className="card border-0 shadow-sm">
                                            <div className="card-header bg-white border-0">
                                                <h6 className="mb-0">Material Utilization Breakdown</h6>
                                            </div>
                                            <div className="card-body">
                                                <ResponsiveContainer width="100%" height={200}>
                                                    <PieChart>
                                                        <Pie
                                                    data={[
                                                        { name: 'Alkansya', value: productionOverview?.overall?.material_utilization?.alkansya_percentage || 0, color: colors.success },
                                                        { name: 'Made-to-Order', value: productionOverview?.overall?.material_utilization?.made_to_order_percentage || 0, color: colors.accent }
                                                    ]}
                                                            cx="50%"
                                                            cy="50%"
                                                            labelLine={false}
                                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                            outerRadius={60}
                                                            fill="#8884d8"
                                                            dataKey="value"
                                                        >
                                                            {[
                                                                { name: 'Alkansya', value: productionOverview?.overall?.material_utilization?.alkansya_percentage || 0, color: colors.success },
                                                                { name: 'Made-to-Order', value: productionOverview?.overall?.material_utilization?.made_to_order_percentage || 0, color: colors.accent }
                                                            ].map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip />
                                                        <Legend />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="card border-0 shadow-sm">
                                            <div className="card-header bg-white border-0">
                                                <h6 className="mb-0">Production Distribution</h6>
                                            </div>
                                            <div className="card-body">
                                                <div className="d-flex justify-content-between mb-3">
                                                    <span>Alkansya Production</span>
                                        <span className="badge bg-success fs-6">
                                            {productionOverview?.overall?.production_breakdown?.alkansya_percentage || 0}%
                                        </span>
                                                </div>
                                                <div className="progress mb-3" style={{ height: '20px' }}>
                                                    <div 
                                                        className="progress-bar bg-success" 
                                                        style={{ 
                                                            width: `${productionOverview?.overall?.production_breakdown?.alkansya_percentage || 0}%` 
                                                        }}
                                                    ></div>
                                                </div>
                                                <div className="d-flex justify-content-between mb-3">
                                                    <span>Made-to-Order Production</span>
                                                    <span className="badge bg-accent fs-6">
                                                        {productionOverview?.overall?.production_breakdown?.made_to_order_percentage || 0}%
                                                    </span>
                                                </div>
                                                <div className="progress" style={{ height: '20px' }}>
                                                    <div 
                                                        className="progress-bar" 
                                                        style={{ 
                                                            width: `${productionOverview?.overall?.production_breakdown?.made_to_order_percentage || 0}%`,
                                                            backgroundColor: colors.accent
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="col-12">
                            <div className="text-center py-5">
                                <FaIndustry className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                <h5 className="text-muted">No Production Data Available</h5>
                                <p className="text-muted">Production overview data will appear here once production activities are recorded</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Production Performance Tab */}
            {activeTab === 'productionPerformance' && (
                <div className="row">
                    {tabLoadingStates.productionPerformance ? (
                        <div className="col-12">
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary mb-3" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <h5>Loading Production Performance Report...</h5>
                                <p className="text-muted">Analyzing production metrics and performance data</p>
                            </div>
                        </div>
                    ) : productionOverview ? (
                        <>
                            {/* Report Header */}
                            <div className="col-12 mb-4">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-header bg-white border-0">
                                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                                            <div>
                                                <h4 className="mb-0 fw-bold" style={{ color: '#8B4513' }}>
                                                    <FaTachometerAlt className="me-2" />
                                                    Production Performance Report
                                                </h4>
                                                <small className="text-muted">Generated: {new Date().toLocaleString()}</small>
                                            </div>
                                            <div className="d-flex gap-2 flex-wrap">
                                                {/* CSV Buttons */}
                                                <div className="btn-group" role="group">
                                                    <button
                                                        className="btn btn-outline-primary"
                                                        onClick={() => previewReport('performance')}
                                                        style={{ 
                                                            borderRadius: '8px 0 0 8px', 
                                                            borderWidth: '2px',
                                                            transition: 'all 0.3s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#8B4513';
                                                            e.currentTarget.style.color = 'white';
                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                            e.currentTarget.style.color = '#8B4513';
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                        }}
                                                    >
                                                        <FaEye className="me-2" />
                                                        Preview CSV
                                                    </button>
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => downloadReport('performance')}
                                                        style={{ 
                                                            borderRadius: '0 8px 8px 0',
                                                            backgroundColor: '#8B4513',
                                                            borderColor: '#8B4513',
                                                            transition: 'all 0.3s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#6B3410';
                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#8B4513';
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                        }}
                                                    >
                                                        <FaDownload className="me-2" />
                                                        Download CSV
                                                    </button>
                                                </div>
                                                {/* PDF Buttons */}
                                                <div className="btn-group" role="group">
                                                    <button
                                                        className="btn btn-outline-danger"
                                                        onClick={() => previewPdfReport('performance')}
                                                        style={{ 
                                                            borderRadius: '8px 0 0 8px', 
                                                            borderWidth: '2px',
                                                            transition: 'all 0.3s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#dc3545';
                                                            e.currentTarget.style.color = 'white';
                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                            e.currentTarget.style.color = '#dc3545';
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                        }}
                                                    >
                                                        <FaEye className="me-2" />
                                                        Preview PDF
                                                    </button>
                                                    <button
                                                        className="btn btn-danger"
                                                        onClick={() => downloadPdfReport('performance')}
                                                        style={{ 
                                                            borderRadius: '0 8px 8px 0',
                                                            transition: 'all 0.3s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#c82333';
                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#dc3545';
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                        }}
                                                    >
                                                        <FaDownload className="me-2" />
                                                        Download PDF
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Overall Performance Metrics */}
                            <div className="col-12 mb-4">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-header bg-white border-0">
                                        <h5 className="mb-0 fw-bold">Overall Performance Metrics</h5>
                                    </div>
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-3 mb-3">
                                                <div className="text-center p-3" style={{ background: 'linear-gradient(135deg, #8B451315, #A0522D15)', borderRadius: '8px' }}>
                                                    <h3 className="fw-bold mb-1" style={{ color: '#8B4513' }}>
                                                        {productionOverview?.overall?.total_units_produced || 0}
                                                    </h3>
                                                    <small className="text-muted">Total Units Produced</small>
                                                </div>
                                            </div>
                                            <div className="col-md-3 mb-3">
                                                <div className="text-center p-3" style={{ background: 'linear-gradient(135deg, #6B442315, #8B5A2B15)', borderRadius: '8px' }}>
                                                    <h3 className="fw-bold mb-1" style={{ color: '#6B4423' }}>
                                                        {productionOverview?.overall?.production_efficiency || 0}%
                                                    </h3>
                                                    <small className="text-muted">Production Efficiency</small>
                                                </div>
                                            </div>
                                            <div className="col-md-3 mb-3">
                                                <div className="text-center p-3" style={{ background: 'linear-gradient(135deg, #D4AF3715, #FFA50015)', borderRadius: '8px' }}>
                                                    <h3 className="fw-bold mb-1" style={{ color: '#D4AF37' }}>
                                                        {productionOverview?.overall?.average_daily_output?.toFixed(1) || 0}
                                                    </h3>
                                                    <small className="text-muted">Average Daily Output</small>
                                                </div>
                                            </div>
                                            <div className="col-md-3 mb-3">
                                                <div className="text-center p-3" style={{ background: 'linear-gradient(135deg, #8B451315, #6B442315)', borderRadius: '8px' }}>
                                                    <h3 className="fw-bold mb-1" style={{ color: '#8B4513' }}>
                                                        {productionOverview?.overall?.total_production_days || 0}
                                                    </h3>
                                                    <small className="text-muted">Production Days</small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Alkansya Performance */}
                            {productionOverview?.alkansya && (
                                <div className="col-12 mb-4">
                                    <div className="card border-0 shadow-sm">
                                        <div className="card-header bg-white border-0">
                                            <h5 className="mb-0 fw-bold">Alkansya Production Performance</h5>
                                        </div>
                                        <div className="card-body">
                                            <div className="row mb-3">
                                                <div className="col-md-4">
                                                    <div className="p-3 border rounded">
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <span className="text-muted">Total Units</span>
                                                            <span className="fw-bold">{productionOverview.alkansya.total_units_produced || 0}</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <span className="text-muted">Avg Daily Output</span>
                                                            <span className="fw-bold">{productionOverview.alkansya.average_daily_output?.toFixed(1) || 0}</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between align-items-center">
                                                            <span className="text-muted">Max Daily Output</span>
                                                            <span className="fw-bold">{productionOverview.alkansya.max_daily_output || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-4">
                                                    <div className="p-3 border rounded">
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <span className="text-muted">Min Daily Output</span>
                                                            <span className="fw-bold">{productionOverview.alkansya.min_daily_output || 0}</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <span className="text-muted">Production Days</span>
                                                            <span className="fw-bold">{productionOverview.alkansya.total_days || 0}</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between align-items-center">
                                                            <span className="text-muted">Trend</span>
                                                            <span className={`badge ${productionOverview.alkansya.production_trend === 'increasing' ? 'bg-success' : productionOverview.alkansya.production_trend === 'decreasing' ? 'bg-danger' : 'bg-warning'}`}>
                                                                {productionOverview.alkansya.production_trend || 'stable'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-4">
                                                    <div className="p-3 border rounded">
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <span className="text-muted">Efficiency</span>
                                                            <span className="fw-bold">{productionOverview.alkansya.efficiency || 0}%</span>
                                                        </div>
                                                        {productionOverview.alkansya.recent_output && productionOverview.alkansya.recent_output.length > 0 && (
                                                            <div className="mt-3">
                                                                <small className="text-muted d-block mb-2">Recent Output (Last 5 Days)</small>
                                                                {productionOverview.alkansya.recent_output.slice(0, 5).map((output, idx) => (
                                                                    <div key={idx} className="d-flex justify-content-between small mb-1">
                                                                        <span>{output.date}</span>
                                                                        <span className="fw-bold">{output.quantity} units</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Product-Level Performance Table */}
                            {productPerformanceData?.products && productPerformanceData.products.length > 0 && (
                                <div className="col-12 mb-4">
                                    <div className="card border-0 shadow-sm">
                                        <div className="card-header bg-white border-0">
                                            <h5 className="mb-0 fw-bold d-flex align-items-center">
                                                <FaTachometerAlt className="me-2" style={{ color: '#8B4513' }} />
                                                Product-Level Production Performance
                                            </h5>
                                            <small className="text-muted">
                                                Detailed performance metrics for each product (Alkansya & Made-to-Order)
                                            </small>
                                        </div>
                                        <div className="card-body">
                                            <div className="table-responsive">
                                                <table className="table table-hover table-striped">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>Product Name</th>
                                                            <th>Category</th>
                                                            <th>Total Produced</th>
                                                            <th>Days with Production</th>
                                                            <th>Avg Daily Output</th>
                                                            <th>Max Daily</th>
                                                            <th>Min Daily</th>
                                                            <th>Efficiency</th>
                                                            <th>First Production</th>
                                                            <th>Last Production</th>
                                                            <th>Trend</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {productPerformanceData.products.map((product, index) => (
                                                            <tr key={index}>
                                                                <td className="fw-bold">{product.product_name}</td>
                                                                <td>
                                                                    <span className={`badge ${
                                                                        product.category === 'Alkansya' 
                                                                            ? 'bg-success' 
                                                                            : 'bg-warning'
                                                                    }`}>
                                                                        {product.category}
                                                                    </span>
                                                                </td>
                                                                <td className="fw-bold">{product.total_quantity_produced || 0}</td>
                                                                <td>{product.days_with_production || product.orders_count || 0}</td>
                                                                <td>{product.average_daily_output?.toFixed(2) || product.average_production_time_days || '-'}</td>
                                                                <td>{product.max_daily_output || '-'}</td>
                                                                <td>{product.min_daily_output || '-'}</td>
                                                                <td>
                                                                    <span className={`badge ${
                                                                        product.efficiency_percentage >= 80 ? 'bg-success' :
                                                                        product.efficiency_percentage >= 60 ? 'bg-warning' :
                                                                        'bg-danger'
                                                                    }`}>
                                                                        {product.efficiency_percentage?.toFixed(1) || product.completion_rate?.toFixed(1) || 0}%
                                                                    </span>
                                                                </td>
                                                                <td>{product.first_production_date || product.first_order_date || '-'}</td>
                                                                <td>{product.last_production_date || product.last_order_date || '-'}</td>
                                                                <td>
                                                                    {product.production_trend ? (
                                                                        <span className={`badge ${
                                                                            product.production_trend === 'increasing' ? 'bg-success' :
                                                                            product.production_trend === 'decreasing' ? 'bg-danger' :
                                                                            'bg-secondary'
                                                                        }`}>
                                                                            {product.production_trend}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="badge bg-secondary">-</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {productPerformanceData.summary && (
                                                <div className="mt-3 p-3 bg-light rounded">
                                                    <div className="row text-center">
                                                        <div className="col-md-3">
                                                            <h6 className="text-muted mb-1">Total Products</h6>
                                                            <h5 className="fw-bold">{productPerformanceData.summary.total_products}</h5>
                                                        </div>
                                                        <div className="col-md-3">
                                                            <h6 className="text-muted mb-1">Alkansya Products</h6>
                                                            <h5 className="fw-bold text-success">{productPerformanceData.summary.alkansya_products}</h5>
                                                        </div>
                                                        <div className="col-md-3">
                                                            <h6 className="text-muted mb-1">Made-to-Order Products</h6>
                                                            <h5 className="fw-bold text-warning">{productPerformanceData.summary.made_to_order_products}</h5>
                                                        </div>
                                                        <div className="col-md-3">
                                                            <h6 className="text-muted mb-1">Avg Efficiency</h6>
                                                            <h5 className="fw-bold">{productPerformanceData.summary.average_efficiency?.toFixed(1)}%</h5>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Made-to-Order Performance */}
                            {productionOverview?.made_to_order && (
                                <div className="col-12 mb-4">
                                    <div className="card border-0 shadow-sm">
                                        <div className="card-header bg-white border-0">
                                            <h5 className="mb-0 fw-bold">Made-to-Order Production Performance</h5>
                                        </div>
                                        <div className="card-body">
                                            <div className="row mb-3">
                                                <div className="col-md-3">
                                                    <div className="text-center p-3 border rounded">
                                                        <h4 className="fw-bold mb-1" style={{ color: '#6B4423' }}>
                                                            {productionOverview.made_to_order.total_products_ordered || 0}
                                                        </h4>
                                                        <small className="text-muted">Total Orders</small>
                                                    </div>
                                                </div>
                                                <div className="col-md-3">
                                                    <div className="text-center p-3 border rounded">
                                                        <h4 className="fw-bold mb-1" style={{ color: '#8B5A2B' }}>
                                                            {productionOverview.made_to_order.in_progress || 0}
                                                        </h4>
                                                        <small className="text-muted">In Progress</small>
                                                    </div>
                                                </div>
                                                <div className="col-md-3">
                                                    <div className="text-center p-3 border rounded">
                                                        <h4 className="fw-bold mb-1 text-success">
                                                            {productionOverview.made_to_order.completed || 0}
                                                        </h4>
                                                        <small className="text-muted">Completed</small>
                                                    </div>
                                                </div>
                                                <div className="col-md-3">
                                                    <div className="text-center p-3 border rounded">
                                                        <h4 className="fw-bold mb-1" style={{ color: '#D4AF37' }}>
                                                            {productionOverview.made_to_order.completion_rate || 0}%
                                                        </h4>
                                                        <small className="text-muted">Completion Rate</small>
                                                    </div>
                                                </div>
                                            </div>
                                            {productionOverview.made_to_order.efficiency !== undefined && (
                                                <div className="mt-3">
                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                        <span className="fw-medium">Production Efficiency</span>
                                                        <span className="fw-bold">{productionOverview.made_to_order.efficiency || 0}%</span>
                                                    </div>
                                                    <div className="progress" style={{ height: '25px' }}>
                                                        <div 
                                                            className="progress-bar bg-success" 
                                                            style={{ width: `${productionOverview.made_to_order.efficiency || 0}%` }}
                                                        >
                                                            {productionOverview.made_to_order.efficiency || 0}%
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Performance Chart */}
                            {productionOverview && (
                                <div className="col-12 mb-4">
                                    <div className="card border-0 shadow-sm">
                                        <div className="card-header bg-white border-0">
                                            <h5 className="mb-0 fw-bold">Performance Overview</h5>
                                        </div>
                                        <div className="card-body">
                                            <ResponsiveContainer width="100%" height={300}>
                                                <ComposedChart data={[
                                                    {
                                                        name: 'Alkansya',
                                                        units: productionOverview?.alkansya?.total_units_produced || 0,
                                                        efficiency: productionOverview?.alkansya?.efficiency || 0
                                                    },
                                                    {
                                                        name: 'Made-to-Order',
                                                        units: productionOverview?.made_to_order?.total_products_ordered || 0,
                                                        efficiency: productionOverview?.made_to_order?.efficiency || 0
                                                    }
                                                ]}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" />
                                                    <YAxis yAxisId="left" />
                                                    <YAxis yAxisId="right" orientation="right" />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Bar yAxisId="left" dataKey="units" fill="#8B4513" name="Units Produced" />
                                                    <Line yAxisId="right" type="monotone" dataKey="efficiency" stroke="#6B4423" strokeWidth={2} name="Efficiency %" />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="col-12">
                            <div className="text-center py-5">
                                <FaTachometerAlt className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                <h5 className="text-muted">No Performance Data Available</h5>
                                <p className="text-muted">Production performance data will appear here once production activities are recorded</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Work Progress Tab */}
            {activeTab === 'workProgress' && (
                <div className="row">
                    {tabLoadingStates.workProgress ? (
                        <div className="col-12">
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary mb-3" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <h5>Loading Work Progress Report...</h5>
                                <p className="text-muted">Analyzing work progress and status data</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="col-12 mb-4">
                                <div className="row g-3">
                                    <div className="col-lg-4 col-md-6">
                                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.success}15, ${colors.success}05)` }}>
                                            <div className="card-body text-center p-4">
                                                <div className="d-flex align-items-center justify-content-center mb-3">
                                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.success}20` }}>
                                                        <FaBoxes style={{ color: colors.success }} className="fs-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="mb-0 fw-bold" style={{ color: colors.success }}>
                                                            {alkansyaDailyOutput.filter(item => {
                                                                const itemDate = new Date(item.date).toISOString().split('T')[0];
                                                                const today = new Date().toISOString().split('T')[0];
                                                                return itemDate === today;
                                                            }).reduce((sum, item) => sum + (item.quantity_produced || 0), 0)}
                                                        </h3>
                                                        <small className="text-muted fw-medium">Alkansya Today</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-lg-4 col-md-6">
                                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.warning}15, ${colors.warning}05)` }}>
                                            <div className="card-body text-center p-4">
                                                <div className="d-flex align-items-center justify-content-center mb-3">
                                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.warning}20` }}>
                                                        <FaClipboardList style={{ color: colors.warning }} className="fs-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="mb-0 fw-bold text-warning">
                                                            {mtoOrders.filter(order => order.status === 'In Progress').length}
                                                        </h3>
                                                        <small className="text-muted fw-medium">MTO In Progress</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-lg-4 col-md-6">
                                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.info}15, ${colors.info}05)` }}>
                                            <div className="card-body text-center p-4">
                                                <div className="d-flex align-items-center justify-content-center mb-3">
                                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.info}20` }}>
                                                        <FaCheckCircle style={{ color: colors.info }} className="fs-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="mb-0 fw-bold" style={{ color: colors.info }}>
                                                            {mtoOrders.filter(order => {
                                                                const orderDate = new Date(order.lastUpdatedAt);
                                                                const now = new Date();
                                                                return order.status === 'Completed' && 
                                                                       orderDate.getMonth() === now.getMonth() &&
                                                                       orderDate.getFullYear() === now.getFullYear();
                                                            }).length}
                                                        </h3>
                                                        <small className="text-muted fw-medium">Completed This Month</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Search and Filter Controls */}
                            <div className="col-12 mb-4">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-body">
                                        <div className="row g-3 align-items-end">
                                            <div className="col-md-4">
                                                <label className="form-label fw-medium">
                                                    <FaSearch className="me-2" />
                                                    Search
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Search by product name or order number..."
                                                    value={workProgressSearch}
                                                    onChange={(e) => setWorkProgressSearch(e.target.value)}
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-medium">
                                                    <FaFilter className="me-2" />
                                                    Category
                                                </label>
                                                <select
                                                    className="form-select"
                                                    value={workProgressFilter}
                                                    onChange={(e) => setWorkProgressFilter(e.target.value)}
                                                >
                                                    <option value="all">All Products</option>
                                                    <option value="alkansya">Alkansya</option>
                                                    <option value="mto">Made-to-Order</option>
                                                </select>
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-medium">Status</label>
                                                <select
                                                    className="form-select"
                                                    value={workProgressStatusFilter}
                                                    onChange={(e) => setWorkProgressStatusFilter(e.target.value)}
                                                >
                                                    <option value="all">All Status</option>
                                                    <option value="not_started">Not Started</option>
                                                    <option value="in_progress">In Progress</option>
                                                    <option value="completed">Completed</option>
                                                </select>
                                            </div>
                                            <div className="col-md-2">
                                                <button
                                                    className="btn btn-outline-secondary w-100"
                                                    onClick={() => {
                                                        setWorkProgressSearch('');
                                                        setWorkProgressFilter('all');
                                                        setWorkProgressStatusFilter('all');
                                                    }}
                                                >
                                                    <FaSync className="me-2" />
                                                    Reset
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 1: All Products */}
                            <div className="col-12 mb-4">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-header bg-white border-0">
                                        <h5 className="mb-0 fw-bold">
                                            <FaBoxes className="me-2" style={{ color: colors.primary }} />
                                            Section 1: All Products
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        {(() => {
                                            // Filter products
                                            let filteredProducts = allProducts;
                                            
                                            // Apply category filter
                                            if (workProgressFilter === 'alkansya') {
                                                filteredProducts = filteredProducts.filter(p => p.category === 'Alkansya');
                                            } else if (workProgressFilter === 'mto') {
                                                filteredProducts = filteredProducts.filter(p => p.category === 'Made-to-Order');
                                            }
                                            
                                            // Apply status filter
                                            if (workProgressStatusFilter !== 'all') {
                                                filteredProducts = filteredProducts.filter(p => {
                                                    const statusLower = p.status?.toLowerCase().replace(' ', '_');
                                                    return statusLower === workProgressStatusFilter;
                                                });
                                            }
                                            
                                            // Apply search filter
                                            if (workProgressSearch) {
                                                const searchLower = workProgressSearch.toLowerCase();
                                                filteredProducts = filteredProducts.filter(p => {
                                                    const name = (p.name || p.product_name || '').toLowerCase();
                                                    const code = (p.product_code || '').toLowerCase();
                                                    return name.includes(searchLower) || code.includes(searchLower);
                                                });
                                            }
                                            
                                            // Enhance products with today's Alkansya output
                                            filteredProducts = filteredProducts.map(product => {
                                                if (product.category === 'Alkansya') {
                                                    const today = new Date().toISOString().split('T')[0];
                                                    const todayOutput = alkansyaDailyOutput.find(item => {
                                                        const itemDate = new Date(item.date).toISOString().split('T')[0];
                                                        return itemDate === today;
                                                    });
                                                    if (todayOutput) {
                                                        product.completedToday = todayOutput.quantity_produced || 0;
                                                        product.lastUpdatedBy = todayOutput.produced_by || 'N/A';
                                                        product.lastUpdatedAt = todayOutput.date || today;
                                                        product.status = 'In Progress';
                                                        product.progress = 100; // Alkansya daily output is always completed
                                                    }
                                                }
                                                return product;
                                            });
                                            
                                            return (
                                                <div className="table-responsive">
                                                    <table className="table table-hover align-middle">
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th>Product Name</th>
                                                                <th>Product Code</th>
                                                                <th>Category</th>
                                                                <th>Total Completed Today</th>
                                                                <th>Total Completed for Order</th>
                                                                <th>Status</th>
                                                                <th>Progress</th>
                                                                <th>Last Updated By</th>
                                                                <th>Last Updated</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredProducts.length > 0 ? (
                                                                filteredProducts.map((product, idx) => (
                                                                    <tr key={product.id || idx}>
                                                                        <td className="fw-medium">{product.name || product.product_name || 'N/A'}</td>
                                                                        <td><code>{product.product_code || `PROD-${product.id || idx}`}</code></td>
                                                                        <td>
                                                                            <span className={`badge ${
                                                                                product.category === 'Alkansya' ? 'bg-success' :
                                                                                product.category === 'Made-to-Order' ? 'bg-warning' :
                                                                                'bg-secondary'
                                                                            }`}>
                                                                                {product.category || 'Other'}
                                                                            </span>
                                                                        </td>
                                                                        <td>
                                                                            {product.category === 'Alkansya' ? (
                                                                                <span className="badge bg-info">{product.completedToday || 0}</span>
                                                                            ) : (
                                                                                <span className="text-muted">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td>
                                                                            {product.category === 'Made-to-Order' ? (
                                                                                <span className="badge bg-info">
                                                                                    {mtoOrders
                                                                                        .filter(order => order.productId === product.id)
                                                                                        .reduce((sum, order) => sum + order.completedQuantity, 0)}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-muted">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td>
                                                                            <span className={`badge ${
                                                                                product.status === 'Completed' ? 'bg-success' :
                                                                                product.status === 'In Progress' ? 'bg-warning' :
                                                                                'bg-secondary'
                                                                            }`}>
                                                                                {product.status || 'Not Started'}
                                                                            </span>
                                                                        </td>
                                                                        <td>
                                                                            <div className="d-flex align-items-center">
                                                                                <div className="progress flex-grow-1 me-2" style={{ height: '20px', minWidth: '100px' }}>
                                                                                    <div
                                                                                        className={`progress-bar ${
                                                                                            product.progress === 100 ? 'bg-success' :
                                                                                            product.progress > 0 ? 'bg-warning' :
                                                                                            'bg-secondary'
                                                                                        }`}
                                                                                        style={{ width: `${product.progress || 0}%` }}
                                                                                    >
                                                                                        {product.progress || 0}%
                                                                                    </div>
                                                                                </div>
                                                                                <small className="text-muted">{product.progress || 0}%</small>
                                                                            </div>
                                                                        </td>
                                                                        <td className="small">{product.lastUpdatedBy || 'N/A'}</td>
                                                                        <td className="small">
                                                                            {product.lastUpdatedAt ? new Date(product.lastUpdatedAt).toLocaleString() : 'N/A'}
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan="9" className="text-center text-muted py-4">
                                                                        No products found matching the filters.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: Alkansya Daily Production */}
                            <div className="col-12 mb-4">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-header bg-white border-0">
                                        <h5 className="mb-0 fw-bold">
                                            <FaBoxes className="me-2" style={{ color: colors.success }} />
                                            Section 2: Alkansya Daily Production
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        <div className="table-responsive">
                                            <table className="table table-hover align-middle">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Date</th>
                                                        <th>Today's Output</th>
                                                        <th>Updated By</th>
                                                        <th>Update Timestamp</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {alkansyaDailyOutput.length > 0 ? (
                                                        alkansyaDailyOutput.slice(0, 30).map((output, idx) => (
                                                            <tr key={output.id || idx}>
                                                                <td className="fw-medium">
                                                                    {new Date(output.date).toLocaleDateString('en-US', {
                                                                        year: 'numeric',
                                                                        month: 'long',
                                                                        day: 'numeric'
                                                                    })}
                                                                </td>
                                                                <td>
                                                                    <span className="badge bg-success fs-6">
                                                                        {output.quantity_produced || 0} units
                                                                    </span>
                                                                </td>
                                                                <td>{output.produced_by || 'N/A'}</td>
                                                                <td className="small">
                                                                    {output.updated_at ? new Date(output.updated_at).toLocaleString() :
                                                                     output.created_at ? new Date(output.created_at).toLocaleString() :
                                                                     new Date(output.date).toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="4" className="text-center text-muted py-4">
                                                                No Alkansya daily output data available.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: Made-to-Order Production */}
                            <div className="col-12 mb-4">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-header bg-white border-0">
                                        <h5 className="mb-0 fw-bold">
                                            <FaClipboardList className="me-2" style={{ color: colors.warning }} />
                                            Section 3: Made-to-Order (MTO) Production
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        {(() => {
                                            // Filter MTO orders
                                            let filteredMTO = mtoOrders;
                                            
                                            // Apply search filter
                                            if (workProgressSearch) {
                                                const searchLower = workProgressSearch.toLowerCase();
                                                filteredMTO = filteredMTO.filter(order => {
                                                    const orderNum = (order.orderNumber || '').toLowerCase();
                                                    const productName = (order.productName || '').toLowerCase();
                                                    return orderNum.includes(searchLower) || productName.includes(searchLower);
                                                });
                                            }
                                            
                                            // Apply status filter
                                            if (workProgressStatusFilter !== 'all') {
                                                filteredMTO = filteredMTO.filter(order => {
                                                    const statusLower = order.status?.toLowerCase().replace(' ', '_');
                                                    return statusLower === workProgressStatusFilter;
                                                });
                                            }
                                            
                                            return (
                                                <>
                                                    <div className="table-responsive">
                                                        <table className="table table-hover align-middle">
                                                            <thead className="table-light">
                                                                <tr>
                                                                    <th>Order Number</th>
                                                                    <th>Product Name</th>
                                                                    <th>Required Quantity</th>
                                                                    <th>Completed Quantity</th>
                                                                    <th>Percentage Completed</th>
                                                                    <th>Deadline / Due Date</th>
                                                                    <th>Status</th>
                                                                    <th>Last Updated</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {filteredMTO.length > 0 ? (
                                                                    filteredMTO.map((order, idx) => (
                                                                        <tr key={order.orderId || idx}>
                                                                            <td className="fw-medium">
                                                                                <code>{order.orderNumber}</code>
                                                                            </td>
                                                                            <td>{order.productName}</td>
                                                                            <td>
                                                                                <span className="badge bg-secondary">{order.requiredQuantity}</span>
                                                                            </td>
                                                                            <td>
                                                                                <span className="badge bg-info">{order.completedQuantity}</span>
                                                                            </td>
                                                                            <td>
                                                                                <div className="d-flex align-items-center">
                                                                                    <div className="progress flex-grow-1 me-2" style={{ height: '20px', minWidth: '100px' }}>
                                                                                        <div
                                                                                            className={`progress-bar ${
                                                                                                order.progress === 100 ? 'bg-success' :
                                                                                                order.progress > 0 ? 'bg-warning' :
                                                                                                'bg-secondary'
                                                                                            }`}
                                                                                            style={{ width: `${order.progress || 0}%` }}
                                                                                        >
                                                                                            {order.progress || 0}%
                                                                                        </div>
                                                                                    </div>
                                                                                    <small className="text-muted">{order.progress || 0}%</small>
                                                                                </div>
                                                                            </td>
                                                                            <td>
                                                                                {order.deadline ? (
                                                                                    <span className={`badge ${
                                                                                        new Date(order.deadline) < new Date() ? 'bg-danger' : 'bg-info'
                                                                                    }`}>
                                                                                        {new Date(order.deadline).toLocaleDateString()}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-muted">N/A</span>
                                                                                )}
                                                                            </td>
                                                                            <td>
                                                                                <span className={`badge ${
                                                                                    order.status === 'Completed' ? 'bg-success' :
                                                                                    order.status === 'In Progress' ? 'bg-warning' :
                                                                                    order.status === 'Not Started' ? 'bg-secondary' :
                                                                                    'bg-danger'
                                                                                }`}>
                                                                                    {order.status}
                                                                                </span>
                                                                            </td>
                                                                            <td className="small">
                                                                                {order.lastUpdatedAt ? new Date(order.lastUpdatedAt).toLocaleString() : 'N/A'}
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                ) : (
                                                                    <tr>
                                                                        <td colSpan="8" className="text-center text-muted py-4">
                                                                            No Made-to-Order production data available.
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    
                                                    {/* Production Stages Display */}
                                                    {filteredMTO.length > 0 && (
                                                        <div className="mt-4">
                                                            <h6 className="mb-3 fw-bold">Production Stages</h6>
                                                            <div className="row g-3">
                                                                {filteredMTO.slice(0, 5).map((order, idx) => (
                                                                    <div key={idx} className="col-md-6 col-lg-4">
                                                                        <div className="card border">
                                                                            <div className="card-body p-3">
                                                                                <h6 className="card-title small mb-2">
                                                                                    <code>{order.orderNumber}</code> - {order.productName}
                                                                                </h6>
                                                                                <div className="progress mb-2" style={{ height: '8px' }}>
                                                                                    <div
                                                                                        className={`progress-bar ${
                                                                                            order.progress === 100 ? 'bg-success' :
                                                                                            order.progress > 0 ? 'bg-warning' :
                                                                                            'bg-secondary'
                                                                                        }`}
                                                                                        style={{ width: `${order.progress || 0}%` }}
                                                                                    />
                                                                                </div>
                                                                                <div className="d-flex justify-content-between small">
                                                                                    <span className="text-muted">Progress:</span>
                                                                                    <span className="fw-medium">{order.progress || 0}%</span>
                                                                                </div>
                                                                                <div className="d-flex justify-content-between small mt-1">
                                                                                    <span className="text-muted">Status:</span>
                                                                                    <span className={`badge badge-sm ${
                                                                                        order.status === 'Completed' ? 'bg-success' :
                                                                                        order.status === 'In Progress' ? 'bg-warning' :
                                                                                        'bg-secondary'
                                                                                    }`}>
                                                                                        {order.status}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Enhanced Production Output Tab */}
            {activeTab === 'output' && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0">
                                <div className="d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0 d-flex align-items-center">
                                        <FaIndustry className="me-2" style={{ color: colors.secondary }} />
                                        Production Output Analysis
                                        {tabLoadingStates.output && (
                                            <div className="spinner-border spinner-border-sm ms-2" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        )}
                                    </h5>
                                    <div className="d-flex gap-2 align-items-center">
                                        <FaFilter className="text-muted" />
                                        <select 
                                            value={productionFilter} 
                                            onChange={(e) => setProductionFilter(e.target.value)}
                                            className="form-select form-select-sm"
                                            style={{ width: 'auto' }}
                                        >
                                            <option value="all">All Products</option>
                                            <option value="alkansya">Alkansya Only</option>
                                            <option value="made_to_order">Made-to-Order Only</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="card-body">
                                {tabLoadingStates.output ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-secondary mb-3" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h5>Loading Production Output Data...</h5>
                                        <p className="text-muted">Analyzing accurate production performance and output trends</p>
                                    </div>
                                ) : filteredProductionOutput ? (
                                    <div>
                                        {/* Key Metrics */}
                                        <div className="row mb-4">
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card bg-light">
                                                    <div className="card-body text-center">
                                                        <h4 className="text-primary mb-1">{filteredProductionOutput.metrics.total_units_produced || 0}</h4>
                                                        <small className="text-muted">Total Units Produced</small>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card bg-light">
                                                    <div className="card-body text-center">
                                                        <h4 className="text-success mb-1">{filteredProductionOutput.metrics.alkansya_units || 0}</h4>
                                                        <small className="text-muted">Alkansya Units</small>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card bg-light">
                                                    <div className="card-body text-center">
                                                        <h4 className="text-accent mb-1">{filteredProductionOutput.metrics.made_to_order_units || 0}</h4>
                                                        <small className="text-muted">Made-to-Order Units</small>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card bg-light">
                                                    <div className="card-body text-center">
                                                        <h4 className="text-info mb-1">{filteredProductionOutput.metrics.production_days || 0}</h4>
                                                        <small className="text-muted">Production Days</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Production Breakdown */}
                                        <div className="row mb-4">
                                            <div className="col-md-6">
                                                <div className="card">
                                                    <div className="card-header">
                                                        <h6 className="mb-0">Production Statistics</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <div className="d-flex justify-content-between mb-2">
                                                            <span>Order Days</span>
                                                            <span className="fw-bold">{filteredProductionOutput.metrics.order_days || 0}</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between mb-2">
                                                            <span>Avg Daily Alkansya</span>
                                                            <span className="fw-bold text-success">{filteredProductionOutput.metrics.average_daily_alkansya || 0}</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between">
                                                            <span>Avg Daily Orders</span>
                                                            <span className="fw-bold text-accent">{filteredProductionOutput.metrics.average_daily_orders || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="card">
                                                    <div className="card-header">
                                                        <h6 className="mb-0">Efficiency Analysis</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <div className="d-flex justify-content-between mb-2">
                                                            <span>Alkansya Consistency</span>
                                                            <span className="fw-bold text-success">{filteredProductionOutput.efficiency_analysis?.alkansya_consistency || 0}%</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between mb-2">
                                                            <span>Order Completion</span>
                                                            <span className="fw-bold text-accent">{filteredProductionOutput.efficiency_analysis?.order_completion_rate || 0}%</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between">
                                                            <span>Overall Efficiency</span>
                                                            <span className="fw-bold text-primary">{filteredProductionOutput.efficiency_analysis?.overall_efficiency || 0}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Daily Production Chart */}
                                        <div className="row mb-4">
                                            <div className="col-12">
                                                <div className="card">
                                                    <div className="card-header">
                                                        <h6 className="mb-0">Daily Production Output</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <ResponsiveContainer width="100%" height={300}>
                                                            <LineChart data={filteredProductionOutput.daily_summary}>
                                                                <CartesianGrid strokeDasharray="3 3" />
                                                                <XAxis dataKey="date" />
                                                                <YAxis />
                                                                <Tooltip />
                                                                <Legend />
                                                                <Line type="monotone" dataKey="alkansya_units" stroke={colors.success} strokeWidth={2} name="Alkansya Units" />
                                                                <Line type="monotone" dataKey="made_to_order_units" stroke={colors.accent} strokeWidth={2} name="Made-to-Order Units" />
                                                                <Line type="monotone" dataKey="total_units" stroke={colors.primary} strokeWidth={2} name="Total Units" />
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Weekly Trends */}
                                        <div className="row mb-4">
                                            <div className="col-12">
                                                <div className="card">
                                                    <div className="card-header">
                                                        <h6 className="mb-0">Weekly Production Trends</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <ResponsiveContainer width="100%" height={300}>
                                                            <BarChart data={filteredProductionOutput.weekly_trends}>
                                                                <CartesianGrid strokeDasharray="3 3" />
                                                                <XAxis dataKey="week" />
                                                                <YAxis />
                                                                <Tooltip />
                                                                <Legend />
                                                                <Bar dataKey="alkansya_units" fill={colors.success} name="Alkansya Units" />
                                                                <Bar dataKey="made_to_order_units" fill={colors.accent} name="Made-to-Order Units" />
                                                                <Bar dataKey="total_units" fill={colors.primary} name="Total Units" />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Production Stability */}
                                        <div className="row">
                                            <div className="col-12">
                                                <div className="card">
                                                    <div className="card-header">
                                                        <h6 className="mb-0">Production Stability Analysis</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <div className="row">
                                                            <div className="col-md-4">
                                                                <div className="text-center">
                                                                    <h5 className={`${
                                                                        filteredProductionOutput.efficiency_analysis?.production_stability === 'high' ? 'text-success' :
                                                                        filteredProductionOutput.efficiency_analysis?.production_stability === 'medium' ? 'text-warning' :
                                                                        'text-danger'
                                                                    }`}>
                                                                        {filteredProductionOutput.efficiency_analysis?.production_stability?.toUpperCase() || 'LOW'}
                                                                    </h5>
                                                                    <small className="text-muted">Production Stability</small>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-4">
                                                                <div className="text-center">
                                                                    <h5 className={`${
                                                                        filteredProductionOutput.efficiency_analysis?.alkansya_trend === 'increasing' ? 'text-success' :
                                                                        filteredProductionOutput.efficiency_analysis?.alkansya_trend === 'decreasing' ? 'text-danger' :
                                                                        'text-info'
                                                                    }`}>
                                                                        {filteredProductionOutput.efficiency_analysis?.alkansya_trend?.toUpperCase() || 'STABLE'}
                                                                    </h5>
                                                                    <small className="text-muted">Alkansya Trend</small>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-4">
                                                                <div className="text-center">
                                                                    <h5 className="text-success">
                                                                        {filteredProductionOutput.efficiency_analysis?.order_completion_rate || 0}%
                                                                    </h5>
                                                                    <small className="text-muted">Order Completion Rate</small>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-5">
                                        <FaIndustry className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                        <h5 className="text-muted">No Production Output Data</h5>
                                        <p className="text-muted">Production output data will appear here once production activities are recorded</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Enhanced Made-to-Order Tab */}
            {activeTab === 'madeToOrder' && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaClipboardList className="me-2" style={{ color: colors.accent }} />
                                    Made-to-Order Production Status
                                    {tabLoadingStates.madeToOrder && (
                                        <div className="spinner-border spinner-border-sm ms-2" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    )}
                                </h5>
                            </div>
                            <div className="card-body">
                                {tabLoadingStates.madeToOrder ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-accent mb-3" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h5>Loading Made-to-Order Data...</h5>
                                        <p className="text-muted">Fetching accurate accepted order production status</p>
                                    </div>
                                ) : madeToOrderProductionData ? (
                                    <div>
                                        {/* Key Metrics */}
                                        <div className="row mb-4">
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card bg-light">
                                                    <div className="card-body text-center">
                                                        <h4 className="text-accent mb-1">{madeToOrderProductionData.metrics.total_accepted_orders || 0}</h4>
                                                        <small className="text-muted">Accepted Orders</small>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card bg-light">
                                                    <div className="card-body text-center">
                                                        <h4 className="text-success mb-1">{madeToOrderProductionData.metrics.total_products_ordered || 0}</h4>
                                                        <small className="text-muted">Products Ordered</small>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card bg-light">
                                                    <div className="card-body text-center">
                                                        <h4 className="text-info mb-1">₱{madeToOrderProductionData.metrics.total_revenue?.toLocaleString() || 0}</h4>
                                                        <small className="text-muted">Total Revenue</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Current In-Progress Orders */}
                                        <div className="row mb-4">
                                            <div className="col-12">
                                                <div className="card border-0 shadow-sm">
                                                    <div className="card-header bg-white border-0" style={{ borderBottom: '3px solid #ffc107' }}>
                                                        <h5 className="mb-0 d-flex align-items-center">
                                                            <i className="fas fa-cog fa-spin text-warning me-2"></i>
                                                            In-Progress Orders
                                                        </h5>
                                                    </div>
                                                    <div className="card-body">
                                                        {madeToOrderProductionData.current_orders?.length > 0 ? (
                                                            <div className="table-responsive">
                                                                <table className="table table-hover">
                                                                    <thead className="table-light">
                                                                        <tr>
                                                                            <th>Order ID</th>
                                                                            <th>Product</th>
                                                                            <th>Quantity</th>
                                                                            <th>Customer</th>
                                                                            <th>Status</th>
                                                                            <th>Production Stage</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {madeToOrderProductionData.current_orders.map((order, index) => (
                                                                            <tr key={index}>
                                                                                <td className="fw-bold">#{order.id}</td>
                                                                                <td>{order.product_name}</td>
                                                                                <td><span className="badge bg-primary">{order.quantity}</span></td>
                                                                                <td>{order.customer_name}</td>
                                                                                <td>
                                                                                    <span className="badge bg-warning">In Progress</span>
                                                                                </td>
                                                                                <td>
                                                                                    <span className="badge bg-info">{order.production_stage}</span>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-4">
                                                                <i className="fas fa-check-circle text-success fa-3x mb-3"></i>
                                                                <h5 className="text-muted">No In-Progress Orders</h5>
                                                                <p className="text-muted">All orders are completed or pending acceptance</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Order Analytics */}
                                        <div className="row mb-4">
                                            <div className="col-md-6">
                                                <div className="card">
                                                    <div className="card-header">
                                                        <h6 className="mb-0">Order Analytics</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <div className="d-flex justify-content-between mb-2">
                                                            <span>Average Order Value</span>
                                                            <span className="fw-bold">₱{madeToOrderProductionData.metrics.average_order_value?.toLocaleString() || 0}</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between mb-2">
                                                            <span>Unique Products</span>
                                                            <span className="fw-bold">{madeToOrderProductionData.metrics.unique_products || 0}</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between">
                                                            <span>Avg Products per Order</span>
                                                            <span className="fw-bold">{madeToOrderProductionData.metrics.average_products_per_order || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="card">
                                                    <div className="card-header">
                                                        <h6 className="mb-0">Customer Analysis</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <div className="d-flex justify-content-between mb-2">
                                                            <span>Total Customers</span>
                                                            <span className="fw-bold">{madeToOrderProductionData.customer_analysis?.total_customers || 0}</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between mb-2">
                                                            <span>Repeat Customers</span>
                                                            <span className="fw-bold text-success">{madeToOrderProductionData.customer_analysis?.repeat_customers || 0}</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between">
                                                            <span>New Customers</span>
                                                            <span className="fw-bold text-info">{madeToOrderProductionData.customer_analysis?.new_customers || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recent Orders */}
                                        <div className="row">
                                            <div className="col-12">
                                                <div className="card">
                                                    <div className="card-header">
                                                        <h6 className="mb-0">Recent Accepted Orders</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <div className="table-responsive">
                                                            <table className="table table-hover">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Order ID</th>
                                                                        <th>Customer</th>
                                                                        <th>Total Amount</th>
                                                                        <th>Status</th>
                                                                        <th>Date</th>
                                                                        <th>Items</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {madeToOrderProductionData.recent_orders?.map((order, index) => (
                                                                        <tr key={index}>
                                                                            <td className="fw-bold">#{order.id}</td>
                                                                            <td>
                                                                                <div>
                                                                                    <div className="fw-bold">{order.customer_name}</div>
                                                                                    <small className="text-muted">{order.customer_email}</small>
                                                                                </div>
                                                                            </td>
                                                                            <td className="text-success fw-bold">₱{order.total_amount?.toLocaleString() || 0}</td>
                                                                            <td>
                                                                                <span className="badge bg-success">{order.status}</span>
                                                                            </td>
                                                                            <td>{order.created_at}</td>
                                                                            <td>
                                                                                <div className="small">
                                                                                    {order.items?.map((item, itemIndex) => (
                                                                                        <div key={itemIndex} className="mb-1">
                                                                                            {item.product_name} x{item.quantity}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Materials Required */}
                                        {madeToOrderProductionData.materials_required?.length > 0 && (
                                            <div className="row mt-4">
                                                <div className="col-12">
                                                    <div className="card">
                                                        <div className="card-header">
                                                            <h6 className="mb-0">Materials Required for Orders</h6>
                                                        </div>
                                                        <div className="card-body">
                                                            <div className="table-responsive">
                                                                <table className="table table-sm">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Material</th>
                                                                            <th>Code</th>
                                                                            <th>Quantity Required</th>
                                                                            <th>Unit</th>
                                                                            <th>Cost per Unit</th>
                                                                            <th>Total Cost</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {madeToOrderProductionData.materials_required.map((material, index) => (
                                                                            <tr key={index}>
                                                                                <td>{material.material_name}</td>
                                                                                <td>{material.material_code}</td>
                                                                                <td className="text-accent fw-bold">{material.quantity_required}</td>
                                                                                <td>{material.unit}</td>
                                                                                <td>₱{material.cost_per_unit?.toLocaleString() || 0}</td>
                                                                                <td>₱{material.total_cost?.toLocaleString() || 0}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-5">
                                        <FaClipboardList className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                        <h5 className="text-muted">No Made-to-Order Data</h5>
                                        <p className="text-muted">Made-to-Order production data will appear here once orders are accepted</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Enhanced Alkansya Daily Output Tab */}
            {activeTab === 'alkansya' && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaBoxes className="me-2" style={{ color: colors.success }} />
                                    Alkansya Daily Output Reports
                                    {tabLoadingStates.alkansya && (
                                        <div className="spinner-border spinner-border-sm ms-2" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    )}
                                </h5>
                            </div>
                            <div className="card-body">
                                {tabLoadingStates.alkansya ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-success mb-3" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h5>Loading Alkansya Production Data...</h5>
                                        <p className="text-muted">Fetching accurate daily Alkansya production records</p>
                                    </div>
                                ) : alkansyaProductionData ? (
                                    <div>
                                        {/* Key Metrics */}
                                        <div className="row mb-4">
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card bg-light">
                                                    <div className="card-body text-center">
                                                        <h4 className="text-success mb-1">{alkansyaProductionData.metrics.total_units_produced || 0}</h4>
                                                        <small className="text-muted">Total Units Produced</small>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card bg-light">
                                                    <div className="card-body text-center">
                                                        <h4 className="text-info mb-1">{alkansyaProductionData.metrics.average_daily_output || 0}</h4>
                                                        <small className="text-muted">Average Daily Output</small>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card bg-light">
                                                    <div className="card-body text-center">
                                                        <h4 className="text-warning mb-1">{alkansyaProductionData.metrics.production_consistency || 0}%</h4>
                                                        <small className="text-muted">Production Consistency</small>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card bg-light">
                                                    <div className="card-body text-center">
                                                        <h4 className="text-primary mb-1">{alkansyaProductionData.metrics.total_days || 0}</h4>
                                                        <small className="text-muted">Production Days</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Production Trend */}
                                        <div className="row mb-4">
                                            <div className="col-md-6">
                                                <div className="card">
                                                    <div className="card-header">
                                                        <h6 className="mb-0">Production Performance</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <div className="d-flex justify-content-between mb-2">
                                                            <span>Recent Trend</span>
                                                            <span className={`badge ${
                                                                alkansyaProductionData.metrics.recent_trend === 'increasing' ? 'bg-success' :
                                                                alkansyaProductionData.metrics.recent_trend === 'decreasing' ? 'bg-danger' :
                                                                'bg-secondary'
                                                            }`}>
                                                                {alkansyaProductionData.metrics.recent_trend || 'stable'}
                                                            </span>
                                                        </div>
                                                        <div className="d-flex justify-content-between mb-2">
                                                            <span>Max Daily Output</span>
                                                            <span className="fw-bold">{alkansyaProductionData.metrics.max_daily_output || 0}</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between">
                                                            <span>Min Daily Output</span>
                                                            <span className="fw-bold">{alkansyaProductionData.metrics.min_daily_output || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="card">
                                                    <div className="card-header">
                                                        <h6 className="mb-0">Product Information</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        {alkansyaProductionData.product_info ? (
                                                            <div>
                                                                <h6 className="text-success">{alkansyaProductionData.product_info.name}</h6>
                                                                <p className="text-muted small mb-2">{alkansyaProductionData.product_info.description}</p>
                                                                <div className="d-flex justify-content-between">
                                                                    <span>Materials Required</span>
                                                                    <span className="badge bg-info">{alkansyaProductionData.product_info.materials_count}</span>
                                                                </div>
                                                                <div className="d-flex justify-content-between">
                                                                    <span>Unit Price</span>
                                                                    <span className="fw-bold">₱{alkansyaProductionData.product_info.unit_price?.toLocaleString() || 0}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className="text-muted">No product information available</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Daily Production Chart */}
                                        <div className="row mb-4">
                                            <div className="col-12">
                                                <div className="card">
                                                    <div className="card-header">
                                                        <h6 className="mb-0">Daily Production Output</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <ResponsiveContainer width="100%" height={300}>
                                                            <LineChart data={alkansyaProductionData.daily_breakdown}>
                                                                <CartesianGrid strokeDasharray="3 3" />
                                                                <XAxis dataKey="date" />
                                                                <YAxis />
                                                                <Tooltip />
                                                                <Legend />
                                                                <Line type="monotone" dataKey="quantity_produced" stroke={colors.success} strokeWidth={2} name="Units Produced" />
                                                                <Line type="monotone" dataKey="efficiency" stroke={colors.warning} strokeWidth={2} name="Efficiency %" />
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Daily Production Table */}
                                        <div className="row">
                                            <div className="col-12">
                                                <div className="card">
                                                    <div className="card-header">
                                                        <h6 className="mb-0">Daily Production Details</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <div className="table-responsive">
                                                            <table className="table table-hover">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Date</th>
                                                                        <th>Day</th>
                                                                        <th>Units Produced</th>
                                                                        <th>Efficiency</th>
                                                                        <th>Produced By</th>
                                                                        <th>Type</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {alkansyaProductionData.daily_breakdown?.map((day, index) => (
                                                                        <tr key={index}>
                                                                            <td>{day.date}</td>
                                                                            <td>{day.day_of_week}</td>
                                                                            <td className="text-success fw-bold">{day.quantity_produced}</td>
                                                                            <td>
                                                                                <span className={`badge ${
                                                                                    day.efficiency >= 100 ? 'bg-success' :
                                                                                    day.efficiency >= 80 ? 'bg-warning' :
                                                                                    'bg-danger'
                                                                                }`}>
                                                                                    {day.efficiency}%
                                                                                </span>
                                                                            </td>
                                                                            <td>{day.produced_by}</td>
                                                                            <td>
                                                                                <span className={`badge ${
                                                                                    day.is_weekend ? 'bg-info' : 'bg-primary'
                                                                                }`}>
                                                                                    {day.is_weekend ? 'Weekend' : 'Weekday'}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Materials Consumed */}
                                        {alkansyaProductionData.metrics.materials_consumed?.length > 0 && (
                                            <div className="row mt-4">
                                                <div className="col-12">
                                                    <div className="card">
                                                        <div className="card-header">
                                                            <h6 className="mb-0">Materials Consumed</h6>
                                                        </div>
                                                        <div className="card-body">
                                                            <div className="table-responsive">
                                                                <table className="table table-sm">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Material</th>
                                                                            <th>Code</th>
                                                                            <th>Quantity Consumed</th>
                                                                            <th>Unit</th>
                                                                            <th>Cost per Unit</th>
                                                                            <th>Total Cost</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {alkansyaProductionData.metrics.materials_consumed.map((material, index) => (
                                                                            <tr key={index}>
                                                                                <td>{material.material_name}</td>
                                                                                <td>{material.material_code}</td>
                                                                                <td className="text-success fw-bold">{material.quantity_consumed}</td>
                                                                                <td>{material.unit}</td>
                                                                                <td>₱{material.cost_per_unit?.toLocaleString() || 0}</td>
                                                                                <td>₱{material.total_cost?.toLocaleString() || 0}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-5">
                                        <FaBoxes className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                        <h5 className="text-muted">No Alkansya Production Data</h5>
                                        <p className="text-muted">Alkansya production data will appear here once daily output is recorded</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaChartBar className="me-2" style={{ color: colors.info }} />
                                    Production Analytics
                                    {tabLoadingStates.analytics && (
                                        <div className="spinner-border spinner-border-sm ms-2" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    )}
                                </h5>
                            </div>
                            <div className="card-body">
                                {tabLoadingStates.analytics ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-info mb-3" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h5>Loading Predictive Analytics...</h5>
                                        <p className="text-muted">Analyzing historical production data and trends</p>
                                    </div>
                                ) : (
                                    <div className="predictive-analytics-container">
                                        {/* Header Section */}
                                        <div className="mb-4">
                                            <h4 className="d-flex align-items-center mb-2">
                                                <i className="fas fa-crystal-ball text-info me-2" style={{ fontSize: '28px' }}></i>
                                                Predictive Analytics Dashboard
                                            </h4>
                                            <p className="text-muted mb-0">
                                                Analyze historical production data to forecast output levels and anticipate delays
                                            </p>
                                        </div>

                                        {/* Display Alkansya Daily Output - Always show structure */}
                                        <div className="mb-4">
                                            <div className="card border-0 shadow-sm">
                                                <div className="card-header bg-white border-0" style={{ borderBottom: '3px solid #28a745' }}>
                                                    <h5 className="mb-0 d-flex align-items-center">
                                                        <i className="fas fa-box text-success me-2"></i>
                                                        Alkansya Daily Output Analytics
                                                    </h5>
                                                </div>
                                                <div className="card-body">
                                                    {alkansyaProductionData?.daily_output && alkansyaProductionData.daily_output.length > 0 ? (
                                                        <ResponsiveContainer width="100%" height={300}>
                                                            <LineChart data={alkansyaProductionData.daily_output}>
                                                                <CartesianGrid strokeDasharray="3 3" />
                                                                <XAxis dataKey="date" />
                                                                <YAxis />
                                                                <Tooltip />
                                                                <Legend />
                                                                <Line type="monotone" dataKey="quantity" stroke="#28a745" strokeWidth={2} name="Daily Output" />
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    ) : (
                                                        <div className="text-center py-5">
                                                            <i className="fas fa-info-circle text-muted mb-3" style={{ fontSize: '3rem' }}></i>
                                                            <h5 className="text-muted">No Alkansya Production Data Available</h5>
                                                            <p className="text-muted">Alkansya daily output data will appear here once production activities are recorded</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Display Made-to-Order Accepted Orders - Always show structure */}
                                        <div className="mb-4">
                                            <div className="card border-0 shadow-sm">
                                                <div className="card-header bg-white border-0" style={{ borderBottom: '3px solid #CD853F' }}>
                                                    <h5 className="mb-0 d-flex align-items-center">
                                                        <i className="fas fa-clipboard-list text-warning me-2"></i>
                                                        Made-to-Order Products Analytics
                                                    </h5>
                                                </div>
                                                <div className="card-body">
                                                    {madeToOrderProductionData?.orders && madeToOrderProductionData.orders.length > 0 ? (
                                                        <ResponsiveContainer width="100%" height={300}>
                                                            <BarChart data={madeToOrderProductionData.orders}>
                                                                <CartesianGrid strokeDasharray="3 3" />
                                                                <XAxis dataKey="order_date" />
                                                                <YAxis />
                                                                <Tooltip />
                                                                <Legend />
                                                                <Bar dataKey="order_count" fill="#CD853F" name="Accepted Orders" />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    ) : (
                                                        <div className="text-center py-5">
                                                            <i className="fas fa-info-circle text-muted mb-3" style={{ fontSize: '3rem' }}></i>
                                                            <h5 className="text-muted">No Made-to-Order Data Available</h5>
                                                            <p className="text-muted">Made-to-Order accepted orders data will appear here once orders are received and accepted</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Efficiency Tab */}
            {activeTab === 'efficiency' && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaChartLine className="me-2" style={{ color: colors.warning }} />
                                    Efficiency Metrics
                                    {tabLoadingStates.efficiency && (
                                        <div className="spinner-border spinner-border-sm ms-2" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    )}
                                </h5>
                            </div>
                            <div className="card-body">
                                {tabLoadingStates.efficiency ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-warning mb-3" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h5>Loading Efficiency Data...</h5>
                                        <p className="text-muted">Calculating production efficiency metrics</p>
                                    </div>
                                ) : (
                                    <div className="efficiency-metrics-container">
                                        {/* Header */}
                                        <div className="mb-4">
                                            <h4 className="d-flex align-items-center mb-2">
                                                <i className="fas fa-chart-line text-warning me-2" style={{ fontSize: '28px' }}></i>
                                                Production Efficiency Analysis
                                            </h4>
                                            <p className="text-muted mb-0">
                                                Analyze production efficiency based on Alkansya daily output and Made-to-Order accepted orders
                                            </p>
                                        </div>

                                        {/* Alkansya Production Efficiency */}
                                        <div className="mb-4">
                                            <div className="card border-0 shadow-sm">
                                                <div className="card-header bg-white border-0" style={{ borderBottom: '3px solid #28a745' }}>
                                                    <h5 className="mb-0 d-flex align-items-center">
                                                        <i className="fas fa-box text-success me-2"></i>
                                                        Alkansya Production Efficiency
                                                    </h5>
                                                </div>
                                                <div className="card-body">
                                                    {/* Always show efficiency metrics structure */}
                                                    <div className="row">
                                                        <div className="col-md-3 mb-3">
                                                            <div className="text-center p-3 rounded" style={{ backgroundColor: '#e8f5e9' }}>
                                                                <i className="fas fa-percent text-success fa-2x mb-2"></i>
                                                                <h4 className="text-success">{alkansyaProductionData?.efficiency_metrics?.overall_efficiency || 0}%</h4>
                                                                <small className="text-muted">Overall Efficiency</small>
                                                            </div>
                                                        </div>
                                                        <div className="col-md-3 mb-3">
                                                            <div className="text-center p-3 rounded" style={{ backgroundColor: '#e3f2fd' }}>
                                                                <i className="fas fa-boxes text-info fa-2x mb-2"></i>
                                                                <h4 className="text-info">{alkansyaProductionData?.efficiency_metrics?.average_daily_output || 0}</h4>
                                                                <small className="text-muted">Avg Daily Output</small>
                                                            </div>
                                                        </div>
                                                        <div className="col-md-3 mb-3">
                                                            <div className="text-center p-3 rounded" style={{ backgroundColor: '#fff3e0' }}>
                                                                <i className="fas fa-tasks text-warning fa-2x mb-2"></i>
                                                                <h4 className="text-warning">{alkansyaProductionData?.efficiency_metrics?.production_days || 0}</h4>
                                                                <small className="text-muted">Production Days</small>
                                                            </div>
                                                        </div>
                                                        <div className="col-md-3 mb-3">
                                                            <div className="text-center p-3 rounded" style={{ backgroundColor: '#e8f5e9' }}>
                                                                <i className="fas fa-target text-success fa-2x mb-2"></i>
                                                                <h4 className="text-success">{alkansyaProductionData?.efficiency_metrics?.target_achievement || 0}%</h4>
                                                                <small className="text-muted">Target Achievement</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Made-to-Order Production Efficiency */}
                                        <div className="mb-4">
                                            <div className="card border-0 shadow-sm">
                                                <div className="card-header bg-white border-0" style={{ borderBottom: '3px solid #CD853F' }}>
                                                    <h5 className="mb-0 d-flex align-items-center">
                                                        <i className="fas fa-clipboard-list text-warning me-2"></i>
                                                        Made-to-Order Production Efficiency
                                                    </h5>
                                                </div>
                                                <div className="card-body">
                                                    {/* Always show efficiency metrics structure */}
                                                    <div className="row">
                                                        <div className="col-md-3 mb-3">
                                                            <div className="text-center p-3 rounded" style={{ backgroundColor: '#FFF3E0' }}>
                                                                <i className="fas fa-check-circle text-success fa-2x mb-2"></i>
                                                                <h4 className="text-success">{madeToOrderProductionData?.efficiency_metrics?.completion_rate || 0}%</h4>
                                                                <small className="text-muted">Completion Rate</small>
                                                            </div>
                                                        </div>
                                                        <div className="col-md-3 mb-3">
                                                            <div className="text-center p-3 rounded" style={{ backgroundColor: '#E3F2FD' }}>
                                                                <i className="fas fa-hourglass-half text-info fa-2x mb-2"></i>
                                                                <h4 className="text-info">{madeToOrderProductionData?.efficiency_metrics?.avg_completion_time || 0}</h4>
                                                                <small className="text-muted">Avg Completion Time</small>
                                                            </div>
                                                        </div>
                                                        <div className="col-md-3 mb-3">
                                                            <div className="text-center p-3 rounded" style={{ backgroundColor: '#E8F5E9' }}>
                                                                <i className="fas fa-list-alt text-warning fa-2x mb-2"></i>
                                                                <h4 className="text-warning">{madeToOrderProductionData?.efficiency_metrics?.total_orders || 0}</h4>
                                                                <small className="text-muted">Total Orders</small>
                                                            </div>
                                                        </div>
                                                        <div className="col-md-3 mb-3">
                                                            <div className="text-center p-3 rounded" style={{ backgroundColor: '#FFEBEE' }}>
                                                                <i className="fas fa-clock text-danger fa-2x mb-2"></i>
                                                                <h4 className="text-danger">{madeToOrderProductionData?.efficiency_metrics?.on_time_delivery || 0}%</h4>
                                                                <small className="text-muted">On-Time Delivery</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Work Progress Bar */}
                                        <div className="mb-4">
                                            <div className="card border-0 shadow-sm">
                                                <div className="card-header bg-white border-0">
                                                    <h5 className="mb-0 d-flex align-items-center">
                                                        <i className="fas fa-tasks text-primary me-2"></i>
                                                        Overall Work Progress
                                                    </h5>
                                                </div>
                                                <div className="card-body">
                                                    <div className="mb-3">
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <span className="fw-bold">Alkansya Production Progress</span>
                                                            <span className="badge bg-success">{alkansyaProductionData?.efficiency_metrics?.overall_efficiency || 0}%</span>
                                                        </div>
                                                        <div className="progress" style={{ height: '25px', borderRadius: '8px' }}>
                                                            <div className="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                                                                 style={{ width: `${alkansyaProductionData?.efficiency_metrics?.overall_efficiency || 0}%` }}>
                                                                {alkansyaProductionData?.efficiency_metrics?.overall_efficiency || 0}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="mb-3">
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <span className="fw-bold">Made-to-Order Completion Progress</span>
                                                            <span className="badge bg-warning">{madeToOrderProductionData?.efficiency_metrics?.completion_rate || 0}%</span>
                                                        </div>
                                                        <div className="progress" style={{ height: '25px', borderRadius: '8px' }}>
                                                            <div className="progress-bar bg-warning progress-bar-striped progress-bar-animated" 
                                                                 style={{ width: `${madeToOrderProductionData?.efficiency_metrics?.completion_rate || 0}%` }}>
                                                                {madeToOrderProductionData?.efficiency_metrics?.completion_rate || 0}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Resource Utilization Tab */}
            {activeTab === 'utilization' && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaCogs className="me-2" style={{ color: colors.dark }} />
                                    Resource Utilization
                                    {tabLoadingStates.utilization && (
                                        <div className="spinner-border spinner-border-sm ms-2" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    )}
                                </h5>
                            </div>
                            <div className="card-body">
                                {tabLoadingStates.utilization ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-dark mb-3" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h5>Loading Resource Data...</h5>
                                        <p className="text-muted">Analyzing resource utilization patterns</p>
                                    </div>
                                ) : (
                                    <div className="resource-utilization-container">
                                        {/* Header */}
                                        <div className="mb-4">
                                            <h4 className="d-flex align-items-center mb-2">
                                                <i className="fas fa-cogs text-dark me-2" style={{ fontSize: '28px' }}></i>
                                                Resource Allocation & Utilization Analysis
                                            </h4>
                                            <p className="text-muted mb-0">
                                                Optimize resource allocation to improve production efficiency based on Alkansya daily output and Made-to-Order accepted orders
                                            </p>
                                        </div>

                                        {/* Capacity Utilization for Alkansya */}
                                        <div className="mb-4">
                                            <div className="card border-0 shadow-sm">
                                                <div className="card-header bg-white border-0" style={{ borderBottom: '3px solid #28a745' }}>
                                                    <h5 className="mb-0 d-flex align-items-center">
                                                        <i className="fas fa-box text-success me-2"></i>
                                                        Alkansya Capacity Utilization
                                                    </h5>
                                                </div>
                                                <div className="card-body">
                                                    {/* Always show capacity utilization structure */}
                                                    <div className="row">
                                                        <div className="col-md-6 mb-3">
                                                            <div className="card bg-light">
                                                                <div className="card-body">
                                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                                        <span className="fw-bold">Production Capacity</span>
                                                                        <span className="badge bg-success">{alkansyaProductionData?.capacity_utilization?.used_capacity || 0} / {alkansyaProductionData?.capacity_utilization?.total_capacity || 0}</span>
                                                                    </div>
                                                                    <div className="progress" style={{ height: '30px', borderRadius: '8px' }}>
                                                                        <div className="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                                                                             style={{ width: `${alkansyaProductionData?.capacity_utilization?.utilization_percentage || 0}%` }}>
                                                                            {alkansyaProductionData?.capacity_utilization?.utilization_percentage || 0}%
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="col-md-6 mb-3">
                                                            <div className="card bg-light">
                                                                <div className="card-body">
                                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                                        <span className="fw-bold">Resource Efficiency</span>
                                                                        <span className="badge bg-info">{alkansyaProductionData?.capacity_utilization?.resource_efficiency || 0}%</span>
                                                                    </div>
                                                                    <div className="progress" style={{ height: '30px', borderRadius: '8px' }}>
                                                                        <div className="progress-bar bg-info progress-bar-striped progress-bar-animated" 
                                                                             style={{ width: `${alkansyaProductionData?.capacity_utilization?.resource_efficiency || 0}%` }}>
                                                                            {alkansyaProductionData?.capacity_utilization?.resource_efficiency || 0}%
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Capacity Utilization for Made-to-Order */}
                                        <div className="mb-4">
                                            <div className="card border-0 shadow-sm">
                                                <div className="card-header bg-white border-0" style={{ borderBottom: '3px solid #CD853F' }}>
                                                    <h5 className="mb-0 d-flex align-items-center">
                                                        <i className="fas fa-clipboard-list text-warning me-2"></i>
                                                        Made-to-Order Capacity Utilization
                                                    </h5>
                                                </div>
                                                <div className="card-body">
                                                    {/* Always show capacity utilization structure */}
                                                    <div className="row">
                                                        <div className="col-md-6 mb-3">
                                                            <div className="card bg-light">
                                                                <div className="card-body">
                                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                                        <span className="fw-bold">Order Processing Capacity</span>
                                                                        <span className="badge bg-warning">{madeToOrderProductionData?.capacity_utilization?.active_orders || 0} / {madeToOrderProductionData?.capacity_utilization?.max_capacity || 0}</span>
                                                                    </div>
                                                                    <div className="progress" style={{ height: '30px', borderRadius: '8px' }}>
                                                                        <div className="progress-bar bg-warning progress-bar-striped progress-bar-animated" 
                                                                             style={{ width: `${madeToOrderProductionData?.capacity_utilization?.processing_rate || 0}%` }}>
                                                                            {madeToOrderProductionData?.capacity_utilization?.processing_rate || 0}%
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="col-md-6 mb-3">
                                                            <div className="card bg-light">
                                                                <div className="card-body">
                                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                                        <span className="fw-bold">Workforce Utilization</span>
                                                                        <span className="badge bg-danger">{madeToOrderProductionData?.capacity_utilization?.workforce_utilization || 0}%</span>
                                                                    </div>
                                                                    <div className="progress" style={{ height: '30px', borderRadius: '8px' }}>
                                                                        <div className="progress-bar bg-danger progress-bar-striped progress-bar-animated" 
                                                                             style={{ width: `${madeToOrderProductionData?.capacity_utilization?.workforce_utilization || 0}%` }}>
                                                                            {madeToOrderProductionData?.capacity_utilization?.workforce_utilization || 0}%
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Production Stages Tab */}
            {activeTab === 'stages' && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaHistory className="me-2" style={{ color: colors.danger }} />
                                    Production Stage Breakdown
                                    {tabLoadingStates.stages && (
                                        <div className="spinner-border spinner-border-sm ms-2" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    )}
                                </h5>
                            </div>
                            <div className="card-body">
                                {tabLoadingStates.stages ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-danger mb-3" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h5>Loading Stage Data...</h5>
                                        <p className="text-muted">Analyzing production stage performance</p>
                                    </div>
                                ) : (
                                    <>
                                        {stageBreakdown && stageBreakdown.summary && (
                                            <div className="row mb-4">
                                                <div className="col-md-3">
                                                    <div className="card bg-light">
                                                        <div className="card-body text-center">
                                                            <h3 className="text-primary mb-1">{stageBreakdown.summary.total_productions || 0}</h3>
                                                            <p className="text-muted mb-0 small">Total Productions</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-3">
                                                    <div className="card bg-light">
                                                        <div className="card-body text-center">
                                                            <h3 className="text-warning mb-1">{stageBreakdown.summary.in_progress_productions || 0}</h3>
                                                            <p className="text-muted mb-0 small">In Progress</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-3">
                                                    <div className="card bg-light">
                                                        <div className="card-body text-center">
                                                            <h3 className="text-success mb-1">{stageBreakdown.summary.completed_productions || 0}</h3>
                                                            <p className="text-muted mb-0 small">Completed</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-3">
                                                    <div className="card bg-light">
                                                        <div className="card-body text-center">
                                                            <h3 className="text-info mb-1">{stageBreakdown.summary.average_progress || 0}%</h3>
                                                            <p className="text-muted mb-0 small">Avg Progress</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="accordion" id="stagesAccordion">
                                            {stageBreakdown && stageBreakdown.stages && stageBreakdown.stages.length > 0 ? (
                                                stageBreakdown.stages.map((stage, index) => (
                                                    <div key={index} className="accordion-item mb-2">
                                                        <h2 className="accordion-header" id={`heading${index}`}>
                                                            <button
                                                                className={`accordion-button ${index === 0 ? '' : 'collapsed'}`}
                                                                type="button"
                                                                data-bs-toggle="collapse"
                                                                data-bs-target={`#collapse${index}`}
                                                                aria-expanded={index === 0}
                                                                aria-controls={`collapse${index}`}
                                                                style={{
                                                                    backgroundColor: stage.total_productions > 0 ? colors.primary : '#f8f9fa',
                                                                    color: stage.total_productions > 0 ? 'white' : '#6c757d'
                                                                }}
                                                            >
                                                                <div className="d-flex justify-content-between align-items-center w-100 me-3">
                                                                    <span className="fw-bold">{stage.stage_name}</span>
                                                                    <span className="badge bg-light text-dark ms-2">
                                                                        {stage.total_productions} Production{stage.total_productions !== 1 ? 's' : ''}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        </h2>
                                                        <div
                                                            id={`collapse${index}`}
                                                            className={`accordion-collapse collapse ${index === 0 ? 'show' : ''}`}
                                                            aria-labelledby={`heading${index}`}
                                                            data-bs-parent="#stagesAccordion"
                                                        >
                                                            <div className="accordion-body p-0">
                                                                {stage.productions && stage.productions.length > 0 ? (
                                                                    <div className="table-responsive">
                                                                        <table className="table table-hover table-sm mb-0">
                                                                            <thead className="table-light">
                                                                                <tr>
                                                                                    <th style={{ minWidth: '120px' }}>Order #</th>
                                                                                    <th style={{ minWidth: '150px' }}>Product</th>
                                                                                    <th style={{ minWidth: '120px' }}>Customer</th>
                                                                                    <th style={{ minWidth: '80px' }} className="text-center">Quantity</th>
                                                                                    <th style={{ minWidth: '120px' }} className="text-center">Status</th>
                                                                                    <th style={{ minWidth: '120px' }} className="text-center">Progress</th>
                                                                                    <th style={{ minWidth: '120px' }} className="text-center">Start Date</th>
                                                                                    <th style={{ minWidth: '120px' }} className="text-center">Est. Completion</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {stage.productions.map((prod, prodIndex) => (
                                                                                    <tr key={prodIndex}>
                                                                                        <td className="fw-bold text-primary">{prod.order_number}</td>
                                                                                        <td className="text-nowrap">{prod.product_name}</td>
                                                                                        <td className="text-nowrap">{prod.customer_name}</td>
                                                                                        <td className="text-center">{prod.quantity}</td>
                                                                                        <td className="text-center">
                                                                                            <span className={`badge ${
                                                                                                prod.status === 'Completed' ? 'bg-success' :
                                                                                                prod.status === 'In Progress' ? 'bg-warning' :
                                                                                                'bg-secondary'
                                                                                            }`}>
                                                                                                {prod.status}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="text-center">
                                                                                            <div className="progress" style={{ height: '20px' }}>
                                                                                                <div 
                                                                                                    className="progress-bar bg-info" 
                                                                                                    role="progressbar"
                                                                                                    style={{ width: `${Number(prod.overall_progress) || 0}%` }}
                                                                                                >
                                                                                                    {(Number(prod.overall_progress) || 0).toFixed(0)}%
                                                                                                </div>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="text-center text-nowrap">{prod.start_date}</td>
                                                                                        <td className="text-center text-nowrap">{prod.estimated_completion}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center py-4 text-muted">
                                                                        No productions in this stage
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-5">
                                                    <FaHistory className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                                    <h5 className="text-muted">No Production Data</h5>
                                                    <p className="text-muted">No accepted or in-progress orders to display</p>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Preview Modal */}
            {showPreviewModal && (
                <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title d-flex align-items-center">
                                    <i className="fas fa-file-alt text-primary me-2"></i>
                                    {previewTitle}
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close" 
                                    onClick={() => setShowPreviewModal(false)}
                                ></button>
                            </div>
                            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                                {previewData && previewData.sections.map((section, sectionIndex) => (
                                    <div key={sectionIndex} className="mb-4">
                                        <h6 className="text-primary mb-3 border-bottom pb-2">
                                            <i className="fas fa-chart-bar me-2"></i>
                                            {section.title}
                                        </h6>
                                        
                                        {section.type === 'table' ? (
                                            <div className="table-responsive">
                                                <table className="table table-striped table-hover">
                                                    <thead className="table-dark">
                                                        <tr>
                                                            {section.headers.map((header, headerIndex) => (
                                                                <th key={headerIndex}>{header}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {section.data.map((row, rowIndex) => (
                                                            <tr key={rowIndex}>
                                                                {row.map((cell, cellIndex) => (
                                                                    <td key={cellIndex}>{cell}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="row">
                                                {section.data.map((item, itemIndex) => (
                                                    <div key={itemIndex} className="col-md-6 mb-3">
                                                        <div className="card border-0 shadow-sm">
                                                            <div className="card-body p-3">
                                                                <div className="d-flex justify-content-between align-items-center">
                                                                    <span className="text-muted fw-medium">{item.label}</span>
                                                                    <span className="fw-bold text-primary fs-5">{item.value}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={() => setShowPreviewModal(false)}
                                >
                                    <i className="fas fa-times me-2"></i>
                                    Close
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary"
                                    onClick={() => {
                                        const reportType = previewTitle.includes('Performance') ? 'performance' : 
                                                         previewTitle.includes('Work Progress') ? 'workprogress' : 'comprehensive';
                                        downloadReport(reportType);
                                        setShowPreviewModal(false);
                                    }}
                                >
                                    <i className="fas fa-download me-2"></i>
                                    Download CSV
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PDF Preview Modal */}
            {showPdfPreviewModal && pdfPreviewUrl && (
                <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
                    <div className="modal-dialog modal-fullscreen">
                        <div className="modal-content">
                            <div className="modal-header bg-white border-bottom">
                                <div className="d-flex align-items-center w-100">
                                    <div className="d-flex align-items-center me-3">
                                        <div className="rounded-circle bg-danger bg-opacity-10 p-2 me-2">
                                            <i className="fas fa-file-pdf text-danger"></i>
                                        </div>
                                        <div>
                                            <h5 className="modal-title mb-0 fw-bold">{pdfPreviewTitle}</h5>
                                            <small className="text-muted">UNICK Furniture - Production Report</small>
                                        </div>
                                    </div>
                                    <div className="ms-auto">
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-danger me-2"
                                            onClick={() => {
                                                const reportType = pdfPreviewTitle.includes('Performance') ? 'performance' : 
                                                                 pdfPreviewTitle.includes('Work Progress') ? 'workprogress' : 'comprehensive';
                                                downloadPdfReport(reportType);
                                            }}
                                        >
                                            <i className="fas fa-download me-2"></i>
                                            Download PDF
                                        </button>
                                        <button 
                                            type="button"
                                            className="btn-close"
                                            onClick={() => {
                                                setShowPdfPreviewModal(false);
                                                if (pdfPreviewUrl) {
                                                    window.URL.revokeObjectURL(pdfPreviewUrl);
                                                    setPdfPreviewUrl(null);
                                                }
                                            }}
                                        ></button>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-body p-0" style={{ height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
                                <iframe
                                    src={pdfPreviewUrl}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        border: 'none'
                                    }}
                                    title={pdfPreviewTitle}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ProductionReports;