import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function SettingsPanel({ visible, onClose, children, darkMode = false }) {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsMounted(false);
      });
    }
  }, [visible]);

  if (!isMounted) return null;

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={[styles.overlay, { backgroundColor: darkMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }]}>
        <Animated.View
          style={[
            styles.panel,
            {
              transform: [{ translateX: slideAnim }],
              backgroundColor: darkMode ? '#121212' : '#fff',
            },
          ]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={28} color={darkMode ? '#fff' : '#000'} />
            </TouchableOpacity>

            <View style={styles.content}>
              {children}
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: SCREEN_WIDTH * 0.75,
    height: '100%',
    paddingTop: 40,
    paddingHorizontal: 20,
    // backgroundColor is now set dynamically
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  content: {
    flex: 1,
  },
});
