import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform, ToastAndroid } from 'react-native';

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

// Finds earlier exports of the same calendar so they can be replaced rather
// than piling up. Android appends " (1)", " (2)" and so on when a filename is
// taken, so anything starting with the base name is a previous save of this
// same month.
async function findPreviousExports(baseName) {
  const matches = [];
  let cursor;

  // Only look at the most recent images; an export from months ago is not worth
  // paging the entire library to find.
  for (let page = 0; page < 3; page++) {
    const { assets, endCursor, hasNextPage } = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [MediaLibrary.SortBy.creationTime],
      first: 100,
      after: cursor,
    });

    for (const asset of assets) {
      const name = asset.filename ?? '';
      if (name === `${baseName}.png` || name.startsWith(`${baseName} (`) || name.startsWith(`${baseName}(`)) {
        matches.push(asset);
      }
    }

    if (!hasNextPage) break;
    cursor = endCursor;
  }

  return matches;
}

// Saves the calendar straight to the photo gallery. Apps that accept a receipt
// through their own picker - Splitwise among them - cannot take an image from
// the share sheet, so the reliable route is to save it and attach it there.
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

    // Remove earlier saves of this same calendar first, so re-saving a month
    // replaces the image instead of leaving "name (1)", "name (2)" behind.
    // The app created those assets, so deleting them does not prompt. Any
    // failure here is not worth blocking the save - worst case a duplicate.
    let replaced = false;
    try {
      const previous = await findPreviousExports(filename);
      if (previous.length > 0) {
        await MediaLibrary.deleteAssetsAsync(previous);
        replaced = true;
      }
    } catch (deleteError) {
      console.warn('Could not remove the previous export:', deleteError);
    }

    // Saved to the gallery's default location on purpose. Filing it into a
    // named album moves the asset, and moving an asset makes Android ask
    // "Allow this app to modify this photo?" every single time.
    await MediaLibrary.createAssetAsync(uri);

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
