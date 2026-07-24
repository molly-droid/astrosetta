/**
 * Learn tab - Educational content and XP progression
 */

import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useUserProfile, useAuth } from '@astro/shared';
import { calculateTier, calculateTierProgress } from '@astro/shared';

export default function LearnScreen() {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile();

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Please sign in to access learning content</Text>
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

  const tierProgress = calculateTierProgress(profile.total_xp);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {profile.display_name || 'Apprentice'}!</Text>
        <View style={styles.tierBadge}>
          <Text style={styles.tierText}>{profile.current_tier}</Text>
        </View>
      </View>

      <View style={styles.xpCard}>
        <Text style={styles.xpLabel}>Total XP</Text>
        <Text style={styles.xpValue}>{profile.total_xp.toLocaleString()}</Text>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${tierProgress * 100}%` }]} />
        </View>

        <Text style={styles.level}>Level {profile.level}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Learning Modules</Text>
        <Text style={styles.message}>
          Educational content coming soon!
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Quiz</Text>
        <Text style={styles.message}>
          Test your knowledge and earn XP
        </Text>
      </View>

      {profile.streak_count > 0 && (
        <View style={styles.streakCard}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakText}>
            {profile.streak_count} day streak!
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  tierBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tierText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  xpCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  xpLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  xpValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
  },
  level: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  streakCard: {
    margin: 20,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  streakEmoji: {
    fontSize: 24,
  },
  streakText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400e',
  },
});
