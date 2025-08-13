import React, { useEffect, useState, useCallback } from 'react';
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
import { auth, db } from './firebaseConfig';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';

// Function to calculate statistics from rides
async function getDriverStatistics(driverId) {
  try {
    const ridesRef = collection(db, 'rides');
    const q = query(
      ridesRef,
      where('acceptedBy', '==', driverId),
      where('status', '==', 'completed')
    );
    
    const querySnapshot = await getDocs(q);
    
    // Calculate statistics
    let totalEarnings = 0;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    let monthlyEarnings = 0;
    
    querySnapshot.forEach(doc => {
      const ride = doc.data();
      const price = parseFloat(ride.price) || 0;
      totalEarnings += price;
      
      // Check if ride is from this month
      const rideDate = ride.startTime?.toDate?.() || new Date();
      if (rideDate.getMonth() === thisMonth && rideDate.getFullYear() === thisYear) {
        monthlyEarnings += price;
      }
    });
    
    // Get all rides (completed and cancelled) for completion rate
    const allRidesQuery = query(
      ridesRef,
      where('acceptedBy', '==', driverId),
      where('status', 'in', ['completed', 'cancelled'])
    );
    const allRidesSnapshot = await getDocs(allRidesQuery);
    const totalRides = allRidesSnapshot.size;
    const completedRides = querySnapshot.size;
    
    const completionRate = totalRides > 0 
      ? (completedRides / totalRides) * 100 
      : 100; // Default to 100% if no rides
    
    return {
      totalEarnings,
      monthlyEarnings,
      completedTrips: completedRides,
      completionRate
    };
    
  } catch (error) {
    console.error("Error calculating statistics:", error);
    return {
      totalEarnings: 0,
      monthlyEarnings: 0,
      completedTrips: 0,
      completionRate: 0
    };
  }
}

// Function to get recent rides
async function getRecentRidesFromRidesCollection(driverId, limitRides = 15) {
  try {
    const ridesRef = collection(db, 'rides');
    // First get all recent rides (without the acceptedBy filter)
    const q = query(
      ridesRef,
      orderBy('startTime', 'desc'),
      limit(50) // Get more than needed since we'll filter client-side
    );
    
    const querySnapshot = await getDocs(q);

    // Then filter for this driver client-side
    const rides = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime?.toDate?.() || doc.data().startTime
      }))
      .filter(ride => ride.acceptedBy === driverId)
      .slice(0, limitRides);

    return rides;
    
  } catch (error) {
    console.error("Error fetching recent rides:", error);
    return [];
  }
}

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
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#F44336';
       case 'accepted': return '#FFA500'; // Changed from blue to orange
      case 'pending': return '#FFC107';
      default: return '#FFA500'; // Changed from blue to orange
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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
              tintColor="#FFA500" // Changed from blue to orange
            />
          }
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
             <Ionicons name="arrow-back" size={28} color="#FFA500" /> {/* Changed from conditional to orange */}
            </TouchableOpacity>
            <Text style={styles.title}>Earnings Detail</Text>
            <TouchableOpacity 
              onPress={fetchEarningsData} 
              style={styles.refreshButton} 
              disabled={loading || refreshing}
            >
              {(loading || refreshing) ? (
                <ActivityIndicator size="small" color="#FFA500" />
              ) : (
                <Ionicons name="refresh" size={24} color="#FFA500" /> 
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Earnings Summary</Text>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryAmount}>${stats?.totalEarnings?.toFixed(2) || '0.00'}</Text>
              <Text style={styles.summaryLabel}>Total Earnings</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryAmount}>${stats?.monthlyEarnings?.toFixed(2) || '0.00'}</Text>
              <Text style={styles.summaryLabel}>This Month</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.completedTrips || 0}</Text>
              <Text style={styles.statLabel}>Completed Trips</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                ${stats?.completedTrips > 0
                  ? (stats.totalEarnings / stats.completedTrips).toFixed(2)
                  : '0.00'}
              </Text>
              <Text style={styles.statLabel}>Avg per Trip</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.completionRate?.toFixed(1) || '100.0'}%</Text>
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Recent Rides</Text>

          {recentRides.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={60} color={darkMode ? '#666' : '#ccc'} />
              <Text style={styles.emptyText}>No rides yet</Text>
              <Text style={styles.emptySubtext}>Your accepted and completed rides will appear here</Text>
            </View>
          ) : (
            recentRides.map((ride, index) => (
              <View key={ride.id || index} style={styles.tripCard}>
                <View style={styles.tripHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
                    <Text style={styles.statusText}>{ride.status?.replace(/_/g, ' ')?.toUpperCase() || 'UNKNOWN'}</Text>
                  </View>
                  <Text style={styles.tripDate}>{formatDate(ride.startTime)}</Text>
                </View>

                <View style={styles.tripDetails}>
                  <View style={styles.tripInfo}>
                    <Ionicons name="location-outline" size={16} color="#FFA500" />
                    <Text style={styles.tripLocation} numberOfLines={1}>
                      {ride.pickup?.address || 'Pickup Location'}
                    </Text>
                  </View>
                  <View style={styles.tripInfo}>
                     <Ionicons name="location" size={16} color="#FFA500" />
                    <Text style={styles.tripLocation} numberOfLines={1}>
                      {ride.dropoff?.address || 'Dropoff Location'}
                    </Text>
                  </View>
                </View>

                <View style={styles.tripFooter}>
  <View style={styles.tripMetrics}>
    {ride.distance !== undefined && !isNaN(ride.distance) && (
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <Ionicons name="speedometer-outline" size={14} color={darkMode ? '#ccc' : '#666'} />
        <Text style={styles.tripMetric}>{ride.distance.toFixed(1)} km</Text>
      </View>
    )}
  </View>

  {ride.status === 'completed' && (
    <Text style={styles.tripEarning}>+${ride.price?.toFixed(2) || '0.00'}</Text>
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


const createStyles = (darkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: darkMode ? '#121212' : '#fff',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 15,
      paddingBottom: 15,
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
      color: "#FFA500", // Changed from conditional to orange
    },
    content: {
      flex: 1,
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
      color: "#FFA500", // Changed from blue to orange
      marginBottom: 15,
      paddingHorizontal: 20,
    },
    summaryContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
      paddingHorizontal: 20,
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
      paddingHorizontal: 20,
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
      color: "#FFA500", // Changed from blue to orange
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
      paddingHorizontal: 20,
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
    },
    tripCard: {
      backgroundColor: darkMode ? '#222' : '#fff',
      borderRadius: 12,
      padding: 15,
      marginBottom: 12,
      marginHorizontal: 20,
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
    tripCancelled: {
      fontSize: 14,
      fontWeight: '600',
      color: '#F44336',
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
      color: "#FFA500", // Changed from red to orange
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
      backgroundColor: "#FFA500", // Changed from blue to orange
    },
    textStyle: {
      color: 'white',
      fontWeight: 'bold',
      textAlign: 'center',
      fontSize: 16,
    },
  });