import React, { useEffect, useState, useCallback } from "react";
import api from "../../api/client";
import { 
  BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, 
  ScatterChart, Scatter, ComposedChart
} from "recharts";
import { 
  FaBox, FaChartLine, FaClipboardList, FaHistory, 
  FaTruck, FaExclamationTriangle, FaCheckCircle,
  FaDownload, FaSync, FaFilter, FaSearch, FaEye, FaEdit
} from "react-icons/fa";
import { toast } from "sonner";

const EnhancedInventoryReports = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("overview");
    const [windowDays, setWindowDays] = useState(30);
    const [materialFilter, setMaterialFilter] = useState('all');
    const [stockFilter, setStockFilter] = useState('all'); // Filter for stock tab: 'all', 'alkansya', 'made_to_order'
    const [refreshKey, setRefreshKey] = useState(0);
    
    // Enhanced filter states for reports
    const [reportDateRange, setReportDateRange] = useState('days'); // 'days', 'weeks', 'months', 'year', 'custom'
    const [reportDateValue, setReportDateValue] = useState(30); // Number of days/weeks/months
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [reportCategoryFilter, setReportCategoryFilter] = useState('all'); // 'all', 'alkansya', 'made_to_order', 'raw', 'packaging'
    const [reportStatusFilter, setReportStatusFilter] = useState('all'); // 'all', 'in_stock', 'low_stock', 'out_of_stock', 'overstocked'
    const [reportMaterialFilter, setReportMaterialFilter] = useState('all'); // Material-specific filter
    
    // Enhanced data states
    const [dashboardData, setDashboardData] = useState(null);
    const [inventoryReport, setInventoryReport] = useState(null);
    const [replenishmentSchedule, setReplenishmentSchedule] = useState(null);
    const [forecastReport, setForecastReport] = useState(null);
    const [turnoverReport, setTurnoverReport] = useState(null);
    const [alkansyaStats, setAlkansyaStats] = useState(null);
    const [materialUsageAnalysis, setMaterialUsageAnalysis] = useState(null);
    const [inventoryTransactions, setInventoryTransactions] = useState(null);
    const [realTimeAlerts, setRealTimeAlerts] = useState(null);
    
    // Enhanced forecasting states
    const [forecastType, setForecastType] = useState('alkansya');
    const [forecastFilter, setForecastFilter] = useState('all'); // Filter for forecast tab
    const [alkansyaForecast, setAlkansyaForecast] = useState(null);
    const [madeToOrderForecast, setMadeToOrderForecast] = useState(null);
    const [overallForecast, setOverallForecast] = useState(null);
    
    // Enhanced replenishment states
    const [enhancedReplenishment, setEnhancedReplenishment] = useState(null);
    const [replenishmentView, setReplenishmentView] = useState('summary'); // summary, schedule, analytics
    const [replenishmentFilter, setReplenishmentFilter] = useState('all'); // all, alkansya, made_to_order
    
    // Enhanced transactions states
    const [enhancedTransactions, setEnhancedTransactions] = useState(null);
    const [transactionView, setTransactionView] = useState('list'); // list, summary, analytics
    const [transactionFilter, setTransactionFilter] = useState('all'); // all, alkansya, made_to_order, other
    
    // Modal states for report preview
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewTitle, setPreviewTitle] = useState('');
    
    // Modal states for PDF preview
    const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
    const [pdfPreviewTitle, setPdfPreviewTitle] = useState('');
    
    // Filtered data
    const [filteredInventoryData, setFilteredInventoryData] = useState(null);
    
    // Loading states for each tab
    const [tabLoadingStates, setTabLoadingStates] = useState({
        overview: false,
        stock: false,
        forecast: false,
        replenishment: false,
        transactions: false,
        alerts: false
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

            // Fetch materials, products, alkansya output, BOM data, and accepted orders for accurate stock calculation
            const [normalizedInventoryData, productsData, dailyOutputData, bomsData, acceptedOrdersData] = await Promise.all([
                safeFetch('/normalized-inventory/materials'),
                safeFetch('/normalized-inventory/products'),
                safeFetch('/normalized-inventory/daily-output'),
                safeFetch('/bom'),
                safeFetch('/orders/accepted') // Fetch accepted orders for Made-to-Order consumption calculation
            ]);

            // Process materials with MRP calculations
            let inventoryData = { items: [], summary: { total_items: 0, items_needing_reorder: 0, critical_items: 0, total_usage: 0 } };
            
            if (normalizedInventoryData && Array.isArray(normalizedInventoryData)) {
                const materials = normalizedInventoryData;
                const products = productsData || [];
                const alkansyaOutput = dailyOutputData?.daily_outputs || [];
                const boms = bomsData || [];
                const acceptedOrders = acceptedOrdersData?.orders || [];
                
                // Get Alkansya product IDs
                const alkansyaProductIds = products
                    .filter(p => p.category_name === 'Stocked Products' && p.name?.toLowerCase().includes('alkansya'))
                    .map(p => p.id);
                
                // Get Made to Order product IDs
                const madeToOrderProductIds = products
                    .filter(p => p.category_name === 'Made to Order')
                    .map(p => p.id);
                
                // Get Alkansya material IDs from BOM
                const alkansyaMaterialIds = boms
                    .filter(bom => alkansyaProductIds.includes(bom.product_id))
                    .map(bom => bom.material_id);
                
                // Get Made to Order material IDs from BOM
                const madeToOrderMaterialIds = boms
                    .filter(bom => madeToOrderProductIds.includes(bom.product_id))
                    .map(bom => bom.material_id);
                
                // Process each material with MRP calculations
                const processedItems = materials.map(material => {
                    // Check if material is used in Alkansya
                    const isAlkansyaMaterial = alkansyaMaterialIds.includes(material.material_id);
                    
                    // Check if material is used in Made to Order products
                    const isMadeToOrderMaterial = madeToOrderMaterialIds.includes(material.material_id);
                    
                    // Calculate average daily consumption from Alkansya output (use ALL data, not just last 30 days)
                    // This includes seeded data and manual entries
                    const allOutput = alkansyaOutput || [];
                    
                    // Find BOM entry for this material in Alkansya
                    const alkansyaBomEntry = boms.find(b => 
                        b.material_id === material.material_id && 
                        alkansyaProductIds.includes(b.product_id)
                    );
                    
                    // Calculate Alkansya consumption
                    let alkansyaConsumption = 0;
                    if (alkansyaBomEntry && allOutput.length > 0) {
                        // Get unique days with output
                        const uniqueDays = new Set();
                        const totalQuantity = allOutput.reduce((sum, o) => {
                            // Handle both date field names (date or output_date)
                            const date = o.date || o.output_date;
                            if (date) {
                                // Normalize date to YYYY-MM-DD format
                                const dateStr = typeof date === 'string' 
                                    ? date.split('T')[0] 
                                    : new Date(date).toISOString().split('T')[0];
                                uniqueDays.add(dateStr);
                            }
                            return sum + (o.quantity_produced || 0);
                        }, 0);
                        
                        // Calculate average by dividing by actual number of days with output
                        const actualDaysWithOutput = uniqueDays.size || allOutput.length;
                        const avgDailyOutput = actualDaysWithOutput > 0 ? totalQuantity / actualDaysWithOutput : 0;
                        alkansyaConsumption = avgDailyOutput * (alkansyaBomEntry.quantity_per_product || 0);
                        
                        // Debug logging
                        if (material.material_id === alkansyaMaterialIds[0]) {
                            console.log('Alkansya Consumption Calculation:', {
                                material: material.material_name,
                                totalOutput: allOutput.length,
                                uniqueDays: uniqueDays.size,
                                totalQuantity,
                                avgDailyOutput,
                                qtyPerUnit: alkansyaBomEntry.quantity_per_product,
                                alkansyaConsumption
                            });
                        }
                    }
                    
                    // Calculate Made-to-Order consumption from accepted orders (use ALL orders, not just last 30 days)
                    // This includes seeded data and manual orders
                    let madeToOrderConsumption = 0;
                    if (isMadeToOrderMaterial && acceptedOrders.length > 0) {
                        // Use ALL accepted orders, not just recent ones
                        const allAcceptedOrders = acceptedOrders || [];
                        
                        // Get unique days with orders
                        const uniqueOrderDays = new Set();
                        const totalQuantityOrdered = allAcceptedOrders.reduce((sum, order) => {
                            const orderDate = order.accepted_at || order.created_at;
                            if (orderDate) {
                                // Normalize date to YYYY-MM-DD format
                                const dateStr = typeof orderDate === 'string' 
                                    ? orderDate.split('T')[0] 
                                    : new Date(orderDate).toISOString().split('T')[0];
                                uniqueOrderDays.add(dateStr);
                            }
                            
                            const orderProducts = order.order_items || order.products || [];
                            const materialQuantity = orderProducts.reduce((prodSum, item) => {
                                const orderBomEntry = boms.find(b => 
                                    b.product_id === item.product_id && 
                                    b.material_id === material.material_id &&
                                    madeToOrderProductIds.includes(b.product_id)
                                );
                                if (orderBomEntry) {
                                    return prodSum + (item.quantity * orderBomEntry.quantity_per_product);
                                }
                                return prodSum;
                            }, 0);
                            return sum + materialQuantity;
                        }, 0);
                        
                        // Calculate average by dividing by actual number of days with orders
                        const actualDaysWithOrders = uniqueOrderDays.size || allAcceptedOrders.length;
                        madeToOrderConsumption = actualDaysWithOrders > 0 ? totalQuantityOrdered / actualDaysWithOrders : 0;
                    }
                    
                    // Total average daily consumption
                    let avgDailyConsumption = alkansyaConsumption + madeToOrderConsumption;
                    
                    // Calculate safety stock (typically 2 weeks of average consumption)
                    const safetyStock = Math.ceil(avgDailyConsumption * 14);
                    
                    // Use backend reorder_level if available, otherwise calculate reorder point
                    // Backend reorder_level is the actual threshold from database
                    const backendReorderLevel = material.reorder_level || 0;
                    const leadTimeDays = material.lead_time_days || 7;
                    const calculatedReorderPoint = safetyStock + Math.ceil(avgDailyConsumption * leadTimeDays);
                    // Prefer backend reorder_level, fallback to calculated
                    const reorderPoint = backendReorderLevel > 0 ? backendReorderLevel : calculatedReorderPoint;
                    
                    // Calculate max level (use backend max_level if set, otherwise calculate)
                    const backendMaxLevel = material.max_level || 0;
                    const calculatedMaxLevel = Math.ceil(avgDailyConsumption * 30);
                    const maxLevel = backendMaxLevel > 0 ? backendMaxLevel : calculatedMaxLevel;
                    
                    // Determine stock status based on current available quantity
                    // Priority order: Out of Stock > Critical > Need Reorder > Overstocked > In Stock
                    // Use backend status if available, otherwise calculate
                    const availableQty = material.available_quantity || 0;
                    const criticalStock = material.critical_stock || 0;
                    let stockStatus = material.status || 'in_stock';
                    
                    // If backend didn't provide status, calculate it
                    if (!material.status) {
                        if (availableQty <= 0) {
                            stockStatus = 'out_of_stock';
                        } else if (criticalStock > 0 && availableQty <= criticalStock) {
                            // Critical: Stock is at or below critical level
                            stockStatus = 'critical';
                        } else if (reorderPoint > 0 && availableQty <= reorderPoint) {
                            // Need Reorder: Stock is at or below reorder point
                            stockStatus = 'need_reorder';
                        } else if (maxLevel > 0 && availableQty > maxLevel) {
                            // Overstocked: Current stock exceeds max level
                            stockStatus = 'overstocked';
                        }
                    }
                    
                    // Determine needs_reorder: use backend flag if available, otherwise check against reorder_point
                    // Handle backend needs_reorder as boolean, string, or number
                    const backendNeedsReorder = material.needs_reorder !== undefined 
                        ? (material.needs_reorder === true || material.needs_reorder === 'true' || material.needs_reorder === 1 || material.needs_reorder === '1')
                        : undefined;
                    const calculatedNeedsReorder = reorderPoint > 0 && availableQty <= reorderPoint;
                    const needsReorder = backendNeedsReorder !== undefined ? backendNeedsReorder : calculatedNeedsReorder;
                    
                    // Calculate days until stockout
                    const daysUntilStockout = avgDailyConsumption > 0 
                        ? Math.floor(availableQty / avgDailyConsumption) 
                        : 999;
                    
                    // Calculate total value
                    const totalValue = (material.available_quantity || 0) * (material.standard_cost || 0);
                    
                    return {
                        material_id: material.material_id,
                        name: material.material_name,
                        material_code: material.material_code,
                        sku: material.material_code,
                        category: material.category || 'raw',
                        current_stock: material.available_quantity || 0,
                        available_quantity: material.available_quantity || 0,
                        quantity_on_hand: material.total_quantity_on_hand || 0,
                        quantity_reserved: material.total_quantity_reserved || 0,
                        unit: material.unit_of_measure || 'pcs',
                        unit_cost: material.standard_cost || 0,
                        value: totalValue,
                        reorder_point: reorderPoint,
                        reorder_level: backendReorderLevel, // Include backend reorder_level for reference
                        safety_stock: safetyStock,
                        max_level: maxLevel,
                        critical_stock: material.critical_stock || 0,
                        lead_time_days: leadTimeDays,
                        supplier: material.supplier || 'N/A',
                        location: material.location || 'Windfield 2',
                        stock_status: stockStatus,
                        is_alkansya_material: isAlkansyaMaterial,
                        is_made_to_order_material: isMadeToOrderMaterial,
                        avg_daily_consumption: avgDailyConsumption,
                        days_until_stockout: daysUntilStockout,
                        needs_reorder: needsReorder,
                        stock_variant: material.status_variant || 'success',
                        status_label: material.status_label || 'In Stock'
                    };
                });
                
                inventoryData = {
                    items: processedItems,
                    summary: {
                        total_items: processedItems.length,
                        items_needing_reorder: processedItems.filter(i => i.needs_reorder).length,
                        critical_items: processedItems.filter(i => i.stock_status === 'critical' || i.stock_status === 'out_of_stock').length,
                        critical_stock_items: processedItems.filter(i => {
                            const qty = i.available_quantity || 0;
                            const critical = i.critical_stock || 0;
                            return critical > 0 && qty <= critical && qty > 0;
                        }).length,
                        total_usage: processedItems.reduce((sum, item) => sum + item.avg_daily_consumption, 0),
                        total_value: processedItems.reduce((sum, item) => sum + item.value, 0),
                        alkansya_materials: processedItems.filter(i => i.is_alkansya_material).length,
                        made_to_order_materials: processedItems.filter(i => i.is_made_to_order_material).length,
                        // Low Stock includes both critical and need reorder items
                        // Use needs_reorder flag from backend OR check status OR check quantities directly
                        low_stock_items: (() => {
                            // First, log all materials to see what we're working with
                            console.log('All Processed Items for Low Stock Check:', processedItems.map(i => ({
                                name: i.name,
                                qty: i.available_quantity,
                                reorder_level: i.reorder_level,
                                reorder_point: i.reorder_point,
                                critical_stock: i.critical_stock,
                                status: i.stock_status,
                                status_label: i.status_label,
                                needs_reorder: i.needs_reorder,
                                needs_reorder_type: typeof i.needs_reorder
                            })));
                            
                            const lowStockItems = processedItems.filter(i => {
                                const qty = i.available_quantity || 0;
                                const critical = i.critical_stock || 0;
                                // Use reorder_level from backend if available, otherwise use calculated reorder_point
                                const reorderPoint = i.reorder_level || i.reorder_point || 0;
                                const stockStatus = i.stock_status || i.status || '';
                                
                                // Handle needs_reorder as boolean, string, or number
                                const needsReorder = i.needs_reorder === true || 
                                                   i.needs_reorder === 'true' || 
                                                   i.needs_reorder === 1 ||
                                                   i.needs_reorder === '1';
                                
                                // Include if:
                                // 1. Backend says it needs reorder
                                // 2. Status is critical or need_reorder
                                // 3. Quantity is at or below critical level (and critical > 0)
                                // 4. Quantity is at or below reorder point/level (and reorderPoint > 0)
                                const shouldInclude = needsReorder || 
                                       stockStatus === 'critical' || 
                                       stockStatus === 'need_reorder' || 
                                       (critical > 0 && qty <= critical && qty > 0) || 
                                       (reorderPoint > 0 && qty <= reorderPoint);
                                
                                // Debug logging for ALL items to see what's happening
                                console.log('Checking Material:', {
                                    name: i.name,
                                    qty,
                                    reorderPoint,
                                    reorder_level: i.reorder_level,
                                    reorder_point: i.reorder_point,
                                    critical,
                                    stockStatus,
                                    status_from_backend: i.status,
                                    needsReorder,
                                    needs_reorder_raw: i.needs_reorder,
                                    shouldInclude,
                                    reason: needsReorder ? 'needs_reorder flag' :
                                            stockStatus === 'critical' ? 'critical status' :
                                            stockStatus === 'need_reorder' ? 'need_reorder status' :
                                            (critical > 0 && qty <= critical) ? 'below critical' :
                                            (reorderPoint > 0 && qty <= reorderPoint) ? 'below reorder point' :
                                            'not included'
                                });
                                
                                return shouldInclude;
                            });
                            
                            console.log('Low Stock Summary:', {
                                total: lowStockItems.length,
                                items: lowStockItems.map(i => ({
                                    name: i.name,
                                    qty: i.available_quantity,
                                    reorderPoint: i.reorder_point,
                                    reorderLevel: i.reorder_level,
                                    status: i.stock_status,
                                    needsReorder: i.needs_reorder
                                }))
                            });
                            
                            return lowStockItems.length;
                        })(),
                        out_of_stock_items: processedItems.filter(i => i.stock_status === 'out_of_stock').length,
                        alkansya_out_of_stock: processedItems.filter(i => i.is_alkansya_material && i.stock_status === 'out_of_stock').length,
                        alkansya_needs_reorder: processedItems.filter(i => i.is_alkansya_material && i.needs_reorder).length,
                        made_to_order_out_of_stock: processedItems.filter(i => i.is_made_to_order_material && i.stock_status === 'out_of_stock').length,
                        made_to_order_needs_reorder: processedItems.filter(i => i.is_made_to_order_material && i.needs_reorder).length,
                        overstocked_items: processedItems.filter(i => i.stock_status === 'overstocked' || (i.max_level > 0 && i.available_quantity > i.max_level)).length
                    }
                };
            }
            
            setDashboardData({
                summary: {
                    total_items: inventoryData.summary.total_items,
                    low_stock_items: inventoryData.summary.low_stock_items || inventoryData.summary.items_needing_reorder || 0,
                    out_of_stock_items: inventoryData.summary.critical_items,
                    recent_usage: inventoryData.summary.total_usage,
                    total_value: inventoryData.summary.total_value || 0,
                    critical_items: inventoryData.summary.critical_items,
                    alkansya_materials: inventoryData.summary.alkansya_materials,
                    made_to_order_materials: inventoryData.summary.made_to_order_materials,
                    alkansya_out_of_stock: inventoryData.summary.alkansya_out_of_stock,
                    alkansya_needs_reorder: inventoryData.summary.alkansya_needs_reorder,
                    made_to_order_out_of_stock: inventoryData.summary.made_to_order_out_of_stock,
                    made_to_order_needs_reorder: inventoryData.summary.made_to_order_needs_reorder
                },
                critical_items: inventoryData.items.filter(item => item.stock_status === 'out_of_stock' || item.stock_status === 'critical'),
                recent_activities: []
            });
            
            setInventoryReport(inventoryData);
            
            // Apply initial filter
            applyFilter(inventoryData, materialFilter);
            
            // Also set filtered data initially
            setFilteredInventoryData(inventoryData);

            // Set default values for other data
            setTurnoverReport([]);
            setAlkansyaStats({ total_output: 0, average_daily: 0, last_7_days: 0, production_efficiency: 0 });
            setMaterialUsageAnalysis([]);

        } catch (error) {
            console.error('Error fetching reports:', error);
            setError('Failed to load inventory reports. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [windowDays, refreshKey, materialFilter]);

    useEffect(() => {
        fetchAllReports();
    }, [fetchAllReports]);
    
    // Reload stock data when filter changes (only if already on stock tab)
    useEffect(() => {
        if (activeTab === 'stock' && !tabLoadingStates.stock) {
            loadTabData('stock');
        }
    }, [stockFilter, activeTab]);


    const handleGlobalRefresh = () => {
        setRefreshKey(prev => prev + 1);
        toast.success("Reports refreshed successfully!");
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
    const previewReport = async (reportType) => {
        try {
            console.log('Preview Report - Type:', reportType);
            console.log('Preview Report - filteredInventoryData:', filteredInventoryData);
            console.log('Preview Report - inventoryReport:', inventoryReport);
            console.log('Preview Report - enhancedReplenishment:', enhancedReplenishment);
            
            // Ensure data is loaded before generating preview
            if (reportType === 'replenishment' && !enhancedReplenishment) {
                toast.info('Loading replenishment data...');
                await fetchEnhancedReplenishmentData();
            }
            
            if (reportType === 'usage' && !filteredInventoryData && !inventoryReport) {
                toast.info('Loading inventory data...');
                await fetchAllReports();
            }
            
            let data = null;
            let title = '';

            const dateRange = getDateRange();
            
            switch(reportType) {
                case 'stock':
                    const stockData = filteredInventoryData || inventoryReport;
                    if (!stockData) {
                        toast.warning('Stock data not loaded. Please wait for data to load.');
                        return;
                    }
                    const filteredStockData = applyFiltersToData(stockData);
                    data = generateStockReportData(filteredStockData, dateRange);
                    title = `Stock Levels Report (${dateRange.start_date} to ${dateRange.end_date})`;
                    break;
                case 'usage':
                    const usageData = filteredInventoryData || inventoryReport;
                    if (!usageData) {
                        toast.warning('Usage data not loaded. Please wait for data to load.');
                        return;
                    }
                    const filteredUsageData = applyFiltersToData(usageData);
                    data = generateUsageReportData(filteredUsageData, alkansyaForecast, madeToOrderForecast, dateRange);
                    title = `Material Usage Trends Report (${dateRange.start_date} to ${dateRange.end_date})`;
                    break;
                case 'replenishment':
                    if (!enhancedReplenishment) {
                        toast.warning('Replenishment data not loaded. Please wait for data to load.');
                        return;
                    }
                    data = generateReplenishmentReportData(enhancedReplenishment, dateRange, reportCategoryFilter);
                    title = `Replenishment Schedule Report (${dateRange.start_date} to ${dateRange.end_date})`;
                    break;
                case 'full':
                    const fullInventoryData = filteredInventoryData || inventoryReport;
                    if (!fullInventoryData) {
                        toast.warning('Inventory data not loaded. Please wait for data to load.');
                        return;
                    }
                    const filteredFullData = applyFiltersToData(fullInventoryData);
                    data = generateFullReportData(filteredFullData, enhancedReplenishment, dateRange);
                    title = `Complete Inventory Report (${dateRange.start_date} to ${dateRange.end_date})`;
                    break;
                default:
                    return;
            }

            console.log('Preview Report - Generated data:', data);
            console.log('Preview Report - Data sections:', data?.sections);
            
            if (!data || !data.sections || data.sections.length === 0) {
                toast.warning('No data available for preview. Please ensure the data is loaded by navigating to the respective tab first.');
                console.warn('Preview Report - No data generated');
                return;
            }

            setPreviewData(data);
            setPreviewTitle(title);
            setShowPreviewModal(true);
        } catch (error) {
            console.error('Error generating preview:', error);
            console.error('Error stack:', error.stack);
            toast.error('Failed to generate report preview. Please try again.');
        }
    };

    // Download Report Function
    const downloadReport = (reportType) => {
        try {
            const dateRange = getDateRange();
            let filename = '';
            let content = '';

            switch(reportType) {
                case 'stock':
                    const stockData = filteredInventoryData || inventoryReport;
                    const filteredStockData = applyFiltersToData(stockData);
                    filename = `Stock_Levels_Report_${dateRange.start_date}_to_${dateRange.end_date}.csv`;
                    content = generateStockReportCSV(filteredStockData, dateRange, reportCategoryFilter, reportStatusFilter);
                    break;
                case 'usage':
                    const usageData = filteredInventoryData || inventoryReport;
                    const filteredUsageData = applyFiltersToData(usageData);
                    filename = `Material_Usage_Trends_Report_${dateRange.start_date}_to_${dateRange.end_date}.csv`;
                    content = generateUsageReportCSV(filteredUsageData, alkansyaForecast, madeToOrderForecast, dateRange, reportCategoryFilter);
                    break;
                case 'replenishment':
                    filename = `Replenishment_Schedule_Report_${dateRange.start_date}_to_${dateRange.end_date}.csv`;
                    content = generateReplenishmentReportCSV(enhancedReplenishment, dateRange, reportCategoryFilter);
                    break;
                case 'full':
                    const fullInventoryData = filteredInventoryData || inventoryReport;
                    const filteredFullData = applyFiltersToData(fullInventoryData);
                    filename = `Complete_Inventory_Report_${dateRange.start_date}_to_${dateRange.end_date}.csv`;
                    content = generateFullReportCSV(filteredFullData, enhancedReplenishment, dateRange, reportCategoryFilter, reportStatusFilter);
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
            
            toast.success(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report downloaded successfully!`);
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
                case 'stock':
                    url = `http://localhost:8000/api/enhanced-inventory-reports/export-pdf?report_type=stock&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}&status=${reportStatusFilter}`;
                    title = 'Stock Levels Report - PDF Preview';
                    break;
                case 'usage':
                    url = `http://localhost:8000/api/enhanced-inventory-reports/export-pdf?report_type=usage&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}`;
                    title = 'Material Usage Trends Report - PDF Preview';
                    break;
                case 'replenishment':
                    url = `http://localhost:8000/api/enhanced-inventory-reports/export-pdf?report_type=replenishment&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}`;
                    title = 'Replenishment Schedule Report - PDF Preview';
                    break;
                case 'full':
                    url = `http://localhost:8000/api/enhanced-inventory-reports/export-pdf?report_type=full&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}&status=${reportStatusFilter}`;
                    title = 'Complete Inventory Report - PDF Preview';
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
                case 'stock':
                    url = `http://localhost:8000/api/enhanced-inventory-reports/export-pdf?report_type=stock&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}&status=${reportStatusFilter}`;
                    break;
                case 'usage':
                    url = `http://localhost:8000/api/enhanced-inventory-reports/export-pdf?report_type=usage&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}`;
                    break;
                case 'replenishment':
                    url = `http://localhost:8000/api/enhanced-inventory-reports/export-pdf?report_type=replenishment&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}`;
                    break;
                case 'full':
                    // Use enhanced inventory reports endpoint for complete report
                    url = `http://localhost:8000/api/enhanced-inventory-reports/export-pdf?report_type=full&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&category=${reportCategoryFilter}&status=${reportStatusFilter}`;
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
            link.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`;
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

    // Generate Stock Levels Report CSV
    // Helper function to calculate accurate stock status
    const calculateStockStatus = (item) => {
        const availableQty = item.current_stock || item.available_quantity || 0;
        const criticalStock = item.critical_stock || item.safety_stock || 0;
        const reorderPoint = item.reorder_point || item.reorder_level || 0;
        const maxLevel = item.max_level || 0;
        
        // Priority: Out of Stock > Critical > Low Stock > Overstocked > In Stock
        if (availableQty <= 0) {
            return 'Out of Stock';
        } else if (criticalStock > 0 && availableQty <= criticalStock) {
            return 'Critical';
        } else if (reorderPoint > 0 && availableQty <= reorderPoint) {
            return 'Low Stock';
        } else if (maxLevel > 0 && availableQty > maxLevel) {
            return 'Overstocked';
        }
        return 'In Stock';
    };

    // Apply filters to inventory data
    const applyFiltersToData = (data) => {
        if (!data || !data.items) {
            return data || { items: [], summary: { total_items: 0, items_needing_reorder: 0, critical_items: 0, low_stock_items: 0 } };
        }
        
        let filteredItems = [...data.items];
        
        // Apply category filter
        if (reportCategoryFilter !== 'all') {
            filteredItems = filteredItems.filter(item => {
                if (reportCategoryFilter === 'alkansya') return item.is_alkansya_material === true;
                if (reportCategoryFilter === 'made_to_order') return item.is_made_to_order_material === true;
                if (reportCategoryFilter === 'raw') return item.category === 'raw';
                if (reportCategoryFilter === 'packaging') return item.category === 'packaging';
                return false;
            });
        }
        
        // Apply status filter
        if (reportStatusFilter !== 'all') {
            filteredItems = filteredItems.filter(item => {
                const status = calculateStockStatus(item);
                if (reportStatusFilter === 'in_stock') return status === 'In Stock';
                if (reportStatusFilter === 'low_stock') return status === 'Low Stock';
                if (reportStatusFilter === 'out_of_stock') return status === 'Out of Stock';
                if (reportStatusFilter === 'overstocked') return status === 'Overstocked';
                return false;
            });
        }
        
        // Recalculate summary based on filtered items
        const lowStockItems = filteredItems.filter(item => {
            const status = calculateStockStatus(item);
            return status === 'Low Stock' || status === 'Critical' || status === 'Out of Stock';
        }).length;
        
        const criticalItems = filteredItems.filter(item => {
            const status = calculateStockStatus(item);
            return status === 'Critical' || status === 'Out of Stock';
        }).length;
        
        const overstockedItems = filteredItems.filter(item => {
            const status = calculateStockStatus(item);
            return status === 'Overstocked';
        }).length;
        
        return {
            ...data,
            items: filteredItems,
            summary: {
                ...data.summary,
                total_items: filteredItems.length,
                items_needing_reorder: lowStockItems,
                low_stock_items: lowStockItems,
                critical_items: criticalItems,
                overstocked_items: overstockedItems
            }
        };
    };

    const generateStockReportCSV = (data, dateRange = null, categoryFilter = 'all', statusFilter = 'all') => {
        // Apply filters using the same function
        const filteredData = applyFiltersToData(data);
        
        if (!filteredData || !filteredData.items || filteredData.items.length === 0) {
            const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
            return `Material Name,SKU,Available Quantity,Safety Stock,Reorder Point,Max Level,Days Until Stockout,Status,Category,Unit Cost,Date Range\nNo materials found matching the selected filters.\nDate Range: ${dateRangeStr}\nCategory Filter: ${categoryFilter === 'all' ? 'All' : categoryFilter}\nStatus Filter: ${statusFilter === 'all' ? 'All' : statusFilter}`;
        }
        
        const headers = 'Material Name,SKU,Available Quantity,Safety Stock,Reorder Point,Max Level,Days Until Stockout,Status,Category,Unit Cost,Date Range\n';
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        const rows = filteredData.items.map(item => {
            const status = calculateStockStatus(item);
            return `"${item.name || item.material_name || 'N/A'}",${item.material_code || 'N/A'},${item.current_stock || item.available_quantity || 0},${item.safety_stock || item.critical_stock || 0},${item.reorder_point || item.reorder_level || 0},${item.max_level || 0},${item.days_until_stockout || 'N/A'},"${status}",${item.is_alkansya_material ? 'Alkansya' : item.is_made_to_order_material ? 'Made to Order' : 'Other'},₱${item.unit_cost || 0},"${dateRangeStr}"`
        }).join('\n');
        
        return headers + rows;
    };

    // Generate Usage Trends Report CSV
    const generateUsageReportCSV = (inventoryData, alkansyaForecast, madeToOrderForecast, dateRange = null, categoryFilter = 'all') => {
        // Apply filters - only category filter for usage reports
        let filteredData = { ...inventoryData };
        if (categoryFilter !== 'all' && inventoryData?.items) {
            filteredData.items = inventoryData.items.filter(item => {
                if (categoryFilter === 'alkansya') return item.is_alkansya_material === true;
                if (categoryFilter === 'made_to_order') return item.is_made_to_order_material === true;
                if (categoryFilter === 'raw') return item.category === 'raw';
                if (categoryFilter === 'packaging') return item.category === 'packaging';
                return false;
            });
        }
        
        const filteredItems = filteredData?.items || [];
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        
        if (filteredItems.length === 0) {
            return `Material Name,Category,Average Daily Consumption,Current Stock,Max Level,Days Until Stockout,Projected Usage (30 days),Projected Stock (30 days),Current Status,Projected Status (30 days),Total Consumption,Days With Consumption,Date Range\nNo materials found matching the selected filters.\nDate Range: ${dateRangeStr}\nCategory Filter: ${categoryFilter === 'all' ? 'All' : categoryFilter}`;
        }
        
        let content = 'Material Name,Category,Average Daily Consumption,Current Stock,Max Level,Days Until Stockout,Projected Usage (30 days),Projected Stock (30 days),Current Status,Projected Status (30 days),Total Consumption,Days With Consumption,Date Range\n';
        
        if (filteredItems.length > 0) {
            filteredItems.forEach(item => {
                const currentStatus = calculateStockStatus(item);
                
                // Calculate projected stock after 30 days
                const avgDailyConsumption = item.avg_daily_consumption || 0;
                const currentStock = item.current_stock || item.available_quantity || 0;
                const projectedUsage30Days = avgDailyConsumption * 30;
                const projectedStock30Days = currentStock - projectedUsage30Days;
                
                // Calculate projected status
                const maxLevel = item.max_level || 0;
                const criticalStock = item.critical_stock || item.safety_stock || 0;
                const reorderPoint = item.reorder_point || item.reorder_level || 0;
                
                let projectedStatus = 'In Stock';
                if (projectedStock30Days <= 0) {
                    projectedStatus = 'Out of Stock';
                } else if (criticalStock > 0 && projectedStock30Days <= criticalStock) {
                    projectedStatus = 'Critical';
                } else if (reorderPoint > 0 && projectedStock30Days <= reorderPoint) {
                    projectedStatus = 'Low Stock';
                } else if (maxLevel > 0 && projectedStock30Days > maxLevel) {
                    projectedStatus = 'Overstocked';
                }
                
                content += `"${item.name || item.material_name || 'N/A'}",${item.is_alkansya_material ? 'Alkansya' : item.is_made_to_order_material ? 'Made to Order' : 'Other'},${Number(avgDailyConsumption || 0).toFixed(2)},${Number(currentStock || 0).toFixed(2)},${Number(maxLevel || 0).toFixed(2)},${item.days_until_stockout || 'N/A'},${Number(projectedUsage30Days || 0).toFixed(2)},${Number(projectedStock30Days || 0).toFixed(2)},${currentStatus},${projectedStatus},${item.total_consumption || 0},${item.days_with_consumption || 0},"${dateRangeStr}"\n`;
            });
        }
        
        return content;
    };

    // Generate Replenishment Report CSV
    const generateReplenishmentReportCSV = (replenishmentData, dateRange = null, categoryFilter = 'all') => {
        let content = 'Material Name,Category,Current Stock,Reorder Point,Max Level,Recommended Quantity,Days Until Reorder,Priority,Status,Unit Cost,Estimated Cost,Date Range\n';
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        
        const processItem = (item, category) => {
            // Use projected stock for status calculation if available
            const stockForStatus = item.projected_stock !== undefined ? item.projected_stock : item.current_stock;
            const status = calculateStockStatus({
                current_stock: stockForStatus,
                available_quantity: stockForStatus,
                critical_stock: item.critical_stock,
                reorder_point: item.reorder_point,
                max_level: item.max_level
            });
            
            // Use days_remaining (days until stockout) for "Days Until Reorder" column
            const daysUntilReorder = item.days_remaining !== null && item.days_remaining !== undefined 
                ? (typeof item.days_remaining === 'number' ? item.days_remaining.toFixed(1) : item.days_remaining)
                : (item.days_until_stockout !== null && item.days_until_stockout !== undefined && item.days_until_stockout < 999
                    ? (typeof item.days_until_stockout === 'number' ? item.days_until_stockout.toFixed(1) : item.days_until_stockout)
                    : 'N/A');
            
            const unitCost = item.unit_cost || 0;
            const recommendedQty = item.recommended_quantity || 0;
            const estimatedCost = recommendedQty * unitCost;
            
            content += `"${item.material_name || 'N/A'}",${category},${item.current_stock || 0},${item.reorder_point || 0},${item.max_level || 0},${recommendedQty},${daysUntilReorder},"${item.priority || 'Normal'}","${status}",${unitCost.toFixed(2)},${estimatedCost.toFixed(2)},"${dateRangeStr}"\n`;
        };
        
        // Apply category filter
        if (replenishmentData && replenishmentData.alkansya_replenishment && replenishmentData.alkansya_replenishment.schedule) {
            if (categoryFilter === 'all' || categoryFilter === 'alkansya') {
                replenishmentData.alkansya_replenishment.schedule.forEach(item => {
                    processItem(item, 'Alkansya');
                });
            }
        }
        
        if (replenishmentData && replenishmentData.made_to_order_replenishment && replenishmentData.made_to_order_replenishment.schedule) {
            if (categoryFilter === 'all' || categoryFilter === 'made_to_order') {
                replenishmentData.made_to_order_replenishment.schedule.forEach(item => {
                    processItem(item, 'Made to Order');
                });
            }
        }
        
        // Also include comprehensive replenishment items if available
        if (replenishmentData && replenishmentData.replenishment_items && Array.isArray(replenishmentData.replenishment_items)) {
            const processedNames = new Set();
            
            // Add already processed materials to set
            if (replenishmentData.alkansya_replenishment?.schedule) {
                replenishmentData.alkansya_replenishment.schedule.forEach(item => {
                    processedNames.add(item.material_name);
                });
            }
            if (replenishmentData.made_to_order_replenishment?.schedule) {
                replenishmentData.made_to_order_replenishment.schedule.forEach(item => {
                    processedNames.add(item.material_name);
                });
            }
            
            // Process remaining items
            replenishmentData.replenishment_items.forEach(item => {
                if (!processedNames.has(item.material_name)) {
                    const category = item.is_alkansya_material ? 'Alkansya' : 
                                   item.is_made_to_order_material ? 'Made to Order' : 'Other';
                    processItem(item, category);
                    processedNames.add(item.material_name);
                }
            });
        }
        
        return content;
    };

    // Generate Full Report CSV
    const generateFullReportCSV = (inventoryData, replenishmentData, dateRange = null, categoryFilter = 'all', statusFilter = 'all') => {
        // Apply filters using the same function
        const filteredData = applyFiltersToData(inventoryData);
        const filteredItems = filteredData?.items || [];
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        
        let content = 'INVENTORY REPORT SUMMARY\n';
        content += `Generated: ${new Date().toLocaleString()}\n`;
        content += `Date Range: ${dateRangeStr}\n`;
        content += `Category Filter: ${categoryFilter === 'all' ? 'All' : categoryFilter}\n`;
        content += `Status Filter: ${statusFilter === 'all' ? 'All' : statusFilter}\n`;
        content += `Total Materials: ${filteredItems.length}\n`;
        content += `Materials Needing Reorder: ${filteredData.summary?.items_needing_reorder || 0}\n`;
        content += `Critical Items: ${filteredData.summary?.critical_items || 0}\n`;
        content += `Overstocked Items: ${filteredData.summary?.overstocked_items || 0}\n\n`;
        
        content += '\nMATERIAL DETAILS\n';
        content += 'Material Name,SKU,Category,Available Qty,Safety Stock,Reorder Point,Max Level,Days Left,Status,Unit Cost,Total Value,Date Range\n';
        
        if (filteredItems.length > 0) {
            filteredItems.forEach(item => {
                const status = calculateStockStatus(item);
                content += `"${item.name || item.material_name || 'N/A'}",${item.material_code || 'N/A'},${item.is_alkansya_material ? 'Alkansya' : item.is_made_to_order_material ? 'Made to Order' : 'Other'},${item.current_stock || item.available_quantity || 0},${item.safety_stock || item.critical_stock || 0},${item.reorder_point || item.reorder_level || 0},${item.max_level || 0},${item.days_until_stockout || 'N/A'},"${status}",₱${item.unit_cost || 0},₱${((item.current_stock || item.available_quantity || 0) * (item.unit_cost || 0)).toFixed(2)},"${dateRangeStr}"\n`;
            });
        } else {
            content += `No materials found matching the selected filters.\n`;
        }
        
        return content;
    };

    // Generate Stock Levels Report Data for Preview
    const generateStockReportData = (data, dateRange = null) => {
        if (!data || !data.items) return { sections: [] };
        
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        
        return {
            sections: [
                {
                    title: 'Report Information',
                    data: [
                        { label: 'Date Range', value: dateRangeStr },
                        { label: 'Category Filter', value: reportCategoryFilter === 'all' ? 'All' : reportCategoryFilter },
                        { label: 'Status Filter', value: reportStatusFilter === 'all' ? 'All' : reportStatusFilter }
                    ]
                },
                {
                    title: 'Stock Summary',
                    data: [
                        { label: 'Total Materials', value: data.summary?.total_items || data.items.length || 0 },
                        { label: 'Materials Needing Reorder', value: data.summary?.items_needing_reorder || 0 },
                        { label: 'Critical Items', value: data.summary?.critical_items || 0 },
                        { label: 'Low Stock Items', value: data.summary?.low_stock_items || 0 },
                        { label: 'Overstocked Items', value: data.items.filter(item => {
                            const status = calculateStockStatus(item);
                            return status === 'Overstocked';
                        }).length }
                    ]
                },
                {
                    title: 'Material Details',
                    type: 'table',
                    headers: ['Material Name', 'SKU', 'Available Qty', 'Safety Stock', 'Reorder Point', 'Max Level', 'Days Left', 'Status', 'Unit Cost'],
                    data: data.items.map(item => {
                        const status = calculateStockStatus(item);
                        return [
                            item.name,
                            item.material_code,
                            item.current_stock || item.available_quantity || 0,
                            item.safety_stock || item.critical_stock || 0,
                            item.reorder_point || item.reorder_level || 0,
                            item.max_level || 0,
                            item.days_until_stockout || 'N/A',
                            status,
                            `₱${item.unit_cost || 0}`
                        ];
                    })
                }
            ]
        };
    };

    // Generate Usage Trends Report Data for Preview
    const generateUsageReportData = (inventoryData, alkansyaForecast, madeToOrderForecast, dateRange = null) => {
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        
        // Apply category filter to usage data
        let filteredData = { ...inventoryData };
        if (reportCategoryFilter !== 'all' && inventoryData?.items) {
            filteredData.items = inventoryData.items.filter(item => {
                if (reportCategoryFilter === 'alkansya') return item.is_alkansya_material === true;
                if (reportCategoryFilter === 'made_to_order') return item.is_made_to_order_material === true;
                if (reportCategoryFilter === 'raw') return item.category === 'raw';
                if (reportCategoryFilter === 'packaging') return item.category === 'packaging';
                return false;
            });
        }
        
        // Use filtered inventoryData items to calculate usage data
        const usageData = filteredData?.items || [];
        
        if (usageData.length === 0) {
            return {
                sections: [
                    {
                        title: 'Report Information',
                        data: [
                            { label: 'Date Range', value: dateRangeStr },
                            { label: 'Category Filter', value: reportCategoryFilter === 'all' ? 'All' : reportCategoryFilter }
                        ]
                    },
                    {
                        title: 'Usage Summary',
                        data: [
                            { label: 'Total Consumption', value: '0.00' },
                            { label: 'Alkansya Consumption', value: '0.00' },
                            { label: 'Made-to-Order Consumption', value: '0.00' },
                            { label: 'Materials Consumed', value: 0 }
                        ]
                    },
                    {
                        title: 'Top Materials by Usage',
                        type: 'table',
                        headers: ['Material Name', 'Category', 'Avg Daily Usage', 'Current Stock', 'Days Until Stockout', 'Projected Usage', 'Status'],
                        data: []
                    }
                ]
            };
        }
        
        // Calculate summary from filtered items
        const totalConsumption = usageData.reduce((sum, item) => sum + (item.avg_daily_consumption || 0), 0);
        const alkansyaConsumption = usageData
            .filter(item => item.is_alkansya_material)
            .reduce((sum, item) => sum + (item.avg_daily_consumption || 0), 0);
        const madeToOrderConsumption = usageData
            .filter(item => item.is_made_to_order_material)
            .reduce((sum, item) => sum + (item.avg_daily_consumption || 0), 0);
        
        // Count materials with consumption data
        const materialsWithConsumption = usageData.filter(item => (item.avg_daily_consumption || 0) > 0).length;
        
        // Sort all materials: those with consumption first (sorted by consumption), then others
        const sortedMaterials = [...usageData].sort((a, b) => {
            const aConsumption = a.avg_daily_consumption || 0;
            const bConsumption = b.avg_daily_consumption || 0;
            
            // If both have consumption, sort by consumption descending
            if (aConsumption > 0 && bConsumption > 0) {
                return bConsumption - aConsumption;
            }
            // If only one has consumption, prioritize it
            if (aConsumption > 0) return -1;
            if (bConsumption > 0) return 1;
            // If neither has consumption, sort by name
            const aName = (a.name || a.material_name || '').toLowerCase();
            const bName = (b.name || b.material_name || '').toLowerCase();
            return aName.localeCompare(bName);
        });
        
        return {
            sections: [
                {
                    title: 'Report Information',
                    data: [
                        { label: 'Date Range', value: dateRangeStr },
                        { label: 'Category Filter', value: reportCategoryFilter === 'all' ? 'All' : reportCategoryFilter },
                        { label: 'Total Materials', value: usageData.length }
                    ]
                },
                {
                    title: 'Usage Summary',
                    data: [
                        { label: 'Total Consumption', value: totalConsumption.toFixed(2) },
                        { label: 'Alkansya Consumption', value: alkansyaConsumption.toFixed(2) },
                        { label: 'Made-to-Order Consumption', value: madeToOrderConsumption.toFixed(2) },
                        { label: 'Materials with Consumption Data', value: materialsWithConsumption }
                    ]
                },
                {
                    title: 'Top Materials by Usage',
                    type: 'table',
                    headers: ['Material Name', 'Category', 'Avg Daily Usage', 'Current Stock', 'Days Until Stockout', 'Projected Usage', 'Status'],
                    data: sortedMaterials.map(material => {
                        const avgDailyUsage = material.avg_daily_consumption || 0;
                        const currentStock = material.current_stock || material.available_quantity || 0;
                        const daysUntilStockout = material.days_until_stockout;
                        const projectedUsage = avgDailyUsage > 0 ? `${(avgDailyUsage * 30).toFixed(2)} (30-day projection)` : 'N/A';
                        const status = material.stock_status || calculateStockStatus(material);
                        
                        return [
                            material.name || material.material_name || 'N/A',
                            material.is_alkansya_material ? 'Alkansya' : material.is_made_to_order_material ? 'Made to Order' : 'Other',
                            avgDailyUsage.toFixed(2),
                            currentStock,
                            daysUntilStockout !== null && daysUntilStockout !== undefined ? daysUntilStockout : 'N/A',
                            projectedUsage,
                            status
                        ];
                    })
                }
            ]
        };
    };

    // Generate Replenishment Report Data for Preview
    const generateReplenishmentReportData = (data, dateRange = null, categoryFilter = 'all') => {
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        
        if (!data) {
            return { 
                sections: [
                    {
                        title: 'Report Information',
                        data: [
                            { label: 'Date Range', value: dateRangeStr },
                            { label: 'Category Filter', value: categoryFilter === 'all' ? 'All' : categoryFilter }
                        ]
                    },
                    {
                        title: 'Replenishment Summary',
                        data: [
                            { label: 'Total Items', value: 0 },
                            { label: 'Critical Items', value: 0 },
                            { label: 'High Priority Items', value: 0 },
                            { label: 'Total Estimated Cost', value: '₱0' }
                        ]
                    },
                    {
                        title: 'Replenishment Schedule',
                        type: 'table',
                        headers: ['Material Name', 'Category', 'Current Stock', 'Reorder Point', 'Recommended Qty', 'Priority', 'Status', 'Estimated Cost'],
                        data: []
                    }
                ]
            };
        }
        
        // Extract schedules from alkansya and made-to-order replenishment
        let alkansyaSchedule = data?.alkansya_replenishment?.schedule || [];
        let madeToOrderSchedule = data?.made_to_order_replenishment?.schedule || [];
        
        // Apply category filter
        if (categoryFilter === 'alkansya') {
            madeToOrderSchedule = [];
        } else if (categoryFilter === 'made_to_order') {
            alkansyaSchedule = [];
        }
        
        const allItems = [...alkansyaSchedule, ...madeToOrderSchedule];
        
        if (allItems.length === 0) {
            return {
                sections: [
                    {
                        title: 'Report Information',
                        data: [
                            { label: 'Date Range', value: dateRangeStr },
                            { label: 'Category Filter', value: categoryFilter === 'all' ? 'All' : categoryFilter }
                        ]
                    },
                    {
                        title: 'Replenishment Summary',
                        data: [
                            { label: 'Total Items', value: 0 },
                            { label: 'Critical Items', value: 0 },
                            { label: 'High Priority Items', value: 0 },
                            { label: 'Total Estimated Cost', value: '₱0' }
                        ]
                    },
                    {
                        title: 'Replenishment Schedule',
                        type: 'table',
                        headers: ['Material Name', 'Category', 'Current Stock', 'Reorder Point', 'Recommended Qty', 'Priority', 'Status', 'Estimated Cost'],
                        data: []
                    }
                ]
            };
        }
        
        // Calculate summary
        const totalItems = allItems.length;
        const criticalItems = allItems.filter(item => item.priority === 'Critical' || item.priority === 'High').length;
        const highPriorityItems = allItems.filter(item => item.priority === 'High').length;
        const totalEstimatedCost = allItems.reduce((sum, item) => {
            const qty = item.recommended_quantity || item.suggested_order_qty || 0;
            const cost = item.unit_cost || 0;
            return sum + (qty * cost);
        }, 0);
        
        return {
            sections: [
                {
                    title: 'Report Information',
                    data: [
                        { label: 'Date Range', value: dateRangeStr },
                        { label: 'Category Filter', value: categoryFilter === 'all' ? 'All' : categoryFilter }
                    ]
                },
                {
                    title: 'Replenishment Summary',
                    data: [
                        { label: 'Total Items', value: totalItems },
                        { label: 'Critical Items', value: criticalItems },
                        { label: 'High Priority Items', value: highPriorityItems },
                        { label: 'Total Estimated Cost', value: `₱${totalEstimatedCost.toFixed(2)}` }
                    ]
                },
                {
                    title: 'Replenishment Schedule',
                    type: 'table',
                    headers: ['Material Name', 'Category', 'Current Stock', 'Reorder Point', 'Recommended Qty', 'Priority', 'Status', 'Estimated Cost'],
                    data: allItems.map(item => {
                        const status = calculateStockStatus({
                            current_stock: item.current_stock,
                            critical_stock: item.critical_stock,
                            reorder_point: item.reorder_point,
                            max_level: item.max_level
                        });
                        return [
                            item.material_name || 'N/A',
                            alkansyaSchedule.includes(item) ? 'Alkansya' : 'Made to Order',
                            (item.current_stock || 0).toFixed(2),
                            (item.reorder_point || 0).toFixed(2),
                            (item.recommended_quantity || item.suggested_order_qty || 0).toFixed(2),
                            item.priority || 'Normal',
                            status,
                            `₱${((item.recommended_quantity || item.suggested_order_qty || 0) * (item.unit_cost || 0)).toFixed(2)}`
                        ];
                    })
                }
            ]
        };
    };

    // Generate Full Report Data for Preview
    const generateFullReportData = (inventoryData, replenishmentData, dateRange = null) => {
        const dateRangeStr = dateRange ? `${dateRange.start_date} to ${dateRange.end_date}` : 'All Time';
        
        return {
            sections: [
                {
                    title: 'Report Information',
                    data: [
                        { label: 'Date Range', value: dateRangeStr },
                        { label: 'Category Filter', value: reportCategoryFilter === 'all' ? 'All' : reportCategoryFilter },
                        { label: 'Status Filter', value: reportStatusFilter === 'all' ? 'All' : reportStatusFilter }
                    ]
                },
                {
                    title: 'Inventory Overview',
                    data: [
                        { label: 'Total Materials', value: inventoryData?.summary?.total_items || inventoryData?.items?.length || 0 },
                        { label: 'Materials Needing Reorder', value: inventoryData?.summary?.items_needing_reorder || 0 },
                        { label: 'Critical Items', value: inventoryData?.summary?.critical_items || 0 },
                        { label: 'Low Stock Items', value: inventoryData?.summary?.low_stock_items || 0 }
                    ]
                },
                {
                    title: 'Material Details',
                    type: 'table',
                    headers: ['Material Name', 'SKU', 'Category', 'Available Qty', 'Safety Stock', 'Reorder Point', 'Max Level', 'Days Left', 'Status', 'Unit Cost'],
                    data: inventoryData?.items?.map(item => {
                        const status = calculateStockStatus(item);
                        return [
                            item.name,
                            item.material_code,
                            item.is_alkansya_material ? 'Alkansya' : item.is_made_to_order_material ? 'Made to Order' : 'Other',
                            item.current_stock || item.available_quantity || 0,
                            item.safety_stock || item.critical_stock || 0,
                            item.reorder_point || item.reorder_level || 0,
                            item.max_level || 0,
                            item.days_until_stockout || 'N/A',
                            status,
                            `₱${item.unit_cost || 0}`
                        ];
                    }) || []
                },
                {
                    title: 'Replenishment Recommendations',
                    type: 'table',
                    headers: ['Material Name', 'SKU', 'Priority', 'Reorder Qty', 'Estimated Cost', 'Days Until Stockout'],
                    data: replenishmentData?.items?.map(item => [
                        item.name,
                        item.sku,
                        item.priority,
                        item.reorder_quantity,
                        `₱${item.estimated_cost}`,
                        item.days_until_stockout
                    ]) || []
                }
            ]
        };
    };

    // Filter function with accurate BOM-based filtering
    const applyFilter = (data, filter) => {
        if (!data || !data.items) {
            setFilteredInventoryData(null);
            return;
        }

        let filteredItems = data.items;
        
        if (filter !== 'all') {
            filteredItems = data.items.filter(item => {
                const name = item.name.toLowerCase();
                switch (filter) {
                    case 'alkansya':
                        // Alkansya has 13 materials based on BOM
                        return name.includes('pinewood 1x4x8ft') || 
                               name.includes('plywood 4.2mm 4x8ft') || 
                               name.includes('acrylic 1.5mm 4x8ft') || 
                               name.includes('pin nail f30') || 
                               name.includes('black screw 1 1/2') || 
                               name.includes('stikwell 250 grams') || 
                               name.includes('grinder pad 4inch 120 grit') || 
                               name.includes('sticker 24 inch car decals') || 
                               name.includes('transfer tape') || 
                               name.includes('tape 2 inch 200m') || 
                               name.includes('fragile tape') || 
                               name.includes('bubble wrap 40 inch x 100m') || 
                               name.includes('insulation 8mm 40 inch x 100m');
                    case 'dining-table':
                        // Dining Table has 9 materials based on BOM
                        return name.includes('mahogany hardwood 2x4x8ft') || 
                               name.includes('mahogany hardwood 1x6x10ft') || 
                               name.includes('plywood 18mm 4x8ft') || 
                               name.includes('metal table brackets') || 
                               name.includes('wood screws 3 inch') || 
                               name.includes('wood glue 500ml') || 
                               name.includes('wood stain walnut 1 liter') || 
                               name.includes('polyurethane gloss 1 liter') || 
                               name.includes('felt pads large');
                    case 'wooden-chair':
                        // Wooden Chair has 12 materials based on BOM
                        return name.includes('mahogany hardwood 2x2x6ft') || 
                               name.includes('mahogany hardwood 1x4x6ft') || 
                               name.includes('plywood 12mm 2x4ft') || 
                               name.includes('wood screws 2.5 inch') || 
                               name.includes('wood dowels 8mm') || 
                               name.includes('wood glue 250ml') || 
                               name.includes('foam cushion 2 inch') || 
                               name.includes('upholstery fabric') || 
                               name.includes('upholstery staples') || 
                               name.includes('wood stain walnut 500ml') || 
                               name.includes('lacquer spray clear') || 
                               name.includes('felt pads small');
                    default:
                        return true;
                }
            });
        }

        setFilteredInventoryData({
            ...data,
            items: filteredItems
        });
    };

    // Handle filter changes and re-apply to current data
    const handleFilterChange = (newFilter) => {
        setMaterialFilter(newFilter);
        if (inventoryReport) {
            applyFilter(inventoryReport, newFilter);
        } else {
            // Ensure data is loaded for stock tab if not yet available
            loadTabData('stock');
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
                    // Overview data is already loaded initially
                    break;
                    
                case 'stock':
                    // Sync stock levels first, then fetch from the new endpoint
                    try {
                        // Sync stock levels to ensure data is up-to-date
                        await api.post('/inventory/stock-levels/sync').catch(err => {
                            console.warn('Stock levels sync failed (may already be synced):', err);
                        });
                        
                        // Fetch stock levels from the new endpoint
                        const filterParam = stockFilter === 'all' ? 'all' : 
                                          stockFilter === 'alkansya' ? 'alkansya' : 
                                          stockFilter === 'made_to_order' ? 'made_to_order' : 
                                          stockFilter === 'overstocked' ? 'overstocked' : 'all';
                        
                        const stockLevelsRes = await api.get(`/inventory/stock-levels`, {
                            params: { filter: filterParam }
                        });
                        
                        const stockData = stockLevelsRes.data;
                        
                        // Map the response to match expected format
                        const processedItems = (stockData.items || []).map(item => ({
                            material_id: item.material_id,
                            name: item.name,
                            material_code: item.sku,
                            sku: item.sku,
                            category: item.category || 'raw',
                            current_stock: item.available_quantity || 0,
                            available_quantity: item.available_quantity || 0,
                            quantity_on_hand: item.quantity_on_hand || 0,
                            quantity_reserved: item.quantity_reserved || 0,
                            unit: item.unit || 'pcs',
                            unit_cost: item.unit_cost || 0,
                            value: item.value || 0,
                            reorder_point: item.reorder_point || 0,
                            reorder_level: item.reorder_level || item.reorder_point || 0,
                            safety_stock: item.safety_stock || 0,
                            max_level: item.max_level || 0,
                            critical_stock: item.critical_stock || 0,
                            lead_time_days: item.lead_time_days || 0,
                            supplier: item.supplier || 'N/A',
                            location: item.location || 'Windfield 2',
                            stock_status: item.stock_status || 'in_stock',
                            status: item.stock_status || 'in_stock',
                            status_label: item.status_label || item.stock_status || 'In Stock',
                            is_alkansya_material: item.is_alkansya_material || false,
                            is_made_to_order_material: item.is_made_to_order_material || false,
                            avg_daily_consumption: Number(item.daily_usage || item.avg_daily_consumption || 0),
                            daily_usage: Number(item.daily_usage || item.avg_daily_consumption || 0),
                            days_until_stockout: item.days_until_stockout !== null && item.days_until_stockout !== undefined ? Number(item.days_until_stockout) : 999,
                            needs_reorder: item.needs_reorder || false
                        }));
                        
                        // Calculate summary with proper status mapping
                        const summary = {
                            total_items: stockData.summary?.total_items || processedItems.length,
                            items_needing_reorder: processedItems.filter(i => i.needs_reorder).length,
                            critical_items: processedItems.filter(i => 
                                i.stock_status === 'critical' || 
                                i.stock_status === 'out_of_stock' ||
                                i.status_label === 'Critical' ||
                                i.status_label === 'Out of Stock'
                            ).length,
                            critical_stock_items: processedItems.filter(i => {
                                const qty = i.available_quantity || 0;
                                const critical = i.critical_stock || 0;
                                return critical > 0 && qty <= critical && qty > 0;
                            }).length,
                            total_usage: processedItems.reduce((sum, item) => sum + (item.avg_daily_consumption || 0), 0),
                            total_value: stockData.summary?.total_value || processedItems.reduce((sum, item) => sum + (item.value || 0), 0),
                            alkansya_materials: processedItems.filter(i => i.is_alkansya_material).length,
                            made_to_order_materials: processedItems.filter(i => i.is_made_to_order_material).length,
                            overstocked_items: stockData.summary?.overstocked || processedItems.filter(i => 
                                i.stock_status === 'overstocked' || 
                                i.status_label === 'Overstocked' ||
                                (i.max_level > 0 && i.available_quantity > i.max_level)
                            ).length,
                            low_stock_items: stockData.summary?.low_stock_items || processedItems.filter(i => {
                                    const qty = i.available_quantity || 0;
                                    const critical = i.critical_stock || 0;
                                    const reorderPoint = i.reorder_level || i.reorder_point || 0;
                                    const stockStatus = i.stock_status || '';
                                    const needsReorder = i.needs_reorder || false;
                                    
                                return needsReorder || 
                                           stockStatus === 'critical' || 
                                           stockStatus === 'need_reorder' || 
                                       stockStatus === 'low_stock' ||
                                           (critical > 0 && qty <= critical && qty > 0) || 
                                           (reorderPoint > 0 && qty <= reorderPoint);
                            }).length,
                            out_of_stock_items: processedItems.filter(i => 
                                i.stock_status === 'out_of_stock' || 
                                i.status_label === 'Out of Stock'
                            ).length
                        };
                        
                        const data = {
                            items: processedItems,
                            summary: summary
                    };
                    
                    setInventoryReport(data);
                    applyFilter(data, materialFilter);
                    setFilteredInventoryData(data);
                    } catch (error) {
                        console.error('Error loading stock levels:', error);
                        toast.error('Failed to load stock levels. Please try again.');
                        // Set empty data on error
                        const emptyData = {
                            items: [],
                            summary: {
                                total_items: 0,
                                items_needing_reorder: 0,
                                critical_items: 0,
                                critical_stock_items: 0,
                                total_usage: 0,
                                total_value: 0,
                                alkansya_materials: 0,
                                made_to_order_materials: 0,
                                overstocked_items: 0,
                                low_stock_items: 0,
                                out_of_stock_items: 0
                            }
                        };
                        setInventoryReport(emptyData);
                        setFilteredInventoryData(emptyData);
                    }
                    break;
                    
                case 'forecast':
                    // Use enhanced forecasting
                    await fetchForecastData();
                    break;
                    
                case 'replenishment':
                    // Use enhanced replenishment
                    await fetchEnhancedReplenishmentData();
                    break;
                    
                case 'transactions':
                    // Use enhanced transactions
                    await fetchEnhancedTransactionsData();
                    break;
                    
                case 'alerts':
                    // Generate alerts from inventory data
                    const inventoryData = filteredInventoryData || inventoryReport;
                    
                    if (inventoryData && inventoryData.items) {
                        const alerts = [];
                        
                        inventoryData.items.forEach(item => {
                            if (item.stock_status === 'out_of_stock') {
                                alerts.push({
                                    id: item.material_id,
                                    material: item.name,
                                    message: `Material is out of stock and needs immediate reorder`,
                                    severity: 'critical',
                                    current_stock: item.current_stock,
                                    reorder_point: item.reorder_point,
                                    safety_stock: item.safety_stock,
                                    timestamp: new Date().toISOString(),
                                    category: item.is_alkansya_material ? 'alkansya' : item.is_made_to_order_material ? 'made_to_order' : 'other'
                                });
                            } else if (item.needs_reorder) {
                                alerts.push({
                                    id: item.material_id,
                                    material: item.name,
                                    message: `Material stock is below reorder point (${item.current_stock} left, reorder point: ${item.reorder_point})`,
                                    severity: 'high',
                                    current_stock: item.current_stock,
                                    reorder_point: item.reorder_point,
                                    safety_stock: item.safety_stock,
                                    timestamp: new Date().toISOString(),
                                    category: item.is_alkansya_material ? 'alkansya' : item.is_made_to_order_material ? 'made_to_order' : 'other'
                                });
                            } else if (item.stock_status === 'critical') {
                                alerts.push({
                                    id: item.material_id,
                                    material: item.name,
                                    message: `Material stock is critically low (${item.current_stock} left, safety stock: ${item.safety_stock})`,
                                    severity: 'medium',
                                    current_stock: item.current_stock,
                                    reorder_point: item.reorder_point,
                                    safety_stock: item.safety_stock,
                                    timestamp: new Date().toISOString(),
                                    category: item.is_alkansya_material ? 'alkansya' : item.is_made_to_order_material ? 'made_to_order' : 'other'
                                });
                            }
                        });
                        
                        setRealTimeAlerts({ alerts, summary: inventoryData.summary });
                    } else {
                        // Fallback to API endpoint
                    if (!realTimeAlerts) {
                            try {
                        const response = await api.get('/inventory/alerts');
                        setRealTimeAlerts(response.data);
                            } catch (error) {
                                console.error('Error fetching alerts from API:', error);
                                setRealTimeAlerts({ alerts: [], summary: { total_alerts: 0 } });
                            }
                        }
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

    // Enhanced forecasting data fetch function
    const fetchForecastData = async () => {
        setTabLoadingStates(prev => ({ ...prev, forecast: true }));
        
        try {
            const params = {
                forecast_days: windowDays,
                historical_days: windowDays
            };

            // Fetch all three types of forecasts in parallel
            const [alkansyaResponse, madeToOrderResponse, overallResponse] = await Promise.all([
                api.get('/inventory/forecast/alkansya-materials', { params }).catch(() => ({ data: null })),
                api.get('/inventory/forecast/made-to-order-materials', { params }).catch(() => ({ data: null })),
                api.get('/inventory/forecast/overall-materials', { params }).catch(() => ({ data: null }))
            ]);

            setAlkansyaForecast(alkansyaResponse.data);
            setMadeToOrderForecast(madeToOrderResponse.data);
            setOverallForecast(overallResponse.data);

        } catch (error) {
            console.error('Error fetching forecast data:', error);
            toast.error('Failed to load forecast data');
        } finally {
            setTabLoadingStates(prev => ({ ...prev, forecast: false }));
        }
    };

    // Enhanced replenishment data fetch function
    const fetchEnhancedReplenishmentData = async () => {
        setTabLoadingStates(prev => ({ ...prev, replenishment: true }));
        
        try {
            const params = {
                forecast_days: windowDays,
                historical_days: windowDays
            };

            const response = await api.get('/inventory/enhanced-replenishment', { params });
            setEnhancedReplenishment(response.data);

        } catch (error) {
            console.error('Error fetching enhanced replenishment data:', error);
            const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to load replenishment data';
            toast.error(`Failed to load replenishment data: ${errorMessage}`);
            // Set empty data structure to prevent UI errors
            setEnhancedReplenishment({
                replenishment_items: [],
                schedule: {
                    immediate: [],
                    this_week: [],
                    next_week: [],
                    future: []
                },
                summary: {
                    total_materials: 0,
                    critical_materials: 0,
                    high_priority_materials: 0,
                    medium_priority_materials: 0,
                    materials_needing_reorder: 0,
                    total_reorder_value: 0,
                    alkansya_materials: 0,
                    made_to_order_materials: 0,
                    avg_lead_time: 0
                },
                alkansya_replenishment: {
                    materials_needing_reorder: 0,
                    critical_materials: 0,
                    total_reorder_value: 0,
                    avg_lead_time: 0,
                    schedule: []
                },
                made_to_order_replenishment: {
                    materials_needing_reorder: 0,
                    critical_materials: 0,
                    total_reorder_value: 0,
                    avg_lead_time: 0,
                    schedule: []
                },
                error: errorMessage
            });
        } finally {
            setTabLoadingStates(prev => ({ ...prev, replenishment: false }));
        }
    };

    // Enhanced transactions data fetch function
    const fetchEnhancedTransactionsData = async () => {
        setTabLoadingStates(prev => ({ ...prev, transactions: true }));
        
        try {
            const params = {
                start_date: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0],
                transaction_type: transactionFilter,
                limit: 200
            };

            const response = await api.get('/inventory/enhanced-transactions', { params });
            setEnhancedTransactions(response.data);

        } catch (error) {
            console.error('Error fetching enhanced transactions data:', error);
            toast.error('Failed to load transactions data');
        } finally {
            setTabLoadingStates(prev => ({ ...prev, transactions: false }));
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <h5>Loading Inventory Reports...</h5>
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
        <div className="enhanced-inventory-reports">
            {/* Enhanced Navigation Tabs */}
            <div className="mb-4">
                <ul className="nav nav-pills nav-fill" role="tablist">
                    {[
                        { id: 'overview', name: 'Overview', icon: FaChartLine, color: colors.primary },
                        { id: 'stock', name: 'Stock Levels', icon: FaBox, color: colors.secondary },
                        { id: 'forecast', name: 'Forecasting', icon: FaChartLine, color: colors.info },
                        { id: 'replenishment', name: 'Replenishment', icon: FaTruck, color: colors.warning },
                        { id: 'transactions', name: 'Transactions', icon: FaHistory, color: colors.dark },
                        { id: 'alerts', name: 'Alerts', icon: FaExclamationTriangle, color: colors.danger }
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
                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.primary}15, ${colors.secondary}15)` }}>
                            <div className="card-body text-center p-4">
                                <div className="d-flex align-items-center justify-content-center mb-3">
                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.primary}20` }}>
                                        <FaBox style={{ color: colors.primary }} className="fs-4" />
                                    </div>
                                    <div>
                                        <h3 className="mb-0 fw-bold" style={{ color: colors.primary }}>
                                            {dashboardData?.summary?.total_items || 0}
                                        </h3>
                                        <small className="text-muted fw-medium">Total Items</small>
                                    </div>
                                </div>
                                <p className="text-muted small mb-0">
                                    {inventoryReport?.summary?.total_items || 0} items tracked
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-3 col-md-6 mb-4">
                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.danger}15, ${colors.warning}15)` }}>
                            <div className="card-body text-center p-4">
                                <div className="d-flex align-items-center justify-content-center mb-3">
                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.danger}20` }}>
                                        <FaExclamationTriangle style={{ color: colors.danger }} className="fs-4" />
                                    </div>
                                    <div>
                                        <h3 className="mb-0 fw-bold" style={{ color: colors.danger }}>
                                            {dashboardData?.summary?.low_stock_items || 0}
                                        </h3>
                                        <small className="text-muted fw-medium">Low Stock</small>
                                    </div>
                                </div>
                                <p className="text-muted small mb-0">
                                    {dashboardData?.summary?.critical_items || 0} critical items
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-3 col-md-6 mb-4">
                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.success}15, ${colors.info}15)` }}>
                            <div className="card-body text-center p-4">
                                <div className="d-flex align-items-center justify-content-center mb-3">
                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.success}20` }}>
                                        <FaCheckCircle style={{ color: colors.success }} className="fs-4" />
                                    </div>
                                    <div>
                                        <h3 className="mb-0 fw-bold" style={{ color: colors.success }}>
                                            {dashboardData?.summary?.total_items || 0}
                                        </h3>
                                        <small className="text-muted fw-medium">Total Materials</small>
                                    </div>
                                </div>
                                <p className="text-muted small mb-0">
                                    {dashboardData?.summary?.total_value ? `₱${Number(dashboardData.summary.total_value).toLocaleString()}` : '₱0'} total value
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-3 col-md-6 mb-4">
                        <div className="card border-0 shadow-sm h-100" style={{ background: `linear-gradient(135deg, ${colors.info}15, ${colors.accent}15)` }}>
                            <div className="card-body text-center p-4">
                                <div className="d-flex align-items-center justify-content-center mb-3">
                                    <div className="rounded-circle p-3 me-3" style={{ backgroundColor: `${colors.info}20` }}>
                                        <FaHistory style={{ color: colors.info }} className="fs-4" />
                                    </div>
                                    <div>
                                        <h3 className="mb-0 fw-bold" style={{ color: colors.info }}>
                                            {inventoryTransactions?.summary?.total_transactions || 0}
                                        </h3>
                                        <small className="text-muted fw-medium">Transactions</small>
                                    </div>
                                </div>
                                <p className="text-muted small mb-0">
                                    Last {windowDays} days
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Automated Reports Section - Matching Production Reports Design */}
                    <div className="col-12 mb-4">
                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', background: 'linear-gradient(135deg, rgba(245, 222, 179, 0.1), rgba(255, 255, 255, 0.9))' }}>
                            <div className="card-body p-4">
                                <div className="d-flex align-items-center mb-3">
                                    <div className="rounded-circle bg-primary bg-opacity-10 p-3 me-3" style={{ 
                                        background: 'linear-gradient(135deg, rgba(0, 123, 255, 0.1), rgba(0, 123, 255, 0.05))',
                                        width: '56px',
                                        height: '56px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <i className="fas fa-file-export text-primary" style={{ fontSize: '24px' }}></i>
                                    </div>
                                    <div>
                                        <h5 className="mb-0 fw-bold" style={{ color: '#495057', fontSize: '1.25rem' }}>Automated Reports & Analytics</h5>
                                        <small className="text-muted">Download comprehensive inventory reports</small>
                                    </div>
                                </div>
                                <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>Generate detailed reports for stock levels, material usage trends, and replenishment schedules</p>
                                        
                                {/* Unified Report Filters - Applies to both CSV and PDF */}
                                <div className="mb-4">
                                    <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #f8f9fa, #ffffff)' }}>
                                        <div className="card-header bg-white border-0 pb-2" style={{ borderRadius: '12px 12px 0 0' }}>
                                            <div className="d-flex align-items-center">
                                                <i className="fas fa-filter text-primary me-2"></i>
                                                <h6 className="mb-0 fw-bold" style={{ color: '#495057', fontSize: '0.95rem' }}>
                                                    Report Filters
                                                </h6>
                                                <small className="text-muted ms-2">(Applies to all reports)</small>
                                            </div>
                                        </div>
                                        <div className="card-body p-3">
                                            <div className="row g-3 align-items-end">
                                                <div className="col-md-2">
                                                    <label className="form-label small fw-bold text-muted mb-1">
                                                        <i className="fas fa-calendar-alt me-1"></i>Date Range
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
                                                        style={{ borderRadius: '8px', border: '2px solid #dee2e6' }}
                                                    >
                                                        <option value="days">Days</option>
                                                        <option value="weeks">Weeks</option>
                                                        <option value="months">Months</option>
                                                        <option value="year">Year</option>
                                                        <option value="custom">Custom Range</option>
                                                    </select>
                                                </div>
                                                {reportDateRange !== 'custom' && reportDateRange !== 'year' && (
                                                    <div className="col-md-2">
                                                        <label className="form-label small fw-bold text-muted mb-1">
                                                            <i className="fas fa-hashtag me-1"></i>Period
                                                        </label>
                                                        <input
                                                            type="number"
                                                            className="form-control form-control-sm"
                                                            value={reportDateValue}
                                                            onChange={(e) => setReportDateValue(parseInt(e.target.value) || 1)}
                                                            min="1"
                                                            style={{ borderRadius: '8px', border: '2px solid #dee2e6' }}
                                                        />
                                                    </div>
                                                )}
                                                {reportDateRange === 'custom' && (
                                                    <>
                                                        <div className="col-md-2">
                                                            <label className="form-label small fw-bold text-muted mb-1">
                                                                <i className="fas fa-calendar-check me-1"></i>Start Date
                                                            </label>
                                                            <input
                                                                type="date"
                                                                className="form-control form-control-sm"
                                                                value={reportStartDate}
                                                                onChange={(e) => setReportStartDate(e.target.value)}
                                                                style={{ borderRadius: '8px', border: '2px solid #dee2e6' }}
                                                            />
                                                        </div>
                                                        <div className="col-md-2">
                                                            <label className="form-label small fw-bold text-muted mb-1">
                                                                <i className="fas fa-calendar-times me-1"></i>End Date
                                                            </label>
                                                            <input
                                                                type="date"
                                                                className="form-control form-control-sm"
                                                                value={reportEndDate}
                                                                onChange={(e) => setReportEndDate(e.target.value)}
                                                                style={{ borderRadius: '8px', border: '2px solid #dee2e6' }}
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                                <div className="col-md-2">
                                                    <label className="form-label small fw-bold text-muted mb-1">
                                                        <i className="fas fa-tags me-1"></i>Category
                                                    </label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={reportCategoryFilter}
                                                        onChange={(e) => setReportCategoryFilter(e.target.value)}
                                                        style={{ borderRadius: '8px', border: '2px solid #dee2e6' }}
                                                    >
                                                        <option value="all">All Categories</option>
                                                        <option value="alkansya">Alkansya</option>
                                                        <option value="made_to_order">Made to Order</option>
                                                        <option value="raw">Raw Materials</option>
                                                        <option value="packaging">Packaging</option>
                                                    </select>
                                                </div>
                                                <div className="col-md-2">
                                                    <label className="form-label small fw-bold text-muted mb-1">
                                                        <i className="fas fa-info-circle me-1"></i>Status
                                                    </label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={reportStatusFilter}
                                                        onChange={(e) => setReportStatusFilter(e.target.value)}
                                                        style={{ borderRadius: '8px', border: '2px solid #dee2e6' }}
                                                    >
                                                        <option value="all">All Status</option>
                                                        <option value="in_stock">In Stock</option>
                                                        <option value="low_stock">Low Stock</option>
                                                        <option value="out_of_stock">Out of Stock</option>
                                                        <option value="overstocked">Overstocked</option>
                                                    </select>
                                                </div>
                                                <div className="col-md-2">
                                                    <button
                                                        className="btn btn-sm btn-primary w-100"
                                                        onClick={() => {
                                                            const dateRange = getDateRange();
                                                            console.log('Filters applied:', { dateRange, reportCategoryFilter, reportStatusFilter });
                                                            toast.success('Filters applied to all reports!');
                                                        }}
                                                        style={{ borderRadius: '8px', fontWeight: '600' }}
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
                                        {/* Stock Levels Report */}
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
                                                            <FaBox className="text-white" style={{ fontSize: '14px' }} />
                                                        </div>
                                                        <h6 className="mb-0 fw-bold" style={{ color: '#8B4513', fontSize: '0.85rem' }}>
                                                            Stock Levels Report
                                                        </h6>
                                                    </div>
                                                    <div className="btn-group w-100" role="group">
                                                        <button 
                                                            className="btn btn-outline-primary"
                                                            onClick={() => previewReport('stock')}
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
                                                            onClick={() => downloadReport('stock')}
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

                                        {/* Material Usage Trends Report */}
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
                                                            <FaChartLine className="text-white" style={{ fontSize: '14px' }} />
                                                        </div>
                                                        <h6 className="mb-0 fw-bold" style={{ color: '#17a2b8', fontSize: '0.85rem' }}>
                                                            Material Usage Trends Report
                                                        </h6>
                                                    </div>
                                                    <div className="btn-group w-100" role="group">
                                                        <button 
                                                            className="btn btn-outline-info"
                                                            onClick={() => previewReport('usage')}
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
                                                            onClick={() => downloadReport('usage')}
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

                                        {/* Replenishment Schedule Report */}
                                        <div className="col-md-4">
                                            <div className="card border-0 shadow-sm h-100" style={{ 
                                                background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.05), rgba(255, 193, 7, 0.02))',
                                                borderRadius: '12px',
                                                border: '1px solid rgba(255, 193, 7, 0.1)'
                                            }}>
                                                <div className="card-body p-3">
                                                    <div className="d-flex align-items-center mb-3">
                                                        <div className="rounded-circle p-2 me-2" style={{ 
                                                            background: 'linear-gradient(135deg, #ffc107, #e0a800)',
                                                            width: '32px',
                                                            height: '32px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            <FaTruck className="text-white" style={{ fontSize: '14px' }} />
                                                        </div>
                                                        <h6 className="mb-0 fw-bold" style={{ color: '#ffc107', fontSize: '0.85rem' }}>
                                                            Replenishment Schedule Report
                                                        </h6>
                                                    </div>
                                                    <div className="btn-group w-100" role="group">
                                                        <button 
                                                            className="btn btn-outline-warning"
                                                            onClick={() => previewReport('replenishment')}
                                                            style={{ borderRadius: '8px 0 0 8px', transition: 'all 0.3s', borderWidth: '2px', flex: 1 }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.backgroundColor = '#ffc107';
                                                                e.currentTarget.style.color = 'white';
                                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                                e.currentTarget.style.color = '#ffc107';
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                            }}
                                                        >
                                                            <i className="fas fa-eye me-2"></i>
                                                            Preview
                                                        </button>
                                                        <button 
                                                            className="btn btn-warning"
                                                            onClick={() => downloadReport('replenishment')}
                                                            style={{ borderRadius: '0 8px 8px 0', transition: 'all 0.3s', flex: 1 }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.backgroundColor = '#e0a800';
                                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.backgroundColor = '#ffc107';
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
                                        {/* Stock Levels Report PDF */}
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
                                                            <FaBox className="text-white" style={{ fontSize: '14px' }} />
                                                        </div>
                                                        <h6 className="mb-0 fw-bold" style={{ color: '#dc3545', fontSize: '0.85rem' }}>
                                                            Stock Levels Report
                                                        </h6>
                                                    </div>
                                                    <div className="btn-group w-100" role="group">
                                                        <button 
                                                            className="btn btn-outline-danger"
                                                            onClick={() => previewPdfReport('stock')}
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
                                                            onClick={() => downloadPdfReport('stock')}
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

                                        {/* Material Usage Trends Report PDF */}
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
                                                            <FaChartLine className="text-white" style={{ fontSize: '14px' }} />
                                                        </div>
                                                        <h6 className="mb-0 fw-bold" style={{ color: '#dc3545', fontSize: '0.85rem' }}>
                                                            Material Usage Trends Report
                                                        </h6>
                                                    </div>
                                                    <div className="btn-group w-100" role="group">
                                                        <button 
                                                            className="btn btn-outline-danger"
                                                            onClick={() => previewPdfReport('usage')}
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
                                                            onClick={() => downloadPdfReport('usage')}
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

                                        {/* Replenishment Schedule Report PDF */}
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
                                                            <FaTruck className="text-white" style={{ fontSize: '14px' }} />
                                                        </div>
                                                        <h6 className="mb-0 fw-bold" style={{ color: '#dc3545', fontSize: '0.85rem' }}>
                                                            Replenishment Schedule Report
                                                        </h6>
                                                    </div>
                                                    <div className="btn-group w-100" role="group">
                                                        <button 
                                                            className="btn btn-outline-danger"
                                                            onClick={() => previewPdfReport('replenishment')}
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
                                                            onClick={() => downloadPdfReport('replenishment')}
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

                    {/* Inventory Summary Details */}
                    <div className="col-12 mb-4">
                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                            <div className="card-header bg-white border-0">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaBox className="me-2" style={{ color: colors.primary }} />
                                    Inventory Report Summary
                                </h5>
                            </div>
                            <div className="card-body">
                                {/* Overview Stats Row */}
                                <div className="row mb-4">
                                    <div className="col-md-4">
                                        <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px', transition: 'all 0.3s ease' }}
                                             onMouseEnter={(e) => {
                                                 e.currentTarget.style.transform = 'translateY(-4px)';
                                                 e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                             }}
                                             onMouseLeave={(e) => {
                                                 e.currentTarget.style.transform = 'translateY(0)';
                                                 e.currentTarget.style.boxShadow = '';
                                             }}>
                                                    <div className="card-body text-center">
                                                <div className="mb-3">
                                                    <div className="rounded-circle d-flex align-items-center justify-content-center mx-auto" style={{ width: '60px', height: '60px', backgroundColor: '#e3f2fd' }}>
                                                        <i className="fas fa-box text-primary" style={{ fontSize: '28px' }}></i>
                                                    </div>
                                                </div>
                                                <h3 className="text-primary mb-1">{dashboardData?.summary?.alkansya_materials || 0}</h3>
                                                <h6 className="text-muted mb-2">Alkansya Materials</h6>
                                                <small className="text-muted">Materials for Alkansya production</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px', transition: 'all 0.3s ease' }}
                                             onMouseEnter={(e) => {
                                                 e.currentTarget.style.transform = 'translateY(-4px)';
                                                 e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                             }}
                                             onMouseLeave={(e) => {
                                                 e.currentTarget.style.transform = 'translateY(0)';
                                                 e.currentTarget.style.boxShadow = '';
                                             }}>
                                                    <div className="card-body text-center">
                                                <div className="mb-3">
                                                    <div className="rounded-circle d-flex align-items-center justify-content-center mx-auto" style={{ width: '60px', height: '60px', backgroundColor: '#e1f5fe' }}>
                                                        <i className="fas fa-tools text-info" style={{ fontSize: '28px' }}></i>
                                                    </div>
                                                </div>
                                                <h3 className="text-info mb-1">{dashboardData?.summary?.made_to_order_materials || 0}</h3>
                                                <h6 className="text-muted mb-2">Made to Order Materials</h6>
                                                <small className="text-muted">Materials for made to order products</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px', transition: 'all 0.3s ease' }}
                                             onMouseEnter={(e) => {
                                                 e.currentTarget.style.transform = 'translateY(-4px)';
                                                 e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                             }}
                                             onMouseLeave={(e) => {
                                                 e.currentTarget.style.transform = 'translateY(0)';
                                                 e.currentTarget.style.boxShadow = '';
                                             }}>
                                                    <div className="card-body text-center">
                                                <div className="mb-3">
                                                    <div className="rounded-circle d-flex align-items-center justify-content-center mx-auto" style={{ width: '60px', height: '60px', backgroundColor: '#fff3e0' }}>
                                                        <i className="fas fa-peso-sign text-warning" style={{ fontSize: '28px' }}></i>
                                            </div>
                                        </div>
                                                <h3 className="text-warning mb-1">₱{dashboardData?.summary?.total_value?.toLocaleString() || '0'}</h3>
                                                <h6 className="text-muted mb-2">Total Inventory Value</h6>
                                                <small className="text-muted">Total value of all materials</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                {/* Status Breakdown */}
                                <div className="row">
                                    <div className="col-md-6 mb-4">
                                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                            <div className="card-header bg-white border-0 pb-2">
                                                <h5 className="mb-0 d-flex align-items-center">
                                                    <i className="fas fa-box text-primary me-2" style={{ fontSize: '20px' }}></i>
                                                    Alkansya Materials Status
                                                </h5>
                                                    </div>
                                            <div className="card-body">
                                                <div className="row text-center">
                                                    <div className="col-6 mb-3">
                                                        <div className="p-3 rounded" style={{ backgroundColor: '#ffebee' }}>
                                                            <div className="mb-2">
                                                                <i className="fas fa-times-circle text-danger" style={{ fontSize: '32px' }}></i>
                                                </div>
                                                            <h3 className="text-danger mb-1">{dashboardData?.summary?.alkansya_out_of_stock || 0}</h3>
                                                            <small className="text-muted">Out of Stock</small>
                                            </div>
                                                    </div>
                                                    <div className="col-6 mb-3">
                                                        <div className="p-3 rounded" style={{ backgroundColor: '#fff3e0' }}>
                                                            <div className="mb-2">
                                                                <i className="fas fa-exclamation-circle text-warning" style={{ fontSize: '32px' }}></i>
                                                </div>
                                                            <h3 className="text-warning mb-1">{dashboardData?.summary?.alkansya_needs_reorder || 0}</h3>
                                                            <small className="text-muted">Need Reorder</small>
                                            </div>
                                                    </div>
                                                    <div className="col-12">
                                                        <div className="p-3 rounded" style={{ backgroundColor: '#e8f5e9' }}>
                                                            <div className="mb-2">
                                                                <i className="fas fa-check-circle text-success" style={{ fontSize: '32px' }}></i>
                                                </div>
                                                            <h4 className="text-success mb-1">
                                                                {((dashboardData?.summary?.alkansya_materials || 0) - (dashboardData?.summary?.alkansya_out_of_stock || 0) - (dashboardData?.summary?.alkansya_needs_reorder || 0))}
                                                            </h4>
                                                            <small className="text-muted">Items in Good Condition</small>
                                            </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        </div>

                                    <div className="col-md-6 mb-4">
                                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                            <div className="card-header bg-white border-0 pb-2">
                                                <h5 className="mb-0 d-flex align-items-center">
                                                    <i className="fas fa-tools text-info me-2" style={{ fontSize: '20px' }}></i>
                                                    Made to Order Materials Status
                                                </h5>
                                                                                </div>
                                            <div className="card-body">
                                                <div className="row text-center">
                                                    <div className="col-6 mb-3">
                                                        <div className="p-3 rounded" style={{ backgroundColor: '#ffebee' }}>
                                                            <div className="mb-2">
                                                                <i className="fas fa-times-circle text-danger" style={{ fontSize: '32px' }}></i>
                                                                            </div>
                                                            <h3 className="text-danger mb-1">{dashboardData?.summary?.made_to_order_out_of_stock || 0}</h3>
                                                            <small className="text-muted">Out of Stock</small>
                                                                            </div>
                                                                        </div>
                                                    <div className="col-6 mb-3">
                                                        <div className="p-3 rounded" style={{ backgroundColor: '#fff3e0' }}>
                                                            <div className="mb-2">
                                                                <i className="fas fa-exclamation-circle text-warning" style={{ fontSize: '32px' }}></i>
                                                </div>
                                                            <h3 className="text-warning mb-1">{dashboardData?.summary?.made_to_order_needs_reorder || 0}</h3>
                                                            <small className="text-muted">Need Reorder</small>
                                            </div>
                                        </div>
                                                    <div className="col-12">
                                                        <div className="p-3 rounded" style={{ backgroundColor: '#e8f5e9' }}>
                                                            <div className="mb-2">
                                                                <i className="fas fa-check-circle text-success" style={{ fontSize: '32px' }}></i>
                                    </div>
                                                            <h4 className="text-success mb-1">
                                                                {((dashboardData?.summary?.made_to_order_materials || 0) - (dashboardData?.summary?.made_to_order_out_of_stock || 0) - (dashboardData?.summary?.made_to_order_needs_reorder || 0))}
                                                            </h4>
                                                            <small className="text-muted">Items in Good Condition</small>
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
                </div>
            )}

            {/* Stock Status Tab - MRP Enabled */}
            {activeTab === 'stock' && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                            <div className="card-header bg-white border-0" style={{ borderRadius: '12px' }}>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaBox className="me-2" style={{ color: colors.secondary }} />
                                        Stock Status 
                                    {tabLoadingStates.stock && (
                                        <div className="spinner-border spinner-border-sm ms-2" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    )}
                                </h5>
                                </div>
                                
                                {/* Filter Buttons */}
                                        <div className="d-flex gap-2 flex-wrap">
                                    <button 
                                        className={`btn ${stockFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setStockFilter('all')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-list me-2"></i>
                                        All Materials
                                    </button>
                                    <button 
                                        className={`btn ${stockFilter === 'alkansya' ? 'btn-success' : 'btn-outline-success'}`}
                                        onClick={() => setStockFilter('alkansya')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-box me-2"></i>
                                        Alkansya
                                    </button>
                                    <button 
                                        className={`btn ${stockFilter === 'made_to_order' ? 'btn-info' : 'btn-outline-info'}`}
                                        onClick={() => setStockFilter('made_to_order')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-tools me-2"></i>
                                        Made to Order
                                    </button>
                                    <button 
                                        className={`btn ${stockFilter === 'overstocked' ? 'btn-info' : 'btn-outline-info'}`}
                                        onClick={() => setStockFilter('overstocked')}
                                        style={{ borderRadius: '8px' }}
                                        title="Materials with stock exceeding maximum level"
                                    >
                                        <i className="fas fa-boxes me-2"></i>
                                        Overstocked
                                    </button>
                                </div>
                            </div>
                            <div className="card-body">
                                {/* Summary Cards */}
                                {filteredInventoryData?.summary && !tabLoadingStates.stock && (
                                    <div className="row mb-4">
                                        <div className="col-md-3 col-sm-6 mb-3">
                                            <div className="card border h-100" style={{ borderRadius: '8px' }}>
                                                <div className="card-body">
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <h6 className="mb-1 text-muted small">Total Materials</h6>
                                                            <h3 className="mb-0 text-dark">{filteredInventoryData.summary.total_items || 0}</h3>
                                                        </div>
                                                        <i className="fas fa-boxes fa-2x text-muted opacity-50"></i>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-3 col-sm-6 mb-3">
                                            <div className="card border h-100" style={{ borderRadius: '8px', borderColor: '#17a2b8' }}>
                                                <div className="card-body">
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <h6 className="mb-1 text-muted small">Overstocked</h6>
                                                            <h3 className="mb-0" style={{ color: '#17a2b8' }}>{filteredInventoryData.summary.overstocked_items || 0}</h3>
                                                        </div>
                                                        <i className="fas fa-boxes fa-2x" style={{ color: '#17a2b8', opacity: 0.5 }}></i>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-3 col-sm-6 mb-3">
                                            <div className="card border h-100" style={{ borderRadius: '8px', borderColor: '#dc3545' }}>
                                                <div className="card-body">
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <h6 className="mb-1 text-muted small">Critical Stock</h6>
                                                            <h3 className="mb-0 text-danger">{filteredInventoryData.summary.critical_stock_items || 0}</h3>
                                                        </div>
                                                        <i className="fas fa-exclamation-circle fa-2x text-danger opacity-50"></i>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-3 col-sm-6 mb-3">
                                            <div className="card border h-100" style={{ borderRadius: '8px', borderColor: '#ffc107' }}>
                                                <div className="card-body">
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <h6 className="mb-1 text-muted small">Low Stock / Need Reorder</h6>
                                                            <h3 className="mb-0 text-warning">{filteredInventoryData.summary.low_stock_items || 0}</h3>
                                                            <small className="text-muted" style={{ fontSize: '0.75rem' }}>Includes critical items</small>
                                                        </div>
                                                        <i className="fas fa-exclamation-triangle fa-2x text-warning opacity-50"></i>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {tabLoadingStates.stock ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary mb-3" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h5>Loading Stock Data...</h5>
                                        <p className="text-muted">Calculating MRP parameters and real-time stock levels</p>
                                    </div>
                                ) : filteredInventoryData?.items && filteredInventoryData.items.length > 0 ? (
                                    <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                    <div className="table-responsive">
                                            <table className="table table-hover mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th style={{ padding: '1rem', fontWeight: '600', color: '#495057' }}>Material Name</th>
                                                    <th style={{ padding: '1rem', fontWeight: '600', color: '#495057' }}>SKU</th>
                                                    <th className="text-end" style={{ padding: '1rem', fontWeight: '600', color: '#495057' }}>Available Qty</th>
                                                    <th className="text-end" style={{ padding: '1rem', fontWeight: '600', color: '#495057' }}>Safety Stock</th>
                                                    <th className="text-end" style={{ padding: '1rem', fontWeight: '600', color: '#495057' }}>Reorder Point</th>
                                                    <th className="text-end" style={{ padding: '1rem', fontWeight: '600', color: '#495057' }}>
                                                        Days Left
                                                        <i className="fas fa-question-circle ms-2 text-muted" 
                                                           style={{ fontSize: '14px' }}
                                                           title="Estimated days until stockout based on average daily consumption from Alkansya production and orders"></i>
                                                    </th>
                                                    <th className="text-end" style={{ padding: '1rem', fontWeight: '600', color: '#495057' }}>Avg Daily</th>
                                                    <th style={{ padding: '1rem', fontWeight: '600', color: '#495057' }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredInventoryData.items
                                                    .filter(item => {
                                                        if (stockFilter === 'all') return true;
                                                        if (stockFilter === 'alkansya') return item.is_alkansya_material;
                                                        if (stockFilter === 'made_to_order') return item.is_made_to_order_material;
                                                        if (stockFilter === 'overstocked') return item.stock_status === 'overstocked' || (item.max_level > 0 && item.available_quantity > item.max_level);
                                                        return true;
                                                    })
                                                    .map((item, index) => {
                                                    // Determine status label with proper priority order
                                                    // Priority: Out of Stock > Critical > Low > Overstocked > In Stock
                                                    let statusLabel = 'In Stock';
                                                    let statusColor = 'success';
                                                    const availableQty = item.available_quantity || 0;
                                                    const criticalStock = item.critical_stock || 0;
                                                    
                                                    if (availableQty <= 0) {
                                                        statusLabel = 'Out of Stock';
                                                        statusColor = 'danger';
                                                    } else if (criticalStock > 0 && availableQty <= criticalStock) {
                                                        // Critical: Stock is at or below critical level
                                                        statusLabel = 'Critical';
                                                        statusColor = 'danger';
                                                    } else if (item.reorder_point && availableQty <= item.reorder_point) {
                                                        // Need Reorder: Stock is at or below reorder point
                                                        statusLabel = 'Need Reorder';
                                                        statusColor = 'warning';
                                                    } else if (item.max_level > 0 && availableQty > item.max_level) {
                                                        // Overstocked: Current stock exceeds max level
                                                        statusLabel = 'Overstocked';
                                                        statusColor = 'info'; // Using info (blue) to distinguish from other statuses
                                                    } else if (item.stock_status === 'critical') {
                                                        // Fallback for critical status
                                                        statusLabel = 'Critical';
                                                        statusColor = 'danger';
                                                    } else if (item.stock_status === 'need_reorder') {
                                                        // Fallback for need reorder status
                                                        statusLabel = 'Need Reorder';
                                                        statusColor = 'warning';
                                                    }
                                                    
                                                    return (
                                                    <tr 
                                                        key={index}
                                                        style={{ transition: 'all 0.2s ease' }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = '';
                                                        }}
                                                    >
                                                        <td style={{ padding: '1rem' }}>
                                                            <div className="d-flex align-items-center">
                                                                <div className="me-3">
                                                                        <div className={`rounded-circle d-flex align-items-center justify-content-center`}
                                                                         style={{ 
                                                                             width: '40px', 
                                                                             height: '40px', 
                                                                             backgroundColor: item.is_alkansya_material ? '#e8f5e9' : '#e1f5fe',
                                                                             color: item.is_alkansya_material ? '#4caf50' : '#03a9f4'
                                                                         }}>
                                                                        <FaBox />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <h6 className="mb-0 fw-semibold">{item.name}</h6>
                                                                        <small className="text-muted">{item.location || 'Windfield 2'}</small>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <code className="bg-light px-2 py-1 rounded">{item.sku}</code>
                                                        </td>
                                                        <td className="text-end" style={{ padding: '1rem' }}>
                                                            <span className={`fw-bold ${
                                                                    item.available_quantity <= 0 ? 'text-danger' :
                                                                    item.critical_stock && item.available_quantity <= item.critical_stock ? 'text-danger' :
                                                                    item.available_quantity <= item.reorder_point ? 'text-warning' :
                                                                    item.available_quantity <= item.safety_stock ? 'text-warning' :
                                                                    item.max_level && item.available_quantity > item.max_level ? 'text-info' :
                                                                'text-success'
                                                            }`}>
                                                                    {item.available_quantity || 0}
                                                            </span>
                                                            <br/>
                                                            <small className="text-muted">{item.unit}</small>
                                                        </td>
                                                        <td className="text-end" style={{ padding: '1rem' }}>
                                                                <span className="text-muted fw-medium">{item.safety_stock || 0}</span>
                                                            </td>
                                                        <td className="text-end" style={{ padding: '1rem' }}>
                                                                <span className="text-warning fw-medium">{item.reorder_point || 0}</span>
                                                            </td>
                                                        <td className="text-end" style={{ padding: '1rem' }}>
                                                                <span className={`badge ${
                                                                    item.days_until_stockout <= 7 ? 'bg-danger' :
                                                                    item.days_until_stockout <= 14 ? 'bg-warning' :
                                                                    'bg-success'
                                                            }`} style={{ borderRadius: '6px' }}>
                                                                {item.days_until_stockout >= 999 ? '∞' : item.days_until_stockout} days
                                                                </span>
                                                            </td>
                                                        <td className="text-end" style={{ padding: '1rem' }}>
                                                                <span className="text-info">
                                                                    {Number(item.daily_usage || item.avg_daily_consumption || 0).toFixed(2)}
                                                                </span>
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <span className={`badge ${
                                                                statusColor === 'danger' ? 'bg-danger' :
                                                                statusColor === 'warning' ? 'bg-warning' :
                                                                statusColor === 'info' ? 'bg-info' :
                                                                'bg-success'
                                                            }`} style={{ borderRadius: '6px' }}>
                                                                {statusLabel}
                                                                </span>
                                                        </td>
                                                    </tr>
                                                )})}
                                            </tbody>
                                        </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                        <div className="card-body text-center py-5">
                                        <FaBox className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                        <h5 className="text-muted">No materials found</h5>
                                        <p className="text-muted">Materials will appear here once they are added to the normalized inventory</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Enhanced Forecasting Tab */}
            {activeTab === 'forecast' && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                            <div className="card-header bg-white border-0" style={{ borderRadius: '12px' }}>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="mb-0 d-flex align-items-center">
                                        <FaChartLine className="me-2" style={{ color: colors.info }} />
                                        Material Usage Forecasting
                                        {tabLoadingStates.forecast && (
                                            <div className="spinner-border spinner-border-sm ms-2" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        )}
                                    </h5>
                                    <div className="d-flex gap-2">
                                        <select 
                                            className="form-select form-select-sm" 
                                            value={windowDays}
                                            onChange={(e) => setWindowDays(parseInt(e.target.value))}
                                            style={{ width: '120px', borderRadius: '8px' }}
                                        >
                                            <option value={7}>7 Days</option>
                                            <option value={14}>14 Days</option>
                                            <option value={30}>30 Days</option>
                                            <option value={60}>60 Days</option>
                                            <option value={90}>90 Days</option>
                                        </select>
                                        <button 
                                            className="btn btn-outline-primary btn-sm"
                                            onClick={() => fetchForecastData()}
                                            style={{ borderRadius: '8px' }}
                                        >
                                            <FaSync className="me-1" />
                                            Refresh
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Filter Buttons */}
                                <div className="d-flex gap-2 mb-3">
                                    <button 
                                        className={`btn ${forecastFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setForecastFilter('all')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-list me-2"></i>
                                        All Materials
                                    </button>
                                    <button 
                                        className={`btn ${forecastFilter === 'alkansya' ? 'btn-success' : 'btn-outline-success'}`}
                                        onClick={() => setForecastFilter('alkansya')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-box me-2"></i>
                                        Alkansya Materials
                                    </button>
                                    <button 
                                        className={`btn ${forecastFilter === 'made_to_order' ? 'btn-info' : 'btn-outline-info'}`}
                                        onClick={() => setForecastFilter('made_to_order')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-tools me-2"></i>
                                        Made to Order Materials
                                    </button>
                                </div>
                            </div>
                            <div className="card-body">
                                {tabLoadingStates.forecast ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-info mb-3" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h5>Loading Enhanced Forecast Data...</h5>
                                        <p className="text-muted">Analyzing Alkansya output, made-to-order patterns, and overall material usage</p>
                                    </div>
                                ) : (
                                    <div>
                                        {/* Alkansya Materials Forecast */}
                                        {(forecastFilter === 'all' || forecastFilter === 'alkansya') && alkansyaForecast && (
                                            <div className="mb-5">
                                                <h6 className="mb-3 d-flex align-items-center text-success">
                                                    <i className="fas fa-box me-2"></i>
                                                    Alkansya Materials Forecast (Based on Daily Output)
                                                </h6>
                                                    <div>
                                                        <div className="row mb-4">
                                                            <div className="col-md-2">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">
                                                                            <i className="fas fa-chart-line me-1"></i>
                                                                            Avg Daily Output
                                                                        </h6>
                                                                        <h4 className="text-primary mb-0">{alkansyaForecast.avg_daily_output || 0}</h4>
                                                                        <small className="text-muted">units/day</small>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-2">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">
                                                                            <i className="fas fa-cubes me-1"></i>
                                                                            Total Output
                                                                        </h6>
                                                                        <h4 className="text-success mb-0">{alkansyaForecast.total_historical_output || 0}</h4>
                                                                        <small className="text-muted">total units</small>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-2">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">
                                                                            <i className="fas fa-calendar-check me-1"></i>
                                                                            Days with Output
                                                                        </h6>
                                                                        <h4 className="text-info mb-0">{alkansyaForecast.actual_days_with_output || 0}</h4>
                                                                        <small className="text-muted">days</small>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-2">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">
                                                                            <i className="fas fa-boxes me-1"></i>
                                                                            Materials Analyzed
                                                                        </h6>
                                                                        <h4 className="text-info mb-0">{alkansyaForecast.summary.materials_analyzed || 0}</h4>
                                                                        <small className="text-muted">materials</small>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-2">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">
                                                                            <i className="fas fa-exclamation-triangle me-1"></i>
                                                                            Need Reorder
                                                                        </h6>
                                                                        <h4 className="text-warning mb-0">{alkansyaForecast.summary.materials_needing_reorder || 0}</h4>
                                                                        <small className="text-muted">materials</small>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-2">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">
                                                                            <i className="fas fa-clock me-1"></i>
                                                                            Avg Days to Stockout
                                                                        </h6>
                                                                        <h4 className="text-danger mb-0">{Math.round(alkansyaForecast.summary.avg_days_until_stockout || 0)}</h4>
                                                                        <small className="text-muted">days</small>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Projected Total Output Display */}
                                                        <div className="row mb-4">
                                                            <div className="col-12">
                                                                <div className="card border shadow-sm" style={{ 
                                                                    borderRadius: '12px',
                                                                    backgroundColor: '#ffffff',
                                                                    borderColor: '#e0e0e0'
                                                                }}>
                                                                    <div className="card-body" style={{ padding: '25px' }}>
                                                                        <div className="row align-items-center">
                                                                            <div className="col-md-8">
                                                                                <h5 className="mb-2" style={{ 
                                                                                    color: '#333333',
                                                                                    fontWeight: '600',
                                                                                    fontSize: '1.25rem'
                                                                                }}>
                                                                                    <i className="fas fa-calculator me-2" style={{ color: '#6c757d' }}></i>
                                                                                    Projected Total Alkansya Output
                                                                                </h5>
                                                                                <p className="mb-0 text-muted" style={{ 
                                                                                    fontSize: '0.95rem'
                                                                                }}>
                                                                                    Based on average daily output of <strong style={{ fontWeight: '600', color: '#495057' }}>{alkansyaForecast.avg_daily_output || 0} units/day</strong> over the next <strong style={{ fontWeight: '600', color: '#495057' }}>{alkansyaForecast.forecast_period || windowDays} days</strong>
                                                                                </p>
                                                                            </div>
                                                                            <div className="col-md-4 text-end">
                                                                                <h2 className="mb-0" style={{ 
                                                                                    color: '#28a745',
                                                                                    fontWeight: '700',
                                                                                    fontSize: '2.5rem'
                                                                                }}>
                                                                                    {((alkansyaForecast.avg_daily_output || 0) * (alkansyaForecast.forecast_period || windowDays)).toFixed(0)}
                                                                                </h2>
                                                                                <p className="mb-0 text-muted" style={{ 
                                                                                    fontSize: '0.9rem',
                                                                                    fontWeight: '500'
                                                                                }}>projected units</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* BOM Table - Materials Required for One Alkansya */}
                                                        <div className="row mb-4">
                                                            <div className="col-12">
                                                                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-header bg-white border-0" style={{ borderRadius: '12px 12px 0 0', padding: '15px 20px' }}>
                                                                        <h6 className="mb-0 d-flex align-items-center text-success">
                                                                            <i className="fas fa-list-alt me-2"></i>
                                                                            Bill of Materials (BOM) - Materials Required for One Alkansya Unit
                                                                        </h6>
                                                                        <small className="text-muted">This table shows the quantity of each material needed to produce one Alkansya unit</small>
                                                                    </div>
                                                                    <div className="card-body" style={{ padding: '20px' }}>
                                                                        <div className="table-responsive">
                                                                            <table className="table table-hover mb-0" style={{ fontSize: '0.9rem' }}>
                                                                                <thead className="table-light">
                                                                                    <tr>
                                                                                        <th style={{ fontWeight: '600', padding: '12px' }}>Material Name</th>
                                                                                        <th style={{ fontWeight: '600', padding: '12px', textAlign: 'center' }}>Material Code</th>
                                                                                        <th style={{ fontWeight: '600', padding: '12px', textAlign: 'center' }}>Quantity per Unit</th>
                                                                                        <th style={{ fontWeight: '600', padding: '12px', textAlign: 'center' }}>Unit</th>
                                                                                        <th style={{ fontWeight: '600', padding: '12px', textAlign: 'center' }}>Projected Total Usage</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {alkansyaForecast.material_forecasts && alkansyaForecast.material_forecasts.length > 0 ? (
                                                                                        alkansyaForecast.material_forecasts.map((material, index) => {
                                                                                            const projectedTotal = (material.qty_per_unit || 0) * ((alkansyaForecast.avg_daily_output || 0) * (alkansyaForecast.forecast_period || windowDays));
                                                                                            return (
                                                                                                <tr key={index}>
                                                                                                    <td style={{ padding: '12px' }}>
                                                                                                        <div className="d-flex align-items-center">
                                                                                                            <i className="fas fa-box me-2" style={{ color: '#28a745', fontSize: '0.9rem' }}></i>
                                                                                                            <span style={{ fontWeight: '500' }}>{material.material_name}</span>
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                                                        <code className="bg-light px-2 py-1 rounded">{material.material_code}</code>
                                                                                                    </td>
                                                                                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                                                                                                        {material.qty_per_unit ? Number(material.qty_per_unit).toFixed(4) : '0.0000'}
                                                                                                    </td>
                                                                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                                                        <span className="text-muted">{material.unit || 'pcs'}</span>
                                                                                                    </td>
                                                                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                                                        <span className="text-info fw-bold">
                                                                                                            {projectedTotal.toFixed(2)} {material.unit || 'pcs'}
                                                                                                        </span>
                                                                                                        <br/>
                                                                                                        <small className="text-muted">
                                                                                                            ({((alkansyaForecast.avg_daily_output || 0) * (alkansyaForecast.forecast_period || windowDays)).toFixed(0)} units × {Number(material.qty_per_unit || 0).toFixed(4)})
                                                                                                        </small>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            );
                                                                                        })
                                                                                    ) : (
                                                                                        <tr>
                                                                                            <td colSpan="5" className="text-center text-muted py-4">
                                                                                                No material data available
                                                                                            </td>
                                                                                        </tr>
                                                                                    )}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Daily Output & Material Usage Forecast Chart */}
                                                        <div className="row mb-4">
                                                            <div className="col-12">
                                                                <div className="card shadow-sm" style={{ borderRadius: '12px', border: 'none' }}>
                                                                    <div className="card-header bg-gradient" style={{ 
                                                                        background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                                                        color: 'white',
                                                                        borderRadius: '12px 12px 0 0',
                                                                        border: 'none'
                                                                    }}>
                                                                        <h6 className="mb-0 d-flex align-items-center">
                                                                            <i className="fas fa-chart-line me-2"></i>
                                                                            Daily Output & Material Usage Forecast
                                                                        </h6>
                                                                    </div>
                                                                    <div className="card-body" style={{ padding: '20px' }}>
                                                                        {/* Display Calculated Trends and Total Quantity Units */}
                                                                        {alkansyaForecast.predictive_analytics && (
                                                                            <div className="row mb-3">
                                                                                <div className="col-md-6">
                                                                                    <div className="card bg-light border-0" style={{ borderRadius: '8px' }}>
                                                                                        <div className="card-body py-2">
                                                                                            <div className="d-flex justify-content-between align-items-center">
                                                                                                <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                                                                                                    <i className="fas fa-chart-line me-2"></i>
                                                                                                    <strong>Calculated Trend:</strong>
                                                                                                </span>
                                                                                                <span className={`fw-bold ${alkansyaForecast.predictive_analytics.calculated_trend > 0 ? 'text-success' : alkansyaForecast.predictive_analytics.calculated_trend < 0 ? 'text-danger' : 'text-secondary'}`} style={{ fontSize: '1rem' }}>
                                                                                                    {alkansyaForecast.predictive_analytics.calculated_trend > 0 ? '+' : ''}
                                                                                                    {alkansyaForecast.predictive_analytics.calculated_trend !== undefined && alkansyaForecast.predictive_analytics.calculated_trend !== null
                                                                                                        ? alkansyaForecast.predictive_analytics.calculated_trend.toFixed(4)
                                                                                                        : '0.0000'}
                                                                                                    <small className="ms-1">units/day</small>
                                                                                                </span>
                                                                                            </div>
                                                                                            <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                                                                                                {alkansyaForecast.predictive_analytics.calculated_trend > 0 
                                                                                                    ? 'Increasing production trend' 
                                                                                                    : alkansyaForecast.predictive_analytics.calculated_trend < 0 
                                                                                                    ? 'Decreasing production trend' 
                                                                                                    : 'Stable production trend (no significant change detected)'}
                                                                                            </small>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="col-md-6">
                                                                                    <div className="card bg-light border-0" style={{ borderRadius: '8px' }}>
                                                                                        <div className="card-body py-2">
                                                                                            <div className="d-flex justify-content-between align-items-center">
                                                                                                <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                                                                                                    <i className="fas fa-calculator me-2"></i>
                                                                                                    <strong>Total Quantity Units per Alkansya:</strong>
                                                                                                </span>
                                                                                                <span className={`fw-bold ${(alkansyaForecast.predictive_analytics.total_quantity_per_alkansya || 0) > 0 ? 'text-primary' : 'text-warning'}`} style={{ fontSize: '1rem' }}>
                                                                                                    {alkansyaForecast.predictive_analytics.total_quantity_per_alkansya !== undefined && alkansyaForecast.predictive_analytics.total_quantity_per_alkansya !== null
                                                                                                        ? alkansyaForecast.predictive_analytics.total_quantity_per_alkansya.toFixed(2)
                                                                                                        : '0.00'}
                                                                                                    <small className="ms-1">units</small>
                                                                                                </span>
                                                                                            </div>
                                                                                            <small className={`d-block mt-1 ${(alkansyaForecast.predictive_analytics.total_quantity_per_alkansya || 0) === 0 ? 'text-warning' : 'text-muted'}`} style={{ fontSize: '0.75rem' }}>
                                                                                                {(alkansyaForecast.predictive_analytics.total_quantity_per_alkansya || 0) === 0 
                                                                                                    ? '⚠️ No BOM data found. Please ensure BOM materials have quantity_per_product values set.'
                                                                                                    : 'Sum of all material quantities required to produce 1 Alkansya unit'}
                                                                                            </small>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        
                                                                        {/* Material Usage Calculation Info */}
                                                                        {alkansyaForecast.avg_daily_output && alkansyaForecast.predictive_analytics?.total_quantity_per_alkansya && (
                                                                            <div className="alert alert-info mb-3" style={{ borderRadius: '8px', fontSize: '0.85rem' }}>
                                                                                <div className="d-flex align-items-center">
                                                                                    <i className="fas fa-info-circle me-2"></i>
                                                                                    <div>
                                                                                        <strong>Total Material Usage Calculation:</strong>
                                                                                        <br />
                                                                                        <span className="text-muted">
                                                                                            Avg Daily Output ({alkansyaForecast.avg_daily_output?.toFixed(2)} units) × 
                                                                                            Total Quantity per Alkansya ({alkansyaForecast.predictive_analytics.total_quantity_per_alkansya?.toFixed(2)} units) = 
                                                                                            <strong className="text-primary ms-1">
                                                                                                {(alkansyaForecast.avg_daily_output * alkansyaForecast.predictive_analytics.total_quantity_per_alkansya).toFixed(2)} units/day
                                                                                            </strong>
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        
                                                                        <ResponsiveContainer width="100%" height={350}>
                                                                            <LineChart data={alkansyaForecast.daily_forecast}>
                                                                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                                                                <XAxis 
                                                                                    dataKey="date" 
                                                                                    tick={{ fill: '#666', fontSize: 11 }}
                                                                                    tickFormatter={(value) => {
                                                                                        const date = new Date(value);
                                                                                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                                                    }}
                                                                                />
                                                                                <YAxis 
                                                                                    tick={{ fill: '#666', fontSize: 11 }}
                                                                                />
                                                                                <Tooltip 
                                                                                    contentStyle={{ 
                                                                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                                                        border: '1px solid #28a745',
                                                                                        borderRadius: '8px',
                                                                                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                                                                    }}
                                                                                />
                                                                                <Legend />
                                                                                <Line 
                                                                                    type="linear" 
                                                                                    dataKey="predicted_output" 
                                                                                    stroke={colors.primary} 
                                                                                    strokeWidth={3} 
                                                                                    name="Predicted Output" 
                                                                                    dot={{ r: 5, fill: colors.primary }} 
                                                                                    activeDot={{ r: 7 }}
                                                                                    connectNulls={false}
                                                                                />
                                                                                <Line 
                                                                                    type="linear" 
                                                                                    dataKey="total_material_usage" 
                                                                                    stroke={colors.info} 
                                                                                    strokeWidth={3} 
                                                                                    name="Total Material Usage" 
                                                                                    dot={{ r: 5, fill: colors.info }} 
                                                                                    activeDot={{ r: 7 }}
                                                                                    connectNulls={false}
                                                                                />
                                                                            </LineChart>
                                                                        </ResponsiveContainer>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Material Forecast Summary - Full Width */}
                                                        <div className="row">
                                                            <div className="col-12">
                                                                <div className="card shadow-sm" style={{ borderRadius: '12px', border: 'none' }}>
                                                                    <div className="card-header bg-gradient" style={{ 
                                                                        background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                                                        color: 'white',
                                                                        borderRadius: '12px 12px 0 0',
                                                                        border: 'none',
                                                                        padding: '15px 20px'
                                                                    }}>
                                                                        <h6 className="mb-0 d-flex align-items-center">
                                                                            <i className="fas fa-clipboard-list me-2"></i>
                                                                            Material Forecast Summary
                                                                        </h6>
                                                                    </div>
                                                                    <div className="card-body" style={{ padding: '20px' }}>
                                                                        <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                                                            <table className="table table-hover mb-0" style={{ fontSize: '0.9rem' }}>
                                                                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                                                                                    <tr>
                                                                                        <th style={{ fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #dee2e6', padding: '15px' }}>Material</th>
                                                                                        <th style={{ fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #dee2e6', textAlign: 'center', padding: '15px' }}>Current Stock</th>
                                                                                        <th style={{ fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #dee2e6', textAlign: 'center', padding: '15px' }}>Daily Usage</th>
                                                                                        <th style={{ fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #dee2e6', textAlign: 'center', padding: '15px' }}>Forecasted Usage</th>
                                                                                        <th style={{ fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #dee2e6', textAlign: 'center', padding: '15px' }}>Days Left</th>
                                                                                        <th style={{ fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #dee2e6', textAlign: 'center', padding: '15px' }}>Status</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {alkansyaForecast.material_forecasts.map((material, index) => {
                                                                                        const stockPercentage = material.current_stock && material.reorder_point ? 
                                                                                            Math.min(100, (material.current_stock / (material.reorder_point * 5)) * 100) : 100;
                                                                                        const stockColor = stockPercentage > 50 ? '#28a745' : stockPercentage > 20 ? '#ffc107' : '#dc3545';
                                                                                        
                                                                                        return (
                                                                                            <tr key={index} style={{ 
                                                                                                transition: 'all 0.2s ease',
                                                                                                cursor: 'pointer'
                                                                                            }}
                                                                                            onMouseEnter={(e) => {
                                                                                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                                                                                                e.currentTarget.style.transform = 'scale(1.005)';
                                                                                            }}
                                                                                            onMouseLeave={(e) => {
                                                                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                                                                e.currentTarget.style.transform = 'scale(1)';
                                                                                            }}>
                                                                                                <td style={{ padding: '15px' }}>
                                                                                                    <div className="d-flex align-items-center">
                                                                                                        <i className="fas fa-box me-2" style={{ color: '#28a745', fontSize: '1rem' }}></i>
                                                                                                        <span style={{ fontWeight: '500', fontSize: '0.95rem' }} title={material.material_name}>
                                                                                                            {material.material_name}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                </td>
                                                                                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                                                                                    {material.current_stock !== undefined ? (
                                                                                                        <div className="d-flex flex-column align-items-center">
                                                                                                            <span style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '5px' }}>
                                                                                                                {Number(material.current_stock).toLocaleString()} {material.unit || 'pcs'}
                                                                                                            </span>
                                                                                                            {material.reorder_point && (
                                                                                                                <div style={{ 
                                                                                                                    width: '80px', 
                                                                                                                    height: '6px', 
                                                                                                                    backgroundColor: '#e9ecef', 
                                                                                                                    borderRadius: '3px',
                                                                                                                    overflow: 'hidden'
                                                                                                                }}>
                                                                                                                    <div style={{
                                                                                                                        width: `${stockPercentage}%`,
                                                                                                                        height: '100%',
                                                                                                                        backgroundColor: stockColor,
                                                                                                                        transition: 'width 0.3s ease'
                                                                                                                    }}></div>
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <span className="text-muted">-</span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                                                                                    <span style={{ fontWeight: '600', fontSize: '0.95rem', color: '#495057' }}>
                                                                                                        {(material.daily_usage || material.daily_material_usage) ? Number(material.daily_usage || material.daily_material_usage).toFixed(2) : '-'} {material.unit || 'pcs/day'}
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                                                                                    <span style={{ fontWeight: '600', fontSize: '0.95rem', color: '#495057' }}>
                                                                                                        {material.forecasted_usage ? Number(material.forecasted_usage).toFixed(2) : '-'} {material.unit || 'pcs'}
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                                                                                    <span className={`badge ${material.days_until_stockout <= 7 ? 'bg-danger' : material.days_until_stockout <= 14 ? 'bg-warning' : 'bg-success'}`}
                                                                                                        style={{ 
                                                                                                            fontSize: '0.85rem',
                                                                                                            padding: '8px 12px',
                                                                                                            borderRadius: '8px',
                                                                                                            fontWeight: '600'
                                                                                                        }}>
                                                                                                        {material.days_until_stockout} days
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                                                                                    {(() => {
                                                                                                        // Calculate status with proper priority order
                                                                                                        // Priority: Out of Stock > Critical > Low > Overstocked > In Stock
                                                                                                        const availableQty = material.current_stock || material.available_quantity || 0;
                                                                                                        const criticalStock = material.critical_stock || 0;
                                                                                                        const reorderPoint = material.reorder_point || 0;
                                                                                                        const maxLevel = material.max_level || 0;
                                                                                                        
                                                                                                        let statusLabel = material.status_label || 'In Stock';
                                                                                                        let statusColor = material.status_color || 'success';
                                                                                                        
                                                                                                        // Use backend status if available, otherwise calculate
                                                                                                        if (!material.status_label) {
                                                                                                            if (availableQty <= 0) {
                                                                                                                statusLabel = 'Out of Stock';
                                                                                                                statusColor = 'danger';
                                                                                                            } else if (criticalStock > 0 && availableQty <= criticalStock) {
                                                                                                                statusLabel = 'Critical';
                                                                                                                statusColor = 'danger';
                                                                                                            } else if (reorderPoint > 0 && availableQty <= reorderPoint) {
                                                                                                                statusLabel = 'Low Stock';
                                                                                                                statusColor = 'warning';
                                                                                                            } else if (maxLevel > 0 && availableQty > maxLevel) {
                                                                                                                statusLabel = 'Overstocked';
                                                                                                                statusColor = 'info';
                                                                                                            }
                                                                                                        }
                                                                                                        
                                                                                                        const iconClass = statusColor === 'danger' ? 'fa-exclamation-circle' : 
                                                                                                                         statusColor === 'warning' ? 'fa-exclamation-triangle' :
                                                                                                                         statusColor === 'info' ? 'fa-boxes' :
                                                                                                                         'fa-check-circle';
                                                                                                        
                                                                                                        return (
                                                                                                            <span className={`badge ${
                                                                                                                statusColor === 'danger' ? 'bg-danger' :
                                                                                                                statusColor === 'warning' ? 'bg-warning' :
                                                                                                                statusColor === 'info' ? 'bg-info' :
                                                                                                                'bg-success'
                                                                                                            }`}
                                                                                                                style={{ 
                                                                                                                    fontSize: '0.85rem',
                                                                                                                    padding: '8px 12px',
                                                                                                                    borderRadius: '8px',
                                                                                                                    fontWeight: '600'
                                                                                                                }}>
                                                                                                                <i className={`fas ${iconClass} me-1`}></i>
                                                                                                                {statusLabel}
                                                                                                            </span>
                                                                                                        );
                                                                                                    })()}
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                            </div>
                                        )}

                                        {/* Made-to-Order Forecast */}
                                        {(forecastFilter === 'all' || forecastFilter === 'made_to_order') && madeToOrderForecast && (
                                            <div className="mb-5">
                                                <h6 className="mb-3 d-flex align-items-center text-info">
                                                    <i className="fas fa-tools me-2"></i>
                                                    Made-to-Order Materials Forecast (Based on Order History)
                                                </h6>
                                                {madeToOrderForecast && (
                                                    <div>
                                                        <div className="row mb-4">
                                                            <div className="col-md-3">
                                                                <div className="card bg-light">
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted">Products Analyzed</h6>
                                                                        <h4 className="text-primary">{madeToOrderForecast.summary.products_analyzed}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-3">
                                                                <div className="card bg-light">
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted">Materials Analyzed</h6>
                                                                        <h4 className="text-info">{madeToOrderForecast.summary.materials_analyzed}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-3">
                                                                <div className="card bg-light">
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted">Need Reorder</h6>
                                                                        <h4 className="text-warning">{madeToOrderForecast.summary.materials_needing_reorder}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-3">
                                                                <div className="card bg-light">
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted">Avg Days to Stockout</h6>
                                                                        <h4 className="text-danger">{Math.round(madeToOrderForecast.summary.avg_days_until_stockout)}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Daily Output Forecast Chart - Enhanced Design */}
                                                        {madeToOrderForecast.daily_forecast && madeToOrderForecast.daily_forecast.length > 0 && (
                                                            <div className="row mb-4">
                                                                <div className="col-12">
                                                                    <div className="card shadow-sm" style={{ borderRadius: '12px', border: 'none' }}>
                                                                        <div className="card-header bg-gradient" style={{ 
                                                                            background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 100%)',
                                                                            color: 'white',
                                                                            borderRadius: '12px 12px 0 0',
                                                                            border: 'none'
                                                                        }}>
                                                                            <h6 className="mb-0 d-flex align-items-center">
                                                                                <i className="fas fa-chart-line me-2"></i>
                                                                                Predicted Daily Output Forecast
                                                                            </h6>
                                                                        </div>
                                                                        <div className="card-body" style={{ padding: '20px' }}>
                                                                            <ResponsiveContainer width="100%" height={350}>
                                                                                <LineChart 
                                                                                    data={madeToOrderForecast.daily_forecast}
                                                                                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                                                                >
                                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                                                                    <XAxis 
                                                                                        dataKey="date" 
                                                                                        tick={{ fill: '#666', fontSize: 11 }}
                                                                                        tickFormatter={(value) => {
                                                                                            const date = new Date(value);
                                                                                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                                                        }}
                                                                                    />
                                                                                    <YAxis 
                                                                                        tick={{ fill: '#666', fontSize: 11 }}
                                                                                        label={{ value: 'Output (units)', angle: -90, position: 'insideLeft', style: { fill: '#666' } }}
                                                                                    />
                                                                                    <Tooltip 
                                                                                        contentStyle={{ 
                                                                                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                                                            border: '1px solid #8B4513',
                                                                                            borderRadius: '8px',
                                                                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                                                                        }}
                                                                                        labelFormatter={(value) => {
                                                                                            return `Date: ${new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
                                                                                        }}
                                                                                        formatter={(value) => [`${Number(value).toFixed(2)} units`, '']}
                                                                                    />
                                                                                    <Legend 
                                                                                        wrapperStyle={{ paddingTop: '20px' }}
                                                                                        iconType="line"
                                                                                    />
                                                                                    <Line 
                                                                                        type="monotone" 
                                                                                        dataKey="dining_table_output" 
                                                                                        stroke="#8B4513" 
                                                                                        strokeWidth={3}
                                                                                        name="Dining Table Output"
                                                                                        dot={{ fill: '#8B4513', r: 4 }}
                                                                                        activeDot={{ r: 6, fill: '#654321' }}
                                                                                    />
                                                                                    <Line 
                                                                                        type="monotone" 
                                                                                        dataKey="wooden_chair_output" 
                                                                                        stroke="#D2691E" 
                                                                                        strokeWidth={3}
                                                                                        name="Wooden Chair Output"
                                                                                        dot={{ fill: '#D2691E', r: 4 }}
                                                                                        activeDot={{ r: 6, fill: '#CD853F' }}
                                                                                    />
                                                                                    <Line 
                                                                                        type="monotone" 
                                                                                        dataKey="total_output" 
                                                                                        stroke="#A0522D" 
                                                                                        strokeWidth={3}
                                                                                        strokeDasharray="5 5"
                                                                                        name="Total Output"
                                                                                        dot={{ fill: '#A0522D', r: 4 }}
                                                                                        activeDot={{ r: 6, fill: '#8B4513' }}
                                                                                    />
                                                                                </LineChart>
                                                                            </ResponsiveContainer>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Material Usage Forecast Chart - Enhanced Design */}
                                                        {madeToOrderForecast.daily_forecast && madeToOrderForecast.daily_forecast.length > 0 && (
                                                            <div className="row mb-4">
                                                                <div className="col-12">
                                                                    <div className="card shadow-sm" style={{ borderRadius: '12px', border: 'none' }}>
                                                                        <div className="card-header bg-gradient" style={{ 
                                                                            background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 100%)',
                                                                            color: 'white',
                                                                            borderRadius: '12px 12px 0 0',
                                                                            border: 'none'
                                                                        }}>
                                                                            <h6 className="mb-0 d-flex align-items-center">
                                                                                <i className="fas fa-chart-area me-2"></i>
                                                                                Predicted Material Usage Forecast
                                                                            </h6>
                                                                        </div>
                                                                        <div className="card-body" style={{ padding: '20px' }}>
                                                                            <ResponsiveContainer width="100%" height={350}>
                                                                                <AreaChart 
                                                                                    data={madeToOrderForecast.daily_forecast}
                                                                                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                                                                >
                                                                                    <defs>
                                                                                        <linearGradient id="materialUsageGradient" x1="0" y1="0" x2="0" y2="1">
                                                                                            <stop offset="5%" stopColor="#8B4513" stopOpacity={0.8}/>
                                                                                            <stop offset="95%" stopColor="#D2691E" stopOpacity={0.3}/>
                                                                                        </linearGradient>
                                                                                    </defs>
                                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                                                                    <XAxis 
                                                                                        dataKey="date" 
                                                                                        tick={{ fill: '#666', fontSize: 11 }}
                                                                                        tickFormatter={(value) => {
                                                                                            const date = new Date(value);
                                                                                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                                                        }}
                                                                                    />
                                                                                    <YAxis 
                                                                                        tick={{ fill: '#666', fontSize: 11 }}
                                                                                        label={{ value: 'Material Usage (units)', angle: -90, position: 'insideLeft', style: { fill: '#666' } }}
                                                                                    />
                                                                                    <Tooltip 
                                                                                        contentStyle={{ 
                                                                                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                                                            border: '1px solid #8B4513',
                                                                                            borderRadius: '8px',
                                                                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                                                                        }}
                                                                                        labelFormatter={(value) => {
                                                                                            return `Date: ${new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
                                                                                        }}
                                                                                        formatter={(value) => [`${Number(value).toFixed(2)} units`, 'Total Material Usage']}
                                                                                    />
                                                                                    <Legend 
                                                                                        wrapperStyle={{ paddingTop: '20px' }}
                                                                                        iconType="circle"
                                                                                    />
                                                                                    <Area 
                                                                                        type="monotone" 
                                                                                        dataKey="total_material_usage" 
                                                                                        stroke="#8B4513" 
                                                                                        strokeWidth={3}
                                                                                        fill="url(#materialUsageGradient)" 
                                                                                        name="Total Material Usage"
                                                                                        dot={{ fill: '#8B4513', r: 4 }}
                                                                                        activeDot={{ r: 6, fill: '#A0522D' }}
                                                                                    />
                                                                                </AreaChart>
                                                                            </ResponsiveContainer>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Product Order Statistics */}
                                                        <div className="row mb-4">
                                                            <div className="col-12">
                                                                <div className="card shadow-sm" style={{ borderRadius: '12px', border: 'none' }}>
                                                                    <div className="card-header bg-gradient" style={{ 
                                                                        background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                                                                        color: 'white',
                                                                        borderRadius: '12px 12px 0 0',
                                                                        border: 'none'
                                                                    }}>
                                                                        <h6 className="mb-0 d-flex align-items-center">
                                                                            <i className="fas fa-chart-bar me-2"></i>
                                                                            Product Order Statistics
                                                                        </h6>
                                                                    </div>
                                                                    <div className="card-body" style={{ padding: '20px' }}>
                                                                        <div className="table-responsive">
                                                                            <table className="table table-hover mb-0">
                                                                                <thead>
                                                                                    <tr>
                                                                                        <th style={{ fontWeight: '600' }}>Product</th>
                                                                                        <th style={{ fontWeight: '600', textAlign: 'center' }}>Total Orders</th>
                                                                                        <th style={{ fontWeight: '600', textAlign: 'center' }}>Avg Order Qty</th>
                                                                                        <th style={{ fontWeight: '600', textAlign: 'center' }}>Avg Orders/Day</th>
                                                                                        <th style={{ fontWeight: '600', textAlign: 'center' }}>Avg Daily Qty</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {Object.values(madeToOrderForecast.product_stats).map((product, index) => (
                                                                                        <tr key={index}>
                                                                                            <td style={{ fontWeight: '500' }}>{product.product_name}</td>
                                                                                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{product.total_orders}</td>
                                                                                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{product.avg_order_quantity}</td>
                                                                                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{product.avg_orders_per_day}</td>
                                                                                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{product.avg_daily_quantity}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Material Forecast Summary - Full Width */}
                                                        <div className="row">
                                                            <div className="col-12">
                                                                <div className="card shadow-sm" style={{ borderRadius: '12px', border: 'none' }}>
                                                                    <div className="card-header bg-gradient" style={{ 
                                                                        background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                                                                        color: 'white',
                                                                        borderRadius: '12px 12px 0 0',
                                                                        border: 'none',
                                                                        padding: '15px 20px'
                                                                    }}>
                                                                        <h6 className="mb-0 d-flex align-items-center">
                                                                            <i className="fas fa-clipboard-list me-2"></i>
                                                                            Material Forecast Summary
                                                                        </h6>
                                                                    </div>
                                                                    <div className="card-body" style={{ padding: '20px' }}>
                                                                        <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                                                            <table className="table table-hover mb-0" style={{ fontSize: '0.9rem' }}>
                                                                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                                                                                    <tr>
                                                                                        <th style={{ fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #dee2e6', padding: '15px' }}>Product</th>
                                                                                        <th style={{ fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #dee2e6', padding: '15px' }}>Material</th>
                                                                                        <th style={{ fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #dee2e6', textAlign: 'center', padding: '15px' }}>Current Stock</th>
                                                                                        <th style={{ fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #dee2e6', textAlign: 'center', padding: '15px' }}>Daily Usage</th>
                                                                                        <th style={{ fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #dee2e6', textAlign: 'center', padding: '15px' }}>Days Left</th>
                                                                                        <th style={{ fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #dee2e6', textAlign: 'center', padding: '15px' }}>Status</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {madeToOrderForecast.material_forecasts.map((material, index) => {
                                                                                        const stockPercentage = material.current_stock && material.reorder_point ? 
                                                                                            Math.min(100, (material.current_stock / (material.reorder_point * 5)) * 100) : 100;
                                                                                        const stockColor = stockPercentage > 50 ? '#28a745' : stockPercentage > 20 ? '#ffc107' : '#dc3545';
                                                                                        
                                                                                        return (
                                                                                            <tr key={index} style={{ 
                                                                                                transition: 'all 0.2s ease',
                                                                                                cursor: 'pointer'
                                                                                            }}
                                                                                            onMouseEnter={(e) => {
                                                                                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                                                                                                e.currentTarget.style.transform = 'scale(1.005)';
                                                                                            }}
                                                                                            onMouseLeave={(e) => {
                                                                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                                                                e.currentTarget.style.transform = 'scale(1)';
                                                                                            }}>
                                                                                                <td style={{ padding: '15px' }}>
                                                                                                    <div className="d-flex align-items-center">
                                                                                                        <i className="fas fa-cube me-2" style={{ color: '#17a2b8', fontSize: '1rem' }}></i>
                                                                                                        <span style={{ fontWeight: '500', fontSize: '0.95rem' }} title={material.product_name}>
                                                                                                            {material.product_name}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                </td>
                                                                                                <td style={{ padding: '15px' }}>
                                                                                                    <div className="d-flex align-items-center">
                                                                                                        <i className="fas fa-box me-2" style={{ color: '#17a2b8', fontSize: '1rem' }}></i>
                                                                                                        <span style={{ fontWeight: '500', fontSize: '0.95rem' }} title={material.material_name}>
                                                                                                            {material.material_name}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                </td>
                                                                                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                                                                                    {material.current_stock !== undefined ? (
                                                                                                        <div className="d-flex flex-column align-items-center">
                                                                                                            <span style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '5px' }}>
                                                                                                                {Number(material.current_stock).toLocaleString()} {material.unit || 'pcs'}
                                                                                                            </span>
                                                                                                            {material.reorder_point && (
                                                                                                                <div style={{ 
                                                                                                                    width: '80px', 
                                                                                                                    height: '6px', 
                                                                                                                    backgroundColor: '#e9ecef', 
                                                                                                                    borderRadius: '3px',
                                                                                                                    overflow: 'hidden'
                                                                                                                }}>
                                                                                                                    <div style={{
                                                                                                                        width: `${stockPercentage}%`,
                                                                                                                        height: '100%',
                                                                                                                        backgroundColor: stockColor,
                                                                                                                        transition: 'width 0.3s ease'
                                                                                                                    }}></div>
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <span className="text-muted">-</span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                                                                                    <span style={{ fontWeight: '600', fontSize: '0.95rem', color: '#495057' }}>
                                                                                                        {(material.daily_usage || material.daily_material_usage) ? Number(material.daily_usage || material.daily_material_usage).toFixed(2) : '-'} {material.unit || 'pcs/day'}
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                                                                                    <span className={`badge ${material.days_until_stockout <= 7 ? 'bg-danger' : material.days_until_stockout <= 14 ? 'bg-warning' : 'bg-success'}`}
                                                                                                        style={{ 
                                                                                                            fontSize: '0.85rem',
                                                                                                            padding: '8px 12px',
                                                                                                            borderRadius: '8px',
                                                                                                            fontWeight: '600'
                                                                                                        }}>
                                                                                                        {material.days_until_stockout} days
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                                                                                    {(() => {
                                                                                                        // Calculate status with proper priority order
                                                                                                        // Priority: Out of Stock > Critical > Low > Overstocked > In Stock
                                                                                                        const availableQty = material.current_stock || material.available_quantity || 0;
                                                                                                        const criticalStock = material.critical_stock || 0;
                                                                                                        const reorderPoint = material.reorder_point || 0;
                                                                                                        const maxLevel = material.max_level || 0;
                                                                                                        
                                                                                                        let statusLabel = material.status_label || 'In Stock';
                                                                                                        let statusColor = material.status_color || 'success';
                                                                                                        
                                                                                                        // Use backend status if available, otherwise calculate
                                                                                                        if (!material.status_label) {
                                                                                                            if (availableQty <= 0) {
                                                                                                                statusLabel = 'Out of Stock';
                                                                                                                statusColor = 'danger';
                                                                                                            } else if (criticalStock > 0 && availableQty <= criticalStock) {
                                                                                                                statusLabel = 'Critical';
                                                                                                                statusColor = 'danger';
                                                                                                            } else if (reorderPoint > 0 && availableQty <= reorderPoint) {
                                                                                                                statusLabel = 'Low Stock';
                                                                                                                statusColor = 'warning';
                                                                                                            } else if (maxLevel > 0 && availableQty > maxLevel) {
                                                                                                                statusLabel = 'Overstocked';
                                                                                                                statusColor = 'info';
                                                                                                            }
                                                                                                        }
                                                                                                        
                                                                                                        const iconClass = statusColor === 'danger' ? 'fa-exclamation-circle' : 
                                                                                                                         statusColor === 'warning' ? 'fa-exclamation-triangle' :
                                                                                                                         statusColor === 'info' ? 'fa-boxes' :
                                                                                                                         'fa-check-circle';
                                                                                                        
                                                                                                        return (
                                                                                                            <span className={`badge ${
                                                                                                                statusColor === 'danger' ? 'bg-danger' :
                                                                                                                statusColor === 'warning' ? 'bg-warning' :
                                                                                                                statusColor === 'info' ? 'bg-info' :
                                                                                                                'bg-success'
                                                                                                            }`}
                                                                                                                style={{ 
                                                                                                                    fontSize: '0.85rem',
                                                                                                                    padding: '8px 12px',
                                                                                                                    borderRadius: '8px',
                                                                                                                    fontWeight: '600'
                                                                                                                }}>
                                                                                                                <i className={`fas ${iconClass} me-1`}></i>
                                                                                                                {statusLabel}
                                                                                                            </span>
                                                                                                        );
                                                                                                    })()}
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Empty state when no forecast data is available */}
                                        {!alkansyaForecast && forecastFilter === 'alkansya' && (
                                                    <div className="text-center py-5">
                                                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                    <div className="card-body py-5">
                                                        <i className="fas fa-box fa-3x text-muted mb-3"></i>
                                                        <h5 className="text-muted">No Alkansya Forecast Data</h5>
                                                        <p className="text-muted">Alkansya production data is needed to generate material usage forecasts</p>
                                                    </div>
                                                </div>
                                                    </div>
                                                )}

                                        {!madeToOrderForecast && forecastFilter === 'made_to_order' && (
                                            <div className="text-center py-5">
                                                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                    <div className="card-body py-5">
                                                        <i className="fas fa-tools fa-3x text-muted mb-3"></i>
                                                        <h5 className="text-muted">No Made-to-Order Forecast Data</h5>
                                                        <p className="text-muted">Order data for made-to-order products is needed to generate material usage forecasts</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Overall Forecast Summary - Only shown when viewing all */}
                                        {forecastFilter === 'all' && overallForecast && (
                                            <div className="mt-4">
                                                <h6 className="mb-3 d-flex align-items-center text-primary">
                                                    <i className="fas fa-chart-bar me-2"></i>
                                                    Overall Forecast Summary
                                                </h6>
                                                        <div className="row mb-4">
                                                            <div className="col-md-2">
                                                        <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                <h6 className="card-title text-muted mb-2">Total Materials</h6>
                                                                <h4 className="text-primary mb-0">{overallForecast.summary.total_materials}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-2">
                                                        <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                <h6 className="card-title text-muted mb-2">Need Reorder</h6>
                                                                <h4 className="text-warning mb-0">{overallForecast.summary.materials_needing_reorder}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-2">
                                                        <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                <h6 className="card-title text-muted mb-2">Critical (≤7 days)</h6>
                                                                <h4 className="text-danger mb-0">{overallForecast.summary.critical_materials}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-2">
                                                        <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                <h6 className="card-title text-muted mb-2">High Usage</h6>
                                                                <h4 className="text-info mb-0">{overallForecast.summary.high_usage_materials}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-2">
                                                        <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                <h6 className="card-title text-muted mb-2">Total Value</h6>
                                                                <h6 className="text-success mb-0">₱{overallForecast.summary.total_inventory_value.toLocaleString()}</h6>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-2">
                                                        <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                <h6 className="card-title text-muted mb-2">Avg Days Left</h6>
                                                                <h4 className="text-secondary mb-0">{Math.round(overallForecast.summary.avg_days_until_stockout)}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                {/* Overall forecast chart and critical materials */}
                                                        <div className="row">
                                                            <div className="col-md-8">
                                                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                            <div className="card-header bg-white border-0">
                                                                <h6 className="mb-0">Daily Usage Forecast (Combined)</h6>
                                                                    </div>
                                                                    <div className="card-body">
                                                                        <ResponsiveContainer width="100%" height={300}>
                                                                            <LineChart data={overallForecast.daily_forecast}>
                                                                                <CartesianGrid strokeDasharray="3 3" />
                                                                                <XAxis dataKey="date" />
                                                                                <YAxis />
                                                                                <Tooltip />
                                                                                <Legend />
                                                                                <Line type="monotone" dataKey="predicted_total_usage" stroke={colors.primary} strokeWidth={2} name="Predicted Total Usage" />
                                                                        <Line type="monotone" dataKey="critical_materials_count" stroke={colors.danger} strokeWidth={2} name="Critical Materials" />
                                                                            </LineChart>
                                                                        </ResponsiveContainer>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-4">
                                                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                            <div className="card-header bg-white border-0">
                                                                <h6 className="mb-0">Critical Materials (≤14 days)</h6>
                                                                    </div>
                                                                    <div className="card-body">
                                                                        <div className="table-responsive" style={{ maxHeight: '300px' }}>
                                                                    <table className="table table-sm table-hover">
                                                                                <thead>
                                                                                    <tr>
                                                                                        <th>Material</th>
                                                                                        <th>Days Left</th>
                                                                                        <th>Usage</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {overallForecast.material_forecasts
                                                                                        .filter(m => m.days_until_stockout <= 14)
                                                                                        .slice(0, 5)
                                                                                        .map((material, index) => (
                                                                                        <tr key={index}>
                                                                                            <td className="text-truncate" style={{ maxWidth: '120px' }} title={material.material_name}>
                                                                                                {material.material_name}
                                                                                            </td>
                                                                                            <td>
                                                                                        <span className={`badge ${material.days_until_stockout <= 7 ? 'bg-danger' : 'bg-warning'}`} style={{ borderRadius: '8px' }}>
                                                                                                    {material.days_until_stockout}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td>
                                                                                        <span className={`badge ${material.usage_category === 'high' ? 'bg-danger' : material.usage_category === 'medium' ? 'bg-warning' : 'bg-success'}`} style={{ borderRadius: '8px' }}>
                                                                                                    {material.usage_category}
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
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Enhanced Replenishment Tab */}
            {activeTab === 'replenishment' && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                            <div className="card-header bg-white border-0" style={{ borderRadius: '12px' }}>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="mb-0 d-flex align-items-center">
                                        <FaTruck className="me-2" style={{ color: colors.warning }} />
                                        Inventory Replenishment Needs & Schedule
                                        {tabLoadingStates.replenishment && (
                                            <div className="spinner-border spinner-border-sm ms-2" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        )}
                                    </h5>
                                    <div className="d-flex gap-2">
                                        <select 
                                            className="form-select form-select-sm" 
                                            value={windowDays}
                                            onChange={(e) => setWindowDays(parseInt(e.target.value))}
                                            style={{ width: '120px', borderRadius: '8px' }}
                                        >
                                            <option value={7}>7 Days</option>
                                            <option value={14}>14 Days</option>
                                            <option value={30}>30 Days</option>
                                            <option value={60}>60 Days</option>
                                            <option value={90}>90 Days</option>
                                        </select>
                                        <button 
                                            className="btn btn-outline-warning btn-sm"
                                            onClick={() => fetchEnhancedReplenishmentData()}
                                            style={{ borderRadius: '8px' }}
                                        >
                                            <FaSync className="me-1" />
                                            Refresh
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Filter Buttons */}
                                <div className="d-flex gap-2 mb-3">
                                    <button 
                                        className={`btn ${replenishmentFilter === 'all' ? 'btn-warning' : 'btn-outline-warning'}`}
                                        onClick={() => setReplenishmentFilter('all')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-list me-2"></i>
                                        All Materials
                                    </button>
                                    <button 
                                        className={`btn ${replenishmentFilter === 'alkansya' ? 'btn-success' : 'btn-outline-success'}`}
                                        onClick={() => setReplenishmentFilter('alkansya')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-box me-2"></i>
                                        Alkansya Materials
                                    </button>
                                    <button 
                                        className={`btn ${replenishmentFilter === 'made_to_order' ? 'btn-info' : 'btn-outline-info'}`}
                                        onClick={() => setReplenishmentFilter('made_to_order')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-tools me-2"></i>
                                        Made to Order Materials
                                    </button>
                                </div>
                            </div>
                            <div className="card-body">
                                {tabLoadingStates.replenishment ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-warning mb-3" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h5>Loading Enhanced Replenishment Data...</h5>
                                        <p className="text-muted">Analyzing Alkansya output, made-to-order patterns, and material consumption</p>
                                    </div>
                                ) : enhancedReplenishment ? (
                                    enhancedReplenishment.error ? (
                                        <div className="text-center py-5">
                                            <FaTruck className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                            <h5 className="text-muted">No Consumption Data Available</h5>
                                            <p className="text-muted mb-4">{enhancedReplenishment.message}</p>
                                            <div className="card bg-light">
                                                <div className="card-body">
                                                    <h6 className="card-title">Setup Instructions:</h6>
                                                    <ol className="text-start">
                                                        {enhancedReplenishment.instructions?.map((instruction, index) => (
                                                            <li key={index} className="mb-2">
                                                                <code className="bg-dark text-light px-2 py-1 rounded">
                                                                    {instruction}
                                                                </code>
                                                            </li>
                                                        ))}
                                                    </ol>
                                                    <div className="mt-3">
                                                        <button 
                                                            className="btn btn-primary"
                                                            onClick={() => fetchEnhancedReplenishmentData()}
                                                        >
                                                            <FaSync className="me-1" />
                                                            Check Again
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                        {/* Alkansya Replenishment Section */}
                                        {(replenishmentFilter === 'all' || replenishmentFilter === 'alkansya') && enhancedReplenishment?.alkansya_replenishment && (
                                            <div className="mb-5">
                                                <h6 className="mb-3 d-flex align-items-center text-success">
                                                    <i className="fas fa-box me-2"></i>
                                                    Alkansya Materials Replenishment (Based on Daily Output)
                                                </h6>
                                                <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '12px' }}>
                                                    <div className="card-body">
                                                        <div className="row mb-3">
                                                            <div className="col-md-3">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">Materials Need Reorder</h6>
                                                                        <h4 className="text-danger mb-0">{enhancedReplenishment.alkansya_replenishment.materials_needing_reorder || 0}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-3">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">Critical Materials</h6>
                                                                        <h4 className="text-warning mb-0">{enhancedReplenishment.alkansya_replenishment.critical_materials || 0}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-3">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">Reorder Value</h6>
                                                                        <h6 className="text-success mb-0">₱{(enhancedReplenishment.alkansya_replenishment.total_reorder_value || 0).toLocaleString()}</h6>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-3">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">Avg Lead Time</h6>
                                                                        <h4 className="text-info mb-0">{Math.round(enhancedReplenishment.alkansya_replenishment.avg_lead_time || 0)} days</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {enhancedReplenishment.alkansya_replenishment.schedule && enhancedReplenishment.alkansya_replenishment.schedule.length > 0 && (
                                                            <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                                                <table className="table table-hover table-striped" style={{ fontSize: '0.9rem' }}>
                                                                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                                                                        <tr>
                                                                            <th style={{ fontWeight: '600', padding: '12px' }}>Material</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Current Stock</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Daily Usage</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Projected Usage ({windowDays} days)</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Projected Stock ({windowDays} days)</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Stock-out Date</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Days Remaining</th>
                                                                            <th className="text-center" style={{ fontWeight: '600', padding: '12px' }}>Reorder Needed?</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Recommended Qty</th>
                                                                            <th style={{ fontWeight: '600', padding: '12px' }}>Recommended Order Date</th>
                                                                            <th className="text-center" style={{ fontWeight: '600', padding: '12px' }}>Status ({windowDays} days)</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {enhancedReplenishment.replenishment_items
                                                                            .filter(item => item.is_alkansya_material)
                                                                            // Show ALL alkansya materials - no additional filtering
                                                                            .map((item, index) => {
                                                                                // Calculate projected stock based on selected windowDays for status calculation
                                                                                const currentStock = item.current_stock || 0;
                                                                                const dailyUsage = item.daily_usage || item.predicted_daily_usage || 0;
                                                                                const projectedUsage = dailyUsage * windowDays;
                                                                                const projectedStock = currentStock - projectedUsage;
                                                                                
                                                                                // Recalculate status based on projected stock for selected windowDays
                                                                                const criticalStock = item.critical_stock || 0;
                                                                                const reorderLevel = item.reorder_point || item.reorder_level || 0;
                                                                                const maxLevel = item.max_level || 0;
                                                                                const daysRemaining = item.days_remaining || item.days_until_stockout || 999;
                                                                                
                                                                                // Use projected stock after windowDays for alkansya/made-to-order materials
                                                                                const availableQty = projectedStock;
                                                                                
                                                                                let statusLabel = 'In Stock';
                                                                                let statusColor = 'success';
                                                                                
                                                                                // Check if material will run out within the selected windowDays period
                                                                                const willRunOutInWindow = daysRemaining <= windowDays && daysRemaining > 0;
                                                                                
                                                                                if (availableQty <= 0 && willRunOutInWindow) {
                                                                                    // Only show "Out of Stock" if it will actually run out within the window period
                                                                                    statusLabel = 'Out of Stock';
                                                                                    statusColor = 'danger';
                                                                                } else if (availableQty <= 0 && !willRunOutInWindow) {
                                                                                    // If projected stock is negative but won't run out in window, show as "Low Stock" instead
                                                                                    statusLabel = 'Low Stock';
                                                                                    statusColor = 'warning';
                                                                                } else if (criticalStock > 0 && availableQty <= criticalStock) {
                                                                                    statusLabel = 'Critical';
                                                                                    statusColor = 'danger';
                                                                                } else if (reorderLevel > 0 && availableQty <= reorderLevel) {
                                                                                    statusLabel = 'Low Stock';
                                                                                    statusColor = 'warning';
                                                                                } else if (maxLevel > 0 && availableQty > maxLevel) {
                                                                                    statusLabel = 'Overstocked';
                                                                                    statusColor = 'info';
                                                                                }
                                                                                
                                                                                return (
                                                                                    <tr key={index}>
                                                                                        <td style={{ padding: '12px' }}>{item.material_name}</td>
                                                                                        <td className="text-end" style={{ padding: '12px' }}>{item.current_stock?.toFixed(2) || '0.00'}</td>
                                                                                        <td className="text-end" style={{ padding: '12px' }}>{(item.daily_usage || item.predicted_daily_usage || 0).toFixed(2)}</td>
                                                                                        <td className="text-end" style={{ padding: '12px' }}>
                                                                                            {(() => {
                                                                                                // Calculate projected usage based on selected windowDays
                                                                                                const dailyUsage = item.daily_usage || item.predicted_daily_usage || 0;
                                                                                                const projectedUsage = dailyUsage * windowDays;
                                                                                                return projectedUsage.toFixed(2);
                                                                                            })()}
                                                                                        </td>
                                                                                        <td className="text-end" style={{ padding: '12px' }}>
                                                                                            {(() => {
                                                                                                // Calculate projected stock based on selected windowDays
                                                                                                const currentStock = item.current_stock || 0;
                                                                                                const dailyUsage = item.daily_usage || item.predicted_daily_usage || 0;
                                                                                                const projectedUsage = dailyUsage * windowDays;
                                                                                                const projectedStock = currentStock - projectedUsage;
                                                                                                return projectedStock.toFixed(2);
                                                                                            })()}
                                                                                        </td>
                                                                                        <td className="text-end" style={{ padding: '12px' }}>
                                                                                            {item.stock_out_date ? (
                                                                                                <span>{new Date(item.stock_out_date).toLocaleDateString()}</span>
                                                                                            ) : (
                                                                                                <span className="text-muted">N/A</span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="text-end" style={{ padding: '12px' }}>
                                                                                            {item.days_remaining !== null && item.days_remaining !== undefined ? (
                                                                                                <span className={`badge ${item.days_remaining <= 7 ? 'bg-danger' : item.days_remaining <= 14 ? 'bg-warning' : 'bg-success'}`} style={{ borderRadius: '8px' }}>
                                                                                                    {item.days_remaining}
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="text-muted">-</span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="text-center" style={{ padding: '12px' }}>
                                                                                            <span className={`badge ${(item.reorder_needed || item.needs_reorder) ? 'bg-danger' : 'bg-success'}`} style={{ borderRadius: '8px' }}>
                                                                                                {(item.reorder_needed || item.needs_reorder) ? 'Yes' : 'No'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="text-end text-success fw-bold" style={{ padding: '12px' }}>{item.recommended_quantity?.toFixed(2) || '0.00'}</td>
                                                                                        <td style={{ padding: '12px' }}>{item.recommended_order_date || item.reorder_date || '-'}</td>
                                                                                        <td className="text-center" style={{ padding: '12px' }}>
                                                                                            <span className={`badge ${
                                                                                                statusColor === 'danger' ? 'bg-danger' :
                                                                                                statusColor === 'warning' ? 'bg-warning' :
                                                                                                statusColor === 'info' ? 'bg-info' :
                                                                                                'bg-success'
                                                                                            }`} style={{ borderRadius: '8px' }}>
                                                                                                {statusLabel}
                                                                                            </span>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Made to Order Replenishment Section */}
                                        {(replenishmentFilter === 'all' || replenishmentFilter === 'made_to_order') && enhancedReplenishment?.made_to_order_replenishment && (
                                            <div className="mb-5">
                                                <h6 className="mb-3 d-flex align-items-center text-info">
                                                    <i className="fas fa-tools me-2"></i>
                                                    Made to Order Materials Replenishment (Based on Accepted Orders)
                                                </h6>
                                                <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '12px' }}>
                                                    <div className="card-body">
                                                        <div className="row mb-3">
                                                            <div className="col-md-3">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">Materials Need Reorder</h6>
                                                                        <h4 className="text-danger mb-0">{enhancedReplenishment.made_to_order_replenishment.materials_needing_reorder || 0}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-3">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">Critical Materials</h6>
                                                                        <h4 className="text-warning mb-0">{enhancedReplenishment.made_to_order_replenishment.critical_materials || 0}</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-3">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">Reorder Value</h6>
                                                                        <h6 className="text-success mb-0">₱{(enhancedReplenishment.made_to_order_replenishment.total_reorder_value || 0).toLocaleString()}</h6>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-3">
                                                                <div className="card bg-light border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                                    <div className="card-body text-center">
                                                                        <h6 className="card-title text-muted mb-2">Avg Lead Time</h6>
                                                                        <h4 className="text-info mb-0">{Math.round(enhancedReplenishment.made_to_order_replenishment.avg_lead_time || 0)} days</h4>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {enhancedReplenishment.made_to_order_replenishment.schedule && enhancedReplenishment.made_to_order_replenishment.schedule.length > 0 && (
                                                            <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                                                <table className="table table-hover table-striped" style={{ fontSize: '0.9rem' }}>
                                                                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                                                                        <tr>
                                                                            <th style={{ fontWeight: '600', padding: '12px' }}>Material</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Current Stock</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Daily Usage</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Projected Usage ({windowDays} days)</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Projected Stock ({windowDays} days)</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Stock-out Date</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Days Remaining</th>
                                                                            <th className="text-center" style={{ fontWeight: '600', padding: '12px' }}>Reorder Needed?</th>
                                                                            <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Recommended Qty</th>
                                                                            <th style={{ fontWeight: '600', padding: '12px' }}>Recommended Order Date</th>
                                                                            <th className="text-center" style={{ fontWeight: '600', padding: '12px' }}>Status ({windowDays} days)</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {enhancedReplenishment.replenishment_items
                                                                            .filter(item => item.is_made_to_order_material)
                                                                            // Show ALL made-to-order materials - no additional filtering
                                                                            .map((item, index) => {
                                                                                // Calculate projected stock based on selected windowDays for status calculation
                                                                                const currentStock = item.current_stock || 0;
                                                                                const dailyUsage = item.daily_usage || item.predicted_daily_usage || 0;
                                                                                const projectedUsage = dailyUsage * windowDays;
                                                                                const projectedStock = currentStock - projectedUsage;
                                                                                
                                                                                // Recalculate status based on projected stock for selected windowDays
                                                                                const criticalStock = item.critical_stock || 0;
                                                                                const reorderLevel = item.reorder_point || item.reorder_level || 0;
                                                                                const maxLevel = item.max_level || 0;
                                                                                const daysRemaining = item.days_remaining || item.days_until_stockout || 999;
                                                                                
                                                                                // Use projected stock after windowDays for alkansya/made-to-order materials
                                                                                const availableQty = projectedStock;
                                                                                
                                                                                let statusLabel = 'In Stock';
                                                                                let statusColor = 'success';
                                                                                
                                                                                // Check if material will run out within the selected windowDays period
                                                                                const willRunOutInWindow = daysRemaining <= windowDays && daysRemaining > 0;
                                                                                
                                                                                if (availableQty <= 0 && willRunOutInWindow) {
                                                                                    // Only show "Out of Stock" if it will actually run out within the window period
                                                                                    statusLabel = 'Out of Stock';
                                                                                    statusColor = 'danger';
                                                                                } else if (availableQty <= 0 && !willRunOutInWindow) {
                                                                                    // If projected stock is negative but won't run out in window, show as "Low Stock" instead
                                                                                    statusLabel = 'Low Stock';
                                                                                    statusColor = 'warning';
                                                                                } else if (criticalStock > 0 && availableQty <= criticalStock) {
                                                                                    statusLabel = 'Critical';
                                                                                    statusColor = 'danger';
                                                                                } else if (reorderLevel > 0 && availableQty <= reorderLevel) {
                                                                                    statusLabel = 'Low Stock';
                                                                                    statusColor = 'warning';
                                                                                } else if (maxLevel > 0 && availableQty > maxLevel) {
                                                                                    statusLabel = 'Overstocked';
                                                                                    statusColor = 'info';
                                                                                }
                                                                                
                                                                                return (
                                                                                    <tr key={index}>
                                                                                        <td style={{ padding: '12px' }}>{item.material_name}</td>
                                                                                        <td className="text-end" style={{ padding: '12px' }}>{item.current_stock?.toFixed(2) || '0.00'}</td>
                                                                                        <td className="text-end" style={{ padding: '12px' }}>{(item.daily_usage || item.predicted_daily_usage || 0).toFixed(2)}</td>
                                                                                        <td className="text-end" style={{ padding: '12px' }}>
                                                                                            {(() => {
                                                                                                // Calculate projected usage based on selected windowDays
                                                                                                const dailyUsage = item.daily_usage || item.predicted_daily_usage || 0;
                                                                                                const projectedUsage = dailyUsage * windowDays;
                                                                                                return projectedUsage.toFixed(2);
                                                                                            })()}
                                                                                        </td>
                                                                                        <td className="text-end" style={{ padding: '12px' }}>
                                                                                            {(() => {
                                                                                                // Calculate projected stock based on selected windowDays
                                                                                                const currentStock = item.current_stock || 0;
                                                                                                const dailyUsage = item.daily_usage || item.predicted_daily_usage || 0;
                                                                                                const projectedUsage = dailyUsage * windowDays;
                                                                                                const projectedStock = currentStock - projectedUsage;
                                                                                                return projectedStock.toFixed(2);
                                                                                            })()}
                                                                                        </td>
                                                                                        <td className="text-end" style={{ padding: '12px' }}>
                                                                                            {item.stock_out_date ? (
                                                                                                <span>{new Date(item.stock_out_date).toLocaleDateString()}</span>
                                                                                            ) : (
                                                                                                <span className="text-muted">N/A</span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="text-end" style={{ padding: '12px' }}>
                                                                                            {item.days_remaining !== null && item.days_remaining !== undefined ? (
                                                                                                <span className={`badge ${item.days_remaining <= 7 ? 'bg-danger' : item.days_remaining <= 14 ? 'bg-warning' : 'bg-success'}`} style={{ borderRadius: '8px' }}>
                                                                                                    {item.days_remaining}
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="text-muted">-</span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="text-center" style={{ padding: '12px' }}>
                                                                                            <span className={`badge ${(item.reorder_needed || item.needs_reorder) ? 'bg-danger' : 'bg-success'}`} style={{ borderRadius: '8px' }}>
                                                                                                {(item.reorder_needed || item.needs_reorder) ? 'Yes' : 'No'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="text-end text-success fw-bold" style={{ padding: '12px' }}>{item.recommended_quantity?.toFixed(2) || '0.00'}</td>
                                                                                        <td style={{ padding: '12px' }}>{item.recommended_order_date || item.reorder_date || '-'}</td>
                                                                                        <td className="text-center" style={{ padding: '12px' }}>
                                                                                            <span className={`badge ${
                                                                                                statusColor === 'danger' ? 'bg-danger' :
                                                                                                statusColor === 'warning' ? 'bg-warning' :
                                                                                                statusColor === 'info' ? 'bg-info' :
                                                                                                'bg-success'
                                                                                            }`} style={{ borderRadius: '8px' }}>
                                                                                                {statusLabel}
                                                                                            </span>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Empty State Messages */}
                                        {!enhancedReplenishment?.alkansya_replenishment && replenishmentFilter === 'alkansya' && (
                                            <div className="text-center py-5 mb-4">
                                                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                    <div className="card-body py-5">
                                                        <i className="fas fa-box fa-3x text-muted mb-3"></i>
                                                        <h5 className="text-muted">No Alkansya Replenishment Data</h5>
                                                        <p className="text-muted">Alkansya production data is needed to generate replenishment schedules based on daily output</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {!enhancedReplenishment?.made_to_order_replenishment && replenishmentFilter === 'made_to_order' && (
                                            <div className="text-center py-5 mb-4">
                                                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                    <div className="card-body py-5">
                                                        <i className="fas fa-tools fa-3x text-muted mb-3"></i>
                                                        <h5 className="text-muted">No Made-to-Order Replenishment Data</h5>
                                                        <p className="text-muted">Accepted order data is needed to generate replenishment schedules for made-to-order materials</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {!enhancedReplenishment?.alkansya_replenishment && !enhancedReplenishment?.made_to_order_replenishment && replenishmentFilter === 'all' && (
                                            <div className="text-center py-5 mb-4">
                                                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                    <div className="card-body py-5">
                                                        <i className="fas fa-truck fa-3x text-muted mb-3"></i>
                                                        <h5 className="text-muted">No Replenishment Data Available</h5>
                                                        <p className="text-muted">Replenishment data will appear here once production and order data is available</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* View Tabs */}
                                        <ul className="nav nav-tabs mb-4" id="replenishmentTabs" role="tablist">
                                            <li className="nav-item" role="presentation">
                                                <button 
                                                    className={`nav-link ${replenishmentView === 'summary' ? 'active' : ''}`}
                                                    onClick={() => setReplenishmentView('summary')}
                                                >
                                                    Summary Dashboard
                                                </button>
                                            </li>
                                            <li className="nav-item" role="presentation">
                                                <button 
                                                    className={`nav-link ${replenishmentView === 'schedule' ? 'active' : ''}`}
                                                    onClick={() => setReplenishmentView('schedule')}
                                                >
                                                    Replenishment Schedule
                                                </button>
                                            </li>
                                            <li className="nav-item" role="presentation">
                                                <button 
                                                    className={`nav-link ${replenishmentView === 'analytics' ? 'active' : ''}`}
                                                    onClick={() => setReplenishmentView('analytics')}
                                                >
                                                    Consumption Analytics
                                                </button>
                                            </li>
                                        </ul>

                                        {/* Summary Dashboard */}
                                        {replenishmentView === 'summary' && (
                                            <div>
                                                <div className="row mb-4">
                                                    <div className="col-md-2">
                                                        <div className="card bg-light">
                                                            <div className="card-body text-center">
                                                                <h6 className="card-title text-muted">Total Materials</h6>
                                                                <h4 className="text-primary">{enhancedReplenishment.summary.total_materials}</h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-2">
                                                        <div className="card bg-light">
                                                            <div className="card-body text-center">
                                                                <h6 className="card-title text-muted">Critical</h6>
                                                                <h4 className="text-danger">{enhancedReplenishment.summary.critical_materials}</h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-2">
                                                        <div className="card bg-light">
                                                            <div className="card-body text-center">
                                                                <h6 className="card-title text-muted">High Priority</h6>
                                                                <h4 className="text-warning">{enhancedReplenishment.summary.high_priority_materials}</h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-2">
                                                        <div className="card bg-light">
                                                            <div className="card-body text-center">
                                                                <h6 className="card-title text-muted">Need Reorder</h6>
                                                                <h4 className="text-info">{enhancedReplenishment.summary.materials_needing_reorder}</h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-2">
                                                        <div className="card bg-light">
                                                            <div className="card-body text-center">
                                                                <h6 className="card-title text-muted">Reorder Value</h6>
                                                                <h4 className="text-success">₱{enhancedReplenishment.summary.total_reorder_value.toLocaleString()}</h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-2">
                                                        <div className="card bg-light">
                                                            <div className="card-body text-center">
                                                                <h6 className="card-title text-muted">Avg Lead Time</h6>
                                                                <h4 className="text-secondary">{Math.round(enhancedReplenishment.summary.avg_lead_time)} days</h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="row">
                                                    <div className="col-md-6">
                                                        <div className="card">
                                                            <div className="card-header">
                                                                <h6 className="mb-0">Material Source Breakdown</h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <div className="row text-center">
                                                                    <div className="col-4">
                                                                        <h5 className="text-primary">{enhancedReplenishment.summary.alkansya_materials}</h5>
                                                                        <small className="text-muted">Alkansya Materials</small>
                                                                    </div>
                                                                    <div className="col-4">
                                                                        <h5 className="text-info">{enhancedReplenishment.summary.made_to_order_materials}</h5>
                                                                        <small className="text-muted">Made-to-Order</small>
                                                                    </div>
                                                                    <div className="col-4">
                                                                        <h5 className="text-success">{enhancedReplenishment.alkansya_daily_output}</h5>
                                                                        <small className="text-muted">Avg Daily Output</small>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <div className="card">
                                                            <div className="card-header">
                                                                <h6 className="mb-0">Urgency Distribution</h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <div className="d-flex justify-content-between mb-2">
                                                                    <span>Critical</span>
                                                                    <span className="badge bg-danger">{enhancedReplenishment.summary.critical_materials}</span>
                                                                </div>
                                                                <div className="d-flex justify-content-between mb-2">
                                                                    <span>High Priority</span>
                                                                    <span className="badge bg-warning">{enhancedReplenishment.summary.high_priority_materials}</span>
                                                                </div>
                                                                <div className="d-flex justify-content-between mb-2">
                                                                    <span>Medium Priority</span>
                                                                    <span className="badge bg-info">{enhancedReplenishment.summary.medium_priority_materials}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Comprehensive Replenishment Schedule Table - Only show for All Materials filter */}
                                        {replenishmentView === 'schedule' && replenishmentFilter === 'all' && enhancedReplenishment?.replenishment_items && (
                                            <div className="mb-4">
                                                <h6 className="mb-3 d-flex align-items-center">
                                                    <i className="fas fa-table me-2"></i>
                                                    Comprehensive Replenishment Schedule (Filtered: {windowDays} days)
                                                </h6>
                                                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                    <div className="card-body">
                                                        <div className="table-responsive" style={{ maxHeight: '700px', overflowY: 'auto' }}>
                                                            <table className="table table-hover table-striped" style={{ fontSize: '0.9rem' }}>
                                                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                                                                    <tr>
                                                                        <th style={{ fontWeight: '600', padding: '12px' }}>Material</th>
                                                                        <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Current Stock</th>
                                                                        <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Daily Usage</th>
                                                                        <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Projected Usage ({windowDays} days)</th>
                                                                        <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Projected Stock ({windowDays} days)</th>
                                                                        <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Stock-out Date</th>
                                                                        <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Days Remaining</th>
                                                                        <th className="text-center" style={{ fontWeight: '600', padding: '12px' }}>Reorder Needed?</th>
                                                                        <th className="text-end" style={{ fontWeight: '600', padding: '12px' }}>Recommended Qty</th>
                                                                        <th style={{ fontWeight: '600', padding: '12px' }}>Recommended Order Date</th>
                                                                        <th className="text-center" style={{ fontWeight: '600', padding: '12px' }}>Status ({windowDays} days)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {enhancedReplenishment.replenishment_items
                                                                        // Show ALL materials - no filtering
                                                                        // The windowDays filter is only for display purposes (showing projected values for that period)
                                                                        .map((item, index) => {
                                                                            // Calculate projected stock based on selected windowDays for status calculation
                                                                            const currentStock = item.current_stock || 0;
                                                                            const dailyUsage = item.predicted_daily_usage || 0;
                                                                            const projectedUsage = dailyUsage * windowDays;
                                                                            const projectedStock = currentStock - projectedUsage;
                                                                            
                                                                            // Recalculate status based on projected stock for selected windowDays
                                                                            const criticalStock = item.critical_stock || 0;
                                                                            const reorderLevel = item.reorder_point || item.reorder_level || 0;
                                                                            const maxLevel = item.max_level || 0;
                                                                            const daysRemaining = item.days_remaining || item.days_until_stockout || 999;
                                                                            
                                                                            // For alkansya and made-to-order materials, use projected stock after windowDays
                                                                            // For other materials, use current stock
                                                                            // IMPORTANT: Only show "Out of Stock" if the material will actually run out within the selected windowDays period
                                                                            const availableQty = (item.is_alkansya_material || item.is_made_to_order_material) 
                                                                                ? projectedStock 
                                                                                : currentStock;
                                                                            
                                                                            let statusLabel = 'In Stock';
                                                                            let statusColor = 'success';
                                                                            
                                                                            // Check if material will run out within the selected windowDays period
                                                                            const willRunOutInWindow = daysRemaining <= windowDays && daysRemaining > 0;
                                                                            
                                                                            if (availableQty <= 0 && willRunOutInWindow) {
                                                                                // Only show "Out of Stock" if it will actually run out within the window period
                                                                                statusLabel = 'Out of Stock';
                                                                                statusColor = 'danger';
                                                                            } else if (availableQty <= 0 && !willRunOutInWindow) {
                                                                                // If projected stock is negative but won't run out in window, show as "Low Stock" instead
                                                                                statusLabel = 'Low Stock';
                                                                                statusColor = 'warning';
                                                                            } else if (criticalStock > 0 && availableQty <= criticalStock) {
                                                                                statusLabel = 'Critical';
                                                                                statusColor = 'danger';
                                                                            } else if (reorderLevel > 0 && availableQty <= reorderLevel) {
                                                                                statusLabel = 'Low Stock';
                                                                                statusColor = 'warning';
                                                                            } else if (maxLevel > 0 && availableQty > maxLevel) {
                                                                                statusLabel = 'Overstocked';
                                                                                statusColor = 'info';
                                                                            }
                                                                            
                                                                            return (
                                                                                <tr key={index}>
                                                                                    <td style={{ padding: '12px' }}>
                                                                                        {item.material_name}
                                                                                        {item.is_alkansya_material && <span className="badge bg-primary ms-2" style={{ fontSize: '0.7rem' }}>A</span>}
                                                                                        {item.is_made_to_order_material && <span className="badge bg-info ms-2" style={{ fontSize: '0.7rem' }}>M</span>}
                                                                                    </td>
                                                                                    <td className="text-end" style={{ padding: '12px' }}>{item.current_stock?.toFixed(2) || '0.00'}</td>
                                                                                    <td className="text-end" style={{ padding: '12px' }}>{item.predicted_daily_usage?.toFixed(2) || '0.00'}</td>
                                                                                    <td className="text-end" style={{ padding: '12px' }}>
                                                                                        {(() => {
                                                                                            // Calculate projected usage based on selected windowDays
                                                                                            const dailyUsage = item.predicted_daily_usage || 0;
                                                                                            const projectedUsage = dailyUsage * windowDays;
                                                                                            return projectedUsage.toFixed(2);
                                                                                        })()}
                                                                                    </td>
                                                                                    <td className="text-end" style={{ padding: '12px' }}>
                                                                                        {(() => {
                                                                                            // Calculate projected stock based on selected windowDays
                                                                                            const currentStock = item.current_stock || 0;
                                                                                            const dailyUsage = item.predicted_daily_usage || 0;
                                                                                            const projectedUsage = dailyUsage * windowDays;
                                                                                            const projectedStock = currentStock - projectedUsage;
                                                                                            return projectedStock.toFixed(2);
                                                                                        })()}
                                                                                    </td>
                                                                                    <td className="text-end" style={{ padding: '12px' }}>
                                                                                        {item.stock_out_date ? (
                                                                                            <span>{new Date(item.stock_out_date).toLocaleDateString()}</span>
                                                                                        ) : (
                                                                                            <span className="text-muted">N/A</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="text-end" style={{ padding: '12px' }}>
                                                                                        {item.days_remaining !== null && item.days_remaining !== undefined ? (
                                                                                            <span className={`badge ${item.days_remaining <= 7 ? 'bg-danger' : item.days_remaining <= 14 ? 'bg-warning' : 'bg-success'}`} style={{ borderRadius: '8px' }}>
                                                                                                {item.days_remaining}
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-muted">-</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="text-center" style={{ padding: '12px' }}>
                                                                                        {(() => {
                                                                                            // Calculate if reorder is needed based on projected stock after windowDays
                                                                                            const currentStock = item.current_stock || 0;
                                                                                            const dailyUsage = item.predicted_daily_usage || 0;
                                                                                            const projectedUsage = dailyUsage * windowDays;
                                                                                            const projectedStock = currentStock - projectedUsage;
                                                                                            const reorderLevel = item.reorder_point || item.reorder_level || 0;
                                                                                            
                                                                                            // Calculate days remaining based on current stock and daily usage
                                                                                            const calculatedDaysRemaining = dailyUsage > 0 
                                                                                                ? Math.floor(currentStock / dailyUsage) 
                                                                                                : 999;
                                                                                            
                                                                                            // Reorder is needed if ANY of these conditions are true:
                                                                                            // 1. Projected stock is negative (will run out before end of period)
                                                                                            // 2. Projected stock is at or below reorder point
                                                                                            // 3. Material will run out within the windowDays period (calculated days remaining <= windowDays)
                                                                                            const willRunOutInWindow = calculatedDaysRemaining <= windowDays && calculatedDaysRemaining > 0;
                                                                                            const belowReorderPoint = reorderLevel > 0 && projectedStock <= reorderLevel;
                                                                                            const willBeOutOfStock = projectedStock <= 0;
                                                                                            
                                                                                            const needsReorder = willBeOutOfStock || belowReorderPoint || willRunOutInWindow;
                                                                                            
                                                                                            return (
                                                                                                <span className={`badge ${needsReorder ? 'bg-danger' : 'bg-success'}`} style={{ borderRadius: '8px' }}>
                                                                                                    {needsReorder ? 'Yes' : 'No'}
                                                                                                </span>
                                                                                            );
                                                                                        })()}
                                                                                    </td>
                                                                                    <td className="text-end text-success fw-bold" style={{ padding: '12px' }}>{item.recommended_quantity?.toFixed(2) || '0.00'}</td>
                                                                                    <td style={{ padding: '12px' }}>{item.recommended_order_date || item.reorder_date || '-'}</td>
                                                                                    <td className="text-center" style={{ padding: '12px' }}>
                                                                                        <span className={`badge ${
                                                                                            statusColor === 'danger' ? 'bg-danger' :
                                                                                            statusColor === 'warning' ? 'bg-warning' :
                                                                                            statusColor === 'info' ? 'bg-info' :
                                                                                            'bg-success'
                                                                                        }`} style={{ borderRadius: '8px' }}>
                                                                                            {statusLabel}
                                                                                        </span>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Replenishment Schedule - Only show for All Materials filter */}
                                        {replenishmentView === 'schedule' && replenishmentFilter === 'all' && (
                                            <div>
                                                <div className="row">
                                                    <div className="col-md-6">
                                                        <div className="card">
                                                            <div className="card-header bg-danger text-white">
                                                                <h6 className="mb-0">Immediate Action Required</h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                                                                    <table className="table table-sm">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Material</th>
                                                                                <th>Days Left</th>
                                                                                <th>Order Qty</th>
                                                                                <th>Reorder Date</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {enhancedReplenishment.schedule.immediate.map((item, index) => (
                                                                                <tr key={index}>
                                                                                    <td className="text-truncate" style={{ maxWidth: '150px' }} title={item.material_name}>
                                                                                        {item.material_name}
                                                                                    </td>
                                                                                    <td>
                                                                                        <span className="badge bg-danger">{item.days_until_stockout}</span>
                                                                                    </td>
                                                                                    <td>{item.recommended_quantity || item.suggested_order_qty || '-'}</td>
                                                                                    <td>{item.reorder_date}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <div className="card">
                                                            <div className="card-header bg-warning text-white">
                                                                <h6 className="mb-0">This Week</h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                                                                    <table className="table table-sm">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Material</th>
                                                                                <th>Days Left</th>
                                                                                <th>Order Qty</th>
                                                                                <th>Reorder Date</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {enhancedReplenishment.schedule.this_week.map((item, index) => (
                                                                                <tr key={index}>
                                                                                    <td className="text-truncate" style={{ maxWidth: '150px' }} title={item.material_name}>
                                                                                        {item.material_name}
                                                                                    </td>
                                                                                    <td>
                                                                                        <span className="badge bg-warning">{item.days_until_stockout}</span>
                                                                                    </td>
                                                                                    <td>{item.recommended_quantity || item.suggested_order_qty || '-'}</td>
                                                                                    <td>{item.reorder_date}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="row mt-3">
                                                    <div className="col-md-6">
                                                        <div className="card">
                                                            <div className="card-header bg-info text-white">
                                                                <h6 className="mb-0">Next Week</h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                                                                    <table className="table table-sm">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Material</th>
                                                                                <th>Days Left</th>
                                                                                <th>Order Qty</th>
                                                                                <th>Reorder Date</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {enhancedReplenishment.schedule.next_week.map((item, index) => (
                                                                                <tr key={index}>
                                                                                    <td className="text-truncate" style={{ maxWidth: '150px' }} title={item.material_name}>
                                                                                        {item.material_name}
                                                                                    </td>
                                                                                    <td>
                                                                                        <span className="badge bg-info">{item.days_until_stockout}</span>
                                                                                    </td>
                                                                                    <td>{item.recommended_quantity || item.suggested_order_qty || '-'}</td>
                                                                                    <td>{item.reorder_date}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <div className="card">
                                                            <div className="card-header bg-success text-white">
                                                                <h6 className="mb-0">Future Planning</h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                                                                    <table className="table table-sm">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Material</th>
                                                                                <th>Days Left</th>
                                                                                <th>Order Qty</th>
                                                                                <th>Reorder Date</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {enhancedReplenishment.schedule.future.map((item, index) => (
                                                                                <tr key={index}>
                                                                                    <td className="text-truncate" style={{ maxWidth: '150px' }} title={item.material_name}>
                                                                                        {item.material_name}
                                                                                    </td>
                                                                                    <td>
                                                                                        <span className="badge bg-success">{item.days_until_stockout}</span>
                                                                                    </td>
                                                                                    <td>{item.recommended_quantity || item.suggested_order_qty || '-'}</td>
                                                                                    <td>{item.reorder_date}</td>
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
                                        )}

                                        {/* Message when schedule view is selected but filter is not "all" */}
                                        {replenishmentView === 'schedule' && replenishmentFilter !== 'all' && (
                                            <div className="text-center py-5">
                                                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                                    <div className="card-body py-5">
                                                        <i className="fas fa-calendar-alt fa-3x text-muted mb-3"></i>
                                                        <h5 className="text-muted">Schedule View Available for All Materials Only</h5>
                                                        <p className="text-muted">
                                                            The replenishment schedule (Immediate, This Week, Next Week, Future Planning) is only available when viewing all materials.
                                                            <br />
                                                            Please select "All Materials" filter to view the schedule.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Consumption Analytics */}
                                        {replenishmentView === 'analytics' && (
                                            <div>
                                                <div className="row">
                                                    <div className="col-md-8">
                                                        <div className="card">
                                                            <div className="card-header">
                                                                <h6 className="mb-0">Material Consumption Breakdown</h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <div className="table-responsive">
                                                                    <table className="table table-hover">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Material</th>
                                                                                <th>Historical</th>
                                                                                <th>Alkansya</th>
                                                                                <th>Made-to-Order</th>
                                                                                <th>Predicted</th>
                                                                                <th>Days Left</th>
                                                                                <th>Source</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {enhancedReplenishment.replenishment_items.slice(0, 20).map((item, index) => (
                                                                                <tr key={index}>
                                                                                    <td className="text-truncate" style={{ maxWidth: '150px' }} title={item.material_name}>
                                                                                        {item.material_name}
                                                                                    </td>
                                                                                    <td>{item.consumption_breakdown.historical}</td>
                                                                                    <td>{item.consumption_breakdown.alkansya}</td>
                                                                                    <td>{item.consumption_breakdown.made_to_order}</td>
                                                                                    <td className="fw-bold">{item.consumption_breakdown.predicted}</td>
                                                                                    <td>
                                                                                        <span className={`badge ${
                                                                                            item.days_until_stockout <= 7 ? 'bg-danger' : 
                                                                                            item.days_until_stockout <= 14 ? 'bg-warning' : 
                                                                                            'bg-success'
                                                                                        }`}>
                                                                                            {item.days_until_stockout}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td>
                                                                                        <div className="d-flex gap-1">
                                                                                            {item.is_alkansya_material && (
                                                                                                <span className="badge bg-primary">A</span>
                                                                                            )}
                                                                                            {item.is_made_to_order_material && (
                                                                                                <span className="badge bg-info">M</span>
                                                                                            )}
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
                                                    <div className="col-md-4">
                                                        <div className="card">
                                                            <div className="card-header">
                                                                <h6 className="mb-0">Consumption Sources</h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <div className="mb-3">
                                                                    <div className="d-flex justify-content-between">
                                                                        <span>Alkansya Materials</span>
                                                                        <span className="badge bg-primary">{enhancedReplenishment.summary.alkansya_materials}</span>
                                                                    </div>
                                                                    <div className="progress mt-1" style={{ height: '8px' }}>
                                                                        <div 
                                                                            className="progress-bar bg-primary" 
                                                                            style={{ 
                                                                                width: `${(enhancedReplenishment.summary.alkansya_materials / enhancedReplenishment.summary.total_materials) * 100}%` 
                                                                            }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                                <div className="mb-3">
                                                                    <div className="d-flex justify-content-between">
                                                                        <span>Made-to-Order</span>
                                                                        <span className="badge bg-info">{enhancedReplenishment.summary.made_to_order_materials}</span>
                                                                    </div>
                                                                    <div className="progress mt-1" style={{ height: '8px' }}>
                                                                        <div 
                                                                            className="progress-bar bg-info" 
                                                                            style={{ 
                                                                                width: `${(enhancedReplenishment.summary.made_to_order_materials / enhancedReplenishment.summary.total_materials) * 100}%` 
                                                                            }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                                <div className="mb-3">
                                                                    <div className="d-flex justify-content-between">
                                                                        <span>Other Materials</span>
                                                                        <span className="badge bg-secondary">
                                                                            {enhancedReplenishment.summary.total_materials - enhancedReplenishment.summary.alkansya_materials - enhancedReplenishment.summary.made_to_order_materials}
                                                                        </span>
                                                                    </div>
                                                                    <div className="progress mt-1" style={{ height: '8px' }}>
                                                                        <div 
                                                                            className="progress-bar bg-secondary" 
                                                                            style={{ 
                                                                                width: `${((enhancedReplenishment.summary.total_materials - enhancedReplenishment.summary.alkansya_materials - enhancedReplenishment.summary.made_to_order_materials) / enhancedReplenishment.summary.total_materials) * 100}%` 
                                                                            }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        </div>
                                    )
                                ) : (
                                    <div className="text-center py-5">
                                        <FaTruck className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                        <h5 className="text-muted">No replenishment data available</h5>
                                        <p className="text-muted">Enhanced replenishment data will appear here once material usage patterns are established</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* Enhanced Transactions Tab */}
            {activeTab === 'transactions' && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                            <div className="card-header bg-white border-0" style={{ borderRadius: '12px' }}>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="mb-0 d-flex align-items-center">
                                        <FaHistory className="me-2" style={{ color: colors.dark }} />
                                        Inventory Transactions & Activity Log
                                        {tabLoadingStates.transactions && (
                                            <div className="spinner-border spinner-border-sm ms-2" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        )}
                                    </h5>
                                    <div className="d-flex gap-2">
                                        <select 
                                            className="form-select form-select-sm" 
                                            value={windowDays}
                                            onChange={(e) => setWindowDays(parseInt(e.target.value))}
                                            style={{ width: '120px', borderRadius: '8px' }}
                                        >
                                            <option value={7}>7 Days</option>
                                            <option value={14}>14 Days</option>
                                            <option value={30}>30 Days</option>
                                            <option value={60}>60 Days</option>
                                            <option value={90}>90 Days</option>
                                        </select>
                                        <button 
                                            className="btn btn-outline-dark btn-sm"
                                            onClick={() => fetchEnhancedTransactionsData()}
                                            style={{ borderRadius: '8px' }}
                                        >
                                            <FaSync className="me-1" />
                                            Refresh
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Filter Buttons */}
                                <div className="d-flex gap-2 mb-3">
                                    <button 
                                        className={`btn ${transactionFilter === 'all' ? 'btn-dark' : 'btn-outline-dark'}`}
                                        onClick={() => setTransactionFilter('all')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-list me-2"></i>
                                        All Transactions
                                    </button>
                                    <button 
                                        className={`btn ${transactionFilter === 'alkansya' ? 'btn-success' : 'btn-outline-success'}`}
                                        onClick={() => setTransactionFilter('alkansya')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-box me-2"></i>
                                        Alkansya
                                    </button>
                                    <button 
                                        className={`btn ${transactionFilter === 'made_to_order' ? 'btn-info' : 'btn-outline-info'}`}
                                        onClick={() => setTransactionFilter('made_to_order')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-tools me-2"></i>
                                        Made to Order
                                    </button>
                                    <button 
                                        className={`btn ${transactionFilter === 'other' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                        onClick={() => setTransactionFilter('other')}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <i className="fas fa-ellipsis-h me-2"></i>
                                        Other
                                    </button>
                                </div>
                            </div>
                            <div className="card-body">
                                {tabLoadingStates.transactions ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-dark mb-3" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h5>Loading Enhanced Transactions...</h5>
                                        <p className="text-muted">Fetching normalized inventory transactions with filtering</p>
                                    </div>
                                ) : enhancedTransactions ? (
                                    enhancedTransactions.error ? (
                                        <div className="text-center py-5">
                                            <FaHistory className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                            <h5 className="text-muted">No Transaction Data Available</h5>
                                            <p className="text-muted mb-4">{enhancedTransactions.message}</p>
                                            <div className="card bg-light">
                                                <div className="card-body">
                                                    <h6 className="card-title">Setup Instructions:</h6>
                                                    <ol className="text-start">
                                                        {enhancedTransactions.instructions?.map((instruction, index) => (
                                                            <li key={index} className="mb-2">
                                                                <code className="bg-dark text-light px-2 py-1 rounded">
                                                                    {instruction}
                                                                </code>
                                                            </li>
                                                        ))}
                                                    </ol>
                                                    <div className="mt-3">
                                                        <button 
                                                            className="btn btn-primary"
                                                            onClick={() => fetchEnhancedTransactionsData()}
                                                        >
                                                            <FaSync className="me-1" />
                                                            Check Again
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                        {/* View Tabs */}
                                        <ul className="nav nav-tabs mb-4" id="transactionTabs" role="tablist">
                                            <li className="nav-item" role="presentation">
                                                <button 
                                                    className={`nav-link ${transactionView === 'list' ? 'active' : ''}`}
                                                    onClick={() => setTransactionView('list')}
                                                >
                                                    Transaction List
                                                </button>
                                            </li>
                                            <li className="nav-item" role="presentation">
                                                <button 
                                                    className={`nav-link ${transactionView === 'summary' ? 'active' : ''}`}
                                                    onClick={() => setTransactionView('summary')}
                                                >
                                                    Summary Dashboard
                                                </button>
                                            </li>
                                            <li className="nav-item" role="presentation">
                                                <button 
                                                    className={`nav-link ${transactionView === 'analytics' ? 'active' : ''}`}
                                                    onClick={() => setTransactionView('analytics')}
                                                >
                                                    Analytics
                                                </button>
                                            </li>
                                        </ul>

                                        {/* Transaction List */}
                                        {transactionView === 'list' && (
                                            <div>
                                                <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
                                                    <div className="card-header bg-white border-bottom">
                                                        <h6 className="mb-0">
                                                            <i className="fas fa-history me-2"></i>
                                                            All Inventory Transactions
                                                        </h6>
                                                    </div>
                                                    <div className="card-body p-0">
                                                <div className="table-responsive">
                                                            <table className="table table-hover mb-0">
                                                                <thead className="table-light">
                                                                    <tr>
                                                                        <th style={{ padding: '1rem' }}>Date & Time</th>
                                                                        <th style={{ padding: '1rem' }}>Type</th>
                                                                        <th style={{ padding: '1rem' }}>Category</th>
                                                                        <th style={{ padding: '1rem' }}>Material</th>
                                                                        <th style={{ padding: '1rem' }}>Product</th>
                                                                        <th style={{ padding: '1rem' }}>Quantity</th>
                                                                        <th style={{ padding: '1rem' }}>Unit Cost</th>
                                                                        <th style={{ padding: '1rem' }}>Total Cost</th>
                                                                        <th style={{ padding: '1rem' }}>Reference</th>
                                                                        <th style={{ padding: '1rem' }}>Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {enhancedTransactions.transactions.map((transaction) => (
                                                                        <tr key={transaction.id} style={{ cursor: 'pointer' }}>
                                                                            <td style={{ padding: '1rem' }}>
                                                                        <div>
                                                                            <strong>{transaction.date}</strong>
                                                                            <br />
                                                                            <small className="text-muted">{transaction.time}</small>
                                                                        </div>
                                                                    </td>
                                                                            <td style={{ padding: '1rem' }}>
                                                                        <span className={`badge ${
                                                                            transaction.direction === 'in' ? 'bg-success' : 'bg-danger'
                                                                                }`} style={{ borderRadius: '8px' }}>
                                                                            {transaction.direction_label}
                                                                        </span>
                                                                    </td>
                                                                            <td style={{ padding: '1rem' }}>
                                                                        <span className={`badge ${
                                                                                    transaction.category === 'alkansya' ? 'bg-success' :
                                                                            transaction.category === 'made_to_order' ? 'bg-info' :
                                                                            'bg-secondary'
                                                                                }`} style={{ borderRadius: '8px' }}>
                                                                            {transaction.category === 'alkansya' ? 'Alkansya' :
                                                                             transaction.category === 'made_to_order' ? 'Made-to-Order' : 'Other'}
                                                                        </span>
                                                                    </td>
                                                                            <td style={{ padding: '1rem' }}>
                                                                        <div>
                                                                                    <strong className="d-block">{transaction.material_name}</strong>
                                                                                    <small className="text-muted d-block">{transaction.material_code}</small>
                                                                        </div>
                                                                    </td>
                                                                            <td style={{ padding: '1rem' }}>
                                                                        <span className="text-truncate d-inline-block" style={{ maxWidth: '120px' }} title={transaction.product_name}>
                                                                                    {transaction.product_name || '-'}
                                                                        </span>
                                                                    </td>
                                                                            <td style={{ padding: '1rem' }} className={transaction.direction === 'in' ? 'text-success' : 'text-danger'}>
                                                                        <strong>{transaction.quantity_display}</strong>
                                                                        <br />
                                                                        <small className="text-muted">{transaction.unit}</small>
                                                                    </td>
                                                                            <td style={{ padding: '1rem' }}>
                                                                                <div className="d-flex align-items-center">
                                                                                    ₱{transaction.unit_cost?.toLocaleString() || 'N/A'}
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: '1rem' }}>
                                                                                <strong>₱{transaction.total_cost?.toLocaleString() || 'N/A'}</strong>
                                                                            </td>
                                                                            <td style={{ padding: '1rem' }}>
                                                                        <span className="text-truncate d-inline-block" style={{ maxWidth: '150px' }} title={transaction.reference}>
                                                                            {transaction.reference}
                                                                        </span>
                                                                    </td>
                                                                            <td style={{ padding: '1rem' }}>
                                                                        <span className={`badge ${
                                                                            transaction.status === 'completed' ? 'bg-success' :
                                                                            transaction.status === 'pending' ? 'bg-warning' :
                                                                            'bg-secondary'
                                                                                }`} style={{ borderRadius: '8px' }}>
                                                                            {transaction.status}
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
                                        )}

                                        {/* Summary Dashboard */}
                                        {transactionView === 'summary' && (
                                            <div>
                                                <div className="row mb-4">
                                                    <div className="col-lg-2 col-md-4 col-sm-6 mb-3">
                                                        <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                                                            <div className="card-body text-center">
                                                                <i className="fas fa-shopping-cart fa-2x text-primary mb-2"></i>
                                                                <h6 className="card-title text-muted mb-2">Total Transactions</h6>
                                                                <h4 className="text-primary mb-0">{enhancedTransactions.summary.total_transactions}</h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-lg-2 col-md-4 col-sm-6 mb-3">
                                                        <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                                                            <div className="card-body text-center">
                                                                <i className="fas fa-peso-sign fa-2x text-success mb-2"></i>
                                                                <h6 className="card-title text-muted mb-2">Total Value</h6>
                                                                <h5 className="text-success mb-0">₱{enhancedTransactions.summary.total_value.toLocaleString()}</h5>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-lg-2 col-md-4 col-sm-6 mb-3">
                                                        <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                                                            <div className="card-body text-center">
                                                                <i className="fas fa-arrow-down fa-2x text-success mb-2"></i>
                                                                <h6 className="card-title text-muted mb-2">Inbound</h6>
                                                                <h4 className="text-success mb-0">{enhancedTransactions.summary.inbound_transactions}</h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-lg-2 col-md-4 col-sm-6 mb-3">
                                                        <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                                                            <div className="card-body text-center">
                                                                <i className="fas fa-arrow-up fa-2x text-danger mb-2"></i>
                                                                <h6 className="card-title text-muted mb-2">Outbound</h6>
                                                                <h4 className="text-danger mb-0">{enhancedTransactions.summary.outbound_transactions}</h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-lg-2 col-md-4 col-sm-6 mb-3">
                                                        <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                                                            <div className="card-body text-center">
                                                                <i className="fas fa-boxes fa-2x text-info mb-2"></i>
                                                                <h6 className="card-title text-muted mb-2">Materials</h6>
                                                                <h4 className="text-info mb-0">{enhancedTransactions.summary.unique_materials}</h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-lg-2 col-md-4 col-sm-6 mb-3">
                                                        <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                                                            <div className="card-body text-center">
                                                                <i className="fas fa-layer-group fa-2x text-secondary mb-2"></i>
                                                                <h6 className="card-title text-muted mb-2">Total Qty</h6>
                                                                <h4 className="text-secondary mb-0">{enhancedTransactions.summary.total_quantity.toLocaleString()}</h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="row">
                                                    <div className="col-md-6 mb-4">
                                                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', height: '100%' }}>
                                                            <div className="card-header bg-white border-bottom">
                                                                <h6 className="mb-0">
                                                                    <i className="fas fa-tags me-2"></i>
                                                                    Transaction Categories
                                                                </h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                                    <span className="fw-bold">Alkansya</span>
                                                                    <span className="badge bg-success" style={{ borderRadius: '8px', fontSize: '1rem', padding: '0.5rem 1rem' }}>{enhancedTransactions.summary.alkansya_transactions}</span>
                                                                </div>
                                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                                    <span className="fw-bold">Made-to-Order</span>
                                                                    <span className="badge bg-info" style={{ borderRadius: '8px', fontSize: '1rem', padding: '0.5rem 1rem' }}>{enhancedTransactions.summary.made_to_order_transactions}</span>
                                                                </div>
                                                                <div className="d-flex justify-content-between align-items-center mb-0">
                                                                    <span className="fw-bold">Other</span>
                                                                    <span className="badge bg-secondary" style={{ borderRadius: '8px', fontSize: '1rem', padding: '0.5rem 1rem' }}>{enhancedTransactions.summary.other_transactions}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-6 mb-4">
                                                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', height: '100%' }}>
                                                            <div className="card-header bg-white border-bottom">
                                                                <h6 className="mb-0">
                                                                    <i className="fas fa-chart-line me-2"></i>
                                                                    Daily Transaction Trends
                                                                </h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <ResponsiveContainer width="100%" height={200}>
                                                                    <LineChart data={enhancedTransactions.daily_summary}>
                                                                        <CartesianGrid strokeDasharray="3 3" />
                                                                        <XAxis dataKey="date" />
                                                                        <YAxis />
                                                                        <Tooltip />
                                                                        <Legend />
                                                                        <Line type="monotone" dataKey="total_transactions" stroke={colors.primary} strokeWidth={2} name="Total" />
                                                                        <Line type="monotone" dataKey="inbound" stroke={colors.success} strokeWidth={2} name="Inbound" />
                                                                        <Line type="monotone" dataKey="outbound" stroke={colors.danger} strokeWidth={2} name="Outbound" />
                                                                    </LineChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Analytics */}
                                        {transactionView === 'analytics' && (
                                            <div>
                                                <div className="row">
                                                    <div className="col-md-8">
                                                        <div className="card">
                                                            <div className="card-header">
                                                                <h6 className="mb-0">Material Transaction Summary</h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <div className="table-responsive">
                                                                    <table className="table table-hover">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Material</th>
                                                                                <th>Code</th>
                                                                                <th>Transactions</th>
                                                                                <th>Total Qty</th>
                                                                                <th>Total Value</th>
                                                                                <th>Net Qty</th>
                                                                                <th>Last Transaction</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {enhancedTransactions.material_summary.slice(0, 20).map((material, index) => (
                                                                                <tr key={index}>
                                                                                    <td className="text-truncate" style={{ maxWidth: '150px' }} title={material.material_name}>
                                                                                        {material.material_name}
                                                                                    </td>
                                                                                    <td>{material.material_code}</td>
                                                                                    <td>
                                                                                        <span className="badge bg-info">{material.total_transactions}</span>
                                                                                    </td>
                                                                                    <td>{material.total_quantity.toLocaleString()}</td>
                                                                                    <td>₱{material.total_value.toLocaleString()}</td>
                                                                                    <td className={material.net_quantity > 0 ? 'text-success' : 'text-danger'}>
                                                                                        {material.net_quantity > 0 ? '+' : ''}{material.net_quantity}
                                                                                    </td>
                                                                                    <td>
                                                                                        <small>{new Date(material.last_transaction).toLocaleDateString()}</small>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-4">
                                                        <div className="card">
                                                            <div className="card-header">
                                                                <h6 className="mb-0">Transaction Distribution</h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <ResponsiveContainer width="100%" height={300}>
                                                                    <PieChart>
                                                                        <Pie
                                                                            data={[
                                                                                { name: 'Alkansya', value: enhancedTransactions.summary.alkansya_transactions, color: colors.primary },
                                                                                { name: 'Made-to-Order', value: enhancedTransactions.summary.made_to_order_transactions, color: colors.info },
                                                                                { name: 'Other', value: enhancedTransactions.summary.other_transactions, color: colors.secondary }
                                                                            ]}
                                                                            cx="50%"
                                                                            cy="50%"
                                                                            labelLine={false}
                                                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                                            outerRadius={80}
                                                                            fill="#8884d8"
                                                                            dataKey="value"
                                                                        >
                                                                            {[
                                                                                { name: 'Alkansya', value: enhancedTransactions.summary.alkansya_transactions, color: colors.primary },
                                                                                { name: 'Made-to-Order', value: enhancedTransactions.summary.made_to_order_transactions, color: colors.info },
                                                                                { name: 'Other', value: enhancedTransactions.summary.other_transactions, color: colors.secondary }
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
                                                </div>
                                            </div>
                                        )}
                                        </div>
                                    )
                                ) : (
                                    <div className="text-center py-5">
                                        <FaHistory className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                                        <h5 className="text-muted">No transactions data available</h5>
                                        <p className="text-muted">Enhanced transaction data will appear here once inventory transactions are recorded</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                            <div className="card-header bg-white border-0" style={{ borderRadius: '12px' }}>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <FaExclamationTriangle className="me-2" style={{ color: colors.danger }} />
                                        Inventory Alerts & Warnings
                                        {tabLoadingStates.alerts && (
                                            <div className="spinner-border spinner-border-sm ms-2" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        )}
                                </h5>
                                    <button 
                                        className="btn btn-outline-danger btn-sm"
                                        onClick={() => {
                                            setTabLoadingStates(prev => ({ ...prev, alerts: true }));
                                            loadTabData('alerts');
                                        }}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <FaSync className="me-1" />
                                        Refresh Alerts
                                    </button>
                                </div>
                            </div>
                            <div className="card-body">
                                {tabLoadingStates.alerts ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-danger mb-3" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h5>Loading Inventory Alerts...</h5>
                                        <p className="text-muted">Checking all material levels and stock status</p>
                                    </div>
                                ) : realTimeAlerts?.alerts && realTimeAlerts.alerts.length > 0 ? (
                                    <div>
                                        {/* Summary Statistics */}
                                        <div className="row mb-4">
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px', borderLeft: '4px solid #dc3545' }}>
                                                    <div className="card-body">
                                                        <div className="d-flex align-items-center">
                                        <div className="flex-grow-1">
                                                                <h6 className="text-muted mb-1">Critical Alerts</h6>
                                                                <h4 className="text-danger mb-0">
                                                                    {realTimeAlerts.alerts.filter(a => a.severity === 'critical').length}
                                                                </h4>
                                        </div>
                                                            <i className="fas fa-exclamation-circle fa-3x text-danger"></i>
                                    </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px', borderLeft: '4px solid #ffc107' }}>
                                                    <div className="card-body">
                                                        <div className="d-flex align-items-center">
                                                            <div className="flex-grow-1">
                                                                <h6 className="text-muted mb-1">High Priority</h6>
                                                                <h4 className="text-warning mb-0">
                                                                    {realTimeAlerts.alerts.filter(a => a.severity === 'high').length}
                                                                </h4>
                                                            </div>
                                                            <i className="fas fa-exclamation-triangle fa-3x text-warning"></i>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px', borderLeft: '4px solid #17a2b8' }}>
                                                    <div className="card-body">
                                                        <div className="d-flex align-items-center">
                                                            <div className="flex-grow-1">
                                                                <h6 className="text-muted mb-1">Medium Priority</h6>
                                                                <h4 className="text-info mb-0">
                                                                    {realTimeAlerts.alerts.filter(a => a.severity === 'medium').length}
                                                                </h4>
                                                            </div>
                                                            <i className="fas fa-info-circle fa-3x text-info"></i>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-3 col-md-6 mb-3">
                                                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px', borderLeft: '4px solid #6c757d' }}>
                                                    <div className="card-body">
                                                        <div className="d-flex align-items-center">
                                                            <div className="flex-grow-1">
                                                                <h6 className="text-muted mb-1">Total Alerts</h6>
                                                                <h4 className="text-secondary mb-0">
                                                                    {realTimeAlerts.alerts.length}
                                                                </h4>
                                                            </div>
                                                            <i className="fas fa-bell fa-3x text-secondary"></i>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Alert List */}
                                        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
                                            <div className="card-header bg-white border-bottom">
                                                <h6 className="mb-0">
                                                    <i className="fas fa-list-ul me-2"></i>
                                                    Active Inventory Alerts
                                                </h6>
                                            </div>
                                            <div className="card-body p-0">
                                                {realTimeAlerts.alerts.map((alert) => (
                                                    <div 
                                                        key={alert.id} 
                                                        className={`border-bottom p-4 ${
                                                            alert.severity === 'critical' ? 'bg-light-danger' :
                                                            alert.severity === 'high' ? 'bg-light-warning' :
                                                            'bg-light-info'
                                                        }`}
                                                        style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = alert.severity === 'critical' ? '#f8d7da' : alert.severity === 'high' ? '#fff3cd' : '#d1ecf1'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = alert.severity === 'critical' ? '#f8d7da' : alert.severity === 'high' ? '#fff3cd' : '#d1ecf1'}
                                                    >
                                                        <div className="d-flex align-items-start">
                                                            <div className="me-3 mt-1">
                                                                {alert.severity === 'critical' && <FaExclamationTriangle className="text-danger" size={24} />}
                                                                {alert.severity === 'high' && <FaExclamationTriangle className="text-warning" size={24} />}
                                                                {alert.severity === 'medium' && <FaExclamationTriangle className="text-info" size={24} />}
                                                            </div>
                                                            <div className="flex-grow-1">
                                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                                    <div>
                                                                        <strong className="d-block mb-1" style={{ fontSize: '1.1rem' }}>
                                                                            {alert.material}
                                                                        </strong>
                                                                        <p className="text-muted mb-2" style={{ fontSize: '0.95rem' }}>
                                                                            {alert.message}
                                                                        </p>
                                                                    </div>
                                                                    <span className={`badge ${
                                                                        alert.severity === 'critical' ? 'bg-danger' :
                                                                        alert.severity === 'high' ? 'bg-warning' :
                                                                        'bg-info'
                                                                    }`} style={{ borderRadius: '8px', fontSize: '0.9rem' }}>
                                                                        {alert.severity.toUpperCase()}
                                                                    </span>
                                                                </div>
                                                                <div className="row">
                                                                    <div className="col-md-3 mb-2">
                                                                        <div className="d-flex align-items-center">
                                                                            <i className="fas fa-box text-muted me-2"></i>
                                                                            <div>
                                                                                <small className="text-muted d-block">Current Stock</small>
                                                                                <strong className="text-danger">{alert.current_stock}</strong>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-md-3 mb-2">
                                                                        <div className="d-flex align-items-center">
                                                                            <i className="fas fa-flag text-muted me-2"></i>
                                                                            <div>
                                                                                <small className="text-muted d-block">Reorder Point</small>
                                                                                <strong>{alert.reorder_point}</strong>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-md-3 mb-2">
                                                                        <div className="d-flex align-items-center">
                                                                            <i className="fas fa-shield-alt text-muted me-2"></i>
                                                                            <div>
                                                                                <small className="text-muted d-block">Safety Stock</small>
                                                                                <strong>{alert.safety_stock || 'N/A'}</strong>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-md-3 mb-2">
                                                                        <div className="d-flex align-items-center">
                                                                            <i className="fas fa-clock text-muted me-2"></i>
                                                                            <div>
                                                                                <small className="text-muted d-block">Date/Time</small>
                                                                                <strong className="text-muted">{new Date(alert.timestamp).toLocaleString()}</strong>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Recommendation Card */}
                                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', borderLeft: '4px solid #ffc107' }}>
                                            <div className="card-header bg-light border-0">
                                                <h6 className="mb-0">
                                                    <i className="fas fa-lightbulb me-2 text-warning"></i>
                                                    Recommended Actions
                                                </h6>
                                            </div>
                                            <div className="card-body">
                                                <ul className="mb-0">
                                                    <li className="mb-2">
                                                        <strong>Critical Materials:</strong> Order immediately to prevent stockout
                                                    </li>
                                                    <li className="mb-2">
                                                        <strong>High Priority:</strong> Reorder within the next 2-3 days
                                                    </li>
                                                    <li>
                                                        <strong>Medium Priority:</strong> Monitor closely and plan for restocking
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-5">
                                        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                                            <div className="card-body py-5">
                                                <i className="fas fa-check-circle fa-4x text-success mb-3"></i>
                                                <h5 className="text-success mb-2">All Clear!</h5>
                                                <p className="text-muted mb-4">All inventory levels are within normal ranges</p>
                                                <button 
                                                    className="btn btn-outline-primary"
                                                    onClick={() => {
                                                        setTabLoadingStates(prev => ({ ...prev, alerts: true }));
                                                        loadTabData('alerts');
                                                    }}
                                                    style={{ borderRadius: '8px' }}
                                                >
                                                    <FaSync className="me-2" />
                                                    Refresh Alerts
                                                </button>
                                            </div>
                                        </div>
                                    </div>
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
                                        const reportType = previewTitle.includes('Stock Levels') ? 'stock' : 
                                                         previewTitle.includes('Usage Trends') ? 'usage' :
                                                         previewTitle.includes('Replenishment') ? 'replenishment' : 'full';
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
                                            <small className="text-muted">UNICK Furniture - Inventory Report</small>
                                        </div>
                                    </div>
                                    <div className="ms-auto">
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-danger me-2"
                                            onClick={() => {
                                                const reportType = pdfPreviewTitle.includes('Stock Levels') ? 'stock' : 
                                                                 pdfPreviewTitle.includes('Usage Trends') ? 'usage' :
                                                                 pdfPreviewTitle.includes('Replenishment') ? 'replenishment' : 'full';
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
                                    title="PDF Preview"
                                ></iframe>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default EnhancedInventoryReports;
