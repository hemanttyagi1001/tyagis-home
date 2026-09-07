import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SHADOWS } from '../constants/theme';
import { getDatabase, seedDefaultsThrough } from '../database/database';
import { getToday } from '../utils/dateUtils';

export default function HomeScreen({ navigation }) {
  useFocusEffect(
    React.useCallback(() => {
      initializeToday();
    }, [])
  );

  async function initializeToday() {
    try {
      await getDatabase();
      await seedDefaultsThrough(getToday());
    } catch (error) {
      // Seeding today's defaults is best-effort - the calendar screens still
      // render, and getDatabase() retries the connection on their next query.
      console.error('Init error:', error);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header / Branding */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Manage your daily essentials</Text>
        </View>
      </View>

      {/* Cards */}
      <View style={styles.cardsContainer}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#E8F5E9' }]}
          onPress={() => navigation.navigate('MilkTab')}
          activeOpacity={0.7}
        >
          <View style={[styles.cardIcon, { backgroundColor: COLORS.primary }]}>
            <Ionicons name="water" size={28} color={COLORS.white} />
          </View>
          <Text style={styles.cardTitle}>Milk Tracker</Text>
          <Text style={styles.cardDesc}>Track daily buffalo & cow milk</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#FFF3E0' }]}
          onPress={() => navigation.navigate('EmployeeTab')}
          activeOpacity={0.7}
        >
          <View style={[styles.cardIcon, { backgroundColor: COLORS.secondary }]}>
            <Ionicons name="people" size={28} color={COLORS.white} />
          </View>
          <Text style={styles.cardTitle}>Attendance</Text>
          <Text style={styles.cardDesc}>Manage employee attendance</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoImage: {
    width: 240,
    height: 100,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  cardsContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 30,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    ...SHADOWS.medium,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
