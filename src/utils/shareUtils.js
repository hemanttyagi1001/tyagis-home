import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
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
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Share ${filename}`,
        UTI: 'public.png',
      });
    } else {
      Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
    }

    return true;
  } catch (error) {
    console.error('Error sharing:', error);
    Alert.alert('Share Error', 'Could not share the image. Please try again.');
    return false;
  }
}
