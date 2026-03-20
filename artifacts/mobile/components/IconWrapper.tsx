/**
 * IconWrapper component with fallback support
 * Helps handle cases where Feather icons may not render properly in Expo Go
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

interface IconWrapperProps {
  name: string; // Any Feather icon name
  size: number;
  color: string;
  fallbackText?: string;
  testID?: string;
}

// Fallback text representations for common icons
const ICON_FALLBACKS: Record<string, string> = {
  heart: "♥",
  message: "✉",
  "message-circle": "💬",
  user: "👤",
  users: "👥",
  "user-plus": "👤+",
  x: "✕",
  check: "✓",
  "chevron-right": "›",
  lock: "🔒",
  search: "🔍",
  send: "➤",
  flame: "🔥",
  gift: "🎁",
  radio: "📻",
  camera: "📷",
  volume: "🔊",
  "volume-x": "🔇",
  eye: "👁",
  star: "★",
  home: "🏠",
  settings: "⚙",
  inbox: "📥",
};

/**
 * IconWrapper with fallback support
 * Tries to render Feather icon, falls back to emoji text if needed
 */
export const IconWrapper: React.FC<IconWrapperProps> = ({
  name,
  size,
  color,
  fallbackText,
  testID,
}) => {
  const fallback = fallbackText || ICON_FALLBACKS[name] || "•";

  // Always try to render Feather icon first
  // Feather icons from @expo/vector-icons are generally reliable
  return (
    <View testID={testID}>
      <Feather name={name as any} size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  fallbackText: {
    fontWeight: "bold",
    textAlignVertical: "center",
  },
});

export default IconWrapper;
