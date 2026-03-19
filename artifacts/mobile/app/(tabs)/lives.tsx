import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

const { height: SCREEN_H } = Dimensions.get("window");

const WS_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `wss://${process.env.EXPO_PUBLIC_DOMAIN}/api/ws`
  : `ws://localhost:8080/api/ws`;

const GIFTS = [
  { id: "heart", emoji: "❤️", label: "Serce", cost: 60 },
  { id: "rose", emoji: "🌹", label: "Róża", cost: 150 },
  { id: "fire", emoji: "🔥", label: "Ogień", cost: 300 },
  { id: "star", emoji: "⭐", label: "Gwiazdka", cost: 400 },
  { id: "diamond", emoji: "💎", label: "Diament", cost: 800 },
  { id: "rainbow", emoji: "🌈", label: "Tęcza", cost: 1600 },
  { id: "crown", emoji: "👑", label: "Korona", cost: 3000 },
  { id: "rocket", emoji: "🚀", label: "Rakieta", cost: 6000 },
];

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

interface LiveHost {
  id: number;
  name: string;
  username?: string | null;
  photoUrl: string;
  age: number;
  city?: string;
  isVerified?: boolean;
}

interface Live {
  id: number;
  title: string;
  viewerCount: number;
  createdAt?: string;
  host: LiveHost;
}

interface FloatingGift {
  id: string;
  emoji: string;
  x: number;
}

interface GiftToastItem {
  id: string;
  senderName: string;
  emoji: string;
  giftLabel: string;
}

interface FloatingHeart {
  id: string;
  xOff: number;
}

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

function WebVideoEl({ stream, muted = false, mirrored = false, filter = "", videoRef: externalRef, elId }: {
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
  filter?: string;
  videoRef?: React.MutableRefObject<any>;
  elId: string;
}) {
  const containerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const findContainer = (): HTMLElement | null => {
      if (containerRef.current) return containerRef.current;
      const byId = document.getElementById(elId);
      if (byId) {
        containerRef.current = byId;
        return byId;
      }
      const byNative = document.querySelector(`[data-nativeid="${elId}"]`) as HTMLElement | null;
      if (byNative) {
        byNative.id = elId;
        containerRef.current = byNative;
        return byNative;
      }
      return null;
    };

    const container = findContainer();
    if (!container) {
      console.warn("WebVideoEl: container not found for", elId);
      return;
    }

    container.innerHTML = "";
    if (!stream) {
      if (externalRef) externalRef.current = null;
      return;
    }

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

    if (externalRef) externalRef.current = video;

    // If the container is still 0x0 (common when RN-web layout hasn't sized it yet), force it to fill viewport.
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn("WebVideoEl: container has 0 size, forcing full viewport", elId, rect);
      container.style.position = "fixed";
      container.style.top = "0";
      container.style.left = "0";
      container.style.right = "0";
      container.style.bottom = "0";
      container.style.width = "100vw";
      container.style.height = "100vh";
      video.style.width = "100vw";
      video.style.height = "100vh";
    }

    video.srcObject = stream;

    const onLoadedMetadata = () => {
      // Some browsers report 0x0 until metadata is loaded
      video.play().then(() => {
        if (!muted) video.muted = false;
      }).catch(() => {
        // retry quietly
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
      if (externalRef) externalRef.current = null;
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.srcObject = null;
      container.innerHTML = "";
    };
  }, [stream, muted, mirrored, filter, elId, externalRef]);

  return (
    <View style={{ flex: 1, width: "100%", height: "100%" }}>
      <View ref={containerRef} nativeID={elId} style={{ flex: 1, width: "100%", height: "100%" }} />
    </View>
  );
}

function GiftToastBubble({ toast, onDone }: { toast: GiftToastItem; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <Animated.View
      entering={SlideInRight.springify().damping(18)}
      exiting={SlideOutRight.duration(350)}
      style={styles.giftToast}
    >
      <Text style={styles.giftToastEmoji}>{toast.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.giftToastName} numberOfLines={1}>{toast.senderName}</Text>
        <Text style={styles.giftToastLabel}>wysłał/a {toast.giftLabel}</Text>
      </View>
    </Animated.View>
  );
}

function FloatingHeartBubble({ xOff, onDone }: { xOff: number; onDone: () => void }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withSequence(withSpring(1.3, { damping: 6, stiffness: 200 }), withTiming(1, { duration: 300 }));
    translateY.value = withTiming(-240, { duration: 2200 });
    translateX.value = withSequence(
      withTiming(xOff, { duration: 550 }),
      withTiming(-xOff * 0.6, { duration: 550 }),
      withTiming(xOff * 0.9, { duration: 550 }),
      withTiming(0, { duration: 550 }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(1400, withTiming(0, { duration: 700 })),
    );
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { translateX: translateX.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.floatingHeart, style]} pointerEvents="none">
      <Text style={styles.floatingHeartText}>❤️</Text>
    </Animated.View>
  );
}

function FloatingGiftBubble({ emoji, x, onDone }: { emoji: string; x: number; onDone: () => void }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 60;
    opacity.value = withSequence(withTiming(1, { duration: 250 }), withDelay(1800, withTiming(0, { duration: 800 })));
    scale.value = withSequence(
      withSpring(1.5, { damping: 6, stiffness: 200 }),
      withTiming(1.1, { duration: 400 }),
      withDelay(1400, withTiming(0.7, { duration: 800 })),
    );
    translateY.value = withTiming(-320, { duration: 2800 });
    translateX.value = withSequence(
      withTiming(drift * 0.4, { duration: 700 }),
      withTiming(drift, { duration: 700 }),
      withTiming(drift * 0.7, { duration: 700 }),
      withTiming(drift * 1.1, { duration: 600 }),
    );
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { translateX: translateX.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.floatingGift, { left: `${x}%` as any }, style]} pointerEvents="none">
      <Text style={styles.floatingGiftText}>{emoji}</Text>
    </Animated.View>
  );
}

