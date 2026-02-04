import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState([]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load offline queue from localStorage
  useEffect(() => {
    const savedQueue = localStorage.getItem('offline_queue');
    if (savedQueue) {
      setOfflineQueue(JSON.parse(savedQueue));
    }
  }, []);

  // Sync offline queue when online
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0 && token) {
      syncOfflineEvents();
    }
  }, [isOnline, offlineQueue, token]);

  const syncOfflineEvents = async () => {
    if (offlineQueue.length === 0) return;
    
    try {
      await axios.post(`${API}/sync/offline-events`, {
        events: offlineQueue
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setOfflineQueue([]);
      localStorage.removeItem('offline_queue');
    } catch (error) {
      console.error('Failed to sync offline events:', error);
    }
  };

  const addToOfflineQueue = useCallback((event) => {
    const newQueue = [...offlineQueue, event];
    setOfflineQueue(newQueue);
    localStorage.setItem('offline_queue', JSON.stringify(newQueue));
  }, [offlineQueue]);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${API}/attendance/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Token is valid, get user from stored data
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        // Token invalid or expired
        logout();
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const validateQR = async (qrData) => {
    const response = await axios.post(`${API}/auth/validate-qr`, { qr_data: qrData });
    return response.data;
  };

  const validatePIN = async (employeeId, pin) => {
    const response = await axios.post(`${API}/auth/validate-pin`, {
      employee_id: employeeId,
      pin: pin
    });
    
    const { token: newToken, employee, expires_at } = response.data;
    
    setToken(newToken);
    setUser(employee);
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('user', JSON.stringify(employee));
    localStorage.setItem('token_expires', expires_at);
    
    return response.data;
  };

  const logout = useCallback(async () => {
    if (token) {
      try {
        await axios.post(`${API}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('token_expires');
  }, [token]);

  const clockIn = async () => {
    if (!isOnline) {
      addToOfflineQueue({
        id: Date.now().toString(),
        employee_id: user.employee_id,
        auth_type: 'clock_in',
        timestamp: new Date().toISOString()
      });
      return { success: true, offline: true };
    }

    const response = await axios.post(`${API}/attendance/clock`, {
      employee_id: user.employee_id,
      action: 'clock_in'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  };

  const clockOut = async () => {
    if (!isOnline) {
      addToOfflineQueue({
        id: Date.now().toString(),
        employee_id: user.employee_id,
        auth_type: 'clock_out',
        timestamp: new Date().toISOString()
      });
      return { success: true, offline: true };
    }

    const response = await axios.post(`${API}/attendance/clock`, {
      employee_id: user.employee_id,
      action: 'clock_out'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  };

  const value = {
    user,
    token,
    loading,
    isOnline,
    offlineQueue,
    validateQR,
    validatePIN,
    logout,
    clockIn,
    clockOut,
    addToOfflineQueue
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
