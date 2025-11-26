import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Spinner } from "react-bootstrap";
import { Toaster, toast } from "sonner";
import axios from "axios";
import { authUtils } from "../utils/auth";
import Login from "./Login";
import RegisterModal from "./RegisterModal";
import { formatPrice } from "../utils/currency";
import "./LandingPage.css";

const LandingPage = () => {
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showProductModal, setShowProductModal] = useState(false);
    const [wishlist, setWishlist] = useState([]);
    const [wishlistLoading, setWishlistLoading] = useState(false);

    useEffect(() => {
        // Check if user is already authenticated and redirect if needed
        if (authUtils.checkAndRedirect()) {
            return;
        }
        
        fetchProducts();
        fetchWishlist();

        // Listen for storage events to refresh products when cache is invalidated
        const handleStorageChange = (e) => {
            if (e.key === 'products_cache_invalidated') {
                console.log("Products cache invalidated, refreshing...");
                fetchProducts(true); // Force refresh
                localStorage.removeItem('products_cache_invalidated');
            }
        };

        window.addEventListener('storage', handleStorageChange);
        
        // Also listen for custom events (for same-tab updates)
        const handleProductsUpdated = () => {
            console.log("Products updated event received, refreshing...");
            fetchProducts(true); // Force refresh
        };

        window.addEventListener('productsUpdated', handleProductsUpdated);

        // Periodic refresh check (every 30 seconds) to catch updates from other tabs
        const refreshInterval = setInterval(() => {
            const cacheInvalidated = localStorage.getItem('products_cache_invalidated');
            if (cacheInvalidated) {
                console.log("Cache invalidated flag detected, refreshing products...");
                fetchProducts(true);
                localStorage.removeItem('products_cache_invalidated');
            }
        }, 30000); // Check every 30 seconds

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('productsUpdated', handleProductsUpdated);
            clearInterval(refreshInterval);
        };
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
            setShowProductModal(false);
            setShowLoginModal(true);
            return;
        }

        setWishlistLoading(true);

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
        } finally {
            setWishlistLoading(false);
        }
    };

    const handleRemoveFromWishlist = async (wishlistId) => {
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            await axios.delete(
                `http://localhost:8000/api/wishlist/${wishlistId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update wishlist state optimistically without refetching
            setWishlist(prev => prev.filter(item => item.id !== wishlistId));
            
            // No toast for removal - silent update
            // Dispatch event to update header count only
            window.dispatchEvent(new CustomEvent('wishlistUpdated'));
        } catch (error) {
            toast.error("Failed to remove from wishlist");
        }
    };

    const isInWishlist = (productId) => {
        return wishlist.some(item => item.product_id === productId);
    };

    const getWishlistId = (productId) => {
        const item = wishlist.find(item => item.product_id === productId);
        return item ? item.id : null;
    };

    // Header scroll detection - only show at top, smooth animations
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            
            if (currentScrollY <= 50) {
                // Only show header when at the very top
                setIsHeaderVisible(true);
            } else {
                // Hide header when scrolled down
                setIsHeaderVisible(false);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const fetchProducts = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // Check if we should use cache (unless force refresh is requested)
            if (!forceRefresh) {
                const cachedProducts = localStorage.getItem('cached_products');
                const cacheTimestamp = localStorage.getItem('products_cache_timestamp');
                const now = Date.now();
                // Reduced cache time to 1 minute for faster updates
                const cacheValid = cacheTimestamp && (now - parseInt(cacheTimestamp)) < 60000; // 1 minute
                
                if (cachedProducts && cacheValid) {
                    console.log("Using cached products for faster loading");
                    setProducts(JSON.parse(cachedProducts));
                    setLoading(false);
                    return;
                }
            }
    
            const response = await axios.get("http://localhost:8000/api/products", {
                timeout: 20000, // 20 second timeout
            });
    
            console.log("Fetched products:", response.data);
            console.log("Products count:", response.data.length);
            setProducts(response.data);
            
            // Cache the products for faster future loads
            const now = Date.now();
            localStorage.setItem('cached_products', JSON.stringify(response.data));
            localStorage.setItem('products_cache_timestamp', now.toString());
            
        } catch (error) {
            // Only log error if it's not a timeout (to reduce console noise)
            if (error.code !== 'ECONNABORTED') {
                console.error("Error fetching products:", error.response || error);
            } else {
                console.warn("Request timeout - using cached data if available");
            }
            
            // Try to use cached data if available, even if expired
            const cachedProducts = localStorage.getItem('cached_products');
            if (cachedProducts) {
                console.log("Using cached products as fallback");
                setProducts(JSON.parse(cachedProducts));
            } else {
                // If no cache and error, set empty array to show "no products" message
                setProducts([]);
            }
        } finally {
            setLoading(false);
        }
    };

    // Enhanced product filtering
    const getFilteredProducts = () => {
        let filtered = products.filter((product) => {
            const productName = product.product_name || product.name || '';
            const matchesSearch = productName.toLowerCase().includes(searchTerm.toLowerCase());
            
            // Show all products regardless of availability status
            // Availability will be handled in the UI (disabled buttons, etc.)
            return matchesSearch;
        });

        if (selectedCategory !== 'all') {
            filtered = filtered.filter(product => {
                const name = (product.product_name || product.name || '').toLowerCase();
                switch (selectedCategory) {
                    case 'chairs':
                        return name.includes('chair') || name.includes('wooden chair');
                    case 'tables':
                        return name.includes('table') || name.includes('dining table');
                    case 'alkansya':
                        return name.includes('alkansya');
                    default:
                        return true;
                }
            });
        }

        return filtered;
    };

    const filteredProducts = getFilteredProducts();

    const handleLoginClick = () => {
        setShowLoginModal(true);
    };

    const handleCloseLogin = () => {
        setShowLoginModal(false);
    };

    const handleLoginSuccess = () => {
        setShowLoginModal(false);
        
        // Force immediate redirect using window.location
        window.location.href = '/dashboard';
    };

    const handleCloseRegister = () => {
        setShowRegisterModal(false);
    };

    const handleRegisterSuccess = () => {
        setShowRegisterModal(false);
        
        // Force immediate redirect using window.location
        window.location.href = '/dashboard';
    };

    const handleShowRegister = () => {
        setShowLoginModal(false);
        setShowRegisterModal(true);
    };

    const handleShowLogin = () => {
        setShowRegisterModal(false);
        setShowLoginModal(true);
    };


    const handleViewDetails = (product) => {
        setSelectedProduct(product);
        setShowProductModal(true);
    };

    const handleCloseProductModal = () => {
        setShowProductModal(false);
        setSelectedProduct(null);
    };

    const handleBuyFromModal = () => {
        setShowProductModal(false);
        setShowLoginModal(true);
    };

    const handleAddToCartFromModal = async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            setShowProductModal(false);
            setShowLoginModal(true);
            return;
        }

        try {
            await axios.post(
                "http://localhost:8000/api/cart",
                { 
                    product_id: selectedProduct.id, 
                    quantity: 1 
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success("Product added to cart!");
            window.dispatchEvent(new CustomEvent('cartUpdated'));
            handleCloseProductModal();
        } catch (error) {
            const message = error.response?.data?.message || "Failed to add to cart";
            toast.error(message);
        }
    };

    const handleFacebookClick = () => {
        window.open('https://web.facebook.com/unick.furnitures', '_blank');
    };

    const handleTikTokClick = () => {
        window.open('https://www.tiktok.com/@unick_woodenalkansya?_r=1&_d=secCgYIASAHKAESPgo8Qbb1vMQ0yijdYoBZM40bzN0HWfPG%2F7OwN6Y7Ocjt%2BWH%2FmVrLdul6mQdaIxs5e1EF4bx1M2%2FEUXo7kC%2FMGgA%3D&_svg=1&checksum=ea80af720995a6f7e327bfe48e56d6df4620fbe7474f35cc17964b3ed0b7ee11&item_author_type=2&sec_uid=MS4wLjABAAAA0LtQ-Jz6f3xXo3M4-F25oBMVn3hRXU3h-4yB9SZQBUYEqNOnYCCkFle4J6CVXMk9&sec_user_id=MS4wLjABAAAAvUNsW0lNYhQh4GOzrIuKaB5mu2UIA0u4ZxNYDCsBYwdEJU5mdlmG-W6x8Fe31Rbq&share_app_id=1180&share_author_id=7190151741848618010&share_link_id=6C827862-82D2-4684-91A3-450DA05E67CB&share_scene=1&sharer_language=en&social_share_type=5&source=h5_t&timestamp=1760535502&tt_from=copy&u_code=df02gl186593ee&ug_btm=b2878%2Cb5836&user_id=6881305392279323649&utm_campaign=client_share&utm_medium=ios&utm_source=copy', '_blank');
    };

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


    return (
        <div className="landing-page-container">
            {/* Minimalist Header with Disappearing Effect */}
            <motion.header 
                className={`landing-header ${isHeaderVisible ? 'header-visible' : 'header-hidden'}`}
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                <div className="header-content">
                    <motion.div 
                        className="logo-section"
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 300 }}
                    >
                        <div className="logo-circle">
                            <span className="logo-text">UNICK</span>
                        </div>
                        
                        
                        {/* Social Media Icons */}
                        <div className="social-icons">
                            <motion.button
                                className="social-btn facebook-btn"
                                onClick={handleFacebookClick}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                title="Visit our Facebook page"
                            >
                                <img 
                                    src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI0IDEyLjA3M0MyNCA1LjQwNCAxOC42MjcgMCAxMiAwUzAgNS40MDQgMCAxMi4wNzNDMCAxOC4wOTkgNC4zODcgMjMuMDk0IDEwLjEyNSAyNFYxNS41NjJINy4wNzhWMTIuMDczSDEwLjEyNVY5LjQxM0MxMC4xMjUgNi4zOTcgMTEuOTE1IDQuNzE5IDE0LjY1NyA0LjcxOUMxNS45MzYgNC43MTkgMTcuMjgxIDQuOTk0IDE3LjI4MSA0Ljk5NFY4LjA2MkgxNS44MzlDMTQuNDMxIDguMDYyIDEzLjkzOCA4Ljk5MyAxMy45MzggMTAuMDE2VjEyLjA3M0gxNy4xNzJMMTYuNjg4IDE1LjU2MkgxMy45MzhWMjRDMTkuNjEzIDIzLjA5NCAyNCAxOC4wOTkgMjQgMTIuMDczWiIgZmlsbD0iIzE4NzdGMiIvPgo8L3N2Zz4K" 
                                    alt="Facebook" 
                                    className="social-logo"
                                />
                            </motion.button>
                            <motion.button
                                className="social-btn tiktok-btn"
                                onClick={handleTikTokClick}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                title="Follow us on TikTok"
                            >
                                <img 
                                    src="https://img.freepik.com/premium-photo/square-tiktok-logo-isolated-white-background_469489-1029.jpg?semt=ais_hybrid&w=740&q=80" 
                                    alt="TikTok" 
                                    className="social-logo"
                                />
                            </motion.button>
                        </div>
                    </motion.div>
                    
                    <div className="header-right-section">
                        <motion.button 
                            className="signup-btn"
                            onClick={() => setShowRegisterModal(true)}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400 }}
                        >
                            <i className="fas fa-user-plus"></i>
                            Sign Up
                        </motion.button>
                        <motion.button 
                            className="login-btn"
                            onClick={handleLoginClick}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400 }}
                        >
                            <i className="fas fa-user"></i>
                            Login
                        </motion.button>
                    </div>
                </div>
            </motion.header>

            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-background">
                    <img 
                        src="/images/wooden-planks-hero.jpg" 
                        alt="Wooden planks background" 
                        className="hero-background-image"
                    />
                    <div className="hero-overlay"></div>
                </div>
                
                <div className="hero-content">
                    <motion.div
                        className="hero-text"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.3 }}
                    >
                        <h1 className="hero-title">
                            Handcrafted <span className="highlight">Wooden</span> Furniture
                        </h1>
                        <p className="hero-subtitle">
                            Premium quality furniture made with traditional craftsmanship and modern design
                        </p>
                        
                        {/* Search Bar */}
                        <motion.div 
                            className="hero-search-container"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.6 }}
                        >
                            <div className="hero-search-wrapper">
                                <label htmlFor="hero-search-input" className="visually-hidden">
                                    Search woodcraft products
                                </label>
                                <input
                                    id="hero-search-input"
                                    type="text"
                                    className="hero-search-input"
                                    placeholder="Search woodcraft products"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    aria-label="Search woodcraft products"
                                />
                                <button 
                                    className="hero-search-btn"
                                    type="button"
                                    aria-label="Search products"
                                    title="Search products"
                                >
                                    <i className="fas fa-search" aria-hidden="true"></i>
                                    <span className="visually-hidden">Search</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Products Section */}
            <section className="products-section">
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
                                         selectedCategory === 'alkansya' ? 'Alkansya' : 'All Products'}
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
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                    {loading ? (
                        <motion.div 
                            className="loading-state"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="loading-spinner">
                                <Spinner animation="border" variant="primary" size="lg" />
                            </div>
                            <p className="loading-text">Loading our amazing products...</p>
                        </motion.div>
                    ) : (
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
                                        <motion.div
                                            key={product.id}
                                            className={`product-card ${selectedCategory !== 'all' ? 'filtered-product' : ''}`}
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.5, delay: index * 0.1 }}
                                            whileHover={{ 
                                                y: -10, 
                                                scale: 1.02,
                                                transition: { duration: 0.3 }
                                            }}
                                        >
                                            <div className="product-image-container">
                                                {/* Wishlist Heart Icon - Top Left */}
                                                {(() => {
                                                    const token = localStorage.getItem("token");
                                                    if (!token) return null;
                                                    
                                                    const inWishlist = isInWishlist(product.id);
                                                    const wishId = getWishlistId(product.id);
                                                    
                                                    return (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (inWishlist) {
                                                                    handleRemoveFromWishlist(wishId);
                                                                } else {
                                                                    handleAddToWishlist(product);
                                                                }
                                                            }}
                                                            disabled={wishlistLoading}
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
                                                    src={`http://localhost:8000/${product.image}`}
                                                    alt={product.product_name || product.name}
                                                    className="product-image"
                                                    onError={(e) => {
                                                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                                                    }}
                                                />
                                                
                                                <div className="product-overlay">
                                                    <motion.button
                                                        className="view-details-btn"
                                                        onClick={() => handleViewDetails(product)}
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
                                                            {product.is_available_for_order === true ? 'Available for Order' : 'Currently Not Available'}
                                                        </span>
                                                    ) : (
                                                        <span className={`stock-status ${product.stock > 10 ? 'in-stock' : product.stock > 0 ? 'low-stock' : 'out-of-stock'}`}>
                                                            <i className={`fas ${product.stock > 10 ? 'fa-check-circle' : product.stock > 0 ? 'fa-exclamation-triangle' : 'fa-times-circle'}`}></i>
                                                            {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            </section>

            {/* Map Section */}
            <motion.section 
                className="map-section-minimal"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
            >
                <div className="map-section-container">
                    <div className="map-wrapper-minimal-top">
                        <div className="map-header-minimal">
                            <i className="fas fa-map-marker-alt"></i>
                            <span>Visit Our Location</span>
                        </div>
                        <div className="map-iframe-wrapper">
                            <iframe
                                src="https://www.google.com/maps?q=14.2624446,121.1529838&hl=en&z=17&output=embed"
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title="UNICK Furniture Location"
                            ></iframe>
                        </div>
                        <a 
                            href="https://www.google.com/maps/place/Wood+Shop+UNICK/@14.2624446,121.1529838,17z/data=!3m1!4b1!4m6!3m5!1s0x3397d9138f7bc95d:0x9278fe89a256038d!8m2!3d14.2624446!4d121.1529838!16s%2Fg%2F11w9ytl522?entry=ttu" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="map-link-minimal"
                        >
                            <i className="fas fa-external-link-alt"></i>
                            Open in Google Maps
                        </a>
                    </div>
                </div>
            </motion.section>

            {/* Contact Information Section */}
            <motion.section 
                className="contact-section"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
            >
                <div className="contact-container">
                    <div className="company-brand">
                        <h2 className="company-name">UNICK FURNITURE</h2>
                        <p className="company-tagline">Wooden Crafts | Wooden Table</p>
                    </div>
                    
                    <div className="contact-details-center">
                        <div className="contact-item">
                            <i className="fab fa-viber"></i>
                            <span>Viber: 09351851259</span>
                        </div>
                        <div className="contact-item">
                            <i className="fas fa-envelope"></i>
                            <span>unickenterprisesinc@gmail.com</span>
                        </div>
                    </div>
                    
                    <div className="social-links">
                        <a 
                            href="https://web.facebook.com/unick.furnitures" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="social-link facebook-link"
                        >
                            <img 
                                src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI0IDEyLjA3M0MyNCA1LjQwNCAxOC42MjcgMCAxMiAwUzAgNS40MDQgMCAxMi4wNzNDMCAxOC4wOTkgNC4zODcgMjMuMDk0IDEwLjEyNSAyNFYxNS41NjJINy4wNzhWMTIuMDczSDEwLjEyNVY5LjQxM0MxMC4xMjUgNi4zOTcgMTEuOTE1IDQuNzE5IDE0LjY1NyA0LjcxOUMxNS45MzYgNC43MTkgMTcuMjgxIDQuOTk0IDE3LjI4MSA0Ljk5NFY4LjA2MkgxNS44MzlDMTQuNDMxIDguMDYyIDEzLjkzOCA4Ljk5MyAxMy45MzggMTAuMDE2VjEyLjA3M0gxNy4xNzJMMTYuNjg4IDE1LjU2MkgxMy45MzhWMjRDMTkuNjEzIDIzLjA5NCAyNCAxOC4wOTkgMjQgMTIuMDczWiIgZmlsbD0iIzE4NzdGMiIvPgo8L3N2Zz4K" 
                                alt="Facebook" 
                                className="social-logo"
                            />
                        </a>
                        <a 
                            href="https://www.tiktok.com/@unick_woodenalkansya?_r=1&_d=secCgYIASAHKAESPgo8Qbb1vMQ0yijdYoBZM40bzN0HWfPG%2F7OwN6Y7Ocjt%2BWH%2FmVrLdul6mQdaIxs5e1EF4bx1M2%2FEUXo7kC%2FMGgA%3D&_svg=1&checksum=ea80af720995a6f7e327bfe48e56d6df4620fbe7474f35cc17964b3ed0b7ee11&item_author_type=2&sec_uid=MS4wLjABAAAA0LtQ-Jz6f3xXo3M4-F25oBMVn3hRXU3h-4yB9SZQBUYEqNOnYCCkFle4J6CVXMk9&sec_user_id=MS4wLjABAAAAvUNsW0lNYhQh4GOzrIuKaB5mu2UIA0u4ZxNYDCsBYwdEJU5mdlmG-W6x8Fe31Rbq&share_app_id=1180&share_author_id=7190151741848618010&share_link_id=6C827862-82D2-4684-91A3-450DA05E67CB&share_scene=1&sharer_language=en&social_share_type=5&source=h5_t&timestamp=1760535502&tt_from=copy&u_code=df02gl186593ee&ug_btm=b2878%2Cb5836&user_id=6881305392279323649&utm_campaign=client_share&utm_medium=ios&utm_source=copy" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="social-link tiktok-link"
                        >
                            <img 
                                src="https://img.freepik.com/premium-photo/square-tiktok-logo-isolated-white-background_469489-1029.jpg?semt=ais_hybrid&w=740&q=80" 
                                alt="TikTok" 
                                className="social-logo"
                            />
                        </a>
                    </div>
                </div>
            </motion.section>

            {/* Product Modal */}
            <AnimatePresence>
                {showProductModal && selectedProduct && (
                    <motion.div 
                        className="product-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleCloseProductModal}
                    >
                        <motion.div 
                            className="product-modal-content"
                            initial={{ scale: 0.8, opacity: 0, y: 50 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: 50 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button className="close-modal-btn" onClick={handleCloseProductModal}>
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
                                                disabled={wishlistLoading}
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
                                    <h2 className="modal-product-name">{selectedProduct.product_name || selectedProduct.name}</h2>
                                    
                                    <div className="modal-product-price">
                                        ₱{selectedProduct.price.toLocaleString()}
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
                                    
                                    <div className="modal-product-stock">
                                        {selectedProduct.category_name === 'Made to Order' || selectedProduct.category_name === 'made_to_order' ? (
                                            <span className={`stock-status ${selectedProduct.is_available_for_order === true ? 'in-stock' : 'out-of-stock'}`}>
                                                <i className={`fas ${selectedProduct.is_available_for_order === true ? 'fa-tools' : 'fa-times-circle'}`}></i>
                                                {selectedProduct.is_available_for_order === true ? 'Available for Order' : 'Currently Not Available'}
                                            </span>
                                        ) : (
                                            <span className={`stock-status ${selectedProduct.stock > 10 ? 'in-stock' : selectedProduct.stock > 0 ? 'low-stock' : 'out-of-stock'}`}>
                                                <i className={`fas ${selectedProduct.stock > 10 ? 'fa-check-circle' : selectedProduct.stock > 0 ? 'fa-exclamation-triangle' : 'fa-times-circle'}`}></i>
                                                {selectedProduct.stock > 10 ? 'In Stock' : selectedProduct.stock > 0 ? `Only ${selectedProduct.stock} left` : 'Out of Stock'}
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="modal-action-buttons-landing">
                                        <motion.button 
                                            className="modal-add-to-cart-btn"
                                            onClick={handleAddToCartFromModal}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            disabled={(selectedProduct.category_name === 'Made to Order' || selectedProduct.category_name === 'made_to_order') ? (selectedProduct.is_available_for_order !== true) : (selectedProduct.stock === 0)}
                                        >
                                            <i className="fas fa-cart-plus"></i>
                                            Add to Cart
                                        </motion.button>
                                        
                                        <motion.button 
                                            className="modal-buy-now-btn"
                                            onClick={handleBuyFromModal}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            disabled={(selectedProduct.category_name === 'Made to Order' || selectedProduct.category_name === 'made_to_order') ? (selectedProduct.is_available_for_order !== true) : (selectedProduct.stock === 0)}
                                        >
                                            <i className="fas fa-bolt"></i>
                                            Buy Now
                                        </motion.button>
                                        
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Login Modal */}
            <AnimatePresence>
                {showLoginModal && (
                    <motion.div 
                        className="login-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleCloseLogin}
                    >
                        <motion.div 
                            className="login-modal-content"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button className="close-modal-btn" onClick={handleCloseLogin}>
                                <i className="fas fa-times"></i>
                            </button>
                            <Login onLoginSuccess={handleLoginSuccess} onShowRegister={handleShowRegister} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Register Modal */}
            <AnimatePresence>
                {showRegisterModal && (
                    <motion.div 
                        className="login-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleCloseRegister}
                    >
                        <motion.div 
                            className="login-modal-content"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button className="close-modal-btn" onClick={handleCloseRegister}>
                                <i className="fas fa-times"></i>
                            </button>
                            <RegisterModal onRegisterSuccess={handleRegisterSuccess} onShowLogin={handleShowLogin} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toast Notifications */}
            <Toaster 
                position="top-right"
                richColors
                closeButton
                expand={true}
                duration={4000}
            />
        </div>
    );
};

export default LandingPage;
