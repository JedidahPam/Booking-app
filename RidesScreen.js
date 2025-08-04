import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from './firebaseConfig';
import { Swipeable } from 'react-native-gesture-handler';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

// Star Rating Component
const StarRating = ({ rating, onRatingChange, size = 30, readonly = false }) => {
  const { darkMode } = useTheme();
  
  return (
    <View style={styles.starContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => !readonly && onRatingChange(star)}
          disabled={readonly}
          style={styles.starButton}
        >
          <Ionicons
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color={star <= rating ? '#FFD700' : (darkMode ? '#666' : '#ccc')}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

// Rating Modal Component
const RatingModal = ({ visible, onClose, onSubmitRating, darkMode }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitRating(rating, comment);
      setRating(0);
      setComment('');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setComment('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, darkMode && styles.modalContentDark]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, darkMode && { color: '#fff' }]}>
              Rate Your Ride
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={darkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalSubtitle, darkMode && { color: '#ccc' }]}>
            How was your experience?
          </Text>

          <StarRating rating={rating} onRatingChange={setRating} size={40} />

          <TextInput
            style={[
              styles.commentInput,
              darkMode && styles.commentInputDark
            ]}
            placeholder="Add a comment (optional)"
            placeholderTextColor={darkMode ? '#666' : '#999'}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            maxLength={500}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.submitButton,
                submitting && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Rating</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const RidesScreen = () => {
  const { darkMode } = useTheme();
  const navigation = useNavigation();

  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedRideForRating, setSelectedRideForRating] = useState(null);

  const ridesUnsubscribeRef = useRef(null);
  const lastUpdateRef = useRef(0);

  const setupRidesListener = useCallback(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    setError(null);

    const ridesCollectionRef = collection(db, 'rides');
    const q = query(ridesCollectionRef, where('userId', '==', currentUserId));

    if (ridesUnsubscribeRef.current) {
      ridesUnsubscribeRef.current();
    }

    ridesUnsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const now = Date.now();
        if (now - lastUpdateRef.current < 100) return;
        lastUpdateRef.current = now;

        const userRides = [];
        const rideIds = new Set();
        
        snapshot.forEach((docSnap) => {
          const rideId = docSnap.id;
          
          if (rideIds.has(rideId)) return;
          rideIds.add(rideId);
          
          const data = docSnap.data();

          const pickupData = data.pickup || {};
          const dropoffData = data.dropoff || {};

          let rideTimestamp = null;
          if (data.timestamp) {
            if (typeof data.timestamp.toDate === 'function') {
              rideTimestamp = data.timestamp.toDate();
            } else {
              rideTimestamp = new Date(data.timestamp);
            }
          }

          userRides.push({
            id: rideId,
            pickup: {
              address: pickupData.address || 'Unknown pickup',
              latitude: pickupData.latitude || null,
              longitude: pickupData.longitude || null,
            },
            dropoff: {
              address: dropoffData.address || 'Unknown dropoff',
              latitude: dropoffData.latitude || null,
              longitude: dropoffData.longitude || null,
            },
            status: data.status || 'pending',
            timestamp: rideTimestamp,
            distance: data.distance || null,
            price: data.price || null,
            paymentMethod: data.paymentMethod || null,
            driverId: data.driverId || null,
            userRating: data.userRating || null,
            userComment: data.userComment || null,
            ratedAt: data.ratedAt || null,
          });
        });

        userRides.sort((a, b) => {
          if (!a.timestamp && !b.timestamp) return 0;
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return new Date(b.timestamp) - new Date(a.timestamp);
        });

        setRides(userRides);
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        console.error('Real-time listener error:', err);
        setError(err.message || 'Failed to fetch real-time rides.');
        setLoading(false);
        setRefreshing(false);
      }
    );
  }, []);

  useEffect(() => {
    setupRidesListener();

    return () => {
      if (ridesUnsubscribeRef.current) {
        ridesUnsubscribeRef.current();
      }
    };
  }, [setupRidesListener]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setupRidesListener();
  }, [setupRidesListener]);

  const handleRatingSubmit = async (rating, comment) => {
    if (!selectedRideForRating) return;

    try {
      const rideRef = doc(db, 'rides', selectedRideForRating.id);
      await updateDoc(rideRef, {
        userRating: rating,
        userComment: comment,
        ratedAt: serverTimestamp(),
      });

      Alert.alert('Thank You!', 'Your rating has been submitted successfully.');
    } catch (error) {
      console.error('Error submitting rating:', error);
      throw error;
    }
  };

  const openRatingModal = (ride) => {
    setSelectedRideForRating(ride);
    setRatingModalVisible(true);
  };

  const removeRide = (id) => {
    Alert.alert(
      "Remove Ride",
      "Are you sure you want to remove this ride from the list? This will not delete it from the database.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove",
          onPress: () => {
            setRides(prevRides => prevRides.filter(ride => ride.id !== id));
          }
        }
      ]
    );
  };

  const cancelRide = async (rideId) => {
    Alert.alert(
      "Cancel Ride",
      "Are you sure you want to cancel this ride?",
      [
        {
          text: "No",
          style: "cancel"
        },
        {
          text: "Yes",
          onPress: async () => {
            try {
              const rideRef = doc(db, 'rides', rideId);
              await updateDoc(rideRef, {
                status: 'cancelled',
                cancelledAt: serverTimestamp(),
                cancelledBy: auth.currentUser.uid,
              });
              Alert.alert("Success", "Your ride has been cancelled.");
            } catch (error) {
              console.error("Error cancelling ride:", error);
              Alert.alert("Error", "Failed to cancel ride. Please try again.");
            }
          }
        }
      ]
    );
  };

  const canCancelRide = (status) => {
    const lowerStatus = status?.toLowerCase();
    return lowerStatus === 'pending' || lowerStatus === 'accepted';
  };

  const renderRightActions = (progress, dragX, id) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity onPress={() => removeRide(id)} style={styles.deleteBox}>
        <Ionicons name="trash" size={24} color="white" />
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      console.warn("Invalid timestamp encountered:", timestamp);
      return 'Invalid Date';
    }
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
      case 'declined':
        return '#F44336';
      case 'accepted':
        return '#007bff';
      case 'in_progress':
        return '#8A2BE2';
      default:
        return '#757575';
    }
  };

  const shouldShowRating = (status) => {
    return status?.toLowerCase() === 'completed';
  };

  const shouldShowChatButton = (status) => {
    const statusLower = status?.toLowerCase();
    return statusLower !== 'cancelled' && statusLower !== 'declined';
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && { backgroundColor: '#000' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, darkMode && { color: '#fff' }]}>Your Rides</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
          <Ionicons name="refresh" size={24} color={darkMode ? '#fff' : '#000'} />
        </TouchableOpacity>
      </View>

      {loading && rides.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={[styles.loadingText, darkMode && { color: '#fff' }]}>Loading your rides...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, darkMode && { color: '#fff' }]}>No rides found</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {rides.map(ride => (
            <Swipeable
              key={ride.id}
              renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, ride.id)}
              overshootRight={false}
              containerStyle={styles.swipeableContainer}
            >
              <TouchableOpacity
                style={[
                  styles.rideCard,
                  darkMode && { backgroundColor: '#1a1a1a' }
                ]}
                onPress={() => navigation.navigate('Home', { rideId: ride.id })}
                activeOpacity={0.7}
              >
                <View style={styles.rideHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
                    <Text style={styles.statusText}>{ride.status?.toUpperCase()}</Text>
                  </View>
                  {ride.timestamp && (
                    <Text style={[styles.dateText, darkMode && { color: '#ccc' }]}>
                      {formatDate(ride.timestamp)}
                    </Text>
                  )}
                </View>

                <View style={styles.locationContainer}>
                  <View style={styles.locationRow}>
                    <View style={styles.locationDot} />
                    <View style={styles.locationInfo}>
                      <Text style={[styles.locationLabel, darkMode && { color: '#ccc' }]}>From</Text>
                      <Text style={[styles.locationText, darkMode && { color: '#fff' }]} numberOfLines={2}>
                        {ride.pickup.address}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.locationConnector} />

                  <View style={styles.locationRow}>
                    <View style={[styles.locationDot, { backgroundColor: '#F44336' }]} />
                    <View style={styles.locationInfo}>
                      <Text style={[styles.locationLabel, darkMode && { color: '#ccc' }]}>To</Text>
                      <Text style={[styles.locationText, darkMode && { color: '#fff' }]} numberOfLines={2}>
                        {ride.dropoff.address}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Cancel Ride Button */}
                {canCancelRide(ride.status) && (
                  <TouchableOpacity
                    style={[styles.cancelRideButton, darkMode && { borderColor: '#F44336' }]}
                    onPress={() => cancelRide(ride.id)}
                  >
                    <Ionicons name="close-circle" size={20} color="#F44336" />
                    <Text style={[styles.cancelRideButtonText, darkMode && { color: '#fff' }]}>
                      Cancel Ride
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Rating Section for Completed Rides Only */}
                {shouldShowRating(ride.status) && (
                  <View style={[styles.ratingSection, darkMode && { borderTopColor: '#333' }]}>
                    {ride.userRating ? (
                      <View style={styles.existingRating}>
                        <Text style={[styles.ratingLabel, darkMode && { color: '#ccc' }]}>
                          Your Rating:
                        </Text>
                        <StarRating rating={ride.userRating} readonly size={20} />
                        {ride.userComment && (
                          <Text style={[styles.ratingComment, darkMode && { color: '#ccc' }]}>
                            "{ride.userComment}"
                          </Text>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.rateButton, darkMode && { borderColor: '#FFD700' }]}
                        onPress={() => openRatingModal(ride)}
                      >
                        <Ionicons name="star-outline" size={20} color="#FFD700" />
                        <Text style={[styles.rateButtonText, darkMode && { color: '#fff' }]}>
                          Rate this ride
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Footer */}
                <View style={styles.rideFooter}>
                  <View style={styles.infoGroup}>
                    {ride.distance && (
                      <View style={styles.infoItem}>
                        <Ionicons name="location" size={14} color={darkMode ? '#ccc' : '#666'} />
                        <Text style={[styles.infoText, darkMode && { color: '#ccc' }]}>
                          {ride.distance.toFixed(1)} km
                        </Text>
                      </View>
                    )}
                    {typeof ride.price === 'number' && (
                      <View style={styles.infoItem}>
                        <Ionicons name="card" size={14} color={darkMode ? '#ccc' : '#666'} />
                        <Text style={[styles.infoText, darkMode && { color: '#ccc' }]}>
                          ${ride.price.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {ride.paymentMethod && (
                      <View style={styles.infoItem}>
                        <Ionicons
                          name={ride.paymentMethod === 'cash' ? 'cash' : 'card'}
                          size={14}
                          color={darkMode ? '#ccc' : '#666'}
                        />
                        <Text style={[styles.infoText, darkMode && { color: '#ccc' }]}>
                          {ride.paymentMethod}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Chat button */}
                  {shouldShowChatButton(ride.status) && ride.driverId && (
                    <TouchableOpacity
                      style={styles.chatButton}
                      onPress={() => navigation.navigate('Chat', {
                        rideId: ride.id,
                        userId: auth.currentUser.uid,
                        driverId: ride.driverId,
                      })}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={20} color={darkMode ? '#fff' : '#007bff'} />
                      <Text style={[styles.chatButtonText, darkMode && { color: '#fff' }]}>Chat with Driver</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </Swipeable>
          ))}

          {loading && rides.length > 0 && (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator size="small" color="#4CAF50" />
            </View>
          )}
        </ScrollView>
      )}

      {/* Rating Modal */}
      <RatingModal
        visible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        onSubmitRating={handleRatingSubmit}
        darkMode={darkMode}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButton: {
    padding: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  swipeableContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rideCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  locationContainer: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginTop: 6,
    marginRight: 12,
  },
  locationConnector: {
    width: 2,
    height: 20,
    backgroundColor: '#E0E0E0',
    marginLeft: 3,
    marginVertical: 4,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    lineHeight: 18,
  },
  cancelRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  cancelRideButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#F44336',
    fontWeight: '600',
  },
  ratingSection: {
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginBottom: 8,
  },
  existingRating: {
    alignItems: 'flex-start',
  },
  ratingLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  ratingComment: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  rateButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  starContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  starButton: {
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalContentDark: {
    backgroundColor: '#1a1a1a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginBottom: 24,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  commentInputDark: {
    borderColor: '#444',
    backgroundColor: '#2a2a2a',
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    marginLeft: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  infoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007bff',
  },
  chatButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#007bff',
    fontWeight: '600',
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteBox: {
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    borderRadius: 12,
    marginBottom: 12,
    width: 100,
    alignSelf: 'flex-end',
  },
  deleteText: {
    color: 'white',
    fontWeight: '600',
    marginTop: 5,
  },
});

export default RidesScreen;