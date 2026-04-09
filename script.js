const difficultyConfig = {
  beginner: { rows: 8, cols: 8, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 24, cols: 24, mines: 99 },
};

let currentDifficulty = "beginner";

const boardEl = document.getElementById("board");
const boardFitEl = document.getElementById("board-fit");
const playAreaEl = document.querySelector(".play-area") || boardFitEl;
const boardFrameEl = document.getElementById("board-frame");
const boardViewportEl = document.getElementById("board-viewport");
const pzStageEl = document.getElementById("pz-stage");
const gameContentEl = document.getElementById("gameContent");
const boardContentEl = document.getElementById("board-content");
const panelEl = gameContentEl || document.querySelector(".panel");
const focusModeBtn = document.getElementById("focus-mode-btn");
const resetCompactBtn = document.getElementById("reset-compact-btn");
const boardZoomControlsEl = document.getElementById("board-zoom-controls");
const zoomInBtn = document.getElementById("zoom-in-btn");
const zoomResetBtn = document.getElementById("zoom-reset-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");
const resetBtn = document.getElementById("reset-btn");
const pauseBtn = document.getElementById("pause-btn");
const flagModeBtn = document.getElementById("flag-mode-btn");
const difficultySelectEl = document.getElementById("difficulty-select");
const mineCountEl = document.getElementById("mine-count");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");
const mobileFitMediaQuery = window.matchMedia("(max-width: 768px)");
const mobilePanZoomMediaQuery = window.matchMedia("(pointer: coarse)");
const desktopFinePointerMediaQuery = window.matchMedia("(pointer: fine)");
const boardFitMinScale = 0.45;
const mobileGapByDifficulty = {
  beginner: 6,
  intermediate: 4,
  expert: 3,
};
const mobileTilePresetByDifficulty = {
  beginner: 40,
  intermediate: 24,
  expert: 16,
};
const desktopGapByDifficulty = {
  beginner: 8,
  intermediate: 7,
  expert: 6,
};
const desktopTileMin = 20;
const desktopTileMax = 64;
const desktopGapMin = 3;
const desktopGapMax = 10;
const minUserZoom = 1;
const maxUserZoom = 2.2;
const minBoardZoom = 0.7;
const maxBoardZoom = 2.2;
const boardZoomStep = 0.15;
const mobilePanZoomEnabled = false;
const longPressFlagDelayMs = 450;
const tapMoveTolerancePx = 8;
let boardFitFrameId = null;
let suppressClickUntil = 0;
let isFocusMode = false;
let longPressTimerId = null;
let longPressStartX = 0;
let longPressStartY = 0;
let mobileZoom = 1;
let panX = 0;
let panY = 0;
let boardPanPointerId = null;
let boardPanStartX = 0;
let boardPanStartY = 0;
let boardPanOriginX = 0;
let boardPanOriginY = 0;
let boardPanMoved = false;
let difficultyTransitionId = 0;
const panZoomState = {
  baseScale: 1,
  userZoom: 1,
  panX: 0,
  panY: 0,
  naturalWidth: 0,
  naturalHeight: 0,
  pointers: new Map(),
  dragPointerId: null,
  dragStartX: 0,
  dragStartY: 0,
  dragPanX: 0,
  dragPanY: 0,
  pinchStartDistance: 0,
  pinchStartZoom: 1,
  pinchWorldX: 0,
  pinchWorldY: 0,
  gestureMoved: false,
};

let board = [];
let gameOver = false;
let flagsPlaced = 0;
let revealedCount = 0;
let timer = 0;
let timerId = null;
let hasStarted = false;
let isPaused = false;
let isFlagMode = false;
let inputMode = "mouse";
let keyboardRow = 0;
let keyboardCol = 0;
let lastFlagActionKey = "";
let lastFlagActionTime = 0;
let tileButtons = [];
const pendingTileUpdates = new Set();
let flushAnimationFrameId = null;

function setStatusMessage(text, variant = "") {
  messageEl.textContent = text;
  messageEl.classList.remove("win", "lose");
  if (variant) {
    messageEl.classList.add(variant);
  }
}

function getCurrentConfig() {
  return difficultyConfig[currentDifficulty];
}

function createBoardData() {
  const { rows, cols } = getCurrentConfig();
  const tiles = [];

  for (let row = 0; row < rows; row += 1) {
    const currentRow = [];
    for (let col = 0; col < cols; col += 1) {
      currentRow.push({
        row,
        col,
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborMines: 0,
      });
    }
    tiles.push(currentRow);
  }

  placeMines(tiles);
  calculateNeighborMines(tiles);

  return tiles;
}

function placeMines(tiles) {
  const { rows, cols, mines } = getCurrentConfig();
  let placed = 0;

  while (placed < mines) {
    const row = Math.floor(Math.random() * rows);
    const col = Math.floor(Math.random() * cols);

    if (!tiles[row][col].isMine) {
      tiles[row][col].isMine = true;
      placed += 1;
    }
  }
}

function calculateNeighborMines(tiles) {
  const { rows, cols } = getCurrentConfig();

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (tiles[row][col].isMine) {
        continue;
      }

      let count = 0;
      const neighbors = getNeighbors(row, col);

      for (const neighbor of neighbors) {
        if (tiles[neighbor.row][neighbor.col].isMine) {
          count += 1;
        }
      }

      tiles[row][col].neighborMines = count;
    }
  }
}

