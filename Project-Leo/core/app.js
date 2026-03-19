// ═══════════════════════════════════════════════════════════
//  Project Leo — app.js  v3.0
// ═══════════════════════════════════════════════════════════

var cur = "", all = [], ct = null, vPath = "";
var selMode = false, selected = new Set();
var moveDest = "", moveItems = [];
var driveLabel = "D:";
var _allDrives = [];
var _nav = false;
var _zipping = false;
var _uploading = false;

// ── Auth token — stored in sessionStorage (cleared when browser closes) ──
var _token = sessionStorage.getItem("leo_token") || "";

function setToken(t) { _token = t; sessionStorage.setItem("leo_token", t); }
function clearToken() { _token = ""; sessionStorage.removeItem("leo_token"); }

// Redirect to login if we get a 401 from any API call
function handle401() { clearToken(); location.href = "/login"; }

// Authenticated fetch wrapper — always sends X-Leo-Token header
function apiFetch(url, opts) {
  opts = opts || {};
  opts.headers = opts.headers || {};
  opts.headers["X-Leo-Token"] = _token;
  return fetch(url, opts).then(function (r) {
    if (r.status === 401) { handle401(); throw new Error("Unauthorized"); }
    return r;
  });
}

// Logout function — callable from UI
function logout() {
  apiFetch(api("/api/logout"), { method: "POST" })
    .catch(function () { })
    .finally(function () { clearToken(); location.href = "/login"; });
}

// ═══════════════════════════════════════════════════════════
//  BEFORE-UNLOAD GUARD — warn on refresh/close during upload or zip
// ═══════════════════════════════════════════════════════════
window.addEventListener("beforeunload", function (e) {
  if (_zipping || _uploading) {
    e.preventDefault();
    e.returnValue = _uploading
      ? "Upload is in progress. Leaving will cancel it."
      : "Zipping is in progress. Leaving will cancel the download.";
    return e.returnValue;
  }
});

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function api(p) { return location.protocol + "//" + location.host + p; }
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// ═══════════════════════════════════════════════════════════
//  HEARTBEAT — detect server stop immediately
// ═══════════════════════════════════════════════════════════
var _hbOk = true, _hbInterval = null, _hbPending = false, _hbFails = 0;
var _HB_THRESHOLD = 2; // need 2 consecutive failures before going "offline"

function startHeartbeat() {
  if (_hbInterval) clearInterval(_hbInterval);
  _hbInterval = setInterval(function () {
    if (_hbPending) return;
    _hbPending = true;
    var ctrl = new AbortController();
    var tid = setTimeout(function () { ctrl.abort(); }, 1800);
    fetch(api("/api/info"), { method: "GET", cache: "no-store", signal: ctrl.signal, headers: { "X-Leo-Token": _token } })
      .then(function (r) {
        clearTimeout(tid); _hbPending = false;
        if (r.ok) {
          _hbFails = 0; // reset consecutive failure count
          if (!_hbOk) {
            // Was offline — now recovered
            _hbOk = true;
            document.getElementById("offline-banner").classList.remove("show");
            document.getElementById("dn").style.opacity = "";
            document.querySelector(".dot").style.background = "";
          }
        }
      })
      .catch(function () {
        clearTimeout(tid); _hbPending = false;
        _hbFails++;
        if (_hbFails >= _HB_THRESHOLD && _hbOk) {
          // Only go offline after N consecutive failures — filters out 1s wifi blips
          _hbOk = false;
          document.getElementById("offline-banner").classList.add("show");
          document.getElementById("dn").style.opacity = "0.4";
          document.querySelector(".dot").style.background = "var(--dan)";
        }
      });
  }, 1500);
}

// ═══════════════════════════════════════════════════════════
//  NAVIGATION & HISTORY
// ═══════════════════════════════════════════════════════════

window.addEventListener("popstate", function (e) {
  if (document.getElementById("viewer").classList.contains("show")) { closeViewer(); return; }
  loadAnim((e.state && e.state.path != null) ? e.state.path : "", "back");
});

function load(p) {
  if (selMode) clearSelection();
  history.pushState({ path: p }, "", p === "" ? "/" : "/?path=" + encodeURIComponent(p));
  loadAnim(p, "forward");
}
function reload() { loadNoHistory(cur); }

async function loadAnim(p, dir) {
  if (_nav) return; _nav = true;
  var pg = document.getElementById("page");
  pg.style.cssText = "transition:opacity .14s;opacity:0;overflow:hidden";
  await wait(140);
  pg.style.cssText = "transition:none;opacity:0;overflow:hidden";
  await loadNoHistory(p);
  pg.style.cssText = "transition:opacity .18s;opacity:1;overflow:hidden";
  setTimeout(function () { pg.style.cssText = ""; }, 200);
  _nav = false;
}

async function loadNoHistory(p) {
  cur = p; bread();
  document.getElementById("grid").innerHTML = '<div class="empty"><i class="bi bi-hourglass-split"></i><p>Loading...</p></div>';
  try {
    var d = await (await apiFetch(api("/api/files?path=" + encodeURIComponent(p)))).json();
    if (d.error) {
      document.getElementById("grid").innerHTML = '<div class="empty"><i class="bi bi-exclamation-triangle"></i><p>' + esc(d.error) + '</p></div>';
      toast(d.error, "er"); return;
    }
    all = d.items || []; render(all);
    document.getElementById("st-txt").textContent =
      all.filter(function (x) { return x.is_dir; }).length + " folders, " +
      all.filter(function (x) { return !x.is_dir; }).length + " files";
  } catch (e) {
    document.getElementById("grid").innerHTML = '<div class="empty"><i class="bi bi-wifi-off"></i><p>' + esc(e.message) + '</p></div>';
    toast(e.message, "er");
  }
}

async function init() {
  try {
    var d = await (await apiFetch(api("/api/info"))).json();
    document.getElementById("dn").textContent = d.hostname + " - " + d.ip;
    if (d.drive) driveLabel = d.drive;
    if (d.disk && d.disk.total > 0) renderDisk(d.disk, d.drive || "D:");
  } catch (e) { document.getElementById("dn").textContent = "Connected"; }
  // Load drives list in background
  apiFetch(api("/api/drives")).then(function (r) { return r.json(); })
    .then(function (d) { _allDrives = d.drives || []; bread(); })
    .catch(function () { });
  var sp = new URLSearchParams(location.search).get("path") || "";
  history.replaceState({ path: sp }, "", sp ? "/?path=" + encodeURIComponent(sp) : "/");
  loadNoHistory(sp);
  startHeartbeat();
}

