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
} from 'react-native';
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
} from 'firebase/firestore';
import moment from 'moment';

const ChatScreen = ({ route }) => {
  const { rideId, userId, driverId } = route.params;
  const currentUserId = auth.currentUser.uid;

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [userInfo, setUserInfo] = useState({});
  const [driverInfo, setDriverInfo] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);

  const flatListRef = useRef(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      const userSnap = await getDoc(doc(db, 'users', userId));
      const driverSnap = await getDoc(doc(db, 'drivers', driverId));
      setUserInfo(userSnap.exists() ? userSnap.data() : {});
      setDriverInfo(driverSnap.exists() ? driverSnap.data() : {});
    };
    fetchProfiles();
  }, []);

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
      scrollToBottom();
    });

    return () => unsubscribe();
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const sendMessage = async () => {
    if (message.trim() === '') return;

    await addDoc(collection(db, 'chats', rideId, 'messages'), {
      senderId: currentUserId,
      text: message,
      replyTo: replyingTo || null,
      timestamp: serverTimestamp(),
    });

    setMessage('');
    setReplyingTo(null);
    scrollToBottom();
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

  const renderItem = ({ item }) => {
    const isUser = item.senderId === currentUserId;
    const senderData = item.senderId === userId ? userInfo : driverInfo;

    return (
      <TouchableWithoutFeedback
        onLongPress={() => {
          if (isUser) handleDeleteMessage(item.id);
        }}
        onPress={() => setReplyingTo({ id: item.id, text: item.text })}
      >
        <View
          style={[styles.messageRow, isUser ? styles.rowRight : styles.rowLeft]}
        >
          {!isUser && (
            <Image
              source={senderData?.photoUrl ? { uri: senderData.photoUrl } : require('./assets/default-avatar.png')}
              style={styles.avatar}
            />
          )}
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.driverBubble,
            ]}
          >
            <Text style={styles.senderName}>{senderData?.name || 'User'}</Text>
            {item.replyTo && (
              <View style={styles.replyBox}>
                <Text style={styles.replyText}>↪ {item.replyTo.text}</Text>
              </View>
            )}
            <Text style={styles.messageText}>{item.text}</Text>
            {item.timestamp && (
              <Text style={styles.timestamp}>
                {moment(item.timestamp.toDate()).format('h:mm A')}
              </Text>
            )}
          </View>
          {isUser && (
            <Image
              source={senderData?.photoUrl ? { uri: senderData.photoUrl } : require('./assets/default-avatar.png')}
              style={styles.avatar}
            />
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
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.messageList}
      />

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
          onChangeText={setMessage}
          placeholder="Type your message..."
          placeholderTextColor="#888"
          style={styles.textInput}
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Text style={{ color: 'white' }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
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
  messageBubble: {
    maxWidth: '70%',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#333',
  },
  userBubble: {
    backgroundColor: '#4a90e2',
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
  },
  timestamp: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  textInput: {
    flex: 1,
    color: 'white',
    padding: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginHorizontal: 6,
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
});

export default ChatScreen;
