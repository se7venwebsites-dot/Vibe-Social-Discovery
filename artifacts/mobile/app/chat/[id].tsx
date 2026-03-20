import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

const SCREEN_W = Dimensions.get("window").width;

interface Msg {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  type: string;
  mediaUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface UserProfile {
  id: number;
  name: string;
  photoUrl: string;
  age: number;
}

const REPORT_REASONS = [
  "Spam lub reklama",
  "Nękanie lub zastraszanie",
  "Treści nieodpowiednie",
  "Fałszywy profil",
  "Nieletni",
  "Inne",
];

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUserContext();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const flatRef = useRef<FlatList>(null);
  const otherId = parseInt(id ?? "0");
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);

  const { data: otherUser } = useQuery<UserProfile>({
    queryKey: ["user", otherId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/users/${otherId}`);
      return res.json();
    },
  });

  const { data: messages = [], isLoading } = useQuery<Msg[]>({
    queryKey: ["messages", currentUser?.id, otherId],
    queryFn: async () => {
      if (!currentUser) return [];
      const res = await fetch(`${BASE_URL}/messages/${currentUser.id}/${otherId}`);
      return res.json();
    },
    enabled: !!currentUser,
    refetchInterval: 4000,
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { content?: string; type?: string; mediaUrl?: string }) => {
      if (!currentUser) return;
      const res = await fetch(`${BASE_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUser.id,
          receiverId: otherId,
          content: payload.content || "",
          type: payload.type || "text",
          mediaUrl: payload.mediaUrl || undefined,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", currentUser?.id, otherId] });
      queryClient.invalidateQueries({ queryKey: ["matches", currentUser?.id] });
    },
  });

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setText("");
    sendMutation.mutate({ content: trimmed, type: "text" });
  }, [text, sendMutation]);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
        allowsEditing: true,
      });
      if (result.canceled || !result.assets[0]) return;
      setSendingMedia(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const asset = result.assets[0];
      const base64 = asset.base64;
      const uploadRes = await fetch(`${BASE_URL.replace('/api', '')}/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: asset.mimeType || "image/jpeg" }),
      });
      const { url } = await uploadRes.json();
      sendMutation.mutate({ type: "photo", mediaUrl: url, content: "📷 Zdjęcie" });
      setSendingMedia(false);
    } catch {
      setSendingMedia(false);
    }
  }, [sendMutation]);

  const startRecording = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
      setRecordingDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch {}
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    setIsRecording(false);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri || recordingDuration < 1) return;

      setSendingMedia(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          const uploadRes = await fetch(`${BASE_URL.replace('/api', '')}/api/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64, mimeType: "audio/webm" }),
          });
          const { url } = await uploadRes.json();
          sendMutation.mutate({ type: "voice", mediaUrl: url, content: "🎤 Wiadomość głosowa" });
          setSendingMedia(false);
        };
        reader.readAsDataURL(blob);
      } else {
        sendMutation.mutate({ type: "voice", mediaUrl: uri, content: "🎤 Wiadomość głosowa" });
        setSendingMedia(false);
      }
    } catch {
      setRecording(null);
      setSendingMedia(false);
    }
  }, [recording, recordingDuration, sendMutation]);

  const cancelRecording = useCallback(async () => {
    if (!recording) return;
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
    } catch {}
    setRecording(null);
  }, [recording]);

  const playVoice = useCallback(async (url: string, msgId: number) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (playingId === msgId) {
        setPlayingId(null);
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      setPlayingId(msgId);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
        }
      });
      await sound.playAsync();
    } catch {}
  }, [playingId]);

  const handleReport = useCallback(async (reason: string) => {
    if (!currentUser) return;
    await fetch(`${BASE_URL}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromUserId: currentUser.id, reportedUserId: otherId, reason }),
    });
    setShowReport(false);
    setShowMenu(false);
    if (Platform.OS === "web") window.alert("Zgłoszenie wysłane. Dziękujemy!");
  }, [currentUser, otherId]);

  const handleBlock = useCallback(async () => {
    if (!currentUser) return;
    const msg = "Czy na pewno chcesz zablokować tę osobę? Nie będzie mogła się z Tobą kontaktować.";
    let confirmed = false;
    if (Platform.OS === "web") {
      confirmed = window.confirm(msg);
    } else {
      confirmed = await new Promise(resolve => {
        const { Alert } = require("react-native");
        Alert.alert("Zablokuj", msg, [
          { text: "Anuluj", style: "cancel", onPress: () => resolve(false) },
          { text: "Zablokuj", style: "destructive", onPress: () => resolve(true) },
        ]);
      });
    }
    if (!confirmed) return;
    await fetch(`${BASE_URL}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id, blockedUserId: otherId }),
    });
    setShowMenu(false);
    if (router.canGoBack()) router.back();
    else router.push("/");
  }, [currentUser, otherId]);

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const renderMsg = ({ item }: { item: Msg }) => {
    const isMe = item.senderId === currentUser?.id;

    if (item.type === "photo" && item.mediaUrl) {
      return (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
          {!isMe && otherUser && (
            <Image source={{ uri: otherUser.photoUrl }} style={styles.msgAvatar} />
          )}
          <Pressable onPress={() => setPreviewImage(item.mediaUrl!)}>
            <Image
              source={{ uri: item.mediaUrl }}
              style={[styles.photoMsg, isMe ? styles.photoMsgMe : styles.photoMsgThem]}
              resizeMode="cover"
            />
          </Pressable>
        </Animated.View>
      );
    }

    if (item.type === "voice" && item.mediaUrl) {
      const isPlaying = playingId === item.id;
      return (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
          {!isMe && otherUser && (
            <Image source={{ uri: otherUser.photoUrl }} style={styles.msgAvatar} />
          )}
          <Pressable
            style={[styles.voiceMsg, isMe ? styles.voiceMsgMe : styles.voiceMsgThem]}
            onPress={() => playVoice(item.mediaUrl!, item.id)}
          >
            <Feather name={isPlaying ? "pause" : "play"} size={18} color={isMe ? Colors.black : Colors.accent} />
            <View style={styles.voiceWave}>
              {Array.from({ length: 12 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.voiceBar,
                    {
                      height: 6 + Math.random() * 14,
                      backgroundColor: isMe ? "rgba(0,0,0,0.35)" : "rgba(204,255,0,0.4)",
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.voiceTime, { color: isMe ? Colors.black : Colors.textSecondary }]}>
              🎤
            </Text>
          </Pressable>
        </Animated.View>
      );
    }

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
        {!isMe && otherUser && (
          <Image source={{ uri: otherUser.photoUrl }} style={styles.msgAvatar} />
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.push("/")}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </Pressable>
          {otherUser && (
            <Pressable onPress={() => router.push(`/user/${otherId}` as any)}>
              <Image source={{ uri: otherUser.photoUrl }} style={styles.headerAvatar} />
            </Pressable>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{name ?? otherUser?.name ?? "Czat"}</Text>
            <Text style={styles.headerStatus}>Dopasowanie</Text>
          </View>
          <Pressable style={styles.menuBtn} onPress={() => setShowMenu(true)}>
            <Feather name="more-vertical" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            renderItem={renderMsg}
            contentContainerStyle={[styles.msgList, { paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>Zacznij rozmowę!</Text>
              </View>
            }
          />
        )}

        {isRecording ? (
          <View style={[styles.inputBar, styles.recordingBar, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.recordingPulse} />
            <Text style={styles.recordingText}>Nagrywanie... {formatDuration(recordingDuration)}</Text>
            <View style={styles.recordingActions}>
              <Pressable style={styles.cancelRecBtn} onPress={cancelRecording}>
                <Feather name="x" size={18} color={Colors.danger} />
              </Pressable>
              <Pressable style={styles.stopRecBtn} onPress={stopRecording}>
                <Feather name="send" size={18} color={Colors.black} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
            <Pressable style={styles.mediaBtn} onPress={pickImage} disabled={sendingMedia}>
              <Feather name="image" size={20} color={Colors.accent} />
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Napisz wiadomość..."
              placeholderTextColor={Colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
            />
            {text.trim().length > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.8 }]}
                onPress={handleSend}
                disabled={sendMutation.isPending}
              >
                {sendMutation.isPending ? (
                  <ActivityIndicator color={Colors.black} size="small" />
                ) : (
                  <Feather name="send" size={18} color={Colors.black} />
                )}
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.micBtn, pressed && { opacity: 0.8 }]}
                onPress={startRecording}
                disabled={sendingMedia}
              >
                {sendingMedia ? (
                  <ActivityIndicator color={Colors.accent} size="small" />
                ) : (
                  <Feather name="mic" size={20} color={Colors.accent} />
                )}
              </Pressable>
            )}
          </View>
        )}
      </View>

      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <Pressable style={styles.imagePreviewOverlay} onPress={() => setPreviewImage(null)}>
          <Image source={{ uri: previewImage! }} style={styles.imagePreviewFull} resizeMode="contain" />
          <Pressable style={styles.imagePreviewClose} onPress={() => setPreviewImage(null)}>
            <Feather name="x" size={24} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <Animated.View entering={FadeInDown.duration(200)} style={styles.menuBox}>
            <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); setShowReport(true); }}>
              <Feather name="flag" size={18} color={Colors.danger} />
              <Text style={[styles.menuItemText, { color: Colors.danger }]}>Zgłoś</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleBlock}>
              <Feather name="slash" size={18} color={Colors.danger} />
              <Text style={[styles.menuItemText, { color: Colors.danger }]}>Zablokuj</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => setShowMenu(false)}>
              <Feather name="x" size={18} color={Colors.textSecondary} />
              <Text style={styles.menuItemText}>Anuluj</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <View style={styles.reportOverlay}>
          <Animated.View entering={FadeInDown.springify()} style={styles.reportBox}>
            <Text style={styles.reportTitle}>Zgłoś użytkownika</Text>
            <Text style={styles.reportSub}>Dlaczego chcesz zgłosić tę osobę?</Text>
            {REPORT_REASONS.map(reason => (
              <Pressable key={reason} style={styles.reportReasonBtn} onPress={() => handleReport(reason)}>
                <Text style={styles.reportReasonText}>{reason}</Text>
                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
              </Pressable>
            ))}
            <Pressable style={styles.reportCancelBtn} onPress={() => setShowReport(false)}>
              <Text style={styles.reportCancelText}>Anuluj</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface },
  headerInfo: { flex: 1 },
  headerName: { fontFamily: "Montserrat_700Bold", fontSize: 16, color: Colors.textPrimary },
  headerStatus: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.accent },
  menuBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  msgList: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowThem: { justifyContent: "flex-start" },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surface },
  bubble: { maxWidth: "75%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: Colors.cardBg, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontFamily: "Montserrat_400Regular", fontSize: 15, lineHeight: 21 },
  bubbleTextMe: { color: Colors.black },
  bubbleTextThem: { color: Colors.textPrimary },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyChatText: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textMuted },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.black,
  },
  mediaBtn: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
    color: Colors.textPrimary,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingBar: {
    backgroundColor: "rgba(255,59,48,0.08)",
    borderTopColor: Colors.danger,
  },
  recordingPulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.danger,
    marginRight: 4,
  },
  recordingText: {
    flex: 1,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: Colors.danger,
  },
  recordingActions: { flexDirection: "row", gap: 8 },
  cancelRecBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stopRecBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  photoMsg: {
    width: SCREEN_W * 0.55,
    height: SCREEN_W * 0.55,
    borderRadius: 16,
  },
  photoMsgMe: { borderBottomRightRadius: 4 },
  photoMsgThem: { borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  voiceMsg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    maxWidth: "75%",
  },
  voiceMsgMe: { backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  voiceMsgThem: { backgroundColor: Colors.cardBg, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  voiceWave: { flexDirection: "row", alignItems: "center", gap: 2, flex: 1 },
  voiceBar: { width: 3, borderRadius: 2 },
  voiceTime: { fontFamily: "Montserrat_400Regular", fontSize: 12 },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreviewFull: { width: "90%", height: "80%" },
  imagePreviewClose: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  menuBox: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 40,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemText: { fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: Colors.textPrimary },
  reportOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  reportBox: {
    backgroundColor: Colors.cardBg,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  reportTitle: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: Colors.textPrimary, marginBottom: 4 },
  reportSub: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
  reportReasonBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reportReasonText: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: Colors.textPrimary },
  reportCancelBtn: { marginTop: 16, alignItems: "center", paddingVertical: 12 },
  reportCancelText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: Colors.textSecondary },
});
