import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Pressable,
  PanResponder,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  FadeIn,
} from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";
import { PremiumModal } from "@/components/PremiumModal";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CARD_W = SCREEN_W - 32;
const CARD_H = SCREEN_H * 0.65;
const SWIPE_THRESHOLD = SCREEN_W * 0.35;

interface User {
  id: number;
  name: string;
  age: number;
  bio: string;
  photoUrl: string;
  isPremium: boolean;
  city?: string;
  interests?: string[];
}

function SwipeCard({
  user,
  onSwipe,
  isTop,
  index,
}: {
  user: User;
  onSwipe: (dir: "left" | "right") => void;
  isTop: boolean;
  index: number;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => isTop,
    onMoveShouldSetPanResponder: () => isTop,
    onPanResponderMove: (_, g) => {
      translateX.value = g.dx;
      translateY.value = g.dy * 0.18;
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_W * 1.5, { duration: 240 }, () => runOnJS(onSwipe)("right"));
      } else if (g.dx < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_W * 1.5, { duration: 240 }, () => runOnJS(onSwipe)("left"));
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    },
  });

  const animStyle = useAnimatedStyle(() => {
    const rotate = interpolate(translateX.value, [-SCREEN_W / 2, 0, SCREEN_W / 2], [-14, 0, 14]);
    const scale = interpolate(index, [0, 1, 2], [1, 0.95, 0.9]);
    const offsetY = interpolate(index, [0, 1, 2], [0, 10, 18]);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + offsetY },
        { rotate: isTop ? `${rotate}deg` : "0deg" },
        { scale },
      ],
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD * 0.5], [0, 1], "clamp"),
  }));
  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD * 0.5, 0], [1, 0], "clamp"),
  }));

  return (
    <Animated.View
      style={[styles.card, animStyle, { zIndex: 10 - index }]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      <Image source={{ uri: user.photoUrl }} style={styles.cardImage} resizeMode="cover" />
      <View style={styles.cardGradient} />

      <Animated.View style={[styles.stampLike, likeOpacity]}>
        <Text style={styles.stampLikeText}>VIBE</Text>
      </Animated.View>
      <Animated.View style={[styles.stampNope, nopeOpacity]}>
        <Text style={styles.stampNopeText}>NOPE</Text>
      </Animated.View>

      <View style={styles.cardInfo}>
        {user.city ? (
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={11} color={Colors.textSecondary} />
            <Text style={styles.locationText}>{user.city}</Text>
          </View>
        ) : null}
        <View style={styles.nameRow}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userAge}>, {user.age}</Text>
        </View>
        <Text style={styles.userBio} numberOfLines={2}>{user.bio}</Text>
        {user.interests && user.interests.length > 0 ? (
          <View style={styles.tagsRow}>
            {user.interests.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, isPremium, activatePremium } = useUserContext();
  const [showPremium, setShowPremium] = useState(false);
  const [cardStack, setCardStack] = useState<User[]>([]);
  const queryClient = useQueryClient();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const { data: users = [], isLoading, refetch } = useQuery<User[]>({
    queryKey: ["users", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const res = await fetch(`${BASE_URL}/users?currentUserId=${currentUser.id}`);
      return res.json();
    },
    enabled: !!currentUser,
  });

  React.useEffect(() => {
    if (users.length > 0 && cardStack.length === 0) {
      setCardStack(users.slice(0, 10));
    }
  }, [users]);

  const handleSwipe = useCallback(
    async (dir: "left" | "right") => {
      const topUser = cardStack[0];
      if (!topUser || !currentUser) return;

      Haptics.impactAsync(
        dir === "right" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      );

      if (dir === "right") {
        fetch(`${BASE_URL}/likes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromUserId: currentUser.id, toUserId: topUser.id, action: "like" }),
        }).catch(() => {});
      }

      setCardStack((prev) => {
        const next = prev.slice(1);
        if (next.length <= 2) refetch();
        return next;
      });
    },
    [cardStack, currentUser]
  );

  const handleButtonSwipe = (dir: "left" | "right") => handleSwipe(dir);

  if (isLoading && cardStack.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Text style={styles.logo}>VIBE</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </View>
    );
  }

  const displayStack = cardStack.slice(0, 3);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>VIBE</Text>
        {isPremium ? (
          <View style={styles.premiumBadge}>
            <Feather name="zap" size={12} color={Colors.black} />
            <Text style={styles.premiumBadgeText}>VIBE+</Text>
          </View>
        ) : (
          <Pressable style={styles.premiumBadgeOutline} onPress={() => setShowPremium(true)}>
            <Feather name="zap" size={12} color={Colors.accent} />
            <Text style={styles.premiumBadgeOutlineText}>VIBE+</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.cardArea}>
        {displayStack.length === 0 ? (
          <Animated.View entering={FadeIn} style={styles.emptyState}>
            <Feather name="users" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>To już wszyscy!</Text>
            <Text style={styles.emptyText}>Wróć jutro po nowych profilach.</Text>
            <Pressable style={styles.refreshBtn} onPress={() => { setCardStack([]); refetch(); }}>
              <Text style={styles.refreshBtnText}>Odśwież</Text>
            </Pressable>
          </Animated.View>
        ) : (
          [...displayStack].reverse().map((user, revIdx) => {
            const idx = displayStack.length - 1 - revIdx;
            return (
              <SwipeCard
                key={user.id}
                user={user}
                onSwipe={handleSwipe}
                isTop={idx === 0}
                index={idx}
              />
            );
          })
        )}
      </View>

      {displayStack.length > 0 ? (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.nopeBtn, pressed && styles.btnPressed]}
            onPress={() => handleButtonSwipe("left")}
          >
            <Feather name="x" size={28} color={Colors.danger} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.superLikeBtn, pressed && styles.btnPressed]}
            onPress={() => handleButtonSwipe("right")}
          >
            <Feather name="star" size={20} color={Colors.accent} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.likeBtn, pressed && styles.btnPressed]}
            onPress={() => handleButtonSwipe("right")}
          >
            <Feather name="heart" size={28} color={Colors.accent} />
          </Pressable>
        </View>
      ) : null}

      <PremiumModal
        visible={showPremium}
        onClose={() => setShowPremium(false)}
        onActivate={async () => {
          await activatePremium();
          setShowPremium(false);
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
  logo: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 28,
    color: Colors.accent,
    letterSpacing: 4,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  premiumBadgeOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  premiumBadgeText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 11,
    color: Colors.black,
  },
  premiumBadgeOutlineText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 11,
    color: Colors.accent,
  },
  cardArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: Colors.cardBg,
  },
  cardImage: { width: "100%", height: "100%" },
  cardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "55%",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  stampLike: {
    position: "absolute",
    top: 40,
    left: 20,
    borderWidth: 3,
    borderColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: "-20deg" }],
  },
  stampLikeText: { fontFamily: "Montserrat_700Bold", fontSize: 24, color: Colors.accent, letterSpacing: 3 },
  stampNope: {
    position: "absolute",
    top: 40,
    right: 20,
    borderWidth: 3,
    borderColor: Colors.danger,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: "20deg" }],
  },
  stampNopeText: { fontFamily: "Montserrat_700Bold", fontSize: 24, color: Colors.danger, letterSpacing: 3 },
  cardInfo: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  locationText: { fontFamily: "Montserrat_500Medium", fontSize: 12, color: Colors.textSecondary },
  nameRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 6 },
  userName: { fontFamily: "Montserrat_700Bold", fontSize: 28, color: Colors.textPrimary, letterSpacing: -0.5 },
  userAge: { fontFamily: "Montserrat_600SemiBold", fontSize: 24, color: Colors.textPrimary, marginLeft: 4 },
  userBio: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 20, marginBottom: 10 },
  tagsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: {
    backgroundColor: "rgba(204,255,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.25)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontFamily: "Montserrat_500Medium", fontSize: 11, color: Colors.accent },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingTop: 16,
  },
  actionBtn: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  nopeBtn: { borderColor: Colors.danger, backgroundColor: "rgba(255,59,92,0.08)" },
  likeBtn: { borderColor: Colors.accent, backgroundColor: "rgba(204,255,0,0.08)" },
  superLikeBtn: { width: 50, height: 50, borderRadius: 25, borderColor: Colors.border, backgroundColor: Colors.surface },
  btnPressed: { opacity: 0.7, transform: [{ scale: 0.93 }] },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontFamily: "Montserrat_700Bold", fontSize: 22, color: Colors.textPrimary },
  emptyText: { fontFamily: "Montserrat_400Regular", fontSize: 15, color: Colors.textSecondary, textAlign: "center" },
  refreshBtn: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  refreshBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: Colors.accent },
});
