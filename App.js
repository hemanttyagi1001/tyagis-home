import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import CrashReportPrompt from './src/components/CrashReportPrompt';
import { installGlobalErrorHandler } from './src/utils/crashReporter';
import { registerBackgroundTask } from './src/utils/backgroundTask';
import {
  getDatabase, addDefaultMilkEntryForDate, markDefaultAttendanceForDate,
} from './src/database/database';
import { getToday } from './src/utils/dateUtils';

// Installed at module scope so uncaught errors are captured from the earliest
// possible moment, including anything thrown during the first render.
installGlobalErrorHandler();

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

    // On returning to the foreground, only re-seed today's defaults - the day
    // may have rolled over while the app was backgrounded.
    //
    // This deliberately does NOT close and reopen the connection. Doing that
    // tore down a perfectly good handle on every resume, and the screens reload
    // on the same 'active' event with no ordering guarantee, so their queries
    // could hit a connection mid-teardown and surface a retry banner. A stale
    // handle is already handled where it matters: withDatabase() reopens and
    // retries on demand.
    const subscription = AppState.addEventListener('change', async (nextState) => {
      const cameToForeground =
        appState.current.match(/inactive|background/) && nextState === 'active';
      appState.current = nextState;
      if (!cameToForeground) return;

      try {
        await seedToday();
      } catch (error) {
        console.error('Re-seeding on foreground failed:', error);
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <AppNavigator />
      <CrashReportPrompt />
    </ErrorBoundary>
  );
}
