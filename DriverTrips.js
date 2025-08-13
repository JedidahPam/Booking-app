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
import { useTheme } from './ThemeContext';

const windowWidth = Dimensions.get('window').width;
const OPENROUTE_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjllZjJjN2YyMTI1NTQ1YWI5NzJhZmYxMjBmNjhkMTg5IiwiaCI6Im11cm11cjY0In0=';
const RIDE_DOCUMENT_BASE_URL = `https://firestore.googleapis.com/v1/projects/local-transport-booking-app/databases/(default)/documents/rides`;

export default function DriverTrips({ navigation }) {
  const { darkMode, toggleDarkMode } = useTheme();
  const styles = createStyles(darkMode);
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

  const parseFirebaseTimestamp = (timestamp) => {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp.timestampValue) return new Date(timestamp.timestampValue);
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp === 'string') return new Date(timestamp);
    return null;
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
            if (data.pickup?.latitude && data.pickup?.longitude) {
              pickupLocation = {
                latitude: data.pickup.latitude,
                longitude: data.pickup.longitude,
              };
            }

            if (pickupLocation) {
              const distanceKm = haversine(coords, pickupLocation) / 1000;
              if (distanceKm <= 30) nearbyCount++;
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

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: (maxLat - minLat) * 1.5 || 0.05,
      longitudeDelta: (maxLon - minLon) * 1.5 || 0.05,
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
            createdAt: parseFirebaseTimestamp(docData.createdAt),
            acceptedAt: parseFirebaseTimestamp(docData.acceptedAt),
            startTime: parseFirebaseTimestamp(docData.startTime),
            endTime: parseFirebaseTimestamp(docData.endTime),
            cancelledAt: parseFirebaseTimestamp(docData.cancelledAt),
          };
        });
        
        data.sort((a, b) => {
          const aTime = a.createdAt?.getTime() || 0;
          const bTime = b.createdAt?.getTime() || 0;
          return bTime - aTime;
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
    const dropoff = trip.dropoff?.latitude && trip.dropoff?.longitude ? {
      latitude: trip.dropoff.latitude,
      longitude: trip.dropoff.longitude,
    } : null;

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
        { text: 'No', style: 'cancel' },
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

  const renderTripItem = ({ item: trip }) => {
    const pickupLoc = trip.pickup?.latitude && trip.pickup?.longitude ? {
      latitude: trip.pickup.latitude,
      longitude: trip.pickup.longitude,
    } : null;

    const dropoffLoc = trip.dropoff?.latitude && trip.dropoff?.longitude ? {
      latitude: trip.dropoff.latitude,
      longitude: trip.dropoff.longitude,
    } : null;

    const pickupAddress = trip.pickup?.address || 'Pickup address not available';
    const dropoffAddress = trip.dropoff?.address || 'Dropoff address not available';

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
          <Text style={styles.detailText}>
            Distance: {pickupLoc && dropoffLoc ? `${(haversine(pickupLoc, dropoffLoc) / 1000).toFixed(1)} km` : 'N/A'}
          </Text>
          <Text style={styles.detailText}>
            Fare: {trip.price ? `$${parseFloat(trip.price).toFixed(2)}` : 'N/A'}
          </Text>
          <Text style={styles.detailText}>
            Payment: {trip.paymentMethod || 'N/A'}
          </Text>
        </View>

        {trip.startTime && (
          <View style={styles.timeInfo}>
            <Text style={styles.timeText}>
              Started: {trip.startTime.toLocaleString()}
            </Text>
          </View>
        )}

        {trip.cancelledAt && (
          <View style={styles.timeInfo}>
            <Text style={styles.timeText}>
              Cancelled: {trip.cancelledAt.toLocaleString()}
            </Text>
          </View>
        )}

        {trip.endTime && (
          <View style={styles.timeInfo}>
            <Text style={styles.timeText}>
              Completed: {trip.endTime.toLocaleString()}
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
          <Ionicons 
            name="chatbubble-ellipses-outline" 
            size={20} 
            color="#FFA500" // Changed to orange
          />
          <Text style={styles.chatButtonText}>Chat with Passenger</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color= '#FFA500'  />
          <Text style={styles.loadingText}>Loading your trips...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Your Trips</Text>
        </View>
        <TouchableOpacity
          style={styles.availableRidesButton}
          onPress={() => navigation.navigate('DriverMain', { screen: 'DriverHome' })}
        >
          <Ionicons 
            name="car-sport" 
            size={16} 
            color="#fff" 
            style={styles.rideIcon}
          />
          <Text style={styles.availableRidesText}>
            Available ({availableRidesCount})
          </Text>
        </TouchableOpacity>
      </View>

      {trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons 
            name="time-outline" 
            size={48} 
            color={darkMode ? '#555' : '#ccc'} 
          />
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
          ListHeaderComponent={
            <Text style={styles.tripsHeader}>
              {trips.length} {trips.length === 1 ? 'Trip' : 'Trips'}
            </Text>
          }
        />
      )}

      <Modal
        visible={expandedMapVisible}
        animationType="slide"
        onRequestClose={() => setExpandedMapVisible(false)}
        statusBarTranslucent={true}
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
                <Ionicons 
                  name="locate" 
                  size={20} 
                  color="#FFA500" // Changed to orange
                />
              </Pressable>
              <Pressable 
                style={styles.closeButton} 
                onPress={() => setExpandedMapVisible(false)}
              >
               <Ionicons 
                  name="close" 
                  size={24} 
                  color="#FFA500" // Changed to orange
                />
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
              userInterfaceStyle={darkMode ? 'dark' : 'light'}
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
                  strokeColor={darkMode ? '#FFA500' : '#00aaff'}
                  strokeWidth={4}
                  lineDashPattern={[1]}
                />
              )}
            </MapView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (darkMode) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: darkMode ? '#121212' : '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: darkMode ? '#121212' : '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: darkMode ? '#121212' : '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: darkMode ? '#aaa' : '#666',
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
 chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FFA500", // Changed to orange
    marginTop: 8,
  },  availableRidesButton: {
    backgroundColor: "#FFA500", // Changed to orange
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#FFA500", // Optional: add shadow for depth
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  rideIcon: {
    marginRight: 6,
  },
  availableRidesText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: darkMode ? '#121212' : '#f5f5f5',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: darkMode ? '#aaa' : '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: darkMode ? '#888' : '#999',
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
    backgroundColor: darkMode ? '#121212' : '#f5f5f5',
  },
  tripsHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: darkMode ? '#aaa' : '#666',
    marginBottom: 8,
    marginLeft: 4,
  },
  tripItem: {
    backgroundColor: darkMode ? '#1e1e1e' : '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: darkMode ? 0.3 : 0.1,
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
    color: darkMode ? '#fff' : '#333',
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
    color: darkMode ? '#aaa' : '#666',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: darkMode ? '#fff' : '#333',
    lineHeight: 18,
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 12,
    color: darkMode ? '#aaa' : '#666',
    flex: 1,
  },
  timeInfo: {
    marginBottom: 8,
  },
  timeText: {
    fontSize: 12,
    color: darkMode ? '#aaa' : '#666',
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
    backgroundColor: darkMode ? '#121212' : '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: darkMode ? '#1e1e1e' : '#fff',
    borderBottomWidth: 1,
    borderBottomColor: darkMode ? '#333' : '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: darkMode ? '#fff' : '#333',
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recenterButton: {
    backgroundColor: darkMode ? '#333' : '#f0f0f0',
    padding: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  closeButton: {
    padding: 8,
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
    borderColor: "#FFA500", // Changed to orange
    marginTop: 8,
  },
  chatButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: "#FFA500", // Changed to orange
    fontWeight: '600',
  },
});