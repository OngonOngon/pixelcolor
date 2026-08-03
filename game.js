(() => {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "kostkova-linka-state-v1";
  const SETTINGS_KEY = "kostkova-linka-settings-v1";
  const BEST_KEY = "kostkova-linka-best-v1";
  const BUFFER_LIMIT = 7;
  const CRATE_CAPACITY = 4;
  const ACTIVE_CRATES = 3;

  const COLORS = [
    { id: "coral", name: "Korálová", hex: "#ff6f73" },
    { id: "blue", name: "Modrá", hex: "#4e8cff" },
    { id: "mint", name: "Mátová", hex: "#42cda4" },
    { id: "gold", name: "Žlutá", hex: "#f4bd3e" },
    { id: "violet", name: "Fialová", hex: "#936df4" },
    { id: "pink", name: "Růžová", hex: "#ec71bc" }
  ];

  const els = {
    board: document.querySelector("#board"),
    crates: document.querySelector("#crates"),
    conveyor: document.querySelector("#conveyor"),
    level: document.querySelector("#levelLabel"),
    moves: document.querySelector("#movesLabel"),
    best: document.querySelector("#bestLabel"),
    remaining: document.querySelector("#remainingLabel"),
    queue: document.querySelector("#queueLabel"),
    buffer: document.querySelector("#bufferLabel"),
    undo: document.querySelector("#undoButton"),
    hint: document.querySelector("#hintButton"),
    restart: document.querySelector("#restartButton"),
    help: document.querySelector("#helpButton"),
    sound: document.querySelector("#soundButton"),
    install: document.querySelector("#installButton"),
    toast: document.querySelector("#toast"),
    dialog: document.querySelector("#messageDialog"),
    modalIcon: document.querySelector("#modalIcon"),
    modalKicker: document.querySelector("#modalKicker"),
    modalTitle: document.querySelector("#modalTitle"),
    modalText: document.querySelector("#modalText"),
    modalActions: document.querySelector("#modalActions")
  };

  let state;
  let history = [];
  let busy = false;
  let deferredInstallPrompt = null;
  let audioContext = null;
  let toastTimer = null;
  let settings = loadJSON(SETTINGS_KEY, { sound: true, welcomed: false });
  let bestScores = loadJSON(BEST_KEY, {});

  function mulberry32(seed) {
    return function random() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(array, random) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function shadeColor(hex, percent) {
    const value = parseInt(hex.slice(1), 16);
    const amount = Math.round(2.55 * percent);
    const r = Math.max(0, Math.min(255, (value >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((value >> 8) & 0x00ff) + amount));
    const b = Math.max(0, Math.min(255, (value & 0x0000ff) + amount));
    return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
  }

  function colorById(id) {
    return COLORS.find((color) => color.id === id) || COLORS[0];
  }

  function colorVars(colorId, prefix = "cube") {
    const color = colorById(colorId);
    return `--${prefix}-color:${color.hex};--${prefix}-light:${shadeColor(color.hex, 18)};--${prefix}-dark:${shadeColor(color.hex, -20)};`;
  }

  function generateLevel(level) {
    const random = mulberry32(10591 + level * 7919);
    const colorCount = Math.min(6, 4 + Math.floor((level - 1) / 3));
    const availableColors = shuffle(COLORS.slice(0, colorCount), random).map((color) => color.id);
    const crateCount = Math.min(12, 4 + Math.floor((level - 1) / 2));
    const crateColors = [];

    for (let i = 0; i < crateCount; i += 1) {
      const forbidden = new Set(crateColors.slice(-2));
      const choices = availableColors.filter((id) => !forbidden.has(id));
      crateColors.push(choices[Math.floor(random() * choices.length)]);
    }

    const crates = crateColors.map((color, index) => ({
      id: index,
      color,
      filled: 0,
      complete: false
    }));

    const virtualRemaining = crates.map(() => CRATE_CAPACITY);
    const virtualActive = [];
    let virtualNext = 0;
    while (virtualActive.length < ACTIVE_CRATES && virtualNext < crates.length) {
      virtualActive.push(virtualNext++);
    }

    const solutionColors = [];
    while (virtualActive.length) {
      const weighted = [];
      virtualActive.forEach((id) => {
        const weight = 1 + (CRATE_CAPACITY - virtualRemaining[id]);
        for (let n = 0; n < weight; n += 1) weighted.push(id);
      });
      const chosenId = weighted[Math.floor(random() * weighted.length)];
      solutionColors.push(crates[chosenId].color);
      virtualRemaining[chosenId] -= 1;
      if (virtualRemaining[chosenId] === 0) {
        virtualActive.splice(virtualActive.indexOf(chosenId), 1);
        if (virtualNext < crates.length) virtualActive.push(virtualNext++);
      }
    }

    const columnCount = level >= 5 ? 20 : 16;
    const columns = Array.from({ length: columnCount }, () => []);
    const maxHeight = Math.ceil(solutionColors.length / columnCount) + 2;
    const reversed = [...solutionColors].reverse();

    reversed.forEach((color, step) => {
      let candidates = columns
        .map((column, index) => ({ index, length: column.length }))
        .filter((entry) => entry.length < maxHeight);

      const minLength = Math.min(...candidates.map((entry) => entry.length));
      const balanced = candidates.filter((entry) => entry.length <= minLength + (step < columnCount ? 0 : 1));
      candidates = balanced.length ? balanced : candidates;
      const choice = candidates[Math.floor(random() * candidates.length)].index;
      columns[choice].push(color);
    });

    return {
      version: VERSION,
      level,
      moves: 0,
      board: columns,
      crates,
      activeIds: crates.slice(0, ACTIVE_CRATES).map((crate) => crate.id),
      nextCrate: Math.min(ACTIVE_CRATES, crates.length),
      buffer: [],
      startedAt: Date.now()
    };
  }

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function loadState() {
    const saved = loadJSON(STORAGE_KEY, null);
    if (!saved || saved.version !== VERSION || !Array.isArray(saved.board)) return generateLevel(1);
    return saved;
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function render() {
    renderBoard();
    renderCrates();
    renderConveyor();
    renderStatus();
    els.undo.disabled = history.length === 0 || busy;
    els.hint.disabled = busy;
    els.restart.disabled = busy;
    els.sound.textContent = settings.sound ? "♪" : "×";
    els.sound.setAttribute("aria-label", settings.sound ? "Vypnout zvuk" : "Zapnout zvuk");
  }

  function renderBoard() {
    const cols = state.board.length === 20 ? 5 : 4;
    els.board.style.setProperty("--cols", cols);
    els.board.innerHTML = state.board.map((stack, index) => {
      if (!stack.length) {
        return `<button class="stack empty" data-stack="${index}" type="button" disabled aria-label="Prázdný sloupec"></button>`;
      }

      const visible = stack.slice(-4).reverse();
      const layers = visible.map((colorId, layer) => (
        `<span class="cube-layer" style="${colorVars(colorId)}--layer:${layer};z-index:${10 - layer}"></span>`
      )).join("");
      const topColor = colorById(stack[stack.length - 1]);
      return `
        <button class="stack" data-stack="${index}" type="button" aria-label="${topColor.name} kostka, ve sloupci ${stack.length} kostek">
          <span class="stack-visual">${layers}</span>
          <span class="stack-count">${stack.length}</span>
        </button>`;
    }).join("");
  }

  function renderCrates() {
    const activeCrates = state.activeIds.map((id) => state.crates[id]).filter(Boolean);
    const cards = activeCrates.map((crate) => {
      const color = colorById(crate.color);
      const slots = Array.from({ length: CRATE_CAPACITY }, (_, index) => (
        `<span class="crate-slot ${index < crate.filled ? "filled" : ""}" style="${colorVars(crate.color, "crate")}"></span>`
      )).join("");
      return `
        <div class="crate" data-crate="${crate.id}" style="${colorVars(crate.color, "crate")}">
          <span class="crate-name">${color.name}</span>
          <div class="crate-slots">${slots}</div>
        </div>`;
    });
    while (cards.length < ACTIVE_CRATES) cards.push(`<div class="crate-placeholder">Volno</div>`);
    els.crates.innerHTML = cards.join("");
  }

  function renderConveyor() {
    const slots = Array.from({ length: BUFFER_LIMIT }, (_, index) => {
      const colorId = state.buffer[index];
      return `<span class="conveyor-slot ${colorId ? "filled" : ""}" ${colorId ? `style="${colorVars(colorId)}" aria-label="${colorById(colorId).name} kostka"` : "aria-label=\"Prázdné místo\""}></span>`;
    });
    els.conveyor.innerHTML = slots.join("");
  }

  function renderStatus() {
    const remaining = state.board.reduce((sum, stack) => sum + stack.length, 0);
    const waiting = Math.max(0, state.crates.length - state.nextCrate);
    els.level.textContent = state.level;
    els.moves.textContent = state.moves;
    els.best.textContent = bestScores[state.level] ?? "–";
    els.remaining.textContent = `${remaining} ${pluralize(remaining, "kostka", "kostky", "kostek")}`;
    els.queue.textContent = `${waiting} ${pluralize(waiting, "čeká", "čekají", "čeká")}`;
    els.buffer.textContent = `${state.buffer.length} / ${BUFFER_LIMIT}`;
  }

  function pluralize(number, one, few, many) {
    if (number === 1) return one;
    if (number >= 2 && number <= 4) return few;
    return many;
  }

  function activeCrateFor(colorId) {
    const id = state.activeIds.find((crateId) => {
      const crate = state.crates[crateId];
      return crate && crate.color === colorId && crate.filled < CRATE_CAPACITY;
    });
    return id === undefined ? null : state.crates[id];
  }

  async function handleStackClick(event) {
    const button = event.target.closest(".stack[data-stack]");
    if (!button || button.disabled || busy) return;
    const stackIndex = Number(button.dataset.stack);
    const stack = state.board[stackIndex];
    if (!stack?.length) return;

    const colorId = stack[stack.length - 1];
    const crate = activeCrateFor(colorId);
    if (!crate && state.buffer.length >= BUFFER_LIMIT) {
      rejectMove(button);
      return;
    }

    busy = true;
    history.push(snapshot());
    if (history.length > 60) history.shift();
    stack.pop();
    state.moves += 1;
    render();

    const target = crate
      ? document.querySelector(`[data-crate="${crate.id}"]`)
      : els.conveyor.querySelectorAll(".conveyor-slot")[state.buffer.length];

    await animateCube(button, target, colorId);

    if (crate) {
      fillCrate(crate);
      playTone(540, 0.055);
    } else {
      state.buffer.push(colorId);
      playTone(320, 0.045);
    }

    await settleBoard();
    busy = false;
    saveState();
    render();
    checkEndState();
  }

  function fillCrate(crate) {
    crate.filled += 1;
    if (crate.filled < CRATE_CAPACITY) return;

    crate.complete = true;
    state.activeIds = state.activeIds.filter((id) => id !== crate.id);
    if (state.nextCrate < state.crates.length) {
      state.activeIds.push(state.nextCrate);
      state.nextCrate += 1;
    }
    playTone(760, 0.08);
    vibrate([20, 35, 35]);
  }

  async function settleBoard() {
    let moved = true;
    while (moved) {
      moved = false;
      for (let i = 0; i < state.buffer.length; i += 1) {
        const colorId = state.buffer[i];
        const crate = activeCrateFor(colorId);
        if (!crate) continue;
        state.buffer.splice(i, 1);
        fillCrate(crate);
        render();
        playTone(610, 0.04);
        await delay(105);
        moved = true;
        break;
      }
    }
  }

  function rejectMove(button) {
    button.classList.remove("shake");
    void button.offsetWidth;
    button.classList.add("shake");
    els.conveyor.classList.remove("shake");
    void els.conveyor.offsetWidth;
    els.conveyor.classList.add("shake");
    showToast("Pás je plný. Vyber barvu aktivní bedny nebo vrať tah.");
    playTone(150, 0.09);
    vibrate(45);
  }

  function checkEndState() {
    const remaining = state.board.some((stack) => stack.length > 0);
    const complete = state.crates.every((crate) => crate.complete);
    if (!remaining && complete && state.buffer.length === 0) {
      const previousBest = bestScores[state.level];
      const isBest = previousBest === undefined || state.moves < previousBest;
      if (isBest) {
        bestScores[state.level] = state.moves;
        localStorage.setItem(BEST_KEY, JSON.stringify(bestScores));
      }
      playWinSound();
      vibrate([35, 35, 55, 35, 90]);
      openDialog({
        icon: "✓",
        kicker: `ÚROVEŇ ${state.level} HOTOVÁ`,
        title: isBest ? "Nový nejlepší výsledek!" : "Výborně!",
        html: `<p>Úroveň je hotová za <strong>${state.moves} tahů</strong>${isBest ? "." : `, rekord je ${previousBest}.`}</p><p>Další úroveň přidá nové pořadí beden a postupně i další barvy.</p>`,
        actions: [
          { label: "Další úroveň", className: "primary", onClick: nextLevel },
          { label: "Hrát znovu", className: "secondary", onClick: () => startLevel(state.level) }
        ]
      });
      return;
    }

    if (state.buffer.length >= BUFFER_LIMIT && !hasLegalMove()) {
      openDialog({
        icon: "!",
        kicker: "PÁS JE ZABLOKOVANÝ",
        title: "Žádný problém",
        html: "<p>Nejsou tu životy ani čekání. Vrať poslední tah, nebo si úroveň okamžitě restartuj.</p>",
        actions: [
          { label: "Vrátit tah", className: "primary", onClick: undo },
          { label: "Restart", className: "secondary", onClick: () => startLevel(state.level) }
        ]
      });
    }
  }

  function hasLegalMove() {
    return state.board.some((stack) => stack.length && activeCrateFor(stack[stack.length - 1]));
  }

  function undo() {
    if (busy || history.length === 0) return;
    state = history.pop();
    saveState();
    render();
    closeDialog();
    showToast("Tah vrácen.");
    playTone(260, 0.04);
  }

  function startLevel(level) {
    state = generateLevel(level);
    history = [];
    busy = false;
    saveState();
    render();
    closeDialog();
  }

  function nextLevel() {
    startLevel(state.level + 1);
  }

  function showHint() {
    if (busy) return;
    document.querySelectorAll(".stack.hint").forEach((el) => el.classList.remove("hint"));
    let candidate = null;
    for (let index = 0; index < state.board.length; index += 1) {
      const stack = state.board[index];
      if (stack.length && activeCrateFor(stack[stack.length - 1])) {
        candidate = index;
        break;
      }
    }
    if (candidate === null && state.buffer.length < BUFFER_LIMIT) {
      candidate = state.board.findIndex((stack) => stack.length);
    }
    if (candidate === null) {
      showToast("Teď pomůže vrátit tah nebo restartovat úroveň.");
      return;
    }
    const button = document.querySelector(`[data-stack="${candidate}"]`);
    button?.classList.add("hint");
    button?.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast(activeCrateFor(state.board[candidate].at(-1)) ? "Tahle kostka může rovnou do bedny." : "Tuhle kostku můžeš bezpečně odložit na pás.");
  }

  function showHelp() {
    openDialog({
      icon: "◆",
      kicker: "JAK HRÁT",
      title: "Vyčisti celé pole",
      html: `<ol><li>Klepni na horní kostku některého sloupce.</li><li>Shodná barva zaplní aktivní bednu.</li><li>Ostatní barvy čekají na omezeném pásu.</li><li>Plná bedna zmizí a objeví se další.</li></ol><p>Bez reklam, životů, časovače a placených tahů. Restart i vrácení tahu jsou neomezené.</p>`,
      actions: [{ label: "Rozumím", className: "primary", onClick: closeDialog }]
    });
  }

  function confirmRestart() {
    openDialog({
      icon: "↻",
      kicker: `ÚROVEŇ ${state.level}`,
      title: "Začít znovu?",
      html: "<p>Rozložení úrovně zůstane stejné. Přijdeš jen o současný rozehraný postup.</p>",
      actions: [
        { label: "Restartovat", className: "primary", onClick: () => startLevel(state.level) },
        { label: "Pokračovat", className: "secondary", onClick: closeDialog }
      ]
    });
  }

  function openDialog({ icon, kicker, title, html, actions }) {
    els.modalIcon.textContent = icon;
    els.modalKicker.textContent = kicker;
    els.modalTitle.textContent = title;
    els.modalText.innerHTML = html;
    els.modalActions.innerHTML = "";
    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.className = action.className;
      button.addEventListener("click", action.onClick, { once: true });
      els.modalActions.appendChild(button);
    });
    if (!els.dialog.open) els.dialog.showModal();
  }

  function closeDialog() {
    if (els.dialog.open) els.dialog.close();
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2300);
  }

  async function animateCube(source, target, colorId) {
    if (!source || !target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await delay(80);
      return;
    }
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const cube = document.createElement("div");
    cube.className = "flying-cube";
    cube.style.cssText = `${colorVars(colorId)}left:${sourceRect.left + sourceRect.width / 2 - 23}px;top:${sourceRect.top + 18}px;`;
    document.body.appendChild(cube);
    const dx = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
    const dy = targetRect.top + targetRect.height / 2 - (sourceRect.top + 41);
    requestAnimationFrame(() => {
      cube.style.transform = `translate(${dx}px, ${dy}px) scale(.72) rotate(12deg)`;
      cube.style.opacity = "0.72";
    });
    await delay(275);
    cube.remove();
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function vibrate(pattern) {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  }

  function playTone(frequency, duration) {
    if (!settings.sound) return;
    try {
      audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.05, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {
      // Zvuk je jen doplněk; hra musí fungovat i bez něj.
    }
  }

  function playWinSound() {
    [520, 660, 820].forEach((frequency, index) => setTimeout(() => playTone(frequency, 0.16), index * 110));
  }

  function toggleSound() {
    settings.sound = !settings.sound;
    saveSettings();
    render();
    if (settings.sound) playTone(660, 0.07);
    showToast(settings.sound ? "Zvuk zapnut." : "Zvuk vypnut.");
  }

  async function installApp() {
    if (!deferredInstallPrompt) {
      showToast("V prohlížeči otevři nabídku a zvol Přidat na plochu.");
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.install.classList.add("hidden");
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
    }
  }

  function bindEvents() {
    els.board.addEventListener("click", handleStackClick);
    els.undo.addEventListener("click", undo);
    els.hint.addEventListener("click", showHint);
    els.restart.addEventListener("click", confirmRestart);
    els.help.addEventListener("click", showHelp);
    els.sound.addEventListener("click", toggleSound);
    els.install.addEventListener("click", installApp);

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      els.install.classList.remove("hidden");
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      els.install.classList.add("hidden");
      showToast("Aplikace je nainstalovaná.");
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveState();
    });
  }

  function init() {
    state = loadState();
    bindEvents();
    registerServiceWorker();
    render();

    if (!settings.welcomed) {
      settings.welcomed = true;
      saveSettings();
      showHelp();
    }
  }

  init();
})();
