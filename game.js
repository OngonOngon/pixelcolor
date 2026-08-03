(() => {
  "use strict";

  const Core = window.PixelBlastCore;
  const STORAGE_KEY = "pixelova-palba-state-v2";
  const SETTINGS_KEY = "pixelova-palba-settings-v2";
  const BEST_KEY = "pixelova-palba-best-v2";

  const els = {
    board: document.querySelector("#pixelBoard"),
    stacks: document.querySelector("#cannonStacks"),
    rack: document.querySelector("#cannonRack"),
    level: document.querySelector("#levelLabel"),
    blocks: document.querySelector("#blocksLabel"),
    free: document.querySelector("#freeLabel"),
    cannons: document.querySelector("#cannonsLabel"),
    moves: document.querySelector("#movesLabel"),
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
  let bestTimes = loadJSON(BEST_KEY, {});

  function loadJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    const saved = loadJSON(STORAGE_KEY, null);
    if (!saved || saved.version !== Core.VERSION || !Array.isArray(saved.board) || !Array.isArray(saved.stacks)) {
      return Core.generateLevel(1);
    }
    return saved;
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  function colorVars(colorId) {
    const color = Core.colorById(colorId);
    return `--item-color:${color.hex};--item-rgb:${hexToRgb(color.hex)};`;
  }

  function hexToRgb(hex) {
    const value = parseInt(hex.slice(1), 16);
    return `${value >> 16},${(value >> 8) & 255},${value & 255}`;
  }

  function remainingCannons() {
    return state.stacks.reduce((sum, stack) => sum + stack.length, 0) + state.rack.length;
  }

  function render() {
    renderBoard();
    renderRack();
    renderStacks();
    renderStatus();
    els.undo.disabled = busy || history.length === 0;
    els.hint.disabled = busy;
    els.restart.disabled = busy;
    els.sound.textContent = settings.sound ? "♪" : "×";
    els.sound.setAttribute("aria-label", settings.sound ? "Vypnout zvuk" : "Zapnout zvuk");
  }

  function renderBoard() {
    const rows = state.board.length;
    const cols = state.board[0].length;
    els.board.style.setProperty("--board-cols", cols);
    els.board.style.setProperty("--board-rows", rows);
    const cells = [];

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const colorId = state.board[r][c];
        if (!colorId) {
          cells.push('<span class="pixel empty" aria-hidden="true"></span>');
          continue;
        }
        const color = Core.colorById(colorId);
        const exposed = Core.isExposed(state.board, r, c);
        cells.push(`<span class="pixel ${exposed ? "exposed" : ""}" data-row="${r}" data-col="${c}" style="${colorVars(colorId)}" aria-label="${color.name} kostka${exposed ? ", na okraji" : ""}"><span>${color.symbol}</span></span>`);
      }
    }

    els.board.innerHTML = cells.join("");
  }

  function cannonMarkup(cannon, options = {}) {
    const color = Core.colorById(cannon.color);
    const remaining = cannon.ammo;
    return `
      <span class="cannon ${options.waiting ? "waiting" : ""}" style="${colorVars(cannon.color)}" aria-label="${color.name} dělo, ${remaining} nábojů">
        <span class="cannon-barrel" aria-hidden="true"></span>
        <span class="cannon-body"><span class="cannon-symbol">${color.symbol}</span></span>
        <strong>${remaining}</strong>
      </span>`;
  }

  function renderRack() {
    const slots = [];
    for (let i = 0; i < Core.RACK_LIMIT; i += 1) {
      const cannon = state.rack[i];
      slots.push(`<div class="rack-slot" data-rack-slot="${i}">${cannon ? cannonMarkup(cannon, { waiting: !Core.exposedCells(state.board, cannon.color).length }) : ""}</div>`);
    }
    els.rack.innerHTML = slots.join("");
  }

  function renderStacks() {
    els.stacks.innerHTML = state.stacks.map((stack, index) => {
      const top = stack.at(-1);
      if (!top) {
        return `<button class="cannon-stack empty" type="button" disabled aria-label="Prázdný zásobník"><span class="stack-base"></span></button>`;
      }
      const visible = stack.slice(-3).reverse();
      const layers = visible.map((cannon, layer) => (
        `<span class="cannon-layer" style="--layer:${layer};${colorVars(cannon.color)}">${layer === 0 ? cannonMarkup(cannon) : ""}</span>`
      )).join("");
      const topColor = Core.colorById(top.color);
      return `
        <button class="cannon-stack" data-stack="${index}" type="button" aria-label="Vybrat ${topColor.name.toLowerCase()} dělo s ${top.ammo} náboji. V zásobníku ${stack.length} děl.">
          <span class="stack-base"></span>
          <span class="cannon-layers">${layers}</span>
          <span class="stack-count">${stack.length}</span>
        </button>`;
    }).join("");
  }

  function renderStatus() {
    const blocks = Core.countBlocks(state.board);
    const free = Core.RACK_LIMIT - state.rack.length;
    els.level.textContent = state.level;
    els.blocks.textContent = blocks;
    els.free.textContent = `${free} / ${Core.RACK_LIMIT}`;
    els.cannons.textContent = remainingCannons();
    els.moves.textContent = state.moves;
  }

  async function handleStackClick(event) {
    const button = event.target.closest(".cannon-stack[data-stack]");
    if (!button || busy) return;
    const stackIndex = Number(button.dataset.stack);
    const stack = state.stacks[stackIndex];
    const cannon = stack?.at(-1);
    if (!cannon) return;

    if (state.rack.length >= Core.RACK_LIMIT) {
      rejectMove(button, "Lišta je plná. Nejdřív musí některé dělo dostřílet.");
      return;
    }

    const sourceRect = button.getBoundingClientRect();
    busy = true;
    history.push(snapshot());
    if (history.length > 80) history.shift();
    stack.pop();
    state.rack.push(cannon);
    state.moves += 1;
    render();

    const target = els.rack.querySelector(`[data-rack-slot="${state.rack.length - 1}"]`);
    await animateCannon(sourceRect, target, cannon);
    playTone(330, 0.055);
    await settleRack();

    busy = false;
    saveState();
    render();
    checkEndState();
  }

  async function settleRack() {
    let madeProgress = true;
    while (madeProgress) {
      madeProgress = false;

      for (let i = 0; i < state.rack.length; i += 1) {
        const cannon = state.rack[i];
        const target = Core.chooseExposedCell(state.board, cannon.color);
        if (!target) continue;

        await animateShot(i, target, cannon.color);
        state.board[target.row][target.col] = null;
        cannon.ammo -= 1;
        madeProgress = true;
        playTone(470 + (i * 30), 0.035);
        vibrate(8);
        render();
        await delay(42);

        if (cannon.ammo <= 0) {
          state.rack.splice(i, 1);
          playTone(690, 0.055);
          render();
          await delay(75);
        }
        break;
      }
    }
  }

  function rejectMove(element, message) {
    element.classList.remove("shake");
    void element.offsetWidth;
    element.classList.add("shake");
    els.rack.classList.remove("shake");
    void els.rack.offsetWidth;
    els.rack.classList.add("shake");
    showToast(message);
    playTone(145, 0.09);
    vibrate(45);
  }

  function checkEndState() {
    const blocks = Core.countBlocks(state.board);
    if (blocks === 0) {
      const seconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
      const previous = bestTimes[state.level];
      const isBest = previous === undefined || seconds < previous;
      if (isBest) {
        bestTimes[state.level] = seconds;
        localStorage.setItem(BEST_KEY, JSON.stringify(bestTimes));
      }
      playWinSound();
      vibrate([30, 30, 55, 35, 90]);
      openDialog({
        icon: "✓",
        kicker: `ÚROVEŇ ${state.level} HOTOVÁ`,
        title: isBest ? "Nový nejlepší čas!" : "Perfektní pořadí",
        html: `<p>Obrazec je vyčištěný za <strong>${formatTime(seconds)}</strong>${isBest ? "." : `, rekord je ${formatTime(previous)}.`}</p><p>V další úrovni bude větší obrazec a zásobníky budou záludnější.</p>`,
        actions: [
          { label: "Další úroveň", className: "primary", onClick: nextLevel },
          { label: "Hrát znovu", className: "secondary", onClick: () => startLevel(state.level) }
        ]
      });
      return;
    }

    const noSources = state.stacks.every((stack) => stack.length === 0);
    const rackCanShoot = state.rack.some((cannon) => Core.exposedCells(state.board, cannon.color).length > 0);
    if ((state.rack.length >= Core.RACK_LIMIT || noSources) && !rackCanShoot) {
      openDialog({
        icon: "!",
        kicker: "DĚLA JSOU ZABLOKOVANÁ",
        title: "Pořadí rozhoduje",
        html: "<p>Na liště není dělo pro žádnou barvu na okraji obrazce. Bez životů a čekání: vrať poslední tah, nebo úroveň rovnou restartuj.</p>",
        actions: [
          { label: "Vrátit tah", className: "primary", onClick: undo },
          { label: "Restart", className: "secondary", onClick: () => startLevel(state.level) }
        ]
      });
    }
  }

  function undo() {
    if (busy || history.length === 0) return;
    state = history.pop();
    saveState();
    render();
    closeDialog();
    showToast("Tah vrácen.");
    playTone(255, 0.045);
  }

  function startLevel(level) {
    state = Core.generateLevel(level);
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
    document.querySelectorAll(".cannon-stack.hint").forEach((element) => element.classList.remove("hint"));
    const candidates = state.stacks
      .map((stack, index) => ({ index, cannon: stack.at(-1) }))
      .filter((entry) => entry.cannon)
      .sort((a, b) => a.cannon.order - b.cannon.order);

    const best = candidates[0];
    if (!best) {
      showToast("Teď pomůže vrátit tah nebo restartovat úroveň.");
      return;
    }

    const button = document.querySelector(`[data-stack="${best.index}"]`);
    button?.classList.add("hint");
    button?.scrollIntoView({ behavior: "smooth", block: "center" });
    const canShootNow = Core.exposedCells(state.board, best.cannon.color).length > 0;
    showToast(canShootNow ? "Tohle dělo má právě volný cíl." : "Tohle dělo patří nejdřív mezi zbývající možnosti.");
  }

  function showHelp() {
    openDialog({
      icon: "◎",
      kicker: "JAK HRÁT",
      title: "Střílej zvenku dovnitř",
      html: `<ol><li>Klepni na horní dělo v některém zásobníku.</li><li>Dělo se přesune na lištu a automaticky ničí kostky stejné barvy, které jsou právě na okraji.</li><li>Číslo na děle říká počet nábojů. Dokud je všechny nevystřílí, zabírá místo.</li><li>Na liště je jen ${Core.RACK_LIMIT} míst. Špatné pořadí ji může zablokovat.</li></ol><p>Žádné reklamy, životy, mince ani placené záchrany. Vrácení tahu a restart jsou neomezené.</p>`,
      actions: [{ label: "Rozumím", className: "primary", onClick: closeDialog }]
    });
  }

  function confirmRestart() {
    openDialog({
      icon: "↻",
      kicker: `ÚROVEŇ ${state.level}`,
      title: "Začít znovu?",
      html: "<p>Rozložení kostek i pořadí děl zůstane stejné. Ztratí se pouze současný rozehraný postup.</p>",
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

  async function animateCannon(sourceRect, target, cannon) {
    if (!sourceRect || !target || reduceMotion()) {
      await delay(50);
      return;
    }
    const targetRect = target.getBoundingClientRect();
    const flying = document.createElement("div");
    flying.className = "flying-cannon";
    flying.style.cssText = `${colorVars(cannon.color)}left:${sourceRect.left + sourceRect.width / 2 - 25}px;top:${sourceRect.top + 18}px;`;
    flying.innerHTML = cannonMarkup(cannon);
    document.body.appendChild(flying);
    const dx = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
    const dy = targetRect.top + targetRect.height / 2 - (sourceRect.top + 43);
    requestAnimationFrame(() => {
      flying.style.transform = `translate(${dx}px, ${dy}px) scale(.82)`;
      flying.style.opacity = "0.72";
    });
    await delay(230);
    flying.remove();
  }

  async function animateShot(rackIndex, target, colorId) {
    if (reduceMotion()) return;
    const source = els.rack.querySelector(`[data-rack-slot="${rackIndex}"] .cannon`);
    const cell = els.board.querySelector(`[data-row="${target.row}"][data-col="${target.col}"]`);
    if (!source || !cell) return;
    const sourceRect = source.getBoundingClientRect();
    const targetRect = cell.getBoundingClientRect();
    const projectile = document.createElement("span");
    projectile.className = "projectile";
    projectile.style.cssText = `${colorVars(colorId)}left:${sourceRect.left + sourceRect.width / 2 - 5}px;top:${sourceRect.top + 2}px;`;
    document.body.appendChild(projectile);
    const dx = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
    const dy = targetRect.top + targetRect.height / 2 - (sourceRect.top + 7);
    requestAnimationFrame(() => {
      projectile.style.transform = `translate(${dx}px, ${dy}px) scale(.62)`;
    });
    cell.classList.add("targeted");
    await delay(110);
    projectile.remove();
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs} s`;
  }

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      gain.gain.setValueAtTime(0.045, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {
      // Zvuk je jen doplněk.
    }
  }

  function playWinSound() {
    [520, 660, 820].forEach((frequency, index) => setTimeout(() => playTone(frequency, 0.14), index * 105));
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
      showToast("V nabídce prohlížeče zvol Přidat na plochu nebo Nainstalovat aplikaci.");
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
    els.stacks.addEventListener("click", handleStackClick);
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
