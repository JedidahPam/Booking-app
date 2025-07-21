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
import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';  // Adjust path if needed
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import haversine from 'haversine-distance';
import { serverTimestamp } from 'firebase/firestore';


const OPENCAGE_API_KEY = 'a87b854ab508451da44974719031b90b';
const OPENROUTESERVICE_API_KEY =
  'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjllZjJjN2YyMTI1NTQ1YWI5NzJhZmYxMjBmNjhkMTg5IiwiaCI6Im11cm11cjY0In0=';

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

  // Driver selection states
  const [drivers, setDrivers] = useState([]);
  const [driversVisible, setDriversVisible] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [fetchingDrivers, setFetchingDrivers] = useState(false);

  const [paymentDone, setPaymentDone] = React.useState(false);
  

  const bookRide = async (rideId, driverId, pickup, dropoff) => {
  const userId = auth.currentUser.uid;

  try {
    // 1. Create ride document (your existing logic)
    await setDoc(doc(db, 'rides', rideId), {
      rideId,
      userId,
      driverId,
      pickup,
      dropoff,
      status: 'pending',
      timestamp: serverTimestamp(),
    });

    // 2. Create chat document
    await setDoc(doc(db, 'chats', rideId), {
      rideId,
      userId,
      driverId,
    });

    // 3. Add welcome message from user
    await addDoc(collection(db, 'chats', rideId, 'messages'), {
      senderId: userId,
      text: 'Hi driver, I’ve just booked the ride!',
      timestamp: serverTimestamp(),
    });

    console.log('Ride and chat initialized successfully!');
  } catch (error) {
    console.error('Booking error:', error);
    Alert.alert('Booking Failed', 'Please try again.');
  }
};

  // Refs for inputs to enable focusing on edit icon press
  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);

  const saveRideToFirestore = async () => {
    if (!auth.currentUser || !pickup || !dropoff || !price || !selectedTransport) return;

    try {
      const rideData = {
        userId: auth.currentUser.uid,
        pickup,
        dropoff,
        price: parseFloat(price),
        distance: parseFloat(distance),
        transport: selectedTransport,
        paymentMethod,
        timestamp: new Date().toISOString(),
        status: 'pending',
      };

      const docRef = await addDoc(collection(db, 'rides'), rideData);
      console.log('Ride saved with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error saving ride:', error);
      Alert.alert('Error', 'Could not save ride to Firestore');
    }
  };

  // Fixed fetchNearbyDrivers function
  // Fixed fetchNearbyDrivers function
