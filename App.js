// App.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { ThemeProvider } from './ThemeContext';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
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
import ChatScreen from './ChatScreen';
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
    const registerForPushNotificationsAsync = async () => {
      if (!Device.isDevice) return alert('Use a physical device for push notifications.');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Expo Push Token:', token);

      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          expoPushToken: token,
        });
      }

      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFA500',
        });
      }
    };

    registerForPushNotificationsAsync();
  }, []);

  useEffect(() => {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, 'users', user.uid);
  let unsubscribeRide = null;

  const fetchRideListener = async () => {
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    const rideId = userData?.currentRideId;

    if (!rideId) return;

    const rideRef = doc(db, 'rides', rideId);

    unsubscribeRide = onSnapshot(rideRef, async (docSnapshot) => {
      const data = docSnapshot.data();
      if (!data?.status) return;

      let title = '';
      let body = '';

      switch (data.status) {
        case 'accepted':
          title = 'Ride Accepted';
          body = 'Your ride has been accepted by a driver.';
          break;
        case 'en_route':
          title = 'Driver En Route';
          body = 'Your driver is on the way to pick you up.';
          break;
        case 'started':
          title = 'Ride Started';
          body = 'Your ride has started.';
          break;
        case 'completed':
          title = 'Ride Completed';
          body = 'Thank you for riding with us.';
          break;
        default:
          return;
      }

      // ✅ Show in-app toast
      Toast.show({
        type: 'info',
        text1: title,
        text2: body,
        position: 'top',
      });

      // ✅ Write to Firestore
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title,
        body,
        timestamp: serverTimestamp(),
        read: false,
      });

      // ✅ Send Expo Push Notification
      const token = userData?.expoPushToken;
      if (token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: token,
            title,
            body,
            sound: 'default',
          }),
        });
      }
    });
  };

  fetchRideListener();

  return () => {
    if (unsubscribeRide) unsubscribeRide();
  };
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
          <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>
        <Toast />
      </NavigationContainer>
    </ThemeProvider>
  );
}
