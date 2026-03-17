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
  const isWeb = Platform.OS === "web";

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
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : Colors.black,
          borderTopWidth: isWeb ? 0 : 1,
          borderTopColor: Colors.border,
          elevation: 0,
          height: isWeb ? 64 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: Colors.black,
                  borderTopWidth: 1,
                  borderTopColor: Colors.border,
                },
              ]}
            />
          ),
        tabBarLabelStyle: {
          fontFamily: "Montserrat_500Medium",
          fontSize: 11,
          marginBottom: isWeb ? 4 : 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Odkryj",
          tabBarIcon: ({ color }) => <Feather name="zap" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: "Lajki",
          tabBarIcon: ({ color }) => <Feather name="heart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Wiadomości",
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="video"
        options={{
          title: "Na żywo",
          tabBarIcon: ({ color }) => <Feather name="video" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
