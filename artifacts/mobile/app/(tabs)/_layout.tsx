import { BlurView } from "expo-blur";
import { Tabs, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Platform, StyleSheet, View, ActivityIndicator } from "react-native";

import Colors from "@/constants/colors";
import { useUserContext } from "@/context/UserContext";

export default function TabLayout() {
  const { isRegistered, isLoadingAuth } = useUserContext();
  const isIOS = Platform.OS === "ios";

  useEffect(() => {
    if (!isLoadingAuth && !isRegistered) {
      router.replace("/onboarding");
    }
  }, [isLoadingAuth, isRegistered]);

  if (isLoadingAuth) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.black, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!isRegistered) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        headerShown: false,
        tabBarBackground: () => isIOS ? (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.black, borderTopWidth: 1, borderTopColor: Colors.border }]} />
        ),
        tabBarLabelStyle: {
          fontFamily: "Montserrat_500Medium",
          fontSize: 10,
          marginBottom: Platform.OS === "web" ? 4 : 0,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === "web" ? 68 : undefined,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Odkryj", tabBarIcon: ({ color }) => <Feather name="zap" size={22} color={color} /> }} />
      <Tabs.Screen name="likes" options={{ title: "Lajki", tabBarIcon: ({ color }) => <Feather name="heart" size={22} color={color} /> }} />
      <Tabs.Screen name="video" options={{ title: "Losowy", tabBarIcon: ({ color }) => <Feather name="video" size={22} color={color} /> }} />
      <Tabs.Screen name="lives" options={{ title: "Live", tabBarIcon: ({ color }) => <Feather name="radio" size={22} color={color} /> }} />
      <Tabs.Screen name="messages" options={{ title: "Czat", tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}
