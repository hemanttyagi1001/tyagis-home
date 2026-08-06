import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getPendingCrash, clearPendingCrash, sendCrashReport } from '../utils/crashReporter';

// Shown once on launch when the previous session ended in a crash. The report
// is written to disk at crash time; this is where the user gets to send it.
export default function CrashReportPrompt() {
  const [crash, setCrash] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending = await getPendingCrash();
      if (!cancelled) setCrash(pending);
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSend() {
    setSending(true);
    try {
      const result = await sendCrashReport(crash);
      if (!result.ok && result.reason === 'no-mail-app') {
        Alert.alert(
          'No mail app',
          'No email app is set up on this device, so the report could not be opened.'
        );
        setSending(false);
        return;
      }
      // Clear on anything but an explicit cancel, so the same crash is not
      // reported repeatedly.
      await clearPendingCrash();
      setCrash(null);
    } catch (error) {
      console.error('Failed to open crash report email:', error);
      Alert.alert('Could not open email', 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleDismiss() {
    await clearPendingCrash();
    setCrash(null);
  }

  if (!crash) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Ionicons name="bug-outline" size={40} color={COLORS.secondary} />
          <Text style={styles.title}>The app closed unexpectedly</Text>
          <Text style={styles.body}>
            Sending the error details helps get it fixed. Your milk and attendance
            records are not included.
          </Text>

          <ScrollView style={styles.detail} contentContainerStyle={styles.detailInner}>
            <Text style={styles.detailText} numberOfLines={6}>
              {crash.message}
            </Text>
          </ScrollView>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss} disabled={sending}>
              <Text style={styles.dismissText}>Not now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
              <Text style={styles.sendText}>{sending ? 'Opening…' : 'Send report'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  body: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  detail: {
    maxHeight: 96,
    alignSelf: 'stretch',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginTop: 4,
  },
  detailInner: { padding: 10 },
  detailText: { fontSize: 11, color: COLORS.textLight, fontFamily: 'monospace' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 12, alignSelf: 'stretch' },
  dismissBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#EEE',
    alignItems: 'center',
  },
  dismissText: { color: COLORS.textSecondary, fontWeight: '600' },
  sendBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  sendText: { color: COLORS.white, fontWeight: '700' },
});
