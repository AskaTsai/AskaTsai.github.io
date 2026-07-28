const STORE_KEY = "neufis-workbench-v1";
const TRUSTED_DEVICE_KEY = "neufis-unlocked";
const AI_CONSENT_KEY = "neufis-ai-privacy-consent-v1";

const baseModules = [
  { id: "health", name: "健康管理", enabled: true, rules: "体重、排便、运动、饮品热量、健康周报/月报。" },
  { id: "travel", name: "旅行管理", enabled: true, rules: "旅行档案、路线描述、物品清单、截图文本归档。" },
  { id: "wallet", name: "钱包管理", enabled: true, rules: "收入、支出、细分类别、月度账单与消费复盘。" },
  { id: "quotes", name: "端端有话说", enabled: true, rules: "端端趣味语录按日期存档，支持日记体汇总。" },
  { id: "todos", name: "待办事项", enabled: true, rules: "工作待办、生活待办、截止时间、完成状态。" },
  { id: "stocks", name: "股市资讯", enabled: true, rules: "股票观察、资讯摘要、搜索入口、复盘记录。" },
  { id: "projects", name: "备用项目管理模块", enabled: true, rules: "预留空置，可随时定义字段、统计方式或删除。" }
];

const categoryOptions = ["餐饮", "运动", "购物", "服饰", "装饰品", "超市", "交通", "住宿", "旅行", "医疗", "学习", "娱乐", "家庭", "其他"];

const drinkCalories = [
  ["无糖茶", 0],
  ["美式", 10],
  ["黑咖啡", 10],
  ["拿铁", 180],
  ["卡布奇诺", 150],
  ["奶茶", 450],
  ["可乐", 140],
  ["雪碧", 140],
  ["果汁", 120],
  ["牛奶", 150],
  ["酸奶", 170],
  ["啤酒", 150],
  ["红酒", 125],
  ["水", 0]
];

let state = loadState();
let activeModule = state.activeModule || "health";
let deferredInstallPrompt = null;
let pendingCandidate = null;
let pendingAIRequest = null;
let privacyResolver = null;

const els = {
  login: document.getElementById("login"),
  app: document.getElementById("app"),
  passcode: document.getElementById("passcode"),
  loginBtn: document.getElementById("loginBtn"),
  loginError: document.getElementById("loginError"),
  lockBtn: document.getElementById("lockBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsMenu: document.getElementById("settingsMenu"),
  aiSettingsBtn: document.getElementById("aiSettingsBtn"),
  installBtn: document.getElementById("installBtn"),
  moduleNav: document.getElementById("moduleNav"),
  moduleTitle: document.getElementById("moduleTitle"),
  moduleSubtitle: document.getElementById("moduleSubtitle"),
  moduleContent: document.getElementById("moduleContent"),
  quickInput: document.getElementById("quickInput"),
  quickSubmit: document.getElementById("quickSubmit"),
  outputBox: document.getElementById("outputBox"),
  copyOutputBtn: document.getElementById("copyOutputBtn"),
  overviewBtn: document.getElementById("overviewBtn"),
  exportExcelBtn: document.getElementById("exportExcelBtn"),
  importFile: document.getElementById("importFile"),
  aiSettingsDialog: document.getElementById("aiSettingsDialog"),
  aiSettingsForm: document.getElementById("aiSettingsForm"),
  aiProvider: document.getElementById("aiProvider"),
  aiApiKey: document.getElementById("aiApiKey"),
  aiKeyHint: document.getElementById("aiKeyHint"),
  aiBaseUrl: document.getElementById("aiBaseUrl"),
  aiModel: document.getElementById("aiModel"),
  aiCustomFields: document.getElementById("aiCustomFields"),
  aiConnectionStatus: document.getElementById("aiConnectionStatus"),
  clearAIKeyBtn: document.getElementById("clearAIKeyBtn"),
  saveTestAIBtn: document.getElementById("saveTestAIBtn"),
  aiPreviewDialog: document.getElementById("aiPreviewDialog"),
  aiPreviewForm: document.getElementById("aiPreviewForm"),
  aiPreviewTitle: document.getElementById("aiPreviewTitle"),
  aiPreviewSubtitle: document.getElementById("aiPreviewSubtitle"),
  aiPreviewFields: document.getElementById("aiPreviewFields"),
  aiPreviewError: document.getElementById("aiPreviewError"),
  retryAIBtn: document.getElementById("retryAIBtn"),
  aiPrivacyDialog: document.getElementById("aiPrivacyDialog"),
  cancelAIPrivacyBtn: document.getElementById("cancelAIPrivacyBtn"),
  confirmAIPrivacyBtn: document.getElementById("confirmAIPrivacyBtn")
};

init();

function init() {
  bindGlobalEvents();
  initInstallableApp();
  if (localStorage.getItem(TRUSTED_DEVICE_KEY) === "1" || sessionStorage.getItem(TRUSTED_DEVICE_KEY) === "1") {
    localStorage.setItem(TRUSTED_DEVICE_KEY, "1");
    sessionStorage.removeItem(TRUSTED_DEVICE_KEY);
    unlock();
  }
}

function bindGlobalEvents() {
  els.loginBtn.addEventListener("click", tryLogin);
  els.passcode.addEventListener("keydown", (event) => {
    if (event.key === "Enter") tryLogin();
  });
  els.lockBtn.addEventListener("click", () => {
    closeSettingsMenu();
    localStorage.removeItem(TRUSTED_DEVICE_KEY);
    sessionStorage.removeItem(TRUSTED_DEVICE_KEY);
    els.login.classList.remove("hidden");
    els.app.classList.add("hidden");
    els.passcode.value = "";
  });
  els.settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    setSettingsMenu(!els.settingsMenu.classList.contains("open"));
  });
  document.addEventListener("click", (event) => {
    if (!els.settingsMenu.contains(event.target) && event.target !== els.settingsBtn) closeSettingsMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSettingsMenu();
  });
  els.quickSubmit.addEventListener("click", () => handleQuickInput(els.quickInput.value.trim()));
  els.quickInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") handleQuickInput(els.quickInput.value.trim());
  });
  document.querySelectorAll("[data-command]").forEach((btn) => {
    btn.addEventListener("click", () => handleQuickInput(btn.dataset.command));
  });
  els.copyOutputBtn.addEventListener("click", copyOutput);
  els.overviewBtn.addEventListener("click", () => {
    setOutput(renderOverview());
    closeSettingsMenu();
  });
  els.exportExcelBtn.addEventListener("click", () => {
    closeSettingsMenu();
    exportExcel();
  });
  els.importFile.addEventListener("change", (event) => {
    closeSettingsMenu();
    importBackup(event);
  });
  els.aiSettingsBtn.addEventListener("click", openAISettings);
  els.aiProvider.addEventListener("change", () => {
    window.NeufisAI.setActiveProvider(els.aiProvider.value);
    renderAISettings();
  });
  els.aiSettingsForm.addEventListener("submit", saveAndTestAI);
  els.clearAIKeyBtn.addEventListener("click", clearCurrentAIKey);
  document.querySelectorAll(".dialog-close").forEach((button) => button.addEventListener("click", () => els.aiSettingsDialog.close()));
  document.querySelectorAll(".preview-cancel").forEach((button) => button.addEventListener("click", closeCandidatePreview));
  els.aiPreviewForm.addEventListener("submit", confirmCandidate);
  els.retryAIBtn.addEventListener("click", retryAIRecognition);
  els.cancelAIPrivacyBtn.addEventListener("click", () => resolvePrivacy(false));
  els.confirmAIPrivacyBtn.addEventListener("click", () => resolvePrivacy(true));
  els.aiPrivacyDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    resolvePrivacy(false);
  });
}

function setSettingsMenu(open) {
  els.settingsMenu.classList.toggle("open", open);
  els.settingsBtn.setAttribute("aria-expanded", String(open));
  els.settingsBtn.setAttribute("aria-label", open ? "关闭设置" : "打开设置");
}

function closeSettingsMenu() {
  setSettingsMenu(false);
}

function openAISettings() {
  closeSettingsMenu();
  els.aiProvider.value = window.NeufisAI.getConfig().activeProvider;
  renderAISettings();
  els.aiSettingsDialog.showModal();
}

function renderAISettings() {
  const config = window.NeufisAI.getConfig();
  const provider = els.aiProvider.value || config.activeProvider;
  els.aiProvider.value = provider;
  const saved = config.providers[provider];
  els.aiApiKey.value = "";
  els.aiApiKey.placeholder = saved.hasKey ? "留空表示不修改" : "填写新的 API Key";
  els.aiKeyHint.textContent = saved.hasKey ? `已保存：${saved.keyMask}` : "尚未保存";
  els.aiCustomFields.classList.toggle("hidden", provider !== "custom");
  els.aiBaseUrl.value = provider === "custom" ? saved.baseUrl : "";
  els.aiModel.value = provider === "custom" ? saved.model : "";
  const verified = saved.verifiedAt ? new Date(saved.verifiedAt).toLocaleString() : "";
  els.aiConnectionStatus.textContent = verified ? `已验证 · ${verified}` : "尚未验证";
  els.aiConnectionStatus.className = `status-pill${verified ? " good" : ""}`;
}

