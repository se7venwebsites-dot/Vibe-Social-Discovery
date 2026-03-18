import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

const INTERESTS_OPTIONS = [
  "muzyka", "podróże", "sport", "gotowanie", "sztuka", "tech",
  "kino", "literatura", "fitness", "fotografia", "gaming", "yoga",
];

const BADGES = [
  { id: "new", label: "Nowy", icon: "⭐", desc: "Witaj w VIBE!", unlocked: true },
  { id: "active", label: "Aktywny", icon: "🔥", desc: "Zaloguj się 7 dni z rzędu", unlocked: false },
  { id: "popular", label: "Popularny", icon: "💫", desc: "Zdobądź 50 lajków", unlocked: false },
  { id: "verified", label: "Zweryfikowany", icon: "✅", desc: "Zweryfikuj swoje konto", unlocked: false },
  { id: "streamer", label: "Streamer", icon: "📡", desc: "Przeprowadź swój pierwszy live", unlocked: false },
  { id: "social", label: "Towarzyski", icon: "🤝", desc: "Dodaj 10 znajomych", unlocked: false },
];

type EditMode = "none" | "basic";

const COINS_KEY = "vibe_coins";
const DAILY_REWARD_KEY = "vibe_daily_reward";
const LOGIN_STREAK_KEY = "vibe_login_streak";