function getNeighbors(row, col) {
  const { rows, cols } = getCurrentConfig();
  const neighbors = [];

  for (let dRow = -1; dRow <= 1; dRow += 1) {
    for (let dCol = -1; dCol <= 1; dCol += 1) {
      if (dRow === 0 && dCol === 0) {
        continue;
      }

      const newRow = row + dRow;
      const newCol = col + dCol;

      const isInsideBoard =
        newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols;

      if (isInsideBoard) {
        neighbors.push({ row: newRow, col: newCol });
      }
    }
  }

  return neighbors;
}

function updateMineCounter() {
  const { mines } = getCurrentConfig();
  mineCountEl.textContent = String(mines - flagsPlaced);
}

function getTileIndex(row, col) {
  const { cols } = getCurrentConfig();
  return row * cols + col;
}

function queueTileUpdate(row, col, changedTiles) {
  changedTiles.add(getTileIndex(row, col));
}

function updateTileElement(row, col) {
  const tileData = board[row][col];
  const tileBtn = tileButtons[row][col];

  tileBtn.className = "tile";
  tileBtn.textContent = "";
  tileBtn.removeAttribute("data-number");
  tileBtn.classList.toggle(
    "selected",
    isDesktopFinePointerLayout() &&
      inputMode === "keyboard" &&
      row === keyboardRow &&
      col === keyboardCol,
  );

  if (tileData.isFlagged) {
    tileBtn.classList.add("flagged");
    return;
  }

  if (tileData.isRevealed) {
    tileBtn.classList.add("revealed");

    if (tileData.isMine) {
      tileBtn.classList.add("mine", "mango");
    } else if (tileData.neighborMines > 0) {
      tileBtn.textContent = String(tileData.neighborMines);
      tileBtn.dataset.number = String(tileData.neighborMines);
    }
    return;
  }

  // No additional state to render for hidden, unflagged tiles.
}

function flushPendingTileUpdates() {
  if (flushAnimationFrameId !== null) {
    cancelAnimationFrame(flushAnimationFrameId);
    flushAnimationFrameId = null;
  }

  const { cols } = getCurrentConfig();

  for (const index of pendingTileUpdates) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    updateTileElement(row, col);
  }

  pendingTileUpdates.clear();
}

function applyChangedTiles(changedTiles, options = {}) {
  const { sync = false } = options;

  for (const index of changedTiles) {
    pendingTileUpdates.add(index);
  }

  updateMineCounter();

  if (pendingTileUpdates.size === 0) {
    return;
  }

  const shouldBatchWithAnimationFrame = !sync && pendingTileUpdates.size >= 36;

  if (shouldBatchWithAnimationFrame) {
    if (flushAnimationFrameId === null) {
      flushAnimationFrameId = requestAnimationFrame(() => {
        flushAnimationFrameId = null;
        flushPendingTileUpdates();
      });
    }
    return;
  }

  flushPendingTileUpdates();
}

function resetTileView() {
  if (flushAnimationFrameId !== null) {
    cancelAnimationFrame(flushAnimationFrameId);
    flushAnimationFrameId = null;
  }
  pendingTileUpdates.clear();
}

function refreshSelectedTileState() {
  const shouldShowSelectedTile =
    isDesktopFinePointerLayout() && inputMode === "keyboard";

  for (let row = 0; row < tileButtons.length; row += 1) {
    for (let col = 0; col < tileButtons[row].length; col += 1) {
      tileButtons[row][col].classList.toggle(
        "selected",
        shouldShowSelectedTile && row === keyboardRow && col === keyboardCol,
      );
    }
  }
}

function queueKeyboardTileUpdate(changedTiles, row, col) {
  const { rows, cols } = getCurrentConfig();
  if (row < 0 || row >= rows || col < 0 || col >= cols) {
    return;
  }
  queueTileUpdate(row, col, changedTiles);
}

function syncKeyboardSelection(changedTiles = null) {
  const { rows, cols } = getCurrentConfig();
  const nextRow = clamp(keyboardRow, 0, rows - 1);
  const nextCol = clamp(keyboardCol, 0, cols - 1);
  const previousRow = keyboardRow;
  const previousCol = keyboardCol;

  keyboardRow = nextRow;
  keyboardCol = nextCol;

  if (!(changedTiles instanceof Set)) {
    return;
  }

  queueKeyboardTileUpdate(changedTiles, previousRow, previousCol);
  queueKeyboardTileUpdate(changedTiles, keyboardRow, keyboardCol);
}

function moveSelection(deltaRow, deltaCol) {
  const changedTiles = new Set();
  const previousRow = keyboardRow;
  const previousCol = keyboardCol;
  const { rows, cols } = getCurrentConfig();
  setInputMode("keyboard");
  keyboardRow = clamp(keyboardRow + deltaRow, 0, rows - 1);
  keyboardCol = clamp(keyboardCol + deltaCol, 0, cols - 1);

  queueTileUpdate(previousRow, previousCol, changedTiles);
  queueTileUpdate(keyboardRow, keyboardCol, changedTiles);
  applyChangedTiles(changedTiles, { sync: true });
}

function clearFocusedBoardTile() {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return;
  }

  if (activeElement.classList.contains("tile") && boardEl.contains(activeElement)) {
    activeElement.blur();
  }
}

function setInputMode(nextInputMode) {
  if (inputMode === nextInputMode) {
    return;
  }

  if (nextInputMode === "keyboard") {
    clearFocusedBoardTile();
  }

  inputMode = nextInputMode;
  refreshSelectedTileState();
}

