import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const [userRole, setUserRole] = useState('');
  const location = useLocation();

  useEffect(() => {
    // Get user role from localStorage
    const role = localStorage.getItem('role');
    setUserRole(role || '');
  }, []);

  // Define all menu items with their allowed roles
  const menuItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: '📊',
      roles: ['employee', 'staff'] // Both admin and staff can access
    },
    {
      name: 'Productions',
      path: '/productions',
      icon: '🏭',
      roles: ['employee', 'staff'] // Both admin and staff can access
    },
    {
      name: 'Products',
      path: '/products',
      icon: '📦',
      roles: ['employee'] // Only admin
    },
    {
      name: 'Orders',
      path: '/orders',
      icon: '🛒',
      roles: ['employee'] // Only admin
    },
    {
      name: 'Inventory',
      path: '/inventory',
      icon: '📋',
      roles: ['employee'] // Only admin
    },
    {
      name: 'Reports',
      path: '/reports',
      icon: '📈',
      roles: ['employee'] // Only admin
    },
  ];

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(userRole)
  );

  return (
    <div className="sidebar" style={{ 
      minHeight: '100vh', 
      width: '280px',
      background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 50%, #D2691E 100%)',
      color: '#FFF8DC',
      borderRight: '2px solid #F4E4BC',
      boxShadow: '8px 0 32px rgba(139, 69, 19, 0.3)',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      {/* Sidebar Header */}
      <div className="sidebar-header p-3" style={{ 
        borderBottom: '2px solid #F4E4BC',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)'
      }}>
        <h4 className="mb-0" style={{ color: '#FFF8DC', textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)' }}>
          {userRole === 'staff' ? '👷 Staff Panel' : '👨‍💼 Admin Panel'}
        </h4>
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-nav p-3">
        {filteredMenuItems.map(item => (
          <Link
            key={item.name}
            to={item.path}
            className="d-flex align-items-center text-decoration-none p-2 mb-2 rounded"
            style={{
              color: location.pathname === item.path ? '#FFD700' : '#FFF8DC',
              backgroundColor: location.pathname === item.path ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%)' : 'transparent',
              borderLeft: location.pathname === item.path ? '3px solid #FFD700' : '3px solid transparent',
              transition: 'all 0.3s ease',
              borderRadius: '12px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              if (location.pathname !== item.path) {
                e.currentTarget.style.backgroundColor = 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)';
                e.currentTarget.style.borderLeft = '3px solid #FFD700';
                e.currentTarget.style.transform = 'translateX(8px)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(139, 69, 19, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== item.path) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderLeft = '3px solid transparent';
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <span className="me-2" style={{ fontSize: '1.2rem' }}>{item.icon}</span>
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer p-3 mt-auto" style={{ 
        borderTop: '2px solid #F4E4BC',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
      }}>
        <small style={{ color: '#FFF8DC' }}>
          Logged in as: <strong style={{ color: '#FFD700' }}>{userRole === 'staff' ? 'Staff' : 'Admin'}</strong>
        </small>
      </div>
    </div>
  );
};

export default Sidebar;
