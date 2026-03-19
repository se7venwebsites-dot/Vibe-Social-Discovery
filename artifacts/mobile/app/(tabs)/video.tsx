import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext } from "@/context/UserContext";

const WS_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `wss://${process.env.EXPO_PUBLIC_DOMAIN}/api/ws`
  : `ws://localhost:8080/ws`;

const CITIES_OPTIONS = ["all", "Warszawa", "Kraków", "Wrocław", "Poznań", "Gdańsk", "Łódź", "Katowice"];

const CAM_FILTERS = [
  { id: "none", label: "Normalny", css: "" },
  { id: "beauty", label: "Beauty", css: "brightness(108%) contrast(95%) saturate(115%)" },
  { id: "bw", label: "B&W", css: "grayscale(100%)" },
  { id: "sepia", label: "Sepia", css: "sepia(80%)" },
  { id: "cool", label: "Chłodny", css: "hue-rotate(190deg) saturate(140%) brightness(105%)" },
  { id: "warm", label: "Ciepły", css: "hue-rotate(20deg) saturate(160%) brightness(108%)" },
  { id: "vivid", label: "Żywy", css: "saturate(220%) contrast(115%)" },
  { id: "neon", label: "Neon", css: "saturate(300%) contrast(120%) brightness(88%) hue-rotate(100deg)" },
  { id: "vintage", label: "Vintage", css: "sepia(40%) saturate(80%) contrast(90%) brightness(95%)" },
  { id: "fade", label: "Fade", css: "saturate(60%) contrast(80%) brightness(118%)" },
  { id: "film", label: "Film", css: "grayscale(25%) contrast(112%) brightness(95%) sepia(15%)" },
  { id: "glam", label: "Glam", css: "brightness(115%) contrast(105%) saturate(130%) hue-rotate(340deg)" },
];

type Status = "idle" | "requesting-camera" | "waiting" | "connected" | "error";

interface PartnerInfo {
  name?: string;
  age?: number;
  city?: string;
}

function NotWebFallback() {
  return (
    <View style={styles.fallback}>
      <Feather name="monitor" size={48} color={Colors.accent} />
      <Text style={styles.fallbackTitle}>Tylko w przeglądarce</Text>
      <Text style={styles.fallbackText}>
        Funkcja wideo czatu działa w wersji webowej aplikacji.
        Otwórz VIBE w przeglądarce, żeby korzystać z połączeń na kamerce.
      </Text>
    </View>
  );
}

