import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext } from "@/context/UserContext";

type Mode = "landing" | "login";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useUserContext();
  const [mode, setMode] = useState<Mode>("landing");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Błąd", "Wpisz nazwę użytkownika i hasło.");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      Alert.alert("Błąd logowania", (e as Error).message || "Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={[styles.container, { paddingTop: topInset }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.springify()} style={styles.logoSection}>
          <Text style={styles.logo}>VIBE</Text>
          <Text style={styles.tagline}>Poznaj. Rozmawiaj. Połącz się.</Text>
        </Animated.View>

        {mode === "landing" && (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.landingButtons}>
            <View style={styles.featureRow}>
              {[
                { icon: "zap", label: "Swipe & Match" },
                { icon: "video", label: "Video chat" },
                { icon: "radio", label: "Live stream" },
                { icon: "map-pin", label: "Mapa" },
              ].map(f => (
                <View key={f.icon} style={styles.featureItem}>
                  <Feather name={f.icon as any} size={22} color={Colors.accent} />
                  <Text style={styles.featureLabel}>{f.label}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={styles.primaryBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/onboarding"); }}
            >
              <Feather name="zap" size={18} color={Colors.black} />
              <Text style={styles.primaryBtnText}>Utwórz konto</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode("login"); }}
            >
              <Text style={styles.secondaryBtnText}>Mam już konto — Zaloguj się</Text>
            </Pressable>
          </Animated.View>
        )}

        {mode === "login" && (
          <Animated.View entering={FadeIn} style={styles.loginForm}>
            <Pressable style={styles.backRow} onPress={() => setMode("landing")}>
              <Feather name="arrow-left" size={18} color={Colors.textSecondary} />
              <Text style={styles.backText}>Wróć</Text>
            </Pressable>

            <Text style={styles.formTitle}>Zaloguj się</Text>
            <Text style={styles.formSub}>Wpisz swój @nick i hasło</Text>

            <View style={styles.inputWrap}>
              <Text style={styles.atPrefix}>@</Text>
              <TextInput
                style={styles.inputWithPrefix}
                placeholder="twojnick"
                placeholderTextColor={Colors.textMuted}
                value={username}
                onChangeText={t => setUsername(t.replace(/^@/, "").toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            </View>

            <View style={styles.inputWrap}>
              <Feather name="lock" size={16} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.inputWithPrefix}
                placeholder="Hasło"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <Pressable onPress={() => setShowPass(s => !s)} style={styles.showPassBtn}>
                <Feather name={showPass ? "eye-off" : "eye"} size={16} color={Colors.textMuted} />
              </Pressable>
            </View>

            <Pressable
              style={[styles.primaryBtn, { marginTop: 8 }, (loading || !username || !password) && { opacity: 0.5 }]}
              onPress={handleLogin}
              disabled={loading || !username.trim() || !password.trim()}
            >
              {loading
                ? <ActivityIndicator color={Colors.black} />
                : <><Feather name="log-in" size={18} color={Colors.black} /><Text style={styles.primaryBtnText}>Zaloguj się</Text></>}
            </Pressable>

            <Pressable onPress={() => { router.push("/onboarding"); }} style={styles.registerLink}>
              <Text style={styles.registerLinkText}>Nie masz konta? <Text style={{ color: Colors.accent }}>Zarejestruj się</Text></Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 },
  logoSection: { alignItems: "center", paddingTop: 60, paddingBottom: 40, gap: 10 },
  logo: { fontFamily: "Montserrat_700Bold", fontSize: 52, color: Colors.accent, letterSpacing: 8 },
  tagline: { fontFamily: "Montserrat_400Regular", fontSize: 15, color: Colors.textSecondary, textAlign: "center" },
  featureRow: { flexDirection: "row", justifyContent: "center", gap: 28, paddingVertical: 20, flexWrap: "wrap" },
  featureItem: { alignItems: "center", gap: 6 },
  featureLabel: { fontFamily: "Montserrat_500Medium", fontSize: 11, color: Colors.textMuted },
  landingButtons: { gap: 14 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 17 },
  primaryBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 17, color: Colors.black },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingVertical: 15 },
  secondaryBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: Colors.textSecondary },
  loginForm: { gap: 14 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8 },
  backText: { fontFamily: "Montserrat_500Medium", fontSize: 14, color: Colors.textSecondary },
  formTitle: { fontFamily: "Montserrat_700Bold", fontSize: 28, color: Colors.textPrimary },
  formSub: { fontFamily: "Montserrat_400Regular", fontSize: 15, color: Colors.textSecondary, marginBottom: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.cardBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14 },
  atPrefix: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: Colors.accent, marginRight: 4 },
  inputIcon: { marginRight: 8 },
  inputWithPrefix: { flex: 1, paddingVertical: 14, fontFamily: "Montserrat_500Medium", fontSize: 16, color: Colors.textPrimary },
  showPassBtn: { padding: 8 },
  registerLink: { alignItems: "center", paddingTop: 8 },
  registerLinkText: { fontFamily: "Montserrat_500Medium", fontSize: 14, color: Colors.textMuted },
});
