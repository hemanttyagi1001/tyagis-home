import * as FileSystem from 'expo-file-system/legacy';
import * as MailComposer from 'expo-mail-composer';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

const DEVELOPER_EMAIL = 'hemanttyagi1001@gmail.com';
const CRASH_FILE = `${FileSystem.documentDirectory}pending-crash.json`;

// A crash cannot be mailed as it happens - the process is going down and the
// mail client will not reliably open. So the report is written to disk here and
// offered to the user on the next launch instead.

function describeDevice() {
  return {
    app: `${Application.applicationName ?? "Tyagi's Home"} ${Application.nativeApplicationVersion ?? '?'} (build ${Application.nativeBuildVersion ?? '?'})`,
    device: `${Device.manufacturer ?? '?'} ${Device.modelName ?? '?'}`,
    os: `${Platform.OS} ${Device.osVersion ?? Platform.Version}`,
    deviceType: Device.isDevice ? 'physical device' : 'emulator',
  };
}

// Writes the crash to disk. Deliberately synchronous-ish and defensive: if this
// throws during a crash it must not mask the original error.
export async function saveCrashReport(error, context = {}) {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      message: String(error?.message ?? error),
      stack: error?.stack ? String(error.stack) : '(no stack trace available)',
      componentStack: context.componentStack ? String(context.componentStack) : null,
      isFatal: context.isFatal ?? null,
      ...describeDevice(),
    };
    await FileSystem.writeAsStringAsync(CRASH_FILE, JSON.stringify(report));
  } catch (writeError) {
    // Nothing useful left to do - never let reporting break the app further.
    console.error('Could not save crash report:', writeError);
  }
}

export async function getPendingCrash() {
  try {
    const info = await FileSystem.getInfoAsync(CRASH_FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(CRASH_FILE);
    return JSON.parse(raw);
  } catch {
    // Unreadable or corrupt - drop it rather than prompting about nothing.
    await clearPendingCrash();
    return null;
  }
}

export async function clearPendingCrash() {
  try {
    await FileSystem.deleteAsync(CRASH_FILE, { idempotent: true });
  } catch {
    // Already gone.
  }
}

function formatBody(report) {
  return [
    'A crash was recorded in Tyagi\'s Home.',
    '',
    `When       : ${report.timestamp}`,
    `App        : ${report.app}`,
    `Device     : ${report.device} (${report.deviceType})`,
    `OS         : ${report.os}`,
    `Fatal      : ${report.isFatal === null ? 'unknown' : report.isFatal}`,
    '',
    '--- Error ---',
    report.message,
    '',
    '--- Stack trace ---',
    report.stack,
    ...(report.componentStack
      ? ['', '--- Component stack ---', report.componentStack]
      : []),
    '',
    '--- Anything else? ---',
    'What were you doing when this happened?',
    '',
  ].join('\n');
}

// Opens the user's mail app pre-filled. Returns true if the report was sent or
// the user is done with it, so the caller knows to clear the stored crash.
export async function sendCrashReport(report) {
  const available = await MailComposer.isAvailableAsync();
  if (!available) return { ok: false, reason: 'no-mail-app' };

  const subject = `Tyagi's Home crash - ${report.timestamp.slice(0, 10)}`;
  const result = await MailComposer.composeAsync({
    recipients: [DEVELOPER_EMAIL],
    subject,
    body: formatBody(report),
  });

  // 'sent' on Android is often reported as 'undetermined' because the mail app
  // does not report back. Treat anything other than an explicit cancel as done,
  // otherwise the user is prompted about the same crash forever.
  return { ok: result.status !== 'cancelled', status: result.status };
}

// Installs a global handler for uncaught JS errors. React's ErrorBoundary only
// catches render errors, so this covers the rest (async callbacks, event
// handlers, native module errors).
export function installGlobalErrorHandler() {
  const globalHandler = global.ErrorUtils?.getGlobalHandler?.();
  if (!globalHandler) return;

  global.ErrorUtils.setGlobalHandler(async (error, isFatal) => {
    await saveCrashReport(error, { isFatal });
    // Hand back to the default handler so the crash still surfaces normally in
    // development and the app dies as it otherwise would in production.
    globalHandler(error, isFatal);
  });
}
