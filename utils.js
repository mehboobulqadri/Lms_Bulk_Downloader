/* utils.js — shared helpers (popup + downloader only, not content script) */
"use strict";

const TYPE_EMOJI = {
  pdf: "📄", ppt: "📊", pptx: "📊", doc: "📝", docx: "📝",
  xls: "📈", xlsx: "📈", zip: "📦", rar: "📦", "7z": "📦",
  mp4: "🎬", mkv: "🎬", avi: "🎬", mov: "🎬", webm: "🎬",
  mp3: "🎵", wav: "🎵", ogg: "🎵", flac: "🎵",
  png: "🖼️", jpg: "🖼️", jpeg: "🖼️",
  csv: "📊", txt: "📃", rtf: "📝"
};

/** Format bytes to human-readable string */
function fmtBytes(b) {
  if (!b || b < 0) return "0 B";
  if (b < 1024) return b + " B";
  if (b < 1_048_576) return (b / 1024).toFixed(1) + " KB";
  if (b < 1_073_741_824) return (b / 1_048_576).toFixed(1) + " MB";
  return (b / 1_073_741_824).toFixed(2) + " GB";
}

/** Format seconds to human-readable string */
function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) return "–";
  if (s < 60) return Math.ceil(s) + "s";
  return `${Math.floor(s / 60)}m ${Math.ceil(s % 60)}s`;
}

/** Strip characters illegal in file/folder names on any OS */
function sanitizePath(s) {
  if (!s) return "Unknown";
  return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "Unknown";
}

/** HTML-escape a string for safe insertion via innerHTML */
function esc(str) {
  const d = document.createElement("div");
  d.textContent = String(str ?? "");
  return d.innerHTML;
}

window.LMSUtils = { TYPE_EMOJI, fmtBytes, fmtTime, sanitizePath, esc };
