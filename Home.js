// TravelDetailsScreen.js

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import polyline from '@mapbox/polyline';
import SettingsPanel from './SettingsPanel';
import SettingsScreen from './SettingsScreen'; 
import { useTheme } from './ThemeContext';
import { collection, query, where, getDocs, doc, getDoc, addDoc, setDoc, onSnapshot, arrayUnion, limit, orderBy } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import haversine from 'haversine-distance';
import { serverTimestamp } from 'firebase/firestore';
import { Modalize } from 'react-native-modalize';


const OPENCAGE_API_KEY = 'a87b854ab508451da44974719031b90b';
const OPENROUTESERVICE_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjllZjJjN2YyMTI1NTQ1YWI5NzJhZmYxMjBmNjhkMTg5IiwiaCI6Im11cm11cjY0In0=';

export default function TravelDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { dropoff: initialDropoff = null } = route.params || {};
  const { darkMode } = useTheme();
  const styles = createStyles(darkMode);

  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(initialDropoff);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [travelTime, setTravelTime] = useState(null);
  const [distance, setDistance] = useState(null);
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [region, setRegion] = useState(null);
  const [selectedTransport, setSelectedTransport] = useState('taxi');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const typingTimeout = useRef(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const modalizeRef = useRef(null);
  const [hasActiveRide, setHasActiveRide] = useState(false);
  const [activeRideId, setActiveRideId] = useState(null);
  const [needsReassignment, setNeedsReassignment] = useState(false);

  
  // Driver tracking states
  const [rideStatus, setRideStatus] = useState(null);
  const [currentRideId, setCurrentRideId] = useState(null);
  const [driverLocationUpdates, setDriverLocationUpdates] = useState(null);
  const [trackingEta, setTrackingEta] = useState(null);

  // Driver selection states
  const [drivers, setDrivers] = useState([]);
  const [driversVisible, setDriversVisible] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [fetchingDrivers, setFetchingDrivers] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [paymentDone, setPaymentDone] = React.useState(false);

  // Refs for inputs
  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);

  // Check for active rides when component mounts
