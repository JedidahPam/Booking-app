import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Alert, Image, ActionSheetIOS, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { auth, db } from './firebaseConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { uploadImageToStorage, STORAGE_FOLDERS } from './storageUtils';

const getUserDocId = () => auth.currentUser?.uid || null;

// Helper function to validate image URLs
const isValidImageUrl = (url) => {
  if (!url) return false;
  // Check if it's a valid HTTP/HTTPS URL
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

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
  const imageRef = useRef(null);

  // Fetch profile from Firestore
  const fetchProfile = async () => {
    setLoading(true);
    try {
      if (!userDocId) {
        throw new Error('User not authenticated');
      }

      const docRef = doc(db, 'users', userDocId);
      const docSnap = await getDoc(docRef);
     
      if (docSnap.exists()) {
        const data = docSnap.data();
       
        setProfile({
          firstname: data.firstname || '',
          lastname: data.lastname || '',
          phone: data.phone || '',
          // Only set profileImage if it's a valid URL
          profileImage: isValidImageUrl(data.profileImage) ? data.profileImage : '',
          address: {
            street: data.address?.street || '',
            city: data.address?.city || '',
            state: data.address?.state || '',
            zipcode: data.address?.zipcode || '',
          },
        });

        // If the stored profileImage was invalid, update Firestore to clear it
        if (data.profileImage && !isValidImageUrl(data.profileImage)) {
          console.log('Clearing invalid profile image URL from database:', data.profileImage);
          await updateDoc(docRef, { profileImage: '' });
        }
      } else {
        await createDefaultProfile();
      }
    } catch (error) {
      console.error('Fetch profile error:', error);
      Alert.alert('Error', `Failed to load profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultProfile = async () => {
    try {
      if (!userDocId) {
        throw new Error('User not authenticated');
      }

      const defaultProfile = {
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
        createdAt: new Date(),
        email: auth.currentUser?.email || '',
      };

      const docRef = doc(db, 'users', userDocId);
      await setDoc(docRef, defaultProfile);
     
      setProfile(defaultProfile);
    } catch (error) {
      console.error('Create default profile error:', error);
      Alert.alert('Error', `Failed to create profile: ${error.message}`);
    }
  };

  useEffect(() => {
    if (userDocId) {
      fetchProfile();
    } else {
      Alert.alert('Error', 'User not authenticated. Please log in again.');
    }
  }, [userDocId]);

  const saveProfile = async (profileData = profile) => {
    setSaving(true);
    try {
      if (!userDocId) {
        throw new Error('User not authenticated');
      }

      const docRef = doc(db, 'users', userDocId);
      await updateDoc(docRef, {
        firstname: profileData.firstname,
        lastname: profileData.lastname,
        phone: profileData.phone,
        profileImage: profileData.profileImage,
        address: profileData.address,
        updatedAt: new Date(),
      });

      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('Error', `Failed to save profile: ${error.message}`);
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

  // ===== Image Upload using Storage Utils =====
  const uploadProfileImage = async (localUri) => {
    setUploadingImage(true);
    try {
      if (!userDocId) {
        throw new Error('User not authenticated');
      }

      console.log('Old image URL for deletion:', profile.profileImage);

      const downloadURL = await uploadImageToStorage(
        localUri,
        STORAGE_FOLDERS.PROFILE_IMAGES,
        userDocId,
        profile.profileImage // This will delete the old image
      );
      
      console.log('New image download URL from storage utility:', downloadURL);
      
      const updatedProfile = { ...profile, profileImage: downloadURL };
      setProfile(updatedProfile);
      
      console.log('Profile state after setProfile (new image URL):', updatedProfile.profileImage);

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
      uploadProfileImage(result.assets[0].uri);
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
      uploadProfileImage(result.assets[0].uri);
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
          ) : (profile.profileImage && isValidImageUrl(profile.profileImage)) ? (
            <Image
              ref={imageRef}
              key={profile.profileImage + '?t=' + new Date().getTime()}
              source={{ uri: profile.profileImage }}
              style={styles.profileImage}
              onError={(e) => {
                console.error('Image loading error:', e.nativeEvent.error);
                // Clear invalid image URL from profile
                console.log('Clearing invalid image URL from state');
                setProfile(prev => ({ ...prev, profileImage: '' }));
              }}
              onLoad={() => console.log('Image loaded successfully from URI:', profile.profileImage)}
              onLoadStart={() => console.log('Image load started for URI:', profile.profileImage)}
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