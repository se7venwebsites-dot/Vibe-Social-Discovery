import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Pressable,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

interface MapUser {
  id: number;
  name: string;
  age: number;
  photoUrl: string;
  city?: string | null;
  lat: number;
  lng: number;
  isPremium: boolean;
  lastLocationUpdate?: string | null;
}

interface SelectedPin {
  user: MapUser;
  x: number;
  y: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "teraz";
  if (mins < 60) return `${mins} min temu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  return `${days} dn. temu`;
}

function MapFallback() {
  return (
    <View style={styles.fallback}>
      <Feather name="map" size={48} color={Colors.accent} />
      <Text style={styles.fallbackTitle}>Mapa użytkowników</Text>
      <Text style={styles.fallbackText}>
        Mapa jest dostępna w wersji przeglądarkowej aplikacji.{"\n"}
        Otwórz VIBE w przeglądarce, żeby zobaczyć, skąd są użytkownicy.
      </Text>
    </View>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, isPremium, activatePremium } = useUserContext();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const mapContainerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<MapUser[]>([]);
  const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const pathname = usePathname();
  const router = useRouter();

  const sendLocation = useCallback(async (lat: number, lng: number) => {
    if (!currentUser) return;
    try {
      await fetch(`${BASE_URL}/users/${currentUser.id}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
    } catch {}
  }, [currentUser]);

  const requestGeolocation = useCallback(() => {
    if (Platform.OS !== "web" || !navigator.geolocation) return;
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationStatus("granted");
        sendLocation(pos.coords.latitude, pos.coords.longitude);
        if (mapRef.current) {
          mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 12);
        }
      },
      () => {
        setLocationStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [sendLocation]);

  useEffect(() => {
    if (Platform.OS !== "web" || pathname !== "/map") return;
    requestGeolocation();
  }, [pathname, requestGeolocation]);

  const fetchUsers = useCallback(() => {
    fetch(`${BASE_URL}/users/map${currentUser?.id ? `?currentUserId=${currentUser.id}` : ''}`)
      .then(r => r.json())
      .then(data => setUsers(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (Platform.OS !== "web" || !mapReady || users.length === 0) return;
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    users.forEach(user => {
      if (!user.lat || !user.lng) return;
      const icon = L.divIcon({
        html: `<div style="position:relative;width:44px;height:44px;">
          <img src="${user.photoUrl}" style="width:44px;height:44px;border-radius:50%;border:2px solid ${user.isPremium ? "#CCFF00" : "#555"};object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,0.5);" />
          ${user.isPremium ? '<div style="position:absolute;bottom:0;right:0;width:14px;height:14px;border-radius:50%;background:#CCFF00;display:flex;align-items:center;justify-content:center;border:1px solid #000;font-size:8px;">⚡</div>' : ""}
        </div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        className: "",
      });
      const marker = L.marker([user.lat, user.lng], { icon })
        .addTo(mapRef.current)
        .on("click", (e: any) => {
          const containerRect = document.getElementById("vibe-map")?.getBoundingClientRect();
          if (containerRect) {
            setSelectedPin({
              user,
              x: e.originalEvent.clientX - containerRect.left,
              y: e.originalEvent.clientY - containerRect.top,
            });
          }
        });
      markersRef.current.push(marker);
    });
  }, [users, mapReady]);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const container = document.getElementById("vibe-map");
      if (!container) return;
      const L = (window as any).L;
      const map = L.map("vibe-map", { zoomControl: true }).setView([52.0, 19.5], 6);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
      map.on("click", () => setSelectedPin(null));
    };
    document.head.appendChild(script);

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      link.remove();
    };
  }, []);

  if (Platform.OS !== "web") {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Mapa</Text>
        </View>
        <MapFallback />
      </View>
    );
  }

  if (!isPremium) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Mapa</Text>
        </View>
        <Animated.View entering={FadeIn} style={styles.premiumGate}>
          <View style={styles.premiumGateIcon}>
            <Feather name="map" size={36} color={Colors.black} />
          </View>
          <Text style={styles.premiumGateTitle}>Mapa użytkowników</Text>
          <Text style={styles.premiumGateText}>
            Odkryj, skąd są użytkownicy VIBE. Zobacz, kto jest w Twoim mieście i w okolicy.
            Dostępne tylko dla VIBE+.
          </Text>
          <View style={styles.premiumGateFeatures}>
            {["Widzisz użytkowników na mapie", "Odległość od Ciebie", "Profile bez limitu"].map(f => (
              <View key={f} style={styles.premiumGateFeatureRow}>
                <Feather name="check" size={14} color={Colors.accent} />
                <Text style={styles.premiumGateFeatureText}>{f}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={styles.premiumGateBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); activatePremium(); }}
          >
            <Feather name="zap" size={18} color={Colors.black} />
            <Text style={styles.premiumGateBtnText}>Aktywuj VIBE+</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Mapa</Text>
        <View style={styles.headerRight}>
          {locationStatus === "denied" && (
            <Pressable style={styles.locationDeniedChip} onPress={requestGeolocation}>
              <Feather name="map-pin" size={11} color={Colors.danger} />
              <Text style={styles.locationDeniedText}>Lokalizacja wyłączona</Text>
            </Pressable>
          )}
          <View style={styles.headerBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.headerBadgeText}>{users.length} użytkowników</Text>
          </View>
        </View>
      </View>

      <View style={styles.mapWrapper}>
        {loading && (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={Colors.accent} size="large" />
            <Text style={styles.mapLoadingText}>Ładuję mapę...</Text>
          </View>
        )}
        <View
          nativeID="vibe-map"
          style={styles.mapContainer}
        />

        {selectedPin && (
          <Animated.View
            entering={FadeInDown.springify()}
            style={[styles.pinPopup, {
              left: Math.min(selectedPin.x - 80, 260),
              top: Math.max(selectedPin.y - 200, 10),
            }]}
          >
            <Pressable onPress={() => setSelectedPin(null)} style={styles.pinPopupClose}>
              <Feather name="x" size={14} color={Colors.textMuted} />
            </Pressable>
            <Image source={{ uri: selectedPin.user.photoUrl }} style={styles.pinPopupAvatar} />
            <Text style={styles.pinPopupName}>{selectedPin.user.name}, {selectedPin.user.age}</Text>
            {selectedPin.user.city && (
              <View style={styles.pinPopupCity}>
                <Feather name="map-pin" size={10} color={Colors.textMuted} />
                <Text style={styles.pinPopupCityText}>{selectedPin.user.city}</Text>
              </View>
            )}
            {selectedPin.user.lastLocationUpdate && (
              <View style={styles.pinPopupCity}>
                <Feather name="clock" size={10} color={Colors.textMuted} />
                <Text style={styles.pinPopupCityText}>{timeAgo(selectedPin.user.lastLocationUpdate)}</Text>
              </View>
            )}
            {selectedPin.user.isPremium && (
              <View style={styles.pinPopupPremium}>
                <Feather name="zap" size={10} color={Colors.black} />
                <Text style={styles.pinPopupPremiumText}>VIBE+</Text>
              </View>
            )}
            <Pressable
              style={styles.pinPopupProfileBtn}
              onPress={() => {
                setSelectedPin(null);
                router.push(`/user/${selectedPin.user.id}` as any);
              }}
            >
              <Text style={styles.pinPopupProfileBtnText}>Zobacz profil</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },
  title: { fontFamily: "Montserrat_700Bold", fontSize: 26, color: Colors.textPrimary },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  headerBadgeText: { fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  locationDeniedChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,59,48,0.15)", borderWidth: 1, borderColor: "rgba(255,59,48,0.3)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  locationDeniedText: { fontFamily: "Montserrat_500Medium", fontSize: 11, color: Colors.danger },
  mapWrapper: { flex: 1, position: "relative" },
  mapContainer: { flex: 1, backgroundColor: "#0a0a0a" },
  mapLoading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.7)", zIndex: 10, gap: 12 },
  mapLoadingText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  pinPopup: {
    position: "absolute",
    zIndex: 100,
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    width: 170,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  pinPopupClose: { position: "absolute", top: 8, right: 8, zIndex: 2 },
  pinPopupAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: Colors.accent },
  pinPopupName: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: Colors.textPrimary, textAlign: "center" },
  pinPopupCity: { flexDirection: "row", alignItems: "center", gap: 4 },
  pinPopupCityText: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textMuted },
  pinPopupPremium: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pinPopupPremiumText: { fontFamily: "Montserrat_700Bold", fontSize: 9, color: Colors.black },
  pinPopupProfileBtn: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border, marginTop: 2 },
  pinPopupProfileBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: Colors.accent },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  fallbackTitle: { fontFamily: "Montserrat_700Bold", fontSize: 22, color: Colors.textPrimary },
  fallbackText: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
  premiumGate: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  premiumGateIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  premiumGateTitle: { fontFamily: "Montserrat_700Bold", fontSize: 24, color: Colors.textPrimary, textAlign: "center" },
  premiumGateText: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
  premiumGateFeatures: { width: "100%", gap: 10, backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  premiumGateFeatureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  premiumGateFeatureText: { fontFamily: "Montserrat_500Medium", fontSize: 14, color: Colors.textPrimary },
  premiumGateBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.accent, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, marginTop: 8 },
  premiumGateBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.black },
});
