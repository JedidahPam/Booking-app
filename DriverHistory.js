import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, SafeAreaView, Alert
} from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

export default function DriverHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const driverId = auth.currentUser?.uid;
      const q = query(
        collection(db, 'rides'),
        where('status', '==', 'completed'),
        where('acceptedBy', '==', driverId)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setHistory(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not load trip history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.label}>Pickup:</Text>
      <Text style={styles.value}>{item.pickupLocation?.mapValue?.fields?.address?.stringValue || 'N/A'}</Text>

      <Text style={styles.label}>Drop-off:</Text>
      <Text style={styles.value}>{item.dropoffLocation?.mapValue?.fields?.address?.stringValue || 'N/A'}</Text>

      <Text style={styles.label}>Fare:</Text>
      <Text style={styles.value}>${item.finalFare?.doubleValue || 'N/A'}</Text>

      <Text style={styles.label}>Distance:</Text>
      <Text style={styles.value}>{item.distance?.doubleValue || 'N/A'} km</Text>

      <Text style={styles.label}>Completed:</Text>
      <Text style={styles.value}>{item.endTime?.timestampValue ? new Date(item.endTime.timestampValue).toLocaleString() : 'N/A'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Trip History</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#FFA500" />
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.emptyText}>No completed trips yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  title: {
    fontSize: 24,
    color: '#FFA500',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
  },
  label: {
    color: '#FFB84D',
    fontSize: 14,
  },
  value: {
    color: '#FFA500',
    fontSize: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#FFB84D',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
});
