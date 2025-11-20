import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../Header";
import Pusher from "pusher-js";
import { toast } from "sonner";
import AlkansyaDailyOutputModal from "./AlkansyaDailyOutputModal";


// Custom styles for simple, clean design
const customStyles = `
  .table tbody tr {
    transition: background-color 0.2s ease;
  }
  .table tbody tr:hover {
    background-color: #f8f9fa;
  }
  
  /* Simple transparent button styles */
  .btn-action {
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid #d1d5db;
    border-radius: 6px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: #374151;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    margin: 0 2px;
  }
  
  .btn-action:hover {
    background: rgba(249, 250, 251, 0.9);
    border-color: #9ca3af;
    color: #111827;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .btn-action:active {
    transform: translateY(0);
  }
  
  .btn-action i {
    font-size: 12px;
    color: inherit;
  }
`;

const DEFAULTS = {
  forecastWindowDays: 14,
  planningHorizonDays: 30,
  pollIntervalMs: 15000,
};

// Utility functions (commented out as not currently used)
// function toCSV(rows) {
//   if (!rows || rows.length === 0) return "";
//   const headers = Object.keys(rows[0]);
//   const escape = (v) =>
//     v === null || v === undefined
//       ? ""
//       : String(v)
//           .replaceAll("\"", '""')
//           .replace(/[\n\r]/g, " ");
//   const lines = [headers.join(",")];
//   for (const r of rows) {
//     lines.push(headers.map((h) => `"${escape(r[h])}"`).join(","));
//   }
//   return lines.join("\n");
// }

// function download(filename, text) {
//   const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = filename;
//   a.click();
//   URL.revokeObjectURL(url);
// }

function groupBy(arr, keyFn) {
  return arr.reduce((acc, x) => {
    const k = keyFn(x);
    (acc[k] = acc[k] || []).push(x);
    return acc;
  }, {});
}

function parseUsageCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift();
  const cols = header.split(",").map((c) => c.trim().toLowerCase());
  const skuIdx = cols.indexOf("sku");
  const dateIdx = cols.indexOf("date");
  const qtyIdx = cols.indexOf("qtyused");
  if (skuIdx === -1 || dateIdx === -1 || qtyIdx === -1) {
    throw new Error("CSV must have headers: sku,date,qtyUsed");
  }
  return lines.map((ln) => {
    const parts = ln.split(",");
    return {
      sku: parts[skuIdx]?.trim(),
      date: parts[dateIdx]?.trim(),
      qtyUsed: Number(parts[qtyIdx]?.trim() || 0),
    };
  });
}

function movingAverageDaily(usageByDayArr, windowDays) {
  if (!usageByDayArr || usageByDayArr.length === 0) return 0;
  const lastN = usageByDayArr
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-windowDays);
  const total = lastN.reduce((s, r) => s + Number(r.qtyUsed || 0), 0);
  return total / Math.max(1, lastN.length);
}

function daysUntil(quantity, dailyUsage) {
  if (dailyUsage <= 0) return Infinity;
  return quantity / dailyUsage;
}

function projectOnHand(onHand, dailyUsage, days) {
  const arr = [];
  let bal = onHand;
  for (let d = 0; d <= days; d++) {
    arr.push({ day: d, projected: Math.max(0, Math.round(bal)) });
    bal -= dailyUsage;
  }
  return arr;
}

function statusFromLevels({ onHand, rop, maxLevel, category, name, productionCount = 0, isMadeToOrder = false, productionStatus = null, status = null, safetyStock = 0 }) {
  // Always calculate status based on current stock levels for accuracy
  // For raw materials - use accurate reorder logic
  if (category === 'raw') {
    if (onHand === 0) return { label: "Out of Stock", variant: "danger" };
    if (onHand <= safetyStock) return { label: "Critical Stock", variant: "danger" };
    if (onHand <= rop) return { label: "Reorder now", variant: "danger" };
    if (maxLevel && onHand > maxLevel) return { label: "Overstock", variant: "warning" };
    return { label: "In Stock", variant: "success" };
  }
  
  // For mass-produced finished goods (Alkansya)
  if (category === 'finished' && !isMadeToOrder) {
    if (onHand === 0) return { label: "Out of Stock", variant: "danger" };
    if (onHand <= (rop || 0)) return { label: "Low Stock", variant: "warning" };
    return { label: "In Stock", variant: "success" };
  }
  
  // For made-to-order products (Table and Chair)
  if (isMadeToOrder || (category === 'finished' && (name.toLowerCase().includes('table') || name.toLowerCase().includes('chair')))) {
    // Check production status first
    if (productionStatus === 'completed') {
      return { label: "Completed", variant: "success" };
    }
    if (productionStatus === 'ready_to_deliver') {
      return { label: "Ready to Deliver", variant: "info" };
    }
    if (productionCount > 0 || productionStatus === 'in_production') {
      return { label: `${productionCount} Order${productionCount > 1 ? 's' : ''} in Production`, variant: "warning" };
    }
    return { label: "No Production", variant: "secondary" };
  }
  
  // Default fallback - always check stock levels first
  if (onHand === 0) return { label: "Out of Stock", variant: "danger" };
  return { label: "In Stock", variant: "success" };
}

