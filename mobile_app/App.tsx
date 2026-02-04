import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import EnrollScreen from './src/screens/EnrollScreen';
import QRDisplayScreen from './src/screens/QRDisplayScreen';
import {AuthProvider} from './src/context/AuthContext';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Enroll"
            screenOptions={{
              headerStyle: {
                backgroundColor: '#2563EB',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: '700',
              },
            }}>
            <Stack.Screen
              name="Enroll"
              component={EnrollScreen}
              options={{title: 'CareHome Clocking'}}
            />
            <Stack.Screen
              name="QRDisplay"
              component={QRDisplayScreen}
              options={{title: 'Your QR Code'}}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