async function saveAndTestAI(event) {
  event.preventDefault();
  const provider = els.aiProvider.value;
  setButtonBusy(els.saveTestAIBtn, true, "正在测试");
  els.aiConnectionStatus.textContent = "正在连接...";
  els.aiConnectionStatus.className = "status-pill warn";
  try {
    await window.NeufisAI.saveAndTest({
      provider,
      apiKey: els.aiApiKey.value,
      baseUrl: els.aiBaseUrl.value,
      model: els.aiModel.value
    });
    renderAISettings();
    els.aiConnectionStatus.textContent = "连接成功，已启用";
    els.aiConnectionStatus.className = "status-pill good";
  } catch (error) {
    els.aiConnectionStatus.textContent = error.message;
    els.aiConnectionStatus.className = "status-pill warn";
  } finally {
    setButtonBusy(els.saveTestAIBtn, false);
  }
}

function clearCurrentAIKey() {
  const provider = els.aiProvider.value;
  if (!confirm("确认清除当前厂商的 API Key？")) return;
  window.NeufisAI.clearProvider(provider);
  renderAISettings();
}

function setButtonBusy(button, busy, label = "处理中") {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = label;
    button.disabled = true;
    return;
  }
  button.disabled = false;
  if (button.dataset.label) button.textContent = button.dataset.label;
  delete button.dataset.label;
}

function aiIsReady() {
  const config = window.NeufisAI.getConfig();
  return Boolean(config.providers[config.activeProvider]?.verifiedAt);
}

function ensureAIConsent() {
  if (localStorage.getItem(AI_CONSENT_KEY) === "1") return Promise.resolve(true);
  if (privacyResolver) return Promise.resolve(false);
  els.aiPrivacyDialog.showModal();
  return new Promise((resolve) => {
    privacyResolver = resolve;
  });
}

function resolvePrivacy(accepted) {
  if (accepted) localStorage.setItem(AI_CONSENT_KEY, "1");
  if (els.aiPrivacyDialog.open) els.aiPrivacyDialog.close();
  const resolve = privacyResolver;
  privacyResolver = null;
  if (resolve) resolve(accepted);
}

async function runAI(request) {
  if (!aiIsReady()) throw new Error("AI 尚未配置。请在设置中填写 API Key 并完成连接测试。");
  if (!(await ensureAIConsent())) throw new Error("已取消 AI 请求。");
  return window.NeufisAI.runTask(request);
}

async function requestCandidate(request, button = els.quickSubmit) {
  setButtonBusy(button, true, "AI 识别中");
  try {
    const result = await request();
    showCandidatePreview(result, request);
  } catch (error) {
    setOutput(`AI 处理失败：${error.message}\n\n本地记录、报表和 Excel 功能仍可正常使用。`);
  } finally {
    setButtonBusy(button, false);
  }
}

function resizeImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return Promise.reject(new Error("请选择有效的图片文件。"));
  if (file.size > 15 * 1024 * 1024) return Promise.reject(new Error("图片不能超过 15 MB。"));
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { alpha: false });
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        reject(new Error("图片处理失败，请更换 JPG 或 PNG 图片。"));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片，请更换 JPG 或 PNG 图片。"));
    };
    image.src = url;
  });
}

function initInstallableApp() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.classList.remove("hidden");
  });

  els.installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    closeSettingsMenu();
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.classList.add("hidden");
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    els.installBtn.classList.add("hidden");
  });
}

function tryLogin() {
  if (els.passcode.value.trim() === expectedCode()) {
    localStorage.setItem(TRUSTED_DEVICE_KEY, "1");
    unlock();
    return;
  }
  els.loginError.textContent = "验证码不正确，请重新输入。";
}

function unlock() {
  els.login.classList.add("hidden");
  els.app.classList.remove("hidden");
  renderNav();
  setActiveModule(activeModule);
  setOutput(renderOverview());
}

function expectedCode() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `20230306${yyyy}${mm}${dd}`;
}

function loadState() {
  const blank = {
    version: 1,
    createdAt: new Date().toISOString(),
    activeModule: "health",
    settings: { heightCm: "" },
    modules: baseModules,
    data: {
      health: [],
      travel: [],
      wallet: [],
      quotes: [],
      todos: [],
      stocks: [],
      projects: []
    },
    lastEntry: null
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!saved) return blank;
    saved.modules = mergeModules(saved.modules || []);
    saved.data = { ...blank.data, ...(saved.data || {}) };
    saved.settings = { ...blank.settings, ...(saved.settings || {}) };
    return saved;
  } catch {
    return blank;
  }
}

function mergeModules(savedModules) {
  const savedMap = new Map(savedModules.map((item) => [item.id, item]));
  const merged = baseModules.map((mod) => ({ ...mod, ...(savedMap.get(mod.id) || {}) }));
  savedModules.forEach((mod) => {
    if (!merged.some((item) => item.id === mod.id)) merged.push(mod);
  });
  return merged;
}

function saveState() {
  state.activeModule = activeModule;
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderNav() {
  els.moduleNav.innerHTML = state.modules
    .filter((mod) => mod.enabled)
    .map((mod) => {
      const count = getModuleCount(mod.id);
      return `<button class="nav-btn ${activeModule === mod.id ? "active" : ""}" data-id="${mod.id}">
        <span>${escapeHtml(mod.name)}</span><small>${count}</small>
      </button>`;
    })
    .join("");
  els.moduleNav.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveModule(btn.dataset.id));
  });
}

function getModule(id) {
  return state.modules.find((mod) => mod.id === id);
}

function getModuleCount(id) {
  const data = state.data[id];
  return Array.isArray(data) ? data.length : 0;
}

function setActiveModule(id) {
  activeModule = id;
  const mod = getModule(id);
  els.moduleTitle.textContent = mod?.name || "工作台";
  els.moduleSubtitle.textContent = mod?.rules || "可新增、删除、修改模块规则。";
  renderNav();
  renderActiveModule();
  saveState();
}

function renderActiveModule() {
  const renderers = {
    health: renderHealth,
    travel: renderTravel,
    wallet: renderWallet,
    quotes: renderQuotes,
    todos: renderTodos,
    stocks: renderStocks,
    projects: renderGenericModule
  };
  (renderers[activeModule] || renderGenericModule)();
}

function setOutput(markdown) {
  els.outputBox.textContent = markdown || "无输出。";
}

