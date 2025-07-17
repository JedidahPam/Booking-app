// App.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider } from './ThemeContext';
import Toast from 'react-native-toast-message';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

// Screens
import SignUp from './SignUp';
import SignIn from './SignIn';
import ResetPassword from './ResetPassword';
import VerifyOtpScreen from './VerifyOtpScreen';
import Home from './Home';
import ProfileScreen from './ProfileScreen';
import PaymentsScreen from './PaymentsScreen';
import NotificationsScreen from './NotificationsScreen';
import RidesScreen from './RidesScreen';
import ChangePasswordScreen from './ChangePasswordScreen';
import DriverHome from './DriverHome';
import DriverProfile from './DriverProfile';
import DriverTrips from './DriverTrips';
import DriverRegistration from './DriverRegistration';
import DriverSettings from './DriverSettings';
import DriverHistory from './DriverHistory';
import AdminDashboard from './AdminDashboard';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = 'home-outline';
          else if (route.name === 'Rides') iconName = 'time-outline';
          else if (route.name === 'Payments') iconName = 'card-outline';
          else if (route.name === 'Profile') iconName = 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007bff',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Rides" component={RidesScreen} />
      <Tab.Screen name="Payments" component={PaymentsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'DriverHome') iconName = 'car-sport-outline';
          else if (route.name === 'DriverTrips') iconName = 'list-outline';
          else if (route.name === 'DriverProfile') iconName = 'person-outline';
          else if (route.name === 'DriverSettings') iconName = 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007bff',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="DriverHome" component={DriverHome} options={{ title: 'Home' }} />
      <Tab.Screen name="DriverTrips" component={DriverTrips} options={{ title: 'Trips' }} />
      <Tab.Screen name="DriverProfile" component={DriverProfile} options={{ title: 'Profile' }} />
      <Tab.Screen name="DriverSettings" component={DriverSettings} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialScreen, setInitialScreen] = useState('SignIn');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
       const userData = userDoc.data();
if (!userData) return setInitialScreen('SignIn');

if (userData.isAdmin || userData.role === 'admin') {
  setInitialScreen('AdminDashboard');
} else if (userData.role === 'driver') {
  setInitialScreen('DriverMain');
} else {
  setInitialScreen('Main');
}

        setInitialScreen(isAdmin ? 'AdminDashboard' : 'Main');
      } else {
        setInitialScreen('SignIn');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const rideId = 'current_ride_id_here'; // Replace with actual logic
    if (!rideId) return;

    const unsubscribe = onSnapshot(doc(db, 'rides', rideId), (docSnapshot) => {
      const data = docSnapshot.data();
      if (!data?.status) return;

      let message = '';
      switch (data.status) {
        case 'accepted':
          message = 'Your ride has been accepted!';
          break;
        case 'en_route':
          message = 'Driver is on the way!';
          break;
        case 'started':
          message = 'Your ride has started!';
          break;
        case 'completed':
          message = 'Ride completed. Thank you!';
          break;
        default:
          return;
      }

      Toast.show({
        type: 'info',
        text1: 'Ride Update',
        text2: message,
        position: 'top',
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialScreen}>
          {/* Auth */}
          <Stack.Screen name="SignIn" component={SignIn} options={{ headerShown: false }} />
          <Stack.Screen name="SignUp" component={SignUp} options={{ headerShown: false }} />
          <Stack.Screen name="ResetPassword" component={ResetPassword} options={{ headerShown: false }} />
          <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />

          {/* Driver onboarding */}
          <Stack.Screen name="DriverRegistration" component={DriverRegistration} options={{ headerShown: false }} />

          {/* Main */}
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="DriverMain" component={DriverTabs} options={{ headerShown: false }} />

          {/* Admin */}
          <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ headerShown: false }} />

          {/* Global */}
          <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="DriverHistory" component={DriverHistory} options={{ title: 'Trip History' }} />
          <Stack.Screen name="ChangePasswordScreen" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
        </Stack.Navigator>
        <Toast />
      </NavigationContainer>
    </ThemeProvider>
  );
}
