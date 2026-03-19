import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";
import { VOIVODESHIPS, VOIVODESHIP_NAMES } from "@/constants/poland";

const INTERESTS_OPTIONS = [
  "muzyka", "podróże", "sport", "gotowanie", "sztuka", "tech",
  "kino", "literatura", "fitness", "fotografia", "gaming", "yoga",
];
const TOTAL_STEPS = 6;

const GENDER_OPTIONS = [
  { id: "male", label: "Mężczyzna", icon: "👨" },
  { id: "female", label: "Kobieta", icon: "👩" },
  { id: "other", label: "Inna", icon: "🌈" },
];

async function uploadImageBase64(base64: string, mimeType: string): Promise<string> {
  const uploadUrl = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/upload`
    : "/api/upload";
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mimeType }),
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { register } = useUserContext();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [voivodeship, setVoivodeship] = useState("");
  const [city, setCity] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const toggleInterest = (tag: string) => {
    setInterests(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag].slice(0, 5));
    Haptics.selectionAsync();
  };

  const checkUsername = useCallback(async (raw: string) => {
    const cleaned = raw.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(cleaned);
    if (cleaned.length < 3) { setUsernameStatus("idle"); return; }
    setUsernameStatus("checking");
    try {
      const res = await fetch(`${BASE_URL}/users/check-username/${cleaned}`);
      const data = await res.json();
      setUsernameStatus(data.available ? "available" : "taken");
    } catch {
      setUsernameStatus("idle");
    }
  }, []);

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Brak dostępu", "Zezwól na dostęp do galerii."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadImageBase64(asset.base64, asset.mimeType ?? "image/jpeg");
      setPhotoUrl(url);
      setPhotoPreview(asset.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Błąd", "Nie udało się przesłać zdjęcia.");
    } finally { setUploadingPhoto(false); }
  };

  const canNext = () => {
    if (step === 0) return name.trim().length >= 2 && age.trim().length > 0 && parseInt(age) >= 18 && parseInt(age) <= 80 && gender.length > 0 && acceptedTerms;
    if (step === 1) return voivodeship.length > 0 && city.length > 0;
    if (step === 2) return username.length >= 3 && usernameStatus === "available";
    if (step === 3) return bio.trim().length >= 20;
    if (step === 4) return true;
    if (step === 5) return password.length >= 6 && password === confirmPassword;
    return true;
  };

  const handleNext = () => {
    if (!canNext()) return;
    if (step < TOTAL_STEPS - 1) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(s => s + 1); }
    else handleRegister();
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const finalPhotoUrl = photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ccff00&color=000&size=400&bold=true`;
      await register({
        name: name.trim(),
        username,
        age: parseInt(age),
        bio: bio.trim(),
        photoUrl: finalPhotoUrl,
        photos: [],
        city,
        voivodeship,
        gender,
        interests,
        password,
        acceptedTerms: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      Alert.alert("Błąd rejestracji", (e as Error).message || "Spróbuj ponownie.");
    } finally { setLoading(false); }
  };

  const citiesForVoivodeship = voivodeship ? VOIVODESHIPS[voivodeship] || [] : [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: 8 }]}>
        <Animated.View entering={FadeInDown.springify()} style={styles.header}>
          <Text style={styles.logo}>VIBE</Text>
          <View style={styles.stepsRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={[styles.stepDot, i <= step && styles.stepDotActive]} />
            ))}
          </View>
        </Animated.View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {step === 0 && (
            <Animated.View entering={FadeInDown.springify()} style={styles.stepBox}>
              <Text style={styles.stepTitle}>Kim jesteś?</Text>
              <Text style={styles.stepSub}>Podstawowe informacje o Tobie.</Text>
              <Text style={styles.label}>Imię</Text>
              <TextInput style={styles.input} placeholder="Twoje imię..." placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} maxLength={30} autoFocus />
              <Text style={styles.label}>Wiek</Text>
              <TextInput style={styles.input} placeholder="Ile masz lat?" placeholderTextColor={Colors.textMuted} value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={2} />
              <Text style={styles.label}>Płeć</Text>
              <View style={styles.genderRow}>
                {GENDER_OPTIONS.map(g => (
                  <Pressable
                    key={g.id}
                    style={[styles.genderOption, gender === g.id && styles.genderOptionActive]}
                    onPress={() => { setGender(g.id); Haptics.selectionAsync(); }}
                  >
                    <Text style={styles.genderIcon}>{g.icon}</Text>
                    <Text style={[styles.genderLabel, gender === g.id && styles.genderLabelActive]}>{g.label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.termsRow}>
                <Pressable
                  style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}
                  onPress={() => { setAcceptedTerms(!acceptedTerms); Haptics.selectionAsync(); }}
                >
                  {acceptedTerms && <Feather name="check" size={14} color={Colors.black} />}
                </Pressable>
                <Text style={styles.termsText}>
                  Akceptuję{" "}
                  <Text style={styles.termsLink} onPress={() => router.push("/regulamin" as any)}>Regulamin</Text>
                  {" "}i{" "}
                  <Text style={styles.termsLink} onPress={() => router.push("/polityka-prywatnosci" as any)}>Politykę Prywatności</Text>
                </Text>
              </View>
            </Animated.View>
          )}

          {step === 1 && (
            <Animated.View entering={FadeInDown.springify()} style={styles.stepBox}>
              <Text style={styles.stepTitle}>Skąd jesteś?</Text>
              <Text style={styles.stepSub}>Wybierz województwo, a potem miasto.</Text>
              <Text style={styles.label}>Województwo</Text>
              <ScrollView style={styles.locationList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                <View style={styles.locationGrid}>
                  {VOIVODESHIP_NAMES.map(v => (
                    <Pressable
                      key={v}
                      style={[styles.locationItem, voivodeship === v && styles.locationItemActive]}
                      onPress={() => { setVoivodeship(v); setCity(""); Haptics.selectionAsync(); }}
                    >
                      <Text style={[styles.locationItemText, voivodeship === v && styles.locationItemTextActive]}>{v}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              {voivodeship ? (
                <>
                  <Text style={[styles.label, { marginTop: 12 }]}>Miasto w woj. {voivodeship}</Text>
                  <ScrollView style={styles.cityList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    <View style={styles.locationGrid}>
                      {citiesForVoivodeship.map(c => (
                        <Pressable
                          key={c}
                          style={[styles.locationItem, city === c && styles.locationItemActive]}
                          onPress={() => { setCity(c); Haptics.selectionAsync(); }}
                        >
                          <Text style={[styles.locationItemText, city === c && styles.locationItemTextActive]}>{c}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </>
              ) : null}
            </Animated.View>
          )}

          {step === 2 && (
            <Animated.View entering={FadeInDown.springify()} style={styles.stepBox}>
              <Text style={styles.stepTitle}>Twój nick</Text>
              <Text style={styles.stepSub}>Inni znajdą Cię po tej nazwie.</Text>
              <Text style={styles.label}>Nazwa użytkownika</Text>
              <View style={styles.usernameInputRow}>
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  style={[styles.input, styles.usernameInput, usernameStatus === "taken" && styles.inputError, usernameStatus === "available" && styles.inputSuccess]}
                  placeholder="twojnick"
                  placeholderTextColor={Colors.textMuted}
                  value={username}
                  onChangeText={checkUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  autoFocus
                />
                {usernameStatus === "checking" && <ActivityIndicator color={Colors.accent} size="small" style={styles.usernameIcon} />}
                {usernameStatus === "available" && <Feather name="check-circle" size={20} color="#00DC82" style={styles.usernameIcon} />}
                {usernameStatus === "taken" && <Feather name="x-circle" size={20} color={Colors.danger} style={styles.usernameIcon} />}
              </View>
              {usernameStatus === "taken" && <Text style={styles.errorText}>Ta nazwa jest już zajęta</Text>}
              {usernameStatus === "available" && <Text style={styles.successText}>@{username} jest dostępna!</Text>}
              <Text style={styles.usernameHint}>Tylko litery, cyfry i _ • min. 3 znaki</Text>
            </Animated.View>
          )}

          {step === 3 && (
            <Animated.View entering={FadeInDown.springify()} style={styles.stepBox}>
              <Text style={styles.stepTitle}>Twoje bio</Text>
              <Text style={styles.stepSub}>Co chcesz, żeby wiedział o Tobie świat?</Text>
              <Text style={styles.label}>Bio (min. 20 znaków)</Text>
              <TextInput style={[styles.input, styles.bioInput]} placeholder="Napisz coś o sobie..." placeholderTextColor={Colors.textMuted} value={bio} onChangeText={setBio} multiline maxLength={300} autoFocus />
              <Text style={[styles.charCount, bio.length < 20 && { color: Colors.danger }]}>{bio.length}/300</Text>
            </Animated.View>
          )}

          {step === 4 && (
            <Animated.View entering={FadeInDown.springify()} style={styles.stepBox}>
              <Text style={styles.stepTitle}>Zdjęcie i tagi</Text>
              <Text style={styles.stepSub}>Wybierz zdjęcie profilowe i zainteresowania.</Text>
              <Pressable style={styles.photoPickerBtn} onPress={handlePickPhoto} disabled={uploadingPhoto}>
                {uploadingPhoto
                  ? <ActivityIndicator color={Colors.accent} size="large" />
                  : photoPreview
                  ? <Image source={{ uri: photoPreview }} style={styles.photoPickerPreview} />
                  : <View style={styles.photoPickerEmpty}>
                      <Feather name="camera" size={32} color={Colors.textMuted} />
                      <Text style={styles.photoPickerText}>Wybierz z galerii</Text>
                      <Text style={styles.photoPickerSub}>lub użyj automatycznego avatara</Text>
                    </View>}
                {photoPreview
                  ? <View style={styles.photoPickerOverlay}>
                      <Feather name="camera" size={20} color="#fff" />
                      <Text style={styles.photoPickerChangeText}>Zmień</Text>
                    </View>
                  : null}
              </Pressable>
              <Text style={[styles.label, { marginTop: 8 }]}>Zainteresowania (max 5)</Text>
              <View style={styles.interestsGrid}>
                {INTERESTS_OPTIONS.map(tag => {
                  const active = interests.includes(tag);
                  return (
                    <Pressable key={tag} style={[styles.tag, active && styles.tagActive]} onPress={() => toggleInterest(tag)}>
                      {active && <Feather name="check" size={11} color={Colors.black} />}
                      <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {step === 5 && (
            <Animated.View entering={FadeInDown.springify()} style={styles.stepBox}>
              <Text style={styles.stepTitle}>Ustaw hasło</Text>
              <Text style={styles.stepSub}>Zabezpiecz swoje konto VIBE.</Text>
              <Text style={styles.label}>Hasło (min. 6 znaków)</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Hasło..."
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoFocus
                  maxLength={64}
                />
                <Pressable style={styles.showPassBtn} onPress={() => setShowPass(s => !s)}>
                  <Feather name={showPass ? "eye-off" : "eye"} size={18} color={Colors.textMuted} />
                </Pressable>
              </View>
              <Text style={styles.label}>Powtórz hasło</Text>
              <TextInput
                style={[styles.input, confirmPassword.length > 0 && confirmPassword !== password && styles.inputError, confirmPassword.length > 0 && confirmPassword === password && styles.inputSuccess]}
                placeholder="Powtórz hasło..."
                placeholderTextColor={Colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPass}
                maxLength={64}
              />
              {confirmPassword.length > 0 && confirmPassword !== password && <Text style={styles.errorText}>Hasła nie pasują</Text>}
              {confirmPassword.length > 0 && confirmPassword === password && <Text style={styles.successText}>Hasła pasują ✓</Text>}

              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Podsumowanie</Text>
                <Text style={styles.summaryName}>{name}, {age} • @{username}</Text>
                <Text style={styles.summaryCity}>📍 {city}, {voivodeship}</Text>
                <Text style={styles.summaryGender}>{GENDER_OPTIONS.find(g => g.id === gender)?.icon} {GENDER_OPTIONS.find(g => g.id === gender)?.label}</Text>
                <Text style={styles.summaryBio} numberOfLines={2}>{bio}</Text>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 ? (
            <Pressable style={styles.backBtn} onPress={() => { setStep(s => s - 1); Haptics.selectionAsync(); }}>
              <Feather name="arrow-left" size={20} color={Colors.textSecondary} />
            </Pressable>
          ) : (
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Feather name="arrow-left" size={20} color={Colors.textSecondary} />
            </Pressable>
          )}
          <Pressable
            style={[styles.nextBtn, (!canNext() || loading) && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canNext() || loading}
          >
            {loading ? <ActivityIndicator color={Colors.black} /> : (
              <>
                <Text style={styles.nextBtnText}>{step === TOTAL_STEPS - 1 ? "Dołącz do VIBE" : "Dalej"}</Text>
                <Feather name={step === TOTAL_STEPS - 1 ? "zap" : "arrow-right"} size={18} color={Colors.black} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: { paddingHorizontal: 24, paddingBottom: 8, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { fontFamily: "Montserrat_700Bold", fontSize: 28, color: Colors.accent, letterSpacing: 4 },
  stepsRow: { flexDirection: "row", gap: 6 },
  stepDot: { width: 14, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.accent },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  stepBox: { gap: 12, paddingTop: 16 },
  stepTitle: { fontFamily: "Montserrat_700Bold", fontSize: 28, color: Colors.textPrimary },
  stepSub: { fontFamily: "Montserrat_400Regular", fontSize: 15, color: Colors.textSecondary, marginBottom: 8 },
  label: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.textSecondary, letterSpacing: 0.5, marginBottom: -4 },
  input: { backgroundColor: Colors.cardBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 14, fontFamily: "Montserrat_500Medium", fontSize: 16, color: Colors.textPrimary },
  bioInput: { height: 140, textAlignVertical: "top" },
  inputError: { borderColor: Colors.danger },
  inputSuccess: { borderColor: "#00DC82" },
  charCount: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textMuted, textAlign: "right" },
  usernameInputRow: { flexDirection: "row", alignItems: "center", gap: 0 },
  atSign: { fontFamily: "Montserrat_700Bold", fontSize: 20, color: Colors.accent, paddingRight: 6 },
  usernameInput: { flex: 1 },
  usernameIcon: { marginLeft: 8 },
  errorText: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.danger },
  successText: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: "#00DC82" },
  usernameHint: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textMuted },
  interestsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg },
  tagActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tagText: { fontFamily: "Montserrat_500Medium", fontSize: 13, color: Colors.textSecondary },
  tagTextActive: { color: Colors.black },
  photoPickerBtn: { width: "100%", height: 200, borderRadius: 20, overflow: "hidden", backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  photoPickerEmpty: { alignItems: "center", gap: 8 },
  photoPickerText: { fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: Colors.textSecondary },
  photoPickerSub: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textMuted },
  photoPickerPreview: { width: "100%", height: "100%", resizeMode: "cover" },
  photoPickerOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10 },
  photoPickerChangeText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#fff" },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 0 },
  showPassBtn: { position: "absolute", right: 14, padding: 4 },
  summaryBox: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 6, marginTop: 8 },
  summaryTitle: { fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  summaryName: { fontFamily: "Montserrat_700Bold", fontSize: 17, color: Colors.textPrimary },
  summaryCity: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary },
  summaryGender: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary },
  summaryBio: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  nextBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16 },
  nextBtnDisabled: { opacity: 0.35 },
  nextBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.black },
  genderRow: { flexDirection: "row", gap: 10 },
  genderOption: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg },
  genderOptionActive: { borderColor: Colors.accent, backgroundColor: "rgba(204,255,0,0.1)" },
  genderIcon: { fontSize: 28 },
  genderLabel: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.textSecondary },
  genderLabelActive: { color: Colors.accent },
  locationList: { maxHeight: 180 },
  cityList: { maxHeight: 160 },
  locationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 4 },
  locationItem: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg },
  locationItemActive: { borderColor: Colors.accent, backgroundColor: "rgba(204,255,0,0.1)" },
  locationItemText: { fontFamily: "Montserrat_500Medium", fontSize: 13, color: Colors.textSecondary },
  locationItemTextActive: { color: Colors.accent },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  termsText: { flex: 1, fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  termsLink: { color: Colors.accent, fontFamily: "Montserrat_600SemiBold", textDecorationLine: "underline" },
});
