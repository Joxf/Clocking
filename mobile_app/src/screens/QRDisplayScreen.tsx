import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {authenticator} from 'otplib';
import KeepAwake from 'react-native-keep-awake';
import DeviceInfo from 'react-native-device-info';
import {useAuth} from '../context/AuthContext';
import {useNavigation} from '@react-navigation/native';

const REFRESH_INTERVAL = 30; // seconds

export default function QRDisplayScreen() {
  const navigation = useNavigation();
  const {authData, clearEnrollment} = useAuth();
  const {width: screenWidth} = useWindowDimensions();
  const [qrValue, setQrValue] = useState('');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [fullBrightness, setFullBrightness] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [showBatteryWarning, setShowBatteryWarning] = useState(false);

  const qrSize = Math.min(screenWidth - 64, 320);

  const generateQR = useCallback(() => {
    if (!authData?.totpSecret) return;

    try {
      const code = authenticator.generate(authData.totpSecret);
      const payload = JSON.stringify({
        employee_id: authData.employeeId,
        totp_code: code,
        timestamp: Math.floor(Date.now() / 1000),
      });
      setQrValue(payload);
    } catch (error) {
      console.error('Failed to generate TOTP:', error);
    }
  }, [authData]);

  // Generate QR on mount and when countdown resets
  useEffect(() => {
    generateQR();
  }, [generateQR]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          generateQR();
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [generateQR]);

  // Battery monitoring
  useEffect(() => {
    const checkBattery = async () => {
      try {
        const level = await DeviceInfo.getBatteryLevel();
        setBatteryLevel(Math.round(level * 100));
        setShowBatteryWarning(level < 0.15);
      } catch (error) {
        console.log('Battery check failed:', error);
      }
    };

    checkBattery();
    const interval = setInterval(checkBattery, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const handleUnenroll = () => {
    Alert.alert(
      'Unenroll Device',
      'Are you sure you want to unenroll this device? You will need to scan a new enrollment QR from your manager.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Unenroll',
          style: 'destructive',
          onPress: async () => {
            await clearEnrollment();
            navigation.reset({
              index: 0,
              routes: [{name: 'Enroll' as never}],
            });
          },
        },
      ],
    );
  };

  const toggleBrightness = () => {
    setFullBrightness(prev => !prev);
    // In a real app, you'd use a brightness library here
    // SystemSetting.setBrightness(fullBrightness ? -1 : 1);
  };

  if (!authData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Not enrolled</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        fullBrightness && styles.containerBright,
      ]}>
      <KeepAwake />

      {/* Battery Warning */}
      {showBatteryWarning && (
        <View style={styles.batteryWarning}>
          <Text style={styles.batteryWarningText}>
            Low battery ({batteryLevel}%). Please charge your device at the kiosk.
          </Text>
        </View>
      )}

      {/* Employee Info */}
      <View style={styles.header}>
        <Text style={styles.employeeName}>{authData.employeeName}</Text>
        <Text style={styles.employeeId}>{authData.employeeId}</Text>
      </View>

      {/* QR Code */}
      <View style={styles.qrContainer}>
        <View style={styles.qrWrapper}>
          {qrValue ? (
            <QRCode
              value={qrValue}
              size={qrSize}
              backgroundColor="#FFFFFF"
              color="#000000"
            />
          ) : (
            <Text>Generating...</Text>
          )}
        </View>

        {/* Countdown */}
        <View style={styles.countdownContainer}>
          <View style={styles.countdownBar}>
            <View
              style={[
                styles.countdownProgress,
                {width: `${(countdown / REFRESH_INTERVAL) * 100}%`},
              ]}
            />
          </View>
          <Text style={styles.countdownText}>
            Refreshes in {countdown}s
          </Text>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          Show this QR code to the kiosk camera to clock in or out
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.brightnessButton}
          onPress={toggleBrightness}>
          <Text style={styles.brightnessButtonText}>
            {fullBrightness ? 'Normal Brightness' : 'Full Brightness'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.unenrollButton}
          onPress={handleUnenroll}>
          <Text style={styles.unenrollButtonText}>Unenroll Device</Text>
        </TouchableOpacity>
      </View>

      {/* Battery indicator */}
      {batteryLevel !== null && (
        <Text style={styles.batteryText}>Battery: {batteryLevel}%</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 24,
    alignItems: 'center',
  },
  containerBright: {
    backgroundColor: '#FFFFFF',
  },
  batteryWarning: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  batteryWarningText: {
    color: '#92400E',
    textAlign: 'center',
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  employeeName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  employeeId: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrWrapper: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  countdownContainer: {
    marginTop: 24,
    alignItems: 'center',
    width: '100%',
  },
  countdownBar: {
    width: 200,
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  countdownProgress: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 3,
  },
  countdownText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
  },
  instructions: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  instructionText: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    marginTop: 32,
    width: '100%',
    gap: 12,
  },
  brightnessButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
  },
  brightnessButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  unenrollButton: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  unenrollButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#DC2626',
  },
  batteryText: {
    position: 'absolute',
    bottom: 24,
    fontSize: 12,
    color: '#94A3B8',
  },
});
