import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { BASE_URL } from "@/context/UserContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications(userId: number | null | undefined) {
  const lastUserId = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (Platform.OS === "web") return;
    if (lastUserId.current === userId) return;

    lastUserId.current = userId;

    const registerForPush = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") return;

        const tokenData = await Notifications.getExpoPushTokenAsync();
        const pushToken = tokenData.data;

        await fetch(`${BASE_URL}/users/${userId}/push-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pushToken }),
        });
      } catch {}
    };

    registerForPush();
  }, [userId]);
}
