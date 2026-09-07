// src/string.ts
function toCamelCase(str) {
  return str.replace(/[-_]+/g, " ").replace(/[^\w\s]/g, "").replace(
    /(?:^\w|[A-Z]|\b\w)/g,
    (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase()
  ).replace(/\s+/g, "");
}
function toPascalCase(str) {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/[-_\s]+/g, "_").replace(/^[_\s]+|[_\s]+$/g, "").toLowerCase();
}
function toKebabCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/[-_\s]+/g, "-").replace(/^[-_\s]+|[-_\s]+$/g, "").toLowerCase();
}
function toScreamingSnake(str) {
  return toSnakeCase(str).toUpperCase();
}
function toSlug(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s-_]/g, "").replace(/[\s-_]+/g, "-").replace(/^-+|-+$/g, "");
}
function uuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function shortId(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.random() * chars.length | 0);
  }
  return result;
}
function prefixedId(prefix, length = 8) {
  return `${prefix}-${shortId(length)}`;
}
function interpolate(tmpl, data) {
  return tmpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return data[key] !== void 0 ? String(data[key]) : `{{${key}}}`;
  });
}

// src/base.ts
var SkipoBase = class {
  /** Unique instance identifier */
  instanceId;
  /** Human-readable component name */
  name;
  /** Logger instance */
  logger;
  /** Whether this component has been initialized */
  initialized = false;
  /** Whether this component has been disposed */
  disposed = false;
  constructor(config = { name: "SkipoComponent" }) {
    this.instanceId = shortId();
    this.name = config?.name ?? "SkipoComponent";
    this.logger = config?.logger ?? console;
  }
  /** Initialize the component. Call before use. */
  async initialize() {
    if (this.initialized) return;
    this.logger.log(`[${this.name}:${this.instanceId}] Initializing`);
    await this.onInitialize();
    this.initialized = true;
  }
  /** Override to add custom initialization logic */
  async onInitialize() {
  }
  /** Dispose the component and release resources */
  async dispose() {
    if (this.disposed) return;
    this.logger.log(`[${this.name}:${this.instanceId}] Disposing`);
    await this.onDispose();
    this.disposed = true;
  }
  /** Override to add custom cleanup logic */
  async onDispose() {
  }
  /** Guard: throws if not initialized */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error(`${this.name} has not been initialized. Call initialize() first.`);
    }
  }
  /** Guard: throws if already disposed */
  ensureNotDisposed() {
    if (this.disposed) {
      throw new Error(`${this.name} has been disposed and cannot be used.`);
    }
  }
};

