import { BlurView } from "expo-blur";
import { Tabs, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Platform, StyleSheet, View, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";

function ChatTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const { currentUser } = useUserContext();

  const { data: friendRequests = [] } = useQuery<{ requestId: number }[]>({
    queryKey: ["friend-requests-badge", currentUser?.id],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/friends/requests/${currentUser!.id}`);
      return res.json();
    },
    enabled: !!currentUser,
    refetchInterval: 20000,
  });

  const { data: matches = [] } = useQuery<{ unreadCount?: number }[]>({
    queryKey: ["matches-badge", currentUser?.id],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/matches/${currentUser!.id}`);
      return res.json();
    },
    enabled: !!currentUser,
    refetchInterval: 20000,
  });

  const unreadMessages = matches.reduce((sum, m) => sum + (m.unreadCount ?? 0), 0);
  const hasDot = friendRequests.length > 0 || unreadMessages > 0;

  return (
    <View>
      <Feather name="message-circle" size={22} color={color} />
      {hasDot && (
        <View style={{
          position: "absolute",
          top: -3,
          right: -5,
          width: 9,
          height: 9,
          borderRadius: 5,
          backgroundColor: Colors.danger,
          borderWidth: 1.5,
          borderColor: Colors.black,
        }} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const { isRegistered, isLoadingAuth, currentUser } = useUserContext();
  const isIOS = Platform.OS === "ios";
  usePushNotifications(currentUser?.id);

  useEffect(() => {
    if (!isLoadingAuth && !isRegistered) {
      router.replace("/auth");
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
      <Tabs.Screen name="map" options={{ title: "Mapa", tabBarIcon: ({ color }) => <Feather name="map-pin" size={22} color={color} /> }} />
      <Tabs.Screen name="video" options={{ title: "Losowy", tabBarIcon: ({ color }) => <Feather name="video" size={22} color={color} /> }} />
      <Tabs.Screen name="lives" options={{ title: "Live", tabBarIcon: ({ color }) => <Feather name="radio" size={22} color={color} /> }} />
      <Tabs.Screen name="messages" options={{ title: "Czat", tabBarIcon: ({ color, focused }) => <ChatTabIcon color={color} focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}