// Material Form Modal Component
const MaterialModal = ({ show, onHide, material, onSave }) => {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "raw",
    location: "",
    quantity: 0,
    unit: "",
    cost: 0,
    supplier: "",
    lead_time_days: 0,
    safety_stock: 0,
    max_level: 0,
    reorder_point: 0,
    description: ""
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (material) {
      setFormData({
        name: material.name || "",
        sku: material.sku || "",
        category: material.category || "raw",
        location: material.location || "",
        quantity: (material.quantity_on_hand ?? material.quantity ?? 0),
        unit: material.unit || "",
        cost: (material.unit_cost ?? material.cost ?? 0),
        supplier: material.supplier || "",
        lead_time_days: material.lead_time_days || material.leadTimeDays || 0,
        safety_stock: material.safety_stock || material.safetyStock || 0,
        max_level: material.max_level || material.maxLevel || 0,
        reorder_point: material.reorder_point || material.reorderPoint || 0,
        description: material.description || ""
      });
    } else {
      setFormData({
        name: "",
        sku: "",
        category: "raw",
        location: "",
        quantity: 0,
        unit: "",
        cost: 0,
        supplier: "",
        lead_time_days: 0,
        safety_stock: 0,
        max_level: 0,
        reorder_point: 0,
        description: ""
      });
    }
    setErrors({});
  }, [material, show]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.sku.trim()) newErrors.sku = "SKU is required";
    if (!formData.location.trim()) newErrors.location = "Location is required";
    if (formData.quantity < 0) newErrors.quantity = "Quantity cannot be negative";
    if (formData.cost < 0) newErrors.cost = "Cost cannot be negative";
    if (formData.lead_time_days < 0) newErrors.lead_time_days = "Lead time cannot be negative";
    if (formData.safety_stock < 0) newErrors.safety_stock = "Safety stock cannot be negative";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    // Sanitize category to match backend enum
    const allowedCategories = ["raw", "finished"];
    const sanitizedCategory = allowedCategories.includes(formData.category)
      ? formData.category
      : "raw";

    setSaving(true);
    try {
      await onSave({ ...formData, category: sanitizedCategory });
      onHide();
      
      // Success toast notification
      toast.success("📦 Material Saved Successfully!", {
        description: material 
          ? `"${formData.name}" has been updated in the inventory.`
          : `"${formData.name}" has been added to the inventory.`,
        duration: 4000,
        style: {
          background: '#f0fdf4',
          border: '1px solid #86efac',
          color: '#166534'
        }
      });
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("❌ Material Save Failed", {
        description: "Unable to save the material. Please check your inputs and try again.",
        duration: 5000,
        style: {
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626'
        }
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {material ? "Edit Material" : "Add New Material"}
            </h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  className={`form-control ${errors.name ? "is-invalid" : ""}`}
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                />
                {errors.name && <div className="invalid-feedback">{errors.name}</div>}
              </div>
              <div className="col-md-6">
                <label className="form-label">SKU *</label>
                <input
                  type="text"
                  className={`form-control ${errors.sku ? "is-invalid" : ""}`}
                  value={formData.sku}
                  onChange={(e) => handleChange("sku", e.target.value)}
                />
                {errors.sku && <div className="invalid-feedback">{errors.sku}</div>}
              </div>
              <div className="col-md-6">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={formData.category}
                  onChange={(e) => handleChange("category", e.target.value)}
                >
                  <option value="raw">Raw Material</option>
                  <option value="finished">Finished Good</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Location *</label>
                <input
                  type="text"
                  className={`form-control ${errors.location ? "is-invalid" : ""}`}
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="e.g., Warehouse A, Shelf B2"
                />
                {errors.location && <div className="invalid-feedback">{errors.location}</div>}
              </div>
              <div className="col-md-4">
                <label className="form-label">Quantity</label>
                <input
                  type="number"
                  className={`form-control ${errors.quantity ? "is-invalid" : ""}`}
                  value={formData.quantity}
                  onChange={(e) => handleChange("quantity", Math.max(0, parseInt(e.target.value || 0, 10)))}
                  min="0"
                  step="1"
                />
                {errors.quantity && <div className="invalid-feedback">{errors.quantity}</div>}
              </div>
              <div className="col-md-4">
                <label className="form-label">Unit</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.unit}
                  onChange={(e) => handleChange("unit", e.target.value)}
                  placeholder="kg, pcs, m, etc."
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Unit Cost</label>
                <input
                  type="number"
                  className={`form-control ${errors.cost ? "is-invalid" : ""}`}
                  value={formData.cost}
                  onChange={(e) => handleChange("cost", Number(e.target.value))}
                  min="0"
                  step="0.01"
                />
                {errors.cost && <div className="invalid-feedback">{errors.cost}</div>}
              </div>
              <div className="col-md-6">
                <label className="form-label">Supplier</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.supplier}
                  onChange={(e) => handleChange("supplier", e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Lead Time (days)</label>
                <input
                  type="number"
                  className={`form-control ${errors.lead_time_days ? "is-invalid" : ""}`}
                  value={formData.lead_time_days}
                  onChange={(e) => handleChange("lead_time_days", Math.max(0, parseInt(e.target.value || 0, 10)))}
                  min="0"
                  step="1"
                />
                {errors.lead_time_days && <div className="invalid-feedback">{errors.lead_time_days}</div>}
              </div>
              <div className="col-md-4">
                <label className="form-label">Safety Stock</label>
                <input
                  type="number"
                  className={`form-control ${errors.safety_stock ? "is-invalid" : ""}`}
                  value={formData.safety_stock}
                  onChange={(e) => handleChange("safety_stock", Math.max(0, parseInt(e.target.value || 0, 10)))}
                  min="0"
                  step="1"
                />
                {errors.safety_stock && <div className="invalid-feedback">{errors.safety_stock}</div>}
              </div>
              <div className="col-md-4">
                <label className="form-label">Max Level</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.max_level}
                  onChange={(e) => handleChange("max_level", Math.max(0, parseInt(e.target.value || 0, 10)))}
                  min="0"
                  step="1"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Reorder Point</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.reorder_point}
                  onChange={(e) => handleChange("reorder_point", Math.max(0, parseInt(e.target.value || 0, 10)))}
                  min="0"
                  step="1"
                  readOnly={formData.category === 'finished'}
                  style={formData.category === 'finished' ? { backgroundColor: '#f8f9fa', cursor: 'not-allowed' } : {}}
                />
                {formData.category === 'finished' && (
                  <small className="text-muted">Reorder point is read-only for finished goods</small>
                )}
              </div>
              <div className="col-12">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Additional notes about this material..."
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : (material ? "Update" : "Add")} Material
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Inventory Component
const InventoryPage = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter] = useState({ q: "", type: "all", product: "all" });
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [showAlkansyaModal, setShowAlkansyaModal] = useState(false);
  const [activeTab, setActiveTab] = useState("raw"); // New state for tab management
  
  // Raw materials specific filtering state
  const [rawMaterialsFilter, setRawMaterialsFilter] = useState({
    search: "",
    category: "all",
    status: "all"
  });
  const [alkansyaStats, setAlkansyaStats] = useState({
    totalOutput: 0,
    averageDaily: 0,
    last7Days: 0,
    productionDays: 0
  });
  const wsRef = useRef(null);
  const pollRef = useRef(null);
  const fileInputRef = useRef(null);

  // API helper function
  const apiBase = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000/api";
  const apiCall = useCallback(async (path, options = {}) => {
    const token = localStorage.getItem("token");
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    };

    const url = path.startsWith('http') ? path : `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }, [apiBase]);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [invRes, usageRes] = await Promise.allSettled([
        apiCall("/inventory"),
        apiCall("/usage?days=120"),
      ]);

      if (invRes.status === "fulfilled") setInventory(invRes.value || []);
      else throw invRes.reason;

      if (usageRes.status === "fulfilled") setUsage(usageRes.value || []);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch initial data. Check API settings.");
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  const fetchAlkansyaStats = useCallback(async () => {
    try {
      console.log('Fetching Alkansya statistics...');
      // Use the proper statistics endpoint
      const data = await apiCall('/inventory/alkansya-daily-output/statistics');
      console.log('Alkansya statistics data:', data);
      setAlkansyaStats({
        totalOutput: data.total_output || 0,
        averageDaily: data.average_daily || 0,
        last7Days: data.last_7_days || 0,
        productionDays: data.total_days || 0
      });
    } catch (err) {
      console.error('Failed to fetch Alkansya statistics:', err);
      // Fallback to test route if main route fails
      try {
        const data = await apiCall('/test-alkansya-stats');
        setAlkansyaStats({
          totalOutput: data.total_output || 0,
          averageDaily: data.average_daily || 0,
          last7Days: data.last_7_days || 0,
          productionDays: data.total_days || 0
        });
      } catch (fallbackErr) {
        console.error('Fallback Alkansya statistics also failed:', fallbackErr);
      }
    }
  }, [apiCall]);

  // Fetch inventory and usage data
  useEffect(() => {
    fetchInventory();
    fetchAlkansyaStats();
  }, [fetchInventory, fetchAlkansyaStats]);

  // Material CRUD operations
  const handleAddMaterial = () => {
    setEditingMaterial(null);
    setShowModal(true);
  };

  const handleEditMaterial = (material) => {
    setEditingMaterial(material);
    setShowModal(true);
  };

  const handleSaveMaterial = async (materialData) => {
    try {
      const payload = {
        name: materialData.name,
        sku: materialData.sku,
        category: materialData.category,
        location: materialData.location,
        unit: materialData.unit,
        unit_cost: Number(materialData.cost || 0),
        supplier: materialData.supplier,
        description: materialData.description,
        quantity_on_hand: Number(materialData.quantity || 0),
        lead_time_days: Number(materialData.lead_time_days || 0),
        safety_stock: Number(materialData.safety_stock || 0),
        max_level: Number(materialData.max_level || 0),
        reorder_point: Number(materialData.reorder_point || 0),
      };
      if (editingMaterial) {
        // Update existing material
        const response = await apiCall(
          `/inventory/${editingMaterial.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload)
          }
        );
        setInventory(prev => 
          prev.map(item => 
            item.id === editingMaterial.id ? response : item
          )
        );
      } else {
        // Add new material
        const response = await apiCall(
          "/inventory",
          {
            method: 'POST',
            body: JSON.stringify(payload)
          }
        );
        setInventory(prev => [...prev, response]);
      }
    } catch (error) {
      console.error("Save material error:", error);
      throw error;
    }
  };

  // Use a more robust approach with a Map to track deletion state
  const deletionState = useRef(new Map());

  const handleDeleteMaterial = async (materialId, event) => {
    // Prevent event bubbling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Check if this material is already being deleted
    const deletionInfo = deletionState.current.get(materialId);
    if (deletionInfo && deletionInfo.status === 'deleting') {
      console.log('Material is already being deleted, ignoring duplicate call');
      return;
    }

    console.log('Delete material called for ID:', materialId);
    
    if (!window.confirm("Are you sure you want to delete this material? This action cannot be undone.")) {
      return;
    }

    // Check if material still exists in inventory
    const materialExists = inventory.find(item => item.id === materialId);
    if (!materialExists) {
      console.log('Material no longer exists in inventory, skipping deletion');
      return;
    }

    // Mark this material as being deleted with timestamp
    deletionState.current.set(materialId, {
      status: 'deleting',
      timestamp: Date.now(),
      promise: null
    });

    // Disable the button to prevent multiple clicks
    if (event && event.target) {
      event.target.disabled = true;
      event.target.textContent = 'Deleting...';
    }

    try {
      console.log('Deleting material with ID:', materialId);
      
      // Add a small delay to prevent rapid successive calls
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check again if material still exists after delay
      const materialStillExists = inventory.find(item => item.id === materialId);
      if (!materialStillExists) {
        console.log('Material was deleted during delay, skipping API call');
        return;
      }
      
      // Create a unique promise for this deletion
      const deletePromise = (async () => {
        console.log('Making DELETE request to:', `/inventory/${materialId}`);
        const response = await apiCall(`/inventory/${materialId}`, {
          method: 'DELETE'
        });
        return response;
      })();

      // Store the promise in deletion state
      deletionState.current.set(materialId, {
        ...deletionState.current.get(materialId),
        promise: deletePromise
      });

      const response = await deletePromise;
      
      console.log('Delete response:', response);
      console.log('Material deleted successfully, updating state');
      
      // Update state to remove the deleted item
      setInventory(prev => {
        const updated = prev.filter(item => item.id !== materialId);
        console.log('Updated inventory count:', updated.length);
        return updated;
      });
      
      // Success toast notification
      toast.success("🗑️ Material Deleted Successfully!", {
        description: "Material has been removed from the inventory.",
        duration: 4000,
        style: {
          background: '#f0fdf4',
          border: '1px solid #86efac',
          color: '#166534'
        }
      });
    } catch (error) {
      console.error("Delete material error:", error);
      
      // If it's a 404 error, the material might already be deleted
      if (error.message.includes('404')) {
        console.log('Material already deleted (404), updating UI');
        setInventory(prev => {
          const updated = prev.filter(item => item.id !== materialId);
          console.log('Updated inventory count after 404:', updated.length);
          return updated;
        });
        
        toast.success("🗑️ Material Deleted Successfully!", {
          description: "Material has been removed from the inventory.",
          duration: 4000,
          style: {
            background: '#f0fdf4',
            border: '1px solid #86efac',
            color: '#166534'
          }
        });
      } else {
        toast.error("❌ Material Deletion Failed", {
          description: "Unable to delete the material. Please try again.",
          duration: 5000,
          style: {
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#dc2626'
          }
        });
      }
    } finally {
      // Remove from deletion state and re-enable the button
      deletionState.current.delete(materialId);
      if (event && event.target) {
        event.target.disabled = false;
        event.target.textContent = 'Delete';
      }
    }
  };

  // Additional polling for production status updates when on made-to-order tab
  useEffect(() => {
    let productionStatusInterval = null;
    
    if (activeTab === 'made-to-order') {
      console.log("Starting production status polling for made-to-order tab");
      productionStatusInterval = setInterval(async () => {
        console.log("Polling for production status updates...");
        await fetchInventory();
      }, 10000); // Poll every 10 seconds
    }

    return () => {
      if (productionStatusInterval) {
        console.log("Stopping production status polling");
        clearInterval(productionStatusInterval);
      }
    };
  }, [activeTab, fetchInventory]);

  // Cleanup deletion state on unmount
  useEffect(() => {
    const currentDeletionState = deletionState.current;
    return () => {
      // Clear all pending deletion states
      currentDeletionState.clear();
    };
  }, []);

  // Real-time tracking via Pusher with polling fallback
  useEffect(() => {
    const key = process.env.REACT_APP_PUSHER_KEY || "";
    const cluster = process.env.REACT_APP_PUSHER_CLUSTER || "mt1";
    if (key) {
      const p = new Pusher(key, { cluster });
      const ch = p.subscribe("inventory-channel");
      const handler = (data) => {
        const item = data.item || data;
        setInventory((prev) => prev.map((it) => (it.id === item.id ? { ...it, ...item } : it)));
      };
      ch.bind("inventory-updated", handler);
      // Listen for order acceptance events to refresh inventory
      ch.bind("order-accepted", () => {
        console.log("Order accepted - refreshing inventory for production status update");
        toast.success("Order accepted! Production status updated.", {
          description: "Made-to-order products status has been refreshed.",
          duration: 3000,
        });
        fetchInventory();
      });
      wsRef.current = p;
      return () => {
        ch.unbind("inventory-updated", handler);
        ch.unbind("order-accepted");
        p.unsubscribe("inventory-channel");
        p.disconnect();
      };
    } else {
      startPolling();
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      };
    }

    function startPolling() {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        try {
          const data = await apiCall("/inventory");
          setInventory(data || []);
        } catch (e) {
          console.warn("Polling failed", e);
        }
      }, DEFAULTS.pollIntervalMs);
    }
  }, [apiCall, fetchInventory]);

  // Derived analytics per item
  const enriched = useMemo(() => {
    const usageBySku = groupBy(usage || [], (u) => u.sku);

    const safeEtaFromDays = (days) => {
      if (!Number.isFinite(days) || days < 0) return "-";
      const millis = Date.now() + Math.floor(days) * 86400000;
      const d = new Date(millis);
      return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "-";
    };

    const rows = (inventory || []).map((it) => {
      const onHand = Number(it.quantity ?? it.quantity_on_hand ?? 0);
      const lead = Number(it.lead_time_days ?? it.leadTimeDays ?? 0);
      const safety = Number(it.safety_stock ?? it.safetyStock ?? 0);
      const maxLevel = Number(it.max_level ?? it.maxLevel ?? 0) || undefined;
      const category = it.category || it.type || "unspecified";

      const history = (usageBySku[it.sku] || [])
        .map((u) => ({ date: u.date, qtyUsed: Number(u.qtyUsed || 0) }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const avgDaily = Number(
        it.avg_daily_usage ?? it.avgDailyUsage ?? movingAverageDaily(history, DEFAULTS.forecastWindowDays)
      );

      const ropBackend = it.reorder_point ?? it.reorderPoint;
      const ropCalc = Math.round(avgDaily * lead + safety);
      const rop = Number(ropBackend ?? ropCalc);

      const daysCover = daysUntil(onHand, avgDaily);
      const projected = projectOnHand(onHand, avgDaily, DEFAULTS.planningHorizonDays);

      const status = statusFromLevels({ 
        onHand, 
        rop, 
        maxLevel, 
        category: it.category, 
        name: it.name,
        productionCount: it.productionCount || 0,
        isMadeToOrder: it.isMadeToOrder || (it.category === 'finished' && (it.name.toLowerCase().includes('table') || it.name.toLowerCase().includes('chair'))),
        productionStatus: it.productionStatus || null,
        status: it.status || null,
        safetyStock: safety
      });

      const target = maxLevel || rop + safety;
      const suggestedOrderQty = (it.category === 'raw' && onHand <= rop) ? Math.max(0, Math.round(target - onHand)) : 0;

      const rawDaysToROP = (onHand - rop) / (avgDaily > 0 ? avgDaily : Infinity);
      const daysToROP = Number.isFinite(rawDaysToROP) ? Math.max(0, Math.ceil(rawDaysToROP)) : null;
      const etaReorderDate = safeEtaFromDays(daysToROP ?? NaN);

      return {
        ...it,
        category,
        onHand,
        avgDaily: Number(avgDaily.toFixed(2)),
        leadTimeDays: lead,
        safetyStock: safety,
        rop,
        daysCover: isFinite(daysCover) ? Number(daysCover.toFixed(1)) : "∞",
        projected,
        status,
        suggestedOrderQty,
        etaReorderDate,
        maxLevel,
        productionCount: it.production_count || 0,
        productionStatus: it.production_status || null,
      };
    });

    return rows.sort((a, b) => {
      const pri = { danger: 0, warning: 1, success: 2 };
      return (pri[a.status.variant] ?? 2) - (pri[b.status.variant] ?? 2);
    });
  }, [inventory, usage]);

  // Filters and grouping with product-specific filtering and tab-based filtering
  const filtered = useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    const type = filter.type;
    const product = filter.product;
    
    return enriched.filter((it) => {
      const matchesQ = !q || [it.name, it.sku, it.location, it.category, it.description].join(" ").toLowerCase().includes(q);
      const matchesType = type === "all" || 
        (type === "raw" && it.category.toLowerCase().includes("raw")) || 
        (type === "finished" && it.category.toLowerCase().includes("finished") && 
          !it.isMadeToOrder && 
          !it.name.toLowerCase().includes('table') && 
          !it.name.toLowerCase().includes('chair')) ||
        (type === "made-to-order" && (it.isMadeToOrder || 
          it.category.toLowerCase().includes("made-to-order") ||
          (it.category.toLowerCase().includes("finished") && (it.name.toLowerCase().includes('table') || it.name.toLowerCase().includes('chair')))));
      
      // Product-specific filtering
      let matchesProduct = true;
      if (product !== "all") {
        const itemText = [it.name, it.description, it.sku].join(" ").toLowerCase();
        if (product === "alkansya") {
          matchesProduct = itemText.includes("alkansya");
        } else if (product === "table") {
          matchesProduct = itemText.includes("table") || itemText.includes("dining");
        } else if (product === "chair") {
          matchesProduct = itemText.includes("chair");
        }
      }
      
      // Tab-based filtering
      let matchesTab = true;
      if (activeTab === 'raw') {
        matchesTab = it.category.toLowerCase().includes("raw");
      } else if (activeTab === 'finished') {
        matchesTab = it.category.toLowerCase().includes("finished") && 
          !it.isMadeToOrder && 
          !it.name.toLowerCase().includes('table') && 
          !it.name.toLowerCase().includes('chair');
      } else if (activeTab === 'made-to-order') {
        matchesTab = it.isMadeToOrder || 
          it.category.toLowerCase().includes("made-to-order") ||
          (it.category.toLowerCase().includes("finished") && (it.name.toLowerCase().includes('table') || it.name.toLowerCase().includes('chair')));
      }
      // For daily-output tab, show all items (no filtering)
      
      return matchesQ && matchesType && matchesProduct && matchesTab;
    });
  }, [enriched, filter, activeTab]);

  // Group materials by category - Raw Materials, Finished Goods, and Made-to-Order
  const groupedInventory = useMemo(() => {
    const raw = filtered.filter(item => item.category.toLowerCase().includes("raw"));
    const finished = filtered.filter(item => 
      item.category.toLowerCase().includes("finished") && 
      !item.isMadeToOrder && 
      !item.name.toLowerCase().includes('table') && 
      !item.name.toLowerCase().includes('chair')
    );
    const madeToOrder = filtered.filter(item => 
      item.isMadeToOrder || 
      item.category.toLowerCase().includes("made-to-order") ||
      (item.category.toLowerCase().includes("finished") && (item.name.toLowerCase().includes('table') || item.name.toLowerCase().includes('chair')))
    );
    return { raw, finished, madeToOrder };
  }, [filtered]);

  // Filter raw materials based on search and filters
  const filteredRawMaterials = useMemo(() => {
    let filtered = groupedInventory.raw || [];
    
    // Search filter
    if (rawMaterialsFilter.search) {
      const searchTerm = rawMaterialsFilter.search.toLowerCase();
      filtered = filtered.filter(item => 
        item.name?.toLowerCase().includes(searchTerm) ||
        item.sku?.toLowerCase().includes(searchTerm) ||
        item.location?.toLowerCase().includes(searchTerm) ||
        item.description?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Status filter
    if (rawMaterialsFilter.status !== "all") {
      filtered = filtered.filter(item => {
        if (rawMaterialsFilter.status === "low_stock") {
          return item.status?.variant === "warning" || item.status?.variant === "danger";
        } else if (rawMaterialsFilter.status === "in_stock") {
          return item.status?.variant === "success";
        } else if (rawMaterialsFilter.status === "out_of_stock") {
          return item.status?.variant === "danger";
        }
        return true;
      });
    }
    
    return filtered;
  }, [groupedInventory.raw, rawMaterialsFilter]);

  // CSV usage upload
  const onUploadUsage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const rows = parseUsageCSV(text);
      setUsage((prev) => [...prev, ...rows]);
      
      // Success toast notification
      toast.success("📊 Usage Data Imported Successfully!", {
        description: `${rows.length} usage records have been imported from the CSV file.`,
        duration: 4000,
        style: {
          background: '#f0fdf4',
          border: '1px solid #86efac',
          color: '#166534'
        }
      });
    } catch (err) {
      toast.error("❌ CSV Import Failed", {
        description: `Unable to import usage data: ${err.message}`,
        duration: 5000,
        style: {
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626'
        }
      });
    } finally {
      e.target.value = "";
    }
  };

  return (
    <AppLayout>
    <style>{customStyles}</style>
    <div className="container-fluid py-4" role="region" aria-labelledby="inv-heading">
      {/* Navigation Buttons */}
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-outline-secondary" onClick={() => navigate("/dashboard")}>
          ← Back to Dashboard
        </button>
        
      </div>


    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 id="inv-heading" className="mb-0">Inventory Management</h2>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-info" onClick={() => setShowAlkansyaModal(true)}>
            <i className="fas fa-piggy-bank me-2"></i>
            + Daily Alkansya Output
          </button>
          <button className="btn btn-success" onClick={handleAddMaterial}>
            + Add Material
          </button>
          <label className="btn btn-outline-success mb-0">
            Upload Usage CSV
            <input ref={fileInputRef} type="file" accept=".csv" onChange={onUploadUsage} hidden />
          </label>
        </div>
      </div>

      {/* Inventory Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small mb-1">Total Items</div>
              <div className="h3 mb-1 text-primary fw-bold">{inventory.length}</div>
              <div className="small text-muted">
                {groupedInventory.raw.length} raw • {groupedInventory.finished.length} finished
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small mb-1">Reorder Alerts</div>
              <div className="h3 mb-1 text-danger fw-bold">{inventory.filter(item => item.category === 'raw' && item.quantity_on_hand <= item.reorder_point).length}</div>
              <div className="small text-muted">
                {inventory.filter(item => item.category === 'raw' && item.quantity_on_hand <= item.reorder_point).length > 0 ? "Action required" : "All stocked"}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small mb-1">Low Stock</div>
              <div className="h3 mb-1 text-warning fw-bold">
                {inventory.filter(item => item.category === 'raw' && item.quantity_on_hand > item.reorder_point && item.quantity_on_hand <= (item.reorder_point * 1.5)).length}
              </div>
              <div className="small text-muted">Less than 14 days</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small mb-1">Total Finished Goods</div>
              <div className="h3 mb-1 text-success fw-bold">{groupedInventory.finished.length}</div>
              <div className="small text-muted">Mass-produced products</div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Tab Navigation - Simple Design */}
      <div className="mb-4">
        <div className="d-flex border-bottom bg-white rounded-top">
          <button 
            className={`btn btn-link text-decoration-none px-4 py-3 border-0 rounded-0 ${
              activeTab === 'raw' 
                ? 'text-primary border-bottom border-primary border-2 bg-light' 
                : 'text-muted'
            }`}
            onClick={() => setActiveTab('raw')}
            style={{
              fontWeight: activeTab === 'raw' ? '600' : '400'
            }}
          >
            <i className="fas fa-boxes me-2"></i>
            Raw Materials 
            <span className="badge bg-primary ms-2">{groupedInventory.raw.length}</span>
          </button>
          <button 
            className={`btn btn-link text-decoration-none px-4 py-3 border-0 rounded-0 ${
              activeTab === 'finished' 
                ? 'text-primary border-bottom border-primary border-2 bg-light' 
                : 'text-muted'
            }`}
            onClick={() => setActiveTab('finished')}
            style={{
              fontWeight: activeTab === 'finished' ? '600' : '400'
            }}
          >
            <i className="fas fa-check-circle me-2"></i>
            Finished Goods 
            <span className="badge bg-success ms-2">{groupedInventory.finished.length}</span>
          </button>
          <button 
            className={`btn btn-link text-decoration-none px-4 py-3 border-0 rounded-0 ${
              activeTab === 'made-to-order' 
                ? 'text-primary border-bottom border-primary border-2 bg-light' 
                : 'text-muted'
            }`}
            onClick={() => setActiveTab('made-to-order')}
            style={{
              fontWeight: activeTab === 'made-to-order' ? '600' : '400'
            }}
          >
            <i className="fas fa-hammer me-2"></i>
            Made-to-Order 
            <span className="badge bg-warning ms-2">{groupedInventory.madeToOrder.length}</span>
          </button>
          <button 
            className={`btn btn-link text-decoration-none px-4 py-3 border-0 rounded-0 ${
              activeTab === 'daily-output' 
                ? 'text-primary border-bottom border-primary border-2 bg-light' 
                : 'text-muted'
            }`}
            onClick={() => setActiveTab('daily-output')}
            style={{
              fontWeight: activeTab === 'daily-output' ? '600' : '400'
            }}
          >
            <i className="fas fa-piggy-bank me-2"></i>
            Daily Output
          </button>
        </div>
      </div>

      {/* Hidden Search and Filter - Functionality preserved but UI removed */}
      {activeTab === 'raw' && (
        <div style={{ display: 'none' }}>
          <input
            type="text"
            value={rawMaterialsFilter.search}
            onChange={(e) => setRawMaterialsFilter(prev => ({ ...prev, search: e.target.value }))}
          />
          <select
            value={rawMaterialsFilter.status}
            onChange={(e) => setRawMaterialsFilter(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">All Status</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
      )}

      {/* Hidden Search for Other Tabs - Functionality preserved but UI removed */}
      {(activeTab === 'finished' || activeTab === 'made-to-order') && (
        <div style={{ display: 'none' }}>
          <input
            type="text"
            value={rawMaterialsFilter.search}
            onChange={(e) => setRawMaterialsFilter(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>
      )}

      {loading && (
        <div className="alert alert-info">Loading inventory…</div>
      )}
      {error && (
        <div className="alert alert-danger">{error}</div>
      )}


      {/* Enhanced Raw Materials Tab Content */}
      {activeTab === 'raw' && (
        <div className="mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h5 className="mb-1 text-dark fw-semibold">
                <i className="fas fa-boxes me-2 text-primary"></i>
                Raw Materials
              </h5>
              <small className="text-muted">
                {groupedInventory.raw.length} raw materials
              </small>
            </div>
            <div className="d-flex gap-2">
              <span className="badge bg-primary fs-6">{groupedInventory.raw.length} total</span>
            </div>
          </div>
          
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="py-3 px-3 fw-semibold">SKU</th>
                    <th className="py-3 px-3 fw-semibold">Name</th>
                    <th className="py-3 px-3 fw-semibold">Location</th>
                    <th className="py-3 px-3 fw-semibold text-end">Current Stock</th>
                    <th className="py-3 px-3 fw-semibold text-end">Reorder Point</th>
                    <th className="py-3 px-3 fw-semibold text-end">Daily Use</th>
                    <th className="py-3 px-3 fw-semibold">Status</th>
                    <th className="py-3 px-3 fw-semibold text-end">Reorder Qty</th>
                    <th className="py-3 px-3 fw-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRawMaterials.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-5">
                        <div className="text-muted">
                          <i className="fas fa-search fa-2x mb-3 d-block"></i>
                          <h6>No raw materials found</h6>
                          <small>
                            {rawMaterialsFilter.search || rawMaterialsFilter.status !== "all" 
                              ? "Try adjusting your search or filters" 
                              : "No raw materials available"
                            }
                          </small>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRawMaterials.map((item) => (
                      <tr key={item.id || item.sku}>
                        <td className="py-3 px-3">
                          <code className="small bg-light px-2 py-1 rounded">{item.sku}</code>
                        </td>
                        <td className="py-3 px-3">
                          <div className="fw-semibold text-dark">{item.name}</div>
                          {item.description && (
                            <small className="text-muted">{item.description.substring(0, 50)}...</small>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <small className="text-muted">
                            <i className="fas fa-map-marker-alt me-1"></i>
                            {item.location}
                          </small>
                        </td>
                        <td className="py-3 px-3 text-end">
                          <div className="fw-bold text-dark">{item.onHand}</div>
                          <small className="text-muted">{item.unit}</small>
                        </td>
                        <td className="py-3 px-3 text-end">
                          <div className="fw-semibold text-info">{item.rop}</div>
                          <small className="text-muted">reorder at</small>
                        </td>
                        <td className="py-3 px-3 text-end">
                          <div className="fw-semibold">{item.avgDaily}</div>
                          <small className="text-muted">per day</small>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`badge bg-${item.status.variant} px-2 py-1`}>
                            {item.status.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-end">
                          {item.suggestedOrderQty > 0 ? (
                            <div className="fw-bold text-danger">{item.suggestedOrderQty}</div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="d-flex gap-1 align-items-center">
                            <button 
                              className="btn btn-sm btn-action"
                              onClick={() => handleEditMaterial(item)}
                              title="Edit Material"
                              style={{ minWidth: '32px', height: '32px', padding: '6px' }}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button 
                              className="btn btn-sm btn-action"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteMaterial(item.id, e);
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                              title="Delete Material"
                              style={{ minWidth: '32px', height: '32px', padding: '6px' }}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* FINISHED GOODS TAB */}
      {activeTab === 'finished' && (
        <div className="mb-4">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="mb-0">✅ Finished Goods</h5>
            <span className="badge bg-success">{groupedInventory.finished.length} items</span>
          </div>
          
          <div className="card shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Location</th>
                    <th className="text-end">Stock</th>
                    <th className="text-end">Unit Cost</th>
                    <th className="text-end">Total Value</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedInventory.finished.map((item) => (
                    <tr key={item.id || item.sku}>
                      <td><code className="small">{item.sku}</code></td>
                      <td>
                        <div>{item.name}</div>
                        {item.description && <small className="text-muted">{item.description.substring(0, 40)}...</small>}
                      </td>
                      <td><small>{item.location}</small></td>
                      <td className="text-end">
                        <strong>{item.onHand}</strong> <small className="text-muted">{item.unit}</small>
                      </td>
                      <td className="text-end">₱{(item.unit_cost || 0).toLocaleString()}</td>
                      <td className="text-end">₱{((item.unit_cost || 0) * item.onHand).toLocaleString()}</td>
                      <td>
                        <span className={`badge bg-${item.status.variant}`}>
                          {item.status.label}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <button 
                            className="btn btn-sm btn-action"
                            onClick={() => handleEditMaterial(item)}
                            title="Edit Material"
                            style={{ minWidth: '32px', height: '32px', padding: '6px' }}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button 
                            className="btn btn-sm btn-action"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteMaterial(item.id, e);
                            }}
                            onMouseDown={(e) => e.preventDefault()}
                            title="Delete Material"
                            style={{ minWidth: '32px', height: '32px', padding: '6px' }}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MADE-TO-ORDER TAB */}
      {activeTab === 'made-to-order' && (
        <div className="mb-4">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="mb-0">🔨 Made-to-Order Products</h5>
            <div className="d-flex align-items-center gap-2">
              {(() => {
                const totalInProduction = groupedInventory.madeToOrder.reduce((sum, item) => sum + (item.productionCount || 0), 0);
                return (
                  <>
                    {totalInProduction > 0 && (
                      <span className="badge bg-primary">
                        <i className="fas fa-cog fa-spin me-1"></i>
                        {totalInProduction} Order{totalInProduction > 1 ? 's' : ''} in Production
                      </span>
                    )}
                    <span className="badge bg-warning">{groupedInventory.madeToOrder.length} items</span>
                  </>
                );
              })()}
            </div>
          </div>
          
          <div className="card shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Location</th>
                    <th className="text-end">Stock</th>
                    <th className="text-end">Unit Cost</th>
                    <th>Production Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedInventory.madeToOrder.map((item) => (
                    <tr key={item.id || item.sku}>
                      <td><code className="small">{item.sku}</code></td>
                      <td>
                        <div>{item.name}</div>
                        {item.description && <small className="text-muted">{item.description.substring(0, 40)}...</small>}
                      </td>
                      <td><small>{item.location}</small></td>
                      <td className="text-end">
                        <strong>{item.onHand}</strong> <small className="text-muted">{item.unit}</small>
                      </td>
                      <td className="text-end">₱{(item.unit_cost || 0).toLocaleString()}</td>
                      <td className="text-center">
                        <div className="d-flex flex-column align-items-center">
                          <span className={`badge bg-${item.status.variant} mb-1`}>
                            {item.status.label}
                          </span>
                          {item.productionCount > 0 && (
                            <div className="text-center">
                              <small className="text-primary fw-bold">
                                {item.productionCount} Order{item.productionCount > 1 ? 's' : ''} in Production
                              </small>
                              <br />
                              <small className="text-muted">
                                {item.productionStatus === 'in_production' ? 'Active Production' : 'Processing'}
                              </small>
                            </div>
                          )}
                          {item.productionCount === 0 && item.status.label === 'No Production' && (
                            <small className="text-muted">
                              No active orders
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <button 
                            className="btn btn-sm btn-action"
                            onClick={() => handleEditMaterial(item)}
                            title="Edit Material"
                            style={{ minWidth: '32px', height: '32px', padding: '6px' }}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button 
                            className="btn btn-sm btn-action"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteMaterial(item.id, e);
                            }}
                            onMouseDown={(e) => e.preventDefault()}
                            title="Delete Material"
                            style={{ minWidth: '32px', height: '32px', padding: '6px' }}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DAILY OUTPUT TAB */}
      {activeTab === 'daily-output' && (
        <div className="mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h5 className="mb-1 text-dark fw-semibold">
                <i className="fas fa-piggy-bank me-2 text-info"></i>
                Daily Alkansya Output
              </h5>
              <small className="text-muted">
                Track daily production and manage Alkansya inventory
              </small>
            </div>
            <button 
              className="btn btn-info"
              onClick={() => setShowAlkansyaModal(true)}
            >
              <i className="fas fa-plus me-2"></i>
              Add Daily Output
            </button>
          </div>
          
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <div className="h3 text-primary mb-2">{alkansyaStats.totalOutput}</div>
                  <div className="small text-muted fw-semibold">Total Output</div>
                  <div className="small text-muted">All time production</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <div className="h3 text-success mb-2">{alkansyaStats.averageDaily}</div>
                  <div className="small text-muted fw-semibold">Avg Daily</div>
                  <div className="small text-muted">Per day average</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <div className="h3 text-info mb-2">{alkansyaStats.last7Days}</div>
                  <div className="small text-muted fw-semibold">Last 7 Days</div>
                  <div className="small text-muted">Recent production</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <div className="h3 text-warning mb-2">{alkansyaStats.productionDays}</div>
                  <div className="small text-muted fw-semibold">Production Days</div>
                  <div className="small text-muted">Active days</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card shadow-sm border-0">
            <div className="card-header bg-info text-white">
              <h6 className="mb-0">
                <i className="fas fa-chart-line me-2"></i>
                Production Overview
              </h6>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="d-flex align-items-center">
                    <div className="bg-primary bg-opacity-10 rounded-circle p-3 me-3">
                      <i className="fas fa-piggy-bank text-primary"></i>
                    </div>
                    <div>
                      <div className="fw-semibold">Current Alkansya Stock</div>
                      <div className="h5 text-primary mb-0">
                        {(() => {
                          const alkansyaItem = inventory.find(item => 
                            item.name.toLowerCase().includes('alkansya') && 
                            item.category === 'finished'
                          );
                          return alkansyaItem ? alkansyaItem.quantity_on_hand || 0 : 0;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center">
                    <div className="bg-success bg-opacity-10 rounded-circle p-3 me-3">
                      <i className="fas fa-trending-up text-success"></i>
                    </div>
                    <div>
                      <div className="fw-semibold">Production Efficiency</div>
                      <div className="h5 text-success mb-0">
                        {alkansyaStats.productionDays > 0 ? 
                          Math.round((alkansyaStats.totalOutput / alkansyaStats.productionDays) * 100) / 100 : 0
                        } per day
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* No Results Message */}
      {filtered.length === 0 && !loading && (
        <div className="alert alert-info text-center">
          <h5>No items found</h5>
          <p className="mb-2">Try adjusting your filters or add new materials</p>
          <button className="btn btn-primary btn-sm" onClick={handleAddMaterial}>
            + Add Material
          </button>
        </div>
      )}

      {/* Material Management Modal */}
      <MaterialModal
        show={showModal}
        onHide={() => setShowModal(false)}
        material={editingMaterial}
        onSave={handleSaveMaterial}
      />

      {/* Alkansya Daily Output Modal */}
      <AlkansyaDailyOutputModal
        show={showAlkansyaModal}
        onHide={() => setShowAlkansyaModal(false)}
        onSuccess={() => {
          fetchInventory();
          fetchAlkansyaStats();
        }}
      />


      
    </div>
     </div>
    </AppLayout>
  );
};

export default InventoryPage;