import React, { useEffect, useState } from "react";
import axios from "axios";
import AppLayout from "../Header";
import { Link } from "react-router-dom";
import ProductionTracking from "./ProductionTracking";

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [tracking, setTracking] = useState(null);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };
  const API = "http://localhost:8000/api";

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/my-orders`, { headers });
        setOrders(res.data || []);
      } catch (e) {
        setError("Failed to load orders");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const viewTracking = async (order) => {
    setSelected(order);
    try {
      const res = await axios.get(`${API}/orders/${order.id}/tracking`, { headers });
      setTracking(res.data);
    } catch (e) {
      setTracking({ error: "Failed to fetch tracking" });
    }
  };

  return (
    <AppLayout>
      <div className="container-fluid p-0">
        <ProductionTracking />
      </div>
    </AppLayout>
  );
}

