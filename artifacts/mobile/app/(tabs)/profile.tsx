import React, { useState } from "react";
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
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext } from "@/context/UserContext";

const INTERESTS_OPTIONS = [
  "muzyka", "podróże", "sport", "gotowanie", "sztuka", "tech",
  "kino", "literatura", "fitness", "fotografia", "gaming", "yoga",
];

const CITIES = ["Warszawa", "Kraków", "Wrocław", "Poznań", "Gdańsk", "Łódź", "Katowice"];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, isPremium, updateProfile, activatePremium, devReset } = useUserContext();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const [name, setName] = useState(currentUser?.name ?? "");
  const [age, setAge] = useState(String(currentUser?.age ?? ""));
  const [bio, setBio] = useState(currentUser?.bio ?? "");
  const [city, setCity] = useState(currentUser?.city ?? "");
  const [interests, setInterests] = useState<string[]>(currentUser?.interests ?? []);

  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 5)
    );
    Haptics.selectionAsync();
  };

  const handleEdit = () => {
    setName(currentUser?.name ?? "");
    setAge(String(currentUser?.age ?? ""));
    setBio(currentUser?.bio ?? "");
    setCity(currentUser?.city ?? "");
    setInterests(currentUser?.interests ?? []);
    setEditing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = async () => {
    const ageNum = parseInt(age);
    if (!name.trim() || isNaN(ageNum) || !bio.trim()) {
      Alert.alert("Błąd", "Wypełnij poprawnie imię, wiek i bio.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), age: ageNum, bio: bio.trim(), city: city || undefined, interests });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(false);
    } catch {
      Alert.alert("Błąd", "Nie udało się zapisać zmian.");
    } finally {
      setSaving(false);
    }
  };

  const handleDevReset = () => {
    Alert.alert(
      "DEV: Reset profilu",
      "Czy na pewno chcesz zresetować profil? Zostaniesz przeniesiony do ekranu rejestracji.",
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await devReset();
            router.replace("/onboarding");
          },
        },
      ]
    );
  };

  if (!currentUser) return null;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Profil</Text>
        {!editing ? (
          <Pressable style={styles.editBtn} onPress={handleEdit}>
            <Feather name="edit-2" size={16} color={Colors.accent} />
            <Text style={styles.editBtnText}>Edytuj</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.black} size="small" />
            ) : (
              <>
                <Feather name="check" size={16} color={Colors.black} />
                <Text style={styles.saveBtnText}>Zapisz</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={styles.avatarSection}>
          <Image source={{ uri: currentUser.photoUrl }} style={styles.avatar} />
          <View style={styles.nameBadge}>
            {isPremium ? (
              <View style={styles.premiumTag}>
                <Feather name="zap" size={11} color={Colors.black} />
                <Text style={styles.premiumTagText}>VIBE+</Text>
              </View>
            ) : null}
            <Text style={styles.profileName}>{currentUser.name}, {currentUser.age}</Text>
            {currentUser.city ? (
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={12} color={Colors.textMuted} />
                <Text style={styles.locationText}>{currentUser.city}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {!editing ? (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardLabel}>Bio</Text>
              <Text style={styles.infoCardValue}>{currentUser.bio}</Text>
            </View>

            {currentUser.interests && currentUser.interests.length > 0 ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoCardLabel}>Zainteresowania</Text>
                <View style={styles.tagsRow}>
                  {currentUser.interests.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {!isPremium && (
              <Animated.View entering={FadeInDown.delay(200)} style={styles.premiumCard}>
                <View style={styles.premiumIconWrap}>
                  <Feather name="zap" size={24} color={Colors.black} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.premiumCardTitle}>Odblokuj VIBE+</Text>
                  <Text style={styles.premiumCardSub}>
                    Nieograniczone lajki, widoczność kto Cię polubia i pełen czat.
                  </Text>
                </View>
                <Pressable
                  style={styles.premiumUpgradeBtn}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowPremiumModal(true); }}
                >
                  <Text style={styles.premiumUpgradeBtnText}>24,99 PLN</Text>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.springify()} style={styles.editSection}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Imię</Text>
              <TextInput
                style={styles.fieldInput}
                value={name}
                onChangeText={setName}
                placeholderTextColor={Colors.textMuted}
                maxLength={30}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Wiek</Text>
              <TextInput
                style={styles.fieldInput}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                maxLength={2}
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Miasto</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.cityRow}>
                  {CITIES.map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.cityTag, city === c && styles.cityTagActive]}
                      onPress={() => { setCity(c); Haptics.selectionAsync(); }}
                    >
                      <Text style={[styles.cityTagText, city === c && styles.cityTagTextActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Bio</Text>
              <TextInput
                style={[styles.fieldInput, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={300}
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.charCount}>{bio.length}/300</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Zainteresowania (max 5)</Text>
              <View style={styles.tagsGrid}>
                {INTERESTS_OPTIONS.map((tag) => {
                  const active = interests.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      style={[styles.interestTag, active && styles.interestTagActive]}
                      onPress={() => toggleInterest(tag)}
                    >
                      {active && <Feather name="check" size={11} color={Colors.black} />}
                      <Text style={[styles.interestTagText, active && styles.interestTagTextActive]}>{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              style={styles.cancelBtn}
              onPress={() => { setEditing(false); Haptics.selectionAsync(); }}
            >
              <Text style={styles.cancelBtnText}>Anuluj zmiany</Text>
            </Pressable>
          </Animated.View>
        )}

        <View style={styles.devSection}>
          <Text style={styles.devLabel}>DEV</Text>
          <Pressable
            style={styles.devBtn}
            onPress={async () => {
              await activatePremium();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          >
            <Feather name="zap" size={14} color={Colors.accent} />
            <Text style={styles.devBtnText}>DEV: Aktywuj Premium</Text>
          </Pressable>
          <Pressable style={styles.devResetBtn} onPress={handleDevReset}>
            <Feather name="trash-2" size={14} color={Colors.danger} />
            <Text style={styles.devResetBtnText}>DEV: Resetuj profil</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={showPremiumModal} transparent animationType="slide" onRequestClose={() => setShowPremiumModal(false)}>
        <View style={styles.premiumModalOverlay}>
          <Animated.View entering={FadeIn.duration(180)} style={styles.premiumModalBox}>
            <Pressable style={styles.premiumModalClose} onPress={() => setShowPremiumModal(false)}>
              <Feather name="x" size={20} color={Colors.textSecondary} />
            </Pressable>
            <View style={styles.premiumModalIconWrap}>
              <Feather name="zap" size={30} color={Colors.black} />
            </View>
            <Text style={styles.premiumModalTitle}>VIBE+</Text>
            <Text style={styles.premiumModalSub}>Odblokuj pełne możliwości aplikacji i zacznij nawiązywać realne połączenia.</Text>
            <View style={{ gap: 8, width: "100%" }}>
              {["✓ Widzisz kto Cię polubił", "✓ Pełny czat z dopasowaniami", "✓ Nieograniczone funkcje"].map((b) => (
                <Text key={b} style={styles.benefitText}>{b}</Text>
              ))}
            </View>
            <Text style={styles.premiumModalPrice}>24,99 PLN / tydzień</Text>
            <Pressable
              style={({ pressed }) => [styles.premiumModalBtn, pressed && { opacity: 0.85 }]}
              onPress={async () => {
                await activatePremium();
                setShowPremiumModal(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}
            >
              <Feather name="zap" size={16} color={Colors.black} />
              <Text style={styles.premiumModalBtnText}>Odblokuj VIBE+</Text>
            </Pressable>
            <Text style={styles.premiumModalNote}>Zakup jest symulowany.</Text>
          </Animated.View>
        </View>
      </Modal>
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
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  editBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.accent },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: Colors.black },
  content: { paddingHorizontal: 20, gap: 20, paddingTop: 8 },
  avatarSection: { alignItems: "center", gap: 14 },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: Colors.accent, backgroundColor: Colors.surface },
  nameBadge: { alignItems: "center", gap: 6 },
  premiumTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  premiumTagText: { fontFamily: "Montserrat_700Bold", fontSize: 10, color: Colors.black },
  profileName: { fontFamily: "Montserrat_700Bold", fontSize: 24, color: Colors.textPrimary },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textMuted },
  infoSection: { gap: 14 },
  infoCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  infoCardLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoCardValue: { fontFamily: "Montserrat_400Regular", fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: "rgba(204,255,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.2)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: { fontFamily: "Montserrat_500Medium", fontSize: 12, color: Colors.accent },
  premiumCard: {
    backgroundColor: "rgba(204,255,0,0.06)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.2)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  premiumIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  premiumCardTitle: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: Colors.textPrimary, marginBottom: 3 },
  premiumCardSub: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  premiumUpgradeBtn: { backgroundColor: Colors.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  premiumUpgradeBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 12, color: Colors.black },
  editSection: { gap: 18 },
  field: { gap: 8 },
  fieldLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: "Montserrat_500Medium",
    fontSize: 15,
    color: Colors.textPrimary,
  },
  bioInput: { height: 120, textAlignVertical: "top" },
  charCount: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  cityRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  cityTag: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg,
  },
  cityTagActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  cityTagText: { fontFamily: "Montserrat_500Medium", fontSize: 13, color: Colors.textSecondary },
  cityTagTextActive: { color: Colors.black },
  tagsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interestTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg,
  },
  interestTagActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  interestTagText: { fontFamily: "Montserrat_500Medium", fontSize: 13, color: Colors.textSecondary },
  interestTagTextActive: { color: Colors.black },
  cancelBtn: {
    alignItems: "center", paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
  },
  cancelBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  devSection: {
    marginTop: 12,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  devLabel: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  devBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(204,255,0,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.2)",
  },
  devBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.accent },
  devResetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,59,92,0.06)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(255,59,92,0.15)",
  },
  devResetBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.danger },
  premiumModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  premiumModalBox: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 44,
    borderTopWidth: 1, borderColor: Colors.border,
    gap: 12, alignItems: "center",
  },
  premiumModalClose: { position: "absolute", top: 16, right: 20, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  premiumModalIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  premiumModalTitle: { fontFamily: "Montserrat_700Bold", fontSize: 28, color: Colors.textPrimary },
  premiumModalSub: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
  benefitText: { fontFamily: "Montserrat_500Medium", fontSize: 14, color: Colors.textPrimary },
  premiumModalPrice: { fontFamily: "Montserrat_700Bold", fontSize: 26, color: Colors.accent },
  premiumModalBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 28, paddingVertical: 16,
    borderRadius: 14, marginTop: 4, width: "100%", justifyContent: "center",
  },
  premiumModalBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.black },
  premiumModalNote: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textMuted },
});
