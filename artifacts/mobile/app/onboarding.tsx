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
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

const INTERESTS_OPTIONS = [
  "muzyka", "podróże", "sport", "gotowanie", "sztuka", "tech",
  "kino", "literatura", "fitness", "fotografia", "gaming", "yoga",
];
const CITIES = ["Warszawa", "Kraków", "Wrocław", "Poznań", "Gdańsk", "Łódź", "Katowice"];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { register } = useUserContext();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

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

  const canNext = () => {
    if (step === 0) return name.trim().length >= 2 && age.trim().length > 0 && parseInt(age) >= 18 && parseInt(age) <= 80;
    if (step === 1) return username.length >= 3 && usernameStatus === "available";
    if (step === 2) return bio.trim().length >= 20;
    return true;
  };

  const handleNext = () => {
    if (!canNext()) return;
    if (step < 3) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(s => s + 1); }
    else handleRegister();
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ccff00&color=000&size=400&bold=true`;
      await register({ name: name.trim(), username, age: parseInt(age), bio: bio.trim(), photoUrl, photos: [], city: city || undefined, interests });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      Alert.alert("Błąd", (e as Error).message || "Spróbuj ponownie.");
    } finally { setLoading(false); }
  };

  const TOTAL_STEPS = 4;

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
              <Text style={styles.label}>Miasto (opcjonalnie)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tagsRow}>
                  {CITIES.map(c => (
                    <Pressable key={c} style={[styles.tag, city === c && styles.tagActive]} onPress={() => { setCity(c); Haptics.selectionAsync(); }}>
                      <Text style={[styles.tagText, city === c && styles.tagTextActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          )}

          {step === 1 && (
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

          {step === 2 && (
            <Animated.View entering={FadeInDown.springify()} style={styles.stepBox}>
              <Text style={styles.stepTitle}>Twoje bio</Text>
              <Text style={styles.stepSub}>Co chcesz, żeby wiedział o Tobie świat?</Text>
              <Text style={styles.label}>Bio (min. 20 znaków)</Text>
              <TextInput style={[styles.input, styles.bioInput]} placeholder="Napisz coś o sobie..." placeholderTextColor={Colors.textMuted} value={bio} onChangeText={setBio} multiline maxLength={300} autoFocus />
              <Text style={[styles.charCount, bio.length < 20 && { color: Colors.danger }]}>{bio.length}/300</Text>
            </Animated.View>
          )}

          {step === 3 && (
            <Animated.View entering={FadeInDown.springify()} style={styles.stepBox}>
              <Text style={styles.stepTitle}>Zainteresowania</Text>
              <Text style={styles.stepSub}>Wybierz do 5 tagów (opcjonalnie).</Text>
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
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Podsumowanie</Text>
                <Text style={styles.summaryName}>{name}, {age} • @{username}</Text>
                {city ? <Text style={styles.summaryCity}>📍 {city}</Text> : null}
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
          ) : <View style={{ width: 44 }} />}
          <Pressable
            style={[styles.nextBtn, !canNext() && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canNext() || loading}
          >
            {loading ? <ActivityIndicator color={Colors.black} /> : (
              <>
                <Text style={styles.nextBtnText}>{step === 3 ? "Dołącz do VIBE" : "Dalej"}</Text>
                <Feather name={step === 3 ? "zap" : "arrow-right"} size={18} color={Colors.black} />
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
  stepDot: { width: 22, height: 4, borderRadius: 2, backgroundColor: Colors.border },
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
  tagsRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  interestsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg },
  tagActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tagText: { fontFamily: "Montserrat_500Medium", fontSize: 13, color: Colors.textSecondary },
  tagTextActive: { color: Colors.black },
  summaryBox: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 6, marginTop: 8 },
  summaryTitle: { fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  summaryName: { fontFamily: "Montserrat_700Bold", fontSize: 17, color: Colors.textPrimary },
  summaryCity: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary },
  summaryBio: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  nextBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16 },
  nextBtnDisabled: { opacity: 0.35 },
  nextBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.black },
});
