import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

export default function PolitykaPrywatnosciScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.push("/")}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Polityka Prywatności</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Ostatnia aktualizacja: 19 marca 2026</Text>

        <Text style={styles.heading}>1. Administrator danych</Text>
        <Text style={styles.body}>Administratorem danych osobowych jest VIBE App. Kontakt: kontakt@vibe-app.pl</Text>

        <Text style={styles.heading}>2. Jakie dane zbieramy</Text>
        <Text style={styles.body}>2.1. Dane podane podczas rejestracji: imię, wiek, płeć, lokalizacja (województwo, miasto), nazwa użytkownika, zdjęcie profilowe, zainteresowania, opis profilu.{"\n"}2.2. Dane techniczne: adres IP, typ urządzenia, system operacyjny, identyfikator urządzenia.{"\n"}2.3. Dane o aktywności: historia dopasowań, wiadomości, lajki, blokady, zgłoszenia.{"\n"}2.4. Dane lokalizacyjne: przybliżona lokalizacja na podstawie wybranego miasta.{"\n"}2.5. Token powiadomień push (jeśli wyrażono zgodę).</Text>

        <Text style={styles.heading}>3. Cele przetwarzania</Text>
        <Text style={styles.body}>3.1. Świadczenie usług Aplikacji (dopasowywanie, czat, wideo).{"\n"}3.2. Zapewnienie bezpieczeństwa i moderacja treści.{"\n"}3.3. Wysyłanie powiadomień push o nowych wiadomościach i dopasowaniach.{"\n"}3.4. Ulepszanie Aplikacji na podstawie anonimowych statystyk.{"\n"}3.5. Obsługa płatności i subskrypcji.</Text>

        <Text style={styles.heading}>4. Podstawy prawne</Text>
        <Text style={styles.body}>4.1. Zgoda użytkownika (art. 6 ust. 1 lit. a RODO).{"\n"}4.2. Wykonanie umowy (art. 6 ust. 1 lit. b RODO).{"\n"}4.3. Prawnie uzasadniony interes administratora (art. 6 ust. 1 lit. f RODO).</Text>

        <Text style={styles.heading}>5. Udostępnianie danych</Text>
        <Text style={styles.body}>5.1. Dane profilu (imię, wiek, zdjęcie, bio, zainteresowania) są widoczne dla innych użytkowników.{"\n"}5.2. Nie sprzedajemy danych osobom trzecim.{"\n"}5.3. Możemy udostępnić dane organom ścigania na podstawie obowiązujących przepisów prawa.{"\n"}5.4. Korzystamy z dostawców usług (hosting, płatności), którzy przetwarzają dane w naszym imieniu.</Text>

        <Text style={styles.heading}>6. Okres przechowywania</Text>
        <Text style={styles.body}>6.1. Dane konta przechowujemy przez czas korzystania z Aplikacji.{"\n"}6.2. Po usunięciu konta dane są usuwane w ciągu 30 dni.{"\n"}6.3. Stories są automatycznie usuwane po 24 godzinach.{"\n"}6.4. Zgłoszenia i blokady przechowujemy przez 12 miesięcy.</Text>

        <Text style={styles.heading}>7. Prawa użytkownika</Text>
        <Text style={styles.body}>Zgodnie z RODO przysługuje Ci prawo do:{"\n"}- dostępu do swoich danych,{"\n"}- sprostowania danych,{"\n"}- usunięcia danych ("prawo do bycia zapomnianym"),{"\n"}- ograniczenia przetwarzania,{"\n"}- przenoszenia danych,{"\n"}- sprzeciwu wobec przetwarzania,{"\n"}- cofnięcia zgody w dowolnym momencie.{"\n\n"}Aby skorzystać z powyższych praw, napisz na: kontakt@vibe-app.pl</Text>

        <Text style={styles.heading}>8. Bezpieczeństwo</Text>
        <Text style={styles.body}>8.1. Hasła są przechowywane w formie zahashowanej (PBKDF2 z solą).{"\n"}8.2. Komunikacja P2P (wideo) jest szyfrowana.{"\n"}8.3. Stosujemy zabezpieczenia przed nieautoryzowanym dostępem do danych.</Text>

        <Text style={styles.heading}>9. Pliki cookies</Text>
        <Text style={styles.body}>Aplikacja mobilna nie wykorzystuje plików cookies. Wersja webowa może używać localStorage do przechowywania sesji użytkownika.</Text>

        <Text style={styles.heading}>10. Zmiany polityki</Text>
        <Text style={styles.body}>O istotnych zmianach polityki prywatności informujemy użytkowników w Aplikacji. Dalsze korzystanie oznacza akceptację zmian.</Text>

        <Text style={styles.heading}>11. Kontakt</Text>
        <Text style={styles.body}>W sprawach dotyczących ochrony danych osobowych prosimy o kontakt: kontakt@vibe-app.pl</Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: Colors.textPrimary },
  content: { paddingHorizontal: 24, paddingTop: 20 },
  updated: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textMuted, marginBottom: 20 },
  heading: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.accent, marginTop: 24, marginBottom: 8 },
  body: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
});
