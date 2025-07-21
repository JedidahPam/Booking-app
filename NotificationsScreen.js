import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Button,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNotifications(data);
      },
      (error) => {
        console.log('Firestore onSnapshot error:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const markAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
      });
    } catch (error) {
      console.log('Error marking notification as read:', error);
      Alert.alert('Error', 'Could not mark notification as read.');
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (error) {
      console.log('Error deleting notification:', error);
      Alert.alert('Error', 'Could not delete notification.');
    }
  };

  const handleLongPress = (item) => {
    Alert.alert(
      'Delete Notification?',
      `Are you sure you want to delete "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNotification(item.id),
        },
      ]
    );
  };

  // Function to add sample notification (for testing)
  const addSampleNotification = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Not logged in', 'Please log in to add notifications.');
      return;
    }

    try {
      await addDoc(collection(db, 'notifications'), {
        userId: uid,
        title: 'Welcome!',
        body: 'Thanks for signing up. This is a sample notification.',
        read: false,
        timestamp: serverTimestamp(),
      });
      Alert.alert('Notification added', 'Sample notification created.');
    } catch (error) {
      console.error('Error adding notification:', error);
      Alert.alert('Error', 'Failed to add sample notification.');
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => !item.read && markAsRead(item.id)}
      onLongPress={() => handleLongPress(item)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.notificationCard,
          !item.read && styles.unreadNotification,
        ]}
      >
        <View style={styles.iconRow}>
          <Ionicons
            name={
              item.title?.toLowerCase().includes('ride')
                ? 'car-outline'
                : 'notifications-outline'
            }
            size={20}
            color="#FFA500"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.title}>{item.title}</Text>
        </View>
        <Text style={styles.body}>{item.body}</Text>
        {item.timestamp && (
          <Text style={styles.timestamp}>
            {new Date(item.timestamp?.toDate?.() ?? item.timestamp).toLocaleString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Notifications</Text>

      <Button title="Add Sample Notification" onPress={addSampleNotification} color="#FFA500" />

      {notifications.length === 0 ? (
        <Text style={styles.emptyMessage}>No notifications yet.</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFA500"
            />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFA500',
    marginBottom: 12,
    textAlign: 'center',
  },
  notificationCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    color: '#FFA500',
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },
  emptyMessage: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
});
