/**
 * Home screen / Landing page
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@astro/shared';

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Astrosetta</Text>
        <Text style={styles.subtitle}>Loading...</Text>
      </View>
    );
  }

  if (user) {
    // If logged in, navigate to main app
    router.replace('/(tabs)');
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>✨ Astrosetta</Text>
      <Text style={styles.subtitle}>
        Your personal astrology companion
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/sign-up')}
        >
          <Text style={styles.secondaryButtonText}>Create Account</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>
        Learn astrology while exploring your birth chart
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 48,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  secondaryButtonText: {
    color: '#6366f1',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    marginTop: 48,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