function initializeBoardView(options = {}) {
  const { deferFit = false } = options;
  const { rows, cols } = getCurrentConfig();
  const fragment = document.createDocumentFragment();

  boardEl.innerHTML = "";
  boardEl.style.setProperty("--cols", String(cols));
  boardEl.style.setProperty("--rows", String(rows));
  tileButtons = [];

  for (let row = 0; row < rows; row += 1) {
    const currentRowButtons = [];
    for (let col = 0; col < cols; col += 1) {
      const tileBtn = document.createElement("button");
      tileBtn.type = "button";
      tileBtn.className = "tile";
      tileBtn.dataset.row = String(row);
      tileBtn.dataset.col = String(col);
      tileBtn.setAttribute("aria-label", `Tile ${row + 1}, ${col + 1}`);
      currentRowButtons.push(tileBtn);
      fragment.appendChild(tileBtn);
    }
    tileButtons.push(currentRowButtons);
  }

  boardEl.appendChild(fragment);
  refreshSelectedTileState();
  updateMineCounter();
  if (!deferFit) {
    scheduleBoardFit();
  }
}

function isMobilePanZoomLayout() {
  return mobilePanZoomMediaQuery.matches;
}

function isMobilePanZoomEnabled() {
  return mobilePanZoomEnabled && isMobilePanZoomLayout();
}

function isDesktopFinePointerLayout() {
  return desktopFinePointerMediaQuery.matches;
}

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function getScaledContentSize() {
  const totalScale = panZoomState.baseScale * panZoomState.userZoom;
  return {
    width: panZoomState.naturalWidth * totalScale,
    height: panZoomState.naturalHeight * totalScale,
  };
}

function clampPan() {
  const viewportWidth = boardViewportEl.clientWidth;
  const viewportHeight = boardViewportEl.clientHeight;
  const scaledSize = getScaledContentSize();

  if (scaledSize.width <= viewportWidth) {
    panZoomState.panX = (viewportWidth - scaledSize.width) / 2;
  } else {
    const minX = viewportWidth - scaledSize.width;
    panZoomState.panX = clamp(panZoomState.panX, minX, 0);
  }

  if (scaledSize.height <= viewportHeight) {
    panZoomState.panY = (viewportHeight - scaledSize.height) / 2;
  } else {
    const minY = viewportHeight - scaledSize.height;
    panZoomState.panY = clamp(panZoomState.panY, minY, 0);
  }
}

function applyPanZoomTransforms() {
  const contentScale = panZoomState.baseScale * panZoomState.userZoom;
  boardContentEl.style.setProperty("--content-scale", contentScale.toFixed(3));
  pzStageEl.style.setProperty("--pan-x", `${panZoomState.panX.toFixed(1)}px`);
  pzStageEl.style.setProperty("--pan-y", `${panZoomState.panY.toFixed(1)}px`);
}

function syncDifficultyState() {
  gameContentEl.dataset.difficulty = currentDifficulty;
}

function applyMobileTileGapPreset() {
  if (!isMobilePanZoomLayout()) {
    return;
  }
  const presetGap = mobileGapByDifficulty[currentDifficulty];
  const presetTile = mobileTilePresetByDifficulty[currentDifficulty];
  boardEl.style.setProperty("--gap", `${presetGap}px`);
  boardEl.style.setProperty("--tile", `${presetTile}px`);
}

function waitForAnimationFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function resetUserView() {
  mobileZoom = 1;
  panX = 0;
  panY = 0;
  commitMobileBoardTransform();
  syncBoardZoomControls();
}

function isMobileBoardZoomEnabled() {
  return isMobilePanZoomLayout() && currentDifficulty !== "beginner";
}

function syncBoardZoomControls() {
  const showControls = isMobileBoardZoomEnabled();
  boardZoomControlsEl.hidden = !showControls;

  if (!showControls) {
    mobileZoom = 1;
    panX = 0;
    panY = 0;
    commitMobileBoardTransform();
    return;
  }

  zoomInBtn.disabled = mobileZoom >= maxBoardZoom;
  zoomOutBtn.disabled = mobileZoom <= minBoardZoom;
}

function setBoardZoom(nextZoom) {
  const zoom = clamp(nextZoom, minBoardZoom, maxBoardZoom);
  if (Math.abs(zoom - mobileZoom) < 0.001) {
    return;
  }

  const viewportWidth = boardViewportEl.clientWidth;
  const viewportHeight = boardViewportEl.clientHeight;
  const stageX = panZoomState.panX;
  const stageY = panZoomState.panY;
  const anchorX = viewportWidth / 2;
  const anchorY = viewportHeight / 2;
  const worldX = (anchorX - stageX - panX) / mobileZoom;
  const worldY = (anchorY - stageY - panY) / mobileZoom;

  mobileZoom = zoom;
  panX = anchorX - stageX - worldX * mobileZoom;
  panY = anchorY - stageY - worldY * mobileZoom;
  commitMobileBoardTransform();
  syncBoardZoomControls();
}

function applyMobileBoardTransform() {
  boardEl.style.setProperty("--board-pan-x", `${panX.toFixed(1)}px`);
  boardEl.style.setProperty("--board-pan-y", `${panY.toFixed(1)}px`);
  boardEl.style.setProperty("--board-zoom", mobileZoom.toFixed(3));
}

function commitMobileBoardTransform() {
  clampMobileBoardPan();
  applyMobileBoardTransform();
}