function markdownTable(headers, rows) {
  const clean = (value) => String(value ?? "").replace(/\n/g, " ").replace(/\|/g, "\\|");
  const head = `| ${headers.map(clean).join(" | ")} |`;
  const line = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(clean).join(" | ")} |`);
  return [head, line, ...body].join("\n");
}

function candidateFields(moduleId) {
  const definitions = {
    health: [
      ["date", "日期", "date"],
      ["heightCm", "身高 cm", "number"],
      ["weight", "体重 kg", "number"],
      ["bowel", "排便", "select", ["", "是", "否"]],
      ["exerciseDone", "运动", "select", ["", "是", "否"]],
      ["exerciseType", "运动类型", "text"],
      ["drinkText", "饮品信息", "text", [], "full"],
      ["calories", "估算热量 kcal", "number"]
    ],
    travel: [
      ["startDate", "开始时间", "date"],
      ["endDate", "结束时间", "date"],
      ["destination", "目的地", "text"],
      ["companions", "同行人", "text"],
      ["lodging", "住宿信息", "text", [], "wide"],
      ["transport", "交通", "text"],
      ["itineraryText", "逐日行程", "textarea", [], "full"],
      ["route", "路线描述", "textarea", [], "full"],
      ["packing", "物品清单", "textarea", [], "full"],
      ["notes", "备注", "textarea", [], "full"]
    ],
    wallet: [
      ["date", "日期", "date"],
      ["kind", "类型", "select", ["expense", "income"]],
      ["amount", "金额", "number"],
      ["category", "类别", "select", categoryOptions],
      ["note", "备注", "text", [], "wide"]
    ],
    quotes: [
      ["date", "日期", "date"],
      ["quote", "语录", "textarea", [], "full"],
      ["context", "场景", "textarea", [], "full"]
    ],
    todos: [
      ["category", "分类", "select", ["工作待办", "生活待办"]],
      ["due", "截止时间", "date"],
      ["content", "事项内容", "textarea", [], "full"]
    ],
    stocks: [
      ["date", "日期", "date"],
      ["symbol", "股票/指数", "text"],
      ["title", "标题", "text", [], "wide"],
      ["source", "来源", "text"],
      ["summary", "摘要/观点", "textarea", [], "full"]
    ],
    generic: [
      ["date", "日期", "date"],
      ["title", "标题", "text", [], "wide"],
      ["content", "内容", "textarea", [], "full"]
    ]
  };
  return definitions[moduleId] || definitions.generic;
}

function showCandidatePreview({ module, data, title, subtitle }, retryRequest) {
  const mod = getModule(module);
  if (!mod || !mod.enabled) throw new Error("AI 返回了未启用的模块，未生成记录。");
  pendingCandidate = { module, data: normalizeCandidate(module, data) };
  pendingAIRequest = retryRequest || null;
  els.aiPreviewTitle.textContent = title || `确认 ${mod.name} 识别结果`;
  els.aiPreviewSubtitle.textContent = subtitle || "内容由 AI 提取，可编辑；确认前不会写入工作台。";
  els.aiPreviewError.textContent = "";
  els.retryAIBtn.classList.toggle("hidden", !pendingAIRequest);
  els.aiPreviewFields.replaceChildren();
  candidateFields(module).forEach(([name, label, type, options = [], width = ""]) => {
    const wrapper = document.createElement("div");
    wrapper.className = `field ${width}`.trim();
    const labelNode = document.createElement("label");
    labelNode.htmlFor = `candidate-${name}`;
    labelNode.textContent = label;
    let control;
    if (type === "textarea") {
      control = document.createElement("textarea");
      control.rows = 3;
    } else if (type === "select") {
      control = document.createElement("select");
      options.forEach((option) => {
        const optionNode = document.createElement("option");
        optionNode.value = option;
        optionNode.textContent = option || "未记录";
        control.append(optionNode);
      });
    } else {
      control = document.createElement("input");
      control.type = type;
      if (type === "number") control.step = "any";
    }
    control.id = `candidate-${name}`;
    control.name = name;
    const value = pendingCandidate.data[name];
    control.value = Array.isArray(value) ? value.join("\n") : value ?? "";
    wrapper.append(labelNode, control);
    els.aiPreviewFields.append(wrapper);
  });
  if (!els.aiPreviewDialog.open) els.aiPreviewDialog.showModal();
}

function closeCandidatePreview() {
  pendingCandidate = null;
  pendingAIRequest = null;
  els.aiPreviewError.textContent = "";
  if (els.aiPreviewDialog.open) els.aiPreviewDialog.close();
}

function normalizeCandidate(moduleId, raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {};
  candidateFields(moduleId).forEach(([name, , type]) => {
    let value = source[name];
    if (name === "packing" && Array.isArray(value)) value = value.join("\n");
    if (type === "number") value = value === "" || value == null ? "" : Number(value);
    else value = value == null ? "" : String(value);
    out[name] = value;
  });
  if ((moduleId === "health" || moduleId === "wallet" || moduleId === "stocks") && !out.date) out.date = today();
  if (moduleId === "wallet" && !["income", "expense"].includes(out.kind)) out.kind = "expense";
  if (moduleId === "wallet" && !categoryOptions.includes(out.category)) out.category = "其他";
  if (moduleId === "todos" && !["工作待办", "生活待办"].includes(out.category)) out.category = "工作待办";
  return out;
}

function readCandidateForm() {
  const form = new FormData(els.aiPreviewForm);
  const data = {};
  candidateFields(pendingCandidate.module).forEach(([name, , type]) => {
    const value = String(form.get(name) || "").trim();
    data[name] = type === "number" && value !== "" ? Number(value) : value;
  });
  return data;
}

function validateCandidate(moduleId, data) {
  const validDate = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
  const dateFields = ["date", "startDate", "endDate", "due"];
  if (dateFields.some((field) => field in data && !validDate(data[field]))) return "日期必须使用 YYYY-MM-DD 格式。";
  if (moduleId === "wallet") {
    if (!Number.isFinite(data.amount) || data.amount <= 0) return "账目金额必须是大于 0 的数字。";
    if (!["income", "expense"].includes(data.kind)) return "账目类型不正确。";
    if (!categoryOptions.includes(data.category)) return "账目类别不正确。";
  }
  if (moduleId === "health") {
    if (data.weight !== "" && (!Number.isFinite(data.weight) || data.weight <= 0)) return "体重必须是大于 0 的数字。";
    if (data.calories !== "" && (!Number.isFinite(data.calories) || data.calories < 0)) return "饮品热量必须是非负数字。";
    if (data.bowel && !["是", "否"].includes(data.bowel)) return "排便只能记录是或否。";
    if (data.exerciseDone && !["是", "否"].includes(data.exerciseDone)) return "运动只能记录是或否。";
  }
  if (moduleId === "travel" && !data.destination) return "请补充旅行目的地。";
  if (moduleId === "quotes" && !data.quote) return "请补充语录内容。";
  if (moduleId === "todos" && !data.content) return "请补充待办内容。";
  if (moduleId === "stocks" && !data.title) return "请补充资讯标题。";
  if (!["health", "travel", "wallet", "quotes", "todos", "stocks"].includes(moduleId) && !data.title) return "请补充记录标题。";
  return "";
}

function confirmCandidate(event) {
  event.preventDefault();
  if (!pendingCandidate) return;
  const data = readCandidateForm();
  const error = validateCandidate(pendingCandidate.module, data);
  if (error) {
    els.aiPreviewError.textContent = error;
    return;
  }
  const moduleId = pendingCandidate.module;
  commitCandidate(moduleId, data);
  closeCandidatePreview();
}

async function retryAIRecognition() {
  if (!pendingAIRequest) return;
  setButtonBusy(els.retryAIBtn, true, "识别中");
  els.aiPreviewError.textContent = "";
  try {
    const result = await pendingAIRequest();
    showCandidatePreview(result, pendingAIRequest);
  } catch (error) {
    els.aiPreviewError.textContent = error.message;
  } finally {
    setButtonBusy(els.retryAIBtn, false);
  }
}

function commitCandidate(moduleId, data) {
  let item;
  if (moduleId === "health") {
    if (data.heightCm) state.settings.heightCm = data.heightCm;
    const date = data.date || today();
    item = state.data.health.find((record) => record.date === date);
    if (!item) {
      item = { id: uid("health"), date, drinks: [], createdAt: new Date().toISOString() };
      state.data.health.push(item);
    }
    ["weight", "bowel", "exerciseDone", "exerciseType"].forEach((field) => {
      if (data[field] !== "") item[field] = data[field];
    });
    item.drinks = item.drinks || [];
    if (data.drinkText) item.drinks.push({ text: data.drinkText, calories: data.calories, source: "AI 估算" });
  } else if (moduleId === "travel") {
    item = {
      id: uid("travel"),
      startDate: data.startDate,
      endDate: data.endDate,
      destination: data.destination,
      companions: data.companions,
      lodging: data.lodging,
      transport: data.transport,
      itineraryText: data.itineraryText,
      route: data.route,
      notes: data.notes,
      packingList: splitList(data.packing).map((name) => ({ id: uid("pack"), name, checked: false })),
      createdAt: new Date().toISOString()
    };
    if (!item.route) item.route = makeRoute(item);
    state.data.travel.push(item);
  } else if (moduleId === "wallet") {
    item = { id: uid("wallet"), ...data, createdAt: new Date().toISOString() };
    state.data.wallet.push(item);
  } else if (moduleId === "quotes") {
    item = { id: uid("quote"), date: data.date || today(), quote: data.quote, context: data.context, createdAt: new Date().toISOString() };
    state.data.quotes.push(item);
  } else if (moduleId === "todos") {
    item = { id: uid("todo"), ...data, done: false, createdAt: new Date().toISOString() };
    state.data.todos.push(item);
  } else if (moduleId === "stocks") {
    item = { id: uid("stock"), ...data, date: data.date || today(), createdAt: new Date().toISOString() };
    state.data.stocks.push(item);
  } else {
    item = { id: uid(moduleId), ...data, date: data.date || today(), createdAt: new Date().toISOString() };
    state.data[moduleId] = state.data[moduleId] || [];
    state.data[moduleId].push(item);
  }
  state.lastEntry = { module: moduleId, id: item.id };
  saveState();
  setActiveModule(moduleId);
  setOutput(`# 已保存\n\n${markdownTable(["模块", "记录ID", "来源"], [[getModule(moduleId)?.name || moduleId, item.id, "AI 识别并确认"]])}`);
}

function renderOverview() {
  const rows = state.modules
    .filter((mod) => mod.enabled)
    .map((mod) => [mod.name, getModuleCount(mod.id), latestSummary(mod.id), mod.rules || ""]);
  return `# 工作台总览\n\n${markdownTable(["模块", "记录数", "最新数据", "规则"], rows)}`;
}

function latestSummary(id) {
  const list = state.data[id] || [];
  const item = list[list.length - 1];
  if (!item) return "暂无";
  if (id === "health") return `${item.date || ""} 体重${item.weight || "-"}kg 运动${item.exerciseDone || "-"}`;
  if (id === "travel") return `${item.destination || "未填目的地"} ${item.startDate || ""}`;
  if (id === "wallet") return `${item.date || ""} ${item.kind === "income" ? "收入" : "支出"} ${item.amount || 0}`;
  if (id === "quotes") return `${item.date || ""} ${item.quote || ""}`.slice(0, 36);
  if (id === "todos") return `${item.done ? "已完成" : "未完成"} ${item.content || ""}`.slice(0, 36);
  if (id === "stocks") return `${item.symbol || ""} ${item.title || ""}`.slice(0, 36);
  return `${item.date || item.createdAt || ""} ${item.content || item.title || ""}`.slice(0, 36);
}

