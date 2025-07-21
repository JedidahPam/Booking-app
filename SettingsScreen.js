import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deleteUser } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { useTheme } from './ThemeContext';
import { doc, getDoc } from 'firebase/firestore';

export default function SettingsScreen({ navigation }) {
  const { darkMode, toggleTheme } = useTheme();

  // User profile state
  const [profile, setProfile] = useState({
    firstname: '',
    email: '',
    role: '',
  });

  // Load user profile from Firebase Auth and Firestore
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
          return;
        }

        const email = user.email || '';

        // Fetch firstname and role from Firestore users collection
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        let firstname = '';
        let role = '';
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          firstname = userData.firstname || '';
          role = userData.role || '';
        }

        setProfile({ firstname, email, role });
      } catch (error) {
        Alert.alert('Error', 'Failed to load profile info.');
      }
    };

    loadProfile();
  }, [navigation]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] }),
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    Alert.alert('Delete Account', 'This action is irreversible. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const user = auth.currentUser;
            await deleteUser(user);
            Alert.alert('Deleted', 'Your account has been deleted.');
            navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
          } catch (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const styles = getStyles(darkMode);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Settings</Text>

      {/* Profile Info */}
      <View style={styles.profileBox}>
        <Ionicons name="person-circle-outline" size={60} color={darkMode ? '#fff' : '#333'} />
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.profileName}>{profile.firstname || 'Unnamed User'}</Text>
          <Text style={styles.profileEmail}>{profile.email || 'No email'}</Text>
          <Text style={styles.profileRole}>{profile.role || 'Rider'}</Text>
        </View>
      </View>

      {/* Preferences */}
      <Text style={styles.sectionTitle}>Preferences</Text>
      <SettingsToggle 
        label="Dark Mode" 
        value={darkMode} 
        onValueChange={toggleTheme} 
        styles={styles} 
      />

      {/* Account */}
      <Text style={styles.sectionTitle}>Account</Text>
      <SettingsOption 
        icon="lock-closed-outline" 
        label="Change Password" 
        onPress={() => navigation.navigate('ChangePasswordScreen')} 
        styles={styles}
        darkMode={darkMode}
      />
      <SettingsOption 
        icon="trash-outline" 
        label="Delete Account" 
        onPress={handleDeleteAccount} 
        styles={styles}
        darkMode={darkMode}
      />
      <SettingsOption 
        icon="log-out-outline" 
        label="Logout" 
        onPress={handleLogout} 
        styles={styles}
        darkMode={darkMode}
      />
    </ScrollView>
  );
}

function SettingsOption({ icon, label, onPress, styles, darkMode }) {
  return (
    <TouchableOpacity style={styles.optionItem} onPress={onPress}>
      <Ionicons name={icon} size={22} color={darkMode ? '#fff' : '#333'} style={styles.optionIcon} />
      <Text style={styles.optionText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#888" />
    </TouchableOpacity>
  );
}

function SettingsToggle({ label, value, onValueChange, styles }) {
  return (
    <View style={styles.optionItem}>
      <Text style={styles.optionText}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const getStyles = (darkMode) =>
  StyleSheet.create({
    container: {
      backgroundColor: darkMode ? '#1a1a1a' : '#fff',
      flex: 1,
      padding: 20,
    },
    header: {
      color: darkMode ? '#FFA500' : '#333',
      fontSize: 28,
      fontWeight: '600',
      marginBottom: 20,
    },
    profileBox: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 30,
    },
    profileName: {
      color: darkMode ? '#FFA500' : '#222',
      fontSize: 20,
      fontWeight: '600',
    },
    profileEmail: {
      color: darkMode ? '#FFB84D' : '#666',
      fontSize: 14,
    },
    profileRole: {
      color: darkMode ? '#FFD699' : '#999',
      fontSize: 14,
    },
    sectionTitle: {
      color: darkMode ? '#FFA500' : '#444',
      fontSize: 18,
      fontWeight: '600',
      marginTop: 20,
      marginBottom: 12,
    },
    optionItem: {
      backgroundColor: darkMode ? '#2a2a2a' : '#eee',
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginBottom: 12,
    },
    optionIcon: {
      marginRight: 16,
    },
    optionText: {
      flex: 1,
      color: darkMode ? '#fff' : '#000',
      fontSize: 16,
    },
  });
