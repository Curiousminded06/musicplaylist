import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient, ObjectId } from "mongodb";

const app = express();
const port = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mongoUri = process.env.MONGODB_URI;
const mongoDatabaseName = process.env.MONGODB_DB || "soundboard";

if (!mongoUri) {
  throw new Error("MONGODB_URI is required. Set it in Render environment variables.");
}

const mongoClient = new MongoClient(mongoUri);
let playlists;
let songs;

const configuredOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.length === 0 || configuredOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.options("*", cors());
app.use(express.json());

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function objectId(value) {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

function serializePlaylist(playlist, songCount = 0) {
  return { id: playlist._id.toString(), name: playlist.name, songCount };
}

function serializeSong(song) {
  return {
    id: song._id.toString(),
    title: song.title,
    url: song.url,
    videoId: song.videoId || null,
    mediaType: song.mediaType,
    favorite: Boolean(song.favorite),
    addedAt: song.addedAt
  };
}

async function getPlaylist(id) {
  const playlistId = objectId(id);
  return playlistId ? playlists.findOne({ _id: playlistId }) : null;
}

async function getSongs(playlistId) {
  return (await songs.find({ playlistId }).sort({ favorite: -1, position: 1, addedAt: 1 }).toArray()).map(serializeSong);
}

app.get("/api/playlists", asyncRoute(async (_req, res) => {
  const items = await playlists.find().sort({ createdAt: 1 }).toArray();
  const result = await Promise.all(items.map(async (item) => {
    const songCount = await songs.countDocuments({ playlistId: item._id });
    return serializePlaylist(item, songCount);
  }));
  res.json(result);
}));

app.post("/api/playlists", asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ message: "Playlist name is required." });
  const playlist = { name, createdAt: new Date() };
  const result = await playlists.insertOne(playlist);
  res.status(201).json(serializePlaylist({ ...playlist, _id: result.insertedId }));
}));

app.patch("/api/playlists/:playlistId", asyncRoute(async (req, res) => {
  const playlist = await getPlaylist(req.params.playlistId);
  const name = String(req.body.name || "").trim();
  if (!playlist) return res.status(404).json({ message: "Playlist not found." });
  if (!name) return res.status(400).json({ message: "Playlist name is required." });
  await playlists.updateOne({ _id: playlist._id }, { $set: { name } });
  res.json(serializePlaylist({ ...playlist, name }, await songs.countDocuments({ playlistId: playlist._id })));
}));

app.delete("/api/playlists/:playlistId", asyncRoute(async (req, res) => {
  const count = await playlists.countDocuments();
  if (count <= 1) return res.status(400).json({ message: "Keep at least one playlist." });
  const playlistId = objectId(req.params.playlistId);
  const result = await playlists.deleteOne({ _id: playlistId });
  if (!result.deletedCount) return res.status(404).json({ message: "Playlist not found." });
  await songs.deleteMany({ playlistId });
  res.status(204).send();
}));

app.get("/api/playlists/:playlistId/songs", asyncRoute(async (req, res) => {
  const playlist = await getPlaylist(req.params.playlistId);
  if (!playlist) return res.status(404).json({ message: "Playlist not found." });
  res.json(await getSongs(playlist._id));
}));

app.post("/api/playlists/:playlistId/songs", asyncRoute(async (req, res) => {
  const playlist = await getPlaylist(req.params.playlistId);
  const { title, url, videoId, mediaType = "youtube" } = req.body;
  if (!playlist) return res.status(404).json({ message: "Playlist not found." });
  if (!title || !url || (mediaType === "youtube" && !videoId)) {
    return res.status(400).json({ message: "A song title and valid media link are required." });
  }
  const song = {
    playlistId: playlist._id,
    title: title.trim(),
    url,
    videoId: videoId || null,
    mediaType,
    favorite: false,
    position: await songs.countDocuments({ playlistId: playlist._id }),
    addedAt: new Date()
  };
  const result = await songs.insertOne(song);
  res.status(201).json(serializeSong({ ...song, _id: result.insertedId }));
}));

app.patch("/api/playlists/:playlistId/songs/:songId", asyncRoute(async (req, res) => {
  const playlistId = objectId(req.params.playlistId);
  const songId = objectId(req.params.songId);
  const favorite = Boolean(req.body.favorite);
  const result = await songs.updateOne({ _id: songId, playlistId }, { $set: { favorite } });
  if (!result.matchedCount) return res.status(404).json({ message: "Song not found." });
  res.json({ favorite });
}));

app.patch("/api/playlists/:playlistId/order", asyncRoute(async (req, res) => {
  const playlistId = objectId(req.params.playlistId);
  const songIds = Array.isArray(req.body.songIds) ? req.body.songIds : [];
  const existing = await songs.find({ playlistId }, { projection: { _id: 1 } }).toArray();
  const existingIds = new Set(existing.map((song) => song._id.toString()));
  if (!playlistId || songIds.length !== existing.length || songIds.some((id) => !existingIds.has(String(id)))) {
    return res.status(400).json({ message: "Invalid playlist order." });
  }
  await Promise.all(songIds.map((id, position) =>
    songs.updateOne({ _id: objectId(id), playlistId }, { $set: { position } })
  ));
  res.json(await getSongs(playlistId));
}));

app.delete("/api/playlists/:playlistId/songs/:songId", asyncRoute(async (req, res) => {
  const result = await songs.deleteOne({
    _id: objectId(req.params.songId),
    playlistId: objectId(req.params.playlistId)
  });
  if (!result.deletedCount) return res.status(404).json({ message: "Song not found." });
  res.status(204).send();
}));

app.get("/favicon.ico", (_req, res) => res.status(204).end());

app.get("/api/playlist", asyncRoute(async (_req, res) => {
  const playlist = await playlists.findOne({}, { sort: { createdAt: 1 } });
  res.json(playlist ? await getSongs(playlist._id) : []);
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "The server could not complete that request." });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
}

async function start() {
  await mongoClient.connect();
  const database = mongoClient.db(mongoDatabaseName);
  playlists = database.collection("playlists");
  songs = database.collection("songs");
  await playlists.createIndex({ createdAt: 1 });
  await songs.createIndex({ playlistId: 1, favorite: -1, position: 1 });
  if (await playlists.countDocuments() === 0) {
    await playlists.insertOne({ name: "My collection", createdAt: new Date() });
  }
  app.listen(port, () => console.log(`Playlist API running at http://localhost:${port}`));
}

start().catch((error) => {
  console.error("Could not connect to MongoDB:", error);
  process.exit(1);
});
