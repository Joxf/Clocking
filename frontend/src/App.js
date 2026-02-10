import React, { useEffect } from "react";
import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "sonner";

// Pages
import ScanLogin from "./pages/ScanLogin";
import PinEntry from "./pages/PinEntry";
import KioskClockScreen from "./pages/KioskClockScreen";
import StaffProfile from "./pages/StaffProfile";
import RequestCenter from "./pages/RequestCenter";
import ManagerDashboard from "./pages/ManagerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import MobileAuth from "./pages/MobileAuth";
import StaffPlanner from "./pages/StaffPlanner";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="kiosk-container">
        <div className="frappe-spinner"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'manager') return <Navigate to="/manager" replace />;
    return <Navigate to="/staff" replace />;
  }
  
  return children;
};

// Main App Component
function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes - Kiosk entry flow */}
        <Route path="/" element={<ScanLogin />} />
        <Route path="/pin" element={<PinEntry />} />
        <Route path="/mobile-auth" element={<MobileAuth />} />
        
        {/* Staff Dashboard (Kiosk Clock Screen) */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['staff', 'manager', 'admin']}>
              <KioskClockScreen />
            </ProtectedRoute>
          }
        />
        
        {/* Staff Profile Page */}
        <Route
          path="/staff/profile"
          element={
            <ProtectedRoute allowedRoles={['staff', 'manager', 'admin']}>
              <StaffProfile />
            </ProtectedRoute>
          }
        />
        
        {/* Manager Dashboard */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/*"
          element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />
        
        {/* Admin Dashboard */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/planner"
          element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <StaffPlanner />
            </ProtectedRoute>
          }
        />
        
        {/* Catch all - redirect to scan login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
