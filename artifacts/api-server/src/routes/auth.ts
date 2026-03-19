import { Router, type IRouter } from "express";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { toUserDto } from "./users";

const router: IRouter = Router();

export const CITY_COORDS: Record<string, [number, number]> = {
  "Warszawa": [52.2297, 21.0122], "Kraków": [50.0647, 19.9450], "Wrocław": [51.1079, 17.0385],
  "Poznań": [52.4064, 16.9252], "Gdańsk": [54.3520, 18.6466], "Łódź": [51.7592, 19.4560],
  "Katowice": [50.2599, 19.0216], "Szczecin": [53.4285, 14.5528], "Bydgoszcz": [53.1235, 17.9941],
  "Lublin": [51.2465, 22.5684], "Białystok": [53.1325, 23.1688], "Gdynia": [54.5189, 18.5305],
  "Częstochowa": [50.8118, 19.1203], "Radom": [51.4027, 21.1471], "Toruń": [53.0138, 18.5981],
  "Kielce": [50.8661, 20.6286], "Rzeszów": [50.0412, 21.9991], "Olsztyn": [53.7784, 20.4801],
  "Opole": [50.6751, 17.9213], "Zielona Góra": [51.9356, 15.5062], "Tarnów": [50.0121, 20.9858],
  "Koszalin": [54.1943, 16.1714], "Kalisz": [51.7613, 18.0910], "Legnica": [51.2100, 16.1619],
  "Gorzów Wielkopolski": [52.7325, 15.2369], "Nowy Sącz": [49.6218, 20.6972],
  "Sosnowiec": [50.2863, 19.1042], "Gliwice": [50.2945, 18.6714], "Zabrze": [50.3249, 18.7857],
  "Bielsko-Biała": [49.8224, 19.0587], "Rybnik": [50.0971, 18.5463], "Tychy": [50.1369, 18.9997],
  "Płock": [52.5464, 19.7064], "Elbląg": [54.1561, 19.4044], "Konin": [52.2230, 18.2510],
  "Piła": [53.1510, 16.7383], "Słupsk": [54.4641, 17.0285], "Siedlce": [52.1676, 22.2903],
  "Przemyśl": [49.7838, 22.7676], "Zamość": [50.7231, 23.2519], "Suwałki": [54.1118, 22.9308],
  "Łomża": [53.1782, 22.0590], "Sopot": [54.4417, 18.5601], "Zakopane": [49.2992, 19.9496],
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
  const { name, username, age, bio, photoUrl, photos, city, voivodeship, gender, interests, password, acceptedTerms } = req.body;
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
    voivodeship: voivodeship || null,
    gender: gender || null,
    interests: interests || [],
    isPremium: false,
    acceptedTerms: acceptedTerms === true,
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