// src/async.ts
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function withTimeout(promise, ms, label = "Operation") {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`[SkipoTimeoutError] ${label} timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([
    promise.then((val) => {
      clearTimeout(timer);
      return val;
    }),
    timeoutPromise
  ]);
}
async function retry(fn, maxAttempts, delayMs = 1e3) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw err;
      }
      await sleep(delayMs);
    }
  }
  throw new Error("Retry failed");
}
async function pLimit(tasks, concurrency) {
  const results = [];
  let index = 0;
  const worker = async () => {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  };
  const workers = [];
  for (let i = 0; i < concurrency && i < tasks.length; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}
function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
function throttle(fn, ms) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}
function once(fn) {
  let run = false;
  let result;
  return (...args) => {
    if (!run) {
      run = true;
      result = fn(...args);
    }
    return result;
  };
}
function memoize(fn, keyFn) {
  const cache = /* @__PURE__ */ new Map();
  return (...args) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const val = fn(...args);
    cache.set(key, val);
    return val;
  };
}

// src/object.ts
function deepClone(obj, seen = /* @__PURE__ */ new Map()) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (seen.has(obj)) {
    return seen.get(obj);
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags);
  }
  if (Array.isArray(obj)) {
    const cloneArr = [];
    seen.set(obj, cloneArr);
    for (const item of obj) {
      cloneArr.push(deepClone(item, seen));
    }
    return cloneArr;
  }
  const cloneObj = Object.create(Object.getPrototypeOf(obj));
  seen.set(obj, cloneObj);
  for (const key of Reflect.ownKeys(obj)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(obj, key);
    if (descriptor) {
      descriptor.value = deepClone(descriptor.value, seen);
      Object.defineProperty(cloneObj, key, descriptor);
    }
  }
  return cloneObj;
}
function deepMerge(base, ...overrides) {
  let result = deepClone(base);
  for (const override of overrides) {
    if (override === null || typeof override !== "object") {
      continue;
    }
    for (const key of Object.keys(override)) {
      const val = override[key];
      if (val === void 0) {
        delete result[key];
      } else if (val && typeof val === "object" && !Array.isArray(val)) {
        if (result[key] && typeof result[key] === "object" && !Array.isArray(result[key])) {
          result[key] = deepMerge(result[key], val);
        } else {
          result[key] = deepClone(val);
        }
      } else {
        result[key] = deepClone(val);
      }
    }
  }
  return result;
}
function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
    return false;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }
  const keysA = Reflect.ownKeys(a);
  const keysB = Reflect.ownKeys(b);
  if (keysA.length !== keysB.length) return false;
  const setB = new Set(keysB);
  for (const key of keysA) {
    if (!setB.has(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}
function objectDiff(before, after) {
  const added = {};
  const removed = {};
  const changed = {};
  if (before === null || typeof before !== "object" || after === null || typeof after !== "object") {
    return { added, removed, changed };
  }
  const keysBefore = Object.keys(before);
  const keysAfter = Object.keys(after);
  for (const key of keysAfter) {
    if (!(key in before)) {
      added[key] = deepClone(after[key]);
    } else if (!deepEqual(before[key], after[key])) {
      if (before[key] && typeof before[key] === "object" && after[key] && typeof after[key] === "object" && !Array.isArray(before[key]) && !Array.isArray(after[key])) {
        const nested = objectDiff(before[key], after[key]);
        if (Object.keys(nested.added).length > 0 || Object.keys(nested.removed).length > 0 || Object.keys(nested.changed).length > 0) {
          changed[key] = nested;
        }
      } else {
        changed[key] = { from: deepClone(before[key]), to: deepClone(after[key]) };
      }
    }
  }
  for (const key of keysBefore) {
    if (!(key in after)) {
      removed[key] = deepClone(before[key]);
    }
  }
  return { added, removed, changed };
}
function getPath(obj, path6, defaultValue) {
  if (!path6) return obj;
  const parts = path6.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === void 0) {
      return defaultValue;
    }
    current = current[part];
  }
  return current !== void 0 ? current : defaultValue;
}
function setPath(obj, path6, value) {
  if (!path6) return obj;
  const parts = path6.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === void 0 || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
  return obj;
}

// src/cache.ts
import fs from "fs";
import path from "path";
var LRUCache = class {
  maxSize;
  cache;
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = /* @__PURE__ */ new Map();
  }
  get(key) {
    if (!this.cache.has(key)) return void 0;
    const val = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== void 0) this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  delete(key) {
    return this.cache.delete(key);
  }
  clear() {
    this.cache.clear();
  }
  size() {
    return this.cache.size;
  }
};
var TTLCache = class {
  ttlMs;
  cache;
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.cache = /* @__PURE__ */ new Map();
  }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }
  set(key, value) {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttlMs
    });
  }
  delete(key) {
    return this.cache.delete(key);
  }
  clear() {
    this.cache.clear();
  }
};
function swr(cache, key, fetchFn) {
  const cached = cache.get(key);
  if (cached !== null) {
    setTimeout(() => {
      fetchFn().then((fresh) => cache.set(key, fresh)).catch(() => {
      });
    }, 0);
    return Promise.resolve(cached);
  }
  return fetchFn().then((fresh) => {
    cache.set(key, fresh);
    return fresh;
  });
}
var FileCache = class {
  cacheDir;
  constructor(cacheDir) {
    this.cacheDir = cacheDir;
    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
    } catch (e) {
    }
  }
  getFilePath(key) {
    return path.join(this.cacheDir, `${encodeURIComponent(key)}.json`);
  }
  get(key) {
    const file = this.getFilePath(key);
    if (!fs.existsSync(file)) return null;
    try {
      const content = fs.readFileSync(file, "utf8");
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }
  set(key, value) {
    const file = this.getFilePath(key);
    try {
      fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
    } catch (e) {
    }
  }
  delete(key) {
    const file = this.getFilePath(key);
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (e) {
      }
    }
  }
  clear() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
    } catch (e) {
    }
  }
};

// src/env.ts
import fs2 from "fs";
import path2 from "path";
function getEnv(key, defaultValue) {
  const val = process.env[key];
  if (val === void 0) {
    if (defaultValue !== void 0) return defaultValue;
    throw new Error(`[SkipoEnvError] Missing required environment variable: ${key}`);
  }
  if (typeof defaultValue === "number") {
    const num = Number(val);
    if (isNaN(num)) {
      throw new Error(`[SkipoEnvError] Expected number for ${key}, received: ${val}`);
    }
    return num;
  }
  if (typeof defaultValue === "boolean") {
    return val === "true" || val === "1";
  }
  try {
    if (defaultValue && typeof defaultValue === "object") {
      return JSON.parse(val);
    }
  } catch (e) {
  }
  return val;
}
function requireEnv(key) {
  const val = process.env[key];
  if (val === void 0) {
    throw new Error(`[SkipoEnvError] Missing required environment variable: ${key}`);
  }
  return val;
}
function loadEnv(filePath) {
  const file = filePath || path2.join(process.cwd(), ".env");
  if (!fs2.existsSync(file)) return;
  try {
    const content = fs2.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) continue;
      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === void 0) {
        process.env[key] = value;
      }
    }
  } catch (e) {
  }
}
function validateEnvSchema(zodSchema) {
  try {
    return zodSchema.parse(process.env);
  } catch (err) {
    throw new Error(`[SkipoEnvError] Environment validation failed: ${err.message || String(err)}`);
  }
}
function isPlaceholderConnection(url) {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim().toLowerCase();
  const placeholders = [
    "ep-sample",
    "example.com",
    "placeholder",
    "user:password@",
    "my_database",
    "your_password",
    "xxx.neon.tech",
    "username:password"
  ];
  return placeholders.some((p) => trimmed.includes(p));
}
function sanitizeDatabaseUrl(url) {
  if (!url || isPlaceholderConnection(url)) return void 0;
  return url.trim();
}

// src/http.ts
async function requestRaw(url, opts = {}) {
  const timeout = opts.timeout || 6e4;
  const retries = opts.retries || 0;
  const perform = async () => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...opts,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };
  return await retry(perform, retries + 1, 1e3);
}
async function request(url, opts = {}) {
  try {
    const res = await requestRaw(url, opts);
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.toLowerCase().includes("application/json");
    if (!res.ok) {
      let errorMessage = `HTTP Error ${res.status}: ${res.statusText}`;
      try {
        if (isJson) {
          const errData = await res.json();
          errorMessage = errData?.message || errData?.error || errorMessage;
        } else {
          const rawText = await res.text();
          if (rawText.trim()) {
            errorMessage = rawText.length > 200 ? `${rawText.slice(0, 200)}...` : rawText;
          }
        }
      } catch {
      }
      return { status: "error", message: errorMessage, code: res.status };
    }
    if (!isJson) {
      const text = await res.text();
      return {
        status: "error",
        message: `Expected JSON response but received "${contentType || "text/plain"}": ${text.slice(0, 100)}`,
        code: res.status
      };
    }
    const data = await res.json();
    return { status: "success", data };
  } catch (e) {
    return { status: "error", message: e.message || String(e) };
  }
}
async function get(url, opts = {}) {
  return await request(url, { ...opts, method: "GET" });
}
async function post(url, body, opts = {}) {
  return await request(url, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: JSON.stringify(body)
  });
}
async function put(url, body, opts = {}) {
  return await request(url, {
    ...opts,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: JSON.stringify(body)
  });
}
async function del(url, opts = {}) {
  return await request(url, { ...opts, method: "DELETE" });
}
function createClient(baseUrl, defaultHeaders = {}) {
  return {
    get: (path6, opts = {}) => get(`${baseUrl}${path6}`, { ...opts, headers: { ...defaultHeaders, ...opts.headers } }),
    post: (path6, body, opts = {}) => post(`${baseUrl}${path6}`, body, { ...opts, headers: { ...defaultHeaders, ...opts.headers } }),
    put: (path6, body, opts = {}) => put(`${baseUrl}${path6}`, body, { ...opts, headers: { ...defaultHeaders, ...opts.headers } }),
    del: (path6, opts = {}) => del(`${baseUrl}${path6}`, { ...opts, headers: { ...defaultHeaders, ...opts.headers } })
  };
}
async function* streamResponse(url, opts = {}) {
  const res = await requestRaw(url, opts);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to initialize stream: HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

// src/shell.ts
import { exec, spawn } from "child_process";
import path3 from "path";
import fs3 from "fs";
function execCmd(cmd, opts = {}) {
  const timeout = opts.timeout || 3e4;
  return new Promise((resolve, reject) => {
    exec(cmd, { ...opts, timeout }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`[SkipoShellError] Command failed: ${cmd}
Exit Code: ${error.code}
Stderr: ${String(stderr)}`));
      } else {
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      }
    });
  });
}
function spawnCmd(cmd, args, opts = {}) {
  const child = spawn(cmd, args, opts);
  const promise = new Promise((resolve, reject) => {
    child.on("close", (code, signal) => {
      resolve({ code, signal });
    });
    child.on("error", (err) => {
      reject(err);
    });
  });
  return {
    pid: child.pid,
    kill: (signal) => child.kill(signal),
    promise
  };
}
function platform(routing) {
  return process.platform === "win32" ? routing.win32 : routing.posix;
}
function which(cmd) {
  const envPath = process.env.PATH || "";
  const paths = envPath.split(path3.delimiter);
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const p of paths) {
    for (const ext of extensions) {
      const fullPath = path3.join(p, `${cmd}${ext}`);
      try {
        if (fs3.existsSync(fullPath) && fs3.statSync(fullPath).isFile()) {
          return fullPath;
        }
      } catch (e) {
      }
    }
  }
  return null;
}

// src/fs-lock.ts
import path4 from "path";
var FileLock = class _FileLock {
  static locks = /* @__PURE__ */ new Map();
  static async acquire(filePath) {
    const resolvedPath = path4.resolve(filePath);
    const existing = _FileLock.locks.get(resolvedPath) || Promise.resolve();
    let release = () => {
    };
    const nextLock = new Promise((resolve) => {
      release = () => {
        _FileLock.locks.delete(resolvedPath);
        resolve();
      };
    });
    _FileLock.locks.set(resolvedPath, nextLock);
    await existing;
    return release;
  }
};

// src/fs.ts
import fs4 from "fs";
import fsp from "fs/promises";
import path5 from "path";
import os from "os";
async function readFile(filePath, encoding = "utf8") {
  return await fsp.readFile(filePath, encoding);
}
async function writeFile(filePath, content) {
  await fsp.writeFile(filePath, content);
}
async function writeFileAtomic(filePath, content) {
  const dir = path5.dirname(filePath);
  await ensureDir(dir);
  const tempFile = path5.join(dir, `.${path5.basename(filePath)}.tmp_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  try {
    await fsp.writeFile(tempFile, content);
    await fsp.rename(tempFile, filePath);
  } catch (e) {
    if (fs4.existsSync(tempFile)) {
      await fsp.unlink(tempFile).catch(() => {
      });
    }
    throw e;
  }
}
async function appendFile(filePath, content) {
  await fsp.appendFile(filePath, content);
}
async function deleteFile(filePath) {
  await fsp.unlink(filePath);
}
async function fileExists(filePath) {
  try {
    const stat = await fsp.stat(filePath);
    return stat.isFile();
  } catch (e) {
    return false;
  }
}
async function getFileStat(filePath) {
  const stat = await fsp.stat(filePath);
  return {
    size: stat.size,
    createdAt: stat.birthtime,
    modifiedAt: stat.mtime,
    isDir: stat.isDirectory()
  };
}
async function readJSON(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}
async function writeJSON(filePath, data, indent = 2) {
  const content = JSON.stringify(data, null, indent);
  await writeFileAtomic(filePath, content);
}
async function updateJSON(filePath, patch) {
  const release = await FileLock.acquire(filePath);
  try {
    let existing = await readJSON(filePath);
    if (!existing) {
      existing = {};
    }
    const updated = deepMerge(existing, patch);
    await writeJSON(filePath, updated);
    return updated;
  } finally {
    release();
  }
}
async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}
async function deleteDir(dirPath, recursive = true) {
  await fsp.rm(dirPath, { recursive, force: true });
}
async function listDir(dirPath) {
  return await fsp.readdir(dirPath);
}
async function* walkDir(dirPath, filter) {
  const list = await listDir(dirPath);
  for (const item of list) {
    const full = path5.join(dirPath, item);
    const stat = await getFileStat(full);
    if (stat.isDir) {
      yield* walkDir(full, filter);
    } else {
      if (!filter || filter(full)) {
        yield full;
      }
    }
  }
}
async function dirExists(dirPath) {
  try {
    const stat = await fsp.stat(dirPath);
    return stat.isDirectory();
  } catch (e) {
    return false;
  }
}
async function copyDir(src, dest) {
  await ensureDir(dest);
  const list = await listDir(src);
  for (const item of list) {
    const srcItem = path5.join(src, item);
    const destItem = path5.join(dest, item);
    const stat = await getFileStat(srcItem);
    if (stat.isDir) {
      await copyDir(srcItem, destItem);
    } else {
      await fsp.copyFile(srcItem, destItem);
    }
  }
}
async function firstExisting(candidates) {
  for (const cand of candidates) {
    if (await fileExists(cand)) {
      return cand;
    }
  }
  return null;
}
function watchFile(filePath, handler, debounceMs = 100) {
  let timer = null;
  return fs4.watch(filePath, (event) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => handler(event), debounceMs);
  });
}
function watchDir(dirPath, handler, debounceMs = 100) {
  let timer = null;
  return fs4.watch(dirPath, (event, filename) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => handler(event, filename), debounceMs);
  });
}
function createTempFile(prefix = "tmp-") {
  return path5.join(os.tmpdir(), `${prefix}${Math.random().toString(36).substring(7)}.tmp`);
}
function createTempDir(prefix = "tmp-dir-") {
  const dir = path5.join(os.tmpdir(), `${prefix}${Math.random().toString(36).substring(7)}`);
  fs4.mkdirSync(dir, { recursive: true });
  return dir;
}
async function withTempDir(fn, prefix = "tmp-") {
  const tempDir = createTempDir(prefix);
  try {
    return await fn(tempDir);
  } finally {
    await deleteDir(tempDir, true).catch(() => {
    });
  }
}

