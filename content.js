/* content.js — Moodle page scanner (runs on lms.nust.edu.pk) */
"use strict";
(() => {

  /* ── Constants ── */
  const FILE_EXTS = new Set([
    "pdf", "ppt", "pptx", "doc", "docx", "xls", "xlsx",
    "zip", "rar", "7z", "tar", "gz",
    "txt", "csv", "rtf",
    "png", "jpg", "jpeg", "gif", "bmp", "svg",
    "mp4", "mkv", "avi", "mov", "webm",
    "mp3", "wav", "ogg", "flac"
  ]);

  // Map Moodle icon path keywords → guessed file type
  const ICON_MAP = {
    pdf: "pdf", powerpoint: "pptx", document: "docx",
    spreadsheet: "xlsx", archive: "zip", text: "txt",
    video: "mp4", audio: "mp3", image: "png", sourcecode: "txt"
  };

  /* ── Helpers ── */
  function getExt(url) {
    try {
      const m = new URL(url).pathname.match(/\.([a-z0-9]{1,5})$/i);
      return m ? m[1].toLowerCase() : null;
    } catch { return null; }
  }

  function getFilename(url) {
    try {
      return decodeURIComponent(new URL(url).pathname.split("/").pop()) || null;
    } catch { return null; }
  }

  function sanitize(name) {
    return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "file";
  }

  function textOf(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll(".accesshide,.sr-only,.visually-hidden").forEach(h => h.remove());
    return clone.textContent.replace(/\s+/g, " ").trim();
  }

  function iconType(img) {
    if (!img) return null;
    const src = (img.getAttribute("src") || "").toLowerCase();
    for (const [k, v] of Object.entries(ICON_MAP)) {
      if (src.includes(`/f/${k}`) || src.includes(`icon/${k}`)) return v;
    }
    return null;
  }

  function isDownloadable(url) {
    if (!url) return false;
    const ext = getExt(url);
    return (
      url.includes("pluginfile.php") ||
      url.includes("mod/resource/view.php") ||
      url.includes("mod/folder/view.php") ||
      url.includes("forcedownload=1") ||
      (ext !== null && ext !== "php" && FILE_EXTS.has(ext))
    );
  }

  /* ── Extractors ── */
  function courseName() {
    for (const sel of ["h1.h2", ".page-header-headings h1", "h1", ".course-header h1", "title"]) {
      const el = document.querySelector(sel);
      if (el) {
        const t = textOf(el);
        if (t && t.length < 200) return sanitize(t);
      }
    }
    return "LMS_Course";
  }

  function sectionName(el, idx) {
    for (const sel of [".sectionname", ".section-title", "h3.sectionname", "h2", ".content > h3"]) {
      const child = el.querySelector(sel);
      if (child) { const t = textOf(child); if (t) return t; }
    }
    return el.getAttribute("aria-label")?.trim() || `Section ${idx + 1}`;
  }

  function filesFrom(container, seen) {
    const out = [];

    // Method A: Moodle activity items
    container.querySelectorAll("li.activity, .activity-item, .activityinstance").forEach(act => {
      const link = act.querySelector("a[href]");
      if (!link || !isDownloadable(link.href) || seen.has(link.href)) return;
      seen.add(link.href);

      const icon = act.querySelector("img.activityicon, img.icon, .activityicon img");
      const nameEl = act.querySelector(".instancename, .aalink, .activityname, a");
      let name = nameEl ? textOf(nameEl) : null;

      const ext = getExt(link.href);
      const type = (ext && ext !== "php" ? ext : null) || iconType(icon) || "file";

      if (name && !getExt(name)) name = `${name}.${type}`;
      if (!name) name = getFilename(link.href) || `file.${type}`;

      out.push({ name: sanitize(name), url: link.href, type });
    });

    // Method B: bare pluginfile.php links
    container.querySelectorAll('a[href*="pluginfile.php"]').forEach(link => {
      if (seen.has(link.href)) return;
      seen.add(link.href);

      let name = getFilename(link.href) || textOf(link) || "file";
      const ext = getExt(link.href);
      const type = (ext && ext !== "php" ? ext : null) || "file";
      if (!getExt(name)) name = `${name}.${type}`;

      out.push({ name: sanitize(name), url: link.href, type });
    });

    return out;
  }

  /* ── Page scan ── */
  function scanPage() {
    const seen = new Set();
    const name = courseName();
    const sections = [];

    let els = document.querySelectorAll("li.section.main");
    if (!els.length) els = document.querySelectorAll("[data-region='section']");
    if (!els.length) els = document.querySelectorAll(".course-section, .section");

    els.forEach((sec, i) => {
      const files = filesFrom(sec, seen);
      if (files.length) sections.push({ name: sectionName(sec, i), files });
    });

    if (!sections.length) {
      const files = filesFrom(document.body, seen);
      if (files.length) sections.push({ name: "All Files", files });
    }

    return { courseName: name, sections };
  }

  /* ── Message listener ── */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "scan") {
      try { sendResponse({ ok: true, data: scanPage() }); }
      catch (e) { sendResponse({ ok: false, error: e.message }); }
    } else if (msg.action === "ping") {
      sendResponse({ alive: true });
    }
    return true;
  });

})();