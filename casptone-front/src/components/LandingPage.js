import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Spinner } from "react-bootstrap";
import { Toaster } from "sonner";
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

    useEffect(() => {
        // Check if user is already authenticated and redirect if needed
        if (authUtils.checkAndRedirect()) {
            return;
        }
        
        fetchProducts();
    }, []);

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

    const fetchProducts = async () => {
        setLoading(true);
        try {
            // Check if we have cached products (valid for 5 minutes)
            const cachedProducts = localStorage.getItem('cached_products');
            const cacheTimestamp = localStorage.getItem('products_cache_timestamp');
            const now = Date.now();
            const cacheValid = cacheTimestamp && (now - parseInt(cacheTimestamp)) < 300000; // 5 minutes
            
            if (cachedProducts && cacheValid) {
                console.log("Using cached products for faster loading");
                setProducts(JSON.parse(cachedProducts));
                setLoading(false);
                return;
            }
    
            const response = await axios.get("http://localhost:8000/api/products", {
                timeout: 10000, // 10 second timeout
            });
    
            console.log("Fetched products:", response.data);
            console.log("Products count:", response.data.length);
            setProducts(response.data);
            
            // Cache the products for faster future loads
            localStorage.setItem('cached_products', JSON.stringify(response.data));
            localStorage.setItem('products_cache_timestamp', now.toString());
            
        } catch (error) {
            console.error("Error fetching products:", error.response || error);
            
            // Try to use cached data if available, even if expired
            const cachedProducts = localStorage.getItem('cached_products');
            if (cachedProducts) {
                console.log("Using expired cache as fallback");
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
                                <input
                                    type="text"
                                    className="hero-search-input"
                                    placeholder="Search woodcraft products"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <button className="hero-search-btn">
                                    <i className="fas fa-search"></i>
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
                                                {/* Wood Type Badge */}
                                                
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
                                                        <span className="stock-status in-stock">
                                                            <i className="fas fa-tools"></i>
                                                            Available for Order
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
                                        ₱{selectedProduct.price.toLocaleString()}
                                    </div>
                                    
                                    <div className="modal-product-description">
                                        <h3>Product Description</h3>
                                        <p>
                                            {selectedProduct.description || 
                                            `Premium quality ${selectedProduct.name.toLowerCase()} made with traditional craftsmanship and modern design. Each piece is carefully crafted to bring warmth and elegance to your home.`}
                                        </p>
                                    </div>
                                    
                                    <div className="modal-product-stock">
                                        <span className={`stock-status ${selectedProduct.stock > 10 ? 'in-stock' : selectedProduct.stock > 0 ? 'low-stock' : 'out-of-stock'}`}>
                                            <i className={`fas ${selectedProduct.stock > 10 ? 'fa-check-circle' : selectedProduct.stock > 0 ? 'fa-exclamation-triangle' : 'fa-times-circle'}`}></i>
                                            {selectedProduct.stock > 10 ? 'In Stock' : selectedProduct.stock > 0 ? `Only ${selectedProduct.stock} left` : 'Out of Stock'}
                                        </span>
                                    </div>
                                    
                                    <motion.button 
                                        className="modal-buy-now-btn"
                                        onClick={handleBuyFromModal}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        disabled={selectedProduct.stock === 0}
                                    >
                                        <i className="fas fa-shopping-bag"></i>
                                        Buy Now
                                    </motion.button>
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