function renderDisk(disk, drive) {
  var total = disk.total, used = disk.used, free = disk.free;
  var pct = total > 0 ? Math.round((used / total) * 100) : 0;
  function fmt(b) { if (!b) return "0 B"; var k = 1024, s = ["B", "KB", "MB", "GB", "TB"], i = Math.floor(Math.log(b) / Math.log(k)); return parseFloat((b / Math.pow(k, i)).toFixed(1)) + " " + s[i]; }
  var col = pct > 85 ? "var(--dan)" : pct > 60 ? "var(--acc)" : "var(--ok)";
  var el = document.getElementById("disk-bar");
  if (!el) return;
  el.innerHTML = '<div class="disk-info">' +
    '<div class="disk-top">' +
    '<span class="disk-drive"><i class="bi bi-hdd-fill"></i> ' + esc(drive) + '</span>' +
    '<span class="disk-nums">' + fmt(used) + ' / ' + fmt(total) + ' &nbsp;·&nbsp; <span style="color:' + col + '">' + fmt(free) + ' free</span></span>' +
    '</div>' +
    '<div class="disk-track"><div class="disk-fill" style="width:' + pct + '%;background:' + col + '"></div></div>' +
    '</div>';
}

// ═══════════════════════════════════════════════════════════
//  FILE TYPE HELPERS
// ═══════════════════════════════════════════════════════════

function ext(n) { return (n.split(".").pop() || "").toLowerCase(); }
function isImg(n) { return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext(n)); }
function isVid(n) { return ["mp4", "mkv", "webm", "avi", "mov", "m4v", "3gp"].includes(ext(n)); }
function isAud(n) { return ["mp3", "wav", "ogg", "flac", "m4a", "aac"].includes(ext(n)); }
function isPdf(n) { return ext(n) === "pdf"; }
function isTxt(n) { return ["txt", "log", "md", "json", "js", "py", "html", "css", "xml", "csv", "ini", "bat", "sh"].includes(ext(n)); }
function isView(n) { return isImg(n) || isVid(n) || isAud(n) || isPdf(n) || isTxt(n); }

function fileIcon(n, isDir, sz) {
  var s = sz || "font-size:clamp(25px,5.5vw,34px)";
  if (isDir) return '<i class="bi bi-folder-fill" style="color:#f5a623;' + s + '"></i>';
  if (isImg(n)) return '<i class="bi bi-image-fill" style="color:#7dd3fc;' + s + '"></i>';
  if (isVid(n)) return '<i class="bi bi-play-circle-fill" style="color:#a78bfa;' + s + '"></i>';
  if (isAud(n)) return '<i class="bi bi-music-note-beamed" style="color:#f472b6;' + s + '"></i>';
  if (isPdf(n)) return '<i class="bi bi-file-earmark-pdf-fill" style="color:#f87171;' + s + '"></i>';
  if (isTxt(n)) return '<i class="bi bi-file-earmark-text-fill" style="color:#94a3b8;' + s + '"></i>';
  var e = ext(n), m = {
    doc: "bi-file-earmark-word-fill:#60a5fa", docx: "bi-file-earmark-word-fill:#60a5fa",
    xls: "bi-file-earmark-excel-fill:#4ade80", xlsx: "bi-file-earmark-excel-fill:#4ade80",
    ppt: "bi-file-earmark-ppt-fill:#fb923c", pptx: "bi-file-earmark-ppt-fill:#fb923c",
    zip: "bi-file-zip-fill:#fbbf24", rar: "bi-file-zip-fill:#fbbf24", "7z": "bi-file-zip-fill:#fbbf24",
    exe: "bi-gear-fill:#94a3b8", apk: "bi-android2:#4ade80"
  };
  if (m[e]) { var pp = m[e].split(":"); return '<i class="bi ' + pp[0] + '" style="color:' + pp[1] + ';' + s + '"></i>'; }
  return '<i class="bi bi-file-earmark-fill" style="color:#475569;' + s + '"></i>';
}

function fs(b) {
  if (!b) return "0 B";
  var k = 1024, s = ["B", "KB", "MB", "GB", "TB"], i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + " " + s[i];
}
function fspeed(bps) {
  if (bps < 1024) return bps.toFixed(0) + " B/s";
  if (bps < 1048576) return (bps / 1024).toFixed(1) + " KB/s";
  return (bps / 1048576).toFixed(2) + " MB/s";
}
function ftime(sec) {
  if (!isFinite(sec) || sec < 2) return "";
  if (sec < 60) return " · ETA " + Math.ceil(sec) + "s";
  if (sec < 3600) return " · ETA " + Math.floor(sec / 60) + "m " + Math.ceil(sec % 60) + "s";
  return " · ETA " + Math.floor(sec / 3600) + "h " + Math.floor((sec % 3600) / 60) + "m";
}

// ═══════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════

function render(items) {
  var q = document.getElementById("sqi").value.toLowerCase();
  var f = q ? items.filter(function (i) { return i.name.toLowerCase().includes(q); }) : items;
  f = [...f].sort(function (a, b) {
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;
    return a.name.localeCompare(b.name);
  });
  if (!f.length) {
    document.getElementById("grid").innerHTML = '<div class="empty"><i class="bi bi-inbox"></i><p>Nothing here</p></div>';
    return;
  }
  var h = "";
  for (var i = 0; i < f.length; i++) {
    var nm = f[i].name, isDir = f[i].is_dir;
    var nq = nm.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    var fp = cur ? (cur + "/" + nm) : nm;
    var fpq = fp.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    var delay = (Math.min(i, 12) * 0.025).toFixed(3);
    var isSel = selected.has(fp);
    var tHtml;
    if (isDir) {
      tHtml = '<div class="thumb"><div class="thumb-in">' + fileIcon(nm, true) + '</div></div>';
    } else if (isImg(nm)) {
      var tu = api("/api/thumb?tok=" + _token + "&path=" + encodeURIComponent(fp));
      tHtml = '<div class="thumb loading" id="th-' + i + '">'
        + '<div class="thumb-in"><img src="' + tu + '" loading="lazy" '
        + 'onload="var t=this.closest(\'.thumb\');if(t)t.classList.remove(\'loading\')" '
        + 'onerror="var t=this.closest(\'.thumb\');if(t){t.classList.remove(\'loading\');t.querySelector(\'.thumb-in\').innerHTML=\'' + fileIcon(nm, false).replace(/'/g, "\\'").replace(/"/g, "&quot;") + '\'}">'
        + '</div></div>';
    } else if (isVid(nm)) {
      tHtml = '<div class="thumb" id="th-' + i + '">'
        + '<div class="thumb-in" id="thi-' + i + '">' + fileIcon(nm, false) + '</div>'
        + '<div class="play-badge"><div class="pbi"><i class="bi bi-play-fill"></i></div></div>'
        + '</div>';
    } else {
      tHtml = '<div class="thumb"><div class="thumb-in">' + fileIcon(nm, false) + '</div></div>';
    }
    h += '<div class="item' + (isSel ? ' selected' : '') + (selMode ? ' selmode' : '') + '" '
      + 'style="animation-delay:' + delay + 's" '
      + 'data-path="' + esc(fp) + '" '
      + 'onclick="handleTap(\'' + nq + '\',' + isDir + ',\'' + fpq + '\')" '
      + 'oncontextmenu="showCtx(event,\'' + nq + '\',' + isDir + ',\'' + fpq + '\')">'
      + '<div class="sel-chk"><i class="bi bi-check2"></i></div>'
      + tHtml
      + '<div class="cinfo">'
      + '<div class="nm" title="' + esc(nm) + '">' + esc(nm) + '</div>'
      + '<div class="sz">' + (isDir ? '<i class="bi bi-folder2-open" style="font-size:9px"></i> Folder' : fs(f[i].size)) + '</div>'
      + '</div></div>';
  }
  document.getElementById("grid").innerHTML = h;
  for (var i = 0; i < f.length; i++) {
    if (!f[i].is_dir && isVid(f[i].name)) lazyVidThumb(cur ? (cur + "/" + f[i].name) : f[i].name, i);
  }
}

