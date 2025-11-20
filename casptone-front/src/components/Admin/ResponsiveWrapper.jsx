import React from 'react';
import { useSidebar } from '../Header';

/**
 * ResponsiveWrapper - A wrapper component that provides responsive behavior
 * based on the sidebar state. Use this for admin pages that need to be
 * responsive to sidebar minimize/expand actions.
 */
const ResponsiveWrapper = ({ children, className = "", style = {} }) => {
    const { isMinimized } = useSidebar();

    const responsiveStyle = {
        ...style,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        // Add any responsive styles based on sidebar state
        maxWidth: isMinimized ? 'calc(100vw - 80px)' : 'calc(100vw - 280px)',
        width: '100%'
    };

    return (
        <div className={className} style={responsiveStyle}>
            {children}
        </div>
    );
};

export default ResponsiveWrapper;

