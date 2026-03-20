import {
  Montserrat_700Bold,
  Montserrat_600SemiBold,
  Montserrat_500Medium,
  Montserrat_400Regular,
  useFonts,
} from "@expo-google-fonts/montserrat";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UserProvider } from "@/context/UserContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="shop" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_700Bold,
    Montserrat_600SemiBold,
    Montserrat_500Medium,
    Montserrat_400Regular,
  });
  const [shouldShowApp, setShouldShowApp] = React.useState(false);

  useEffect(() => {
    // Show UI quickly with or without fonts
    // This prevents the app from appearing frozen while fonts load
    const splashTimer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setShouldShowApp(true);
    }, 800); // Short timeout - show UI quickly with system font fallback

    if (fontsLoaded || fontError) {
      // If fonts finish loading faster, show immediately
      clearTimeout(splashTimer);
      SplashScreen.hideAsync().catch(() => {});
      setShouldShowApp(true);
    }

    return () => clearTimeout(splashTimer);
  }, [fontsLoaded, fontError]);

  // Show UI after fonts load OR after timeout - never block the UI
  if (!shouldShowApp) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <UserProvider>
              <StatusBar style="light" />
              <RootLayoutNav />
            </UserProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
