// src/storage/BaseStorageAdapter.ts
import { SkipoBase } from "@skipo/core";
var BaseStorageAdapter = class extends SkipoBase {
  config;
  constructor(config) {
    super({ name: "BaseStorageAdapter" });
    this.config = config;
  }
  async deleteFolder(pathStr) {
    const items = await this.list(pathStr);
    let count = 0;
    for (const item of items) {
      await this.delete(item.path);
      count++;
    }
    return { success: true, deletedCount: count };
  }
  async renameFolder(oldPath, newPath) {
    const items = await this.list(oldPath);
    let count = 0;
    for (const item of items) {
      const rel = item.path.startsWith(oldPath) ? item.path.slice(oldPath.length).replace(/^\/+/, "") : item.path;
      const target = `${newPath.replace(/\/+$/, "")}/${rel}`;
      const data = await this.read(item.path);
      await this.write(target, data);
      await this.delete(item.path);
      count++;
    }
    return { success: true, movedCount: count };
  }
  async ensureDirectory(pathStr) {
    await this.mkdir(pathStr);
  }
  async testConnection() {
    const start = performance.now();
    try {
      await this.list("");
      return { ok: true, latencyMs: Math.round(performance.now() - start) };
    } catch (e) {
      return { ok: false, latencyMs: Math.round(performance.now() - start), error: e.message };
    }
  }
  normalizePath(p) {
    return p.replace(/\\/g, "/").replace(/^\/+/, "");
  }
  getExtension(p) {
    const parts = p.split(".");
    return parts.length > 1 ? parts[parts.length - 1] : "";
  }
};

// src/storage/LocalFSAdapter.ts
import { promises as fs } from "fs";
import path from "path";
var LocalFSAdapter = class extends BaseStorageAdapter {
  basePath;
  constructor(config) {
    super(config);
    this.basePath = path.resolve(config.basePath || "./.skipo/storage");
  }
  resolvePath(p) {
    return path.join(this.basePath, this.normalizePath(p));
  }
  async read(pathStr) {
    const fullPath = this.resolvePath(pathStr);
    const data = await fs.readFile(fullPath);
    return new Uint8Array(data);
  }
  async write(pathStr, data) {
    const fullPath = this.resolvePath(pathStr);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, typeof data === "string" ? data : Buffer.from(data));
  }
  async delete(pathStr) {
    const fullPath = this.resolvePath(pathStr);
    await fs.rm(fullPath, { recursive: true, force: true });
  }
  async exists(pathStr) {
    try {
      await fs.access(this.resolvePath(pathStr));
      return true;
    } catch {
      return false;
    }
  }
  async list(pathStr = "") {
    const fullPath = this.resolvePath(pathStr);
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const results = [];
      for (const entry of entries) {
        if (entry.isFile()) {
          const stats = await fs.stat(path.join(fullPath, entry.name));
          results.push({
            path: path.posix.join(pathStr, entry.name),
            size: stats.size,
            modifiedAt: stats.mtimeMs
          });
        }
      }
      return results;
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
  }
  async stat(pathStr) {
    const fullPath = this.resolvePath(pathStr);
    const stats = await fs.stat(fullPath);
    return {
      path: pathStr,
      size: stats.size,
      modifiedAt: stats.mtimeMs
    };
  }
  async mkdir(pathStr) {
    const fullPath = this.resolvePath(pathStr);
    await fs.mkdir(fullPath, { recursive: true });
  }
  async deleteFolder(pathStr) {
    const fullPath = this.resolvePath(pathStr);
    try {
      await fs.rm(fullPath, { recursive: true, force: true });
      return { success: true, deletedCount: 1 };
    } catch {
      return { success: false, deletedCount: 0 };
    }
  }
  async renameFolder(oldPath, newPath) {
    const oldFull = this.resolvePath(oldPath);
    const newFull = this.resolvePath(newPath);
    try {
      await fs.mkdir(path.dirname(newFull), { recursive: true });
      await fs.rename(oldFull, newFull);
      return { success: true, movedCount: 1 };
    } catch {
      return { success: false, movedCount: 0 };
    }
  }
};

