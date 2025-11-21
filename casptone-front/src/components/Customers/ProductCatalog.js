// src/components/ProductCatalog.js

import React, { useState, memo, useCallback, useMemo, useEffect } from "react";

import { Form } from "react-bootstrap";

import axios from "axios";

import { motion, AnimatePresence } from "framer-motion";

import { toast } from "sonner";

import BuyNowModal from "./BuyNowModal";

import { formatPrice } from "../../utils/currency";

import "./product_catalog.css";



const ProductCatalog = ({ products, searchTerm = "" }) => {

  const [showModal, setShowModal] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState(null);

  const [quantity, setQuantity] = useState(1);

  const [loadingProducts, setLoadingProducts] = useState(new Set());

  const [error, setError] = useState(null);

  const [showToast, setShowToast] = useState(false);

  const [toastMessage, setToastMessage] = useState("");

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  

  // Buy Now modal states

  const [showBuyNowModal, setShowBuyNowModal] = useState(false);

  const [buyNowProduct, setBuyNowProduct] = useState(null);

  

  // Modal positioning states (not used - modals are centered with CSS)

  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });

  const [buyNowModalPosition, setBuyNowModalPosition] = useState({ x: 0, y: 0 });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterDropdown && !event.target.closest('.filter-dropdown-wrapper')) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterDropdown]);

  // Filter products based on search term and category
  const filteredProducts = useMemo(() => {

    if (!products || products.length === 0) return [];

    let filtered = products.filter((product) => {

      const productName = product.product_name || product.name || '';

      const matchesSearch = productName.toLowerCase().includes(searchTerm.toLowerCase());

      

      // Show all products regardless of availability status

      // Availability will be handled in the UI (disabled buttons, etc.)

      return matchesSearch;

    });

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => {
        const name = (product.product_name || product.name || '').toLowerCase();
        const categoryName = (product.category_name || '').toLowerCase();
        
        switch (selectedCategory) {
          case 'chairs':
            return name.includes('chair') || name.includes('wooden chair') || name.includes('square back chair');
          case 'tables':
            return name.includes('table') || name.includes('dining table');
          case 'alkansya':
            return name.includes('alkansya') || categoryName === 'stocked products';
          case 'made_to_order':
            return categoryName === 'made to order' || categoryName === 'made_to_order';
          default:
            return true;
        }
      });
    }

    return filtered;

  }, [products, searchTerm, selectedCategory]);

  // Group products by category when showing all
  const groupedProducts = useMemo(() => {
    if (selectedCategory !== 'all') {
      return { filtered: filteredProducts };
    }

    const alkansyaProducts = filteredProducts.filter(product => {
      const name = (product.product_name || product.name || '').toLowerCase();
      const categoryName = (product.category_name || '').toLowerCase();
      return name.includes('alkansya') || categoryName === 'stocked products';
    });

    const madeToOrderProducts = filteredProducts.filter(product => {
      const categoryName = (product.category_name || '').toLowerCase();
      return categoryName === 'made to order' || categoryName === 'made_to_order';
    });

    return { alkansya: alkansyaProducts, madeToOrder: madeToOrderProducts };
  }, [filteredProducts, selectedCategory]);





  const handleShowModal = useCallback((product, event) => {

    setSelectedProduct(product);

    

    // Set initial quantity based on product type

    const productName = (product.name || product.product_name || '').toLowerCase();

    const categoryName = product.category_name || '';

    const isMadeToOrderDiningTable = 

      (categoryName === 'Made to Order' || categoryName === 'made_to_order') &&

      productName.includes('dining table');

    

    // Fixed to 1 for made-to-order Dining Table

    setQuantity(isMadeToOrderDiningTable ? 1 : 1);

    

    // Always center the modal on the screen

    setModalPosition({

      x: window.innerWidth / 2,

      y: window.innerHeight / 2

    });

    

    setShowModal(true);

  }, []);



  const handleCloseModal = () => {

    setShowModal(false);

    setError(null);

  };



  // Buy Now handlers

  const handleBuyNow = useCallback((product, event) => {

    setBuyNowProduct(product);

    

    // Always center the modal on the screen

    setBuyNowModalPosition({

      x: window.innerWidth / 2,

      y: window.innerHeight / 2

    });

    

    setShowBuyNowModal(true);

    // Close the view details modal if it's open

    if (showModal) {

      setShowModal(false);

    }

  }, [showModal]);



  const handleCloseBuyNowModal = () => {

    setShowBuyNowModal(false);

    setBuyNowProduct(null);

  };



  const handleOrderSuccess = (orderData) => {

    toast.success("Order placed successfully!", {

      description: `Your order has been placed and will appear in the admin dashboard.`,

      duration: 5000

    });

  };



  const handleAddToCart = async () => {

    if (!selectedProduct) return;

    

    // Validate quantity limits

    const productName = (selectedProduct.name || selectedProduct.product_name || '').toLowerCase();

    const categoryName = selectedProduct.category_name || '';

    const isMadeToOrderDiningTable = 

      (categoryName === 'Made to Order' || categoryName === 'made_to_order') &&

      productName.includes('dining table');

    const isWoodenChair = productName.includes('wooden chair');

    

    // Enforce quantity limits - always use quantity 1 for Dining Table

    let finalQuantity = quantity;

    if (isMadeToOrderDiningTable) {

      finalQuantity = 1;

    }

    

    if (isWoodenChair && quantity > 4) {

      setError("Wooden Chair maximum quantity is 4");

      setQuantity(4);

      return;

    }

    

    // Add this product to loading set

    setLoadingProducts(prev => new Set(prev).add(selectedProduct.id));

    setError(null);



    try {

      const token = localStorage.getItem("token");

      if (!token) {

        setError("You need to be logged in to add to cart.");

        setLoadingProducts(prev => {

          const newSet = new Set(prev);

          newSet.delete(selectedProduct.id);

          return newSet;

        });

        return;

      }



      await axios.post(

        "http://localhost:8000/api/cart",

        {

          product_id: selectedProduct.id,

          quantity: finalQuantity,

        },

        {

          headers: { Authorization: `Bearer ${token}` },

        }

      );



      // Show success toast

      toast.success(`${selectedProduct.name} added to cart!`);

      

      // Dispatch custom event to update cart count in header (non-blocking)

      setTimeout(() => {

        window.dispatchEvent(new CustomEvent('cartUpdated'));

      }, 0);

      

      handleCloseModal();

    } catch (err) {

      setError(err.response?.data?.message || "Something went wrong");

    } finally {

      // Remove this product from loading set

      setLoadingProducts(prev => {

        const newSet = new Set(prev);

        newSet.delete(selectedProduct.id);

        return newSet;

      });

    }

  };



  const handleAddToCartDirect = useCallback((product) => {

    // Open the details modal instead of directly adding to cart

    handleShowModal(product);

  }, [handleShowModal]);



  // Memoized ProductCard component to prevent unnecessary re-renders

  const ProductCard = React.memo(({ product, index, category, onShowModal, onAddToCart, onBuyNow, isLoading }) => {

    // Memoize the button handlers to prevent re-renders

    const handleViewDetails = useCallback((e) => {

      e.preventDefault();

      e.stopPropagation();

      onShowModal(product, e);

    }, [onShowModal, product]);

    

    const handleAddToCart = useCallback(() => onAddToCart(product), [onAddToCart, product]);

    

    const handleBuyNow = useCallback((e) => {

      e.preventDefault();

      e.stopPropagation();

      onBuyNow(product, e);

    }, [onBuyNow, product]);



    return (

    <motion.div

      key={product.id}

      className={`product-card ${category}`}

      initial={{ opacity: 0, y: 30 }}

      animate={{ opacity: 1, y: 0 }}

      transition={{ delay: index * 0.1, duration: 0.6 }}

      whileHover={{ 

        y: -10, 

        scale: 1.02,

        transition: { duration: 0.3 }

      }}

    >

      <div className="product-image-container">

        

        <img

          src={`http://localhost:8000/${product.image}`}

          alt={product.name}

          className="product-image"

          onError={(e) => {

            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

          }}

        />

        

        <div className="product-overlay">

          <motion.button

            className="view-details-btn"

            onClick={handleViewDetails}

            whileHover={{ scale: 1.1 }}

            whileTap={{ scale: 0.9 }}

          >

            <i className="fas fa-eye"></i>

            View Details

          </motion.button>

        </div>

        

        {/* Popular Badge */}

        {product.stock > 10 && (

          <div className="stock-badge popular">

            <i className="fas fa-star"></i>

            POPULAR

          </div>

        )}

        

        {product.stock <= 5 && product.stock > 0 && (

          <div className="stock-badge limited">

            <i className="fas fa-fire"></i>

            LIMITED

          </div>

        )}

      </div>

      

      <div className="product-info">

        <h3 className="product-name">{product.product_name || product.name}</h3>

        <p className="product-price">{formatPrice(product.price)}</p>

        <div className="product-stock">

          {product.category_name === 'Made to Order' || product.category_name === 'made_to_order' ? (

            <span className={`stock-status ${product.is_available !== false ? 'in-stock' : 'out-of-stock'}`}>

              <i className={`fas ${product.is_available !== false ? 'fa-tools' : 'fa-times-circle'}`}></i>

              {product.is_available !== false ? 'Available for Made to Order' : 'Currently Not Available'}

            </span>

          ) : (

            <span className={`stock-status ${product.stock > 10 ? 'in-stock' : product.stock > 0 ? 'low-stock' : 'out-of-stock'}`}>

              <i className={`fas ${product.stock > 10 ? 'fa-check-circle' : product.stock > 0 ? 'fa-exclamation-triangle' : 'fa-times-circle'}`}></i>

              {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}

            </span>

          )}

        </div>

        

        {/* Action Buttons */}

        <div className="product-actions">

          <motion.button

            className="add-to-cart-btn"

            onClick={handleAddToCart}

            disabled={isLoading || (product.category_name === 'Made to Order' || product.category_name === 'made_to_order') ? (product.is_available === false) : (product.stock === 0)}

            whileHover={{ scale: 1.02 }}

            whileTap={{ scale: 0.98 }}

          >

            <i className="fas fa-shopping-cart"></i>

            {isLoading ? 'Adding...' : 'Add to Cart'}

          </motion.button>

          

          <motion.button

            className="buy-now-btn"

            onClick={handleBuyNow}

            disabled={(product.category_name === 'Made to Order' || product.category_name === 'made_to_order') ? (product.is_available === false) : (product.stock === 0)}

            whileHover={{ scale: 1.02 }}

            whileTap={{ scale: 0.98 }}

          >

            <i className="fas fa-bolt"></i>

            Buy Now

          </motion.button>

        </div>

      </div>

    </motion.div>

    );

  });



  return (

    <div className="products-section">

      <div className="products-container">

        {/* Products Header with Filter Dropdown */}
        <div className="products-header">
          <div className="filter-dropdown-wrapper">
            <motion.button
              className="filter-dropdown-trigger"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="filter-trigger-content">
                <i className="fas fa-filter"></i>
                <span className="filter-text">
                  {selectedCategory === 'all' ? 'All Products' :
                   selectedCategory === 'chairs' ? 'Chairs' :
                   selectedCategory === 'tables' ? 'Tables' :
                   selectedCategory === 'alkansya' ? 'Alkansya' :
                   selectedCategory === 'made_to_order' ? 'Made to Order' : 'All Products'}
                </span>
      </div>
              <i className={`fas fa-chevron-down ${showFilterDropdown ? 'rotate' : ''}`}></i>
            </motion.button>

      <AnimatePresence>
              {showFilterDropdown && (
          <motion.div 
                  className="filter-dropdown-menu"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    className={`filter-menu-item ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory('all');
                      setShowFilterDropdown(false);
                    }}
                  >
                    <i className="fas fa-th"></i>
                    <span>All Products</span>
                    {selectedCategory === 'all' && <i className="fas fa-check"></i>}
              </button>
                                <button 
                    className={`filter-menu-item ${selectedCategory === 'chairs' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory('chairs');
                      setShowFilterDropdown(false);
                    }}
                  >
                    <i className="fas fa-chair"></i>
                    <span>Chairs</span>
                    {selectedCategory === 'chairs' && <i className="fas fa-check"></i>}
                                </button>
                                <button 
                    className={`filter-menu-item ${selectedCategory === 'tables' ? 'active' : ''}`}
                                  onClick={() => {
                      setSelectedCategory('tables');
                      setShowFilterDropdown(false);
                    }}
                  >
                    <i className="fas fa-table"></i>
                    <span>Tables</span>
                    {selectedCategory === 'tables' && <i className="fas fa-check"></i>}
                                </button>
                    <button
                    className={`filter-menu-item ${selectedCategory === 'alkansya' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory('alkansya');
                      setShowFilterDropdown(false);
                    }}
                  >
                    <i className="fas fa-box"></i>
                    <span>Alkansya</span>
                    {selectedCategory === 'alkansya' && <i className="fas fa-check"></i>}
                    </button>
                    <button
                    className={`filter-menu-item ${selectedCategory === 'made_to_order' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory('made_to_order');
                      setShowFilterDropdown(false);
                    }}
                  >
                    <i className="fas fa-tools"></i>
                    <span>Made to Order</span>
                    {selectedCategory === 'made_to_order' && <i className="fas fa-check"></i>}
                    </button>
            </motion.div>
        )}
      </AnimatePresence>
          </div>
    </div>

        {!products || products.length === 0 ? (

          <div className="loading-state">

            <div className="loading-spinner">

              <div className="spinner-border text-primary" role="status">

                <span className="visually-hidden">Loading...</span>

              </div>

            </div>

            <p className="loading-text">

              {!products ? 'Loading our amazing products...' : 'No products found. Please check back later.'}

            </p>

          </div>

        ) : selectedCategory !== 'all' ? (
          // Show filtered products when a category is selected
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selectedCategory}-${searchTerm}`}
              className="products-grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              {filteredProducts.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-box-open"></i>
                  <h3>No products found</h3>
                  <p>Try adjusting your search or filter criteria</p>
                </div>
              ) : (
                filteredProducts.map((product, index) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  index={index} 
                    category={selectedCategory}
                  onShowModal={handleShowModal}
                  onAddToCart={handleAddToCartDirect}
                  onBuyNow={handleBuyNow}
                  isLoading={loadingProducts.has(product.id)}
                  />
                ))
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          // Show grouped products when showing all
          <AnimatePresence mode="wait">
            <motion.div
              key={`all-${searchTerm}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              {/* Alkansya Section */}
              {groupedProducts.alkansya && groupedProducts.alkansya.length > 0 && (
                <div className="product-category-section">
                  <h2 className="category-section-title">
                    <i className="fas fa-box"></i>
                    Alkansya
                  </h2>
                  <motion.div
                    className="products-grid"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    {groupedProducts.alkansya.map((product, index) => (
                      <ProductCard 
                        key={product.id} 
                        product={product} 
                        index={index} 
                        category="alkansya"
                        onShowModal={handleShowModal}
                        onAddToCart={handleAddToCartDirect}
                        onBuyNow={handleBuyNow}
                        isLoading={loadingProducts.has(product.id)}
                      />
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Made to Order Section */}
              {groupedProducts.madeToOrder && groupedProducts.madeToOrder.length > 0 && (
                <div className="product-category-section">
                  <h2 className="category-section-title">
                    <i className="fas fa-tools"></i>
                    Made to Order
                  </h2>
                  <motion.div
                    className="products-grid"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    {groupedProducts.madeToOrder.map((product, index) => (
                      <ProductCard 
                        key={product.id} 
                        product={product} 
                        index={index} 
                        category="made_to_order"
                        onShowModal={handleShowModal}
                        onAddToCart={handleAddToCartDirect}
                        onBuyNow={handleBuyNow}
                        isLoading={loadingProducts.has(product.id)}
                      />
                    ))}
            </motion.div>
                </div>
              )}

              {/* Show message if no products in either category */}
              {(!groupedProducts.alkansya || groupedProducts.alkansya.length === 0) && 
               (!groupedProducts.madeToOrder || groupedProducts.madeToOrder.length === 0) && (
                <div className="empty-state">
                  <i className="fas fa-box-open"></i>
                  <h3>No products found</h3>
                  <p>Try adjusting your search criteria</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

      </div>



      {/* Landing Page Style Modal */}

      <AnimatePresence>

        {showModal && selectedProduct && (

          <motion.div 

            className="product-modal-overlay"

            initial={{ opacity: 0 }}

            animate={{ opacity: 1 }}

            exit={{ opacity: 0 }}

            onClick={handleCloseModal}

          >

            <motion.div 

              className="product-modal-content"

              initial={{ scale: 0.8, opacity: 0, y: 50 }}

              animate={{ scale: 1, opacity: 1, y: 0 }}

              exit={{ scale: 0.8, opacity: 0, y: 50 }}

              transition={{ type: "spring", stiffness: 300, damping: 30 }}

              onClick={(e) => e.stopPropagation()}

            >

              <button className="close-modal-btn" onClick={handleCloseModal}>

                <i className="fas fa-times"></i>

              </button>

              

              <div className="product-modal-body">

                <div className="product-modal-image">

                  <img

                    src={`http://localhost:8000/${selectedProduct.image}`}

                    alt={selectedProduct.name}

                    className="modal-product-image"

                    onError={(e) => {

                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

                    }}

                  />

                </div>

                

                <div className="product-modal-info">

                  <h2 className="modal-product-name">{selectedProduct.name}</h2>

                  

                  <div className="modal-product-price">

                    {formatPrice(selectedProduct.price)}

                  </div>

                  

                  <div className="modal-product-description">

                    <h3>Product Description</h3>

                    <p>

                      {selectedProduct.description || 

                      `Premium quality ${selectedProduct.name.toLowerCase()} made with traditional craftsmanship and modern design. Each piece is carefully crafted to bring warmth and elegance to your home.`}

                    </p>

                  </div>



                  {error && (

                    <div className="alert alert-danger" role="alert">

                      <i className="fas fa-exclamation-triangle me-2"></i>

                      {error}

                    </div>

                  )}



                  {(() => {

                    const productName = (selectedProduct.name || selectedProduct.product_name || '').toLowerCase();

                    const categoryName = selectedProduct.category_name || '';

                    const isMadeToOrderDiningTable = 

                      (categoryName === 'Made to Order' || categoryName === 'made_to_order') &&

                      productName.includes('dining table');

                    const isWoodenChair = productName.includes('wooden chair');

                    const isAlkansya = productName.includes('alkansya');

                    const isMadeToOrder = (categoryName === 'Made to Order' || categoryName === 'made_to_order');

                    

                    // Only show quantity controls for Wooden Chair and Alkansya

                    const showQuantityControls = isWoodenChair || isAlkansya;

                    

                    // For Dining Table: Don't show quantity controls at all

                    if (isMadeToOrderDiningTable) {

                      return (

                        <div className="mt-3">

                          <div className="quantity-stock-row">

                            <div className="quantity-info-simple">

                              <span className="info-text">Quantity: <strong>1</strong></span>

                            </div>

                            <div className="modal-product-stock-compact">

                              {isMadeToOrder ? (

                                <span className="stock-badge stock-in">

                                  Available for Made to Order

                                </span>

                              ) : (

                                <span className={`stock-badge ${selectedProduct.stock > 0 ? 'stock-in' : 'stock-out'}`}>

                                  {selectedProduct.stock > 0 ? `In Stock (${selectedProduct.stock})` : 'Out of Stock'}

                                </span>

                              )}

                            </div>

                          </div>

                        </div>

                      );

                    }

                    

                    // For Wooden Chair and Alkansya: Show quantity controls with stock on the right

                    if (showQuantityControls) {

                      const maxQty = isWoodenChair ? 4 : (selectedProduct.stock || 999);

                      

                      return (

                        <div className="mt-3">

                          <div className="quantity-stock-row">

                            <div className="quantity-selector-compact-inline">

                              <label className="quantity-label-compact">Quantity</label>

                              <div className="quantity-input-group">

                                <button 

                                  type="button" 

                                  className="qty-btn-compact qty-minus"

                                  onClick={() => setQuantity(Math.max(1, quantity - 1))}

                                  disabled={quantity <= 1}

                                >

                                  <span>−</span>

                                </button>

                                <input

                                  type="number"

                                  min="1"

                                  max={maxQty}

                                  value={quantity}

                                  onChange={(e) => {

                                    const newQty = Number(e.target.value);

                                    if (newQty < 1) {

                                      setQuantity(1);

                                    } else if (isWoodenChair && newQty > 4) {

                                      setQuantity(4);

                                      toast.error("Wooden Chair maximum quantity is 4");

                                    } else if (newQty > maxQty) {

                                      setQuantity(maxQty);

                                    } else {

                                      setQuantity(newQty);

                                    }

                                  }}

                                  className="qty-input-compact"

                                  readOnly

                                />

                                <button 

                                  type="button" 

                                  className="qty-btn-compact qty-plus"

                                  onClick={() => {

                                    const newQty = quantity + 1;

                                    if (isWoodenChair && newQty > 4) {

                                      toast.error("Wooden Chair maximum quantity is 4");

                                      return;

                                    }

                                    setQuantity(Math.min(maxQty, newQty));

                                  }}

                                  disabled={quantity >= maxQty}

                                >

                                  <span>+</span>

                                </button>

                              </div>

                              {isWoodenChair && (

                                <small className="qty-hint">Max: 4</small>

                              )}

                            </div>

                            <div className="modal-product-stock-compact">

                              {isMadeToOrder ? (

                                <span className="stock-badge stock-in">

                                  Available for Made to Order

                                </span>

                              ) : (

                                <span className={`stock-badge ${selectedProduct.stock > 0 ? 'stock-in' : 'stock-out'}`}>

                                  {selectedProduct.stock > 0 ? `In Stock (${selectedProduct.stock})` : 'Out of Stock'}

                                </span>

                              )}

                            </div>

                          </div>

                        </div>

                      );

                    }

                    

                    // For other products: Don't show quantity controls

                    return (

                      <div className="mt-3">

                        <div className="quantity-stock-row">

                          <div className="quantity-info-simple">

                            <span className="info-text">Quantity: <strong>1</strong></span>

                          </div>

                          <div className="modal-product-stock-compact">

                            {isMadeToOrder ? (

                              <span className="stock-badge stock-in">

                                Available for Made to Order

                              </span>

                            ) : (

                              <span className={`stock-badge ${selectedProduct.stock > 0 ? 'stock-in' : 'stock-out'}`}>

                                {selectedProduct.stock > 0 ? `In Stock (${selectedProduct.stock})` : 'Out of Stock'}

                              </span>

                            )}

                          </div>

                        </div>

                      </div>

                    );

                  })()}

                  

                  {/* Action Buttons - Add to Cart and Buy Now */}

                  <div className="modal-action-buttons">

                    <button

                      className="modal-add-to-cart-btn"

                      onClick={handleAddToCart}

                      disabled={loadingProducts.has(selectedProduct.id)}

                    >

                      {loadingProducts.has(selectedProduct.id) ? (

                        <>

                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>

                          Adding...

                        </>

                      ) : (

                        <>

                          <i className="fas fa-cart-plus"></i>

                          Add to Cart

                        </>

                      )}

                    </button>

                    <button

                      className="modal-buy-now-btn"

                      onClick={() => handleBuyNow(selectedProduct)}

                      disabled={loadingProducts.has(selectedProduct.id)}

                    >

                      <i className="fas fa-bolt"></i>

                      Buy Now

                    </button>

                  </div>

                </div>

              </div>

            </motion.div>

          </motion.div>

        )}

      </AnimatePresence>





      {/* Buy Now Modal */}

      <BuyNowModal

        show={showBuyNowModal}

        onClose={handleCloseBuyNowModal}

        product={buyNowProduct}

        onOrderSuccess={handleOrderSuccess}

        position={buyNowModalPosition}

      />

    </div>

  );

};



// Memoize the component to prevent unnecessary re-renders

export default memo(ProductCatalog, (prevProps, nextProps) => {

  // Only re-render if products array reference or searchTerm changes

  if (prevProps.products !== nextProps.products || prevProps.searchTerm !== nextProps.searchTerm) {

    return false; // Re-render

  }

  // If products and searchTerm are the same, don't re-render

  return true; // Don't re-render

});


