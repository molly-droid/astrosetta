/**
 * Sign Up screen
 */

import { View, Text, StyleSheet } from 'react-native';

export default function SignUpScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.message}>
        Registration UI coming soon!
      </Text>
      <Text style={styles.hint}>
        Will integrate with Supabase Auth (Email/OAuth)
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
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  message: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
