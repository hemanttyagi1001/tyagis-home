const { withAppBuildGradle } = require('expo/config-plugins');

// `expo prebuild` regenerates android/app/build.gradle from a template, which
// signs release builds with the DEBUG key. The Play Store rejects debug-signed
// uploads, so without this plugin the signing fix has to be reapplied by hand
// after every prebuild - easy to forget, and the failure only surfaces at
// upload time.
//
// Credentials are read at build time from android/keystore.properties, which is
// gitignored along with the rest of android/. If that file is absent (a fresh
// clone, or CI where EAS manages credentials), the release config is simply
// empty and Gradle falls back to its normal behaviour.
const RELEASE_SIGNING_CONFIG = `
        release {
            def props = new Properties()
            def propsFile = rootProject.file('keystore.properties')
            if (propsFile.exists()) {
                props.load(new FileInputStream(propsFile))
                storeFile file(props['storeFile'])
                storePassword props['storePassword']
                keyAlias props['keyAlias']
                keyPassword props['keyPassword']
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes("props.load(new FileInputStream(propsFile))")) {
      return cfg; // Already applied.
    }

    // Add a `release` block alongside the generated `debug` one.
    const debugBlockEnd = /(signingConfigs \{[\s\S]*?keyPassword 'android'\n\s*\})/;
    if (!debugBlockEnd.test(gradle)) {
      throw new Error(
        'withReleaseSigning: could not find the debug signingConfig block. ' +
          'The prebuild template probably changed - update this plugin.'
      );
    }
    gradle = gradle.replace(debugBlockEnd, `$1${RELEASE_SIGNING_CONFIG}`);

    // Point the release build type at it instead of the debug key. Anchor on
    // the buildTypes release block specifically: a looser pattern matches the
    // `debug { signingConfig signingConfigs.debug }` block that appears first
    // and silently swaps the two around.
    const releaseBuildType =
      /(buildTypes \{[\s\S]*?\n        release \{\n(?:\s*\/\/[^\n]*\n)*\s*)signingConfig signingConfigs\.debug/;

    if (!releaseBuildType.test(gradle)) {
      throw new Error(
        'withReleaseSigning: could not find the release build type using the ' +
          'debug signingConfig - the prebuild template probably changed.'
      );
    }
    gradle = gradle.replace(releaseBuildType, '$1signingConfig signingConfigs.release');

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
