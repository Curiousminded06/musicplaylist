import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const app = express();
const port = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const database = new Database(path.join(__dirname, "soundboard.db"));

database.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    video_id TEXT,
    media_type TEXT NOT NULL DEFAULT 'youtube',
    favorite INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    added_at TEXT NOT NULL
  );
`);
database.pragma("foreign_keys = ON");
try {
  database.exec("ALTER TABLE songs ADD COLUMN position INTEGER NOT NULL DEFAULT 0");
} catch (error) {
  if (!String(error.message).includes("duplicate column name")) throw error;
}

const defaultPlaylist = database.prepare("SELECT id FROM playlists ORDER BY id LIMIT 1").get();
if (!defaultPlaylist) {
  database.prepare("INSERT INTO playlists (name, created_at) VALUES (?, ?)").run("My collection", new Date().toISOString());
}

app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",").map((url) => url.trim()) : true
}));
app.use(express.json());

function getPlaylist(id) {
  return database.prepare("SELECT id, name FROM playlists WHERE id = ?").get(id);
}

function getSongs(playlistId) {
  return database.prepare(`
    SELECT id, title, url, video_id AS videoId, media_type AS mediaType,
      favorite = 1 AS favorite, added_at AS addedAt
    FROM songs
    WHERE playlist_id = ?
    ORDER BY favorite DESC, position ASC, id ASC
  `).all(playlistId);
}

app.get("/api/playlists", (_req, res) => {
  res.json(database.prepare(`
    SELECT p.id, p.name, COUNT(s.id) AS songCount
    FROM playlists p LEFT JOIN songs s ON s.playlist_id = p.id
    GROUP BY p.id ORDER BY p.id ASC
  `).all());
});

app.patch("/api/playlists/:playlistId/order", (req, res) => {
  const playlistId = Number(req.params.playlistId);
  const songIds = Array.isArray(req.body.songIds) ? req.body.songIds.map(Number) : [];
  const existing = database.prepare("SELECT id FROM songs WHERE playlist_id = ?").all(playlistId).map((song) => song.id);
  if (!getPlaylist(playlistId) || songIds.length !== existing.length || songIds.some((id) => !existing.includes(id))) {
    return res.status(400).json({ message: "Invalid playlist order." });
  }
  const update = database.prepare("UPDATE songs SET position = ? WHERE id = ? AND playlist_id = ?");
  const transaction = database.transaction(() => {
    songIds.forEach((id, index) => update.run(index, id, playlistId));
  });
  transaction();
  return res.json(getSongs(playlistId));
});

app.post("/api/playlists", (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ message: "Playlist name is required." });
  const result = database.prepare("INSERT INTO playlists (name, created_at) VALUES (?, ?)").run(name, new Date().toISOString());
  return res.status(201).json({ id: Number(result.lastInsertRowid), name, songCount: 0 });
});

app.patch("/api/playlists/:playlistId", (req, res) => {
  const playlist = getPlaylist(Number(req.params.playlistId));
  const name = String(req.body.name || "").trim();
  if (!playlist) return res.status(404).json({ message: "Playlist not found." });
  if (!name) return res.status(400).json({ message: "Playlist name is required." });
  database.prepare("UPDATE playlists SET name = ? WHERE id = ?").run(name, playlist.id);
  return res.json({ ...playlist, name });
});

app.delete("/api/playlists/:playlistId", (req, res) => {
  const playlistId = Number(req.params.playlistId);
  const playlists = database.prepare("SELECT id FROM playlists ORDER BY id").all();
  if (playlists.length <= 1) return res.status(400).json({ message: "Keep at least one playlist." });
  const result = database.prepare("DELETE FROM playlists WHERE id = ?").run(playlistId);
  if (!result.changes) return res.status(404).json({ message: "Playlist not found." });
  return res.status(204).send();
});

app.get("/api/playlists/:playlistId/songs", (req, res) => {
  if (!getPlaylist(Number(req.params.playlistId))) return res.status(404).json({ message: "Playlist not found." });
  return res.json(getSongs(Number(req.params.playlistId)));
});

app.post("/api/playlists/:playlistId/songs", (req, res) => {
  const playlistId = Number(req.params.playlistId);
  const { title, url, videoId, mediaType = "youtube" } = req.body;
  if (!getPlaylist(playlistId)) return res.status(404).json({ message: "Playlist not found." });
  if (!title || !url || (mediaType === "youtube" && !videoId)) {
    return res.status(400).json({ message: "A song title and valid media link are required." });
  }
  const addedAt = new Date().toISOString();
  const result = database.prepare(`
    INSERT INTO songs (playlist_id, title, url, video_id, media_type, added_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(playlistId, title.trim(), url, videoId || null, mediaType, addedAt);
  return res.status(201).json(database.prepare(`
    SELECT id, title, url, video_id AS videoId, media_type AS mediaType,
      favorite = 1 AS favorite, added_at AS addedAt
    FROM songs WHERE id = ?
  `).get(result.lastInsertRowid));
});

app.patch("/api/playlists/:playlistId/songs/:songId", (req, res) => {
  const favorite = req.body.favorite ? 1 : 0;
  const result = database.prepare("UPDATE songs SET favorite = ? WHERE id = ? AND playlist_id = ?")
    .run(favorite, Number(req.params.songId), Number(req.params.playlistId));
  if (!result.changes) return res.status(404).json({ message: "Song not found." });
  return res.json({ favorite: Boolean(favorite) });
});

app.delete("/api/playlists/:playlistId/songs/:songId", (req, res) => {
  const result = database.prepare("DELETE FROM songs WHERE id = ? AND playlist_id = ?")
    .run(Number(req.params.songId), Number(req.params.playlistId));
  if (!result.changes) return res.status(404).json({ message: "Song not found." });
  return res.status(204).send();
});

app.get("/api/playlist", (_req, res) => {
  const playlist = database.prepare("SELECT id FROM playlists ORDER BY id LIMIT 1").get();
  res.json(getSongs(playlist.id));
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
}

app.listen(port, () => console.log(`Playlist API running at http://localhost:${port}`));