useEffect(() => {
  const checkActiveRides = async () => {
    if (!auth.currentUser) return;
    
    try {
      const ridesRef = collection(db, 'rides');
      
      // Check for non-cancelled rides
      const activeRidesQuery = query(
        ridesRef,
        where('userId', '==', auth.currentUser.uid),
        where('status', 'in', ['pending', 'accepted', 'in-progress'])
      );
      
      const activeSnapshot = await getDocs(activeRidesQuery);
      
      if (!activeSnapshot.empty) {
        const activeRide = activeSnapshot.docs[0].data();
        setHasActiveRide(true);
        setActiveRideId(activeRide.rideId);
        setCurrentRideId(activeRide.rideId);
        setRideStatus(activeRide.status);
        return;
      }

      // Check for cancelled rides
      const cancelledRidesQuery = query(
        ridesRef,
        where('userId', '==', auth.currentUser.uid),
        where('status', 'in', ['cancelled_by_driver', 'declined']),
        orderBy('updatedAt', 'desc'),
        limit(1)
      );
      
      const cancelledSnapshot = await getDocs(cancelledRidesQuery);
      
      if (!cancelledSnapshot.empty) {
        const cancelledRide = cancelledSnapshot.docs[0].data();
        
        // Update Firestore with previous driver and new status
        await setDoc(doc(db, 'rides', cancelledRide.rideId), {
          previousDrivers: arrayUnion(cancelledRide.driverId),
          status: 'needs_reassignment',
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Set ride details in state
        setPickup(cancelledRide.pickup);
        setDropoff(cancelledRide.dropoff);
        setFromLocation(cancelledRide.pickup.address);
        setToLocation(cancelledRide.dropoff.address);
        setSelectedTransport(cancelledRide.transport);
        setPrice(cancelledRide.price);
        setDistance(cancelledRide.distance);
        setTravelTime(cancelledRide.travelTime);
        
        // Maintain ride ID and set reassignment state
        setCurrentRideId(cancelledRide.rideId);
        setActiveRideId(cancelledRide.rideId);
        setHasActiveRide(true);
        setRideStatus('needs_reassignment');

        // Automatically fetch nearby drivers (excluding the previous one)
        fetchNearbyDrivers(cancelledRide.driverId);
      }
    } catch (error) {
      console.error('Error checking active rides:', error);
    }
  };

  checkActiveRides();
}, []);

  const collapseSheet = () => {
    modalizeRef.current?.snapToIndex(0);
  };

  const expandSheet = () => {
    modalizeRef.current?.snapToIndex(1);
  };

  useEffect(() => {
    if (selectedDriver) {
      expandSheet();
    }
  }, [selectedDriver]);

  useEffect(() => {
  if (rideStatus === 'needs_reassignment') {
    setNeedsReassignment(true);
    fetchNearbyDrivers();
  } else {
    setNeedsReassignment(false);
  }
}, [rideStatus]);
  
useEffect(() => {
  if (!currentRideId) return;

  const unsubscribe = onSnapshot(doc(db, 'rides', currentRideId), async (docSnapshot) => {
    const rideData = docSnapshot.data();
    if (!rideData) return;
    
    const newStatus = rideData.status;
    const previousStatus = rideStatus;
    
    console.log(`Ride status changed from ${previousStatus} to ${newStatus}`);
    setRideStatus(newStatus);
    
    // Handle driver cancellation/decline
    if ((newStatus === 'cancelled_by_driver' || newStatus === 'declined') && 
        previousStatus !== 'cancelled_by_driver' && previousStatus !== 'declined') {
      
      // Update previous drivers list
      try {
        const currentPreviousDrivers = rideData.previousDrivers || [];
        if (rideData.driverId && !currentPreviousDrivers.includes(rideData.driverId)) {
          const updatedPreviousDrivers = [...currentPreviousDrivers, rideData.driverId];
          
          await setDoc(doc(db, 'rides', currentRideId), {
            previousDrivers: updatedPreviousDrivers,
            status: 'needs_reassignment',
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } catch (error) {
        console.error('Error updating previousDrivers:', error);
      }
      
      // Show reassignment alert
      Alert.alert(
        'Driver Unavailable', 
        `Your driver ${newStatus === 'cancelled_by_driver' ? 'cancelled' : 'declined'} the ride.`,
        [
          {
            text: 'Cancel Ride',
            style: 'destructive',
            onPress: () => {
              cancelCurrentRide();
            }
          },
          {
            text: 'Reassign Driver',
            onPress: () => {
              // Just update the status - don't fetch drivers yet
              setRideStatus('needs_reassignment');
              setNeedsReassignment(true);
            }
          }
        ]
      );
    }

    // Handle other status changes
    if (newStatus === 'completed' || newStatus === 'cancelled') {
      // Complete cleanup on completion or cancellation
      setHasActiveRide(false);
      setActiveRideId(null);
      setCurrentRideId(null);
      setRideStatus(null);
      setSelectedDriver(null);
      setDriverLocationUpdates(null);
      setNeedsReassignment(false);
    }

    // Handle driver location updates for in-progress rides
    if (rideData.status === 'in-progress' && rideData.driverLocation) {
      setDriverLocationUpdates(rideData.driverLocation);
      const eta = calculateEta(rideData.driverLocation, pickup);
      setTrackingEta(eta);
      
      // Update map region to show both user and driver
      if (pickup) {
        const centerLat = (rideData.driverLocation.latitude + pickup.latitude) / 2;
        const centerLng = (rideData.driverLocation.longitude + pickup.longitude) / 2;
        const deltaLat = Math.abs(rideData.driverLocation.latitude - pickup.latitude) * 1.5 || 0.05;
        const deltaLng = Math.abs(rideData.driverLocation.longitude - pickup.longitude) * 1.5 || 0.05;
        setRegion({ latitude: centerLat, longitude: centerLng, latitudeDelta: deltaLat, longitudeDelta: deltaLng });
      }
    }
  });

  return () => unsubscribe();
}, [currentRideId, pickup, rideStatus]);

// Also fix the cancelCurrentRide function:
const cancelCurrentRide = async () => {
  if (!currentRideId) return;
  
  Alert.alert(
    'Cancel Ride',
    'Are you sure you want to cancel this ride?',
    [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            // FIX: Use the correct doc reference
            const rideDocRef = doc(db, 'rides', currentRideId);
            await setDoc(rideDocRef, {
              status: 'cancelled',
              cancelledAt: serverTimestamp(),
              cancelledBy: 'user',
              updatedAt: serverTimestamp()
            }, { merge: true });
            
            // Complete state reset
            setHasActiveRide(false);
            setCurrentRideId(null);
            setActiveRideId(null);
            setRideStatus(null);
            setSelectedDriver(null);
            setDriverLocationUpdates(null);
            setTrackingEta(null);
            setNeedsReassignment(false);
            setDriversVisible(false);
            
            // Clear form
            setPickup(null);
            setDropoff(null);
            setFromLocation('');
            setToLocation('');
            setPrice(null);
            setDistance(null);
            setTravelTime(null);
            setRouteCoords([]);
            
            Alert.alert('Ride Cancelled', 'Your ride has been cancelled successfully.');
          } catch (error) {
            console.error('Error cancelling ride:', error);
            Alert.alert('Error', 'Could not cancel ride. Please try again.');
          }
        }
      }
    ]
  );
};
// Enhanced bookRide function with better previousDrivers tracking

// 3. Enhanced bookRide function with better reassignment handling
const bookRide = async (rideId, driverId, pickup, dropoff, isReassignment = false) => {
  const userId = auth.currentUser.uid;

  try {
    const rideData = {
      rideId,
      userId,
      driverId,
      pickup: {
        name: pickup.address,
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        address: pickup.address
      },
      dropoff: {
        name: dropoff.address,
        latitude: dropoff.latitude,
        longitude: dropoff.longitude,
        address: dropoff.address
      },
      price: parseFloat(price),
      distance: parseFloat(distance),
      transport: selectedTransport,
      paymentMethod,
      timestamp: serverTimestamp(),
      travelTime: travelTime,
      updatedAt: serverTimestamp(),
    };

    if (isReassignment) {
      // Get existing ride data and update previousDrivers
      const rideDoc = await getDoc(doc(db, 'rides', rideId));
      let previousDrivers = [];
      let originalTimestamp = null;
      
      if (rideDoc.exists()) {
        const existingData = rideDoc.data();
        previousDrivers = existingData.previousDrivers || [];
        originalTimestamp = existingData.timestamp || existingData.createdAt;
        
        // Ensure the previous driver is in the exclusion list
        const previousDriverId = existingData.driverId;
        if (previousDriverId && !previousDrivers.includes(previousDriverId)) {
          previousDrivers.push(previousDriverId);
        }
      }
      
      // Update existing ride with new driver
      await setDoc(doc(db, 'rides', rideId), {
        ...rideData,
        status: 'pending',
        previousDrivers,
        timestamp: originalTimestamp, // Keep original timestamp
        createdAt: originalTimestamp, // Keep original creation time
        reassignedAt: serverTimestamp(), // Add reassignment timestamp
        reassignmentCount: (rideDoc.exists() ? (rideDoc.data().reassignmentCount || 0) + 1 : 1),
        cancelledAt: null,
        cancelledBy: null,
        declinedAt: null,
      }, { merge: true });

      console.log(`Ride reassigned with ${previousDrivers.length} previous drivers excluded`);
    } else {
      // New ride
      await setDoc(doc(db, 'rides', rideId), {
        ...rideData,
        status: 'pending',
        createdAt: serverTimestamp(),
        previousDrivers: [], // Initialize empty
        reassignmentCount: 0,
      });
    }

    // Update state
    setHasActiveRide(true);
    setActiveRideId(rideId);
    setCurrentRideId(rideId);
    setRideStatus('pending');
    setNeedsReassignment(false);

    // Handle chat document
    if (isReassignment) {
      // Update chat with new driver
      const chatDoc = await getDoc(doc(db, 'chats', rideId));
      let chatPreviousDrivers = [];
      
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        chatPreviousDrivers = chatData.previousDrivers || [];
        if (chatData.driverId && !chatPreviousDrivers.includes(chatData.driverId)) {
          chatPreviousDrivers.push(chatData.driverId);
        }
      }

      await setDoc(doc(db, 'chats', rideId), {
        driverId,
        previousDrivers: chatPreviousDrivers,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Add reassignment message
      await addDoc(collection(db, 'chats', rideId, 'messages'), {
        senderId: userId,
        text: `Hi! I've been reassigned to you as my new driver. Please confirm you can take this ride.`,
        timestamp: serverTimestamp(),
        messageType: 'reassignment',
      });
    } else {
      // Create new chat document
      await setDoc(doc(db, 'chats', rideId), {
        rideId,
        userId,
        driverId,
        previousDrivers: [],
        createdAt: serverTimestamp(),
      });

      // Add initial message
      await addDoc(collection(db, 'chats', rideId, 'messages'), {
        senderId: userId,
        text: 'Hi driver, I\'ve just booked the ride!',
        timestamp: serverTimestamp(),
        messageType: 'booking',
      });
    }

    console.log(isReassignment ? 'Driver reassigned successfully!' : 'Ride booked successfully!');
    return true;
  } catch (error) {
    console.error('Booking error:', error);
    Alert.alert(
      'Booking Failed', 
      isReassignment 
        ? 'Could not reassign driver. Please try again.' 
        : 'Please try again.'
    );
    return false;
  }
};

  const fetchPricing = async () => {
    try {
      const docRef = doc(db, 'settings', 'pricing');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const safePricing = {
          taxi: {
            baseFare: Number(data?.taxi?.baseFare ?? 0),
            pricePerKm: Number(data?.taxi?.pricePerKm ?? 0),
          },
          bus: {
            baseFare: Number(data?.bus?.baseFare ?? 0),
            pricePerKm: Number(data?.bus?.pricePerKm ?? 0),
          },
          van: {
            baseFare: Number(data?.van?.baseFare ?? 0),
            pricePerKm: Number(data?.van?.pricePerKm ?? 0),
          },
        };
        setPricing(safePricing);
      } else {
        console.log('No pricing doc found!');
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
    }
  };
// Update the fetchNearbyDrivers function - Fix active ride check

// 2. Enhanced fetchNearbyDrivers function with better exclusion logic
const fetchNearbyDrivers = async (excludeDriverId = null) => {
  if (!pickup) {
    Alert.alert('Error', 'Pickup location not set');
    return;
  }

  // Check if we're in reassignment mode
  const isReassignment = rideStatus === 'needs_reassignment' || needsReassignment;
  
  // If not in reassignment mode, check for active rides
  if (!isReassignment) {
    const isActuallyActive = hasActiveRide && 
                           currentRideId && 
                           ['pending', 'accepted', 'in-progress'].includes(rideStatus);

    if (isActuallyActive) {
      Alert.alert(
        'Active Ride Exists',
        'Please complete or cancel your current ride before booking a new one.',
        [
          { text: 'View Ride', onPress: () => navigation.navigate('RideTracking', { rideId: currentRideId }) },
          { text: 'Cancel Ride', onPress: cancelCurrentRide, style: 'destructive' },
          { text: 'OK', style: 'cancel' }
        ]
      );
      return;
    }
  }

  setFetchingDrivers(true);
  try {
    // Get previous drivers list for exclusion
    let previousDrivers = [];
    if (currentRideId && isReassignment) {
      try {
        const rideDoc = await getDoc(doc(db, 'rides', currentRideId));
        if (rideDoc.exists()) {
          const rideData = rideDoc.data();
          previousDrivers = rideData.previousDrivers || [];
          
          // Also exclude the current driver who just cancelled/declined
          if (rideData.driverId && !previousDrivers.includes(rideData.driverId)) {
            previousDrivers.push(rideData.driverId);
          }
        }
      } catch (error) {
        console.error('Error fetching ride data for previousDrivers:', error);
      }
    }

    // Add the specifically excluded driver if provided
    if (excludeDriverId && !previousDrivers.includes(excludeDriverId)) {
      previousDrivers.push(excludeDriverId);
    }

    console.log('Excluding drivers:', previousDrivers);

    // Fetch available drivers
    const driversRef = collection(db, 'drivers');
    const querySnapshot = await getDocs(driversRef);

    const driversFromFirestore = [];
    for (const driverDoc of querySnapshot.docs) {
      const driverData = driverDoc.data();
      const driverId = driverDoc.id;

      // Skip if not available or is in exclusion list
      if (driverData.isAvailable === false || previousDrivers.includes(driverId)) {
        console.log(`Skipping driver ${driverId}: not available or in exclusion list`);
        continue;
      }

      // Fetch driver personal info
      let driverPersonalInfo = {
        firstname: 'Unknown',
        lastname: 'Driver',
        profileImage: null,
      };
      
      try {
        const userDocSnap = await getDoc(doc(db, 'users', driverId));
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          driverPersonalInfo = {
            firstname: userData.firstname || 'Unknown',
            lastname: userData.lastname || 'Driver',
            profileImage: userData.profileImage || userData.photoURL || null,
          };
        }
      } catch (err) {
        console.error(`Error fetching user info for driver ${driverId}:`, err);
      }

      // Vehicle info
      const vehicleInfo = driverData.vehicleInfo || {};
      const vehicleDetails = {
        make: vehicleInfo.make || 'Unknown Make',
        model: vehicleInfo.model || 'Unknown Model',
        year: vehicleInfo.year || 'Unknown Year',
        color: vehicleInfo.color || 'Unknown Color',
        licensePlate: vehicleInfo.plateNumber || vehicleInfo.licensePlate || 'Unknown Plate',
        vehicleType: vehicleInfo.vehicleType || 'car',
      };

      driversFromFirestore.push({
        id: driverId,
        name: `${driverPersonalInfo.firstname} ${driverPersonalInfo.lastname}`.trim(),
        firstname: driverPersonalInfo.firstname,
        lastname: driverPersonalInfo.lastname,
        profileImage: driverPersonalInfo.profileImage,
        rating: driverData.rating || 4.5,
        vehicle: `${vehicleDetails.year} ${vehicleDetails.make} ${vehicleDetails.model}`.trim(),
        vehicleDetails,
        latitude: driverData.latitude,
        longitude: driverData.longitude,
        isAvailable: true,
      });
    }

    // Filter drivers within 10km
    const driversWithLocation = driversFromFirestore.filter(
      (d) => d.latitude && d.longitude
    );

    let finalDrivers = driversWithLocation.filter((driver) => {
      const distanceKm = haversine(
        { latitude: driver.latitude, longitude: driver.longitude },
        { latitude: pickup.latitude, longitude: pickup.longitude }
      ) / 1000;
      return distanceKm <= 10; // Within 10km
    });

    if (finalDrivers.length === 0) {
      Alert.alert(
        'No Available Drivers',
        isReassignment 
          ? 'No other drivers are available nearby. You can try again later or cancel the ride.'
          : 'No drivers are available nearby at the moment. Please try again later.',
        isReassignment 
          ? [
              { text: 'Try Again', onPress: () => fetchNearbyDrivers(excludeDriverId) },
              { text: 'Cancel Ride', onPress: cancelCurrentRide, style: 'destructive' }
            ]
          : [{ text: 'OK' }]
      );
      return;
    }

    console.log(`Found ${finalDrivers.length} available drivers`);
    setDrivers(finalDrivers);
    setDriversVisible(true);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    Alert.alert('Error', 'Could not fetch drivers. Please try again.');
  } finally {
    setFetchingDrivers(false);
  }
};
  useEffect(() => {
    fetchPricing();
  }, []);

  useEffect(() => {
    const checkUserStatus = async () => {
      if (!auth.currentUser) return;

      try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();

          if (userData.approved === false || userData.blocked === true) {
            Alert.alert(
              'Account Blocked',
              'Your account has been blocked. Please contact support.',
              [
                {
                  text: 'OK',
                  onPress: () => navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] }),
                },
              ],
              { cancelable: false }
            );
          }
        }
      } catch (error) {
        console.error('Error checking user status:', error);
      }
    };

    checkUserStatus();
  }, []);

  const generateAndShareTicket = async () => {
    const htmlContent = `
      <h1 style="text-align:center;">🎫 Transport Ticket</h1>
      <p><strong>Transport:</strong> ${selectedTransport.toUpperCase()}</p>
      <p><strong>From:</strong> ${pickup?.address || 'N/A'}</p>
      <p><strong>To:</strong> ${dropoff?.address || 'N/A'}</p>
      <p><strong>Distance:</strong> ${distance || 'N/A'} km</p>
      <p><strong>Price:</strong> $${price || 'N/A'}</p>
      <p><strong>ETA:</strong> ${travelTime || 'N/A'} min</p>
      <p>Thank you for using our service!</p>
    `;

    try {
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Ticket Ready', `Ticket saved to ${uri}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not generate ticket: ' + error.message);
    }
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is required.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      const address = 'Current Location';
      setPickup({ ...coords, address });
      setFromLocation(address);
      setRegion({ ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 });
    })();
  }, []);

  useEffect(() => {
    if (pickup && dropoff) {
      setToLocation(dropoff.address || '');
      const centerLat = (pickup.latitude + dropoff.latitude) / 2;
      const centerLng = (pickup.longitude + dropoff.longitude) / 2;
      const deltaLat = Math.abs(pickup.latitude - dropoff.latitude) * 1.5 || 0.05;
      const deltaLng = Math.abs(pickup.longitude - dropoff.longitude) * 1.5 || 0.05;
      setRegion({ latitude: centerLat, longitude: centerLng, latitudeDelta: deltaLat, longitudeDelta: deltaLng });
    }
  }, [pickup, dropoff]);

  useEffect(() => {
    if (pickup && dropoff && selectedTransport) {
      fetchTravelInfo();
    }
  }, [selectedTransport, pickup, dropoff]);

  const fetchTravelInfo = async () => {
    try {
      setLoading(true);
      const url = 'https://api.openrouteservice.org/v2/directions/driving-car';
      const body = { coordinates: [[pickup.longitude, pickup.latitude], [dropoff.longitude, dropoff.latitude]] };
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: OPENROUTESERVICE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!data.routes?.length) throw new Error('No route found');

      const summary = data.routes[0].summary;
      setTravelTime(Math.round(summary.duration / 60));
      setDistance((summary.distance / 1000).toFixed(2));

      const base = pricing[selectedTransport].baseFare;
      const perKm = pricing[selectedTransport].pricePerKm;
      const calculatedPrice = base + (summary.distance / 1000 * perKm);
      setPrice(calculatedPrice.toFixed(2));

      const geometry = data.routes[0].geometry;
      const decoded = polyline.decode(geometry).map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
      setRouteCoords(decoded);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const geocodeAddress = async (query) => {
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_API_KEY}&limit=5`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      return data.results.map((item) => ({
        address: item.formatted,
        latitude: item.geometry.lat,
        longitude: item.geometry.lng,
      }));
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const onLocationChange = (text, isPickup = true) => {
    isPickup ? setFromLocation(text) : setToLocation(text);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => searchAddresses(text, isPickup), 500);
  };

  const searchAddresses = async (query, isPickup = true) => {
    if (query.length < 3) return;
    const results = await geocodeAddress(query);
    isPickup ? setFromSuggestions(results) : setToSuggestions(results);
    isPickup ? setShowFromSuggestions(true) : setShowToSuggestions(true);
  };

  const selectAddress = (address, isPickup = true) => {
    if (isPickup) {
      setPickup(address);
      setFromLocation(address.address);
      setShowFromSuggestions(false);
    } else {
      setDropoff(address);
      setToLocation(address.address);
      setShowToSuggestions(false);
    }
  };

  const renderSuggestion = (item, isPickup = true) => (
    <TouchableOpacity key={item.address} style={styles.suggestionItem} onPress={() => selectAddress(item, isPickup)}>
      <Ionicons name="location-outline" size={16} color={darkMode ? '#FFA500' : '#444'} style={{ marginRight: 8 }} />
      <Text style={{ color: darkMode ? '#fff' : '#000', flex: 1 }}>{item.address}</Text>
    </TouchableOpacity>
  );

const onConfirmOrder = async () => {
  // If in reassignment mode, directly show drivers

  if (!pickup || !dropoff) {
    Alert.alert('Missing Details', 'Please set both pickup and dropoff locations');
    return;
  }

  if (!paymentDone) {
    Alert.alert(
      'Payment Required',
      'Please select a payment method before confirming your order.',
      [{ text: 'OK', onPress: () => setPaymentModalVisible(true) }]
    );
    return;
  }

  await fetchNearbyDrivers();
};


const saveRideToFirestore = async () => {
  if (!auth.currentUser || !pickup || !dropoff || !price || !selectedTransport) {
    Alert.alert('Missing Information', 'Please complete all ride details before booking');
    return null;
  }

  try {
    const rideId = doc(collection(db, 'rides')).id;
    
    const rideData = {
      rideId,
      userId: auth.currentUser.uid,
      pickup: {
        name: pickup.address,
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        address: pickup.address
      },
      dropoff: {
        name: dropoff.address,
        latitude: dropoff.latitude,
        longitude: dropoff.longitude,
        address: dropoff.address
      },
      price: parseFloat(price),
      distance: parseFloat(distance),
      transport: selectedTransport,
      paymentMethod,
      timestamp: serverTimestamp(),
      status: 'pending',
      travelTime: travelTime,
      createdAt: serverTimestamp()
    };

    await setDoc(doc(db, 'rides', rideId), rideData);
    console.log('Ride saved with ID:', rideId);
    return rideId;
  } catch (error) {
    console.error('Error saving ride:', error);
    Alert.alert('Error', 'Could not save ride details. Please try again.');
    return null;
  }
};

  const renderDriverItem = ({ item }) => {
  const isSelected = selectedDriver?.id === item.id;
  const vehicleDetails = item.vehicleDetails || {};

 // 5. Enhanced cancelCurrentRide with proper cleanup
const cancelCurrentRide = async () => {
  if (!currentRideId) return;
  
  Alert.alert(
    'Cancel Ride',
    'Are you sure you want to cancel this ride?',
    [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await setDoc(doc(db, 'rides', currentRideId), {
              status: 'cancelled',
              cancelledAt: serverTimestamp(),
              cancelledBy: 'user',
              updatedAt: serverTimestamp()
            }, { merge: true });
            
            // Complete state reset
            setHasActiveRide(false);
            setCurrentRideId(null);
            setActiveRideId(null);
            setRideStatus(null);
            setSelectedDriver(null);
            setDriverLocationUpdates(null);
            setTrackingEta(null);
            setNeedsReassignment(false);
            setDriversVisible(false);
            
            // Clear form
            setPickup(null);
            setDropoff(null);
            setFromLocation('');
            setToLocation('');
            setPrice(null);
            setDistance(null);
            setTravelTime(null);
            setRouteCoords([]);
            
            Alert.alert('Ride Cancelled', 'Your ride has been cancelled successfully.');
          } catch (error) {
            console.error('Error cancelling ride:', error);
            Alert.alert('Error', 'Could not cancel ride. Please try again.');
          }
        }
      }
    ]
  );
};
    
    return (
      <TouchableOpacity
        style={[styles.driverItem, isSelected && styles.driverItemSelected]}
        onPress={() => setSelectedDriver(item)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {item.profileImage || item.photoURL ? (
            <Image
              source={{ uri: item.profileImage || item.photoURL }}
              style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
            />
          ) : (
            <Ionicons
              name="person-circle-outline"
              size={50}
              color="#ccc"
              style={{ marginRight: 12 }}
            />
          )}
          
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.driverName, isSelected && { color: '#fff' }]}>
                {item.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={[styles.driverRating, isSelected && { color: '#fff' }]}>
                  {item.rating}
                </Text>
              </View>
            </View>
            
            <Text style={[styles.vehicleMain, isSelected && { color: '#fff' }]}>
              {vehicleDetails.year} {vehicleDetails.make} {vehicleDetails.model}
            </Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text style={[styles.vehicleDetails, isSelected && { color: '#fff' }]}>
                {vehicleDetails.color} • {vehicleDetails.licensePlate}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Ionicons 
                name={
                  vehicleDetails.vehicleType === 'sedan' ? 'car-sport' :
                  vehicleDetails.vehicleType === 'suv' ? 'car' :
                  vehicleDetails.vehicleType === 'van' ? 'bus' :
                  'car-outline'
                } 
                size={12} 
                color={isSelected ? '#fff' : '#666'} 
              />
              <Text style={[styles.vehicleType, isSelected && { color: '#fff' }]}>
                {vehicleDetails.vehicleType?.toUpperCase() || 'CAR'}
                {vehicleDetails.capacity ? ` • ${vehicleDetails.capacity} seats` : ''}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <View style={[styles.topHeader, { justifyContent: 'flex-end' }]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('NotificationsScreen')}
          style={[styles.settingsButton, { marginRight: 16 }]}
          accessibilityLabel="Go to notifications"
        >
          <Ionicons
            name="notifications-outline"
            size={28}
            color={darkMode ? '#FFA500' : '#444'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSettingsVisible(true)}
          style={styles.settingsButton}
          accessibilityLabel="Open settings"
        >
          <Ionicons
            name="settings-outline"
            size={28}
            color={darkMode ? '#FFA500' : '#444'}
          />
        </TouchableOpacity>
      </View>

      {region && (
        <MapView style={StyleSheet.absoluteFillObject} region={region} showsUserLocation>
          {pickup && <Marker coordinate={pickup} pinColor="green" />}
          {dropoff && <Marker coordinate={dropoff} pinColor="red" />}
          {routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="#FFA500"
              strokeWidth={3}
            />
          )}
          
          {/* Driver tracking markers */}
          {rideStatus === 'in-progress' && driverLocationUpdates && (
            <>
              <Marker coordinate={driverLocationUpdates}>
                <View style={styles.driverMarker}>
                  {selectedDriver?.profileImage ? (
                    <Image 
                      source={{ uri: selectedDriver.profileImage }} 
                      style={styles.driverMarkerImage}
                    />
                  ) : (
                    <Ionicons name="car-sport" size={24} color="#fff" />
                  )}
                  <View style={styles.driverMarkerArrow} />
                </View>
              </Marker>
              
              <Polyline
                coordinates={[driverLocationUpdates, pickup]}
                strokeColor="#4285F4"
                strokeWidth={4}
              />
            </>
          )}
          
          {drivers.map((driver) => {
            const vehicleDetails = driver.vehicleDetails || {};
  
            return (
              <Marker
                key={driver.id}
                coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
                title={driver.name}
                description={`${driver.vehicle} • ${vehicleDetails.color} • ⭐ ${driver.rating}`}
              >
                <View style={{
                  backgroundColor: '#FFA500',
                  padding: 8,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: '#fff',
                }}>
                  <Ionicons 
                    name={
                      vehicleDetails.vehicleType === 'sedan' ? 'car-sport' :
                      vehicleDetails.vehicleType === 'suv' ? 'car' :
                      vehicleDetails.vehicleType === 'van' ? 'bus' :
                      'car-outline'
                    } 
                    size={20} 
                    color="#fff" 
                  />
                </View>
              </Marker>
            );
          })}
        </MapView>
      )}

      {/* Driver tracking info panel */}
      {rideStatus === 'in-progress' && (
        <View style={styles.trackingContainer}>
          <Text style={styles.trackingText}>Driver is on the way</Text>
          <View style={styles.trackingInfo}>
            <Text style={styles.trackingEta}>
              ETA: {trackingEta || '--'} min
            </Text>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity 
                style={[styles.trackingButton, { backgroundColor: '#ff4444', marginRight: 10 }]}
                onPress={cancelCurrentRide}
              >
                <Text style={styles.trackingButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.trackingButton}
                onPress={() => navigation.navigate('RideTracking', { rideId: currentRideId })}
              >
                <Text style={styles.trackingButtonText}>Live Tracking</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    <KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
  style={[
    styles.bottomSheet,
    collapsed ? { maxHeight: 120 } : { maxHeight: '50%' },
  ]}
>
  <View style={styles.sheetContainer}>
    <FlatList
      data={showFromSuggestions ? fromSuggestions : showToSuggestions ? toSuggestions : []}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {distance && travelTime && price && (
            <View style={styles.infoRow}>
              <View style={styles.infoBox}>
                <Ionicons name="navigate-outline" size={18} color="#FFA500" />
                <Text style={styles.infoText}>{distance} km</Text>
              </View>
              <View style={styles.infoBox}>
                <Ionicons name="time-outline" size={18} color="#FFA500" />
                <Text style={styles.infoText}>{travelTime} min ETA</Text>
              </View>
              <View style={styles.infoBox}>
                <Ionicons name="cash-outline" size={18} color="#FFA500" />
                <Text style={styles.infoText}>${price}</Text>
              </View>
            </View>
          )}

          <View style={styles.inputContainer}>
            <View style={styles.locationRow}>
              <TextInput
                ref={pickupInputRef}
                value={fromLocation}
                onChangeText={(text) => onLocationChange(text, true)}
                placeholder="Pickup Location"
                style={styles.input}
              />
              <TouchableOpacity
                onPress={() => pickupInputRef.current?.focus()}
                style={styles.editIcon}
              >
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={darkMode ? '#FFA500' : '#444'}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.locationRow}>
              <TextInput
                ref={dropoffInputRef}
                value={toLocation}
                onChangeText={(text) => onLocationChange(text, false)}
                placeholder="Dropoff Location"
                style={styles.input}
              />
              <TouchableOpacity
                onPress={() => dropoffInputRef.current?.focus()}
                style={styles.editIcon}
              >
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={darkMode ? '#FFA500' : '#444'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </>
      }
      renderItem={({ item }) => renderSuggestion(item, showFromSuggestions)}
      ListFooterComponent={
        <>
          <View style={styles.transportRow}>
            {['taxi', 'bus', 'van'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.transportOption,
                  selectedTransport === type && styles.transportSelected,
                ]}
                onPress={() => setSelectedTransport(type)}
              >
                <Ionicons
                  name={
                    type === 'taxi'
                      ? 'car-sport'
                      : type === 'bus'
                      ? 'bus'
                      : 'car-outline'
                  }
                  size={20}
                  color="#fff"
                />
                <Text style={styles.transportText}>{type.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading && (
            <ActivityIndicator color="#FFA500" style={{ marginVertical: 10 }} />
          )}

          <TouchableOpacity
            style={styles.paymentButton}
            onPress={() => setPaymentModalVisible(true)}
          >
            <MaterialIcons name="payment" size={24} color="#FFA500" />
            <Text style={styles.paymentButtonText}>Payment</Text>
            <Ionicons name="chevron-forward" size={24} color="#FFA500" />
          </TouchableOpacity>

          {/* Added Reassign Driver Button */}
          {needsReassignment && (
            <TouchableOpacity
              style={[
                styles.paymentButton, 
                { 
                  backgroundColor: '#FFA500',
                  marginTop: 10
                }
              ]}
              onPress={() => fetchNearbyDrivers()}
            >
              <MaterialIcons name="person-search" size={24} color="#fff" />
              <Text style={[styles.paymentButtonText, { color: '#fff' }]}>
                Reassign Driver
              </Text>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          {paymentDone && (
            <TouchableOpacity
              style={[
                styles.paymentButton, 
                { 
                  marginTop: 10,
                  backgroundColor: hasActiveRide ? '#ccc' : '#FFA500',
                  opacity: hasActiveRide ? 0.7 : 1
                }
              ]}
              onPress={onConfirmOrder}
              disabled={fetchingDrivers || hasActiveRide}
            >
              {fetchingDrivers ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons 
                    name={hasActiveRide ? "error-outline" : "check-circle"} 
                    size={24} 
                    color="#fff" 
                  />
                  <Text style={[styles.paymentButtonText, { color: '#fff' }]}>
                    {hasActiveRide ? 'Active Ride Exists' : 'Confirm Order'}
                  </Text>
                  {!hasActiveRide && (
                    <Ionicons name="chevron-forward" size={24} color="#fff" />
                  )}
                </>
              )}
            </TouchableOpacity>
          )}
        </>
      }
      contentContainerStyle={{ paddingBottom: 30 }}
    />
  </View>
</KeyboardAvoidingView>
      {/* Payment Method Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, darkMode && { backgroundColor: '#222' }]}>
            <Text style={[styles.modalTitle, { color: darkMode ? '#FFA500' : '#000' }]}>Select Payment Method</Text>

            {['cash', 'card'].map((method) => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.paymentMethodOption,
                  paymentMethod === method && styles.paymentMethodSelected,
                  { marginVertical: 8 },
                ]}
                onPress={() => {
                  setPaymentMethod(method);
                  setPaymentDone(true);
                  setPaymentModalVisible(false);

                  if (method === 'card') {
                    navigation.navigate('Main', {
                      screen: 'Payments',
                      params: {
                        pickup,
                        dropoff,
                        price,
                        distance,
                        selectedTransport,
                        paymentMethod: method,
                      },
                    });

                    if (selectedTransport === 'bus' || selectedTransport === 'van') {
                      setTimeout(() => {
                        generateAndShareTicket();
                      }, 1500);
                    }
                  } else {
                    Alert.alert('Cash Payment Selected', 'Please pay the driver in person.');

                    if (selectedTransport === 'bus' || selectedTransport === 'van') {
                      generateAndShareTicket();
                    }
                  }
                }}
              >
                <Ionicons
                  name={method === 'cash' ? 'cash-outline' : 'card-outline'}
                  size={22}
                  color={paymentMethod === method ? '#fff' : '#FFA500'}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[
                    styles.paymentMethodText,
                    paymentMethod === method && { color: '#fff' },
                  ]}
                >
                  {method.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
  onPress={() => setDriversVisible(false)}
  style={[styles.modalButton, { backgroundColor: '#ccc' }]}
>
  <Text style={{ color: '#000' }}>Cancel</Text>
</TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Driver Selection Modal */}
      <Modal
        visible={driversVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDriversVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, darkMode && { backgroundColor: '#222' }]}>
            <Text style={[styles.modalTitle, { color: darkMode ? '#FFA500' : '#000' }]}>Select a Driver</Text>

            <FlatList
              data={drivers}
              keyExtractor={(item) => item.id}
              renderItem={renderDriverItem}
              contentContainerStyle={{ paddingVertical: 10 }}
              keyboardShouldPersistTaps="handled"
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setDriversVisible(false)}
                style={[styles.modalButton, { backgroundColor: '#ccc' }]}
              >
                <Text style={{ color: '#000' }}>Cancel</Text>
              </TouchableOpacity>

              

    // In the driver selection modal's confirm button:
<TouchableOpacity
  onPress={async () => {
    if (!selectedDriver) {
      Alert.alert('Select Driver', 'Please choose a driver to continue.');
      return;
    }

    try {
      const isReassignment = needsReassignment || rideStatus === 'needs_reassignment';
      const rideId = isReassignment ? currentRideId : await saveRideToFirestore();
      
      if (!rideId) return;

      const bookingSuccess = await bookRide(rideId, selectedDriver.id, pickup, dropoff, isReassignment);
      
      if (bookingSuccess) {
        setCurrentRideId(rideId);
        setDriversVisible(false);
        Alert.alert(
          isReassignment ? 'Driver Reassigned!' : 'Ride Booked!',
          `Your ride with ${selectedDriver.name} has been ${isReassignment ? 'reassigned' : 'booked'} successfully.`
        );
      }
    } catch (err) {
      console.error('Error booking ride:', err);
      Alert.alert('Booking Failed', 'An error occurred while booking the ride.');
    }
  }}
  style={[styles.modalButton, { backgroundColor: '#FFA500' }]}
>
  <Text style={{ color: '#fff' }}>
    {needsReassignment ? 'Reassign Driver' : 'Confirm Booking'}
  </Text>
</TouchableOpacity>

            </View>
          </View>
        </View>
      </Modal>

      <SettingsPanel visible={settingsVisible} onClose={() => setSettingsVisible(false)}>
        <SettingsScreen navigation={navigation} />
      </SettingsPanel>
    </View>
  );
}

const createStyles = (darkMode) =>
  StyleSheet.create({
    mainContainer: {
      flex: 1,
      backgroundColor: darkMode ? '#1a1a1a' : '#fff',
    },
    bottomSheet: {
      position: 'absolute',
      bottom: 0,
      width: '100%',
      maxHeight: '50%',
      backgroundColor: darkMode ? '#2a2a2a' : '#fff',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 10,
      zIndex: 100,
    },
    sheetContainer: {
      flex: 1,
      padding: 20,
    },
    inputContainer: {
      marginBottom: 10,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    editIcon: {
      marginLeft: 8,
      padding: 6,
    },
    input: {
      flex: 1,
      backgroundColor: darkMode ? '#333' : '#f0f0f0',
      padding: 12,
      borderRadius: 8,
      color: darkMode ? '#fff' : '#000',
      marginBottom: 6,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      backgroundColor: darkMode ? '#444' : '#eee',
      borderBottomColor: '#ccc',
      borderBottomWidth: 0.5,
    },
    transportRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginVertical: 10,
    },
    transportOption: {
      backgroundColor: '#444',
      padding: 10,
      borderRadius: 10,
      alignItems: 'center',
    },
    transportSelected: {
      backgroundColor: '#FFA500',
    },
    transportText: {
      color: '#fff',
      fontSize: 12,
      marginTop: 5,
    },
    paymentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 20,
      backgroundColor: darkMode ? '#333' : '#f2f2f2',
      borderRadius: 12,
      marginTop: 20,
    },
    paymentButtonText: {
      flex: 1,
      marginLeft: 12,
      fontSize: 16,
      fontWeight: '700',
      color: '#FFA500',
    },  
    paymentMethodOption: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF5E1',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#FFA500',
    },
    paymentMethodSelected: {
      backgroundColor: '#FFA500',
    },
    paymentMethodText: {
      marginLeft: 8,
      fontWeight: '600',
      color: '#FFA500',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      width: '85%',
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 15,
      textAlign: 'center',
    },
    driverItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: darkMode ? '#444' : '#ddd',
      borderRadius: 12,
      marginVertical: 6,
      backgroundColor: darkMode ? '#333' : '#f9f9f9',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    driverItemSelected: {
      backgroundColor: '#FFA500',
      borderColor: '#FF8C00',
    },
    driverName: {
      fontSize: 18,
      fontWeight: '700',
      color: darkMode ? '#fff' : '#000',
    },
    driverRating: {
      fontSize: 14,
      fontWeight: '600',
      color: darkMode ? '#fff' : '#666',
      marginLeft: 4,
    },
    vehicleMain: {
      fontSize: 16,
      fontWeight: '600',
      color: darkMode ? '#FFA500' : '#333',
      marginTop: 2,
    },
    vehicleDetails: {
      fontSize: 14,
      color: darkMode ? '#ccc' : '#666',
      fontWeight: '500',
    },
    vehicleType: {
      fontSize: 12,
      color: darkMode ? '#ccc' : '#666',
      marginLeft: 4,
      fontWeight: '500',
      textTransform: 'uppercase',
    },
    modalButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 10,
      marginHorizontal: 5,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 50 : 20,
      paddingBottom: 10,
      backgroundColor: darkMode ? '#1a1a1a' : '#fff',
      zIndex: 10,
    },
    settingsButton: {
      padding: 8,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 12,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: darkMode ? '#333' : '#FFF5E1',
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#FFA500',
      shadowColor: '#FFA500',
      shadowOpacity: 0.3,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    infoText: {
      marginLeft: 8,
      color: darkMode ? '#FFA500' : '#B36B00',
      fontWeight: '600',
      fontSize: 16,
    },
    // Tracking styles
    trackingContainer: {
      position: 'absolute',
      top: 80,
      left: 20,
      right: 20,
      backgroundColor: darkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
      borderRadius: 12,
      padding: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    trackingText: {
      fontSize: 18,
      fontWeight: '600',
      color: darkMode ? '#FFA500' : '#000',
      marginBottom: 8,
    },
    trackingInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    trackingEta: {
      fontSize: 16,
      color: darkMode ? '#fff' : '#333',
    },
    trackingButton: {
      backgroundColor: '#FFA500',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
    },
    trackingButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    driverMarker: {
      alignItems: 'center',
    },
    driverMarkerImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: '#fff',
    },
    driverMarkerArrow: {
      width: 0,
      height: 0,
      backgroundColor: 'transparent',
      borderStyle: 'solid',
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderBottomWidth: 10,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: '#FFA500',
      transform: [{ rotate: '180deg' }],
      marginTop: -5,
    },
 });