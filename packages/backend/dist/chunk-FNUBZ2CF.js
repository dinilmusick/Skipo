// src/storage/BaseStorageAdapter.ts
import { SkipoBase } from "@skipo/core";
var BaseStorageAdapter = class extends SkipoBase {
  config;
  constructor(config) {
    super({ name: "BaseStorageAdapter" });
    this.config = config;
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
};

// src/storage/S3Adapter.ts
var S3Client;
var PutObjectCommand;
var GetObjectCommand;
var DeleteObjectCommand;
var ListObjectsV2Command;
var HeadObjectCommand;
var ListObjectVersionsCommand;
var DeleteObjectsCommand;
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
      DeleteObjectCommand = aws.DeleteObjectCommand;
      ListObjectsV2Command = aws.ListObjectsV2Command;
      HeadObjectCommand = aws.HeadObjectCommand;
      ListObjectVersionsCommand = aws.ListObjectVersionsCommand;
      DeleteObjectsCommand = aws.DeleteObjectsCommand;
      this.client = new S3Client({
        region: this.config.region,
        endpoint: this.config.endpoint,
        credentials: {
          accessKeyId: this.config.accessKey,
          secretAccessKey: this.config.secretKey
        },
        forcePathStyle: true
        // Needed for B2/R2 often
      });
    } catch (e) {
      throw new Error("@aws-sdk/client-s3 is not installed or failed to initialize.");
    }
  }
  async read(pathStr) {
    await this.ensureClient();
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: this.normalizePath(pathStr) });
    const response = await this.client.send(command);
    const byteArray = await response.Body.transformToByteArray();
    return byteArray;
  }
  async write(pathStr, data) {
    await this.ensureClient();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.normalizePath(pathStr),
      Body: data
    });
    await this.client.send(command);
  }
  async delete(pathStr) {
    await this.ensureClient();
    const key = this.normalizePath(pathStr);
    const versionsCmd = new ListObjectVersionsCommand({ Bucket: this.bucket, Prefix: key });
    const versionsRes = await this.client.send(versionsCmd);
    const objectsToDelete = [];
    if (versionsRes.Versions) {
      objectsToDelete.push(...versionsRes.Versions.map((v) => ({ Key: v.Key, VersionId: v.VersionId })));
    }
    if (versionsRes.DeleteMarkers) {
      objectsToDelete.push(...versionsRes.DeleteMarkers.map((v) => ({ Key: v.Key, VersionId: v.VersionId })));
    }
    if (objectsToDelete.length > 0) {
      const deleteCmd = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: objectsToDelete }
      });
      await this.client.send(deleteCmd);
    } else {
      const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
      await this.client.send(command);
    }
  }
  async exists(pathStr) {
    await this.ensureClient();
    try {
      const command = new HeadObjectCommand({ Bucket: this.bucket, Key: this.normalizePath(pathStr) });
      await this.client.send(command);
      return true;
    } catch (e) {
      if (e.name === "NotFound") return false;
      throw e;
    }
  }
  async list(pathStr = "") {
    await this.ensureClient();
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: pathStr ? this.normalizePath(pathStr) + "/" : ""
    });
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
  async mkdir(_pathStr) {
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
        return new S3Adapter(config);
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
  S3Adapter,
  SupabaseStorageAdapter,
  StorageAdapterFactory
};