// src/storage/s3Purge.ts
async function ensureS3DirectoryMarker(s3, bucketName, folderPrefix) {
  const clean = folderPrefix.replace(/^\/+|\/+$/g, "");
  if (!clean) return;
  const { PutObjectCommand: PutObjectCommand3 } = await import("@aws-sdk/client-s3");
  try {
    await s3.send(new PutObjectCommand3({
      Bucket: bucketName,
      Key: `${clean}/`,
      Body: Buffer.alloc(0),
      ContentType: "application/x-directory"
    }));
  } catch (err) {
    console.warn(`[s3Purge] Directory marker warning for ${clean}/:`, err?.message);
  }
}
async function permanentDeleteS3Object(s3, bucketName, fullKey) {
  try {
    const { ListObjectVersionsCommand, DeleteObjectsCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const versionsToDelete = [];
    try {
      const res = await s3.send(new ListObjectVersionsCommand({ Bucket: bucketName, Prefix: fullKey }));
      for (const v of res.Versions || []) {
        if (v.Key === fullKey) versionsToDelete.push({ Key: v.Key, VersionId: v.VersionId });
      }
      for (const dm of res.DeleteMarkers || []) {
        if (dm.Key === fullKey) versionsToDelete.push({ Key: dm.Key, VersionId: dm.VersionId });
      }
    } catch (verErr) {
      console.warn("[s3Purge] ListObjectVersions fallback:", verErr);
    }
    if (versionsToDelete.length > 0) {
      for (let i = 0; i < versionsToDelete.length; i += 1e3) {
        const batch = versionsToDelete.slice(i, i + 1e3);
        try {
          await s3.send(new DeleteObjectsCommand({ Bucket: bucketName, Delete: { Objects: batch, Quiet: true } }));
        } catch {
          for (const item of batch) {
            try {
              await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: item.Key, VersionId: item.VersionId }));
            } catch {
            }
          }
        }
      }
      return true;
    }
    return true;
  } catch (err) {
    console.warn(`[s3Purge] Error deleting object ${fullKey}:`, err);
    return false;
  }
}
async function permanentDeleteS3Folder(s3, bucketName, targetPrefix) {
  let deletedCount = 0;
  const bare = targetPrefix.replace(/\/+$/, "");
  const isMatch = (k) => k === bare || k === `${bare}/` || k.startsWith(`${bare}/`);
  try {
    const { ListObjectVersionsCommand, DeleteObjectsCommand, DeleteObjectCommand, ListObjectsV2Command: ListObjectsV2Command3 } = await import("@aws-sdk/client-s3");
    let keyMarker;
    let versionMarker;
    let isTruncated = true;
    while (isTruncated) {
      try {
        const input = { Bucket: bucketName, Prefix: bare };
        if (keyMarker) input.KeyMarker = keyMarker;
        if (versionMarker && keyMarker) input.VersionIdMarker = versionMarker;
        const res = await s3.send(new ListObjectVersionsCommand(input));
        const items = [];
        for (const v of res.Versions || []) if (v.Key && isMatch(v.Key)) items.push({ Key: v.Key, VersionId: v.VersionId });
        for (const dm of res.DeleteMarkers || []) if (dm.Key && isMatch(dm.Key)) items.push({ Key: dm.Key, VersionId: dm.VersionId });
        if (items.length > 0) {
          for (let i = 0; i < items.length; i += 1e3) {
            const batch = items.slice(i, i + 1e3);
            try {
              await s3.send(new DeleteObjectsCommand({ Bucket: bucketName, Delete: { Objects: batch, Quiet: true } }));
              deletedCount += batch.length;
            } catch {
              for (const it of batch) {
                try {
                  await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: it.Key, VersionId: it.VersionId }));
                  deletedCount++;
                } catch {
                }
              }
            }
          }
        }
        isTruncated = Boolean(res.IsTruncated);
        keyMarker = res.NextKeyMarker;
        versionMarker = res.NextVersionIdMarker;
      } catch {
        break;
      }
    }
    let contToken;
    let more = true;
    while (more) {
      const v2Res = await s3.send(new ListObjectsV2Command3({ Bucket: bucketName, Prefix: bare, ContinuationToken: contToken }));
      for (const obj of v2Res.Contents || []) {
        if (obj.Key && isMatch(obj.Key)) {
          await permanentDeleteS3Object(s3, bucketName, obj.Key);
          deletedCount++;
        }
      }
      more = Boolean(v2Res.IsTruncated);
      contToken = v2Res.NextContinuationToken;
    }
    return { success: true, deletedCount };
  } catch (err) {
    console.error("[s3Purge] permanentDeleteS3Folder failed:", err);
    return { success: false, deletedCount };
  }
}
async function renameS3Folder(s3, bucketName, oldPrefix, newPrefix) {
  const oldClean = oldPrefix.replace(/^\/+|\/+$/g, "");
  const newClean = newPrefix.replace(/^\/+|\/+$/g, "");
  if (!oldClean || !newClean || oldClean === newClean) return { success: false, movedCount: 0 };
  const oldFolderKey = oldClean;
  const oldDir = `${oldClean}/`;
  const newDir = `${newClean}/`;
  let movedCount = 0;
  try {
    const { ListObjectsV2Command: ListObjectsV2Command3, GetObjectCommand: GetObjectCommand3, PutObjectCommand: PutObjectCommand3 } = await import("@aws-sdk/client-s3");
    let contToken;
    let more = true;
    const items = [];
    while (more) {
      const res = await s3.send(new ListObjectsV2Command3({ Bucket: bucketName, Prefix: oldFolderKey, ContinuationToken: contToken }));
      for (const obj of res.Contents || []) {
        if (!obj.Key) continue;
        if (obj.Key === oldFolderKey || obj.Key === oldDir) items.push({ Key: obj.Key, isDir: true, subRel: "" });
        else if (obj.Key.startsWith(oldDir)) items.push({ Key: obj.Key, isDir: obj.Key.endsWith("/"), subRel: obj.Key.substring(oldDir.length) });
      }
      more = Boolean(res.IsTruncated);
      contToken = res.NextContinuationToken;
    }
    await ensureS3DirectoryMarker(s3, bucketName, newClean);
    for (const item of items) {
      if (item.isDir) {
        if (item.subRel) await ensureS3DirectoryMarker(s3, bucketName, `${newClean}/${item.subRel}`);
        continue;
      }
      const newKey = `${newDir}${item.subRel}`;
      const getRes = await s3.send(new GetObjectCommand3({ Bucket: bucketName, Key: item.Key }));
      if (getRes.Body) {
        const bytes = await getRes.Body.transformToByteArray();
        await s3.send(new PutObjectCommand3({ Bucket: bucketName, Key: newKey, Body: bytes, ContentType: getRes.ContentType || "application/octet-stream" }));
        movedCount++;
      }
    }
    await permanentDeleteS3Folder(s3, bucketName, oldFolderKey);
    return { success: true, movedCount };
  } catch (err) {
    console.error("[s3Purge] renameS3Folder failed:", err);
    return { success: false, movedCount };
  }
}

