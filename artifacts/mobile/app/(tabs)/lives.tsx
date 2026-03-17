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
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

const WS_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `wss://${process.env.EXPO_PUBLIC_DOMAIN}/api/ws`
  : `ws://localhost:8080/ws`;

interface LiveHost {
  id: number;
  name: string;
  username?: string | null;
  photoUrl: string;
  age: number;
  city?: string;
}

interface Live {
  id: number;
  title: string;
  viewerCount: number;
  createdAt?: string;
  host: LiveHost;
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

function LiveViewerModal({ live, visible, onClose, currentUser }: {
  live: Live | null;
  visible: boolean;
  onClose: () => void;
  currentUser: { id: number; name: string } | null;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [connected, setConnected] = useState(false);
  const [addedFriend, setAddedFriend] = useState(false);
  const queryClient = useQueryClient();

  const cleanup = () => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    const container = document.getElementById("vibe-live-remote");
    if (container) container.innerHTML = "";
    setConnected(false);
    if (live) {
      fetch(`${BASE_URL}/lives/${live.id}/viewers`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta: -1 }) }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!visible || !live || Platform.OS !== "web") return;
    fetch(`${BASE_URL}/lives/${live.id}/viewers`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta: 1 }) }).catch(() => {});

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join-live", liveId: live.id, userId: currentUser?.id, name: currentUser?.name, role: "viewer" }));
    };
    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "live-offer") {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        pcRef.current = pc;
        pc.ontrack = (e) => {
          const container = document.getElementById("vibe-live-remote");
          if (container) {
            let v = container.querySelector("video") as HTMLVideoElement;
            if (!v) { v = document.createElement("video"); v.autoplay = true; v.playsInline = true; v.style.cssText = "width:100%;height:100%;object-fit:cover;"; container.appendChild(v); }
            v.srcObject = e.streams[0];
            setConnected(true);
          }
        };
        pc.onicecandidate = (e) => { if (e.candidate) ws.send(JSON.stringify({ type: "live-ice", candidate: e.candidate, role: "viewer" })); };
        await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "live-answer", answer, liveId: live.id }));
      }
      if (msg.type === "live-ice-from-host" && pcRef.current) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
      }
      if (msg.type === "live-ended") { cleanup(); onClose(); }
    };
    ws.onclose = () => { setConnected(false); };
    return () => { cleanup(); };
  }, [visible, live]);

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
        <View nativeID="vibe-live-remote" style={styles.liveVideoFill} />
        {!connected && (
          <View style={styles.liveConnectingOverlay}>
            <ActivityIndicator color={Colors.accent} size="large" />
            <Text style={styles.liveConnectingText}>Łączę z live...</Text>
          </View>
        )}
        {live && (
          <View style={styles.liveViewerHeader}>
            <Pressable style={styles.liveViewerClose} onPress={() => { cleanup(); onClose(); }}>
              <Feather name="x" size={22} color={Colors.textPrimary} />
            </Pressable>
            <View style={styles.liveViewerHostInfo}>
              <Image source={{ uri: live.host.photoUrl }} style={styles.liveViewerHostAvatar} />
              <View>
                <Text style={styles.liveViewerHostName}>{live.host.name}</Text>
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
            <Feather name="radio" size={28} color={Colors.black} />
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
            <Feather name="radio" size={16} color={Colors.black} />
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
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const { data: lives = [], isLoading } = useQuery<Live[]>({
    queryKey: ["lives"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/lives`);
      return res.json();
    },
    refetchInterval: 15000,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lives"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
          <Feather name="radio" size={14} color={Colors.black} />
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
            <Feather name="radio" size={16} color={Colors.black} />
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
  startBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  startBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: Colors.black },
  list: { paddingHorizontal: 16, gap: 12, paddingTop: 4 },
  liveCard: { backgroundColor: Colors.cardBg, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 0 },
  liveThumb: { width: 100, height: 90, position: "relative" },
  liveThumbImg: { width: "100%", height: "100%", resizeMode: "cover" },
  liveBadge: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.danger, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
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
  startEmptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  startEmptyBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: Colors.black },
  liveViewerContainer: { flex: 1, backgroundColor: "#000" },
  liveVideoFill: { flex: 1, backgroundColor: "#0a0a0a" },
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
  liveViewerActions: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  addFriendBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  addFriendBtnDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  addFriendBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.textPrimary },
  startLiveOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  startLiveBox: { backgroundColor: Colors.cardBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 44, borderTopWidth: 1, borderColor: Colors.border, gap: 14, alignItems: "center" },
  startLiveClose: { position: "absolute", top: 16, right: 20, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  startLiveIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.danger, alignItems: "center", justifyContent: "center" },
  startLiveTitle: { fontFamily: "Montserrat_700Bold", fontSize: 24, color: Colors.textPrimary },
  startLiveSub: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  startLiveInput: { width: "100%", backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 13, fontFamily: "Montserrat_500Medium", fontSize: 15, color: Colors.textPrimary },
  startLiveBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.danger, paddingHorizontal: 28, paddingVertical: 15, borderRadius: 14, width: "100%", justifyContent: "center" },
  startLiveBtnText: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: "#fff" },
});
