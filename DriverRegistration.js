import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, KeyboardAvoidingView, Platform, SafeAreaView
} from 'react-native';

export default function DriverRegistration({ route, navigation }) {
  const { uid } = route.params;

  const [licenseNumber, setLicenseNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [driverLicenseUrl, setDriverLicenseUrl] = useState('');
  const [vehicleRegistrationUrl, setVehicleRegistrationUrl] = useState('');
  const [insuranceUrl, setInsuranceUrl] = useState('');

  const API_KEY = 'AIzaSyAZf-KMgaokOF-PVhxgXG64bxWK28_h9-0';

  const handleConfirm = async () => {
    if (!licenseNumber || !make || !model || !year || !color || !plateNumber || !capacity) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const payload = {
      fields: {
        licenseNumber: { stringValue: licenseNumber },
        vehicleInfo: {
          mapValue: {
            fields: {
              make: { stringValue: make },
              model: { stringValue: model },
              year: { integerValue: parseInt(year, 10) }, // convert string to int
              color: { stringValue: color },
              plateNumber: { stringValue: plateNumber },
              capacity: { integerValue: parseInt(capacity, 10) }, // convert string to int
            },
          },
        },
        documents: {
          mapValue: {
            fields: {
              driverLicense: { stringValue: driverLicenseUrl },
              vehicleRegistration: { stringValue: vehicleRegistrationUrl },
              insurance: { stringValue: insuranceUrl },
            },
          },
        },
      },
    };

    try {
      // Use PATCH and include doc path in URL for specific docId
      const url = `https://firestore.googleapis.com/v1/projects/local-transport-booking-app/databases/(default)/documents/drivers/${uid}?key=${API_KEY}`;

      const response = await fetch(url, {
        method: 'PATCH', // PATCH to create/overwrite specific document
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      Alert.alert('Success', 'Driver registration completed. Please sign in.');
      navigation.navigate('SignIn');
    } catch (error) {
      Alert.alert('Error', `Failed to save registration: ${error.message}`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
               <Text style={styles.backButtonText}>← Go Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Driver Registration</Text>

          <TextInput
            style={styles.input}
            placeholder="License Number"
            placeholderTextColor="#888"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
          />

          <TextInput
            style={styles.input}
            placeholder="Vehicle Make"
            placeholderTextColor="#888"
            value={make}
            onChangeText={setMake}
          />

          <TextInput
            style={styles.input}
            placeholder="Vehicle Model"
            placeholderTextColor="#888"
            value={model}
            onChangeText={setModel}
          />

          <TextInput
            style={styles.input}
            placeholder="Vehicle Year"
            placeholderTextColor="#888"
            keyboardType="numeric"
            value={year}
            onChangeText={setYear}
          />

          <TextInput
            style={styles.input}
            placeholder="Vehicle Color"
            placeholderTextColor="#888"
            value={color}
            onChangeText={setColor}
          />

          <TextInput
            style={styles.input}
            placeholder="Plate Number"
            placeholderTextColor="#888"
            value={plateNumber}
            onChangeText={setPlateNumber}
          />

          <TextInput
            style={styles.input}
            placeholder="Capacity"
            placeholderTextColor="#888"
            keyboardType="numeric"
            value={capacity}
            onChangeText={setCapacity}
          />

          <TextInput
            style={styles.input}
            placeholder="Driver License URL"
            placeholderTextColor="#888"
            value={driverLicenseUrl}
            onChangeText={setDriverLicenseUrl}
          />

          <TextInput
            style={styles.input}
            placeholder="Vehicle Registration URL"
            placeholderTextColor="#888"
            value={vehicleRegistrationUrl}
            onChangeText={setVehicleRegistrationUrl}
          />

          <TextInput
            style={styles.input}
            placeholder="Insurance URL"
            placeholderTextColor="#888"
            value={insuranceUrl}
            onChangeText={setInsuranceUrl}
          />

          <TouchableOpacity style={styles.button} onPress={handleConfirm}>
            <Text style={styles.buttonText}>Confirm Registration</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#1a1a1a', // dark background
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFA500', // bright orange
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2a2a2a', // dark input background
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    color: '#fff', // white text
    fontSize: 16,
  },
  button: {
    backgroundColor: '#FFA500', // orange button
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#1a1a1a', // dark text for contrast
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
  marginBottom: 16,
  alignSelf: 'flex-start',
  paddingHorizontal: 10,
  paddingVertical: 6,
  backgroundColor: '#333',
  borderRadius: 8,
},

backButtonText: {
  color: '#FFA500',
  fontSize: 16,
  fontWeight: '600',
},

});
