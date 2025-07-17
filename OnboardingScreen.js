import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
} from 'react-native';
import Swiper from 'react-native-swiper';

export default function OnboardingScreen({ navigation }) {
  const slides = [
    {
      image: require('./assets/slide1.jpg'),
      text: 'Book rides easily and quickly!',
    },
    {
      image: require('./assets/slide2.jpg'),
      text: 'Choose from reliable local drivers.',
    },
    {
      image: require('./assets/slide3.jpg'),
      text: 'Your destination, just a tap away.',
    },
  ];

  return (
    <Swiper loop={false} dotStyle={styles.dot} activeDotStyle={styles.activeDot}>
      {slides.map((slide, index) => (
        <ImageBackground source={slide.image} style={styles.slide} key={index}>
          <View style={styles.overlay}>
            <Text style={styles.text}>{slide.text}</Text>
            {index === slides.length - 1 && (
              <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.replace('SignUp')} // or SignIn
              >
                <Text style={styles.buttonText}>Get Started</Text>
              </TouchableOpacity>
            )}
          </View>
        </ImageBackground>
      ))}
    </Swiper>
  );
}

const styles = StyleSheet.create({
  slide: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 30,
  },
  text: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#FFB84C',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 30,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#1E1E2E',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dot: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: '#FFB84C',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
