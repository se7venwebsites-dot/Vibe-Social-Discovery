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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeOut, useSharedValue, useAnimatedStyle, withTiming, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

const WS_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `wss://${process.env.EXPO_PUBLIC_DOMAIN}/api/ws`
  : `ws://localhost:8080/ws`;

const GIFTS = [
  { id: "heart", emoji: "❤️", label: "Serce", cost: 10, size: 34 },
  { id: "rose", emoji: "🌹", label: "Róża", cost: 15, size: 34 },
  { id: "fire", emoji: "🔥", label: "Ogień", cost: 25, size: 34 },
  { id: "star", emoji: "⭐", label: "Gwiazdka", cost: 30, size: 36 },
  { id: "diamond", emoji: "💎", label: "Diament", cost: 50, size: 38 },
  { id: "rainbow", emoji: "🌈", label: "Tęcza", cost: 75, size: 38 },
  { id: "crown", emoji: "👑", label: "Korona", cost: 100, size: 40 },
  { id: "rocket", emoji: "🚀", label: "Rakieta", cost: 200, size: 42 },
];

const CAM_FILTERS = [
  { id: "none", label: "Normal", css: "" },
  { id: "bw", label: "B&W", css: "grayscale(100%)" },
  { id: "sepia", label: "Sepia", css: "sepia(80%)" },
  { id: "cool", label: "Chłodny", css: "hue-rotate(180deg) saturate(120%)" },
  { id: "warm", label: "Ciepły", css: "hue-rotate(20deg) saturate(160%) brightness(105%)" },
  { id: "vivid", label: "Żywy", css: "saturate(200%) contrast(110%)" },
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

function LiveCard({ live, index, onJoin }: { live: Live; index: number; onJoin: (live: Live) => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable style={styles.liveCard} onPress={() => onJoin(live)}>
        <View style={styles.liveThumb}>
          <Image source={{ uri: live.host.photoUrl }} style={styles.liveThumbImg} />
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
          <View style={styles.liveViewers}>
            <Feather name="eye" size={11} color="rgba(255,255,255,0.8)" />
            <Text style={styles.liveViewersText}>{live.viewerCount}</Text>
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
              <View style={styles.verifiedBadge}>
                <Feather name="check" size={8} color="#fff" />
              </View>
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

function GiftPanel({ onSend, coins, disabled }: { onSend: (gift: typeof GIFTS[0]) => void; coins: number; disabled: boolean }) {
  return (
    <View style={styles.giftPanel}>
      <View style={styles.giftCoinsRow}>
        <Text style={styles.giftCoinsLabel}>💰 {coins} monet</Text>
        <Text style={styles.giftCoinsHint}>Dotknij, żeby wysłać</Text>
      </View>
      <View style={styles.giftGrid}>
        {GIFTS.map(gift => {
          const canAfford = coins >= gift.cost;
          return (
            <Pressable
              key={gift.id}
              style={[styles.giftBtn, (!canAfford || disabled) && styles.giftBtnDisabled]}
              onPress={() => onSend(gift)}
              disabled={disabled || !canAfford}
            >
              <Text style={{ fontSize: gift.size }}>{gift.emoji}</Text>
              <Text style={styles.giftLabel}>{gift.label}</Text>
              <View style={styles.giftCostRow}>
                <Text style={styles.giftCostIcon}>💰</Text>
                <Text style={[styles.giftCost, !canAfford && { color: Colors.textMuted }]}>{gift.cost}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LiveViewerModal({ live, visible, onClose, currentUser }: {
  live: Live | null;
  visible: boolean;
  onClose: () => void;
  currentUser: { id: number; name: string } | null;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const myPeerIdRef = useRef<string>("");
  const [connected, setConnected] = useState(false);
  const [addedFriend, setAddedFriend] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [floatingGifts, setFloatingGifts] = useState<FloatingGift[]>([]);
  const [coins, setCoins] = useState(200);
  const queryClient = useQueryClient();

  const cleanup = useCallback(() => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (Platform.OS === "web") {
      const container = document.getElementById("vibe-live-remote");
      if (container) container.innerHTML = "";
    }
    setConnected(false);
    if (live) {
      fetch(`${BASE_URL}/lives/${live.id}/viewers`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta: -1 }) }).catch(() => {});
    }
  }, [live]);

  useEffect(() => {
    if (!visible || !live) return;
    if (Platform.OS !== "web") return;

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
        // Viewer joined, waiting for host offer
      }

      if (msg.type === "live-offer") {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] });
        pcRef.current = pc;

        pc.ontrack = (e) => {
          const container = document.getElementById("vibe-live-remote");
          if (container) {
            let v = container.querySelector("video") as HTMLVideoElement | null;
            if (!v) {
              v = document.createElement("video");
              v.autoplay = true;
              v.playsInline = true;
              v.style.cssText = "width:100%;height:100%;object-fit:cover;";
              container.appendChild(v);
            }
            v.srcObject = e.streams[0];
            setConnected(true);
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            ws.send(JSON.stringify({ type: "live-ice", candidate: e.candidate, targetPeerId: msg.fromPeerId }));
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "live-answer", answer, targetPeerId: msg.fromPeerId }));
      }

      if (msg.type === "live-ice" && pcRef.current) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
      }

      if (msg.type === "live-error") {
        Alert.alert("Błąd", msg.error || "Nie można dołączyć do live'a");
        cleanup();
        onClose();
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = Math.random().toString(36).slice(2);
    const x = Math.random() * 60 + 10;
    setFloatingGifts(prev => [...prev, { id, emoji: gift.emoji, x }]);
    setTimeout(() => setFloatingGifts(prev => prev.filter(g => g.id !== id)), 3000);
  }, [coins]);

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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { cleanup(); onClose(); }}>
      <View style={styles.liveViewerContainer}>
        {Platform.OS === "web" ? (
          <View nativeID="vibe-live-remote" style={styles.liveVideoFill} />
        ) : (
          <View style={[styles.liveVideoFill, styles.nativePlaceholder]}>
            <Feather name="monitor" size={48} color={Colors.textMuted} />
            <Text style={styles.nativePlaceholderText}>Live dostępny w wersji web</Text>
          </View>
        )}

        {Platform.OS === "web" && !connected && (
          <View style={styles.liveConnectingOverlay}>
            <ActivityIndicator color={Colors.accent} size="large" />
            <Text style={styles.liveConnectingText}>Łączę z live...</Text>
          </View>
        )}

        {/* Floating gifts */}
        {floatingGifts.map(g => (
          <Animated.View key={g.id} entering={FadeInDown.springify()} exiting={FadeOut} style={[styles.floatingGift, { left: `${g.x}%` as any }]}>
            <Text style={styles.floatingGiftText}>{g.emoji}</Text>
          </Animated.View>
        ))}

        {live && (
          <View style={styles.liveViewerHeader}>
            <Pressable style={styles.liveViewerClose} onPress={() => { cleanup(); onClose(); }}>
              <Feather name="x" size={22} color={Colors.textPrimary} />
            </Pressable>
            <View style={styles.liveViewerHostInfo}>
              <Image source={{ uri: live.host.photoUrl }} style={styles.liveViewerHostAvatar} />
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={styles.liveViewerHostName}>{live.host.name}</Text>
                  {live.host.isVerified && <View style={styles.verifiedBadgeSm}><Feather name="check" size={8} color="#fff" /></View>}
                </View>
                <Text style={styles.liveViewerTitle}>{live.title}</Text>
              </View>
            </View>
            <View style={styles.liveViewerCount}>
              <View style={styles.liveDotSmall} />
              <Text style={styles.liveViewerCountText}>{live.viewerCount}</Text>
            </View>
          </View>
        )}

        <View style={styles.liveViewerActions}>
          <Pressable
            style={[styles.addFriendBtn, addedFriend && styles.addFriendBtnDone]}
            onPress={handleAddFriend}
            disabled={addedFriend}
          >
            <Feather name={addedFriend ? "check" : "user-plus"} size={16} color={addedFriend ? Colors.black : Colors.textPrimary} />
            <Text style={[styles.addFriendBtnText, addedFriend && { color: Colors.black }]}>
              {addedFriend ? "Zaproszono!" : "Dodaj znajomego"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.giftToggleBtn}
            onPress={() => { setShowGifts(s => !s); Haptics.selectionAsync(); }}
          >
            <Text style={{ fontSize: 18 }}>🎁</Text>
          </Pressable>
        </View>

        {showGifts && (
          <Animated.View entering={FadeInDown} exiting={FadeOut} style={styles.giftPanelWrap}>
            <GiftPanel onSend={handleSendGift} coins={coins} disabled={false} />
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

function HostBroadcastModal({ live, visible, onClose }: { live: { id: number; title: string } | null; visible: boolean; onClose: () => void }) {
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const viewerPcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const myPeerIdRef = useRef<string>("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState("none");
  const [showFilters, setShowFilters] = useState(false);
  const queryClient = useQueryClient();

  const applyFilter = useCallback((filterId: string) => {
    setActiveFilter(filterId);
    if (Platform.OS !== "web") return;
    const container = document.getElementById("vibe-host-video");
    const video = container?.querySelector("video") as HTMLVideoElement | null;
    if (video) {
      const filter = CAM_FILTERS.find(f => f.id === filterId);
      video.style.filter = filter?.css || "";
    }
  }, []);

  const cleanup = useCallback(() => {
    viewerPcsRef.current.forEach(pc => pc.close());
    viewerPcsRef.current.clear();
    if (wsRef.current) { wsRef.current.send(JSON.stringify({ type: "end-live" })); wsRef.current.close(); wsRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (Platform.OS === "web") {
      const c = document.getElementById("vibe-host-video");
      if (c) c.innerHTML = "";
    }
    if (live) {
      fetch(`${BASE_URL}/lives/${live.id}/end`, { method: "PATCH" }).catch(() => {});
    }
    setBroadcasting(false);
    setViewerCount(0);
    queryClient.invalidateQueries({ queryKey: ["lives"] });
  }, [live]);

  useEffect(() => {
    if (!visible || !live || Platform.OS !== "web") return;

    const startBroadcast = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        const c = document.getElementById("vibe-host-video");
        if (c) {
          c.innerHTML = "";
          const v = document.createElement("video");
          v.autoplay = true; v.muted = true; v.playsInline = true;
          v.style.cssText = "width:100%;height:100%;object-fit:cover;";
          v.srcObject = stream;
          c.appendChild(v);
        }
        setBroadcasting(true);
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "join-live", liveId: live.id, role: "host" }));
        };
        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "connected") { myPeerIdRef.current = msg.peerId; }
          if (msg.type === "viewer-joined") {
            const viewerPeerId = msg.viewerPeerId as string;
            setViewerCount(c => c + 1);
            const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
            viewerPcsRef.current.set(viewerPeerId, pc);
            localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
            pc.onicecandidate = (e) => {
              if (e.candidate) ws.send(JSON.stringify({ type: "live-ice", candidate: e.candidate, targetPeerId: viewerPeerId }));
            };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: "live-offer", offer, targetPeerId: viewerPeerId }));
          }
          if (msg.type === "live-answer") {
            const pc = viewerPcsRef.current.get(msg.fromPeerId);
            if (pc) { try { await pc.setRemoteDescription(new RTCSessionDescription(msg.answer)); } catch {} }
          }
          if (msg.type === "live-ice") {
            const pc = viewerPcsRef.current.get(msg.fromPeerId);
            if (pc) { try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {} }
          }
          if (msg.type === "viewer-left") {
            const pc = viewerPcsRef.current.get(msg.viewerPeerId);
            if (pc) { pc.close(); viewerPcsRef.current.delete(msg.viewerPeerId); }
            setViewerCount(c => Math.max(0, c - 1));
          }
        };
        ws.onclose = () => setBroadcasting(false);
      } catch (e: unknown) {
        const err = e as Error;
        Alert.alert("Błąd kamery", err.name === "NotAllowedError" ? "Zezwól na dostęp do kamery." : "Nie udało się uruchomić kamery.");
        onClose();
      }
    };

    startBroadcast();
    return () => { cleanup(); };
  }, [visible, live]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { cleanup(); onClose(); }}>
      <View style={styles.liveViewerContainer}>
        {Platform.OS === "web" ? (
          <View nativeID="vibe-host-video" style={styles.liveVideoFill} />
        ) : (
          <View style={[styles.liveVideoFill, styles.nativePlaceholder]}>
            <Feather name="monitor" size={48} color={Colors.textMuted} />
            <Text style={styles.nativePlaceholderText}>Streaming dostępny w wersji web</Text>
          </View>
        )}

        <View style={styles.liveViewerHeader}>
          <View style={styles.liveBroadcastBadge}>
            {broadcasting && <View style={styles.liveDot} />}
            <Text style={styles.liveBadgeText}>{broadcasting ? "LIVE" : "Łączę..."}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={styles.liveViewerCount}>
            <Feather name="eye" size={13} color={Colors.textPrimary} />
            <Text style={styles.liveViewerCountText}>{viewerCount}</Text>
          </View>
        </View>

        {showFilters && Platform.OS === "web" && (
          <Animated.View entering={FadeInDown} exiting={FadeOut} style={styles.filterBar}>
            {CAM_FILTERS.map(f => (
              <Pressable
                key={f.id}
                style={[styles.filterBtn, activeFilter === f.id && styles.filterBtnActive]}
                onPress={() => { applyFilter(f.id); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.filterBtnText, activeFilter === f.id && styles.filterBtnTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </Animated.View>
        )}

        <View style={styles.liveViewerActions}>
          {Platform.OS === "web" && (
            <Pressable
              style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]}
              onPress={() => { setShowFilters(s => !s); Haptics.selectionAsync(); }}
            >
              <Feather name="sliders" size={16} color={showFilters ? Colors.black : Colors.textPrimary} />
              <Text style={[styles.filterToggleBtnText, showFilters && { color: Colors.black }]}>Filtry</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.endLiveBtn]}
            onPress={() => { cleanup(); onClose(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }}
          >
            <Feather name="x-circle" size={18} color="#fff" />
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
            <Feather name="radio" size={28} color="#fff" />
          </View>
          <Text style={styles.startLiveTitle}>Zacznij Live</Text>
          <Text style={styles.startLiveSub}>Inni zobaczą Twoje wideo na żywo i mogą Cię dodać do znajomych.</Text>
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
            onPress={() => { if (title.trim()) { onStart(title.trim()); onClose(); } }}
            disabled={!title.trim()}
          >
            <Feather name="radio" size={16} color="#fff" />
            <Text style={styles.startLiveBtnText}>Idź na żywo</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
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
    refetchInterval: 10000,
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
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Na żywo</Text>
        <Pressable
          style={styles.startBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowStartModal(true); }}
        >
          <Feather name="radio" size={14} color="#fff" />
          <Text style={styles.startBtnText}>Idź live</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : lives.length === 0 ? (
        <View style={styles.center}>
          <Feather name="radio" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Brak live'ów</Text>
          <Text style={styles.emptyText}>Bądź pierwszy! Zacznij swój live.</Text>
          <Pressable style={styles.startEmptyBtn} onPress={() => setShowStartModal(true)}>
            <Feather name="radio" size={16} color="#fff" />
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
  container: { flex: 1, backgroundColor: Colors.black },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
  title: { fontFamily: "Montserrat_700Bold", fontSize: 26, color: Colors.textPrimary },
  startBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.danger, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  startBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: "#fff" },
  list: { paddingHorizontal: 16, gap: 12, paddingTop: 4 },
  liveCard: { backgroundColor: Colors.cardBg, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", flexDirection: "row", alignItems: "center" },
  liveThumb: { width: 100, height: 90, position: "relative" },
  liveThumbImg: { width: "100%", height: "100%", resizeMode: "cover" },
  liveBadge: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.danger, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  liveBroadcastBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.danger, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveBadgeText: { fontFamily: "Montserrat_700Bold", fontSize: 9, color: "#fff", letterSpacing: 1 },
  liveViewers: { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  liveViewersText: { fontFamily: "Montserrat_600SemiBold", fontSize: 10, color: "#fff" },
  liveInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, gap: 6 },
  liveTitle: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: Colors.textPrimary },
  liveHostRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveHostAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.surface },
  liveHostName: { fontFamily: "Montserrat_500Medium", fontSize: 12, color: Colors.textSecondary },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textMuted },
  joinBtn: { backgroundColor: Colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginRight: 12 },
  joinBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: Colors.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontFamily: "Montserrat_700Bold", fontSize: 20, color: Colors.textPrimary },
  emptyText: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  startEmptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.danger, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  startEmptyBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: "#fff" },
  liveViewerContainer: { flex: 1, backgroundColor: "#000" },
  liveVideoFill: { flex: 1, backgroundColor: "#0a0a0a" },
  nativePlaceholder: { alignItems: "center", justifyContent: "center", gap: 12 },
  nativePlaceholderText: { fontFamily: "Montserrat_500Medium", fontSize: 14, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 32 },
  liveConnectingOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.8)", gap: 16 },
  liveConnectingText: { fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: Colors.textPrimary },
  liveViewerHeader: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "rgba(0,0,0,0.5)", gap: 12 },
  liveViewerClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  liveViewerHostInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  liveViewerHostAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: Colors.danger },
  liveViewerHostName: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: Colors.textPrimary },
  liveViewerTitle: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textSecondary },
  liveViewerCount: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.danger },
  liveViewerCountText: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.textPrimary },
  liveViewerActions: { position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 20 },
  addFriendBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  addFriendBtnDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  addFriendBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.textPrimary },
  giftToggleBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  giftPanelWrap: { position: "absolute", bottom: 100, left: 16, right: 16 },
  giftPanel: { backgroundColor: "rgba(20,20,20,0.95)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  giftCoinsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  giftCoinsLabel: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.accent },
  giftCoinsHint: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textMuted },
  giftGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  giftBtn: { alignItems: "center", gap: 3, padding: 10, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, width: 78 },
  giftBtnDisabled: { opacity: 0.35 },
  giftLabel: { fontFamily: "Montserrat_500Medium", fontSize: 10, color: Colors.textSecondary },
  giftCostRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  giftCostIcon: { fontSize: 10 },
  giftCost: { fontFamily: "Montserrat_700Bold", fontSize: 11, color: Colors.accent },
  floatingGift: { position: "absolute", bottom: 160, zIndex: 100 },
  floatingGiftText: { fontSize: 42 },
  filterBar: { position: "absolute", bottom: 100, left: 16, right: 16, flexDirection: "row", gap: 8, backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: Colors.border, flexWrap: "wrap" },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  filterBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  filterBtnTextActive: { color: Colors.black },
  filterToggleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  filterToggleBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterToggleBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: Colors.textPrimary },
  endLiveBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.danger, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30 },
  endLiveBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: "#fff" },
  startLiveOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  startLiveBox: { backgroundColor: Colors.cardBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 44, borderTopWidth: 1, borderColor: Colors.border, gap: 14, alignItems: "center" },
  startLiveClose: { position: "absolute", top: 16, right: 20, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  startLiveIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.danger, alignItems: "center", justifyContent: "center" },
  startLiveTitle: { fontFamily: "Montserrat_700Bold", fontSize: 24, color: Colors.textPrimary },
  startLiveSub: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  startLiveInput: { width: "100%", backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 13, fontFamily: "Montserrat_500Medium", fontSize: 15, color: Colors.textPrimary },
  startLiveBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.danger, paddingHorizontal: 28, paddingVertical: 15, borderRadius: 14, width: "100%", justifyContent: "center" },
  startLiveBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: "#fff" },
  verifiedBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#1d9bf0", alignItems: "center", justifyContent: "center" },
  verifiedBadgeSm: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#1d9bf0", alignItems: "center", justifyContent: "center" },
});
