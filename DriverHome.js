import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Vibration,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import haversine from 'haversine-distance';
import { auth, db } from './firebaseConfig';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { useTheme } from './ThemeContext';
import { getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

export default function DriverHome({ navigation }) {
  const { darkMode, toggleDarkMode } = useTheme();
  const styles = createStyles(darkMode);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState([]);
  const [error, setError] = useState(null);
  const [expandedRideId, setExpandedRideId] = useState(null);
  const [selectedRideType, setSelectedRideType] = useState('All');
  const [acceptedRidesCount, setAcceptedRidesCount] = useState(0);
  
  const locationSubscriptionRef = useRef(null);
  const ridesUnsubscribeRef = useRef(null);
  const acceptedRidesUnsubscribeRef = useRef(null);
  const subscribeToRidesThrottled = useRef(null);

  useEffect(() => {
    startTracking();
    subscribeToAcceptedRides();

    return () => {
      if (subscribeToRidesThrottled.current) {
        clearTimeout(subscribeToRidesThrottled.current);
      }
      
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
      if (ridesUnsubscribeRef.current) {
        ridesUnsubscribeRef.current();
      }
      if (acceptedRidesUnsubscribeRef.current) {
        acceptedRidesUnsubscribeRef.current();
      }
      markDriverUnavailable();
    };
  }, []);

  const subscribeToAcceptedRides = () => {
    const driverId = auth.currentUser?.uid;
    if (!driverId) return;

    const acceptedRidesQuery = query(
      collection(db, 'rides'),
      where('status', 'in', ['accepted', 'in_progress']),
      where('acceptedBy', '==', driverId)
    );

    acceptedRidesUnsubscribeRef.current = onSnapshot(
      acceptedRidesQuery,
      (snapshot) => {
        setAcceptedRidesCount(snapshot.docs.length);
      },
      (error) => {
        console.error('Error fetching accepted rides count:', error);
      }
    );
  };

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location access is required.');
      setError('Location permission denied');
      setLoading(false);
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const coords = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    setDriverLocation(coords);
    await updateDriverLocation(coords);
    subscribeToRides(coords);

    locationSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 50,
        timeInterval: 30000,
      },
      async (loc) => {
        const newCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        
        const oldCoords = driverLocation;
        if (oldCoords) {
          const distance = haversine(oldCoords, newCoords);
          if (distance < 100) {
            return;
          }
        }
        
        setDriverLocation(newCoords);
        await updateDriverLocation(newCoords);
        subscribeToRides(newCoords);
      }
    );
    
    setLoading(false);
  };

  const updateDriverLocation = async (coords) => {
    try {
      const driverId = auth.currentUser?.uid;
      if (!driverId) return;
      
      const driverRef = doc(db, 'drivers', driverId);
      const driverDoc = await getDoc(driverRef);
      
      const driverData = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        isAvailable: true,
        lastUpdated: serverTimestamp(),
      };

      if (!driverDoc.exists()) {
        await setDoc(driverRef, {
          ...driverData,
          userId: driverId,
          createdAt: serverTimestamp(),
          name: auth.currentUser?.displayName || 'Driver',
          email: auth.currentUser?.email || '',
          vehicleType: 'taxi',
          status: 'active',
        });
        console.log('Driver document created successfully');
      } else {
        await updateDoc(driverRef, driverData);
      }
    } catch (err) {
      console.error('Failed to update driver location:', err);
    }
  };

  const markDriverUnavailable = async () => {
    try {
      const driverId = auth.currentUser?.uid;
      if (!driverId) return;
      
      const driverRef = doc(db, 'drivers', driverId);
      const driverDoc = await getDoc(driverRef);
      
      if (driverDoc.exists()) {
        await updateDoc(driverRef, { isAvailable: false });
      }
    } catch (err) {
      console.error('Failed to mark driver unavailable:', err);
    }
  };

