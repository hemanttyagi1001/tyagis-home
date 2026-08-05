import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import {
  addDefaultMilkEntryForDate, markDefaultAttendanceForDate, getDatabase, resetDatabase,
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
  } finally {
    // Release the handle we opened here. The OS may tear this connection down
    // once the task returns, and a dead handle left in the module cache is
    // exactly what made the app show blank data on the next foreground.
    await resetDatabase();
  }
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
