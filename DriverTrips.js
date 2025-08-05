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
import polyline from '@mapbox/polyline';

const windowWidth = Dimensions.get('window').width;
const OPENROUTE_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjllZjJjN2YyMTI1NTQ1YWI5NzJhZmYxMjBmNjhkMTg5IiwiaCI6Im11cm11cjY0In0=';
const RIDE_DOCUMENT_BASE_URL = `https://firestore.googleapis.com/v1/projects/local-transport-booking-app/databases/(default)/documents/rides`;

export default function DriverTrips({ navigation }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMapVisible, setExpandedMapVisible] = useState(false);
  const [expandedMapPickup, setExpandedMapPickup] = useState(null);
  const [expandedMapDropoff, setExpandedMapDropoff] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [availableRidesCount, setAvailableRidesCount] = useState(0);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const locationSubscription = useRef(null);
  const availableRidesUnsubscribeRef = useRef(null);
  const mapRef = useRef(null);

  // Fetch directions from OpenRouteService API
// Replace the existing fetchDirections function with this:
const fetchDirections = async (startLoc, endLoc) => {
  try {
    const url = 'https://api.openrouteservice.org/v2/directions/driving-car';
    const body = { 
      coordinates: [
        [startLoc.longitude, startLoc.latitude],
        [endLoc.longitude, endLoc.latitude]
      ] 
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: OPENROUTE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    
    if (!data.routes?.length) {
      console.error('No route found in response:', data);
      return [];
    }

    const geometry = data.routes[0].geometry;
    const decoded = polyline.decode(geometry).map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));
    
    setRouteCoordinates(decoded);
    return decoded;
  } catch (error) {
    console.error('Error fetching directions:', error);
    Alert.alert('Error', 'Failed to fetch route directions');
    return [];
  }
};
  useEffect(() => {
    if (expandedMapVisible) {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location access is required.');
          setExpandedMapVisible(false);
          return;
        }
        
        const initialLocation = await Location.getCurrentPositionAsync({});
        setDriverLocation(initialLocation.coords);
        
        locationSubscription.current = await Location.watchPositionAsync(
          { 
            accuracy: Location.Accuracy.High, 
            distanceInterval: 10,
            timeInterval: 5000 
          },
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
      setRouteCoordinates([]);
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

            let pickupLocation = null;
            if (data.pickup && data.pickup.latitude && data.pickup.longitude) {
              pickupLocation = {
                latitude: data.pickup.latitude,
                longitude: data.pickup.longitude,
              };
            }

            if (pickupLocation) {
              const distanceKm = haversine(coords, pickupLocation) / 1000;
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

  const openExpandedMap = async (pickupLoc, dropoffLoc) => {
    if (!pickupLoc || !dropoffLoc) return;
    
    setExpandedMapPickup(pickupLoc);
    setExpandedMapDropoff(dropoffLoc);
    await fetchDirections(pickupLoc, dropoffLoc);
    setExpandedMapVisible(true);
  };

  const getExpandedMapRegion = () => {
    if (!expandedMapPickup || !expandedMapDropoff) return null;

    let coordinates = [expandedMapPickup, expandedMapDropoff];
    if (driverLocation) coordinates.push(driverLocation);
    if (routeCoordinates.length > 0) coordinates = [...coordinates, ...routeCoordinates];

    const latitudes = coordinates.map(c => c.latitude);
    const longitudes = coordinates.map(c => c.longitude);

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
      where('status', 'in', ['accepted', 'in_progress', 'cancelled_by_driver']),
      where('acceptedBy', '==', driverId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const docData = doc.data();
          return {
            id: doc.id,
            ...docData,
            startTime: docData.startTime?.toDate ? docData.startTime.toDate() : docData.startTime,
            endTime: docData.endTime?.toDate ? docData.endTime.toDate() : docData.endTime,
            createdAt: docData.createdAt?.toDate ? docData.createdAt.toDate() : docData.createdAt,
          };
        });
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
      .join('&')}`;

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

    const trip = trips.find(t => t.id === rideId);
    const dropoff = getDropoffLocation(trip);

    if (!dropoff) {
      Alert.alert('Error', 'Dropoff location not available.');
      return;
    }

    const distanceToDropoff = haversine(coords, dropoff);

    if (distanceToDropoff > 100) {
      Alert.alert(
        'Too Far From Dropoff',
        `You must be within 50 meters of the dropoff location to complete the trip. You're currently ${Math.round(distanceToDropoff)} meters away.`
      );
      
      return;
    }

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

  const handleCancelTrip = async (rideId) => {
    Alert.alert(
      'Confirm Cancellation',
      'Are you sure you want to cancel this trip?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: async () => {
            const coords = await getCurrentLocation();
            if (!coords) return;

            const updateFields = {
              status: { stringValue: 'cancelled_by_driver' },
              cancelledAt: { timestampValue: new Date().toISOString() },
              driverLocation: {
                mapValue: {
                  fields: {
                    latitude: { doubleValue: coords.latitude },
                    longitude: { doubleValue: coords.longitude },
                  },
                },
              },
            };

            await updateRide(rideId, updateFields, ['status', 'cancelledAt', 'driverLocation']);
          },
        },
      ],
      { cancelable: false }
    );
  };

  const getPickupLocation = (trip) => {
    if (trip.pickup && trip.pickup.latitude && trip.pickup.longitude) {
      return {
        latitude: trip.pickup.latitude,
        longitude: trip.pickup.longitude,
      };
    }
    return null;
  };

  const getDropoffLocation = (trip) => {
    if (trip.dropoff && trip.dropoff.latitude && trip.dropoff.longitude) {
      return {
        latitude: trip.dropoff.latitude,
        longitude: trip.dropoff.longitude,
      };
    }
    return null;
  };

  const getPickupAddress = (trip) => {
    if (trip.pickup && trip.pickup.address) {
      return trip.pickup.address;
    }
    return 'Pickup address not available';
  };

  const getDropoffAddress = (trip) => {
    if (trip.dropoff && trip.dropoff.address) {
      return trip.dropoff.address;
    }
    return 'Dropoff address not available';
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

  const getFare = (trip) => {
    const price = parseFloat(trip.price);
    return !isNaN(price) ? `$${price.toFixed(2)}` : 'N/A';
  };

  const renderTripItem = ({ item: trip }) => {
    const pickupLoc = getPickupLocation(trip);
    const dropoffLoc = getDropoffLocation(trip);
    const pickupAddress = getPickupAddress(trip);
    const dropoffAddress = getDropoffAddress(trip);

    return (
      <View style={styles.tripItem}>
        <View style={styles.tripHeader}>
          <Text style={styles.tripId}>Trip #{trip.id.slice(-6)}</Text>
          <View style={[styles.statusBadge, { 
            backgroundColor: 
              trip.status === 'accepted' ? '#ff9500' : 
              trip.status === 'in_progress' ? '#007AFF' :
              trip.status === 'cancelled_by_driver' ? '#FF3B30' : '#8E8E93'
          }]}>
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
              <Text style={styles.locationAddress}>{pickupAddress}</Text>
            </View>
          </View>

          <View style={styles.locationRow}>
            <View style={styles.locationIcon}>
              <Text style={styles.iconText}>🏁</Text>
            </View>
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>Dropoff</Text>
              <Text style={styles.locationAddress}>{dropoffAddress}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tripDetails}>
          <Text style={styles.detailText}>Distance: {calculateDistance(pickupLoc, dropoffLoc)}</Text>
          <Text style={styles.detailText}>Fare: {getFare(trip)}</Text>
          <Text style={styles.detailText}>Payment: {trip.paymentMethod || 'N/A'}</Text>
        </View>

        {trip.startTime && (
          <View style={styles.timeInfo}>
            <Text style={styles.timeText}>
              Started: {trip.startTime instanceof Date ? trip.startTime.toLocaleString() : new Date(trip.startTime).toLocaleString()}
            </Text>
          </View>
        )}

        {trip.cancelledAt && (
          <View style={styles.timeInfo}>
            <Text style={styles.timeText}>
              Cancelled: {trip.cancelledAt instanceof Date ? trip.cancelledAt.toLocaleString() : new Date(trip.cancelledAt).toLocaleString()}
            </Text>
          </View>
        )}

        {trip.endTime && (
          <View style={styles.timeInfo}>
            <Text style={styles.timeText}>
              Completed: {trip.endTime instanceof Date ? trip.endTime.toLocaleString() : new Date(trip.endTime).toLocaleString()}
            </Text>
          </View>
        )}

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
          {(trip.status === 'accepted' || trip.status === 'in_progress') && (
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleCancelTrip(trip.id)}
            >
              <Text style={styles.buttonText}>Cancel Trip</Text>
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
          onPress={() => navigation.navigate('DriverMain', { screen: 'DriverHome' })}
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

      <Modal
        visible={expandedMapVisible}
        animationType="slide"
        onRequestClose={() => setExpandedMapVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Trip Route</Text>
            <View style={styles.modalHeaderButtons}>
              <Pressable 
                style={styles.recenterButton}
                onPress={() => {
                  if (driverLocation) {
                    mapRef.current?.animateToRegion({
                      latitude: driverLocation.latitude,
                      longitude: driverLocation.longitude,
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02,
                    });
                  }
                }}
              >
                <Ionicons name="locate" size={20} color="#007AFF" />
              </Pressable>
              <Pressable style={styles.closeButton} onPress={() => setExpandedMapVisible(false)}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>
          </View>

     {expandedMapPickup && expandedMapDropoff && (
  <MapView
    ref={mapRef}
    style={styles.expandedMap}
    initialRegion={getExpandedMapRegion()}
    showsUserLocation={true}
    showsMyLocationButton={false}
    followsUserLocation={true}
    onMapReady={() => {
      if (routeCoordinates.length > 0) {
        mapRef.current.fitToCoordinates(routeCoordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }}
  >
    <Marker coordinate={expandedMapPickup} title="Pickup Location" pinColor="green" />
    <Marker coordinate={expandedMapDropoff} title="Dropoff Location" pinColor="red" />
    {driverLocation && (
      <Marker coordinate={driverLocation} title="Your Location" pinColor="blue" />
    )}
    {routeCoordinates.length > 0 && (
      <Polyline
  coordinates={routeCoordinates}
  strokeColor="#00aaff"  // Changed to match TravelDetailsScreen
  strokeWidth={4}
  lineDashPattern={[1]}  // Optional: makes line dashed
/>
    )}
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
  timeInfo: {
    marginBottom: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    marginVertical: 4,
  },
  startButton: {
    backgroundColor: '#34C759',
  },
  completeButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#FF9500',
  },
  mapButton: {
    backgroundColor: '#8E8E93',
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
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
    marginLeft: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#007AFF',
  },
  recenterButton: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  expandedMap: {
    flex: 1,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
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