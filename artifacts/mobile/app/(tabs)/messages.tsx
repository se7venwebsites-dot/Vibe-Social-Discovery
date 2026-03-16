import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";
import { PremiumModal } from "@/components/PremiumModal";

interface MatchedUser {
  id: number;
  name: string;
  age: number;
  bio: string;
  photoUrl: string;
  matchId: number;
  lastMessage?: string;
  unreadCount: number;
  city?: string;
}

function MessagePaywallModal({ visible, matchUser, onClose, onActivate }: {
  visible: boolean;
  matchUser: MatchedUser | null;
  onClose: () => void;
  onActivate: () => Promise<void>;
}) {
  const [loading, setLoading] = React.useState(false);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.paywallOverlay}>
        <Animated.View entering={FadeIn.duration(180)} style={styles.paywallBox}>
          <Pressable style={styles.paywallClose} onPress={onClose}>
            <Feather name="x" size={20} color={Colors.textSecondary} />
          </Pressable>
          {matchUser && (
            <Image source={{ uri: matchUser.photoUrl }} style={styles.paywallAvatar} />
          )}
          <Text style={styles.paywallTitle}>
            {matchUser?.name ?? "Ona"} już tu jest!
          </Text>
          <Text style={styles.paywallSub}>
            Odblokuj możliwość rozmowy i odpowiedz{" "}
            <Text style={{ color: Colors.accent }}>{matchUser?.name ?? "jej"}</Text> już teraz za 24,99 PLN.
          </Text>
          <View style={styles.paywallPriceRow}>
            <Text style={styles.paywallPrice}>24,99 PLN</Text>
            <Text style={styles.paywallPriceSub}> / tydzień</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.paywallBtn, pressed && { opacity: 0.85 }]}
            onPress={async () => {
              setLoading(true);
              await onActivate();
              setLoading(false);
            }}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={Colors.black} /> : (
              <>
                <Feather name="message-circle" size={16} color={Colors.black} />
                <Text style={styles.paywallBtnText}>Odblokuj rozmowę</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.paywallNote}>Zakup jest symulowany.</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MatchCard({ match, index, isPremium, onPress }: {
  match: MatchedUser;
  index: number;
  isPremium: boolean;
  onPress: () => void;
}) {
  const isLocked = !isPremium;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable
        style={({ pressed }) => [styles.matchCard, pressed && { backgroundColor: Colors.surface }]}
        onPress={onPress}
      >
        <View style={styles.avatarWrap}>
          <Image source={{ uri: match.photoUrl }} style={styles.avatar} />
          {match.unreadCount > 0 && (
            <View style={styles.unreadDot}>
              <Text style={styles.unreadDotText}>{match.unreadCount > 9 ? "9+" : match.unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.matchInfo}>
          <View style={styles.matchNameRow}>
            <Text style={styles.matchName}>{match.name}</Text>
            {isLocked && (
              <View style={styles.lockBadge}>
                <Feather name="lock" size={10} color={Colors.black} />
                <Text style={styles.lockBadgeText}>Premium</Text>
              </View>
            )}
          </View>
          {isLocked ? (
            <View style={styles.blurMsgRow}>
              <View style={styles.blurMsg} />
              <View style={[styles.blurMsg, { width: 60, opacity: 0.4 }]} />
            </View>
          ) : (
            <Text style={styles.lastMsg} numberOfLines={1}>
              {match.lastMessage ?? "Zacznij rozmowę!"}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={16} color={Colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, isPremium, activatePremium } = useUserContext();
  const [showPremium, setShowPremium] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchedUser | null>(null);
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const { data: matches = [], isLoading } = useQuery<MatchedUser[]>({
    queryKey: ["matches", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const res = await fetch(`${BASE_URL}/matches/${currentUser.id}`);
      return res.json();
    },
    enabled: !!currentUser,
    refetchInterval: 10000,
  });

  const handleMatchPress = (match: MatchedUser) => {
    Haptics.selectionAsync();
    if (!isPremium) {
      setSelectedMatch(match);
      setShowPremium(true);
    } else {
      router.push({ pathname: "/chat/[id]", params: { id: String(match.id), name: match.name } });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Wiadomości</Text>
        {isPremium ? (
          <View style={styles.premiumTag}>
            <Feather name="zap" size={11} color={Colors.black} />
            <Text style={styles.premiumTagText}>VIBE+</Text>
          </View>
        ) : (
          <Pressable style={styles.premiumTagOutline} onPress={() => setShowPremium(true)}>
            <Feather name="lock" size={11} color={Colors.accent} />
            <Text style={styles.premiumTagOutlineText}>Odblokuj</Text>
          </Pressable>
        )}
      </View>

      {!isPremium && (
        <Animated.View entering={FadeIn.delay(100)} style={styles.freeBanner}>
          <Feather name="info" size={14} color={Colors.accent} />
          <Text style={styles.freeBannerText}>
            Darmowi użytkownicy widzą mecze, ale{" "}
            <Text style={{ color: Colors.accent }}>nie mogą odczytać wiadomości</Text>.
          </Text>
        </Animated.View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <Feather name="message-circle" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Brak dopasowań</Text>
          <Text style={styles.emptyText}>Swipuj, żeby tworzyć dopasowania!</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
          renderItem={({ item, index }) => (
            <MatchCard
              match={item}
              index={index}
              isPremium={isPremium}
              onPress={() => handleMatchPress(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <PremiumModal
        visible={showPremium && !selectedMatch}
        onClose={() => setShowPremium(false)}
        onActivate={async () => {
          await activatePremium();
          setShowPremium(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      <MessagePaywallModal
        visible={showPremium && !!selectedMatch}
        matchUser={selectedMatch}
        onClose={() => { setShowPremium(false); setSelectedMatch(null); }}
        onActivate={async () => {
          await activatePremium();
          setShowPremium(false);
          setSelectedMatch(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 8,
  },
  title: { fontFamily: "Montserrat_700Bold", fontSize: 26, color: Colors.textPrimary },
  premiumTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  premiumTagText: { fontFamily: "Montserrat_700Bold", fontSize: 11, color: Colors.black },
  premiumTagOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  premiumTagOutlineText: { fontFamily: "Montserrat_700Bold", fontSize: 11, color: Colors.accent },
  freeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "rgba(204,255,0,0.07)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.2)",
    borderRadius: 12,
    padding: 12,
  },
  freeBannerText: {
    flex: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  listContent: { paddingTop: 4 },
  matchCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: Colors.black,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.surface },
  unreadDot: {
    position: "absolute",
    top: -2, right: -2,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.black,
  },
  unreadDotText: { fontFamily: "Montserrat_700Bold", fontSize: 10, color: Colors.black },
  matchInfo: { flex: 1 },
  matchNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  matchName: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.textPrimary },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.accent,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  lockBadgeText: { fontFamily: "Montserrat_700Bold", fontSize: 9, color: Colors.black },
  blurMsgRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  blurMsg: { height: 10, width: 90, borderRadius: 5, backgroundColor: Colors.border },
  lastMsg: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 90 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontFamily: "Montserrat_700Bold", fontSize: 20, color: Colors.textPrimary },
  emptyText: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  paywallOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  paywallBox: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 44,
    borderTopWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    alignItems: "center",
  },
  paywallClose: { position: "absolute", top: 16, right: 20, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  paywallAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: Colors.accent },
  paywallTitle: { fontFamily: "Montserrat_700Bold", fontSize: 22, color: Colors.textPrimary, textAlign: "center" },
  paywallSub: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
  paywallPriceRow: { flexDirection: "row", alignItems: "baseline" },
  paywallPrice: { fontFamily: "Montserrat_700Bold", fontSize: 36, color: Colors.accent },
  paywallPriceSub: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary },
  paywallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  paywallBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.black },
  paywallNote: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textMuted },
});