// src/storage/S3Adapter.ts
var S3Client;
var PutObjectCommand;
var GetObjectCommand;
var ListObjectsV2Command;
var HeadObjectCommand;
var S3Adapter = class extends BaseStorageAdapter {
  client;
  bucket;
  constructor(config) {
    super(config);
    this.bucket = config.bucket || "";
  }
  async ensureClient() {
    if (this.client) return;
    try {
      const aws = await import("@aws-sdk/client-s3");
      S3Client = aws.S3Client;
      PutObjectCommand = aws.PutObjectCommand;
      GetObjectCommand = aws.GetObjectCommand;
      ListObjectsV2Command = aws.ListObjectsV2Command;
      HeadObjectCommand = aws.HeadObjectCommand;
      this.client = new S3Client({
        region: this.config.region || "us-east-1",
        endpoint: this.config.endpoint,
        credentials: {
          accessKeyId: this.config.accessKey,
          secretAccessKey: this.config.secretKey
        },
        forcePathStyle: Boolean(this.config.endpoint)
      });
    } catch (e) {
      throw new Error(`@aws-sdk/client-s3 failed to initialize: ${e.message}`);
    }
  }
  async read(pathStr) {
    await this.ensureClient();
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: this.normalizePath(pathStr) });
    const response = await this.client.send(command);
    return response.Body ? await response.Body.transformToByteArray() : new Uint8Array();
  }
  async write(pathStr, data, contentType = "application/octet-stream") {
    await this.ensureClient();
    const body = typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.normalizePath(pathStr),
      Body: body,
      ContentType: contentType
    });
    await this.client.send(command);
  }
  async delete(pathStr) {
    await this.ensureClient();
    await permanentDeleteS3Object(this.client, this.bucket, this.normalizePath(pathStr));
  }
  async deleteFolder(pathStr) {
    await this.ensureClient();
    return await permanentDeleteS3Folder(this.client, this.bucket, this.normalizePath(pathStr));
  }
  async renameFolder(oldPath, newPath) {
    await this.ensureClient();
    return await renameS3Folder(this.client, this.bucket, this.normalizePath(oldPath), this.normalizePath(newPath));
  }
  async ensureDirectory(pathStr) {
    await this.ensureClient();
    await ensureS3DirectoryMarker(this.client, this.bucket, this.normalizePath(pathStr));
  }
  async exists(pathStr) {
    await this.ensureClient();
    try {
      const command = new HeadObjectCommand({ Bucket: this.bucket, Key: this.normalizePath(pathStr) });
      await this.client.send(command);
      return true;
    } catch (e) {
      if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) return false;
      throw e;
    }
  }
  async list(pathStr = "") {
    await this.ensureClient();
    const prefix = pathStr ? this.normalizePath(pathStr).replace(/\/+$/, "") + "/" : "";
    const command = new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix });
    const response = await this.client.send(command);
    return (response.Contents || []).map((item) => ({
      path: item.Key,
      size: item.Size || 0,
      modifiedAt: item.LastModified ? item.LastModified.getTime() : 0
    }));
  }
  async stat(pathStr) {
    await this.ensureClient();
    const command = new HeadObjectCommand({ Bucket: this.bucket, Key: this.normalizePath(pathStr) });
    const response = await this.client.send(command);
    return {
      path: pathStr,
      size: response.ContentLength || 0,
      modifiedAt: response.LastModified ? response.LastModified.getTime() : 0
    };
  }
  async mkdir(pathStr) {
    await this.ensureDirectory(pathStr);
  }
  async testConnection() {
    const start = performance.now();
    try {
      await this.ensureClient();
      const res = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, MaxKeys: 1 }));
      return {
        ok: true,
        latencyMs: Math.round(performance.now() - start),
        details: { bucket: this.bucket, keyCount: res.KeyCount ?? 0 }
      };
    } catch (e) {
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - start),
        error: e.message
      };
    }
  }
};

