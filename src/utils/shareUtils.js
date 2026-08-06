import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export async function captureAndShare(viewRef, filename = 'calendar') {
  try {
    const ref = viewRef?.current ?? viewRef;
    if (!ref) {
      Alert.alert('Error', 'Could not capture the view. Please try again.');
      return false;
    }

    const uri = await captureRef(ref, {
      format: 'png',
      quality: 0.9,
      // Write to a real file rather than a temporary in-memory handle, so the
      // receiving app can read it after the share sheet hands it over.
      result: 'tmpfile',
      fileName: filename,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
      return false;
    }

    await Sharing.shareAsync(uri, {
      // image/png alone makes Android offer file destinations - "save to
      // gallery" and little else. image/* matches what messaging apps register
      // for, so WhatsApp, Gmail and the rest appear in the sheet.
      mimeType: 'image/*',
      dialogTitle: `Share ${filename}`,
      UTI: 'public.png',
    });

    return true;
  } catch (error) {
    console.error('Error sharing:', error);
    Alert.alert('Share Error', 'Could not share the image. Please try again.');
    return false;
  }
}
