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
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";
import { PremiumModal } from "@/components/PremiumModal";

interface User {
  id: number;
  name: string;
  age: number;
  bio: string;
  photoUrl: string;
  city?: string;
}

function BlurCard() {
  return (
    <View style={styles.blurCard}>
      <View style={styles.blurImg} />
      <View style={styles.blurOverlay}>
        <View style={styles.blurLine} />
        <View style={[styles.blurLine, { width: "55%" }]} />
      </View>
    </View>
  );
}

function LikeCard({
  user,
  index,
  onPress,
}: {
  user: User;
  index: number;
  onPress: (user: User) => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable style={styles.likeCard} onPress={() => onPress(user)}>
        <Image source={{ uri: user.photoUrl }} style={styles.likeImg} resizeMode="cover" />
        <View style={styles.likeOverlay} />
        <View style={styles.likeInfo}>
          <Text style={styles.likeName}>{user.name}, {user.age}</Text>
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
      </Pressable>
    </Animated.View>
  );
}

function LikePaywallModal({ visible, user, onClose, onActivate }: {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onActivate: () => Promise<void>;
}) {
  const [loading, setLoading] = React.useState(false);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.paywallOverlay}>
        <Animated.View entering={FadeIn.duration(200)} style={styles.paywallBox}>
          <Pressable style={styles.paywallClose} onPress={onClose}>
            <Feather name="x" size={20} color={Colors.textSecondary} />
          </Pressable>
          <View style={styles.paywallLockCircle}>
            <Feather name="lock" size={28} color={Colors.black} />
          </View>
          <Text style={styles.paywallTitle}>
            {user?.name ?? "Ona"} już tu jest!
          </Text>
          <Text style={styles.paywallSub}>
            Odblokuj listę lajków i odpowiedz {user?.name ?? "jej"} już teraz.
          </Text>
          <View style={styles.paywallPriceRow}>
            <Text style={styles.paywallPrice}>24,99 PLN</Text>
            <Text style={styles.paywallPriceSub}> / tydzień</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.paywallBtn, pressed && { opacity: 0.85 }]}
            onPress={async () => { setLoading(true); await onActivate(); setLoading(false); }}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.black} />
            ) : (
              <>
                <Feather name="zap" size={16} color={Colors.black} />
                <Text style={styles.paywallBtnText}>Odblokuj VIBE+</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.paywallNote}>Zakup jest symulowany.</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function LikesScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, isPremium, activatePremium } = useUserContext();
  const [showPremium, setShowPremium] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const router = useRouter();

  const { data: likers = [], isLoading } = useQuery<User[]>({
    queryKey: ["likes-received", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const res = await fetch(`${BASE_URL}/likes/received/${currentUser.id}`);
      return res.json();
    },
    enabled: isPremium && !!currentUser,
  });

  const FAKE_COUNT = 8;

  const handleCardPress = (user: User) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPremium) {
      router.push(`/user/${user.id}` as any);
    } else {
      setSelectedUser(user);
      setShowPremium(true);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Polubili Cię</Text>
        {isPremium && (
          <View style={styles.premiumTag}>
            <Feather name="zap" size={11} color={Colors.black} />
            <Text style={styles.premiumTagText}>VIBE+</Text>
          </View>
        )}
      </View>

      {!isPremium ? (
        <View style={styles.lockedContainer}>
          <View style={styles.blurGrid}>
            {Array.from({ length: FAKE_COUNT }).map((_, i) => (
              <Pressable key={i} style={styles.blurCardWrap} onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedUser(null);
                setShowPremium(true);
              }}>
                <BlurCard />
                <View style={styles.blurLockOverlay}>
                  <Feather name="lock" size={18} color="rgba(255,255,255,0.6)" />
                </View>
              </Pressable>
            ))}
          </View>
          <View style={styles.lockedBanner}>
            <Animated.View entering={FadeIn.delay(200)} style={styles.lockedBox}>
              <View style={styles.lockIconWrap}>
                <Feather name="lock" size={26} color={Colors.black} />
              </View>
              <Text style={styles.lockTitle}>{FAKE_COUNT}+ osób Cię polubiło</Text>
              <Text style={styles.lockSub}>
                Odblokuj VIBE+, aby zobaczyć kto dał Ci lajka i z nimi pogadać.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.unlockBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowPremium(true); }}
              >
                <Feather name="zap" size={16} color={Colors.black} />
                <Text style={styles.unlockBtnText}>Odblokuj za 24,99 PLN/tydz.</Text>
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
            <LikeCard user={item} index={index} onPress={handleCardPress} />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      <PremiumModal
        visible={!isPremium && showPremium && !selectedUser}
        onClose={() => { setShowPremium(false); setSelectedUser(null); }}
        onActivate={async () => {
          await activatePremium();
          setShowPremium(false);
          setSelectedUser(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      <LikePaywallModal
        visible={showPremium && !!selectedUser && !isPremium}
        user={selectedUser}
        onClose={() => { setShowPremium(false); setSelectedUser(null); }}
        onActivate={async () => {
          await activatePremium();
          setShowPremium(false);
          setSelectedUser(null);
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
    paddingBottom: 16,
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
  lockedContainer: { flex: 1 },
  blurGrid: { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 8 },
  blurCardWrap: { width: "47%", position: "relative" },
  blurCard: { height: 200, borderRadius: 16, overflow: "hidden", backgroundColor: Colors.cardBg },
  blurImg: { flex: 1, backgroundColor: Colors.surface, opacity: 0.3 },
  blurOverlay: { padding: 10, gap: 6 },
  blurLine: { height: 10, borderRadius: 5, backgroundColor: Colors.border, width: "80%" },
  blurLockOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  lockedBanner: {
    position: "absolute",
    bottom: 80, left: 0, right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  lockedBox: {
    backgroundColor: Colors.cardBg,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    width: "100%",
  },
  lockIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  lockTitle: { fontFamily: "Montserrat_700Bold", fontSize: 20, color: Colors.textPrimary, textAlign: "center" },
  lockSub: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 19 },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  unlockBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: Colors.black },
  row: { gap: 12, paddingHorizontal: 12, marginBottom: 12 },
  listContent: { paddingTop: 8, paddingHorizontal: 4 },
  likeCard: { flex: 1, height: 220, borderRadius: 16, overflow: "hidden", backgroundColor: Colors.cardBg },
  likeImg: { width: "100%", height: "100%" },
  likeOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: "45%", backgroundColor: "rgba(0,0,0,0.7)" },
  likeInfo: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12 },
  likeName: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: Colors.textPrimary },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  locationText: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textSecondary },
  heartBadge: {
    position: "absolute",
    top: 10, right: 10,
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontFamily: "Montserrat_700Bold", fontSize: 20, color: Colors.textPrimary },
  emptyText: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary },
  paywallOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  paywallBox: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    alignItems: "center",
  },
  paywallClose: { position: "absolute", top: 16, right: 20, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  paywallLockCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  paywallTitle: { fontFamily: "Montserrat_700Bold", fontSize: 22, color: Colors.textPrimary, textAlign: "center" },
  paywallSub: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
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
  paywallNote: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textMuted, textAlign: "center" },
});
