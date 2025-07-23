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
import { useColorScheme } from 'react-native';


export default function DriverHome({ navigation }) {
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState([]);
  const [error, setError] = useState(null);
  const [expandedRideId, setExpandedRideId] = useState(null);
  const [selectedRideType, setSelectedRideType] = useState('All');
  const [acceptedRidesCount, setAcceptedRidesCount] = useState(0);
  const colorScheme = useColorScheme();
const isDarkMode = colorScheme === 'dark';
const styles = createStyles(isDarkMode);


  // Keep reference to location subscription to remove on cleanup
  const locationSubscriptionRef = useRef(null);
  // Keep unsubscribe function from Firestore query
  const ridesUnsubscribeRef = useRef(null);
  // Keep unsubscribe function for accepted rides count
  const acceptedRidesUnsubscribeRef = useRef(null);

  useEffect(() => {
    startTracking();
    subscribeToAcceptedRides();

    return () => {
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
    setLoading(false);

    // Subscribe to Firestore rides query with real-time updates
    subscribeToRides(coords);

    // Start location watcher
    locationSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10,
        timeInterval: 10000,
      },
      async (loc) => {
        const newCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setDriverLocation(newCoords);
        await updateDriverLocation(newCoords);
        // Update rides subscription based on new location
        subscribeToRides(newCoords);
      }
    );
  };

  const updateDriverLocation = async (coords) => {
    try {
      const driverId = auth.currentUser?.uid;
      if (!driverId) return;
      
      const driverRef = doc(db, 'drivers', driverId);
      
      // Check if driver document exists
      const driverDoc = await getDoc(driverRef);
      
      const driverData = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        isAvailable: true,
        lastUpdated: serverTimestamp(),
      };

      if (!driverDoc.exists()) {
        // Create new driver document with additional fields
        await setDoc(driverRef, {
          ...driverData,
          userId: driverId,
          createdAt: serverTimestamp(),
          // Add any other driver fields you need
          name: auth.currentUser?.displayName || 'Driver',
          email: auth.currentUser?.email || '',
          vehicleType: 'taxi', // Default vehicle type
          status: 'active',
        });
        console.log('Driver document created successfully');
      } else {
        // Update existing document
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

  // Subscribe or re-subscribe to rides near the current location
  const subscribeToRides = (coords) => {
    // Unsubscribe previous listener to avoid duplicates
    if (ridesUnsubscribeRef.current) {
      ridesUnsubscribeRef.current();
    }

    setLoading(true);

    const ridesQuery = query(
      collection(db, 'rides'),
      where('status', '==', 'pending')
    );

    ridesUnsubscribeRef.current = onSnapshot(
      ridesQuery,
      (snapshot) => {
        const nearbyRides = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          
          // Handle both nested object structure and direct structure
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
              id: docSnap.id,
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

        // Sort by distance (closest first)
        nearbyRides.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
        
        setRides(nearbyRides);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching rides:', error);
        setError('Failed to fetch rides');
        setLoading(false);
      }
    );
  };

  const handleAccept = async (rideId) => {
    const driverId = auth.currentUser?.uid;
    if (!driverId) {
      Alert.alert('Error', 'Driver not authenticated');
      return;
    }

    const rideRef = doc(db, 'rides', rideId);

    try {
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
          {
            text: 'Stay Here',
            style: 'cancel'
          },
          {
            text: 'Go to Trips',
            onPress: () => navigation.navigate('DriverTrips')
          }
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
      // Use a transaction to ensure atomicity in case of concurrent updates
      await runTransaction(db, async (transaction) => {
        const rideDoc = await transaction.get(rideRef);
        if (!rideDoc.exists()) {
          throw 'Ride does not exist!';
        }

        // Optional: Check current status if you only want to decline 'pending' rides
        // if (rideDoc.data().status !== 'pending') {
        //   throw 'Ride is not in a pending state to be declined.';
        // }

        transaction.update(rideRef, {
          status: 'declined',
          declinedBy: driverId, // Record which driver declined it
          declinedAt: serverTimestamp(), // Record when it was declined
        });
      });

      Alert.alert('Success', 'Ride has been declined and removed from your list.');

      // Remove from local state
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
        >
          <Marker 
            coordinate={driverLocation} 
            title="You are here" 
            pinColor="blue"
            anchor={{ x: 0.5, y: 0.5 }}
          />
          {rides.map((ride) => (
            <Marker
              key={ride.id}
              coordinate={ride.location}
              title={`${ride.rideType} - ${ride.distance}km`}
              description={ride.pickup}
              pinColor="orange"
            />
          ))}
        </MapView>
      )}

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Available Rides ({rides.length})</Text>
          
          {/* Navigation button to trips */}
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

const createStyles = (isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 10,
      backgroundColor: isDarkMode ? 'rgba(10, 10, 10, 0.85)' : '#f2f2f2',
    },
    header: {
      marginBottom: 10,
    },
    headerTitle: {
      color: isDarkMode ? '#FFA500' : '#222',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
    },
    tripsButton: {
      backgroundColor: '#4CAF50',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      alignSelf: 'center',
      shadowColor: '#4CAF50',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    tripsButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: 'bold',
    },
    card: {
      backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : '#fff',
      borderRadius: 20,
      padding: 18,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255, 165, 0, 0.3)' : '#ddd',
      shadowColor: '#FFA500',
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
      backgroundColor: '#FFA500',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    rideType: {
      color: '#000',
      fontSize: 12,
      fontWeight: 'bold',
    },
    distance: {
      color: '#4CAF50',
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
      color: '#FFB84D',
      fontSize: 14,
      fontWeight: '600',
      flexShrink: 0,
      width: '30%',
    },
    value: {
      color: isDarkMode ? '#FFFFFF' : '#222',
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
    },
    emptyText: {
      color: '#FFB84D',
      fontSize: 16,
      textAlign: 'center',
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#000' : '#fff',
    },
    loadingText: {
      color: '#FFA500',
      fontSize: 16,
      marginTop: 10,
    },
    errorText: {
      color: '#FF4D4D',
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 20,
    },
    retryButton: {
      backgroundColor: '#FFA500',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#000',
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
      backgroundColor: isDarkMode ? 'rgba(51, 51, 51, 0.8)' : '#eee',
      margin: 4,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(85, 85, 85, 0.8)' : '#ccc',
    },
    filterButtonActive: {
      backgroundColor: '#FFA500',
      borderColor: '#FFA500',
    },
    filterText: {
      color: isDarkMode ? 'white' : '#222',
      fontWeight: '500',
      fontSize: 14,
    },
    filterTextActive: {
      color: 'black',
      fontWeight: '700',
    },
  });