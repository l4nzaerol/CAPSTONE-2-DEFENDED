import React, { useEffect, useState, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ShoppingCart, User } from "lucide-react";
import { LayoutDashboard, Package, ClipboardList, Boxes, Factory, BarChart } from "lucide-react";
import NotificationBell from "./Customers/NotificationBell";



// 🧠 Get role and username from localStorage
const getUserData = () => ({
    username: localStorage.getItem("username") || "Guest",
    role: localStorage.getItem("role") || "User",
    token: localStorage.getItem("token") || null,
});

// 📱 Sidebar Context for minimize functionality
const SidebarContext = createContext();

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        // Return default values if not within provider (for customer pages)
        return { isMinimized: false, toggleSidebar: () => {} };
    }
    return context;
};

// 🔷 Header Component
const Header = ({ role, username, searchTerm, setSearchTerm }) => {
    const navigate = useNavigate();
    const [cartCount, setCartCount] = useState(0);
    const [showSearch, setShowSearch] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        // Check if mobile on mount and resize
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        // Close mobile menu when clicking outside
        const handleClickOutside = (e) => {
            if (showMobileMenu && !e.target.closest('.mobile-menu-container')) {
                setShowMobileMenu(false);
            }
        };

        window.addEventListener('resize', handleResize);
        document.addEventListener('click', handleClickOutside);
        handleResize(); // Initial check

        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showMobileMenu]);

    useEffect(() => {
        if (role === "customer") {
            const fetchCartCount = async () => {
                try {
                    const token = localStorage.getItem("token");
                    if (!token) throw new Error("User not authenticated.");

                    const response = await axios.get("http://localhost:8000/api/cart", {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const totalItems = response.data.reduce((sum, item) => sum + item.quantity, 0);
                    setCartCount(totalItems);
                } catch (err) {
                    console.error("Failed to fetch cart count:", err);
                }
            };

            // Fetch cart count on mount
            fetchCartCount();

            // Listen for cart item added events
            const handleCartItemAdded = () => {
                // Simply increment the cart count instead of fetching all cart data
                setCartCount(prev => prev + 1);
            };

            window.addEventListener('cartItemAdded', handleCartItemAdded);
            
            return () => {
                window.removeEventListener('cartItemAdded', handleCartItemAdded);
            };
        }
    }, [role]);

    const handleLogout = () => {
        localStorage.clear();
        navigate("/");
    };

    return (
        <header style={{
            ...(role === "customer" ? styles.headerTransparent : styles.headerWood),
            padding: isMobile ? "0 1rem" : "0 2rem"
        }}>
            <div style={styles.left} onClick={() => navigate("/dashboard")}>
                <h2 style={{ ...styles.logo, fontSize: isMobile ? '1.2rem' : '1.5rem' }}>UNICK FURNITURE</h2>
            </div>

            <div className="mobile-menu-container" style={{ ...styles.right, position: "relative", gap: isMobile ? '0.5rem' : '1.5rem' }}>
                {role === "customer" && (
                    <>
                        {/* Search Icon with Dropdown */}
                        <div style={{ position: "relative" }}>
                            <button 
                                style={styles.iconBtn} 
                                onClick={() => setShowSearch(!showSearch)}
                                title="Search"
                            >
                                <i className="fas fa-search" style={{ fontSize: isMobile ? '16px' : '20px', color: '#333' }}></i>
                            </button>
                            
                            {showSearch && (
                                <div style={{ ...styles.searchDropdown, minWidth: isMobile ? '280px' : '350px' }}>
                                    <input
                                        type="text"
                                        placeholder="Search for products..."
                                        value={searchTerm || ""}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={styles.searchInput}
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                        
                        <NotificationBell />
                        <button style={styles.iconBtn} onClick={() => navigate("/cart")}>
                            <ShoppingCart size={isMobile ? 20 : 24} />
                            {cartCount > 0 && <span style={styles.cartBadge}>{cartCount}</span>}
                        </button>
                    </>
                )}
                
                {/* Mobile menu button */}
                {isMobile ? (
                    <button 
                        className="mobile-menu-container"
                        style={styles.mobileMenuBtn}
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                    >
                        <i className="fas fa-bars"></i>
                    </button>
                ) : (
                    <>
                        <div style={styles.userSection}>
                            <span 
                                style={styles.username} 
                                onClick={() => navigate("/profile")}
                                title="Click to view your profile"
                                onMouseEnter={(e) => {
                                    e.target.style.background = "rgba(255,255,255,0.2)";
                                    e.target.style.transform = "translateY(-1px)";
                                    e.target.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = "rgba(255,255,255,0.1)";
                                    e.target.style.transform = "translateY(0)";
                                    e.target.style.boxShadow = "none";
                                }}
                            >
                                <User size={20} /> {username}
                            </span>
                        </div>
                        
                        <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
                    </>
                )}
            </div>

            {/* Mobile dropdown menu */}
            {isMobile && showMobileMenu && (
                <div className="mobile-menu-container" style={styles.mobileDropdown}>
                    <div style={styles.mobileUser}>
                        <User size={18} />
                        <span>{username}</span>
                    </div>
                    <button 
                        style={styles.mobileMenuItem}
                        onClick={() => {
                            navigate("/profile");
                            setShowMobileMenu(false);
                        }}
                        onMouseEnter={handleMobileMenuItemHover}
                        onMouseLeave={handleMobileMenuItemLeave}
                    >
                        <i className="fas fa-user"></i> Profile
                    </button>
                    <button 
                        style={styles.mobileMenuItem}
                        onClick={() => {
                            handleLogout();
                            setShowMobileMenu(false);
                        }}
                        onMouseEnter={handleMobileMenuItemHover}
                        onMouseLeave={handleMobileMenuItemLeave}
                    >
                        <i className="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            )}
        </header>
    );
};

// Define nav items outside component to prevent recreation
const SIDEBAR_NAV_ITEMS = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["employee", "admin", "staff"] },
    { path: "/product", icon: Package, label: "Products", roles: ["employee", "admin"] },
    { path: "/orders", icon: ClipboardList, label: "Orders", roles: ["employee", "admin"] },
    { path: "/normalized-inventory", icon: Boxes, label: "Inventory", roles: ["employee", "admin", "staff"] },
    { path: "/productions", icon: Factory, label: "Productions", roles: ["employee", "admin", "staff"] },
    { path: "/reports", icon: BarChart, label: "Reports", roles: ["employee", "admin"] },
];

// 🔸 Sidebar for Admin with minimize functionality
const Sidebar = ({ isMinimized, toggleSidebar }) => {
    const navigate = useNavigate();
    const [role, setRole] = useState(() => localStorage.getItem("role") || "");
    const [hoveredItem, setHoveredItem] = useState(null);
    
    // Update role when localStorage changes
    useEffect(() => {
        const handleStorageChange = () => {
            const currentRole = localStorage.getItem("role") || "";
            setRole(currentRole);
        };
        
        // Check role on mount and when storage changes
        handleStorageChange();
        window.addEventListener("storage", handleStorageChange);
        
        // Also check periodically in case role changes in same tab
        const interval = setInterval(handleStorageChange, 1000);
        
        return () => {
            window.removeEventListener("storage", handleStorageChange);
            clearInterval(interval);
        };
    }, []);

    const handleLogout = () => {
        localStorage.clear();
        navigate("/");
    };

    // Normalize role to lowercase for consistent comparison
    const normalizedRole = role ? String(role).toLowerCase().trim() : "";
    
    // Filter menu items based on user role
    // Staff can see Dashboard, Productions, and Inventory
    // Employee/Admin can see all items
    const filteredNavItems = React.useMemo(() => {
        // Staff role: Dashboard, Productions, and Inventory
        if (normalizedRole === "staff") {
            // Explicitly return only allowed paths for staff
            const allowedPaths = ["/dashboard", "/productions", "/normalized-inventory"];
            return SIDEBAR_NAV_ITEMS.filter(item => allowedPaths.includes(item.path));
        }
        
        // Employee/Admin roles: Can access all items
        if (normalizedRole === "employee" || normalizedRole === "admin") {
            return SIDEBAR_NAV_ITEMS; // Show all items for employee/admin
        }
        
        // Default: No access (shouldn't happen for authenticated users)
        return [];
    }, [normalizedRole]);

    return (
        <div style={{
            ...styles.sidebarModern,
            width: isMinimized ? "80px" : "280px",
            transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }}>
            <div>
                {/* Brand Section with Simple Toggle Button */}
                <div style={styles.brandSection}>
                    <div 
                        style={{
                            ...styles.brandModern,
                            padding: isMinimized ? "1rem 0.5rem" : "2rem 1.5rem 2rem 1.5rem",
                            justifyContent: isMinimized ? "center" : "flex-start",
                            cursor: "default", // Make non-clickable
                            position: "relative",
                            paddingRight: isMinimized ? "0.5rem" : "4rem" // Add space for button
                        }}
                        onMouseEnter={(e) => {
                            if (!isMinimized) {
                                e.target.style.transform = "scale(1.02)";
                                e.target.style.background = "linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)";
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isMinimized) {
                                e.target.style.transform = "scale(1)";
                                e.target.style.background = "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)";
                            }
                        }}
                    >
                        {/* Removed Factory icon - text only */}
                        {!isMinimized && <span>Unick Furniture</span>}
                    </div>
                    
                    {/* Simple Toggle Button - Positioned to avoid overlap */}
                    <button 
                        style={{
                            ...styles.simpleToggleButton,
                            ...(isMinimized ? styles.simpleToggleButtonMinimized : {})
                        }}
                        onClick={toggleSidebar}
                        title={isMinimized ? "Expand Sidebar" : "Minimize Sidebar"}
                        onMouseEnter={(e) => {
                            e.target.style.background = "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)";
                            e.target.style.transform = "scale(1.1)";
                            e.target.style.boxShadow = "0 4px 12px rgba(255, 215, 0, 0.4)";
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = isMinimized 
                                ? "linear-gradient(135deg, #8B4513 0%, #A0522D 100%)"
                                : "linear-gradient(135deg, #2C1810 0%, #3D2817 100%)";
                            e.target.style.transform = "scale(1)";
                            e.target.style.boxShadow = isMinimized 
                                ? "0 2px 8px rgba(139, 69, 19, 0.3)"
                                : "0 3px 10px rgba(139, 69, 19, 0.2)";
                        }}
                    >
                        {isMinimized ? "→" : "←"}
                    </button>
                </div>

                <nav style={{
                    ...styles.navModern,
                    padding: isMinimized ? "1rem 0.5rem" : "1.5rem"
                }}>
                    {filteredNavItems.map((item, index) => {
                        const IconComponent = item.icon;
                        return (
                            <button 
                                key={index}
                                style={{
                                    ...styles.navItem,
                                    ...(hoveredItem === index ? styles.navItemHover : {}),
                                    padding: isMinimized ? "1rem 0.5rem" : "1rem 1.25rem",
                                    justifyContent: isMinimized ? "center" : "flex-start"
                                }}
                                onClick={() => navigate(item.path)}
                                onMouseEnter={() => setHoveredItem(index)}
                                onMouseLeave={() => setHoveredItem(null)}
                                title={isMinimized ? item.label : ""}
                            >
                                <IconComponent size={20} style={{ 
                                    color: hoveredItem === index ? "#FFD700" : "#FFF8DC",
                                    transition: "color 0.3s ease"
                                }} />
                                {!isMinimized && <span>{item.label}</span>}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <button 
                style={{
                    ...styles.logoutModern,
                    padding: isMinimized ? "1rem 0.5rem" : "1rem 1.5rem",
                    margin: isMinimized ? "1.5rem 0.5rem" : "1.5rem",
                    justifyContent: isMinimized ? "center" : "flex-start"
                }}
                onClick={handleLogout}
                title={isMinimized ? "Logout" : ""}
                onMouseEnter={(e) => {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 8px 24px rgba(139, 69, 19, 0.4)";
                    e.target.style.background = "linear-gradient(135deg, #8B4513 0%, #2C1810 100%)";
                    e.target.style.borderColor = "#FFD700";
                }}
                onMouseLeave={(e) => {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 16px rgba(139, 69, 19, 0.3)";
                    e.target.style.background = "linear-gradient(135deg, #2C1810 0%, #3D2817 100%)";
                    e.target.style.borderColor = "#F4E4BC";
                }}
            >
                {!isMinimized && "Logout"}
            </button>
        </div>
    );
};

// 📦 Sidebar Provider Component
const SidebarProvider = ({ children }) => {
    // Load initial state from localStorage or default to false
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });

    const toggleSidebar = () => {
        const newState = !isMinimized;
        setIsMinimized(newState);
        // Save to localStorage
        localStorage.setItem('sidebarMinimized', JSON.stringify(newState));
    };

    return (
        <SidebarContext.Provider value={{ isMinimized, toggleSidebar }}>
            {children}
        </SidebarContext.Provider>
    );
};

// 📦 Final Layout
const AppLayout = ({ children, searchTerm, setSearchTerm }) => {
    const [userData, setUserData] = useState(() => getUserData());
    const { isMinimized, toggleSidebar } = useSidebar();
    
    const { role, username } = userData;
    
    // Update user data when localStorage changes (e.g., on login/logout)
    useEffect(() => {
        const handleStorageChange = () => {
            setUserData(getUserData());
        };
        
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    return (
        <>
            {/* Show header only for customer */}
            {role === "customer" && <Header role={role} username={username} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
            
            {/* Show sidebar only for employees/admins */}
            {role !== "customer" && <Sidebar isMinimized={isMinimized} toggleSidebar={toggleSidebar} />}

            {/* Adjust layout spacing depending on role */}
            <div
                style={{
                    marginLeft: role !== "customer" ? (isMinimized ? "80px" : "280px") : 0,
                    marginTop: role === "customer" ? "60px" : 0,
                    padding: role === "customer" ? "0" : "1rem",
                    transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    minHeight: "100vh",
                    width: role === "customer" ? "100%" : "auto"
                }}
            >
                {children}
            </div>
            {role !== "customer" && (
                <footer className="footer-wood text-center" style={{ 
                    marginLeft: isMinimized ? "80px" : "280px",
                    transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}>
                    <div className="container">
                        <small>© {new Date().getFullYear()} Unick Furniture — Crafted with care</small>
                    </div>
                </footer>
            )}
        </>
    );
};

// 📦 Main App Layout with Sidebar Provider
const AppLayoutWithProvider = ({ children, searchTerm, setSearchTerm }) => {
    const { role } = getUserData();
    
    if (role === "customer") {
        return <AppLayout searchTerm={searchTerm} setSearchTerm={setSearchTerm}>{children}</AppLayout>;
    }
    
    return (
        <SidebarProvider>
            <AppLayout searchTerm={searchTerm} setSearchTerm={setSearchTerm}>{children}</AppLayout>
        </SidebarProvider>
    );
};

const styles = {
    headerTransparent: {
        width: "100%",
        height: "60px",
        backgroundColor: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 999,
        boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
    },
    headerWood: {
        width: "100%",
        height: "60px",
        background: "linear-gradient(180deg, #e8d9c6, #d9c7ae)",
        color: "#2f2a26",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 2rem",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 999,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    },
    left: {
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
    },
    right: {
        display: "flex",
        alignItems: "center",
        gap: "1.5rem",
    },
    logo: {
        fontSize: "1.5rem",
        fontWeight: "bold",
        color: "#333",
    },
    userSection: {
        display: "flex",
        alignItems: "center",
    },
    username: {
        display: "flex",
        alignItems: "center",
        fontSize: "1rem",
        gap: "0.5rem",
        color: "#333",
        cursor: "pointer",
        padding: "8px 12px",
        borderRadius: "8px",
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.2)",
        transition: "all 0.3s ease",
        fontWeight: "500",
        userSelect: "none",
    },
    iconBtn: {
        background: "none",
        border: "none",
        position: "relative",
        cursor: "pointer",
        padding: "0.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.3s ease",
    },
    cartBadge: {
        position: "absolute",
        top: "-6px",
        right: "-8px",
        backgroundColor: "#ff2e2e",
        color: "#fff",
        fontSize: "0.75rem",
        borderRadius: "50%",
        padding: "2px 6px",
    },
    logoutBtn: {
        background: "linear-gradient(180deg, #b5835a, #8b5e34)",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        padding: "6px 12px",
        cursor: "pointer",
        boxShadow: "0 8px 16px rgba(139,94,52,0.25)",
    },
    themeBtn: {
        background: "linear-gradient(180deg, #d9c7ae, #cbb79a)",
        color: "#2f2a26",
        border: "none",
        borderRadius: "8px",
        padding: "6px 12px",
        cursor: "pointer",
        boxShadow: "0 6px 12px rgba(0,0,0,0.08)",
    },

    
    sidebarModern: {
        background: "linear-gradient(135deg, #8B4513 0%, #A0522D 50%, #D2691E 100%)",
        color: "#FFF8DC",
        width: "280px",
        height: "100vh",
        padding: "0",
        position: "fixed",
        top: 0,
        left: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "8px 0 32px rgba(139, 69, 19, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        backdropFilter: "blur(20px)",
        borderRight: "2px solid #F4E4BC",
        zIndex: 1000,
    },
    
    brandModern: {
        display: "flex",
        alignItems: "center",
        fontSize: "1.8rem",
        fontWeight: "700",
        color: "#FFF8DC",
        marginBottom: "0",
        cursor: "pointer",
        gap: "0.75rem",
        padding: "2rem 1.5rem",
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)",
        borderBottom: "2px solid #F4E4BC",
        position: "relative",
        transition: "all 0.3s ease",
        textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)",
    },
    
    userModern: {
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "1rem",
        color: "#ffeccc",
        marginBottom: "2rem",
        paddingLeft: "2px",
        borderBottom: "1px dashed rgba(255,255,255,0.15)",
        paddingBottom: "0.5rem",
    },
    
    navModern: {
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        padding: "1.5rem",
        flex: 1,
    },
    
    navItem: {
        background: "transparent",
        color: "#FFF8DC",
        border: "none",
        padding: "1rem 1.25rem",
        borderRadius: "12px",
        fontSize: "0.95rem",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        fontWeight: "500",
        letterSpacing: "0.2px",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        overflow: "hidden",
        borderLeft: "3px solid transparent",
    },
    navItemHover: {
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)",
        transform: "translateX(8px)",
        color: "#FFF8DC",
        borderLeft: "3px solid #FFD700",
        boxShadow: "0 4px 20px rgba(139, 69, 19, 0.2)",
    },
    
    logoutModern: {
        background: "linear-gradient(135deg, #2C1810 0%, #3D2817 100%)",
        color: "#FFF8DC",
        border: "2px solid #F4E4BC",
        padding: "1rem 1.5rem",
        fontSize: "0.95rem",
        fontWeight: "600",
        borderRadius: "12px",
        cursor: "pointer",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        letterSpacing: "0.3px",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        margin: "1.5rem",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(139, 69, 19, 0.3)",
    },
    
    brandSection: {
        position: "relative",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
    },
    
    simpleToggleButton: {
        position: "absolute",
        top: "1rem",
        right: "1rem",
        background: "linear-gradient(135deg, #2C1810 0%, #3D2817 100%)",
        color: "#FFF8DC",
        border: "1px solid #F4E4BC",
        borderRadius: "4px",
        padding: "0.5rem",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.3s ease",
        boxShadow: "0 3px 10px rgba(139, 69, 19, 0.2)",
        zIndex: 10,
        width: "32px",
        height: "32px",
        fontSize: "14px",
        fontWeight: "bold"
    },
    
    simpleToggleButtonMinimized: {
        top: "0.5rem",
        right: "0.5rem",
        width: "28px",
        height: "28px",
        background: "linear-gradient(135deg, #8B4513 0%, #A0522D 100%)",
        border: "1px solid #FFD700",
        boxShadow: "0 2px 8px rgba(139, 69, 19, 0.3)",
        fontSize: "12px"
    },
    
    toggleButtonIntegrated: {
        position: "absolute",
        top: "1rem",
        right: "1rem",
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)",
        color: "#FFF8DC",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        borderRadius: "6px",
        padding: "0.4rem",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.3s ease",
        boxShadow: "0 2px 8px rgba(139, 69, 19, 0.3)",
        zIndex: 10,
        width: "32px",
        height: "32px"
    },
    
    toggleContainer: {
        display: "flex",
        justifyContent: "flex-end",
        padding: "1rem 1rem 0.5rem 1rem",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
    },
    
    toggleButton: {
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
        color: "#FFF8DC",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        borderRadius: "8px",
        padding: "0.5rem",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.3s ease",
        boxShadow: "0 2px 8px rgba(139, 69, 19, 0.2)"
    },
    
    searchDropdown: {
        position: "absolute",
        top: "calc(100% + 0.5rem)",
        right: "0",
        backgroundColor: "white",
        padding: "1rem",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        zIndex: 1000,
        minWidth: "350px",
        maxWidth: "500px"
    },
    
    searchInput: {
        width: "100%",
        padding: "0.75rem 1rem",
        border: "2px solid #e9ecef",
        borderRadius: "8px",
        fontSize: "1rem",
        outline: "none",
        transition: "all 0.3s ease",
        boxSizing: "border-box"
    },
    
    mobileMenuBtn: {
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "0.5rem",
        fontSize: "1.2rem",
        color: "#333",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    },
    
    mobileDropdown: {
        position: "absolute",
        top: "100%",
        right: "1rem",
        marginTop: "0.5rem",
        backgroundColor: "white",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        zIndex: 1000,
        minWidth: "200px",
        overflow: "hidden"
    },
    
    mobileUser: {
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "1rem",
        borderBottom: "1px solid #e9ecef",
        fontSize: "0.95rem",
        fontWeight: "600",
        color: "#333"
    },
    
    mobileMenuItem: {
        width: "100%",
        background: "none",
        border: "none",
        padding: "0.875rem 1rem",
        cursor: "pointer",
        fontSize: "0.9rem",
        color: "#333",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        transition: "background 0.2s ease",
        textAlign: "left"
    }
};

// Add hover effect for mobile menu items
const handleMobileMenuItemHover = (e) => {
    e.target.style.background = "#f8f9fa";
};

const handleMobileMenuItemLeave = (e) => {
    e.target.style.background = "none";
};


export default AppLayoutWithProvider;
