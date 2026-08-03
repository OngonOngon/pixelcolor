(function attachCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PixelBlastCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCore() {
  "use strict";

  const VERSION = 2;
  const RACK_LIMIT = 4;
  const STACK_COUNT = 6;

  const COLORS = [
    { id: "coral", name: "Korálová", hex: "#ff6672", symbol: "●" },
    { id: "blue", name: "Modrá", hex: "#4387ff", symbol: "◆" },
    { id: "mint", name: "Mátová", hex: "#35c89a", symbol: "▲" },
    { id: "gold", name: "Žlutá", hex: "#f4b936", symbol: "■" },
    { id: "violet", name: "Fialová", hex: "#8d68ee", symbol: "✦" },
    { id: "pink", name: "Růžová", hex: "#e969b5", symbol: "♥" }
  ];

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

  function dimensionsFor(level) {
    const step = Math.min(3, Math.floor((level - 1) / 4));
    return { rows: 9 + step, cols: 9 + step };
  }

  function shapeMask(level, rows, cols) {
    const kind = (level - 1) % 5;
    const mask = Array.from({ length: rows }, () => Array(cols).fill(false));
    const midR = (rows - 1) / 2;
    const midC = (cols - 1) / 2;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const nr = (r - midR) / Math.max(1, midR);
        const nc = (c - midC) / Math.max(1, midC);
        let alive = false;

        if (kind === 0) {
          // Zaoblený štít s malým zářezem nahoře.
          alive = Math.abs(nc) + Math.abs(nr) * 0.76 < 1.12;
          if (r < 2 && Math.abs(c - midC) < 1.2) alive = false;
        } else if (kind === 1) {
          // Srdce.
          const x = nc * 1.15;
          const y = nr * 1.12 + 0.16;
          const heart = Math.pow(x * x + y * y - 0.72, 3) - x * x * y * y * y;
          alive = heart <= 0;
        } else if (kind === 2) {
          // Pixelová koruna.
          alive = r >= 2 && r <= rows - 2 && c >= 1 && c <= cols - 2;
          if (r < Math.floor(rows * 0.42)) alive = alive && ((c + 1) % 3 !== 0 || r >= 3);
          if (r === rows - 2 && (c < 2 || c > cols - 3)) alive = false;
        } else if (kind === 3) {
          // Kruh s průduchy.
          alive = nr * nr + nc * nc < 1.02;
          if (r > rows * 0.32 && r < rows * 0.55 && (c === 2 || c === cols - 3)) alive = false;
        } else {
          // Pixelová raketa.
          const body = Math.abs(nc) < 0.48 && nr > -0.78 && nr < 0.68;
          const nose = nr <= -0.45 && Math.abs(nc) < (nr + 1.05) * 0.92;
          const fins = nr > 0.2 && nr < 0.78 && Math.abs(nc) < 0.82;
          alive = body || nose || fins;
          if (r === rows - 1 && Math.abs(c - midC) > 0.8) alive = false;
        }

        mask[r][c] = alive;
      }
    }

    return mask;
  }

  function computeDepths(mask) {
    const rows = mask.length;
    const cols = mask[0].length;
    const remaining = mask.map((row) => [...row]);
    const depths = Array.from({ length: rows }, () => Array(cols).fill(-1));
    let layer = 0;
    let left = remaining.flat().filter(Boolean).length;

    while (left > 0) {
      const exposed = [];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (!remaining[r][c]) continue;
          const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          const edge = neighbors.some(([dr, dc]) => {
            const nr = r + dr;
            const nc = c + dc;
            return nr < 0 || nr >= rows || nc < 0 || nc >= cols || !remaining[nr][nc];
          });
          if (edge) exposed.push([r, c]);
        }
      }
      if (!exposed.length) break;
      exposed.forEach(([r, c]) => {
        remaining[r][c] = false;
        depths[r][c] = layer;
        left -= 1;
      });
      layer += 1;
    }
    return depths;
  }

  function assignColors(level, mask, random) {
    const rows = mask.length;
    const cols = mask[0].length;
    const colorCount = Math.min(COLORS.length, 4 + Math.floor((level - 1) / 4));
    const palette = shuffle(COLORS.slice(0, colorCount), random).map((color) => color.id);
    const depths = computeDepths(mask);
    const board = Array.from({ length: rows }, () => Array(cols).fill(null));

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!mask[r][c]) continue;
        const depth = Math.max(0, depths[r][c]);
        const pairOffset = (depth * 2) % palette.length;
        const patch = (Math.floor(r / 2) + Math.floor(c / 3) + (random() < 0.12 ? 1 : 0)) % 2;
        board[r][c] = palette[(pairOffset + patch) % palette.length];
      }
    }

    return board;
  }

  function cloneBoard(board) {
    return board.map((row) => [...row]);
  }

  function countBlocks(board) {
    let count = 0;
    board.forEach((row) => row.forEach((cell) => { if (cell) count += 1; }));
    return count;
  }

  function isExposed(board, row, col) {
    if (!board[row]?.[col]) return false;
    const rows = board.length;
    const cols = board[0].length;
    const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    return neighbors.some(([dr, dc]) => {
      const nr = row + dr;
      const nc = col + dc;
      return nr < 0 || nr >= rows || nc < 0 || nc >= cols || !board[nr][nc];
    });
  }

  function exposedCells(board, colorId) {
    const cells = [];
    for (let r = 0; r < board.length; r += 1) {
      for (let c = 0; c < board[r].length; c += 1) {
        if (board[r][c] === colorId && isExposed(board, r, c)) cells.push({ row: r, col: c });
      }
    }
    return cells;
  }

  function exposedColors(board) {
    const result = new Map();
    for (let r = 0; r < board.length; r += 1) {
      for (let c = 0; c < board[r].length; c += 1) {
        const color = board[r][c];
        if (!color || !isExposed(board, r, c)) continue;
        result.set(color, (result.get(color) || 0) + 1);
      }
    }
    return result;
  }

  function chooseExposedCell(board, colorId, random) {
    const cells = exposedCells(board, colorId);
    if (!cells.length) return null;
    if (!random) return cells[0];
    return cells[Math.floor(random() * cells.length)];
  }

  function fireUpTo(board, colorId, ammo, random) {
    let shots = 0;
    while (shots < ammo) {
      const target = chooseExposedCell(board, colorId, random);
      if (!target) break;
      board[target.row][target.col] = null;
      shots += 1;
    }
    return shots;
  }

  function buildSolution(board, level, random) {
    const simulation = cloneBoard(board);
    const cannons = [];
    let previousColor = null;
    let order = 0;

    while (countBlocks(simulation) > 0) {
      const available = [...exposedColors(simulation).entries()];
      if (!available.length) throw new Error("Generátor vytvořil neřešitelnou desku.");

      const alternatives = available.filter(([color]) => color !== previousColor);
      const candidates = alternatives.length ? alternatives : available;
      const weighted = [];
      candidates.forEach(([color, visible]) => {
        const weight = Math.max(1, Math.min(5, visible));
        for (let i = 0; i < weight; i += 1) weighted.push(color);
      });
      const color = weighted[Math.floor(random() * weighted.length)];
      const requestedAmmo = Math.min(8, 3 + Math.floor(random() * (level < 5 ? 4 : 6)));
      const removed = fireUpTo(simulation, color, requestedAmmo);
      if (!removed) throw new Error("Dělo bez platného cíle.");

      cannons.push({
        id: `c-${level}-${order}`,
        color,
        ammo: removed,
        maxAmmo: removed,
        order
      });
      previousColor = color;
      order += 1;
    }

    return cannons;
  }

  function distributeCannons(cannons, random) {
    const chunks = [];
    let cursor = 0;
    const remainingSlots = () => STACK_COUNT - chunks.length;

    while (cursor < cannons.length && chunks.length < STACK_COUNT) {
      const remaining = cannons.length - cursor;
      const slots = remainingSlots();
      const minimumForOthers = Math.max(0, slots - 1);
      const ideal = Math.ceil(remaining / slots);
      const jitter = Math.floor(random() * 3) - 1;
      const size = Math.max(1, Math.min(remaining - minimumForOthers, ideal + jitter));
      chunks.push(cannons.slice(cursor, cursor + size));
      cursor += size;
    }

    if (cursor < cannons.length) chunks[chunks.length - 1].push(...cannons.slice(cursor));
    while (chunks.length < STACK_COUNT) chunks.push([]);

    const assigned = shuffle(chunks, random);
    return assigned.map((chunk) => [...chunk].reverse().map((cannon) => ({ ...cannon })));
  }

  function generateLevel(level) {
    const safeLevel = Math.max(1, Math.floor(level) || 1);
    const random = mulberry32(1000 + safeLevel * 104729);
    const { rows, cols } = dimensionsFor(safeLevel);
    const mask = shapeMask(safeLevel, rows, cols);
    const board = assignColors(safeLevel, mask, random);
    const cannons = buildSolution(board, safeLevel, random);
    const stacks = distributeCannons(cannons, random);

    return {
      version: VERSION,
      level: safeLevel,
      moves: 0,
      board,
      stacks,
      rack: [],
      totalBlocks: countBlocks(board),
      totalCannons: cannons.length,
      startedAt: Date.now()
    };
  }

  function verifyLevel(level) {
    const state = generateLevel(level);
    const cannons = state.stacks.flat().sort((a, b) => a.order - b.order);
    const board = cloneBoard(state.board);
    for (const cannon of cannons) {
      const fired = fireUpTo(board, cannon.color, cannon.ammo);
      if (fired !== cannon.ammo) return { ok: false, level, reason: `Dělo ${cannon.order} vystřelilo ${fired}/${cannon.ammo}.` };
    }
    return { ok: countBlocks(board) === 0, level, cannons: cannons.length, blocks: state.totalBlocks };
  }

  return {
    VERSION,
    RACK_LIMIT,
    STACK_COUNT,
    COLORS,
    colorById(id) { return COLORS.find((color) => color.id === id) || COLORS[0]; },
    cloneBoard,
    countBlocks,
    isExposed,
    exposedCells,
    exposedColors,
    chooseExposedCell,
    fireUpTo,
    generateLevel,
    verifyLevel
  };
});
