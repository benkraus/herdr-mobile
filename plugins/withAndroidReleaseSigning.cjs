const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_CONFIG = `
        release {
            def releaseTaskRequested = gradle.startParameter.taskNames.any {
                it.toLowerCase().contains("release")
            }
            if (releaseTaskRequested) {
                def keystoreFile = System.getenv("HERDR_ANDROID_KEYSTORE_FILE")
                def keystorePassword = System.getenv("HERDR_ANDROID_KEYSTORE_PASSWORD")
                def keyAliasValue = System.getenv("HERDR_ANDROID_KEY_ALIAS")
                def keyPasswordValue = System.getenv("HERDR_ANDROID_KEY_PASSWORD")

                if (!keystoreFile || !keystorePassword || !keyAliasValue || !keyPasswordValue) {
                    throw new GradleException("Herdr release signing variables are missing. Run pnpm android:release.")
                }

                storeFile file(keystoreFile)
                storePassword keystorePassword
                keyAlias keyAliasValue
                keyPassword keyPasswordValue
            }
        }`;

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (nextConfig) => {
    if (nextConfig.modResults.language !== "groovy") {
      throw new Error("withAndroidReleaseSigning: app build.gradle must use Groovy.");
    }

    let contents = nextConfig.modResults.contents;
    if (!contents.includes("HERDR_ANDROID_KEYSTORE_FILE")) {
      const signingConfigs = /(signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n\s*\})(\n\s*\})/;
      if (!signingConfigs.test(contents)) {
        throw new Error(
          "withAndroidReleaseSigning: could not find Expo's debug signing config; update the plugin anchor.",
        );
      }
      contents = contents.replace(signingConfigs, `$1${RELEASE_CONFIG}$2`);
    }

    const buildTypesIndex = contents.indexOf("    buildTypes {");
    const releaseBuildIndex = contents.indexOf("        release {", buildTypesIndex);
    const debugSigningIndex = contents.indexOf(
      "signingConfig signingConfigs.debug",
      releaseBuildIndex,
    );
    const releaseSigningIndex = contents.indexOf(
      "signingConfig signingConfigs.release",
      releaseBuildIndex,
    );

    if (buildTypesIndex === -1 || releaseBuildIndex === -1) {
      throw new Error(
        "withAndroidReleaseSigning: could not find Expo's release build type; update the plugin anchor.",
      );
    }

    if (releaseSigningIndex === -1) {
      if (debugSigningIndex === -1) {
        throw new Error(
          "withAndroidReleaseSigning: could not find Expo's release signing assignment; update the plugin anchor.",
        );
      }
      contents =
        contents.slice(0, debugSigningIndex) +
        "signingConfig signingConfigs.release" +
        contents.slice(debugSigningIndex + "signingConfig signingConfigs.debug".length);
    }

    nextConfig.modResults.contents = contents;
    return nextConfig;
  });
};
