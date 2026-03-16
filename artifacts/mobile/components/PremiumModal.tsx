import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  FadeIn,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");

interface Props {
  visible: boolean;
  onClose: () => void;
  onActivate: () => Promise<void>;
}

const FEATURES = [
  { icon: "infinity" as const, label: "Nieograniczone swipe'y" },
  { icon: "eye" as const, label: "Kto mnie polubił" },
  { icon: "star" as const, label: "Super Like x5 dziennie" },
  { icon: "zap" as const, label: "Boost profilu x1 dziennie" },
];

export function PremiumModal({ visible, onClose, onActivate }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = React.useState(false);

  const handleActivate = async () => {
    setLoading(true);
    await onActivate();
    setLoading(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        >
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Feather name="x" size={20} color={Colors.textSecondary} />
          </Pressable>

          <View style={styles.logoRow}>
            <Text style={styles.logoVibe}>VIBE</Text>
            <Text style={styles.logoPlus}>+</Text>
          </View>

          <Text style={styles.subtitle}>Odblokuj pełny VIBE</Text>

          <View style={styles.featuresBox}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Feather name={f.icon} size={16} color={Colors.accent} />
                </View>
                <Text style={styles.featureText}>{f.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>Tygodniowy plan</Text>
            <Text style={styles.price}>24,99 PLN</Text>
            <Text style={styles.priceSub}>/ tydzień • anuluj kiedy chcesz</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.activateBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            onPress={handleActivate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.black} />
            ) : (
              <Text style={styles.activateBtnText}>Aktywuj VIBE+</Text>
            )}
          </Pressable>

          <Text style={styles.legal}>
            Zakup jest symulowany. Żadna płatność nie zostanie pobrana.
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 32,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoVibe: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 34,
    color: Colors.accent,
    letterSpacing: 4,
  },
  logoPlus: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 34,
    color: Colors.textPrimary,
    marginBottom: 2,
    marginLeft: 2,
  },
  subtitle: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  featuresBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(204,255,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 15,
    color: Colors.textPrimary,
  },
  priceBox: {
    alignItems: "center",
    marginBottom: 20,
  },
  priceLabel: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  price: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 40,
    color: Colors.accent,
    letterSpacing: -1,
  },
  priceSub: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activateBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 16,
  },
  activateBtnText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 17,
    color: Colors.black,
    letterSpacing: 0.5,
  },
  legal: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "center",
  },
});
