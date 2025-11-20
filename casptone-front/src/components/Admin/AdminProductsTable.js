import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../../api/client";
import { toast } from "sonner";
import "bootstrap/dist/css/bootstrap.min.css";
import "./admin_products.css";

const AdminProductsTable = () => {
  const [products, setProducts] = useState([]);
  
  // Function to format quantity for display - remove unnecessary decimal places
  const formatQuantity = (qty) => {
    if (qty == null || qty === '') return '';
    const num = parseFloat(qty);
    if (isNaN(num)) return qty;
    
    // If it's a whole number, display without decimals
    if (num === Math.floor(num)) {
      return num.toString();
    }
    
    // For decimal numbers, remove trailing zeros
    return num.toString().replace(/\.?0+$/, '');
  };
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    image: "",
  });
  const [deleteId, setDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const [showBomModal, setShowBomModal] = useState(false);
  const [bom, setBom] = useState([]); // [{inventory_item_id, qty_per_unit}]
  const [materials, setMaterials] = useState([]); // inventory list for picker
  const [materialQuery, setMaterialQuery] = useState("");
  const [bomError, setBomError] = useState("");
  const [showBulkPicker, setShowBulkPicker] = useState(false);
  const [bulkQuery, setBulkQuery] = useState("");
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]); // number[]
  
  // Price Calculator States
  const [priceCalculation, setPriceCalculation] = useState(null);
  const [laborPercentage, setLaborPercentage] = useState(30);
  const [profitMargin, setProfitMargin] = useState(25);
  const [calculating, setCalculating] = useState(false);

  // Token and headers are handled by api client

  const fetchProducts = async () => {
    try {
      const response = await api.get("/products");
      setProducts(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openBomModal = async (product) => {
    setSelectedProduct(product);
    setBomError("");
    setPriceCalculation(null); // Reset price calculation
    try {
      const [invRes, bomRes] = await Promise.all([
        api.get("/inventory"),
        api.get(`/products/${product.id}/materials`),
      ]);
      setMaterials(invRes.data || []);
      setBom(bomRes.data || []);
      setShowBomModal(true);
    } catch (e) {
      console.error(e);
    }
  };

  const selectedIds = useMemo(() => new Set(bom.map(r => r.inventory_item_id).filter(Boolean)), [bom]);
  const filteredMaterials = useMemo(() => {
    const q = materialQuery.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter(m =>
      String(m.sku || "").toLowerCase().includes(q) ||
      String(m.name || "").toLowerCase().includes(q)
    );
  }, [materials, materialQuery]);

  const addBomRow = () => setBom((prev) => [...prev, { inventory_item_id: "", qty_per_unit: 1 }]);
  const removeBomRow = (idx) => setBom((prev) => prev.filter((_, i) => i !== idx));
  const updateBomRow = (idx, field, value) => setBom((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const toggleBulkId = (id) => {
    setBulkSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const bulkAdd = () => {
    setBom(prev => {
      const existing = new Set(prev.map(p => p.inventory_item_id).filter(Boolean));
      const toAdd = bulkSelectedIds.filter(id => !existing.has(id));
      const rows = toAdd.map(id => ({ inventory_item_id: id, qty_per_unit: 1 }));
      return [...prev, ...rows];
    });
    setShowBulkPicker(false);
    setBulkSelectedIds([]);
    setBulkQuery("");
  };

  const validateBom = () => {
    const ids = [];
    for (const row of bom) {
      if (!row.inventory_item_id) return "Please select a material for every row.";
      if (!row.qty_per_unit || row.qty_per_unit <= 0) return "Quantity must be at least 1 for all rows.";
      ids.push(row.inventory_item_id);
    }
    // Check for duplicates
    const hasDup = ids.some((id, idx) => ids.indexOf(id) !== idx);
    if (hasDup) return "Duplicate materials are not allowed.";
    return "";
  };

  const saveBom = async () => {
    const err = validateBom();
    if (err) { setBomError(err); return; }
    try {
      await api.post(`/products/${selectedProduct.id}/materials`, { materials: bom });
      setShowBomModal(false);
    } catch (e) {
      console.error(e);
      setBomError("Failed to save BOM");
    }
  };

  // Calculate price based on BOM
  const calculatePrice = useCallback(async () => {
    if (bom.length === 0) {
      setPriceCalculation(null);
      return;
    }

    setCalculating(true);
    try {
      const materialsForCalc = bom
        .filter(row => row.inventory_item_id && row.qty_per_unit > 0)
        .map(row => {
          const material = materials.find(m => m.id === row.inventory_item_id);
          return {
            sku: material?.sku,
            quantity: row.qty_per_unit
          };
        })
        .filter(m => m.sku);

      if (materialsForCalc.length === 0) {
        setPriceCalculation(null);
        return;
      }

      const response = await api.post('/price-calculator/calculate', {
        materials: materialsForCalc,
        labor_percentage: laborPercentage,
        profit_margin: profitMargin
      });

      setPriceCalculation(response.data);
    } catch (error) {
      console.error('Error calculating price:', error);
    } finally {
      setCalculating(false);
    }
  }, [bom, materials, laborPercentage, profitMargin]);

  // Auto-calculate when BOM changes
  useEffect(() => {
    if (showBomModal && bom.length > 0) {
      const timer = setTimeout(() => calculatePrice(), 500);
      return () => clearTimeout(timer);
    }
  }, [bom, laborPercentage, profitMargin, showBomModal, calculatePrice]);

  // Apply suggested price to product
  const applySuggestedPrice = async () => {
    if (!priceCalculation || !selectedProduct) return;
    
    const suggestedPrice = Math.round(priceCalculation.suggested_price);
    
    try {
      const response = await api.put(`/products/${selectedProduct.id}`, {
        price: suggestedPrice
      });
      
      if (response.status === 200) {
        toast.success("💰 Price Updated Successfully!", {
          description: `Product price has been updated to ₱${suggestedPrice}`,
          duration: 4000,
          style: {
            background: '#f0fdf4',
            border: '1px solid #86efac',
            color: '#166534'
          }
        });
        fetchProducts();
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error updating price:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      toast.error("💸 Price Update Failed", {
        description: `Unable to update price: ${errorMessage}`,
        duration: 5000,
        style: {
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626'
        }
      });
    }
  };

  // Export and import functions are available but not currently used in the UI
  // const exportBom = async () => { ... };
  // const importBom = async (file) => { ... };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setFormData(product);
    setShowEditModal(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setDeleteError("");
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/products/${deleteId}`);
      const deletedProduct = products.find(p => p.id === deleteId);
      setProducts(products.filter((product) => product.id !== deleteId));
      setShowDeleteModal(false);
      toast.success("🗑️ Product Deleted Successfully!", {
        description: `"${deletedProduct?.name || 'Product'}" has been removed from the catalog.`,
        duration: 4000,
        style: {
          background: '#f0fdf4',
          border: '1px solid #86efac',
          color: '#166534'
        }
      });
    } catch (error) {
      setDeleteError(
        "Error: This product is linked to an order and cannot be deleted."
      );
      console.error("Error deleting product:", error);
      toast.error("🚫 Product Deletion Failed", {
        description: "This product is linked to an order and cannot be deleted.",
        duration: 5000,
        style: {
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626'
        }
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = async () => {
    try {
      await api.put(
        `/products/${selectedProduct.id}`,
        formData
      );
      setShowEditModal(false);
      fetchProducts();
      toast.success("✏️ Product Updated Successfully!", {
        description: `"${formData.name}" has been updated in the product catalog.`,
        duration: 4000,
        style: {
          background: '#f0fdf4',
          border: '1px solid #86efac',
          color: '#166534'
        }
      });
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("❌ Product Update Failed", {
        description: "Unable to update the product. Please try again.",
        duration: 4000,
        style: {
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626'
        }
      });
    }
  };

  return (
    <div className="products-container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Products</h5>
        <button className="btn btn-outline-secondary btn-sm" onClick={fetchProducts}>Refresh</button>
      </div>
      {loading ? (
        <p>Loading products...</p>
      ) : (
        <div className="row g-4">
          {products.map((product) => (
            <div key={product.id} className="col-md-3 col-sm-6">
              <div className="card h-100 shadow-sm border-0">
                {product.image ? (
                <img
                  src={`http://localhost:8000/${product.image}`}
                  alt={product.name}
                  className="card-img-top"
                  style={{ height: "200px", objectFit: "cover" }}
                />
              ) : (
                <div
                  className="d-flex align-items-center justify-content-center bg-light"
                  style={{ height: "200px" }}
                >
                  No image
                </div>
              )}

                <div className="card-body d-flex flex-column">
                  <h5 className="card-title text-truncate">{product.name}</h5>
                  <p className="card-text small text-muted">
                    {product.description}
                  </p>
                  <div className="mb-1">
                    <p className="fw-bold mb-0">₱{product.price?.toLocaleString()}</p>
                    {product.is_bom_priced && (
                      <small className="text-success">
                        <i className="fas fa-calculator me-1"></i>BOM-calculated price
                      </small>
                    )}
                  </div>
                  <div className="mb-2">
                    {product.inventory_stock !== null && product.inventory_stock !== undefined ? (
                      <>
                        <p className="mb-1">
                          <span className="badge bg-success">Inventory Stock: {product.inventory_stock}</span>
                        </p>
                        {product.inventory_sku && (
                          <p className="text-muted small mb-0">
                            SKU: {product.inventory_sku} • {product.inventory_location}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-secondary small mb-0">
                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}
                      </p>
                    )}
                  </div>
                  <div className="mt-auto d-flex justify-content-between gap-2">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => openBomModal(product)}
                    >
                      Manage BOM
                    </button>
                    <button
                      className="btn btn-warning btn-sm"
                      onClick={() => handleEdit(product)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(product.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteError && (
        <div className="alert alert-danger mt-2">{deleteError}</div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Product</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowEditModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control mb-2"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Name"
                />
                <textarea
                  className="form-control mb-2"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Description"
                />
                <input
                  type="number"
                  className="form-control mb-2"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  placeholder="Price"
                />
                <input
                  type="number"
                  className="form-control mb-2"
                  name="stock"
                  value={formData.stock}
                  onChange={handleInputChange}
                  placeholder="Stock"
                />
                <input
                  type="text"
                  className="form-control mb-2"
                  name="image"
                  value={formData.image}
                  onChange={handleInputChange}
                  placeholder="Image URL"
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm Deletion</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowDeleteModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete this product?</p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={confirmDelete}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOM Modal */}
      {showBomModal && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Manage Bill of Materials — {selectedProduct?.name}</h5>
                <button type="button" className="btn-close" onClick={() => setShowBomModal(false)}></button>
              </div>
              <div className="modal-body">
                {/* Bulk picker toggle */}
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="input-group input-group-sm" style={{maxWidth: 320}}>
                    <span className="input-group-text">Search materials</span>
                    <input className="form-control" value={materialQuery} onChange={(e)=>setMaterialQuery(e.target.value)} placeholder="Search by SKU or name" />
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary btn-sm" onClick={()=>setShowBulkPicker(s=>!s)}>
                      {showBulkPicker ? "Close Bulk Add" : "Bulk Add Materials"}
                    </button>
                    
                  </div>
                </div>

                {showBulkPicker && (
                  <div className="card mb-3 border-success">
                    <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                      <strong>Select Materials</strong>
                      <span className="badge bg-light text-dark">{bulkSelectedIds.length} selected</span>
                    </div>
                    <div className="card-body" style={{maxHeight: 300, overflowY: 'auto'}}>
                      <div className="mb-2">
                        <input 
                          className="form-control form-control-sm" 
                          value={bulkQuery} 
                          onChange={(e)=>setBulkQuery(e.target.value)} 
                          placeholder="Search materials..." 
                        />
                      </div>
                      <div className="row">
                        {materials
                          .filter(m => !selectedIds.has(m.id))
                          .filter(m => {
                            const q = bulkQuery.trim().toLowerCase();
                            if (!q) return true;
                            return String(m.sku||"").toLowerCase().includes(q) || String(m.name||"").toLowerCase().includes(q);
                          })
                          .map(m => (
                            <div key={m.id} className="col-md-6 mb-2">
                              <div className="form-check">
                                <input 
                                  className="form-check-input" 
                                  type="checkbox" 
                                  id={`m-${m.id}`} 
                                  checked={bulkSelectedIds.includes(m.id)} 
                                  onChange={()=>toggleBulkId(m.id)} 
                                />
                                <label className="form-check-label" htmlFor={`m-${m.id}`}>
                                  <strong>{m.name}</strong>
                                  <div className="small text-muted">{m.sku} - {m.unit}</div>
                                </label>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="card-footer d-flex justify-content-end gap-2">
                      <button 
                        className="btn btn-sm btn-secondary" 
                        onClick={()=>{setShowBulkPicker(false); setBulkSelectedIds([]);}}
                      >
                        Cancel
                      </button>
                      <button 
                        className="btn btn-sm btn-success" 
                        onClick={bulkAdd} 
                        disabled={bulkSelectedIds.length===0}
                      >
                        Add {bulkSelectedIds.length} Material{bulkSelectedIds.length !== 1 ? 's' : ''}
                      </button>
                    </div>
                  </div>
                )}

                {bomError && <div className="alert alert-warning py-2">{bomError}</div>}

                {bom.length === 0 ? (
                  <div className="alert alert-light text-center">
                    <p className="mb-0 text-muted">No materials added. Click "Bulk Add Materials" or "+ Add Material" to start.</p>
                  </div>
                ) : (
                  <table className="table table-bordered table-hover table-sm align-middle mb-3">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '60%' }}>Material</th>
                        <th style={{ width: '30%' }}>Quantity per Unit</th>
                        <th style={{ width: '10%' }} className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bom.map((row, idx) => {
                        const material = materials.find(m => m.id === row.inventory_item_id);
                        return (
                          <tr key={idx}>
                            <td className="align-middle">
                              {material ? (
                                <>
                                  <strong>{material.name}</strong>
                                  <div className="small text-muted">{material.sku} - {material.unit}</div>
                                </>
                              ) : (
                                <select
                                  className="form-select form-select-sm"
                                  value={row.inventory_item_id}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (val && selectedIds.has(val) && val !== row.inventory_item_id) {
                                      toast.warning("⚠️ Duplicate Material", {
                                        description: "This material is already selected in another row.",
                                        duration: 3000,
                                        style: {
                                          background: '#fef3c7',
                                          border: '1px solid #fbbf24',
                                          color: '#92400e'
                                        }
                                      });
                                      return;
                                    }
                                    updateBomRow(idx, 'inventory_item_id', val);
                                  }}
                                >
                                  <option value="">-- Select material --</option>
                                  {filteredMaterials.map((m) => (
                                    <option key={m.id} value={m.id} disabled={selectedIds.has(m.id) && m.id !== row.inventory_item_id}>
                                      {m.name} ({m.sku}) - {m.unit}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="align-middle">
                              <input 
                                type="number" 
                                className="form-control form-control-sm" 
                                style={{ maxWidth: '120px' }}
                                min="0.001"
                                step="0.001"
                                value={formatQuantity(row.qty_per_unit)}
                                onChange={(e) => updateBomRow(idx, 'qty_per_unit', Number(e.target.value))} 
                              />
                            </td>
                            <td className="align-middle text-center">
                              <button 
                                className="btn btn-outline-danger btn-sm" 
                                onClick={() => removeBomRow(idx)}
                                title="Remove material"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-secondary btn-sm" onClick={addBomRow}>+ Add Material</button>
                </div>

                {/* Price Calculator Section */}
                {bom.length > 0 && (
                  <div className="mt-4">
                    <hr />
                    <h6 className="mb-3">💰 Price Calculator</h6>
                    
                    {/* Pricing Controls */}
                    <div className="row g-2 mb-3">
                      <div className="col-md-3">
                        <label className="form-label small">Preset</label>
                        <select 
                          className="form-select form-select-sm"
                          onChange={(e) => {
                            const presets = {
                              alkansya: { labor: 25, profit: 30 },
                              table: { labor: 40, profit: 35 },
                              chair: { labor: 35, profit: 30 },
                              custom: { labor: 30, profit: 25 }
                            };
                            const preset = presets[e.target.value];
                            if (preset) {
                              setLaborPercentage(preset.labor);
                              setProfitMargin(preset.profit);
                            }
                          }}
                        >
                          <option value="custom">Custom</option>
                          <option value="alkansya">Alkansya (25% labor, 30% profit)</option>
                          <option value="table">Table (40% labor, 35% profit)</option>
                          <option value="chair">Chair (35% labor, 30% profit)</option>
                        </select>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small">Labor %</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={laborPercentage}
                          onChange={(e) => setLaborPercentage(Number(e.target.value))}
                          min="0"
                          max="100"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small">Profit %</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={profitMargin}
                          onChange={(e) => setProfitMargin(Number(e.target.value))}
                          min="0"
                          max="100"
                        />
                      </div>
                      <div className="col-md-3 d-flex align-items-end">
                        <button 
                          className="btn btn-primary btn-sm w-100"
                          onClick={calculatePrice}
                          disabled={calculating}
                        >
                          {calculating ? 'Calculating...' : 'Calculate Price'}
                        </button>
                      </div>
                    </div>

                    {/* Price Breakdown Display */}
                    {priceCalculation && (
                      <div className="card border-success">
                        <div className="card-header bg-success text-white">
                          <strong>💰 Suggested Pricing</strong>
                        </div>
                        <div className="card-body">
                          <table className="table table-sm mb-0">
                            <tbody>
                              <tr>
                                <td>Material Cost:</td>
                                <td className="text-end">
                                  <strong>₱{priceCalculation.material_cost.toFixed(2)}</strong>
                                </td>
                              </tr>
                              <tr>
                                <td>Labor ({priceCalculation.labor_percentage}%):</td>
                                <td className="text-end">₱{priceCalculation.labor_cost.toFixed(2)}</td>
                              </tr>
                              <tr className="table-active">
                                <td><strong>Production Cost:</strong></td>
                                <td className="text-end">
                                  <strong>₱{priceCalculation.production_cost.toFixed(2)}</strong>
                                </td>
                              </tr>
                              <tr>
                                <td>Profit ({priceCalculation.profit_margin}%):</td>
                                <td className="text-end text-success">
                                  +₱{priceCalculation.profit_amount.toFixed(2)}
                                </td>
                              </tr>
                              <tr className="table-success">
                                <td><strong>Suggested Selling Price:</strong></td>
                                <td className="text-end">
                                  <strong className="fs-5 text-success">
                                    ₱{Math.round(priceCalculation.suggested_price).toLocaleString()}
                                  </strong>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                          
                          <div className="mt-3 d-flex gap-2">
                            <button
                              className="btn btn-success btn-sm flex-grow-1"
                              onClick={applySuggestedPrice}
                              disabled={calculating}
                            >
                              {calculating ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                  Calculating...
                                </>
                              ) : (
                                <>
                                  ✓ Update Product Price to ₱{Math.round(priceCalculation.suggested_price).toLocaleString()}
                                </>
                              )}
                            </button>
                          </div>

                          <div className="mt-2 p-2 bg-light rounded">
                            <small className="text-muted">
                              <strong>Break-even:</strong> ₱{priceCalculation.production_cost.toFixed(2)} • 
                              <strong> Profit Margin:</strong> {((priceCalculation.profit_amount / priceCalculation.production_cost) * 100).toFixed(1)}%
                            </small>
                          </div>
                        </div>
                      </div>
                    )}

                    {calculating && (
                      <div className="alert alert-info">
                        <div className="spinner-border spinner-border-sm me-2"></div>
                        Calculating price...
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowBomModal(false)}>Close</button>
                <button className="btn btn-primary" onClick={saveBom} disabled={!!validateBom()}>Save Materials</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductsTable;