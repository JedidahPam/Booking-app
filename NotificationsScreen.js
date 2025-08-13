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
  ActivityIndicator,
  Modal,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from './firebaseConfig';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newNotification, setNewNotification] = useState({
    title: '',
    body: '',
  });
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all', 'unread', 'read'

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setError('User not authenticated');
          setLoading(false);
          return;
        }

        console.log('Fetching notifications for user:', uid);
        
        let q;
        if (selectedFilter === 'unread') {
          q = query(
            collection(db, 'notifications'),
            where('userId', '==', uid),
            where('read', '==', false)
          );
        } else if (selectedFilter === 'read') {
          q = query(
            collection(db, 'notifications'),
            where('userId', '==', uid),
            where('read', '==', true)
          );
        } else {
          q = query(
            collection(db, 'notifications'),
            where('userId', '==', uid)
          );
        }

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            console.log('Received snapshot with', snapshot.docs.length, 'documents');
            const data = snapshot.docs.map((doc) => {
              const docData = doc.data();
              console.log('Document data:', docData);
              return {
                id: doc.id,
                ...docData,
                timestamp: docData.timestamp?.toDate?.() || docData.timestamp
              };
            });
            
            // Sort by timestamp descending client-side
            const sortedData = data.sort((a, b) => {
              const timeA = a.timestamp?.getTime?.() || 0;
              const timeB = b.timestamp?.getTime?.() || 0;
              return timeB - timeA;
            });
            
            setNotifications(sortedData);
            setLoading(false);
            setError(null);
          },
          (error) => {
            console.error('Firestore error:', error);
            setError(`Failed to load notifications: ${error.message}`);
            setLoading(false);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error('Error in fetchNotifications:', error);
        setError('An unexpected error occurred');
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [selectedFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // You could add actual refresh logic here if needed
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setRefreshing(false);
    }
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

  const markAllAsRead = async () => {
    try {
      const batch = notifications
        .filter(notification => !notification.read)
        .map(notification => 
          updateDoc(doc(db, 'notifications', notification.id), { read: true })
        );
      
      await Promise.all(batch);
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.log('Error marking all as read:', error);
      Alert.alert('Error', 'Could not mark all notifications as read.');
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

  const deleteAllNotifications = async () => {
    Alert.alert(
      'Delete All Notifications?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              const batch = notifications.map(notification => 
                deleteDoc(doc(db, 'notifications', notification.id))
              );
              await Promise.all(batch);
            } catch (error) {
              console.log('Error deleting all notifications:', error);
              Alert.alert('Error', 'Could not delete all notifications.');
            }
          },
        },
      ]
    );
  };

  const handleLongPress = (item) => {
    Alert.alert(
      'Notification Options',
      `Choose an action for "${item.title}"`,
      [
        {
          text: 'Mark as Read',
          onPress: () => markAsRead(item.id),
          style: 'default',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNotification(item.id),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const addSampleNotification = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Not logged in', 'Please log in to add notifications.');
      return;
    }

    try {
      await addDoc(collection(db, 'notifications'), {
        userId: uid,
        title: 'Sample Notification',
        body: 'This is a test notification generated by the app.',
        read: false,
        timestamp: serverTimestamp(),
      });
      console.log('Sample notification added successfully');
    } catch (error) {
      console.error('Error adding notification:', error);
      Alert.alert('Error', 'Failed to add sample notification.');
    }
  };

  const handleAddNotification = async () => {
    if (!newNotification.title.trim() || !newNotification.body.trim()) {
      Alert.alert('Error', 'Please fill in both title and body');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      await addDoc(collection(db, 'notifications'), {
        userId: uid,
        title: newNotification.title,
        body: newNotification.body,
        read: false,
        timestamp: serverTimestamp(),
      });
      setNewNotification({ title: '', body: '' });
      setModalVisible(false);
      Alert.alert('Success', 'Notification added successfully');
    } catch (error) {
      console.error('Error adding notification:', error);
      Alert.alert('Error', 'Failed to add notification.');
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
                : item.title?.toLowerCase().includes('alert')
                ? 'alert-circle-outline'
                : 'notifications-outline'
            }
            size={20}
            color="#FFA500"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.title}>{item.title}</Text>
          {item.read ? (
            <Ionicons
              name="checkmark-done-outline"
              size={16}
              color="#4CAF50"
              style={{ marginLeft: 'auto' }}
            />
          ) : (
            <Ionicons
              name="ellipse"
              size={12}
              color="#FFA500"
              style={{ marginLeft: 'auto' }}
            />
          )}
        </View>
        <Text style={styles.body}>{item.body}</Text>
        {item.timestamp && (
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFA500" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button
          title="Retry"
          onPress={() => {
            setLoading(true);
            setError(null);
            setNotifications([]);
          }}
          color="#FFA500"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Notifications</Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={selectedFilter === 'all' ? styles.activeFilterText : styles.filterText}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setSelectedFilter('unread')}
        >
          <Text style={selectedFilter === 'unread' ? styles.activeFilterText : styles.filterText}>
            Unread
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setSelectedFilter('read')}
        >
          <Text style={selectedFilter === 'read' ? styles.activeFilterText : styles.filterText}>
            Read
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <Button
          title="Add Notification"
          onPress={() => setModalVisible(true)}
          color="#FFA500"
        />
        <Button
          title="Mark All Read"
          onPress={markAllAsRead}
          color="#4CAF50"
        />
        <Button
          title="Delete All"
          onPress={deleteAllNotifications}
          color="#F44336"
        />
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Notification</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              value={newNotification.title}
              onChangeText={(text) => setNewNotification({...newNotification, title: text})}
            />
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Body"
              multiline
              numberOfLines={4}
              value={newNotification.body}
              onChangeText={(text) => setNewNotification({...newNotification, body: text})}
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setModalVisible(false)}
                color="#F44336"
              />
              <Button
                title="Add"
                onPress={handleAddNotification}
                color="#4CAF50"
              />
            </View>
          </View>
        </View>
      </Modal>

      {notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="notifications-off-outline" size={48} color="#888" />
          <Text style={styles.emptyMessage}>No notifications found</Text>
          <Text style={styles.emptySubtext}>Pull down to refresh or add a new notification</Text>
        </View>
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
  },
  filterText: {
    color: '#888',
    fontSize: 14,
  },
  activeFilterText: {
    color: '#FFA500',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#FFA500',
    marginTop: 16,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    padding: 20,
    borderRadius: 12,
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFA500',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#3a3a3a',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});