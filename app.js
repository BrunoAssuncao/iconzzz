const CUSTOM_COLORS_KEY = "pixel-ico-custom-colors-v1";

const canvas16 = document.getElementById("canvas16");
const canvas32 = document.getElementById("canvas32");
const stage16 = document.getElementById("stage16");
const stage32 = document.getElementById("stage32");
const preview16 = document.getElementById("preview16");
const preview32 = document.getElementById("preview32");

const ctx16 = canvas16.getContext("2d", { willReadFrequently: true });
const ctx32 = canvas32.getContext("2d", { willReadFrequently: true });
const pctx16 = preview16.getContext("2d", { alpha: true });
const pctx32 = preview32.getContext("2d", { alpha: true });

const paletteEl = document.getElementById("palette");
const customPaletteEl = document.getElementById("customPalette");
const customColorInput = document.getElementById("customColorInput");
const saveCustomColorBtn = document.getElementById("saveCustomColorBtn");
const customSlotSelect = document.getElementById("customSlotSelect");
const toolButtons = document.getElementById("toolButtons");
const gridToggle = document.getElementById("gridToggle");
const importIcoInput = document.getElementById("importIcoInput");

const state = {
  selectedColor: "#000000",
  drawing: false,
  tool: "pen",
  customColors: loadCustomColors(),
};

const classicPalette = generateClassic256();

initialize();

function initialize() {
  for (let i = 0; i < 10; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = `Slot ${i + 1}`;
    customSlotSelect.append(option);
  }

  clearCanvas(ctx16, 16);
  clearCanvas(ctx32, 32);

  renderClassicPalette();
  renderCustomPalette();
  bindToolButtons();
  bindEditor(canvas16, ctx16, 16);
  bindEditor(canvas32, ctx32, 32);

  enforceEditorCanvasDisplaySize();
  syncEditorCanvasBackgroundScale();

  window.addEventListener("resize", syncEditorCanvasBackgroundScale);

  window.addEventListener("mouseup", () => {
    state.drawing = false;
  });
  window.addEventListener("blur", () => {
    state.drawing = false;
  });

  gridToggle.addEventListener("change", () => {
    document.body.classList.toggle("grid-off", !gridToggle.checked);
  });

  document.getElementById("clear16").addEventListener("click", () => {
    clearCanvas(ctx16, 16);
    updatePreview();
  });

  document.getElementById("clear32").addEventListener("click", () => {
    clearCanvas(ctx32, 32);
    updatePreview();
  });

  document.getElementById("clearAll").addEventListener("click", () => {
    clearCanvas(ctx16, 16);
    clearCanvas(ctx32, 32);
    updatePreview();
  });

  saveCustomColorBtn.addEventListener("click", () => {
    const slot = Number(customSlotSelect.value);
    state.customColors[slot] = normalizeHexColor(customColorInput.value);
    persistCustomColors();
    renderCustomPalette();
  });

  document.getElementById("exportIcoBtn").addEventListener("click", exportIco);
  document.getElementById("importIcoBtn").addEventListener("click", () => importIcoInput.click());
  importIcoInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      await importIco(file);
      updatePreview();
    } catch (error) {
      alert(`ICO import failed: ${error.message}`);
    } finally {
      importIcoInput.value = "";
    }
  });

  document.getElementById("downloadPng16Btn").addEventListener("click", () => downloadCanvasPng(canvas16, "icon-16.png"));
  document.getElementById("downloadPng32Btn").addEventListener("click", () => downloadCanvasPng(canvas32, "icon-32.png"));

  updatePreview();
}

function enforceEditorCanvasDisplaySize() {
  stage16.style.width = "256px";
  stage16.style.height = "256px";
  stage32.style.width = "512px";
  stage32.style.height = "512px";
}

function syncEditorCanvasBackgroundScale() {
  syncCanvasBackgroundScale(stage16, 16);
  syncCanvasBackgroundScale(stage32, 32);
}

