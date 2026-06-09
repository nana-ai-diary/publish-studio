const CANVAS_WIDTH = 864;
const CANVAS_HEIGHT = 1152;
const PAD_X = 46;
const STORE_KEY = "fawenStudio.docs.v1";
const ACTIVE_KEY = "fawenStudio.activeDoc.v1";

const $ = (selector) => document.querySelector(selector);

const els = {
  docList: $("#docList"),
  docCount: $("#docCount"),
  newDoc: $("#newDocBtn"),
  duplicateDoc: $("#duplicateDocBtn"),
  exportDocs: $("#exportDocsBtn"),
  importDocs: $("#importDocsInput"),
  deleteDoc: $("#deleteDocBtn"),
  title: $("#titleInput"),
  author: $("#authorInput"),
  handle: $("#handleInput"),
  avatarInput: $("#avatarInput"),
  avatarPreview: $("#avatarPreview"),
  imageInput: $("#imageInput"),
  galleryLayout: $("#galleryLayoutInput"),
  imageStrip: $("#imageStrip"),
  textColor: $("#textColorInput"),
  accentColor: $("#accentColorInput"),
  highlightColor: $("#highlightColorInput"),
  inlineColor: $("#inlineColorInput"),
  fontSize: $("#fontSizeInput"),
  lineHeight: $("#lineHeightInput"),
  content: $("#contentInput"),
  pages: $("#pages"),
  status: $("#statusText"),
  copyRich: $("#copyRichBtn"),
  downloadLong: $("#downloadLongBtn"),
  downloadAll: $("#downloadAllBtn"),
  findInput: $("#findInput"),
  replaceInput: $("#replaceInput"),
  findPrev: $("#findPrevBtn"),
  findNext: $("#findNextBtn"),
  replaceCurrent: $("#replaceCurrentBtn"),
  replaceAll: $("#replaceAllBtn"),
  replaceToggle: $("#replaceToggleBtn"),
  replacePanel: $("#replacePanel"),
  findStatus: $("#findStatus"),
  cropModal: $("#cropModal"),
  cropCanvas: $("#cropCanvas"),
  cropClose: $("#cropCloseBtn"),
  cropApply: $("#cropApplyBtn"),
  cropReset: $("#cropResetBtn"),
  cropTitle: $("#cropTitle"),
  ratioButtons: document.querySelectorAll("[data-ratio]"),
};

const sampleAvatar = "./assets/nana-avatar.jpg";
const defaultAuthor = "娜娜酱AI日记";
const defaultHandle = "@nana_ai_diary";

let docs = loadDocs();
let activeId = localStorage.getItem(ACTIVE_KEY) || docs[0]?.id;
let canvases = [];
let renderTimer = null;
let storageLimited = false;
let historyTimer = null;
let historyRestoring = false;
const undoStack = [];
let textSelection = { start: 0, end: 0 };

const cropper = {
  id: null,
  image: null,
  rect: null,
  display: null,
  aspect: "original",
  dragging: false,
  dragMode: null,
  dragHandle: null,
  dragOffset: { x: 0, y: 0 },
  dragStartPoint: null,
  dragStartRect: null,
};

const layoutConfigs = {
  auto: { layout: 1, variant: "single" },
  "two-cols": { layout: 2, variant: "two-cols" },
  "two-rows": { layout: 2, variant: "two-rows" },
  "three-left": { layout: 3, variant: "three-left" },
  "three-right": { layout: 3, variant: "three-right" },
  "three-cols": { layout: 3, variant: "three-cols" },
  "four-grid": { layout: 4, variant: "four-grid" },
};

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultGuideContent() {
  return `:::title
欢迎来到娜娜酱AI日记
:::

你好呀，我是娜娜酱。这里是一个给公众号、小红书图文和长文发稿用的 Markdown 工作台：先写内容，再排版成图片或复制为公众号富文本。

:::title
最常用的流程
:::

1. 在左侧新建或切换文档，所有内容都会自动保存在本地。
2. 在正文区写 Markdown，也可以用上方按钮快速插入标题、加粗、斜体、颜色、高亮、引用、代码块和对齐段落。
3. 在版式下拉里选择图片排版，再点击「图」上传图片。
4. 需要调整图片时，在素材区点「裁剪」，可以选择原比例、1:1、3:4、4:3、16:9。
5. 内容比较长时，可以用正文上方的查找替换栏快速定位和批量替换。
6. 需要强制换到下一张图时，点工具栏里的「分页」按钮，会插入 :::pagebreak。
7. 需要备份时，左侧点「导出备份」；换电脑或换浏览器时，点「导入」恢复。
8. 发公众号时点「复制富文本」；发小红书时点「下载长图」或「批量下载」。

## 文字示例

这是普通正文。你可以写 **重点加粗**，也可以写 *轻轻强调的斜体*。

选中文字后点高亮按钮，会得到 ==这样的高亮效果==。点文字选色按钮，会得到 {color:#e11d48|这样的自由文字颜色}。

> 引用适合放观点、金句、提醒，排版时会自动带强调色。

:::align center
这一行是居中示例
:::

:::align right
这一行是右对齐示例
:::

## 图片排版怎么选

单图模式会按图片原比例缩放。

双图左右默认是 1:1；双图上下默认是 16:9。

三图左1右2、三图右1左2里，小图默认是 1:1。三图并列和四图环绕也默认是 1:1。

上传后素材会保存在素材区。即使你删掉正文里的图片标记，也可以点素材上的「插入」重新放回来。

## 代码块示例

\`\`\`js
const title = "娜娜酱AI日记";
console.log(\`开始排版：\${title}\`);
\`\`\`

## 小提示

如果对齐方式改错了，选中那一段再点新的对齐按钮即可，它会替换原来的对齐标记。

如果图片裁剪不满意，点素材上的「原图」可以恢复。`;
}

function defaultDoc() {
  return {
    id: uid("doc"),
    title: "使用指南",
    updatedAt: Date.now(),
    author: defaultAuthor,
    handle: defaultHandle,
    avatar: sampleAvatar,
    settings: {
      textColor: "#202938",
      bgColor: "#ffffff",
      accentColor: "#2563eb",
      highlightColor: "#fff2a8",
      inlineColor: "#e11d48",
      fontSize: 31,
      lineHeight: 1.6,
    },
    images: {},
    content: defaultGuideContent(),
  };
}

function loadDocs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    if (Array.isArray(parsed) && parsed.length) return migrateSeedDocs(parsed);
  } catch {
    // fall through to seed document
  }
  const doc = defaultDoc();
  localStorage.setItem(STORE_KEY, JSON.stringify([doc]));
  localStorage.setItem(ACTIVE_KEY, doc.id);
  return [doc];
}

function migrateSeedDocs(parsed) {
  let changed = false;
  const docs = parsed.map((doc) => {
    const looksLikeOldSeed =
      (doc.author === "捏捏番茄" || doc.handle === "@heytomato") &&
      (doc.title === "第一篇图文" || String(doc.content || "").includes("一个可以保存历史的发文工具"));
    const looksLikePreviousGuide =
      doc.author === defaultAuthor &&
      doc.title === "使用指南" &&
        (String(doc.content || "").startsWith("# 欢迎来到娜娜酱AI日记") ||
        (String(doc.content || "").includes("最常用的流程") &&
          (!String(doc.content || "").includes("自由文字颜色") ||
            !String(doc.content || "").includes("查找替换栏") ||
            !String(doc.content || "").includes("导出备份") ||
            !String(doc.content || "").includes("pagebreak"))));

    if (!looksLikeOldSeed && !looksLikePreviousGuide) return doc;

    changed = true;
    return {
      ...defaultDoc(),
      id: doc.id,
      images: doc.images || {},
      updatedAt: Date.now(),
    };
  });

  if (changed) {
    localStorage.setItem(STORE_KEY, JSON.stringify(docs));
  }
  return docs;
}

function activeDoc() {
  return docs.find((doc) => doc.id === activeId) || docs[0];
}

function saveDocs() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(docs));
    localStorage.setItem(ACTIVE_KEY, activeId);
    storageLimited = false;
    return true;
  } catch {
    storageLimited = true;
    try {
      localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {
      // Active in memory is enough for the current editing session.
    }
    return false;
  }
}

function formatTime(ts) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function renderDocList() {
  els.docList.innerHTML = "";
  els.docCount.textContent = String(docs.length);

  [...docs]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((doc) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `doc-item${doc.id === activeId ? " active" : ""}`;
      button.dataset.id = doc.id;
      button.innerHTML = `<strong>${escapeHtml(doc.title || "未命名文档")}</strong><span>${formatTime(doc.updatedAt)} · ${countPagesHint(doc.content)} 段</span>`;
      button.addEventListener("click", () => switchDoc(doc.id));
      els.docList.append(button);
    });
}

