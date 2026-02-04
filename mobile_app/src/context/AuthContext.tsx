import React, {createContext, useState, useContext, useEffect} from 'react';
import * as Keychain from 'react-native-keychain';

interface AuthData {
  employeeId: string;
  employeeName: string;
  totpSecret: string;
  enrolledAt: string;
}

interface AuthContextType {
  authData: AuthData | null;
  isEnrolled: boolean;
  saveEnrollment: (data: AuthData) => Promise<void>;
  clearEnrollment: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  authData: null,
  isEnrolled: false,
  saveEnrollment: async () => {},
  clearEnrollment: async () => {},
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [authData, setAuthData] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredCredentials();
  }, []);

  const loadStoredCredentials = async () => {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: 'carehome-authenticator',
      });

      if (credentials) {
        const data = JSON.parse(credentials.password);
        setAuthData(data);
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveEnrollment = async (data: AuthData) => {
    try {
      await Keychain.setGenericPassword(
        data.employeeId,
        JSON.stringify(data),
        {
          service: 'carehome-authenticator',
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
        },
      );
      setAuthData(data);
    } catch (error) {
      console.error('Failed to save credentials:', error);
      throw error;
    }
  };

  const clearEnrollment = async () => {
    try {
      await Keychain.resetGenericPassword({service: 'carehome-authenticator'});
      setAuthData(null);
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        authData,
        isEnrolled: !!authData,
        saveEnrollment,
        clearEnrollment,
        loading,
      }}>
      {children}
    </AuthContext.Provider>
  );
};
