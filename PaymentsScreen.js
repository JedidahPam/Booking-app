import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, SafeAreaView
} from 'react-native';
import { useTheme } from './ThemeContext'; // 👈 Your theme context
import { CardField, useStripe, StripeProvider } from '@stripe/stripe-react-native';

// Replace with your Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51RgPPsIEq6B8XLxXcWWOLaRJfMFjKVZ0hlsKa4esXIvH2dfOtX0BtaBFod9RMUb3X3zmlZwnAeDRTyAP4IKXuMwv00C3FOcbwg';

const BASE_URL = 'http://172.20.34.48:3000/api';


export default function PaymentsScreen({ route }) {
  const { darkMode } = useTheme();
  const styles = createStyles(darkMode);

  // If navigating from TravelDetailsScreen, get ride info from route params:
  const {
    pickup = 'Station A',
    dropoff = 'Station B',
    rideId = 'ride_123',
    price = '10.00',
    distance = '5km',
    selectedTransport = 'taxi',
  } = route?.params || {};

  const { createPaymentMethod } = useStripe();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [paymentMethodId, setPaymentMethodId] = useState(null);
  const [amount, setAmount] = useState(price); // default to passed price
  const [loading, setLoading] = useState(false);
  const [cardDetails, setCardDetails] = useState(null);

  // Create Stripe Customer on your backend
  const createCustomer = async () => {
    if (!email || !name) {
      Alert.alert('Validation', 'Please enter both name and email.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/create-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (res.ok) {
        setCustomerId(data.id);
        Alert.alert('Success', 'Customer created!');
      } else {
        Alert.alert('Error', data.message || 'Failed to create customer');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
    setLoading(false);
  };

  // Use Stripe SDK to create payment method from card input
  const createPaymentMethodHandler = async () => {
    if (!customerId) {
      Alert.alert('Error', 'Create a customer first.');
      return;
    }
    if (!cardDetails?.complete) {
      Alert.alert('Validation', 'Please enter complete card details.');
      return;
    }

    setLoading(true);
    const { paymentMethod, error } = await createPaymentMethod({
      type: 'Card',
      card: cardDetails,
    });

    if (error) {
      Alert.alert('Payment Method Error', error.message);
      setLoading(false);
      return;
    }

    setPaymentMethodId(paymentMethod.id);
    Alert.alert('Success', 'Payment method created!');
    setLoading(false);
  };

  // Attach payment method to customer via backend
  const attachPaymentMethod = async () => {
    if (!customerId || !paymentMethodId) {
      Alert.alert('Error', 'Customer or payment method missing.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/attach-payment-method`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId, customerId }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', 'Payment method attached to customer!');
      } else {
        Alert.alert('Error', data.message || 'Failed to attach payment method');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
    setLoading(false);
  };

  // Create ride payment on backend
  const createRidePayment = async () => {
    if (!customerId || !paymentMethodId) {
      Alert.alert('Error', 'Customer or payment method missing.');
      return;
    }
    if (!amount || isNaN(amount)) {
      Alert.alert('Validation', 'Please enter a valid amount.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/create-ride-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paymentMethodId,
          customerId,
          rideDetails: {
            rideId,
            pickup,
            dropoff,
            distance,
            selectedTransport,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', 'Ride payment successful!');
      } else {
        Alert.alert('Error', data.message || 'Failed to process payment');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
    setLoading(false);
  };

  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.heading}>Stripe Payment Integration</Text>

          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={darkMode ? '#888' : '#999'}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={darkMode ? '#888' : '#999'}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.button} onPress={createCustomer} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Customer</Text>}
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 20, marginBottom: 10 }]}>Card Details</Text>

          <CardField
            postalCodeEnabled={false}
            placeholder={{
              number: '4242 4242 4242 4242',
            }}
            cardStyle={{
              backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
              textColor: darkMode ? '#fff' : '#000',
            }}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 12,
              marginBottom: 20,
            }}
            onCardChange={(card) => {
              setCardDetails(card);
            }}
          />

          <TouchableOpacity
            style={[styles.button]}
            onPress={createPaymentMethodHandler}
            disabled={loading || !customerId}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Payment Method</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { marginTop: 10 }]}
            onPress={attachPaymentMethod}
            disabled={loading || !customerId || !paymentMethodId}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Attach Payment Method</Text>}
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { marginTop: 20 }]}
            placeholder="Amount"
            placeholderTextColor={darkMode ? '#888' : '#999'}
            value={amount.toString()}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={[styles.button, { marginTop: 10 }]}
            onPress={createRidePayment}
            disabled={loading || !customerId || !paymentMethodId || !amount}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pay for Ride</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </StripeProvider>
  );
}

// ✅ Dynamic style generator
const createStyles = (darkMode) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: darkMode ? '#1a1a1a' : '#f2f2f2',
    },
    container: {
      padding: 20,
      paddingTop: 40,
      flexGrow: 1,
      backgroundColor: darkMode ? '#1a1a1a' : '#fff',
    },
    heading: {
      fontSize: 24,
      fontWeight: '700',
      color: darkMode ? '#FFA500' : '#333',
      marginBottom: 30,
      textAlign: 'center',
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: darkMode ? '#fff' : '#000',
    },
    input: {
      backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
      color: darkMode ? '#fff' : '#000',
      borderRadius: 12,
      paddingHorizontal: 15,
      paddingVertical: 14,
      fontSize: 16,
      marginBottom: 12,
      borderColor: darkMode ? '#444' : '#ccc',
      borderWidth: 1,
    },
    button: {
      backgroundColor: '#FFA500',
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonText: {
      color: '#1a1a1a',
      fontWeight: '700',
      fontSize: 16,
    },
  });