// src/storage/b2Endpoint.ts
function isSecretMasked(str) {
  return Boolean(str && (str.includes("\u2022") || str.includes("***")));
}
function resolveBackblazeEndpoint(inputEndpointOrRegion, keyId) {
  let raw = (inputEndpointOrRegion || "").trim().toLowerCase();
  raw = raw.replace(/^https?:\/\//, "").replace(/[\/?#].*$/, "").trim();
  const endpointMatch = raw.match(/(?:s3\.)?([a-z0-9-]+)\.backblazeb2\.com/i);
  if (endpointMatch) {
    const region = endpointMatch[1];
    return {
      region,
      endpoint: `https://s3.${region}.backblazeb2.com`
    };
  }
  if (raw && /^[a-z0-9-]+$/.test(raw) && !raw.includes(".")) {
    return {
      region: raw,
      endpoint: `https://s3.${raw}.backblazeb2.com`
    };
  }
  if (raw && raw.includes(".")) {
    return {
      region: "us-west-004",
      endpoint: `https://${raw}`
    };
  }
  let derivedRegion = "us-west-004";
  if (keyId) {
    const cleanKey = keyId.trim();
    if (cleanKey.startsWith("005")) derivedRegion = "us-east-005";
    else if (cleanKey.startsWith("004")) derivedRegion = "us-west-004";
    else if (cleanKey.startsWith("003")) derivedRegion = "eu-central-003";
    else if (cleanKey.startsWith("002")) derivedRegion = "us-west-002";
    else if (cleanKey.startsWith("001")) derivedRegion = "us-west-001";
    else if (cleanKey.startsWith("000")) derivedRegion = "us-west-000";
  }
  return {
    region: derivedRegion,
    endpoint: `https://s3.${derivedRegion}.backblazeb2.com`
  };
}
function normalizeBackblazeCredentials(inputKeyId, inputAppKey) {
  let keyId = (inputKeyId || "").trim();
  let appKey = (inputAppKey || "").trim();
  const rawCombined = `${keyId}
${appKey}`;
  const idMatch = rawCombined.match(/keyID[:\s]+([0-9a-zA-Z]{12,36})/i);
  const secretMatch = rawCombined.match(/applicationKey[:\s]+([0-9a-zA-Z/+=_-]{20,64})/i);
  if (idMatch && secretMatch) {
    keyId = idMatch[1].trim();
    appKey = secretMatch[1].trim();
  }
  if (keyId.startsWith("K00") && (!appKey || appKey.startsWith("00") || appKey.length === 25)) {
    const temp = keyId;
    keyId = appKey || temp;
    appKey = temp;
  }
  if (isSecretMasked(appKey)) {
    throw new Error("BACKBLAZE_APP_KEY_MASKED: Application Key secret is masked.");
  }
  return { keyId, appKey };
}

// src/storage/BackblazeB2Adapter.ts
var S3Client2;
var PutObjectCommand2;
var GetObjectCommand2;
var ListObjectsV2Command2;
var HeadObjectCommand2;
var BackblazeB2Adapter = class extends BaseStorageAdapter {
  client;
  bucket;
  constructor(config) {
    super(config);
    this.bucket = config.b2BucketName || config.bucket || "";
  }
  async ensureClient() {
    if (this.client) return;
    try {
      const aws = await import("@aws-sdk/client-s3");
      S3Client2 = aws.S3Client;
      PutObjectCommand2 = aws.PutObjectCommand;
      GetObjectCommand2 = aws.GetObjectCommand;
      ListObjectsV2Command2 = aws.ListObjectsV2Command;
      HeadObjectCommand2 = aws.HeadObjectCommand;
      const rawKeyId = this.config.b2KeyId || this.config.accessKey || this.config.keyId;
      const rawAppKey = this.config.b2ApplicationKey || this.config.secretKey || this.config.applicationKey;
      const { keyId, appKey } = normalizeBackblazeCredentials(rawKeyId, rawAppKey);
      const rawEndpoint = this.config.b2Endpoint || this.config.endpoint || this.config.b2Region || this.config.region;
      const { endpoint, region } = resolveBackblazeEndpoint(rawEndpoint, keyId);
      this.client = new S3Client2({
        region,
        endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: keyId,
          secretAccessKey: appKey
        }
      });
    } catch (e) {
      throw new Error(`[BackblazeB2Adapter] S3Client initialization error: ${e.message}`);
    }
  }
  async read(pathStr) {
    await this.ensureClient();
    const command = new GetObjectCommand2({ Bucket: this.bucket, Key: this.normalizePath(pathStr) });
    const response = await this.client.send(command);
    return response.Body ? await response.Body.transformToByteArray() : new Uint8Array();
  }
  async write(pathStr, data, contentType = "text/plain") {
    await this.ensureClient();
    const body = typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data);
    const command = new PutObjectCommand2({
      Bucket: this.bucket,
      Key: this.normalizePath(pathStr),
      Body: body,
      ContentType: contentType
    });
    await this.client.send(command);
  }
  async delete(pathStr) {
    await this.ensureClient();
    await permanentDeleteS3Object(this.client, this.bucket, this.normalizePath(pathStr));
  }
  async deleteFolder(pathStr) {
    await this.ensureClient();
    return await permanentDeleteS3Folder(this.client, this.bucket, this.normalizePath(pathStr));
  }
  async renameFolder(oldPath, newPath) {
    await this.ensureClient();
    return await renameS3Folder(
      this.client,
      this.bucket,
      this.normalizePath(oldPath),
      this.normalizePath(newPath)
    );
  }
  async ensureDirectory(pathStr) {
    await this.ensureClient();
    await ensureS3DirectoryMarker(this.client, this.bucket, this.normalizePath(pathStr));
  }
  async exists(pathStr) {
    await this.ensureClient();
    try {
      const command = new HeadObjectCommand2({ Bucket: this.bucket, Key: this.normalizePath(pathStr) });
      await this.client.send(command);
      return true;
    } catch (e) {
      if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) return false;
      throw e;
    }
  }
  async list(pathStr = "") {
    await this.ensureClient();
    const prefix = pathStr ? this.normalizePath(pathStr).replace(/\/+$/, "") + "/" : "";
    const command = new ListObjectsV2Command2({ Bucket: this.bucket, Prefix: prefix });
    const response = await this.client.send(command);
    return (response.Contents || []).map((item) => ({
      path: item.Key,
      size: item.Size || 0,
      modifiedAt: item.LastModified ? item.LastModified.getTime() : 0
    }));
  }
  async stat(pathStr) {
    await this.ensureClient();
    const command = new HeadObjectCommand2({ Bucket: this.bucket, Key: this.normalizePath(pathStr) });
    const response = await this.client.send(command);
    return {
      path: pathStr,
      size: response.ContentLength || 0,
      modifiedAt: response.LastModified ? response.LastModified.getTime() : 0
    };
  }
  async mkdir(pathStr) {
    await this.ensureDirectory(pathStr);
  }
  async testConnection() {
    const start = performance.now();
    try {
      await this.ensureClient();
      const res = await this.client.send(new ListObjectsV2Command2({ Bucket: this.bucket, MaxKeys: 1 }));
      return {
        ok: true,
        latencyMs: Math.round(performance.now() - start),
        details: { bucket: this.bucket, keyCount: res.KeyCount ?? 0 }
      };
    } catch (e) {
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - start),
        error: e.message
      };
    }
  }
};

