import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import {
  addDefaultMilkEntryForDate, markDefaultAttendanceForDate, getDatabase,
} from '../database/database';
import { getToday } from './dateUtils';

const BACKGROUND_TASK_NAME = 'DAILY_AUTO_ENTRY';

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    await getDatabase();
    const today = getToday();
    await addDefaultMilkEntryForDate(today);
    await markDefaultAttendanceForDate(today);
    console.log('Background task: Added default entries for', today);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
  // Deliberately does not close the connection. This task shares the app's JS
  // context, so when it runs while the app is open the handle it would close is
  // the same one the visible screens are querying - which showed up as an
  // intermittent "could not load records" banner. If the OS tears the
  // connection down after this returns, withDatabase() reopens it on the next
  // query anyway.
});

export async function registerBackgroundTask() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
      console.log('Background fetch is denied');
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
        minimumInterval: 60 * 60, // 1 hour - OS will schedule around 2 AM
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('Background task registered');
    }
  } catch (error) {
    console.error('Failed to register background task:', error);
  }
}
