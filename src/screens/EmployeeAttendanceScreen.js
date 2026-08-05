import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import CalendarGrid from '../components/CalendarGrid';
import MonthSelector from '../components/MonthSelector';
import { COLORS, SHADOWS } from '../constants/theme';
import { ATTENDANCE_STATUS, ATTENDANCE_LABELS, ATTENDANCE_SHORT } from '../constants/attendance';
import {
  getAttendanceForMonth, upsertAttendance, getAttendanceSummary
} from '../database/database';
import {
  getCurrentMonth, getPreviousMonth, getNextMonth, getMonthName, isCurrentOrLastMonth
} from '../utils/dateUtils';
import { captureAndShare } from '../utils/shareUtils';

export default function EmployeeAttendanceScreen({ route }) {
  const { employee } = route.params;
  const current = getCurrentMonth();
  const [year, setYear] = useState(current.year);
  const [month, setMonth] = useState(current.month);
  const [attendance, setAttendance] = useState({});
  const [summary, setSummary] = useState(null);
  const [statusModal, setStatusModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const calendarRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      loadAttendance();
    }, [year, month])
  );

  // Reload when returning from the background - the connection may have been
  // reopened, and whatever the last load produced could be stale or empty.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadAttendance();
    });
    return () => subscription.remove();
  }, [year, month]);

  async function loadAttendance() {
    try {
      const data = await getAttendanceForMonth(employee.id, year, month);
      const map = {};
      data.forEach((a) => {
        map[a.date] = a;
      });
      setAttendance(map);

      const s = await getAttendanceSummary(employee.id, year, month);
      setSummary(s);
      setLoadError(false);
    } catch (error) {
      // Surface the failure instead of silently leaving the calendar blank.
      console.error('Failed to load attendance:', error);
      setLoadError(true);
    }
  }

  function onDayPress(dateStr) {
    setSelectedDate(dateStr);
    setStatusModal(true);
  }

  async function setAttendanceStatus(status) {
    try {
      await upsertAttendance(employee.id, selectedDate, status);
      setStatusModal(false);
      loadAttendance();
    } catch (error) {
      console.error('Failed to update attendance:', error);
      Alert.alert('Save Failed', 'Could not update attendance. Please try again.');
    }
  }

  function goToPrev() {
    const prev = getPreviousMonth(year, month);
    setYear(prev.year);
    setMonth(prev.month);
  }

  function goToNext() {
    const next = getNextMonth(year, month);
    if (next.year > current.year || (next.year === current.year && next.month > current.month)) return;
    setYear(next.year);
    setMonth(next.month);
  }

  function getStatusColor(status) {
    switch (status) {
      case ATTENDANCE_STATUS.FULL_DAY: return COLORS.fullDay;
      case ATTENDANCE_STATUS.FIRST_HALF: return COLORS.halfDay;
      case ATTENDANCE_STATUS.SECOND_HALF: return COLORS.halfDay;
      case ATTENDANCE_STATUS.LEAVE: return COLORS.leave;
      default: return COLORS.absent;
    }
  }

  function renderAttendanceCell(dateStr, dayData) {
    if (!dayData) return null;
    const color = getStatusColor(dayData.status);
    const label = ATTENDANCE_SHORT[dayData.status] || '?';
    return (
      <View style={[styles.statusBadge, { backgroundColor: color }]}>
        <Text style={styles.statusText}>{label}</Text>
      </View>
    );
  }

  async function handleShare() {
    if (calendarRef.current) {
      await captureAndShare(calendarRef, `attendance_${employee.name}_${getMonthName(month)}_${year}`);
    }
  }

  const editable = isCurrentOrLastMonth(year, month);
  const workingDays = summary
    ? summary.full_days + (summary.first_halves * 0.5) + (summary.second_halves * 0.5)
    : 0;
  const excessLeaves = summary
    ? Math.max(0, summary.leaves - (employee.allowed_leaves || 0))
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.empName}>{employee.name}</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={22} color={COLORS.primary} />
          <Text style={styles.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      {loadError && (
        <TouchableOpacity style={styles.errorBanner} onPress={loadAttendance}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
          <Text style={styles.errorBannerText}>Could not load attendance. Tap to retry.</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.scroll}>
        <View ref={calendarRef} collapsable={false} style={styles.captureArea}>
          <View style={styles.captureHeader}>
            <Text style={styles.captureTitle}>Tyagi's Home - Attendance</Text>
            <Text style={styles.captureSubtitle}>{employee.name} | {employee.type === 'daily' ? 'Daily' : 'Monthly'}</Text>
          </View>

          <MonthSelector year={year} month={month} onPrev={goToPrev} onNext={goToNext} />

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.fullDay }]} />
              <Text style={styles.legendText}>Present</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.halfDay }]} />
              <Text style={styles.legendText}>Half Day</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.leave }]} />
              <Text style={styles.legendText}>Leave</Text>
            </View>
          </View>

          <View style={styles.calendarWrapper}>
            <CalendarGrid
              year={year}
              month={month}
              data={attendance}
              renderCell={renderAttendanceCell}
              onDayPress={onDayPress}
              isEditable={editable}
            />
          </View>

          {/* Summary */}
          {summary && (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Attendance Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Full Days:</Text>
                <Text style={styles.summaryValue}>{summary.full_days}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>1st Half Days:</Text>
                <Text style={styles.summaryValue}>{summary.first_halves}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>2nd Half Days:</Text>
                <Text style={styles.summaryValue}>{summary.second_halves}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Leaves:</Text>
                <Text style={[styles.summaryValue, summary.leaves > 0 && { color: COLORS.leave }]}>
                  {summary.leaves}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Allowed Leaves:</Text>
                <Text style={styles.summaryValue}>{employee.allowed_leaves}</Text>
              </View>
              {excessLeaves > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: COLORS.error }]}>Extra Leaves:</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.error, fontWeight: '700' }]}>
                    {excessLeaves}
                  </Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={[styles.summaryLabel, styles.totalLabel]}>Working Days:</Text>
                <Text style={[styles.summaryValue, styles.totalValue]}>{workingDays}</Text>
              </View>
              {employee.type === 'daily' && employee.salary > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, styles.totalLabel]}>Estimated Pay:</Text>
                  <Text style={[styles.summaryValue, styles.totalValue]}>
                    ₹{(workingDays * employee.salary).toFixed(0)}
                  </Text>
                </View>
              )}
              {employee.type === 'monthly' && employee.salary > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, styles.totalLabel]}>Salary:</Text>
                  <Text style={[styles.summaryValue, styles.totalValue]}>
                    ₹{employee.salary} {excessLeaves > 0 ? `(- ₹${((employee.salary / 30) * excessLeaves).toFixed(0)} deduction)` : ''}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Status Selection Modal */}
      <Modal visible={statusModal} transparent animationType="fade">
        <ScrollView contentContainerStyle={[styles.modalOverlay, styles.modalScrollContent]} keyboardShouldPersistTaps="handled">
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Mark Attendance</Text>
            <Text style={styles.modalSubtitle}>{selectedDate}</Text>

            {Object.entries(ATTENDANCE_STATUS).map(([key, value]) => (
              <TouchableOpacity
                key={key}
                style={[styles.statusOption, { borderLeftColor: getStatusColor(value) }]}
                onPress={() => setAttendanceStatus(value)}
              >
                <View style={[styles.statusOptionDot, { backgroundColor: getStatusColor(value) }]} />
                <Text style={styles.statusOptionText}>{ATTENDANCE_LABELS[value]}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setStatusModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  empName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  shareBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 4 },
  shareBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEA',
    marginHorizontal: 8,
    marginTop: 6,
    padding: 10,
    borderRadius: 8,
  },
  errorBannerText: { color: COLORS.error, fontSize: 13, fontWeight: '600' },
  scroll: { flex: 1 },
  captureArea: { backgroundColor: COLORS.surface, margin: 8, borderRadius: 12, overflow: 'hidden' },
  captureHeader: { backgroundColor: COLORS.primary, padding: 10, alignItems: 'center' },
  captureTitle: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  captureSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingVertical: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: COLORS.textSecondary },
  calendarWrapper: { paddingHorizontal: 4 },
  statusBadge: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  statusText: { fontSize: 9, color: COLORS.white, fontWeight: '700' },
  summary: {
    margin: 12,
    padding: 12,
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
  },
  summaryTitle: { fontWeight: '700', fontSize: 15, marginBottom: 8, color: COLORS.text },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { fontSize: 14, color: COLORS.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  totalRow: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4, paddingTop: 8 },
  totalLabel: { fontWeight: '700', color: COLORS.text },
  totalValue: { fontWeight: '700', color: COLORS.primary, fontSize: 15 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    marginBottom: 8,
    borderLeftWidth: 4,
    gap: 10,
  },
  statusOptionDot: { width: 12, height: 12, borderRadius: 6 },
  statusOptionText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#EEE',
    alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
});