function syncCanvasBackgroundScale(stage, size) {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (!width || !height) return;

  const pixelSize = Math.floor(width / size);
  const checkerSize = 12;

  stage.style.setProperty("--pixel-size", `${pixelSize}px`);
  stage.style.setProperty("--checker-size", `${checkerSize}px`);
}

function bindToolButtons() {
  toolButtons.querySelectorAll(".tool-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.tool = button.dataset.tool;
      toolButtons.querySelectorAll(".tool-btn").forEach((node) => node.classList.remove("selected"));
      button.classList.add("selected");
    });
  });
}

function bindEditor(canvas, ctx, size) {
  const applyTool = (event, isStart = false) => {
    const { x, y } = getPixelCoordinates(canvas, event, size);
    if (x < 0 || y < 0 || x >= size || y >= size) return;

    if (state.tool === "bucket") {
      if (isStart) {
        floodFill(ctx, size, x, y, state.selectedColor);
        updatePreview();
      }
      return;
    }

    if (!state.drawing && !isStart) return;

    if (state.tool === "eraser") {
      ctx.clearRect(x, y, 1, 1);
    } else {
      ctx.fillStyle = state.selectedColor;
      ctx.fillRect(x, y, 1, 1);
    }
    updatePreview();
  };

  canvas.addEventListener("mousedown", (event) => {
    if (state.tool !== "bucket") {
      state.drawing = true;
    }
    applyTool(event, true);
  });

  canvas.addEventListener("mousemove", (event) => applyTool(event));
  canvas.addEventListener("mouseup", () => {
    state.drawing = false;
  });
  canvas.addEventListener("mouseleave", () => {
    state.drawing = false;
  });
}

function getPixelCoordinates(canvas, event, size) {
  const rect = canvas.getBoundingClientRect();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) {
    return { x: -1, y: -1 };
  }

  const pointerX = event.clientX - rect.left - canvas.clientLeft;
  const pointerY = event.clientY - rect.top - canvas.clientTop;
  const x = Math.floor((pointerX / width) * size);
  const y = Math.floor((pointerY / height) * size);
  return { x, y };
}

function floodFill(ctx, size, startX, startY, fillColor) {
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  const target = getPixel(data, size, startX, startY);
  const replacement = hexToRgba(fillColor);

  if (rgbaEqual(target, replacement)) return;

  const stack = [[startX, startY]];

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= size || y >= size) continue;

    const current = getPixel(data, size, x, y);
    if (!rgbaEqual(current, target)) continue;

    setPixel(data, size, x, y, replacement);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  ctx.putImageData(image, 0, 0);
}

function getPixel(data, size, x, y) {
  const index = (y * size + x) * 4;
  return [data[index], data[index + 1], data[index + 2], data[index + 3]];
}

function setPixel(data, size, x, y, rgba) {
  const index = (y * size + x) * 4;
  data[index] = rgba[0];
  data[index + 1] = rgba[1];
  data[index + 2] = rgba[2];
  data[index + 3] = rgba[3];
}

function hexToRgba(hex) {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b, 255];
}

function rgbaEqual(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function clearCanvas(ctx, size) {
  ctx.clearRect(0, 0, size, size);
}

function updatePreview() {
  pctx16.clearRect(0, 0, 16, 16);
  pctx32.clearRect(0, 0, 32, 32);
  pctx16.drawImage(canvas16, 0, 0);
  pctx32.drawImage(canvas32, 0, 0);
}

function renderClassicPalette() {
  paletteEl.innerHTML = "";
  classicPalette.forEach((color, index) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "palette-swatch";
    if (index === 0) swatch.classList.add("selected");
    swatch.style.background = color;
    swatch.title = color;
    swatch.addEventListener("click", () => selectColor(color, swatch, ".palette-swatch, .custom-swatch"));
    paletteEl.append(swatch);
  });
}

function renderCustomPalette() {
  customPaletteEl.innerHTML = "";
  state.customColors.forEach((color, index) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "custom-swatch";
    swatch.style.background = color;
    swatch.title = `Custom ${index + 1}: ${color}`;
    swatch.addEventListener("click", () => selectColor(color, swatch, ".palette-swatch, .custom-swatch"));
    customPaletteEl.append(swatch);
  });
}

