import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext } from "@/context/UserContext";
import { PremiumModal } from "@/components/PremiumModal";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

interface User {
  id: number;
  name: string;
  age: number;
  bio: string;
  photoUrl: string;
  isPremium: boolean;
  city?: string;
}

function BlurredCard() {
  return (
    <View style={styles.blurCard}>
      <View style={styles.blurImagePlaceholder} />
      <View style={styles.blurContent}>
        <View style={styles.blurLine} />
        <View style={[styles.blurLine, { width: "60%" }]} />
      </View>
    </View>
  );
}

function LikeCard({ user, index }: { user: User; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <View style={styles.likeCard}>
        <Image source={{ uri: user.photoUrl }} style={styles.likeCardImage} />
        <View style={styles.likeCardOverlay} />
        <View style={styles.likeCardInfo}>
          <Text style={styles.likeCardName}>{user.name}, {user.age}</Text>
          {user.city ? (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={10} color={Colors.textSecondary} />
              <Text style={styles.locationText}>{user.city}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.heartBadge}>
          <Feather name="heart" size={14} color={Colors.black} />
        </View>
      </View>
    </Animated.View>
  );
}

export default function LikesScreen() {
  const insets = useSafeAreaInsets();
  const { currentUserId, isPremium, activatePremium } = useUserContext();
  const [showPremium, setShowPremium] = React.useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const { data: likers = [], isLoading } = useQuery<User[]>({
    queryKey: ["likes-received", currentUserId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/likes/received/${currentUserId}`);
      return res.json();
    },
    enabled: isPremium,
  });

  const FAKE_COUNT = 7;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Polubienia</Text>
        {isPremium ? (
          <View style={styles.premiumTag}>
            <Feather name="zap" size={11} color={Colors.black} />
            <Text style={styles.premiumTagText}>VIBE+</Text>
          </View>
        ) : null}
      </View>

      {!isPremium ? (
        <View style={styles.lockedContainer}>
          <View style={styles.blurGrid}>
            {Array.from({ length: FAKE_COUNT }).map((_, i) => (
              <BlurredCard key={i} />
            ))}
          </View>
          <View style={styles.lockedOverlay}>
            <Animated.View entering={FadeIn.delay(200)} style={styles.lockedBox}>
              <View style={styles.lockIconWrapper}>
                <Feather name="lock" size={28} color={Colors.black} />
              </View>
              <Text style={styles.lockTitle}>Kto Cię polubił?</Text>
              <Text style={styles.lockSubtitle}>
                Odblokuj VIBE+, aby zobaczyć {FAKE_COUNT}+ profili, które Cię polubiły.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.unlockBtn,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowPremium(true);
                }}
              >
                <Feather name="zap" size={16} color={Colors.black} />
                <Text style={styles.unlockBtnText}>Odblokuj VIBE+</Text>
              </Pressable>
            </Animated.View>
          </View>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : likers.length === 0 ? (
        <View style={styles.center}>
          <Feather name="heart" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Jeszcze nikt</Text>
          <Text style={styles.emptyText}>Swipuj więcej, a lajki przyjdą!</Text>
        </View>
      ) : (
        <FlatList
          data={likers}
          keyExtractor={(u) => String(u.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
          renderItem={({ item, index }) => (
            <LikeCard user={item} index={index} />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

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
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 26,
    color: Colors.textPrimary,
  },
  premiumTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  premiumTagText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 11,
    color: Colors.black,
  },
  lockedContainer: {
    flex: 1,
    position: "relative",
  },
  blurGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
    gap: 8,
  },
  blurCard: {
    width: "47%",
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.cardBg,
  },
  blurImagePlaceholder: {
    flex: 1,
    backgroundColor: Colors.surface,
    opacity: 0.4,
  },
  blurContent: {
    padding: 10,
    gap: 6,
  },
  blurLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
    width: "80%",
  },
  lockedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  lockedBox: {
    backgroundColor: Colors.cardBg,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  lockIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  lockTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  lockSubtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  unlockBtnText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: Colors.black,
  },
  row: {
    gap: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  listContent: {
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  likeCard: {
    flex: 1,
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.cardBg,
    position: "relative",
  },
  likeCardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  likeCardOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "45%",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  likeCardInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  likeCardName: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: Colors.textPrimary,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  locationText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
  },
  heartBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 20,
    color: Colors.textPrimary,
  },
  emptyText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
