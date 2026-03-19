import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const USER_ID_KEY = "vibe_user_id";
const IS_PREMIUM_KEY = "vibe_is_premium";

export const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export interface UserProfile {
  id: number;
  name: string;
  username?: string | null;
  age: number;
  bio: string;
  photoUrl: string;
  photos?: string[];
  isPremium: boolean;
  city?: string;
  voivodeship?: string;
  gender?: string;
  interests?: string[];
  lat?: number | null;
  lng?: number | null;
}

interface UserContextType {
  currentUser: UserProfile | null;
  isRegistered: boolean;
  isLoadingAuth: boolean;
  isPremium: boolean;
  register: (data: Omit<UserProfile, "id" | "isPremium"> & { password?: string; acceptedTerms?: boolean }) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  updateProfile: (data: Partial<Omit<UserProfile, "id" | "isPremium">>) => Promise<void>;
  activatePremium: () => Promise<void>;
  devReset: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const storedId = await AsyncStorage.getItem(USER_ID_KEY);
        const storedPremium = await AsyncStorage.getItem(IS_PREMIUM_KEY);
        if (storedId) {
          const res = await fetch(`${BASE_URL}/users/${storedId}`);
          if (res.ok) {
            const user: UserProfile = await res.json();
            setCurrentUser(user);
            setIsPremium(user.isPremium || storedPremium === "true");
          } else {
            await AsyncStorage.removeItem(USER_ID_KEY);
          }
        }
      } catch {}
      setIsLoadingAuth(false);
    };
    load();
  }, []);

  const register = useCallback(async (data: Omit<UserProfile, "id" | "isPremium"> & { password?: string; acceptedTerms?: boolean }) => {
    const endpoint = data.password ? `${BASE_URL}/auth/register` : `${BASE_URL}/users/register`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Rejestracja nieudana");
    }
    const user: UserProfile = await res.json();
    setCurrentUser(user);
    setIsPremium(false);
    await AsyncStorage.setItem(USER_ID_KEY, String(user.id));
    await AsyncStorage.removeItem(IS_PREMIUM_KEY);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Logowanie nieudane");
    }
    const user: UserProfile = await res.json();
    setCurrentUser(user);
    setIsPremium(user.isPremium);
    await AsyncStorage.setItem(USER_ID_KEY, String(user.id));
    if (user.isPremium) await AsyncStorage.setItem(IS_PREMIUM_KEY, "true");
  }, []);

  const updateProfile = useCallback(async (data: Partial<Omit<UserProfile, "id" | "isPremium">>) => {
    if (!currentUser) return;
    const res = await fetch(`${BASE_URL}/users/${currentUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Aktualizacja nieudana");
    }
    const updated: UserProfile = await res.json();
    setCurrentUser(updated);
  }, [currentUser]);

  const activatePremium = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${BASE_URL}/premium/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      if (res.ok) {
        const updated: UserProfile = await res.json();
        setCurrentUser(updated);
      }
    } catch {}
    setIsPremium(true);
    setCurrentUser(u => u ? { ...u, isPremium: true } : u);
    await AsyncStorage.setItem(IS_PREMIUM_KEY, "true");
  }, [currentUser]);

  const devReset = useCallback(async () => {
    await AsyncStorage.multiRemove([USER_ID_KEY, IS_PREMIUM_KEY]);
    setCurrentUser(null);
    setIsPremium(false);
  }, []);

  return (
    <UserContext.Provider value={{
      currentUser,
      isRegistered: !!currentUser,
      isLoadingAuth,
      isPremium,
      register,
      login,
      updateProfile,
      activatePremium,
      devReset,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserContext must be used within UserProvider");
  return ctx;
}
