import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Alert, Image, ActionSheetIOS, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { getAuth } from 'firebase/auth';

const FIRESTORE_API_KEY = 'AIzaSyAZf-KMgaokOF-PVhxgXG64bxWK28_h9-0';
const PROJECT_ID = 'local-transport-booking-app';
const DATABASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Cloudinary config — REPLACE with your details
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dgkethsxx/image/upload';
const CLOUDINARY_UPLOAD_PRESET = 'profile_images';

const auth = getAuth(); // Make sure firebaseApp is initialized elsewhere
const getUserDocId = () => auth.currentUser?.uid || null;

export default function ProfileScreen() {
  const { darkMode } = useTheme();
  const styles = createStyles(darkMode);
  const userDocId = getUserDocId();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profile, setProfile] = useState({
    firstname: '',
    lastname: '',
    phone: '',
    profileImage: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipcode: '',
    },
  });

  // Fetch profile from Firestore REST API
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${DATABASE_URL}/users/${userDocId}?key=${FIRESTORE_API_KEY}`);
      
      if (!res.ok) {
        if (res.status === 404) {
          await createDefaultProfile();
          return;
        }
        throw new Error(`Failed to fetch profile: ${res.status}`);
      }
      
      const data = await res.json();
      const fields = data.fields || {};
      
      setProfile({
        firstname: fields.firstname?.stringValue || '',
        lastname: fields.lastname?.stringValue || '',
        phone: fields.phone?.stringValue || '',
        profileImage: fields.profileImage?.stringValue || '',
        address: {
          street: fields.address?.mapValue?.fields?.street?.stringValue || '',
          city: fields.address?.mapValue?.fields?.city?.stringValue || '',
          state: fields.address?.mapValue?.fields?.state?.stringValue || '',
          zipcode: fields.address?.mapValue?.fields?.zipcode?.stringValue || '',
        },
      });
    } catch (error) {
      console.error('Fetch profile error:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultProfile = async () => {
    try {
      const defaultProfile = {
        fields: {
          firstname: { stringValue: '' },
          lastname: { stringValue: '' },
          phone: { stringValue: '' },
          profileImage: { stringValue: '' },
          address: {
            mapValue: {
              fields: {
                street: { stringValue: '' },
                city: { stringValue: '' },
                state: { stringValue: '' },
                zipcode: { stringValue: '' },
              },
            },
          },
        },
      };

      const res = await fetch(`${DATABASE_URL}/users/${userDocId}?key=${FIRESTORE_API_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultProfile),
      });

      if (!res.ok) {
        throw new Error('Failed to create default profile');
      } else {
        // After creation, fetch profile again to update UI
        fetchProfile();
      }
    } catch (error) {
      console.error('Create default profile error:', error);
      Alert.alert('Error', 'Failed to create profile. Please try again.');
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const saveProfile = async (profileData = profile) => {
    setSaving(true);
    try {
      const body = {
        fields: {
          firstname: { stringValue: profileData.firstname },
          lastname: { stringValue: profileData.lastname },
          phone: { stringValue: profileData.phone },
          profileImage: { stringValue: profileData.profileImage },
          address: {
            mapValue: {
              fields: {
                street: { stringValue: profileData.address.street },
                city: { stringValue: profileData.address.city },
                state: { stringValue: profileData.address.state },
                zipcode: { stringValue: profileData.address.zipcode },
              },
            },
          },
        },
      };

      const updateMaskFields = [
        'firstname', 'lastname', 'phone', 'profileImage',
        'address.street', 'address.city', 'address.state', 'address.zipcode',
      ];

      const url = `${DATABASE_URL}/users/${userDocId}?key=${FIRESTORE_API_KEY}&updateMask.fieldPaths=${updateMaskFields.join('&updateMask.fieldPaths=')}`;

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Server response:', errorText);
        throw new Error(`Failed to update profile: ${res.status}`);
      }

      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Helper to handle text input changes on profile fields
  const handleInputChange = (key, value) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  // Helper to handle address input changes
  const handleAddressChange = (key, value) => {
    setProfile(prev => ({
      ...prev,
      address: { ...prev.address, [key]: value }
    }));
  };

  // ===== Image picking & uploading logic =====

  // Upload image helper (used by both camera & gallery pickers)
  const uploadImage = async (localUri) => {
    setUploadingImage(true);
    try {
      const response = await fetch(localUri);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('file', {
        uri: localUri,
        type: blob.type || 'image/jpeg',
        name: `upload_${Date.now()}.jpg`,
      });
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const uploadResponse = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error?.message || 'Cloudinary upload failed');
      }

      const updatedProfile = { ...profile, profileImage: uploadResult.secure_url };
      setProfile(updatedProfile);
      await saveProfile(updatedProfile);
      Alert.alert('Success', 'Profile image updated successfully!');
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Opens camera to take photo
  const openCamera = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPermission.status !== 'granted') {
      Alert.alert('Permission denied', 'Camera permission is required!');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  // Opens gallery picker
  const openGallery = async () => {
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (mediaPermission.status !== 'granted') {
      Alert.alert('Permission denied', 'Media library permission is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  // Presents user with option to choose camera or gallery
  const chooseImageSource = async () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
          cancelButtonIndex: 0,
        },
        buttonIndex => {
          if (buttonIndex === 1) {
            openCamera();
          } else if (buttonIndex === 2) {
            openGallery();
          }
        }
      );
    } else {
      Alert.alert(
        'Select Image Source',
        'Choose the image source',
        [
          { text: 'Camera', onPress: openCamera },
          { text: 'Gallery', onPress: openGallery },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={darkMode ? '#FFA500' : '#4A90E2'} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

       <TouchableOpacity 
  onPress={chooseImageSource} 
  style={styles.imagePicker}
  disabled={uploadingImage}
>
  {uploadingImage ? (
  <View style={styles.profileImageContainer}>
    <ActivityIndicator size="large" color="#FFA500" />
  </View>
) : profile.profileImage ? (
  <Image
    key={profile.profileImage}
    source={{ uri: profile.profileImage, cache: 'reload' }}
    style={styles.profileImage}
  />
) : (
  <Ionicons name="person-circle-outline" size={120} color={darkMode ? '#888' : '#ccc'} />
)}


  <Text style={styles.changePhotoText}>
    {uploadingImage ? 'Uploading...' : 'Tap to change photo'}
  </Text>
</TouchableOpacity>


        {/* Basic Information */}
        {[
          { label: 'First Name', key: 'firstname' },
          { label: 'Last Name', key: 'lastname' },
          { label: 'Phone Number', key: 'phone', keyboardType: 'phone-pad' },
        ].map(({ label, key, keyboardType }) => (
          <View style={styles.inputGroup} key={key}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              value={profile[key]}
              onChangeText={text => handleInputChange(key, text)}
              placeholder={label}
              placeholderTextColor={darkMode ? '#888' : '#999'}
              keyboardType={keyboardType}
            />
          </View>
        ))}

        {/* Address Information */}
        <Text style={styles.sectionTitle}>Address</Text>
        {[
          { label: 'Street', key: 'street' },
          { label: 'City', key: 'city' },
          { label: 'State', key: 'state' },
          { label: 'Zip Code', key: 'zipcode', keyboardType: 'numeric' },
        ].map(({ label, key, keyboardType }) => (
          <View style={styles.inputGroup} key={key}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              value={profile.address[key]}
              onChangeText={text => handleAddressChange(key, text)}
              placeholder={label}
              placeholderTextColor={darkMode ? '#888' : '#999'}
              keyboardType={keyboardType}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.saveButton, (saving || uploadingImage) && styles.disabledButton]}
          onPress={() => saveProfile()}
          disabled={saving || uploadingImage}
        >
          {saving ? (
            <ActivityIndicator color={darkMode ? '#1a1a1a' : '#fff'} />
          ) : (
            <Text style={styles.saveButtonText}>Save Profile</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// Dynamic styles generator
const createStyles = (darkMode) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: darkMode ? '#1a1a1a' : '#f2f2f2',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: darkMode ? '#1a1a1a' : '#fff',
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: darkMode ? '#FFA500' : '#333',
  },
  imagePicker: {
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: darkMode ? '#444' : '#ddd',
  },
  changePhotoText: {
    color: '#FFA500',
    fontSize: 14,
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: darkMode ? '#FFA500' : '#333',
    marginBottom: 15,
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    color: darkMode ? '#FFA500' : '#333',
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: darkMode ? '#fff' : '#000',
    borderWidth: 1,
    borderColor: darkMode ? '#444' : '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#FFA500',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#888',
  },
  saveButtonText: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: darkMode ? '#1a1a1a' : '#f2f2f2',
  },
  loadingText: {
    color: darkMode ? '#FFA500' : '#333',
    fontSize: 16,
    marginTop: 10,
  },
  profileImageContainer: {
  width: 120,
  height: 120,
  borderRadius: 60,
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: darkMode ? '#444' : '#ddd',
  backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
},

});
