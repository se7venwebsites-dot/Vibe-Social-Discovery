import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Colors from "@/constants/colors";
import { useUserContext } from "@/context/UserContext";
import { PremiumModal } from "@/components/PremiumModal";

const STATS = [
  { label: "Swipe'y", value: "∞", iconName: "zap" as const },
  { label: "Dopasowania", value: "3", iconName: "heart" as const },
  { label: "Super Lajki", value: "12", iconName: "star" as const },
];

const MENU_ITEMS = [
  { icon: "bell" as const, label: "Powiadomienia", desc: "Ustaw preferencje alertów" },
  { icon: "sliders" as const, label: "Preferencje", desc: "Wiek, odległość, płeć" },
  { icon: "shield" as const, label: "Prywatność", desc: "Zarządzaj swoimi danymi" },
  { icon: "help-circle" as const, label: "Pomoc", desc: "FAQ i wsparcie" },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isPremium, activatePremium, resetSwipes } = useUserContext();
  const [showPremium, setShowPremium] = React.useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handleResetData = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Resetuj dane",
      "Czy na pewno chcesz zresetować swoje preferencje i liczniki?",
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Resetuj",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove([
              "vibe_swipe_count",
              "vibe_is_premium",
            ]);
            resetSwipes();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 100 }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
          <Pressable style={styles.editBtn}>
            <Feather name="edit-2" size={18} color={Colors.accent} />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.profileCard}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Feather name="user" size={40} color={Colors.textMuted} />
            </View>
          </View>
          <Text style={styles.userName}>Ty (ID: 1)</Text>
          <Text style={styles.userLocation}>Warszawa, Polska</Text>

          {isPremium ? (
            <View style={styles.premiumBadge}>
              <Feather name="zap" size={12} color={Colors.black} />
              <Text style={styles.premiumBadgeText}>VIBE+ AKTYWNY</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.upgradeCta,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowPremium(true);
              }}
            >
              <Feather name="zap" size={14} color={Colors.black} />
              <Text style={styles.upgradeCtaText}>Aktywuj VIBE+</Text>
            </Pressable>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.statsRow}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statBox}>
              <View style={styles.statIconWrap}>
                <Feather name={s.iconName} size={16} color={isPremium ? Colors.accent : Colors.textMuted} />
              </View>
              <Text style={styles.statValue}>{isPremium ? s.value : "–"}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {!isPremium ? (
          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.premiumBanner}>
            <View style={styles.premiumBannerLeft}>
              <Text style={styles.premiumBannerTitle}>Odblokuj VIBE+</Text>
              <Text style={styles.premiumBannerSub}>Nieograniczone swipe'y i więcej</Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.premiumBannerBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowPremium(true);
              }}
            >
              <Text style={styles.premiumBannerBtnText}>24,99 PLN/tydz.</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Ustawienia</Text>
          {MENU_ITEMS.map((item, i) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [
                styles.menuItem,
                i === MENU_ITEMS.length - 1 && { borderBottomWidth: 0 },
                pressed && { backgroundColor: Colors.surface },
              ]}
            >
              <View style={styles.menuIconWrap}>
                <Feather name={item.icon} size={18} color={Colors.accent} />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuDesc}>{item.desc}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={Colors.textMuted} />
            </Pressable>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <Pressable style={styles.dangerBtn} onPress={handleResetData}>
            <Feather name="refresh-cw" size={16} color={Colors.danger} />
            <Text style={styles.dangerBtnText}>Resetuj dane</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

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
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 26,
    color: Colors.textPrimary,
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    gap: 8,
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 20,
    color: Colors.textPrimary,
  },
  userLocation: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  premiumBadgeText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 11,
    color: Colors.black,
    letterSpacing: 1,
  },
  upgradeCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 4,
  },
  upgradeCtaText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
    color: Colors.black,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  premiumBanner: {
    backgroundColor: "rgba(204,255,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.25)",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  premiumBannerLeft: {
    flex: 1,
  },
  premiumBannerTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: Colors.accent,
  },
  premiumBannerSub: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  premiumBannerBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  premiumBannerBtnText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 12,
    color: Colors.black,
  },
  menuSection: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    padding: 16,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(204,255,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuTextWrap: {
    flex: 1,
  },
  menuLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    color: Colors.textPrimary,
  },
  menuDesc: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,59,92,0.2)",
    backgroundColor: "rgba(255,59,92,0.06)",
  },
  dangerBtnText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: Colors.danger,
  },
});