function renderHealth() {
  els.moduleContent.innerHTML = `
    <section class="module-section">
      <h3>健康记录</h3>
      <form id="healthForm" class="grid">
        <div class="field"><label>日期</label><input name="date" type="date" value="${today()}"></div>
        <div class="field"><label>身高 cm（用于 BMI）</label><input name="heightCm" type="number" step="0.1" value="${escapeHtml(state.settings.heightCm)}"></div>
        <div class="field"><label>体重 kg</label><input name="weight" type="number" step="0.1" placeholder="70.5"></div>
        <div class="field"><label>排便</label><select name="bowel"><option value="">未记录</option><option>是</option><option>否</option></select></div>
        <div class="field"><label>运动</label><select name="exerciseDone"><option value="">未记录</option><option>是</option><option>否</option></select></div>
        <div class="field"><label>运动类型</label><input name="exerciseType" placeholder="羽毛球"></div>
        <div class="field full"><label>饮品记录</label><input name="drinkText" placeholder="例如：一杯拿铁、无糖茶、可乐 330ml"></div>
        <div class="field full"><label>饮品图片/截图（AI 识别）</label><input name="drinkImage" type="file" accept="image/*"></div>
        <div class="field full actions">
          <button class="primary" type="submit">保存健康记录</button>
          <button type="button" id="healthWeek">健康周报</button>
          <button type="button" id="healthMonth">健康月报</button>
        </div>
      </form>
      ${healthTable()}
    </section>`;
  document.getElementById("healthForm").addEventListener("submit", saveHealth);
  document.getElementById("healthWeek").addEventListener("click", () => generateHealthReport("week"));
  document.getElementById("healthMonth").addEventListener("click", () => generateHealthReport("month"));
  bindTableActions("health");
}

async function saveHealth(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const date = form.get("date") || today();
  const drinkText = (form.get("drinkText") || "").trim();
  const imageFile = form.get("drinkImage");
  const estimated = drinkText ? estimateDrinkCalories(drinkText) : { calories: "", source: "" };
  const needsAI = Boolean(imageFile?.name) || (drinkText && estimated.source === "未匹配，可点搜索核对");
  if (needsAI && aiIsReady()) {
    const baseData = {
      date,
      heightCm: form.get("heightCm") || "",
      weight: form.get("weight") || "",
      bowel: form.get("bowel") || "",
      exerciseDone: form.get("exerciseDone") || "",
      exerciseType: form.get("exerciseType") || ""
    };
    const request = async () => {
      const imageDataUrl = imageFile?.name ? await resizeImageFile(imageFile) : "";
      const result = await runAI({
        task: "drink_extract",
        input: drinkText,
        context: { existingFields: baseData, calorieMeaning: "整杯估算 kcal" },
        imageDataUrl
      });
      const description = [result.name, result.specification, result.sugar].filter(Boolean).join(" ") || drinkText;
      return {
        module: "health",
        data: { ...baseData, drinkText: description, calories: result.calories ?? "" },
        title: "确认饮品识别结果",
        subtitle: "热量为 AI 估算值，可修改；确认前不会保存图片或记录。"
      };
    };
    await requestCandidate(request, event.submitter);
    return;
  }
  if (imageFile?.name) {
    setOutput("图片尚未处理。请先在设置中配置支持图片的 Kimi 或通义千问，再重新提交。");
    return;
  }
  state.settings.heightCm = form.get("heightCm") || "";
  let item = state.data.health.find((record) => record.date === date);
  if (!item) {
    item = { id: uid("health"), date, drinks: [], createdAt: new Date().toISOString() };
    state.data.health.push(item);
  }
  const weight = form.get("weight");
  if (weight) item.weight = Number(weight);
  if (form.get("bowel")) item.bowel = form.get("bowel");
  if (form.get("exerciseDone")) item.exerciseDone = form.get("exerciseDone");
  if (form.get("exerciseType")) item.exerciseType = form.get("exerciseType");
  if (drinkText) {
    item.drinks.push({ text: drinkText, calories: estimated.calories, source: estimated.source });
  }
  state.lastEntry = { module: "health", id: item.id };
  saveState();
  renderHealth();
  setOutput(healthReport("week"));
}

function healthTable() {
  const rows = [...state.data.health].sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return `<p class="muted">暂无健康记录。</p>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>日期</th><th>体重</th><th>排便</th><th>运动</th><th>饮品</th><th>BMI</th><th>操作</th></tr></thead>
    <tbody>${rows
      .map((item) => `<tr>
        <td>${item.date}</td>
        <td>${item.weight || ""}</td>
        <td>${item.bowel || ""}</td>
        <td>${item.exerciseDone || ""}${item.exerciseType ? ` / ${escapeHtml(item.exerciseType)}` : ""}</td>
        <td>${formatDrinks(item.drinks)}</td>
        <td>${calcBmi(item.weight)}</td>
        <td>${rowActions("health", item.id)}</td>
      </tr>`)
      .join("")}</tbody>
  </table></div>`;
}

function formatDrinks(drinks = []) {
  if (!drinks.length) return "";
  return drinks.map((drink) => `${escapeHtml(drink.text)}${drink.calories !== "" && drink.calories != null ? `（${drink.calories} kcal）` : ""}`).join("<br>");
}

function estimateDrinkCalories(text) {
  const explicit = text.match(/(\d+)\s*(kcal|卡|大卡)/i);
  if (explicit) return { calories: Number(explicit[1]), source: "手动录入" };
  const found = drinkCalories.find(([key]) => text.includes(key));
  if (!found) return { calories: "", source: "未匹配，可点搜索核对" };
  let calories = found[1];
  if (text.includes("无糖") || text.includes("少糖")) calories = Math.round(calories * 0.55);
  if (text.includes("大杯")) calories = Math.round(calories * 1.25);
  if (text.includes("小杯")) calories = Math.round(calories * 0.75);
  return { calories, source: "内置估算" };
}

function calcBmi(weight) {
  const height = Number(state.settings.heightCm);
  if (!weight || !height) return "";
  return (Number(weight) / (height / 100) ** 2).toFixed(1);
}

function healthReport(period) {
  const records = filterByPeriod(state.data.health, period);
  const title = period === "week" ? "健康周报" : "健康月报";
  if (!records.length) return `# ${title}\n\n暂无本${period === "week" ? "周" : "月"}健康记录。`;
  const rows = records
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => [
      item.date,
      item.weight || "",
      item.bowel || "",
      item.exerciseDone || "",
      item.exerciseType || "",
      sumCalories(item.drinks),
      calcBmi(item.weight)
    ]);
  const weights = records.map((item) => Number(item.weight)).filter(Boolean);
  const exerciseDays = records.filter((item) => item.exerciseDone === "是").length;
  const avgWeight = weights.length ? (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1) : "-";
  const trend = weights.length > 1 ? `${weights[0]} -> ${weights[weights.length - 1]} kg` : "-";
  return `# ${title}\n\n平均体重：${avgWeight} kg\n运动天数：${exerciseDays} 天\n体重趋势：${trend}\n\n${markdownTable(["日期", "体重kg", "排便", "运动", "运动类型", "饮品热量kcal", "BMI"], rows)}`;
}

async function generateHealthReport(period) {
  const local = healthReport(period);
  setOutput(local);
  if (!aiIsReady() || !filterByPeriod(state.data.health, period).length) return;
  try {
    const review = await runAI({ task: "health_review", context: { report: local } });
    setOutput(`${local}\n\n## AI 简要复盘\n\n${review}`);
  } catch {
    setOutput(local);
  }
}

function filterByPeriod(list, period) {
  const now = new Date();
  const current = today();
  if (period === "month") return list.filter((item) => (item.date || "").slice(0, 7) === current.slice(0, 7));
  const monday = new Date(now);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return list.filter((item) => new Date(item.date) >= monday);
}

function sumCalories(drinks = []) {
  const total = drinks.reduce((sum, drink) => sum + (Number(drink.calories) || 0), 0);
  return total || "";
}

function renderTravel() {
  els.moduleContent.innerHTML = `
    <section class="module-section">
      <h3>旅行档案</h3>
      <form id="travelForm" class="grid">
        <div class="field"><label>开始时间</label><input name="startDate" type="date"></div>
        <div class="field"><label>结束时间</label><input name="endDate" type="date"></div>
        <div class="field"><label>目的地</label><input name="destination" placeholder="可由截图识别"></div>
        <div class="field"><label>同行人</label><input name="companions"></div>
        <div class="field wide"><label>住宿信息</label><input name="lodging"></div>
        <div class="field"><label>交通</label><input name="transport"></div>
        <div class="field full"><label>行程安排</label><textarea name="itinerary" rows="4" placeholder="一天一行：2026-08-01 西湖、灵隐寺"></textarea></div>
        <div class="field full"><label>截图识别文本/备注</label><textarea name="notes" rows="3" placeholder="可粘贴截图 OCR 后的文字，或保存重要备注。"></textarea></div>
        <div class="field full"><label>行程截图（AI 识别）</label><input name="travelImage" type="file" accept="image/*"></div>
        <div class="field full"><label>物品清单（逗号或换行分隔）</label><textarea name="packing" rows="2" placeholder="身份证、充电器、雨伞"></textarea></div>
        <div class="field full actions"><button class="primary" type="submit">保存旅行</button><button type="button" id="travelSummary">汇总全部旅行清单</button></div>
      </form>
      ${travelTable()}
    </section>`;
  document.getElementById("travelForm").addEventListener("submit", saveTravel);
  document.getElementById("travelSummary").addEventListener("click", () => setOutput(travelSummary()));
  bindTableActions("travel");
  bindPackingActions();
}

