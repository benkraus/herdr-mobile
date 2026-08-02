import type { ExpoConfig } from "expo/config";

const dmSansFonts = {
  regular: "@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf",
  medium: "@expo-google-fonts/dm-sans/500Medium/DMSans_500Medium.ttf",
  bold: "@expo-google-fonts/dm-sans/700Bold/DMSans_700Bold.ttf",
} as const;

const icon = "./assets/prod/herdr-app-icon-1024.png";

const config: ExpoConfig = {
  name: "Herdr",
  slug: "herdr-mobile",
  platforms: ["ios", "android"],
  scheme: "herdr",
  version: "0.1.0",
  orientation: "portrait",
  icon,
  userInterfaceStyle: "automatic",
  ios: {
    icon,
    supportsTablet: true,
    bundleIdentifier: "dev.herdr.mobile",
    infoPlist: {
      NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
      NSLocalNetworkUsageDescription:
        "Allow Herdr to connect to a Herdr Control bridge on your local network or tailnet.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "dev.herdr.mobile",
    adaptiveIcon: {
      backgroundColor: "#d9dad8",
      foregroundImage: "./assets/prod/herdr-adaptive-foreground-1024.png",
    },
  },
  plugins: [
    "expo-asset",
    [
      "expo-font",
      {
        ios: { fonts: [dmSansFonts.regular, dmSansFonts.medium, dmSansFonts.bold] },
        android: {
          fonts: [
            {
              fontFamily: "DMSans-Regular",
              fontDefinitions: [{ path: dmSansFonts.regular, weight: 400 }],
            },
            {
              fontFamily: "DMSans-Medium",
              fontDefinitions: [{ path: dmSansFonts.medium, weight: 500 }],
            },
            {
              fontFamily: "DMSans-Bold",
              fontDefinitions: [{ path: dmSansFonts.bold, weight: 700 }],
            },
          ],
        },
      },
    ],
    "expo-secure-store",
    "expo-sqlite",
    [
      "expo-splash-screen",
      {
        image: icon,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        imageWidth: 180,
        dark: { image: icon, backgroundColor: "#0a0a0a" },
      },
    ],
    ["expo-build-properties", { ios: { deploymentTarget: "18.0" } }],
    "./plugins/withIosCocoaPodsUuidCache.cjs",
    "./plugins/withIosSceneLifecycle.cjs",
    "./plugins/withAndroidCleartextTraffic.cjs",
    "./plugins/withAndroidGradleHeap.cjs",
    "./plugins/withAndroidPredictiveBackCompat.cjs",
    "./plugins/withAndroidReleaseSigning.cjs",
  ],
};

export default config;
