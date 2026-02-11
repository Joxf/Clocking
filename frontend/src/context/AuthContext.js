import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import offlineManager from '../utils/OfflineManager';

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
  const [lastSyncStatus, setLastSyncStatus] = useState(null);
  const [loginPreferences, setLoginPreferences] = useState(null);
  const [sessionTimeout, setSessionTimeout] = useState(null);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Fetch login preferences on mount
  useEffect(() => {
    const fetchLoginPrefs = async () => {
      try {
        const response = await axios.get(`${API}/control-preferences`);
        const prefs = response.data.preferences;
        if (prefs?.login) {
          setLoginPreferences(prefs.login);
        }
      } catch (err) {
        // Use defaults if fetch fails
        console.log('Using default login preferences');
      }
    };
    fetchLoginPrefs();
  }, []);

  // Handle session timeout based on control preferences
  useEffect(() => {
    if (!user || !loginPreferences?.session) return;
    
    const sessionPrefs = loginPreferences.session;
    const timeoutMinutes = user.role === 'manager' || user.role === 'admin'
      ? sessionPrefs.manager_session_timeout_minutes || 60
      : sessionPrefs.staff_session_timeout_minutes || 5;
    
    if (!sessionPrefs.auto_logout_on_inactivity) return;
    
    // Set up activity tracker
    const handleActivity = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    
    // Check for timeout periodically
    const checkTimeout = setInterval(() => {
      const inactiveMinutes = (Date.now() - lastActivity) / (1000 * 60);
      if (inactiveMinutes >= timeoutMinutes) {
        console.log(`Session timeout after ${timeoutMinutes} minutes of inactivity`);
        logout();
      }
    }, 30000); // Check every 30 seconds
    
    setSessionTimeout(timeoutMinutes);
    
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(checkTimeout);
    };
  }, [user, loginPreferences, lastActivity]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Attempt to sync when coming back online
      if (token) {
        offlineManager.syncQueue(token).then(result => {
          setLastSyncStatus(result);
          setOfflineQueue(offlineManager.getQueue());
        });
      }
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Listen to offline manager events
    const unsubscribe = offlineManager.addListener((event, data) => {
      if (event === 'queue_updated') {
        setOfflineQueue(data.queue);
      } else if (event === 'sync_complete') {
        setLastSyncStatus({ success: true, ...data });
        setOfflineQueue(offlineManager.getQueue());
      }
    });
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [token]);

  // Load offline queue from localStorage
  useEffect(() => {
    setOfflineQueue(offlineManager.getQueue());
  }, []);

  // Sync offline queue when online
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0 && token) {
      const unsyncedCount = offlineQueue.filter(e => !e.synced).length;
      if (unsyncedCount > 0) {
        offlineManager.syncQueue(token).then(result => {
          setLastSyncStatus(result);
        });
      }
    }
  }, [isOnline, token, offlineQueue]);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      // If offline, use stored user data
      if (!navigator.onLine) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        setLoading(false);
        return;
      }

      try {
        await axios.get(`${API}/attendance/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Token is valid, get user from stored data
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        
      } catch (error) {
        // Token invalid or expired
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('token_expires');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  // Refresh offline bundle periodically
  const refreshOfflineBundle = useCallback(async () => {
    if (!token || !isOnline) return;
    
    const storedUser = localStorage.getItem('user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    
    // Only managers/admins can download bundle
    if (!user || !['manager', 'admin'].includes(user.role)) return;
    
    try {
      const response = await axios.get(`${API}/kiosk/offline-bundle`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        offlineManager.setOfflineBundle(response.data);
        console.log('Offline bundle refreshed');
      }
    } catch (error) {
      console.error('Failed to refresh offline bundle:', error);
    }
  }, [token, isOnline]);

  const validateQR = async (qrData) => {
    const response = await axios.post(`${API}/auth/validate-qr`, { qr_data: qrData });
    return response.data;
  };

  const validatePIN = async (employeeId, pin) => {
    // Try online validation first
    if (isOnline) {
      try {
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
      } catch (error) {
        // If network error, try offline
        if (!error.response) {
          return validatePINOffline(employeeId, pin);
        }
        throw error;
      }
    }
    
    // Offline validation
    return validatePINOffline(employeeId, pin);
  };

  const validatePINOffline = (employeeId, pin) => {
    // Get employee code from stored data
    const result = offlineManager.validatePinLocally(employeeId, pin);
    
    if (result.success) {
      // Create offline session
      const offlineUser = result.employee;
      setUser(offlineUser);
      localStorage.setItem('user', JSON.stringify(offlineUser));
      localStorage.setItem('offline_session', 'true');
      
      return {
        token: null,
        employee: offlineUser,
        offline: true
      };
    }
    
    throw new Error(result.error || 'Offline validation failed');
  };

  const logout = useCallback(async () => {
    if (token && isOnline) {
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
    localStorage.removeItem('offline_session');
  }, [token, isOnline]);

  const clockIn = async () => {
    const result = await offlineManager.clockIn(user.id, user.employee_id, token);
    
    if (result.offline) {
      setOfflineQueue(offlineManager.getQueue());
    }
    
    return result;
  };

  const clockOut = async () => {
    const result = await offlineManager.clockOut(user.id, user.employee_id, token);
    
    if (result.offline) {
      setOfflineQueue(offlineManager.getQueue());
    }
    
    return result;
  };

  const addToOfflineQueue = useCallback((event) => {
    offlineManager.addToQueue(event);
    setOfflineQueue(offlineManager.getQueue());
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    if (!token) return { success: false, reason: 'No token' };
    const result = await offlineManager.syncQueue(token);
    setLastSyncStatus(result);
    setOfflineQueue(offlineManager.getQueue());
    return result;
  }, [token]);

  const getOfflineBundleStatus = useCallback(() => {
    const bundle = offlineManager.getOfflineBundle();
    const age = offlineManager.getBundleAge();
    
    return {
      hasBundle: !!bundle,
      employeeCount: bundle?.employees?.length || 0,
      shiftCount: bundle?.shifts?.length || 0,
      age,
      isStale: age?.isStale || false,
      expiresAt: bundle?.expires_at
    };
  }, []);

  const value = {
    user,
    token,
    loading,
    isOnline,
    offlineQueue,
    lastSyncStatus,
    validateQR,
    validatePIN,
    logout,
    clockIn,
    clockOut,
    addToOfflineQueue,
    syncOfflineQueue,
    refreshOfflineBundle,
    getOfflineBundleStatus,
    deviceId: offlineManager.getDeviceId(),
    deviceName: offlineManager.getDeviceName()
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
