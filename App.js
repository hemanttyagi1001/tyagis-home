import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { registerBackgroundTask } from './src/utils/backgroundTask';
import {
  getDatabase, resetDatabase, addDefaultMilkEntryForDate, markDefaultAttendanceForDate,
} from './src/database/database';
import { getToday } from './src/utils/dateUtils';

export default function App() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    async function seedToday() {
      const today = getToday();
      await addDefaultMilkEntryForDate(today);
      await markDefaultAttendanceForDate(today);
    }

    async function init() {
      try {
        await getDatabase();
        await seedToday();
        await registerBackgroundTask();
      } catch (error) {
        console.error('App init error:', error);
      }
    }

    init();

    // Android can close the native SQLite connection while the JS context stays
    // alive. Reconnect on every foreground so the first query after resuming
    // hits a live handle instead of returning empty results.
    const subscription = AppState.addEventListener('change', async (nextState) => {
      const cameToForeground =
        appState.current.match(/inactive|background/) && nextState === 'active';
      appState.current = nextState;
      if (!cameToForeground) return;

      try {
        await resetDatabase();
        await getDatabase();
        // The day may have rolled over while the app was backgrounded.
        await seedToday();
      } catch (error) {
        console.error('Reconnect on foreground failed:', error);
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <AppNavigator />
    </ErrorBoundary>
  );
}
