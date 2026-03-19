import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

const REPORT_REASONS = [
  "Spam lub reklama",
  "Nękanie lub zastraszanie",
  "Treści nieodpowiednie",
  "Fałszywy profil",
  "Nieletni",
  "Inne",
];

interface UserProfile {
  id: number;
  name: string;
  username?: string;
  age: number;
  bio: string;
  photoUrl: string;
  photos: string[];
  isPremium: boolean;
  isVerified?: boolean;
  city?: string;
  interests: string[];
}

interface UserStats {
  swipeCount: number;
  friendCount: number;
  receivedLikes: number;
}

function StatBox({ label, value, icon }: { label: string; value: number | string; icon?: string }) {
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
  const queryClient = useQueryClient();
  const [photoViewIdx, setPhotoViewIdx] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);

  const isOwnProfile = currentUser?.id === Number(id);

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
      if (!res.ok) return { swipeCount: 0, friendCount: 0, receivedLikes: 0 };
      return res.json();
    },
    enabled: !!id,
  });

  const { data: friends = [] } = useQuery<{ id: number }[]>({
    queryKey: ["user-friends", id],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/friends/${id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id && !!currentUser,
  });

  const isFriend = friends.some((f) => f.id === currentUser?.id);

  const { data: friendRequests = [] } = useQuery<{ requestId: number; fromUser: { id: number } }[]>({
    queryKey: ["friend-requests-badge", currentUser?.id],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/friends/requests/${currentUser!.id}`);
      return res.json();
    },
    enabled: !!currentUser && !isOwnProfile,
  });

  const hasPendingRequest = friendRequests.some((r) => r.fromUser?.id === Number(id));

  const addFriendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE_URL}/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: currentUser!.id, toUserId: Number(id) }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-friends", id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleMessage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chat/${id}` as any);
  };

  const handleReport = useCallback(async (reason: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${BASE_URL}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: currentUser.id, reportedUserId: Number(id), reason }),
      });
      setShowReport(false);
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (Platform.OS === "web") window.alert("Zgłoszenie wysłane. Dziękujemy!");
      } else {
        if (Platform.OS === "web") window.alert("Nie udało się wysłać zgłoszenia.");
      }
    } catch {
      setShowReport(false);
      if (Platform.OS === "web") window.alert("Błąd sieci. Spróbuj ponownie.");
    }
  }, [currentUser, id]);

  const handleBlock = useCallback(async () => {
    if (!currentUser) return;
    const msg = "Czy na pewno chcesz zablokować tę osobę?";
    let confirmed = false;
    if (Platform.OS === "web") {
      confirmed = window.confirm(msg);
    } else {
      confirmed = await new Promise(resolve => {
        const { Alert } = require("react-native");
        Alert.alert("Zablokuj", msg, [
          { text: "Anuluj", style: "cancel", onPress: () => resolve(false) },
          { text: "Zablokuj", style: "destructive", onPress: () => resolve(true) },
        ]);
      });
    }
    if (!confirmed) return;
    try {
      const res = await fetch(`${BASE_URL}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, blockedUserId: Number(id) }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        router.back();
      } else {
        if (Platform.OS === "web") window.alert("Nie udało się zablokować użytkownika.");
      }
    } catch {
      if (Platform.OS === "web") window.alert("Błąd sieci. Spróbuj ponownie.");
    }
  }, [currentUser, id, router]);

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

  const allPhotos = [user.photoUrl, ...(user.photos ?? [])].filter(Boolean);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
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
        <Animated.View entering={FadeInDown.springify()} style={styles.avatarWrap}>
          <Image source={{ uri: user.photoUrl }} style={styles.avatar} resizeMode="cover" />
          {user.isPremium && (
            <View style={styles.premiumBadge}>
              <Feather name="zap" size={12} color={Colors.black} />
              <Text style={styles.premiumBadgeText}>VIBE+</Text>
            </View>
          )}
          {user.isVerified && (
            <View style={styles.verifiedBadge}>
              <Feather name="check" size={10} color="#fff" />
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.nameRow}>
          <View style={styles.nameInline}>
            <Text style={styles.name}>{user.name}, {user.age}</Text>
            {user.isVerified && (
              <View style={styles.verifiedInline}>
                <Feather name="check" size={12} color="#fff" />
              </View>
            )}
          </View>
          {user.username && (
            <Text style={styles.username}>@{user.username}</Text>
          )}
          {user.city && (
            <View style={styles.cityRow}>
              <Feather name="map-pin" size={12} color={Colors.textSecondary} />
              <Text style={styles.city}>{user.city}</Text>
            </View>
          )}
          {user.isPremium && (
            <View style={styles.premiumChip}>
              <Feather name="zap" size={11} color={Colors.black} />
              <Text style={styles.premiumChipText}>VIBE+ Premium</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.statsRow}>
          <StatBox label="Znajomi" value={stats?.friendCount ?? 0} />
          <View style={styles.statDivider} />
          <StatBox label="Polubienia" value={stats?.receivedLikes ?? 0} />
          <View style={styles.statDivider} />
          <StatBox label="Swipe'y" value={stats?.swipeCount ?? 0} />
        </Animated.View>

        {user.bio ? (
          <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.section}>
            <Text style={styles.sectionLabel}>O mnie</Text>
            <View style={styles.bioCard}>
              <Text style={styles.bio}>{user.bio}</Text>
            </View>
          </Animated.View>
        ) : null}

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

        {allPhotos.length > 1 && (
          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
            <Text style={styles.sectionLabel}>Zdjęcia ({allPhotos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photoRow}>
                {allPhotos.map((p, i) => (
                  <Pressable key={i} onPress={() => setPhotoViewIdx(photoViewIdx === i ? null : i)}>
                    <Image source={{ uri: p }} style={styles.photo} resizeMode="cover" />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        )}

        {currentUser && !isOwnProfile && (
          <Animated.View entering={FadeInDown.delay(360).springify()} style={styles.actionsWrap}>
            <Pressable
              style={({ pressed }) => [styles.msgBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
              onPress={handleMessage}
            >
              <Feather name="message-circle" size={18} color={Colors.black} />
              <Text style={styles.msgBtnText}>Wyślij wiadomość</Text>
            </Pressable>

            {!isFriend && !hasPendingRequest && (
              <Pressable
                style={({ pressed }) => [styles.friendBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                onPress={() => addFriendMutation.mutate()}
                disabled={addFriendMutation.isPending}
              >
                {addFriendMutation.isPending ? (
                  <ActivityIndicator color={Colors.accent} size="small" />
                ) : addFriendMutation.isSuccess ? (
                  <>
                    <Feather name="check" size={18} color={Colors.accent} />
                    <Text style={styles.friendBtnText}>Zaproszenie wysłane</Text>
                  </>
                ) : (
                  <>
                    <Feather name="user-plus" size={18} color={Colors.accent} />
                    <Text style={styles.friendBtnText}>Dodaj do znajomych</Text>
                  </>
                )}
              </Pressable>
            )}

            {isFriend && (
              <View style={styles.friendStatusRow}>
                <Feather name="check-circle" size={16} color={Colors.accent} />
                <Text style={styles.friendStatusText}>Znajomy</Text>
              </View>
            )}

            {hasPendingRequest && !isFriend && (
              <View style={styles.friendStatusRow}>
                <Feather name="clock" size={16} color={Colors.textMuted} />
                <Text style={styles.friendStatusText}>Zaproszenie oczekuje</Text>
              </View>
            )}

            <View style={styles.dangerRow}>
              <Pressable style={styles.reportBtn} onPress={() => setShowReport(true)}>
                <Feather name="flag" size={16} color={Colors.danger} />
                <Text style={styles.reportBtnText}>Zgłoś</Text>
              </Pressable>
              <Pressable style={styles.blockBtn} onPress={handleBlock}>
                <Feather name="slash" size={16} color={Colors.danger} />
                <Text style={styles.reportBtnText}>Zablokuj</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <View style={styles.reportOverlay}>
          <Animated.View entering={FadeInDown.springify()} style={styles.reportBox}>
            <Text style={styles.reportTitle}>Zgłoś użytkownika</Text>
            <Text style={styles.reportSub}>Dlaczego chcesz zgłosić {user?.name ?? "tę osobę"}?</Text>
            {REPORT_REASONS.map(reason => (
              <Pressable key={reason} style={styles.reportReasonBtn} onPress={() => handleReport(reason)}>
                <Text style={styles.reportReasonText}>{reason}</Text>
                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
              </Pressable>
            ))}
            <Pressable style={styles.reportCancelBtn} onPress={() => setShowReport(false)}>
              <Text style={styles.reportCancelText}>Anuluj</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
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
  verifiedBadge: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "#1DA1F2", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.black },
  nameRow: { alignItems: "center", gap: 4 },
  nameInline: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontFamily: "Montserrat_700Bold", fontSize: 26, color: Colors.textPrimary },
  verifiedInline: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#1DA1F2", alignItems: "center", justifyContent: "center" },
  username: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textMuted },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  city: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary },
  premiumChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  premiumChipText: { fontFamily: "Montserrat_700Bold", fontSize: 11, color: Colors.black },
  statsRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.cardBg, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, paddingVertical: 18, paddingHorizontal: 16, width: "100%", justifyContent: "center" },
  statBox: { alignItems: "center", flex: 1 },
  statValue: { fontFamily: "Montserrat_700Bold", fontSize: 22, color: Colors.accent },
  statLabel: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  section: { width: "100%", gap: 10 },
  sectionLabel: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  bioCard: { backgroundColor: Colors.cardBg, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  bio: { fontFamily: "Montserrat_400Regular", fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { backgroundColor: Colors.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border },
  tagText: { fontFamily: "Montserrat_500Medium", fontSize: 13, color: Colors.textPrimary },
  photoRow: { flexDirection: "row", gap: 10 },
  photo: { width: 120, height: 160, borderRadius: 12 },
  actionsWrap: { width: "100%", gap: 12, marginTop: 4 },
  msgBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.accent, paddingVertical: 16, borderRadius: 14 },
  msgBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.black },
  friendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.cardBg, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.border },
  friendBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: Colors.accent },
  friendStatusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10 },
  friendStatusText: { fontFamily: "Montserrat_500Medium", fontSize: 14, color: Colors.textMuted },
  errorText: { fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: Colors.textSecondary },
  backBtn: { backgroundColor: Colors.surface, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.textPrimary },
  dangerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 8 },
  reportBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,59,48,0.25)" },
  blockBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,59,48,0.25)" },
  reportBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.danger },
  reportOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  reportBox: { backgroundColor: Colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  reportTitle: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: Colors.textPrimary, textAlign: "center", marginBottom: 4 },
  reportSub: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textMuted, textAlign: "center", marginBottom: 16 },
  reportReasonBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, backgroundColor: Colors.surface, marginBottom: 8 },
  reportReasonText: { fontFamily: "Montserrat_500Medium", fontSize: 15, color: Colors.textPrimary },
  reportCancelBtn: { alignItems: "center", paddingVertical: 14, marginTop: 8 },
  reportCancelText: { fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: Colors.textMuted },
});
