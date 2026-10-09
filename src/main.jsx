import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = (import.meta.env.VITE_API_URL || "https://musicplaylist-qz0p.onrender.com").replace(/\/$/, "");
const apiUrl = (path) => `${API_URL}${path}`;

function getYouTubeId(value) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1).split("/")[0] || null;
    }
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/")[2] || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function DirectAudioForm({ playlistId, onSongAdded, onError }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function addAudio(event) {
    event.preventDefault();
    onError("");
    if (!title.trim()) {
      onError("Give your audio track a title first.");
      return;
    }
    if (!/\.(mp3|ogg|wav)(\?.*)?$/i.test(url.trim())) {
      onError("Use a direct .mp3, .ogg, or .wav file link.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(apiUrl(`/api/playlists/${playlistId}/songs`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url: url.trim(), mediaType: "audio" })
      });
      const song = await response.json();
      if (!response.ok) throw new Error(song.message);
      onSongAdded(song);
      setTitle("");
      setUrl("");
    } catch (requestError) {
      onError(requestError.message || "Could not add that audio track.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="add-card audio-card" onSubmit={addAudio}>
      <div className="card-heading">
        <div className="heading-icon audio-icon">♪</div>
        <div>
          <h2>Add audio file</h2>
          <p>Use a direct link to an authorized audio file.</p>
        </div>
      </div>
      <label htmlFor="audio-title">Track title</label>
      <input id="audio-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Evening ambience" />
      <label htmlFor="audio-url">Direct audio URL</label>
      <input id="audio-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/song.mp3" />
      <button className="add-button secondary-button" type="submit" disabled={isSaving}>
        {isSaving ? "Adding..." : "Add audio"} <span>↗</span>
      </button>
    </form>
  );
}

function FocusTimer() {
  const [mode, setMode] = useState("focus");
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  function chooseMode(nextMode) {
    setMode(nextMode);
    setRunning(false);
    setSeconds(nextMode === "focus" ? 25 * 60 : 5 * 60);
  }

  function reset() {
    setRunning(false);
    setSeconds(mode === "focus" ? 25 * 60 : 5 * 60);
  }

  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainingSeconds = String(seconds % 60).padStart(2, "0");
  const totalSeconds = mode === "focus" ? 25 * 60 : 5 * 60;
  const progress = ((totalSeconds - seconds) / totalSeconds) * 100;

  return (
    <section className="study-card timer-card">
      <div className="study-card-heading">
        <span className="study-icon">◷</span>
        <div><span className="section-kicker">FOCUS SESSION</span><h2>Stay in the zone</h2></div>
      </div>
      <div className="timer-tabs">
        <button className={mode === "focus" ? "selected" : ""} onClick={() => chooseMode("focus")} type="button">Focus 25</button>
        <button className={mode === "break" ? "selected" : ""} onClick={() => chooseMode("break")} type="button">Break 05</button>
      </div>
      <div className="timer-display">{minutes}<span>:</span>{remainingSeconds}</div>
      <div className="timer-track"><span style={{ width: `${progress}%` }} /></div>
      <div className="timer-actions">
        <button className="timer-main-button" type="button" onClick={() => setRunning((current) => !current)}>{running ? "Pause" : seconds === 0 ? "Start again" : "Start focus"}</button>
        <button className="timer-reset" type="button" onClick={reset}>Reset</button>
      </div>
    </section>
  );
}

