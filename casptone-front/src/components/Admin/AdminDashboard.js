import React, { useEffect, useState, Suspense, lazy, useRef } from "react";
import api from "../../api/client";
import "./AdminDashboard.css";

// Lazy load analytics components
const KPICards = lazy(() => import("./Analytics/KPICards"));
const DailyOutputChart = lazy(() => import("./Analytics/DailyOutputChart"));
const TopProductsChart = lazy(() => import("./Analytics/TopProductsChart"));
const TopUsersChart = lazy(() => import("./Analytics/TopUsersChart"));
const TopStaffChart = lazy(() => import("./Analytics/TopStaffChart"));

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shouldLoadCharts, setShouldLoadCharts] = useState(false);
  const chartsRef = useRef(null);
  const hasFetchedRef = useRef(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    
    try {
      // Fetch order analytics
      let orderData = {
        pending_orders: 0,
        completed_orders: 0,
        total_sales_revenue: 0,
        completed_productions: 0,
        in_progress: 0
      };

      try {
        // Try to fetch order data from API
        const ordersResponse = await api.get('/orders');
        const orders = ordersResponse.data || [];
        
        // Fetch productions to get accurate counts
        let productionsResponse;
        let productions = [];
        try {
          productionsResponse = await api.get('/productions');
          productions = productionsResponse.data || [];
        } catch (prodError) {
          console.warn('Productions API not available:', prodError);
        }
        
        // Calculate order metrics - only pending orders that haven't been accepted
        const pendingOrders = orders.filter(order => 
          order.acceptance_status !== 'accepted' && 
          (order.status === 'pending' || order.acceptance_status === 'pending')
        ).length;
        
        const completedOrders = orders.filter(order => 
          order.status === 'completed' || order.status === 'delivered'
        ).length;
        
        const totalRevenue = orders
          .filter(order => order.payment_status === 'paid')
          .reduce((sum, order) => sum + parseFloat(order.total_price || 0), 0);
        
        // Calculate production metrics (only for table and chair, exclude alkansya)
        // Count unique completed orders that have completed productions to match "Completed Orders" count
        const completedProductionsWithOrders = productions.filter(prod => {
          const isCompleted = prod.status === 'Completed' && prod.product_type !== 'alkansya';
          if (!isCompleted || !prod.order_id) return false;
          
          const order = orders.find(o => o.id === prod.order_id);
          return order && (order.status === 'completed' || order.status === 'delivered');
        });
        
        // Count unique order IDs to match the "Completed Orders" count
        const uniqueCompletedOrderIds = new Set(
          completedProductionsWithOrders.map(prod => prod.order_id).filter(id => id)
        );
        const completedProductions = uniqueCompletedOrderIds.size;
        
        const inProgressProductions = productions.filter(prod => 
          prod.status === 'In Progress' && prod.product_type !== 'alkansya'
        ).length;
        
        orderData = {
          pending_orders: pendingOrders,
          completed_orders: completedOrders,
          total_sales_revenue: totalRevenue,
          completed_productions: completedProductions,
          in_progress: inProgressProductions
        };
      } catch (orderError) {
        console.warn('Order API not available, using zero values');
        orderData = {
          pending_orders: 0,
          completed_orders: 0,
          total_sales_revenue: 0,
          completed_productions: 0,
          in_progress: 0
        };
      }

      // Fetch production analytics data
      let productionData = {
        daily_output: [],
        top_products: [],
        top_users: [],
        top_staff: [],
        alkansya_stats: { total: 0, avg: 0 },
        furniture_stats: { total: 0, avg: 0 }
      };

      try {
        // Fetch production analytics from the correct endpoint that includes top_staff, top_products, top_users
        const productionResponse = await api.get('/productions/analytics');
        const productionAnalytics = productionResponse.data || {};
        
        // Use the data directly from the API response
        if (productionAnalytics.daily_output) {
          productionData.daily_output = productionAnalytics.daily_output || [];
          
          // Calculate alkansya and furniture stats from daily_output
          const alkansyaTotal = productionData.daily_output.reduce((sum, item) => sum + (item.alkansya || 0), 0);
          const furnitureTotal = productionData.daily_output.reduce((sum, item) => sum + (item.furniture || 0), 0);
          const daysWithData = productionData.daily_output.length || 1;
          
          productionData.alkansya_stats = {
            total: alkansyaTotal,
            avg: Math.round(alkansyaTotal / daysWithData)
          };
          
          productionData.furniture_stats = {
            total: furnitureTotal,
            avg: Math.round(furnitureTotal / daysWithData)
          };
        }
        
        // Get top products, top users, and top staff from the API response
        productionData.top_products = productionAnalytics.top_products || [];
        productionData.top_users = productionAnalytics.top_users || [];
        productionData.top_staff = productionAnalytics.top_staff || [];
        
      } catch (productionError) {
        console.warn('Production analytics API not available:', productionError);
        // Keep empty arrays for production data
      }
      
      // Transform the API response to match the expected dashboard structure
      const transformedData = {
        kpis: {
          total: productionData.alkansya_stats.total + productionData.furniture_stats.total,
          completed_productions: orderData.completed_productions,
          in_progress: orderData.in_progress,
          pending_orders: orderData.pending_orders,
          completed_orders: orderData.completed_orders,
          total_sales_revenue: orderData.total_sales_revenue
        },
        daily_output: productionData.daily_output,
        top_products: productionData.top_products,
        top_users: productionData.top_users,
        top_staff: productionData.top_staff
      };
      
      setAnalytics(transformedData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Set fallback data if all APIs fail
      setAnalytics({
        kpis: {
          total: 0,
          completed_productions: 0,
          in_progress: 0,
          pending_orders: 0,
          completed_orders: 0,
          total_sales_revenue: 0
        },
        daily_output: [],
        top_products: [],
        top_users: [],
        top_staff: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Prevent multiple fetches (especially in React StrictMode)
    if (hasFetchedRef.current) {
      return;
    }
    
    hasFetchedRef.current = true;
    let isMounted = true;
    
    const loadData = async () => {
      if (isMounted) {
        await fetchAnalytics();
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, []); // fetch on mount only - no auto-refresh

  // Intersection Observer for lazy loading charts
  useEffect(() => {
    if (!analytics || shouldLoadCharts) return;

    let observer = null;
    let fallbackTimer = null;

    // Start loading charts after analytics data is ready
    // Use a small delay to ensure smooth transition
    const timer = setTimeout(() => {
      if (chartsRef.current) {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                setShouldLoadCharts(true);
                if (observer) observer.disconnect();
              }
            });
          },
          {
            rootMargin: '100px', // Start loading 100px before the element is visible
            threshold: 0.1
          }
        );

        observer.observe(chartsRef.current);

        // Fallback: if element is already visible, load immediately
        if (chartsRef.current.getBoundingClientRect().top < window.innerHeight + 100) {
          setShouldLoadCharts(true);
          if (observer) observer.disconnect();
        }
      } else {
        // If ref is not set yet, load charts anyway after a short delay
        fallbackTimer = setTimeout(() => setShouldLoadCharts(true), 500);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (observer) observer.disconnect();
    };
  }, [analytics, shouldLoadCharts]);

  return (
    <div className="admin-dashboard-wrapper" style={{ minHeight: '100vh', backgroundColor: 'transparent' }}>
      {/* Simple Brown Header - Responsive */}
      <div className="admin-dashboard-header" style={{ 
        backgroundColor: '#8b5e34',
        padding: 'clamp(1rem, 2vw, 1.5rem) 0',
        marginBottom: 'clamp(1rem, 2vw, 2rem)'
      }}>
        <div className="container admin-dashboard-container" style={{ maxWidth: '1200px', paddingLeft: 'clamp(1rem, 3vw, 1.5rem)', paddingRight: 'clamp(1rem, 3vw, 1.5rem)' }}>
          <div className="d-flex justify-content-center align-items-center">
            <div className="text-center">
              <h1 className="fw-bold mb-0" style={{ 
                fontSize: 'clamp(1.25rem, 4vw, 2rem)',
                letterSpacing: '1px',
                color: '#ffffff',
                lineHeight: '1.2'
              }}>
                UNICK FURNITURE DASHBOARD
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics - Responsive Container */}
      <div className="container-fluid" style={{ maxWidth: '100%', padding: '0 clamp(1rem, 3vw, 1.5rem)' }}>
        {loading || !analytics ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color: '#8b5e34' }} role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="mt-3" style={{ fontSize: '0.9rem', color: '#6b4423' }}>
              {loading ? 'Loading analytics data...' : 'Preparing analytics...'}
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards - Load immediately */}
            <Suspense 
              fallback={
                <div className="text-center py-4">
                  <div className="spinner-border spinner-border-sm" style={{ color: '#8b5e34' }} role="status">
                    <span className="visually-hidden">Loading KPIs...</span>
                  </div>
                </div>
              }
            >
              <KPICards kpis={analytics?.kpis || {}} />
            </Suspense>

            {/* Charts Section - Lazy loaded with intersection observer */}
            <div ref={chartsRef} style={{ minHeight: '200px' }}>
              {shouldLoadCharts ? (
                <>
                  {/* Main Charts Row */}
                  <div className="row mt-4">
                    {/* Daily Output - Full Width */}
                    <div className="col-12 mb-4">
                      <Suspense 
                        fallback={
                          <div className="text-center py-4" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div>
                              <div className="spinner-border" style={{ color: '#8b5e34' }} role="status">
                                <span className="visually-hidden">Loading chart...</span>
                              </div>
                              <div className="mt-2" style={{ fontSize: '0.85rem', color: '#6b4423' }}>Loading daily output chart...</div>
                            </div>
                          </div>
                        }
                      >
                        <DailyOutputChart data={analytics?.daily_output || []} />
                      </Suspense>
                    </div>
                  </div>

                  {/* Secondary Charts Row - Responsive */}
                  <div className="row mb-4">
                    <div className="col-12 col-md-6 col-lg-4 mb-4">
                      <Suspense 
                        fallback={
                          <div className="text-center py-4" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div>
                              <div className="spinner-border spinner-border-sm" style={{ color: '#8b5e34' }} role="status">
                                <span className="visually-hidden">Loading...</span>
                              </div>
                              <div className="mt-2" style={{ fontSize: '0.85rem', color: '#6b4423' }}>Loading staff chart...</div>
                            </div>
                          </div>
                        }
                      >
                        <TopStaffChart data={analytics?.top_staff || []} />
                      </Suspense>
                    </div>
                    <div className="col-12 col-md-6 col-lg-4 mb-3 mb-md-4">
                      <Suspense 
                        fallback={
                          <div className="text-center py-4" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div>
                              <div className="spinner-border spinner-border-sm" style={{ color: '#8b5e34' }} role="status">
                                <span className="visually-hidden">Loading...</span>
                              </div>
                              <div className="mt-2" style={{ fontSize: '0.85rem', color: '#6b4423' }}>Loading products chart...</div>
                            </div>
                          </div>
                        }
                      >
                        <TopProductsChart data={analytics?.top_products || []} />
                      </Suspense>
                    </div>
                    <div className="col-12 col-md-6 col-lg-4 mb-3 mb-md-4">
                      <Suspense 
                        fallback={
                          <div className="text-center py-4" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div>
                              <div className="spinner-border spinner-border-sm" style={{ color: '#8b5e34' }} role="status">
                                <span className="visually-hidden">Loading...</span>
                              </div>
                              <div className="mt-2" style={{ fontSize: '0.85rem', color: '#6b4423' }}>Loading users chart...</div>
                            </div>
                          </div>
                        }
                      >
                        <TopUsersChart data={analytics?.top_users || []} />
                      </Suspense>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-5" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div>
                    <div className="spinner-border" style={{ color: '#8b5e34' }} role="status">
                      <span className="visually-hidden">Preparing charts...</span>
                    </div>
                    <div className="mt-3" style={{ fontSize: '0.9rem', color: '#6b4423' }}>Preparing analytics charts...</div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