function countPagesHint(content) {
  return (content || "").split(/\n\s*\n/).filter(Boolean).length;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeCodeHtml(text) {
  return escapeHtml(text)
    .replaceAll("\t", "&nbsp;&nbsp;&nbsp;&nbsp;")
    .replaceAll(" ", "&nbsp;")
    .replace(/\n/g, "<br>");
}

function loadDocToForm() {
  const doc = activeDoc();
  if (!doc) return;
  els.title.value = doc.title || "";
  els.author.value = doc.author || "";
  els.handle.value = doc.handle || "";
  els.avatarPreview.src = doc.avatar || sampleAvatar;
  els.textColor.value = doc.settings?.textColor || "#202938";
  els.accentColor.value = doc.settings?.accentColor || "#2563eb";
  els.highlightColor.value = doc.settings?.highlightColor || "#fff2a8";
  els.inlineColor.value = doc.settings?.inlineColor || "#e11d48";
  els.fontSize.value = doc.settings?.fontSize || 31;
  els.lineHeight.value = doc.settings?.lineHeight || 1.6;
  els.content.value = doc.content || "";
  updateImageStrip();
}

function syncFormToDoc(markUpdated = true) {
  const doc = activeDoc();
  if (!doc) return;
  doc.title = els.title.value.trim() || "未命名文档";
  doc.author = els.author.value.trim() || "未命名作者";
  doc.handle = normalizeHandle(els.handle.value);
  doc.settings = {
    textColor: els.textColor.value,
    bgColor: doc.settings?.bgColor || "#ffffff",
    accentColor: els.accentColor.value,
    highlightColor: els.highlightColor.value,
    inlineColor: els.inlineColor.value,
    fontSize: clamp(Number(els.fontSize.value) || 31, 24, 42),
    lineHeight: clamp(Number(els.lineHeight.value) || 1.6, 1.25, 2.4),
  };
  doc.content = els.content.value;
  if (markUpdated) doc.updatedAt = Date.now();
  saveDocs();
  renderDocList();
}

function normalizeHandle(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "@profile";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function snapshotDoc() {
  const doc = activeDoc();
  return doc ? JSON.stringify(doc) : "";
}

function pushHistoryNow() {
  if (historyRestoring) return;
  const snap = snapshotDoc();
  if (!snap) return;
  if (undoStack[undoStack.length - 1] === snap) return;
  undoStack.push(snap);
  if (undoStack.length > 60) undoStack.shift();
}

function scheduleHistory() {
  if (historyRestoring) return;
  clearTimeout(historyTimer);
  historyTimer = setTimeout(pushHistoryNow, 260);
}

function undoDoc() {
  pushHistoryNow();
  if (undoStack.length <= 1) {
    els.status.textContent = "没有可撤回的步骤";
    return;
  }
  undoStack.pop();
  const previous = JSON.parse(undoStack[undoStack.length - 1]);
  const index = docs.findIndex((doc) => doc.id === activeId);
  if (index === -1) return;
  historyRestoring = true;
  docs[index] = previous;
  saveDocs();
  loadDocToForm();
  renderDocList();
  historyRestoring = false;
  requestRender();
  els.status.textContent = "已撤回一步";
}

function switchDoc(id) {
  syncFormToDoc(false);
  activeId = id;
  saveDocs();
  loadDocToForm();
  renderDocList();
  undoStack.length = 0;
  pushHistoryNow();
  requestRender();
}

function createDoc() {
  syncFormToDoc(false);
  const doc = defaultDoc();
  doc.title = `新文档 ${docs.length + 1}`;
  docs.unshift(doc);
  activeId = doc.id;
  saveDocs();
  loadDocToForm();
  renderDocList();
  requestRender();
}

function duplicateDoc() {
  syncFormToDoc(false);
  const current = activeDoc();
  const copy = JSON.parse(JSON.stringify(current));
  copy.id = uid("doc");
  copy.title = `${current.title || "未命名文档"} 副本`;
  copy.updatedAt = Date.now();
  docs.unshift(copy);
  activeId = copy.id;
  saveDocs();
  loadDocToForm();
  renderDocList();
  requestRender();
}

function deleteDoc() {
  if (docs.length <= 1) {
    els.status.textContent = "至少保留一个文档";
    return;
  }
  const index = docs.findIndex((doc) => doc.id === activeId);
  docs = docs.filter((doc) => doc.id !== activeId);
  activeId = docs[Math.max(0, index - 1)]?.id || docs[0].id;
  saveDocs();
  loadDocToForm();
  renderDocList();
  requestRender();
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

function exportDocuments() {
  syncFormToDoc(false);
  const payload = {
    app: "fawen-studio",
    version: 1,
    exportedAt: new Date().toISOString(),
    activeId,
    docs,
  };
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  saveBlob(blob, `fawen-studio-backup-${stamp}.json`);
  els.status.textContent = `已导出 ${docs.length} 篇文档备份`;
}

function normalizeImportedDoc(raw, fallbackTitle = "导入文档") {
  const doc = {
    ...defaultDoc(),
    ...raw,
    id: raw.id || uid("doc"),
    title: raw.title || fallbackTitle,
    updatedAt: Date.now(),
    settings: {
      ...defaultDoc().settings,
      ...(raw.settings || {}),
    },
    images: raw.images && typeof raw.images === "object" ? raw.images : {},
    content: String(raw.content || ""),
  };
  if (!doc.content.trim()) doc.content = defaultGuideContent();
  if (!doc.author) doc.author = defaultAuthor;
  if (!doc.handle) doc.handle = defaultHandle;
  if (!doc.avatar) doc.avatar = sampleAvatar;
  return doc;
}

function uniqueImportedDoc(doc) {
  const existingIds = new Set(docs.map((item) => item.id));
  if (!existingIds.has(doc.id)) return doc;
  return {
    ...doc,
    id: uid("doc"),
    title: `${doc.title} 导入`,
  };
}

function titleFromMarkdown(text, filename) {
  const heading = text.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim().slice(0, 40) || "导入文档";
  return (filename || "导入文档").replace(/\.(md|txt)$/i, "").slice(0, 40) || "导入文档";
}

async function importDocuments(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await readFileAsText(file);
    let imported = [];
    let importedActiveId = null;
    if (/\.json$/i.test(file.name)) {
      const data = JSON.parse(text);
      const rawDocs = Array.isArray(data) ? data : Array.isArray(data.docs) ? data.docs : [];
      importedActiveId = data.activeId || rawDocs[0]?.id || null;
      imported = rawDocs.map((doc) => normalizeImportedDoc(doc, doc.title || file.name));
    } else {
      imported = [
        normalizeImportedDoc(
          {
            title: titleFromMarkdown(text, file.name),
            content: text,
          },
          titleFromMarkdown(text, file.name),
        ),
      ];
    }

    imported = imported.filter((doc) => doc.content || doc.title).map(uniqueImportedDoc);
    if (!imported.length) {
      els.status.textContent = "没有找到可导入的文档";
      return;
    }

    docs = [...imported, ...docs];
    const activeImported = imported.find((doc) => doc.id === importedActiveId) || imported[0];
    activeId = activeImported.id;
    saveDocs();
    loadDocToForm();
    renderDocList();
    undoStack.length = 0;
    pushHistoryNow();
    requestRender();
    els.status.textContent = `已导入 ${imported.length} 篇文档`;
  } catch (error) {
    els.status.textContent = `导入失败：${error.message || "文件格式不正确"}`;
  } finally {
    event.target.value = "";
  }
}

function requestRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 120);
}

function rememberContentSelection() {
  if (!els.content) return;
  textSelection = {
    start: els.content.selectionStart ?? textSelection.start,
    end: els.content.selectionEnd ?? textSelection.end,
  };
}

