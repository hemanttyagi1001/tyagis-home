import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SHADOWS } from '../constants/theme';
import { EMPLOYEE_TYPE } from '../constants/attendance';
import { getEmployees, addEmployee, updateEmployee, deleteEmployee } from '../database/database';

export default function EmployeeListScreen({ navigation }) {
  const [employees, setEmployees] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'daily', salary: '', allowedLeaves: '2' });
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadEmployees();
    }, [])
  );

  // Reload when returning from the background - the connection may have been
  // reopened, and the previous load could have failed while backgrounded.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadEmployees();
    });
    return () => subscription.remove();
  }, []);

  async function loadEmployees() {
    try {
      const data = await getEmployees(true);
      setEmployees(data);
      setLoadError(false);
    } catch (error) {
      // Surface the failure instead of silently rendering the empty state.
      console.error('Failed to load employees:', error);
      setLoadError(true);
    }
  }

  function openAddModal() {
    setEditingEmployee(null);
    setForm({ name: '', type: 'daily', salary: '', allowedLeaves: '2' });
    setModalVisible(true);
  }

  function openEditModal(emp) {
    setEditingEmployee(emp);
    setForm({
      name: emp.name,
      type: emp.type,
      salary: String(emp.salary || 0),
      allowedLeaves: String(emp.allowed_leaves || 0),
    });
    setModalVisible(true);
  }

  async function saveEmployee() {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Please enter employee name');
      return;
    }

    try {
      if (editingEmployee) {
        await updateEmployee(
          editingEmployee.id,
          form.name.trim(),
          form.type,
          parseFloat(form.salary) || 0,
          parseInt(form.allowedLeaves) || 0
        );
      } else {
        await addEmployee(
          form.name.trim(),
          form.type,
          parseFloat(form.salary) || 0,
          parseInt(form.allowedLeaves) || 0
        );
      }

      setModalVisible(false);
      loadEmployees();
    } catch (error) {
      console.error('Failed to save employee:', error);
      Alert.alert('Save Failed', 'Could not save this employee. Please try again.');
    }
  }

  function confirmDelete(emp) {
    Alert.alert(
      'Remove Employee',
      `Are you sure you want to remove ${emp.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEmployee(emp.id);
              loadEmployees();
            } catch (error) {
              console.error('Failed to remove employee:', error);
              Alert.alert('Remove Failed', 'Could not remove this employee. Please try again.');
            }
          },
        },
      ]
    );
  }

  function renderEmployee({ item }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('EmployeeAttendance', { employee: item })}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.empName}>{item.name}</Text>
            <Text style={styles.empType}>
              {item.type === 'daily' ? 'Daily Basis' : 'Monthly Basis'} | ₹{item.salary}
            </Text>
            <Text style={styles.empLeaves}>Allowed Leaves: {item.allowed_leaves}/month</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={employees}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEmployee}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loadError ? (
            // Never show "No employees added" when the read actually failed -
            // that is what made the bug look like silent data loss.
            <View style={styles.empty}>
              <Ionicons name="alert-circle-outline" size={60} color={COLORS.error} />
              <Text style={styles.emptyText}>Could not load employees</Text>
              <Text style={styles.emptySubtext}>Your data is safe. Tap below to retry.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadEmployees}>
                <Ionicons name="refresh" size={16} color={COLORS.white} />
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={60} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No employees added</Text>
              <Text style={styles.emptySubtext}>Tap + to add your first employee</Text>
            </View>
          )
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>
                {editingEmployee ? 'Edit Employee' : 'Add Employee'}
              </Text>

              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
                placeholder="Employee name"
              />

              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, form.type === 'daily' && styles.typeBtnActive]}
                  onPress={() => setForm({ ...form, type: 'daily' })}
                >
                  <Text style={[styles.typeBtnText, form.type === 'daily' && styles.typeBtnTextActive]}>Daily</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, form.type === 'monthly' && styles.typeBtnActive]}
                  onPress={() => setForm({ ...form, type: 'monthly' })}
                >
                  <Text style={[styles.typeBtnText, form.type === 'monthly' && styles.typeBtnTextActive]}>Monthly</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Salary (₹)</Text>
              <TextInput
                style={styles.input}
                value={form.salary}
                onChangeText={(t) => setForm({ ...form, salary: t })}
                keyboardType="decimal-pad"
                placeholder="0"
              />

              <Text style={styles.inputLabel}>Allowed Leaves per Month</Text>
              <TextInput
                style={styles.input}
                value={form.allowedLeaves}
                onChangeText={(t) => setForm({ ...form, allowedLeaves: t })}
                keyboardType="number-pad"
                placeholder="0"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveEmployee}>
                  <Text style={styles.saveBtnText}>Save</Text>
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
  list: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: COLORS.white, fontWeight: '700', fontSize: 18 },
  empName: { fontWeight: '700', fontSize: 16, color: COLORS.text },
  empType: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  empLeaves: { fontSize: 12, color: COLORS.textLight, marginTop: 1 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6 },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.textSecondary, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  retryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: COLORS.background,
  },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { fontWeight: '600', color: COLORS.textSecondary },
  typeBtnTextActive: { color: COLORS.white },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#EEE' },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: COLORS.primary },
  saveBtnText: { color: COLORS.white, fontWeight: '600' },
});
