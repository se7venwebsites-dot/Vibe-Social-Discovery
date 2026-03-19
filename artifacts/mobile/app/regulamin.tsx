import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

export default function RegulaminScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Regulamin VIBE</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Ostatnia aktualizacja: 19 marca 2026</Text>

        <Text style={styles.heading}>1. Postanowienia ogólne</Text>
        <Text style={styles.body}>Niniejszy Regulamin określa zasady korzystania z aplikacji mobilnej VIBE (dalej "Aplikacja"). Korzystając z Aplikacji, akceptujesz poniższe warunki w całości.</Text>

        <Text style={styles.heading}>2. Warunki korzystania</Text>
        <Text style={styles.body}>2.1. Aplikacja jest przeznaczona dla osób, które ukończyły 18 lat.{"\n"}2.2. Użytkownik zobowiązuje się do podawania prawdziwych danych osobowych.{"\n"}2.3. Każdy użytkownik może posiadać tylko jedno konto.{"\n"}2.4. Zabrania się udostępniania konta osobom trzecim.</Text>

        <Text style={styles.heading}>3. Konto użytkownika</Text>
        <Text style={styles.body}>3.1. Rejestracja wymaga podania imienia, wieku, płci, lokalizacji, nazwy użytkownika i hasła.{"\n"}3.2. Użytkownik jest odpowiedzialny za bezpieczeństwo swojego hasła.{"\n"}3.3. Zastrzegamy sobie prawo do usunięcia konta naruszającego Regulamin.</Text>

        <Text style={styles.heading}>4. Zasady zachowania</Text>
        <Text style={styles.body}>4.1. Zabrania się publikowania treści obraźliwych, pornograficznych, rasistowskich lub niezgodnych z prawem.{"\n"}4.2. Zabrania się nękania, zastraszania lub molestowania innych użytkowników.{"\n"}4.3. Zabrania się wysyłania spamu, reklam lub treści komercyjnych bez zgody administracji.{"\n"}4.4. Zabrania się podszywania się pod inne osoby.{"\n"}4.5. Zabrania się nagrywania rozmów wideo bez zgody drugiej strony.</Text>

        <Text style={styles.heading}>5. Funkcje Premium (VIBE+)</Text>
        <Text style={styles.body}>5.1. VIBE+ to płatna subskrypcja dająca dostęp do dodatkowych funkcji.{"\n"}5.2. Cena subskrypcji wynosi 24,99 PLN/tydzień.{"\n"}5.3. Subskrypcja odnawia się automatycznie, chyba że zostanie anulowana.{"\n"}5.4. Zwroty są możliwe zgodnie z polityką sklepu Google Play / Apple App Store.</Text>

        <Text style={styles.heading}>6. Ulepszenia (Boosty)</Text>
        <Text style={styles.body}>6.1. Ulepszenia to jednorazowe zakupy wpływające na widoczność profilu.{"\n"}6.2. Zakupione ulepszenia nie podlegają zwrotowi.{"\n"}6.3. Wszystkie zakupy w aplikacji są symulowane w wersji testowej.</Text>

        <Text style={styles.heading}>7. System zgłoszeń i blokowania</Text>
        <Text style={styles.body}>7.1. Każdy użytkownik może zgłosić innego użytkownika za naruszenie Regulaminu.{"\n"}7.2. Zgłoszenia są rozpatrywane przez administrację w ciągu 48 godzin.{"\n"}7.3. Zablokowany użytkownik nie będzie mógł kontaktować się z Tobą.{"\n"}7.4. Wielokrotne naruszenia mogą skutkować permanentnym banem.</Text>

        <Text style={styles.heading}>8. Odpowiedzialność</Text>
        <Text style={styles.body}>8.1. VIBE nie ponosi odpowiedzialności za treści publikowane przez użytkowników.{"\n"}8.2. VIBE nie gwarantuje ciągłości działania Aplikacji.{"\n"}8.3. Użytkownik korzysta z Aplikacji na własne ryzyko.{"\n"}8.4. VIBE nie ponosi odpowiedzialności za spotkania offline inicjowane przez Aplikację.</Text>

        <Text style={styles.heading}>9. Własność intelektualna</Text>
        <Text style={styles.body}>9.1. Wszelkie prawa do Aplikacji, jej nazwy, logo i designu należą do twórców VIBE.{"\n"}9.2. Użytkownik zachowuje prawa do treści, które publikuje, udzielając VIBE licencji na ich wyświetlanie w Aplikacji.</Text>

        <Text style={styles.heading}>10. Zmiany Regulaminu</Text>
        <Text style={styles.body}>10.1. VIBE zastrzega sobie prawo do zmian niniejszego Regulaminu.{"\n"}10.2. O istotnych zmianach użytkownicy zostaną powiadomieni w Aplikacji.{"\n"}10.3. Dalsze korzystanie z Aplikacji po zmianach oznacza akceptację nowego Regulaminu.</Text>

        <Text style={styles.heading}>11. Kontakt</Text>
        <Text style={styles.body}>W sprawach związanych z Regulaminem prosimy o kontakt: kontakt@vibe-app.pl</Text>

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