function clampMobileBoardPan() {
  if (!isMobileBoardZoomEnabled()) {
    panX = 0;
    panY = 0;
    return;
  }

  if (mobileZoom <= 1) {
    panX = 0;
    panY = 0;
    return;
  }

  const viewportWidth = boardViewportEl.clientWidth;
  const viewportHeight = boardViewportEl.clientHeight;
  const stageX = panZoomState.panX;
  const stageY = panZoomState.panY;
  const boardWidth = boardEl.offsetWidth;
  const boardHeight = boardEl.offsetHeight;
  const scaledWidth = boardWidth * mobileZoom;
  const scaledHeight = boardHeight * mobileZoom;

  if (scaledWidth <= viewportWidth) {
    panX = (viewportWidth - scaledWidth) / 2 - stageX;
  } else {
    const minPanX = viewportWidth - stageX - scaledWidth;
    const maxPanX = -stageX;
    panX = clamp(panX, minPanX, maxPanX);
  }

  if (scaledHeight <= viewportHeight) {
    panY = (viewportHeight - scaledHeight) / 2 - stageY;
  } else {
    const minPanY = viewportHeight - stageY - scaledHeight;
    const maxPanY = -stageY;
    panY = clamp(panY, minPanY, maxPanY);
  }
}

function isMobileBoardPanEnabled() {
  return isMobileBoardZoomEnabled() && mobileZoom > 1;
}

function handleBoardViewportPointerDown(event) {
  if (!isMobileBoardPanEnabled() || event.pointerType === "mouse") {
    return;
  }

  boardPanPointerId = event.pointerId;
  boardPanStartX = event.clientX;
  boardPanStartY = event.clientY;
  boardPanOriginX = panX;
  boardPanOriginY = panY;
  boardPanMoved = false;
  if (typeof boardViewportEl.setPointerCapture === "function") {
    boardViewportEl.setPointerCapture(event.pointerId);
  }
}

function handleBoardViewportPointerMove(event) {
  if (boardPanPointerId !== event.pointerId) {
    return;
  }

  const deltaX = event.clientX - boardPanStartX;
  const deltaY = event.clientY - boardPanStartY;
  if (!boardPanMoved && Math.hypot(deltaX, deltaY) > tapMoveTolerancePx) {
    boardPanMoved = true;
  }

  if (!boardPanMoved) {
    return;
  }

  panX = boardPanOriginX + deltaX;
  panY = boardPanOriginY + deltaY;
  commitMobileBoardTransform();
  suppressClickUntil = Date.now() + 180;
  event.preventDefault();
}

function handleBoardViewportPointerEnd(event) {
  if (boardPanPointerId !== event.pointerId) {
    return;
  }

  if (
    typeof boardViewportEl.hasPointerCapture === "function" &&
    boardViewportEl.hasPointerCapture(event.pointerId)
  ) {
    boardViewportEl.releasePointerCapture(event.pointerId);
  }

  if (boardPanMoved) {
    suppressClickUntil = Date.now() + 220;
  }

  boardPanPointerId = null;
  boardPanMoved = false;
}

function clearLongPressTimer() {
  if (longPressTimerId !== null) {
    clearTimeout(longPressTimerId);
    longPressTimerId = null;
  }
}

function handleBoardTouchStart(event) {
  if (!isMobilePanZoomLayout() || gameOver || isPaused) {
    return;
  }

  if (event.touches.length !== 1) {
    clearLongPressTimer();
    return;
  }

  const touch = event.touches[0];
  longPressStartX = touch.clientX;
  longPressStartY = touch.clientY;
  clearLongPressTimer();
  longPressTimerId = setTimeout(() => {
    runMobileLongPressFlag(longPressStartX, longPressStartY);
    suppressClickUntil = Date.now() + 260;
  }, longPressFlagDelayMs);
}

function handleBoardTouchMove(event) {
  if (!isMobilePanZoomLayout() || longPressTimerId === null || event.touches.length !== 1) {
    clearLongPressTimer();
    return;
  }

  const touch = event.touches[0];
  const deltaX = touch.clientX - longPressStartX;
  const deltaY = touch.clientY - longPressStartY;
  if (Math.hypot(deltaX, deltaY) > tapMoveTolerancePx) {
    clearLongPressTimer();
  }
}

function handleBoardTouchEnd() {
  clearLongPressTimer();
}

function getTileFromClientPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  if (!(element instanceof Element)) {
    return null;
  }

  const tileBtn = element.closest(".tile");
  if (!tileBtn || !boardEl.contains(tileBtn)) {
    return null;
  }

  return {
    row: Number(tileBtn.dataset.row),
    col: Number(tileBtn.dataset.col),
  };
}

function runMobileTapReveal(clientX, clientY) {
  if (gameOver || isPaused) {
    return;
  }

  const tile = getTileFromClientPoint(clientX, clientY);
  if (!tile) {
    return;
  }

  handleTilePrimaryAction(tile.row, tile.col, isFlagMode);
}

function runMobileLongPressFlag(clientX, clientY) {
  if (gameOver || isPaused) {
    return;
  }

  const tile = getTileFromClientPoint(clientX, clientY);
  if (!tile) {
    return;
  }

  handleTileContextAction(tile.row, tile.col);
}

function syncFocusModeUI() {
  panelEl.classList.remove("focus-mode");
  focusModeBtn.textContent = "Focus Off";
}

function setFocusMode(enabled) {
  if (isMobilePanZoomLayout()) {
    isFocusMode = false;
    syncFocusModeUI();
    return;
  }
  isFocusMode = enabled;
  syncFocusModeUI();
  scheduleBoardFit();
}

function toggleFocusMode() {
  setFocusMode(!isFocusMode);
}

function getPointerDistance(pointerA, pointerB) {
  return Math.hypot(pointerB.x - pointerA.x, pointerB.y - pointerA.y);
}

function getPointerMidpoint(pointerA, pointerB) {
  return {
    x: (pointerA.x + pointerB.x) / 2,
    y: (pointerA.y + pointerB.y) / 2,
  };
}

