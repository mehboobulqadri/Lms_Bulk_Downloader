/* downloader.js — download engine + ZIP builder */
"use strict";
(() => {

  const { TYPE_EMOJI, fmtBytes, fmtTime, sanitizePath, esc } = window.LMSUtils;
  const { loadJob, clearJob } = window.JobStorage;

  /* ═══════════════════════════════════════════════
     MIME → extension fallback map
  ═══════════════════════════════════════════════ */
  const CONTENT_TYPE_EXT = {
    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/msword": "doc",
    "application/vnd.ms-excel": "xls",
    "application/vnd.ms-powerpoint": "ppt",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "text/plain": "txt",
    "video/mp4": "mp4",
    "audio/mpeg": "mp3",
  };

  /* ═══════════════════════════════════════════════
     DOWNLOAD ENGINE
  ═══════════════════════════════════════════════ */
  class DownloadEngine {
    constructor({ concurrency = 12, maxRetries = 3,
      onStart, onDone, onFail, onProgress, onConcChange } = {}) {
      this.concurrency = concurrency;
      this.maxRetries = maxRetries;
      this.onStart = onStart ?? (() => { });
      this.onDone = onDone ?? (() => { });
      this.onFail = onFail ?? (() => { });
      this.onProgress = onProgress ?? (() => { });
      this.onConcChange = onConcChange ?? (() => { });

      this._ctrl = new AbortController();
      this.paused = false;
      this.active = 0;
      this.completed = 0;
      this.failed = 0;
      this.bytes = 0;
      this.total = 0;
      this._t0 = 0;
      this._errors = 0; // consecutive error streak
    }

    pause() { this.paused = true; }
    resume() { this.paused = false; }
    abort() { this._ctrl.abort(); }

    /** Download all files with a fixed pool of workers. */
    async run(files) {
      this.total = files.length;
      this._t0 = Date.now();
      let idx = 0;

      const worker = async () => {
        while (idx < files.length) {
          if (this._ctrl.signal.aborted) return;
          while (this.paused && !this._ctrl.signal.aborted) await this._sleep(200);
          if (this._ctrl.signal.aborted) return;

          // Throttle to current concurrency cap
          if (this.active >= this.concurrency) { await this._sleep(80); continue; }

          const file = files[idx++];
          await this._fetch(file);
        }
      };

      const poolSize = Math.min(this.concurrency, files.length);
      await Promise.all(Array.from({ length: poolSize }, worker));
    }

    /** Fetch one file, retry on transient errors. */
    async _fetch(file) {
      this.active++;
      this.onStart(file);

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const url = this._patchUrl(file.url);
          const resp = await fetch(url, { credentials: "include", signal: this._ctrl.signal });

          if (resp.status === 429) {
            this._throttle();
            await this._sleep(2000 * attempt);
            continue;
          }
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

          const ct = resp.headers.get("content-type") ?? "";
          if (ct.includes("text/html")) throw new Error("Session expired (got HTML)");

          const blob = await resp.blob();
          const name = this._resolveName(file.name, resp);

          this.active--;
          this.completed++;
          this.bytes += blob.size;
          this._errors = 0;
          this.onDone({ file: { ...file, name }, blob, size: blob.size });
          this._emit();
          return;

        } catch (err) {
          if (this._ctrl.signal.aborted) { this.active--; return; }
          if (attempt < this.maxRetries) { await this._sleep(1000 * attempt); continue; }

          this.active--;
          this.failed++;
          if (++this._errors >= 3) this._throttle();
          this.onFail({ file, error: err.message });
          this._emit();
        }
      }
    }

    /** Parse Content-Disposition (RFC 5987 + legacy) then fall back to URL/MIME. */
    _resolveName(fallback, resp) {
      const cd = resp.headers.get("content-disposition") ?? "";
      if (cd) {
        const rfc5987 = cd.match(/filename\*=UTF-8''([^;]+)/i);
        if (rfc5987) return sanitizePath(decodeURIComponent(rfc5987[1]));
        const legacy = cd.match(/filename=(?:"([^"]+)"|([^;]+))/i);
        if (legacy) return sanitizePath((legacy[1] ?? legacy[2]).trim());
      }

      // Try final URL (after redirect)
      const urlExt = new URL(resp.url).pathname.split(".").pop().toLowerCase();
      if (urlExt && urlExt !== "php" && urlExt.length <= 5) {
        const base = fallback.replace(/\.php$/i, "").replace(/\.[^.]+$/, "");
        return sanitizePath(`${base}.${urlExt}`);
      }

      // MIME fallback
      const mime = (resp.headers.get("content-type") ?? "").split(";")[0].trim();
      if (CONTENT_TYPE_EXT[mime]) {
        const base = fallback.replace(/\.php$/i, "").replace(/\.[^.]+$/, "");
        return sanitizePath(`${base}.${CONTENT_TYPE_EXT[mime]}`);
      }

      return sanitizePath(fallback);
    }

    _patchUrl(url) {
      if (url.includes("mod/resource/view.php") && !url.includes("redirect=")) {
        return url + (url.includes("?") ? "&" : "?") + "redirect=1";
      }
      return url;
    }

    _throttle() {
      if (this.concurrency <= 2) return;
      this.concurrency = Math.max(2, this.concurrency - 2);
      this.onConcChange(this.concurrency);
    }

    _emit() {
      const elapsed = (Date.now() - this._t0) / 1000;
      const done = this.completed + this.failed;
      const speed = elapsed > 0 ? this.bytes / elapsed : 0;
      const eta = done > 0 ? (this.total - done) * (elapsed / done) : 0;
      this.onProgress({
        completed: this.completed, failed: this.failed,
        total: this.total, bytes: this.bytes, speed, eta
      });
    }

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  }

  /* ═══════════════════════════════════════════════
     UI
  ═══════════════════════════════════════════════ */
  const $ = id => document.getElementById(id);
  const $courseName = $("course-name");
  const $pbar = $("pbar");
  const $ptext = $("ptext");
  const $statFiles = $("stat-files");
  const $statBytes = $("stat-bytes");
  const $statSpeed = $("stat-speed");
  const $statEta = $("stat-eta");
  const $statConc = $("stat-conc");
  const $btnPause = $("btn-pause");
  const $btnCancel = $("btn-cancel");
  const $btnSave = $("btn-save");
  const $doneBanner = $("done-banner");
  const $doneText = $("done-text");
  const $errorBanner = $("error-banner");
  const $fileList = $("file-list");

  /** url → row element */
  const rows = new Map();

  function buildList(files) {
    $fileList.innerHTML = "";
    files.forEach(f => {
      const el = document.createElement("div");
      el.className = "file-item";
      el.innerHTML =
        `<span class="icon">${TYPE_EMOJI[f.type] || "📎"}</span>` +
        `<span class="name" title="${esc(f.name)}">${esc(f.name)}</span>` +
        `<span class="size">–</span>` +
        `<span class="status status-pending">Pending</span>`;
      $fileList.appendChild(el);
      rows.set(f.url, el);
    });
  }

  function setRow(url, state, label = "") {
    const row = rows.get(url);
    if (!row) return;
    const s = row.querySelector(".status");
    const z = row.querySelector(".size");
    s.className = `status status-${state}`;
    s.textContent = state === "done" ? "✓ Done" :
      state === "error" ? `✗ ${label || "Failed"}` :
        "Downloading…";
    if (state === "done" && label) z.textContent = label;
  }

  /* ═══════════════════════════════════════════════
     MAIN
  ═══════════════════════════════════════════════ */
  let zipBlob = null;
  let engine = null;
  let paused = false;

  async function main() {
    const job = await loadJob();
    if (!job?.files?.length) {
      $courseName.textContent = "No job found — open the popup on a course page first.";
      return;
    }

    const { courseName, files } = job;
    $courseName.textContent = courseName;
    $statConc.textContent = 12; // starting value
    document.title = `Downloading – ${courseName}`;

    buildList(files);

    const zip = new JSZip();
    const root = zip.folder(sanitizePath(courseName));
    const errs = [];

    engine = new DownloadEngine({
      concurrency: 12,

      onStart: f => setRow(f.url, "downloading"),

      onDone({ file, blob, size }) {
        setRow(file.url, "done", fmtBytes(size));
        const folder = root.folder(sanitizePath(file.section || "General"));

        // Deduplicate filenames within folder
        let name = sanitizePath(file.name);
        const extM = name.match(/(\.[^.]+)$/);
        const ext = extM ? extM[1] : "";
        const base = extM ? name.slice(0, -ext.length) : name;
        let n = 1;
        while (folder.file(name)) name = `${base} (${n++})${ext}`;
        folder.file(name, blob);
      },

      onFail({ file, error }) {
        setRow(file.url, "error", error);
        errs.push(`${file.name}: ${error}`);
      },

      onProgress({ completed, failed, total, bytes, speed, eta }) {
        const pct = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
        $pbar.style.width = pct + "%";
        $ptext.textContent = pct + "%";
        $statFiles.textContent = `${completed + failed} / ${total}`;
        $statBytes.textContent = fmtBytes(bytes);
        $statSpeed.textContent = fmtBytes(speed) + "/s";
        $statEta.textContent = fmtTime(eta);
      },

      onConcChange(n) {
        $statConc.textContent = n;
        $statConc.style.color = "#d97706"; // amber — throttled
      }
    });

    await engine.run(files);

    // Build ZIP
    $ptext.textContent = "Building ZIP…";
    zipBlob = await zip.generateAsync(
      { type: "blob", compression: "DEFLATE", compressionOptions: { level: 5 } },
      m => { $ptext.textContent = `Zipping… ${Math.round(m.percent)}%`; }
    );

    $pbar.style.width = "100%";
    $ptext.textContent = "Complete ✓";
    $doneBanner.style.display = "block";
    $doneText.textContent =
      `${engine.completed} file${engine.completed !== 1 ? "s" : ""} — ` +
      `${fmtBytes(engine.bytes)} → ${fmtBytes(zipBlob.size)} ZIP`;

    if (errs.length) {
      $errorBanner.style.display = "block";
      // Use textContent to avoid XSS on error strings
      $errorBanner.textContent = `${errs.length} file(s) failed:\n` + errs.join("\n");
    }

    $btnSave.classList.remove("btn-disabled");
    clearJob();
  }

  /* ── Controls ── */
  $btnPause.addEventListener("click", () => {
    if (!engine) return;
    paused = !paused;
    paused ? engine.pause() : engine.resume();
    $btnPause.innerHTML = paused ? "▶ Resume" : "⏸ Pause";
    $btnPause.className = paused ? "btn-success" : "btn-warn";
  });

  $btnCancel.addEventListener("click", () => {
    if (!engine || !confirm("Cancel all downloads?")) return;
    engine.abort();
    $ptext.textContent = "Cancelled";
  });

  $btnSave.addEventListener("click", () => {
    if (!zipBlob) return;
    const url = URL.createObjectURL(zipBlob);
    chrome.downloads.download(
      { url, filename: sanitizePath($courseName.textContent || "LMS_Download") + ".zip", saveAs: true },
      () => setTimeout(() => URL.revokeObjectURL(url), 60_000)
    );
  });

  main().catch(err => {
    $errorBanner.style.display = "block";
    $errorBanner.textContent = "Fatal: " + err.message;
    console.error("[LMS Downloader]", err);
  });

  // Set version dynamically
  const manifest = chrome.runtime.getManifest();
  const $version = $("app-version");
  if ($version) $version.textContent = `v${manifest.version}`;

})();