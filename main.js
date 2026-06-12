(() => {
  // Bitmask layout — keep in sync with preprocess.py
  const RUN = 1, CHASE = 2, CLIMB = 4, EAT = 8, FORAGE = 16,
        KUK = 32, QUAA = 64, MOAN = 128,
        APPR = 1024, INDIFF = 2048, RUNSFROM = 4096;
  const ANYCALL = KUK | QUAA | MOAN;

  const CENSUS_DAYS = [6, 7, 8, 10, 12, 13, 14, 17, 18, 19, 20];

  const C = {
    paper:       [244, 241, 234],
    park:        [235, 231, 220],
    lawn:        [222, 222, 200],
    wood:        [213, 213, 192],
    water:       [202, 212, 209],
    ink:         [26, 26, 26],
    furGray:     [150, 146, 139],
    furCinnamon: [184, 107, 60],
    furBlack:    [15, 15, 15],
    am:          [212, 165, 66],
    pm:          [91, 138, 168],
    sound:       [217, 101, 68],
    approach:    [107, 153, 104],
    indifferent: [185, 181, 172],
    runs:        [194, 84, 80],
    actForage:   [158, 141, 117],
    actEat:      [96, 142, 131],
    actRun:      [222, 143, 56],
    actClimb:    [124, 112, 162],
    actChase:    [194, 84, 80],
  };

  const LEGENDS = {
    2: [["AM", C.am], ["PM", C.pm]],
    3: [["Gray", C.furGray], ["Cinnamon", C.furCinnamon], ["Black", C.furBlack]],
    4: [["Foraging", C.actForage], ["Eating", C.actEat], ["Running", C.actRun],
        ["Climbing", C.actClimb], ["Chasing", C.actChase]],
    5: [["Heard a call", C.sound]],
    6: [["Approached", C.approach], ["Indifferent", C.indifferent], ["Ran away", C.runs]],
  };

  // [lon, lat, anchor] — water/lawn labels get centroids computed after load
  const LANDMARKS = {
    reservoir:  { name: "The Reservoir",  water: "Jacqueline Kennedy Onassis Reservoir", anchor: "center" },
    lake:       { name: "The Lake",       water: "The Lake",      anchor: "center" },
    meer:       { name: "Harlem Meer",    water: "Harlem Meer",   anchor: "center" },
    pond:       { name: "The Pond",       water: "The Pond",      anchor: "center" },
    sheep:      { name: "Sheep Meadow",   lawn: "Sheep Meadow",   anchor: "center" },
    greatlawn:  { name: "Great Lawn",     lawn: "The Great Lawn", anchor: "center" },
    ramble:     { name: "The Ramble",     lon: -73.9697, lat: 40.7785, anchor: "right" },
    northwoods: { name: "North Woods",    lon: -73.9560, lat: 40.7975, anchor: "right" },
    mall:       { name: "The Mall",       lon: -73.9710, lat: 40.7702, anchor: "right" },
  };

  const CHAPTER_LANDMARKS = {
    1: ["reservoir", "lake"],
    2: ["sheep", "mall"],
    3: ["northwoods", "ramble"],
    4: ["greatlawn", "pond"],
    5: ["meer", "ramble"],
    6: ["mall", "sheep"],
    7: ["reservoir", "lake", "meer", "northwoods"],
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.getElementById("map");
  const ctx = canvas.getContext("2d");
  let base = document.createElement("canvas");
  let dpr = 1, cssW = 0, cssH = 0;
  let projection = null;
  let park = null;

  // Per-dot data
  let N = 0;
  let px, py;                 // projected coords
  let mask, shiftArr, furArr, dayIdx;
  let curR, curG, curB, curA, curRad;   // animated state
  let phase1, phase2, speed;            // per-dot motion seeds
  let soundIdx = [], soundOffsets = [];
  let cumByDay = [];

  let currentChapter = 0;
  let chapterProgress = 0;

  // --- layout ---

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement.getBoundingClientRect();
    const aspect = 1.45;
    let w = rect.width, h = rect.height;
    if (w / h > 1 / aspect) w = h / aspect; else h = w * aspect;
    cssW = w; cssH = h;
    for (const cv of [canvas, base]) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    projection = d3.geoMercator().fitExtent(
      [[20, 20], [w - 20, h - 20]],
      { type: "Polygon", coordinates: [park.boundary] }
    );
    const raw = window.__squirrelLL;
    for (let i = 0; i < N; i++) {
      const p = projection([raw[i * 2], raw[i * 2 + 1]]);
      px[i] = p[0]; py[i] = p[1];
    }
    renderBase();
  }

  function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

  function tracePath(g, ring) {
    ring.forEach((c, i) => {
      const p = projection(c);
      if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
    });
    g.closePath();
  }

  function renderBase() {
    const g = base.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);

    g.beginPath(); tracePath(g, park.boundary);
    g.fillStyle = rgba(C.park, 1); g.fill();

    for (const lawn of park.lawns) {
      g.beginPath(); tracePath(g, lawn.ring);
      g.fillStyle = rgba(C.lawn, 0.85); g.fill();
    }
    for (const wood of park.woods) {
      g.beginPath(); tracePath(g, wood.ring);
      g.fillStyle = rgba(C.wood, 0.7); g.fill();
    }
    g.strokeStyle = rgba([185, 178, 162], 0.9);
    g.lineWidth = 0.6;
    for (const tv of park.transverses) {
      g.beginPath();
      const a = projection(tv[0]), b = projection(tv[1]);
      g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      g.stroke();
    }
    for (const water of park.waters) {
      g.beginPath(); tracePath(g, water.ring);
      g.fillStyle = rgba(C.water, 1); g.fill();
      g.strokeStyle = rgba([168, 182, 178], 1); g.lineWidth = 0.5; g.stroke();
    }
    g.beginPath(); tracePath(g, park.boundary);
    g.strokeStyle = rgba(C.ink, 0.85); g.lineWidth = 0.8; g.stroke();
  }

  // --- per-chapter dot targets: write [r,g,b,alpha,radius] into out ---

  const FAINT = 0.05;
  function dotTarget(i, t, out) {
    const m = mask[i];
    const ch = currentChapter;

    if (ch === 0) {
      set(out, C.ink, 0.04, 1.3);

    } else if (ch === 1) {
      const cutoff = Math.max(0.6, chapterProgress * CENSUS_DAYS.length);
      const d = dayIdx[i];
      if (d + 1 <= cutoff) set(out, C.ink, 0.5, 1.6);
      else if (d < cutoff) set(out, C.ink, 0.5 * (cutoff - d), 1.6);
      else set(out, C.ink, 0, 1.0);

    } else if (ch === 2) {
      const period = 5200;
      const swing = reduceMotion ? 0.5 : (Math.sin((t % period) / period * Math.PI * 2) + 1) / 2;
      if (shiftArr[i] === 0) set(out, C.am, 0.15 + 0.62 * swing, 1.7);
      else set(out, C.pm, 0.15 + 0.62 * (1 - swing), 1.7);

    } else if (ch === 3) {
      const f = furArr[i];
      if (f === 2) {
        const pulse = reduceMotion ? 0.5 : (Math.sin(t / 380 + phase1[i]) + 1) / 2;
        set(out, C.furBlack, 0.9, 2.5 + pulse * 0.9);
      }
      else if (f === 1) set(out, C.furCinnamon, 0.85, 2.1);
      else if (f === 0) set(out, C.furGray, 0.4, 1.5);
      else set(out, C.ink, FAINT, 1.1);

    } else if (ch === 4) {
      if (m & CHASE)       set(out, C.actChase, 0.92, 2.3);
      else if (m & RUN)    set(out, C.actRun, 0.85, 2.0);
      else if (m & CLIMB)  set(out, C.actClimb, 0.8, 1.8);
      else if (m & EAT)    set(out, C.actEat, 0.8, 1.8);
      else if (m & FORAGE) set(out, C.actForage, 0.65, 1.6);
      else set(out, C.ink, FAINT, 1.1);

    } else if (ch === 5) {
      if (m & ANYCALL) set(out, C.sound, 0.95, 2.5);
      else set(out, C.ink, 0.07, 1.1);

    } else if (ch === 6) {
      if (m & APPR)          set(out, C.approach, 0.92, 2.6);
      else if (m & RUNSFROM) set(out, C.runs, 0.75, 1.9);
      else if (m & INDIFF)   set(out, C.indifferent, 0.55, 1.5);
      else set(out, C.ink, FAINT, 1.0);

    } else {
      // finale: everyone, in their own colors, breathing
      const f = furArr[i];
      const c = f === 2 ? C.furBlack : f === 1 ? C.furCinnamon : f === 0 ? C.furGray : C.ink;
      const breathe = reduceMotion ? 0 : Math.sin(t / 1400 + phase1[i]) * 0.35;
      set(out, c, f === 1 || f === 2 ? 0.8 : 0.45, 1.7 + breathe);
    }
  }

  function set(out, c, a, rad) {
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = a; out[4] = rad;
  }

  // --- render loop ---

  const tgt = new Float32Array(5);

  function render(t) {
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.drawImage(base, 0, 0, cssW, cssH);

    const k = 0.09; // lerp factor → smooth chapter cross-fades
    const ch = currentChapter;
    const jitterOn = ch === 4 && !reduceMotion;

    for (let i = 0; i < N; i++) {
      dotTarget(i, t, tgt);
      curR[i] += (tgt[0] - curR[i]) * k;
      curG[i] += (tgt[1] - curG[i]) * k;
      curB[i] += (tgt[2] - curB[i]) * k;
      curA[i] += (tgt[3] - curA[i]) * k;
      curRad[i] += (tgt[4] - curRad[i]) * k;

      if (curA[i] < 0.01) continue;

      let x = px[i], y = py[i];
      if (jitterOn) {
        const m = mask[i];
        if (m & (CHASE | RUN)) {
          x += Math.sin(t * 0.004 * speed[i] + phase1[i]) * 2.2;
          y += Math.cos(t * 0.0033 * speed[i] + phase2[i]) * 2.2;
        } else if (m & CLIMB) {
          y += Math.sin(t * 0.0016 + phase1[i]) * 1.1;
        }
      }

      ctx.globalAlpha = curA[i];
      ctx.fillStyle = `rgb(${curR[i] | 0},${curG[i] | 0},${curB[i] | 0})`;
      ctx.beginPath();
      ctx.arc(x, y, curRad[i], 0, Math.PI * 2);
      ctx.fill();
    }

    if (ch === 5) drawSoundRings(t);
    ctx.globalAlpha = 1;
    drawAnnotations();
    updateTicker();
    requestAnimationFrame(render);
  }

  function drawSoundRings(t) {
    const period = 2600;
    ctx.strokeStyle = rgba(C.sound, 1);
    for (let j = 0; j < soundIdx.length; j++) {
      const i = soundIdx[j];
      const ph = ((t + soundOffsets[j]) % period) / period;
      ctx.globalAlpha = (1 - ph) * 0.5;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(px[i], py[i], 2 + ph * 24, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawAnnotations() {
    const keys = CHAPTER_LANDMARKS[currentChapter] || [];
    if (!keys.length) return;
    ctx.font = '500 11px "Inter", -apple-system, sans-serif';
    ctx.textBaseline = "middle";
    for (const key of keys) {
      const lm = LANDMARKS[key];
      const [ax, ay] = projection([lm.lon, lm.lat]);
      ctx.textAlign = lm.anchor === "left" ? "right" : lm.anchor === "right" ? "left" : "center";
      const dx = lm.anchor === "left" ? -7 : lm.anchor === "right" ? 7 : 0;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "rgba(244,241,234,0.92)";
      ctx.strokeText(lm.name, ax + dx, ay);
      ctx.fillStyle = rgba([58, 58, 58], 1);
      ctx.fillText(lm.name, ax + dx, ay);
      if (lm.anchor !== "center") {
        ctx.fillStyle = rgba(C.ink, 1);
        ctx.beginPath(); ctx.arc(ax, ay, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // --- DOM overlays ---

  const tickerEl = document.getElementById("ticker");
  const legendEl = document.getElementById("legend");
  const MONTH = "Oct.";

  function updateTicker() {
    if (currentChapter !== 1) { tickerEl.classList.remove("on"); return; }
    tickerEl.classList.add("on");
    const cutoff = Math.max(0.6, chapterProgress * CENSUS_DAYS.length);
    const di = Math.min(CENSUS_DAYS.length - 1, Math.floor(cutoff));
    const count = cumByDay[di];
    tickerEl.textContent = `${MONTH} ${CENSUS_DAYS[di]}, 2018 · ${count.toLocaleString()} squirrels`;
  }

  function updateLegend() {
    const items = LEGENDS[currentChapter];
    if (!items) { legendEl.classList.remove("on"); return; }
    legendEl.innerHTML = items.map(([label, c]) =>
      `<span class="legend-chip"><span class="legend-dot" style="background:rgb(${c[0]},${c[1]},${c[2]})"></span>${label}</span>`
    ).join("");
    legendEl.classList.add("on");
  }

  function runCounters(stepEl) {
    stepEl.querySelectorAll(".stat[data-count]").forEach(el => {
      if (el.dataset.done) return;
      el.dataset.done = "1";
      const target = +el.dataset.count;
      const t0 = performance.now(), dur = 1300;
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * ease).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  // --- audio ---

  const sounds = {};
  document.querySelectorAll(".sound-chip").forEach(btn => {
    const name = btn.dataset.sound;
    btn.addEventListener("click", () => {
      for (const [k, a] of Object.entries(sounds)) {
        if (k !== name) { a.pause(); a.currentTime = 0; }
      }
      document.querySelectorAll(".sound-chip").forEach(b => b.classList.remove("playing"));
      if (!sounds[name]) {
        sounds[name] = new Audio(name + ".mp3");
        sounds[name].addEventListener("ended", () => btn.classList.remove("playing"));
      }
      const a = sounds[name];
      if (a.paused) { btn.classList.add("playing"); a.currentTime = 0; a.play(); }
      else { a.pause(); a.currentTime = 0; }
    });
  });

  // --- init ---

  async function init() {
    const [sResp, pResp] = await Promise.all([fetch("squirrels.json"), fetch("park.json")]);
    if (!sResp.ok || !pResp.ok) throw new Error("data fetch failed");
    const rows = await sResp.json();
    park = await pResp.json();

    N = rows.length;
    px = new Float32Array(N); py = new Float32Array(N);
    curR = new Float32Array(N); curG = new Float32Array(N); curB = new Float32Array(N);
    curA = new Float32Array(N); curRad = new Float32Array(N);
    mask = new Int32Array(N); shiftArr = new Uint8Array(N); furArr = new Int8Array(N);
    dayIdx = new Int8Array(N);
    phase1 = new Float32Array(N); phase2 = new Float32Array(N); speed = new Float32Array(N);

    const raw = new Float64Array(N * 2);
    window.__squirrelLL = raw;
    const dayToIdx = {};
    CENSUS_DAYS.forEach((d, i) => dayToIdx[d] = i);
    const dayCounts = new Array(CENSUS_DAYS.length).fill(0);

    for (let i = 0; i < N; i++) {
      const [x, y, s, d, f, m] = rows[i];
      raw[i * 2] = x; raw[i * 2 + 1] = y;
      shiftArr[i] = s;
      furArr[i] = f === "G" ? 0 : f === "C" ? 1 : f === "B" ? 2 : -1;
      mask[i] = m;
      dayIdx[i] = dayToIdx[d] ?? 0;
      dayCounts[dayIdx[i]]++;
      phase1[i] = (i * 2654435761 % 1000) / 1000 * Math.PI * 2;
      phase2[i] = (i * 1597334677 % 1000) / 1000 * Math.PI * 2;
      speed[i] = 0.7 + (i * 40503 % 600) / 1000;
      curRad[i] = 1.3;
      if (m & ANYCALL) {
        soundIdx.push(i);
        soundOffsets.push((i * 7919) % 2600);
      }
    }
    let acc = 0;
    cumByDay = dayCounts.map(c => acc += c);

    // centroids for water/lawn landmark labels
    for (const lm of Object.values(LANDMARKS)) {
      const feat = lm.water ? park.waters.find(w => w.name === lm.water)
                 : lm.lawn ? park.lawns.find(l => l.name === lm.lawn) : null;
      if (feat) {
        let sx = 0, sy = 0;
        for (const c of feat.ring) { sx += c[0]; sy += c[1]; }
        lm.lon = sx / feat.ring.length;
        lm.lat = sy / feat.ring.length;
      }
    }

    document.getElementById("loading").classList.add("hidden");
    resize();

    const scroller = scrollama();
    scroller
      .setup({ step: ".step", offset: 0.55, progress: true })
      .onStepEnter(({ element }) => {
        currentChapter = +element.dataset.step;
        updateLegend();
        runCounters(element);
      })
      .onStepProgress(({ element, progress }) => {
        if (+element.dataset.step === currentChapter) chapterProgress = progress;
      })
      .onStepExit(({ element, direction }) => {
        if (+element.dataset.step === 1 && direction === "up") {
          currentChapter = 0;
          updateLegend();
        }
      });

    let resizeT;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { resize(); scroller.resize(); }, 120);
    });

    requestAnimationFrame(render);
  }

  init().catch(err => {
    console.error(err);
    const el = document.getElementById("loading");
    if (el) el.textContent = "Couldn't load data.";
  });
})();