function beginPinchGesture() {
  const activePointers = Array.from(panZoomState.pointers.values());
  if (activePointers.length < 2) {
    return;
  }

  const [pointerA, pointerB] = activePointers;
  panZoomState.pinchStartDistance = getPointerDistance(pointerA, pointerB);
  panZoomState.pinchStartZoom = panZoomState.userZoom;

  const midpoint = getPointerMidpoint(pointerA, pointerB);
  const viewportRect = boardViewportEl.getBoundingClientRect();
  const midX = midpoint.x - viewportRect.left;
  const midY = midpoint.y - viewportRect.top;

  panZoomState.pinchWorldX = (midX - panZoomState.panX) / panZoomState.userZoom;
  panZoomState.pinchWorldY = (midY - panZoomState.panY) / panZoomState.userZoom;
}

function handleStagePointerDown(event) {
  if (!isMobilePanZoomEnabled() || event.pointerType === "mouse") {
    return;
  }

  pzStageEl.setPointerCapture(event.pointerId);
  panZoomState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (panZoomState.pointers.size === 1) {
    panZoomState.dragPointerId = event.pointerId;
    panZoomState.dragStartX = event.clientX;
    panZoomState.dragStartY = event.clientY;
    panZoomState.dragPanX = panZoomState.panX;
    panZoomState.dragPanY = panZoomState.panY;
    panZoomState.gestureMoved = false;
    clearLongPressTimer();
    longPressTimerId = setTimeout(() => {
      if (panZoomState.pointers.size !== 1 || panZoomState.dragPointerId !== event.pointerId) {
        return;
      }
      runMobileLongPressFlag(event.clientX, event.clientY);
      panZoomState.gestureMoved = true;
      suppressClickUntil = Date.now() + 260;
    }, longPressFlagDelayMs);
  } else if (panZoomState.pointers.size >= 2) {
    clearLongPressTimer();
    beginPinchGesture();
  }

  event.preventDefault();
}

function handleStagePointerMove(event) {
  if (!isMobilePanZoomEnabled() || !panZoomState.pointers.has(event.pointerId)) {
    return;
  }

  panZoomState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (panZoomState.pointers.size >= 2) {
    clearLongPressTimer();
    const activePointers = Array.from(panZoomState.pointers.values());
    const [pointerA, pointerB] = activePointers;
    const distance = getPointerDistance(pointerA, pointerB);
    if (panZoomState.pinchStartDistance <= 0) {
      beginPinchGesture();
      event.preventDefault();
      return;
    }

    const midpoint = getPointerMidpoint(pointerA, pointerB);
    const viewportRect = boardViewportEl.getBoundingClientRect();
    const midX = midpoint.x - viewportRect.left;
    const midY = midpoint.y - viewportRect.top;

    panZoomState.userZoom = clamp(
      panZoomState.pinchStartZoom * (distance / panZoomState.pinchStartDistance),
      minUserZoom,
      maxUserZoom,
    );
    panZoomState.panX = midX - panZoomState.pinchWorldX * panZoomState.userZoom;
    panZoomState.panY = midY - panZoomState.pinchWorldY * panZoomState.userZoom;
    clampPan();
    applyPanZoomTransforms();
    panZoomState.gestureMoved = true;
    event.preventDefault();
    return;
  }

  if (panZoomState.dragPointerId !== event.pointerId) {
    return;
  }

  const deltaX = event.clientX - panZoomState.dragStartX;
  const deltaY = event.clientY - panZoomState.dragStartY;
  if (Math.hypot(deltaX, deltaY) > tapMoveTolerancePx) {
    clearLongPressTimer();
  }
  panZoomState.panX = panZoomState.dragPanX + deltaX;
  panZoomState.panY = panZoomState.dragPanY + deltaY;
  clampPan();
  applyPanZoomTransforms();
  if (Math.hypot(deltaX, deltaY) > 4) {
    panZoomState.gestureMoved = true;
  }
  event.preventDefault();
}

function handleStagePointerUpOrCancel(event) {
  if (!isMobilePanZoomEnabled() || !panZoomState.pointers.has(event.pointerId)) {
    return;
  }

  panZoomState.pointers.delete(event.pointerId);
  if (pzStageEl.hasPointerCapture(event.pointerId)) {
    pzStageEl.releasePointerCapture(event.pointerId);
  }

  if (panZoomState.pointers.size >= 2) {
    clearLongPressTimer();
    beginPinchGesture();
  } else if (panZoomState.pointers.size === 1) {
    const [[pointerId, pointer]] = panZoomState.pointers.entries();
    panZoomState.dragPointerId = pointerId;
    panZoomState.dragStartX = pointer.x;
    panZoomState.dragStartY = pointer.y;
    panZoomState.dragPanX = panZoomState.panX;
    panZoomState.dragPanY = panZoomState.panY;
    panZoomState.pinchStartDistance = 0;
  } else {
    clearLongPressTimer();
    panZoomState.dragPointerId = null;
    panZoomState.pinchStartDistance = 0;
    if (!panZoomState.gestureMoved && event.type !== "pointercancel") {
      runMobileTapReveal(event.clientX, event.clientY);
      suppressClickUntil = Date.now() + 220;
    } else {
      suppressClickUntil = Date.now() + 220;
    }
    panZoomState.gestureMoved = false;
  }

  event.preventDefault();
}

function handleRevealAction(row, col) {
  startGameIfNeeded();
  const changedTiles = revealTile(row, col);
  const clickedTile = board[row][col];

  if (clickedTile.isMine) {
    endGame(false, changedTiles);
    return;
  }

  if (checkWin()) {
    endGame(true, changedTiles);
    return;
  }

  applyChangedTiles(changedTiles);
}

