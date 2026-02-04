import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {RNCamera} from 'react-native-camera';
import {useNavigation} from '@react-navigation/native';
import {useAuth} from '../context/AuthContext';

export default function EnrollScreen() {
  const navigation = useNavigation();
  const {isEnrolled, saveEnrollment, clearEnrollment, loading, authData} =
    useAuth();
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!loading && isEnrolled) {
      navigation.reset({
        index: 0,
        routes: [{name: 'QRDisplay' as never}],
      });
    }
  }, [loading, isEnrolled, navigation]);

  const handleBarCodeRead = async ({data}: {data: string}) => {
    if (processing) return;
    setProcessing(true);

    try {
      const payload = JSON.parse(data);

      if (payload.type !== 'enrollment') {
        Alert.alert('Invalid QR', 'This is not an enrollment QR code');
        setProcessing(false);
        return;
      }

      // Validate required fields
      if (
        !payload.employee_id ||
        !payload.totp_secret ||
        !payload.enrollment_token
      ) {
        Alert.alert('Invalid QR', 'QR code is missing required data');
        setProcessing(false);
        return;
      }

      // Check expiration
      if (payload.expires_at) {
        const expiresAt = new Date(payload.expires_at);
        if (expiresAt < new Date()) {
          Alert.alert(
            'Expired',
            'This enrollment QR has expired. Please ask your manager to generate a new one.',
          );
          setProcessing(false);
          return;
        }
      }

      // Save the enrollment data
      await saveEnrollment({
        employeeId: payload.employee_id,
        employeeName: payload.employee_name || 'Unknown',
        totpSecret: payload.totp_secret,
        enrolledAt: new Date().toISOString(),
      });

      // Notify server (optional, for confirming enrollment)
      // This happens in background, doesn't block the flow
      notifyServerEnrollmentComplete(
        payload.employee_id,
        payload.enrollment_token,
      );

      Alert.alert(
        'Enrollment Complete!',
        `Welcome, ${payload.employee_name || 'Staff'}! You can now use this app to clock in and out.`,
        [
          {
            text: 'Continue',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{name: 'QRDisplay' as never}],
              });
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert('Error', 'Could not read QR code. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const notifyServerEnrollmentComplete = async (
    employeeId: string,
    token: string,
  ) => {
    try {
      // This would call your Frappe server
      // Implementation depends on your server URL configuration
      console.log('Notifying server of enrollment completion');
    } catch (error) {
      console.error('Failed to notify server:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (isEnrolled) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Redirecting...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!scanning ? (
        <View style={styles.welcomeContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>CC</Text>
          </View>

          <Text style={styles.title}>CareHome Clocking</Text>
          <Text style={styles.subtitle}>Mobile Authenticator</Text>

          <Text style={styles.instructions}>
            To get started, ask your manager to show you the enrollment QR code
            on their screen.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => setScanning(true)}>
            <Text style={styles.buttonText}>Scan Enrollment QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => Linking.openURL('https://carehome.example.com/help')}>
            <Text style={styles.linkText}>Need help?</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.scannerContainer}>
          <RNCamera
            style={styles.camera}
            type={RNCamera.Constants.Type.back}
            onBarCodeRead={handleBarCodeRead}
            barCodeTypes={[RNCamera.Constants.BarCodeType.qr]}
            captureAudio={false}>
            <View style={styles.scanOverlay}>
              <View style={styles.scanTarget} />
            </View>
          </RNCamera>

          <View style={styles.scanFooter}>
            <Text style={styles.scanInstructions}>
              Point your camera at the enrollment QR code shown by your manager
            </Text>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setScanning(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {processing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.processingText}>Processing...</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748B',
    marginBottom: 32,
  },
  instructions: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  linkButton: {
    marginTop: 24,
    padding: 12,
  },
  linkText: {
    color: '#2563EB',
    fontSize: 16,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanTarget: {
    width: 280,
    height: 280,
    borderWidth: 3,
    borderColor: '#2563EB',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scanFooter: {
    backgroundColor: '#0F172A',
    padding: 24,
    alignItems: 'center',
  },
  scanInstructions: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
});
