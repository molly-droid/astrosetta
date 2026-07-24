/**
 * Chart tab - View and manage birth charts
 */

import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useCharts, useAuth } from '@astro/shared';
import { ChartWheel } from '@astro/ui';

export default function ChartScreen() {
  const { user } = useAuth();
  const { charts, primaryChart, loading } = useCharts();

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Please sign in to view your charts</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Loading charts...</Text>
      </View>
    );
  }

  if (!primaryChart) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No Chart Yet</Text>
        <Text style={styles.message}>
          Create your first birth chart to get started
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{primaryChart.label}</Text>
        <Text style={styles.subtitle}>
          {new Date(primaryChart.birth_date).toLocaleDateString()}
          {primaryChart.birth_time && ` • ${primaryChart.birth_time}`}
        </Text>
        <Text style={styles.location}>{primaryChart.place_name}</Text>
      </View>

      <View style={styles.chartContainer}>
        <ChartWheel
          chartData={primaryChart.chart_data}
          size={350}
          showAspects={true}
        />
      </View>

      <View style={styles.info}>
        <Text style={styles.infoTitle}>House System</Text>
        <Text style={styles.infoText}>{primaryChart.house_system}</Text>
      </View>
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
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#999',
  },
  chartContainer: {
    alignItems: 'center',
    padding: 20,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  info: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
});
