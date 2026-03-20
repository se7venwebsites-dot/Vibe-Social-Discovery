import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";

const COINS_KEY = "vibe_coins";

const PACKAGES = [
  { id: "p300", coins: 300, price: "4,99 zł", bonus: "", popular: false, color: Colors.surface },
  { id: "p1200", coins: 1200, price: "14,99 zł", bonus: "+100 bonus", popular: false, color: Colors.surface },
  { id: "p3000", coins: 3000, price: "29,99 zł", bonus: "+300 bonus", popular: true, color: "rgba(204,255,0,0.08)" },
  { id: "p7500", coins: 7500, price: "59,99 zł", bonus: "+1000 bonus", popular: false, color: Colors.surface },
  { id: "p18000", coins: 18000, price: "119,99 zł", bonus: "+3000 bonus 🔥", popular: false, color: Colors.surface },
];

const GIFT_PRICES = [
  { emoji: "❤️", label: "Serduszko", cost: 60 },
  { emoji: "🌹", label: "Róża", cost: 150 },
  { emoji: "🔥", label: "Ogień", cost: 300 },
  { emoji: "⭐", label: "Gwiazdka", cost: 400 },
  { emoji: "💎", label: "Diament", cost: 800 },
  { emoji: "🌈", label: "Tęcza", cost: 1600 },
  { emoji: "👑", label: "Korona", cost: 3000 },
  { emoji: "🚀", label: "Rakieta", cost: 6000 },
];

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [coins, setCoins] = useState(0);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(COINS_KEY).then(v => setCoins(v ? parseInt(v) : 200));
  }, []);

  const handleBuy = async (pkg: typeof PACKAGES[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Kup monety",
      `Czy chcesz kupić ${pkg.coins.toLocaleString()} monet za ${pkg.price}?`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: `Kup za ${pkg.price}`,
          onPress: async () => {
            setBuying(pkg.id);
            await new Promise(r => setTimeout(r, 1200));
            const newCoins = coins + pkg.coins;
            setCoins(newCoins);
            await AsyncStorage.setItem(COINS_KEY, String(newCoins));
            setBuying(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Sukces! 🎉", `Dodano ${pkg.coins.toLocaleString()} monet do Twojego konta!`);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.push("/")}>
          <Feather name="arrow-left" size={20} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.title}>Sklep monet</Text>
        <View style={styles.balanceChip}>
          <Text style={styles.balanceIcon}>💰</Text>
          <Text style={styles.balanceText}>{coins.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} showsVerticalScrollIndicator={false}>

        <Animated.View entering={FadeInDown.springify()} style={styles.banner}>
          <Text style={styles.bannerEmoji}>💰</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Monety VIBE</Text>
            <Text style={styles.bannerSub}>Wysyłaj gifty podczas live'ów i wspieraj swoich ulubionych twórców</Text>
          </View>
        </Animated.View>

        <Text style={styles.sectionTitle}>Pakiety monet</Text>

        {PACKAGES.map((pkg, i) => (
          <Animated.View key={pkg.id} entering={FadeInDown.delay(i * 60).springify()}>
            <Pressable
              style={[styles.packageCard, { backgroundColor: pkg.color }, pkg.popular && styles.packageCardPopular]}
              onPress={() => handleBuy(pkg)}
              disabled={buying === pkg.id}
            >
              {pkg.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>POPULAR</Text>
                </View>
              )}
              <View style={styles.packageLeft}>
                <Text style={styles.packageEmoji}>💰</Text>
                <View>
                  <Text style={styles.packageCoins}>{pkg.coins.toLocaleString()} monet</Text>
                  {pkg.bonus ? <Text style={styles.packageBonus}>{pkg.bonus}</Text> : null}
                </View>
              </View>
              <View style={styles.packageRight}>
                {buying === pkg.id
                  ? <ActivityIndicator color={Colors.accent} size="small" />
                  : <Text style={[styles.packagePrice, pkg.popular && styles.packagePricePremium]}>{pkg.price}</Text>}
              </View>
            </Pressable>
          </Animated.View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Na co wydać monety?</Text>
        <View style={styles.giftGrid}>
          {GIFT_PRICES.map((g, i) => (
            <Animated.View key={g.emoji} entering={FadeInDown.delay(i * 40).springify()} style={styles.giftItem}>
              <Text style={styles.giftEmoji}>{g.emoji}</Text>
              <Text style={styles.giftLabel}>{g.label}</Text>
              <View style={styles.giftCostRow}>
                <Text style={styles.giftCostIcon}>💰</Text>
                <Text style={styles.giftCost}>{g.cost}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Feather name="info" size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>Monety są wirtualną walutą w aplikacji VIBE i nie mają wartości pieniężnej poza aplikacją.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  title: { flex: 1, fontFamily: "Montserrat_700Bold", fontSize: 22, color: Colors.textPrimary },
  balanceChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  balanceIcon: { fontSize: 16 },
  balanceText: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: Colors.accent },
  content: { paddingHorizontal: 20, gap: 12 },
  banner: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "rgba(204,255,0,0.08)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(204,255,0,0.2)", padding: 16, marginBottom: 4 },
  bannerEmoji: { fontSize: 36 },
  bannerTitle: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.accent },
  bannerSub: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  sectionTitle: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.textPrimary, marginTop: 4 },
  packageCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, position: "relative", overflow: "hidden" },
  packageCardPopular: { borderColor: Colors.accent },
  popularBadge: { position: "absolute", top: 0, right: 0, backgroundColor: Colors.accent, paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 12 },
  popularBadgeText: { fontFamily: "Montserrat_700Bold", fontSize: 10, color: Colors.black },
  packageLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  packageEmoji: { fontSize: 28 },
  packageCoins: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.textPrimary },
  packageBonus: { fontFamily: "Montserrat_500Medium", fontSize: 12, color: Colors.accent },
  packageRight: {},
  packagePrice: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: Colors.textPrimary },
  packagePricePremium: { color: Colors.accent },
  giftGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  giftItem: { width: "22%", aspectRatio: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", gap: 3 },
  giftEmoji: { fontSize: 24 },
  giftLabel: { fontFamily: "Montserrat_500Medium", fontSize: 10, color: Colors.textMuted },
  giftCostRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  giftCostIcon: { fontSize: 10 },
  giftCost: { fontFamily: "Montserrat_700Bold", fontSize: 11, color: Colors.accent },
  infoBox: { flexDirection: "row", gap: 10, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "flex-start" },
  infoText: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textMuted, flex: 1, lineHeight: 18 },
});