// ═══════════════════════════════════════════════════════════
//  VIDEO THUMBNAILS — throttled, queued, cross-browser safe
// ═══════════════════════════════════════════════════════════

// Only try thumbnails for formats browsers can decode in a canvas
function canThumbVid(n) {
  return ["mp4", "webm", "m4v", "mov", "3gp"].includes(ext(n));
}

var _vobs = {}, _vidQueue = [], _vidActive = 0, _VID_MAX = 3;

function lazyVidThumb(fp, idx) {
  var nm = fp.split("/").pop();
  if (!canThumbVid(nm)) return; // skip mkv/avi — browser can't canvas-capture these
  var el = document.getElementById("thi-" + idx);
  if (!el || _vobs[idx]) return;
  _vobs[idx] = new IntersectionObserver(function (entries, obs) {
    if (entries[0].isIntersecting) {
      obs.disconnect(); delete _vobs[idx];
      _vidQueue.push({ fp: fp, idx: idx });
      drainVidQueue();
    }
  }, { rootMargin: "300px" });
  _vobs[idx].observe(el);
}
function drainVidQueue() {
  while (_vidActive < _VID_MAX && _vidQueue.length) {
    var job = _vidQueue.shift();
    _vidActive++;
    genVidThumb(job.fp, job.idx, function () { _vidActive--; drainVidQueue(); });
  }
}
function genVidThumb(fp, idx, done) {
  var thi = document.getElementById("thi-" + idx), th = document.getElementById("th-" + idx);
  if (!thi || !th) { done && done(); return; }
  var vid = document.createElement("video"), finished = false;
  vid.muted = true; vid.preload = "metadata";
  vid.setAttribute("playsinline", "");
  vid.setAttribute("crossorigin", "anonymous");
  function finish() {
    if (finished) return; finished = true;
    try { vid.pause(); vid.removeAttribute("src"); vid.load(); } catch (e) { }
    done && done();
  }
  function capture() {
    try {
      var c = document.createElement("canvas"); c.width = 180; c.height = 180;
      var ctx2 = c.getContext("2d");
      var vw = vid.videoWidth || 180, vh = vid.videoHeight || 180, sc = Math.max(180 / vw, 180 / vh);
      ctx2.drawImage(vid, (180 - vw * sc) / 2, (180 - vh * sc) / 2, vw * sc, vh * sc);
      var url = c.toDataURL("image/jpeg", 0.55);
      if (thi && thi.parentNode) {
        thi.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;display:block">';
        if (th) th.classList.remove("loading");
      }
    } catch (e) { }
    finish();
  }
  vid.addEventListener("loadeddata", function () {
    // Seek to 0.5s — always within the first 8 MB chunk, no extra range requests needed
    try { vid.currentTime = 0.5; } catch (e) { finish(); }
  });
  vid.addEventListener("seeked", capture);
  vid.addEventListener("error", finish);
  vid.addEventListener("stalled", finish);
  vid.addEventListener("abort", finish);
  // 5s hard timeout — faster than before so queue keeps moving
  setTimeout(function () { if (!finished) finish(); }, 5000);
  // No stagger delay — server is threaded, parallel requests are fine
  vid.src = api("/api/view?tok=" + _token + "&path=" + encodeURIComponent(fp));
  vid.load();
}

// ═══════════════════════════════════════════════════════════
//  SELECTION
// ═══════════════════════════════════════════════════════════

function handleTap(nm, isDir, fp) {
  if (selMode) { toggleSelect(fp); return; }
  if (selected.size > 0) { toggleSelect(fp); return; }
  if (isDir) { load(cur ? cur + "/" + nm : nm); }
  else if (isView(nm)) { openViewer(nm); }
  else { toast("Long-press for options", "ok"); }
}
function toggleSelMode() {
  if (selMode) { clearSelection(); }
  else { selMode = true; updateSelBtn(); updateSelbar(); render(all); }
}
function clearSelection() {
  selMode = false; selected.clear(); updateSelBtn(); updateSelbar(); render(all);
}
function updateSelBtn() {
  var b = document.getElementById("sel-btn");
  if (selMode) b.classList.add("active-sel"); else b.classList.remove("active-sel");
}
function selectAll() {
  var allPaths = all.map(function (item) { return cur ? (cur + "/" + item.name) : item.name; });
  var allSel = allPaths.every(function (fp) { return selected.has(fp); });
  if (allSel) {
    allPaths.forEach(function (fp) { selected.delete(fp); });
  } else {
    allPaths.forEach(function (fp) { selected.add(fp); });
  }
  updateSelbar(); render(all);
}
function toggleSelect(fp) {
  if (selected.has(fp)) selected.delete(fp); else selected.add(fp);
  updateSelbar();
  var card = document.querySelector('[data-path="' + CSS.escape(fp) + '"]');
  if (card) card.classList.toggle("selected", selected.has(fp));
}
function updateSelbar() {
  var n = selected.size;
  document.getElementById("sel-count").textContent = n;
  document.getElementById("selbar").classList.toggle("show", selMode || n > 0);
}

// ═══════════════════════════════════════════════════════════
//  BREADCRUMB
// ═══════════════════════════════════════════════════════════

function bread() {
  var el = document.getElementById("bread"), parts = cur ? cur.split("/") : [];
  var chipHtml = _allDrives.length > 1
    ? '<span class="drive-chip drive-chip-btn" onclick="toggleDriveMenu(event)" title="Switch drive">'
    + '<i class="bi bi-hdd-fill" style="font-size:9px"></i> ' + esc(driveLabel)
    + '<i class="bi bi-chevron-down drive-chip-arr"></i>'
    + '</span>'
    : '<span class="drive-chip"><i class="bi bi-hdd-fill" style="font-size:9px"></i> ' + esc(driveLabel) + '</span>';

  var h = '<span class="crumb' + (cur === "" ? " active" : "") + '" onclick="load(\'\')">'
    + '<i class="bi bi-house-door-fill"></i> Root'
    + chipHtml
    + '</span>';
  var acc = "";
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i]; acc = acc ? acc + "/" + p : p;
    var pa = acc.replace(/'/g, "\\'");
    h += '<span class="bread-sep"><i class="bi bi-chevron-right"></i></span>';
    h += '<span class="crumb' + (i === parts.length - 1 ? " active" : "") + '" onclick="load(\'' + pa + '\')">' + esc(p) + '</span>';
  }
  el.innerHTML = h;
  setTimeout(function () { el.scrollLeft = el.scrollWidth; }, 50);
}
function goUp() { if (!cur) return; var p = cur.split("/"); p.pop(); load(p.join("/")); }
function filter() { render(all); }

