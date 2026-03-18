import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

interface UserProfile {
  id: number;
  name: string;
  username?: string;
  age: number;
  bio: string;
  photoUrl: string;
  photos: string[];
  isPremium: boolean;
  city?: string;
  interests: string[];
}

interface UserStats {
  swipeCount: number;
  friendCount: number;
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUserContext();

  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: ["user-profile", id],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/users/${id}`);
      if (!res.ok) throw new Error("User not found");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: stats } = useQuery<UserStats>({
    queryKey: ["user-stats", id],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/users/${id}/stats`);
      if (!res.ok) return { swipeCount: 0, friendCount: 0 };
      return res.json();
    },
    enabled: !!id,
  });

  const handleMessage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chat/${id}` as any);
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: topInset }]}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.center, { paddingTop: topInset }]}>
        <Feather name="user-x" size={48} color={Colors.textMuted} />
        <Text style={styles.errorText}>Nie znaleziono użytkownika</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Wróć</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBack} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{user.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <Animated.View entering={FadeInDown.springify()} style={styles.avatarWrap}>
          <Image source={{ uri: user.photoUrl }} style={styles.avatar} resizeMode="cover" />
          {user.isPremium && (
            <View style={styles.premiumBadge}>
              <Feather name="zap" size={12} color={Colors.black} />
              <Text style={styles.premiumBadgeText}>VIBE+</Text>
            </View>
          )}
        </Animated.View>

        {/* Name + age */}
        <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.nameRow}>
          <Text style={styles.name}>{user.name}, {user.age}</Text>
          {user.username && (
            <Text style={styles.username}>@{user.username}</Text>
          )}
          {user.city && (
            <View style={styles.cityRow}>
              <Feather name="map-pin" size={12} color={Colors.textSecondary} />
              <Text style={styles.city}>{user.city}</Text>
            </View>
          )}
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.statsRow}>
          <StatBox label="Swipe'y" value={stats?.swipeCount ?? 0} />
          <View style={styles.statDivider} />
          <StatBox label="Znajomi" value={stats?.friendCount ?? 0} />
          {user.isPremium && (
            <>
              <View style={styles.statDivider} />
              <StatBox label="Status" value="VIBE+" />
            </>
          )}
        </Animated.View>

        {/* Bio */}
        {user.bio ? (
          <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.section}>
            <Text style={styles.sectionLabel}>O mnie</Text>
            <Text style={styles.bio}>{user.bio}</Text>
          </Animated.View>
        ) : null}

        {/* Interests */}
        {user.interests?.length > 0 && (
          <Animated.View entering={FadeInDown.delay(240).springify()} style={styles.section}>
            <Text style={styles.sectionLabel}>Zainteresowania</Text>
            <View style={styles.tagsRow}>
              {user.interests.map((t, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Photos */}
        {user.photos?.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
            <Text style={styles.sectionLabel}>Zdjęcia</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photoRow}>
                {user.photos.map((p, i) => (
                  <Image key={i} source={{ uri: p }} style={styles.photo} resizeMode="cover" />
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        )}

        {/* Message button (only if not self) */}
        {currentUser && user.id !== currentUser.id && (
          <Animated.View entering={FadeInDown.delay(360).springify()} style={styles.msgBtnWrap}>
            <Pressable
              style={({ pressed }) => [styles.msgBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
              onPress={handleMessage}
            >
              <Feather name="message-circle" size={18} color={Colors.black} />
              <Text style={styles.msgBtnText}>Wyślij wiadomość</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: Colors.black },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 },
  headerBack: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: Colors.textPrimary, flex: 1, textAlign: "center" },
  scroll: { flex: 1 },
  scrollContent: { alignItems: "center", paddingHorizontal: 20, gap: 20, paddingTop: 8 },
  avatarWrap: { position: "relative" },
  avatar: { width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: Colors.accent },
  premiumBadge: { position: "absolute", bottom: 4, right: 4, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  premiumBadgeText: { fontFamily: "Montserrat_700Bold", fontSize: 10, color: Colors.black },
  nameRow: { alignItems: "center", gap: 4 },
  name: { fontFamily: "Montserrat_700Bold", fontSize: 26, color: Colors.textPrimary },
  username: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textMuted },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  city: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary },
  statsRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.cardBg, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, paddingVertical: 16, paddingHorizontal: 24, width: "100%", justifyContent: "center" },
  statBox: { alignItems: "center", flex: 1 },
  statValue: { fontFamily: "Montserrat_700Bold", fontSize: 22, color: Colors.accent },
  statLabel: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  section: { width: "100%", gap: 10 },
  sectionLabel: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  bio: { fontFamily: "Montserrat_400Regular", fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { backgroundColor: Colors.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border },
  tagText: { fontFamily: "Montserrat_500Medium", fontSize: 13, color: Colors.textPrimary },
  photoRow: { flexDirection: "row", gap: 10 },
  photo: { width: 120, height: 160, borderRadius: 12 },
  msgBtnWrap: { width: "100%", marginTop: 4 },
  msgBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.accent, paddingVertical: 16, borderRadius: 14 },
  msgBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.black },
  errorText: { fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: Colors.textSecondary },
  backBtn: { backgroundColor: Colors.surface, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.textPrimary },
});
