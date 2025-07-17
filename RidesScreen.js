import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { useNavigation } from '@react-navigation/native';

const API_BASE_URL = 'https://firestore.googleapis.com/v1/projects/local-transport-booking-app/databases/(default)/documents/rides';
const API_KEY = 'AIzaSyAZf-KMgaokOF-PVhxgXG64bxWK28_h9-0';
const PAGE_SIZE = 10;

const STATUS_COLORS = {
  accepted: '#4CAF50',
  pending: '#FFA500',
  completed: '#2196F3',
  cancelled: '#f44336',
  default: '#999',
};

const STATUS_LABELS = {
  accepted: 'Accepted',
  pending: 'Pending',
  completed: 'Completed',
  cancelled: 'Cancelled',
  default: 'Unknown',
};

export default function RidesScreen() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [nextPageToken, setNextPageToken] = useState(null);
  const { darkMode } = useTheme();
  const styles = createStyles(darkMode);
  const navigation = useNavigation();

  useEffect(() => {
    fetchRides(true);
  }, []);

  const fetchRides = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setError(null);
        setNextPageToken(null);
      }
      let url = `${API_BASE_URL}?key=${API_KEY}&pageSize=${PAGE_SIZE}`;
      if (!reset && nextPageToken) {
        url += `&pageToken=${nextPageToken}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error.message || 'API Error');

      if (data.documents) {
        const parsed = data.documents.map((doc) => {
          const f = doc.fields;
          return {
            id: doc.name.split('/').pop(),
            pickup: f.pickupLocation?.mapValue?.fields?.address?.stringValue ?? '',
            dropoff: f.dropoffLocation?.mapValue?.fields?.address?.stringValue ?? '',
            status: f.status?.stringValue ?? 'pending',
            timestamp: f.timestamp?.timestampValue ?? null,
          };
        });

        setRides((prev) => (reset ? parsed : [...prev, ...parsed]));
      } else if (reset) {
        setRides([]);
      }

      setNextPageToken(data.nextPageToken || null);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRides(true);
  }, []);

  const loadMore = () => {
    if (!loading && nextPageToken) {
      fetchRides(false);
    }
  };

  const formatTimestamp = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const onPressRide = (ride) => {
    navigation.navigate('RideDetailsScreen', { rideId: ride.id });
  };

  if (loading && rides.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFA500" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle" size={64} color="#f44336" />
        <Text style={[styles.errorText]}>Error: {error}</Text>
        <TouchableOpacity
          onPress={() => fetchRides(true)}
          style={styles.retryButton}
          accessibilityLabel="Retry loading rides"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: darkMode ? '#000' : '#f9f9f9' }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFA500" />}
      >
        <Text style={styles.title}>Your Rides</Text>

        {rides.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={64} color="#999" />
            <Text style={styles.emptyText}>No rides available</Text>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => navigation.navigate('TravelDetailsScreen')}
              accessibilityLabel="Book your first ride"
            >
              <Text style={styles.ctaButtonText}>Book your first ride</Text>
            </TouchableOpacity>
          </View>
        ) : (
          rides.map((ride) => {
            const status = ride.status.toLowerCase();
            const color = STATUS_COLORS[status] || STATUS_COLORS.default;
            const label = STATUS_LABELS[status] || STATUS_LABELS.default;

            return (
              <TouchableOpacity
                key={ride.id}
                style={[styles.rideCard, { borderColor: color }]}
                onPress={() => onPressRide(ride)}
                accessibilityLabel={`Ride from ${ride.pickup} to ${ride.dropoff}, status ${label}`}
                accessibilityRole="button"
              >
                <View style={styles.rideHeader}>
                  <Ionicons name="car" size={20} color={color} />
                  <Text style={[styles.statusText, { color }]}>{label}</Text>
                </View>

                <Text style={styles.label}>From:</Text>
                <Text style={styles.info}>{ride.pickup}</Text>

                <Text style={styles.label}>To:</Text>
                <Text style={styles.info}>{ride.dropoff}</Text>

                {ride.timestamp ? (
                  <>
                    <Text style={styles.label}>Date & Time:</Text>
                    <Text style={styles.info}>{formatTimestamp(ride.timestamp)}</Text>
                  </>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}

        {nextPageToken && rides.length > 0 && (
          <TouchableOpacity
            onPress={loadMore}
            style={styles.loadMoreButton}
            accessibilityLabel="Load more rides"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#FFA500" />
            ) : (
              <Text style={styles.loadMoreText}>Load More</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (darkMode) =>
  StyleSheet.create({
    container: {
      padding: 20,
      backgroundColor: darkMode ? '#000' : '#f9f9f9',
      flexGrow: 1,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      marginBottom: 20,
      color: darkMode ? '#fff' : '#000',
      textAlign: 'center',
    },
    empty: {
      alignItems: 'center',
      marginTop: 60,
    },
    emptyText: {
      fontSize: 18,
      marginTop: 16,
      color: darkMode ? '#aaa' : '#666',
      marginBottom: 20,
    },
    ctaButton: {
      backgroundColor: '#FFA500',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
    },
    ctaButtonText: {
      color: '#000',
      fontWeight: '700',
      fontSize: 16,
    },
    rideCard: {
      backgroundColor: darkMode ? '#1a1a1a' : '#fff',
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 2,
      elevation: 3,
    },
    rideHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    statusText: {
      marginLeft: 8,
      fontWeight: '700',
      fontSize: 16,
      textTransform: 'capitalize',
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: darkMode ? '#ccc' : '#555',
      marginTop: 6,
    },
    info: {
      fontSize: 15,
      color: darkMode ? '#fff' : '#000',
    },
    errorText: {
      fontSize: 18,
      color: '#f44336',
      marginTop: 20,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 20,
      backgroundColor: '#f44336',
      paddingVertical: 10,
      paddingHorizontal: 30,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
    loadMoreButton: {
      padding: 14,
      borderRadius: 8,
      backgroundColor: '#FFA500',
      alignItems: 'center',
      marginVertical: 10,
    },
    loadMoreText: {
      color: '#000',
      fontWeight: '700',
      fontSize: 16,
    },
  });