// ═══════════════════════════════════════════════════════════
//  DRIVE SWITCHER
// ═══════════════════════════════════════════════════════════

function toggleDriveMenu(e) {
  e.stopPropagation();
  var existing = document.getElementById("drive-menu");
  if (existing) { existing.remove(); return; }

  var menu = document.createElement("div");
  menu.id = "drive-menu";
  menu.className = "drive-menu";

  function fmtSize(b) {
    if (!b) return "?";
    var k = 1024, s = ["B", "KB", "MB", "GB", "TB"], i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + " " + s[i];
  }

  _allDrives.forEach(function (drv) {
    var pct = drv.total > 0 ? Math.round((drv.used / drv.total) * 100) : 0;
    var col = pct > 85 ? "var(--dan)" : pct > 60 ? "var(--acc)" : "var(--ok)";
    var item = document.createElement("div");
    item.className = "drive-item" + (drv.active ? " drive-item-active" : "");
    item.innerHTML =
      '<div class="drive-item-top">'
      + '<i class="bi bi-hdd-fill" style="color:' + (drv.active ? "var(--acc)" : "var(--mut)") + ';font-size:14px"></i>'
      + '<span class="drive-item-letter">' + esc(drv.letter) + '</span>'
      + (drv.active ? '<span class="drive-item-badge">Active</span>' : '')
      + '<span class="drive-item-free" style="color:' + col + '">' + fmtSize(drv.free) + ' free</span>'
      + '</div>'
      + (drv.total > 0
        ? '<div class="drive-item-track"><div class="drive-item-fill" style="width:' + pct + '%;background:' + col + '"></div></div>'
        : '');
    if (!drv.active) {
      item.onclick = function () { switchDrive(drv.letter); };
    }
    menu.appendChild(item);
  });

  // Position below the chip
  var chip = e.currentTarget;
  var rect = chip.getBoundingClientRect();
  menu.style.top = (rect.bottom + 6) + "px";
  menu.style.left = rect.left + "px";
  document.body.appendChild(menu);

  // Close on outside click
  setTimeout(function () {
    document.addEventListener("click", function _close(ev) {
      if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("click", _close); }
    });
  }, 0);
}

async function switchDrive(letter) {
  var menu = document.getElementById("drive-menu");
  if (menu) menu.remove();
  try {
    var d = await (await apiFetch(api("/api/setdrive"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drive: letter })
    })).json();
    if (!d.success) { toast(d.error || "Failed to switch drive", "er"); return; }
    driveLabel = d.drive;
    // Update _allDrives active flag
    _allDrives.forEach(function (drv) { drv.active = (drv.letter === d.drive); });
    if (d.disk && d.disk.total > 0) renderDisk(d.disk, d.drive);
    // Navigate to root of new drive
    cur = "";
    history.replaceState({ path: "" }, "", "/");
    loadAnim("", "forward");
    toast("Switched to " + d.drive, "ok");
  } catch (e) { toast("Drive switch failed: " + e.message, "er"); }
}

// ═══════════════════════════════════════════════════════════
//  CONTEXT MENUS
// ═══════════════════════════════════════════════════════════

function showCtx(e, nm, isDir, fp) {
  e.preventDefault(); e.stopPropagation();
  hCtx(); hCtxMulti();
  ct = { nm: nm, isDir: isDir, fp: fp };
  if (selected.size > 0) {
    document.getElementById("ctx-multi-count").textContent = selected.size;
    var m = document.getElementById("ctx-multi");
    m.style.left = Math.min(e.clientX, innerWidth - 185) + "px";
    m.style.top = Math.min(e.clientY, innerHeight - 180) + "px";
    m.classList.add("show");
  } else {
    document.getElementById("ctx-view").style.display = isDir ? "none" : "flex";
    document.getElementById("ctx-rename").style.display = "flex";
    var m = document.getElementById("ctx");
    m.style.left = Math.min(e.clientX, innerWidth - 175) + "px";
    m.style.top = Math.min(e.clientY, innerHeight - 220) + "px";
    m.classList.add("show");
  }
}
document.addEventListener("click", function (e) {
  if (!e.target.closest(".ctx") && !e.target.closest("#ctx-multi")) { hCtx(); hCtxMulti(); }
});
function hCtx() { var m = document.getElementById("ctx"); m.classList.remove("show"); m.classList.add("hide"); setTimeout(function () { m.classList.remove("hide"); }, 180); }
function hCtxMulti() { var m = document.getElementById("ctx-multi"); m.classList.remove("show"); m.classList.add("hide"); setTimeout(function () { m.classList.remove("hide"); }, 180); }

function cView() { if (ct && !ct.isDir) openViewer(ct.nm); hCtx(); }
function cRename() { if (ct) showRename(ct.nm); hCtx(); }
function cMove() { showMoveModal(ct ? ct.fp : null); hCtx(); }
function cDl() {
  if (!ct) return;
  hCtx();
  if (ct.isDir) {
    // Folder → zip download (same path as bulk but for single item)
    _singleZipDownload([ct.fp], ct.nm);
  } else {
    triggerDownload(api("/api/download?path=" + encodeURIComponent(ct.fp)), ct.nm);
  }
}
async function cDel() {
  hCtx();
  if (!ct || !confirm("Delete \"" + ct.nm + "\"?")) return;
  var d = await (await apiFetch(api("/api/delete?path=" + encodeURIComponent(ct.fp)), { method: "DELETE" })).json();
  if (d.success) { toast("Deleted!", "ok"); reload(); } else toast(d.error || "Error", "er");
}
function cSel() {
  if (!ct) return;
  hCtx();
  if (!selMode) { selMode = true; updateSelBtn(); updateSelbar(); render(all); }
  selected.add(ct.fp);
  updateSelbar();
  var card = document.querySelector('[data-path="' + CSS.escape(ct.fp) + '"]');
  if (card) card.classList.add("selected");
}

// ═══════════════════════════════════════════════════════════
//  BULK DELETE
// ═══════════════════════════════════════════════════════════

async function bulkDelete() {
  if (!selected.size) return;
  var items = [...selected];
  if (!confirm("Delete " + items.length + " item(s)? Cannot be undone.")) return;
  try {
    var d = await (await apiFetch(api("/api/delete_bulk"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items })
    })).json();
    toast("Deleted " + d.deleted + " item(s)", "ok");
    clearSelection(); reload();
  } catch (e) { toast(e.message, "er"); }
}

// ═══════════════════════════════════════════════════════════
//  DOWNLOAD PROGRESS BAR — mirrors upload bar style
// ═══════════════════════════════════════════════════════════

var _dprogTickId = null;

function dprogShow() {
  var el = document.getElementById("dprog");
  el.className = "show";
  el.classList.add("show");
  document.body.classList.add("dprog-visible");
  document.getElementById("tc").classList.add("up-active");
  var cancelBtn = document.getElementById("dprog-cancel");
  if (cancelBtn) cancelBtn.style.display = "flex";
}

