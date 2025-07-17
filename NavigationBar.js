import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native'; 

export default function NavigationBar({ onSettingsPress }) {
  const navigation = useNavigation(); // <-- get navigation from context

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navbar}>
        <Text style={styles.title}>Menu</Text>
        <View style={styles.iconContainer}>
          <TouchableOpacity
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Search"
            onPress={() => navigation.navigate('SearchScreen')} // replace with your screen
          >
            <Ionicons name="search-outline" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => navigation.navigate('NotificationsScreen')} // replace with your screen
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
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
    backgroundColor: '#1a1a1a', // deep black background
  },
  navbar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    backgroundColor: '#2a2a2a', // dark gray-black for navbar
  },
  title: {
    color: '#FFA500', // orange title text
    fontSize: 18,
    fontWeight: '600',
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 20,
    backgroundColor: '#333', // darker tap area background
    borderRadius: 8,
    padding: 6,
  },
});
