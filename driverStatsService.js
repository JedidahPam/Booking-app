import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { auth } from './firebaseConfig';
import { 
  getDriverStatistics, 
  getRecentRidesFromRidesCollection 
} from './driverStatsService';

export default function EarningsDetail() {
  const { darkMode } = useTheme();
  const styles = createStyles(darkMode);
  const navigation = useNavigation();

  const [stats, setStats] = useState(null);
  const [recentRides, setRecentRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchEarningsData();
    }, [])
  );

  const fetchEarningsData = async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      const driverId = auth.currentUser?.uid;
      if (!driverId) {
        setErrorMessage('User not authenticated. Please log in.');
        setErrorModalVisible(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [driverStats, rides] = await Promise.all([
        getDriverStatistics(driverId),
        getRecentRidesFromRidesCollection(driverId, 15)
      ]);
      
      setStats(driverStats);
      setRecentRides(rides);

    } catch (error) {
      console.error('Error fetching earnings data:', error);
      setErrorMessage('Failed to load earnings data: ' + error.message);
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      case 'accepted': return '#2196F3';
      case 'pending': return '#FFC107';
      default: return darkMode ? '#FFA500' : '#2196F3';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={darkMode ? '#FFA500' : '#444'} />
        </TouchableOpacity>
        <Text style={styles.title}>Earnings Detail</Text>
        <TouchableOpacity 
          onPress={fetchEarningsData} 
          style={styles.refreshButton} 
          disabled={loading || refreshing}
        >
          <Ionicons 
            name="refresh" 
            size={24} 
            color={(loading || refreshing) ? '#888' : (darkMode ? '#FFA500' : '#444')} 
          />
        </TouchableOpacity>
      </View>

      {loading && !stats ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={darkMode ? '#FFA500' : '#007AFF'} />
          <Text style={styles.loadingText}>Loading earnings data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={fetchEarningsData}
              tintColor={darkMode ? '#FFA500' : '#007AFF'}
            />
          }
        >
          <Text style={styles.sectionTitle}>Earnings Summary</Text>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryAmount}>
                ${stats?.totalEarnings?.toFixed(2) || '0.00'}
              </Text>
              <Text style={styles.summaryLabel}>Total Earnings</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryAmount}>
                ${stats?.monthlyEarnings?.toFixed(2) || '0.00'}
              </Text>
              <Text style={styles.summaryLabel}>This Month</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.completedTrips || 0}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats?.completionRate?.toFixed(0) || '100'}%
              </Text>
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats?.averageRating?.toFixed(1) || '0.0'}
              </Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Recent Rides</Text>

          {recentRides.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={60} color={darkMode ? '#666' : '#ccc'} />
              <Text style={styles.emptyText}>No rides yet</Text>
              <Text style={styles.emptySubtext}>Your completed rides will appear here</Text>
            </View>
          ) : (
            recentRides.map((ride, index) => (
              <View key={ride.id || index} style={styles.tripCard}>
                <View style={styles.tripHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
                    <Text style={styles.statusText}>{ride.status?.toUpperCase() || 'UNKNOWN'}</Text>
                  </View>
                  <Text style={styles.tripDate}>{formatDate(ride.startTime)}</Text>
                </View>

                <View style={styles.tripDetails}>
                  <View style={styles.tripInfo}>
                    <Ionicons name="location-outline" size={16} color={darkMode ? '#FFA500' : '#007AFF'} />
                    <Text style={styles.tripLocation} numberOfLines={1}>
                      {ride.pickup?.address || 'Pickup Location'}
                    </Text>
                  </View>
                  <View style={styles.tripInfo}>
                    <Ionicons name="location" size={16} color={darkMode ? '#FFA500' : '#007AFF'} />
                    <Text style={styles.tripLocation} numberOfLines={1}>
                      {ride.dropoff?.address || 'Dropoff Location'}
                    </Text>
                  </View>
                </View>

                <View style={styles.tripFooter}>
                  <View style={styles.tripMetrics}>
                    {ride.distance !== undefined && (
                      <Text style={styles.tripMetric}>
                        <Ionicons name="speedometer-outline" size={14} /> 
                        {ride.distance.toFixed(1)} km
                      </Text>
                    )}
                  </View>

                  {ride.status === 'completed' && (
                    <Text style={styles.tripEarning}>
                      +${ride.price?.toFixed(2) || '0.00'}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      <Modal
        animationType="fade"
        transparent={true}
        visible={errorModalVisible}
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Error</Text>
            <Text style={styles.modalText}>{errorMessage}</Text>
            <TouchableOpacity
              style={[styles.button, styles.buttonClose]}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.textStyle}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (darkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkMode ? '#121212' : '#fff',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: darkMode ? '#333' : '#ddd',
    backgroundColor: darkMode ? '#1a1a1a' : '#f9f9f9',
  },
  backButton: {
    padding: 4,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 4,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: darkMode ? '#FFA500' : '#222',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: darkMode ? '#ccc' : '#666',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: darkMode ? '#FFA500' : '#007AFF',
    marginBottom: 15,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: darkMode ? '#222' : '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: darkMode ? '#444' : '#e0e0e0',
    alignItems: 'center',
    shadowColor: darkMode ? '#000' : '#aaa',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: darkMode ? '#4CAF50' : '#2E7D32',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 14,
    color: darkMode ? '#ccc' : '#666',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: darkMode ? '#222' : '#fff',
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: darkMode ? '#444' : '#e0e0e0',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: darkMode ? '#FFA500' : '#007AFF',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: darkMode ? '#ccc' : '#666',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: darkMode ? '#ccc' : '#666',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    color: darkMode ? '#888' : '#999',
    marginTop: 5,
    textAlign: 'center',
  },
  tripCard: {
    backgroundColor: darkMode ? '#222' : '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: darkMode ? '#444' : '#e0e0e0',
    shadowColor: darkMode ? '#000' : '#aaa',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tripDate: {
    fontSize: 12,
    color: darkMode ? '#ccc' : '#666',
  },
  tripDetails: {
    marginBottom: 10,
  },
  tripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  tripLocation: {
    marginLeft: 8,
    fontSize: 14,
    color: darkMode ? '#fff' : '#333',
    flex: 1,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripMetric: {
    fontSize: 12,
    color: darkMode ? '#ccc' : '#666',
    marginRight: 15,
  },
  tripEarning: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: darkMode ? '#2a2a2a' : 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: darkMode ? '#FFA500' : '#E53935',
  },
  modalText: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 16,
    color: darkMode ? '#ccc' : '#333',
  },
  button: {
    borderRadius: 10,
    padding: 12,
    elevation: 2,
    minWidth: 100,
  },
  buttonClose: {
    backgroundColor: darkMode ? '#FFA500' : '#007AFF',
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
});