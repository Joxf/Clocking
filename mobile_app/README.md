# CareHome Authenticator - Mobile App

React Native mobile app for CareHome Clocking system. Generates rotating QR codes for staff clock-in/out.

## Features

- **Enrollment**: Scan QR from manager to enroll phone
- **Rotating QR**: Generate new TOTP-based QR every 30 seconds
- **Secure Storage**: TOTP secret stored in device Keychain/Keystore
- **Offline**: Works without internet after enrollment
- **Battery Warning**: Alerts when battery is low

## Prerequisites

- Node.js 18+
- React Native CLI
- Android Studio (for Android)
- Xcode (for iOS)

## Setup

```bash
# Install dependencies
npm install

# iOS only - install pods
cd ios && pod install && cd ..

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Building for Production

### Android

```bash
cd android
./gradlew assembleRelease
```

APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

### iOS

Build via Xcode:
1. Open `ios/CareHomeAuthenticator.xcworkspace`
2. Select target device/simulator
3. Product > Archive

## How It Works

1. **Enrollment**
   - Manager generates enrollment QR in web dashboard
   - Staff scans QR with this app
   - App stores TOTP secret securely

2. **Daily Use**
   - Open app to see rotating QR
   - Show QR to kiosk camera
   - Kiosk validates TOTP and records clock in/out

3. **Security**
   - TOTP secret never leaves the device
   - QR codes are valid for ~90 seconds (drift tolerance)
   - Re-enrollment invalidates previous secret

## Configuration

Server URL can be configured in `src/config.ts`:

```typescript
export const API_URL = 'https://your-carehome-server.com';
```

## Troubleshooting

### Camera not working
- Ensure camera permissions are granted
- Try closing and reopening the app

### QR not scanning at kiosk
- Ensure phone time is accurate (TOTP is time-based)
- Try full brightness mode
- Clean kiosk camera lens

### Enrollment failed
- QR may have expired (10 minute limit)
- Ask manager to generate new enrollment QR
