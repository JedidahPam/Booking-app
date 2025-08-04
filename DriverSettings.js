// DriverSettings.js - Updated Version
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import { auth } from './firebaseConfig';
import { getDriverStatistics, initializeDriverStats } from './driverStatsService';

export default function DriverSettings() {
  const { darkMode, setDarkMode } = useTheme();
  const styles = createStyles(darkMode);
  const navigation = useNavigation();

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDriverStats = async () => {
    try {
      const driverId = auth.currentUser?.uid;
      if (!driverId) throw new Error('User not authenticated');

      console.log('Fetching stats for driver:', driverId);
      const driverStats = await getDriverStatistics(driverId);
      setStats(driverStats);
    } catch (error) {
      console.error('Error fetching driver stats:', error);
      Alert.alert('Error', 'Failed to load driver statistics.');
      
      // Set default stats if fetch fails
      setStats({
        totalTrips: 0,
        totalEarnings: 0,
        averageRating: 0,
        completionRate: 100,
        totalRatings: 0,
        completedTrips: 0,
        cancelledTrips: 0,
        monthlyEarnings: 0,
        monthlyTrips: 0
      });
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const initializeAndFetch = async () => {
      try {
        const driverId = auth.currentUser?.uid;
        if (driverId) {
          console.log('Initializing driver stats for:', driverId);
          
          // Initialize driver stats if they don't exist
          await initializeDriverStats(driverId, {
            name: auth.currentUser?.displayName || '',
            email: auth.currentUser?.email || ''
          });
          
          // Then fetch the stats
          await fetchDriverStats();
        }
      } catch (error) {
        console.error('Error initializing driver:', error);
        setLoadingStats(false);
      }
    };

    initializeAndFetch();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDriverStats();
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
    Alert.alert('Settings', `Dark Mode ${!darkMode ? 'Enabled' : 'Disabled'}`);
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            navigation.reset({
              index: 0,
              routes: [{ name: 'SignIn' }],
            });
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to log out.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          style={styles.backButton}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={28} color={darkMode ? '#FFA500' : '#444'} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={darkMode ? '#FFA500' : '#444'} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Driver Stats */}
        <Text style={styles.sectionTitle}>Driver Statistics</Text>
        {loadingStats ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={darkMode ? '#FFA500' : '#007AFF'} />
            <Text style={styles.loadingText}>Loading statistics...</Text>
          </View>
        ) : (
          <View>
            {/* Main Stats Row */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats?.totalTrips ?? 0}</Text>
                <Text style={styles.statLabel}>Total Trips</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>${stats?.totalEarnings?.toFixed(2) ?? '0.00'}</Text>
                <Text style={styles.statLabel}>Total Earnings</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats?.averageRating?.toFixed(1) ?? '0.0'}</Text>
                <Text style={styles.statLabel}>Rating ({stats?.totalRatings ?? 0})</Text>
              </View>
            </View>

            {/* Secondary Stats Row */}
            <View style={[styles.statsContainer, { marginTop: 12 }]}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats?.completedTrips ?? 0}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats?.completionRate?.toFixed(1) ?? '100.0'}%</Text>
                <Text style={styles.statLabel}>Completion Rate</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>${stats?.monthlyEarnings?.toFixed(2) ?? '0.00'}</Text>
                <Text style={styles.statLabel}>This Month</Text>
              </View>
            </View>
          </View>
        )}

        {/* Settings Section */}
        <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Preferences</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.label}>Dark Mode</Text>
          <Switch
            value={darkMode}
            onValueChange={toggleDarkMode}
            thumbColor={darkMode ? '#FFA500' : '#f4f3f4'}
            trackColor={{ false: '#767577', true: '#7a42f4' }}
          />
        </View>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => navigation.navigate('DriverHistory')}
          accessibilityLabel="View trip history"
          accessibilityRole="button"
        >
          <Text style={styles.label}>Trip History</Text>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={darkMode ? '#FFA500' : '#444'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => navigation.navigate('EarningsDetail')}
          accessibilityLabel="View detailed earnings"
          accessibilityRole="button"
        >
          <Text style={styles.label}>Earnings Breakdown</Text>
          <Ionicons
            name="analytics-outline"
            size={22}
            color={darkMode ? '#FFA500' : '#444'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          accessibilityLabel="Log out"
          accessibilityRole="button"
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
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
      alignItems: 'center',
      paddingVertical: 40,
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
      marginBottom: 12,
      letterSpacing: 0.5,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    statCard: {
      flex: 1,
      backgroundColor: darkMode ? '#222' : '#fff',
      borderRadius: 12,
      paddingVertical: 20,
      marginHorizontal: 5,
      borderWidth: 1,
      borderColor: darkMode ? '#444' : '#e0e0e0',
      shadowColor: darkMode ? '#000' : '#aaa',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 20,
      fontWeight: 'bold',
      color: darkMode ? '#FFA500' : '#007AFF',
      marginBottom: 6,
    },
    statLabel: {
      fontSize: 12,
      color: darkMode ? '#ccc' : '#555',
      fontWeight: '600',
      textAlign: 'center',
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 18,
      paddingHorizontal: 20,
      backgroundColor: darkMode ? '#222' : '#fff',
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: darkMode ? '#444' : '#e0e0e0',
      shadowColor: darkMode ? '#000' : '#aaa',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
    },
    label: {
      fontSize: 16,
      color: darkMode ? '#fff' : '#333',
      fontWeight: '600',
    },
    logoutBtn: {
      backgroundColor: '#FF6B6B',
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 40,
      marginBottom: 30,
      shadowColor: '#FF6B6B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.8,
      shadowRadius: 6,
      elevation: 5,
    },
    logoutText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
    },
  });