async function saveTravel(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const imageFile = form.get("travelImage");
  if (imageFile?.name) {
    if (!aiIsReady()) {
      setOutput("图片尚未处理。请先在设置中配置支持图片的 Kimi 或通义千问，再重新提交。");
      return;
    }
    const existing = {
      startDate: form.get("startDate") || "",
      endDate: form.get("endDate") || "",
      destination: form.get("destination") || "",
      companions: form.get("companions") || "",
      lodging: form.get("lodging") || "",
      transport: form.get("transport") || "",
      itineraryText: form.get("itinerary") || "",
      notes: form.get("notes") || "",
      packing: form.get("packing") || ""
    };
    const request = async () => {
      const imageDataUrl = await resizeImageFile(imageFile);
      const result = await runAI({ task: "travel_extract", input: existing.notes, context: { existingFields: existing }, imageDataUrl });
      return {
        module: "travel",
        data: { ...result, ...Object.fromEntries(Object.entries(existing).filter(([, value]) => value)), route: result.route || "" },
        title: "确认旅行截图识别结果"
      };
    };
    await requestCandidate(request, event.submitter);
    return;
  }
  if (!form.get("destination")) {
    setOutput("请填写旅行目的地，或上传行程截图交给 AI 识别。");
    return;
  }
  const trip = {
    id: uid("travel"),
    startDate: form.get("startDate"),
    endDate: form.get("endDate"),
    destination: form.get("destination"),
    companions: form.get("companions"),
    lodging: form.get("lodging"),
    transport: form.get("transport"),
    itineraryText: form.get("itinerary"),
    notes: form.get("notes"),
    packingList: splitList(form.get("packing")).map((name) => ({ id: uid("pack"), name, checked: false })),
    createdAt: new Date().toISOString()
  };
  trip.route = makeRoute(trip);
  state.data.travel.push(trip);
  state.lastEntry = { module: "travel", id: trip.id };
  saveState();
  renderTravel();
  setOutput(singleTripMarkdown(trip));
}

function splitList(value) {
  return String(value || "")
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function makeRoute(trip) {
  const spots = splitList(trip.itineraryText.replace(/\d{4}-\d{2}-\d{2}/g, ""));
  const unique = [...new Set(spots)];
  return unique.length ? `${trip.destination}路线：${unique.join(" -> ")}` : `${trip.destination}旅行路线待补充。`;
}

function travelTable() {
  const rows = [...state.data.travel].sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  if (!rows.length) return `<p class="muted">暂无旅行档案。</p>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>时间</th><th>目的地</th><th>同行人</th><th>住宿</th><th>交通</th><th>路线</th><th>物品清单</th><th>操作</th></tr></thead>
    <tbody>${rows
      .map((item) => `<tr>
        <td>${item.startDate || ""} 至 ${item.endDate || ""}</td>
        <td>${escapeHtml(item.destination)}</td>
        <td>${escapeHtml(item.companions)}</td>
        <td>${escapeHtml(item.lodging)}</td>
        <td>${escapeHtml(item.transport)}</td>
        <td>${escapeHtml(item.route)}</td>
        <td>${packingHtml(item)}</td>
        <td>${rowActions("travel", item.id)}<button data-trip="${item.id}" class="search-map">搜地图</button></td>
      </tr>`)
      .join("")}</tbody>
  </table></div>`;
}

function packingHtml(trip) {
  if (!trip.packingList?.length) return "";
  return `<div class="packing-list">${trip.packingList
    .map((item) => `<label class="check-line"><input type="checkbox" data-pack-trip="${trip.id}" data-pack-id="${item.id}" ${item.checked ? "checked" : ""}>${escapeHtml(item.name)}</label>`)
    .join("")}</div>`;
}

function bindPackingActions() {
  document.querySelectorAll("[data-pack-trip]").forEach((input) => {
    input.addEventListener("change", () => {
      const trip = state.data.travel.find((item) => item.id === input.dataset.packTrip);
      const pack = trip?.packingList.find((item) => item.id === input.dataset.packId);
      if (pack) pack.checked = input.checked;
      saveState();
      setOutput(singleTripMarkdown(trip));
    });
  });
  document.querySelectorAll(".search-map").forEach((btn) => {
    btn.addEventListener("click", () => {
      const trip = state.data.travel.find((item) => item.id === btn.dataset.trip);
      const query = encodeURIComponent(`${trip.destination} ${trip.itineraryText || ""} 地图`);
      window.open(`https://www.bing.com/images/search?q=${query}`, "_blank");
    });
  });
}

function singleTripMarkdown(trip) {
  return `# ${trip.destination || "旅行档案"}\n\n${markdownTable(
    ["字段", "内容"],
    [
      ["起止时间", `${trip.startDate || ""} 至 ${trip.endDate || ""}`],
      ["目的地", trip.destination || ""],
      ["同行人", trip.companions || ""],
      ["住宿", trip.lodging || ""],
      ["交通", trip.transport || ""],
      ["路线", trip.route || ""],
      ["行程", trip.itineraryText || ""],
      ["物品清单", (trip.packingList || []).map((item) => `${item.checked ? "[x]" : "[ ]"} ${item.name}`).join("；")],
      ["备注", trip.notes || ""]
    ]
  )}`;
}

function travelSummary() {
  const rows = state.data.travel.map((trip) => [trip.startDate || "", trip.endDate || "", trip.destination || "", trip.companions || "", trip.route || ""]);
  return `# 全部旅行清单\n\n${rows.length ? markdownTable(["开始", "结束", "目的地", "同行人", "路线"], rows) : "暂无旅行档案。"}`;
}

function renderWallet() {
  els.moduleContent.innerHTML = `
    <section class="module-section">
      <h3>收支记账</h3>
      <form id="walletForm" class="grid">
        <div class="field"><label>日期</label><input name="date" type="date" value="${today()}"></div>
        <div class="field"><label>类型</label><select name="kind"><option value="expense">支出</option><option value="income">收入</option></select></div>
        <div class="field"><label>金额</label><input name="amount" type="number" step="0.01" required></div>
        <div class="field"><label>类别</label><select name="category">${categoryOptions.map((cat) => `<option>${cat}</option>`).join("")}</select></div>
        <div class="field wide"><label>备注</label><input name="note"></div>
        <div class="field full actions"><button class="primary" type="submit">保存账目</button><button type="button" id="monthBill">月度账单</button></div>
      </form>
      ${walletTable()}
    </section>`;
  document.getElementById("walletForm").addEventListener("submit", saveWallet);
  document.getElementById("monthBill").addEventListener("click", generateWalletReport);
  bindTableActions("wallet");
}

function saveWallet(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = {
    id: uid("wallet"),
    date: form.get("date") || today(),
    kind: form.get("kind"),
    amount: Number(form.get("amount")),
    category: form.get("category"),
    note: form.get("note"),
    createdAt: new Date().toISOString()
  };
  state.data.wallet.push(item);
  state.lastEntry = { module: "wallet", id: item.id };
  saveState();
  renderWallet();
  setOutput(walletReport());
}

function walletTable() {
  const rows = [...state.data.wallet].sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return `<p class="muted">暂无收支记录。</p>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>日期</th><th>类型</th><th>金额</th><th>类别</th><th>备注</th><th>操作</th></tr></thead>
    <tbody>${rows
      .map((item) => `<tr>
        <td>${item.date}</td><td>${item.kind === "income" ? "收入" : "支出"}</td><td>${item.amount.toFixed(2)}</td>
        <td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.note)}</td><td>${rowActions("wallet", item.id)}</td>
      </tr>`)
      .join("")}</tbody>
  </table></div>`;
}

function walletReport() {
  const month = today().slice(0, 7);
  const records = state.data.wallet.filter((item) => item.date?.startsWith(month));
  const income = records.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = records.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  const byCat = {};
  records.filter((item) => item.kind === "expense").forEach((item) => {
    byCat[item.category] = (byCat[item.category] || 0) + item.amount;
  });
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, value]) => [cat, value.toFixed(2), expense ? `${((value / expense) * 100).toFixed(1)}%` : "0%"]);
  const top = catRows[0]?.[0] || "暂无";
  return `# ${month} 月度账单\n\n${markdownTable(["总收入", "总支出", "结余", "最高花销类目"], [[income.toFixed(2), expense.toFixed(2), (income - expense).toFixed(2), top]])}\n\n## 类目占比\n\n${catRows.length ? markdownTable(["类别", "支出", "占比"], catRows) : "暂无支出。"}\n\n复盘：本月花销占比最高为「${top}」，可优先检查该类目是否有可调整项目。`;
}

