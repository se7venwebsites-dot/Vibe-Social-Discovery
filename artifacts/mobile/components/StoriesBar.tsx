import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Modal,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { useUserContext, BASE_URL } from "@/context/UserContext";

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;

interface StoryItem {
  id: number;
  mediaUrl: string;
  type: string;
  caption?: string | null;
  createdAt: string;
  expiresAt: string;
}

interface StoryGroup {
  userId: number;
  name: string;
  photoUrl: string;
  isOwn: boolean;
  stories: StoryItem[];
}

export default function StoriesBar() {
  const { currentUser } = useUserContext();
  const queryClient = useQueryClient();
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null);
  const [viewingIndex, setViewingIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  const { data: storyGroups = [] } = useQuery<StoryGroup[]>({
    queryKey: ["stories-feed", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const res = await fetch(`${BASE_URL}/stories/feed/${currentUser.id}`);
      return res.json();
    },
    enabled: !!currentUser,
    refetchInterval: 30000,
  });

  const addStory = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        base64: true,
        allowsEditing: true,
        aspect: [9, 16],
      });
      if (result.canceled || !result.assets[0]) return;
      setUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const asset = result.assets[0];
      const uploadRes = await fetch(`${BASE_URL.replace('/api', '')}/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: asset.base64, mimeType: asset.mimeType || "image/jpeg" }),
      });
      const { url } = await uploadRes.json();

      await fetch(`${BASE_URL}/stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser!.id, mediaUrl: url, type: "photo" }),
      });

      queryClient.invalidateQueries({ queryKey: ["stories-feed"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {} finally {
      setUploading(false);
    }
  }, [currentUser, queryClient]);

  const openStory = (group: StoryGroup) => {
    setViewingGroup(group);
    setViewingIndex(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const nextStory = () => {
    if (!viewingGroup) return;
    if (viewingIndex < viewingGroup.stories.length - 1) {
      setViewingIndex(prev => prev + 1);
    } else {
      const currentIdx = storyGroups.findIndex(g => g.userId === viewingGroup.userId);
      if (currentIdx < storyGroups.length - 1) {
        setViewingGroup(storyGroups[currentIdx + 1]);
        setViewingIndex(0);
      } else {
        setViewingGroup(null);
      }
    }
  };

  const prevStory = () => {
    if (viewingIndex > 0) {
      setViewingIndex(prev => prev - 1);
    }
  };

  const ownGroup = storyGroups.find(g => g.isOwn);
  const hasOwnStory = ownGroup && ownGroup.stories.length > 0;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bar}
      >
        <Pressable style={styles.storyItem} onPress={hasOwnStory ? () => openStory(ownGroup!) : addStory} disabled={uploading}>
          <View style={[styles.storyRing, hasOwnStory ? styles.storyRingActive : styles.storyRingAdd]}>
            {uploading ? (
              <ActivityIndicator color={Colors.accent} />
            ) : (
              <Image
                source={{ uri: currentUser?.photoUrl }}
                style={styles.storyAvatar}
              />
            )}
            {!hasOwnStory && (
              <View style={styles.addBadge}>
                <Feather name="plus" size={12} color={Colors.black} />
              </View>
            )}
          </View>
          <Text style={styles.storyName} numberOfLines={1}>
            {hasOwnStory ? "Twoje" : "Dodaj"}
          </Text>
        </Pressable>

        {storyGroups.filter(g => !g.isOwn).map((group, i) => (
          <Animated.View key={group.userId} entering={FadeInRight.delay(i * 50)}>
            <Pressable style={styles.storyItem} onPress={() => openStory(group)}>
              <View style={[styles.storyRing, styles.storyRingActive]}>
                <Image source={{ uri: group.photoUrl }} style={styles.storyAvatar} />
              </View>
              <Text style={styles.storyName} numberOfLines={1}>{group.name}</Text>
            </Pressable>
          </Animated.View>
        ))}

        {storyGroups.filter(g => !g.isOwn).length === 0 && (
          <View style={styles.emptyStories}>
            <Text style={styles.emptyStoriesText}>Brak stories</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!viewingGroup} transparent animationType="fade" onRequestClose={() => setViewingGroup(null)}>
        {viewingGroup && viewingGroup.stories[viewingIndex] && (
          <View style={styles.storyViewer}>
            <View style={styles.progressBar}>
              {viewingGroup.stories.map((_, i) => (
                <View key={i} style={[styles.progressSegment, i <= viewingIndex && styles.progressSegmentActive]} />
              ))}
            </View>

            <View style={styles.storyHeader}>
              <Image source={{ uri: viewingGroup.photoUrl }} style={styles.storyHeaderAvatar} />
              <Text style={styles.storyHeaderName}>{viewingGroup.name}</Text>
              <Text style={styles.storyHeaderTime}>
                {getTimeAgo(viewingGroup.stories[viewingIndex].createdAt)}
              </Text>
              <Pressable style={styles.storyCloseBtn} onPress={() => setViewingGroup(null)}>
                <Feather name="x" size={22} color="#fff" />
              </Pressable>
            </View>

            <Image
              source={{ uri: viewingGroup.stories[viewingIndex].mediaUrl }}
              style={styles.storyImage}
              resizeMode="contain"
            />

            {viewingGroup.stories[viewingIndex].caption && (
              <View style={styles.captionBox}>
                <Text style={styles.captionText}>{viewingGroup.stories[viewingIndex].caption}</Text>
              </View>
            )}

            <View style={styles.storyTapZones}>
              <Pressable style={styles.tapLeft} onPress={prevStory} />
              <Pressable style={styles.tapRight} onPress={nextStory} />
            </View>
          </View>
        )}
      </Modal>
    </>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "teraz";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} godz.`;
  return "1 dzień";
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 16, paddingVertical: 6, gap: 10, alignItems: "flex-start", marginBottom: 4 },
  storyItem: { alignItems: "center", width: 68 },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  storyRingActive: { borderWidth: 2, borderColor: Colors.accent },
  storyRingAdd: { borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed" },
  storyAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.surface },
  addBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.black,
  },
  storyName: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  emptyStories: { justifyContent: "center", paddingHorizontal: 8 },
  emptyStoriesText: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: Colors.textMuted },
  storyViewer: { flex: 1, backgroundColor: "#000" },
  progressBar: { flexDirection: "row", gap: 3, paddingHorizontal: 12, paddingTop: Platform.OS === "web" ? 70 : 55 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" },
  progressSegmentActive: { backgroundColor: "#fff" },
  storyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  storyHeaderAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface },
  storyHeaderName: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: "#fff", flex: 1 },
  storyHeaderTime: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(255,255,255,0.6)" },
  storyCloseBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  storyImage: { flex: 1, width: SCREEN_W },
  captionBox: {
    position: "absolute",
    bottom: 80,
    left: 24,
    right: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    padding: 12,
  },
  captionText: { fontFamily: "Montserrat_400Regular", fontSize: 14, color: "#fff", textAlign: "center" },
  storyTapZones: { position: "absolute", top: 120, bottom: 0, left: 0, right: 0, flexDirection: "row" },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
});
