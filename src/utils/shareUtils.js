import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Platform, ToastAndroid } from 'react-native';

// Ids of the images this app has written to the gallery, keyed by export name.
//
// Kept here rather than discovered by scanning the media library, because
// scanning needs READ_MEDIA_IMAGES - permission to read every photo on the
// device. Google Play flags that for an app like this, and rightly so: writing
// an image does not justify reading the user's whole camera roll. Remembering
// what we created ourselves needs no read permission at all.
const SAVED_INDEX = `${FileSystem.documentDirectory}saved-exports.json`;

async function readSavedIndex() {
  try {
    const info = await FileSystem.getInfoAsync(SAVED_INDEX);
    if (!info.exists) return {};
    return JSON.parse(await FileSystem.readAsStringAsync(SAVED_INDEX));
  } catch {
    return {};
  }
}

async function writeSavedIndex(index) {
  try {
    await FileSystem.writeAsStringAsync(SAVED_INDEX, JSON.stringify(index));
  } catch (error) {
    // Only costs us a duplicate on the next save.
    console.warn('Could not record the saved image id:', error);
  }
}

// Brief, non-blocking confirmation. Saving is a background nicety - it does not
// warrant a dialog the user has to dismiss.
function toast(message) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('', message);
  }
}

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
// through their own picker - Splitwise among them - cannot take an image from
// the share sheet, so the reliable route is to save it and attach it there.
export async function captureAndSaveToGallery(viewRef, filename = 'calendar') {
  try {
    // writeOnly: this app adds images and removes the ones it added. It never
    // reads the user's library, so it does not ask for permission to.
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow Tyagi’s Home to save photos so the calendar can go to your gallery.'
      );
      return false;
    }

    const uri = await capture(viewRef, filename);
    if (!uri) {
      Alert.alert('Error', 'Could not capture the calendar. Please try again.');
      return false;
    }

    // Remove the previous save of this same month so re-saving replaces it
    // instead of leaving "name (1)", "name (2)" behind. Only ids this app
    // recorded are touched, so nothing of the user's is ever at risk. A failure
    // here is not worth blocking the save - worst case is the duplicate.
    const index = await readSavedIndex();
    const previousId = index[filename];
    let replaced = false;

    if (previousId) {
      try {
        await MediaLibrary.deleteAssetsAsync([previousId]);
        replaced = true;
      } catch (deleteError) {
        console.warn('Could not remove the previous export:', deleteError);
      }
    }

    // Saved to the gallery's default location on purpose. Filing it into a
    // named album moves the asset, and moving an asset makes Android ask
    // "Allow this app to modify this photo?" every single time.
    const asset = await MediaLibrary.createAssetAsync(uri);

    index[filename] = asset.id;
    await writeSavedIndex(index);

    toast(replaced ? 'Updated in gallery' : 'Saved to gallery');
    return true;
  } catch (error) {
    console.error('Error saving to gallery:', error);
    toast('Could not save the image');
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
