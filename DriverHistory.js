import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, SafeAreaView,
  Alert, TouchableOpacity, TextInput, Modal, Pressable
} from 'react-native';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { useTheme } from './ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function DriverHistory() {
  const { darkMode } = useTheme();
  const navigation = useNavigation();
  const styles = createStyles(darkMode);
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const statusOptions = [
    { label: 'All', value: null },
    { label: 'Accepted', value: 'accepted' },
    { label: 'Started', value: 'started' },
    { label: 'Completed', value: 'completed' },
    { label: 'Declined', value: 'declined' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  useEffect(() => {
    const driverId = auth.currentUser?.uid;
    if (!driverId) return;

    const q = query(
      collection(db, 'rides'),
      where('acceptedBy', '==', driverId),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || null,
      }));
      setHistory(data);
      setFilteredHistory(data);
      setLoading(false);
    }, (error) => {
      console.error('Firestore error:', error);
      Alert.alert('Error', 'Failed to load rides. Ensure the Firestore index is created.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let results = history;
    if (statusFilter) {
      results = results.filter(item => item.status === statusFilter);
    }
    if (searchText) {
      const query = searchText.toLowerCase();
      results = results.filter(item =>
        item.pickup?.address?.toLowerCase().includes(query) ||
        item.dropoff?.address?.toLowerCase().includes(query) ||
        item.price?.toString().includes(query)
      );
    }
    setFilteredHistory(results);
  }, [statusFilter, searchText, history]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.label}>Status:</Text>
      <Text style={[
        styles.value,
        { color: getStatusColor(item.status, darkMode) }
      ]}>
        {item.status?.toUpperCase() || 'N/A'}
      </Text>

      <Text style={styles.label}>Pickup:</Text>
      <Text style={styles.value}>{item.pickup?.address || 'N/A'}</Text>

      <Text style={styles.label}>Drop-off:</Text>
      <Text style={styles.value}>{item.dropoff?.address || 'N/A'}</Text>

      <Text style={styles.label}>Fare:</Text>
      <Text style={styles.value}>${item.price || 'N/A'}</Text>

      <Text style={styles.label}>Date:</Text>
      <Text style={styles.value}>
        {item.timestamp ? item.timestamp.toLocaleString() : 'N/A'}
      </Text>
    </View>
  );

  const getStatusColor = (status, darkMode) => {
    switch (status) {
      case 'completed': return 'green';
      case 'cancelled': return 'red';
      case 'declined': return 'orange';
      case 'started': return '#FFA500'; // Changed from darkMode conditional to orange
      default: return '#FFA500'; // Changed from darkMode conditional to orange
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color="#FFA500" // Changed from darkMode conditional to orange
          />
        </TouchableOpacity>
        <Text style={styles.title}>Trip History</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by address or fare..."
          placeholderTextColor={darkMode ? '#888' : '#999'}
          value={searchText}
          onChangeText={setSearchText}
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons
            name="filter"
            size={24}
            color="#FFA500" // Changed from darkMode conditional to orange
          />
        </TouchableOpacity>
      </View>

      <Modal
        transparent={true}
        visible={showFilters}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by Status</Text>
            {statusOptions.map(option => (
              <Pressable
                key={option.value || 'all'}
                style={styles.filterOption}
                onPress={() => {
                  setStatusFilter(option.value);
                  setShowFilters(false);
                }}
              >
                <Text style={styles.filterOptionText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {loading ? (
        <ActivityIndicator size="large" color="#FFA500" /> // Changed from darkMode conditional to orange
      ) : (
        <FlatList
          data={filteredHistory}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No trips found.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (darkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkMode ? '#1a1a1a' : '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: darkMode ? '#333' : '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: "#FFA500", // Changed from darkMode conditional to orange
    textAlign: 'center',
    flex: 1,
  },
  headerRightPlaceholder: {
    width: 32,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: darkMode ? '#2a2a2a' : '#fff',
    color: darkMode ? '#fff' : '#333',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    fontSize: 16,
  },
  filterButton: {
    padding: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: darkMode ? '#2a2a2a' : '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    color: darkMode ? '#FFB84D' : '#FF8C00',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  value: {
    color: darkMode ? '#fff' : '#333',
    fontSize: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: darkMode ? '#FFB84D' : '#FF8C00',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: darkMode ? '#2a2a2a' : '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#FFA500", // Changed from darkMode conditional to orange
    marginBottom: 16,
    textAlign: 'center',
  },
  filterOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: darkMode ? '#444' : '#eee',
  },
  filterOptionText: {
    color: darkMode ? '#fff' : '#333',
    fontSize: 16,
  },
});