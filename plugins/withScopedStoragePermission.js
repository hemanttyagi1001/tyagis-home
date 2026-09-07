const { withAndroidManifest } = require('expo/config-plugins');

// expo-media-library declares WRITE_EXTERNAL_STORAGE with no upper bound. The
// permission has had no effect since API 29 (scoped storage), and this app
// targets 36, so on every device that can install it the declaration is dead
// weight - except on the Play listing, where it still renders as a "Photos and
// media / Storage" access request. That reads badly for an app whose whole
// pitch is that nothing leaves the device.
//
// Capping it at 29 keeps the permission where it is actually needed. minSdk is
// 24, so API 24-28 devices still get it and MediaLibrary.createAssetAsync()
// keeps working there; API 30+ stops requesting it and the listing stops
// showing it.
//
// This cannot be done from app.json: `blockedPermissions` only removes a
// permission outright, which would break saving to the gallery on API <= 28.
// Editing android/AndroidManifest.xml by hand does not survive prebuild.
//
// `android:requestLegacyExternalStorage="true"` is left alone deliberately. It
// is ignored from API 30 onwards, and on API 29 it is what keeps the legacy
// storage path working alongside this permission. It does not appear on the
// listing, so there is nothing to gain by stripping it.
const PERMISSION = 'android.permission.WRITE_EXTERNAL_STORAGE';
const MAX_SDK = '29';

module.exports = function withScopedStoragePermission(config) {
  return withAndroidManifest(config, (cfg) => {
    const permissions = cfg.modResults.manifest['uses-permission'];

    // No permissions block at all means nothing to cap.
    if (!Array.isArray(permissions)) return cfg;

    for (const permission of permissions) {
      if (permission.$?.['android:name'] === PERMISSION) {
        permission.$['android:maxSdkVersion'] = MAX_SDK;
      }
    }

    // Absence is not an error: if a future expo-media-library stops declaring
    // the permission, the listing is already clean and there is nothing to do.
    return cfg;
  });
};