// Fixed fetchNearbyDrivers function to handle nested vehicle info
const fetchNearbyDrivers = async () => {
  if (!pickup) {
    Alert.alert('Pickup location not set');
    return;
  }
  setFetchingDrivers(true);
  try {
    // Get drivers from the drivers collection
    const driversRef = collection(db, 'drivers');
    const querySnapshot = await getDocs(driversRef);

    const driversFromFirestore = [];

    // Process each driver document
    for (const driverDoc of querySnapshot.docs) {
      const driverData = driverDoc.data();
      const driverId = driverDoc.id;
      
      // Fetch vehicle info from the nested vehicleInfo subcollection
      let vehicleDetails = {
        make: 'Unknown Make',
        model: 'Unknown Model',
        year: 'Unknown Year',
        color: 'Unknown Color',
        licensePlate: 'Unknown Plate',
        vehicleType: 'car'
      };

      try {
        // Get all documents from the vehicleInfo subcollection
        const vehicleInfoRef = collection(db, 'drivers', driverId, 'vehicleInfo');
        const vehicleSnapshot = await getDocs(vehicleInfoRef);
        
        if (!vehicleSnapshot.empty) {
          // If there are multiple vehicle documents, take the first one
          // Or you could modify this logic to handle multiple vehicles
          const vehicleDoc = vehicleSnapshot.docs[0];
          const vehicleData = vehicleDoc.data();
          
          vehicleDetails = {
            make: vehicleData.make || 'Unknown Make',
            model: vehicleData.model || 'Unknown Model',
            year: vehicleData.year || 'Unknown Year',
            color: vehicleData.color || 'Unknown Color',
            licensePlate: vehicleData.licensePlate || vehicleData.plateNumber || 'Unknown Plate',
            vehicleType: vehicleData.vehicleType || vehicleData.type || 'car',
            // Add any other vehicle fields you have
            capacity: vehicleData.capacity || 4,
            fuelType: vehicleData.fuelType || 'Unknown',
          };
        }
      } catch (vehicleError) {
        console.error(`Error fetching vehicle info for driver ${driverId}:`, vehicleError);
        // vehicleDetails will use default values
      }

      // Create complete driver object
      const driverInfo = {
        id: driverId,
        // Personal details from drivers collection
        name: driverData.firstname && driverData.lastname 
          ? `${driverData.firstname} ${driverData.lastname}` 
          : driverData.name || 'Unknown Driver',
        email: driverData.email || '',
        phone: driverData.phone || '',
        profileImage: driverData.profileImage || driverData.photoURL || null,
        
        // Driver-specific details
        rating: driverData.rating || 4.5,
        
        // Vehicle details from nested collection
        vehicle: `${vehicleDetails.year} ${vehicleDetails.make} ${vehicleDetails.model}`.trim(),
        vehicleDetails: vehicleDetails, // Store complete vehicle info
        vehicleType: vehicleDetails.vehicleType,
        licensePlate: vehicleDetails.licensePlate,
        
        // Location data
        latitude: driverData.latitude || null,
        longitude: driverData.longitude || null,
        isAvailable: driverData.isAvailable !== false,
        
        // Additional driver info
        createdAt: driverData.createdAt || null,
        uid: driverData.uid || driverId,
      };

      driversFromFirestore.push(driverInfo);
    }

    // Filter drivers that have location data and are available
    const driversWithLocation = driversFromFirestore.filter(driver => {
      return driver.latitude && driver.longitude && driver.isAvailable;
    });

    // If no drivers have location data, show mock drivers nearby (for testing)
    let finalDrivers = driversWithLocation;
    if (driversWithLocation.length === 0) {
      console.log('No drivers with location found, creating mock drivers nearby');
      
      // Create mock drivers near the pickup location for testing
      const mockDrivers = driversFromFirestore.slice(0, 3).map((driver, index) => ({
        ...driver,
        latitude: pickup.latitude + (Math.random() - 0.5) * 0.01,
        longitude: pickup.longitude + (Math.random() - 0.5) * 0.01,
        isAvailable: true,
        name: driver.name || `Driver ${index + 1}`,
        vehicle: driver.vehicle || `2022 Toyota Camry`, // Better mock data
        rating: driver.rating || (4.0 + Math.random()).toFixed(1),
        vehicleDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: '2022',
          color: ['White', 'Black', 'Silver'][index] || 'White',
          licensePlate: `ABC-${1000 + index}`,
          vehicleType: 'sedan',
        },
      }));
      
      finalDrivers = mockDrivers;
    } else {
      // Filter drivers by distance (within 10 km of pickup)
      finalDrivers = driversWithLocation.filter(driver => {
        const distanceKm = haversine(
          { latitude: driver.latitude, longitude: driver.longitude },
          { latitude: pickup.latitude, longitude: pickup.longitude }
        ) / 1000;
        return distanceKm <= 10;
      });
    }

    if (finalDrivers.length === 0) {
      Alert.alert('No available drivers found nearby.');
      return;
    }

    console.log('Final drivers with vehicle details:', finalDrivers);
    setDrivers(finalDrivers);
    setDriversVisible(true);
    
  } catch (error) {
    console.error('Error fetching drivers:', error);
    Alert.alert('Error fetching drivers', error.message);
  } finally {
    setFetchingDrivers(false);
  }
};
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

      const ratePerKm = { taxi: 1.5, bus: 0.8, van: 1.2 };
      setPrice((summary.distance / 1000 * ratePerKm[selectedTransport]).toFixed(2));

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

  const onConfirmOrder = () => {
  if (!pickup || !dropoff) {
    Alert.alert('Missing Details', 'Please set both pickup and dropoff locations');
    return;
  }

  if (!paymentDone) {
    Alert.alert(
      'Payment Required',
      'Please select a payment method before confirming your order.',
      [
        {
          text: 'OK',
          onPress: () => setPaymentModalVisible(true),
        },
      ]
    );
    return;
  }

  fetchNearbyDrivers();
};


 // Updated renderDriverItem to show detailed vehicle information
