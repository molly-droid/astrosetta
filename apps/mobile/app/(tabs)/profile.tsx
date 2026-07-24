/**
 * Profile tab - User settings and account management
 */

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUserProfile } from '@astro/shared';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { profile, loading } = useUserProfile();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Please sign in to view your profile</Text>
      </View>
    );
  }

  if (loading || !profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile.display_name || user.email || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{profile.display_name || 'User'}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Edit Profile</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>My Charts</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Preferences</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>

        <View style={styles.tierCard}>
          <Text style={styles.tierLabel}>Current Plan</Text>
          <Text style={styles.tierValue}>Free Tier</Text>
          <Text style={styles.tierDescription}>
            Upgrade to unlock AI-powered interpretations and calendar sync
          </Text>

          <TouchableOpacity style={styles.upgradeButton}>
            <Text style={styles.upgradeButtonText}>View Plans</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Help & FAQ</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Send Feedback</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Privacy Policy</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    padding: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  menuItemArrow: {
    fontSize: 24,
    color: '#999',
  },
  tierCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
  },
  tierLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  tierValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  tierDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  upgradeButton: {
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  signOutButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  version: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
});
