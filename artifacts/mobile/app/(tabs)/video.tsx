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
import { usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

const WS_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `wss://${process.env.EXPO_PUBLIC_DOMAIN}/api/ws`
  : `ws://localhost:8080/api/ws`;

const FALLBACK_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

let _cachedIce: object[] | null = null;
let _cacheTs = 0;
async function getIceServers(): Promise<object[]> {
  const now = Date.now();
  if (_cachedIce && now - _cacheTs < 3_600_000) return _cachedIce;
  try {
    const res = await fetch(`${BASE_URL}/ice-servers`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      _cachedIce = await res.json() as object[];
      _cacheTs = now;
      return _cachedIce;
    }
  } catch {}
  return FALLBACK_ICE_SERVERS;
}

function buildPeerConfig(iceServers: object[]) {
  return {
    host: "0.peerjs.com",
    port: 443,
    secure: true,
    path: "/",
    config: { iceServers },
  };
}

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
  photoUrl?: string;
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

function WebVideoEl({ stream, muted = false, mirrored = false, filter = "", elId }: {
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
  filter?: string;
  elId: string;
}) {
  useEffect(() => {
    const container = document.getElementById(elId);
    if (!container) return;

    container.innerHTML = "";
    if (!stream) return;

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;object-fit:cover;display:block;background:transparent;";
    if (mirrored) video.style.transform = "scaleX(-1)";
    if (filter) video.style.filter = filter;

    // Ensure the container itself has a non-zero size
    container.style.position = "relative";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.minWidth = "1px";
    container.style.minHeight = "1px";

    container.appendChild(video);

    video.srcObject = stream;

    const onLoadedMetadata = () => {
      video.play().then(() => {
        if (!muted) video.muted = false;
      }).catch(() => {
        // play may fail if user hasn't interacted yet; we'll retry below
      });
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);

    const playWithRetry = () => {
      video.play().then(() => {
        if (!muted) video.muted = false;
      }).catch(() => {
        setTimeout(playWithRetry, 100);
      });
    };

    playWithRetry();

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.srcObject = null;
      container.innerHTML = "";
    };
  }, [stream, muted, mirrored, filter, elId]);

  return (
    <View style={{ flex: 1, width: "100%", height: "100%" }}>
      <View nativeID={elId} style={{ flex: 1, width: "100%", height: "100%" }} />
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
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [partnerCameraOn, setPartnerCameraOn] = useState(true);
  const [filterAgeMin, setFilterAgeMin] = useState(18);
  const [filterAgeMax, setFilterAgeMax] = useState(40);
  const [filterCity, setFilterCity] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [activeCamFilter, setActiveCamFilter] = useState("none");
  const [showCamFilters, setShowCamFilters] = useState(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const activeFilter = CAM_FILTERS.find(f => f.id === activeCamFilter);

  const handlePartnerDisconnect = useCallback(() => {
    setPartnerInfo(null);
    setStatus("waiting");
    setRemoteStream(null);
    if (activeCallRef.current) { try { activeCallRef.current.close(); } catch {} activeCallRef.current = null; }
  }, []);

  const destroyPeer = useCallback(() => {
    if (activeCallRef.current) { try { activeCallRef.current.close(); } catch {} activeCallRef.current = null; }
    if (peerRef.current) { try { peerRef.current.destroy(); } catch {} peerRef.current = null; }
  }, []);

  const cleanup = useCallback(() => {
    destroyPeer();
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
  }, [destroyPeer]);

  const connectWithPeerJs = useCallback(async (
    initiator: boolean,
    partnerPeerJsId: string,
    stream: MediaStream,
  ) => {
    if (Platform.OS !== "web") return;
    if (initiator) {
      const call = peerRef.current.call(partnerPeerJsId, stream);
      if (!call) return;
      activeCallRef.current = call;
      call.on("stream", (rs: MediaStream) => {
        setRemoteStream(rs);
        setStatus("connected");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });
      call.on("close", () => handlePartnerDisconnect());
      call.on("error", () => handlePartnerDisconnect());
    } else {
      peerRef.current.on("call", (call: any) => {
        activeCallRef.current = call;
        call.answer(stream);
        call.on("stream", (rs: MediaStream) => {
          setRemoteStream(rs);
          setStatus("connected");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        });
        call.on("close", () => handlePartnerDisconnect());
        call.on("error", () => handlePartnerDisconnect());
      });
    }
  }, [handlePartnerDisconnect]);

  const handleConnect = useCallback(async () => {
    if (Platform.OS !== "web") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus("requesting-camera");
    setErrorMsg("");
    setPartnerCameraOn(true);

    try {
      let stream: MediaStream;
      let hasVideo = true;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        hasVideo = false;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicOn(true);
      setCameraOn(hasVideo);

      const iceServers = await getIceServers();
      const { Peer } = (await import("peerjs")) as any;
      const peer = new Peer(buildPeerConfig(iceServers));
      peerRef.current = peer;

      peer.on("error", (err: any) => {
        if (err.type === "peer-unavailable") {
          handlePartnerDisconnect();
        } else if (err.type !== "server-error") {
          setErrorMsg("Błąd połączenia P2P. Spróbuj ponownie.");
          setStatus("error");
          cleanup();
        }
      });

      peer.on("open", (myPeerId: string) => {
        setStatus("waiting");
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: "join",
            peerJsId: myPeerId,
            userId: currentUser?.id,
            name: currentUser?.name,
            age: currentUser?.age,
            city: currentUser?.city,
            photoUrl: currentUser?.photoUrl,
            filterAgeMin,
            filterAgeMax,
            filterCity,
            filterGender,
            gender: currentUser?.gender,
          }));
        };

        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "matched") {
            const { initiator, partnerPeerJsId, partnerName, partnerAge, partnerCity, partnerPhotoUrl } = msg;
            setPartnerInfo({ name: partnerName, age: partnerAge, city: partnerCity, photoUrl: partnerPhotoUrl });
            setPartnerCameraOn(true);
            if (!hasVideo) {
              ws.send(JSON.stringify({ type: "camera-toggle", cameraOn: false }));
            }
            if (partnerPeerJsId) {
              await connectWithPeerJs(initiator, partnerPeerJsId, stream);
            } else {
              setStatus("connected");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
          if (msg.type === "partner-disconnected") {
            handlePartnerDisconnect();
          }
          if (msg.type === "partner-camera-toggle") {
            setPartnerCameraOn(!!msg.cameraOn);
          }
        };

        ws.onclose = () => { if (status !== "idle") setStatus("idle"); };
        ws.onerror = () => {
          setErrorMsg("Błąd połączenia z serwerem.");
          setStatus("error");
          cleanup();
        };
      });
    } catch (e: unknown) {
      const err = e as Error;
      setErrorMsg(err.name === "NotAllowedError"
        ? "Brak dostępu do kamery/mikrofonu. Zezwól w ustawieniach przeglądarki."
        : "Nie udało się uruchomić kamery.");
      setStatus("error");
    }
  }, [currentUser, filterAgeMin, filterAgeMax, filterCity, filterGender, connectWithPeerJs, handlePartnerDisconnect, cleanup]);

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPartnerInfo(null);
    setStatus("waiting");
    setRemoteStream(null);
    if (activeCallRef.current) { try { activeCallRef.current.close(); } catch {} activeCallRef.current = null; }

    const stream = localStreamRef.current;
    if (!stream) return;
    if (peerRef.current) { try { peerRef.current.destroy(); } catch {} peerRef.current = null; }

    const createNewPeer = async () => {
      const iceServers = await getIceServers();
      const { Peer } = (await import("peerjs")) as any;
      const peer = new Peer(buildPeerConfig(iceServers));
      peerRef.current = peer;
      peer.on("error", (err: any) => {
        if (err.type === "peer-unavailable") handlePartnerDisconnect();
      });
      peer.on("open", (myPeerId: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "next", peerJsId: myPeerId, filterAgeMin, filterAgeMax, filterCity, filterGender }));
        }
        peer.on("call", (call: any) => {
          activeCallRef.current = call;
          call.answer(stream);
          call.on("stream", (rs: MediaStream) => {
            setRemoteStream(rs);
            setStatus("connected");
          });
          call.on("close", () => handlePartnerDisconnect());
        });
      });
    };
    createNewPeer();
  }, [filterAgeMin, filterAgeMax, filterCity, filterGender, handlePartnerDisconnect]);

  const handleDisconnect = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus("idle");
    setPartnerInfo(null);
    cleanup();
  }, [cleanup]);

  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicOn(v => !v);
    Haptics.selectionAsync();
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const newState = !localStreamRef.current.getVideoTracks()[0]?.enabled;
    localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCameraOn(newState ?? false);
    wsRef.current?.send(JSON.stringify({ type: "camera-toggle", cameraOn: newState }));
    Haptics.selectionAsync();
  }, []);

  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/video") {
      cleanup();
      setStatus("idle");
      setLocalStream(null);
      setRemoteStream(null);
      setPartnerInfo(null);
    }
  }, [pathname]);

  useEffect(() => { return () => { cleanup(); }; }, []);

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
          <Text style={[styles.filterLabel, { marginTop: 12 }]}>Płeć</Text>
          <View style={styles.ageRow}>
            {[
              { id: "all", label: "Wszyscy" },
              { id: "male", label: "👨 Mężczyzna" },
              { id: "female", label: "👩 Kobieta" },
              { id: "other", label: "🌈 Inna" },
            ].map(g => (
              <Pressable
                key={g.id}
                style={[styles.ageTag, filterGender === g.id && styles.ageTagActive]}
                onPress={() => { setFilterGender(g.id); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.ageTagText, filterGender === g.id && styles.ageTagTextActive]}>
                  {g.label}
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
              <View style={styles.remoteVideoInner}>
                {remoteStream && (
                  <WebVideoEl stream={remoteStream} muted={false} mirrored={false} elId="vibe-remote-video" />
                )}
              </View>
              {status === "connected" && !partnerCameraOn && (
                <View style={styles.camOffOverlayFull}>
                  {partnerInfo?.photoUrl ? (
                    <Image source={{ uri: partnerInfo.photoUrl }} style={styles.camOffAvatar} />
                  ) : (
                    <View style={[styles.camOffAvatar, { backgroundColor: "#333", alignItems: "center", justifyContent: "center" }]}>
                      <Feather name="user" size={40} color="#888" />
                    </View>
                  )}
                  <Text style={styles.camOffName}>{partnerInfo?.name ?? "Anonim"}</Text>
                  <Text style={styles.camOffLabel}>Kamera wyłączona</Text>
                </View>
              )}
              {status === "waiting" && (
                <View style={styles.waitingOverlay}>
                  <ActivityIndicator color={Colors.accent} size="large" />
                  <Text style={styles.waitingText}>Szukam rozmówcy...</Text>
                  <Text style={styles.waitingSubText}>
                    {filterGender !== "all" ? `${filterGender === "male" ? "👨" : filterGender === "female" ? "👩" : "🌈"} • ` : ""}
                    {filterCity !== "all" ? `📍 ${filterCity} • ` : ""}
                    {filterAgeMin}–{filterAgeMax} lat
                  </Text>
                </View>
              )}
              {status === "connected" && partnerInfo && partnerCameraOn && (
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
              <View style={styles.localVideoInner}>
                {localStream && (
                  <WebVideoEl
                    stream={localStream}
                    muted={true}
                    mirrored={true}
                    filter={activeFilter?.css || ""}
                    elId="vibe-local-video"
                  />
                )}
              </View>
              {!cameraOn && (
                <View style={styles.camOffOverlay}>
                  {currentUser?.photoUrl ? (
                    <Image source={{ uri: currentUser.photoUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                  ) : (
                    <Feather name="video-off" size={20} color={Colors.textMuted} />
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </View>

      {(status === "waiting" || status === "connected") && (
        <>
          {showCamFilters && (
            <Animated.View entering={FadeInDown} exiting={FadeOut} style={styles.filterBar}>
              {CAM_FILTERS.map(f => (
                <Pressable
                  key={f.id}
                  style={[styles.filterTag, activeCamFilter === f.id && styles.filterTagActive]}
                  onPress={() => { setActiveCamFilter(f.id); Haptics.selectionAsync(); }}
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

            <Pressable
              style={({ pressed }) => [styles.ctrlBtn, !micOn && styles.ctrlBtnMuted, pressed && { opacity: 0.8 }]}
              onPress={toggleMic}
            >
              <Feather name={micOn ? "mic" : "mic-off"} size={22} color={micOn ? Colors.accent : Colors.textMuted} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.ctrlBtn, !cameraOn && styles.ctrlBtnMuted, pressed && { opacity: 0.8 }]}
              onPress={toggleCamera}
            >
              <Feather name={cameraOn ? "video" : "video-off"} size={22} color={cameraOn ? Colors.accent : Colors.textMuted} />
            </Pressable>

            {status === "connected" ? (
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
  remoteVideoInner: { flex: 1, backgroundColor: "#0a0a0a", overflow: "hidden" },
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
  localVideoInner: { flex: 1, overflow: "hidden" },
  camOffOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  camOffOverlayFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,17,17,0.95)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  camOffAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  camOffName: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: "#fff", marginBottom: 4 },
  camOffLabel: { fontFamily: "Montserrat_500Medium", fontSize: 13, color: "rgba(255,255,255,0.5)" },
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
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  ctrlBtnDanger: {
    borderColor: Colors.danger,
    backgroundColor: "rgba(255,59,92,0.1)",
  },
  ctrlBtnMuted: {
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
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