async function generateWalletReport() {
  const local = walletReport();
  setOutput(local);
  if (!aiIsReady() || !state.data.wallet.length) return;
  try {
    const review = await runAI({ task: "wallet_review", context: { report: local } });
    setOutput(`${local}\n\n## AI 消费复盘\n\n${review}`);
  } catch {
    setOutput(local);
  }
}

function renderQuotes() {
  els.moduleContent.innerHTML = `
    <section class="module-section">
      <h3>端端有话说</h3>
      <form id="quoteForm" class="grid">
        <div class="field"><label>日期</label><input name="date" type="date" value="${today()}"></div>
        <div class="field wide"><label>语录</label><input name="quote" required placeholder="端端说了什么"></div>
        <div class="field full"><label>场景备注</label><textarea name="context" rows="2"></textarea></div>
        <div class="field full actions"><button class="primary" type="submit">保存语录</button><button type="button" id="quoteDiary">汇总日记</button></div>
      </form>
      ${quoteTable()}
    </section>`;
  document.getElementById("quoteForm").addEventListener("submit", saveQuote);
  document.getElementById("quoteDiary").addEventListener("click", generateQuoteDiary);
  bindTableActions("quotes");
}

function saveQuote(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = {
    id: uid("quote"),
    date: form.get("date") || today(),
    quote: form.get("quote"),
    context: form.get("context"),
    createdAt: new Date().toISOString()
  };
  state.data.quotes.push(item);
  state.lastEntry = { module: "quotes", id: item.id };
  saveState();
  renderQuotes();
  setOutput(quoteDiary());
}

function quoteTable() {
  const rows = [...state.data.quotes].sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return `<p class="muted">暂无端端语录。</p>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>日期</th><th>语录</th><th>场景</th><th>操作</th></tr></thead>
    <tbody>${rows
      .map((item) => `<tr><td>${item.date}</td><td>${escapeHtml(item.quote)}</td><td>${escapeHtml(item.context)}</td><td>${rowActions("quotes", item.id)}</td></tr>`)
      .join("")}</tbody>
  </table></div>`;
}

function quoteDiary() {
  if (!state.data.quotes.length) return "# 端端语录日记\n\n暂无语录。";
  const paragraphs = [...state.data.quotes]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => `${item.date}，${item.context ? `${item.context}，` : ""}端端说：“${item.quote}”`);
  return `# 端端语录日记\n\n${paragraphs.join("\n\n")}`;
}

async function generateQuoteDiary() {
  const local = quoteDiary();
  setOutput(local);
  if (!aiIsReady() || !state.data.quotes.length) return;
  try {
    const diary = await runAI({ task: "quote_diary", context: { quotes: state.data.quotes.map(({ date, quote, context }) => ({ date, quote, context })) } });
    setOutput(`# 端端语录日记\n\n${diary}`);
  } catch {
    setOutput(local);
  }
}

function renderTodos() {
  els.moduleContent.innerHTML = `
    <section class="module-section">
      <h3>待办事项</h3>
      <form id="todoForm" class="grid">
        <div class="field"><label>分类</label><select name="category"><option>工作待办</option><option>生活待办</option></select></div>
        <div class="field"><label>截止时间</label><input name="due" type="date"></div>
        <div class="field wide"><label>事项内容</label><input name="content" required></div>
        <div class="field full actions"><button class="primary" type="submit">新增待办</button><button type="button" id="allTodos">全部待办</button><button type="button" id="openTodos">仅未完成事项</button></div>
      </form>
      ${todoTable()}
    </section>`;
  document.getElementById("todoForm").addEventListener("submit", saveTodo);
  document.getElementById("allTodos").addEventListener("click", () => setOutput(todoReport(false)));
  document.getElementById("openTodos").addEventListener("click", () => setOutput(todoReport(true)));
  bindTableActions("todos");
  document.querySelectorAll("[data-toggle-todo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const todo = state.data.todos.find((item) => item.id === btn.dataset.toggleTodo);
      todo.done = !todo.done;
      todo.completedAt = todo.done ? new Date().toISOString() : "";
      saveState();
      renderTodos();
      setOutput(todoReport(true));
    });
  });
}

function saveTodo(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = {
    id: uid("todo"),
    category: form.get("category"),
    due: form.get("due"),
    content: form.get("content"),
    done: false,
    createdAt: new Date().toISOString()
  };
  state.data.todos.push(item);
  state.lastEntry = { module: "todos", id: item.id };
  saveState();
  renderTodos();
  setOutput(todoReport(true));
}

function todoTable() {
  const rows = [...state.data.todos].sort((a, b) => Number(a.done) - Number(b.done) || String(a.due).localeCompare(String(b.due)));
  if (!rows.length) return `<p class="muted">暂无待办。</p>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>状态</th><th>分类</th><th>截止</th><th>事项</th><th>操作</th></tr></thead>
    <tbody>${rows
      .map((item) => `<tr>
        <td><span class="status-pill ${item.done ? "good" : "warn"}">${item.done ? "已完成" : "未完成"}</span></td>
        <td>${escapeHtml(item.category)}</td><td>${item.due || ""}</td><td>${escapeHtml(item.content)}</td>
        <td><div class="row-actions"><button data-toggle-todo="${item.id}">${item.done ? "撤销完成" : "勾选完成"}</button>${rowActions("todos", item.id, false)}</div></td>
      </tr>`)
      .join("")}</tbody>
  </table></div>`;
}

function todoReport(onlyOpen) {
  const rows = state.data.todos
    .filter((item) => !onlyOpen || !item.done)
    .sort((a, b) => String(a.due).localeCompare(String(b.due)))
    .map((item) => [item.done ? "已完成" : "未完成", item.category, item.due || "", item.content]);
  return `# ${onlyOpen ? "仅未完成事项" : "全部待办"}\n\n${rows.length ? markdownTable(["状态", "分类", "截止时间", "事项"], rows) : "暂无待办。"}`;
}

function renderStocks() {
  els.moduleContent.innerHTML = `
    <section class="module-section">
      <h3>股市资讯</h3>
      <form id="stockForm" class="grid">
        <div class="field"><label>日期</label><input name="date" type="date" value="${today()}"></div>
        <div class="field"><label>股票/指数</label><input name="symbol" placeholder="例如：AAPL / 000001"></div>
        <div class="field wide"><label>标题</label><input name="title" required></div>
        <div class="field"><label>来源</label><input name="source"></div>
        <div class="field full"><label>摘要/观点</label><textarea name="summary" rows="3"></textarea></div>
        <div class="field full actions"><button class="primary" type="submit">保存资讯</button><button type="button" id="stockSummary">汇总股市资讯</button><button type="button" id="stockSearch">打开资讯搜索</button></div>
      </form>
      ${stockTable()}
    </section>`;
  document.getElementById("stockForm").addEventListener("submit", saveStock);
  document.getElementById("stockSummary").addEventListener("click", generateStockSummary);
  document.getElementById("stockSearch").addEventListener("click", () => window.open("https://www.bing.com/search?q=%E8%82%A1%E5%B8%82%E8%B5%84%E8%AE%AF", "_blank"));
  bindTableActions("stocks");
}

function saveStock(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = {
    id: uid("stock"),
    date: form.get("date") || today(),
    symbol: form.get("symbol"),
    title: form.get("title"),
    source: form.get("source"),
    summary: form.get("summary"),
    createdAt: new Date().toISOString()
  };
  state.data.stocks.push(item);
  state.lastEntry = { module: "stocks", id: item.id };
  saveState();
  renderStocks();
  setOutput(stockSummary());
}

function stockTable() {
  const rows = [...state.data.stocks].sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return `<p class="muted">暂无股市资讯记录。</p>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>日期</th><th>股票/指数</th><th>标题</th><th>来源</th><th>摘要</th><th>操作</th></tr></thead>
    <tbody>${rows
      .map((item) => `<tr><td>${item.date}</td><td>${escapeHtml(item.symbol)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.source)}</td><td>${escapeHtml(item.summary)}</td><td>${rowActions("stocks", item.id)}</td></tr>`)
      .join("")}</tbody>
  </table></div>`;
}

function stockSummary() {
  const rows = state.data.stocks.map((item) => [item.date, item.symbol || "", item.title, item.source || "", item.summary || ""]);
  return `# 股市资讯汇总\n\n${rows.length ? markdownTable(["日期", "股票/指数", "标题", "来源", "摘要"], rows) : "暂无股市资讯。"}`;
}

async function generateStockSummary() {
  const local = stockSummary();
  setOutput(local);
  if (!aiIsReady() || !state.data.stocks.length) return;
  try {
    const summary = await runAI({
      task: "stock_summary",
      context: { notice: "这些是用户提供的历史材料，不是实时行情。", records: state.data.stocks }
    });
    setOutput(`${local}\n\n## AI 材料整理\n\n${summary}`);
  } catch {
    setOutput(local);
  }
}

