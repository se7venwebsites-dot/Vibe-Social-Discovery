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
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

interface Msg {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface UserProfile {
  id: number;
  name: string;
  photoUrl: string;
  age: number;
}

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUserContext();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const flatRef = useRef<FlatList>(null);
  const otherId = parseInt(id ?? "0");
  const topInset = Platform.OS === "web" ? 67 : insets.top;

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
    mutationFn: async (content: string) => {
      if (!currentUser) return;
      const res = await fetch(`${BASE_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderId: currentUser.id, receiverId: otherId, content }),
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
    sendMutation.mutate(trimmed);
  }, [text, sendMutation]);

  const renderMsg = ({ item }: { item: Msg }) => {
    const isMe = item.senderId === currentUser?.id;
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
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </Pressable>
          {otherUser && (
            <Image source={{ uri: otherUser.photoUrl }} style={styles.headerAvatar} />
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{name ?? otherUser?.name ?? "Czat"}</Text>
            <Text style={styles.headerStatus}>Dopasowanie</Text>
          </View>
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

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            placeholder="Napisz wiadomość..."
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              text.trim().length === 0 && styles.sendBtnDisabled,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleSend}
            disabled={text.trim().length === 0 || sendMutation.isPending}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color={Colors.black} size="small" />
            ) : (
              <Feather name="send" size={18} color={Colors.black} />
            )}
          </Pressable>
        </View>
      </View>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  msgList: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowThem: { justifyContent: "flex-start" },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surface },
  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
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
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.black,
  },
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
  sendBtnDisabled: { opacity: 0.35 },
});
