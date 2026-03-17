import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";
import { PremiumModal } from "@/components/PremiumModal";

type Tab = "matches" | "friends" | "requests";

interface Match {
  id: number;
  name: string;
  username?: string | null;
  age: number;
  photoUrl: string;
  bio: string;
  city?: string;
  matchId: number;
  lastMessage?: string | null;
  unreadCount?: number;
}

interface FriendRequest {
  requestId: number;
  fromUser: { id: number; name: string; username?: string | null; photoUrl: string; age: number; city?: string };
}

interface Friend {
  id: number; name: string; username?: string | null; photoUrl: string; age: number; city?: string;
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, isPremium } = useUserContext();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("matches");
  const [showPremium, setShowPremium] = useState(false);
  const [searchUsername, setSearchUsername] = useState("");
  const [searchResult, setSearchResult] = useState<Friend | null | "not_found">(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const { data: matches = [], isLoading: matchesLoading } = useQuery<Match[]>({
    queryKey: ["matches", currentUser?.id],
    queryFn: async () => { const res = await fetch(`${BASE_URL}/matches/${currentUser!.id}`); return res.json(); },
    enabled: !!currentUser,
  });

  const { data: friendRequests = [], isLoading: reqLoading } = useQuery<FriendRequest[]>({
    queryKey: ["friend-requests", currentUser?.id],
    queryFn: async () => { const res = await fetch(`${BASE_URL}/friends/requests/${currentUser!.id}`); return res.json(); },
    enabled: !!currentUser,
    refetchInterval: 30000,
  });

  const { data: friends = [], isLoading: friendsLoading } = useQuery<Friend[]>({
    queryKey: ["friends", currentUser?.id],
    queryFn: async () => { const res = await fetch(`${BASE_URL}/friends/${currentUser!.id}`); return res.json(); },
    enabled: !!currentUser,
    refetchInterval: 30000,
  });

  const respondToRequest = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: number; status: string }) => {
      await fetch(`${BASE_URL}/friends/request/${requestId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
  });

  const sendFriendRequest = useMutation({
    mutationFn: async (toUserId: number) => {
      const res = await fetch(`${BASE_URL}/friends/request`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: currentUser!.id, toUserId }),
      });
      return res.json();
    },
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setSearchResult(null); setSearchUsername(""); },
  });

  const handleSearch = async () => {
    const raw = searchUsername.trim().replace(/^@/, "");
    if (!raw) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/users/by-username/${raw}`);
      if (!res.ok) { setSearchResult("not_found"); return; }
      const user = await res.json();
      if (user.id === currentUser?.id) { setSearchResult("not_found"); return; }
      setSearchResult(user);
    } catch { setSearchResult("not_found"); }
    finally { setSearchLoading(false); }
  };

  const openChat = (matchId: number) => {
    if (!isPremium) { setShowPremium(true); return; }
    router.push(`/chat/${matchId}`);
  };

  const pendingCount = friendRequests.length;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}><Text style={styles.title}>Wiadomości</Text></View>

      <View style={styles.tabBar}>
        {(["matches", "friends", "requests"] as Tab[]).map(t => (
          <Pressable key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => { setTab(t); Haptics.selectionAsync(); }}>
            {t === "requests" && pendingCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{pendingCount}</Text></View>}
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === "matches" ? "Matche" : t === "friends" ? "Znajomi" : "Zaproszenia"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "matches" && (
        matchesLoading ? <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View> :
        matches.length === 0 ? (
          <View style={styles.center}>
            <Feather name="heart" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Brak dopasowań</Text>
            <Text style={styles.emptyText}>Przesuń w prawo, żeby znaleźć swój match!</Text>
          </View>
        ) : (
          <FlatList data={matches} keyExtractor={m => String(m.matchId)} contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 16, gap: 10 }}
            renderItem={({ item: match, index }) => (
              <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
                <Pressable style={styles.card} onPress={() => openChat(match.matchId)}>
                  <View style={styles.avatarWrap}>
                    <Image source={{ uri: match.photoUrl }} style={styles.avatar} />
                    <View style={styles.onlineDot} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{match.name}, {match.age}</Text>
                    {match.username && <Text style={styles.cardUsername}>@{match.username}</Text>}
                    {!isPremium ? (
                      <View style={styles.lockRow}><Feather name="lock" size={11} color={Colors.textMuted} /><Text style={styles.lockText}>Odblokuj za 24,99 zł/mies.</Text></View>
                    ) : (
                      <Text style={styles.cardPreview} numberOfLines={1}>{match.lastMessage || "Powiedz cześć! 👋"}</Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={18} color={Colors.textMuted} />
                </Pressable>
              </Animated.View>
            )}
            showsVerticalScrollIndicator={false}
          />
        )
      )}

      {tab === "friends" && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchSection}>
            <View style={styles.searchRow}>
              <Text style={styles.atSign}>@</Text>
              <TextInput style={styles.searchInput} placeholder="Wpisz nick znajomego..." placeholderTextColor={Colors.textMuted}
                value={searchUsername} onChangeText={t => { setSearchUsername(t); setSearchResult(null); }}
                autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={handleSearch} />
              <Pressable style={styles.searchBtn} onPress={handleSearch}>
                {searchLoading ? <ActivityIndicator size="small" color={Colors.black} /> : <Feather name="search" size={16} color={Colors.black} />}
              </Pressable>
            </View>
            {searchResult === "not_found" && <Text style={styles.notFound}>Nie znaleziono @{searchUsername.replace(/^@/, "")}</Text>}
            {searchResult && searchResult !== "not_found" && (
              <Animated.View entering={FadeInDown.springify()} style={styles.resultCard}>
                <Image source={{ uri: (searchResult as Friend).photoUrl }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{(searchResult as Friend).name}</Text>
                  <Text style={styles.cardUsername}>@{(searchResult as Friend).username}</Text>
                </View>
                <Pressable style={styles.addBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sendFriendRequest.mutate((searchResult as Friend).id); }} disabled={sendFriendRequest.isPending}>
                  {sendFriendRequest.isPending ? <ActivityIndicator size="small" color={Colors.black} /> : <><Feather name="user-plus" size={14} color={Colors.black} /><Text style={styles.addBtnText}>Dodaj</Text></>}
                </Pressable>
              </Animated.View>
            )}
          </View>
          {friendsLoading ? <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View> :
            friends.length === 0 ? (
              <View style={styles.center}>
                <Feather name="users" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Brak znajomych</Text>
                <Text style={styles.emptyText}>Szukaj po @nicku i dodaj pierwszego znajomego!</Text>
              </View>
            ) : (
              <FlatList data={friends} keyExtractor={f => String(f.id)} contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 16, paddingTop: 8, gap: 10 }}
                renderItem={({ item: friend, index }) => {
                  const matchItem = matches.find(m => m.id === friend.id);
                  return (
                    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
                      <Pressable style={styles.card} onPress={() => { if (matchItem) openChat(matchItem.matchId); }}>
                        <Image source={{ uri: friend.photoUrl }} style={styles.avatar} />
                        <View style={styles.cardInfo}>
                          <Text style={styles.cardName}>{friend.name}, {friend.age}</Text>
                          {friend.username && <Text style={styles.cardUsername}>@{friend.username}</Text>}
                        </View>
                        {matchItem && <Feather name="message-circle" size={20} color={Colors.accent} />}
                      </Pressable>
                    </Animated.View>
                  );
                }}
                showsVerticalScrollIndicator={false}
              />
            )
          }
        </View>
      )}

      {tab === "requests" && (
        reqLoading ? <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View> :
        friendRequests.length === 0 ? (
          <View style={styles.center}>
            <Feather name="inbox" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Brak zaproszeń</Text>
            <Text style={styles.emptyText}>Gdy ktoś Cię zaprosi, pojawi się tutaj.</Text>
          </View>
        ) : (
          <FlatList data={friendRequests} keyExtractor={r => String(r.requestId)} contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 16, paddingTop: 8, gap: 10 }}
            renderItem={({ item: req, index }) => (
              <Animated.View entering={FadeInDown.delay(index * 50).springify()} style={styles.requestCard}>
                <Image source={{ uri: req.fromUser.photoUrl }} style={styles.avatar} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{req.fromUser.name}</Text>
                  {req.fromUser.username && <Text style={styles.cardUsername}>@{req.fromUser.username}</Text>}
                  {req.fromUser.city && <Text style={styles.cityText}>📍 {req.fromUser.city}</Text>}
                </View>
                <View style={styles.reqActions}>
                  <Pressable style={styles.acceptBtn} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); respondToRequest.mutate({ requestId: req.requestId, status: "accepted" }); }}>
                    <Feather name="check" size={16} color={Colors.black} />
                  </Pressable>
                  <Pressable style={styles.declineBtn} onPress={() => { Haptics.selectionAsync(); respondToRequest.mutate({ requestId: req.requestId, status: "declined" }); }}>
                    <Feather name="x" size={16} color={Colors.textSecondary} />
                  </Pressable>
                </View>
              </Animated.View>
            )}
            showsVerticalScrollIndicator={false}
          />
        )
      )}

      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} onActivate={async () => setShowPremium(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },
  title: { fontFamily: "Montserrat_700Bold", fontSize: 26, color: Colors.textPrimary },
  tabBar: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: "center", position: "relative" },
  tabBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: Colors.textSecondary },
  tabBtnTextActive: { color: Colors.black },
  badge: { position: "absolute", top: -6, right: -6, backgroundColor: Colors.danger, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", zIndex: 1 },
  badgeText: { fontFamily: "Montserrat_700Bold", fontSize: 10, color: "#fff" },
  searchSection: { paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, gap: 4 },
  atSign: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.accent },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: "Montserrat_500Medium", fontSize: 14, color: Colors.textPrimary },
  searchBtn: { backgroundColor: Colors.accent, width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  notFound: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.danger, paddingHorizontal: 4 },
  resultCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.cardBg, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: Colors.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 60 },
  emptyTitle: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: Colors.textPrimary },
  emptyText: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.cardBg, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border },
  avatarWrap: { position: "relative" },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surface },
  onlineDot: { position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: "#00DC82", borderWidth: 2, borderColor: Colors.black },
  cardInfo: { flex: 1, gap: 3 },
  cardName: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: Colors.textPrimary },
  cardUsername: { fontFamily: "Montserrat_500Medium", fontSize: 12, color: Colors.accent },
  cardPreview: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  lockText: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textMuted },
  requestCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.cardBg, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border },
  reqActions: { flexDirection: "row", gap: 8 },
  acceptBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  declineBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  cityText: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textMuted },
});
