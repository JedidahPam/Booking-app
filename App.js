import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import { Platform, Alert, View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './ThemeContext';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { useTheme } from './ThemeContext';
import { initUserStatusTracking } from './userStatusService'
// Screens (keep your existing screen imports)
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
import EarningsDetail from './EarningsDetail';
import DriverHistory from './DriverHistory';
import AdminDashboard from './AdminDashboard';
import ChatScreen from './ChatScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { darkMode } = useTheme();

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
        tabBarActiveTintColor: darkMode ? '#FFA500' : '#007bff',
        tabBarInactiveTintColor: darkMode ? '#888' : 'gray',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: darkMode ? '#1e1e1e' : '#fff',
          borderTopColor: darkMode ? '#333' : '#e0e0e0',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 4,
        },
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
  const { darkMode } = useTheme();

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
        tabBarActiveTintColor: darkMode ? '#FFA500' : '#007bff',
        tabBarInactiveTintColor: darkMode ? '#888' : 'gray',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: darkMode ? '#1e1e1e' : '#fff',
          borderTopColor: darkMode ? '#333' : '#e0e0e0',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 4,
        },
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
  const [notificationCount, setNotificationCount] = useState(0);
  const [lastNotification, setLastNotification] = useState(null);


  useEffect(() => {
    const unsubscribeAuth = initUserStatusTracking();
    return () => unsubscribeAuth();
  }, []);

  // Notification setup and handler
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        // Request permissions
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Notifications require permissions');
          return;
        }

        // Configure notification presentation
        await Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        // Add listener for notification taps
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data;
          console.log('Notification tapped:', data);
          setNotificationCount(prev => Math.max(0, prev - 1));
          setLastNotification(data);
        });

        return () => subscription.remove();
      } catch (error) {
        console.error("Notification setup error:", error);
      }
    };

    setupNotifications();
  }, []);

  // Ride status listener with notifications
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    let unsubscribeRide = null;

    const statusMessages = {
      'accepted': ['Ride Accepted', 'Your driver has accepted the ride'],
      'en_route': ['Driver Coming', 'Your driver is on the way'],
      'started': ['Ride Started', 'Your trip has begun'],
      'completed': ['Ride Complete', 'Thanks for using our service']
    };

    const fetchRideListener = async () => {
      try {
        const userData = (await getDoc(userRef)).data();
        const rideId = userData?.currentRideId;
        if (!rideId) return;

        const rideRef = doc(db, 'rides', rideId);
        unsubscribeRide = onSnapshot(rideRef, async (docSnapshot) => {
          const data = docSnapshot.data();
          if (!data?.status) return;

          const [title, body] = statusMessages[data.status] || [];
          if (!title) return;

          // Show toast
          Toast.show({
            type: 'info',
            text1: title,
            text2: body,
            position: 'top',
          });

          // Trigger in-app notification
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              data: { 
                rideId,
                status: data.status,
                timestamp: new Date().toISOString(),
                type: 'ride_update'
              },
              sound: true,
              _displayInForeground: true,
            },
            trigger: null,
          });

          setNotificationCount(prev => prev + 1);
        });
      } catch (error) {
        console.error("Ride listener error:", error);
      }
    };

    fetchRideListener();
    return () => unsubscribeRide?.();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName={initialScreen}>
            {/* Auth Screens */}
            <Stack.Screen name="SignIn" component={SignIn} options={{ headerShown: false }} />
            <Stack.Screen name="SignUp" component={SignUp} options={{ headerShown: false }} />
            <Stack.Screen name="ResetPassword" component={ResetPassword} options={{ headerShown: false }} />
            <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />

            {/* Driver Onboarding */}
            <Stack.Screen name="DriverRegistration" component={DriverRegistration} options={{ headerShown: false }} />

            {/* Main App Screens */}
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="DriverMain" component={DriverTabs} options={{ headerShown: false }} />

            {/* Admin Screens */}
            <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ headerShown: false }} />

            {/* Shared Screens */}
            <Stack.Screen 
              name="NotificationsScreen" 
              component={NotificationsScreen} 
              options={{ 
                title: 'Notifications',
                headerRight: () => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {notificationCount > 0 && (
                      <View style={{
                        backgroundColor: 'red',
                        borderRadius: 10,
                        width: 20,
                        height: 20,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 10
                      }}>
                        <Text style={{ color: 'white', fontSize: 12 }}>{notificationCount}</Text>
                      </View>
                    )}
                    <MaterialIcons name="notifications" size={24} color="black" />
                  </View>
                ),
              }} 
            />
           <Stack.Screen name="DriverHistory" component={DriverHistory} options={{ headerShown: false }} />
            <Stack.Screen name="EarningsDetail" component={EarningsDetail} options={{ headerShown: false }}/>
            <Stack.Screen name="ChangePasswordScreen" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
          </Stack.Navigator>
          
          <Toast />
        </NavigationContainer>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}