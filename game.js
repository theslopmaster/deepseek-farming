/* Tiny Farm — a small incremental farming game.
   Vanilla JS, no build step. Progress saves to localStorage. */

(() => {
  'use strict';

  // ---------------------------------------------------------------- data

  const CROPS = [
    { id: 'wheat',      name: 'Wheat',      cost: 10,  grow: 6,  value: 58,  xp: 1,  unlock: 1 },
    { id: 'carrot',     name: 'Carrot',     cost: 20,  grow: 10, value: 116, xp: 3,  unlock: 2 },
    { id: 'corn',       name: 'Corn',       cost: 35,  grow: 15, value: 203, xp: 7,  unlock: 4 },
    { id: 'strawberry', name: 'Strawberry', cost: 60,  grow: 22, value: 342, xp: 15, unlock: 6 },
    { id: 'pumpkin',    name: 'Pumpkin',    cost: 90,  grow: 30, value: 522, xp: 30, unlock: 8 },
    { id: 'sunflower',  name: 'Sunflower',  cost: 140, grow: 40, value: 780, xp: 60, unlock: 10 },
  ];

  const CROP_BY_ID = Object.fromEntries(CROPS.map((c) => [c.id, c]));

  const UPGRADES = [
    { id: 'fert',   name: 'Fertilizer',     desc: 'Crops grow 6% faster per level',   base: 900,   growth: 2.2,  max: 8 },
    { id: 'tools',  name: 'Better tools',   desc: '+20% crop value per level',        base: 1500,  growth: 2.2,  max: 6 },
    { id: 'market', name: 'Market stall',   desc: '+15% sell price per level',        base: 2100,  growth: 2.25, max: 6 },
    { id: 'auto',   name: 'Auto-harvester', desc: 'Harvests and replants ripe crops', base: 60000, growth: 1,    max: 1 },
  ];

  // A 5x5 field. The corners and center are free; the rest unlock in order.
  const COLS = 5;
  const FREE_PLOTS = new Set([0, 4, 12, 20, 24]);
  const PLOT_COSTS = [
    0, 450, 750, 1200, 0,
    1950, 3000, 4500, 6600, 9600,
    13500, 18600, 0, 25500, 34500,
    45000, 58500, 75000, 96000, 120000,
    0, 150000, 186000, 228000, 0,
  ];

  // Adjacency effects on a crop's harvest yield. Same-crop penalties are
  // multiplicative and stack; relationship bonuses are counted once per type.
  const ADJ = {
    sameFactor: 0.5,
    neighbor: 0.06,
    like: 0.20,
    dislike: -0.20,
    diverse: 0.08,
    min: 0.05,
    max: 1.75,
  };

  // Carrot -> Wheat -> Sunflower -> Pumpkin -> Strawberry -> Corn -> Carrot.
  // Each crop likes the next one in the ring and dislikes the previous one.
  const CROP_RELATIONS = {
    wheat:      { likes: 'sunflower',  dislikes: 'carrot' },
    carrot:     { likes: 'wheat',      dislikes: 'corn' },
    corn:       { likes: 'carrot',     dislikes: 'strawberry' },
    strawberry: { likes: 'corn',       dislikes: 'pumpkin' },
    pumpkin:    { likes: 'strawberry', dislikes: 'sunflower' },
    sunflower:  { likes: 'pumpkin',    dislikes: 'wheat' },
  };

  const SAVE_KEY = 'tiny-farm-save-v3';
  const TICK_MS = 100;
  const AUTO_SAVE_MS = 5000;

  // -------------------------------------------------------------- assets

  const ASSET_ROOT = 'assets';
  const cropSrc = (id, stage) => `${ASSET_ROOT}/crops/${id}-${stage}.png`;
  const iconSrc = (name) => `${ASSET_ROOT}/icons/${name}.png`;

  const COIN_IMG = `<img class="coin-ico" src="${iconSrc('coin')}" alt="" draggable="false">`;
  const LOCK_IMG = `<img class="lock-ico" src="${iconSrc('lock')}" alt="" draggable="false">`;

  // --------------------------------------------------------------- utils

  const $ = (id) => document.getElementById(id);

  function num(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  function fmt(n) {
    const v = Math.floor(n);
    if (v < 1000) return String(v);
    if (v < 1e6) return trim((v / 1e3).toFixed(v < 1e4 ? 2 : 1)) + 'k';
    if (v < 1e9) return trim((v / 1e6).toFixed(2)) + 'M';
    if (v < 1e12) return trim((v / 1e9).toFixed(2)) + 'B';
    return trim((v / 1e12).toFixed(2)) + 'T';
  }

  function trim(s) {
    return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }

  function fmtTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }

  function setClass(el, name) {
    if (el.className !== name) el.className = name;
  }

  function setContent(el, html) {
    if (el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
  }

  function setArt(img, src, className) {
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    if (img.className !== className) img.className = className;
  }

  function coinMarkup(value) {
    return `${COIN_IMG}<span>${fmt(value)}</span>`;
  }

  function xpNeeded(level) {
    return Math.floor(16 * Math.pow(level, 1.4));
  }

  // --------------------------------------------------------------- state

  function freshState() {
    return {
      v: 1,
      isNew: true,
      coins: 60,
      level: 1,
      xp: 0,
      totalHarvests: 0,
      selected: 'wheat',
      plots: PLOT_COSTS.map((_, i) => ({ unlocked: FREE_PLOTS.has(i), crop: null })),
      up: { fert: 0, tools: 0, market: 0, auto: 0 },
      autoOn: true,
      mute: false,
      completed: false,
    };
  }

  function loadState() {
    const fresh = freshState();
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (err) {
      return fresh;
    }
    if (!raw) return fresh;

    try {
      const s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return fresh;

      fresh.isNew = false;
      fresh.coins = Math.max(0, num(s.coins, fresh.coins));
      fresh.level = Math.max(1, Math.floor(num(s.level, 1)));
      fresh.xp = Math.max(0, num(s.xp, 0));
      fresh.totalHarvests = Math.max(0, Math.floor(num(s.totalHarvests, 0)));
      fresh.autoOn = s.autoOn !== false;
      fresh.mute = Boolean(s.mute);
      fresh.completed = Boolean(s.completed);

      if (Array.isArray(s.plots)) {
        const savedFert = s.up && typeof s.up === 'object'
          ? Math.max(0, Math.min(8, Math.floor(num(s.up.fert, 0))))
          : 0;

        s.plots.forEach((saved, i) => {
          const plot = fresh.plots[i];
          if (!plot) return;
          plot.unlocked = Boolean(saved && saved.unlocked);
          const crop = saved && saved.crop;
          if (crop && CROP_BY_ID[crop.id] && typeof crop.t === 'number') {
            const base = CROP_BY_ID[crop.id];
            const defaultGrowMs = base.grow * (1 - 0.06 * savedFert) * 1000;
            plot.crop = {
              id: crop.id,
              t: crop.t,
              growMs: Math.max(1, num(crop.growMs, defaultGrowMs)),
              accrued: Math.max(0, num(crop.accrued, 0)),
              lastAt: num(crop.lastAt, crop.t),
            };
          }
        });
      }

      if (s.selected && CROP_BY_ID[s.selected]) fresh.selected = s.selected;

      if (s.up && typeof s.up === 'object') {
        for (const u of UPGRADES) {
          const lvl = Math.floor(num(s.up[u.id], 0));
          fresh.up[u.id] = Math.max(0, Math.min(u.max, lvl));
        }
      }

      return fresh;
    } catch (err) {
      return fresh;
    }
  }

  const state = loadState();

  // ----------------------------------------------------------- derived

  function growTime(crop) {
    return crop.grow * (1 - 0.06 * state.up.fert);
  }

  function sellValue(crop) {
    const market = 1 + 0.15 * state.up.market;
    const levelBonus = 1 + 0.03 * (state.level - 1);
    const yieldBonus = 1 + 0.20 * state.up.tools;
    return Math.round(crop.value * market * levelBonus * yieldBonus);
  }

  function upCost(upgrade, level) {
    return Math.round(upgrade.base * Math.pow(upgrade.growth, level));
  }

  function isReady(plot, now = Date.now()) {
    if (!plot || !plot.unlocked || !plot.crop) return false;
    const crop = CROP_BY_ID[plot.crop.id];
    if (!crop) return false;
    const growMs = plot.crop.growMs || growTime(crop) * 1000;
    return now - plot.crop.t >= growMs;
  }

  function neighborsOf(index) {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    const rows = Math.ceil(PLOT_COSTS.length / COLS);
    const out = [];

    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < rows && c >= 0 && c < COLS) out.push(r * COLS + c);
      }
    }

    return out;
  }

  // Yield multiplier from all eight surrounding plots.
  function plotMultiplier(index) {
    const plot = state.plots[index];
    if (!plot || !plot.crop) return 1;
    const crop = CROP_BY_ID[plot.crop.id];
    if (!crop) return 1;

    const rel = CROP_RELATIONS[crop.id];
    let same = 0;
    let liked = false;
    let disliked = false;
    let neighborBonus = 0;
    const distinct = new Set();

    for (const ni of neighborsOf(index)) {
      const neighbor = state.plots[ni];
      if (!neighbor || !neighbor.crop) continue;
      const nid = neighbor.crop.id;

      if (nid === crop.id) {
        same += 1;
        continue;
      }

      distinct.add(nid);
      if (nid === rel.dislikes) {
        disliked = true;
      } else {
        neighborBonus += ADJ.neighbor;
        if (nid === rel.likes) liked = true;
      }
    }

    let bonus = 1 + neighborBonus;
    if (liked) bonus += ADJ.like;
    if (disliked) bonus += ADJ.dislike;
    if (distinct.size >= 3) bonus += ADJ.diverse;

    const mult = bonus * Math.pow(ADJ.sameFactor, same);
    return Math.max(ADJ.min, Math.min(ADJ.max, Math.round(mult * 100) / 100));
  }

  // Value-weighted average multiplier, so an expensive crop in a good spot
  // matters more than a cheap buffer crop.
  function fieldHarmony() {
    let weighted = 0;
    let total = 0;

    state.plots.forEach((plot, i) => {
      if (!plot.unlocked || !plot.crop) return;
      const crop = CROP_BY_ID[plot.crop.id];
      if (!crop) return;
      const base = sellValue(crop);
      weighted += base * plotMultiplier(i);
      total += base;
    });

    return total ? weighted / total : 1;
  }

  // Bank the yield produced since the last tick. The rate is the crop's
  // current sale value spread over its frozen growth time, multiplied by the
  // current adjacency multiplier. The integral is kept as a float.
  function accruePlot(index, now) {
    const plot = state.plots[index];
    if (!plot || !plot.crop) return;
    const crop = CROP_BY_ID[plot.crop.id];
    if (!crop) return;

    if (!plot.crop.growMs) plot.crop.growMs = growTime(crop) * 1000;
    if (typeof plot.crop.accrued !== 'number') plot.crop.accrued = 0;
    if (typeof plot.crop.lastAt !== 'number') plot.crop.lastAt = plot.crop.t;

    const readyAt = plot.crop.t + plot.crop.growMs;
    const until = Math.min(now, readyAt);
    if (until <= plot.crop.lastAt) return;

    const growSeconds = plot.crop.growMs / 1000;
    const rate = sellValue(crop) / growSeconds;
    const seconds = (until - plot.crop.lastAt) / 1000;

    plot.crop.accrued += rate * plotMultiplier(index) * seconds;
    plot.crop.lastAt = until;
  }

  function accrueAll(now = Date.now()) {
    state.plots.forEach((_, i) => accruePlot(i, now));
  }

  // --------------------------------------------------------------- dom

  const plotsEl = $('plots');
  const seedsEl = $('seeds');
  const upgradesEl = $('upgrades');
  const coinsEl = $('coins');
  const levelEl = $('level');
  const xpTextEl = $('xpText');
  const xpFillEl = $('xpFill');
  const harvestAllBtn = $('harvestAll');
  const autoToggle = $('autoToggle');
  const autoStateEl = autoToggle.querySelector('.auto-state');
  const muteBtn = $('mute');
  const muteIcon = $('muteIcon');
  const resetBtn = $('reset');
  const harmonyEl = $('harmony');
  const relationsEl = $('relations');
  const toastEl = $('toast');

  const plotEls = [];
  const seedEls = new Map();
  const upEls = new Map();

  function buildField() {
    plotsEl.innerHTML = '';
    plotEls.length = 0;

    state.plots.forEach((_, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'plot';
      btn.dataset.i = String(i);

      const art = document.createElement('img');
      art.className = 'art';
      art.alt = '';
      art.draggable = false;

      const label = document.createElement('span');
      label.className = 'label';

      const bar = document.createElement('span');
      bar.className = 'bar';
      const fill = document.createElement('i');

      const synergy = document.createElement('span');
      synergy.className = 'synergy';
      synergy.hidden = true;

      const value = document.createElement('span');
      value.className = 'plot-value';
      value.hidden = true;

      const icon = document.createElement('img');
      icon.className = 'plot-icon';
      icon.alt = '';
      icon.draggable = false;
      icon.hidden = true;

      bar.appendChild(fill);
      btn.append(art, label, bar, synergy, value, icon);
      plotsEl.appendChild(btn);

      plotEls[i] = { el: btn, art, label, bar: fill, synergy, value, icon };
    });
  }

  function buildSeeds() {
    seedsEl.innerHTML = '';
    seedEls.clear();

    CROPS.forEach((crop, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seed';
      btn.dataset.id = crop.id;
      const rel = CROP_RELATIONS[crop.id];
      btn.title = `Select ${crop.name} (key ${index + 1}) · likes ${CROP_BY_ID[rel.likes].name}, dislikes ${CROP_BY_ID[rel.dislikes].name}`;

      btn.innerHTML = `
        <img class="s-art" src="${cropSrc(crop.id, 3)}" alt="" draggable="false">
        <span class="s-info"><b>${crop.name}</b><small></small></span>
        <span class="s-cost"></span>`;

      btn.addEventListener('click', () => selectSeed(crop.id));
      seedsEl.appendChild(btn);

      seedEls.set(crop.id, {
        el: btn,
        sub: btn.querySelector('.s-info small'),
        cost: btn.querySelector('.s-cost'),
      });
    });
  }

  function buildUpgrades() {
    upgradesEl.innerHTML = '';
    upEls.clear();

    for (const up of UPGRADES) {
      const row = document.createElement('div');
      row.className = 'upgrade';
      row.innerHTML = `
        <img class="u-icon" src="${iconSrc(up.id)}" alt="" draggable="false">
        <div class="u-info">
          <div class="u-name">${up.name} <span class="u-lvl"></span></div>
          <small>${up.desc}</small>
        </div>
        <button class="buy" type="button"></button>`;

      const btn = row.querySelector('.buy');
      btn.addEventListener('click', () => buyUpgrade(up.id));
      upgradesEl.appendChild(row);

      upEls.set(up.id, {
        row,
        lvl: row.querySelector('.u-lvl'),
        btn,
      });
    }
  }

  function buildGuide() {
    relationsEl.innerHTML = '';

    for (const crop of CROPS) {
      const rel = CROP_RELATIONS[crop.id];
      const liked = CROP_BY_ID[rel.likes];
      const disliked = CROP_BY_ID[rel.dislikes];

      const row = document.createElement('div');
      row.className = 'relation';
      row.innerHTML = `
        <img class="rel-crop" src="${cropSrc(crop.id, 3)}" alt="" draggable="false">
        <span class="rel-name">${crop.name}</span>
        <span class="rel-pair good"><span class="rel-tag">likes</span><img src="${cropSrc(liked.id, 3)}" alt="" draggable="false"><span>${liked.name}</span></span>
        <span class="rel-pair bad"><span class="rel-tag">dislikes</span><img src="${cropSrc(disliked.id, 3)}" alt="" draggable="false"><span>${disliked.name}</span></span>`;

      relationsEl.appendChild(row);
    }
  }

  // ------------------------------------------------------------- audio

  let audioCtx = null;

  function tone(freq, duration, type = 'sine', volume = 0.05, delay = 0) {
    if (state.mute) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = audioCtx || new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const start = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    } catch (err) {
      /* audio is a nice-to-have; never break the game for it */
    }
  }

  const sfx = {
    plant() { tone(320, 0.09, 'triangle', 0.05); tone(210, 0.13, 'sine', 0.04, 0.035); },
    harvest() { tone(660, 0.1, 'triangle', 0.05); tone(990, 0.16, 'triangle', 0.045, 0.06); },
    buy() { tone(440, 0.08, 'square', 0.025); tone(660, 0.12, 'square', 0.025, 0.07); },
    unlock() { tone(523, 0.1, 'sine', 0.05); tone(784, 0.16, 'sine', 0.05, 0.08); },
    level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.045, i * 0.085)); },
    error() { tone(150, 0.16, 'sawtooth', 0.025); },
  };

  // ----------------------------------------------------------- feedback

  let toastTimer = 0;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  let coinTimer = 0;

  function bumpCoins() {
    coinsEl.classList.remove('bump');
    void coinsEl.offsetWidth; // restart the animation
    coinsEl.classList.add('bump');
    clearTimeout(coinTimer);
    coinTimer = setTimeout(() => coinsEl.classList.remove('bump'), 340);
  }

  function floater(plotIndex, text) {
    const host = plotEls[plotIndex] && plotEls[plotIndex].el;
    if (!host) return;
    const span = document.createElement('span');
    span.className = 'floater';
    span.textContent = text;
    host.appendChild(span);
    setTimeout(() => span.remove(), 950);
  }

  // ------------------------------------------------------------ actions

  function selectSeed(id) {
    const crop = CROP_BY_ID[id];
    if (!crop) return;

    if (state.level < crop.unlock) {
      sfx.error();
      toast(`${crop.name} unlocks at level ${crop.unlock}`);
      return;
    }

    state.selected = id;
    updateSeeds();
    updatePlots(Date.now());
    save();
  }

  function unlockPlot(index) {
    const cost = PLOT_COSTS[index];
    if (state.coins < cost) {
      sfx.error();
      toast(`This plot costs ${fmt(cost)} coins — keep harvesting!`);
      return;
    }
    state.coins -= cost;
    state.plots[index].unlocked = true;
    sfx.unlock();
    toast('New plot unlocked');
    updateAll();
    save();
    checkCompletion();
  }

  function plantCrop(index, cropId) {
    const crop = CROP_BY_ID[cropId];
    if (!crop) return false;
    if (state.level < crop.unlock) return false;
    if (state.coins < crop.cost) return false;

    const now = Date.now();
    state.coins -= crop.cost;
    state.plots[index].crop = {
      id: cropId,
      t: now,
      growMs: growTime(crop) * 1000,
      accrued: 0,
      lastAt: now,
    };
    return true;
  }

  function plant(index) {
    const crop = CROP_BY_ID[state.selected];
    if (!crop) return;

    if (state.level < crop.unlock) {
      sfx.error();
      toast(`${crop.name} unlocks at level ${crop.unlock}`);
      return;
    }

    if (state.coins < crop.cost) {
      sfx.error();
      toast(`Not enough coins for ${crop.name} seeds`);
      return;
    }

    accrueAll();
    plantCrop(index, crop.id);
    sfx.plant();
    updateAll();
    save();
  }

  function harvestAt(index, silent = false) {
    accrueAll();
    const plot = state.plots[index];
    if (!isReady(plot)) return 0;

    const crop = CROP_BY_ID[plot.crop.id];
    const gain = Math.max(0, Math.round(plot.crop.accrued || 0));

    state.coins += gain;
    state.totalHarvests += 1;
    plot.crop = null;
    plot.harvestedAt = Date.now();

    addXp(crop.xp);
    floater(index, `+${fmt(gain)}`);
    bumpCoins();
    if (!silent) sfx.harvest();

    return gain;
  }

  function harvestAll(silent = false) {
    const now = Date.now();
    const ready = [];

    state.plots.forEach((plot, i) => {
      if (isReady(plot, now)) ready.push(i);
    });

    if (!ready.length) return 0;

    let total = 0;
    ready.forEach((i) => { total += harvestAt(i, true); });
    const count = ready.length;

    if (!silent) {
      sfx.harvest();
      toast(`Harvested ${count} ${count === 1 ? 'crop' : 'crops'} · +${fmt(total)} coins`);
    }
    updateAll();
    save();
    return total;
  }

  function addXp(amount) {
    state.xp += amount;

    while (state.xp >= xpNeeded(state.level)) {
      state.xp -= xpNeeded(state.level);
      state.level += 1;
      announceLevel();
    }

    checkCompletion();
  }

  function checkCompletion() {
    if (state.completed || state.level < 10) return;
    if (!state.plots.every((plot) => plot.unlocked)) return;

    state.completed = true;
    save();
    // Defer so a harvest or unlock summary cannot overwrite the milestone.
    setTimeout(() => toast('Farm complete — all 25 plots and every crop are yours'), 0);
  }

  function announceLevel() {
    sfx.level();
    const unlocked = CROPS.find((c) => c.unlock === state.level);
    if (unlocked) {
      toast(`Level ${state.level}! ${unlocked.name} unlocked`);
    } else {
      toast(`Level ${state.level}! Sell prices +3%`);
    }
  }

  function buyUpgrade(id) {
    const up = UPGRADES.find((u) => u.id === id);
    if (!up) return;

    const level = state.up[id];
    if (level >= up.max) return;

    const cost = upCost(up, level);
    if (state.coins < cost) {
      sfx.error();
      toast(`Need ${fmt(cost - state.coins)} more coins`);
      return;
    }

    accrueAll();
    state.coins -= cost;
    state.up[id] = level + 1;
    sfx.buy();

    if (id === 'auto') {
      state.autoOn = true;
      toast('Auto-harvester online — toggle it with AUTO in the field');
    }

    updateAll();
    save();
  }

  function toggleAuto() {
    if (state.up.auto <= 0) return;
    state.autoOn = !state.autoOn;
    updateAutoToggle();
    if (state.autoOn) sfx.buy();
    else sfx.plant();
    save();
    toast(state.autoOn
      ? 'Auto-harvester resumed'
      : 'Auto-harvester paused — harvest and replant by hand');
  }

  // ------------------------------------------------------------- render

  function updateHud() {
    coinsEl.textContent = fmt(state.coins);
    levelEl.textContent = String(state.level);

    const need = xpNeeded(state.level);
    xpTextEl.textContent = `${fmt(state.xp)}/${fmt(need)}`;
    xpFillEl.style.width = `${Math.min(100, (state.xp / need) * 100)}%`;

    const harmony = fieldHarmony();
    harmonyEl.textContent = `HARMONY ×${harmony.toFixed(2)}`;
    harmonyEl.classList.toggle('good', harmony > 1.02);
    harmonyEl.classList.toggle('bad', harmony < 0.98);

    const readyCount = state.plots.filter((p) => isReady(p)).length;
    harvestAllBtn.disabled = readyCount === 0;
    harvestAllBtn.textContent = readyCount > 0 ? `Harvest all · ${readyCount}` : 'Harvest all';
  }

  function updateSeeds() {
    for (const crop of CROPS) {
      const ui = seedEls.get(crop.id);
      if (!ui) continue;

      const unlocked = state.level >= crop.unlock;
      ui.el.classList.toggle('locked', !unlocked);
      ui.el.classList.toggle('selected', state.selected === crop.id);
      ui.el.classList.toggle('poor', unlocked && state.coins < crop.cost);

      if (unlocked) {
        ui.sub.textContent = `${fmtTime(Math.round(growTime(crop)))} · ${fmt(sellValue(crop))} coins`;
        setContent(ui.cost, coinMarkup(crop.cost));
      } else {
        ui.sub.textContent = `unlocks at level ${crop.unlock}`;
        setContent(ui.cost, `${LOCK_IMG}<span>LV ${crop.unlock}</span>`);
      }
    }
  }

  function updateUpgrades() {
    for (const up of UPGRADES) {
      const ui = upEls.get(up.id);
      if (!ui) continue;

      const level = state.up[up.id];
      const maxed = level >= up.max;

      ui.lvl.textContent = maxed ? 'MAX' : `LV ${level}/${up.max}`;

      if (maxed) {
        setContent(ui.btn, 'MAX');
        ui.btn.disabled = true;
        ui.btn.classList.remove('can');
      } else {
        const cost = upCost(up, level);
        const affordable = state.coins >= cost;
        setContent(ui.btn, coinMarkup(cost));
        ui.btn.disabled = !affordable;
        ui.btn.classList.toggle('can', affordable);
      }
    }
  }

  function updateAutoToggle() {
    const owned = state.up.auto > 0;
    autoToggle.hidden = !owned;
    autoToggle.classList.toggle('on', owned && state.autoOn);
    autoToggle.setAttribute('aria-pressed', String(owned && state.autoOn));
    autoToggle.title = owned
      ? `Auto-harvester: ${state.autoOn ? 'on' : 'off'}`
      : 'Auto-harvester';
    autoStateEl.textContent = state.autoOn ? 'ON' : 'OFF';
  }

  function updatePlots(now) {
    state.plots.forEach((plot, i) => {
      const ui = plotEls[i];
      if (!ui) return;

      if (!plot.unlocked) {
        setClass(ui.el, 'plot locked');
        setArt(ui.art, iconSrc('lock'), 'art lock-art');
        setContent(ui.label, coinMarkup(PLOT_COSTS[i]));
        ui.bar.style.width = '0%';
        ui.synergy.hidden = true;
        ui.value.hidden = true;
        ui.icon.hidden = true;
        ui.el.title = `Unlock this plot for ${fmt(PLOT_COSTS[i])} coins`;
        return;
      }

      if (!plot.crop) {
        const selected = CROP_BY_ID[state.selected] || CROPS[0];
        setClass(ui.el, 'plot empty');
        setArt(ui.art, cropSrc(selected.id, 3), 'art ghost');
        setContent(ui.label, 'Plant');
        ui.bar.style.width = '0%';
        ui.synergy.hidden = true;
        ui.value.hidden = true;
        ui.icon.hidden = true;
        ui.el.title = `Plant ${selected.name} · ${fmt(selected.cost)} coins`;
        return;
      }

      const crop = CROP_BY_ID[plot.crop.id] || CROPS[0];
      const total = plot.crop.growMs || growTime(crop) * 1000;
      const elapsed = Math.max(0, now - plot.crop.t);
      const progress = Math.min(1, elapsed / total);
      const accrued = Math.max(0, plot.crop.accrued || 0);
      const banked = Math.round(accrued);
      const iconSrcForCrop = cropSrc(crop.id, 3);

      ui.value.hidden = false;
      ui.value.textContent = `+${banked.toLocaleString('en-US')}`;
      ui.icon.hidden = false;
      if (ui.icon.getAttribute('src') !== iconSrcForCrop) ui.icon.src = iconSrcForCrop;

      if (progress >= 1) {
        setClass(ui.el, 'plot ready');
        setArt(ui.art, cropSrc(crop.id, 3), 'art ripe');
        setContent(ui.label, 'Harvest');
        ui.bar.style.width = '100%';
        ui.synergy.hidden = true;
        ui.el.title = `Harvest ${crop.name} · +${fmt(banked)} coins banked`;
        return;
      }

      const mult = plotMultiplier(i);
      ui.synergy.hidden = false;
      ui.synergy.textContent = `×${mult.toFixed(2)}`;
      ui.synergy.classList.toggle('good', mult > 1.02);
      ui.synergy.classList.toggle('bad', mult < 0.98);

      setClass(ui.el, 'plot growing');
      const stage = progress < 0.3 ? 0 : progress < 0.62 ? 1 : 2;
      setArt(ui.art, cropSrc(crop.id, stage), `art stage-${stage}`);

      const secondsLeft = Math.max(1, Math.ceil((total - elapsed) / 1000));
      setContent(ui.label, `${secondsLeft}s`);
      ui.bar.style.width = `${(progress * 100).toFixed(1)}%`;
      ui.el.title = `${crop.name} · ${secondsLeft}s left · +${fmt(banked)} banked · ×${mult.toFixed(2)}`;
    });
  }

  function updateAll() {
    const now = Date.now();
    updateHud();
    updateSeeds();
    updateUpgrades();
    updateAutoToggle();
    updatePlots(now);
  }

  // --------------------------------------------------------------- loop

  function tick() {
    const now = Date.now();
    accrueAll(now);

    // Recovery hatch: never trap the player with no crops and no seed money.
    if (state.coins < CROPS[0].cost && !state.plots.some((p) => p.crop)) {
      state.coins = CROPS[0].cost;
      toast(`Scraped together ${CROPS[0].cost} coins — plant some wheat`);
      save();
    }

    if (state.up.auto > 0 && state.autoOn) {
      // The auto-harvester works silently: harvest ripe plots, then re-sow
      // the same crop if you can afford the seed. Multipliers are snapshotted
      // before any plot is cleared, so the harvest order is irrelevant.
      const ready = [];
      state.plots.forEach((plot, i) => {
        if (isReady(plot, now)) ready.push(i);
      });

      if (ready.length) {
        ready.forEach((i) => {
          const cropId = state.plots[i].crop.id;
          harvestAt(i, true);
          plantCrop(i, cropId);
        });
      }
    }

    updateHud();
    updateSeeds();
    updateUpgrades();
    updatePlots(now);
  }

  // --------------------------------------------------------------- save

  function save() {
    accrueAll();
    try {
      state.isNew = false;
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (err) {
      /* private mode / storage full — keep playing without saving */
    }
  }

  // --------------------------------------------------------------- init

  function updateMuteIcon() {
    muteIcon.src = iconSrc(state.mute ? 'sound-off' : 'sound-on');
    muteBtn.title = state.mute ? 'Sound off' : 'Sound on';
    muteBtn.setAttribute('aria-label', state.mute ? 'Sound off' : 'Sound on');
  }

  function onPlotClick(event) {
    const el = event.target.closest('.plot');
    if (!el) return;

    const index = Number(el.dataset.i);
    if (!Number.isInteger(index)) return;

    const plot = state.plots[index];
    if (!plot) return;

    if (!plot.unlocked) {
      unlockPlot(index);
      return;
    }

    if (plot.crop) {
      if (isReady(plot)) {
        const gained = harvestAt(index);
        if (gained) updateAll();
      }
      return;
    }

    // A quick second click (double-click) shouldn't instantly buy a new seed.
    if (plot.harvestedAt && Date.now() - plot.harvestedAt < 250) return;

    plant(index);
  }

  function init() {
    buildField();
    buildSeeds();
    buildUpgrades();
    buildGuide();

    updateMuteIcon();

    plotsEl.addEventListener('click', onPlotClick);
    harvestAllBtn.addEventListener('click', () => harvestAll(false));
    autoToggle.addEventListener('click', toggleAuto);

    muteBtn.addEventListener('click', () => {
      state.mute = !state.mute;
      updateMuteIcon();
      if (!state.mute) sfx.buy();
      save();
    });

    resetBtn.addEventListener('click', () => {
      if (!window.confirm('Reset your farm? All progress will be lost.')) return;
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch (err) { /* ignore */ }

      Object.assign(state, freshState());
      updateMuteIcon();
      updateAll();
      save();
      toast('Fresh soil, fresh start');
    });

    window.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const index = Number.parseInt(event.key, 10);
      if (index >= 1 && index <= CROPS.length) {
        selectSeed(CROPS[index - 1].id);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) save();
    });
    window.addEventListener('pagehide', save);

    accrueAll();
    updateAll();
    checkCompletion();

    setInterval(tick, TICK_MS);
    setInterval(save, AUTO_SAVE_MS);

    if (state.isNew) {
      setTimeout(() => toast('Welcome! Plant the five free plots. Same crops next to each other halve yield — see the Field guide.'), 450);
    }
  }

  init();
})();
