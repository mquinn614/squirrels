(() => {
  const PARK_OUTLINE = {
    type: "Polygon",
    coordinates: [[
      [-73.9819, 40.7681],
      [-73.9582, 40.8004],
      [-73.9495, 40.7969],
      [-73.9732, 40.7644],
      [-73.9819, 40.7681]
    ]]
  };

  const RESERVOIR = { lon: -73.9622, lat: 40.7884, rx: 0.00235, ry: 0.0036 };

  const LANDMARKS = {
    ramble:     { name: "The Ramble",        lon: -73.9700, lat: 40.7770, anchor: "left"  },
    reservoir:  { name: "The Reservoir",     lon: -73.9622, lat: 40.7884, anchor: "center"},
    sheep:      { name: "Sheep Meadow",      lon: -73.9760, lat: 40.7720, anchor: "left"  },
    mall:       { name: "The Mall",          lon: -73.9716, lat: 40.7708, anchor: "right" },
    northwoods: { name: "North Woods",       lon: -73.9560, lat: 40.7975, anchor: "right" },
    hallett:    { name: "Hallett Sanctuary", lon: -73.9750, lat: 40.7665, anchor: "left"  },
  };

  const CHAPTER_LANDMARKS = {
    1: ["reservoir", "ramble"],
    2: ["sheep", "mall"],
    3: ["northwoods", "ramble"],
    4: ["ramble", "sheep"],
    5: ["mall", "hallett"],
  };

  const COLOR = {
    park:        "#ebe7dc",
    parkLine:    "#3a3a3a",
    reservoir:   "#dad6c7",
    ink:         "#1a1a1a",
    inkSoft:     "#3a3a3a",
    paper:       "#f4f1ea",
    am:          "#d4a542",
    pm:          "#5b8aa8",
    furGray:     "#9b9b9b",
    furCinnamon: "#b86b3c",
    furBlack:    "#141414",
    sound:       "#d96544",
    approach:    "#6b9968",
    indifferent: "#b8b8b8",
    runs:        "#c25450",
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.getElementById("map");
  const ctx = canvas.getContext("2d");
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let cssW = 0, cssH = 0;
  let projection = null;
  let projected = [];
  let squirrels = [];
  let soundIdx = [];
  let soundOffsets = [];

  let currentChapter = 0;
  let chapterProgress = 0;

  function resize() {
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    const aspect = 1.45;
    let w = rect.width;
    let h = rect.height;
    if (w / h > 1 / aspect) {
      w = h / aspect;
    } else {
      h = w * aspect;
    }
    cssW = w; cssH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    projection = d3.geoMercator().fitExtent(
      [[18, 18], [w - 18, h - 18]],
      PARK_OUTLINE
    );
    projected = squirrels.map(s => projection([s.x, s.y]));
  }

  function drawBase() {
    ctx.beginPath();
    const ring = PARK_OUTLINE.coordinates[0];
    ring.forEach((c, i) => {
      const p = projection(c);
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fillStyle = COLOR.park;
    ctx.fill();
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = COLOR.parkLine;
    ctx.stroke();

    ctx.beginPath();
    const segs = 36;
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      const lon = RESERVOIR.lon + RESERVOIR.rx * Math.cos(t);
      const lat = RESERVOIR.lat + RESERVOIR.ry * Math.sin(t);
      const p = projection([lon, lat]);
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.fillStyle = COLOR.reservoir;
    ctx.fill();
  }

  function drawAnnotations() {
    const keys = CHAPTER_LANDMARKS[currentChapter] || [];
    if (!keys.length) return;
    ctx.font = '500 11px "Inter", -apple-system, sans-serif';
    ctx.textBaseline = "middle";
    for (const key of keys) {
      const lm = LANDMARKS[key];
      const [px, py] = projection([lm.lon, lm.lat]);
      ctx.textAlign = lm.anchor === "left" ? "right"
                    : lm.anchor === "right" ? "left"
                    : "center";
      const dx = lm.anchor === "left" ? -7 : lm.anchor === "right" ? 7 : 0;
      const dy = lm.anchor === "center" ? -10 : 0;

      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "rgba(244, 241, 234, 0.92)";
      ctx.strokeText(lm.name, px + dx, py + dy);
      ctx.fillStyle = COLOR.inkSoft;
      ctx.fillText(lm.name, px + dx, py + dy);

      ctx.fillStyle = COLOR.ink;
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function dot(px, py, r, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function renderCh0() {
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      dot(p[0], p[1], 1.3, COLOR.ink, 0.04);
    }
  }

  function renderCh1(progress) {
    const alpha = 0.10 + progress * 0.45;
    const r = 1.5 + progress * 0.25;
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      dot(p[0], p[1], r, COLOR.ink, alpha);
    }
  }

  function renderCh2(progress, t) {
    const period = 5200;
    const swing = reduceMotion
      ? 0.5
      : (Math.sin((t % period) / period * Math.PI * 2) + 1) / 2;
    const amA = 0.18 + 0.65 * swing;
    const pmA = 0.18 + 0.65 * (1 - swing);
    for (let i = 0; i < projected.length; i++) {
      const s = squirrels[i];
      const p = projected[i];
      if (s.shift === "AM")      dot(p[0], p[1], 1.7, COLOR.am, amA);
      else if (s.shift === "PM") dot(p[0], p[1], 1.7, COLOR.pm, pmA);
      else                       dot(p[0], p[1], 1.3, COLOR.ink, 0.08);
    }
  }

  function renderCh3(progress, t) {
    const period = 2400;
    const phase = (t % period) / period;
    const pulse = reduceMotion ? 0.5 : (Math.sin(phase * Math.PI * 2) + 1) / 2;

    for (let i = 0; i < projected.length; i++) {
      const s = squirrels[i];
      const p = projected[i];
      if (s.fur === "Black") {
        dot(p[0], p[1], 2.4 + pulse * 1.2, COLOR.furBlack, 0.85);
      }
    }
    for (let i = 0; i < projected.length; i++) {
      const s = squirrels[i];
      const p = projected[i];
      if (s.fur === "Cinnamon") {
        dot(p[0], p[1], 2.0, COLOR.furCinnamon, 0.85);
      }
    }
    for (let i = 0; i < projected.length; i++) {
      const s = squirrels[i];
      const p = projected[i];
      if (s.fur === "Gray") {
        dot(p[0], p[1], 1.5, COLOR.furGray, 0.45);
      } else if (s.fur !== "Black" && s.fur !== "Cinnamon") {
        dot(p[0], p[1], 1.1, COLOR.ink, 0.08);
      }
    }
  }

  function renderCh4(progress, t) {
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      dot(p[0], p[1], 1.2, COLOR.ink, 0.08);
    }
    const period = 2600;
    ctx.globalAlpha = 1;
    for (let j = 0; j < soundIdx.length; j++) {
      const idx = soundIdx[j];
      const p = projected[idx];
      const offset = soundOffsets[j];
      const phase = ((t + offset) % period) / period;
      const ringR = 2 + phase * 22;
      const ringA = (1 - phase) * 0.55;
      ctx.globalAlpha = ringA;
      ctx.strokeStyle = COLOR.sound;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(p[0], p[1], ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let j = 0; j < soundIdx.length; j++) {
      const idx = soundIdx[j];
      const p = projected[idx];
      dot(p[0], p[1], 2.4, COLOR.sound, 0.92);
    }
  }

  function renderCh5(progress) {
    for (let i = 0; i < projected.length; i++) {
      const s = squirrels[i];
      const p = projected[i];
      const interacted = s.approaches || s.indifferent || s.runs_from;
      if (!interacted) {
        dot(p[0], p[1], 1.0, COLOR.ink, 0.05);
      }
    }
    for (let i = 0; i < projected.length; i++) {
      const s = squirrels[i];
      const p = projected[i];
      if (s.indifferent && !s.approaches && !s.runs_from) {
        dot(p[0], p[1], 1.5, COLOR.indifferent, 0.55);
      }
    }
    for (let i = 0; i < projected.length; i++) {
      const s = squirrels[i];
      const p = projected[i];
      if (s.runs_from && !s.approaches) {
        dot(p[0], p[1], 1.9, COLOR.runs, 0.75);
      }
    }
    for (let i = 0; i < projected.length; i++) {
      const s = squirrels[i];
      const p = projected[i];
      if (s.approaches) {
        dot(p[0], p[1], 2.6, COLOR.approach, 0.92);
      }
    }
  }

  function render(t) {
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, cssW, cssH);
    drawBase();
    ctx.globalAlpha = 1;

    if      (currentChapter === 0) renderCh0();
    else if (currentChapter === 1) renderCh1(chapterProgress, t);
    else if (currentChapter === 2) renderCh2(chapterProgress, t);
    else if (currentChapter === 3) renderCh3(chapterProgress, t);
    else if (currentChapter === 4) renderCh4(chapterProgress, t);
    else if (currentChapter === 5) renderCh5(chapterProgress, t);

    ctx.globalAlpha = 1;
    drawAnnotations();
    requestAnimationFrame(render);
  }

  function indexSounds() {
    soundIdx = [];
    soundOffsets = [];
    for (let i = 0; i < squirrels.length; i++) {
      const s = squirrels[i];
      if (s.kuks || s.quaas || s.moans) {
        soundIdx.push(i);
        soundOffsets.push(Math.random() * 2600);
      }
    }
  }

  async function init() {
    const resp = await fetch("squirrels.json");
    if (!resp.ok) throw new Error("Failed to load squirrels.json: " + resp.status);
    squirrels = await resp.json();
    indexSounds();

    document.getElementById("loading").classList.add("hidden");

    resize();

    const scroller = scrollama();
    scroller
      .setup({ step: ".step", offset: 0.55, progress: true })
      .onStepEnter(({ element }) => {
        currentChapter = +element.dataset.step;
      })
      .onStepProgress(({ element, progress }) => {
        if (+element.dataset.step === currentChapter) {
          chapterProgress = progress;
        }
      })
      .onStepExit(({ element, direction }) => {
        if (+element.dataset.step === 1 && direction === "up") {
          currentChapter = 0;
          chapterProgress = 0;
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