export default function VideoScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser } = useUserContext();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const [status, setStatus] = useState<Status>("idle");
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterAgeMin, setFilterAgeMin] = useState(18);
  const [filterAgeMax, setFilterAgeMax] = useState(40);
  const [filterCity, setFilterCity] = useState("all");

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isInitiatorRef = useRef(false);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const [activeCamFilter, setActiveCamFilter] = useState("none");
  const [showCamFilters, setShowCamFilters] = useState(false);

  const applyFilter = useCallback((filterId: string) => {
    setActiveCamFilter(filterId);
    if (Platform.OS !== "web") return;
    const container = document.getElementById("vibe-local-video");
    const video = container?.querySelector("video") as HTMLVideoElement | null;
    if (video) {
      const filter = CAM_FILTERS.find(f => f.id === filterId);
      video.style.filter = filter?.css || "";
    }
  }, []);

  const setupWebRTC = useCallback(async (initiator: boolean, ws: WebSocket) => {
    if (Platform.OS !== "web") return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    pcRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0] || (() => {
        const s = new MediaStream();
        if (event.track) s.addTrack(event.track);
        return s;
      })();
      const remoteContainer = document.getElementById("vibe-remote-video");
      if (remoteContainer && stream.getTracks().length > 0) {
        let video = remoteContainer.querySelector("video") as HTMLVideoElement;
        if (!video) {
          video = document.createElement("video");
          video.autoplay = true;
          video.playsInline = true;
          video.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:0;";
          remoteContainer.appendChild(video);
        }
        video.srcObject = stream;
        video.play().catch(() => {});
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        try { pc.restartIce(); } catch {}
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        handlePartnerDisconnect();
      }
    };

    if (initiator) {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "offer", offer }));
    }
  }, []);

  const handlePartnerDisconnect = useCallback(() => {
    setPartnerInfo(null);
    setStatus("waiting");
    pendingCandidatesRef.current = [];
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    const remoteContainer = document.getElementById("vibe-remote-video");
    if (remoteContainer) remoteContainer.innerHTML = "";
  }, []);

  const cleanup = useCallback(() => {
    pendingCandidatesRef.current = [];
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    const localContainer = document.getElementById("vibe-local-video");
    if (localContainer) localContainer.innerHTML = "";
    const remoteContainer = document.getElementById("vibe-remote-video");
    if (remoteContainer) remoteContainer.innerHTML = "";
  }, []);

  const handleConnect = useCallback(async () => {
    if (Platform.OS !== "web") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setStatus("requesting-camera");
    setErrorMsg("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;

      const localContainer = document.getElementById("vibe-local-video");
      if (localContainer) {
        localContainer.innerHTML = "";
        const video = document.createElement("video");
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.style.cssText = "width:100%;height:100%;object-fit:cover;transform:scaleX(-1);";
        video.srcObject = stream;
        localContainer.appendChild(video);
      }

      setStatus("waiting");

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "join",
          userId: currentUser?.id,
          name: currentUser?.name,
          age: currentUser?.age,
          city: currentUser?.city,
          filterAgeMin,
          filterAgeMax,
          filterCity,
        }));
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "matched": {
            isInitiatorRef.current = msg.initiator;
            setPartnerInfo({ name: msg.partnerName, age: msg.partnerAge, city: msg.partnerCity });
            setStatus("connected");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            pendingCandidatesRef.current = [];
            if (msg.initiator) {
              await setupWebRTC(true, ws);
            }
            break;
          }
          case "offer": {
            if (!pcRef.current) await setupWebRTC(false, ws);
            if (pcRef.current) {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.offer));
              for (const c of pendingCandidatesRef.current) {
                try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch {}
              }
              pendingCandidatesRef.current = [];
              const answer = await pcRef.current.createAnswer();
              await pcRef.current.setLocalDescription(answer);
              ws.send(JSON.stringify({ type: "answer", answer }));
            }
            break;
          }
          case "answer": {
            if (pcRef.current) {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
              for (const c of pendingCandidatesRef.current) {
                try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch {}
              }
              pendingCandidatesRef.current = [];
            }
            break;
          }
          case "ice-candidate": {
            if (msg.candidate) {
              if (pcRef.current?.remoteDescription) {
                try { await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
              } else {
                pendingCandidatesRef.current.push(msg.candidate);
              }
            }
            break;
          }
          case "partner-disconnected": {
            handlePartnerDisconnect();
            break;
          }
        }
      };

      ws.onclose = () => {
        if (status !== "idle") setStatus("idle");
      };

      ws.onerror = () => {
        setErrorMsg("Błąd połączenia. Sprawdź internet.");
        setStatus("error");
        cleanup();
      };
    } catch (e: unknown) {
      const err = e as Error;
      setErrorMsg(err.name === "NotAllowedError"
        ? "Brak dostępu do kamery/mikrofonu. Zezwól w ustawieniach przeglądarki."
        : "Nie udało się uruchomić kamery.");
      setStatus("error");
    }
  }, [currentUser, filterAgeMin, filterAgeMax, filterCity, setupWebRTC, handlePartnerDisconnect, cleanup]);

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPartnerInfo(null);
    setStatus("waiting");
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    const remoteContainer = document.getElementById("vibe-remote-video");
    if (remoteContainer) remoteContainer.innerHTML = "";
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "next", filterAgeMin, filterAgeMax, filterCity }));
    }
  }, [filterAgeMin, filterAgeMax, filterCity]);

  const handleDisconnect = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus("idle");
    setPartnerInfo(null);
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    return () => { cleanup(); };
  }, []);

  if (Platform.OS !== "web") {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Losowy czat</Text>
        </View>
        <NotWebFallback />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Losowy czat</Text>
        {status === "idle" || status === "error" ? (
          <Pressable
            style={styles.filterBtn}
            onPress={() => { setShowFilters(!showFilters); Haptics.selectionAsync(); }}
          >
            <Feather name="sliders" size={16} color={Colors.accent} />
            <Text style={styles.filterBtnText}>Filtry</Text>
          </Pressable>
        ) : (
          <View style={[styles.statusBadge, status === "connected" && styles.statusBadgeGreen]}>
            <View style={[styles.statusDot, status === "connected" && styles.statusDotGreen]} />
            <Text style={styles.statusBadgeText}>
              {status === "waiting" ? "Szukam..." : "Połączony"}
            </Text>
          </View>
        )}
      </View>

      {showFilters && (status === "idle" || status === "error") && (
        <Animated.View entering={FadeInDown.springify()} exiting={FadeOut} style={styles.filtersBox}>
          <Text style={styles.filtersTitle}>Filtry wyszukiwania</Text>

          <Text style={styles.filterLabel}>Wiek: {filterAgeMin}–{filterAgeMax} lat</Text>
          <View style={styles.ageRow}>
            {[[18, 25], [20, 30], [25, 35], [30, 40], [35, 50], [18, 50]].map(([mn, mx]) => (
              <Pressable
                key={`${mn}-${mx}`}
                style={[styles.ageTag, filterAgeMin === mn && filterAgeMax === mx && styles.ageTagActive]}
                onPress={() => { setFilterAgeMin(mn); setFilterAgeMax(mx); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.ageTagText, filterAgeMin === mn && filterAgeMax === mx && styles.ageTagTextActive]}>
                  {mn}–{mx}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.filterLabel, { marginTop: 12 }]}>Miasto</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.cityRow}>
              {CITIES_OPTIONS.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.cityTag, filterCity === c && styles.cityTagActive]}
                  onPress={() => { setFilterCity(c); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.cityTagText, filterCity === c && styles.cityTagTextActive]}>
                    {c === "all" ? "Wszystkie" : c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      )}

      <View style={styles.videoArea}>
        {status === "idle" || status === "error" ? (
          <Animated.View entering={FadeIn} style={styles.idleState}>
            <View style={styles.idleIconWrap}>
              <Feather name="video" size={36} color={Colors.black} />
            </View>
            <Text style={styles.idleTitle}>Połącz się z kimś</Text>
            <Text style={styles.idleText}>
              Rozmawiaj na żywo z losowymi osobami z całej Polski.{"\n"}
              Możesz filtrować wg wieku i miasta.
            </Text>
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color={Colors.danger} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.connectBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
              onPress={handleConnect}
            >
              <Feather name="video" size={20} color={Colors.black} />
              <Text style={styles.connectBtnText}>Połącz się</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            <View style={styles.remoteVideoWrap}>
              <View
                nativeID="vibe-remote-video"
                style={styles.remoteVideoInner}
              />
              {status === "waiting" && (
                <View style={styles.waitingOverlay}>
                  <ActivityIndicator color={Colors.accent} size="large" />
                  <Text style={styles.waitingText}>Szukam rozmówcy...</Text>
                  <Text style={styles.waitingSubText}>
                    {filterCity !== "all" ? `📍 ${filterCity} • ` : ""}
                    {filterAgeMin}–{filterAgeMax} lat
                  </Text>
                </View>
              )}
              {status === "connected" && partnerInfo && (
                <Animated.View entering={FadeIn} style={styles.partnerBadge}>
                  <Text style={styles.partnerBadgeName}>
                    {partnerInfo.name ?? "Anonim"}{partnerInfo.age ? `, ${partnerInfo.age}` : ""}
                  </Text>
                  {partnerInfo.city ? (
                    <Text style={styles.partnerBadgeCity}>📍 {partnerInfo.city}</Text>
                  ) : null}
                </Animated.View>
              )}
            </View>

            <View style={styles.localVideoWrap}>
              <View
                nativeID="vibe-local-video"
                style={styles.localVideoInner}
              />
            </View>
          </>
        )}
      </View>

      {(status === "waiting" || status === "connected") && (
        <>
          {showCamFilters && Platform.OS === "web" && (
            <Animated.View entering={FadeInDown} exiting={FadeOut} style={styles.filterBar}>
              {CAM_FILTERS.map(f => (
                <Pressable
                  key={f.id}
                  style={[styles.filterTag, activeCamFilter === f.id && styles.filterTagActive]}
                  onPress={() => { applyFilter(f.id); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.filterTagText, activeCamFilter === f.id && styles.filterTagTextActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </Animated.View>
          )}
          <Animated.View entering={FadeInDown} style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
            <Pressable
              style={({ pressed }) => [styles.ctrlBtn, styles.ctrlBtnDanger, pressed && { opacity: 0.8 }]}
              onPress={handleDisconnect}
            >
              <Feather name="phone-off" size={24} color={Colors.danger} />
            </Pressable>

            {status === "connected" && Platform.OS === "web" ? (
              <Pressable
                style={({ pressed }) => [styles.ctrlBtn, showCamFilters && styles.ctrlBtnFilterActive, pressed && { opacity: 0.8 }]}
                onPress={() => { setShowCamFilters(s => !s); Haptics.selectionAsync(); }}
              >
                <Feather name="sliders" size={22} color={showCamFilters ? Colors.black : Colors.accent} />
              </Pressable>
            ) : null}

            {status === "connected" ? (
              <Pressable
                style={({ pressed }) => [styles.ctrlBtn, styles.ctrlBtnNext, pressed && { opacity: 0.8 }]}
                onPress={handleNext}
              >
                <Feather name="skip-forward" size={22} color={Colors.accent} />
                <Text style={styles.ctrlBtnNextText}>Następna osoba</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </>
      )}
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
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.accent },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusBadgeGreen: { borderColor: "rgba(0,220,130,0.3)", backgroundColor: "rgba(0,220,130,0.1)" },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.textMuted },
  statusDotGreen: { backgroundColor: "#00DC82" },
  statusBadgeText: { fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  filtersBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  filtersTitle: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: Colors.textPrimary, marginBottom: 4 },
  filterLabel: { fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  ageRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ageTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  ageTagActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  ageTagText: { fontFamily: "Montserrat_500Medium", fontSize: 12, color: Colors.textSecondary },
  ageTagTextActive: { color: Colors.black },
  cityRow: { flexDirection: "row", gap: 6 },
  cityTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cityTagActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  cityTagText: { fontFamily: "Montserrat_500Medium", fontSize: 12, color: Colors.textSecondary },
  cityTagTextActive: { color: Colors.black },
  videoArea: { flex: 1, position: "relative" },
  idleState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  idleIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  idleTitle: { fontFamily: "Montserrat_700Bold", fontSize: 24, color: Colors.textPrimary, textAlign: "center" },
  idleText: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,59,92,0.08)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,59,92,0.2)",
  },
  errorText: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.danger, flex: 1 },
  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  connectBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: Colors.black },
  remoteVideoWrap: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    position: "relative",
  },
  remoteVideoInner: { flex: 1, backgroundColor: "#0a0a0a" },
  waitingOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    gap: 12,
  },
  waitingText: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: Colors.textPrimary },
  waitingSubText: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary },
  partnerBadge: {
    position: "absolute",
    bottom: 16,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 2,
  },
  partnerBadgeName: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.textPrimary },
  partnerBadgeCity: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textSecondary },
  localVideoWrap: {
    position: "absolute",
    bottom: 80,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: Colors.accent,
    backgroundColor: Colors.cardBg,
  },
  localVideoInner: { flex: 1 },
  filterBar: {
    position: "absolute",
    bottom: 80,
    left: 16,
    right: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 50,
  },
  filterTag: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  filterTagActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterTagText: { fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  filterTagTextActive: { color: Colors.black },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  ctrlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  ctrlBtnDanger: {
    borderColor: Colors.danger,
    backgroundColor: "rgba(255,59,92,0.1)",
  },
  ctrlBtnFilterActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  ctrlBtnNext: {
    flexDirection: "row",
    width: "auto",
    paddingHorizontal: 24,
    gap: 8,
    borderColor: Colors.accent,
    backgroundColor: "rgba(204,255,0,0.08)",
    borderWidth: 2,
    height: 54,
    borderRadius: 27,
  },
  ctrlBtnNextText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: Colors.accent,
  },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  fallbackTitle: { fontFamily: "Montserrat_700Bold", fontSize: 22, color: Colors.textPrimary },
  fallbackText: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
});
