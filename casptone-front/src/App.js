import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Toaster } from "sonner";
import "bootstrap/dist/css/bootstrap.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

// Components
import LandingPage from "./components/LandingPage";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import Cart from "./components/Customers/Cart";
import ProductPage from "./components/Admin/ProductPage"; 
import ProductionPage from "./components/Admin/ProductionPage"; 
import InventoryPage from "./components/Admin/InventoryPage"; 
import NormalizedInventoryPage from "./components/Admin/NormalizedInventoryPage";
import OrderPage from "./components/Admin/OrderPage"; 
import Report from "./components/Admin/Report"; 
import AdvancedReportsPage from "./components/Admin/AdvancedReportsPage";
import EnhancedProductionDashboard from "./components/Admin/EnhancedProductionDashboard";
import OrderAcceptance from "./components/Admin/OrderAcceptance";
import MyOrders from "./components/Customers/MyOrders";
// import OrderTracking from "./components/Customers/OrderTracking";
import SimpleOrderTracking from "./components/Customers/SimpleOrderTracking";
import UserProfile from "./components/Customers/UserProfile";

// ✅ Authentication Check
const isAuthenticated = () => !!localStorage.getItem("token");

function App() {
    return (
        <Router>
            <Toaster position="top-right" richColors />
            <main id="main-content">
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Routes */}
                <Route path="/cart" element={isAuthenticated() ? <Cart /> : <Navigate to="/" />} />
                <Route path="/my-orders" element={isAuthenticated() ? <MyOrders /> : <Navigate to="/" />} />
                <Route path="/profile" element={isAuthenticated() ? <UserProfile /> : <Navigate to="/" />} />
                <Route path="/dashboard" element={isAuthenticated() ? <Dashboard /> : <Navigate to="/" />} />
                <Route path="/inventory" element={isAuthenticated() ? <InventoryPage /> : <Navigate to="/" />} /> 
                <Route path="/normalized-inventory" element={isAuthenticated() ? <NormalizedInventoryPage /> : <Navigate to="/" />} /> 
                <Route path="/product" element={isAuthenticated() ? <ProductPage /> : <Navigate to="/" />} /> 
                <Route path="/productions" element={isAuthenticated() ? <ProductionPage /> : <Navigate to="/" />} /> 
                <Route path="/production-analytics" element={isAuthenticated() ? <EnhancedProductionDashboard /> : <Navigate to="/" />} /> 
                <Route path="/orders" element={isAuthenticated() ? <OrderPage /> : <Navigate to="/" />} />
                <Route path="/order-acceptance" element={isAuthenticated() ? <OrderAcceptance /> : <Navigate to="/" />} /> 
                <Route path="/reports" element={isAuthenticated() ? <Report /> : <Navigate to="/" />} /> 
                <Route path="/advanced-reports" element={isAuthenticated() ? <AdvancedReportsPage /> : <Navigate to="/" />} /> 
                <Route path="/track/:orderId" element={isAuthenticated() ? <TrackWrapper /> : <Navigate to="/" />} />

                {/* Redirect unknown routes */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            </main>
        </Router>
    );
}

export default App;

function TrackWrapper(){
    const { orderId } = useParams();
    return <SimpleOrderTracking orderId={orderId} />;
}