function dprogSetZip(msg, pct) {
  // Zipping phase: determinate progress bar, blue colour
  var el = document.getElementById("dprog");
  el.className = "show";
  document.getElementById("dprog-ico").className = "bi bi-arrow-repeat dprog-spin";
  document.getElementById("dprog-msg").textContent = msg;
  document.getElementById("dprog-pct").textContent = Math.round(pct) + "%";
  var fill = document.getElementById("dprog-fill");
  fill.classList.remove("indeterminate");
  fill.style.width = Math.round(pct) + "%";
  document.getElementById("dprog-sub").textContent = "⚠ Don't refresh or close the tab";
  var cancelBtn = document.getElementById("dprog-cancel");
  if (cancelBtn) cancelBtn.style.display = "flex";
}

function dprogSetDownload(msg) {
  // Downloading phase: indeterminate bar, green colour
  var el = document.getElementById("dprog");
  el.className = "show dl-mode";
  document.getElementById("dprog-ico").className = "bi bi-download";
  document.getElementById("dprog-msg").textContent = msg;
  document.getElementById("dprog-pct").textContent = "...";
  var fill = document.getElementById("dprog-fill");
  fill.classList.add("indeterminate");
  document.getElementById("dprog-sub").textContent = "Browser is downloading the zip file...";
  var cancelBtn = document.getElementById("dprog-cancel");
  if (cancelBtn) cancelBtn.style.display = "none"; // can't cancel once browser has the blob
}

function dprogSetDownloadPct(name, pct, info) {
  var el = document.getElementById("dprog");
  el.className = "show dl-mode";
  document.getElementById("dprog-ico").className = "bi bi-download";
  document.getElementById("dprog-msg").textContent = name;
  var fill = document.getElementById("dprog-fill");
  if (pct >= 0) {
    fill.classList.remove("indeterminate");
    fill.style.width = Math.round(pct) + "%";
    document.getElementById("dprog-pct").textContent = Math.round(pct) + "%";
  } else {
    fill.classList.add("indeterminate");
    document.getElementById("dprog-pct").textContent = "";
  }
  document.getElementById("dprog-sub").textContent = info || "Downloading...";
  var cancelBtn = document.getElementById("dprog-cancel");
  if (cancelBtn) cancelBtn.style.display = "flex";
}

function dprogSetDone(msg) {
  // Done: full bar, green
  var el = document.getElementById("dprog");
  el.className = "show done-mode";
  document.getElementById("dprog-ico").className = "bi bi-check-circle-fill";
  document.getElementById("dprog-msg").textContent = msg;
  document.getElementById("dprog-pct").textContent = "✓";
  var fill = document.getElementById("dprog-fill");
  fill.classList.remove("indeterminate");
  fill.style.width = "100%";
  document.getElementById("dprog-sub").textContent = "Download complete!";
  var cancelBtn = document.getElementById("dprog-cancel");
  if (cancelBtn) cancelBtn.style.display = "none";
}

function dprogSetCancelled() {
  var el = document.getElementById("dprog");
  el.className = "show cancel-mode";
  document.getElementById("dprog-ico").className = "bi bi-x-circle-fill";
  document.getElementById("dprog-msg").textContent = "Cancelled";
  document.getElementById("dprog-pct").textContent = "";
  var fill = document.getElementById("dprog-fill");
  fill.classList.remove("indeterminate");
  // Drain the bar smoothly to 0
  fill.style.transition = "width .4s cubic-bezier(.4,0,.2,1)";
  fill.style.width = "0%";
  document.getElementById("dprog-sub").textContent = "Download was cancelled";
  var cancelBtn = document.getElementById("dprog-cancel");
  if (cancelBtn) cancelBtn.style.display = "none";
}

function dprogHide() {
  var el = document.getElementById("dprog");
  // Animate out first, then fully hide
  el.classList.add("hiding");
  setTimeout(function () {
    el.classList.remove("show", "hiding", "dl-mode", "done-mode", "cancel-mode");
    el.className = "";
    document.body.classList.remove("dprog-visible");
    document.getElementById("tc").classList.remove("up-active");
    document.getElementById("dprog-fill").classList.remove("indeterminate");
    document.getElementById("dprog-fill").style.width = "0%";
    var cancelBtn = document.getElementById("dprog-cancel");
    if (cancelBtn) cancelBtn.style.display = "none";
  }, 290);
}

// ═══════════════════════════════════════════════════════════
//  BULK DOWNLOAD — single file direct, multiple → streaming zip
// ═══════════════════════════════════════════════════════════

// ── Zip download abort controller ──────────────────────────
var _zipAbort = null;

function cancelZipDownload() {
  if (_zipAbort) { try { _zipAbort.abort(); } catch (e) { } _zipAbort = null; }
}

// Shared zip-download engine — XHR for real download progress + cancellable
function _singleZipDownload(items, zipName) {
  var zipCount = items.length;
  _zipping = true;
  dprogShow();
  dprogSetZip("Zipping " + zipCount + " item(s)...", 0);

  var xhr = new XMLHttpRequest();
  _zipAbort = { abort: function () { xhr.abort(); } };

  xhr.open("POST", api("/api/zip"), true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.setRequestHeader("X-Leo-Token", _token);
  xhr.responseType = "blob";

  // ── Real download progress ───────────────────────────────
  xhr.addEventListener("progress", function (e) {
    if (_dprogTickId) { clearInterval(_dprogTickId); _dprogTickId = null; }
    function fmt(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB"; }
    if (e.lengthComputable && e.total > 0) {
      var pct = (e.loaded / e.total) * 100;
      dprogSetDownloadPct(zipName + ".zip", pct, fmt(e.loaded) + " / " + fmt(e.total));
    } else {
      dprogSetDownloadPct(zipName + ".zip", -1, fmt(e.loaded) + " received");
    }
  });

  // ── Headers received = zipping done, streaming starts ───
  xhr.addEventListener("readystatechange", function () {
    if (xhr.readyState === 2 /*HEADERS_RECEIVED*/) {
      if (_dprogTickId) { clearInterval(_dprogTickId); _dprogTickId = null; }
      dprogSetZip("Zipping done, downloading...", 100);
    }
  });

  xhr.addEventListener("load", function () {
    if (_dprogTickId) { clearInterval(_dprogTickId); _dprogTickId = null; }
    _zipping = false; _zipAbort = null;
    if (xhr.status !== 200) { dprogHide(); toast("Zip failed: server error " + xhr.status, "er"); return; }
    var blob = xhr.response;
    if (!blob || blob.size === 0) { dprogHide(); toast("Zip is empty", "er"); return; }
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = zipName + ".zip"; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 15000);
    var sz = blob.size > 1048576 ? (blob.size / 1048576).toFixed(1) + " MB" : Math.round(blob.size / 1024) + " KB";
    dprogSetDone(zipName + ".zip  (" + sz + ")");
    clearSelection();
    setTimeout(dprogHide, 3500);
  });

  xhr.addEventListener("error", function () {
    if (_dprogTickId) { clearInterval(_dprogTickId); _dprogTickId = null; }
    _zipping = false; _zipAbort = null;
    dprogHide(); toast("Zip download failed", "er");
  });

  xhr.addEventListener("abort", function () {
    if (_dprogTickId) { clearInterval(_dprogTickId); _dprogTickId = null; }
    _zipping = false; _zipAbort = null;
    dprogSetCancelled();
    setTimeout(dprogHide, 2500);
  });

  // Fake zip progress ticks until HEADERS_RECEIVED
  var fakeStart = Date.now();
  _dprogTickId = setInterval(function () {
    var elapsed = (Date.now() - fakeStart) / 1000;
    var pct = Math.min(85, 85 * (1 - Math.exp(-elapsed / 6)));
    dprogSetZip("Zipping " + zipCount + " item(s)...", pct);
  }, 200);

  xhr.send(JSON.stringify({ items: items, name: zipName }));
}

async function bulkDownload() {
  var items = [...selected];
  if (!items.length) { toast("Nothing selected", "er"); return; }
  hCtxMulti();

  // ── Single plain file → direct download, no zip ──────────
  if (items.length === 1) {
    var onlyItem = items[0];
    var nm = onlyItem.split("/").pop();
    var entry = all.find(function (x) { return (cur ? cur + "/" + x.name : x.name) === onlyItem; });
    if (entry && !entry.is_dir) {
      triggerDownload(api("/api/download?path=" + encodeURIComponent(onlyItem)), nm);
      clearSelection();
      return;
    }
    // Single folder → zip it (falls through)
  }

  // ── Multiple items or any folder → streaming zip ─────────
  var zipName = (cur ? cur.split("/").pop() : "selection") || "selection";
  await _singleZipDownload(items, zipName);
}

// ═══════════════════════════════════════════════════════════
//  DOWNLOAD — direct link, browser handles streaming natively
// ═══════════════════════════════════════════════════════════

function triggerDownload(url, filename) {
  var a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { a.remove(); }, 1000);
  toast("Downloading: " + filename, "ok");
}