function renderGenericModule() {
  const mod = getModule(activeModule);
  const list = state.data[activeModule] || [];
  els.moduleContent.innerHTML = `
    <section class="module-section">
      <h3>${escapeHtml(mod?.name || "模块")}</h3>
      <form id="genericForm" class="grid">
        <div class="field"><label>日期</label><input name="date" type="date" value="${today()}"></div>
        <div class="field wide"><label>标题</label><input name="title" required></div>
        <div class="field full"><label>内容</label><textarea name="content" rows="4"></textarea></div>
        <div class="field full"><label>模块规则</label><textarea name="rules" rows="3">${escapeHtml(mod?.rules || "")}</textarea></div>
        <div class="field full actions"><button class="primary" type="submit">保存记录</button><button type="button" id="saveRules">保存模块规则</button></div>
      </form>
      ${genericTable(list)}
    </section>`;
  document.getElementById("genericForm").addEventListener("submit", saveGeneric);
  document.getElementById("saveRules").addEventListener("click", () => {
    mod.rules = document.querySelector("[name='rules']").value;
    saveState();
    setActiveModule(activeModule);
  });
  bindTableActions(activeModule);
}

function saveGeneric(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = {
    id: uid(activeModule),
    date: form.get("date") || today(),
    title: form.get("title"),
    content: form.get("content"),
    createdAt: new Date().toISOString()
  };
  state.data[activeModule] = state.data[activeModule] || [];
  state.data[activeModule].push(item);
  state.lastEntry = { module: activeModule, id: item.id };
  saveState();
  renderGenericModule();
  setOutput(genericSummary(activeModule));
}

function genericTable(list) {
  if (!list.length) return `<p class="muted">暂无记录。可先定义规则，再保存记录。</p>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>日期</th><th>标题</th><th>内容</th><th>操作</th></tr></thead>
    <tbody>${list
      .map((item) => `<tr><td>${item.date || ""}</td><td>${escapeHtml(item.title || "")}</td><td>${escapeHtml(item.content || "")}</td><td>${rowActions(activeModule, item.id)}</td></tr>`)
      .join("")}</tbody>
  </table></div>`;
}

function genericSummary(moduleId) {
  const mod = getModule(moduleId);
  const rows = (state.data[moduleId] || []).map((item) => [item.date || "", item.title || "", item.content || ""]);
  return `# ${mod?.name || moduleId} 汇总\n\n${rows.length ? markdownTable(["日期", "标题", "内容"], rows) : "暂无记录。"}`;
}

function rowActions(moduleId, id, wrap = true) {
  const html = `<button data-view="${moduleId}:${id}">调取</button><button data-edit="${moduleId}:${id}">编辑</button><button class="danger" data-delete="${moduleId}:${id}">删除</button>`;
  return wrap ? `<div class="row-actions">${html}</div>` : html;
}

function bindTableActions(moduleId) {
  document.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => viewRecord(btn.dataset.view)));
  document.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => editRecord(btn.dataset.edit)));
  document.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => deleteRecord(btn.dataset.delete)));
}

function findRecord(ref) {
  const [moduleId, id] = ref.split(":");
  const list = state.data[moduleId] || [];
  return { moduleId, item: list.find((record) => record.id === id), list };
}

function viewRecord(ref) {
  const { moduleId, item } = findRecord(ref);
  if (!item) return;
  if (moduleId === "travel") setOutput(singleTripMarkdown(item));
  else setOutput(`# 调取记录\n\n${markdownTable(["字段", "内容"], Object.entries(flattenRecord(item)).map(([key, value]) => [key, value]))}`);
}

function editRecord(ref) {
  const { moduleId, item } = findRecord(ref);
  if (!item) return;
  const editable = { ...flattenRecord(item) };
  delete editable.id;
  delete editable.createdAt;
  const next = prompt("编辑记录 JSON。提交后会覆盖该条记录。", JSON.stringify(editable, null, 2));
  if (!next) return;
  try {
    const parsed = JSON.parse(next);
    Object.assign(item, parsed);
    saveState();
    renderActiveModule();
    setOutput(`# 已编辑\n\n${markdownTable(["模块", "记录ID"], [[getModule(moduleId)?.name || moduleId, item.id]])}`);
  } catch {
    setOutput("编辑失败：JSON 格式不正确。");
  }
}

function deleteRecord(ref) {
  const { moduleId, item, list } = findRecord(ref);
  if (!item) return;
  if (!confirm("确认删除这条记录？")) return;
  state.data[moduleId] = list.filter((record) => record.id !== item.id);
  if (state.lastEntry?.module === moduleId && state.lastEntry?.id === item.id) state.lastEntry = null;
  saveState();
  renderActiveModule();
  setOutput(`# 已删除\n\n${getModule(moduleId)?.name || moduleId}：${item.id}`);
}

function flattenRecord(item) {
  const out = {};
  Object.entries(item).forEach(([key, value]) => {
    out[key] = typeof value === "object" && value !== null ? JSON.stringify(value) : value;
  });
  return out;
}

async function handleQuickInput(text) {
  if (!text) return;
  const compact = text.replace(/\s+/g, "");
  if (compact === "工作台总览") return setOutput(renderOverview());
  if (compact === "健康周报") return generateHealthReport("week");
  if (compact === "健康月报") return generateHealthReport("month");
  if (compact === "月度账单") return generateWalletReport();
  if (["端端语录汇总", "端端日记", "语录汇总"].includes(compact)) return generateQuoteDiary();
  if (compact === "股市资讯汇总") return generateStockSummary();
  if (compact === "全部待办") return setOutput(todoReport(false));
  if (compact === "仅未完成事项") return setOutput(todoReport(true));
  if (compact === "导出全部记录") return setOutput(exportAllMarkdown());
  if (compact === "清空本条记录") return clearLastEntry();
  if (/^新增.+模块$/.test(compact)) return addModule(compact.replace(/^新增/, "").replace(/模块$/, ""));
  if (/^删除.+模块$/.test(compact)) return removeModule(compact.replace(/^删除/, "").replace(/模块$/, ""));
  if (compact.startsWith("修改") && compact.includes("模块规则")) return updateModuleRule(text);
  const routed = autoRoute(text);
  if (routed) return;
  if (!aiIsReady()) {
    setOutput("无法可靠判断信息归属。请补充模块关键词，或在设置中配置 AI 后重新提交。");
    return;
  }
  const request = async () => {
    const modules = state.modules.filter((mod) => mod.enabled).map(({ id, name, rules }) => ({ id, name, rules }));
    const result = await runAI({
      task: "quick_route",
      input: text,
      context: {
        modules,
        allowedFields: {
          health: ["date", "heightCm", "weight", "bowel", "exerciseDone", "exerciseType", "drinkText", "calories"],
          travel: ["startDate", "endDate", "destination", "companions", "lodging", "transport", "itineraryText", "route", "packing", "notes"],
          wallet: ["date", "kind", "amount", "category", "note"],
          quotes: ["date", "quote", "context"],
          todos: ["category", "due", "content"],
          stocks: ["date", "symbol", "title", "source", "summary"],
          dynamicModule: ["date", "title", "content"]
        },
        walletCategories: categoryOptions
      }
    });
    const confidence = Number(result.confidence);
    if (!Number.isFinite(confidence) || confidence < 0.55) {
      const missing = Array.isArray(result.missingFields) ? result.missingFields.join("、") : "模块信息";
      throw new Error(`归类置信度较低，请补充：${missing || "模块信息"}。`);
    }
    return { module: result.module, data: result.data, title: "确认随手记识别结果" };
  };
  await requestCandidate(request, els.quickSubmit);
}

function autoRoute(text) {
  if (/^\d+(\.\d+)?$/.test(text)) {
    const item = { id: uid("health"), date: today(), weight: Number(text), drinks: [], createdAt: new Date().toISOString() };
    state.data.health.push(item);
    state.lastEntry = { module: "health", id: item.id };
    saveState();
    setActiveModule("health");
    setOutput(healthReport("week"));
    return true;
  }
  if (/排便|便便|大便/.test(text)) {
    const yes = /是|有|已|正常/.test(text) ? "是" : /否|没|无/.test(text) ? "否" : "";
    quickHealth({ bowel: yes || "是" });
    return true;
  }
  if (/羽毛球|运动|跑步|健身|游泳/.test(text)) {
    const type = text.match(/羽毛球|跑步|健身|游泳|瑜伽|骑行/)?.[0] || "羽毛球";
    quickHealth({ exerciseDone: /否|没|无/.test(text) ? "否" : "是", exerciseType: type });
    return true;
  }
  if (/饮|奶茶|咖啡|可乐|茶|牛奶|酸奶|啤酒|果汁/.test(text)) {
    const estimated = estimateDrinkCalories(text);
    if (estimated.source !== "未匹配，可点搜索核对") {
      quickHealth({ drinks: [{ text, calories: estimated.calories, source: estimated.source }] });
      return true;
    }
  }
  if (/收入|支出|花了|消费|付款/.test(text) && /\d+/.test(text)) {
    quickWallet(text);
    return true;
  }
  if (/(工作待办|生活待办)/.test(text) && /\d{4}-\d{2}-\d{2}/.test(text)) {
    quickTodo(text);
    return true;
  }
  if (/端端|儿子|宝宝说|说[:：]/.test(text)) {
    quickQuote(text);
    return true;
  }
  if (/旅行|目的地|住宿|景点|行程/.test(text)) {
    if (aiIsReady()) return false;
    quickGenericTrip(text);
    return true;
  }
  if (/股票|股市|A股|港股|美股|指数|基金/.test(text)) {
    if (aiIsReady()) return false;
    quickStock(text);
    return true;
  }
  return false;
}