function StickyNotes() {
  const [notes, setNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("soundboard-notes") || "[]");
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState("");

  useEffect(() => {
    localStorage.setItem("soundboard-notes", JSON.stringify(notes));
  }, [notes]);

  function addNote(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    setNotes((current) => [{ id: Date.now(), text: draft.trim() }, ...current]);
    setDraft("");
  }

  return (
    <section className="study-card notes-card">
      <div className="study-card-heading">
        <span className="study-icon note-icon">✦</span>
        <div><span className="section-kicker">QUICK NOTES</span><h2>Keep it visible</h2></div>
      </div>
      <form className="note-form" onSubmit={addNote}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a reminder..." aria-label="New sticky note" />
        <button type="submit" aria-label="Add sticky note">+</button>
      </form>
      <div className="notes-grid">
        {notes.length === 0 && <p className="notes-empty">Your next small step goes here.</p>}
        {notes.map((note) => (
          <div className="sticky-note" key={note.id}>
            <span>{note.text}</span>
            <button type="button" onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))} aria-label="Delete note">×</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function AmbientRoom() {
  return (
    <section className="ambient-card">
      <div className="ambient-copy">
        <span className="section-kicker">AMBIENT ROOM</span>
        <h2>Let the room<br /><em>slow down.</em></h2>
        <p>Put on a little background music, close the noise out, and make space for good work.</p>
        <a href="https://www.youtube.com/@LofiGirl" target="_blank" rel="noreferrer">Open Lofi Girl on YouTube ↗</a>
      </div>
      <div className="ambient-window" aria-hidden="true">
        <div className="moon" /><div className="cityline" /><div className="desk-lamp" />
        <span className="ambient-label">LOFI / STUDY</span>
      </div>
    </section>
  );
}

function AmbientMixer() {
  const [active, setActive] = useState(null);
  const [volume, setVolume] = useState(35);
  const audioContextRef = useRef(null);
  const gainRef = useRef(null);
  const soundCleanupRef = useRef(null);

  useEffect(() => () => {
    soundCleanupRef.current?.();
    audioContextRef.current?.close();
  }, []);

  function createNoiseBuffer(context, duration, texture = "noise") {
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < data.length; index += 1) {
      const random = Math.random() * 2 - 1;
      if (texture === "warm") {
        previous = previous * 0.96 + random * 0.04;
        data[index] = previous * 3;
      } else if (texture === "crackle") {
        const burst = Math.random() > 0.9985 ? Math.random() * 0.9 : 0;
        data[index] = (random * 0.04) + burst;
      } else {
        data[index] = random;
      }
    }
    return buffer;
  }

  function selectSound(id) {
    if (active === id) {
      soundCleanupRef.current?.();
      soundCleanupRef.current = null;
      setActive(null);
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = audioContextRef.current || new AudioContext();
    audioContextRef.current = context;
    soundCleanupRef.current?.();
    soundCleanupRef.current = null;
    const masterGain = context.createGain();
    masterGain.gain.value = volume / 1000;
    masterGain.connect(context.destination);
    const sources = [];
    const filters = [];
    const addNoiseLayer = (texture, filterType, frequency, layerGain) => {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = createNoiseBuffer(context, 4, texture);
      source.loop = true;
      filter.type = filterType;
      filter.frequency.value = frequency;
      gain.gain.value = layerGain;
      source.connect(filter).connect(gain).connect(masterGain);
      source.start();
      sources.push(source);
      filters.push(filter);
    };

    if (id === "cafe") {
      addNoiseLayer("warm", "bandpass", 900, 0.9);
      addNoiseLayer("noise", "lowpass", 260, 0.5);
      [118, 176].forEach((frequency, index) => {
        const hum = context.createOscillator();
        const humGain = context.createGain();
        hum.type = "sine";
        hum.frequency.value = frequency;
        humGain.gain.value = index === 0 ? 0.025 : 0.012;
        hum.connect(humGain).connect(masterGain);
        hum.start();
        sources.push(hum);
      });
    } else if (id === "fire") {
      addNoiseLayer("warm", "lowpass", 420, 1.1);
      addNoiseLayer("crackle", "highpass", 1600, 0.65);
    } else {
      addNoiseLayer("noise", id === "ocean" ? "lowpass" : "highpass", id === "ocean" ? 550 : 1800, 1);
    }
    soundCleanupRef.current = () => {
      sources.forEach((source) => {
        source.stop();
        source.disconnect();
      });
      filters.forEach((filter) => filter.disconnect());
      masterGain.disconnect();
    };
    gainRef.current = masterGain;
    setActive(id);
  }

  function updateVolume(value) {
    setVolume(value);
    if (gainRef.current) gainRef.current.gain.value = value / 1000;
  }

  return (
    <section className="study-card mixer-card">
      <div className="study-card-heading">
        <span className="study-icon">≋</span>
        <div><span className="section-kicker">AMBIENT MIXER</span><h2>Set the atmosphere</h2></div>
      </div>
      <p className="mixer-description">Layer a quiet background while you work.</p>
      <div className="sound-options">
        {[
          ["rain", "Rain", "⌁"],
          ["cafe", "Café", "♨"],
          ["fire", "Fireplace", "♨"],
          ["ocean", "Ocean", "≋"]
        ].map(([id, label, icon]) => (
          <button className={`sound-option ${active === id ? "active" : ""}`} type="button" key={id} onClick={() => selectSound(id)}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </div>
      <label className="volume-label" htmlFor="ambient-volume">Volume <strong>{volume}%</strong></label>
      <input id="ambient-volume" className="volume-slider" type="range" min="0" max="100" value={volume} onChange={(event) => updateVolume(event.target.value)} disabled={!active} />
      <p className="mixer-note">{active ? `${active[0].toUpperCase()}${active.slice(1)} ambience selected` : "Choose one sound to begin"}</p>
    </section>
  );
}

function ThemeOptions() {
  const [theme, setTheme] = useState(() => localStorage.getItem("soundboard-theme") || "midnight");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("soundboard-theme", theme);
  }, [theme]);

  return (
    <section className="theme-bar">
      <div>
        <span className="section-kicker">APPEARANCE</span>
        <strong>Choose your focus mood</strong>
      </div>
      <div className="theme-options">
        {[["midnight", "Midnight"], ["warm", "Warm paper"], ["forest", "Forest"]].map(([id, label]) => (
          <button key={id} type="button" className={`theme-option ${theme === id ? "selected" : ""}`} onClick={() => setTheme(id)}>
            <span className={`theme-swatch ${id}`} />{label}
          </button>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [playlist, setPlaylist] = useState([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [audioError, setAudioError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [localAudioUrl, setLocalAudioUrl] = useState("");
  const [localAudioBySong, setLocalAudioBySong] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [playlists, setPlaylists] = useState([]);
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [playlistName, setPlaylistName] = useState("");
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(true);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [draggedSongId, setDraggedSongId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef(null);
  const youtubeRef = useRef(null);

  useEffect(() => {
    fetch(apiUrl("/api/playlists"))
      .then((response) => response.json())
      .then((items) => {
        setPlaylists(items);
        if (items[0]) {
          setActivePlaylistId(items[0].id);
          setPlaylistName(items[0].name);
        }
      })
      .catch(() => setError("Could not connect to the playlist server."));
  }, []);

  useEffect(() => {
    if (!activePlaylistId) return;
    setIsLoadingPlaylist(true);
    fetch(apiUrl(`/api/playlists/${activePlaylistId}/songs`))
      .then((response) => response.json())
      .then(setPlaylist)
      .catch(() => setError("Could not load this playlist."))
      .finally(() => setIsLoadingPlaylist(false));
  }, [activePlaylistId]);

  useEffect(() => {
    function handleShortcut(event) {
      if (event.target.matches("input, textarea")) return;
      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
      } else if (event.key.toLowerCase() === "n") {
        playNextSong();
      } else if (event.key.toLowerCase() === "f" && nowPlaying) {
        toggleFavorite(nowPlaying);
      } else if (event.key === "/") {
        event.preventDefault();
        document.querySelector(".search-field input")?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  useEffect(() => {
    function handleYouTubeMessage(event) {
      if (!youtubeRef.current || event.source !== youtubeRef.current.contentWindow) return;
      let message;
      try {
        message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if ((message?.event === "infoDelivery" && message.info?.playerState === 0) ||
        (message?.event === "onStateChange" && message.info === 0)) {
        playNextSong();
      }
    }
    window.addEventListener("message", handleYouTubeMessage);
    return () => window.removeEventListener("message", handleYouTubeMessage);
  });

  async function addSong(event) {
    event.preventDefault();
    setError("");
    const videoId = getYouTubeId(url.trim());

    if (!title.trim()) {
      setError("Give your song a title first.");
      return;
    }
    if (!videoId) {
      setError("Paste a valid YouTube link (watch, youtu.be, Shorts, or embed).");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(apiUrl(`/api/playlists/${activePlaylistId}/songs`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url, videoId })
      });
      const song = await response.json();
      if (!response.ok) throw new Error(song.message);
      setPlaylist((current) => [...current, { ...song, mediaType: song.mediaType || "youtube" }]);
      setPlaylists((current) => current.map((item) => item.id === activePlaylistId ? { ...item, songCount: item.songCount + 1 } : item));
      setTitle("");
      setUrl("");
    } catch (requestError) {
      setError(requestError.message || "Could not add that song.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSong(id) {
    try {
      const response = await fetch(apiUrl(`/api/playlists/${activePlaylistId}/songs/${id}`), { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove the song.");
      setPlaylist((current) => current.filter((song) => song.id !== id));
      setPlaylists((current) => current.map((item) => item.id === activePlaylistId ? { ...item, songCount: Math.max(0, item.songCount - 1) } : item));
      setNowPlaying((current) => current?.id === id ? null : current);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function toggleFavorite(song) {
    const response = await fetch(apiUrl(`/api/playlists/${activePlaylistId}/songs/${song.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !song.favorite })
    });
    if (!response.ok) {
      setError("Could not update favorite.");
      return;
    }
    setPlaylist((current) => current.map((item) => item.id === song.id ? { ...item, favorite: !item.favorite } : item));
  }

  async function createPlaylist() {
    const name = window.prompt("Name your new playlist", "New playlist");
    if (!name?.trim()) return;
    const response = await fetch(apiUrl("/api/playlists"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const item = await response.json();
    if (!response.ok) return setError(item.message);
    setPlaylists((current) => [...current, item]);
    setActivePlaylistId(item.id);
    setPlaylistName(item.name);
  }

  async function renamePlaylist() {
    const name = window.prompt("Rename playlist", playlistName);
    if (!name?.trim() || name.trim() === playlistName) return;
    const response = await fetch(apiUrl(`/api/playlists/${activePlaylistId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    if (!response.ok) return setError("Could not rename playlist.");
    setPlaylistName(name.trim());
    setPlaylists((current) => current.map((item) => item.id === activePlaylistId ? { ...item, name: name.trim() } : item));
  }

  function handleLocalAudio(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["audio/mpeg", "audio/ogg", "audio/wav", "audio/x-wav"].includes(file.type)) {
      setError("Choose an authorized MP3, OGG, or WAV file.");
      event.target.value = "";
      return;
    }

    if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
    const objectUrl = URL.createObjectURL(file);
    const sourceSongId = nowPlaying.id;
    const localSong = {
      ...nowPlaying,
      title: file.name.replace(/\.(mp3|ogg|wav)$/i, ""),
      url: objectUrl,
      mediaType: "audio"
    };
    setLocalAudioUrl(objectUrl);
    setLocalAudioBySong((current) => ({ ...current, [sourceSongId]: localSong }));
    setNowPlaying(localSong);
    event.target.value = "";
  }

  function playSong(song) {
    setNowPlaying(localAudioBySong[song.id] || song);
    setIsPlaying(true);
    setLoadingVideo(song.mediaType !== "audio");
  }

  function sendYouTubeCommand(command) {
    youtubeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: command, args: [] }),
      "https://www.youtube.com"
    );
  }

  function togglePlayback() {
    if (!nowPlaying) return;
    if (nowPlaying.mediaType === "audio") {
      if (audioRef.current?.paused) audioRef.current.play();
      else audioRef.current?.pause();
    } else {
      sendYouTubeCommand(isPlaying ? "pauseVideo" : "playVideo");
    }
    setIsPlaying((current) => !current);
  }

  function playNextSong() {
    if (!nowPlaying || playlist.length < 2) return;
    const currentIndex = playlist.findIndex((song) => song.id === nowPlaying.id);
    const nextSong = playlist[(currentIndex + 1) % playlist.length];
    playSong(nextSong);
  }

  const visiblePlaylist = playlist.filter((song) =>
    song.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  function shufflePlaylist() {
    if (playlist.length < 2) return;
    setPlaylist((current) => [...current].sort(() => Math.random() - 0.5));
  }

  function exportPlaylist() {
    const exportData = playlist.map(({ title, url, mediaType }) => ({ title, url, mediaType }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "soundboard-playlist.json";
    link.click();
    URL.revokeObjectURL(downloadUrl);
  }

  async function moveSong(droppedSongId) {
    if (!draggedSongId || draggedSongId === droppedSongId) return;
    const reordered = [...playlist];
    const fromIndex = reordered.findIndex((song) => song.id === draggedSongId);
    const toIndex = reordered.findIndex((song) => song.id === droppedSongId);
    const [movedSong] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedSong);
    setPlaylist(reordered);
    setDraggedSongId(null);
    const response = await fetch(apiUrl(`/api/playlists/${activePlaylistId}/order`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songIds: reordered.map((song) => song.id) })
    });
    if (!response.ok) setError("Could not save the new playlist order.");
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">♫</span>
          <span>soundboard</span>
        </a>
        <span className="saved-count">{playlist.length} {playlist.length === 1 ? "song" : "songs"} saved</span>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span /> YOUR PERSONAL MIX</div>
        <h1>Build the soundtrack<br /><em>to your day.</em></h1>
        <p>Collect the videos you love in one simple, shareable playlist.</p>
      </section>

      <section className="study-dashboard">
        <div className="dashboard-heading">
          <div>
            <div className="eyebrow muted"><span /> STUDY SPACE</div>
            <h2>Your little corner to <em>focus.</em></h2>
          </div>
          <p>Set a rhythm, clear your mind, and make space for good work.</p>
        </div>
        <div className="dashboard-grid">
          <AmbientRoom />
          <FocusTimer />
          <StickyNotes />
          <AmbientMixer />
        </div>
        <ThemeOptions />
      </section>

      <section className="workspace">
        <div className="source-cards">
        <form className="add-card" onSubmit={addSong}>
          <div className="card-heading">
            <div className="heading-icon">+</div>
            <div>
              <h2>Add a song</h2>
              <p>Drop in a YouTube link to get started.</p>
            </div>
          </div>
          <label htmlFor="title">Song title</label>
          <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Midnight City" />
          <label htmlFor="url">YouTube URL</label>
          <input id="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtube.com/watch?v=..." />
          {error && <div className="error" role="alert">{error}</div>}
          <button className="add-button" type="submit" disabled={isSaving}>
            {isSaving ? "Adding..." : "Add to playlist"} <span>↗</span>
          </button>
        </form>
        <DirectAudioForm
          playlistId={activePlaylistId}
          onSongAdded={(song) => {
            setPlaylist((current) => [...current, song]);
            setPlaylists((current) => current.map((item) => item.id === activePlaylistId ? { ...item, songCount: item.songCount + 1 } : item));
          }}
          onError={setAudioError}
        />
        {audioError && <div className="error source-error" role="alert">{audioError}</div>}
        </div>

        <section className="playlist-panel">
          <div className="playlist-header">
            <div>
              <div className="eyebrow muted"><span /> NOW PLAYLISTING</div>
              <div className="playlist-title-row">
                <select value={activePlaylistId || ""} onChange={(event) => {
                  const item = playlists.find((entry) => entry.id === Number(event.target.value));
                  setActivePlaylistId(Number(event.target.value));
                  setPlaylistName(item?.name || "");
                  setNowPlaying(null);
                }} aria-label="Choose playlist">
                  {playlists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <button className="rename-button" type="button" onClick={renamePlaylist} disabled={!activePlaylistId} aria-label="Rename playlist">✎</button>
                <h2><strong>{String(playlist.length).padStart(2, "0")}</strong></h2>
              </div>
            </div>
            {playlist.length > 0 && (
              <div className="playlist-actions">
                <button type="button" onClick={shufflePlaylist} disabled={playlist.length < 2}>Shuffle ↝</button>
                <button type="button" onClick={exportPlaylist}>Export ↓</button>
              </div>
            )}
            <button className="new-playlist-button" type="button" onClick={createPlaylist}>+ New</button>
          </div>
          {playlist.length > 0 && (
            <div className="playlist-tools">
              <div className="search-field">
                <span>⌕</span>
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search your collection..." aria-label="Search playlist" />
                {searchTerm && <button type="button" onClick={() => setSearchTerm("")} aria-label="Clear search">×</button>}
              </div>
              <span className="duration-note">{visiblePlaylist.length} of {playlist.length} visible</span>
            </div>
          )}
          {isLoadingPlaylist ? (
            <div className="empty-state loading-state"><div className="loading-spinner" /><h3>Loading your playlist...</h3></div>
          ) : playlist.length === 0 ? (
            <div className="empty-state">
              <div className="empty-disc"><span>♫</span></div>
              <h3>Your playlist is waiting.</h3>
              <p>Add your first YouTube song and make it yours.</p>
            </div>
          ) : (
            <>
            {nowPlaying && (
              <div className="player-card">
                <div className="player-heading">
                  <span className="playing-dot" />
                  <div>
                    <span>NOW PLAYING</span>
                    <strong>{nowPlaying.title}</strong>
                  </div>
                  <button type="button" className="close-player" onClick={() => setNowPlaying(null)} aria-label="Close player">×</button>
                </div>
                {nowPlaying.mediaType === "audio" ? (
                  <audio ref={audioRef} className="audio-player" src={nowPlaying.url} autoPlay onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={playNextSong} />
                ) : (
                <div className="video-wrapper">
                  <iframe
                    src={`https://www.youtube.com/embed/${nowPlaying.videoId}?autoplay=1&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                    title={`Playing ${nowPlaying.title}`}
                    ref={youtubeRef}
                    key={nowPlaying.id}
                    onLoad={(event) => {
                      setLoadingVideo(false);
                      setIsPlaying(true);
                      const player = event.currentTarget.contentWindow;
                      player.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "soundboard" }), "https://www.youtube.com");
                      player.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"], channel: "soundboard" }), "https://www.youtube.com");
                    }}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
                )}
                <div className="player-controls">
                  <button type="button" onClick={togglePlayback} aria-label={isPlaying ? "Pause song" : "Play song"}>
                    {isPlaying ? "Ⅱ" : "▶"} <span>{isPlaying ? "Pause" : "Play"}</span>
                  </button>
                  <button type="button" onClick={playNextSong} disabled={playlist.length < 2} aria-label="Play next song">
                    Next song <span>↠</span>
                  </button>
                </div>
                {loadingVideo && <div className="player-loading"><span className="loading-spinner small" /> Loading YouTube player...</div>}
                <p className="player-fallback">
                  {nowPlaying.mediaType === "audio"
                    ? <>If playback is blocked, <a href={nowPlaying.url} target="_blank" rel="noreferrer">open the audio file ↗</a>.</>
                    : <>If YouTube restricts playback here, <a href={nowPlaying.url} target="_blank" rel="noreferrer">open this song on YouTube ↗</a>.</>}
                </p>
                {nowPlaying.mediaType === "youtube" && (
                  <div className="local-upload">
                    <input id="local-audio" type="file" accept=".mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav" onChange={handleLocalAudio} />
                    <label htmlFor="local-audio">Upload an authorized MP3 instead</label>
                    <small>This plays locally in your browser and is not uploaded to the server.</small>
                  </div>
                )}
              </div>
            )}
            <div className="song-list">
              {visiblePlaylist.length === 0 ? (
                <div className="no-results">No songs match “{searchTerm}”.</div>
              ) : visiblePlaylist.map((song, index) => (
                <article
                  className={`song-row ${draggedSongId === song.id ? "dragging" : ""}`}
                  key={song.id}
                  draggable
                  onDragStart={() => setDraggedSongId(song.id)}
                  onDragEnd={() => setDraggedSongId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => moveSong(song.id)}
                >
                  <span className="drag-handle" aria-label="Drag to reorder" title="Drag to reorder">⠿</span>
                  <span className="song-number">{String(index + 1).padStart(2, "0")}</span>
                  <button className={`play-button ${nowPlaying?.id === song.id ? "active" : ""}`} type="button" onClick={() => playSong(song)} aria-label={`Play ${song.title}`}>
                    {song.mediaType === "audio" ? <span className="audio-thumbnail">♪</span> : <img src={`https://img.youtube.com/vi/${song.videoId}/mqdefault.jpg`} alt="" />}
                    <span>{nowPlaying?.id === song.id ? "▶" : "▶"}</span>
                  </button>
                  <div className="song-info">
                    <h3>{song.title}</h3>
                    <button className="play-text" type="button" onClick={() => playSong(song)}>
                      {nowPlaying?.id === song.id ? "Playing in playlist" : localAudioBySong[song.id] ? "Play uploaded audio" : "Play in playlist"} <span>▶</span>
                    </button>
                  </div>
                  <button className={`favorite-button ${song.favorite ? "favorited" : ""}`} type="button" onClick={() => toggleFavorite(song)} aria-label={song.favorite ? `Unpin ${song.title}` : `Pin ${song.title}`} title={song.favorite ? "Unpin song" : "Pin song"}>{song.favorite ? "★" : "☆"}</button>
                  <button className="remove-button" type="button" onClick={() => removeSong(song.id)} aria-label={`Remove ${song.title}`}>×</button>
                </article>
              ))}
            </div>
            </>
          )}
        </section>
      </section>
      <footer>Made for the songs that stay with you.</footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode><App /></StrictMode>
);