function handleTilePrimaryAction(row, col, forceFlag = false) {
  if (forceFlag) {
    runFlagAction(row, col);
    return;
  }

  if (board[row][col].isFlagged) {
    return;
  }

  handleRevealAction(row, col);
}

function handleTileContextAction(row, col) {
  if (shouldSkipDuplicateFlag(row, col)) {
    return;
  }

  runFlagAction(row, col);
}

function fitBoardToViewport() {
  boardFitFrameId = null;
  boardContentEl.style.setProperty("--content-scale", "1");
  pzStageEl.style.setProperty("--pan-x", "0px");
  pzStageEl.style.setProperty("--pan-y", "0px");
  boardViewportEl.style.width = "";
  boardViewportEl.style.height = "";

  const frameStyle = window.getComputedStyle(boardFrameEl);
  const framePadX = parseFloat(frameStyle.paddingLeft) + parseFloat(frameStyle.paddingRight);
  const framePadY = parseFloat(frameStyle.paddingTop) + parseFloat(frameStyle.paddingBottom);
  const { rows, cols } = getCurrentConfig();
  const isDesktop = isDesktopFinePointerLayout();
  let availableWidth = Math.max(1, boardFitEl.clientWidth - framePadX);
  let availableHeight;
  if (isDesktop) {
    availableWidth = Math.max(1, playAreaEl.clientWidth - framePadX);
    availableHeight = Math.max(1, playAreaEl.clientHeight - framePadY);
  } else {
    availableWidth = Math.max(1, boardFrameEl.clientWidth - framePadX);
    availableHeight = Math.max(1, boardFrameEl.clientHeight - framePadY);
  }

  let computedGap;
  let computedTile;
  if (isDesktop) {
    const targetGap = desktopGapByDifficulty[currentDifficulty];
    computedGap = clamp(targetGap, desktopGapMin, desktopGapMax);
    const tileByWidth = Math.floor((availableWidth - computedGap * (cols - 1)) / cols);
    const tileByHeight = Math.floor((availableHeight - computedGap * (rows - 1)) / rows);
    const fittedTile = Math.min(tileByWidth, tileByHeight);
    computedTile = clamp(fittedTile, desktopTileMin, desktopTileMax);
  } else {
    computedGap = mobileGapByDifficulty[currentDifficulty];
    const tileByWidth = Math.floor((availableWidth - computedGap * (cols - 1)) / cols);
    const tileByHeight = Math.floor((availableHeight - computedGap * (rows - 1)) / rows);
    computedTile = Math.max(8, Math.min(tileByWidth, tileByHeight));
  }

  boardEl.style.setProperty("--gap", `${computedGap}px`);
  boardEl.style.setProperty("--tile", `${computedTile}px`);

  const naturalWidth = boardContentEl.offsetWidth;
  const naturalHeight = boardContentEl.offsetHeight;
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    syncBoardZoomControls();
    return;
  }

  let scale;
  if (isDesktop) {
    const widthScale = availableWidth / naturalWidth;
    const heightScale = availableHeight / naturalHeight;
    const fittedScale = Math.min(1, widthScale, heightScale);
    scale = Math.min(1, Math.max(boardFitMinScale, fittedScale));
  } else {
    scale = Math.max(boardFitMinScale, 1);
  }

  scale = Math.max(0.05, Math.min(1, scale));

  panZoomState.baseScale = scale;
  panZoomState.naturalWidth = naturalWidth;
  panZoomState.naturalHeight = naturalHeight;
  const scaledWidth = Math.ceil(naturalWidth * scale);
  const scaledHeight = Math.ceil(naturalHeight * scale);
  if (!isDesktop) {
    boardViewportEl.style.width = `${Math.floor(availableWidth)}px`;
    boardViewportEl.style.height = `${Math.floor(availableHeight)}px`;
  } else {
    boardViewportEl.style.width = `${scaledWidth}px`;
    boardViewportEl.style.height = `${scaledHeight}px`;
  }
  if (!isMobileBoardZoomEnabled()) {
    mobileZoom = 1;
    panX = 0;
    panY = 0;
  }
  clampPan();
  applyPanZoomTransforms();
  commitMobileBoardTransform();
  syncBoardZoomControls();
}

function scheduleBoardFit() {
  if (boardFitFrameId !== null) {
    cancelAnimationFrame(boardFitFrameId);
  }
  boardFitFrameId = requestAnimationFrame(fitBoardToViewport);
}

function startTimer() {
  if (timerId !== null) {
    return;
  }

  timerId = setInterval(() => {
    timer += 1;
    timerEl.textContent = String(timer);
  }, 1000);
}

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function setBoardInteractivity() {
  const shouldLockBoard = gameOver || isPaused;
  boardEl.classList.toggle("paused", shouldLockBoard);
}

function setPaused(paused) {
  if (gameOver) {
    return;
  }

  if (!hasStarted && paused) {
    return;
  }

  isPaused = paused;
  setBoardInteractivity();
  pauseBtn.textContent = isPaused ? "Resume" : "Pause";

  if (isPaused) {
    stopTimer();
    setStatusMessage("Paused");
    return;
  }

  if (hasStarted) {
    startTimer();
    setStatusMessage("Game resumed.");
  }
}

function togglePause() {
  setPaused(!isPaused);
}

function updateFlagModeButton() {
  flagModeBtn.textContent = isFlagMode ? "Flag On" : "Flag Off";
  flagModeBtn.classList.toggle("active", isFlagMode);
}

function toggleFlagMode() {
  isFlagMode = !isFlagMode;
  updateFlagModeButton();
}

function isEditableElement(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const editableTagNames = new Set(["INPUT", "SELECT", "TEXTAREA"]);
  return editableTagNames.has(target.tagName);
}

