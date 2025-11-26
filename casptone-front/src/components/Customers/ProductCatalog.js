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

  // Wishlist states
  const [wishlist, setWishlist] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(new Set());

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

  // Fetch wishlist on component mount
  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get("http://localhost:8000/api/wishlist", {
        headers: { Authorization: `Bearer ${token}` }
      });

      setWishlist(response.data.wishlist || []);
    } catch (error) {
      // Silently fail if user is not authenticated
      if (error.response?.status !== 401) {
        console.error("Error fetching wishlist:", error);
      }
    }
  };

  const handleAddToWishlist = async (product) => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login to add products to wishlist");
      return;
    }

    setWishlistLoading(prev => new Set(prev).add(product.id));

    try {
      const response = await axios.post(
        "http://localhost:8000/api/wishlist",
        { product_id: product.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update wishlist state optimistically without refetching
      setWishlist(prev => [...prev, response.data.wishlist]);
      
      toast.success("Product added to wishlist!");
      
      // Dispatch event to update header count only
      window.dispatchEvent(new CustomEvent('wishlistUpdated'));
    } catch (error) {
      const message = error.response?.data?.message || "Failed to add to wishlist";
      toast.error(message);
      // Revert optimistic update on error
      fetchWishlist();
    } finally {
      setWishlistLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }
  };

  const handleRemoveFromWishlist = async (wishlistId) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      // Update wishlist state optimistically without refetching
      setWishlist(prev => prev.filter(item => item.id !== wishlistId));
      
      await axios.delete(
        `http://localhost:8000/api/wishlist/${wishlistId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // No toast for removal - silent update
      // Dispatch event to update header count only
      window.dispatchEvent(new CustomEvent('wishlistUpdated'));
    } catch (error) {
      toast.error("Failed to remove from wishlist");
      // Revert optimistic update on error
      fetchWishlist();
    }
  };

  const isInWishlist = (productId) => {
    return wishlist.some(item => item.product_id === productId);
  };

  const getWishlistId = (productId) => {
    const item = wishlist.find(item => item.product_id === productId);
    return item ? item.id : null;
  };

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

    

    // Set initial quantity to 1 for all products

    setQuantity(1);

    

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

    

    // Validate quantity limits (only for non-made-to-order products)

    const productName = (selectedProduct.name || selectedProduct.product_name || '').toLowerCase();

    const categoryName = selectedProduct.category_name || '';

    const isMadeToOrder = categoryName === 'Made to Order' || categoryName === 'made_to_order';

    const isWoodenChair = productName.includes('wooden chair');

    

    // No quantity limits for made-to-order products

    let finalQuantity = quantity;

    

    // Only enforce limits for Wooden Chair (not made-to-order)

    if (isWoodenChair && !isMadeToOrder && quantity > 4) {

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

  const ProductCard = React.memo(({ product, index, category, onShowModal, onAddToCart, onBuyNow, onAddToWishlist, onRemoveFromWishlist, isInWishlist, wishlistId, isLoading, isWishlistLoading }) => {

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

    const handleWishlistToggle = useCallback((e) => {

      e.preventDefault();

      e.stopPropagation();

      if (isInWishlist) {

        onRemoveFromWishlist(wishlistId);

      } else {

        onAddToWishlist(product);

      }

    }, [isInWishlist, wishlistId, onAddToWishlist, onRemoveFromWishlist, product]);

    

    // Show wishlist heart icon for all products



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

        {/* Wishlist Heart Icon - Top Left */}
        <button
          className={`wishlist-heart-btn ${isInWishlist ? 'in-wishlist' : ''}`}
          onClick={handleWishlistToggle}
          disabled={isWishlistLoading}
          title={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.9)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
          }}
        >
          <span style={{
            fontSize: '20px',
            color: isInWishlist ? '#DC2626' : '#999',
            transition: 'color 0.3s ease'
          }}>
            {isInWishlist ? '♥' : '♡'}
          </span>
        </button>

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

            <span className={`stock-status ${product.is_available_for_order === true ? 'in-stock' : 'out-of-stock'}`}>

              <i className={`fas ${product.is_available_for_order === true ? 'fa-tools' : 'fa-times-circle'}`}></i>

              {product.is_available_for_order === true ? 'Available for Made to Order' : 'Currently Not Available'}

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

            disabled={isLoading || (product.category_name === 'Made to Order' || product.category_name === 'made_to_order') ? (product.is_available_for_order !== true) : (product.stock === 0)}

            whileHover={{ scale: 1.02 }}

            whileTap={{ scale: 0.98 }}

          >

            <i className="fas fa-shopping-cart"></i>

            {isLoading ? 'Adding...' : 'Add to Cart'}

          </motion.button>

          

          <motion.button

            className="buy-now-btn"

            onClick={handleBuyNow}

            disabled={(product.category_name === 'Made to Order' || product.category_name === 'made_to_order') ? (product.is_available_for_order !== true) : (product.stock === 0)}

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
                  onAddToWishlist={handleAddToWishlist}
                  onRemoveFromWishlist={handleRemoveFromWishlist}
                  isInWishlist={isInWishlist(product.id)}
                  wishlistId={getWishlistId(product.id)}
                  isLoading={loadingProducts.has(product.id)}
                  isWishlistLoading={wishlistLoading.has(product.id)}
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
                        onAddToWishlist={handleAddToWishlist}
                        onRemoveFromWishlist={handleRemoveFromWishlist}
                        isInWishlist={isInWishlist(product.id)}
                        wishlistId={getWishlistId(product.id)}
                        isLoading={loadingProducts.has(product.id)}
                        isWishlistLoading={wishlistLoading.has(product.id)}
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
                        onAddToWishlist={handleAddToWishlist}
                        onRemoveFromWishlist={handleRemoveFromWishlist}
                        isInWishlist={isInWishlist(product.id)}
                        wishlistId={getWishlistId(product.id)}
                        isLoading={loadingProducts.has(product.id)}
                        isWishlistLoading={wishlistLoading.has(product.id)}
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

                <div className="product-modal-image" style={{ position: 'relative' }}>
                  {/* Wishlist Heart Icon - Top Left */}
                  {(() => {
                    const token = localStorage.getItem("token");
                    if (!token) return null;
                    
                    const inWishlist = isInWishlist(selectedProduct.id);
                    const wishId = getWishlistId(selectedProduct.id);
                    
                    return (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (inWishlist) {
                            handleRemoveFromWishlist(wishId);
                          } else {
                            handleAddToWishlist(selectedProduct);
                          }
                        }}
                        disabled={wishlistLoading.has(selectedProduct.id)}
                        title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                        style={{
                          position: 'absolute',
                          top: '10px',
                          left: '10px',
                          zIndex: 10,
                          background: 'rgba(255, 255, 255, 0.9)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '36px',
                          height: '36px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.1)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                        }}
                      >
                        <span style={{
                          fontSize: '20px',
                          color: inWishlist ? '#DC2626' : '#999',
                          transition: 'color 0.3s ease'
                        }}>
                          {inWishlist ? '♥' : '♡'}
                        </span>
                      </button>
                    );
                  })()}

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

                      `Premium quality ${(selectedProduct.product_name || selectedProduct.name).toLowerCase()} made with traditional craftsmanship and modern design. Each piece is carefully crafted to bring warmth and elegance to your home.`}

                    </p>

                  </div>

                  {/* Product Details Section */}
                  {(() => {
                    const productName = (selectedProduct.product_name || selectedProduct.name || '').toLowerCase();
                    const categoryName = selectedProduct.category_name || '';
                    const isAlkansya = productName.includes('alkansya') || categoryName === 'stocked products';
                    const isMadeToOrder = categoryName === 'Made to Order' || categoryName === 'made_to_order';

                    if (isAlkansya || isMadeToOrder) {
                      // Get BOM materials
                      const bomMaterials = selectedProduct.bom || [];
                      
                      // Extract wood/material names from BOM
                      const getWoodMaterials = () => {
                        if (isAlkansya) {
                          // For alkansya, find Pinewood from BOM
                          const pinewood = bomMaterials.find(m => 
                            m.material_name && (
                              m.material_name.toLowerCase().includes('pinewood') ||
                              m.material_name.toLowerCase().includes('pine wood') ||
                              m.material_code === 'PW-1X4X8'
                            )
                          );
                          const plywood = bomMaterials.find(m => 
                            m.material_name && (
                              m.material_name.toLowerCase().includes('plywood') ||
                              m.material_code === 'PLY-4.2-4X8'
                            )
                          );
                          const acrylic = bomMaterials.find(m => 
                            m.material_name && (
                              m.material_name.toLowerCase().includes('acrylic') ||
                              m.material_code === 'ACR-1.5-4X8'
                            )
                          );
                          
                          const materials = [];
                          if (pinewood) materials.push(pinewood.material_name);
                          if (plywood) materials.push(plywood.material_name);
                          if (acrylic) materials.push(acrylic.material_name);
                          
                          return materials.length > 0 ? materials.join(', ') : 'Pinewood, Plywood, Acrylic';
                        } else {
                          // For made to order, find premium wood materials
                          const premiumMaterials = bomMaterials
                            .filter(m => m.material_name && (
                              m.material_name.toLowerCase().includes('mahogany') ||
                              m.material_name.toLowerCase().includes('hardwood') ||
                              m.material_name.toLowerCase().includes('oak') ||
                              m.material_name.toLowerCase().includes('teak') ||
                              m.material_name.toLowerCase().includes('walnut')
                            ))
                            .slice(0, 3) // Get top 3 most engaging materials
                            .map(m => m.material_name);
                          
                          return premiumMaterials.length > 0 
                            ? premiumMaterials.join(', ') 
                            : 'Premium Hardwood (Mahogany)';
                        }
                      };

                      // Get dimensions based on product
                      const getDimensions = () => {
                        if (selectedProduct.dimensions) return selectedProduct.dimensions;
                        if (selectedProduct.sizes) return selectedProduct.sizes;
                        
                        const name = selectedProduct.product_name || selectedProduct.name || '';
                        
                        if (name.toLowerCase().includes('dining table set') && !name.toLowerCase().includes('no bench')) {
                          return 'Table: 4ft x 3ft x 30in (H) | Bench: 4ft x 14in x 18in (H) | 2 Chairs: 22in (W) x 22in (D) x 40in (H)';
                        } else if (name.toLowerCase().includes('dining table set') && name.toLowerCase().includes('no bench')) {
                          return 'Table: 4ft x 3ft x 30in (H) | 2 Chairs: 22in (W) x 22in (D) x 40in (H)';
                        } else if (name.toLowerCase().includes('chair') && (name.toLowerCase().includes('curved') || name.toLowerCase().includes('square'))) {
                          return '22in (W) x 22in (D) x 40in (H)';
                        } else if (isAlkansya) {
                          return '8 x 9 inches';
                        }
                        return null;
                      };

                      // Get "How it's made" description
                      const getHowItsMade = () => {
                        const name = (selectedProduct.product_name || selectedProduct.name || '').toLowerCase();
                        
                        if (isAlkansya) {
                          return 'Each Alkansya is handcrafted using traditional Filipino woodworking techniques. We start with premium Pinewood boards that are precisely cut and shaped. The base is constructed from sturdy Plywood, while a clear Acrylic sheet creates the transparent viewing window. The pieces are carefully assembled using pin nails and screws, then finished with premium adhesives and protective coatings. Each Alkansya undergoes quality inspection to ensure durability and craftsmanship.';
                        } else if (name.includes('dining table set')) {
                          return 'Our dining table set is built step by step with care and precision. First, we select beautiful mahogany wood and cut it to size for the table top and legs. The table frame is assembled using strong steel supports for stability. Next, we craft the comfortable chairs with curved backs and soft cushioned seats. Each piece is sanded smooth, then we apply a rich walnut stain to bring out the wood\'s natural beauty. Finally, we add a protective clear finish so your dining set stays beautiful for years. The bench is made the same way, ensuring everything matches perfectly.';
                        } else if (name.includes('chair')) {
                          return 'Each wooden chair is made with attention to comfort and style. We start by cutting mahogany wood pieces for the chair frame and back. The seat is made from plywood and padded with soft foam for comfort. We cover the seat with quality fabric that matches your style. All the pieces are carefully joined together using wood screws and strong glue. After assembly, we sand everything smooth so there are no rough edges. Then we apply a beautiful stain and clear protective finish. The result is a comfortable, sturdy chair that looks great in any dining room.';
                        } else {
                          return 'Our made-to-order furniture is crafted by skilled artisans using time-honored techniques. We begin with carefully selected premium hardwoods that are milled and shaped to exact specifications. Each piece is assembled using traditional joinery methods combined with modern hardware. The furniture is then sanded through multiple grits for a smooth finish, stained to enhance the natural wood grain, and protected with multiple coats of premium polyurethane or lacquer. Every detail is meticulously attended to, ensuring your custom piece will last for generations.';
                        }
                      };

                      return (
                        <div className="modal-product-details">
                          <h3>Product Information</h3>
                          <div className="product-details-list">
                            {/* Dimensions/Sizes */}
                            {getDimensions() ? (
                              <div className="detail-row">
                                <span className="detail-label">Dimensions</span>
                                <span className="detail-value">{getDimensions()}</span>
                              </div>
                            ) : null}

                            {/* Materials - Based on BOM */}
                            <div className="detail-row">
                              <span className="detail-label">Materials</span>
                              <span className="detail-value">{getWoodMaterials()}</span>
                            </div>

                            {/* How it's Made Section */}
                            <div className="detail-row how-its-made-row">
                              <span className="detail-label">How it's Made</span>
                              <div className="detail-value how-its-made-content">
                                <p>{getHowItsMade()}</p>
                              </div>
                            </div>

                            {/* Weight (if available) */}
                            {selectedProduct.weight && (
                              <div className="detail-row">
                                <span className="detail-label">Weight</span>
                                <span className="detail-value">{selectedProduct.weight}</span>
                              </div>
                            )}

                            {/* Finish - Only for Made-to-Order */}
                            {!isAlkansya && (
                              selectedProduct.finish ? (
                                <div className="detail-row">
                                  <span className="detail-label">Finish</span>
                                  <span className="detail-value">{selectedProduct.finish}</span>
                                </div>
                              ) : (
                                <div className="detail-row">
                                  <span className="detail-label">Finish Options</span>
                                  <span className="detail-value">Customizable</span>
                                </div>
                              )
                            )}

                            {/* Availability */}
                            <div className="detail-row">
                              <span className="detail-label">Availability</span>
                              <span className="detail-value">{isAlkansya ? `${selectedProduct.stock || 0} units in stock` : 'Available for custom order'}</span>
                            </div>

                            {/* Made-to-Order Specific Info */}
                            {isMadeToOrder && (
                              <>
                                <div className="detail-row">
                                  <span className="detail-label">Customization</span>
                                  <span className="detail-value">Dimensions, materials, finishes, and design</span>
                                </div>
                                <div className="detail-row">
                                  <span className="detail-label">Production Time</span>
                                  <span className="detail-value">2-4 weeks from order confirmation</span>
                                </div>
                                <div className="detail-row">
                                  <span className="detail-label">Consultation</span>
                                  <span className="detail-value">Free design consultation included</span>
                                </div>
                              </>
                            )}

                            {/* Alkansya Specific Info - Weight only if available */}
                            {isAlkansya && !selectedProduct.weight && (
                              <div className="detail-row">
                                <span className="detail-label">Weight</span>
                                <span className="detail-value">Varies by size (approx. 1-3 kg)</span>
                              </div>
                            )}

                            {/* Delivery */}
                            <div className="detail-row delivery-row">
                              <span className="detail-label">Delivery Time</span>
                              <span className={`detail-value ${isAlkansya ? 'delivery-fast' : 'delivery-standard'}`}>
                                {isAlkansya ? '2-3 days after placing order' : 'Estimated 2 weeks or more after production'}
                              </span>
                            </div>

                            {/* Additional Note */}
                            {!getDimensions() && (
                              <div className="detail-note">
                                {isAlkansya 
                                  ? 'Custom sizes available upon request. Contact us for special dimensions and finishes.'
                                  : 'Contact us to discuss your specific requirements, dimensions, and design preferences.'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}



                  {error && (

                    <div className="alert alert-danger" role="alert">

                      <i className="fas fa-exclamation-triangle me-2"></i>

                      {error}

                    </div>

                  )}



                  {(() => {

                    const productName = (selectedProduct.name || selectedProduct.product_name || '').toLowerCase();

                    const categoryName = selectedProduct.category_name || '';

                    const isWoodenChair = productName.includes('wooden chair');

                    const isAlkansya = productName.includes('alkansya');

                    const isMadeToOrder = (categoryName === 'Made to Order' || categoryName === 'made_to_order');

                    

                    // Show quantity controls for Wooden Chair, Alkansya, and Made-to-Order products

                    const showQuantityControls = isWoodenChair || isAlkansya || isMadeToOrder;

                    

                    // For all products with quantity controls: Show quantity selector

                    if (showQuantityControls) {

                      // No max limit for made-to-order products, limit for Wooden Chair is 4, stock limit for Alkansya

                      const maxQty = isMadeToOrder ? 99999 : (isWoodenChair ? 4 : (selectedProduct.stock || 999));

                      

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

                                    } else if (isWoodenChair && !isMadeToOrder && newQty > 4) {

                                      setQuantity(4);

                                      toast.error("Wooden Chair maximum quantity is 4");

                                    } else if (!isMadeToOrder && newQty > maxQty) {

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

                                    if (isWoodenChair && !isMadeToOrder && newQty > 4) {

                                      toast.error("Wooden Chair maximum quantity is 4");

                                      return;

                                    }

                                    // No limit for made-to-order products

                                    if (isMadeToOrder) {

                                      setQuantity(newQty);

                                    } else {

                                      setQuantity(Math.min(maxQty, newQty));

                                    }

                                  }}

                                  disabled={!isMadeToOrder && quantity >= maxQty}

                                >

                                  <span>+</span>

                                </button>

                              </div>

                              {isWoodenChair && !isMadeToOrder && (

                                <small className="qty-hint">Max: 4</small>

                              )}

                            </div>

                            <div className="modal-product-stock-compact">

                              {isMadeToOrder ? (

                                <span className={`stock-badge ${selectedProduct.is_available_for_order === true ? 'stock-in' : 'stock-out'}`}>

                                  {selectedProduct.is_available_for_order === true ? 'Available for Made to Order' : 'Currently Not Available'}

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

                  

                  {/* Action Buttons - Add to Cart, Buy Now, and Wishlist */}

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


