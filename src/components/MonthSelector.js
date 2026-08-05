import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getMonthName, isCurrentOrLastMonth, getCurrentMonth } from '../utils/dateUtils';

export default function MonthSelector({ year, month, onPrev, onNext }) {
  const current = getCurrentMonth();
  const isCurrentMonth = year === current.year && month === current.month;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onPrev}
        style={styles.button}
        disabled={!isCurrentOrLastMonth(year, month) && false}
      >
        <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
      </TouchableOpacity>
      <Text style={styles.title}>{getMonthName(month)} {year}</Text>
      <TouchableOpacity
        onPress={onNext}
        style={styles.button}
        disabled={isCurrentMonth}
      >
        <Ionicons
          name="chevron-forward"
          size={24}
          color={isCurrentMonth ? COLORS.textLight : COLORS.primary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
});
