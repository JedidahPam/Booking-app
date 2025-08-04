import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import Toast from 'react-native-toast-message';

export default function NavigationBar({ onSettingsPress }) {
  const navigation = useNavigation();
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotificationBadge, setShowNotificationBadge] = useState(false);

  // Initialize notifications
  useEffect(() => {
    const setupNotifications = async () => {
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });

      const subscription = Notifications.addNotificationReceivedListener(notification => {
        setNotificationCount(prev => prev + 1);
        setShowNotificationBadge(true);
      });

      return () => subscription.remove();
    };

    setupNotifications();
  }, []);

  const handleNotificationPress = () => {
    // Show notification center or perform action
    Toast.show({
      type: 'info',
      text1: 'Notifications',
      text2: `You have ${notificationCount} new notifications`,
      position: 'top',
    });
    
    // Reset counter and hide badge
    setNotificationCount(0);
    setShowNotificationBadge(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navbar}>
        <Text style={styles.title}>Menu</Text>
        <View style={styles.iconContainer}>

          <TouchableOpacity
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={handleNotificationPress}
          >
            <View>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {showNotificationBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={onSettingsPress}
          >
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#1a1a1a',
  },
  navbar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    backgroundColor: '#2a2a2a',
  },
  title: {
    color: '#FFA500',
    fontSize: 18,
    fontWeight: '600',
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 20,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 6,
  },
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
    backgroundColor: 'red',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});