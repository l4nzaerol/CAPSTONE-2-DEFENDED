import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { formatPrice } from "../../utils/currency";
import BuyNowModal from "./BuyNowModal";
import "./product_catalog.css";
import "../LandingPage.css";
import "./wishlist.css";

const Wishlist = () => {
    const navigate = useNavigate();
    const [wishlist, setWishlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [visibleProducts, setVisibleProducts] = useState([]);
    const [loadedCount, setLoadedCount] = useState(0);
    const itemsPerLoad = 6; // Load 6 items at a time
    const [showBuyNowModal, setShowBuyNowModal] = useState(false);
    const [buyNowProduct, setBuyNowProduct] = useState(null);

    const fetchWishlist = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                navigate("/");
                return;
            }

            const response = await axios.get("http://localhost:8000/api/wishlist", {
                headers: { Authorization: `Bearer ${token}` }
            });

            const wishlistItems = response.data.wishlist || [];
            setWishlist(wishlistItems);
            
            // Load first batch immediately
            if (wishlistItems.length > 0) {
                const firstBatch = wishlistItems.slice(0, itemsPerLoad);
                setVisibleProducts(firstBatch);
                setLoadedCount(itemsPerLoad);
            }
            
            setLoading(false);
        } catch (error) {
            if (error.response?.status === 401) {
                navigate("/");
            } else {
                toast.error("Failed to load wishlist");
            }
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        // Delay initial load by 2 seconds for faster perceived loading
        const timer = setTimeout(() => {
            fetchWishlist();
        }, 2000);

        return () => clearTimeout(timer);
    }, [fetchWishlist]);

    useEffect(() => {
        // Lazy load products with 2 second delay between batches
        if (wishlist.length > 0 && loadedCount < wishlist.length) {
            const timer = setTimeout(() => {
                const nextBatch = wishlist.slice(loadedCount, loadedCount + itemsPerLoad);
                setVisibleProducts(prev => [...prev, ...nextBatch]);
                setLoadedCount(prev => prev + itemsPerLoad);
            }, 2000);

            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wishlist.length, loadedCount, itemsPerLoad]);

    const handleRemoveFromWishlist = async (wishlistId) => {
        try {
            const token = localStorage.getItem("token");
            
            // Update state optimistically
            setWishlist(prev => prev.filter(item => item.id !== wishlistId));
            setVisibleProducts(prev => prev.filter(item => item.id !== wishlistId));
            
            await axios.delete(
                `http://localhost:8000/api/wishlist/${wishlistId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // No toast for removal - silent update
            // Dispatch event to update header count
            window.dispatchEvent(new CustomEvent('wishlistUpdated'));
        } catch (error) {
            toast.error("Failed to remove from wishlist");
            // Revert on error
            fetchWishlist();
        }
    };

    const handleAddToCart = async (product) => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(
                "http://localhost:8000/api/cart",
                { product_id: product.id, quantity: 1 },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success("Product added to cart!");
            window.dispatchEvent(new CustomEvent('cartUpdated'));
        } catch (error) {
            const message = error.response?.data?.message || "Failed to add to cart";
            toast.error(message);
        }
    };

    const handleBuyNow = (product) => {
        setBuyNowProduct(product);
        setShowBuyNowModal(true);
    };

    const handleOrderSuccess = () => {
        setShowBuyNowModal(false);
        setBuyNowProduct(null);
        // Optionally refresh wishlist or navigate
    };

    // Show loading only if we haven't loaded anything yet
    const isLoading = loading && visibleProducts.length === 0;

    return (
        <div className="wishlist-container" style={{ 
            padding: window.innerWidth <= 768 ? '1rem' : '2rem', 
            maxWidth: '1400px', 
            margin: '0 auto' 
        }}>
            <div style={{ 
                marginBottom: '2rem', 
                display: 'flex', 
                flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                justifyContent: 'space-between', 
                alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                gap: window.innerWidth <= 768 ? '1rem' : '0'
            }}>
                <div>
                    <h1 style={{ 
                        fontSize: window.innerWidth <= 768 ? '1.5rem' : '2rem', 
                        fontWeight: '700', 
                        color: '#2c3e50', 
                        marginBottom: '0.5rem' 
                    }}>
                        My Wishlist
                    </h1>
                    <p style={{ color: '#666', fontSize: window.innerWidth <= 768 ? '0.9rem' : '1rem' }}>
                        {wishlist.length === 0 
                            ? "Your wishlist is empty" 
                            : `${wishlist.length} ${wishlist.length === 1 ? 'item' : 'items'} in your wishlist`}
                    </p>
                </div>
                
                {/* Back to Dashboard Button - Only show when wishlist has products */}
                {wishlist.length > 0 && (
                    <button
                        onClick={() => navigate("/dashboard")}
                        style={{
                            padding: window.innerWidth <= 768 ? '0.625rem 1rem' : '0.75rem 1.5rem',
                            background: 'linear-gradient(135deg, #8B4513, #A0522D)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: window.innerWidth <= 768 ? '0.875rem' : '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            width: window.innerWidth <= 768 ? '100%' : 'auto',
                            justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(139, 69, 19, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = 'none';
                        }}
                    >
                        <i className="fas fa-arrow-left"></i>
                        Back to Dashboard
                    </button>
                )}
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p style={{ marginTop: '1rem' }}>Loading your wishlist...</p>
                    </div>
                </div>
            ) : (
                wishlist.length === 0 ? (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '4rem 2rem',
                    background: '#f8f9fa',
                    borderRadius: '12px',
                    marginTop: '2rem'
                }}>
                    <i className="fas fa-heart" style={{ fontSize: '4rem', color: '#ddd', marginBottom: '1rem' }}></i>
                    <h3 style={{ color: '#666', marginBottom: '0.5rem' }}>No items in your wishlist</h3>
                    <p style={{ color: '#999' }}>Start adding products you love to your wishlist!</p>
                    <button
                        onClick={() => navigate("/dashboard")}
                        style={{
                            marginTop: '1.5rem',
                            padding: '0.75rem 2rem',
                            background: 'linear-gradient(135deg, #8B4513, #A0522D)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                    >
                        Browse Products
                    </button>
                </div>
                ) : (
                    <>
                        <div className="wishlist-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '2rem',
                        marginTop: '2rem'
                    }}>
                        {visibleProducts.map((item) => {
                        const product = item.product;
                        if (!product) return null;

                        const categoryName = product.category_name || '';
                        const isMadeToOrder = categoryName === 'Made to Order' || categoryName === 'made_to_order';
                        const isAvailable = isMadeToOrder 
                            ? product.is_available_for_order === true 
                            : product.stock > 0;

                        return (
                            <motion.div
                                key={item.id}
                                className="product-card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                                    position: 'relative'
                                }}
                            >
                                <div className="product-image-container" style={{ position: 'relative' }}>
                                    <img
                                        src={`http://localhost:8000/${product.image}`}
                                        alt={product.product_name || product.name}
                                        className="product-image"
                                        style={{ width: '100%', height: '250px', objectFit: 'cover' }}
                                        onError={(e) => {
                                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                                        }}
                                    />
                                    <button
                                        onClick={() => handleRemoveFromWishlist(item.id)}
                                        style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            background: 'rgba(255, 255, 255, 0.9)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '36px',
                                            height: '36px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            fontSize: '20px',
                                            color: '#DC2626',
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                                        }}
                                        title="Remove from wishlist"
                                    >
                                        ♥
                                    </button>
                                </div>

                                <div className="product-info" style={{ padding: '1.25rem' }}>
                                    <h3 className="product-name" style={{ 
                                        fontSize: '1.1rem', 
                                        fontWeight: '600', 
                                        marginBottom: '0.5rem',
                                        color: '#2c3e50'
                                    }}>
                                        {product.product_name || product.name}
                                    </h3>
                                    <p className="product-price" style={{ 
                                        fontSize: '1.5rem', 
                                        fontWeight: '700', 
                                        color: '#059669',
                                        marginBottom: '1rem'
                                    }}>
                                        {formatPrice(product.price)}
                                    </p>

                                    <div style={{ marginBottom: '1rem' }}>
                                        {isMadeToOrder ? (
                                            <span className={`stock-status ${isAvailable ? 'in-stock' : 'out-of-stock'}`}>
                                                <i className={`fas ${isAvailable ? 'fa-tools' : 'fa-times-circle'}`}></i>
                                                {isAvailable ? 'Available for Made to Order' : 'Currently Not Available'}
                                            </span>
                                        ) : (
                                            <span className={`stock-status ${product.stock > 10 ? 'in-stock' : product.stock > 0 ? 'low-stock' : 'out-of-stock'}`}>
                                                <i className={`fas ${product.stock > 10 ? 'fa-check-circle' : product.stock > 0 ? 'fa-exclamation-triangle' : 'fa-times-circle'}`}></i>
                                                {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="product-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            className="add-to-cart-btn"
                                            onClick={() => handleAddToCart(product)}
                                            disabled={!isAvailable}
                                            style={{
                                                flex: 1,
                                                padding: '0.75rem',
                                                background: isAvailable 
                                                    ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)' 
                                                    : '#ccc',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: '600',
                                                cursor: isAvailable ? 'pointer' : 'not-allowed',
                                                fontSize: '0.9rem',
                                                transition: 'all 0.3s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (isAvailable) {
                                                    e.target.style.transform = 'translateY(-2px)';
                                                    e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.transform = 'translateY(0)';
                                                e.target.style.boxShadow = 'none';
                                            }}
                                        >
                                            <i className="fas fa-cart-plus"></i> Add to Cart
                                        </button>
                                        <button
                                            className="buy-now-btn"
                                            onClick={() => handleBuyNow(product)}
                                            disabled={!isAvailable}
                                            style={{
                                                flex: 1,
                                                padding: '0.75rem',
                                                background: isAvailable 
                                                    ? 'linear-gradient(135deg, #DC2626, #B91C1C)' 
                                                    : '#ccc',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: '700',
                                                cursor: isAvailable ? 'pointer' : 'not-allowed',
                                                fontSize: '0.9rem',
                                                transition: 'all 0.3s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                boxShadow: isAvailable ? '0 2px 8px rgba(220, 38, 38, 0.3)' : 'none'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (isAvailable) {
                                                    e.target.style.transform = 'translateY(-2px)';
                                                    e.target.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)';
                                                    e.target.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.4)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.transform = 'translateY(0)';
                                                e.target.style.background = isAvailable 
                                                    ? 'linear-gradient(135deg, #DC2626, #B91C1C)' 
                                                    : '#ccc';
                                                e.target.style.boxShadow = isAvailable ? '0 2px 8px rgba(220, 38, 38, 0.3)' : 'none';
                                            }}
                                        >
                                            <i className="fas fa-bolt"></i> Buy Now
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                        })}
                    </div>
                    
                    {/* Loading indicator for lazy loading */}
                    {loadedCount < wishlist.length && (
                        <div style={{ 
                            textAlign: 'center', 
                            marginTop: '2rem',
                            padding: '2rem'
                        }}>
                            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                                <span className="visually-hidden">Loading more...</span>
                            </div>
                            <p style={{ marginTop: '1rem', color: '#666' }}>
                                Loading more products...
                            </p>
                        </div>
                    )}
                    </>
                )
            )}

            {/* Buy Now Modal */}
            <BuyNowModal
                show={showBuyNowModal}
                onClose={() => {
                    setShowBuyNowModal(false);
                    setBuyNowProduct(null);
                }}
                product={buyNowProduct}
                onOrderSuccess={handleOrderSuccess}
            />
        </div>
    );
};

export default Wishlist;

