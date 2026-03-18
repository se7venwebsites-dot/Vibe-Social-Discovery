import { Router, type IRouter } from "express";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { toUserDto } from "./users";

const router: IRouter = Router();

export const CITY_COORDS: Record<string, [number, number]> = {
  "Warszawa": [52.2297, 21.0122],
  "Kraków": [50.0647, 19.9450],
  "Wrocław": [51.1079, 17.0385],
  "Poznań": [52.4064, 16.9252],
  "Gdańsk": [54.3520, 18.6466],
  "Łódź": [51.7592, 19.4560],
  "Katowice": [50.2599, 19.0216],
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const newHash = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return newHash === hash;
}

router.post("/auth/register", async (req, res) => {
  const { name, username, age, bio, photoUrl, photos, city, interests, password } = req.body;
  if (!name || !age || !bio) {
    res.status(400).json({ error: "name, age, bio required" });
    return;
  }

  const rawUsername = username ? username.replace(/^@/, "").toLowerCase() : null;
  if (rawUsername) {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, rawUsername));
    if (existing) { res.status(400).json({ error: "Nazwa użytkownika jest już zajęta" }); return; }
  }

  const coords = city ? CITY_COORDS[city] : undefined;
  const passwordHash = password ? hashPassword(password) : null;

  const [user] = await db.insert(usersTable).values({
    name,
    username: rawUsername,
    age: parseInt(age),
    bio,
    photoUrl: photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ccff00&color=000&size=400&bold=true`,
    photos: photos || [],
    city: city || null,
    interests: interests || [],
    isPremium: false,
    passwordHash,
    lat: coords?.[0] ?? null,
    lng: coords?.[1] ?? null,
  }).returning();

  res.json(toUserDto(user));
});

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "username i password wymagane" });
    return;
  }

  const raw = username.replace(/^@/, "").toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, raw));

  if (!user) {
    res.status(401).json({ error: "Nieprawidłowy login lub hasło" });
    return;
  }

  if (user.passwordHash && !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Nieprawidłowy login lub hasło" });
    return;
  }

  res.json(toUserDto(user));
});

export default router;
