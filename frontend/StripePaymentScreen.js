import React, { useState, useEffect } from 'react';
import { View, Button, Alert, ActivityIndicator } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';

export default function StripePaymentScreen({ route, navigation }) {
  const { amount } = route.params || { amount: 1000 }; // Amount in smallest currency unit (e.g. kobo for NGN)
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);

  useEffect(() => {
    fetchPaymentIntentClientSecret();
  }, []);

  // Replace the URL with your backend endpoint that creates a PaymentIntent
  async function fetchPaymentIntentClientSecret() {
    setLoading(true);
    try {
      const response = await fetch('https://your-backend.com/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }), // amount in smallest currency unit
      });
      const { clientSecret } = await response.json();
      setClientSecret(clientSecret);
    } catch (error) {
      Alert.alert('Error', 'Unable to fetch payment details');
    } finally {
      setLoading(false);
    }
  }

  async function openPaymentSheet() {
    if (!clientSecret) {
      Alert.alert('Error', 'Payment not initialized');
      return;
    }
    setLoading(true);

    // Initialize payment sheet
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      merchantDisplayName: 'Local Transport Booking',
    });

    if (initError) {
      Alert.alert('Error', initError.message);
      setLoading(false);
      return;
    }

    // Present payment sheet UI
    const { error: paymentError } = await presentPaymentSheet();

    if (paymentError) {
      Alert.alert('Payment failed', paymentError.message);
    } else {
      Alert.alert('Success', 'Payment completed successfully!');
      // Navigate or update UI as needed
      navigation.goBack();
    }
    setLoading(false);
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', margin: 20 }}>
      {loading && <ActivityIndicator size="large" color="#0000ff" />}
      {!loading && (
        <Button title="Pay Now" onPress={openPaymentSheet} disabled={!clientSecret} />
      )}
    </View>
  );
}