const renderDriverItem = ({ item }) => {
  const isSelected = selectedDriver?.id === item.id;
  const vehicleDetails = item.vehicleDetails || {};
  
  return (
    <TouchableOpacity
      style={[styles.driverItem, isSelected && styles.driverItemSelected]}
      onPress={() => setSelectedDriver(item)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Driver Profile Image */}
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
        
        {/* Driver and Vehicle Information */}
        <View style={{ flex: 1 }}>
          {/* Driver Name and Rating */}
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
          
          {/* Vehicle Make, Model, Year */}
          <Text style={[styles.vehicleMain, isSelected && { color: '#fff' }]}>
            {vehicleDetails.year} {vehicleDetails.make} {vehicleDetails.model}
          </Text>
          
          {/* Vehicle Color and License Plate */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Text style={[styles.vehicleDetails, isSelected && { color: '#fff' }]}>
              {vehicleDetails.color} • {vehicleDetails.licensePlate}
            </Text>
          </View>
          
          {/* Vehicle Type and Capacity (if available) */}
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
          
          {drivers.map((driver) => {
  const vehicleDetails = driver.vehicleDetails || {};
  
  return (
    <Marker
      key={driver.id}
      coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
      title={driver.name}
      description={`${driver.vehicle} • ${vehicleDetails.color} • ⭐ ${driver.rating}`}
    >
      {/* Custom marker icon based on vehicle type */}
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
        style={[
          styles.bottomSheet,
          collapsed ? { maxHeight: 120 } : { maxHeight: '50%' },
        ]}
      >
        <View style={styles.sheetContainer}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
          >
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

              {showFromSuggestions && (
                <FlatList
                  data={fromSuggestions}
                  keyExtractor={(item) => item.address}
                  renderItem={({ item }) => renderSuggestion(item, true)}
                  style={{ maxHeight: 150, marginBottom: 10 }}
                  keyboardShouldPersistTaps="handled"
                />
              )}

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

              {showToSuggestions && (
                <FlatList
                  data={toSuggestions}
                  keyExtractor={(item) => item.address}
                  renderItem={({ item }) => renderSuggestion(item, false)}
                  style={{ maxHeight: 150, marginBottom: 10 }}
                  keyboardShouldPersistTaps="handled"
                />
              )}
            </View>

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

            {paymentDone && (
  <TouchableOpacity
    style={[styles.paymentButton, { marginTop: 10, backgroundColor: '#FFA500' }]}
    onPress={onConfirmOrder}
    disabled={fetchingDrivers}
  >
    {fetchingDrivers ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <>
        <MaterialIcons name="check-circle" size={24} color="#fff" />
        <Text style={[styles.paymentButtonText, { color: '#fff' }]}>
          Confirm Order
        </Text>
        <Ionicons name="chevron-forward" size={24} color="#fff" />
      </>
    )}
  </TouchableOpacity>
)}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

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
                onPress={async () => {
                  try {
                    setPaymentMethod(method);
                    setPaymentMethod(method);
                    setPaymentDone(true); // 👈 Add this
                    setPaymentModalVisible(false); 

                    const rideId = await saveRideToFirestore();
                    if (!rideId) return;

                    if (method === 'card') {
                      navigation.navigate('Main', {
                        screen: 'Payments',
                        params: {
                          pickup,
                          dropoff,
                          rideId,
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
                      Alert.alert(
                        'Cash Payment Selected',
                        'Please pay the driver in person.'
                      );

                      if (selectedTransport === 'bus' || selectedTransport === 'van') {
                        generateAndShareTicket();
                      }
                    }
                  } catch (error) {
                    console.error('Payment handling error:', error);
                    Alert.alert('Error', 'Something went wrong during payment handling.');
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
              onPress={() => setPaymentModalVisible(false)}
              style={[styles.modalButton, { backgroundColor: '#ccc', marginTop: 16 }]}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={driversVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDriversVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, darkMode && { backgroundColor: '#222' }]}>
            <Text style={[styles.modalTitle, { color: darkMode ? '#FFA500' : '#000' }]}>Select a Driver</Text>

            <FlatList data={drivers} keyExtractor={(item) => item.id} renderItem={renderDriverItem} style={{ maxHeight: 300 }} />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ccc' }]}
                onPress={() => {
                  setSelectedDriver(null);
                  setDriversVisible(false);
                }}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#FFA500' }]}
                disabled={!selectedDriver}
                onPress={() => {
                  Alert.alert('Driver Selected', `You selected ${selectedDriver?.name}.`);
                  setDriversVisible(false);

                  setDriverLocation({
                    latitude: selectedDriver.latitude,
                    longitude: selectedDriver.longitude,
                    name: selectedDriver.name,
                  });

                  if (pickup) {
                    const centerLat = (pickup.latitude + selectedDriver.latitude) / 2;
                    const centerLng = (pickup.longitude + selectedDriver.longitude) / 2;
                    const deltaLat = Math.abs(pickup.latitude - selectedDriver.latitude) * 1.5 || 0.05;
                    const deltaLng = Math.abs(pickup.longitude - selectedDriver.longitude) * 1.5 || 0.05;
                    setRegion({
                      latitude: centerLat,
                      longitude: centerLng,
                      latitudeDelta: deltaLat,
                      longitudeDelta: deltaLng,
                    });
                  }
                  setCollapsed(true);
                }}
              >
                <Text style={{ color: '#fff' }}>Confirm</Text>
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
  maxHeight: '50%', // bottom sheet covers half the screen height
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
    distanceText: {
      color: '#FFA500',
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
      textAlign: 'center',
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
    detailText: {
      color: '#FFA500',
      fontSize: 16,
      marginBottom: 5,
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

    paymentMethodRow: {
  flexDirection: 'row',
  justifyContent: 'space-around',
  marginTop: 10,
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

    // Modal styles
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

  // Update existing driverDetails style (keep for backward compatibility)
  driverDetails: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
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


  });
