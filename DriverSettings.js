// DriverSettings.js - Updated Version without Statistics
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
        <View style={styles.refreshButton} />
      </View>

      <ScrollView style={styles.content}>
        {/* Settings Section */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        
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
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: darkMode ? '#FFA500' : '#007AFF',
      marginBottom: 12,
      letterSpacing: 0.5,
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