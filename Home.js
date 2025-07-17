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
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';  // Adjust path if needed
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
// ...
import haversine from 'haversine-distance';

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

  // Driver selection states
  const [drivers, setDrivers] = useState([]);
  const [driversVisible, setDriversVisible] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [fetchingDrivers, setFetchingDrivers] = useState(false);

  // Refs for inputs to enable focusing on edit icon press
  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);

  const generateAndShareTicket = async () => {
  const htmlContent = `
    <h1 style="text-align:center;">🎫 Transport Ticket</h1>
    <p><strong>Transport:</strong> ${selectedTransport.toUpperCase()}</p>
    <p><strong>From:</strong> ${pickup?.address}</p>
    <p><strong>To:</strong> ${dropoff?.address}</p>
    <p><strong>Distance:</strong> ${distance} km</p>
    <p><strong>Price:</strong> $${price}</p>
    <p><strong>ETA:</strong> ${travelTime} min</p>
    <p>Thank you for using our service!</p>
  `;

  try {
    const file = await RNHTMLtoPDF.convert({
      html: htmlContent,
      fileName: `ticket_${Date.now()}`,
      base64: false,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.filePath);
    } else {
      Alert.alert('Ticket Ready', `Ticket saved to ${file.filePath}`);
    }
  } catch (error) {
    Alert.alert('Error', 'Could not generate ticket: ' + error.message);
  }
};

 
const fetchNearbyDrivers = async () => {
  if (!pickup) {
    Alert.alert('Pickup location not set');
    return;
  }
  setFetchingDrivers(true);
  try {
    const driversRef = collection(db, 'drivers');
    const q = query(driversRef, where('isAvailable', '==', true));
    const querySnapshot = await getDocs(q);

    // Map Firestore documents to driver objects
    const driversFromFirestore = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        rating: data.rating,
        vehicle: data.vehicle,
        latitude: data.latitude,
        longitude: data.longitude,
        photoURL: data.photoURL || null,  // Add this line
      };
    });

    // Filter drivers by distance (within 10 km of pickup)
    const filteredDrivers = driversFromFirestore.filter(driver => {
      if (!driver.latitude || !driver.longitude) return false;
      const distanceKm = haversine(
        { latitude: driver.latitude, longitude: driver.longitude },
        { latitude: pickup.latitude, longitude: pickup.longitude }
      ) / 1000;
      return distanceKm <= 10;
    });

    if (filteredDrivers.length === 0) {
      Alert.alert('No available drivers found nearby.');
    }

    setDrivers(filteredDrivers);
    setDriversVisible(true);
  } catch (error) {
    Alert.alert('Error fetching drivers', error.message);
  } finally {
    setFetchingDrivers(false);
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
      Alert.alert('Please set both pickup and dropoff locations');
      return;
    }
    fetchNearbyDrivers();
  };

  const renderDriverItem = ({ item }) => {
  const isSelected = selectedDriver?.id === item.id;
  return (
    <TouchableOpacity
      style={[styles.driverItem, isSelected && styles.driverItemSelected]}
      onPress={() => setSelectedDriver(item)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {item.photoURL ? (
          <Image
            source={{ uri: item.photoURL }}
            style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
          />
        ) : (
          <Ionicons
            name="person-circle-outline"
            size={40}
            color="#ccc"
            style={{ marginRight: 12 }}
          />
        )}
        <View>
          <Text style={styles.driverName}>{item.name}</Text>
          <Text style={styles.driverDetails}>
            {item.vehicle} | ⭐ {item.rating}
          </Text>
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
      style={[styles.settingsButton, { marginRight: 16 }]} // add margin between icons
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
  
  {/* Add driver markers */}
  {drivers.map((driver) => (
    <Marker
      key={driver.id}
      coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
      pinColor="blue"
      title={driver.name}
      description={`${driver.vehicle} | Rating: ${driver.rating}`}
    />
  ))}

  {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor="#4A90E2" />}
  {driverLocation && (
    <Marker
      coordinate={driverLocation}
      pinColor="blue"
      title={driverLocation.name || 'Driver'}
    />
  )}
</MapView>

      )}

     <KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
  style={[
  styles.bottomSheet,
  collapsed ? { maxHeight: 120 } : { maxHeight: '50%' }
]}

>
  <View style={styles.sheetContainer}>
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 30 }}
    >
     {distance && travelTime && (
  <View style={styles.infoRow}>
    <View style={styles.infoBox}>
      <Ionicons name="navigate-outline" size={18} color="#FFA500" />
      <Text style={styles.infoText}>{distance} km</Text>
    </View>
    <View style={styles.infoBox}>
      <Ionicons name="time-outline" size={18} color="#FFA500" />
      <Text style={styles.infoText}>{travelTime} min ETA</Text>
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
          <TouchableOpacity onPress={() => pickupInputRef.current?.focus()} style={styles.editIcon}>
            <Ionicons name="create-outline" size={20} color={darkMode ? '#FFA500' : '#444'} />
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
          <TouchableOpacity onPress={() => dropoffInputRef.current?.focus()} style={styles.editIcon}>
            <Ionicons name="create-outline" size={20} color={darkMode ? '#FFA500' : '#444'} />
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
            style={[styles.transportOption, selectedTransport === type && styles.transportSelected]}
            onPress={() => setSelectedTransport(type)}
          >
            <Ionicons
              name={type === 'taxi' ? 'car-sport' : type === 'bus' ? 'bus' : 'car-outline'}
              size={20}
              color="#fff"
            />
            <Text style={styles.transportText}>{type.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <ActivityIndicator color="#FFA500" style={{ marginVertical: 10 }} />}

      <TouchableOpacity
        style={styles.paymentButton}
       onPress={async () => {
  navigation.navigate('Main', {
    screen: 'Payments',
    params: {
      pickup,
      dropoff,
      rideId: 'ride_123',
      price,
      distance,
      selectedTransport,
    },
  });

  // Simulate ticket generation only for bus or van
  if (selectedTransport === 'bus' || selectedTransport === 'van') {
    setTimeout(() => {
      generateAndShareTicket();
    }, 1500); // wait for payment screen to load before showing share dialog
  }
}}

      >
        <MaterialIcons name="payment" size={24} color="#FFA500" />
        <Text style={styles.paymentButtonText}>Payment</Text>
        <Ionicons name="chevron-forward" size={24} color="#FFA500" />
      </TouchableOpacity>

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
            <Text style={[styles.paymentButtonText, { color: '#fff' }]}>Confirm Order</Text>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  </View>
</KeyboardAvoidingView>


      {/* Drivers selection modal */}
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
  Alert.alert('Driver Selected', `You selected ${selectedDriver?.name}. Proceed with booking.`);
  setDriversVisible(false);

  // ✅ Show driver on map
  setDriverLocation({
    latitude: selectedDriver.latitude,
    longitude: selectedDriver.longitude,
    name: selectedDriver.name,
  });

  // ✅ Optionally update map region to fit both pickup and driver
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
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#ddd',
      borderRadius: 8,
      marginVertical: 4,
      backgroundColor: '#f7f7f7',
    },
    driverItemSelected: {
      backgroundColor: '#FFA500',
    },
    driverName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#000',
    },
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
  gap: 20, // use marginRight on child views if your RN version doesn't support gap
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