function currentContentSelection() {
  if (document.activeElement === els.content) rememberContentSelection();
  const length = els.content.value.length;
  const start = clamp(textSelection.start, 0, length);
  const end = clamp(textSelection.end, 0, length);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function replaceContentRange(start, end, text, nextStart = start + text.length, nextEnd = nextStart) {
  els.content.value = `${els.content.value.slice(0, start)}${text}${els.content.value.slice(end)}`;
  els.content.focus();
  els.content.setSelectionRange(nextStart, nextEnd);
  rememberContentSelection();
  syncFormToDoc();
  scheduleHistory();
  requestRender();
}

function insertAtCursor(text) {
  const { start, end } = currentContentSelection();
  const next = start + text.length;
  replaceContentRange(start, end, text, next, next);
}

function wrapSelection(kind) {
  if (kind === "alignLeft" || kind === "alignCenter" || kind === "alignRight") {
    formatAlignedSelection(kind.replace("align", "").toLowerCase());
    return;
  }

  const { start, end } = currentContentSelection();
  const selected = els.content.value.slice(start, end) || "文字";
  let next = selected;

  if (kind === "bold") next = `**${selected}**`;
  if (kind === "italic") next = `*${selected}*`;
  if (kind === "highlight") next = `==${selected}==`;
  if (kind === "inlineColor") next = `{color:${els.inlineColor.value}|${selected}}`;
  if (kind === "code") next = `\`\`\`\n${selected}\n\`\`\``;
  if (kind === "titleBlock") next = `:::title\n${selected}\n:::`;
  if (kind === "pageBreak") next = `\n:::pagebreak\n`;
  if (kind === "h1" || kind === "h2" || kind === "quote") {
    const prefix = kind === "h1" ? "# " : kind === "h2" ? "## " : "> ";
    const lineStart = els.content.value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    replaceContentRange(lineStart, lineStart, prefix, start + prefix.length, end + prefix.length);
    return;
  }

  replaceContentRange(start, end, next);
}

function formatAlignedSelection(align) {
  const content = els.content.value;
  const { start, end } = currentContentSelection();
  const selected = content.slice(start, end);
  const exact = selected.match(/^:::align\s+(left|center|right)\n([\s\S]*?)\n:::$/);

  if (exact) {
    const next = `:::align ${align}\n${exact[2]}\n:::`;
    replaceContentRange(start, end, next, start, start + next.length);
    return;
  }

  const blockPattern = /:::align\s+(left|center|right)\n([\s\S]*?)\n:::/g;
  for (const match of content.matchAll(blockPattern)) {
    const blockStart = match.index;
    const blockEnd = blockStart + match[0].length;
    if (start >= blockStart && end <= blockEnd) {
      const next = `:::align ${align}\n${match[2]}\n:::`;
      replaceContentRange(blockStart, blockEnd, next, blockStart, blockStart + next.length);
      return;
    }
  }

  const cleanSelected = (selected || "文字").replace(/:::align\s+(left|center|right)\n([\s\S]*?)\n:::/g, "$2");
  const next = `:::align ${align}\n${cleanSelected}\n:::`;
  replaceContentRange(start, end, next, start, start + next.length);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(query = els.findInput?.value || "") {
  const needle = query.trim();
  if (!needle) return [];
  const haystack = els.content.value;
  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const matches = [];
  let index = lowerHaystack.indexOf(lowerNeedle);
  while (index !== -1) {
    matches.push({ start: index, end: index + needle.length });
    index = lowerHaystack.indexOf(lowerNeedle, index + Math.max(1, needle.length));
  }
  return matches;
}

function selectedFindIndex(matches) {
  const { start, end } = currentContentSelection();
  return matches.findIndex((match) => match.start === start && match.end === end);
}

function updateFindStatus() {
  if (!els.findStatus) return;
  const matches = findMatches();
  if (!els.findInput.value.trim()) {
    els.findStatus.textContent = "0/0";
    return;
  }
  const index = selectedFindIndex(matches);
  els.findStatus.textContent = matches.length ? `${index >= 0 ? index + 1 : 0}/${matches.length}` : "0/0";
}

function selectFindMatch(match) {
  els.content.focus();
  els.content.setSelectionRange(match.start, match.end);
  rememberContentSelection();
  updateFindStatus();
}

function findInContent(direction = 1) {
  const matches = findMatches();
  if (!matches.length) {
    updateFindStatus();
    return;
  }
  const { start, end } = currentContentSelection();
  let next = matches[0];
  if (direction > 0) {
    next = matches.find((match) => match.start >= end) || matches[0];
  } else {
    next = [...matches].reverse().find((match) => match.end <= start) || matches[matches.length - 1];
  }
  selectFindMatch(next);
}

function replaceCurrentMatch() {
  const query = els.findInput.value;
  const replacement = els.replaceInput.value;
  const matches = findMatches(query);
  if (!matches.length) {
    updateFindStatus();
    return;
  }
  let index = selectedFindIndex(matches);
  if (index < 0) {
    findInContent(1);
    index = selectedFindIndex(findMatches(query));
    if (index < 0) return;
  }
  const match = findMatches(query)[index];
  replaceContentRange(match.start, match.end, replacement, match.start, match.start + replacement.length);
  updateFindStatus();
}

function replaceAllMatches() {
  const query = els.findInput.value.trim();
  if (!query) return;
  const replacement = els.replaceInput.value;
  const pattern = new RegExp(escapeRegExp(query), "gi");
  const next = els.content.value.replace(pattern, replacement);
  if (next === els.content.value) {
    updateFindStatus();
    return;
  }
  replaceContentRange(0, els.content.value.length, next, 0, 0);
  updateFindStatus();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readOptimizedImage(file) {
  const raw = await readFileAsDataUrl(file);
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") return raw;

  const img = await loadImage(raw).catch(() => null);
  if (!img) return raw;

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

async function handleAvatar(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const doc = activeDoc();
  doc.avatar = await readOptimizedImage(file);
  els.avatarPreview.src = doc.avatar;
  event.target.value = "";
  syncFormToDoc();
  requestRender();
}

async function handleImages(event) {
  const files = [...(event.target.files || [])];
  if (!files.length) return;
  const doc = activeDoc();
  const ids = [];

  for (const file of files.slice(0, 4)) {
    const id = uid("img");
    doc.images[id] = {
      id,
      name: file.name,
      src: await readOptimizedImage(file),
      crop: null,
    };
    ids.push(id);
  }

  const { layout, variant } = selectedLayoutConfig();
  const inserted = layout > 1 ? appendToPendingGallery(ids, layout, variant) : false;
  if (!inserted) {
    const markers = layout === 1 ? ids.map((id) => `[[image:${id}]]`) : [galleryMarker(ids.slice(0, layout), layout, variant)];
    insertAtCursor(`\n${markers.join("\n")}\n`);
  } else {
    syncFormToDoc();
    scheduleHistory();
    requestRender();
  }
  event.target.value = "";
  updateImageStrip();
}

function updateImageStrip() {
  const doc = activeDoc();
  if (!doc || !els.imageStrip) return;
  const images = Object.values(doc.images || {});
  els.imageStrip.innerHTML = "";
  if (!images.length) return;

  const clearButton = document.createElement("button");
  clearButton.className = "image-clear-button";
  clearButton.type = "button";
  clearButton.textContent = "清空素材";
  clearButton.addEventListener("click", clearImages);
  els.imageStrip.append(clearButton);

  images.forEach((image) => {
    const chip = document.createElement("div");
    chip.className = "image-chip";
    chip.innerHTML = `
      <button class="image-chip-remove" type="button" data-remove-image="${image.id}" title="删除素材">×</button>
      <img src="${image.src}" alt="${escapeHtml(image.name || "图片")}" />
      <div class="image-chip-main">
        <strong>${escapeHtml(image.name || image.id)}</strong>
        <div class="image-chip-actions">
          <button type="button" data-insert-image="${image.id}">插入</button>
          <button type="button" data-crop="${image.id}">裁剪</button>
          <button type="button" data-reset-crop="${image.id}">原图</button>
        </div>
      </div>
    `;
    chip.querySelector("[data-insert-image]")?.addEventListener("click", () => insertExistingImage(image.id));
    chip.querySelector("[data-crop]")?.addEventListener("click", () => openCropper(image.id));
    chip.querySelector("[data-remove-image]")?.addEventListener("click", () => removeImage(image.id));
    chip.querySelector("[data-reset-crop]")?.addEventListener("click", () => {
      image.crop = null;
      scheduleHistory();
      syncFormToDoc();
      updateImageStrip();
      requestRender();
    });
    els.imageStrip.append(chip);
  });
}

function insertExistingImage(id) {
  const doc = activeDoc();
  if (!doc?.images?.[id]) return;
  const { layout, variant } = selectedLayoutConfig();
  const inserted = layout > 1 ? appendToPendingGallery([id], layout, variant) : false;
  if (!inserted) {
    const marker = layout === 1 ? `[[image:${id}]]` : galleryMarker([id], layout, variant);
    insertAtCursor(`\n${marker}\n`);
  }
}

function removeImage(id) {
  const doc = activeDoc();
  if (!doc?.images?.[id]) return;
  delete doc.images[id];
  els.content.value = removeImageReferences(els.content.value, id);
  syncFormToDoc();
  scheduleHistory();
  updateImageStrip();
  requestRender();
}

function clearImages() {
  const doc = activeDoc();
  if (!doc) return;
  doc.images = {};
  els.content.value = removeAllImageReferences(els.content.value);
  syncFormToDoc();
  scheduleHistory();
  updateImageStrip();
  requestRender();
}

function removeImageReferences(content, removeId) {
  return normalizeMarkers(content)
    .replace(new RegExp(`^\\[\\[image:${removeId}\\]\\]\\s*\\n?`, "gm"), "")
    .replace(/\[\[gallery:([\w,-]+)\|([1-4])(?:\|([\w-]+))?(?:\|(left|center|right))?\]\]\s*/g, (marker, rawIds, rawLayout, rawVariant) => {
      const ids = rawIds.split(",").filter((id) => id && id !== removeId);
      if (!ids.length) return "";
      if (ids.length === 1) return `[[image:${ids[0]}]]\n`;
      const layout = clamp(Math.min(Number(rawLayout), ids.length), 2, 4);
      const variant = rawVariant || defaultGalleryVariant(layout);
      return `${galleryMarker(ids.slice(0, layout), layout, variant)}\n`;
    })
    .replace(/\n{3,}/g, "\n\n");
}

function removeAllImageReferences(content) {
  return normalizeMarkers(content)
    .replace(/^\[\[image:[\w-]+\]\]\s*$/gm, "")
    .replace(/^\[\[gallery:[\w,-]+\|[1-4](?:\|[\w-]+)?(?:\|(left|center|right))?\]\]\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

async function openCropper(id) {
  const doc = activeDoc();
  const imageData = doc?.images?.[id];
  if (!imageData) return;
  const img = await loadImage(imageData.src).catch(() => null);
  if (!img) return;
  cropper.id = id;
  cropper.image = img;
  cropper.aspect = "original";
  cropper.rect = imageData.crop ? { ...imageData.crop } : { x: 0, y: 0, width: 1, height: 1 };
  els.cropTitle.textContent = `裁剪 ${imageData.name || id}`;
  els.cropModal.classList.remove("hidden");
  setActiveRatio("original");
  drawCropper();
}

function closeCropper() {
  els.cropModal.classList.add("hidden");
  cropper.id = null;
  cropper.image = null;
  cropper.rect = null;
  cropper.dragging = false;
  cropper.dragMode = null;
  cropper.dragHandle = null;
  cropper.dragStartPoint = null;
  cropper.dragStartRect = null;
}

function cropDisplayRect() {
  const canvas = els.cropCanvas;
  const img = cropper.image;
  const ratio = Math.min(canvas.width / img.width, canvas.height / img.height);
  const width = img.width * ratio;
  const height = img.height * ratio;
  return {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height,
    ratio,
  };
}

function sourceRectToCanvas(rect, display) {
  return {
    x: display.x + rect.x * cropper.image.width * display.ratio,
    y: display.y + rect.y * cropper.image.height * display.ratio,
    width: rect.width * cropper.image.width * display.ratio,
    height: rect.height * cropper.image.height * display.ratio,
  };
}

function canvasRectToSource(rect, display) {
  return normalizeCropRect({
    x: (rect.x - display.x) / (cropper.image.width * display.ratio),
    y: (rect.y - display.y) / (cropper.image.height * display.ratio),
    width: rect.width / (cropper.image.width * display.ratio),
    height: rect.height / (cropper.image.height * display.ratio),
  });
}

function normalizeCropRect(rect) {
  const width = clamp(rect.width, 0.05, 1);
  const height = clamp(rect.height, 0.05, 1);
  const x = clamp(rect.x, 0, 1 - width);
  const y = clamp(rect.y, 0, 1 - height);
  return { x, y, width, height };
}

function drawCropper() {
  if (!cropper.image || !cropper.rect) return;
  const canvas = els.cropCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const display = cropDisplayRect();
  cropper.display = display;
  ctx.drawImage(cropper.image, display.x, display.y, display.width, display.height);

  const rect = sourceRectToCanvas(cropper.rect, display);
  ctx.fillStyle = "rgba(15, 23, 42, .52)";
  ctx.fillRect(display.x, display.y, display.width, rect.y - display.y);
  ctx.fillRect(display.x, rect.y + rect.height, display.width, display.y + display.height - rect.y - rect.height);
  ctx.fillRect(display.x, rect.y, rect.x - display.x, rect.height);
  ctx.fillRect(rect.x + rect.width, rect.y, display.x + display.width - rect.x - rect.width, rect.height);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.fillStyle = "#ffffff";
  cropHandles(rect).forEach((handle) => {
    ctx.fillRect(handle.x - 6, handle.y - 6, 12, 12);
  });
}

function cropHandles(rect) {
  return [
    { key: "nw", x: rect.x, y: rect.y },
    { key: "ne", x: rect.x + rect.width, y: rect.y },
    { key: "sw", x: rect.x, y: rect.y + rect.height },
    { key: "se", x: rect.x + rect.width, y: rect.y + rect.height },
  ];
}

function detectCropHandle(point, rect) {
  const hitSize = 18;
  return cropHandles(rect).find((handle) => Math.abs(point.x - handle.x) <= hitSize && Math.abs(point.y - handle.y) <= hitSize)?.key || null;
}

function setActiveRatio(value) {
  els.ratioButtons.forEach((button) => button.classList.toggle("active", button.dataset.ratio === value));
}

function setCropRatio(value) {
  if (!cropper.image || !cropper.rect) return;
  cropper.aspect = value;
  setActiveRatio(value);
  if (value === "original") {
    cropper.rect = { x: 0, y: 0, width: 1, height: 1 };
    drawCropper();
    return;
  }
  const aspect = Number(value);
  const current = cropper.rect;
  const sourceAspect = cropper.image.width / cropper.image.height;
  let width = current.width;
  let height = width * sourceAspect / aspect;
  if (height > current.height) {
    height = current.height;
    width = height * aspect / sourceAspect;
  }
  width = Math.min(width, 1);
  height = Math.min(height, 1);
  cropper.rect = normalizeCropRect({
    x: current.x + (current.width - width) / 2,
    y: current.y + (current.height - height) / 2,
    width,
    height,
  });
  drawCropper();
}

function startCropDrag(event) {
  if (!cropper.image || !cropper.rect) return;
  const display = cropper.display;
  const rect = sourceRectToCanvas(cropper.rect, display);
  const point = canvasPoint(event, els.cropCanvas);
  const handle = detectCropHandle(point, rect);
  const inRect = point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
  if (!inRect && !handle) return;
  cropper.dragging = true;
  cropper.dragMode = handle ? "resize" : "move";
  cropper.dragHandle = handle;
  cropper.dragOffset = { x: point.x - rect.x, y: point.y - rect.y };
  cropper.dragStartPoint = sourcePointFromCanvas(point, display);
  cropper.dragStartRect = { ...cropper.rect };
}

function moveCropDrag(event) {
  if (!cropper.dragging || !cropper.image || !cropper.rect) {
    updateCropCursor(event);
    return;
  }
  const display = cropper.display;
  const point = canvasPoint(event, els.cropCanvas);
  if (cropper.dragMode === "resize") {
    cropper.rect = resizedCropRect(sourcePointFromCanvas(point, display));
    drawCropper();
    return;
  }
  const rect = sourceRectToCanvas(cropper.rect, display);
  rect.x = point.x - cropper.dragOffset.x;
  rect.y = point.y - cropper.dragOffset.y;
  cropper.rect = canvasRectToSource(rect, display);
  drawCropper();
}

function stopCropDrag() {
  cropper.dragging = false;
  cropper.dragMode = null;
  cropper.dragHandle = null;
  cropper.dragStartPoint = null;
  cropper.dragStartRect = null;
  updateCropCursor();
}

function updateCropCursor(event) {
  if (!cropper.image || !cropper.rect || !cropper.display) {
    els.cropCanvas.style.cursor = "default";
    return;
  }
  if (!event) {
    els.cropCanvas.style.cursor = "move";
    return;
  }
  const rect = sourceRectToCanvas(cropper.rect, cropper.display);
  const point = canvasPoint(event, els.cropCanvas);
  const handle = detectCropHandle(point, rect);
  const inRect = point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
  if (handle === "nw" || handle === "se") els.cropCanvas.style.cursor = "nwse-resize";
  else if (handle === "ne" || handle === "sw") els.cropCanvas.style.cursor = "nesw-resize";
  else els.cropCanvas.style.cursor = inRect ? "move" : "default";
}

function sourcePointFromCanvas(point, display) {
  return {
    x: clamp((point.x - display.x) / (cropper.image.width * display.ratio), 0, 1),
    y: clamp((point.y - display.y) / (cropper.image.height * display.ratio), 0, 1),
  };
}

function resizedCropRect(point) {
  const start = cropper.dragStartRect;
  const handle = cropper.dragHandle;
  if (!start || !handle) return cropper.rect;

  const minSize = 0.05;
  const anchor = {
    x: handle.includes("w") ? start.x + start.width : start.x,
    y: handle.includes("n") ? start.y + start.height : start.y,
  };
  const maxWidth = handle.includes("w") ? anchor.x : 1 - anchor.x;
  const maxHeight = handle.includes("n") ? anchor.y : 1 - anchor.y;
  let width = clamp(Math.abs(point.x - anchor.x), minSize, maxWidth);
  let height = clamp(Math.abs(point.y - anchor.y), minSize, maxHeight);

  if (cropper.aspect !== "original") {
    const aspect = Number(cropper.aspect);
    const sourceAspect = cropper.image.width / cropper.image.height;
    height = width * sourceAspect / aspect;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect / sourceAspect;
    }
    width = clamp(width, minSize, maxWidth);
    height = clamp(height, minSize, maxHeight);
  }

  return normalizeCropRect({
    x: handle.includes("w") ? anchor.x - width : anchor.x,
    y: handle.includes("n") ? anchor.y - height : anchor.y,
    width,
    height,
  });
}

function canvasPoint(event, canvas) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
  };
}

function resetCropper() {
  if (!cropper.image) return;
  cropper.rect = { x: 0, y: 0, width: 1, height: 1 };
  setActiveRatio("original");
  drawCropper();
}

function applyCropper() {
  const doc = activeDoc();
  const image = doc?.images?.[cropper.id];
  if (!image || !cropper.rect) return;
  const full = cropper.rect.x === 0 && cropper.rect.y === 0 && cropper.rect.width === 1 && cropper.rect.height === 1;
  image.crop = full ? null : { ...cropper.rect };
  scheduleHistory();
  saveDocs();
  updateImageStrip();
  closeCropper();
  requestRender();
}

function selectedLayoutConfig() {
  return layoutConfigs[els.galleryLayout.value] || layoutConfigs.auto;
}

function selectedGalleryVariant(layout) {
  const selected = selectedLayoutConfig();
  if (selected.layout === layout) return selected.variant;
  return defaultGalleryVariant(layout);
}

function defaultGalleryVariant(layout) {
  if (layout === 2) return "two-cols";
  if (layout === 3) return "three-left";
  if (layout === 4) return "four-grid";
  return "single";
}

function galleryMarker(ids, layout, variant = selectedGalleryVariant(layout)) {
  return `[[gallery:${ids.join(",")}|${layout}|${variant}]]`;
}

function appendToPendingGallery(newIds, layout, variant = selectedGalleryVariant(layout)) {
  const content = els.content.value;
  const galleryPattern = /\[\[\s*gallery\s*:\s*([\w,\s-]*?)\s*\|\s*([1-4])(?:\s*\|\s*([\w-]+))?(?:\s*\|\s*(left|center|right))?\s*\]\]/g;
  const matches = [...content.matchAll(galleryPattern)];
  const cursor = els.content.selectionStart ?? content.length;
  const beforeCursor = matches.filter((match) => match.index <= cursor);
  const candidates = [...beforeCursor.reverse(), ...matches.reverse()];

  for (const match of candidates) {
    const existingLayout = Number(match[2]);
    const existingVariant = match[3] || defaultGalleryVariant(layout);
    const existingIds = match[1]
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (existingLayout !== layout || existingVariant !== variant || existingIds.length >= layout) continue;

    const mergedIds = [...existingIds, ...newIds].slice(0, layout);
    const replacement = galleryMarker(mergedIds, layout, existingVariant);
    const start = match.index;
    const end = start + match[0].length;
    els.content.value = `${content.slice(0, start)}${replacement}${content.slice(end)}`;
    const nextCursor = start + replacement.length;
    els.content.focus();
    els.content.setSelectionRange(nextCursor, nextCursor);

    const leftover = newIds.slice(Math.max(0, layout - existingIds.length));
    if (leftover.length) {
      insertAtCursor(`\n${galleryMarker(leftover, layout, variant)}\n`);
    }
    return true;
  }

  return false;
}

function parseBlocks(content) {
  const lines = normalizeMarkers(content).replace(/\r\n/g, "\n").split("\n");
  const blocks = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    if (/^:::\s*pagebreak\s*$/.test(line) || /^---\s*pagebreak\s*---$/i.test(line)) {
      blocks.push({ type: "pageBreak" });
      continue;
    }

    const codeStart = line.match(/^```([\w-]*)\s*$/);
    if (codeStart) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: "code", text: codeLines.join("\n"), lang: codeStart[1] || "" });
      continue;
    }

    const titleSingle = line.match(/^:::\s*title\s+(.+)$/);
    if (titleSingle) {
      blocks.push({ type: "titleBlock", text: titleSingle[1].trim() });
      continue;
    }

    if (/^:::\s*title\s*$/.test(line)) {
      const titleLines = [];
      i += 1;
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) {
        titleLines.push(lines[i].trim());
        i += 1;
      }
      blocks.push({ type: "titleBlock", text: titleLines.join(" ").trim() });
      continue;
    }

    const alignSingle = line.match(/^:::\s*align\s+(left|center|right)\s+(.+)$/);
    if (alignSingle) {
      blocks.push({ type: "p", text: alignSingle[2].trim(), align: alignSingle[1] });
      continue;
    }

    const alignStart = line.match(/^:::\s*align\s+(left|center|right)\s*$/);
    if (alignStart) {
      const alignLines = [];
      i += 1;
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) {
        const alignedLine = lines[i].trim();
        if (alignedLine) alignLines.push(alignedLine);
        i += 1;
      }
      alignLines.forEach((text) => blocks.push({ type: "p", text, align: alignStart[1] }));
      continue;
    }

    const image = line.match(/^\[\[image:([\w-]+)\]\]$/);
    if (image) {
      blocks.push({ type: "image", ids: [image[1]], layout: 1 });
      continue;
    }

    const gallery = line.match(/^\[\[gallery:([\w,-]+)\|([1-4])(?:\|([\w-]+))?(?:\|(left|center|right))?\]\]$/);
    if (gallery) {
      const layout = Number(gallery[2]);
      blocks.push({
        type: "gallery",
        ids: gallery[1].split(",").slice(0, 4),
        layout,
        variant: gallery[3] || defaultGalleryVariant(layout),
        align: gallery[4] || "center",
      });
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
    } else if (line.startsWith("> ")) {
      blocks.push({ type: "quote", text: line.slice(2).trim() });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }

  return blocks;
}

function normalizeMarkers(content) {
  return String(content || "")
    .replace(/\[\[\s*image\s*:\s*([\s\S]*?)\s*\]\]/g, (marker) => marker.replace(/\s+/g, ""))
    .replace(/\[\[\s*gallery\s*:\s*([\s\S]*?)\s*\]\]/g, (marker) => marker.replace(/\s+/g, ""));
}

function parseInline(text) {
  const pieces = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("{color:", i)) {
      const match = text.slice(i).match(/^\{color:(#[0-9a-fA-F]{6})\|([\s\S]*?)\}/);
      if (match) {
        pieces.push({ text: match[2], color: match[1] });
        i += match[0].length;
        continue;
      }
    }

    if (text.startsWith("**", i)) {
      const close = text.indexOf("**", i + 2);
      if (close !== -1) {
        pieces.push({ text: text.slice(i + 2, close), bold: true });
        i = close + 2;
        continue;
      }
    }

    if (text.startsWith("==", i)) {
      const close = text.indexOf("==", i + 2);
      if (close !== -1) {
        pieces.push({ text: text.slice(i + 2, close), highlight: true });
        i = close + 2;
        continue;
      }
    }

    if (text.startsWith("*", i)) {
      const close = text.indexOf("*", i + 1);
      if (close !== -1) {
        pieces.push({ text: text.slice(i + 1, close), italic: true });
        i = close + 1;
        continue;
      }
    }

    const nextMarkers = ["{color:", "**", "==", "*"]
      .map((marker) => text.indexOf(marker, i + 1))
      .filter((index) => index !== -1);
    const end = nextMarkers.length ? Math.min(...nextMarkers) : text.length;
    pieces.push({ text: text.slice(i, end), bold: false, italic: false });
    i = end;
  }
  return pieces.filter((piece) => piece.text);
}

function styleFor(type, settings) {
  const base = settings.fontSize;
  if (type === "h1") return { size: base + 10, weight: 850, marginTop: 34, lineHeight: 1.24 };
  if (type === "h2") return { size: base + 4, weight: 820, marginTop: 30, lineHeight: 1.28 };
  if (type === "quote") return { size: base, weight: 550, marginTop: 22, lineHeight: settings.lineHeight, quote: true };
  if (type === "code") return { size: Math.max(22, base - 5), weight: 500, marginTop: 24, lineHeight: 1.5, mono: true };
  if (type === "titleBlock") return { size: base + 6, weight: 850, marginTop: 36, lineHeight: 1.24, titleBlock: true };
  return { size: base, weight: 450, marginTop: 13, lineHeight: settings.lineHeight };
}

function font(style, bold = false, italic = false) {
  const weight = bold ? 820 : style.weight;
  const family = style.mono ? 'Consolas, Menlo, "SFMono-Regular", monospace' : '"PingFang SC", "Microsoft YaHei", Arial, sans-serif';
  return `${italic ? "italic " : ""}${weight} ${style.size}px ${family}`;
}

function splitText(ctx, text, style, maxWidth) {
  const tokens = parseInline(text);
  const lines = [];
  let line = [];
  let width = 0;

  const pushChunk = (target, token, chunk) => {
    target.push({
      ...token,
      text: chunk,
    });
  };

  for (const token of tokens) {
    const chars = Array.from(token.text);
    let chunk = "";
    for (const ch of chars) {
      ctx.font = font(style, token.bold, token.italic);
      const chWidth = ctx.measureText(ch).width;
      if (width + chWidth > maxWidth && (line.length || chunk)) {
        if (chunk) {
          pushChunk(line, token, chunk);
          chunk = "";
        }
        lines.push(line);
        line = [];
        width = 0;
      }
      chunk += ch;
      width += chWidth;
    }
    if (chunk) pushChunk(line, token, chunk);
  }
  if (line.length) lines.push(line);
  return lines;
}

function inlineLineWidth(ctx, line, style) {
  return line.reduce((sum, piece) => {
    ctx.font = font(style, piece.bold, piece.italic);
    return sum + ctx.measureText(piece.text).width;
  }, 0);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function buildPages(doc) {
  const measure = document.createElement("canvas");
  const ctx = measure.getContext("2d");
  const settings = doc.settings;
  const blocks = parseBlocks(doc.content);
  const imageCache = {};
  const pages = [];
  const top = 160;
  const bottom = CANVAS_HEIGHT - 66;
  const contentWidth = CANVAS_WIDTH - PAD_X * 2;
  let page = [];
  let y = top;
  let hasContent = false;

  const finish = () => {
    if (page.length) pages.push(page);
    page = [];
    y = top;
    hasContent = false;
  };

  const ensure = (height, margin = 0) => {
    const actualMargin = hasContent ? margin : 0;
    if (hasContent && y + actualMargin + height > bottom) finish();
    y += hasContent ? margin : 0;
  };

  for (const block of blocks) {
    if (block.type === "pageBreak") {
      if (page.length) finish();
      continue;
    }

    if (block.type === "code") {
      const style = styleFor("code", settings);
      const lineHeight = Math.ceil(style.size * style.lineHeight);
      const lines = block.text
        .split("\n")
        .flatMap((line) => splitText(ctx, line || " ", style, contentWidth - 28));
      const height = Math.max(lineHeight + 28, lines.length * lineHeight + 28);
      ensure(height, style.marginTop);
      page.push({ type: "code", lines, style, x: PAD_X, y, width: contentWidth, height, lineHeight });
      y += height + 18;
      hasContent = true;
      continue;
    }

    if (block.type === "titleBlock") {
      const style = styleFor("titleBlock", settings);
      const lineHeight = Math.ceil(style.size * style.lineHeight);
      const lines = splitText(ctx, block.text, style, contentWidth - 96);
      const height = Math.max(76, lines.length * lineHeight + 28);
      ensure(height, style.marginTop);
      page.push({ type: "titleBlock", lines, style, x: PAD_X, y, width: contentWidth, height, lineHeight });
      y += height + 20;
      hasContent = true;
      continue;
    }

    if (block.type === "image" || block.type === "gallery") {
      const ids = block.ids.filter((id) => doc.images[id]).slice(0, block.layout || 4);
      const box = galleryBox(block, PAD_X, contentWidth);
      if (!ids.length) {
        const height = galleryHeight(block.layout, box.width, block.variant);
        ensure(height, 24);
        page.push({ type: "missing-gallery", layout: block.layout, variant: block.variant, x: box.x, y, width: box.width, height });
        y += height + 28;
        hasContent = true;
        continue;
      }
      for (const id of ids) {
        if (!imageCache[id]) imageCache[id] = await loadImage(doc.images[id].src).catch(() => null);
      }
      const imgs = ids.map((id) => ({ ...doc.images[id], img: imageCache[id] })).filter((item) => item.img);
      if (!imgs.length) {
        const height = galleryHeight(block.layout, box.width, block.variant);
        ensure(height, 24);
        page.push({ type: "missing-gallery", layout: block.layout, variant: block.variant, x: box.x, y, width: box.width, height });
        y += height + 28;
        hasContent = true;
        continue;
      }
      const height = galleryHeight(block.layout, box.width, block.variant, imgs);
      ensure(height, 24);
      page.push({ type: "gallery", imgs, layout: block.layout, variant: block.variant, x: box.x, y, width: box.width, height });
      y += height + 28;
      hasContent = true;
      continue;
    }

    const style = styleFor(block.type, settings);
    const textWidth = style.quote ? contentWidth - 32 : contentWidth;
    const lineHeight = Math.ceil(style.size * style.lineHeight);
    const lines = splitText(ctx, block.text, style, textWidth);

    for (const line of lines) {
      ensure(lineHeight, style.marginTop);
      page.push({
        type: "text",
        blockType: block.type,
        line,
        style,
        x: PAD_X + (style.quote ? 32 : 0),
        y,
        width: textWidth,
        align: block.align || "left",
        lineHeight,
      });
      y += lineHeight;
      hasContent = true;
    }
  }

  if (page.length) pages.push(page);
  return pages;
}

async function buildLongDocument(doc) {
  const measure = document.createElement("canvas");
  const ctx = measure.getContext("2d");
  const settings = doc.settings;
  const blocks = parseBlocks(doc.content);
  const imageCache = {};
  const top = 160;
  const contentWidth = CANVAS_WIDTH - PAD_X * 2;
  const items = [];
  let y = top;
  let hasContent = false;

  const addSpace = (margin = 0) => {
    y += hasContent ? margin : 0;
  };

  for (const block of blocks) {
    if (block.type === "pageBreak") {
      y += hasContent ? 120 : 0;
      hasContent = true;
      continue;
    }

    if (block.type === "code") {
      const style = styleFor("code", settings);
      const lineHeight = Math.ceil(style.size * style.lineHeight);
      const lines = block.text
        .split("\n")
        .flatMap((line) => splitText(ctx, line || " ", style, contentWidth - 28));
      const height = Math.max(lineHeight + 28, lines.length * lineHeight + 28);
      addSpace(style.marginTop);
      items.push({ type: "code", lines, style, x: PAD_X, y, width: contentWidth, height, lineHeight });
      y += height + 18;
      hasContent = true;
      continue;
    }

    if (block.type === "titleBlock") {
      const style = styleFor("titleBlock", settings);
      const lineHeight = Math.ceil(style.size * style.lineHeight);
      const lines = splitText(ctx, block.text, style, contentWidth - 96);
      const height = Math.max(76, lines.length * lineHeight + 28);
      addSpace(style.marginTop);
      items.push({ type: "titleBlock", lines, style, x: PAD_X, y, width: contentWidth, height, lineHeight });
      y += height + 20;
      hasContent = true;
      continue;
    }

    if (block.type === "image" || block.type === "gallery") {
      const ids = block.ids.filter((id) => doc.images[id]).slice(0, block.layout || 4);
      const box = galleryBox(block, PAD_X, contentWidth);
      if (!ids.length) {
        const height = galleryHeight(block.layout, box.width, block.variant);
        addSpace(24);
        items.push({ type: "missing-gallery", layout: block.layout, variant: block.variant, x: box.x, y, width: box.width, height });
        y += height + 28;
        hasContent = true;
        continue;
      }

      for (const id of ids) {
        if (!imageCache[id]) imageCache[id] = await loadImage(doc.images[id].src).catch(() => null);
      }

      const imgs = ids.map((id) => ({ ...doc.images[id], img: imageCache[id] })).filter((item) => item.img);
      const height = galleryHeight(block.layout, box.width, block.variant, imgs);
      addSpace(24);
      items.push({
        type: imgs.length ? "gallery" : "missing-gallery",
        imgs,
        layout: block.layout,
        variant: block.variant,
        x: box.x,
        y,
        width: box.width,
        height,
      });
      y += height + 28;
      hasContent = true;
      continue;
    }

    const style = styleFor(block.type, settings);
    const textWidth = style.quote ? contentWidth - 32 : contentWidth;
    const lineHeight = Math.ceil(style.size * style.lineHeight);
    const lines = splitText(ctx, block.text, style, textWidth);

    for (const line of lines) {
      addSpace(style.marginTop);
      items.push({
        type: "text",
        blockType: block.type,
        line,
        style,
        x: PAD_X + (style.quote ? 32 : 0),
        y,
        width: textWidth,
        align: block.align || "left",
        lineHeight,
      });
      y += lineHeight;
      hasContent = true;
    }
  }

  return {
    items,
    height: clamp(Math.ceil(y + 80), CANVAS_HEIGHT, 30000),
  };
}

function galleryBox(block, baseX, contentWidth) {
  return { x: baseX, width: contentWidth };
}

function galleryHeight(layout, width, variant = "", imgs = []) {
  const gap = 12;
  if (layout === 1) {
    const first = imgs[0];
    const aspect = first ? imageDisplayAspect(first) : 16 / 9;
    return clamp(Math.round(width / aspect), 280, 900);
  }
  if (layout === 2) {
    if (variant === "two-rows") return Math.round(width * 9 / 16 * 2 + gap);
    return Math.round((width - gap) / 2);
  }
  if (layout === 3) {
    if (variant === "three-cols") return Math.round((width - gap * 2) / 3);
    const smallW = Math.round((width - gap) * 0.38);
    return smallW * 2 + gap;
  }
  const cell = Math.round((width - gap) / 2);
  return cell * 2 + gap;
}

function galleryRects(layout, x, y, width, height, variant = "") {
  const gap = 12;
  if (layout === 1) return [{ x, y, width, height }];
  if (layout === 2) {
    if (variant === "two-rows") {
      const h = (height - gap) / 2;
      return [
        { x, y, width, height: h },
        { x, y: y + h + gap, width, height: h },
      ];
    }
    const w = (width - gap) / 2;
    return [
      { x, y, width: w, height },
      { x: x + w + gap, y, width: w, height },
    ];
  }
  if (layout === 3) {
    if (variant === "three-cols") {
      const w = (width - gap * 2) / 3;
      return [
        { x, y, width: w, height },
        { x: x + w + gap, y, width: w, height },
        { x: x + (w + gap) * 2, y, width: w, height },
      ];
    }
    const smallW = Math.round((width - gap) * 0.38);
    const bigW = width - smallW - gap;
    const smallH = (height - gap) / 2;
    if (variant === "three-right") {
      return [
        { x, y, width: smallW, height: smallH },
        { x, y: y + smallH + gap, width: smallW, height: smallH },
        { x: x + smallW + gap, y, width: bigW, height },
      ];
    }
    return [
      { x, y, width: bigW, height },
      { x: x + bigW + gap, y, width: smallW, height: smallH },
      { x: x + bigW + gap, y: y + smallH + gap, width: smallW, height: smallH },
    ];
  }
  const w = (width - gap) / 2;
  const h = (height - gap) / 2;
  return [
    { x, y, width: w, height: h },
    { x: x + w + gap, y, width: w, height: h },
    { x, y: y + h + gap, width: w, height: h },
    { x: x + w + gap, y: y + h + gap, width: w, height: h },
  ];
}

async function drawPage(items, index, total, doc) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  const settings = doc.settings;
  const avatar = await loadImage(doc.avatar || sampleAvatar).catch(() => null);

  ctx.fillStyle = settings.bgColor;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawHeader(ctx, doc, avatar);

  for (const item of items) {
    if (item.type === "text") drawText(ctx, item, settings);
    if (item.type === "code") drawCodeBlock(ctx, item, settings);
    if (item.type === "titleBlock") drawTitleBlock(ctx, item, settings);
    if (item.type === "gallery") drawGallery(ctx, item, settings);
    if (item.type === "missing-gallery") drawMissingGallery(ctx, item, settings);
  }

  return canvas;
}

async function drawLongCanvas(doc) {
  const longDoc = await buildLongDocument(doc);
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = longDoc.height;
  const ctx = canvas.getContext("2d");
  const settings = doc.settings;
  const avatar = await loadImage(doc.avatar || sampleAvatar).catch(() => null);

  ctx.fillStyle = settings.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawHeader(ctx, doc, avatar);

  for (const item of longDoc.items) {
    if (item.type === "text") drawText(ctx, item, settings);
    if (item.type === "code") drawCodeBlock(ctx, item, settings);
    if (item.type === "titleBlock") drawTitleBlock(ctx, item, settings);
    if (item.type === "gallery") drawGallery(ctx, item, settings);
    if (item.type === "missing-gallery") drawMissingGallery(ctx, item, settings);
  }

  return canvas;
}

function drawHeader(ctx, doc, avatar) {
  const settings = doc.settings;
  const dark = isDark(settings.bgColor);
  const x = PAD_X;
  const y = 38;
  const size = 82;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    drawCover(ctx, avatar, x, y, size, size);
  } else {
    ctx.fillStyle = "#dbeafe";
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  ctx.strokeStyle = dark ? "rgba(255,255,255,.22)" : "rgba(31,41,55,.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = settings.textColor;
  ctx.font = '780 31px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(clampText(ctx, doc.author || "未命名作者", 430), 152, 74);

  ctx.fillStyle = dark ? "rgba(255,255,255,.68)" : "#667085";
  ctx.font = '450 28px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(clampText(ctx, normalizeHandle(doc.handle), 470), 152, 114);

  ctx.fillStyle = dark ? "rgba(255,255,255,.42)" : "#98a2b3";
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(770 + i * 16, 80, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawText(ctx, item, settings) {
  if (item.style.quote) {
    ctx.fillStyle = settings.accentColor;
    roundRect(ctx, item.x - 30, item.y + 7, 8, item.lineHeight - 12, 4);
    ctx.fill();
  }
  const textWidth = inlineLineWidth(ctx, item.line, item.style);
  const offset = item.align === "center" ? Math.max(0, (item.width - textWidth) / 2) : item.align === "right" ? Math.max(0, item.width - textWidth) : 0;
  let cursor = item.x + offset;
  const baseline = item.y + Math.round(item.lineHeight * 0.74);
  for (const piece of item.line) {
    ctx.font = font(item.style, piece.bold, piece.italic);
    const pieceWidth = ctx.measureText(piece.text).width;
    if (piece.highlight) {
      ctx.fillStyle = settings.highlightColor || "#fff2a8";
      roundRect(ctx, cursor - 3, item.y + Math.round(item.lineHeight * 0.17), pieceWidth + 6, Math.round(item.lineHeight * 0.72), 4);
      ctx.fill();
    }
    ctx.fillStyle = piece.color || (item.blockType === "h1" || item.blockType === "h2" ? settings.accentColor : settings.textColor);
    ctx.fillText(piece.text, cursor, baseline);
    cursor += pieceWidth;
  }
}

function drawCodeBlock(ctx, item, settings) {
  const dark = isDark(settings.bgColor);
  ctx.save();
  roundRect(ctx, item.x, item.y, item.width, item.height, 14);
  ctx.fillStyle = dark ? "rgba(255,255,255,.08)" : "#f3f6fb";
  ctx.fill();
  ctx.strokeStyle = dark ? "rgba(255,255,255,.16)" : "#d8e0ea";
  ctx.stroke();

  let y = item.y + 16;
  for (const line of item.lines) {
    let cursor = item.x + 16;
    const baseline = y + Math.round(item.lineHeight * 0.74);
    for (const piece of line) {
      ctx.font = font(item.style, piece.bold, piece.italic);
      ctx.fillStyle = dark ? "#e5e7eb" : "#263140";
      ctx.fillText(piece.text, cursor, baseline);
      cursor += ctx.measureText(piece.text).width;
    }
    y += item.lineHeight;
  }
  ctx.restore();
}

function drawTitleBlock(ctx, item, settings) {
  ctx.save();
  const innerWidth = Math.min(item.width - 96, measureLinesWidth(ctx, item.lines, item.style) + 36);
  const x = item.x + (item.width - innerWidth) / 2;
  const y = item.y + (item.height - item.lines.length * item.lineHeight - 18) / 2;
  roundRect(ctx, x, y, innerWidth, item.lines.length * item.lineHeight + 18, 4);
  ctx.fillStyle = settings.accentColor;
  ctx.fill();

  let lineY = y + 9;
  for (const line of item.lines) {
    const lineWidth = measureLineWidth(ctx, line, item.style);
    let cursor = item.x + item.width / 2 - lineWidth / 2;
    const baseline = lineY + Math.round(item.lineHeight * 0.74);
    for (const piece of line) {
      ctx.font = font(item.style, piece.bold, piece.italic);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(piece.text, cursor, baseline);
      cursor += ctx.measureText(piece.text).width;
    }
    lineY += item.lineHeight;
  }
  ctx.restore();
}

function measureLineWidth(ctx, line, style) {
  return line.reduce((sum, piece) => {
    ctx.font = font(style, piece.bold, piece.italic);
    return sum + ctx.measureText(piece.text).width;
  }, 0);
}

function measureLinesWidth(ctx, lines, style) {
  return Math.max(0, ...lines.map((line) => measureLineWidth(ctx, line, style)));
}

function drawGallery(ctx, item, settings) {
  const rects = galleryRects(item.layout, item.x, item.y, item.width, item.height, item.variant);
  rects.forEach((rect, index) => {
    const data = item.imgs[index];
    if (!data?.img) {
      drawImagePlaceholder(ctx, rect, index);
      return;
    }
    const { img } = data;
    ctx.save();
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 14);
    ctx.clip();
    drawImageData(ctx, img, data, rect.x, rect.y, rect.width, rect.height, item.layout === 1 ? "single" : "cover");
    ctx.restore();
  });
}

function drawImagePlaceholder(ctx, rect, index) {
  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 14);
  ctx.fillStyle = "#f1f5f9";
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.setLineDash([10, 10]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#64748b";
  ctx.font = '700 24px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(`继续上传图 ${index + 1}`, rect.x + rect.width / 2, rect.y + rect.height / 2);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawMissingGallery(ctx, item, settings) {
  const rects = galleryRects(item.layout, item.x, item.y, item.width, item.height, item.variant);
  rects.forEach((rect, index) => {
    ctx.save();
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 14);
    ctx.fillStyle = isDark(settings.bgColor) ? "rgba(255,255,255,.08)" : "#eef3f8";
    ctx.fill();
    ctx.strokeStyle = isDark(settings.bgColor) ? "rgba(255,255,255,.24)" : "#cbd5e1";
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isDark(settings.bgColor) ? "rgba(255,255,255,.72)" : "#64748b";
    ctx.font = '700 24px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(`图片 ${index + 1} 未读取`, rect.x + rect.width / 2, rect.y + rect.height / 2);
    ctx.textAlign = "left";
    ctx.restore();
  });
}

function drawCover(ctx, img, x, y, width, height) {
  const sourceRatio = img.width / img.height;
  const destRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (sourceRatio > destRatio) {
    sw = img.height * destRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / destRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);
}

function sourceRectFromCrop(img, crop) {
  if (!crop) return null;
  return {
    x: clamp(crop.x, 0, 1) * img.width,
    y: clamp(crop.y, 0, 1) * img.height,
    width: clamp(crop.width, 0.01, 1) * img.width,
    height: clamp(crop.height, 0.01, 1) * img.height,
  };
}

function drawSourceCover(ctx, img, sourceRect, x, y, width, height) {
  const sourceRatio = sourceRect.width / sourceRect.height;
  const destRatio = width / height;
  let sx = sourceRect.x;
  let sy = sourceRect.y;
  let sw = sourceRect.width;
  let sh = sourceRect.height;
  if (sourceRatio > destRatio) {
    sw = sourceRect.height * destRatio;
    sx = sourceRect.x + (sourceRect.width - sw) / 2;
  } else {
    sh = sourceRect.width / destRatio;
    sy = sourceRect.y + (sourceRect.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);
}

function drawContain(ctx, img, x, y, width, height) {
  const sourceRatio = img.width / img.height;
  const destRatio = width / height;
  let dw = width;
  let dh = height;
  if (sourceRatio > destRatio) {
    dh = width / sourceRatio;
  } else {
    dw = height * sourceRatio;
  }
  const dx = x + (width - dw) / 2;
  const dy = y + (height - dh) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, width, height);
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawSourceContain(ctx, img, sourceRect, x, y, width, height) {
  const sourceRatio = sourceRect.width / sourceRect.height;
  const destRatio = width / height;
  let dw = width;
  let dh = height;
  if (sourceRatio > destRatio) {
    dh = width / sourceRatio;
  } else {
    dw = height * sourceRatio;
  }
  const dx = x + (width - dw) / 2;
  const dy = y + (height - dh) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, width, height);
  ctx.drawImage(img, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, dx, dy, dw, dh);
}

function imageDisplayAspect(data) {
  const img = data.img || data;
  const sourceRect = sourceRectFromCrop(img, data.crop);
  if (sourceRect) return sourceRect.width / sourceRect.height;
  return img.width / img.height;
}

function drawImageData(ctx, img, data, x, y, width, height, mode = "single") {
  const sourceRect = sourceRectFromCrop(img, data.crop);
  if (sourceRect) {
    drawSourceContain(ctx, img, sourceRect, x, y, width, height);
  } else if (mode === "cover") {
    drawCover(ctx, img, x, y, width, height);
  } else {
    drawContain(ctx, img, x, y, width, height);
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function clampText(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  let next = text;
  while (next.length > 1 && ctx.measureText(`${next}...`).width > width) next = next.slice(0, -1);
  return `${next}...`;
}

function isDark(hex) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value.padEnd(6, "0").slice(0, 6);
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

async function render() {
  syncFormToDoc(false);
  const doc = activeDoc();
  const pages = await buildPages(doc);
  canvases = [];
  for (let i = 0; i < pages.length; i += 1) {
    canvases.push(await drawPage(pages[i], i, pages.length, doc));
  }
  drawPreview();
  els.status.textContent = storageLimited ? `已生成 ${canvases.length} 张图片；图片较大，本次可预览但本地缓存可能不完整` : `已生成 ${canvases.length} 张图片，文档已保存`;
}

function drawPreview() {
  els.pages.innerHTML = "";
  if (!canvases.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "暂无可预览内容";
    els.pages.append(empty);
    return;
  }

  canvases.forEach((canvas, index) => {
    const shell = document.createElement("article");
    shell.className = "page-shell";
    const frame = document.createElement("div");
    frame.className = "page-frame";
    frame.append(canvas);

    const actions = document.createElement("div");
    actions.className = "page-actions";
    const label = document.createElement("span");
    label.textContent = `图片 ${String(index + 1).padStart(2, "0")}`;
    const button = document.createElement("button");
    button.type = "button";
    button.title = "下载单张";
    button.textContent = "↓";
    button.addEventListener("click", () => downloadCanvas(canvas, `fawen-page-${String(index + 1).padStart(2, "0")}.png`));
    actions.append(label, button);
    shell.append(frame, actions);
    els.pages.append(shell);
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

async function downloadCanvas(canvas, filename) {
  const blob = await canvasToBlob(canvas);
  if (!blob) return;
  saveBlob(blob, filename);
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function downloadAll() {
  if (!canvases.length) return;
  if (!window.JSZip) {
    canvases.forEach((canvas, index) => setTimeout(() => downloadCanvas(canvas, `fawen-page-${index + 1}.png`), index * 160));
    return;
  }
  const zip = new JSZip();
  for (const [index, canvas] of canvases.entries()) {
    const blob = await canvasToBlob(canvas);
    zip.file(`fawen-page-${String(index + 1).padStart(2, "0")}.png`, blob);
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  saveBlob(blob, `${activeDoc().title || "fawen"}.zip`);
}

async function downloadLongImage() {
  syncFormToDoc(false);
  els.status.textContent = "正在生成长图...";
  const canvas = await drawLongCanvas(activeDoc());
  await downloadCanvas(canvas, `${activeDoc().title || "fawen"}-long.png`);
  els.status.textContent = `已下载长图，尺寸 ${canvas.width}x${canvas.height}`;
}

function exportedMarkdown(doc) {
  return normalizeMarkers(doc.content)
    .replace(/^\[\[image:[\w-]+\]\]\s*$/gm, "")
    .replace(/^\[\[gallery:[\w,-]+\|[1-4](?:\|[\w-]+)?(?:\|(left|center|right))?\]\]\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inlineMarkdownToHtml(text) {
  return parseInline(text)
    .map((piece) => {
      let html = escapeHtml(piece.text);
      if (piece.bold) html = `<strong>${html}</strong>`;
      if (piece.italic) html = `<em>${html}</em>`;
      if (piece.highlight) html = `<span style="background:${activeDoc()?.settings?.highlightColor || "#fff2a8"};padding:0 3px;border-radius:3px;">${html}</span>`;
      if (piece.color) html = `<span style="color:${piece.color};">${html}</span>`;
      return html;
    })
    .join("");
}

function richTextStyles(doc) {
  const settings = doc.settings;
  return {
    root: `font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:${settings.textColor};line-height:1.68;font-size:16px;`,
    h1: `font-size:24px;font-weight:800;line-height:1.32;margin:34px 0 16px;color:${settings.accentColor};`,
    h2: `font-size:20px;font-weight:800;line-height:1.38;margin:32px 0 14px;color:${settings.accentColor};`,
    p: `font-size:16px;line-height:1.72;margin:0 0 15px;color:${settings.textColor};`,
    quote: `font-size:16px;line-height:1.72;margin:22px 0;padding:8px 0 8px 14px;border-left:4px solid ${settings.accentColor};color:${settings.textColor};font-weight:600;`,
    gallery: `display:grid;gap:8px;margin:22px 0;`,
    img: `display:block;width:100%;height:auto;border-radius:8px;background:#ffffff;`,
    titleBlock: `text-align:center;margin:36px 0 22px;`,
    titleBlockInner: `display:inline-block;background:${settings.accentColor};color:#ffffff;font-size:22px;font-weight:800;line-height:1.35;padding:6px 14px;`,
    codeWrap: `margin:20px 0;padding:0;border:1px solid #d8e0ea;border-radius:8px;background:#f3f6fb;overflow:hidden;`,
    codeTable: `width:100%;border-collapse:collapse;table-layout:fixed;background:#f3f6fb;`,
    codeCell: `padding:12px 14px;color:#263140;font-size:14px;line-height:1.65;font-family:Consolas,Menlo,"SFMono-Regular","Courier New",monospace;word-break:break-all;`,
    codeLine: `display:block;min-height:1.65em;margin:0;padding:0;font-family:Consolas,Menlo,"SFMono-Regular","Courier New",monospace;font-size:14px;line-height:1.65;color:#263140;white-space:nowrap;`,
  };
}

function codeBlockHtml(block, styles) {
  const lines = block.text.split("\n");
  const rows = (lines.length ? lines : [""]).map((line) => {
    const content = line ? escapeCodeHtml(line) : "&nbsp;";
    return `<code data-code-line="true" style="${styles.codeLine}">${content}</code>`;
  });
  return `<section data-code-block="true" style="${styles.codeWrap}"><table role="presentation" cellspacing="0" cellpadding="0" style="${styles.codeTable}"><tbody><tr><td style="${styles.codeCell}">${rows.join("")}</td></tr></tbody></table><code data-raw="${escapeHtml(block.text)}" style="display:none;">${escapeCodeHtml(block.text)}</code></section>`;
}

async function galleryHtml(doc, block, styles) {
  const ids = block.ids.filter((id) => doc.images[id]).slice(0, block.layout || 4);
  if (!ids.length) return "";
  const collage = await makeGalleryCollage(doc, block);
  if (!collage) return "";
  return `<figure data-gallery-layout="${block.layout}" style="margin:22px 0;"><img src="${collage}" alt="组合图片" style="${styles.img}" /></figure>`;
}

async function buildRichHtml(doc) {
  const styles = richTextStyles(doc);
  const blocks = parseBlocks(doc.content);
  const htmlParts = [];
  for (const block of blocks) {
    if (block.type === "h1") htmlParts.push(`<h1 style="${styles.h1}">${inlineMarkdownToHtml(block.text)}</h1>`);
    else if (block.type === "h2") htmlParts.push(`<h2 style="${styles.h2}">${inlineMarkdownToHtml(block.text)}</h2>`);
    else if (block.type === "quote") htmlParts.push(`<blockquote style="${styles.quote}">${inlineMarkdownToHtml(block.text)}</blockquote>`);
    else if (block.type === "code") htmlParts.push(codeBlockHtml(block, styles));
    else if (block.type === "titleBlock") htmlParts.push(`<section style="${styles.titleBlock}"><span style="${styles.titleBlockInner}">${inlineMarkdownToHtml(block.text)}</span></section>`);
    else if (block.type === "pageBreak") htmlParts.push(`<section style="height:42px;margin:24px 0;border-top:1px dashed #d8e0ea;"></section>`);
    else if (block.type === "image" || block.type === "gallery") htmlParts.push(await galleryHtml(doc, block, styles));
    else htmlParts.push(`<p style="${styles.p}${block.align ? `text-align:${block.align};` : ""}">${inlineMarkdownToHtml(block.text)}</p>`);
  }
  const html = htmlParts.filter(Boolean).join("");

  return `<section style="${styles.root}">${html}</section>`;
}

async function makeGalleryCollage(doc, block) {
  const ids = block.ids.filter((id) => doc.images[id]).slice(0, block.layout || 4);
  if (!ids.length) return "";
  const width = 1200;
  const loaded = [];
  for (const id of ids) {
    const imageData = doc.images[id];
    const img = await loadImage(imageData.src).catch(() => null);
    if (img) loaded.push({ id, imageData, img });
  }
  const height = galleryHeight(block.layout, width, block.variant, loaded.map((item) => ({ ...item.imageData, img: item.img })));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const rects = galleryRects(block.layout, 0, 0, width, height, block.variant);
  for (const [index, item] of loaded.entries()) {
    const { imageData, img } = item;
    const rect = rects[index];
    ctx.save();
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 18);
    ctx.clip();
    drawImageData(ctx, img, imageData, rect.x, rect.y, rect.width, rect.height, block.layout === 1 ? "single" : "cover");
    ctx.restore();
  }
  return canvas.toDataURL("image/png");
}

function plainTextForClipboard(doc) {
  return parseBlocks(doc.content)
    .map((block) => {
      if (block.type === "image" || block.type === "gallery") return "";
      if (block.type === "code") return block.text;
      return (block.text || "")
        .replace(/\{color:#[0-9a-fA-F]{6}\|([\s\S]*?)\}/g, "$1")
        .replace(/==([^=]+)==/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1");
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

async function writeRichClipboard(html, plain) {
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      // Fallback below handles browsers that block rich clipboard writes.
    }
  }

  const selection = window.getSelection();
  if (!selection) return false;
  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.opacity = "0";
  container.style.pointerEvents = "none";
  document.body.append(container);

  let ok = false;
  try {
    const range = document.createRange();
    range.selectNodeContents(container);
    selection.removeAllRanges();
    selection.addRange(range);
    ok = document.execCommand("copy");
  } finally {
    selection.removeAllRanges();
    container.remove();
  }

  if (!ok && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(plain);
    return true;
  }
  return ok;
}

async function copyRichText() {
  syncFormToDoc(false);
  const doc = activeDoc();
  const html = await buildRichHtml(doc);
  const plain = plainTextForClipboard(doc);
  const ok = await writeRichClipboard(html, plain);
  els.status.textContent = ok ? "富文本已复制；公众号可直接粘贴，X 图片可能需要手动上传" : "复制失败，请重试";
}

function bindEvents() {
  els.newDoc.addEventListener("click", createDoc);
  els.duplicateDoc.addEventListener("click", duplicateDoc);
  els.exportDocs.addEventListener("click", exportDocuments);
  els.importDocs.addEventListener("change", importDocuments);
  els.deleteDoc.addEventListener("click", deleteDoc);
  els.avatarInput.addEventListener("change", handleAvatar);
  els.imageInput.addEventListener("change", handleImages);
  document.querySelector("[data-action='undo']")?.addEventListener("click", undoDoc);
  els.copyRich.addEventListener("click", copyRichText);
  els.downloadLong.addEventListener("click", downloadLongImage);
  els.downloadAll.addEventListener("click", downloadAll);
  els.replaceToggle.addEventListener("click", () => {
    els.replacePanel.classList.toggle("hidden");
    if (!els.replacePanel.classList.contains("hidden")) {
      els.findInput.focus();
      updateFindStatus();
    }
  });
  els.findInput.addEventListener("input", updateFindStatus);
  els.replaceInput.addEventListener("input", updateFindStatus);
  els.findPrev.addEventListener("click", () => findInContent(-1));
  els.findNext.addEventListener("click", () => findInContent(1));
  els.findInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      findInContent(event.shiftKey ? -1 : 1);
    }
  });
  els.replaceCurrent.addEventListener("click", replaceCurrentMatch);
  els.replaceAll.addEventListener("click", replaceAllMatches);
  els.cropClose.addEventListener("click", closeCropper);
  els.cropReset.addEventListener("click", resetCropper);
  els.cropApply.addEventListener("click", applyCropper);
  els.cropModal.addEventListener("click", (event) => {
    if (event.target === els.cropModal) closeCropper();
  });
  els.ratioButtons.forEach((button) => {
    button.addEventListener("click", () => setCropRatio(button.dataset.ratio));
  });
  els.cropCanvas.addEventListener("mousedown", startCropDrag);
  window.addEventListener("mousemove", moveCropDrag);
  window.addEventListener("mouseup", stopCropDrag);

  document.querySelectorAll("[data-format]").forEach((button) => {
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      rememberContentSelection();
    });
    button.addEventListener("click", () => wrapSelection(button.dataset.format));
  });

  [els.highlightColor, els.inlineColor].forEach((input) => {
    input.addEventListener("mousedown", rememberContentSelection);
    input.addEventListener("focus", rememberContentSelection);
  });

  ["select", "mouseup", "keyup", "focus", "click"].forEach((eventName) => {
    els.content.addEventListener(eventName, () => {
      rememberContentSelection();
      updateFindStatus();
    });
  });

  [els.title, els.author, els.handle, els.textColor, els.accentColor, els.highlightColor, els.inlineColor, els.fontSize, els.lineHeight, els.content].forEach((input) => {
    input.addEventListener("input", () => {
      syncFormToDoc();
      scheduleHistory();
      requestRender();
      if (input === els.content) updateFindStatus();
    });
    input.addEventListener("change", () => {
      syncFormToDoc();
      scheduleHistory();
      requestRender();
      if (input === els.content) updateFindStatus();
    });
  });
}

bindEvents();
loadDocToForm();
renderDocList();
pushHistoryNow();
render();