// src/events.ts
var globalStore = globalThis;
if (!globalStore.__skipo_realtime_store) {
  globalStore.__skipo_realtime_store = {
    buffer: [],
    listeners: /* @__PURE__ */ new Set()
  };
}
var store = globalStore.__skipo_realtime_store;
var MAX_BUFFER_SIZE = 200;
function publishRealtimeEvent(eventInput) {
  const event = {
    ...eventInput,
    id: eventInput.id || `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: eventInput.timestamp || Date.now(),
    source: eventInput.source || "api"
  };
  store.buffer.push(event);
  if (store.buffer.length > MAX_BUFFER_SIZE) {
    store.buffer.splice(0, store.buffer.length - MAX_BUFFER_SIZE);
  }
  for (const listener of store.listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error("[RealtimeBus] Listener invocation error:", err);
    }
  }
  return event;
}
function subscribeRealtimeEvents(listener) {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}
function getRecentEvents(sinceTimestamp, workspaceId, userId) {
  const since = typeof sinceTimestamp === "number" && !isNaN(sinceTimestamp) ? sinceTimestamp : 0;
  return store.buffer.filter((e) => {
    if (e.timestamp <= since) return false;
    if (workspaceId && e.workspaceId && e.workspaceId !== workspaceId) return false;
    if (userId && e.userId && e.userId !== userId) return false;
    return true;
  });
}
export {
  FileCache,
  FileLock,
  LRUCache,
  SkipoBase,
  TTLCache,
  appendFile,
  copyDir,
  createClient,
  createTempDir,
  createTempFile,
  debounce,
  deepClone,
  deepEqual,
  deepMerge,
  del,
  deleteDir,
  deleteFile,
  dirExists,
  ensureDir,
  execCmd,
  fileExists,
  firstExisting,
  get,
  getEnv,
  getFileStat,
  getPath,
  getRecentEvents,
  interpolate,
  isPlaceholderConnection,
  listDir,
  loadEnv,
  memoize,
  objectDiff,
  once,
  pLimit,
  platform,
  post,
  prefixedId,
  publishRealtimeEvent,
  put,
  readFile,
  readJSON,
  request,
  requestRaw,
  requireEnv,
  retry,
  sanitizeDatabaseUrl,
  setPath,
  shortId,
  sleep,
  spawnCmd,
  streamResponse,
  subscribeRealtimeEvents,
  swr,
  throttle,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toScreamingSnake,
  toSlug,
  toSnakeCase,
  updateJSON,
  uuid,
  validateEnvSchema,
  walkDir,
  watchDir,
  watchFile,
  which,
  withTempDir,
  withTimeout,
  writeFile,
  writeFileAtomic,
  writeJSON
};