const subscribeToRides = (coords) => {
  if (subscribeToRidesThrottled.current) {
    clearTimeout(subscribeToRidesThrottled.current);
  }

  subscribeToRidesThrottled.current = setTimeout(() => {
    if (ridesUnsubscribeRef.current) {
      ridesUnsubscribeRef.current();
      ridesUnsubscribeRef.current = null;
    }

    console.log('Creating new rides subscription at:', new Date().toISOString());
    setLoading(true);

    const driverId = auth.currentUser?.uid;
    if (!driverId) return;

    const ridesQuery = query(
      collection(db, 'rides'),
      where('status', '==', 'pending')
    );

    ridesUnsubscribeRef.current = onSnapshot(
      ridesQuery,
      (snapshot) => {
        const nearbyRides = [];
        const processedRideIds = new Set();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const rideId = docSnap.id;

          if (processedRideIds.has(rideId)) {
            console.warn(`Duplicate ride ID detected: ${rideId}`);
            return;
          }
          processedRideIds.add(rideId);

          // Skip if current driver is in previousDrivers array
          if (data.previousDrivers && data.previousDrivers.includes(driverId)) {
            console.log(`Skipping ride ${rideId} - driver was previously assigned`);
            return;
          }

          let pickupLocation = data.pickupLocation;
          if (data.pickup && data.pickup.latitude) {
            pickupLocation = data.pickup;
          }

          if (!pickupLocation || !pickupLocation.latitude) return;

          const rideCoords = {
            latitude: pickupLocation.latitude,
            longitude: pickupLocation.longitude,
          };

          const distanceKm = haversine(coords, rideCoords) / 1000;

          if (distanceKm <= 30) {
            nearbyRides.push({
              id: rideId,
              pickup: pickupLocation.address || data.pickup?.address || 'N/A',
              dropoff: data.dropoffLocation?.address || data.dropoff?.address || 'N/A',
              rideType: data.rideType || 'taxi',
              passengerCount: data.passengerCount || '1',
              scheduledTime: data.scheduledTime ? data.scheduledTime.toDate() : '',
              specialRequests: data.specialRequests || '',
              location: rideCoords,
              distance: distanceKm.toFixed(1),
            });
          }
        });

        nearbyRides.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

        setRides(prevRides => {
          const ridesChanged = JSON.stringify(prevRides.map(r => r.id).sort()) !== 
                             JSON.stringify(nearbyRides.map(r => r.id).sort());
          
          if (ridesChanged) {
            console.log(`Rides updated: ${nearbyRides.length} rides found`);
            return nearbyRides;
          }
          return prevRides;
        });
        
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching rides:', error);
        setError('Failed to fetch rides');
        setLoading(false);
      }
    );
  }, 2000);
};

  const handleAccept = async (rideId) => {
    const driverId = auth.currentUser?.uid;
    if (!driverId) {
      Alert.alert('Error', 'Driver not authenticated');
      return;
    }

    const activeRidesQuery = query(
      collection(db, 'rides'),
      where('acceptedBy', '==', driverId),
      where('status', 'in', ['accepted', 'in_progress'])
    );

    try {
      const activeRidesSnapshot = await getDocs(activeRidesQuery);
      if (!activeRidesSnapshot.empty) {
        Alert.alert(
          'Active Trip Exists',
          'You already have an active trip. Complete or cancel it before accepting a new ride.'
        );
        return;
      }

      const rideRef = doc(db, 'rides', rideId);

      await runTransaction(db, async (transaction) => {
        const rideDoc = await transaction.get(rideRef);
        if (!rideDoc.exists()) throw 'Ride does not exist!';
        if (rideDoc.data().status !== 'pending')
          throw 'Ride is no longer available';

        transaction.update(rideRef, {
          status: 'accepted',
          acceptedBy: driverId,
          acceptedAt: serverTimestamp(),
        });
      });

      Alert.alert(
        'Success',
        'Ride accepted successfully. Go to My Trips to manage it.',
        [
          { text: 'Stay Here', style: 'cancel' },
          { text: 'Go to Trips', onPress: () => navigation.navigate('DriverTrips') },
        ]
      );
    } catch (error) {
      console.error('Accept ride error:', error);
      Alert.alert('Error', error.toString());
    }
  };

  const handleDecline = async (rideId) => {
    const driverId = auth.currentUser?.uid;
    if (!driverId) {
      Alert.alert('Error', 'Driver not authenticated');
      return;
    }

    const rideRef = doc(db, 'rides', rideId);

    try {
      await runTransaction(db, async (transaction) => {
        const rideDoc = await transaction.get(rideRef);
        if (!rideDoc.exists()) {
          throw 'Ride does not exist!';
        }

        transaction.update(rideRef, {
          status: 'declined',
          declinedBy: driverId,
          declinedAt: serverTimestamp(),
        });
      });

      Alert.alert('Success', 'Ride has been declined and removed from your list.');
      setRides(prev => prev.filter(ride => ride.id !== rideId));
      
    } catch (error) {
      console.error('Decline ride error:', error);
      Alert.alert('Error', error.toString());
    }
  };

  const renderRide = ({ item }) => {
    const expanded = expandedRideId === item.id;

    return (
      <TouchableOpacity
        onPress={() => setExpandedRideId(expanded ? null : item.id)}
        activeOpacity={0.9}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.rideTypeContainer}>
              <Text style={styles.rideType}>{item.rideType.toUpperCase()}</Text>
            </View>
            <Text style={styles.distance}>{item.distance} km</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Pickup:</Text>
            <Text style={styles.value} numberOfLines={2}>{item.pickup}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Drop-off:</Text>
            <Text style={styles.value} numberOfLines={2}>{item.dropoff}</Text>
          </View>

          {expanded && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Passengers:</Text>
                <Text style={styles.value}>{item.passengerCount}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Scheduled:</Text>
                <Text style={styles.value}>
                  {item.scheduledTime
                    ? item.scheduledTime.toLocaleString()
                    : 'ASAP'}
                </Text>
              </View>

              {item.specialRequests ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Requests:</Text>
                  <Text style={styles.value}>{item.specialRequests}</Text>
                </View>
              ) : null}

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#FF4D4D' }]}
                  onPress={() => handleDecline(item.id)}
                >
                  <Text style={styles.btnText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]}
                  onPress={() => handleAccept(item.id)}
                >
                  <Text style={styles.btnText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFA500" />
        <Text style={styles.loadingText}>Finding nearby rides...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => {
          setError(null);
          startTracking();
        }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filteredRides = rides.filter((ride) =>
    selectedRideType === 'All' ? true : ride.rideType === selectedRideType.toLowerCase()
  );

  return (
    <View style={{ flex: 1 }}>
      {driverLocation && (
        <MapView
          style={StyleSheet.absoluteFillObject}
          region={{
            ...driverLocation,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation
          showsMyLocationButton
          userInterfaceStyle={darkMode ? 'dark' : 'light'}
        >
          <Marker 
            coordinate={driverLocation} 
            title="You are here" 
            pinColor={darkMode ? '#FFA500' : 'blue'}
            anchor={{ x: 0.5, y: 0.5 }}
          />
          {rides.map((ride) => (
            <Marker
              key={ride.id}
              coordinate={ride.location}
              title={`${ride.rideType} - ${ride.distance}km`}
              description={ride.pickup}
              pinColor={darkMode ? '#FF7043' : 'orange'}
            />
          ))}
        </MapView>
      )}

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Available Rides ({rides.length})</Text>
            <TouchableOpacity onPress={toggleDarkMode} style={styles.themeToggle}>
              <Ionicons 
                name={darkMode ? 'sunny' : 'moon'} 
                size={24} 
                color={darkMode ? '#FFA500' : '#007AFF'} 
              />
            </TouchableOpacity>
          </View>
          
          {acceptedRidesCount > 0 && (
            <TouchableOpacity 
              style={styles.tripsButton}
              onPress={() => navigation.navigate('DriverTrips')}
            >
              <Text style={styles.tripsButtonText}>
                My Trips ({acceptedRidesCount})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterContainer}>
          {['All', 'Taxi', 'Bus', 'Van'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterButton,
                selectedRideType === type && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedRideType(type)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedRideType === type && styles.filterTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredRides.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name="time-outline" 
              size={48} 
              color={darkMode ? '#555' : '#ccc'} 
            />
            <Text style={styles.emptyText}>
              {selectedRideType === 'All' 
                ? "No nearby ride requests." 
                : `No ${selectedRideType.toLowerCase()} rides available.`}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredRides}
            keyExtractor={(item) => item.id}
            renderItem={renderRide}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const createStyles = (darkMode) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: darkMode ? 'rgba(10, 10, 10, 0.85)' : '#f2f2f2',
  },
 header: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 16,
  backgroundColor: darkMode ? '#1e1e1e' : '#fff',
  borderBottomWidth: 1,
  borderBottomColor: darkMode ? '#333' : '#e0e0e0',
},
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
 headerTitle: {
  fontSize: 24,
  fontWeight: 'bold',
  color: darkMode ? '#fff' : '#333',
},
 themeToggle: {
  marginLeft: 12,
},
  tripsButton: {
    backgroundColor: darkMode ? '#FFA500' : '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: darkMode ? '#FFA500' : '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  tripsButtonText: {
    color: darkMode ? '#000' : '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: darkMode ? 'rgba(30, 30, 30, 0.9)' : '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 165, 0, 0.3)' : '#ddd',
    shadowColor: darkMode ? '#FFA500' : '#FFA500',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideTypeContainer: {
    backgroundColor: darkMode ? '#FF7043' : '#FFA500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rideType: {
    color: darkMode ? '#000' : '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  distance: {
    color: darkMode ? '#4CAF50' : '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'flex-start',
    gap: 10,
  },
  label: {
    color: darkMode ? '#FFB84D' : '#FFA500',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
    width: '30%',
  },
  value: {
    color: darkMode ? '#FFFFFF' : '#222',
    fontSize: 14,
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: darkMode ? '#FFB84D' : '#FFA500',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: darkMode ? '#000' : '#fff',
  },
  loadingText: {
    color: darkMode ? '#FFA500' : '#FFA500',
    fontSize: 16,
    marginTop: 10,
  },
  errorText: {
    color: darkMode ? '#FF7043' : '#FF4D4D',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: darkMode ? '#FFA500' : '#FFA500',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: darkMode ? '#000' : '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: darkMode ? 'rgba(51, 51, 51, 0.8)' : '#eee',
    margin: 4,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(85, 85, 85, 0.8)' : '#ccc',
  },
  filterButtonActive: {
    backgroundColor: darkMode ? '#FF7043' : '#FFA500',
    borderColor: darkMode ? '#FF7043' : '#FFA500',
  },
  filterText: {
    color: darkMode ? 'white' : '#222',
    fontWeight: '500',
    fontSize: 14,
  },
  filterTextActive: {
    color: darkMode ? '#000' : '#000',
    fontWeight: '700',
  },
});