async function uploadImage(base64: string, mimeType: string): Promise<string> {
  const res = await fetch(`${BASE_URL.replace("/api", "")}/api/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mimeType }),
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
}

async function pickAndUploadImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Brak dostępu", "Zezwól aplikacji na dostęp do galerii w ustawieniach.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const base64 = asset.base64;
  if (!base64) return null;
  const mimeType = asset.mimeType ?? "image/jpeg";
  return uploadImage(base64, mimeType);
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, updateProfile, activatePremium, devReset, isPremium } = useUserContext();
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [coins, setCoins] = useState(0);
  const [loginStreak, setLoginStreak] = useState(1);
  const [dailyRewardClaimed, setDailyRewardClaimed] = useState(false);
  const [showRewardBanner, setShowRewardBanner] = useState(false);

  const [name, setName] = useState(currentUser?.name ?? "");
  const [bio, setBio] = useState(currentUser?.bio ?? "");
  const [city, setCity] = useState(currentUser?.city ?? "");
  const [interests, setInterests] = useState<string[]>(currentUser?.interests ?? []);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    const loadCoins = async () => {
      try {
        const stored = await AsyncStorage.getItem(COINS_KEY);
        setCoins(stored ? parseInt(stored) : 200);
        const lastReward = await AsyncStorage.getItem(DAILY_REWARD_KEY);
        const streakStr = await AsyncStorage.getItem(LOGIN_STREAK_KEY);
        const today = new Date().toDateString();
        const streak = streakStr ? parseInt(streakStr) : 1;
        setLoginStreak(streak);
        if (lastReward !== today) {
          setDailyRewardClaimed(false);
          setShowRewardBanner(true);
        } else {
          setDailyRewardClaimed(true);
        }
      } catch {}
    };
    loadCoins();
  }, []);

  const claimDailyReward = async () => {
    const reward = 50 + loginStreak * 10;
    const newCoins = coins + reward;
    const today = new Date().toDateString();
    setCoins(newCoins);
    setDailyRewardClaimed(true);
    setShowRewardBanner(false);
    await AsyncStorage.setItem(COINS_KEY, String(newCoins));
    await AsyncStorage.setItem(DAILY_REWARD_KEY, today);
    await AsyncStorage.setItem(LOGIN_STREAK_KEY, String(loginStreak + 1));
    setLoginStreak(s => s + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Dzienna nagroda!", `Zdobyłeś ${reward} monet! 🎉\nStreak: ${loginStreak} dni z rzędu`);
  };

  const profileLevel = Math.floor(loginStreak / 3) + 1;
  const profileXp = (loginStreak % 3) * 33;

  const handlePickProfilePhoto = useCallback(async () => {
    setUploadingPhoto(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const url = await pickAndUploadImage();
      if (url) {
        await updateProfile({ photoUrl: url });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("Błąd", "Nie udało się przesłać zdjęcia.");
    } finally {
      setUploadingPhoto(false);
    }
  }, [updateProfile]);

  const handleAddGalleryPhoto = useCallback(async () => {
    setUploadingPhoto(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const url = await pickAndUploadImage();
      if (url) {
        const currentPhotos = currentUser?.photos ?? [];
        await updateProfile({ photos: [...currentPhotos, url] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("Błąd", "Nie udało się przesłać zdjęcia.");
    } finally {
      setUploadingPhoto(false);
    }
  }, [updateProfile, currentUser?.photos]);

  if (!currentUser) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>
      </View>
    );
  }

  const allPhotos = [currentUser.photoUrl, ...(currentUser.photos ?? [])].filter(Boolean);

  const startEdit = () => {
    setName(currentUser.name);
    setBio(currentUser.bio);
    setCity(currentUser.city ?? "");
    setInterests(currentUser.interests ?? []);
    setEditMode("basic");
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile({ name: name.trim(), bio: bio.trim(), city: city.trim() || undefined, interests });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditMode("none");
    } catch (e: unknown) {
      Alert.alert("Błąd", (e as Error).message || "Nie udało się zapisać");
    } finally { setLoading(false); }
  };

  const handleSetAsMain = async (photoUrl: string) => {
    const newPhotos = (currentUser.photos ?? []).filter(p => p !== photoUrl);
    if (currentUser.photoUrl !== photoUrl) newPhotos.unshift(currentUser.photoUrl);
    setLoading(true);
    try {
      await updateProfile({ photoUrl, photos: newPhotos });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    finally { setLoading(false); }
  };

  const handleRemovePhoto = async (photoUrl: string) => {
    if (photoUrl === currentUser.photoUrl && (currentUser.photos ?? []).length === 0) {
      Alert.alert("Nie można usunąć", "To Twoje jedyne zdjęcie.");
      return;
    }
    let newPhotoUrl = currentUser.photoUrl;
    let newPhotos = (currentUser.photos ?? []).filter(p => p !== photoUrl);
    if (photoUrl === currentUser.photoUrl) { newPhotoUrl = newPhotos[0]; newPhotos = newPhotos.slice(1); }
    setLoading(true);
    try {
      await updateProfile({ photoUrl: newPhotoUrl, photos: newPhotos });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    finally { setLoading(false); }
  };

  const toggleInterest = (tag: string) => {
    setInterests(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag].slice(0, 5));
    Haptics.selectionAsync();
  };

  return (
    <ScrollView style={[styles.container, { paddingTop: topInset }]} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Profil</Text>
        {editMode === "none" ? (
          <Pressable style={styles.editBtn} onPress={startEdit}>
            <Feather name="edit-2" size={14} color={Colors.accent} />
            <Text style={styles.editBtnText}>Edytuj</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.cancelBtn} onPress={() => setEditMode("none")}>
            <Text style={styles.cancelBtnText}>Anuluj</Text>
          </Pressable>
        )}
      </View>

      {/* Daily reward */}
      {showRewardBanner && !dailyRewardClaimed && (
        <Animated.View entering={FadeInDown} style={styles.rewardBanner}>
          <Text style={styles.rewardBannerIcon}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rewardBannerTitle}>Dzienna nagroda!</Text>
            <Text style={styles.rewardBannerSub}>Zgarnij {50 + loginStreak * 10} monet za dzisiejsze logowanie</Text>
          </View>
          <Pressable style={styles.rewardClaimBtn} onPress={claimDailyReward}>
            <Text style={styles.rewardClaimBtnText}>Odbierz</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <Pressable style={styles.avatarWrap} onPress={handlePickProfilePhoto} disabled={uploadingPhoto}>
          <Image source={{ uri: currentUser.photoUrl }} style={styles.avatar} />
          <View style={styles.avatarEditOverlay}>
            {uploadingPhoto
              ? <ActivityIndicator color="#fff" size="small" />
              : <Feather name="camera" size={16} color="#fff" />}
          </View>
          {isPremium && (
            <View style={styles.premiumRing}>
              <Feather name="zap" size={12} color={Colors.black} />
            </View>
          )}
        </Pressable>
        <View style={styles.profileMeta}>
          <Text style={styles.profileName}>{currentUser.name}, {currentUser.age}</Text>
          {currentUser.username && <Text style={styles.profileUsername}>@{currentUser.username}</Text>}
          {currentUser.city && (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={11} color={Colors.textMuted} />
              <Text style={styles.locationText}>{currentUser.city}</Text>
            </View>
          )}
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Feather name="zap" size={10} color={Colors.black} />
              <Text style={styles.premiumBadgeText}>VIBE+</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>💰</Text>
          <Text style={styles.statValue}>{coins}</Text>
          <Text style={styles.statLabel}>Monety</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🏆</Text>
          <Text style={styles.statValue}>Lvl {profileLevel}</Text>
          <Text style={styles.statLabel}>Poziom</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🔥</Text>
          <Text style={styles.statValue}>{loginStreak}</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
      </View>

      {/* XP bar */}
      <View style={styles.xpSection}>
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>XP do kolejnego poziomu</Text>
          <Text style={styles.xpValue}>{profileXp}/100</Text>
        </View>
        <View style={styles.xpBar}>
          <View style={[styles.xpFill, { width: `${profileXp}%` }]} />
        </View>
      </View>

      {/* Badges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Odznaki</Text>
        <View style={styles.badgesGrid}>
          {BADGES.map((badge) => (
            <View key={badge.id} style={[styles.badgeCard, !badge.unlocked && styles.badgeCardLocked]}>
              <Text style={styles.badgeIcon}>{badge.icon}</Text>
              <Text style={[styles.badgeLabel, !badge.unlocked && styles.badgeLabelLocked]}>{badge.label}</Text>
              <Text style={styles.badgeDesc} numberOfLines={2}>{badge.desc}</Text>
              {!badge.unlocked && <View style={styles.badgeLock}><Feather name="lock" size={10} color={Colors.textMuted} /></View>}
            </View>
          ))}
        </View>
      </View>

      {/* Edit / Bio section */}
      {editMode === "basic" ? (
        <Animated.View entering={FadeIn} style={styles.section}>
          <Text style={styles.sectionTitle}>Edytuj profil</Text>
          <Text style={styles.fieldLabel}>Imię</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Imię..." placeholderTextColor={Colors.textMuted} />
          <Text style={styles.fieldLabel}>Bio</Text>
          <TextInput style={[styles.input, styles.bioInput]} value={bio} onChangeText={setBio} placeholder="Coś o sobie..." placeholderTextColor={Colors.textMuted} multiline maxLength={300} />
          <Text style={styles.fieldLabel}>Miasto</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Skąd jesteś?" placeholderTextColor={Colors.textMuted} />
          <Text style={styles.fieldLabel}>Zainteresowania (max 5)</Text>
          <View style={styles.tagsGrid}>
            {INTERESTS_OPTIONS.map(tag => {
              const active = interests.includes(tag);
              return (
                <Pressable key={tag} style={[styles.tag, active && styles.tagActive]} onPress={() => toggleInterest(tag)}>
                  {active && <Feather name="check" size={10} color={Colors.black} />}
                  <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.black} /> : <><Feather name="check" size={16} color={Colors.black} /><Text style={styles.saveBtnText}>Zapisz zmiany</Text></>}
          </Pressable>
        </Animated.View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.bioDisplay}>{currentUser.bio}</Text>
          {currentUser.interests && currentUser.interests.length > 0 && (
            <View style={styles.tagsRow}>
              {currentUser.interests.map(tag => (
                <View key={tag} style={styles.tagDisplay}>
                  <Text style={styles.tagDisplayText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Gallery */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Galeria zdjęć</Text>
          <Pressable
            style={[styles.addPhotoBtn, uploadingPhoto && { opacity: 0.6 }]}
            onPress={handleAddGalleryPhoto}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto
              ? <ActivityIndicator color={Colors.black} size="small" />
              : <Feather name="plus" size={14} color={Colors.black} />}
            <Text style={styles.addPhotoBtnText}>{uploadingPhoto ? "Wysyłam..." : "Z galerii"}</Text>
          </Pressable>
        </View>
        <Text style={styles.galleryHint}>Dotknij i przytrzymaj zdjęcie, żeby je ustawić jako główne lub usunąć.</Text>
        <View style={styles.galleryGrid}>
          {allPhotos.map((photo, i) => (
            <Animated.View key={photo + i} entering={FadeInDown.delay(i * 40)} style={styles.galleryItemWrap}>
              <Pressable
                style={styles.galleryItem}
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const isMain = photo === currentUser.photoUrl;
                  Alert.alert(
                    isMain ? "Zdjęcie główne" : "Opcje zdjęcia",
                    isMain ? "To jest Twoje zdjęcie profilowe." : "Co chcesz zrobić?",
                    [
                      { text: "Anuluj", style: "cancel" },
                      ...(!isMain ? [{ text: "Ustaw jako główne", onPress: () => handleSetAsMain(photo) }] : []),
                      { text: "Usuń", style: "destructive", onPress: () => handleRemovePhoto(photo) },
                    ]
                  );
                }}
              >
                <Image source={{ uri: photo }} style={styles.galleryPhoto} />
                {photo === currentUser.photoUrl && (
                  <View style={styles.mainPhotoBadge}>
                    <Feather name="star" size={10} color={Colors.black} />
                  </View>
                )}
              </Pressable>
            </Animated.View>
          ))}
          <Pressable
            style={[styles.addPhotoTile, uploadingPhoto && { opacity: 0.5 }]}
            onPress={handleAddGalleryPhoto}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto
              ? <ActivityIndicator color={Colors.textMuted} size="small" />
              : <Feather name="plus" size={24} color={Colors.textMuted} />}
          </Pressable>
        </View>
      </View>

      {/* Premium */}
      {!isPremium && (
        <View style={styles.section}>
          <Pressable style={styles.premiumCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); activatePremium(); }}>
            <View style={styles.premiumCardLeft}>
              <Feather name="zap" size={20} color={Colors.black} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumCardTitle}>VIBE+</Text>
              <Text style={styles.premiumCardSub}>Pełny czat, nieograniczone matche, bez reklam</Text>
            </View>
            <Text style={styles.premiumCardPrice}>24,99 zł/mies.</Text>
          </Pressable>
        </View>
      )}

      {/* Dev tools */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Narzędzia DEV</Text>
        {!isPremium && (
          <Pressable style={styles.devBtn} onPress={async () => { await activatePremium(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}>
            <Feather name="zap" size={14} color={Colors.accent} />
            <Text style={styles.devBtnText}>DEV: Aktywuj Premium</Text>
          </Pressable>
        )}
        <Pressable style={styles.devBtn} onPress={async () => {
          const newCoins = coins + 500;
          setCoins(newCoins);
          await AsyncStorage.setItem(COINS_KEY, String(newCoins));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}>
          <Text style={{ fontSize: 14 }}>💰</Text>
          <Text style={styles.devBtnText}>DEV: +500 monet</Text>
        </Pressable>
        <Pressable style={[styles.devBtn, styles.devBtnDanger]} onPress={() => {
          Alert.alert("Resetuj profil", "Czy na pewno chcesz zresetować konto?", [
            { text: "Anuluj", style: "cancel" },
            { text: "Resetuj", style: "destructive", onPress: async () => { await devReset(); router.replace("/onboarding"); } },
          ]);
        }}>
          <Feather name="trash-2" size={14} color={Colors.danger} />
          <Text style={[styles.devBtnText, { color: Colors.danger }]}>DEV: Resetuj profil</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },
  title: { fontFamily: "Montserrat_700Bold", fontSize: 26, color: Colors.textPrimary },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  editBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.accent },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  cancelBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  rewardBanner: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "rgba(204,255,0,0.1)", borderWidth: 1, borderColor: "rgba(204,255,0,0.3)", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  rewardBannerIcon: { fontSize: 28 },
  rewardBannerTitle: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: Colors.accent },
  rewardBannerSub: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textSecondary },
  rewardClaimBtn: { backgroundColor: Colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  rewardClaimBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: Colors.black },
  avatarSection: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 24, marginBottom: 16 },
  avatarWrap: { position: "relative" },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: Colors.accent },
  avatarEditOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, top: 0, borderRadius: 45, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  premiumRing: { position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.black },
  profileMeta: { flex: 1, gap: 4 },
  profileName: { fontFamily: "Montserrat_700Bold", fontSize: 20, color: Colors.textPrimary },
  profileUsername: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.accent },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textMuted },
  premiumBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  premiumBadgeText: { fontFamily: "Montserrat_700Bold", fontSize: 10, color: Colors.black },
  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: Colors.cardBg, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, alignItems: "center", gap: 4 },
  statIcon: { fontSize: 20 },
  statValue: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: Colors.textPrimary },
  statLabel: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textMuted },
  xpSection: { paddingHorizontal: 16, marginBottom: 16, gap: 6 },
  xpRow: { flexDirection: "row", justifyContent: "space-between" },
  xpLabel: { fontFamily: "Montserrat_500Medium", fontSize: 12, color: Colors.textSecondary },
  xpValue: { fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: Colors.accent },
  xpBar: { height: 6, backgroundColor: Colors.surface, borderRadius: 3, overflow: "hidden" },
  xpFill: { height: "100%", backgroundColor: Colors.accent, borderRadius: 3 },
  section: { paddingHorizontal: 20, marginBottom: 16, gap: 12 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.textPrimary },
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badgeCard: { width: "30%", backgroundColor: Colors.cardBg, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12, alignItems: "center", gap: 4, position: "relative" },
  badgeCardLocked: { opacity: 0.5 },
  badgeIcon: { fontSize: 24 },
  badgeLabel: { fontFamily: "Montserrat_700Bold", fontSize: 11, color: Colors.textPrimary, textAlign: "center" },
  badgeLabelLocked: { color: Colors.textMuted },
  badgeDesc: { fontFamily: "Montserrat_400Regular", fontSize: 9, color: Colors.textMuted, textAlign: "center" },
  badgeLock: { position: "absolute", top: 6, right: 6 },
  bioDisplay: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagDisplay: { backgroundColor: "rgba(204,255,0,0.1)", borderWidth: 1, borderColor: "rgba(204,255,0,0.2)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagDisplayText: { fontFamily: "Montserrat_500Medium", fontSize: 12, color: Colors.accent },
  fieldLabel: { fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: Colors.textMuted, marginBottom: -6 },
  input: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 13, fontFamily: "Montserrat_500Medium", fontSize: 15, color: Colors.textPrimary },
  bioInput: { height: 100, textAlignVertical: "top" },
  tagsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg },
  tagActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tagText: { fontFamily: "Montserrat_500Medium", fontSize: 12, color: Colors.textSecondary },
  tagTextActive: { color: Colors.black },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15 },
  saveBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: Colors.black },
  galleryHint: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textMuted },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  galleryItemWrap: {},
  galleryItem: { width: 100, height: 100, borderRadius: 12, overflow: "hidden", position: "relative" },
  galleryPhoto: { width: "100%", height: "100%" },
  mainPhotoBadge: { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  addPhotoBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  addPhotoBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 12, color: Colors.black },
  addPhotoTile: { width: 100, height: 100, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: Colors.surface },
  premiumCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.accent, borderRadius: 16, padding: 16 },
  premiumCardLeft: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.15)", alignItems: "center", justifyContent: "center" },
  premiumCardTitle: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.black },
  premiumCardSub: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(0,0,0,0.6)" },
  premiumCardPrice: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: Colors.black },
  devBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13 },
  devBtnDanger: { borderColor: "rgba(255,59,92,0.3)" },
  devBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.accent },
});