// src/storage/SupabaseStorageAdapter.ts
var createClient;
var SupabaseStorageAdapter = class extends BaseStorageAdapter {
  client;
  bucket;
  constructor(config) {
    super(config);
    this.bucket = config.bucket || "";
  }
  async ensureClient() {
    if (this.client) return;
    try {
      const sb = await import("@supabase/supabase-js");
      createClient = sb.createClient;
      this.client = createClient(this.config.endpoint, this.config.accessKey);
    } catch (e) {
      throw new Error("@supabase/supabase-js is not installed or failed to initialize.");
    }
  }
  async read(pathStr) {
    await this.ensureClient();
    const { data, error } = await this.client.storage.from(this.bucket).download(this.normalizePath(pathStr));
    if (error) throw error;
    const arrayBuffer = await data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
  async write(pathStr, data) {
    await this.ensureClient();
    const { error } = await this.client.storage.from(this.bucket).upload(this.normalizePath(pathStr), data, { upsert: true });
    if (error) throw error;
  }
  async delete(pathStr) {
    await this.ensureClient();
    const { error } = await this.client.storage.from(this.bucket).remove([this.normalizePath(pathStr)]);
    if (error) throw error;
  }
  async exists(pathStr) {
    await this.ensureClient();
    try {
      await this.stat(pathStr);
      return true;
    } catch {
      return false;
    }
  }
  async list(pathStr = "") {
    await this.ensureClient();
    const { data, error } = await this.client.storage.from(this.bucket).list(this.normalizePath(pathStr));
    if (error) throw error;
    return data.map((item) => ({
      path: item.name,
      size: item.metadata?.size || 0,
      modifiedAt: item.metadata?.lastModified ? new Date(item.metadata.lastModified).getTime() : 0
    }));
  }
  async stat(pathStr) {
    await this.ensureClient();
    const dir = pathStr.split("/").slice(0, -1).join("/");
    const name = pathStr.split("/").pop();
    const { data, error } = await this.client.storage.from(this.bucket).list(dir, { search: name });
    if (error || !data || data.length === 0) {
      throw new Error("Not found");
    }
    const item = data.find((d) => d.name === name);
    if (!item) throw new Error("Not found");
    return {
      path: pathStr,
      size: item.metadata?.size || 0,
      modifiedAt: item.metadata?.lastModified ? new Date(item.metadata.lastModified).getTime() : 0
    };
  }
  async mkdir(_pathStr) {
  }
};

// src/storage/StorageAdapterFactory.ts
var StorageAdapterFactory = class {
  static create(config) {
    switch (config.provider) {
      case "local_fs":
        return new LocalFSAdapter(config);
      case "s3":
      case "cloudflare_r2":
      case "r2":
        return new S3Adapter(config);
      case "backblaze_b2":
      case "b2":
        return new BackblazeB2Adapter(config);
      case "supabase":
        return new SupabaseStorageAdapter(config);
      default:
        throw new Error(`Unsupported storage provider: ${config.provider}`);
    }
  }
};

export {
  BaseStorageAdapter,
  LocalFSAdapter,
  ensureS3DirectoryMarker,
  permanentDeleteS3Object,
  permanentDeleteS3Folder,
  renameS3Folder,
  S3Adapter,
  isSecretMasked,
  resolveBackblazeEndpoint,
  normalizeBackblazeCredentials,
  BackblazeB2Adapter,
  SupabaseStorageAdapter,
  StorageAdapterFactory
};
