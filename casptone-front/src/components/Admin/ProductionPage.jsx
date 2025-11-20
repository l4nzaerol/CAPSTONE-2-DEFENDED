import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AppLayout, { useSidebar } from "../Header";
import { toast } from "sonner";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import api from "../../api/client";
import Pusher from "pusher-js";

// Simple CSV export helper
const toCSV = (rows, columns) => {
  const header = columns.join(",");
  const lines = rows.map((r) => columns.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","));
  return [header, ...lines].join("\n");
};

const STAGES = [
  "Material Preparation",
  "Cutting & Shaping",
  "Assembly",
  "Sanding & Surface Preparation",
  "Finishing",
  "Quality Check & Packaging"
];
const COLORS = ["#f39c12", "#2980b9", "#8e44ad", "#27ae60"];

const authHeaders = () => ({});

// Helper function to get stage descriptions
const getStageDescription = (stageName) => {
  const descriptions = {
    "Material Preparation": "Selecting and preparing high-quality wood materials, checking inventory, and organizing materials for production.",
    "Cutting & Shaping": "Cutting wood pieces to precise measurements and shaping components according to design specifications.",
    "Assembly": "Joining and assembling all components together, ensuring structural integrity and proper alignment.",
    "Sanding & Surface Preparation": "Smoothing all surfaces, removing imperfections, and preparing the furniture for finishing treatments.",
    "Finishing": "Applying stains, varnish, or paint to protect and enhance the wood's natural beauty.",
    "Quality Check & Packaging": "Thorough inspection for quality assurance, final touch-ups, and careful packaging for delivery."
  };
  return descriptions[stageName] || "Production process in progress";
};

