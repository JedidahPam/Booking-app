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
      <Text style={styles.value}>{item.pickup?.address || 'N/A'}</Text>

      <Text style={styles.label}>Drop-off:</Text>
      <Text style={styles.value}>{item.dropoff?.address || 'N/A'}</Text>

      <Text style={styles.label}>Fare:</Text>
      <Text style={styles.value}>${item.price || 'N/A'}</Text>

      <Text style={styles.label}>Payment Method:</Text>
      <Text style={styles.value}>{item.paymentMethod || 'N/A'}</Text>

      <Text style={styles.label}>Transport Type:</Text>
      <Text style={styles.value}>{item.transport || 'N/A'}</Text>

      <Text style={styles.label}>Status:</Text>
      <Text style={styles.value}>{item.status || 'N/A'}</Text>

      <Text style={styles.label}>Completed:</Text>
      <Text style={styles.value}>
        {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}
      </Text>

      <View style={styles.locationDetails}>
        <Text style={styles.label}>Pickup Coordinates:</Text>
        <Text style={styles.value}>
          {item.pickup?.latitude && item.pickup?.longitude 
            ? `${item.pickup.latitude}, ${item.pickup.longitude}` 
            : 'N/A'}
        </Text>

        <Text style={styles.label}>Drop-off Coordinates:</Text>
        <Text style={styles.value}>
          {item.dropoff?.latitude && item.dropoff?.longitude 
            ? `${item.dropoff.latitude}, ${item.dropoff.longitude}` 
            : 'N/A'}
        </Text>
      </View>
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
    fontWeight: '600',
    marginTop: 4,
  },
  value: {
    color: '#FFA500',
    fontSize: 16,
    marginBottom: 8,
  },
  locationDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  emptyText: {
    color: '#FFB84D',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
});