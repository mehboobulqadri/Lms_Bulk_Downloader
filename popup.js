/* popup.js — extension popup controller */
"use strict";
(() => {

  const { TYPE_EMOJI, esc } = window.LMSUtils;
  const { saveJob } = window.JobStorage;

  /* ── DOM ── */
  const el = id => document.getElementById(id);
  const $loading = el("state-loading");
  const $error = el("state-error");
  const $errorMsg = el("error-msg");
  const $empty = el("state-empty");
  const $files = el("state-files");
  const $fileList = el("file-list");
  const $controls = el("controls");
  const $btnAll = el("btn-all");
  const $btnNone = el("btn-none");
  const $selCount = el("selected-count");
  const $btnDl = el("btn-download");
  const $btnRetry = el("btn-retry");

  const STATES = [$loading, $error, $empty, $files];

  /* ── State ── */
  let scanData = null;

  /* ── Helpers ── */
  function showState(target) {
    STATES.forEach(s => s.classList.toggle("active", s === target));
  }

  function updateCount() {
    const boxes = $fileList.querySelectorAll("input[data-url]");
    const checked = [...boxes].filter(b => b.checked).length;
    $selCount.textContent = `${checked} selected`;
    $btnDl.disabled = checked === 0;
  }

  /* ── Render ── */
  function render(data) {
    scanData = data;
    $fileList.innerHTML = "";

    data.sections.forEach((section, si) => {
      const group = document.createElement("div");
      group.className = "section-group";

      // — header
      const header = document.createElement("div");
      header.className = "section-header";
      header.innerHTML =
        `<input type="checkbox" data-section="${si}" checked>` +
        `<span class="arrow">▼</span>` +
        `<span class="section-name">${esc(section.name)}</span>` +
        `<span class="count">${section.files.length}</span>`;
      group.appendChild(header);

      // — file rows
      const filesDiv = document.createElement("div");
      filesDiv.className = "section-files";

      section.files.forEach(f => {
        const row = document.createElement("div");
        row.className = "file-row";
        row.innerHTML =
          `<input type="checkbox" data-url="${esc(f.url)}" data-section="${si}" checked>` +
          `<span class="emoji">${TYPE_EMOJI[f.type] || "📎"}</span>` +
          `<span class="fname" title="${esc(f.name)}">${esc(f.name)}</span>` +
          `<span class="ftype">${esc(f.type)}</span>`;
        filesDiv.appendChild(row);
      });

      group.appendChild(filesDiv);
      $fileList.appendChild(group);

      // — collapse toggle
      header.addEventListener("click", e => {
        if (e.target.tagName === "INPUT") return;
        header.querySelector(".arrow").classList.toggle("collapsed");
        filesDiv.classList.toggle("collapsed");
      });

      // — section checkbox controls all children
      const secBox = header.querySelector("input");
      secBox.addEventListener("change", () => {
        filesDiv.querySelectorAll("input").forEach(b => { b.checked = secBox.checked; });
        updateCount();
      });

      // — child checkboxes update section header state
      filesDiv.addEventListener("change", () => {
        const all = [...filesDiv.querySelectorAll("input")];
        const n = all.filter(b => b.checked).length;
        secBox.checked = n === all.length;
        secBox.indeterminate = n > 0 && n < all.length;
        updateCount();
      });
    });

    updateCount();
  }

  /* ── Scan ── */
  async function scan() {
    showState($loading);
    $controls.style.display = "none";

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.url?.includes("lms.nust.edu.pk")) {
        $errorMsg.textContent = "Navigate to a course page on lms.nust.edu.pk first.";
        showState($error);
        return;
      }

      let resp;
      try {
        resp = await chrome.tabs.sendMessage(tab.id, { action: "scan" });
      } catch {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
        await new Promise(r => setTimeout(r, 200));
        resp = await chrome.tabs.sendMessage(tab.id, { action: "scan" });
      }

      if (!resp?.ok) throw new Error(resp?.error || "Scan failed");

      const total = resp.data.sections.reduce((n, s) => n + s.files.length, 0);
      if (total === 0) { showState($empty); return; }

      render(resp.data);
      showState($files);
      $controls.style.display = "";

    } catch (err) {
      $errorMsg.textContent = err.message;
      showState($error);
    }
  }

  /* ── Events ── */
  $btnRetry.addEventListener("click", scan);

  $btnAll.addEventListener("click", () => {
    $fileList.querySelectorAll("input").forEach(b => { b.checked = true; b.indeterminate = false; });
    updateCount();
  });

  $btnNone.addEventListener("click", () => {
    $fileList.querySelectorAll("input").forEach(b => { b.checked = false; b.indeterminate = false; });
    updateCount();
  });

  $btnDl.addEventListener("click", async () => {
    const selected = [];
    $fileList.querySelectorAll("input[data-url]:checked").forEach(box => {
      const si = parseInt(box.dataset.section, 10);
      const sec = scanData.sections[si];
      const file = sec.files.find(f => f.url === box.dataset.url);
      if (file) selected.push({ ...file, section: sec.name });
    });
    if (!selected.length) return;

    await saveJob({ courseName: scanData.courseName, files: selected, timestamp: Date.now() });
    chrome.tabs.create({ url: chrome.runtime.getURL("downloader.html") });
  });

  scan();
})();