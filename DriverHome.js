import React, { useEffect, useState } from 'react';
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
import { doc, setDoc, updateDoc, serverTimestamp, onSnapshot, collection } from 'firebase/firestore';

const API_KEY = 'AIzaSyAZf-KMgaokOF-PVhxgXG64bxWK28_h9-0';
const RUN_QUERY_URL = `https://firestore.googleapis.com/v1/projects/local-transport-booking-app/databases/(default)/documents:runQuery?key=${API_KEY}`;
const RIDE_DOCUMENT_BASE_URL = `https://firestore.googleapis.com/v1/projects/local-transport-booking-app/databases/(default)/documents/rides`;

export default function DriverHome() {
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState([]);
  const [error, setError] = useState(null);
  const [expandedRideId, setExpandedRideId] = useState(null);
  const [lastSeenRideIds, setLastSeenRideIds] = useState([]);
  const [selectedRideType, setSelectedRideType] = useState('All');

  useEffect(() => {
    let locationSubscription = null;
    let ridesUnsubscribe = null;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required.');
        setError('Location permission denied');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      await updateDriverLocation(location.coords);
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setDriverLocation(coords);
      setLoading(false);
      fetchAvailableRides(coords);

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 10000,
        },
        async (loc) => {
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setDriverLocation(coords);
          await updateDriverLocation(coords);
          fetchAvailableRides(coords);
        }
      );

      // Firestore listener for new rides
      ridesUnsubscribe = onSnapshot(collection(db, 'rides'), (snapshot) => {
        const newRideIds = [];

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            const location = {
              latitude: data.pickupLocation?.latitude,
              longitude: data.pickupLocation?.longitude,
            };
            const id = change.doc.id;

            const isNearby =
              location &&
              coords &&
              haversine(location, coords) / 1000 <= 30;

            if (
              data.status === 'pending' &&
              isNearby &&
              !lastSeenRideIds.includes(id)
            ) {
              newRideIds.push(id);
            }
          }
        });

        if (newRideIds.length) {
          setLastSeenRideIds((prev) => [...prev, ...newRideIds]);
          // You could add vibration or sound notification here for new rides
          Vibration.vibrate(1000);
        }
      });
    };

    startTracking();

    return () => {
      if (locationSubscription) locationSubscription.remove();
      if (ridesUnsubscribe) ridesUnsubscribe();
      markDriverUnavailable();
    };
  }, []);

  const updateDriverLocation = async (coords) => {
    try {
      const driverId = auth.currentUser?.uid;
      if (!driverId) return;
      const driverRef = doc(db, 'drivers', driverId);
      await setDoc(
        driverRef,
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          isAvailable: true,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Failed to update driver location:', err);
    }
  };

  const markDriverUnavailable = async () => {
    try {
      const driverId = auth.currentUser?.uid;
      if (!driverId) return;
      const driverRef = doc(db, 'drivers', driverId);
      await updateDoc(driverRef, { isAvailable: false });
    } catch (err) {
      console.error('Failed to mark driver unavailable:', err);
    }
  };

  const fetchAvailableRides = async (coords) => {
    setLoading(true);

    const queryPayload = {
      structuredQuery: {
        from: [{ collectionId: 'rides' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'status' },
            op: 'EQUAL',
            value: { stringValue: 'pending' },
          },
        },
        limit: 50,
      },
    };

    try {
      const response = await fetch(RUN_QUERY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryPayload),
      });
      const data = await response.json();

      const ridesList = data
        .map((item) => {
          if (!item.document) return null;
          const doc = item.document;
          const fields = doc.fields || {};
          const pickupFields = fields.pickupLocation?.mapValue?.fields;
          return {
            id: doc.name.split('/').pop(),
            pickup: pickupFields?.address?.stringValue || 'N/A',
            dropoff: fields.dropoffLocation?.mapValue?.fields?.address?.stringValue || 'N/A',
            rideType: fields.rideType?.stringValue || '',
            passengerCount: fields.passengerCount?.integerValue || '1',
            scheduledTime: fields.scheduledTime?.timestampValue || '',
            specialRequests: fields.specialRequests?.stringValue || '',
            location: {
              latitude: parseFloat(pickupFields?.latitude?.doubleValue || pickupFields?.latitude?.integerValue),
              longitude: parseFloat(pickupFields?.longitude?.doubleValue || pickupFields?.longitude?.integerValue),
            },
          };
        })
        .filter((ride) => {
          if (!ride || !ride.location || !coords) return false;
          const distance = haversine(ride.location, coords) / 1000;
          return distance <= 30;
        });

      setRides(ridesList);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch nearby rides');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (rideId) => {
    const driverId = auth.currentUser?.uid;
    if (!driverId) {
      Alert.alert('Error', 'Driver not authenticated');
      return;
    }

    const updateUrl = `${RIDE_DOCUMENT_BASE_URL}/${rideId}?updateMask.fieldPaths=status&updateMask.fieldPaths=acceptedBy&updateMask.fieldPaths=acceptedAt&key=${API_KEY}`;
    const payload = {
      fields: {
        status: { stringValue: 'accepted' },
        acceptedBy: { stringValue: driverId },
        acceptedAt: { timestampValue: new Date().toISOString() },
      },
    };

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

      Alert.alert('Success', 'Ride accepted successfully.');
      fetchAvailableRides(driverLocation);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to accept ride');
    }
  };

  const handleDecline = async (rideId) => {
    const driverId = auth.currentUser?.uid;
    if (!driverId) {
      Alert.alert('Error', 'Driver not authenticated');
      return;
    }

    const updateUrl = `${RIDE_DOCUMENT_BASE_URL}/${rideId}?updateMask.fieldPaths=status&key=${API_KEY}`;
    const payload = {
      fields: {
        status: { stringValue: 'declined' },
      },
    };

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

      Alert.alert('Declined', 'Ride declined successfully.');
      fetchAvailableRides(driverLocation);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to decline ride');
    }
  };

  const renderRide = ({ item }) => {
    const expanded = expandedRideId === item.id;

    return (
      <TouchableOpacity
        onPress={() =>
          setExpandedRideId(expanded ? null : item.id)
        }
        activeOpacity={0.9}
      >
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Pickup:</Text>
            <Text style={styles.value}>{item.pickup}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Drop-off:</Text>
            <Text style={styles.value}>{item.dropoff}</Text>
          </View>

          {expanded && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Ride Type:</Text>
                <Text style={styles.value}>{item.rideType}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Passengers:</Text>
                <Text style={styles.value}>{item.passengerCount}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Scheduled:</Text>
                <Text style={styles.value}>
                  {new Date(item.scheduledTime).toLocaleString()}
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
                  style={[styles.actionBtn, { backgroundColor: '#FFA500' }]}
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
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'red' }}>{error}</Text>
      </View>
    );
  }

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
        >
          <Marker coordinate={driverLocation} title="You" pinColor="blue" />
          {rides.map((ride) => (
            <Marker
              key={ride.id}
              coordinate={ride.location}
              title="Pickup"
              description={ride.pickup}
              pinColor="orange"
            />
          ))}
        </MapView>
      )}

      <SafeAreaView style={styles.container}>
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

        {rides.length === 0 ? (
          <Text style={styles.emptyText}>No nearby ride requests.</Text>
        ) : (
          <FlatList
            data={rides.filter((ride) =>
              selectedRideType === 'All' ? true : ride.rideType === selectedRideType
            )}
            keyExtractor={(item) => item.id}
            renderItem={renderRide}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
  },
  card: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.2)',
    shadowColor: '#FFA500',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
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
    flexShrink: 1,
    width: '40%',
  },
  value: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    flexShrink: 1,
    width: '60%',
    textAlign: 'right',
  },
  btnText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  emptyText: {
    color: '#FFB84D',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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

  // Added missing filter button styles:
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#333',
    margin: 5,
    borderWidth: 1,
    borderColor: '#555',
  },
  filterButtonActive: {
    backgroundColor: '#FFA500',
    borderColor: '#FFA500',
  },
  filterText: {
    color: 'white',
    fontWeight: '500',
  },
  filterTextActive: {
    color: 'black',
    fontWeight: '700',
  },
});
