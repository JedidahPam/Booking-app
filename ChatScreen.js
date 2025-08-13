import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from './firebaseConfig';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import moment from 'moment';
import { AppState } from 'react-native';
import { updateUserOnlineStatus } from './userStatusService';

const ChatScreen = ({ route, navigation }) => {
  const { rideId, userId, driverId } = route.params;
  const currentUserId = auth.currentUser.uid;

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [userInfo, setUserInfo] = useState({});
  const [driverInfo, setDriverInfo] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [showReactions, setShowReactions] = useState(null);

  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const reactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];
  const otherUserId = currentUserId === userId ? driverId : userId;
  const otherUserInfo = currentUserId === userId ? driverInfo : userInfo;

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        const driverSnap = await getDoc(doc(db, 'users', driverId)); // Changed from 'drivers' to 'users'
        setUserInfo(userSnap.exists() ? userSnap.data() : {});
        setDriverInfo(driverSnap.exists() ? driverSnap.data() : {});
      } catch (error) {
        console.error('Error fetching profiles:', error);
      }
    };
    fetchProfiles();
  }, []);

  // Listen for online status
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', otherUserId), (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setIsOnline(userData.isOnline || false);
      }
    });
    return () => unsubscribe();
  }, [otherUserId]);

  // Listen for typing status
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'chats', rideId), (doc) => {
      if (doc.exists()) {
        const chatData = doc.data();
        setOtherUserTyping(chatData.typing?.[otherUserId] || false);
      }
    });
    return () => unsubscribe();
  }, [rideId, otherUserId]);

  useEffect(() => {
    const q = query(
      collection(db, 'chats', rideId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
      setFilteredMessages(msgs);
      scrollToBottom();
      
      // Mark messages as read
      markMessagesAsRead(msgs);
    });

    return () => unsubscribe();
  }, []);

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMessages(messages);
    } else {
      const filtered = messages.filter(msg =>
        msg.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMessages(filtered);
    }
  }, [searchQuery, messages]);

  useEffect(() => {
  // Track when the app goes to background/foreground (for mobile)
  const subscription = AppState.addEventListener('change', async (nextAppState) => {
    if (nextAppState.match(/inactive|background/)) {
      await updateUserOnlineStatus(currentUserId, false);
    } else if (nextAppState === 'active') {
      await updateUserOnlineStatus(currentUserId, true);
    }
  });

  return () => {
    subscription.remove();
    // Update status to offline when component unmounts (if you want)
    // updateUserOnlineStatus(currentUserId, false);
  };
}, [currentUserId]);

  const markMessagesAsRead = async (msgs) => {
    const unreadMessages = msgs.filter(
      msg => msg.senderId !== currentUserId && msg.status !== 'read'
    );
    
    for (const msg of unreadMessages) {
      try {
        await updateDoc(doc(db, 'chats', rideId, 'messages', msg.id), {
          status: 'read'
        });
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const updateTypingStatus = async (typing) => {
    try {
      await updateDoc(doc(db, 'chats', rideId), {
        [`typing.${currentUserId}`]: typing
      });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  };

  const handleTextChange = (text) => {
    setMessage(text);
    
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      updateTypingStatus(true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 1000);
  };

  const sendMessage = async () => {
    if (message.trim() === '') return;

    try {
      await addDoc(collection(db, 'chats', rideId, 'messages'), {
        senderId: currentUserId,
        text: message,
        replyTo: replyingTo || null,
        timestamp: serverTimestamp(),
        status: 'sent',
        reactions: {},
      });

      setMessage('');
      setReplyingTo(null);
      setIsTyping(false);
      updateTypingStatus(false);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleDeleteMessage = async (msgId) => {
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'chats', rideId, 'messages', msgId));
          } catch (err) {
            console.error('Delete error:', err);
          }
        },
      },
    ]);
  };

  const addReaction = async (messageId, emoji) => {
    try {
      const messageRef = doc(db, 'chats', rideId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (messageDoc.exists()) {
        const messageData = messageDoc.data();
        const reactions = messageData.reactions || {};
        
        if (reactions[emoji]) {
          if (reactions[emoji].includes(currentUserId)) {
            // Remove reaction
            reactions[emoji] = reactions[emoji].filter(id => id !== currentUserId);
            if (reactions[emoji].length === 0) {
              delete reactions[emoji];
            }
          } else {
            // Add reaction
            reactions[emoji].push(currentUserId);
          }
        } else {
          // First reaction of this type
          reactions[emoji] = [currentUserId];
        }
        
        await updateDoc(messageRef, { reactions });
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
    setShowReactions(null);
  };

  const renderHeader = () => (
    <View style={styles.chatHeader}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#FFA500" />
      </TouchableOpacity>
      
      <View style={styles.headerInfo}>
        <Text style={styles.headerName}>
          {otherUserInfo.firstname && otherUserInfo.lastname 
            ? `${otherUserInfo.firstname} ${otherUserInfo.lastname}`
            : otherUserInfo.name || 'User'}
        </Text>
        <View style={styles.onlineStatus}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? '#4CAF50' : '#888' }]} />
          <Text style={styles.statusText}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
      
      <TouchableOpacity 
        onPress={() => setShowSearch(!showSearch)} 
        style={styles.headerButton}
      >
        <Ionicons name="search" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderReactions = (reactions) => {
    if (!reactions || Object.keys(reactions).length === 0) return null;
    
    return (
      <View style={styles.reactionsContainer}>
        {Object.entries(reactions).map(([emoji, userIds]) => (
          <TouchableOpacity
            key={emoji}
            style={styles.reactionBubble}
            onPress={() => addReaction(showReactions, emoji)}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            <Text style={styles.reactionCount}>{userIds.length}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const isUser = item.senderId === currentUserId;
    const senderData = item.senderId === userId ? userInfo : driverInfo;

    return (
      <TouchableWithoutFeedback
        onLongPress={() => {
          if (isUser) {
            Alert.alert(
              'Message Options',
              'What would you like to do?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Add Reaction', onPress: () => setShowReactions(item.id) },
                { text: 'Delete', style: 'destructive', onPress: () => handleDeleteMessage(item.id) },
              ]
            );
          } else {
            setShowReactions(item.id);
          }
        }}
        onPress={() => setReplyingTo({ id: item.id, text: item.text })}
      >
        <View style={[styles.messageRow, isUser ? styles.rowRight : styles.rowLeft]}>
          {!isUser && (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color="#666" />
            </View>
          )}
          
          <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.driverBubble]}>
            <Text style={styles.senderName}>
              {senderData?.firstname && senderData?.lastname 
                ? `${senderData.firstname} ${senderData.lastname}`
                : senderData?.name || 'User'}
            </Text>
            
            {item.replyTo && (
              <View style={styles.replyBox}>
                <Text style={styles.replyText}>↪ {item.replyTo.text}</Text>
              </View>
            )}
            
            <Text style={styles.messageText}>{item.text}</Text>
            
            {renderReactions(item.reactions)}
            
            <View style={styles.messageFooter}>
              {item.timestamp && (
                <Text style={styles.timestamp}>
                  {moment(item.timestamp.toDate()).format('h:mm A')}
                </Text>
              )}
              
              {isUser && (
                <View style={styles.messageStatus}>
                  <Ionicons 
                    name={item.status === 'read' ? 'checkmark-done' : 'checkmark'} 
                    size={12} 
                    color={item.status === 'read' ? '#4CAF50' : '#888'} 
                  />
                </View>
              )}
            </View>
          </View>
          
          {isUser && (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color="#666" />
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {renderHeader()}
      
      {showSearch && (
        <View style={styles.searchContainer}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search messages..."
            placeholderTextColor="#888"
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearch}>
              <Ionicons name="close" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={filteredMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.messageList}
      />

      {otherUserTyping && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>
            {otherUserInfo.firstname || 'User'} is typing...
          </Text>
        </View>
      )}

      {replyingTo && (
        <View style={styles.replyingToBox}>
          <Text style={styles.replyingToText} numberOfLines={1}>
            Replying to: {replyingTo.text}
          </Text>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Text style={styles.cancelReply}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          value={message}
          onChangeText={handleTextChange}
          placeholder="Type your message..."
          placeholderTextColor="#888"
          style={styles.textInput}
          multiline
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Ionicons name="send" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Reaction Modal */}
      <Modal
        visible={showReactions !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReactions(null)}
      >
        <TouchableWithoutFeedback onPress={() => setShowReactions(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.reactionModal}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {reactions.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionOption}
                    onPress={() => addReaction(showReactions, emoji)}
                  >
                    <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingTop: Platform.OS === 'ios' ? 50 : 15,
  },
  backButton: {
    marginRight: 15,
  },
  headerInfo: {
    flex: 1,
  },
headerName: {
    color: '#FFA500', // Changed to orange
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  statusText: {
    color: '#888',
    fontSize: 12,
  },
  headerButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 16,
  },
  clearSearch: {
    marginLeft: 10,
    padding: 5,
  },
  messageList: {
    padding: 10,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  rowRight: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#333',
  },
  userBubble: {
    backgroundColor:'#FFA500',
  },
  driverBubble: {
    backgroundColor: '#444',
  },
  messageText: {
    color: 'white',
    fontSize: 16,
  },
  senderName: {
    fontWeight: 'bold',
    color: '#ccc',
    marginBottom: 2,
    fontSize: 12,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#aaa',
  },
  messageStatus: {
    marginLeft: 5,
  },
  typingIndicator: {
    padding: 10,
    backgroundColor: '#1a1a1a',
  },
  typingText: {
    color: '#888',
    fontStyle: 'italic',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#1a1a1a',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    color: 'white',
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
sendButton: {
    backgroundColor: '#FFA500', // Changed to orange
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyBox: {
    backgroundColor: '#555',
    padding: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  replyText: {
    color: '#ccc',
    fontSize: 14,
    fontStyle: 'italic',
  },
  replyingToBox: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyingToText: {
    color: '#ccc',
    flex: 1,
    fontStyle: 'italic',
  },
  cancelReply: {
    fontSize: 20,
    color: '#ccc',
    marginLeft: 10,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#555',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 2,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    color: '#ccc',
    fontSize: 10,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionModal: {
    backgroundColor: '#333',
    borderRadius: 25,
    padding: 10,
  },
  reactionOption: {
    padding: 10,
    marginHorizontal: 5,
  },
  reactionOptionEmoji: {
    fontSize: 30,
  },
});

export default ChatScreen;