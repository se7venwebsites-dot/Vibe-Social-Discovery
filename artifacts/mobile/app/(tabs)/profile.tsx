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
  FlatList,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

const INTERESTS_OPTIONS = [
  "muzyka", "podróże", "sport", "gotowanie", "sztuka", "tech",
  "kino", "literatura", "fitness", "fotografia", "gaming", "yoga",
];

type EditMode = "none" | "basic" | "gallery";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, updateProfile, activatePremium, devReset, isPremium } = useUserContext();
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [loading, setLoading] = useState(false);
  const [addPhotoModalVisible, setAddPhotoModalVisible] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  const [name, setName] = useState(currentUser?.name ?? "");
  const [bio, setBio] = useState(currentUser?.bio ?? "");
  const [city, setCity] = useState(currentUser?.city ?? "");
  const [interests, setInterests] = useState<string[]>(currentUser?.interests ?? []);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

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
    if (currentUser.photoUrl !== photoUrl) {
      newPhotos.unshift(currentUser.photoUrl);
    }
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
    if (photoUrl === currentUser.photoUrl) {
      newPhotoUrl = newPhotos[0];
      newPhotos = newPhotos.slice(1);
    }
    setLoading(true);
    try {
      await updateProfile({ photoUrl: newPhotoUrl, photos: newPhotos });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    finally { setLoading(false); }
  };

  const handleAddPhoto = async () => {
    const url = newPhotoUrl.trim();
    if (!url) return;
    const currentPhotos = currentUser.photos ?? [];
    setLoading(true);
    try {
      await updateProfile({ photos: [...currentPhotos, url] });
      setNewPhotoUrl("");
      setAddPhotoModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    finally { setLoading(false); }
  };

  const toggleInterest = (tag: string) => {
    setInterests(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag].slice(0, 5));
    Haptics.selectionAsync();
  };

  return (
    <>
      <ScrollView style={[styles.container, { paddingTop: topInset }]} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
          {editMode === "none" && (
            <Pressable style={styles.editBtn} onPress={startEdit}>
              <Feather name="edit-2" size={14} color={Colors.accent} />
              <Text style={styles.editBtnText}>Edytuj</Text>
            </Pressable>
          )}
          {editMode !== "none" && (
            <Pressable style={styles.cancelBtn} onPress={() => setEditMode("none")}>
              <Text style={styles.cancelBtnText}>Anuluj</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            <Image source={{ uri: currentUser.photoUrl }} style={styles.avatar} />
            {isPremium && (
              <View style={styles.premiumRing}>
                <Feather name="zap" size={12} color={Colors.black} />
              </View>
            )}
          </View>
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

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Galeria zdjęć</Text>
            <Pressable style={styles.addPhotoBtn} onPress={() => setAddPhotoModalVisible(true)}>
              <Feather name="plus" size={14} color={Colors.black} />
              <Text style={styles.addPhotoBtnText}>Dodaj</Text>
            </Pressable>
          </View>
          <Text style={styles.galleryHint}>Dotknij i przytrzymaj, aby ustawić jako profilowe lub usunąć.</Text>
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
            <Pressable style={styles.addPhotoTile} onPress={() => setAddPhotoModalVisible(true)}>
              <Feather name="plus" size={24} color={Colors.textMuted} />
            </Pressable>
          </View>
        </View>

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Narzędzia DEV</Text>
          {!isPremium && (
            <Pressable style={styles.devBtn} onPress={async () => { await activatePremium(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}>
              <Feather name="zap" size={14} color={Colors.accent} />
              <Text style={styles.devBtnText}>DEV: Aktywuj Premium</Text>
            </Pressable>
          )}
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

      <Modal visible={addPhotoModalVisible} transparent animationType="slide" onRequestClose={() => setAddPhotoModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeIn} style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dodaj zdjęcie</Text>
              <Pressable onPress={() => setAddPhotoModalVisible(false)}>
                <Feather name="x" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>Wklej link do zdjęcia (URL)</Text>
            <TextInput
              style={styles.input}
              value={newPhotoUrl}
              onChangeText={setNewPhotoUrl}
              placeholder="https://example.com/photo.jpg"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {newPhotoUrl.trim().length > 0 && (
              <Image source={{ uri: newPhotoUrl.trim() }} style={styles.photoPreview} resizeMode="cover" />
            )}
            <Pressable style={[styles.saveBtn, (!newPhotoUrl.trim() || loading) && { opacity: 0.5 }]} onPress={handleAddPhoto} disabled={!newPhotoUrl.trim() || loading}>
              {loading ? <ActivityIndicator color={Colors.black} /> : <><Feather name="plus" size={16} color={Colors.black} /><Text style={styles.saveBtnText}>Dodaj zdjęcie</Text></>}
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
  title: { fontFamily: "Montserrat_700Bold", fontSize: 26, color: Colors.textPrimary },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  editBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.accent },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  cancelBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  avatarSection: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 24, marginBottom: 16 },
  avatarWrap: { position: "relative" },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: Colors.accent },
  premiumRing: { position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.black },
  profileMeta: { flex: 1, gap: 4 },
  profileName: { fontFamily: "Montserrat_700Bold", fontSize: 20, color: Colors.textPrimary },
  profileUsername: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.accent },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textMuted },
  premiumBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  premiumBadgeText: { fontFamily: "Montserrat_700Bold", fontSize: 10, color: Colors.black },
  section: { paddingHorizontal: 20, marginBottom: 16, gap: 12 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.textPrimary },
  galleryHint: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textMuted },
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
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  galleryItemWrap: {},
  galleryItem: { width: 100, height: 100, borderRadius: 12, overflow: "hidden", position: "relative" },
  galleryPhoto: { width: "100%", height: "100%" },
  mainPhotoBadge: { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  addPhotoBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: Colors.cardBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: Colors.border, gap: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontFamily: "Montserrat_700Bold", fontSize: 20, color: Colors.textPrimary },
  modalSub: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary },
  photoPreview: { width: "100%", height: 180, borderRadius: 12, backgroundColor: Colors.surface },
});
