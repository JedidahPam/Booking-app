import { auth, db } from './firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Update user's online status
export const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    await setDoc(doc(db, 'users', userId), {
      isOnline,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating online status:', error);
  }
};

// Initialize auth state listener for online status
export const initUserStatusTracking = () => {
  const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is signed in
      await updateUserOnlineStatus(user.uid, true);
      
      // Track disconnect events
      const handleBeforeUnload = async () => {
        await updateUserOnlineStatus(user.uid, false);
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        updateUserOnlineStatus(user.uid, false);
      };
    }
  });
  
  return unsubscribeAuth;
};