function handleSelectedTileAction() {
  if (gameOver || isPaused) {
    return;
  }

  handleTilePrimaryAction(keyboardRow, keyboardCol, isFlagMode);
}

function handleGlobalKeydown(event) {
  if (!isDesktopFinePointerLayout() || isEditableElement(event.target)) {
    return;
  }

  const key = event.key;
  const isSpaceKey = key === " ";
  const isArrowKey = key.startsWith("Arrow");
  if (isSpaceKey || isArrowKey) {
    event.preventDefault();
  }

  if (event.repeat && !isArrowKey && !["w", "a", "s", "d", "W", "A", "S", "D"].includes(key)) {
    return;
  }

  switch (key) {
    case "r":
    case "R":
      resetGame();
      return;
    case "f":
    case "F":
      toggleFlagMode();
      return;
    case " ":
      togglePause();
      return;
    case "ArrowUp":
    case "w":
    case "W":
      moveSelection(-1, 0);
      return;
    case "ArrowDown":
    case "s":
    case "S":
      moveSelection(1, 0);
      return;
    case "ArrowLeft":
    case "a":
    case "A":
      moveSelection(0, -1);
      return;
    case "ArrowRight":
    case "d":
    case "D":
      moveSelection(0, 1);
      return;
    case "Enter":
      handleSelectedTileAction();
      return;
    default:
      return;
  }
}

function revealTile(row, col) {
  const changedTiles = new Set();
  const tile = board[row][col];

  if (tile.isRevealed || tile.isFlagged || gameOver) {
    return changedTiles;
  }

  tile.isRevealed = true;
  revealedCount += 1;
  queueTileUpdate(row, col, changedTiles);

  if (tile.isMine) {
    return changedTiles;
  }

  if (tile.neighborMines === 0) {
    revealEmptyNeighbors(row, col, changedTiles);
  }

  return changedTiles;
}

function revealEmptyNeighbors(row, col, changedTiles) {
  const neighbors = getNeighbors(row, col);

  for (const neighbor of neighbors) {
    const nextTile = board[neighbor.row][neighbor.col];

    if (!nextTile.isRevealed && !nextTile.isFlagged && !nextTile.isMine) {
      nextTile.isRevealed = true;
      revealedCount += 1;
      queueTileUpdate(neighbor.row, neighbor.col, changedTiles);

      if (nextTile.neighborMines === 0) {
        revealEmptyNeighbors(neighbor.row, neighbor.col, changedTiles);
      }
    }
  }
}

function toggleFlag(row, col) {
  const changedTiles = new Set();
  const tile = board[row][col];

  if (tile.isRevealed || gameOver) {
    return changedTiles;
  }

  tile.isFlagged = !tile.isFlagged;
  queueTileUpdate(row, col, changedTiles);

  if (tile.isFlagged) {
    flagsPlaced += 1;
  } else {
    flagsPlaced -= 1;
  }

  return changedTiles;
}

function startGameIfNeeded() {
  if (!hasStarted) {
    hasStarted = true;
    startTimer();
  }
}

function runFlagAction(row, col) {
  if (isPaused) {
    return;
  }

  startGameIfNeeded();
  const changedTiles = toggleFlag(row, col);
  applyChangedTiles(changedTiles);
}

function shouldSkipDuplicateFlag(row, col) {
  const now = Date.now();
  const key = `${row},${col}`;
  const isDuplicate = key === lastFlagActionKey && now - lastFlagActionTime < 250;

  lastFlagActionKey = key;
  lastFlagActionTime = now;

  return isDuplicate;
}

function revealAllMines(changedTiles) {
  const { rows, cols } = getCurrentConfig();

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (board[row][col].isMine && !board[row][col].isFlagged) {
        board[row][col].isRevealed = true;
        queueTileUpdate(row, col, changedTiles);
      }
    }
  }
}

function endGame(didWin, changedTiles = new Set()) {
  gameOver = true;
  isPaused = false;
  setBoardInteractivity();
  pauseBtn.textContent = "Pause";
  stopTimer();

  if (didWin) {
    setStatusMessage("You won! All safe tiles are revealed.", "win");
  } else {
    revealAllMines(changedTiles);
    setStatusMessage("Game over! You hit a mine. All mines are shown.", "lose");
  }

  applyChangedTiles(changedTiles, { sync: true });
}

function checkWin() {
  const { rows, cols, mines } = getCurrentConfig();
  const totalSafeTiles = rows * cols - mines;
  return revealedCount === totalSafeTiles;
}

function resetGame(options = {}) {
  const { deferFit = false, applyMobilePreset = false } = options;
  clearLongPressTimer();
  gameOver = false;
  flagsPlaced = 0;
  revealedCount = 0;
  timer = 0;
  hasStarted = false;
  isPaused = false;
  isFlagMode = false;
  inputMode = "mouse";
  lastFlagActionKey = "";
  lastFlagActionTime = 0;
  keyboardRow = 0;
  keyboardCol = 0;
  syncDifficultyState();
  if (applyMobilePreset) {
    applyMobileTileGapPreset();
  }
  board = createBoardData();
  resetTileView();
  initializeBoardView({ deferFit });
  syncKeyboardSelection();
  setBoardInteractivity();
  pauseBtn.textContent = "Pause";
  updateFlagModeButton();

  stopTimer();
  timerEl.textContent = "0";
  setStatusMessage("Good luck!");
  updateMineCounter();
}

