import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

const ALBUM = "Tyagi's Home";

async function capture(viewRef, filename) {
  const ref = viewRef?.current ?? viewRef;
  if (!ref) return null;

  return await captureRef(ref, {
    format: 'png',
    quality: 0.9,
    // Write to a real file rather than a temporary in-memory handle, so the
    // receiving app can read it after the share sheet hands it over.
    result: 'tmpfile',
    fileName: filename,
  });
}

// Saves the calendar straight to the photo gallery. Apps that accept a receipt
// from their own picker - Splitwise among them - cannot take an image from the
// share sheet, so the reliable route is to save it and attach it from there.
export async function captureAndSaveToGallery(viewRef, filename = 'calendar') {
  try {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo access so the calendar can be saved to your gallery.'
      );
      return false;
    }

    const uri = await capture(viewRef, filename);
    if (!uri) {
      Alert.alert('Error', 'Could not capture the calendar. Please try again.');
      return false;
    }

    const asset = await MediaLibrary.createAssetAsync(uri);

    // Group the exports in their own album so they are easy to find later.
    // Album creation can fail on some devices/permission levels; the image is
    // already in the gallery by then, so that is not worth failing the save.
    try {
      const album = await MediaLibrary.getAlbumAsync(ALBUM);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(ALBUM, asset, false);
      }
    } catch (albumError) {
      console.warn('Saved to gallery but could not add to album:', albumError);
    }

    Alert.alert('Saved', `The calendar is in your gallery under "${ALBUM}".`);
    return true;
  } catch (error) {
    console.error('Error saving to gallery:', error);
    Alert.alert('Save Failed', 'Could not save the image. Please try again.');
    return false;
  }
}

export async function captureAndShare(viewRef, filename = 'calendar') {
  try {
    const uri = await capture(viewRef, filename);
    if (!uri) {
      Alert.alert('Error', 'Could not capture the view. Please try again.');
      return false;
    }

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
