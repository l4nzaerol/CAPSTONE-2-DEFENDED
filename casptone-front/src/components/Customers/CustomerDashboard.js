 import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Spinner } from "react-bootstrap";
import ProductCatalog from "./ProductCatalog";
import "../LandingPage.css";
import "./CustomerDashboard.css";
import bannerImage from "../../assets/images/unick_banner.png";

const CustomerDashboard = ({ searchTerm = "" }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchProducts = useCallback(async (forceRefresh = false) => {
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
                    const parsedProducts = JSON.parse(cachedProducts);
                    setProducts(parsedProducts);
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
                
                // Show specific error messages
                if (error.response?.status === 500) {
                    console.error("Server error - backend issue");
                } else if (!error.response) {
                    console.error("Network error - check if backend is running");
                }
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
            
            // If we get rate limited, show a message and retry later
            if (error.response?.status === 429) {
                console.warn("Rate limited - will retry products fetch later");
                setTimeout(() => {
                    fetchProducts();
                }, 5000);
            }
        } finally {
            setLoading(false);
        }
    }, []); // Keep empty dependency array

    useEffect(() => {
        fetchProducts();

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
    }, [fetchProducts]);


    return (
      <div className="enhanced-customer-dashboard">
        {/* Promotional Banner Hero Section */}
        <div 
          className="promotional-banner-section"
          style={{ '--banner-image': `url(${bannerImage})` }}
        >
          <div className="banner-background"></div>
          <div className="banner-content">
            {/* Empty banner content - just for background */}
          </div>
        </div>


        {/* Enhanced Products Section */}
        <div className="products-section-enhanced">
          {loading ? (
            <div className="loading-container">
              <div className="loading-content">
                <Spinner animation="border" variant="primary" size="lg" />
                <p className="loading-text">Loading our amazing products...</p>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 1 }}
            >
              <ProductCatalog products={products} searchTerm={searchTerm} />
            </motion.div>
          )}
        </div>

        {/* Map Section */}
        <motion.section 
          className="map-section-minimal"
          style={{ marginBottom: '2.5rem' }}
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
            style={{ marginTop: '2rem' }}
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

      </div>
    );
};


// Memoize the component to prevent unnecessary re-renders
export default memo(CustomerDashboard);