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
import Animated, { FadeIn, FadeInDown, FadeOut, useSharedValue, useAnimatedStyle, withTiming, withSpring, withSequence, withDelay, runOnJS } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

const WS_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `wss://${process.env.EXPO_PUBLIC_DOMAIN}/api/ws`
  : `ws://localhost:8080/ws`;

const GIFTS = [
  { id: "heart", emoji: "❤️", label: "Serce", cost: 100, size: 34 },
  { id: "rose", emoji: "🌹", label: "Róża", cost: 250, size: 34 },
  { id: "fire", emoji: "🔥", label: "Ogień", cost: 500, size: 34 },
  { id: "star", emoji: "⭐", label: "Gwiazdka", cost: 750, size: 36 },
  { id: "diamond", emoji: "💎", label: "Diament", cost: 1500, size: 38 },
  { id: "rainbow", emoji: "🌈", label: "Tęcza", cost: 3000, size: 38 },
  { id: "crown", emoji: "👑", label: "Korona", cost: 5000, size: 40 },
  { id: "rocket", emoji: "🚀", label: "Rakieta", cost: 10000, size: 42 },
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

function FloatingGiftBubble({ emoji, x, onDone }: { emoji: string; x: number; onDone: () => void }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 60;
    opacity.value = withSequence(
      withTiming(1, { duration: 250 }),
      withDelay(1800, withTiming(0, { duration: 800 }))
    );
    scale.value = withSequence(
      withSpring(1.5, { damping: 6, stiffness: 200 }),
      withTiming(1.1, { duration: 400 }),
      withDelay(1400, withTiming(0.7, { duration: 800 }))
    );
    translateY.value = withTiming(-320, { duration: 2800 });
    translateX.value = withSequence(
      withTiming(drift * 0.4, { duration: 700 }),
      withTiming(drift, { duration: 700 }),
      withTiming(drift * 0.7, { duration: 700 }),
      withTiming(drift * 1.1, { duration: 600 })
    );
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.floatingGift, { left: `${x}%` as any }, style]}>
      <Text style={styles.floatingGiftText}>{emoji}</Text>
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
  const [showChat, setShowChat] = useState(true);
  const [chatMessages, setChatMessages] = useState<{ id: string; name: string; text: string }[]>([]);
  const [chatText, setChatText] = useState("");
  const [floatingGifts, setFloatingGifts] = useState<FloatingGift[]>([]);
  const [coins, setCoins] = useState(2000);
  const chatListRef = useRef<any>(null);
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

      if (msg.type === "live-chat") {
        if ((msg.name as string) !== currentUser?.name) {
          const chatMsg = { id: Math.random().toString(36).slice(2), name: msg.name as string, text: msg.text as string };
          setChatMessages(prev => [...prev.slice(-99), chatMsg]);
        }
      }

      if (msg.type === "live-gift") {
        const fid = Math.random().toString(36).slice(2);
        const fx = Math.random() * 55 + 5;
        setFloatingGifts(prev => [...prev, { id: fid, emoji: msg.emoji as string, x: fx }]);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const id = Math.random().toString(36).slice(2);
    const x = Math.random() * 55 + 5;
    setFloatingGifts(prev => [...prev, { id, emoji: gift.emoji, x }]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "live-gift", senderName: currentUser?.name || "Widz", emoji: gift.emoji, cost: gift.cost }));
    }
  }, [coins, currentUser]);

  const sendChat = useCallback(() => {
    const trimmed = chatText.trim();
    if (!trimmed || !wsRef.current) return;
    const myName = currentUser?.name || "Widz";
    const newMsg = { id: `local_${Date.now()}`, name: myName, text: trimmed };
    setChatMessages(prev => [...prev.slice(-99), newMsg]);
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
          <FloatingGiftBubble
            key={g.id}
            emoji={g.emoji}
            x={g.x}
            onDone={() => setFloatingGifts(prev => prev.filter(fg => fg.id !== g.id))}
          />
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

        {/* Viewer action buttons */}
        <View style={styles.liveViewerActions}>
          <Pressable
            style={[styles.addFriendBtn, addedFriend && styles.addFriendBtnDone]}
            onPress={handleAddFriend}
            disabled={addedFriend}
          >
            <Feather name={addedFriend ? "check" : "user-plus"} size={16} color={addedFriend ? Colors.black : Colors.textPrimary} />
          </Pressable>

          <Pressable
            style={[styles.liveIconBtn, showChat && styles.liveIconBtnActive]}
            onPress={() => { setShowChat(s => !s); Haptics.selectionAsync(); }}
          >
            <Feather name="message-circle" size={18} color={showChat ? Colors.black : Colors.textPrimary} />
          </Pressable>

          <Pressable
            style={styles.giftToggleBtn}
            onPress={() => { setShowGifts(s => !s); Haptics.selectionAsync(); }}
          >
            <Text style={{ fontSize: 18 }}>🎁</Text>
          </Pressable>
        </View>

        {/* Chat panel */}
        {showChat && (
          <View style={styles.chatPanel}>
            <FlatList
              ref={chatListRef}
              data={chatMessages}
              keyExtractor={m => m.id}
              style={styles.chatList}
              contentContainerStyle={{ gap: 4, paddingVertical: 4 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => (
                <View style={styles.chatBubble}>
                  <Text style={styles.chatSender}>{item.name}: </Text>
                  <Text style={styles.chatText}>{item.text}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.chatEmpty}>Napisz coś...</Text>}
            />
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Napisz komentarz..."
                placeholderTextColor={Colors.textMuted}
                value={chatText}
                onChangeText={setChatText}
                onSubmitEditing={sendChat}
                returnKeyType="send"
                maxLength={200}
              />
              <Pressable style={styles.chatSendBtn} onPress={sendChat} disabled={!chatText.trim()}>
                <Feather name="send" size={14} color={Colors.black} />
              </Pressable>
            </View>
          </View>
        )}

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
  const [viewers, setViewers] = useState<{ peerId: string; name: string }[]>([]);
  const [chatMessages, setChatMessages] = useState<{ id: string; name: string; text: string }[]>([]);
  const [giftNotifs, setGiftNotifs] = useState<{ id: string; name: string; emoji: string }[]>([]);
  const [floatingGifts, setFloatingGifts] = useState<FloatingGift[]>([]);
  const [showChat, setShowChat] = useState(true);
  const [activeFilter, setActiveFilter] = useState("none");
  const [showFilters, setShowFilters] = useState(false);
  const chatListRef = useRef<any>(null);
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
          v.style.cssText = "width:100%;height:100%;object-fit:cover;transform:scaleX(-1);";
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
          if (msg.type === "live-chat") {
            const chatMsg = { id: Math.random().toString(36).slice(2), name: msg.name as string, text: msg.text as string };
            setChatMessages(prev => [...prev.slice(-99), chatMsg]);
          }
          if (msg.type === "live-gift") {
            const notifId = Math.random().toString(36).slice(2);
            const newNotif = { id: notifId, name: msg.senderName as string, emoji: msg.emoji as string };
            setGiftNotifs(prev => [...prev.slice(-4), newNotif]);
            setTimeout(() => setGiftNotifs(prev => prev.filter(n => n.id !== notifId)), 4000);
            const fid = Math.random().toString(36).slice(2);
            const fx = Math.random() * 55 + 5;
            setFloatingGifts(prev => [...prev, { id: fid, emoji: msg.emoji as string, x: fx }]);
          }
          if (msg.type === "viewer-joined") {
            const viewerPeerId = msg.viewerPeerId as string;
            const viewerName = (msg.viewerName as string) || "Widz";
            setViewerCount(c => c + 1);
            setViewers(prev => [...prev, { peerId: viewerPeerId, name: viewerName }]);
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
            const pc = viewerPcsRef.current.get(msg.viewerPeerId as string);
            if (pc) { pc.close(); viewerPcsRef.current.delete(msg.viewerPeerId as string); }
            setViewerCount(c => Math.max(0, c - 1));
            setViewers(prev => prev.filter(v => v.peerId !== msg.viewerPeerId));
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

        {/* Header */}
        <View style={styles.liveViewerHeader}>
          <View style={styles.liveBroadcastBadge}>
            {broadcasting && <View style={styles.liveDot} />}
            <Text style={styles.liveBadgeText}>{broadcasting ? "LIVE" : "Łączę..."}</Text>
          </View>
          <View style={{ flex: 1 }} />
          {viewers.length > 0 && (
            <View style={styles.viewerPillRow}>
              {viewers.slice(-3).map(v => (
                <View key={v.peerId} style={styles.viewerPill}>
                  <Text style={styles.viewerPillText}>{v.name.slice(0, 8)}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.liveViewerCount}>
            <Feather name="eye" size={13} color={Colors.textPrimary} />
            <Text style={styles.liveViewerCountText}>{viewerCount}</Text>
          </View>
        </View>

        {/* Floating gifts */}
        {floatingGifts.map(g => (
          <FloatingGiftBubble
            key={g.id}
            emoji={g.emoji}
            x={g.x}
            onDone={() => setFloatingGifts(prev => prev.filter(fg => fg.id !== g.id))}
          />
        ))}

        {/* Gift notifications */}
        {giftNotifs.length > 0 && (
          <View style={styles.giftNotifsPanel}>
            {giftNotifs.map(n => (
              <Animated.View key={n.id} entering={FadeIn} exiting={FadeOut} style={styles.giftNotifRow}>
                <Text style={styles.giftNotifEmoji}>{n.emoji}</Text>
                <Text style={styles.giftNotifText}>{n.name} wysłał/a {n.emoji}</Text>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Chat panel (host view - read only with toggle) */}
        {showChat && (
          <View style={[styles.chatPanel, styles.chatPanelHost]}>
            <FlatList
              ref={chatListRef}
              data={chatMessages}
              keyExtractor={m => m.id}
              style={styles.chatList}
              contentContainerStyle={{ gap: 4, paddingVertical: 4 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => (
                <View style={styles.chatBubble}>
                  <Text style={styles.chatSender}>{item.name}: </Text>
                  <Text style={styles.chatText}>{item.text}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.chatEmpty}>Czat widzów pojawi się tutaj</Text>}
            />
          </View>
        )}

        {/* Filter bar */}
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

        {/* Host action buttons */}
        <View style={styles.liveViewerActions}>
          <Pressable
            style={[styles.liveIconBtn, showChat && styles.liveIconBtnActive]}
            onPress={() => { setShowChat(s => !s); Haptics.selectionAsync(); }}
          >
            <Feather name="message-circle" size={18} color={showChat ? Colors.black : Colors.textPrimary} />
          </Pressable>
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
  floatingGift: { position: "absolute", bottom: 160, zIndex: 200 },
  floatingGiftText: { fontSize: 56 },
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
  liveIconBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  liveIconBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chatPanel: { position: "absolute", bottom: 110, left: 12, width: 220, maxHeight: 200, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  chatPanelHost: { bottom: 120 },
  chatList: { maxHeight: 140, paddingHorizontal: 8, paddingTop: 4 },
  chatBubble: { flexDirection: "row", flexWrap: "wrap", marginBottom: 2 },
  chatSender: { fontFamily: "Montserrat_700Bold", fontSize: 11, color: Colors.accent },
  chatText: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textPrimary, flexShrink: 1 },
  chatEmpty: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: Colors.textMuted, padding: 8 },
  chatInputRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  chatInput: { flex: 1, fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textPrimary, paddingVertical: 4 },
  chatSendBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  viewerPillRow: { flexDirection: "row", gap: 4, marginRight: 8 },
  viewerPill: { backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  viewerPillText: { fontFamily: "Montserrat_600SemiBold", fontSize: 10, color: Colors.textPrimary },
  giftNotifsPanel: { position: "absolute", right: 12, top: 80, gap: 6 },
  giftNotifRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(204,255,0,0.3)" },
  giftNotifEmoji: { fontSize: 18 },
  giftNotifText: { fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: Colors.textPrimary },
});
