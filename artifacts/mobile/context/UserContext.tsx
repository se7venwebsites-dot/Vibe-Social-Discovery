import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const CURRENT_USER_ID_KEY = "vibe_current_user_id";
const SWIPE_COUNT_KEY = "vibe_swipe_count";
const IS_PREMIUM_KEY = "vibe_is_premium";
const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

interface UserContextType {
  currentUserId: number;
  swipeCount: number;
  isPremium: boolean;
  incrementSwipe: () => void;
  activatePremium: () => Promise<void>;
  resetSwipes: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUserId] = useState<number>(1);
  const [swipeCount, setSwipeCount] = useState<number>(0);
  const [isPremium, setIsPremium] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      try {
        const sc = await AsyncStorage.getItem(SWIPE_COUNT_KEY);
        const premium = await AsyncStorage.getItem(IS_PREMIUM_KEY);
        if (sc) setSwipeCount(parseInt(sc));
        if (premium === "true") setIsPremium(true);
      } catch {}
    };
    load();
  }, []);

  const incrementSwipe = () => {
    if (isPremium) return;
    const next = swipeCount + 1;
    setSwipeCount(next);
    AsyncStorage.setItem(SWIPE_COUNT_KEY, String(next));
  };

  const activatePremium = async () => {
    try {
      const res = await fetch(`${BASE_URL}/premium/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });
      if (res.ok) {
        setIsPremium(true);
        setSwipeCount(0);
        await AsyncStorage.setItem(IS_PREMIUM_KEY, "true");
        await AsyncStorage.setItem(SWIPE_COUNT_KEY, "0");
      }
    } catch (e) {
      setIsPremium(true);
      setSwipeCount(0);
      await AsyncStorage.setItem(IS_PREMIUM_KEY, "true");
      await AsyncStorage.setItem(SWIPE_COUNT_KEY, "0");
    }
  };

  const resetSwipes = () => {
    setSwipeCount(0);
    AsyncStorage.setItem(SWIPE_COUNT_KEY, "0");
  };

  return (
    <UserContext.Provider
      value={{ currentUserId, swipeCount, isPremium, incrementSwipe, activatePremium, resetSwipes }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserContext must be used within UserProvider");
  return ctx;
}