function quickHealth(patch) {
  let item = state.data.health.find((record) => record.date === today());
  if (!item) {
    item = { id: uid("health"), date: today(), drinks: [], createdAt: new Date().toISOString() };
    state.data.health.push(item);
  }
  if (patch.drinks) item.drinks.push(...patch.drinks);
  Object.assign(item, Object.fromEntries(Object.entries(patch).filter(([key]) => key !== "drinks")));
  state.lastEntry = { module: "health", id: item.id };
  saveState();
  setActiveModule("health");
  setOutput(healthReport("week"));
}

function quickWallet(text) {
  const amount = Number(text.match(/(\d+(\.\d+)?)/)?.[1] || 0);
  const kind = /收入|工资|到账|收款/.test(text) ? "income" : "expense";
  const category = categoryOptions.find((cat) => text.includes(cat)) || guessCategory(text);
  const item = { id: uid("wallet"), date: today(), kind, amount, category, note: text, createdAt: new Date().toISOString() };
  state.data.wallet.push(item);
  state.lastEntry = { module: "wallet", id: item.id };
  saveState();
  setActiveModule("wallet");
  setOutput(walletReport());
}

function guessCategory(text) {
  if (/饭|餐|咖啡|奶茶|外卖/.test(text)) return "餐饮";
  if (/球|健身|运动/.test(text)) return "运动";
  if (/衣|鞋|裤|裙/.test(text)) return "服饰";
  if (/超市|便利店/.test(text)) return "超市";
  if (/车|地铁|机票|火车/.test(text)) return "交通";
  return "其他";
}

function quickTodo(text) {
  const due = text.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
  const item = {
    id: uid("todo"),
    category: /生活/.test(text) ? "生活待办" : "工作待办",
    due,
    content: text.replace(/待办|提醒|截止|生活|工作|\d{4}-\d{2}-\d{2}/g, "").trim() || text,
    done: false,
    createdAt: new Date().toISOString()
  };
  state.data.todos.push(item);
  state.lastEntry = { module: "todos", id: item.id };
  saveState();
  setActiveModule("todos");
  setOutput(todoReport(true));
}

function quickQuote(text) {
  const quote = text.replace(/^.*?(端端|儿子|宝宝)?说[:：]?/, "").trim() || text;
  const item = { id: uid("quote"), date: today(), quote, context: "", createdAt: new Date().toISOString() };
  state.data.quotes.push(item);
  state.lastEntry = { module: "quotes", id: item.id };
  saveState();
  setActiveModule("quotes");
  setOutput(quoteDiary());
}

function quickGenericTrip(text) {
  const destination = text.match(/目的地[:：]?([^\s，,。]+)/)?.[1] || "待补充目的地";
  const trip = {
    id: uid("travel"),
    startDate: today(),
    endDate: "",
    destination,
    companions: "",
    lodging: "",
    transport: "",
    itineraryText: text,
    notes: "由随手记录自动归档，建议补齐必填字段。",
    packingList: [],
    createdAt: new Date().toISOString()
  };
  trip.route = makeRoute(trip);
  state.data.travel.push(trip);
  state.lastEntry = { module: "travel", id: trip.id };
  saveState();
  setActiveModule("travel");
  setOutput(singleTripMarkdown(trip));
}

function quickStock(text) {
  const item = { id: uid("stock"), date: today(), symbol: "", title: text.slice(0, 40), source: "", summary: text, createdAt: new Date().toISOString() };
  state.data.stocks.push(item);
  state.lastEntry = { module: "stocks", id: item.id };
  saveState();
  setActiveModule("stocks");
  setOutput(stockSummary());
}

function clearLastEntry() {
  const ref = state.lastEntry;
  if (!ref) return setOutput("没有可清空的上一条记录。");
  state.data[ref.module] = (state.data[ref.module] || []).filter((item) => item.id !== ref.id);
  state.lastEntry = null;
  saveState();
  renderActiveModule();
  renderNav();
  setOutput("已删除上一条录入内容。");
}

function addModule(name) {
  const id = `custom_${Date.now()}`;
  state.modules.push({ id, name, enabled: true, rules: "自定义模块：可编辑规则并保存记录。" });
  state.data[id] = [];
  saveState();
  setActiveModule(id);
  setOutput(`# 已新增模块\n\n${markdownTable(["模块", "状态"], [[name, "已启用"]])}`);
}

function removeModule(name) {
  const mod = state.modules.find((item) => item.name === name || item.id === name);
  if (!mod) return setOutput(`未找到模块：${name}`);
  mod.enabled = false;
  saveState();
  activeModule = state.modules.find((item) => item.enabled)?.id || "health";
  setActiveModule(activeModule);
  setOutput(`# 已删除模块\n\n${mod.name} 已从导航隐藏，历史数据仍保留在导出备份中。`);
}

function updateModuleRule(text) {
  const match = text.match(/修改(.+?)模块规则[:：]?(.*)$/);
  if (!match) return setOutput("请使用：修改XX模块规则：新的规则内容");
  const name = match[1].trim();
  const rule = match[2].trim();
  const mod = state.modules.find((item) => item.name.includes(name) || item.id === name);
  if (!mod) return setOutput(`未找到模块：${name}`);
  mod.rules = rule || mod.rules;
  saveState();
  renderNav();
  setOutput(`# 已修改模块规则\n\n${markdownTable(["模块", "新规则"], [[mod.name, mod.rules]])}`);
}

function exportAllMarkdown() {
  return [
    renderOverview(),
    healthReport("month"),
    travelSummary(),
    walletReport(),
    quoteDiary(),
    todoReport(false),
    stockSummary(),
    genericSummary("projects")
  ].join("\n\n---\n\n");
}

function exportExcel() {
  const backup = JSON.stringify(state).replaceAll("<", "\\u003c");
  const sheets = [
    ["健康管理", ["日期", "体重", "排便", "运动", "运动类型", "饮品", "BMI"], state.data.health.map((item) => [item.date, item.weight, item.bowel, item.exerciseDone, item.exerciseType, formatDrinksText(item.drinks), calcBmi(item.weight)])],
    ["旅行管理", ["开始", "结束", "目的地", "同行人", "住宿", "交通", "行程", "路线", "物品清单"], state.data.travel.map((item) => [item.startDate, item.endDate, item.destination, item.companions, item.lodging, item.transport, item.itineraryText, item.route, (item.packingList || []).map((pack) => `${pack.checked ? "[x]" : "[ ]"} ${pack.name}`).join("; ")])],
    ["钱包管理", ["日期", "类型", "金额", "类别", "备注"], state.data.wallet.map((item) => [item.date, item.kind === "income" ? "收入" : "支出", item.amount, item.category, item.note])],
    ["端端有话说", ["日期", "语录", "场景"], state.data.quotes.map((item) => [item.date, item.quote, item.context])],
    ["待办事项", ["状态", "分类", "截止", "事项"], state.data.todos.map((item) => [item.done ? "已完成" : "未完成", item.category, item.due, item.content])],
    ["股市资讯", ["日期", "股票/指数", "标题", "来源", "摘要"], state.data.stocks.map((item) => [item.date, item.symbol, item.title, item.source, item.summary])],
    ["模块架构", ["ID", "模块", "启用", "规则"], state.modules.map((item) => [item.id, item.name, item.enabled ? "是" : "否", item.rules])]
  ];
  const html = `<!doctype html><html><head><meta charset="UTF-8"></head><body>
    <h1>捏欧菲斯数据备份</h1>
    <p>导出时间：${new Date().toLocaleString()}</p>
    <script id="neufis-backup" type="application/json">${backup}</script>
    ${sheets.map(([name, headers, rows]) => sheetHtml(name, headers, rows)).join("")}
  </body></html>`;
  downloadBlob(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }), `捏欧菲斯_${today()}.xls`);
}

function sheetHtml(name, headers, rows) {
  return `<h2>${escapeHtml(name)}</h2><table border="1"><thead><tr>${headers.map((head) => `<th>${escapeHtml(head)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function formatDrinksText(drinks = []) {
  return drinks.map((drink) => `${drink.text}${drink.calories !== "" && drink.calories != null ? `（${drink.calories} kcal）` : ""}`).join("; ");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      let next;
      if (file.name.endsWith(".json") || text.trim().startsWith("{")) {
        next = JSON.parse(text);
      } else {
        const doc = new DOMParser().parseFromString(text, "text/html");
        const backup = doc.getElementById("neufis-backup")?.textContent;
        if (!backup) throw new Error("未找到内嵌备份数据");
        next = JSON.parse(backup);
      }
      state = next;
      state.modules = mergeModules(state.modules || []);
      state.data = state.data || {};
      saveState();
      renderNav();
      setActiveModule(state.activeModule || "health");
      setOutput("# 导入完成\n\n已恢复捏欧菲斯备份数据。");
    } catch (error) {
      setOutput(`导入失败：${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function copyOutput() {
  navigator.clipboard.writeText(els.outputBox.textContent || "");
}
