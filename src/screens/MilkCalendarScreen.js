import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import CalendarGrid from '../components/CalendarGrid';
import MonthSelector from '../components/MonthSelector';
import { COLORS, SHADOWS } from '../constants/theme';
import {
  getMilkEntriesForMonth, upsertMilkEntry, getMilkDefaults, updateMilkDefaults
} from '../database/database';
import {
  getCurrentMonth, getPreviousMonth, getNextMonth, getMonthName, isCurrentOrLastMonth
} from '../utils/dateUtils';
import { captureAndShare, captureAndSaveToGallery } from '../utils/shareUtils';

export default function MilkCalendarScreen() {
  const current = getCurrentMonth();
  const [year, setYear] = useState(current.year);
  const [month, setMonth] = useState(current.month);
  const [entries, setEntries] = useState({});
  const [editModal, setEditModal] = useState(false);
  const [defaultsModal, setDefaultsModal] = useState(false);
  const [editDate, setEditDate] = useState(null);
  const [editData, setEditData] = useState({ buffaloLitres: '', buffaloPrice: '', cowLitres: '', cowPrice: '' });
  const [defaults, setDefaults] = useState({ buffaloLitres: '', buffaloPrice: '', cowLitres: '', cowPrice: '' });
  const [loadError, setLoadError] = useState(false);
  const calendarRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [year, month])
  );

  // Reload when returning from the background - the connection may have been
  // reopened, and whatever the last load produced could be stale or empty.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadEntries();
    });
    return () => subscription.remove();
  }, [year, month]);

  async function loadEntries() {
    try {
      const data = await getMilkEntriesForMonth(year, month);
      const map = {};
      data.forEach((e) => {
        map[e.date] = e;
      });
      setEntries(map);
      setLoadError(false);
    } catch (error) {
      // Surface the failure instead of silently leaving the calendar blank.
      console.error('Failed to load milk entries:', error);
      setLoadError(true);
    }
  }

  async function openDefaults() {
    try {
      const d = await getMilkDefaults();
      setDefaults({
        buffaloLitres: String(d?.buffalo_litres || 0),
        buffaloPrice: String(d?.buffalo_price_per_litre || 0),
        cowLitres: String(d?.cow_litres || 0),
        cowPrice: String(d?.cow_price_per_litre || 0),
      });
      setDefaultsModal(true);
    } catch (error) {
      console.error('Failed to load milk defaults:', error);
      Alert.alert('Error', 'Could not load default values. Please try again.');
    }
  }

  async function saveDefaults() {
    try {
      await updateMilkDefaults(
        parseFloat(defaults.buffaloLitres) || 0,
        parseFloat(defaults.buffaloPrice) || 0,
        parseFloat(defaults.cowLitres) || 0,
        parseFloat(defaults.cowPrice) || 0
      );
      setDefaultsModal(false);
      Alert.alert('Saved', 'Default milk values updated. New entries will use these defaults.');
    } catch (error) {
      console.error('Failed to save milk defaults:', error);
      Alert.alert('Save Failed', 'Could not save the default values. Please try again.');
    }
  }

  function onDayPress(dateStr, dayData) {
    setEditDate(dateStr);
    setEditData({
      buffaloLitres: String(dayData?.buffalo_litres || 0),
      cowLitres: String(dayData?.cow_litres || 0),
    });
    setEditModal(true);
  }

  async function fillFromDefaults() {
    try {
      const d = await getMilkDefaults();
      if (d) {
        setEditData({
          buffaloLitres: String(d.buffalo_litres || 0),
          cowLitres: String(d.cow_litres || 0),
        });
      }
    } catch (error) {
      console.error('Failed to fill from defaults:', error);
    }
  }

  async function saveEntry() {
    try {
      // Use price from defaults, only litres are editable daily
      const currentDefaults = await getMilkDefaults();
      await upsertMilkEntry(
        editDate,
        parseFloat(editData.buffaloLitres) || 0,
        currentDefaults?.buffalo_price_per_litre || 0,
        parseFloat(editData.cowLitres) || 0,
        currentDefaults?.cow_price_per_litre || 0
      );
      setEditModal(false);
      loadEntries();
    } catch (error) {
      console.error('Failed to save milk entry:', error);
      Alert.alert('Save Failed', 'Could not save this entry. Please try again.');
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

  // Calculate totals
  const entryList = Object.values(entries);
  const totalBuffaloLitres = entryList.reduce((s, e) => s + (e.buffalo_litres || 0), 0);
  const totalCowLitres = entryList.reduce((s, e) => s + (e.cow_litres || 0), 0);
  const totalBuffaloAmount = entryList.reduce((s, e) => s + (e.buffalo_litres || 0) * (e.buffalo_price_per_litre || 0), 0);
  const totalCowAmount = entryList.reduce((s, e) => s + (e.cow_litres || 0) * (e.cow_price_per_litre || 0), 0);

  function renderMilkCell(dateStr, dayData) {
    // No row at all - nothing was ever recorded for this day.
    if (!dayData) return null;

    const bLtr = dayData.buffalo_litres || 0;
    const cLtr = dayData.cow_litres || 0;

    // A day saved as zero means milk did not come, which is a real record and
    // has to look different from a day with no record. Both used to render as
    // an empty cell, so "no delivery" was indistinguishable from "not filled
    // in yet" - and there was no way to tell from the calendar which it was.
    if (bLtr === 0 && cLtr === 0) {
      return (
        <View style={styles.cellContent}>
          <Text style={styles.cellNone}>0</Text>
        </View>
      );
    }

    return (
      <View style={styles.cellContent}>
        {bLtr > 0 && <Text style={styles.cellBuffalo}>B:{bLtr}</Text>}
        {cLtr > 0 && <Text style={styles.cellCow}>C:{cLtr}</Text>}
      </View>
    );
  }

  async function handleShare() {
    if (calendarRef.current) {
      await captureAndShare(calendarRef, `milk_${getMonthName(month)}_${year}`);
    }
  }

  async function handleSave() {
    if (calendarRef.current) {
      await captureAndSaveToGallery(calendarRef, `milk_${getMonthName(month)}_${year}`);
    }
  }

  const editable = isCurrentOrLastMonth(year, month);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={openDefaults} style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={22} color={COLORS.primary} />
          <Text style={styles.iconBtnText}>Defaults</Text>
        </TouchableOpacity>
        <View style={styles.topBarRight}>
          <TouchableOpacity onPress={handleSave} style={styles.iconBtn}>
            <Ionicons name="download-outline" size={22} color={COLORS.primary} />
            <Text style={styles.iconBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
            <Ionicons name="share-outline" size={22} color={COLORS.primary} />
            <Text style={styles.iconBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loadError && (
        <TouchableOpacity style={styles.errorBanner} onPress={loadEntries}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
          <Text style={styles.errorBannerText}>Could not load records. Tap to retry.</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.scroll}>
        <View ref={calendarRef} collapsable={false} style={styles.captureArea}>
          <View style={styles.captureHeader}>
            <Text style={styles.captureTitle}>Tyagi's Home - Milk Record</Text>
          </View>
          <MonthSelector year={year} month={month} onPrev={goToPrev} onNext={goToNext} />
          <View style={styles.calendarWrapper}>
            <CalendarGrid
              year={year}
              month={month}
              data={entries}
              renderCell={renderMilkCell}
              onDayPress={onDayPress}
              isEditable={editable}
            />
          </View>

          {/* Summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Monthly Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Buffalo Milk:</Text>
              <Text style={styles.summaryValue}>{totalBuffaloLitres.toFixed(1)} L | ₹{totalBuffaloAmount.toFixed(0)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Cow Milk:</Text>
              <Text style={styles.summaryValue}>{totalCowLitres.toFixed(1)} L | ₹{totalCowAmount.toFixed(0)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={[styles.summaryLabel, styles.totalLabel]}>Total:</Text>
              <Text style={[styles.summaryValue, styles.totalValue]}>
                {(totalBuffaloLitres + totalCowLitres).toFixed(1)} L | ₹{(totalBuffaloAmount + totalCowAmount).toFixed(0)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Edit Entry Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Milk Entry - {editDate}</Text>
              <Text style={styles.modalSubtitle}>Price is picked from defaults</Text>

              <TouchableOpacity style={styles.fillDefaultsBtn} onPress={fillFromDefaults}>
                <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                <Text style={styles.fillDefaultsText}>Fill from Defaults</Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Buffalo Litres</Text>
              <TextInput
                style={styles.input}
                value={editData.buffaloLitres}
                onChangeText={(t) => setEditData({ ...editData, buffaloLitres: t })}
                keyboardType="decimal-pad"
                placeholder="0"
              />

              <Text style={styles.inputLabel}>Cow Litres</Text>
              <TextInput
                style={styles.input}
                value={editData.cowLitres}
                onChangeText={(t) => setEditData({ ...editData, cowLitres: t })}
                keyboardType="decimal-pad"
                placeholder="0"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveEntry}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Defaults Modal */}
      <Modal visible={defaultsModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Milk Defaults</Text>
              <Text style={styles.modalSubtitle}>Auto-added daily for new entries</Text>

              <Text style={styles.inputLabel}>Buffalo Litres</Text>
              <TextInput
                style={styles.input}
                value={defaults.buffaloLitres}
                onChangeText={(t) => setDefaults({ ...defaults, buffaloLitres: t })}
                keyboardType="decimal-pad"
                placeholder="0"
              />

              <Text style={styles.inputLabel}>Buffalo Price/Litre (₹)</Text>
              <TextInput
                style={styles.input}
                value={defaults.buffaloPrice}
                onChangeText={(t) => setDefaults({ ...defaults, buffaloPrice: t })}
                keyboardType="decimal-pad"
                placeholder="0"
              />

              <Text style={styles.inputLabel}>Cow Litres</Text>
              <TextInput
                style={styles.input}
                value={defaults.cowLitres}
                onChangeText={(t) => setDefaults({ ...defaults, cowLitres: t })}
                keyboardType="decimal-pad"
                placeholder="0"
              />

              <Text style={styles.inputLabel}>Cow Price/Litre (₹)</Text>
              <TextInput
                style={styles.input}
                value={defaults.cowPrice}
                onChangeText={(t) => setDefaults({ ...defaults, cowPrice: t })}
                keyboardType="decimal-pad"
                placeholder="0"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setDefaultsModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveDefaults}>
                  <Text style={styles.saveBtnText}>Save Defaults</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: COLORS.surface,
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 4 },
  iconBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
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
  calendarWrapper: { paddingHorizontal: 4 },
  cellContent: { alignItems: 'center', marginTop: 1 },
  cellBuffalo: { fontSize: 8, color: '#1565C0', fontWeight: '600' },
  cellCow: { fontSize: 8, color: '#E65100', fontWeight: '600' },
  // Muted next to the litre figures: it marks a day as accounted for without
  // competing with the days that actually carry a quantity.
  cellNone: { fontSize: 8, color: COLORS.textLight, fontWeight: '600' },
  summary: {
    margin: 12,
    padding: 12,
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
  },
  summaryTitle: { fontWeight: '700', fontSize: 15, marginBottom: 8, color: COLORS.text },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 14, color: COLORS.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  totalRow: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4, paddingTop: 8 },
  totalLabel: { fontWeight: '700', color: COLORS.text },
  totalValue: { fontWeight: '700', color: COLORS.primary, fontSize: 15 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  fillDefaultsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 8,
    gap: 4,
  },
  fillDefaultsText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: COLORS.background,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#EEE' },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: COLORS.primary },
  saveBtnText: { color: COLORS.white, fontWeight: '600' },
});
