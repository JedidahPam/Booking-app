import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { auth } from './firebaseConfig';

const API_KEY = "AIzaSyAZf-KMgaokOF-PVhxgXG64bxWK28_h9-0"; // Replace with your actual API key
const PROJECT_ID = "local-transport-booking-app";    // Replace with your Firebase project ID
const PAGE_SIZE = 20;

const RidesScreen = () => {
  const { darkMode } = useTheme();
  const navigation = useNavigation();

  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [nextPageToken, setNextPageToken] = useState(null);

  const fetchRides = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) {
        throw new Error('User not authenticated');
      }

      let url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/rides?pageSize=${PAGE_SIZE}&key=${API_KEY}`;
      if (nextPageToken) {
        url += `&pageToken=${nextPageToken}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        console.error('Firestore error:', data);
        throw new Error(data.error?.message || 'Failed to fetch rides');
      }

      const documents = data.documents || [];
      const userRides = documents
        .filter(doc => doc.fields?.userId?.stringValue === currentUserId)
        .map(doc => {
          const fields = doc.fields || {};
          
          // Extract nested pickup location
          const pickupData = fields.pickup?.mapValue?.fields || {};
          const pickup = {
            address: pickupData.address?.stringValue || 'Unknown pickup',
            latitude: pickupData.latitude?.doubleValue || pickupData.latitude?.integerValue || null,
            longitude: pickupData.longitude?.doubleValue || pickupData.longitude?.integerValue || null,
          };

          // Extract nested dropoff location
          const dropoffData = fields.dropoff?.mapValue?.fields || {};
          const dropoff = {
            address: dropoffData.address?.stringValue || 'Unknown dropoff',
            latitude: dropoffData.latitude?.doubleValue || dropoffData.latitude?.integerValue || null,
            longitude: dropoffData.longitude?.doubleValue || dropoffData.longitude?.integerValue || null,
          };

          return {
            id: doc.name.split('/').pop(),
            pickup,
            dropoff,
            status: fields.status?.stringValue || 'pending',
            timestamp: fields.timestamp?.timestampValue || null,
            distance: fields.distance?.doubleValue || fields.distance?.integerValue || null,
            price: fields.price?.doubleValue || fields.price?.integerValue || null,
            paymentMethod: fields.paymentMethod?.stringValue || null,
            driverId: fields.driverId?.stringValue || null,  // Added driverId here
          };
        });

      setRides(prev => {
        const existingIds = new Set(prev.map(ride => ride.id));
        const newRides = userRides.filter(ride => !existingIds.has(ride.id));
        return [...prev, ...newRides];
      });
      setNextPageToken(data.nextPageToken || null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRides();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRides([]);
    setNextPageToken(null);
    fetchRides();
  }, []);

  const handleLoadMore = () => {
    if (!loading && nextPageToken) {
      fetchRides();
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
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
      default:
        return '#757575';
    }
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && { backgroundColor: '#000' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, darkMode && { color: '#fff' }]}>Your Rides</Text>
        <TouchableOpacity onPress={onRefresh}>
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
          <TouchableOpacity style={styles.retryButton} onPress={fetchRides}>
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
          onScroll={({ nativeEvent }) => {
            const isCloseToBottom =
              nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
              nativeEvent.contentSize.height - 20;
            if (isCloseToBottom) handleLoadMore();
          }}
          scrollEventThrottle={400}
          showsVerticalScrollIndicator={false}
        >
          {rides.map(ride => (
            <TouchableOpacity
              key={ride.id}
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
                  {ride.price && (
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
  rideCard: {
    backgroundColor: '#f8f9fa',
    marginHorizontal: 16,
    marginBottom: 12,
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
});

export default RidesScreen;
