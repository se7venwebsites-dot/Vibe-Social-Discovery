import React, { useState, useCallback, useEffect } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";
import { PremiumModal } from "@/components/PremiumModal";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CARD_W = SCREEN_W - 24;
const CARD_H = SCREEN_H * 0.75;
const SWIPE_THRESHOLD = SCREEN_W * 0.32;

interface User {
  id: number;
  name: string;
  age: number;
  bio: string;
  photoUrl: string;
  photos?: string[];
  isPremium: boolean;
  isVerified?: boolean;
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
  const allPhotos = [user.photoUrl, ...(user.photos ?? [])].filter(Boolean);
  const [photoIdx, setPhotoIdx] = useState(0);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => isTop,
    onMoveShouldSetPanResponder: (_, g) => isTop && Math.abs(g.dx) > 5,
    onPanResponderMove: (_, g) => {
      translateX.value = g.dx;
      translateY.value = g.dy * 0.1;
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_W * 1.5, { duration: 220 }, () => runOnJS(onSwipe)("right"));
      } else if (g.dx < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_W * 1.5, { duration: 220 }, () => runOnJS(onSwipe)("left"));
      } else {
        translateX.value = withSpring(0, { damping: 20 });
        translateY.value = withSpring(0, { damping: 20 });
      }
    },
  });

  const animStyle = useAnimatedStyle(() => {
    const rotate = interpolate(translateX.value, [-SCREEN_W / 2, 0, SCREEN_W / 2], [-12, 0, 12]);
    const scale = interpolate(index, [0, 1, 2], [1, 0.95, 0.90]);
    const offsetY = interpolate(index, [0, 1, 2], [0, 12, 22]);
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

  const handleTap = useCallback(() => {
    if (!isTop || allPhotos.length <= 1) return;
    const next = (photoIdx + 1) % allPhotos.length;
    setPhotoIdx(next);
    Haptics.selectionAsync();
  }, [isTop, photoIdx, allPhotos.length]);

  return (
    <Animated.View
      style={[styles.card, animStyle, { zIndex: 10 - index }]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
        <Image
          source={{ uri: allPhotos[photoIdx] || user.photoUrl }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      </Pressable>

      {allPhotos.length > 1 && (
        <View style={styles.photoDots}>
          {allPhotos.map((_, i) => (
            <View key={i} style={[styles.photoDot, i === photoIdx && styles.photoDotActive]} />
          ))}
        </View>
      )}

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
            <Feather name="map-pin" size={11} color="rgba(255,255,255,0.6)" />
            <Text style={styles.locationText}>{user.city}</Text>
          </View>
        ) : null}
        <View style={styles.nameRow}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userAge}>, {user.age}</Text>
          {user.isVerified && (
            <View style={styles.verifiedBadge}>
              <Feather name="check" size={10} color="#fff" />
            </View>
          )}
        </View>
        <Text style={styles.userBio} numberOfLines={2}>{user.bio}</Text>
        {user.interests && user.interests.length > 0 ? (
          <View style={styles.tagsRow}>
            {user.interests.slice(0, 3).map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {allPhotos.length > 1 && (
          <Text style={styles.tapHint}>Dotknij, żeby zobaczyć więcej zdjęć →</Text>
        )}
      </View>
    </Animated.View>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, isPremium, activatePremium } = useUserContext();
  const [showPremium, setShowPremium] = useState(false);
  const [cardStack, setCardStack] = useState<User[]>([]);
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const { data: usersData, isLoading, refetch } = useQuery<User[]>({
    queryKey: ["users", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const res = await fetch(`${BASE_URL}/users?currentUserId=${currentUser.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentUser,
    staleTime: 30000,
  });

  useEffect(() => {
    if (usersData && usersData.length > 0) {
      setCardStack(prev => {
        const existingIds = new Set(prev.map(u => u.id));
        const newCards = usersData.filter(u => !existingIds.has(u.id));
        if (newCards.length === 0) return prev;
        return [...prev, ...newCards].slice(0, 15);
      });
    }
  }, [usersData]);

  const handleSwipe = useCallback(async (dir: "left" | "right") => {
    const topUser = cardStack[0];
    if (!topUser || !currentUser) return;

    Haptics.impactAsync(dir === "right" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);

    if (dir === "right") {
      fetch(`${BASE_URL}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: currentUser.id, toUserId: topUser.id, action: "like" }),
      }).catch(() => {});
    }

    setCardStack(prev => {
      const next = prev.slice(1);
      if (next.length <= 3) refetch();
      return next;
    });
  }, [cardStack, currentUser, refetch]);

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
    paddingBottom: 8,
    paddingTop: 8,
  },
  logo: { fontFamily: "Montserrat_700Bold", fontSize: 28, color: Colors.accent, letterSpacing: 4 },
  premiumBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  premiumBadgeText: { fontFamily: "Montserrat_700Bold", fontSize: 11, color: Colors.black },
  premiumBadgeOutline: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: Colors.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  premiumBadgeOutlineText: { fontFamily: "Montserrat_700Bold", fontSize: 11, color: Colors.accent },
  cardArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: Colors.cardBg,
  },
  cardImage: { width: "100%", height: "100%" },
  photoDots: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    zIndex: 10,
  },
  photoDot: { width: 24, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)" },
  photoDotActive: { backgroundColor: Colors.accent },
  cardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "transparent",
  },
  stampLike: {
    position: "absolute",
    top: 44,
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
    top: 44,
    right: 20,
    borderWidth: 3,
    borderColor: Colors.danger,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: "20deg" }],
  },
  stampNopeText: { fontFamily: "Montserrat_700Bold", fontSize: 24, color: Colors.danger, letterSpacing: 3 },
  cardInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingTop: 28,
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  locationText: { fontFamily: "Montserrat_500Medium", fontSize: 12, color: "rgba(255,255,255,0.65)" },
  nameRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 4 },
  userName: { fontFamily: "Montserrat_700Bold", fontSize: 26, color: Colors.textPrimary, letterSpacing: -0.5 },
  userAge: { fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: Colors.textPrimary },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#1d9bf0", alignItems: "center", justifyContent: "center", marginLeft: 4 },
  userBio: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 19, marginBottom: 10 },
  tagsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 6 },
  tag: { backgroundColor: "rgba(204,255,0,0.12)", borderWidth: 1, borderColor: "rgba(204,255,0,0.25)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontFamily: "Montserrat_500Medium", fontSize: 11, color: Colors.accent },
  tapHint: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontFamily: "Montserrat_700Bold", fontSize: 22, color: Colors.textPrimary },
  emptyText: { fontFamily: "Montserrat_400Regular", fontSize: 15, color: Colors.textSecondary, textAlign: "center" },
  refreshBtn: { marginTop: 8, backgroundColor: Colors.surface, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  refreshBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: Colors.accent },
});
