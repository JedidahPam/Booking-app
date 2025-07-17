import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

export default function VerifyOtpScreen({ route, navigation }) {
  const { verificationId, phone } = route.params;
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!otpCode || otpCode.length < 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP code.');
      return;
    }

    try {
      setLoading(true);

      const credential = PhoneAuthProvider.credential(verificationId, otpCode);
      await signInWithCredential(auth, credential);

      const uid = auth.currentUser.uid;

      // ✅ Mark user as phone-verified in Firestore
      await updateDoc(doc(db, 'users', uid), {
        isPhoneVerified: true,
      });

      Alert.alert('Success', 'Phone number verified!');

      // ✅ Navigate back to SignUp screen
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert('Verification Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter OTP sent to {phone}</Text>
      <TextInput
        style={styles.input}
        placeholder="OTP Code"
        placeholderTextColor="#888"
        keyboardType="number-pad"
        value={otpCode}
        onChangeText={setOtpCode}
        maxLength={6}
      />
      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Verify OTP</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  title: {
    fontSize: 22,
    color: '#FFA500',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    color: '#fff',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#FFA500',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '600',
  },
});
