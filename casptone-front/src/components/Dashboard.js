import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayoutWithProvider from "./Header";
import AdminDashboard from "./Admin/AdminDashboard";
import CustomerDashboard from "./Customers/CustomerDashboard";

const Dashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState({ username: "", role: "" });
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");
        const storedUsername = localStorage.getItem("username");
        const storedRole = localStorage.getItem("role");

        if (!token || !storedUsername || !storedRole) {
            navigate("/");
            return;
        }

        setUser({ username: storedUsername, role: storedRole });
    }, [navigate]);

    return (
        <AppLayoutWithProvider searchTerm={searchTerm} setSearchTerm={setSearchTerm}>
            {user.role === "employee" || user.role === "staff" ? (
                <AdminDashboard />
            ) : user.role === "customer" ? (
                <CustomerDashboard searchTerm={searchTerm} />
            ) : (
                <p>Loading content...</p>
            )}
        </AppLayoutWithProvider>
    );
};

export default Dashboard;