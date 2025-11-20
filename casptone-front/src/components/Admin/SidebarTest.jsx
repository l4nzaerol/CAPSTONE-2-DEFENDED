import React from 'react';
import AppLayout from '../Header';
import { useSidebar } from '../Header';

/**
 * Test component to verify sidebar functionality
 * This component can be used to test the minimize/expand functionality
 */
const SidebarTest = () => {
    const { isMinimized, toggleSidebar } = useSidebar();

    return (
        <AppLayout>
            <div className="container-fluid py-4">
                <div className="card">
                    <div className="card-header">
                        <h2>Sidebar Functionality Test</h2>
                    </div>
                    <div className="card-body">
                        <div className="row">
                            <div className="col-md-6">
                                <h4>Current State</h4>
                                <p><strong>Sidebar Status:</strong> {isMinimized ? 'Minimized' : 'Expanded'}</p>
                                <button 
                                    className="btn btn-primary"
                                    onClick={toggleSidebar}
                                >
                                    {isMinimized ? 'Expand Sidebar' : 'Minimize Sidebar'}
                                </button>
                            </div>
                            <div className="col-md-6">
                                <h4>Test Instructions</h4>
                                <ol>
                                    <li>Click the toggle button above to minimize/expand the sidebar</li>
                                    <li>Verify the sidebar animates smoothly</li>
                                    <li>Check that the main content area adjusts its width</li>
                                    <li>Navigate to other admin pages and verify they work correctly</li>
                                </ol>
                            </div>
                        </div>
                        
                        <div className="mt-4">
                            <h4>Responsive Test Content</h4>
                            <div className="row">
                                <div className="col-lg-4">
                                    <div className="card bg-primary text-white">
                                        <div className="card-body">
                                            <h5>Card 1</h5>
                                            <p>This content should adjust when sidebar is minimized.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-lg-4">
                                    <div className="card bg-success text-white">
                                        <div className="card-body">
                                            <h5>Card 2</h5>
                                            <p>Layout should be responsive to sidebar state.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-lg-4">
                                    <div className="card bg-warning text-dark">
                                        <div className="card-body">
                                            <h5>Card 3</h5>
                                            <p>All content should remain accessible.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default SidebarTest;

