import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { auth, storage } from './firebaseConfig'; // You still use firebase storage SDK for images
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useTheme } from './ThemeContext';

const FIRESTORE_API_KEY = 'YOUR_FIRESTORE_API_KEY'; // Replace with your actual key
const PROJECT_ID = 'local-transport-booking-app'; // Your Firebase project ID
const DATABASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export default function DriverProfile() {
  const { darkMode } = useTheme();
  const styles = createStyles(darkMode);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const userId = auth.currentUser?.uid;

  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    vehicleMake: '',
    vehicleModel: '',
    vehiclePlate: '',
    licenseNumber: '',
    licenseExpiry: '',
    profilePicUrl: '',
  });

  // Fetch driver profile from Firestore REST API
 const fetchProfile = async () => {
  if (!userId) return;
  setLoading(true);
  try {
    const res = await fetch(`${DATABASE_URL}/drivers/${userId}?key=${FIRESTORE_API_KEY}`);
    if (!res.ok) {
      if (res.status === 404) {
        await createDefaultProfile();
        return;
      }
      throw new Error(`Failed to fetch profile: ${res.status}`);
    }
    const data = await res.json();
    const fields = data.fields || {};

    const vehicleInfo = fields.vehicleInfo?.mapValue?.fields || {};

   const firstname = fields.firstname?.stringValue || '';
const lastname = fields.lastname?.stringValue || '';

setProfile({
  fullName: `${firstname} ${lastname}`.trim(),
  email: fields.email?.stringValue || auth.currentUser.email || '',
  phone: fields.phone?.stringValue || '',
  vehicleMake: vehicleInfo.make?.stringValue || '',
  vehicleModel: vehicleInfo.model?.stringValue || '',
  vehiclePlate: vehicleInfo.plateNumber?.stringValue || '',
  licenseNumber: fields.licenseNumber?.stringValue || '',
  licenseExpiry: fields.licenseExpiry?.stringValue || '',
  profilePicUrl: fields.profilePicUrl?.stringValue || '',
});

  } catch (error) {
    console.error('Fetch profile error:', error);
    Alert.alert('Error', 'Failed to load profile data.');
  } finally {
    setLoading(false);
  }
};


  // Create default empty profile doc for new driver
  const createDefaultProfile = async () => {
    try {
      const defaultDoc = {
        fields: {
          fullName: { stringValue: '' },
          email: { stringValue: auth.currentUser.email || '' },
          phone: { stringValue: '' },
          vehicleMake: { stringValue: '' },
          vehicleModel: { stringValue: '' },
          vehiclePlate: { stringValue: '' },
          licenseNumber: { stringValue: '' },
          licenseExpiry: { stringValue: '' },
          profilePicUrl: { stringValue: '' },
        },
      };

      const res = await fetch(`${DATABASE_URL}/drivers/${userId}?key=${FIRESTORE_API_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultDoc),
      });

      if (!res.ok) {
        throw new Error('Failed to create default profile');
      }
      // After creating, fetch profile to update UI
      fetchProfile();
    } catch (error) {
      console.error('Create default profile error:', error);
      Alert.alert('Error', 'Failed to create profile.');
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const onChangeField = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  // Save profile to Firestore REST API
 const saveProfile = async () => {
  if (!userId) return;
  setSaving(true);
  try {
    // Split fullName into firstname and lastname
const nameParts = profile.fullName.trim().split(' ');
const firstname = nameParts.shift() || '';
const lastname = nameParts.join(' ') || '';

const body = {
  fields: {
    firstname: { stringValue: firstname },
    lastname: { stringValue: lastname },
    email: { stringValue: profile.email },
    phone: { stringValue: profile.phone },
    licenseNumber: { stringValue: profile.licenseNumber },
    licenseExpiry: { stringValue: profile.licenseExpiry },
    profilePicUrl: { stringValue: profile.profilePicUrl },
    vehicleInfo: {
      mapValue: {
        fields: {
          make: { stringValue: profile.vehicleMake },
          model: { stringValue: profile.vehicleModel },
          plateNumber: { stringValue: profile.vehiclePlate },
        }
      }
    }
  }
};


    const updateMaskFields = Object.keys(body.fields);

    const url = `${DATABASE_URL}/drivers/${userId}?key=${FIRESTORE_API_KEY}&updateMask.fieldPaths=${updateMaskFields.join('&updateMask.fieldPaths=')}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Save profile error:', errorText);
      throw new Error(`Failed to save profile: ${res.status}`);
    }
    Alert.alert('Success', 'Profile saved!');
  } catch (error) {
    console.error('Save failed:', error);
    Alert.alert('Error', 'Failed to save profile.');
  } finally {
    setSaving(false);
  }
};

  // Image picker & upload logic remains same, uploading to Firebase Storage
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Permission to access gallery is required!');
      return;
    }
    let pickerResult = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.7,
      aspect: [1, 1],
    });
    if (pickerResult.cancelled) return;

    setSaving(true);
    try {
      const response = await fetch(pickerResult.uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `drivers/${userId}/profilePic.jpg`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      setProfile(prev => ({ ...prev, profilePicUrl: downloadURL }));
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert('Error', 'Failed to upload profile picture.');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFA500" />
      </View>
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Driver Profile</Text>

        <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
          {profile.profilePicUrl ? (
            <Image source={{ uri: profile.profilePicUrl }} style={styles.profileImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>Tap to add profile picture</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Text inputs */}
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={profile.fullName}
          onChangeText={text => onChangeField('fullName', text)}
          placeholder="Full Name"
          placeholderTextColor="#bbb"
        />

        <Text style={styles.label}>Email (read-only)</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={profile.email}
          editable={false}
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={profile.phone}
          onChangeText={text => onChangeField('phone', text)}
          keyboardType="phone-pad"
          placeholder="Phone Number"
          placeholderTextColor="#bbb"
        />

        <Text style={styles.sectionHeader}>Vehicle Info</Text>

        <Text style={styles.label}>Make</Text>
        <TextInput
          style={styles.input}
          value={profile.vehicleMake}
          onChangeText={text => onChangeField('vehicleMake', text)}
          placeholder="Vehicle Make"
          placeholderTextColor="#bbb"
        />

        <Text style={styles.label}>Model</Text>
        <TextInput
          style={styles.input}
          value={profile.vehicleModel}
          onChangeText={text => onChangeField('vehicleModel', text)}
          placeholder="Vehicle Model"
          placeholderTextColor="#bbb"
        />

        <Text style={styles.label}>Plate Number</Text>
        <TextInput
          style={styles.input}
          value={profile.vehiclePlate}
          onChangeText={text => onChangeField('vehiclePlate', text)}
          placeholder="Plate Number"
          placeholderTextColor="#bbb"
        />

        <Text style={styles.sectionHeader}>License Info</Text>

        <Text style={styles.label}>License Number</Text>
        <TextInput
          style={styles.input}
          value={profile.licenseNumber}
          onChangeText={text => onChangeField('licenseNumber', text)}
          placeholder="License Number"
          placeholderTextColor="#bbb"
        />

        <Text style={styles.label}>License Expiry (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={profile.licenseExpiry}
          onChangeText={text => onChangeField('licenseExpiry', text)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#bbb"
        />

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveProfile}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#1a1a1a" /> : <Text style={styles.saveButtonText}>Save Profile</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (darkMode) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: darkMode ? '#121212' : '#fff',
    },
    container: {
      padding: 20,
      backgroundColor: darkMode ? '#121212' : '#fff',
      flexGrow: 1,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      marginBottom: 20,
      color: darkMode ? '#FFA500' : '#007bff',
      textAlign: 'center',
    },
    imageContainer: {
      alignSelf: 'center',
      marginBottom: 20,
      borderRadius: 60,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: darkMode ? '#FFA500' : '#007bff',
    },
    profileImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
    },
    placeholderImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: darkMode ? '#333' : '#ddd',
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderText: {
      color: darkMode ? '#aaa' : '#666',
    },
    label: {
      color: darkMode ? '#FFA500' : '#007bff',
      fontWeight: '600',
      marginBottom: 6,
    },
    input: {
      backgroundColor: darkMode ? '#222' : '#f0f0f0',
      color: darkMode ? '#fff' : '#000',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 15,
      fontSize: 16,
    },
    readOnlyInput: {
      backgroundColor: darkMode ? '#333' : '#e0e0e0',
      color: darkMode ? '#aaa' : '#888',
    },
    sectionHeader: {
      color: darkMode ? '#FFA500' : '#007bff',
      fontSize: 20,
      fontWeight: '700',
      marginTop: 30,
      marginBottom: 12,
    },
    saveButton: {
      backgroundColor: darkMode ? '#FFA500' : '#007bff',
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 30,
      alignItems: 'center',
      shadowColor: darkMode ? '#ffa500' : '#007bff',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.8,
      shadowRadius: 5,
      elevation: 5,
    },
    saveButtonDisabled: {
      backgroundColor: '#666',
      shadowOpacity: 0.3,
      elevation: 1,
    },
    saveButtonText: {
      color: darkMode ? '#1a1a1a' : '#fff',
      fontWeight: '700',
      fontSize: 18,
    },
  });