function viewerDl() {
  if (!vPath) return;
  triggerDownload(api("/api/download?path=" + encodeURIComponent(vPath)), vPath.split("/").pop());
}

// ═══════════════════════════════════════════════════════════
//  MOVE
// ═══════════════════════════════════════════════════════════

function showMoveModal(itemPath) {
  moveItems = itemPath ? [itemPath] : [...selected];
  if (!moveItems.length) { toast("Nothing selected", "er"); return; }
  moveDest = cur;
  var srch = document.getElementById("move-search"); if (srch) srch.value = "";
  var nf = document.getElementById("move-new-folder"); if (nf) nf.value = "";
  loadMoveList(cur);
  document.getElementById("moveov").classList.add("show");
}
var _moveAllDirs = [];

async function loadMoveList(p) {
  var list = document.getElementById("move-list");
  var srch = document.getElementById("move-search"); if (srch) srch.value = "";
  list.innerHTML = '<div style="padding:10px;color:var(--mut);font-size:12px"><i class="bi bi-hourglass-split"></i> Loading...</div>';
  try {
    var d = await (await apiFetch(api("/api/files?path=" + encodeURIComponent(p)))).json();
    _moveAllDirs = (d.items || []).filter(function (x) { return x.is_dir; });
    renderMoveList(p, _moveAllDirs, "");
    document.getElementById("move-cur-path").textContent = p || "Root";
    moveDest = p;
  } catch (e) { list.innerHTML = '<div style="padding:10px;color:var(--dan)">' + esc(e.message) + '</div>'; }
}

function renderMoveList(p, dirs, qfilter) {
  var list = document.getElementById("move-list");
  var filtered = qfilter ? dirs.filter(function (x) { return x.name.toLowerCase().includes(qfilter.toLowerCase()); }) : dirs;
  var html = "";
  if (p && !qfilter) {
    var par = p.split("/"); par.pop();
    html += "<div class=\"move-item mv-up\" data-path=\"" + encodeURIComponent(par.join("/")) + "\">" +
      "<i class=\"bi bi-arrow-up-circle\" style=\"color:var(--acc)\"></i>" +
      "<span style=\"color:var(--acc)\">.. Go Up</span></div>";
  }
  if (!filtered.length) {
    html += "<div style=\"padding:10px;color:var(--mut);font-size:11px;text-align:center\">" +
      (qfilter ? "No folders matching &quot;" + esc(qfilter) + "&quot;" : "No subfolders here") + "</div>";
  }
  filtered.forEach(function (item) {
    var fp = p ? (p + "/" + item.name) : item.name;
    var active = (moveDest === fp) ? " active" : "";
    html += "<div class=\"move-item mv-sel" + active + "\" data-path=\"" + encodeURIComponent(fp) + "\">" +
      "<i class=\"bi bi-folder-fill\" style=\"color:var(--acc)\"></i>" +
      "<span style=\"flex:1\">" + esc(item.name) + "</span>" +
      "<i class=\"bi bi-chevron-right move-nav mv-nav\" data-path=\"" + encodeURIComponent(fp) + "\"></i>" +
      "</div>";
  });
  list.innerHTML = html;
  list.querySelectorAll(".mv-up").forEach(function (el) {
    el.onclick = function () { loadMoveList(decodeURIComponent(el.dataset.path)); };
  });
  list.querySelectorAll(".mv-sel").forEach(function (el) {
    el.onclick = function () { selectMoveDest(decodeURIComponent(el.dataset.path)); };
  });
  list.querySelectorAll(".mv-nav").forEach(function (el) {
    el.onclick = function (e) { e.stopPropagation(); loadMoveList(decodeURIComponent(el.dataset.path)); };
  });
}
function filterMoveList() {
  var srch = document.getElementById("move-search");
  renderMoveList(moveDest, _moveAllDirs, srch ? srch.value : "");
}

function selectMoveDest(p) { moveDest = p; loadMoveList(p); }

async function mkDirInMove() {
  var inp = document.getElementById("move-new-folder");
  var n = inp ? inp.value.trim() : "";
  if (!n) { inp.focus(); return; }
  var newPath = moveDest ? (moveDest + "/" + n) : n;
  try {
    var d = await (await apiFetch(api("/api/mkdir?path=" + encodeURIComponent(newPath)), { method: "POST" })).json();
    if (d.success) {
      inp.value = "";
      toast("Folder '" + n + "' created", "ok");
      await loadMoveList(moveDest);
      var fp = newPath; moveDest = fp;
      var card = document.querySelector('[data-path="' + CSS.escape(fp) + '"]');
      if (card) card.classList.add("active");
    } else toast(d.error || "Error", "er");
  } catch (e) { toast(e.message, "er"); }
}

