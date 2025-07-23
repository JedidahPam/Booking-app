import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from './firebaseConfig'; // Ensure 'db' is imported

// Import gesture handler components
import { Swipeable } from 'react-native-gesture-handler';

// Import Firestore functions for real-time listening
import {
  collection,
  query,
  where,
  onSnapshot, // Import onSnapshot for real-time updates
} from 'firebase/firestore';

// API_KEY, PROJECT_ID, PAGE_SIZE are no longer needed for onSnapshot direct usage
// const API_KEY = "AIzaSyAZf-KMgaokOF-PVhxgXG64bxWK28_h9-0";
// const PROJECT_ID = "local-transport-booking-app";
// const PAGE_SIZE = 20;

const RidesScreen = () => {
  const { darkMode } = useTheme();
  const navigation = useNavigation();

  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true); // Set to true initially for listener setup
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  // nextPageToken is no longer needed with onSnapshot
  // const [nextPageToken, setNextPageToken] = useState(null);

  // useRef to store the unsubscribe function for the real-time listener
  const ridesUnsubscribeRef = useRef(null);

  useEffect(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ridesCollectionRef = collection(db, 'rides');
    // Query for rides where the userId matches the current authenticated user
    const q = query(ridesCollectionRef, where('userId', '==', currentUserId));

    // Set up the real-time listener using onSnapshot
    ridesUnsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const userRides = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          // Ensure proper data extraction matching your Firestore document structure
          const pickupData = data.pickup || {};
          const dropoffData = data.dropoff || {};

          // --- FIX APPLIED HERE for timestamp ---
          let rideTimestamp = null;
          if (data.timestamp) {
            // Check if it's a Firestore Timestamp object (has toDate method)
            if (typeof data.timestamp.toDate === 'function') {
              rideTimestamp = data.timestamp.toDate();
            } else {
              // Otherwise, assume it's a value parsable by Date constructor (e.g., number, ISO string)
              rideTimestamp = new Date(data.timestamp);
            }
          }
          // --- END FIX ---

          userRides.push({
            id: docSnap.id,
            pickup: {
              address: pickupData.address || 'Unknown pickup',
              latitude: pickupData.latitude || null,
              longitude: pickupData.longitude || null,
            },
            dropoff: {
              address: dropoffData.address || 'Unknown dropoff',
              latitude: dropoffData.latitude || null,
              longitude: dropoffData.longitude || null,
            },
            status: data.status || 'pending',
            timestamp: rideTimestamp, // Use the processed timestamp
            distance: data.distance || null,
            price: data.price || null,
            paymentMethod: data.paymentMethod || null,
            driverId: data.driverId || null,
          });
        });

        setRides(userRides);
        setLoading(false);
        setRefreshing(false); // Stop refreshing indicator after data loads
      },
      (err) => {
        // Error handling for the real-time listener
        console.error('Real-time listener error:', err);
        setError(err.message || 'Failed to fetch real-time rides.');
        setLoading(false);
        setRefreshing(false);
      }
    );

    // Cleanup function: unsubscribe from the listener when the component unmounts
    return () => {
      if (ridesUnsubscribeRef.current) {
        ridesUnsubscribeRef.current();
      }
    };
  }, []); // Empty dependency array means this useEffect runs once on component mount

  // onRefresh will simply reset states, the onSnapshot listener will then re-trigger
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRides([]); // Clear existing rides to show fresh data loading
    setError(null);
    // The onSnapshot listener itself will handle fetching fresh data
    // No explicit fetch call needed here, as the listener is always active.
    // If you need to force a re-subscription, you'd unsubscribe and then re-subscribe.
  }, []);

  // handleLoadMore is no longer needed as onSnapshot handles real-time updates
  // const handleLoadMore = () => {
  //   if (!loading && nextPageToken) {
  //     fetchRides();
  //   }
  // };

  // Function to remove a single ride by ID
  const removeRide = (id) => {
    Alert.alert(
      "Remove Ride",
      "Are you sure you want to remove this ride from the list? This will not delete it from the database.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove",
          onPress: () => {
            setRides(prevRides => prevRides.filter(ride => ride.id !== id));
          }
        }
      ]
    );
  };

  // Render method for the right swipe action (e.g., delete button)
  const renderRightActions = (progress, dragX, id) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity onPress={() => removeRide(id)} style={styles.deleteBox}>
        <Ionicons name="trash" size={24} color="white" />
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    // Ensure date is valid before formatting
    if (isNaN(date.getTime())) {
      console.warn("Invalid timestamp encountered:", timestamp);
      return 'Invalid Date';
    }
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      case 'accepted': // Added accepted status color
        return '#007bff';
      case 'in_progress': // Added in_progress status color
        return '#8A2BE2'; // Example color, adjust as needed
      default:
        return '#757575';
    }
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && { backgroundColor: '#000' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, darkMode && { color: '#fff' }]}>Your Rides</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
          <Ionicons name="refresh" size={24} color={darkMode ? '#fff' : '#000'} />
        </TouchableOpacity>
      </View>

      {loading && rides.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={[styles.loadingText, darkMode && { color: '#fff' }]}>Loading your rides...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}> {/* onRefresh will handle re-triggering the listener */}
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, darkMode && { color: '#fff' }]}>No rides found</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          // onScroll and handleLoadMore are removed as onSnapshot handles updates
          // onScroll={({ nativeEvent }) => {
          //   const isCloseToBottom =
          //     nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
          //     nativeEvent.contentSize.height - 20;
          //   if (isCloseToBottom) handleLoadMore();
          // }}
          // scrollEventThrottle={400}
          showsVerticalScrollIndicator={false}
        >
          {rides.map(ride => (
            <Swipeable
              key={ride.id}
              renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, ride.id)}
              overshootRight={false} // Prevents overswiping past the delete button
              containerStyle={styles.swipeableContainer}
            >
              <TouchableOpacity
                style={[
                  styles.rideCard,
                  darkMode && { backgroundColor: '#1a1a1a' }
                ]}
                onPress={() => navigation.navigate('Home', { rideId: ride.id })}
                activeOpacity={0.7}
              >
                <View style={styles.rideHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
                    <Text style={styles.statusText}>{ride.status?.toUpperCase()}</Text>
                  </View>
                  {ride.timestamp && (
                    <Text style={[styles.dateText, darkMode && { color: '#ccc' }]}>
                      {formatDate(ride.timestamp)}
                    </Text>
                  )}
                </View>

                <View style={styles.locationContainer}>
                  <View style={styles.locationRow}>
                    <View style={styles.locationDot} />
                    <View style={styles.locationInfo}>
                      <Text style={[styles.locationLabel, darkMode && { color: '#ccc' }]}>From</Text>
                      <Text style={[styles.locationText, darkMode && { color: '#fff' }]} numberOfLines={2}>
                        {ride.pickup.address}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.locationConnector} />

                  <View style={styles.locationRow}>
                    <View style={[styles.locationDot, { backgroundColor: '#F44336' }]} />
                    <View style={styles.locationInfo}>
                      <Text style={[styles.locationLabel, darkMode && { color: '#ccc' }]}>To</Text>
                      <Text style={[styles.locationText, darkMode && { color: '#fff' }]} numberOfLines={2}>
                        {ride.dropoff.address}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.rideFooter}>
                  <View style={styles.infoGroup}>
                    {ride.distance && (
                      <View style={styles.infoItem}>
                        <Ionicons name="location" size={14} color={darkMode ? '#ccc' : '#666'} />
                        <Text style={[styles.infoText, darkMode && { color: '#ccc' }]}>
                          {ride.distance.toFixed(1)} km
                        </Text>
                      </View>
                    )}
                    {typeof ride.price === 'number' && (
                      <View style={styles.infoItem}>
                        <Ionicons name="card" size={14} color={darkMode ? '#ccc' : '#666'} />
                        <Text style={[styles.infoText, darkMode && { color: '#ccc' }]}>
                          ${ride.price.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {ride.paymentMethod && (
                      <View style={styles.infoItem}>
                        <Ionicons
                          name={ride.paymentMethod === 'cash' ? 'cash' : 'card'}
                          size={14}
                          color={darkMode ? '#ccc' : '#666'}
                        />
                        <Text style={[styles.infoText, darkMode && { color: '#ccc' }]}>
                          {ride.paymentMethod}
                        </Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() => navigation.navigate('Chat', {
                      rideId: ride.id,
                      userId: auth.currentUser.uid,
                      driverId: ride.driverId,
                    })}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={darkMode ? '#fff' : '#007bff'} />
                    <Text style={[styles.chatButtonText, darkMode && { color: '#fff' }]}>Chat with Driver</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Swipeable>
          ))}

          {loading && rides.length > 0 && (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator size="small" color="#4CAF50" />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButton: {
    padding: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  swipeableContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden', // Ensures the delete button doesn't go beyond the card's bounds
  },
  rideCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  locationContainer: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginTop: 6,
    marginRight: 12,
  },
  locationConnector: {
    width: 2,
    height: 20,
    backgroundColor: '#E0E0E0',
    marginLeft: 3,
    marginVertical: 4,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    lineHeight: 18,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  infoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007bff',
  },
  chatButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#007bff',
    fontWeight: '600',
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteBox: {
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    borderRadius: 12,
    marginBottom: 12, // Match rideCard's margin for spacing
    width: 100, // Width of the swipeable area
    alignSelf: 'flex-end',
  },
  deleteText: {
    color: 'white',
    fontWeight: '600',
    marginTop: 5,
  },
});

export default RidesScreen;