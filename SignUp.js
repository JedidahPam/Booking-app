import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

export default function SignupScreen({ navigation }) {
  const [passwordStrength, setPasswordStrength] = useState('');

  const evaluatePasswordStrength = (password) => {
    if (password.length >= 8) {
      if (/[A-Z]/.test(password) && /\d/.test(password) && /[@#$!]/.test(password)) {
        setPasswordStrength('Strong');
      } else {
        setPasswordStrength('Moderate');
      }
    } else {
      setPasswordStrength('Weak');
    }
  };

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    firstname: '',
    lastname: '',
    role: 'rider',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      setEmailError('Invalid email format');
    } else {
      setEmailError('');
    }
  };

  const validatePhone = (phone) => {
    const phoneRegex = /^\+?[1-9]\d{7,14}$/;
    if (phone && !phoneRegex.test(phone)) {
      setPhoneError('Enter a valid phone number');
    } else {
      setPhoneError('');
    }
  };

  const handleChange = (key, value) => {
    if (key === 'phone') {
      const cleaned = value.replace(/[^\d+]/g, ''); // allow digits and plus
      setFormData(prev => ({ ...prev, phone: cleaned }));
      validatePhone(cleaned);
    } else if (key === 'password') {
      setFormData(prev => ({ ...prev, password: value }));
      evaluatePasswordStrength(value);
    } else {
      setFormData(prev => ({ ...prev, [key]: value }));
    }
  };

  useEffect(() => {
    const { email, password, confirmPassword, firstname, lastname, phone, role } = formData;
    const isValid = email && password && confirmPassword && firstname && lastname && phone &&
      password === confirmPassword &&
      !emailError && !phoneError &&
      ['rider', 'driver'].includes(role);
    setIsFormValid(isValid);
  }, [formData, emailError, phoneError]);

  const handleSubmit = async () => {
    if (!isFormValid) {
      Alert.alert('Error', 'Please correct the highlighted errors.');
      return;
    }

    try {
      const { email, password } = formData;
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, 'users', uid), {
        ...formData,
        uid,
        createdAt: new Date(),
      });

      if (formData.role === 'driver') {
        navigation.navigate('DriverRegistration', { uid });
      } else {
        Alert.alert('Success', 'Account created successfully! Please sign in.');
        navigation.navigate('SignIn');
      }
    } catch (error) {
      Alert.alert('Sign Up Failed', 'Please review your details');
      console.error(error);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      {/* First Name */}
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="First Name"
          placeholderTextColor="#888"
          value={formData.firstname}
          onChangeText={text => handleChange('firstname', text)}
        />
      </View>

      {/* Last Name */}
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          placeholderTextColor="#888"
          value={formData.lastname}
          onChangeText={text => handleChange('lastname', text)}
        />
      </View>

      {/* Email */}
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          keyboardType="email-address"
          autoCapitalize="none"
          value={formData.email}
          onChangeText={text => {
            handleChange('email', text);
            setEmailError('');
          }}
          onBlur={() => validateEmail(formData.email)}
        />
        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
      </View>

      {/* Password */}
      <View style={styles.passwordWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          secureTextEntry={!showPassword}
          value={formData.password}
          onChangeText={text => handleChange('password', text)}
          importantForAutofill="no"
          autoComplete="off"
          textContentType="none"
        />
        <TouchableOpacity onPress={() => setShowPassword(prev => !prev)}>
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Password Strength Indicator */}
      {formData.password.length > 0 && (
        <Text
          style={[
            styles.strengthText,
            passwordStrength === 'Strong'
              ? styles.strong
              : passwordStrength === 'Moderate'
              ? styles.moderate
              : styles.weak,
          ]}
        >
          Password Strength: {passwordStrength}
        </Text>
      )}

      {/* Password Requirements */}
      <View style={styles.requirementsContainer}>
        <Text style={styles.requirementTitle}>Your password must contain:</Text>
        <Text style={styles.requirement}>• At least 8 characters</Text>
        <Text style={styles.requirement}>• At least 1 uppercase letter</Text>
        <Text style={styles.requirement}>• At least 1 number</Text>
        <Text style={styles.requirement}>• At least 1 special character (e.g. @, #, !)</Text>
      </View>

      {/* Confirm Password */}
      <View style={styles.passwordWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#888"
          secureTextEntry={!showConfirmPassword}
          value={formData.confirmPassword}
          onChangeText={text => handleChange('confirmPassword', text)}
          importantForAutofill="no"
          autoComplete="off"
          textContentType="none"
        />
        <TouchableOpacity onPress={() => setShowConfirmPassword(prev => !prev)}>
          <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Phone */}
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#888"
          keyboardType="phone-pad"
          value={formData.phone}
          onChangeText={text => handleChange('phone', text)}
        />
        {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
      </View>

      {/* Role Selection */}
      <Text style={styles.label}>Select Role:</Text>
      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[styles.roleButton, formData.role === 'rider' && styles.roleButtonSelected]}
          onPress={() => handleChange('role', 'rider')}
        >
          <Text style={[styles.roleText, formData.role === 'rider' && styles.roleTextSelected]}>
            Rider
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleButton, formData.role === 'driver' && styles.roleButtonSelected]}
          onPress={() => handleChange('role', 'driver')}
        >
          <Text style={[styles.roleText, formData.role === 'driver' && styles.roleTextSelected]}>
            Driver
          </Text>
        </TouchableOpacity>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, { opacity: isFormValid ? 1 : 0.5 }]}
        onPress={handleSubmit}
        disabled={!isFormValid}
      >
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      {/* Link to Sign In */}
      <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
        <Text style={styles.signinLink}>
          Already have an account? <Text style={styles.signinText}>Sign In</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#000000',
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#FFA500',
  },
  inputWrapper: {
    marginBottom: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  input: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderWidth: 0,
    outlineStyle: 'none',
  },
  label: {
    color: '#FFB84D',
    marginBottom: 8,
    fontWeight: '600',
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFA500',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  roleButtonSelected: {
    backgroundColor: '#FFA500',
    borderColor: '#FFA500',
  },
  roleText: {
    color: '#FFA500',
    fontWeight: '600',
  },
  roleTextSelected: {
    color: '#1a1a1a',
  },
  submitButton: {
    backgroundColor: '#FFA500',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '600',
  },
  signinLink: {
    color: '#FFA500',
    marginTop: 20,
    textAlign: 'center',
    fontSize: 14,
  },
  signinText: {
    fontWeight: 'bold',
    color: '#FFCC00',
  },
  errorText: {
    color: '#FF4C4C',
    fontSize: 12,
    marginTop: 4,
    marginBottom: -10,
  },
  strengthText: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  strong: {
    color: 'lightgreen',
  },
  moderate: {
    color: '#FFD700',
  },
  weak: {
    color: '#FF4C4C',
  },
  requirementsContainer: {
    marginBottom: 16,
    marginTop: -8,
  },
  requirementTitle: {
    color: '#FFA500',
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 13,
  },
  requirement: {
    color: '#ccc',
    fontSize: 12,
    marginLeft: 4,
    marginTop: 2,
  },
});