async function doMove() {
  var dest = moveDest;
  if (!moveItems.length) { closeMoveModal(); return; }
  try {
    var d = await (await apiFetch(api("/api/move"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: moveItems, dest: dest })
    })).json();
    toast("Moved " + d.moved + " item(s)", "ok");
    clearSelection(); closeMoveModal(); reload();
  } catch (e) { toast(e.message, "er"); }
}
function closeMoveModal() {
  var ov = document.getElementById("moveov");
  var modal = ov.querySelector(".modal");
  modal.style.cssText = "animation:moveModalOut .2s cubic-bezier(.4,0,.2,1) both";
  ov.style.opacity = "0";
  ov.style.transition = "opacity .2s";
  setTimeout(function () {
    ov.classList.remove("show");
    ov.style.opacity = "";
    ov.style.transition = "";
    modal.style.cssText = "";
  }, 210);
}

// ═══════════════════════════════════════════════════════════
//  UPLOAD — XHR with real progress, speed, ETA + CANCEL
// ═══════════════════════════════════════════════════════════

function toggleUp() { document.getElementById("upz").classList.toggle("on"); }

function dropF(e) {
  e.preventDefault(); document.getElementById("upz").classList.remove("ov");
  var items = e.dataTransfer.items;
  if (items && items.length) {
    var fileList = [], promises = [];
    for (var i = 0; i < items.length; i++) {
      var entry = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
      if (entry) promises.push(traverseEntry(entry, "", fileList));
    }
    Promise.all(promises).then(function () { startUpload(fileList); });
  } else {
    startUpload(Array.from(e.dataTransfer.files).map(function (f) { return { file: f, rel: f.name }; }));
  }
}
function traverseEntry(entry, base, list) {
  return new Promise(function (resolve) {
    if (entry.isFile) {
      entry.file(function (f) { list.push({ file: f, rel: base ? base + "/" + entry.name : entry.name }); resolve(); });
    } else if (entry.isDirectory) {
      var reader = entry.createReader(), all2 = [];
      function readAll() {
        reader.readEntries(function (entries) {
          if (!entries.length) { Promise.all(all2).then(resolve); return; }
          entries.forEach(function (e2) { all2.push(traverseEntry(e2, base ? base + "/" + entry.name : entry.name, list)); });
          readAll();
        });
      }
      readAll();
    } else resolve();
  });
}
function upFilesInput(input) {
  var list = [];
  for (var i = 0; i < input.files.length; i++) {
    var f = input.files[i];
    list.push({ file: f, rel: f.webkitRelativePath || f.name });
  }
  input.value = "";
  startUpload(list);
}

// ── Upload state ──────────────────────────────────────────
var _upList = [], _upIdx = 0, _upOk = 0, _upFail = 0;
var _upStartTime = 0, _upPrevBytes = 0, _upTotalBytes = 0;
var _upCurXhr = null, _upCancelled = false;

function startUpload(list) {
  if (!list.length) return;
  document.getElementById("upz").classList.remove("on");

  _upList = list; _upIdx = 0; _upOk = 0; _upFail = 0; _upCancelled = false;
  _upStartTime = Date.now(); _upPrevBytes = 0; _upTotalBytes = 0;
  for (var i = 0; i < list.length; i++) _upTotalBytes += list[i].file.size;

  var doneEl = document.getElementById("uprog-done");
  doneEl.classList.remove("show", "ok-state", "cancel-state");
  document.getElementById("upfill").style.width = "0%";
  document.getElementById("uprog-pct").textContent = "0%";
  document.getElementById("uprog-msg").textContent = "Starting...";

  document.getElementById("uprog").classList.add("show");
  document.getElementById("tc").classList.add("up-active");
  var cancelBtn = document.getElementById("uprog-cancel");
  if (cancelBtn) cancelBtn.style.display = "";

  _uploading = true;
  uploadOne();
}

function setUpProg(msg, pct, extra) {
  document.getElementById("uprog-msg").textContent = msg + (extra || "");
  document.getElementById("uprog-pct").textContent = Math.round(pct) + "%";
  document.getElementById("upfill").style.width = Math.round(pct) + "%";
}

function cancelUpload() {
  if (!document.getElementById("uprog").classList.contains("show")) return;
  _upCancelled = true;
  if (_upCurXhr) {
    try { _upCurXhr.abort(); } catch (e) { }
    _upCurXhr = null;
  }
  showUpFinish(true);
}

function showUpFinish(cancelled) {
  _uploading = false;
  var cancelBtn = document.getElementById("uprog-cancel");
  if (cancelBtn) cancelBtn.style.display = "none";
  document.getElementById("upfill").style.width = "100%";
  document.getElementById("uprog-pct").textContent = "100%";
  document.getElementById("uprog-msg").textContent = "";

  var doneEl = document.getElementById("uprog-done");
  var doneMsg = document.getElementById("uprog-done-msg");

  if (cancelled) {
    doneEl.className = "";
    doneEl.classList.add("show", "cancel-state");
    doneEl.querySelector("i").className = "bi bi-x-circle-fill";
    doneMsg.textContent = "Cancelled — " + _upOk + " file(s) saved";
  } else {
    doneEl.className = "";
    doneEl.classList.add("show", "ok-state");
    doneEl.querySelector("i").className = "bi bi-check-circle-fill";
    doneMsg.textContent = _upOk + " file(s) uploaded" + (_upFail ? " · " + _upFail + " failed" : "") + " ✓";
    toast(_upOk + " file(s) uploaded!", "ok");
  }

  setTimeout(function () {
    document.getElementById("uprog").classList.remove("show");
    doneEl.classList.remove("show", "ok-state", "cancel-state");
    document.getElementById("tc").classList.remove("up-active");
    document.getElementById("upfill").style.width = "0%";
    if (!cancelled) reload();
  }, 3000);
}

function uploadOne() {
  if (_upCancelled) return;
  if (_upIdx >= _upList.length) { showUpFinish(false); return; }

  var item = _upList[_upIdx];
  var nm = item.rel.split("/").pop() || item.rel;
  var xhr = new XMLHttpRequest();
  _upCurXhr = xhr;

  xhr.upload.addEventListener("progress", function (e) {
    if (!e.lengthComputable) return;
    var doneBytes = _upPrevBytes + e.loaded;
    var elapsed = (Date.now() - _upStartTime) / 1000;
    var speed = elapsed > 0 ? doneBytes / elapsed : 0;
    var remaining = speed > 0 ? (_upTotalBytes - doneBytes) / speed : 0;
    var totalPct = _upTotalBytes > 0 ? (doneBytes / _upTotalBytes) * 100 : 0;
    var label = "(" + (_upIdx + 1) + "/" + _upList.length + ") " + nm;
    var extra = (speed > 100 ? " · " + fspeed(speed) : "") + ftime(remaining);
    setUpProg(label, totalPct, extra);
  });

  xhr.addEventListener("load", function () {
    _upPrevBytes += item.file.size;
    if (xhr.status === 200) {
      try { var d = JSON.parse(xhr.responseText); if (d.success) _upOk++; else _upFail++; }
      catch (e) { _upFail++; }
    } else { _upFail++; }
    _upIdx++; _upCurXhr = null;
    uploadOne();
  });
  xhr.addEventListener("error", function () {
    _upPrevBytes += item.file.size; _upFail++; _upIdx++; _upCurXhr = null;
    uploadOne();
  });
  xhr.addEventListener("abort", function () { _upCurXhr = null; });

  xhr.open("POST", api("/api/upload?path=" + encodeURIComponent(cur)));
  xhr.setRequestHeader("X-Filename", encodeURIComponent(item.rel));
  xhr.setRequestHeader("X-Leo-Token", _token);
  xhr.send(item.file);
}