function GiftSheet({ onSend, coins, onClose }: { onSend: (gift: typeof GIFTS[0]) => void; coins: number; onClose: () => void }) {
  return (
    <Pressable style={styles.giftSheetBackdrop} onPress={onClose}>
      <Pressable style={styles.giftSheet} onPress={e => e.stopPropagation()}>
        <View style={styles.giftSheetHandle} />
        <View style={styles.giftSheetHeader}>
          <Text style={styles.giftSheetTitle}>Wyślij prezent</Text>
          <View style={styles.giftCoinsChip}>
            <Text style={styles.giftCoinsChipText}>💰 {coins}</Text>
          </View>
        </View>
        <View style={styles.giftGrid}>
          {GIFTS.map(gift => {
            const canAfford = coins >= gift.cost;
            return (
              <Pressable
                key={gift.id}
                style={[styles.giftBtn, !canAfford && styles.giftBtnDisabled]}
                onPress={() => onSend(gift)}
                disabled={!canAfford}
              >
                <Text style={{ fontSize: 32 }}>{gift.emoji}</Text>
                <Text style={styles.giftLabel}>{gift.label}</Text>
                <Text style={[styles.giftCost, !canAfford && { color: Colors.textMuted }]}>💰 {gift.cost}</Text>
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Pressable>
  );
}

function LiveViewerModal({ live, visible, onClose, currentUser }: {
  live: Live | null;
  visible: boolean;
  onClose: () => void;
  currentUser: { id: number; name: string } | null;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const viewerPeerRef = useRef<any>(null);
  const viewerCallRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const cohostPcRef = useRef<RTCPeerConnection | null>(null);
  const myStageStreamRef = useRef<MediaStream | null>(null);
  const myPeerIdRef = useRef<string>("");
  const hostPeerIdRef = useRef<string>("");
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const [connected, setConnected] = useState(false);
  const [hostCameraOn, setHostCameraOn] = useState(true);
  const [cohostVisible, setCohostVisible] = useState(false);
  const [onStage, setOnStage] = useState(false);
  const [stageInvite, setStageInvite] = useState<{ hostPeerId: string; hostName: string } | null>(null);
  const [addedFriend, setAddedFriend] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; name: string; text: string }[]>([]);
  const [chatText, setChatText] = useState("");
  const [floatingGifts, setFloatingGifts] = useState<FloatingGift[]>([]);
  const [giftToasts, setGiftToasts] = useState<GiftToastItem[]>([]);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [coins, setCoins] = useState(2000);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [cohostStream, setCohostStream] = useState<MediaStream | null>(null);
  const [myStageStream, setMyStageStream] = useState<MediaStream | null>(null);
  const chatListRef = useRef<any>(null);
  const queryClient = useQueryClient();

  const cleanup = useCallback(() => {
    if (viewerCallRef.current) { try { viewerCallRef.current.close(); } catch {} viewerCallRef.current = null; }
    if (viewerPeerRef.current) { try { viewerPeerRef.current.destroy(); } catch {} viewerPeerRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (cohostPcRef.current) { cohostPcRef.current.close(); cohostPcRef.current = null; }
    if (myStageStreamRef.current) { myStageStreamRef.current.getTracks().forEach(t => t.stop()); myStageStreamRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    pendingIceRef.current = [];
    setConnected(false);
    setCohostVisible(false);
    setOnStage(false);
    setStageInvite(null);
    setShowGifts(false);
    setChatMessages([]);
    setFloatingGifts([]);
    setGiftToasts([]);
    setFloatingHearts([]);
    setAddedFriend(false);
    setRemoteStream(null);
    setCohostStream(null);
    setMyStageStream(null);
    if (live) {
      fetch(`${BASE_URL}/lives/${live.id}/viewers`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta: -1 }) }).catch(() => {});
    }
  }, [live]);

  const acceptStageInvite = useCallback(async () => {
    const invite = stageInvite;
    setStageInvite(null);
    if (!invite || Platform.OS !== "web") return;
    try {
      const iceServers = await getIceServers();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      myStageStreamRef.current = stream;
      setMyStageStream(stream);
      const pc = new RTCPeerConnection({ iceServers } as RTCConfiguration);
      cohostPcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => {
        if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "stage-ice", candidate: e.candidate, targetPeerId: invite.hostPeerId }));
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.send(JSON.stringify({ type: "stage-offer", offer, targetPeerId: invite.hostPeerId }));
      setOnStage(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Błąd", "Nie udało się uruchomić kamery.");
    }
  }, [stageInvite]);

  const remoteStreamRef = useRef<MediaStream | null>(null);

  const setRemoteStreamSafe = useCallback((stream: MediaStream | null) => {
    remoteStreamRef.current = stream;
    setRemoteStream(stream);
  }, []);

  const handleHostOffer = useCallback(async (offer: RTCSessionDescriptionInit, hostWsPeerId: string) => {
    if (Platform.OS !== "web") return;
    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers } as RTCConfiguration);
    pcRef.current = pc;

    const ensureRemoteStreamHasVideo = (stream: MediaStream) => {
      const hasVideo = stream.getVideoTracks().length > 0;
      if (!hasVideo) {
        console.warn("VIEWER: remote stream does not have a video track yet", stream.getTracks().map(t => `${t.kind}(${t.readyState})`));
        return false;
      }
      return true;
    };

    const attachIncomingStream = (stream: MediaStream) => {
      if (!stream) return;
      if (!ensureRemoteStreamHasVideo(stream)) return;
      console.warn("VIEWER: remote video track added", {
        videoTracks: stream.getVideoTracks().map(t => ({ id: t.id, readyState: t.readyState })),
        audioTracks: stream.getAudioTracks().map(t => ({ id: t.id, readyState: t.readyState })),
      });
      setConnected(true);
      setRemoteStreamSafe(stream);
    };

    pc.ontrack = (e) => {
      console.warn("VIEWER ontrack:", e.track.kind, e.track.readyState);
      const incomingStream = e.streams[0] || new MediaStream();
      if (e.track) incomingStream.addTrack(e.track);
      attachIncomingStream(incomingStream);
    };

    // Some browsers / libs (e.g. older WebRTC implementations) may still fire onaddstream
    // when the remote stream is available.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pc as any).onaddstream = (e: any) => {
      console.warn("VIEWER onaddstream", e.stream);
      attachIncomingStream(e.stream);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current) {
        console.warn("VIEWER sending ICE candidate", e.candidate);
        wsRef.current.send(JSON.stringify({ type: "live-ice", candidate: e.candidate, targetPeerId: hostWsPeerId }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.warn("VIEWER ICE state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        Alert.alert("Błąd", "Połączenie z hostem zostało przerwane.");
        cleanup();
        onClose();
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    wsRef.current?.send(JSON.stringify({ type: "live-answer", answer, targetPeerId: hostWsPeerId }));

    for (const ice of pendingIceRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(ice)); } catch (err) {
        console.warn("VIEWER failed to add pending ICE candidate", err);
      }
    }
    pendingIceRef.current = [];
  }, [cleanup, onClose, setRemoteStreamSafe]);

  useEffect(() => {
    if (!visible || !live) return;
    if (Platform.OS !== "web") return;

    pendingIceRef.current = [];
    fetch(`${BASE_URL}/lives/${live.id}/viewers`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta: 1 }) }).catch(() => {});

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join-live", liveId: live.id, userId: currentUser?.id, name: currentUser?.name, role: "viewer" }));
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "connected") {
        myPeerIdRef.current = msg.peerId;
      }

      if (msg.type === "live-joined") {
        wsRef.current?.send(JSON.stringify({ type: "viewer-peer-ready", viewerPeerJsId: "unused" }));
      }

      if (msg.type === "live-offer") {
        handleHostOffer(msg.offer as RTCSessionDescriptionInit, msg.fromPeerId as string);
      }

      if (msg.type === "live-ice") {
        if (pcRef.current && pcRef.current.remoteDescription) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
        } else {
          pendingIceRef.current.push(msg.candidate);
        }
      }

      if (msg.type === "stage-invite") {
        setStageInvite({ hostPeerId: msg.hostPeerId as string, hostName: msg.hostName as string });
      }

      if (msg.type === "stage-answer") {
        if (cohostPcRef.current) {
          try { await cohostPcRef.current.setRemoteDescription(new RTCSessionDescription(msg.answer)); } catch {}
        }
      }

      if (msg.type === "stage-ice") {
        if (cohostPcRef.current) {
          try { await cohostPcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
        }
      }

      if (msg.type === "cohost-offer") {
        const iceServersForCo = await getIceServers();
        const coPc = new RTCPeerConnection({ iceServers: iceServersForCo } as RTCConfiguration);
        coPc.ontrack = (e) => {
          const stream = e.streams[0] || (() => { const s = new MediaStream(); if (e.track) s.addTrack(e.track); return s; })();
          setCohostVisible(true);
          setCohostStream(stream);
        };
        coPc.onicecandidate = (e) => {
          if (e.candidate) ws.send(JSON.stringify({ type: "cohost-ice", candidate: e.candidate, targetPeerId: msg.fromPeerId }));
        };
        await coPc.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await coPc.createAnswer();
        await coPc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "cohost-answer", answer, targetPeerId: msg.fromPeerId }));
      }

      if (msg.type === "host-camera-toggle") {
        setHostCameraOn(!!msg.cameraOn);
      }

      if (msg.type === "live-chat") {
        const chatMsg = { id: Math.random().toString(36).slice(2), name: msg.name as string, text: msg.text as string };
        setChatMessages(prev => [...prev.slice(-99), chatMsg]);
      }

      if (msg.type === "live-gift") {
        const fid = Math.random().toString(36).slice(2);
        setFloatingGifts(prev => [...prev, { id: fid, emoji: msg.emoji as string, x: Math.random() * 55 + 5 }]);
        const giftDef = GIFTS.find(g => g.emoji === msg.emoji);
        const tid = Math.random().toString(36).slice(2);
        setGiftToasts(prev => [...prev.slice(-3), { id: tid, senderName: msg.senderName as string, emoji: msg.emoji as string, giftLabel: giftDef?.label || "" }]);
      }

      if (msg.type === "live-error") {
        if (msg.usePeerJs) {
          try {
            const res = await fetch(`${BASE_URL}/lives/${live.id}`);
            if (res.ok) {
              const data = await res.json();
              if (data.hostPeerJsId) {
                await callHostViaPeerJs(data.hostPeerJsId as string);
              } else {
                Alert.alert("Błąd", "Host nie jest dostępny.");
                cleanup();
                onClose();
              }
            } else {
              Alert.alert("Błąd", "Nie można dołączyć do live'a.");
              cleanup();
              onClose();
            }
          } catch {
            Alert.alert("Błąd", "Problem z połączeniem.");
            cleanup();
            onClose();
          }
        } else {
          Alert.alert("Błąd", (msg.error as string) || "Nie można dołączyć do live'a");
          cleanup();
          onClose();
        }
      }

      if (msg.type === "live-ended") {
        Alert.alert("Live zakończony", "Gospodarz zakończył transmisję.");
        cleanup();
        onClose();
      }
    };

    ws.onclose = () => { setConnected(false); };
    ws.onerror = () => { setConnected(false); };

    return () => { cleanup(); };
  }, [visible, live]);

  const handleSendGift = useCallback((gift: typeof GIFTS[0]) => {
    if (coins < gift.cost) return;
    setCoins(c => c - gift.cost);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowGifts(false);
    const fid = Math.random().toString(36).slice(2);
    setFloatingGifts(prev => [...prev, { id: fid, emoji: gift.emoji, x: Math.random() * 55 + 5 }]);
    const tid = Math.random().toString(36).slice(2);
    setGiftToasts(prev => [...prev.slice(-3), { id: tid, senderName: currentUser?.name || "Ty", emoji: gift.emoji, giftLabel: gift.label }]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "live-gift", senderName: currentUser?.name || "Widz", emoji: gift.emoji, cost: gift.cost }));
    }
  }, [coins, currentUser]);

  const sendChat = useCallback(() => {
    const trimmed = chatText.trim();
    if (!trimmed || !wsRef.current) return;
    const myName = currentUser?.name || "Widz";
    setChatMessages(prev => [...prev.slice(-99), { id: `local_${Date.now()}`, name: myName, text: trimmed }]);
    setChatText("");
    if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "live-chat", name: myName, text: trimmed }));
    }
  }, [chatText, currentUser]);

  const handleAddFriend = async () => {
    if (!currentUser || !live) return;
    try {
      await fetch(`${BASE_URL}/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: currentUser.id, toUserId: live.host.id }),
      });
      setAddedFriend(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    } catch {}
  };

  const tapHeart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newHearts: FloatingHeart[] = Array.from({ length: 5 }, () => ({
      id: Math.random().toString(36).slice(2),
      xOff: (Math.random() - 0.5) * 70,
    }));
    setFloatingHearts(prev => [...prev, ...newHearts]);
  }, []);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => { cleanup(); onClose(); }}>
      <View style={[styles.liveContainer, StyleSheet.absoluteFill]}>
        {Platform.OS === "web" ? (
          <View style={StyleSheet.absoluteFill}>
            {remoteStream ? (
              <WebVideoEl stream={remoteStream} muted={false} elId="vibe-live-viewer-video" />
            ) : null}
            {connected && !hostCameraOn && (
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(17,17,17,0.95)", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
                {live?.host.photoUrl ? (
                  <Image source={{ uri: live.host.photoUrl }} style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 14 }} />
                ) : (
                  <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: "#333", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                    <Feather name="user" size={44} color="#888" />
                  </View>
                )}
                <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 20, color: "#fff", marginBottom: 4 }}>
                  {live?.host.name}
                </Text>
                <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                  Kamera wyłączona
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111", alignItems: "center", justifyContent: "center", gap: 12 }]}>
            <Feather name="monitor" size={48} color={Colors.textMuted} />
            <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 14, color: Colors.textMuted, textAlign: "center", paddingHorizontal: 32 }}>
              Live dostępny w wersji web
            </Text>
          </View>
        )}

        

        {Platform.OS === "web" && !connected && (
          <View style={styles.connectingOverlay}>
            {live?.host.photoUrl ? (
              <Image source={{ uri: live.host.photoUrl }} style={styles.connectingAvatar} />
            ) : null}
            <ActivityIndicator color={Colors.accent} size="large" style={{ marginTop: 20 }} />
            <Text style={styles.connectingText}>Łączę z live...</Text>
          </View>
        )}

        {live && (
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              {live.host.photoUrl ? (
                <Image source={{ uri: live.host.photoUrl }} style={styles.hostAvatarTop} />
              ) : (
                <View style={[styles.hostAvatarTop, { backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" }]}>
                  <Feather name="user" size={18} color="#fff" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.hostNameTop} numberOfLines={1}>
                  {live.host.name}{live.host.isVerified ? " ✓" : ""}
                </Text>
                {live.title ? <Text style={styles.liveTitleTop} numberOfLines={1}>{live.title}</Text> : null}
              </View>
              <View style={styles.liveBadgeTop}>
                <View style={styles.liveDotTop} />
                <Text style={styles.liveBadgeTopText}>LIVE</Text>
              </View>
              <View style={styles.viewerCountChip}>
                <Feather name="eye" size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.viewerCountChipText}>{live.viewerCount}</Text>
              </View>
            </View>
            <View style={styles.topBarRight}>
              <Pressable
                style={[styles.followTopBtn, addedFriend && styles.followTopBtnDone]}
                onPress={handleAddFriend}
                disabled={addedFriend}
              >
                {addedFriend
                  ? <Feather name="check" size={13} color={Colors.black} />
                  : <Text style={styles.followTopBtnText}>Dodaj</Text>}
              </Pressable>
              <Pressable style={styles.closeTopBtn} onPress={() => { cleanup(); onClose(); }}>
                <Feather name="x" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.rightActions}>
          <Pressable style={styles.rightActionBtn} onPress={tapHeart}>
            <Text style={styles.rightActionEmoji}>❤️</Text>
            <Text style={styles.rightActionLabel}>Serce</Text>
          </Pressable>
          <Pressable style={styles.rightActionBtn} onPress={() => { setShowGifts(s => !s); Haptics.selectionAsync(); }}>
            <Text style={styles.rightActionEmoji}>🎁</Text>
            <Text style={styles.rightActionLabel}>Prezent</Text>
          </Pressable>
          <Pressable style={styles.rightActionBtn}>
            <Feather name="share-2" size={26} color="#fff" />
            <Text style={styles.rightActionLabel}>Udostępnij</Text>
          </Pressable>
        </View>

        <View style={styles.commentsOverlay} pointerEvents="none">
          <FlatList
            ref={chatListRef}
            data={chatMessages}
            keyExtractor={m => m.id}
            style={styles.commentsFlatList}
            contentContainerStyle={{ gap: 5, paddingVertical: 4 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <Text style={styles.commentSender}>{item.name} </Text>
                <Text style={styles.commentText}>{item.text}</Text>
              </View>
            )}
          />
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.commentInputWrap}>
            <TextInput
              style={styles.commentInput}
              placeholder="Dodaj komentarz..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              value={chatText}
              onChangeText={setChatText}
              onSubmitEditing={sendChat}
              returnKeyType="send"
              maxLength={200}
            />
            {chatText.trim() ? (
              <Pressable onPress={sendChat} style={styles.commentSendBtn}>
                <Feather name="send" size={15} color={Colors.accent} />
              </Pressable>
            ) : null}
          </View>
          <Pressable style={styles.bottomGiftBtn} onPress={() => { setShowGifts(s => !s); Haptics.selectionAsync(); }}>
            <Text style={{ fontSize: 22 }}>🎁</Text>
          </Pressable>
        </View>

        <View style={styles.heartsContainer} pointerEvents="none">
          {floatingHearts.map(h => (
            <FloatingHeartBubble
              key={h.id}
              xOff={h.xOff}
              onDone={() => setFloatingHearts(prev => prev.filter(fh => fh.id !== h.id))}
            />
          ))}
        </View>

        {floatingGifts.map(g => (
          <FloatingGiftBubble
            key={g.id}
            emoji={g.emoji}
            x={g.x}
            onDone={() => setFloatingGifts(prev => prev.filter(fg => fg.id !== g.id))}
          />
        ))}

        <View style={styles.giftToastsContainer} pointerEvents="none">
          {giftToasts.map(t => (
            <GiftToastBubble
              key={t.id}
              toast={t}
              onDone={() => setGiftToasts(prev => prev.filter(gt => gt.id !== t.id))}
            />
          ))}
        </View>

        {showGifts && (
          <Animated.View entering={SlideInDown.springify().damping(16)} exiting={SlideOutDown.duration(280)} style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <GiftSheet onSend={handleSendGift} coins={coins} onClose={() => setShowGifts(false)} />
          </Animated.View>
        )}

        {cohostVisible && Platform.OS === "web" && (
          <View style={[styles.cohostPip, { overflow: "hidden" }]}>
            <WebVideoEl stream={cohostStream} muted={false} elId="vibe-live-cohost-video" />
          </View>
        )}
        {onStage && Platform.OS === "web" && (
          <View style={[styles.myCamPip, { overflow: "hidden" }]}>
            <WebVideoEl stream={myStageStream} muted={true} mirrored={true} elId="vibe-live-host-cam-video" />
          </View>
        )}

        {stageInvite && (
          <Animated.View entering={FadeInDown} style={styles.stageInviteBox}>
            <Text style={styles.stageInviteTitle}>🎤 Zaproszenie na scenę</Text>
            <Text style={styles.stageInviteText}>{stageInvite.hostName} zaprasza Cię do live!</Text>
            <View style={styles.stageInviteBtns}>
              <Pressable style={styles.stageDeclineBtn} onPress={() => setStageInvite(null)}>
                <Text style={styles.stageDeclineBtnText}>Odrzuć</Text>
              </Pressable>
              <Pressable style={styles.stageAcceptBtn} onPress={acceptStageInvite}>
                <Text style={styles.stageAcceptBtnText}>Dołącz</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

function HostBroadcastModal({ live, visible, onClose }: { live: { id: number; title: string } | null; visible: boolean; onClose: () => void }) {
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<any>(null);
  const viewerPcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceMap = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const cohostPcRef = useRef<RTCPeerConnection | null>(null);
  const cohostStreamRef = useRef<MediaStream | null>(null);
  const cohostViewerPcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const myPeerIdRef = useRef<string>("");

  const [broadcasting, setBroadcasting] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [viewers, setViewers] = useState<{ peerId: string; name: string }[]>([]);
  const [cohostVisible, setCohostVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; name: string; text: string }[]>([]);
  const [giftToasts, setGiftToasts] = useState<GiftToastItem[]>([]);
  const [floatingGifts, setFloatingGifts] = useState<FloatingGift[]>([]);
  const [showChat, setShowChat] = useState(true);
  const [showViewers, setShowViewers] = useState(false);
  const [activeFilter, setActiveFilter] = useState("none");
  const [showFilters, setShowFilters] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [broadcastError, setBroadcastError] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cohostStream, setCohostStream] = useState<MediaStream | null>(null);
  const chatListRef = useRef<any>(null);
  const queryClient = useQueryClient();
  const hostVideoRef = useRef<any>(null);

  const applyFilter = useCallback((filterId: string) => {
    setActiveFilter(filterId);
  }, []);

  const distributeCohost = useCallback(async (stream: MediaStream, ws: WebSocket) => {
    const iceServers = await getIceServers();
    for (const [viewerPeerId] of viewerPcsRef.current) {
      try {
        const pc = new RTCPeerConnection({ iceServers } as RTCConfiguration);
        cohostViewerPcsRef.current.set(viewerPeerId, pc);
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
        pc.onicecandidate = (e) => {
          if (e.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "cohost-ice", candidate: e.candidate, targetPeerId: viewerPeerId }));
          }
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: "cohost-offer", offer, targetPeerId: viewerPeerId }));
      } catch {}
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    viewerPcsRef.current.forEach(pc => pc.close());
    viewerPcsRef.current.clear();
    cohostViewerPcsRef.current.forEach(pc => pc.close());
    cohostViewerPcsRef.current.clear();
    pendingIceMap.current.clear();
    if (cohostPcRef.current) { cohostPcRef.current.close(); cohostPcRef.current = null; }
    cohostStreamRef.current = null;
    if (wsRef.current) { try { wsRef.current.send(JSON.stringify({ type: "end-live" })); } catch {} wsRef.current.close(); wsRef.current = null; }
    if (peerRef.current) { try { peerRef.current.destroy(); } catch {} peerRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    setBroadcasting(false);
    setViewerCount(0);
    setCohostVisible(false);
    setChatMessages([]);
    setGiftToasts([]);
    setFloatingGifts([]);
    setViewers([]);
    setShowViewers(false);
    setShowFilters(false);
    setBroadcastError("");
    setMicOn(true);
    setCameraOn(true);
    setLocalStream(null);
    setCohostStream(null);
  }, []);

  const endLive = useCallback(() => {
    if (live) {
      fetch(`${BASE_URL}/lives/${live.id}/end`, { method: "PATCH" }).catch(() => {});
    }
    cleanupMedia();
    queryClient.invalidateQueries({ queryKey: ["lives"] });
  }, [live, cleanupMedia]);

  const inviteToStage = useCallback((viewerPeerId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "invite-to-stage", targetPeerId: viewerPeerId }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

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

  useEffect(() => {
    if (!visible || !live || Platform.OS !== "web") return;

    setBroadcastError("");

    const startBroadcast = async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (e: unknown) {
        const err = e as Error;
        setBroadcastError(err.name === "NotAllowedError" ? "Brak dostępu do kamery. Zezwól w ustawieniach." : "Nie udało się uruchomić kamery.");
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicOn(true);
      setCameraOn(true);

      const iceServers = await getIceServers();
      const { Peer } = (await import("peerjs")) as any;
      const peer = new Peer(buildPeerConfig(iceServers));
      peerRef.current = peer;

      peer.on("error", (err: any) => {
        console.warn("Host PeerJS error:", err.type, err.message);
      });

      peer.on("open", (peerJsId: string) => {
        setBroadcasting(true);
        fetch(`${BASE_URL}/lives/${live.id}/peer`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerJsId }),
        }).catch(() => {});

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "join-live", liveId: live.id, role: "host", peerJsId }));
        };
        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === "connected") { myPeerIdRef.current = msg.peerId; }

          if (msg.type === "live-chat") {
            setChatMessages(prev => [...prev.slice(-99), { id: Math.random().toString(36).slice(2), name: msg.name as string, text: msg.text as string }]);
          }

          if (msg.type === "live-gift") {
            const giftDef = GIFTS.find(g => g.emoji === msg.emoji);
            const tid = Math.random().toString(36).slice(2);
            setGiftToasts(prev => [...prev.slice(-3), { id: tid, senderName: msg.senderName as string, emoji: msg.emoji as string, giftLabel: giftDef?.label || "" }]);
            const fid = Math.random().toString(36).slice(2);
            setFloatingGifts(prev => [...prev, { id: fid, emoji: msg.emoji as string, x: Math.random() * 55 + 5 }]);
          }

          if (msg.type === "viewer-joined") {
            const viewerName = (msg.viewerName as string) || "Widz";
            const viewerPeerId = msg.viewerPeerId as string;
            setViewers(prev => [...prev, { peerId: viewerPeerId, name: viewerName }]);
          }

          if (msg.type === "viewer-peer-ready") {
            const viewerWsId = msg.viewerWsPeerId as string;
            console.warn("HOST: creating RTCPeerConnection for viewer", viewerWsId, "stream v:", stream.getVideoTracks().length, "a:", stream.getAudioTracks().length);
            const viewerIce = await getIceServers();
            const vpc = new RTCPeerConnection({ iceServers: viewerIce } as RTCConfiguration);
            
            stream.getTracks().forEach(t => {
              vpc.addTrack(t, stream);
              console.warn("HOST: added track", t.kind, t.readyState);
            });

            vpc.onicecandidate = (e) => {
              if (e.candidate) ws.send(JSON.stringify({ type: "live-ice", candidate: e.candidate, targetPeerId: viewerWsId }));
            };
            vpc.oniceconnectionstatechange = () => {
              console.warn("HOST ICE state for viewer:", vpc.iceConnectionState);
              if (vpc.iceConnectionState === "failed" || vpc.iceConnectionState === "disconnected") {
                setViewerCount(c => Math.max(0, c - 1));
                vpc.close();
              }
            };

            const offer = await vpc.createOffer();
            await vpc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: "live-offer", offer, targetPeerId: viewerWsId }));
            setViewerCount(c => c + 1);

            const handleAnswer = async (event: MessageEvent) => {
              try {
                const m = JSON.parse(event.data);

                if (m.type === "live-answer" && m.fromPeerId === viewerWsId) {
                  await vpc.setRemoteDescription(new RTCSessionDescription(m.answer));

                  const pending = pendingIceMap.current.get(viewerWsId) || [];
                  for (const ice of pending) {
                    try {
                      await vpc.addIceCandidate(new RTCIceCandidate(ice));
                    } catch (err) {
                      console.warn("HOST: failed to add pending ICE candidate", err);
                    }
                  }
                  pendingIceMap.current.delete(viewerWsId);
                }

                if (m.type === "live-ice" && m.fromPeerId === viewerWsId) {
                  if (vpc.remoteDescription) {
                    try {
                      await vpc.addIceCandidate(new RTCIceCandidate(m.candidate));
                    } catch (err) {
                      console.warn("HOST: failed to add ICE candidate", err);
                    }
                  } else {
                    const pending = pendingIceMap.current.get(viewerWsId) ?? [];
                    pending.push(m.candidate);
                    pendingIceMap.current.set(viewerWsId, pending);
                  }
                }
              } catch {}
            };
            ws.addEventListener("message", handleAnswer);
          }

          if (msg.type === "viewer-left") {
            const leftPeerId = msg.viewerPeerId as string;
            setViewers(prev => prev.filter(v => v.peerId !== leftPeerId));
          }

          if (msg.type === "stage-offer") {
            const cohostPeerId = msg.fromPeerId as string;
            const iceServersForStage = await getIceServers();
            const pc = new RTCPeerConnection({ iceServers: iceServersForStage } as RTCConfiguration);
            cohostPcRef.current = pc;
            pc.ontrack = (e) => {
              const s = e.streams[0] || (() => { const ms = new MediaStream(); if (e.track) ms.addTrack(e.track); return ms; })();
              cohostStreamRef.current = s;
              setCohostStream(s);
              setCohostVisible(true);
              distributeCohost(s, ws);
            };
            pc.onicecandidate = (e) => {
              if (e.candidate) ws.send(JSON.stringify({ type: "stage-ice", candidate: e.candidate, targetPeerId: cohostPeerId }));
            };
            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "stage-answer", answer, targetPeerId: cohostPeerId }));
          }

          if (msg.type === "stage-ice") {
            if (cohostPcRef.current) { try { await cohostPcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {} }
          }

          if (msg.type === "stage-left") {
            if (cohostPcRef.current) { cohostPcRef.current.close(); cohostPcRef.current = null; }
            cohostStreamRef.current = null;
            cohostViewerPcsRef.current.forEach(pc => pc.close());
            cohostViewerPcsRef.current.clear();
            setCohostVisible(false);
            setCohostStream(null);
          }

          if (msg.type === "cohost-answer") {
            const pc = cohostViewerPcsRef.current.get(msg.fromPeerId as string);
            if (pc) { try { await pc.setRemoteDescription(new RTCSessionDescription(msg.answer)); } catch {} }
          }

          if (msg.type === "cohost-ice") {
            const pc = cohostViewerPcsRef.current.get(msg.fromPeerId as string);
            if (pc && pc.remoteDescription) { try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {} }
          }
        };
        ws.onclose = () => {};
      });

      
    };

    startBroadcast();
    return () => { cleanupMedia(); };
  }, [visible, live]);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => { cleanup(); onClose(); }}>
      <View style={[styles.liveContainer, StyleSheet.absoluteFill]}>
        {Platform.OS === "web" ? (
          <View style={StyleSheet.absoluteFill}>
            <WebVideoEl
              stream={localStream}
              muted={true}
              mirrored={true}
              videoRef={hostVideoRef}
              filter={CAM_FILTERS.find(f => f.id === activeFilter)?.css || ""}
              elId="vibe-host-main-video"
            />
          </View>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111", alignItems: "center", justifyContent: "center", gap: 12 }]}>
            <Feather name="monitor" size={48} color={Colors.textMuted} />
            <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 14, color: Colors.textMuted }}>Live tylko w web</Text>
          </View>
        )}

        

        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={styles.liveBadgeTop}>
              {broadcasting && <View style={styles.liveDotTop} />}
              <Text style={styles.liveBadgeTopText}>{broadcasting ? "LIVE" : "Łączę..."}</Text>
            </View>
            <View style={styles.viewerCountChip}>
              <Feather name="eye" size={11} color="rgba(255,255,255,0.85)" />
              <Text style={styles.viewerCountChipText}>{viewerCount}</Text>
            </View>
          </View>
          <View style={styles.topBarRight}>
            <Pressable
              style={[styles.topIconBtn, showViewers && styles.topIconBtnActive]}
              onPress={() => { setShowViewers(s => !s); Haptics.selectionAsync(); }}
            >
              <Feather name="users" size={15} color={showViewers ? Colors.black : "#fff"} />
            </Pressable>
            {Platform.OS === "web" && (
              <Pressable
                style={[styles.topIconBtn, showFilters && styles.topIconBtnActive]}
                onPress={() => { setShowFilters(s => !s); Haptics.selectionAsync(); }}
              >
                <Feather name="sliders" size={15} color={showFilters ? Colors.black : "#fff"} />
              </Pressable>
            )}
            <Pressable
              style={[styles.topIconBtn, { backgroundColor: Colors.danger }]}
              onPress={() => { cleanup(); onClose(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }}
            >
              <Feather name="x" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>

        {showViewers && (
          <Animated.View entering={FadeInDown} exiting={FadeOut} style={styles.viewersDropdown}>
            <Text style={styles.viewersDropdownTitle}>Widzowie {viewers.length > 0 ? `(${viewers.length})` : ""}</Text>
            {viewers.length === 0 ? (
              <Text style={styles.viewersEmptyText}>Nikt jeszcze nie dołączył</Text>
            ) : (
              viewers.map(v => (
                <View key={v.peerId} style={styles.viewerRow}>
                  <View style={styles.viewerDot} />
                  <Text style={styles.viewerRowName} numberOfLines={1}>{v.name}</Text>
                  <Pressable style={styles.inviteBtn} onPress={() => inviteToStage(v.peerId)}>
                    <Feather name="mic" size={11} color={Colors.black} />
                    <Text style={styles.inviteBtnText}>Scena</Text>
                  </Pressable>
                </View>
              ))
            )}
          </Animated.View>
        )}

        {showFilters && Platform.OS === "web" && (
          <Animated.View entering={FadeInDown} exiting={FadeOut} style={styles.filtersDropdown}>
            <Text style={styles.filtersDropdownTitle}>Filtry kamery</Text>
            <View style={styles.filtersGrid}>
              {CAM_FILTERS.map(f => (
                <Pressable
                  key={f.id}
                  style={[styles.filterChip, activeFilter === f.id && styles.filterChipActive]}
                  onPress={() => { applyFilter(f.id); setShowFilters(false); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.filterChipText, activeFilter === f.id && styles.filterChipTextActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {showChat && (
          <View style={styles.commentsOverlay} pointerEvents="none">
            <FlatList
              ref={chatListRef}
              data={chatMessages}
              keyExtractor={m => m.id}
              style={styles.commentsFlatList}
              contentContainerStyle={{ gap: 5, paddingVertical: 4 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <Text style={styles.commentSender}>{item.name} </Text>
                  <Text style={styles.commentText}>{item.text}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.chatEmptyText}>Czat widzów pojawi się tutaj</Text>}
            />
          </View>
        )}

        {floatingGifts.map(g => (
          <FloatingGiftBubble
            key={g.id}
            emoji={g.emoji}
            x={g.x}
            onDone={() => setFloatingGifts(prev => prev.filter(fg => fg.id !== g.id))}
          />
        ))}

        <View style={styles.giftToastsContainer} pointerEvents="none">
          {giftToasts.map(t => (
            <GiftToastBubble
              key={t.id}
              toast={t}
              onDone={() => setGiftToasts(prev => prev.filter(gt => gt.id !== t.id))}
            />
          ))}
        </View>

        {cohostVisible && Platform.OS === "web" && (
          <View style={[styles.cohostPip, { overflow: "hidden" }]}>
            <WebVideoEl stream={cohostStream} muted={false} elId="vibe-host-cohost-video" />
          </View>
        )}

        {broadcastError ? (
          <View style={styles.broadcastErrorBox}>
            <Feather name="alert-triangle" size={20} color={Colors.danger} />
            <Text style={styles.broadcastErrorText}>{broadcastError}</Text>
            <Pressable style={styles.broadcastErrorClose} onPress={() => { endLive(); onClose(); }}>
              <Text style={styles.broadcastErrorCloseText}>Zamknij</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.hostBottomBar}>
          <Pressable
            style={[styles.hostBarBtn, showChat && styles.hostBarBtnActive]}
            onPress={() => { setShowChat(s => !s); Haptics.selectionAsync(); }}
          >
            <Feather name="message-circle" size={17} color={showChat ? Colors.black : "#fff"} />
            <Text style={[styles.hostBarBtnText, showChat && { color: Colors.black }]}>Czat</Text>
          </Pressable>

          <Pressable
            style={[styles.hostBarBtn, !micOn && { backgroundColor: "rgba(255,59,92,0.18)", borderWidth: 1, borderColor: "rgba(255,59,92,0.4)" }]}
            onPress={toggleMic}
          >
            <Feather name={micOn ? "mic" : "mic-off"} size={17} color={micOn ? "#fff" : Colors.danger} />
          </Pressable>

          <Pressable
            style={[styles.hostBarBtn, !cameraOn && { backgroundColor: "rgba(255,59,92,0.18)", borderWidth: 1, borderColor: "rgba(255,59,92,0.4)" }]}
            onPress={toggleCamera}
          >
            <Feather name={cameraOn ? "video" : "video-off"} size={17} color={cameraOn ? "#fff" : Colors.danger} />
          </Pressable>

          <Pressable
            style={styles.endLiveBtn}
            onPress={() => { endLive(); onClose(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }}
          >
            <View style={styles.endLiveDot} />
            <Text style={styles.endLiveBtnText}>Zakończ live</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function StartLiveModal({ visible, onClose, onStart }: { visible: boolean; onClose: () => void; onStart: (title: string) => void }) {
  const [title, setTitle] = useState("");
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.startLiveOverlay}>
        <Animated.View entering={FadeIn} style={styles.startLiveBox}>
          <Pressable style={styles.startLiveClose} onPress={onClose}>
            <Feather name="x" size={20} color={Colors.textSecondary} />
          </Pressable>
          <View style={styles.startLiveIconWrap}>
            <View style={styles.startLiveDot} />
            <Feather name="radio" size={26} color="#fff" />
          </View>
          <Text style={styles.startLiveTitle}>Zacznij Live</Text>
          <Text style={styles.startLiveSub}>Inni zobaczą Twoje wideo na żywo i mogą wysyłać Ci prezenty.</Text>
          <TextInput
            style={styles.startLiveInput}
            placeholder="Tytuł live'a..."
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />
          <Pressable
            style={({ pressed }) => [styles.startLiveBtn, pressed && { opacity: 0.85 }]}
            onPress={() => { if (title.trim()) { onStart(title.trim()); onClose(); setTitle(""); } }}
            disabled={!title.trim()}
          >
            <View style={styles.startLiveDotBtn} />
            <Text style={styles.startLiveBtnText}>Idź na żywo</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function LiveCard({ live, index, onJoin }: { live: Live; index: number; onJoin: (live: Live) => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable style={styles.liveCard} onPress={() => onJoin(live)}>
        <View style={styles.liveThumb}>
          <Image source={{ uri: live.host.photoUrl }} style={styles.liveThumbImg} />
          <View style={styles.liveBadgeCard}>
            <View style={styles.liveDotCard} />
            <Text style={styles.liveBadgeCardText}>LIVE</Text>
          </View>
          <View style={styles.liveViewersCard}>
            <Feather name="eye" size={11} color="rgba(255,255,255,0.85)" />
            <Text style={styles.liveViewersCardText}>{live.viewerCount}</Text>
          </View>
        </View>
        <View style={styles.liveInfo}>
          <Text style={styles.liveTitle} numberOfLines={1}>{live.title}</Text>
          <View style={styles.liveHostRow}>
            <Image source={{ uri: live.host.photoUrl }} style={styles.liveHostAvatar} />
            <Text style={styles.liveHostName}>
              {live.host.name}{live.host.username ? ` @${live.host.username}` : ""}
            </Text>
            {live.host.isVerified && (
              <View style={styles.verifiedBadge}><Feather name="check" size={8} color="#fff" /></View>
            )}
          </View>
          {live.host.city ? (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={10} color={Colors.textMuted} />
              <Text style={styles.locationText}>{live.host.city}</Text>
            </View>
          ) : null}
        </View>
        <Pressable style={styles.joinBtn} onPress={() => onJoin(live)}>
          <Text style={styles.joinBtnText}>Dołącz</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export default function LivesScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser } = useUserContext();
  const queryClient = useQueryClient();
  const [selectedLive, setSelectedLive] = useState<Live | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [activeLive, setActiveLive] = useState<{ id: number; title: string } | null>(null);
  const [broadcastVisible, setBroadcastVisible] = useState(false);
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const { data: lives = [], isLoading } = useQuery<Live[]>({
    queryKey: ["lives"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/lives`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5000,
  });

  const startLiveMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch(`${BASE_URL}/lives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: currentUser?.id, title }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lives"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setActiveLive({ id: data.id, title: data.title });
      setBroadcastVisible(true);
    },
  });

  const handleJoin = (live: Live) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLive(live);
    setViewerVisible(true);
  };

  return (
    <View style={[styles.screen, { paddingTop: topInset }]}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Na żywo</Text>
        <Pressable
          style={styles.goLiveBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowStartModal(true); }}
        >
          <View style={styles.goLiveDot} />
          <Text style={styles.goLiveBtnText}>Idź live</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : lives.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Feather name="radio" size={30} color="#fff" />
          </View>
          <Text style={styles.emptyTitle}>Brak live'ów</Text>
          <Text style={styles.emptyText}>Bądź pierwszy! Zacznij swój live.</Text>
          <Pressable style={styles.startEmptyBtn} onPress={() => setShowStartModal(true)}>
            <View style={styles.goLiveDot} />
            <Text style={styles.startEmptyBtnText}>Zacznij live</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={lives}
          keyExtractor={l => String(l.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
          renderItem={({ item, index }) => (
            <LiveCard live={item} index={index} onJoin={handleJoin} />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      <LiveViewerModal
        live={selectedLive}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        currentUser={currentUser}
      />
      <HostBroadcastModal
        live={activeLive}
        visible={broadcastVisible}
        onClose={() => { setBroadcastVisible(false); setActiveLive(null); }}
      />
      <StartLiveModal
        visible={showStartModal}
        onClose={() => setShowStartModal(false)}
        onStart={(title) => startLiveMutation.mutate(title)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.black },
  screenHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
  screenTitle: { fontFamily: "Montserrat_700Bold", fontSize: 26, color: Colors.textPrimary },
  goLiveBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.danger, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 24 },
  goLiveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#fff" },
  goLiveBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: "#fff" },
  list: { paddingHorizontal: 16, gap: 12, paddingTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.danger, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: "Montserrat_700Bold", fontSize: 20, color: Colors.textPrimary },
  emptyText: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  startEmptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.danger, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, marginTop: 4 },
  startEmptyBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: "#fff" },

  liveCard: { backgroundColor: Colors.cardBg, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", flexDirection: "row", alignItems: "center" },
  liveThumb: { width: 100, height: 90, position: "relative" },
  liveThumbImg: { width: "100%", height: "100%", resizeMode: "cover" },
  liveBadgeCard: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.danger, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  liveDotCard: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#fff" },
  liveBadgeCardText: { fontFamily: "Montserrat_700Bold", fontSize: 9, color: "#fff", letterSpacing: 1 },
  liveViewersCard: { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  liveViewersCardText: { fontFamily: "Montserrat_600SemiBold", fontSize: 10, color: "#fff" },
  liveInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, gap: 6 },
  liveTitle: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: Colors.textPrimary },
  liveHostRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveHostAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.surface },
  liveHostName: { fontFamily: "Montserrat_500Medium", fontSize: 12, color: Colors.textSecondary },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textMuted },
  joinBtn: { backgroundColor: Colors.accent, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, marginRight: 12 },
  joinBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: Colors.black },
  verifiedBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#1d9bf0", alignItems: "center", justifyContent: "center" },

  liveContainer: { flex: 1, backgroundColor: "#000" },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 110, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 1 },
  bottomGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 180, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 1 },

  connectingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.82)", alignItems: "center", justifyContent: "center", zIndex: 10 },
  connectingAvatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: Colors.danger },
  connectingText: { fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: "#fff", marginTop: 14 },

  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10, zIndex: 10 },
  topBarLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  hostAvatarTop: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: Colors.danger },
  hostNameTop: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: "#fff", maxWidth: 120 },
  liveTitleTop: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: "rgba(255,255,255,0.7)", maxWidth: 140 },
  liveBadgeTop: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.danger, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  liveDotTop: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#fff" },
  liveBadgeTopText: { fontFamily: "Montserrat_700Bold", fontSize: 10, color: "#fff", letterSpacing: 1.5 },
  viewerCountChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  viewerCountChipText: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: "#fff" },
  followTopBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  followTopBtnDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  followTopBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 12, color: "#fff" },
  closeTopBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  topIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  topIconBtnActive: { backgroundColor: Colors.accent },

  rightActions: { position: "absolute", right: 12, bottom: 120, alignItems: "center", gap: 22, zIndex: 10 },
  rightActionBtn: { alignItems: "center", gap: 4 },
  rightActionEmoji: { fontSize: 30 },
  rightActionLabel: { fontFamily: "Montserrat_600SemiBold", fontSize: 10, color: "#fff", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  commentsOverlay: { position: "absolute", bottom: 68, left: 12, width: "60%", maxHeight: 200, zIndex: 10 },
  commentsFlatList: { maxHeight: 200 },
  commentRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 3, backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  commentSender: { fontFamily: "Montserrat_700Bold", fontSize: 12, color: Colors.accent },
  commentText: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: "#fff", flexShrink: 1 },
  chatEmptyText: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: "rgba(255,255,255,0.4)", padding: 4 },

  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 18, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 10 },
  commentInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  commentInput: { flex: 1, fontFamily: "Montserrat_400Regular", fontSize: 14, color: "#fff", paddingVertical: 0 },
  commentSendBtn: { marginLeft: 6 },
  bottomGiftBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },

  heartsContainer: { position: "absolute", right: 20, bottom: 100, width: 60, height: 280, zIndex: 20 },
  floatingHeart: { position: "absolute", bottom: 0, right: 0 },
  floatingHeartText: { fontSize: 30 },

  floatingGift: { position: "absolute", bottom: 160, zIndex: 200 },
  floatingGiftText: { fontSize: 56 },

  giftToastsContainer: { position: "absolute", left: 12, bottom: 80, gap: 8, zIndex: 50 },
  giftToast: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(20,20,20,0.9)", borderRadius: 30, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", maxWidth: 230 },
  giftToastEmoji: { fontSize: 28 },
  giftToastName: { fontFamily: "Montserrat_700Bold", fontSize: 12, color: "#fff" },
  giftToastLabel: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: "rgba(255,255,255,0.65)" },

  giftSheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  giftSheet: { backgroundColor: "#111", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 16 },
  giftSheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", alignSelf: "center", marginBottom: 14 },
  giftSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  giftSheetTitle: { fontFamily: "Montserrat_700Bold", fontSize: 17, color: "#fff" },
  giftCoinsChip: { backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  giftCoinsChipText: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.accent },
  giftGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  giftBtn: { alignItems: "center", gap: 4, padding: 12, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", width: 82 },
  giftBtnDisabled: { opacity: 0.35 },
  giftLabel: { fontFamily: "Montserrat_500Medium", fontSize: 10, color: "rgba(255,255,255,0.7)" },
  giftCost: { fontFamily: "Montserrat_700Bold", fontSize: 11, color: Colors.accent },

  cohostPip: { position: "absolute", top: 100, right: 12, width: 120, height: 180, borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: Colors.accent, backgroundColor: "#111", zIndex: 15 },
  myCamPip: { position: "absolute", top: 100, left: 12, width: 100, height: 160, borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: "#fff", backgroundColor: "#111", zIndex: 15 },

  stageInviteBox: { position: "absolute", bottom: 100, left: 20, right: 20, backgroundColor: "rgba(18,18,18,0.97)", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.accent, gap: 10, zIndex: 300 },
  stageInviteTitle: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: "#fff", textAlign: "center" },
  stageInviteText: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)", textAlign: "center" },
  stageInviteBtns: { flexDirection: "row", gap: 10, justifyContent: "center" },
  stageDeclineBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  stageDeclineBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  stageAcceptBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.accent, alignItems: "center" },
  stageAcceptBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: Colors.black },

  viewersDropdown: { position: "absolute", top: 62, right: 14, width: 220, backgroundColor: "rgba(12,12,12,0.97)", borderRadius: 16, padding: 14, gap: 8, zIndex: 50, borderWidth: 1, borderColor: Colors.border },
  viewersDropdownTitle: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: "#fff", marginBottom: 2 },
  viewersEmptyText: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textMuted },
  viewerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  viewerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  viewerRowName: { flex: 1, fontFamily: "Montserrat_500Medium", fontSize: 12, color: "#fff" },
  inviteBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  inviteBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 11, color: Colors.black },

  filtersDropdown: { position: "absolute", top: 62, right: 58, width: 210, backgroundColor: "rgba(12,12,12,0.97)", borderRadius: 16, padding: 14, gap: 8, zIndex: 50, borderWidth: 1, borderColor: Colors.border },
  filtersDropdownTitle: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: "#fff", marginBottom: 2 },
  filtersGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterChipText: { fontFamily: "Montserrat_500Medium", fontSize: 11, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.black },

  broadcastErrorBox: { position: "absolute", top: "40%", left: 24, right: 24, backgroundColor: "rgba(20,0,0,0.92)", borderRadius: 18, padding: 22, gap: 12, alignItems: "center", zIndex: 300, borderWidth: 1, borderColor: Colors.danger },
  broadcastErrorText: { fontFamily: "Montserrat_500Medium", fontSize: 14, color: "#fff", textAlign: "center" },
  broadcastErrorClose: { backgroundColor: Colors.danger, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 12 },
  broadcastErrorCloseText: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: "#fff" },
  hostBottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 24, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 10 },
  hostBarBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 },
  hostBarBtnActive: { backgroundColor: Colors.accent },
  hostBarBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: "#fff" },
  endLiveBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.danger, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 24 },
  endLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  endLiveBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: "#fff" },

  startLiveOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  startLiveBox: { backgroundColor: Colors.cardBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 48, borderTopWidth: 1, borderColor: Colors.border, gap: 14, alignItems: "center" },
  startLiveClose: { position: "absolute", top: 16, right: 20, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  startLiveIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.danger, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  startLiveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff" },
  startLiveDotBtn: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  startLiveTitle: { fontFamily: "Montserrat_700Bold", fontSize: 24, color: Colors.textPrimary },
  startLiveSub: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  startLiveInput: { width: "100%", backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 13, fontFamily: "Montserrat_500Medium", fontSize: 15, color: Colors.textPrimary },
  startLiveBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.danger, paddingHorizontal: 28, paddingVertical: 15, borderRadius: 14, width: "100%", justifyContent: "center" },
  startLiveBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: "#fff" },
});
