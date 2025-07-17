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
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import haversine from 'haversine-distance';


const windowWidth = Dimensions.get('window').width;
const API_KEY = 'AIzaSyAZf-KMgaokOF-PVhxgXG64bxWK28_h9-0';
const RIDE_DOCUMENT_BASE_URL = `https://firestore.googleapis.com/v1/projects/local-transport-booking-app/databases/(default)/documents/rides`;

export default function DriverTrips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMapVisible, setExpandedMapVisible] = useState(false);
  const [expandedMapPickup, setExpandedMapPickup] = useState(null);
  const [expandedMapDropoff, setExpandedMapDropoff] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const locationSubscription = useRef(null);

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
      // Stop tracking when modal closes
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      setDriverLocation(null);
    }
  }, [expandedMapVisible]);

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
      console.error(error);
      Alert.alert('Error', 'Failed to update ride');
    }
  };

  const handleStartRide = async (ride) => {
    const coords = await getCurrentLocation();
    if (!coords) return;

    const startLocation = {
      mapValue: {
        fields: {
          latitude: { doubleValue: coords.latitude },
          longitude: { doubleValue: coords.longitude },
        },
      },
    };

    const updateFields = {
      status: { stringValue: 'in_progress' },
      startLocation,
      startTime: { timestampValue: new Date().toISOString() },
    };

    updateRide(ride.id, updateFields, ['status', 'startLocation', 'startTime']);
  };

  const handleCompleteRide = async (ride) => {
    const coords = await getCurrentLocation();
    if (!coords) return;

    const finalFare = 16.75;
    const distance = 5.2;

    const endLocation = {
      mapValue: {
        fields: {
          latitude: { doubleValue: coords.latitude },
          longitude: { doubleValue: coords.longitude },
        },
      },
    };

    const updateFields = {
      status: { stringValue: 'completed' },
      endLocation,
      endTime: { timestampValue: new Date().toISOString() },
      finalFare: { doubleValue: finalFare },
      distance: { doubleValue: distance },
    };

    updateRide(ride.id, updateFields, ['status', 'endLocation', 'endTime', 'finalFare', 'distance']);
  };

  const handleCancelRide = (ride) => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'No' },
        {
          text: 'Yes',
          onPress: () => {
            updateRide(ride.id, { status: { stringValue: 'cancelled' } }, ['status']);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const parseTimestamp = (value) => {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (typeof value === 'string') return new Date(value);
    if (value.timestampValue) return new Date(value.timestampValue);
    return null;
  };

  const extractCoordinates = (loc) => {
    if (!loc) return null;
    if (loc.latitude && loc.longitude) {
      return { latitude: loc.latitude, longitude: loc.longitude };
    }
    if (loc.mapValue?.fields) {
      return {
        latitude: Number(loc.mapValue.fields.latitude.doubleValue),
        longitude: Number(loc.mapValue.fields.longitude.doubleValue),
      };
    }
    return null;
  };

  const renderMapPreview = (pickupLoc, dropoffLoc) => {
    if (!pickupLoc || !dropoffLoc) return null;

    const midLat = (pickupLoc.latitude + dropoffLoc.latitude) / 2;
    const midLon = (pickupLoc.longitude + dropoffLoc.longitude) / 2;
    const latDelta = Math.abs(pickupLoc.latitude - dropoffLoc.latitude) * 2.5 || 0.02;
    const lonDelta = Math.abs(pickupLoc.longitude - dropoffLoc.longitude) * 2.5 || 0.02;

    return (
      <MapView
        style={styles.mapPreview}
        region={{
          latitude: midLat,
          longitude: midLon,
          latitudeDelta: latDelta,
          longitudeDelta: lonDelta,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        pointerEvents="none"
      >
        <Marker coordinate={pickupLoc} title="Pickup" pinColor="green" />
        <Marker coordinate={dropoffLoc} title="Dropoff" pinColor="red" />
      </MapView>
    );
  };

  const renderTrip = ({ item }) => {
    const scheduledDate = parseTimestamp(item.scheduledTime);

    const pickupLoc = extractCoordinates(item.pickupLocation);
    const dropoffLoc = extractCoordinates(item.dropoffLocation);

    return (
      <View style={styles.card}>
        <Text style={styles.label}>Pickup:</Text>
        <Text style={styles.value}>
          {item.pickupLocation?.address ||
            item.pickupLocation?.mapValue?.fields?.address?.stringValue ||
            'N/A'}
        </Text>

        <Text style={styles.label}>Drop-off:</Text>
        <Text style={styles.value}>
          {item.dropoffLocation?.address ||
            item.dropoffLocation?.mapValue?.fields?.address?.stringValue ||
            'N/A'}
        </Text>

        <Text style={styles.label}>Ride Type:</Text>
        <Text style={styles.value}>{item.rideType?.stringValue || 'N/A'}</Text>

        <Text style={styles.label}>Scheduled Time:</Text>
        <Text style={styles.value}>
          {scheduledDate ? scheduledDate.toLocaleString() : 'N/A'}
        </Text>

        <Text style={styles.label}>Status:</Text>
        <Text style={styles.value}>{item.status}</Text>

        <TouchableOpacity
          onPress={() => openExpandedMap(pickupLoc, dropoffLoc)}
          activeOpacity={0.8}
        >
          {renderMapPreview(pickupLoc, dropoffLoc)}
        </TouchableOpacity>

        {item.status === 'accepted' && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => handleCancelRide(item)}
            >
              <Text style={styles.btnText}>Cancel Ride</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => handleStartRide(item)}
            >
              <Text style={styles.btnText}>Start Ride</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'in_progress' && (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={() => handleCompleteRide(item)}
          >
            <Text style={styles.btnText}>Complete Ride</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <>
      <SafeAreaView style={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#FFA500" />
        ) : (
          <FlatList
            data={trips}
            keyExtractor={(item) => item.id}
            renderItem={renderTrip}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No trips yet.</Text>
            }
            contentContainerStyle={trips.length === 0 && { flex: 1, justifyContent: 'center' }}
          />
        )}
      </SafeAreaView>

      <Modal
        visible={expandedMapVisible}
        animationType="slide"
        onRequestClose={() => setExpandedMapVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <MapView
            style={{ flex: 1 }}
            region={getExpandedMapRegion()}
            showsUserLocation={true}
            followsUserLocation={true}
            loadingEnabled={true}
          >
            {expandedMapPickup && (
              <Marker
                coordinate={expandedMapPickup}
                title="Pickup"
                pinColor="green"
              />
            )}
            {expandedMapDropoff && (
              <Marker
                coordinate={expandedMapDropoff}
                title="Dropoff"
                pinColor="red"
              />
            )}
            {driverLocation && (
              <Marker
                coordinate={driverLocation}
                title="You"
                pinColor="blue"
              />
            )}
          </MapView>

          <Pressable
            onPress={() => setExpandedMapVisible(false)}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>Close Map</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#1a1a1a',
  },
  card: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  label: {
    color: '#FFB84D',
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '600',
  },
  value: {
    color: '#FFA500',
    fontSize: 16,
    marginBottom: 10,
  },
  acceptBtn: {
    backgroundColor: '#FFA500',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#FFA500',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 6,
    flex: 1,
    marginLeft: 10,
  },
  completeBtn: {
    backgroundColor: '#cc8400',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#cc8400',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 6,
  },
  cancelBtn: {
    backgroundColor: '#FF4D4D',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#FF4D4D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 6,
    flex: 1,
    marginRight: 10,
  },
  btnText: {
    color: '#1a1a1a',
    fontWeight: '700',
    fontSize: 16,
  },
  emptyText: {
    color: '#FFB84D',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
  mapPreview: {
    width: windowWidth - 60,
    height: 120,
    borderRadius: 12,
    marginVertical: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  closeButton: {
    backgroundColor: '#FFA500',
    padding: 15,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#1a1a1a',
    fontWeight: '700',
    fontSize: 18,
  },
});
