import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  KeyboardAvoidingView,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OverlayPortalHost } from "./components/OverlayPortal";
import { ConfirmDialogHost } from "./components/ConfirmDialogHost";
import { HerdrApp } from "./features/herdr/HerdrApp";
import { useThemeColor } from "./lib/useThemeColor";

import "../global.css";

void SplashScreen.preventAutoHideAsync().catch(() => {
  // The native module can be unavailable in non-native test environments.
});

function SplashScreenCoordinator() {
  useEffect(() => {
    void SplashScreen.hide();
  }, []);

  return null;
}

export default function App() {
  const colorScheme = useColorScheme();
  const statusBarBg = useThemeColor("--color-status-bar");

  return (
    <GestureHandlerRootView className="flex-1">
      <KeyboardProvider statusBarTranslucent>
        <SafeAreaProvider>
          <SplashScreenCoordinator />
          <StatusBar
            barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
            backgroundColor={statusBarBg}
            translucent
          />
          <KeyboardAvoidingView automaticOffset behavior="padding" className="flex-1">
            <HerdrApp />
          </KeyboardAvoidingView>
          <ConfirmDialogHost />
          <OverlayPortalHost />
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