// ═══════════════════════════════════════════════════════════
//  FOLDER / RENAME
// ═══════════════════════════════════════════════════════════

function showMk() { document.getElementById("mkov").classList.add("show"); setTimeout(function () { document.getElementById("fn").focus(); }, 80); }
function closeMk() { document.getElementById("mkov").classList.remove("show"); document.getElementById("fn").value = ""; }
async function mkDir() {
  var n = document.getElementById("fn").value.trim(); if (!n) return;
  var d = await (await apiFetch(api("/api/mkdir?path=" + encodeURIComponent(cur ? cur + "/" + n : n)), { method: "POST" })).json();
  if (d.success) { toast("Folder created!", "ok"); reload(); } else toast(d.error || "Error", "er");
  closeMk();
}
function showRename(nm) {
  document.getElementById("rn-input").value = nm;
  document.getElementById("rnov").classList.add("show");
  document.getElementById("rnov").dataset.orig = nm;
  setTimeout(function () { document.getElementById("rn-input").select(); }, 80);
}
function closeRename() { document.getElementById("rnov").classList.remove("show"); }
async function doRename() {
  var orig = document.getElementById("rnov").dataset.orig;
  var nw = document.getElementById("rn-input").value.trim();
  if (!nw || nw === orig) { closeRename(); return; }
  var p = cur ? cur + "/" + orig : orig;
  try {
    var d = await (await apiFetch(api("/api/rename?path=" + encodeURIComponent(p)), {
      method: "PATCH", headers: { "X-New-Name": encodeURIComponent(nw) }
    })).json();
    if (d.success) { toast("Renamed!", "ok"); reload(); } else toast(d.error || "Error", "er");
  } catch (e) { toast(e.message, "er"); }
  closeRename();
}

// ═══════════════════════════════════════════════════════════
//  VIEWER — cross-browser video with fallback
// ═══════════════════════════════════════════════════════════

function openViewer(nm) {
  vPath = cur ? cur + "/" + nm : nm;
  var url = api("/api/view?tok=" + _token + "&path=" + encodeURIComponent(vPath));
  var body = document.getElementById("vbody");
  document.getElementById("vtitle").textContent = nm;
  var ico = isImg(nm) ? "bi-image-fill" : isVid(nm) ? "bi-play-circle-fill" : isAud(nm) ? "bi-music-note-beamed" : isPdf(nm) ? "bi-file-earmark-pdf-fill" : "bi-file-earmark-text-fill";
  document.getElementById("vico").className = "bi " + ico;
  body.innerHTML = ""; body.classList.add("loading");
  if (isImg(nm)) {
    var img = new Image();
    img.onload = function () { body.classList.remove("loading"); };
    img.style.cssText = "max-width:100%;max-height:100%;object-fit:contain;border-radius:4px";
    img.src = url; body.appendChild(img);
  } else if (isVid(nm)) {
    var vid = document.createElement("video");
    vid.controls = true;
    vid.autoplay = true;
    vid.setAttribute("playsinline", "");
    vid.setAttribute("webkit-playsinline", "");
    vid.setAttribute("preload", "auto");
    vid.style.cssText = "max-width:100%;max-height:100%";
    // Use <source> with explicit type — critical for Firefox to accept the MIME
    var src = document.createElement("source");
    src.src = url;
    // Map extension to exact MIME Firefox needs
    var vidMimes = {
      mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska",
      avi: "video/x-msvideo", mov: "video/quicktime", m4v: "video/mp4",
      "3gp": "video/3gpp"
    };
    src.type = vidMimes[ext(nm)] || "video/mp4";
    vid.appendChild(src);
    vid.addEventListener("loadedmetadata", function () { body.classList.remove("loading"); });
    vid.addEventListener("canplay", function () { body.classList.remove("loading"); });
    vid.addEventListener("error", function () {
      body.classList.remove("loading");
      // Try direct src fallback (no <source>) — different error path in some browsers
      if (vid.querySelector("source")) {
        vid.innerHTML = "";
        vid.src = url;
        vid.load();
        return;
      }
      body.innerHTML = '<div style="color:var(--mut);text-align:center;padding:40px">'
        + '<i class="bi bi-exclamation-triangle" style="font-size:36px;display:block;margin-bottom:12px"></i>'
        + 'Video format not supported by this browser.<br>'
        + '<small style="opacity:.6">' + esc(nm) + '</small></div>';
    });
    body.appendChild(vid);
  } else if (isAud(nm)) {
    body.classList.remove("loading");
    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:18px;padding:50px 20px;width:100%";
    wrap.innerHTML = fileIcon(nm, false, "font-size:52px");
    var aud = document.createElement("audio");
    aud.src = url; aud.controls = true; aud.style.width = "90%";
    aud.setAttribute("preload", "metadata");
    wrap.appendChild(aud); body.appendChild(wrap);
  } else if (isPdf(nm)) {
    body.classList.remove("loading");
    var ifr = document.createElement("iframe");
    ifr.src = url; ifr.style.cssText = "width:100%;height:100%"; body.appendChild(ifr);
  } else if (isTxt(nm)) {
    var pre = document.createElement("pre"); pre.className = "txv"; pre.textContent = "Loading...";
    body.appendChild(pre);
    fetch(url).then(function (r) { return r.text(); })
      .then(function (t) { pre.textContent = t; body.classList.remove("loading"); })
      .catch(function (e) { pre.textContent = "Error: " + e; body.classList.remove("loading"); });
  }
  document.getElementById("viewer").classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeViewer() {
  document.getElementById("viewer").classList.remove("show");
  document.body.style.overflow = "";
  setTimeout(function () {
    var m = document.getElementById("vbody").querySelector("video,audio");
    if (m) { try { m.pause(); m.removeAttribute("src"); m.load(); } catch (e) { } }
    document.getElementById("vbody").innerHTML = "";
  }, 250);
}

// ═══════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════

function toast(msg, type) {
  var c = document.getElementById("tc"), t = document.createElement("div");
  var ico = type === "er" ? "bi-exclamation-triangle" : "bi-check-circle";
  t.className = "toast " + (type || "ok");
  t.innerHTML = '<i class="bi ' + ico + '"></i><span>' + esc(msg) + '</span>';
  c.appendChild(t);
  setTimeout(function () {
    t.style.cssText = "opacity:0;transform:translateY(6px);transition:.2s";
    setTimeout(function () { t.remove(); }, 200);
  }, 3500);
}

// ═══════════════════════════════════════════════════════════
//  START
// ═══════════════════════════════════════════════════════════
init();