export default function ProductionTrackingSystem() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMinimized } = useSidebar();
  const [productions, setProductions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true); // Separate loading for data
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("current"); // 'current', 'ready', 'alkansya', 'completion', 'analytics'
  const [analyticsData, setAnalyticsData] = useState({
    stage_breakdown: [],
    kpis: {},
    daily_output: [],
    resource_allocation: [],
    stage_workload: []
  });
  
  // Delay tracking modal state
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayModalData, setDelayModalData] = useState({
    productionId: null,
    processId: null,
    processName: '',
    delayReason: '',
    estimatedEndDate: null,
    actualCompletionDate: null
  });
  
  // Remarks modal state for all process completions
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [remarksModalData, setRemarksModalData] = useState({
    productionId: null,
    processId: null,
    processName: '',
    remarks: '',
    isDelayed: false
  });
  
  // Loading state for submit button
  const [isSubmittingRemarks, setIsSubmittingRemarks] = useState(false);
  
  // Current time state for real-time delay detection
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every 10 seconds for real-time delay detection
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      console.log('Time updated for delay detection:', new Date().toISOString());
    }, 10000); // Update every 10 seconds
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Load data lazily after page structure loads
    const timer = setTimeout(() => {
      fetchProductions();
      fetchAnalytics();
    }, 100);
    
    // Setup realtime updates via Pusher
    let pusher = null;
    try {
      const pusherKey = process.env.REACT_APP_PUSHER_KEY || "";
      const cluster = process.env.REACT_APP_PUSHER_CLUSTER || "mt1";
      if (pusherKey) {
        pusher = new Pusher(pusherKey, { cluster });
        const channel = pusher.subscribe("production-channel");
        const handler = () => {
          fetchProductions();
          fetchAnalytics();
        };
        channel.bind("production-updated", handler);
        channel.bind("production-process-updated", handler);
      }
    } catch (e) {
      console.warn("Pusher setup failed", e);
    }
    
    return () => {
      clearTimeout(timer);
      if (pusher) {
        pusher.unsubscribe("production-channel");
        pusher.disconnect();
      }
    };
  }, []);

  // Read URL parameters and set filters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const status = searchParams.get('status');
    if (status) {
      setStatusFilter(status);
      // If status is 'completed', also set the active tab to 'completed'
      if (status === 'completed') {
        setActiveTab('completed');
      }
    }
  }, [location.search]);

  useEffect(() => {
    applyFilters();
  }, [productions, statusFilter]);

  const fetchProductions = async () => {
    setDataLoading(true);
    setError("");
    try {
      const token = localStorage.getItem('token');
      console.log('Token exists:', !!token);
      
      const res = await api.get(`/productions`);
      const data = res.data || [];
      console.log('Productions fetched:', data.length);
      console.log('First production BOM:', data[0]?.bom);
      console.log('First production current_process:', data[0]?.current_process);
      setProductions(data);
      setFiltered(data);
    } catch (err) {
      console.error("Fetch error:", err);
      
      if (err.response?.status === 401) {
        setError("Session expired. Please login again.");
        // Redirect to login after 2 seconds
        setTimeout(() => {
          localStorage.clear();
          navigate('/');
        }, 2000);
      } else {
        setError("Failed to load production data. Please check your API endpoint and authentication.");
      }
    } finally {
      setDataLoading(false);
    }
  };

  const markOrderReadyForDelivery = async (orderId) => {
    try {
      console.log('Marking order as ready for delivery:', orderId);
      
      // Check production completion status first
      const productionStatus = await api.get(`/orders/${orderId}/production-status`);
      
      if (!productionStatus.data.isCompleted) {
        toast.error("❌ Cannot Mark as Ready for Delivery", {
          description: productionStatus.data.message,
          duration: 5000,
          style: {
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#dc2626'
          }
        });
        return;
      }
      
      const response = await api.put(`/orders/${orderId}/ready-for-delivery`);
      console.log('Response:', response.data);
      
      toast.success("✅ Order Ready for Delivery!", {
        description: "Order has been marked as ready for delivery. Customer will be notified.",
        duration: 4000,
        style: {
          background: '#f0fdf4',
          border: '1px solid #86efac',
          color: '#166534'
        }
      });
      
      await fetchProductions();
      await fetchAnalytics();
    } catch (err) {
      console.error('Ready for delivery error:', err);
      console.error('Error details:', err.response?.data);
      
      const errorMsg = err.response?.data?.message || 'Failed to mark order as ready for delivery';
      setError(errorMsg);
      toast.error("❌ Ready for Delivery Failed", {
        description: errorMsg,
        duration: 5000,
        style: {
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626'
        }
      });
    }
  };

  const markOrderDelivered = async (orderId) => {
    try {
      console.log('Marking order as delivered:', orderId);
      const response = await api.put(`/orders/${orderId}/delivered`);
      console.log('Response:', response.data);
      
      toast.success("✅ Order Delivered!", {
        description: "Order has been marked as delivered. Customer will be notified.",
        duration: 4000,
        style: {
          background: '#f0fdf4',
          border: '1px solid #86efac',
          color: '#166534'
        }
      });
      
      await fetchProductions();
      await fetchAnalytics();
    } catch (err) {
      console.error('Mark delivered error:', err);
      console.error('Error details:', err.response?.data);
      
      const errorMsg = err.response?.data?.message || 'Failed to mark order as delivered';
      setError(errorMsg);
      toast.error("❌ Delivery Marking Failed", {
        description: errorMsg,
        duration: 5000,
        style: {
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626'
        }
      });
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await api.get(`/productions/analytics`);
      const data = res.data || {};
      console.log('Analytics data:', data);
      
      // Store analytics data
      setAnalyticsData({
        stage_breakdown: data.stage_breakdown || [],
        kpis: data.kpis || {},
        daily_output: data.daily_output || [],
        resource_allocation: data.resource_allocation || [],
        stage_workload: data.stage_workload || []
      });
      
      // Debug logging
      console.log('Analytics data received:', data);
      console.log('Stage breakdown:', data.stage_breakdown);
      console.log('Stage workload:', data.stage_workload);
      
      // Update suggestions with real analytics data
      // IMPORTANT: Always ensure ALL 6 stages are included, even if API doesn't return them
      const defaultCapacities = { 
        "Material Preparation": 3, 
        "Cutting & Shaping": 4, 
        "Assembly": 5, 
        "Sanding & Surface Preparation": 3, 
        "Finishing": 3, 
        "Quality Check & Packaging": 2 
      };
      
      // Start with all 6 stages as defaults
      const stageMap = new Map();
      STAGES.forEach(stage => {
        stageMap.set(stage, {
          stage: stage,
          capacity: defaultCapacities[stage] || 3,
          assigned: [],
          queued: 0,
          utilization: 0,
          status: 'available',
          message: `${stage} has 0 items (0% capacity)`,
          priority: 'low'
        });
      });
      
      // Update with stage workload data from API (primary source)
      if (data.stage_workload && data.stage_workload.length > 0) {
        data.stage_workload.forEach(workload => {
          if (stageMap.has(workload.stage)) {
            const existing = stageMap.get(workload.stage);
            stageMap.set(workload.stage, {
              ...existing,
              capacity: workload.capacity || existing.capacity,
              queued: workload.current_workload || 0,
              utilization: workload.utilization_percentage || ((workload.current_workload || 0) / (workload.capacity || existing.capacity)) * 100,
              status: workload.status || (workload.current_workload > workload.capacity ? 'overloaded' : 'available'),
              message: `${workload.stage} workload: ${workload.current_workload || 0}/${workload.capacity || existing.capacity} (${Math.round(workload.utilization_percentage || ((workload.current_workload || 0) / (workload.capacity || existing.capacity)) * 100)}%)`,
              priority: workload.current_workload > workload.capacity ? 'high' : (workload.current_workload > (workload.capacity || existing.capacity) * 0.7 ? 'medium' : 'low')
            });
          }
        });
      }
      
      // Update with resource allocation data if available
      if (data.resource_allocation && data.resource_allocation.length > 0) {
        data.resource_allocation.forEach(allocation => {
          if (stageMap.has(allocation.stage)) {
            const existing = stageMap.get(allocation.stage);
            stageMap.set(allocation.stage, {
              ...existing,
              queued: allocation.workload || existing.queued,
              utilization: allocation.workload ? ((allocation.workload || 0) / existing.capacity) * 100 : existing.utilization,
              status: allocation.priority === 'high' ? 'overloaded' : (allocation.priority === 'medium' ? 'busy' : existing.status),
              message: allocation.message || existing.message,
              priority: allocation.priority || existing.priority
            });
          }
        });
      }
      
      // Convert map to array and ensure all 6 stages are present
      const newSuggestions = Array.from(stageMap.values());
      
      // Sort by priority but keep all 6
      const sortedSuggestions = newSuggestions.sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;
        if (a.priority === 'medium' && b.priority === 'low') return -1;
        if (a.priority === 'low' && b.priority === 'medium') return 1;
        return 0;
      });
      
      setSuggestions(sortedSuggestions);
    } catch (err) {
      console.error("Analytics fetch error:", err);
    }
  };

  const applyFilters = () => {
    let data = [...productions];
    
    if (statusFilter !== "all") {
      data = data.filter((p) => p.status === statusFilter);
    }
    
    console.log('Filtered data:', data); // Debug log
    setFiltered(data);
  };

  // Derived data for charts - only show stages with active production
  const stageData = useMemo(() => {
    console.log('Calculating stageData:', { analyticsData, productions });
    
    // Use analytics data if available, otherwise fallback to local data
    if (analyticsData.stage_breakdown && analyticsData.stage_breakdown.length > 0) {
      const result = analyticsData.stage_breakdown
        .filter(stage => stage.value > 0) // Only show stages with active production
        .map(stage => ({
          name: stage.name,
          value: stage.value
        }));
      console.log('Using analytics stage data:', result);
      return result;
    }
    
    // Fallback to local productions data - only show stages with active production
    const fallbackResult = STAGES.map((stage) => ({
      name: stage,
      value: productions.filter((p) => (p.current_stage || p.stage) === stage && p.status === 'In Progress').length
    })).filter(stage => stage.value > 0); // Only show stages with active production
    console.log('Using fallback stage data:', fallbackResult);
    return fallbackResult;
  }, [analyticsData.stage_breakdown, productions]);

  const dailyOutput = useMemo(() => {
    // Group production by date and product (Wooden Chair and Dining Table only)
    const map = {};
    
    productions
      .filter(p => p.product_name === 'Wooden Chair' || p.product_name === 'Dining Table')
      .forEach((p) => {
        const d = p.date ? new Date(p.date).toISOString().split("T")[0] : "unknown";
        if (!map[d]) {
          map[d] = { 
            date: d, 
            'Wooden Chair': 0, 
            'Dining Table': 0 
          };
        }
        
        if (p.product_name === 'Wooden Chair') {
          map[d]['Wooden Chair'] += Number(p.quantity || 0);
        } else if (p.product_name === 'Dining Table') {
          map[d]['Dining Table'] += Number(p.quantity || 0);
        }
      });
    
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [productions]);

  // Suggest resource allocation based on actual production data
  const computeSuggestions = () => {
    const capacities = { 
      "Material Preparation": 3, 
      "Cutting & Shaping": 4, 
      "Assembly": 5, 
      "Sanding & Surface Preparation": 3, 
      "Finishing": 3, 
      "Quality Check & Packaging": 2 
    };
    
    // Get all productions (including completed ones for accurate tracking)
    const allProductions = productions || [];
    const pending = allProductions.filter((p) => p.status === "In Progress" || p.status === "Pending");
    const byStage = STAGES.reduce((acc, s) => ({ ...acc, [s]: pending.filter((p) => (p.current_stage || p.stage) === s) }), {});

    // Ensure ALL 6 stages are always included, even if no productions exist
    const alloc = [];
    STAGES.forEach((s) => {
      const queue = byStage[s] || [];
      const cap = capacities[s] || 1;
      const currentWorkload = queue.length;
      const utilization = (currentWorkload / cap) * 100;
      
      alloc.push({ 
        stage: s, 
        capacity: cap, 
        assigned: [], 
        queued: currentWorkload,
        utilization: utilization,
        status: utilization > 90 ? 'overloaded' : (utilization > 70 ? 'busy' : 'available'),
        message: utilization > 90 ? `Stage '${s}' is overloaded with ${currentWorkload} items` : 
                 utilization > 70 ? `Stage '${s}' is busy with ${currentWorkload} items` : 
                 `Stage '${s}' has ${currentWorkload} items (${Math.round(utilization)}% capacity)`,
        priority: utilization > 90 ? 'high' : (utilization > 70 ? 'medium' : 'low')
      });
    });

    // Sort by priority (high priority first) but ensure all 6 are shown
    const sortedAlloc = alloc.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      if (a.priority === 'medium' && b.priority === 'low') return -1;
      if (a.priority === 'low' && b.priority === 'medium') return 1;
      return 0;
    });

    setSuggestions(sortedAlloc);
  };

  useEffect(() => {
    // Always compute suggestions to show all 6 processes, even if no productions
    // This ensures all 6 stages are shown even if fetchAnalytics hasn't run yet
    computeSuggestions();
  }, [productions]);
  
  // Also ensure suggestions are computed when component mounts
  useEffect(() => {
    if (suggestions.length === 0) {
      computeSuggestions();
    }
  }, []);

  const updateStage = async (id, newStage) => {
    try {
      console.log(`Updating production ${id} to stage: ${newStage}`);
      const res = await api.patch(`/productions/${id}`, { stage: newStage });
      const updated = res.data;
      setProductions((prev) => prev.map((p) => (p.id === id ? updated : p)));
      // Immediately refresh analytics so charts and workload reflect the new stage
      fetchAnalytics();
      console.log('Stage update successful:', updated);
    } catch (err) {
      console.error("Update stage error:", err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Failed to update production stage";
      setError(errorMessage);
      
      // Log detailed error for debugging
      if (err.response?.data?.errors) {
        console.error("Validation errors:", err.response.data.errors);
      }
    }
  };

  const handleProcessStatusChange = async (productionId, processId, processName, currentStatus, estimatedEndDate) => {
    try {
      console.log('=== PROCESS STATUS CHANGE TRIGGERED ===');
      console.log('Current Status:', currentStatus);
      console.log('Estimated End Date:', estimatedEndDate);
      
      // If marking as complete, show remarks modal
      if (currentStatus !== 'completed') {
        const now = new Date(); // Always get fresh current time
        const estimatedEnd = estimatedEndDate ? new Date(estimatedEndDate) : null;
        
        console.log('Delay Check:', {
          processName,
          now: now.toISOString(),
          nowTime: now.getTime(),
          estimatedEnd: estimatedEnd?.toISOString(),
          estimatedEndTime: estimatedEnd?.getTime(),
          isDelayed: estimatedEnd && now > estimatedEnd,
          timeDiff: estimatedEnd ? (now.getTime() - estimatedEnd.getTime()) : 'N/A'
        });
        
        const isDelayed = estimatedEnd && now > estimatedEnd;
        
        // Always show remarks modal for completion
        console.log('Showing remarks modal for process completion');
        
        setRemarksModalData({
          productionId,
          processId,
          processName,
          remarks: '',
          isDelayed: isDelayed
        });
        
        if (isDelayed) {
          // If also delayed, show delay modal first
          setDelayModalData({
            productionId,
            processId,
            processName,
            delayReason: '',
            estimatedEndDate: estimatedEnd,
            actualCompletionDate: now
          });
          setShowDelayModal(true);
        } else {
          setShowRemarksModal(true);
        }
        
        return; // Wait for modal submission
      }
      
      // If undoing (marking as pending), just update without remarks
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      await completeProcessUpdate(productionId, processId, processName, newStatus, null);
      
    } catch (err) {
      console.error("Update process error:", err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Failed to update process status";
      setError(errorMessage);
      
      // Refresh to revert UI state
      await fetchProductions();
    }
  };
  
  const completeProcessUpdate = async (productionId, processId, processName, newStatus, delayInfo, remarks = null) => {
    try {
      console.log(`Updating process ${processId} of production ${productionId} to status: ${newStatus}`);
      
      const payload = { 
        status: newStatus,
        ...(delayInfo && {
          delay_reason: delayInfo.reason,
          is_delayed: true,
          actual_completion_date: delayInfo.actualCompletionDate?.toISOString()
        }),
        ...(remarks && { remarks: remarks })
      };
      
      console.log('=== PAYLOAD BEING SENT ===');
      console.log('URL:', `/productions/${productionId}/processes/${processId}`);
      console.log('Payload:', JSON.stringify(payload, null, 2));
      console.log('Has delay info:', !!delayInfo);
      
      const res = await api.patch(`/productions/${productionId}/processes/${processId}`, payload);
      
      console.log('Process update response:', res.data);
      
      // Show success toast notification immediately
      if (newStatus === 'completed') {
        toast.success(`✅ "${processName}" completed successfully!`, {
          duration: 3000,
          position: 'top-right'
        });
      } else {
        toast.info(`🔄 "${processName}" marked as pending`, {
          duration: 3000,
          position: 'top-right'
        });
      }
      
      // Refresh productions to get updated data
      await fetchProductions();
      await fetchAnalytics();
      setError('');
      
    } catch (err) {
      console.error("Update process error:", err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Failed to update process status";
      setError(errorMessage);
      throw err;
    }
  };
  
  const handleRemarksModalSubmit = async () => {
    if (!remarksModalData.remarks.trim()) {
      toast.warning("⚠️ Remarks Required", {
        description: "Please provide remarks for the process completion.",
        duration: 3000,
        style: {
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          color: '#92400e'
        }
      });
      return;
    }
    
    console.log('=== SUBMITTING REMARKS MODAL ===');
    console.log('Remarks:', remarksModalData.remarks);
    console.log('Production ID:', remarksModalData.productionId);
    console.log('Process ID:', remarksModalData.processId);
    
    // Set loading state
    setIsSubmittingRemarks(true);
    
    try {
      // Include delay info if this was a delayed process
      const delayInfo = remarksModalData.isDelayed && delayModalData ? {
        reason: delayModalData.delayReason,
        actualCompletionDate: delayModalData.actualCompletionDate
      } : null;
      
      await completeProcessUpdate(
        remarksModalData.productionId,
        remarksModalData.processId,
        remarksModalData.processName,
        'completed',
        delayInfo,
        remarksModalData.remarks
      );
      
      console.log('✅ Process completed with remarks');
      
      // Get order number for display before closing modal
      const production = productions.find(p => p.id === remarksModalData.productionId);
      const orderNumber = production?.order_id ? ` - Order #${production.order_id}` : '';
      
      // Store process name for toast before clearing state
      const processName = remarksModalData.processName;
      
      // Close the modal
      setShowRemarksModal(false);
      
      // Show success toast with process name and order number
      toast.success(`✅ ${processName} Completed${orderNumber}`, {
        duration: 2000,
        position: 'top-right',
        style: {
          background: '#f0fdf4',
          border: '1px solid #86efac',
          color: '#166534'
        }
      });
      
      // Reset modal data
      setRemarksModalData({
        productionId: null,
        processId: null,
        processName: '',
        remarks: '',
        isDelayed: false
      });
      
      // Reset loading state
      setIsSubmittingRemarks(false);
      
      // Refresh data
      await fetchProductions();
      await fetchAnalytics();
      
    } catch (err) {
      console.error('❌ Error in remarks modal submit:', err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unknown error';
      
      // Reset loading state on error
      setIsSubmittingRemarks(false);
      
      toast.error("❌ Submission Failed", {
        description: `Failed to submit remarks: ${errorMsg}`,
        duration: 5000,
        style: {
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626'
        }
      });
    }
  };

  const handleDelayModalSubmit = async () => {
    if (!delayModalData.delayReason.trim()) {
      toast.warning("⚠️ Delay Reason Required", {
        description: "Please provide a reason for the delay.",
        duration: 3000,
        style: {
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          color: '#92400e'
        }
      });
      return;
    }
    
    console.log('=== SUBMITTING DELAY MODAL ===');
    console.log('Delay Reason:', delayModalData.delayReason);
    console.log('Production ID:', delayModalData.productionId);
    console.log('Process ID:', delayModalData.processId);
    
    try {
      // Store delay reason in remarks modal data first
      setRemarksModalData({
        productionId: delayModalData.productionId,
        processId: delayModalData.processId,
        processName: delayModalData.processName,
        remarks: '', // User will still need to provide general remarks
        isDelayed: true
      });
      
      // Close delay modal and show remarks modal
      setShowDelayModal(false);
      setShowRemarksModal(true);
      
      // Store delay reason temporarily for later submission
      // We'll combine it with remarks
      
    } catch (err) {
      console.error('❌ Error handling delay modal:', err);
    }
  };

  const bulkExportCSV = () => {
    const columns = ["id", "product_name", "date", "stage", "status", "quantity", "resources_used", "notes"];
    const rows = filtered.map((r) => ({
      ...r,
      resources_used: typeof r.resources_used === "object" ? JSON.stringify(r.resources_used) : r.resources_used,
    }));

    const csv = toCSV(rows, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `productions_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const bulkExportPDF = () => {
    // Simple text-based export for demonstration
    const content = filtered.map(r => 
      `ID: ${r.id}, Product: ${r.product_name}, Date: ${r.date}, Stage: ${r.stage}, Status: ${r.status}, Quantity: ${r.quantity}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `productions_report_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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
                  <h2 className="mb-1 fw-bold" id="prod-track-heading">Unick Production Tracking</h2>
                  <p className="text-muted mb-0">Monitor and manage production processes in real-time</p>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-light" onClick={() => navigate("/dashboard")} style={{ borderRadius: '8px' }}>
                    <i className="fas fa-arrow-left me-2"></i>
                    Dashboard
                  </button>
                  {dataLoading ? (
                    <button className="btn btn-primary" disabled style={{ borderRadius: '8px' }}>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Loading...
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => { setCurrentTime(new Date()); fetchProductions(); }} style={{ borderRadius: '8px' }}>
                      <i className="fas fa-sync-alt me-2"></i>
                      Refresh
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError("")}></button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
            <div className="card-body p-0">
              <div className="d-flex" style={{ borderBottom: '2px solid #dee2e6' }}>
                <button 
                  className={`btn btn-lg ${activeTab === 'current' ? 'text-primary fw-bold' : 'text-dark'} border-0 py-3`}
                  onClick={() => setActiveTab('current')}
                  style={{ 
                    borderBottom: activeTab === 'current' ? '3px solid #0d6efd' : 'none',
                    marginBottom: activeTab === 'current' ? '-2px' : '0',
                    transition: 'all 0.3s ease',
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content'
                  }}
                >
                  <i className="fas fa-cogs me-2" style={{ color: activeTab === 'current' ? '#0d6efd' : '#6c757d', fontSize: '20px' }}></i>
                  Current Production
                </button>
                <button 
                  className={`btn btn-lg ${activeTab === 'ready' ? 'text-danger fw-bold' : 'text-dark'} border-0 py-3 position-relative`}
                  onClick={() => setActiveTab('ready')}
                  style={{ 
                    borderBottom: activeTab === 'ready' ? '3px solid #dc3545' : 'none',
                    marginBottom: activeTab === 'ready' ? '-2px' : '0',
                    transition: 'all 0.3s ease',
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content'
                  }}
                >
                  <i className="fas fa-truck me-2" style={{ color: activeTab === 'ready' ? '#dc3545' : '#6c757d', fontSize: '20px' }}></i>
                  Ready To Deliver
                  <span 
                    className="badge bg-danger position-absolute top-0 end-0 ms-2" 
                    style={{ 
                      fontSize: '0.7rem',
                      transform: 'translateX(10px)'
                    }}
                  >
                    {filtered.filter(p => 
                      p.status === 'Completed' && 
                      p.overall_progress >= 100 && 
                      p.product_type !== 'alkansya' &&
                      p.order?.status !== 'ready_for_delivery' && 
                      p.order?.status !== 'delivered'
                    ).length}
                  </span>
                </button>
                <button 
                  className={`btn btn-lg ${activeTab === 'completed' ? 'text-success fw-bold' : 'text-dark'} border-0 py-3 position-relative`}
                  onClick={() => setActiveTab('completed')}
                  style={{ 
                    borderBottom: activeTab === 'completed' ? '3px solid #198754' : 'none',
                    marginBottom: activeTab === 'completed' ? '-2px' : '0',
                    transition: 'all 0.3s ease',
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content'
                  }}
                >
                  <i className="fas fa-check-circle me-2" style={{ color: activeTab === 'completed' ? '#198754' : '#6c757d', fontSize: '20px' }}></i>
                  Completed
                  <span 
                    className="badge bg-success position-absolute top-0 end-0 ms-2" 
                    style={{ 
                      fontSize: '0.7rem',
                      transform: 'translateX(10px)'
                    }}
                  >
                    {filtered.filter(p => 
                      p.status === 'Completed' && 
                      p.product_type !== 'alkansya'
                    ).length}
                  </span>
                </button>
                <button 
                  className={`btn btn-lg ${activeTab === 'completion' ? 'text-warning fw-bold' : 'text-dark'} border-0 py-3`}
                  onClick={() => setActiveTab('completion')}
                  style={{ 
                    borderBottom: activeTab === 'completion' ? '3px solid #ffc107' : 'none',
                    marginBottom: activeTab === 'completion' ? '-2px' : '0',
                    transition: 'all 0.3s ease',
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content'
                  }}
                >
                  <i className="fas fa-exclamation-triangle me-2" style={{ color: activeTab === 'completion' ? '#ffc107' : '#6c757d', fontSize: '20px' }}></i>
                  Process Completion
                </button>
                <button 
                  className={`btn btn-lg ${activeTab === 'analytics' ? 'text-info fw-bold' : 'text-dark'} border-0 py-3`}
                  onClick={() => setActiveTab('analytics')}
                  style={{ 
                    borderBottom: activeTab === 'analytics' ? '3px solid #0dcaf0' : 'none',
                    marginBottom: activeTab === 'analytics' ? '-2px' : '0',
                    transition: 'all 0.3s ease',
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content'
                  }}
                >
                  <i className="fas fa-chart-line me-2" style={{ color: activeTab === 'analytics' ? '#0dcaf0' : '#6c757d', fontSize: '20px' }}></i>
                  Production Summary
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Current Production Tab */}
      {activeTab === 'current' && (
        <div className="row">
        {/* Current Production Processes - Full Width */}
        <div className="col-12">
          <div className="card h-100 shadow-sm">
            <div className="card-header bg-primary text-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  <i className="fas fa-cogs me-2"></i>
                  Current Production Processes 
                  <span className="badge bg-light text-primary ms-2">{filtered.filter(p => p.status === 'In Progress').length}</span>
                </h5>
                <div className="d-flex gap-2 align-items-center">
                  <small className="text-muted">
                    <i className="fas fa-clock me-1"></i>
                    Updated: {currentTime.toLocaleTimeString()}
                  </small>
                  <button className="btn btn-light btn-sm" onClick={() => { setCurrentTime(new Date()); fetchProductions(); }}>
                    <i className="fas fa-sync-alt me-1"></i> Refresh
                  </button>
                </div>
              </div>
            </div>
            <div className="card-body">
              
              {loading && (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <div className="mt-2 text-muted">Loading productions...</div>
                </div>
              )}
              
              {!loading && filtered.filter(p => p.status === 'In Progress').length === 0 && (
                <div className="text-center py-4 text-muted">
                  <i className="fas fa-cogs fa-3x mb-3"></i>
                  <div>No production processes currently in progress.</div>
                  <div className="small">All items are either completed, pending, or on hold.</div>
                  <button className="btn btn-outline-primary mt-2" onClick={fetchProductions}>
                    Refresh Data
                  </button>
                </div>
              )}
              
              <div className="timeline-list">
                {filtered.filter(p => p.status === 'In Progress').map((prod, prodIndex) => {
                  // Calculate estimated completion dates for each process
                  const calculateEstimatedDates = () => {
                    let currentDate = prod.date ? new Date(prod.date) : new Date();
                    return prod.processes?.map((pr, idx) => {
                      if (pr.completed_at) {
                        return { start: pr.started_at, end: pr.completed_at };
                      }
                      
                      // For pending processes, check if previous process is completed
                      if (idx > 0) {
                        const prevProcess = prod.processes[idx - 1];
                        if (prevProcess.completed_at) {
                          // Start from when previous process was completed
                          currentDate = new Date(prevProcess.completed_at);
                        }
                      }
                      
                      const startDate = pr.started_at ? new Date(pr.started_at) : new Date(currentDate);
                      const endDate = new Date(startDate);
                      endDate.setMinutes(endDate.getMinutes() + (pr.estimated_duration_minutes || 0));
                      currentDate = endDate;
                      return { start: startDate, end: endDate };
                    }) || [];
                  };
                  
                  const estimatedDates = calculateEstimatedDates();
                  // Calculate total estimated days correctly - sum all minutes first, then convert
                  const totalEstimatedMinutes = prod.processes?.reduce((sum, pr) => {
                    return sum + (pr.estimated_duration_minutes || 0);
                  }, 0) || 0;
                  const totalEstimatedDays = Math.ceil(totalEstimatedMinutes / (60 * 24));
                  
                  // Calculate final estimated completion date
                  const finalProcess = prod.processes?.[prod.processes.length - 1];
                  const finalEstimatedDate = estimatedDates[estimatedDates.length - 1]?.end;
                  
                  return (
                  <div 
                    key={prod.id} 
                    className="card mb-4 shadow border" 
                    style={{ 
                      overflow: 'hidden',
                      backgroundColor: prodIndex % 2 === 0 ? '#ffffff' : '#f8f9fa',
                      borderRadius: '12px',
                      borderColor: prodIndex % 2 === 0 ? '#dee2e6' : '#adb5bd'
                    }}
                  >
                    {/* Minimalist Header */}
                    <div 
                      className="card-header border-bottom py-3" 
                      style={{ 
                        backgroundColor: prodIndex % 2 === 0 ? '#ffffff' : '#f8f9fa',
                        borderLeft: '5px solid #0d6efd'
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="text-muted small mb-1">
                            <i className="fas fa-calendar-alt me-1"></i>
                            {prod.date ? new Date(prod.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : "No date"}
                          </div>
                          <h5 className="mb-1 fw-bold">{prod.product_name}</h5>
                          <div className="text-muted small">
                            <span className="me-3"><i className="fas fa-box me-1"></i>Qty: <strong>{prod.quantity || 0}</strong></span>
                            <span className="me-3"><i className="fas fa-barcode me-1"></i>Prod ID: <strong>{prod.id}</strong></span>
                            {prod.order_id && (
                              <span className="text-primary fw-bold"><i className="fas fa-shopping-cart me-1"></i>Order #{prod.order_id}</span>
                            )}
                          </div>
                          {prod.order?.user?.name && (
                            <div className="text-muted small mt-1">
                              <i className="fas fa-user me-1"></i>Customer: <strong>{prod.order.user.name}</strong>
                            </div>
                          )}
                        </div>
                        <div className="text-end">
                          <span className={`badge fs-6 px-3 py-2 ${
                            prod.status === "Completed" ? "bg-success" : 
                            prod.status === "Hold" ? "bg-warning text-dark" : 
                            prod.status === "In Progress" ? "bg-primary" : "bg-secondary"
                          }`}>
                            {prod.status}
                          </span>
                          <div className="mt-2">
                            <div className="small text-muted">
                              <i className="fas fa-tasks me-1"></i>
                              {prod.processes?.filter(p => p.status === 'completed').length || 0} / {prod.processes?.length || 0} Complete
                            </div>
                            <div className="small text-muted mt-1">
                              <i className="fas fa-hourglass-half me-1"></i>
                              Estimated Completion: <strong>{totalEstimatedDays} days</strong>
                            </div>
                            {finalEstimatedDate && (
                              <div className="small mt-1">
                                <span className="badge bg-info text-white">
                                  <i className="fas fa-flag-checkered me-1"></i>
                                  Target: {new Date(finalEstimatedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Minimalist Process List */}
                    <div className="card-body p-0">
                      {Array.isArray(prod.processes) && prod.processes.length > 0 && (
                        <div className="list-group list-group-flush">
                          {prod.processes
                            .sort((a, b) => {
                              // Sort by status: in_progress first, then pending, then completed
                              const statusOrder = { 'in_progress': 0, 'pending': 1, 'completed': 2 };
                              const aOrder = statusOrder[a.status] ?? 3;
                              const bOrder = statusOrder[b.status] ?? 3;
                              
                              if (aOrder !== bOrder) {
                                return aOrder - bOrder;
                              }
                              
                              // If same status, sort by process_order
                              return (a.process_order || 0) - (b.process_order || 0);
                            })
                            .map((pr, index) => {
                            const estimatedDays = Math.floor(pr.estimated_duration_minutes / (60 * 24));
                            const estimatedHours = Math.floor((pr.estimated_duration_minutes % (60 * 24)) / 60);
                            const isCompleted = pr.status === 'completed';
                            const isInProgress = pr.status === 'in_progress';
                            
                            // Check if this process can be completed (only first pending process)
                            const allProcesses = prod.processes || [];
                            const completedProcesses = allProcesses.filter(p => p.status === 'completed');
                            const currentProcessOrder = pr.process_order || 0;
                            const previousProcess = allProcesses.find(p => p.process_order === currentProcessOrder - 1);
                            const canBeCompleted = isCompleted || isInProgress || 
                              (pr.status === 'pending' && (!previousProcess || previousProcess.status === 'completed'));
                            
                            // Calculate actual duration for completed processes
                            let actualDuration = null;
                            if (isCompleted && pr.started_at && pr.completed_at) {
                              const startTime = new Date(pr.started_at);
                              const endTime = new Date(pr.completed_at);
                              const durationMs = endTime.getTime() - startTime.getTime();
                              const durationMinutes = Math.floor(durationMs / (1000 * 60));
                              const actualDays = Math.floor(durationMinutes / (60 * 24));
                              const actualHours = Math.floor((durationMinutes % (60 * 24)) / 60);
                              const actualMins = durationMinutes % 60;
                              
                              actualDuration = {
                                days: actualDays,
                                hours: actualHours,
                                minutes: actualMins,
                                totalMinutes: durationMinutes
                              };
                            }
                            
                            const dates = estimatedDates[index] || {};
                            const startDate = dates.start ? new Date(dates.start) : null;
                            const endDate = dates.end ? new Date(dates.end) : null;
                            
                            return (
                              <div 
                                key={pr.id} 
                                className={`list-group-item border-0 py-3 ${
                                  isCompleted ? 'bg-success bg-opacity-10' : isInProgress ? 'bg-primary bg-opacity-10' : ''
                                }`}
                                style={{ 
                                  borderLeft: isCompleted ? '4px solid #28a745' : isInProgress ? '4px solid #0d6efd' : '4px solid #dee2e6',
                                  backgroundColor: prodIndex % 2 === 0 
                                    ? (isCompleted ? '#e8f5e9' : isInProgress ? '#e3f2fd' : '#ffffff')
                                    : (isCompleted ? '#e0f2e0' : isInProgress ? '#dae8f5' : '#f8f9fa')
                                }}
                              >
                                <div className="d-flex align-items-center justify-content-between">
                                  <div className="flex-grow-1">
                                    <div className="d-flex align-items-center gap-3">
                                      {/* Step Number */}
                                      <div 
                                        className={`rounded-circle d-flex align-items-center justify-content-center fw-bold ${
                                          isCompleted ? 'bg-success text-white' : 
                                          isInProgress ? 'bg-primary text-white' : 
                                          'bg-secondary bg-opacity-25 text-secondary'
                                        }`}
                                        style={{ width: '36px', height: '36px', minWidth: '36px' }}
                                      >
                                        {isCompleted ? <i className="fas fa-check"></i> : index + 1}
                                      </div>
                                      
                                      {/* Process Info */}
                                      <div className="flex-grow-1">
                                        <div className={`fw-semibold mb-1 ${
                                          isCompleted ? 'text-muted text-decoration-line-through' : 'text-dark'
                                        }`}>
                                          {pr.process_name}
                                        </div>
                                        <div className="small text-muted">
                                          <div className="mb-1">
                                            <i className="fas fa-clock me-1"></i>
                                            <strong>Duration:</strong> 
                                            {actualDuration ? (
                                              <span className="text-success">
                                                {actualDuration.days > 0 && ` ${actualDuration.days}d`}
                                                {actualDuration.hours > 0 && ` ${actualDuration.hours}h`}
                                                {actualDuration.minutes > 0 && ` ${actualDuration.minutes}m`}
                                                {actualDuration.days === 0 && actualDuration.hours === 0 && actualDuration.minutes === 0 && ' < 1m'}
                                              </span>
                                            ) : (
                                              <>
                                                {estimatedDays > 0 && ` ${estimatedDays}d`}
                                                {estimatedHours > 0 && ` ${estimatedHours}h`}
                                                {estimatedDays === 0 && estimatedHours === 0 && ` ${pr.estimated_duration_minutes}m`}
                                              </>
                                            )}
                                          </div>
                                          
                                          {startDate && (
                                            <div className="mb-1">
                                              <i className="fas fa-play-circle me-1 text-info"></i>
                                              <strong>Start:</strong> {startDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                                            </div>
                                          )}
                                          
                                          {endDate && (
                                            <div className={isCompleted ? 'text-success' : ''}>
                                              <i className={`fas ${isCompleted ? 'fa-check-circle' : 'fa-calendar-check'} me-1`}></i>
                                              <strong>{isCompleted ? 'Completed:' : 'Est. Complete:'}</strong> {endDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                                              {actualDuration && (
                                                <span className="ms-2 text-success fw-bold">
                                                  (Actual: {actualDuration.days > 0 && `${actualDuration.days}d `}
                                                  {actualDuration.hours > 0 && `${actualDuration.hours}h `}
                                                  {actualDuration.minutes > 0 && `${actualDuration.minutes}m`}
                                                  {actualDuration.days === 0 && actualDuration.hours === 0 && actualDuration.minutes === 0 && '< 1m'})
                                                </span>
                                              )}
                                            </div>
                                          )}
                                          
                                          {pr.delay_reason && (
                                            <div className="mt-2 p-2 bg-warning bg-opacity-25 rounded">
                                              <div className="small text-danger fw-bold">
                                                <i className="fas fa-exclamation-circle me-1"></i>Delay Reason:
                                              </div>
                                              <div className="small text-dark">{pr.delay_reason}</div>
                                              {pr.completed_by_name && (
                                                <div className="small text-muted mt-1">
                                                  <i className="fas fa-user me-1"></i>Completed by: <strong>{pr.completed_by_name}</strong>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          
                                          {isCompleted && pr.completed_by_name && !pr.delay_reason && (
                                            <div className="mt-1 small text-success">
                                              <i className="fas fa-user-check me-1"></i>By: <strong>{pr.completed_by_name}</strong>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Action Button with Delay Warning */}
                                  <div className="text-end">
                                    {!isCompleted && endDate && currentTime > endDate && (
                                      <div className="badge bg-danger text-white mb-2 d-block animate__animated animate__flash">
                                        <i className="fas fa-exclamation-triangle me-1"></i>
                                        DELAYED!
                                      </div>
                                    )}
                                    {isCompleted ? (
                                      <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => handleProcessStatusChange(prod.id, pr.id, pr.process_name, pr.status, endDate)}
                                        title="Mark as pending"
                                      >
                                        <i className="fas fa-undo me-1"></i> Undo
                                      </button>
                                    ) : (
                                      <button
                                        className={`btn btn-sm ${canBeCompleted ? 'btn-success' : 'btn-secondary'}`}
                                        onClick={() => handleProcessStatusChange(prod.id, pr.id, pr.process_name, pr.status, endDate)}
                                        title={canBeCompleted ? "Mark as completed" : "Complete previous processes first"}
                                        disabled={!canBeCompleted}
                                      >
                                        <i className="fas fa-check me-1"></i> {canBeCompleted ? 'Complete' : 'Locked'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    {/* Progress Footer */}
                    <div 
                      className="card-footer border-0 py-3" 
                      style={{ 
                        backgroundColor: prodIndex % 2 === 0 ? '#f8f9fa' : '#e9ecef'
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <small className="text-muted fw-semibold">Overall Progress</small>
                        <small className="text-muted">
                          {Math.round((prod.processes?.filter(p => p.status === 'completed').length || 0) / (prod.processes?.length || 1) * 100)}%
                        </small>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div 
                          className="progress-bar bg-success" 
                          role="progressbar" 
                          style={{ width: `${Math.round((prod.processes?.filter(p => p.status === 'completed').length || 0) / (prod.processes?.length || 1) * 100)}%` }}
                          aria-valuenow={Math.round((prod.processes?.filter(p => p.status === 'completed').length || 0) / (prod.processes?.length || 1) * 100)}
                          aria-valuemin="0" 
                          aria-valuemax="100"
                        ></div>
                      </div>
                      {prod.notes && (
                        <div className="mt-2 small text-muted">
                          <i className="fas fa-sticky-note me-1"></i>
                          <strong>Notes:</strong> {prod.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Ready to Deliver Tab */}
      {activeTab === 'ready' && (
        <div className="row">
          <div className="col-12">
          <div className="card h-100 shadow-sm">
            <div className="card-header bg-warning text-dark">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  <i className="fas fa-truck me-2"></i>
                  Ready to Deliver (Table & Chair Only)
                  <span className="badge bg-light text-dark ms-2">
                    {filtered.filter(p => 
                      p.status === 'Completed' && 
                      p.overall_progress >= 100 && 
                      p.product_type !== 'alkansya' &&
                      (p.order?.status === 'ready_for_delivery' || 
                       (p.order?.status !== 'delivered' && p.order?.status !== 'completed'))
                    ).length}
                  </span>
                </h5>
                <button className="btn btn-dark btn-sm" onClick={fetchProductions}>
                  <i className="fas fa-sync-alt me-1"></i> Refresh
                </button>
              </div>
            </div>
            <div className="card-body">
              <div className="timeline-list">
                {filtered.filter(p => 
                  p.status === 'Completed' && 
                  p.overall_progress >= 100 && 
                  p.product_type !== 'alkansya' &&
                  (p.order?.status === 'ready_for_delivery' || 
                   (p.order?.status !== 'delivered' && p.order?.status !== 'completed'))
                ).length === 0 && (
                  <div className="text-center py-5 text-muted">
                    <i className="fas fa-truck-loading fa-3x mb-3"></i>
                    <div className="h5">No furniture orders are currently ready to deliver.</div>
                    <div className="small">Completed Table/Chair orders will appear here when production is finished.</div>
                  </div>
                )}

                {filtered.filter(p => 
                  p.status === 'Completed' && 
                  p.overall_progress >= 100 && 
                  p.product_type !== 'alkansya' &&
                  (p.order?.status === 'ready_for_delivery' || 
                   (p.order?.status !== 'delivered' && p.order?.status !== 'completed'))
                ).map(prod => (
                    <div key={prod.id} className="card mb-3 border-start border-4" style={{ borderColor: '#f39c12' }}>
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="small text-muted mb-1">
                              {prod.date ? new Date(prod.date).toLocaleDateString() : 'No date'}
                            </div>
                            <div className="h6 mb-1">{prod.product_name}</div>
                            <div className="small text-muted">
                              Qty: <strong>{prod.quantity || 0}</strong> • Prod ID: <strong>{prod.id}</strong>
                              {prod.order_id ? (<>
                                {' '}• Order ID: <strong>{prod.order_id}</strong>
                              </>) : null}
                              {prod.order?.user?.name && (
                                <>
                                  {' '}• Customer: <strong>{prod.order.user.name}</strong>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-end">
                            {prod.order?.status === 'ready_for_delivery' ? (
                              <span className="badge bg-warning text-dark">Ready to Deliver</span>
                            ) : (
                              <span className="badge bg-success">Completed</span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 d-flex gap-2">
                          {prod.order_id && prod.order?.status !== 'completed' && (
                            <>
                              {prod.order?.status === 'ready_for_delivery' ? (
                                <span className="badge bg-warning text-dark">
                                  <i className="fas fa-truck me-1"></i>
                                  Ready to Deliver
                                </span>
                              ) : (
                                <button
                                  className="btn btn-outline-warning btn-sm"
                                  onClick={() => markOrderReadyForDelivery(prod.order_id)}
                                  title="Mark Order as Ready for Delivery"
                                >
                                  Mark Ready for Delivery
                                </button>
                              )}
                              {prod.order?.status !== 'delivered' && (
                                <button
                                  className="btn btn-outline-success btn-sm"
                                  onClick={() => markOrderDelivered(prod.order_id)}
                                  title="Mark Order as Delivered"
                                >
                                  Mark Delivered
                                </button>
                              )}
                            </>
                          )}
                          {prod.order?.status === 'completed' && (
                            <span className="badge bg-success">
                              <i className="fas fa-check-circle me-1"></i>
                              Order Completed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Completed Productions Tab */}
      {activeTab === 'completed' && (
        <div className="row">
          <div className="col-12">
          <div className="card h-100 shadow-sm">
            <div className="card-header bg-success text-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  <i className="fas fa-check-circle me-2"></i>
                  Completed Table & Chair Productions
                  <span className="badge bg-light text-dark ms-2">
                    {filtered.filter(p => 
                      p.status === 'Completed' && 
                      p.product_type !== 'alkansya' &&
                      (p.order?.status === 'completed' || 
                       p.order?.status === 'ready_for_delivery' || 
                       !p.order_id)
                    ).length}
                  </span>
                </h5>
                <button className="btn btn-light btn-sm" onClick={fetchProductions}>
                  <i className="fas fa-sync-alt me-1"></i> Refresh
                </button>
              </div>
            </div>
            <div className="card-body">
              <div className="timeline-list">
                {filtered.filter(p => 
                  p.status === 'Completed' && 
                  p.product_type !== 'alkansya' &&
                  (p.order?.status === 'completed' || 
                   p.order?.status === 'ready_for_delivery' || 
                   !p.order_id)
                ).length === 0 && (
                  <div className="text-center py-5 text-muted">
                    <i className="fas fa-check-circle fa-3x mb-3"></i>
                    <div className="h5">No completed productions yet.</div>
                    <div className="small">Completed Table & Chair productions will appear here.</div>
                  </div>
                )}

                {filtered.filter(p => 
                  p.status === 'Completed' && 
                  p.product_type !== 'alkansya' &&
                  (p.order?.status === 'completed' || 
                   p.order?.status === 'ready_for_delivery' || 
                   !p.order_id)
                ).map(prod => (
                    <div key={prod.id} className="card mb-3 border-start border-4 border-success">
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="small text-muted mb-1">
                              Completed: {prod.actual_completion_date ? new Date(prod.actual_completion_date).toLocaleDateString() : 'N/A'}
                            </div>
                            <h6 className="mb-2 fw-bold">
                              <span className="badge bg-primary me-2">#{prod.id}</span>
                              {prod.product_name} 
                              {prod.order_id && (
                                <span className="badge bg-info ms-2">Order #{prod.order_id}</span>
                              )}
                            </h6>
                            <div className="mb-2">
                              <span className="badge bg-secondary me-2">Qty: {prod.quantity}</span>
                              <span className="badge bg-success">
                                <i className="fas fa-check me-1"></i>
                                Completed
                              </span>
                              {prod.overall_progress >= 100 && (
                                <span className="badge bg-success ms-2">
                                  <i className="fas fa-percentage me-1"></i>
                                  100% Complete
                                </span>
                              )}
                            </div>
                            <div className="small text-muted">
                              <i className="fas fa-calendar-alt me-1"></i>
                              Started: {prod.production_started_at ? new Date(prod.production_started_at).toLocaleDateString() : 'N/A'}
                            </div>
                            {prod.estimated_completion_date && (
                              <div className="small text-muted">
                                <i className="fas fa-clock me-1"></i>
                                Est. Completion: {new Date(prod.estimated_completion_date).toLocaleDateString()}
                              </div>
                            )}
                            {prod.order?.status && (
                              <div className="small mt-2">
                                <span className="text-muted">Order Status: </span>
                                <span className={`badge ${
                                  prod.order.status === 'delivered' ? 'bg-success' :
                                  prod.order.status === 'ready_for_delivery' ? 'bg-warning' :
                                  'bg-info'
                                }`}>
                                  {prod.order.status === 'delivered' ? 'Delivered' :
                                   prod.order.status === 'ready_for_delivery' ? 'Ready for Delivery' :
                                   prod.order.status}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="d-flex flex-column gap-2">
                            {prod.order_id && prod.order?.status !== 'delivered' && prod.order?.status !== 'completed' && (
                              <>
                                {prod.order?.status !== 'ready_for_delivery' && (
                                  <button
                                    className="btn btn-warning btn-sm"
                                    onClick={() => markOrderReadyForDelivery(prod.order_id)}
                                    title="Mark Order as Ready for Delivery"
                                  >
                                    <i className="fas fa-truck me-1"></i>
                                    Mark Ready
                                  </button>
                                )}
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => markOrderDelivered(prod.order_id)}
                                  title="Mark Order as Delivered"
                                >
                                  <i className="fas fa-check me-1"></i>
                                  Mark Delivered
                                </button>
                              </>
                            )}
                            {prod.order?.status === 'completed' && (
                              <span className="badge bg-success">
                                <i className="fas fa-check-circle me-1"></i>
                                Order Completed
                              </span>
                            )}
                            {prod.order?.status === 'delivered' && (
                              <span className="badge bg-success">
                                <i className="fas fa-check-double me-1"></i>
                                Delivered
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Process Completion Tab */}
      {activeTab === 'completion' && (
        <div className="row">
          <div className="col-12">
          {/* Delay Tracking & Completion Analytics */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-danger text-white">
              <h5 className="card-title mb-0">
                <i className="fas fa-exclamation-triangle me-2"></i>
                Process Completion
              </h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Production ID</th>
                      <th>Order</th>
                      <th>Product</th>
                      <th>Process</th>
                      <th>Status</th>
                      <th>Completed By</th>
                      <th>Expected Date</th>
                      <th>Actual Date</th>
                      <th>Remarks</th>
                      <th>Delay Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productions.flatMap(prod => 
                      (prod.processes || [])
                        .filter(pr => pr.status === 'completed')
                        .map(pr => {
                          // Check if process was delayed by comparing dates
                          const hasDelayReason = !!(pr.delay_reason && pr.delay_reason.trim());
                          const expectedDate = pr.started_at ? new Date(new Date(pr.started_at).getTime() + (pr.estimated_duration_minutes || 0) * 60000) : null;
                          const actualDate = pr.completed_at ? new Date(pr.completed_at) : null;
                          const wasLate = expectedDate && actualDate && actualDate > expectedDate;
                          const isDelayed = hasDelayReason || wasLate;
                          
                          console.log('Process delay check:', {
                            process: pr.process_name,
                            hasDelayReason,
                            expectedDate: expectedDate?.toISOString(),
                            actualDate: actualDate?.toISOString(),
                            wasLate,
                            isDelayed,
                            delay_reason: pr.delay_reason,
                            is_delayed_flag: pr.is_delayed
                          });
                          
                          return (
                            <tr key={`${prod.id}-${pr.id}`} className={isDelayed ? 'table-warning' : ''}>
                              <td>
                                <span className="badge bg-primary">#{prod.id}</span>
                              </td>
                              <td>
                                {prod.order_id ? (
                                  <span className="badge bg-info">Order #{prod.order_id}</span>
                                ) : (
                                  <span className="text-muted small">No Order</span>
                                )}
                              </td>
                              <td>
                                <strong>{prod.product_name}</strong>
                              </td>
                              <td>{pr.process_name}</td>
                              <td>
                                <span className={`badge ${
                                  pr.status === 'completed' ? 'bg-success' : 
                                  pr.status === 'in_progress' ? 'bg-primary' : 
                                  'bg-secondary'
                                }`}>
                                  {pr.status === 'in_progress' ? 'In Progress' : 
                                   pr.status === 'completed' ? 'Completed' : 'Pending'}
                                </span>
                              </td>
                              <td>
                                {pr.completed_by_name ? (
                                  <div>
                                    <i className="fas fa-user-check me-1 text-success"></i>
                                    <strong>{pr.completed_by_name}</strong>
                                    <div className="small text-muted">
                                      {pr.completed_at ? new Date(pr.completed_at).toLocaleString('en-US', { 
                                        month: 'short', 
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) : ''}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              <td>
                                {pr.started_at ? (
                                  <div className="small">
                                    {new Date(new Date(pr.started_at).getTime() + (pr.estimated_duration_minutes || 0) * 60000).toLocaleDateString()}
                                  </div>
                                ) : '-'}
                              </td>
                              <td>
                                {pr.completed_at ? (
                                  <div className="small">
                                    {new Date(pr.completed_at).toLocaleDateString()}
                                  </div>
                                ) : '-'}
                              </td>
                              <td>
                                <div className="small" style={{ maxWidth: '250px' }}>
                                  {pr.notes && pr.notes.trim() ? (
                                    <span className="text-dark">{pr.notes}</span>
                                  ) : (
                                    <span className="text-muted fst-italic">No remarks</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                {isDelayed ? (
                                  <div>
                                    <div className="badge bg-danger mb-1">
                                      <i className="fas fa-exclamation-triangle me-1"></i>
                                      DELAYED
                                    </div>
                                    {pr.delay_reason && pr.delay_reason.trim() && (
                                      <div className="text-danger small mt-1" style={{ maxWidth: '250px' }}>
                                        <strong>Reason:</strong> {pr.delay_reason}
                                      </div>
                                    )}
                                    {!pr.delay_reason && wasLate && (
                                      <div className="text-muted small mt-1">
                                        <em>Completed late (no reason provided)</em>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="badge bg-success">
                                    <i className="fas fa-check me-1"></i>On Time
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                    )}
                    {productions.flatMap(prod => 
                      (prod.processes || []).filter(pr => pr.status === 'completed')
                    ).length === 0 && (
                      <tr>
                        <td colSpan="8" className="text-center text-muted py-4">
                          <i className="fas fa-info-circle fa-2x mb-2"></i>
                          <div>No completed processes yet</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Product Manufacturing Monitoring */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-success text-white">
              <h5 className="card-title mb-0">
                <i className="fas fa-industry me-2"></i>
                Product Manufacturing Monitoring
              </h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover table-sm">
                  <thead className="table-light">
                    <tr>
                      <th>Product</th>
                      <th>Order No.</th>
                      <th>Current Stage</th>
                      <th>Progress</th>
                      <th>Start Date</th>
                      <th>Est. Completion</th>
                      <th>Status</th>
                      <th>Delay Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productions.filter(p => p.status !== 'Completed').map(prod => {
                      const totalProcesses = prod.processes?.length || 0;
                      const completedProcesses = prod.processes?.filter(p => p.status === 'completed').length || 0;
                      const progress = totalProcesses > 0 ? Math.round((completedProcesses / totalProcesses) * 100) : 0;
                      
                      // Find current process (pending or in progress)
                      const currentProcess = prod.processes?.find(p => p.status === 'pending' || p.status === 'in_progress') 
                        || prod.processes?.find(p => p.status !== 'completed') 
                        || prod.processes?.[prod.processes.length - 1];
                      const currentStage = currentProcess?.process_name || 'N/A';
                      
                      // Calculate Start Date: Use current process start date, or if not started, use last completed process completion date, or production start date
                      let startDate = null;
                      if (currentProcess?.started_at) {
                        startDate = new Date(currentProcess.started_at);
                      } else {
                        // If current process hasn't started, check if there's a completed process before it
                        const completedProcessesList = prod.processes?.filter(p => p.status === 'completed') || [];
                        if (completedProcessesList.length > 0) {
                          // Use the last completed process's completion date as the start for the next process
                          const lastCompleted = completedProcessesList[completedProcessesList.length - 1];
                          if (lastCompleted.completed_at) {
                            startDate = new Date(lastCompleted.completed_at);
                          }
                        }
                        // Fallback to production start date
                        if (!startDate && prod.start_date) {
                          startDate = new Date(prod.start_date);
                        }
                        // Final fallback to production_started_at
                        if (!startDate && prod.production_started_at) {
                          startDate = new Date(prod.production_started_at);
                        }
                      }
                      
                      // Calculate Est. Completion: Start Date + estimated duration of current process
                      let estCompletion = null;
                      if (startDate && currentProcess?.estimated_duration_minutes) {
                        estCompletion = new Date(startDate.getTime() + (currentProcess.estimated_duration_minutes * 60000));
                      } else if (startDate && currentProcess?.estimated_duration) {
                        // Fallback if estimated_duration is in a different format
                        estCompletion = new Date(startDate.getTime() + (currentProcess.estimated_duration * 60000));
                      }
                      
                      const delayDays = estCompletion && new Date() > estCompletion ? Math.ceil((new Date() - estCompletion) / (1000 * 60 * 60 * 24)) : 0;
                      const hasDelays = prod.processes?.some(p => p.delay_reason && p.delay_reason.trim());
                      
                      return (
                        <tr key={prod.id}>
                          <td>
                            <strong>{prod.product_name || prod.product?.name || 'Unknown'}</strong>
                          </td>
                          <td>
                            <span className="badge bg-secondary">#{prod.order_id || prod.order_number}</span>
                          </td>
                          <td>
                            <span className="small">{currentStage}</span>
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div className="progress flex-grow-1" style={{ height: '18px', minWidth: '80px' }}>
                                <div 
                                  className={`progress-bar ${progress === 100 ? 'bg-success' : progress >= 50 ? 'bg-info' : 'bg-warning'}`}
                                  style={{ width: `${progress}%` }}
                                >
                                  {progress}%
                                </div>
                              </div>
                              <span className="small">{completedProcesses}/{totalProcesses}</span>
                            </div>
                          </td>
                          <td className="small">
                            {startDate ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          </td>
                          <td className="small">
                            {estCompletion ? estCompletion.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          </td>
                          <td>
                            <span className={`badge ${prod.status === 'In Progress' ? 'bg-info' : prod.status === 'Hold' ? 'bg-warning' : 'bg-success'}`}>
                              {prod.status}
                            </span>
                          </td>
                          <td>
                            {delayDays > 0 ? (
                              <span className="badge bg-danger">{delayDays} days</span>
                            ) : hasDelays ? (
                              <span className="badge bg-warning">Has Delays</span>
                            ) : (
                              <span className="badge bg-success">On Time</span>
                            )}
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
      )}

      {/* Production Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="row">
          <div className="col-12">
          {/* Production Summary Overview */}
          {dataLoading ? (
            <div className="card shadow-sm mb-4" style={{ borderRadius: '12px' }}>
              <div className="card-body text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3 text-muted">Loading production data...</p>
              </div>
            </div>
          ) : (
            <>
          {/* Stage Completion Summary */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-info text-white">
              <h5 className="card-title mb-0">
                <i className="fas fa-clipboard-check me-2"></i>
                Stage Completion Summary - Performance Overview
              </h5>
              <p className="mb-0 small mt-1">Monitor and optimize stage efficiency across all production processes</p>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Stage Name</th>
                      <th>Total Completed</th>
                      <th>On Time</th>
                      <th>Delayed</th>
                      <th>Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STAGES.map(stageName => {
                      const stageProcesses = productions.flatMap(prod => 
                        (prod.processes || []).filter(pr => 
                          pr.process_name === stageName && pr.status === 'completed'
                        )
                      );
                      const totalCompleted = stageProcesses.length;
                      const onTime = stageProcesses.filter(pr => !pr.delay_reason || !pr.delay_reason.trim()).length;
                      const delayed = stageProcesses.filter(pr => pr.delay_reason && pr.delay_reason.trim()).length;
                      const performance = totalCompleted > 0 ? Math.round((onTime / totalCompleted) * 100) : 0;
                      
                      return (
                        <tr key={stageName}>
                          <td><strong>{stageName}</strong></td>
                          <td>
                            <span className="badge bg-primary">{totalCompleted}</span>
                          </td>
                          <td>
                            <span className="badge bg-success">{onTime}</span>
                          </td>
                          <td>
                            <span className="badge bg-danger">{delayed}</span>
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div className="progress flex-grow-1" style={{ height: '20px', minWidth: '100px' }}>
                                <div 
                                  className={`progress-bar ${performance >= 80 ? 'bg-success' : performance >= 50 ? 'bg-warning' : 'bg-danger'}`}
                                  style={{ width: `${performance}%` }}
                                >
                                  {performance}%
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Summary and Stage Workload */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-success text-white">
              <h5 className="card-title mb-0">
                <i className="fas fa-chart-line me-2"></i>
                Summary & Stage Workload
              </h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-4">
                  <div className="p-3 bg-light rounded">
                    <h6 className="text-primary">Summary</h6>
                    <div className="mb-2">
                      Total Orders: <span className="badge bg-primary">{productions.length}</span>
                    </div>
                    <div className="mb-2">
                      In Progress: <span className="badge bg-info">{productions.filter((p) => p.status === "In Progress").length}</span>
                    </div>
                    <div className="mb-2">
                      Completed: <span className="badge bg-success">{productions.filter((p) => p.status === "Completed").length}</span>
                    </div>
                    <div>
                      On Hold: <span className="badge bg-warning">{productions.filter((p) => p.status === "Hold").length}</span>
                    </div>
                  </div>
                </div>
                <div className="col-md-8">
                  <h6 className="text-primary">Stage Workload</h6>
                  <div>
                    {suggestions.map((suggestion) => {
                      const capacity = suggestion.capacity || 1;
                      const workload = suggestion.queued || 0;
                      const utilization = suggestion.utilization || ((workload / capacity) * 100);
                      const statusColor = suggestion.status === 'overloaded' ? 'danger' : 
                                        suggestion.status === 'busy' ? 'warning' : 'success';
                      
                      return (
                        <div key={suggestion.stage} className="d-flex align-items-center mb-2">
                          <div style={{ width: 140 }} className="small fw-bold">{suggestion.stage}</div>
                          <div className="progress flex-grow-1 me-3" style={{ height: 20 }}>
                            <div 
                              className={`progress-bar bg-${statusColor}`}
                              role="progressbar" 
                              style={{ width: `${Math.min(utilization, 100)}%` }}
                            >
                              {workload}/{capacity}
                            </div>
                          </div>
                          <div className="small">
                            <span className={`badge bg-${statusColor}`}>{workload}</span>
                            <span className="badge bg-light text-dark ms-1">/{capacity}</span>
                            <span className="badge bg-secondary ms-1">{Math.round(utilization)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resource Allocation Optimization */}
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  <i className="fas fa-tasks me-2"></i>
                  Resource Allocation Optimization
                </h5>
                <button 
                  className="btn btn-outline-light btn-sm" 
                  onClick={fetchAnalytics}
                >
                  <i className="fas fa-sync me-1"></i>
                  Refresh
                </button>
              </div>
            </div>
            <div className="card-body">
              {/* Optimization Metrics Summary - Display all 6 processes */}
              <div className="mb-3">
                <h6 className="text-muted mb-3">
                  <i className="fas fa-info-circle me-2"></i>
                  All Production Processes - Resource Utilization Overview
                </h6>
              </div>
              <div className="row mb-4">
                {suggestions.length > 0 ? (
                  // Filter to only show the 6 defined stages and ensure all 6 are present
                  (() => {
                    // Create a map of suggestions by stage name
                    const suggestionsMap = new Map();
                    suggestions.forEach(s => {
                      if (STAGES.includes(s.stage)) {
                        suggestionsMap.set(s.stage, s);
                      }
                    });
                    
                    // Ensure all 6 stages are present, use defaults for missing ones
                    const defaultCapacities = { 
                      "Material Preparation": 3, 
                      "Cutting & Shaping": 4, 
                      "Assembly": 5, 
                      "Sanding & Surface Preparation": 3, 
                      "Finishing": 3, 
                      "Quality Check & Packaging": 2 
                    };
                    
                    const allStages = STAGES.map(stage => {
                      if (suggestionsMap.has(stage)) {
                        return suggestionsMap.get(stage);
                      } else {
                        // Return default for missing stage
                        return {
                          stage: stage,
                          capacity: defaultCapacities[stage] || 3,
                          assigned: [],
                          queued: 0,
                          utilization: 0,
                          status: 'available',
                          message: `${stage} has 0 items (0% capacity)`,
                          priority: 'low'
                        };
                      }
                    });
                    
                    return allStages;
                  })().map((s) => {
                    const utilization = s.utilization || ((s.queued / s.capacity) * 100);
                    const isOverloaded = utilization > 100;
                    const isBusy = utilization > 70 && utilization <= 100;
                    const isOptimal = utilization >= 50 && utilization <= 70;
                    const isUnderutilized = utilization < 50;
                    
                    return (
                      <div key={s.stage} className="col-lg-4 col-md-6 mb-3">
                      <div className={`card h-100 border-${isOverloaded ? 'danger' : isBusy ? 'warning' : isOptimal ? 'success' : 'info'}`}>
                        <div className={`card-header bg-${isOverloaded ? 'danger' : isBusy ? 'warning' : isOptimal ? 'success' : 'info'} text-white`}>
                          <h6 className="mb-0">
                            <strong>{s.stage}</strong>
                            {isOverloaded && (
                              <i className="fas fa-exclamation-triangle ms-2" title="Overloaded - Action Required"></i>
                            )}
                          </h6>
                        </div>
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="small text-muted">Utilization:</span>
                            <span className={`badge bg-${isOverloaded ? 'danger' : isBusy ? 'warning' : isOptimal ? 'success' : 'info'}`}>
                              {Math.round(utilization)}%
                            </span>
                          </div>
                          <div className="progress mb-2" style={{ height: '20px' }}>
                            <div 
                              className={`progress-bar ${isOverloaded ? 'bg-danger' : isBusy ? 'bg-warning' : isOptimal ? 'bg-success' : 'bg-info'}`}
                              role="progressbar" 
                              style={{ width: `${Math.min(utilization, 100)}%` }}
                            >
                              {s.queued}/{s.capacity}
                            </div>
                          </div>
                          <div className="small text-muted">
                            Queued: <strong>{s.queued}</strong> / Capacity: <strong>{s.capacity}</strong>
                          </div>
                          {isOverloaded && (
                            <div className="alert alert-danger mt-2 mb-0 py-2">
                              <i className="fas fa-exclamation-circle me-1"></i>
                              <strong>Action Required:</strong> Consider reallocating resources
                            </div>
                          )}
                          {isBusy && (
                            <div className="alert alert-warning mt-2 mb-0 py-2">
                              <i className="fas fa-clock me-1"></i>
                              <strong>High Activity:</strong> Monitor workload closely
                            </div>
                          )}
                          {isOptimal && (
                            <div className="alert alert-success mt-2 mb-0 py-2">
                              <i className="fas fa-check-circle me-1"></i>
                              <strong>Optimal:</strong> Resources well-balanced
                            </div>
                          )}
                          {isUnderutilized && (
                            <div className="alert alert-info mt-2 mb-0 py-2">
                              <i className="fas fa-info-circle me-1"></i>
                              <strong>Capacity Available:</strong> Can accept more work
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })
                ) : (
                  // Fallback: Show all 6 stages even if suggestions is empty
                  STAGES.map((stage) => {
                    const capacities = { 
                      "Material Preparation": 3, 
                      "Cutting & Shaping": 4, 
                      "Assembly": 5, 
                      "Sanding & Surface Preparation": 3, 
                      "Finishing": 3, 
                      "Quality Check & Packaging": 2 
                    };
                    const cap = capacities[stage] || 1;
                    const utilization = 0;
                    const isUnderutilized = true;
                    
                    return (
                      <div key={stage} className="col-lg-4 col-md-6 mb-3">
                        <div className="card h-100 border-info">
                          <div className="card-header bg-info text-white">
                            <h6 className="mb-0">
                              <strong>{stage}</strong>
                            </h6>
                          </div>
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="small text-muted">Utilization:</span>
                              <span className="badge bg-info">0%</span>
                            </div>
                            <div className="progress mb-2" style={{ height: '20px' }}>
                              <div 
                                className="progress-bar bg-info"
                                role="progressbar" 
                                style={{ width: '0%' }}
                              >
                                0/{cap}
                              </div>
                            </div>
                            <div className="small text-muted">
                              Queued: <strong>0</strong> / Capacity: <strong>{cap}</strong>
                            </div>
                            <div className="alert alert-info mt-2 mb-0 py-2">
                              <i className="fas fa-info-circle me-1"></i>
                              <strong>Capacity Available:</strong> Can accept more work
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Priority Assignments Table */}
              <h6 className="mb-3"><i className="fas fa-list-ul me-2"></i>Top Priority Assignments</h6>
              <div className="table-responsive">
                <table className="table table-hover table-sm">
                  <thead className="table-light">
                    <tr>
                      <th>Stage</th>
                      <th>Priority Level</th>
                      <th>Recommendation</th>
                      <th>Capacity Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map((s) => {
                      const utilization = s.utilization || ((s.queued / s.capacity) * 100);
                      const isOverloaded = utilization > 100;
                      
                      return (
                        <tr key={s.stage}>
                          <td>
                            <strong>{s.stage}</strong>
                          </td>
                          <td>
                            <span className={`badge bg-${s.priority === 'high' ? 'danger' : s.priority === 'medium' ? 'warning' : 'info'}`}>
                              {s.priority?.toUpperCase() || 'LOW'}
                            </span>
                          </td>
                          <td>
                            <div className="small">{s.message}</div>
                          </td>
                          <td>
                            <div className="small">
                              {isOverloaded ? (
                                <span className="text-danger">
                                  <i className="fas fa-exclamation-triangle me-1"></i>
                                  Overloaded ({Math.round(utilization)}%)
                                </span>
                              ) : (
                                <span className="text-success">
                                  <i className="fas fa-check-circle me-1"></i>
                                  Under Capacity ({Math.round(utilization)}%)
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {isOverloaded ? (
                              <span className="badge bg-danger">
                                <i className="fas fa-exclamation-circle me-1"></i>
                                Urgent Attention
                              </span>
                            ) : (
                              <span className="badge bg-success">
                                <i className="fas fa-check me-1"></i>
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </>
          )}
          </div>
        </div>
      )}
      
      {/* Delay Reason Modal */}
      {console.log('Rendering modal check - showDelayModal:', showDelayModal)}
      {showDelayModal ? (
        <>
          {console.log('✅ MODAL IS RENDERING NOW')}
          <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }} tabIndex="-1" onClick={(e) => e.target === e.currentTarget && setShowDelayModal(false)}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow-lg">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  Process Delayed - Explanation Required
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowDelayModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-warning mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <i className="fas fa-exclamation-circle fa-2x text-danger me-3"></i>
                    <div>
                      <strong className="text-danger fs-5">This process is delayed!</strong>
                      <div className="small">Please provide an explanation below</div>
                    </div>
                  </div>
                  <hr />
                  <strong>Process:</strong> {delayModalData.processName}
                  <br />
                  <strong>Expected Completion:</strong> {delayModalData.estimatedEndDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  <br />
                  <strong>Actual Completion:</strong> {delayModalData.actualCompletionDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  <br />
                  <strong className="text-danger">Delay:</strong> {Math.ceil((delayModalData.actualCompletionDate - delayModalData.estimatedEndDate) / (1000 * 60 * 60 * 24))} days late
                </div>
                
                <div className="mb-3">
                  <label htmlFor="delayReason" className="form-label fw-bold">
                    Please explain the reason for this delay: <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="delayReason"
                    className="form-control"
                    rows="4"
                    placeholder="E.g., Material shortage, equipment malfunction, staff shortage, quality issues, etc."
                    value={delayModalData.delayReason}
                    onChange={(e) => setDelayModalData({...delayModalData, delayReason: e.target.value})}
                    required
                  ></textarea>
                  <div className="form-text">
                    This information will be visible to customers and management for transparency.
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowDelayModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-warning" 
                  onClick={handleDelayModalSubmit}
                  disabled={!delayModalData.delayReason.trim()}
                >
                  <i className="fas fa-save me-1"></i>
                  Submit & Complete Process
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
      ) : null}
      
      {/* Remarks Modal */}
      {showRemarksModal && (
        <>
          <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }} tabIndex="-1" onClick={(e) => e.target === e.currentTarget && setShowRemarksModal(false)}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow-lg">
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title">
                    <i className="fas fa-clipboard-check me-2"></i>
                    Complete Process - Remarks Required
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close btn-close-white" 
                    onClick={() => setShowRemarksModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-info mb-3">
                    <div className="d-flex align-items-center mb-2">
                      <i className="fas fa-info-circle fa-2x text-primary me-3"></i>
                      <div>
                        <strong className="text-primary fs-5">Process Completion Remarks</strong>
                        <div className="small">Please provide remarks for process completion</div>
                      </div>
                    </div>
                    <hr />
                    <strong>Process:</strong> {remarksModalData.processName}
                  </div>
                  
                  {remarksModalData.isDelayed && (
                    <div className="alert alert-warning mb-3">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      <strong>This process was delayed.</strong> The delay reason has been recorded.
                    </div>
                  )}
                  
                  <div className="mb-3">
                    <label htmlFor="processRemarks" className="form-label fw-bold">
                      Please provide completion remarks: <span className="text-danger">*</span>
                    </label>
                    <textarea
                      id="processRemarks"
                      className="form-control"
                      rows="6"
                      placeholder="E.g., Process completed successfully. Materials were properly prepared and all quality checks passed. Ready for next stage."
                      value={remarksModalData.remarks}
                      onChange={(e) => setRemarksModalData({...remarksModalData, remarks: e.target.value})}
                      required
                    ></textarea>
                    <div className="form-text">
                      This information will be displayed in the Process Completion tab for tracking and transparency.
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowRemarksModal(false)}
                    disabled={isSubmittingRemarks}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-success" 
                    onClick={handleRemarksModalSubmit}
                    disabled={!remarksModalData.remarks.trim() || isSubmittingRemarks}
                  >
                    {isSubmittingRemarks ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check me-1"></i>
                        Submit & Complete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </AppLayout>
  );
}

