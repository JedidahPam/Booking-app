import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import haversine from 'haversine-distance';

const windowWidth = Dimensions.get('window').width;
const API_KEY = 'AIzaSyAZf-KMgaokOF-PVhxgXG64bxWK28_h9-0';
const RIDE_DOCUMENT_BASE_URL = `https://firestore.googleapis.com/v1/projects/local-transport-booking-app/databases/(default)/documents/rides`;

export default function DriverTrips({ navigation }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMapVisible, setExpandedMapVisible] = useState(false);
  const [expandedMapPickup, setExpandedMapPickup] = useState(null);
  const [expandedMapDropoff, setExpandedMapDropoff] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [availableRidesCount, setAvailableRidesCount] = useState(0);
  const locationSubscription = useRef(null);
  const availableRidesUnsubscribeRef = useRef(null);

  useEffect(() => {
    if (expandedMapVisible) {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location access is required.');
          setExpandedMapVisible(false);
          return;
        }
        locationSubscription.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10 },
          (location) => {
            setDriverLocation(location.coords);
          }
        );
      })();
    } else {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      setDriverLocation(null);
    }
  }, [expandedMapVisible]);

  useEffect(() => {
    subscribeToAvailableRides();
    return () => {
      if (availableRidesUnsubscribeRef.current) {
        availableRidesUnsubscribeRef.current();
      }
    };
  }, []);

  const subscribeToAvailableRides = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied for available rides count');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      const availableRidesQuery = query(
        collection(db, 'rides'),
        where('status', '==', 'pending')
      );

      availableRidesUnsubscribeRef.current = onSnapshot(
        availableRidesQuery,
        (snapshot) => {
          let nearbyCount = 0;
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();

            let pickupLocation = data.pickupLocation;
            if (data.pickup && data.pickup.latitude) {
              pickupLocation = data.pickup;
            }

            if (pickupLocation && pickupLocation.latitude) {
              const rideCoords = {
                latitude: pickupLocation.latitude,
                longitude: pickupLocation.longitude,
              };
              const distanceKm = haversine(coords, rideCoords) / 1000;

              if (distanceKm <= 30) {
                nearbyCount++;
              }
            }
          });

          setAvailableRidesCount(nearbyCount);
        },
        (error) => {
          console.error('Error fetching available rides count:', error);
        }
      );
    } catch (error) {
      console.error('Error setting up available rides subscription:', error);
    }
  };

  const openExpandedMap = (pickupLoc, dropoffLoc) => {
    if (!pickupLoc || !dropoffLoc) return;
    setExpandedMapPickup(pickupLoc);
    setExpandedMapDropoff(dropoffLoc);
    setExpandedMapVisible(true);
  };

  const getExpandedMapRegion = () => {
    if (!expandedMapPickup || !expandedMapDropoff) return null;

    let latitudes = [expandedMapPickup.latitude, expandedMapDropoff.latitude];
    let longitudes = [expandedMapPickup.longitude, expandedMapDropoff.longitude];

    if (driverLocation) {
      latitudes.push(driverLocation.latitude);
      longitudes.push(driverLocation.longitude);
    }

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);

    const midLat = (minLat + maxLat) / 2;
    const midLon = (minLon + maxLon) / 2;

    const latDelta = (maxLat - minLat) * 1.5 || 0.05;
    const lonDelta = (maxLon - minLon) * 1.5 || 0.05;

    return {
      latitude: midLat,
      longitude: midLon,
      latitudeDelta: latDelta,
      longitudeDelta: lonDelta,
    };
  };

  useEffect(() => {
    const driverId = auth.currentUser?.uid;
    if (!driverId) {
      Alert.alert('Error', 'Driver not authenticated');
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'rides'),
      where('status', 'in', ['accepted', 'in_progress']),
      where('acceptedBy', '==', driverId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTrips(data);
        setLoading(false);
      },
      (error) => {
        console.error('Realtime update error:', error);
        Alert.alert('Error', 'Failed to listen for ride updates');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required.');
        return null;
      }
      const location = await Location.getCurrentPositionAsync({});
      return location.coords;
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get location');
      return null;
    }
  };

  const updateRide = async (rideId, updateFields, updateMaskFields) => {
    const updateUrl = `${RIDE_DOCUMENT_BASE_URL}/${rideId}?${updateMaskFields
      .map(f => `updateMask.fieldPaths=${f}`)
      .join('&')}&key=${API_KEY}`;

    const payload = { fields: updateFields };

    try {
      const response = await fetch(updateUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      Alert.alert('Success', 'Ride updated successfully.');
    } catch (error) {
      console.error('Update ride error:', error);
      Alert.alert('Error', 'Failed to update ride');
    }
  };

  const handleStartTrip = async (rideId) => {
    const coords = await getCurrentLocation();
    if (!coords) return;

    const updateFields = {
      status: { stringValue: 'in_progress' },
      startTime: { timestampValue: new Date().toISOString() },
      driverLocation: {
        mapValue: {
          fields: {
            latitude: { doubleValue: coords.latitude },
            longitude: { doubleValue: coords.longitude },
          },
        },
      },
    };

    await updateRide(rideId, updateFields, ['status', 'startTime', 'driverLocation']);
  };

  const handleCompleteTrip = async (rideId) => {
    const coords = await getCurrentLocation();
    if (!coords) return;

    const updateFields = {
      status: { stringValue: 'completed' },
      endTime: { timestampValue: new Date().toISOString() },
      driverLocation: {
        mapValue: {
          fields: {
            latitude: { doubleValue: coords.latitude },
            longitude: { doubleValue: coords.longitude },
          },
        },
      },
    };

    await updateRide(rideId, updateFields, ['status', 'endTime', 'driverLocation']);
  };

  const getPickupLocation = (trip) => {
    return trip.pickupLocation || trip.pickup || null;
  };

  const getDropoffLocation = (trip) => {
    return trip.dropoffLocation || trip.dropoff || null;
  };

  const formatAddress = (address) => {
    if (!address) return 'Address not available';
    if (typeof address === 'string') return address;
    return address.address || address.name || 'Address not available';
  };

  const calculateDistance = (pickup, dropoff) => {
    if (!pickup || !dropoff) return 'N/A';
    const distance = haversine(pickup, dropoff) / 1000;
    return `${distance.toFixed(1)} km`;
  };

  const renderTripItem = ({ item: trip }) => {
    const pickupLoc = getPickupLocation(trip);
    const dropoffLoc = getDropoffLocation(trip);

    return (
      <View style={styles.tripItem}>
        <View style={styles.tripHeader}>
          <Text style={styles.tripId}>Trip #{trip.id.slice(-6)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: trip.status === 'accepted' ? '#ff9500' : '#007AFF' }]}>
            <Text style={styles.statusText}>{trip.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.locationInfo}>
          <View style={styles.locationRow}>
            <View style={styles.locationIcon}>
              <Text style={styles.iconText}>📍</Text>
            </View>
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationAddress}>{formatAddress(trip.pickupAddress)}</Text>
            </View>
          </View>

          <View style={styles.locationRow}>
            <View style={styles.locationIcon}>
              <Text style={styles.iconText}>🏁</Text>
            </View>
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>Dropoff</Text>
              <Text style={styles.locationAddress}>{formatAddress(trip.dropoffAddress)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tripDetails}>
          <Text style={styles.detailText}>Distance: {calculateDistance(pickupLoc, dropoffLoc)}</Text>
          <Text style={styles.detailText}>Fare: ${trip.fare || 'N/A'}</Text>
          <Text style={styles.detailText}>Passenger: {trip.passengerName || 'N/A'}</Text>
        </View>

        <View style={styles.actionButtons}>
          {trip.status === 'accepted' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={() => handleStartTrip(trip.id)}
            >
              <Text style={styles.buttonText}>Start Trip</Text>
            </TouchableOpacity>
          )}
          {trip.status === 'in_progress' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => handleCompleteTrip(trip.id)}
            >
              <Text style={styles.buttonText}>Complete Trip</Text>
            </TouchableOpacity>
          )}
          {(pickupLoc && dropoffLoc) && (
            <TouchableOpacity
              style={[styles.actionButton, styles.mapButton]}
              onPress={() => openExpandedMap(pickupLoc, dropoffLoc)}
            >
              <Text style={styles.buttonText}>View Map</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => navigation.navigate('Chat', {
            rideId: trip.id,
            userId: trip.userId,
            driverId: auth.currentUser.uid,
          })}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#007bff" />
          <Text style={styles.chatButtonText}>Chat with Passenger</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading your trips...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Trips</Text>
        <TouchableOpacity
          style={styles.availableRidesButton}
          onPress={() => navigation.navigate('AvailableRides')}
        >
          <Text style={styles.availableRidesText}>Available Rides ({availableRidesCount})</Text>
        </TouchableOpacity>
      </View>

      {trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No active trips</Text>
          <Text style={styles.emptySubtext}>Check available rides to accept new trips</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTripItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Expanded Map Modal */}
      <Modal
        visible={expandedMapVisible}
        animationType="slide"
        onRequestClose={() => setExpandedMapVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Trip Route</Text>
            <Pressable style={styles.closeButton} onPress={() => setExpandedMapVisible(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          {expandedMapPickup && expandedMapDropoff && (
            <MapView
              style={styles.expandedMap}
              region={getExpandedMapRegion()}
              showsUserLocation={true}
              showsMyLocationButton={true}
            >
              <Marker coordinate={expandedMapPickup} title="Pickup Location" pinColor="green" />
              <Marker coordinate={expandedMapDropoff} title="Dropoff Location" pinColor="red" />
              {driverLocation && (
                <Marker coordinate={driverLocation} title="Your Location" pinColor="blue" />
              )}
              <Polyline coordinates={[expandedMapPickup, expandedMapDropoff]} strokeColor="#007AFF" strokeWidth={3} />
            </MapView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  availableRidesButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  availableRidesText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  tripItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  locationInfo: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  locationIcon: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 16,
  },
  locationDetails: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  startButton: {
    backgroundColor: '#34C759',
  },
  completeButton: {
    backgroundColor: '#FF3B30',
  },
  mapButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#007AFF',
  },
  expandedMap: {
    flex: 1,
  },
  chatButton: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 4,
  paddingHorizontal: 8,
  borderRadius: 6,
  borderWidth: 1,
  borderColor: '#007bff',
  marginTop: 8,
},
chatButtonText: {
  marginLeft: 6,
  fontSize: 14,
  color: '#007bff',
  fontWeight: '600',
},

});