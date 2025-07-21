import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const windowWidth = Dimensions.get('window').width;
const logo = require('./assets/logo4.png'); // adjust path if needed
const bottomBackground = require('./assets/bottomBackground.jpg'); // adjust path as needed

export default function SignIn({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('rider'); // 'rider' or 'driver'
  const [passwordVisible, setPasswordVisible] = useState(false);

 const handleSignIn = async () => {
  if (!email || !password) {
    Alert.alert('Error', 'Please enter both email and password');
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      const roleInFirestore = userData.role;

      // If driver, check approved status
      if (roleInFirestore === 'driver') {
        if (userData.approved === false) {
          Alert.alert(
            'Access Denied',
            'Your account has been rejected. Please contact support.'
          );
          await auth.signOut();
          return; // stop further navigation
        }
      }

      if (roleInFirestore === selectedRole) {
        if (selectedRole === 'driver') {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'DriverMain' }],
            })
          );
        } else {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            })
          );
        }
      } else {
        Alert.alert(
          'Role Mismatch',
          `Please select the correct role.`
        );
      }
    } else {
      Alert.alert('Error', 'User data not found.');
    }
  } catch (error) {
    switch (error.code) {
      case 'auth/invalid-email':
        Alert.alert('Invalid Email', 'Please check your email address.');
        break;
      case 'auth/user-not-found':
        Alert.alert('User Not Found', 'No user found with this email.');
        break;
      case 'auth/wrong-password':
        Alert.alert('Wrong Password', 'Incorrect password.');
        break;
      default:
        Alert.alert('Sign In Failed');
    }
  }
};


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.titleContainer}>
        <Image source={logo} style={styles.logo} resizeMode="cover" />
        
      </View>

      <View style={styles.inputContainer}>
        <View style={styles.roleToggle}>
          <TouchableOpacity
            style={[styles.roleButton, selectedRole === 'rider' && styles.selectedRole]}
            onPress={() => setSelectedRole('rider')}
          >
            <Text style={styles.roleText}>Rider</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleButton, selectedRole === 'driver' && styles.selectedRole]}
            onPress={() => setSelectedRole('driver')}
          >
            <Text style={styles.roleText}>Driver</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
            <Ionicons
            name={passwordVisible ? 'eye-off' : 'eye'}
            size={24}
            color="#fff"
            style={styles.showPasswordIcon}
           />
          </TouchableOpacity>

        </View>

        
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.createRideButton} onPress={handleSignIn}>
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('ResetPassword')}>
        <Text style={styles.link}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.link}>
          Don't have an account? <Text style={styles.signUp}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
      <Image
     source={bottomBackground}
     style={styles.bottomImage}
     resizeMode="cover"
/>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'flex-start',
    paddingTop: 10,
  },
  titleContainer: {
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 10,
},

  
  inputContainer: {
    paddingHorizontal: 20,
    marginTop:10,

  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  inputWrapper: {
    marginBottom: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    color: '#fff',
    fontSize: 16,
  },
   eyeIcon: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 10,
  },
  roleToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20, // ⬅️ Add this line
  },
  roleButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#444',
    borderRadius: 10,
    marginHorizontal: 10,
    

  },
  selectedRole: {
    backgroundColor: '#FFA500',
  },
  roleText: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 50,
  },
  createRideButton: {
    backgroundColor: '#FFA500',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '600',
  },
  link: {
    color: '#FFA500',
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
  },
  signUp: {
    fontWeight: 'bold',
    color: '#FFCC00',
  },
  logo: {
    width: windowWidth * 0.7,      // reduced from 0.9 to 0.4
    height: windowWidth * 0.3,     // reduced from 0.9 to 0.4
  //  marginBottom: 20,              // reduced from 90 to 20
  marginTop: 100,              // added marginTop for spacing
             // crops image to container bounds

  },
  
});