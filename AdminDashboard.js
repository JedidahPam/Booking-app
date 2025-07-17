// AdminDashboard.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const usersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(usersList);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <Text style={styles.name}>{item.name || 'Unnamed User'}</Text>
            <Text style={styles.email}>{item.email}</Text>
            <Text style={styles.role}>{item.isAdmin ? 'Admin' : 'User'}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  userCard: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  name: { fontSize: 18, fontWeight: 'bold' },
  email: { fontSize: 16, color: '#555' },
  role: { fontSize: 14, color: '#007bff' },
});