function selectColor(color, swatch, clearSelector) {
  state.selectedColor = color;
  document.querySelectorAll(clearSelector).forEach((node) => node.classList.remove("selected"));
  swatch.classList.add("selected");
}

function generateClassic256() {
  const levels = [0, 51, 102, 153, 204, 255];
  const webSafe216 = [];

  levels.forEach((r) => {
    levels.forEach((g) => {
      levels.forEach((b) => {
        webSafe216.push(rgbToHex(r, g, b));
      });
    });
  });

  const grays = [];
  for (let i = 0; i < 40; i += 1) {
    const value = Math.round((255 * i) / 39);
    grays.push(rgbToHex(value, value, value));
  }

  return [...webSafe216, ...grays];
}

function rgbToHex(r, g, b) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(v) {
  return v.toString(16).padStart(2, "0");
}

function loadCustomColors() {
  const fallback = [
    "#000000",
    "#ffffff",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#ff00ff",
    "#00ffff",
    "#804000",
    "#808080",
  ];

  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY));
    if (Array.isArray(saved) && saved.length === 10) {
      return saved.map((color, index) => normalizeHexColor(color) || fallback[index]);
    }
  } catch {
    // ignore parsing errors and fallback to defaults
  }
  return fallback;
}

function normalizeHexColor(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().toLowerCase().match(/^#([0-9a-f]{6})$/);
  return match ? `#${match[1]}` : null;
}

function persistCustomColors() {
  localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(state.customColors));
}

function downloadCanvasPng(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(blob, filename);
  }, "image/png");
}

async function exportIco() {
  const png16 = await canvasToPngBytes(canvas16);
  const png32 = await canvasToPngBytes(canvas32);
  const icoBytes = createIco([png16, png32], [16, 32]);
  downloadBlob(new Blob([icoBytes], { type: "image/x-icon" }), "icon.ico");
}

function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Failed to encode PNG."));
        return;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      resolve(bytes);
    }, "image/png");
  });
}

function createIco(images, sizes) {
  const count = images.length;
  const headerSize = 6 + 16 * count;
  const totalSize = headerSize + images.reduce((sum, img) => sum + img.length, 0);
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, count, true);

  let offset = headerSize;
  images.forEach((img, i) => {
    const entry = 6 + i * 16;
    const size = sizes[i];
    out[entry] = size === 256 ? 0 : size;
    out[entry + 1] = size === 256 ? 0 : size;
    out[entry + 2] = 0;
    out[entry + 3] = 0;
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, img.length, true);
    view.setUint32(entry + 12, offset, true);
    out.set(img, offset);
    offset += img.length;
  });

  return out;
}

async function importIco(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) {
    throw new Error("Not a valid ICO file.");
  }

  const count = view.getUint16(4, true);
  const frames = [];

  for (let i = 0; i < count; i += 1) {
    const entry = 6 + i * 16;
    const width = view.getUint8(entry) || 256;
    const height = view.getUint8(entry + 1) || 256;
    const bytesInRes = view.getUint32(entry + 8, true);
    const imageOffset = view.getUint32(entry + 12, true);
    const bytes = new Uint8Array(buffer, imageOffset, bytesInRes);
    frames.push({ width, height, bytes });
  }

  const frame16 = frames.find((f) => f.width === 16 && f.height === 16);
  const frame32 = frames.find((f) => f.width === 32 && f.height === 32);

  if (!frame16 || !frame32) {
    throw new Error("ICO must include both 16x16 and 32x32 images.");
  }

  await drawFrameOnCanvas(frame16, ctx16, 16);
  await drawFrameOnCanvas(frame32, ctx32, 32);
}

async function drawFrameOnCanvas(frame, ctx, size) {
  if (!isPng(frame.bytes)) {
    throw new Error("Only ICO entries stored as PNG are currently supported.");
  }

  const blob = new Blob([frame.bytes], { type: "image/png" });
  const bitmap = await createImageBitmap(blob);
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(bitmap, 0, 0, size, size);
}

function isPng(bytes) {
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