async function runAdvancedMobileDifficultyReset(sequenceId) {
  resetGame({ deferFit: true, applyMobilePreset: true });
  resetUserView();
  syncBoardZoomControls();
  if (sequenceId !== difficultyTransitionId) {
    return;
  }

  await waitForAnimationFrame();
  if (sequenceId !== difficultyTransitionId) {
    return;
  }

  fitBoardToViewport();
  await waitForAnimationFrame();
  if (sequenceId !== difficultyTransitionId) {
    return;
  }

  commitMobileBoardTransform();
  syncBoardZoomControls();
}

async function changeDifficulty(newDifficulty) {
  if (!difficultyConfig[newDifficulty] || newDifficulty === currentDifficulty) {
    return;
  }

  mobileZoom = 1;
  panX = 0;
  panY = 0;
  currentDifficulty = newDifficulty;
  const sequenceId = ++difficultyTransitionId;
  const shouldRunAdvancedMobileReset = isMobilePanZoomLayout() && newDifficulty !== "beginner";

  if (shouldRunAdvancedMobileReset) {
    await runAdvancedMobileDifficultyReset(sequenceId);
    return;
  }

  resetGame();
}

function getTileButtonFromEvent(event) {
  const target = event.target;
  if (target instanceof Element) {
    return target.closest(".tile");
  }

  if (target && target.parentElement) {
    return target.parentElement.closest(".tile");
  }

  return null;
}

function handleBoardPointerInput() {
  if (!isDesktopFinePointerLayout()) {
    return;
  }

  setInputMode("mouse");
}

boardEl.addEventListener("click", (event) => {
  if (Date.now() < suppressClickUntil) {
    event.preventDefault();
    return;
  }

  if (gameOver || isPaused) {
    return;
  }

  const tileBtn = getTileButtonFromEvent(event);
  if (!tileBtn) {
    return;
  }

  const row = Number(tileBtn.dataset.row);
  const col = Number(tileBtn.dataset.col);
  handleBoardPointerInput();

  // Shift+left click remains fallback; Flag Mode enables mobile-friendly flagging.
  if (event.shiftKey || isFlagMode) {
    handleTilePrimaryAction(row, col, true);
    return;
  }

  handleTilePrimaryAction(row, col, false);
});
boardEl.addEventListener("contextmenu", (event) => {
  event.preventDefault();

  if (gameOver || isPaused) {
    return;
  }

  const tileBtn = getTileButtonFromEvent(event);
  if (!tileBtn) {
    return;
  }

  const row = Number(tileBtn.dataset.row);
  const col = Number(tileBtn.dataset.col);
  handleBoardPointerInput();

  handleTileContextAction(row, col);
});
boardEl.addEventListener("touchstart", handleBoardTouchStart, { passive: true });
boardEl.addEventListener("touchmove", handleBoardTouchMove, { passive: true });
boardEl.addEventListener("touchend", handleBoardTouchEnd, { passive: true });
boardEl.addEventListener("touchcancel", handleBoardTouchEnd, { passive: true });
boardEl.addEventListener("pointerdown", handleBoardPointerInput);

pauseBtn.addEventListener("click", togglePause);
flagModeBtn.addEventListener("click", toggleFlagMode);
resetBtn.addEventListener("click", resetGame);
focusModeBtn.addEventListener("click", toggleFocusMode);
resetCompactBtn.addEventListener("click", resetGame);
zoomInBtn.addEventListener("click", () => {
  if (!isMobileBoardZoomEnabled()) {
    return;
  }
  setBoardZoom(mobileZoom + boardZoomStep);
});
zoomResetBtn.addEventListener("click", () => {
  if (!isMobileBoardZoomEnabled()) {
    return;
  }
  resetUserView();
});
zoomOutBtn.addEventListener("click", () => {
  if (!isMobileBoardZoomEnabled()) {
    return;
  }
  setBoardZoom(mobileZoom - boardZoomStep);
});
boardViewportEl.addEventListener("pointerdown", handleBoardViewportPointerDown);
boardViewportEl.addEventListener("pointermove", handleBoardViewportPointerMove);
boardViewportEl.addEventListener("pointerup", handleBoardViewportPointerEnd);
boardViewportEl.addEventListener("pointercancel", handleBoardViewportPointerEnd);
difficultySelectEl.addEventListener("change", (event) => {
  changeDifficulty(event.target.value);
});
pzStageEl.addEventListener("pointerdown", handleStagePointerDown);
pzStageEl.addEventListener("pointermove", handleStagePointerMove);
pzStageEl.addEventListener("pointerup", handleStagePointerUpOrCancel);
pzStageEl.addEventListener("pointercancel", handleStagePointerUpOrCancel);
const handleMobileFitMediaChange = () => {
  syncFocusModeUI();
  refreshSelectedTileState();
  scheduleBoardFit();
};

if (typeof mobileFitMediaQuery.addEventListener === "function") {
  mobileFitMediaQuery.addEventListener("change", handleMobileFitMediaChange);
} else if (typeof mobileFitMediaQuery.addListener === "function") {
  mobileFitMediaQuery.addListener(handleMobileFitMediaChange);
}
if (typeof mobilePanZoomMediaQuery.addEventListener === "function") {
  mobilePanZoomMediaQuery.addEventListener("change", handleMobileFitMediaChange);
} else if (typeof mobilePanZoomMediaQuery.addListener === "function") {
  mobilePanZoomMediaQuery.addListener(handleMobileFitMediaChange);
}
window.addEventListener("resize", () => {
  syncFocusModeUI();
  refreshSelectedTileState();
  scheduleBoardFit();
});
window.addEventListener("orientationchange", () => {
  syncFocusModeUI();
  refreshSelectedTileState();
  scheduleBoardFit();
});
window.addEventListener("keydown", handleGlobalKeydown);

syncFocusModeUI();
resetGame();
