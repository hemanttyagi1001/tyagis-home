import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { getMonthDays, getFirstDayOfMonth, getDayName, isFutureDate } from '../utils/dateUtils';

export default function CalendarGrid({ year, month, data, renderCell, onDayPress, isEditable }) {
  const totalDays = getMonthDays(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const cells = [];
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: null, key: `empty-${i}` });
  }
  // Day cells
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayData = data ? data[dateStr] : null;
    const future = isFutureDate(dateStr);
    cells.push({ day: d, dateStr, dayData, future, key: `day-${d}` });
  }

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {dayNames.map((name) => (
          <View key={name} style={styles.headerCell}>
            <Text style={styles.headerText}>{name}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell) => {
            if (!cell.day) {
              return <View key={cell.key} style={styles.cell} />;
            }
            const canPress = !cell.future && isEditable && onDayPress;
            return (
              <TouchableOpacity
                key={cell.key}
                style={[styles.cell, cell.future && styles.futureCell]}
                onPress={() => canPress && onDayPress(cell.dateStr, cell.dayData)}
                disabled={!canPress}
                activeOpacity={canPress ? 0.6 : 1}
              >
                <Text style={[styles.dayNumber, cell.future && styles.futureText]}>{cell.day}</Text>
                {renderCell && !cell.future && renderCell(cell.dateStr, cell.dayData)}
              </TouchableOpacity>
            );
          })}
          {/* Fill remaining cells in last row */}
          {row.length < 7 && Array.from({ length: 7 - row.length }).map((_, i) => (
            <View key={`pad-${i}`} style={styles.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    minHeight: 52,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 2,
    alignItems: 'center',
  },
  futureCell: {
    backgroundColor: '#F5F5F5',
  },
  dayNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  futureText: {
    color: COLORS.textLight,
  },
});
