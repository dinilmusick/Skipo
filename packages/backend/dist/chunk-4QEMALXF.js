// src/storage/B2DirectClient.ts
var authCache = /* @__PURE__ */ new Map();
async function authorizeB2(keyId, applicationKey) {
  const cacheKey = `${keyId}:${applicationKey}`;
  const cached = authCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const basic = btoa(`${keyId.trim()}:${applicationKey.trim()}`);
  const res = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: `Basic ${basic}` }
  });
  if (!res.ok) throw new Error(`B2 Authorization failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const token = {
    authorizationToken: data.authorizationToken,
    apiUrl: data.apiUrl,
    downloadUrl: data.downloadUrl,
    accountId: data.accountId
  };
  authCache.set(cacheKey, { token, expiresAt: Date.now() + 20 * 60 * 1e3 });
  return token;
}
async function b2ListBuckets(keyId, applicationKey) {
  const auth = await authorizeB2(keyId, applicationKey);
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: auth.accountId })
  });
  if (!res.ok) throw new Error(`B2 list buckets failed: ${res.status}`);
  const data = await res.json();
  return data.buckets || [];
}
async function b2ListFileNames(keyId, applicationKey, bucketName, prefix = "") {
  const auth = await authorizeB2(keyId, applicationKey);
  const buckets = await b2ListBuckets(keyId, applicationKey);
  const bucket = buckets.find((b) => b.bucketName === bucketName);
  if (!bucket) return [];
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: bucket.bucketId, prefix, maxFileCount: 1e3 })
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}
async function b2UploadFile(keyId, applicationKey, bucketName, fileName, content, contentType = "application/json") {
  const auth = await authorizeB2(keyId, applicationKey);
  const buckets = await b2ListBuckets(keyId, applicationKey);
  const bucket = buckets.find((b) => b.bucketName === bucketName);
  if (!bucket) throw new Error(`Bucket ${bucketName} not found`);
  const urlRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: bucket.bucketId })
  });
  if (!urlRes.ok) throw new Error(`B2 get upload url failed: ${urlRes.status}`);
  const { uploadUrl, authorizationToken } = await urlRes.json();
  const raw = typeof content === "string" ? new TextEncoder().encode(content) : content;
  const hashBuffer = await crypto.subtle.digest("SHA-1", raw);
  const sha1 = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const upRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "X-Bz-File-Name": encodeURIComponent(fileName).replace(/%2F/g, "/"),
      "Content-Type": contentType,
      "Content-Length": String(raw.length),
      "X-Bz-Content-Sha1": sha1
    },
    body: raw
  });
  if (!upRes.ok) throw new Error(`B2 upload failed: ${upRes.status} ${await upRes.text()}`);
  return await upRes.json();
}
async function b2DownloadFile(keyId, applicationKey, bucketName, fileName) {
  const auth = await authorizeB2(keyId, applicationKey);
  const url = `${auth.downloadUrl}/file/${bucketName}/${encodeURI(fileName)}`;
  const res = await fetch(url, { headers: { Authorization: auth.authorizationToken } });
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

export {
  authorizeB2,
  b2ListBuckets,
  b2ListFileNames,
  b2UploadFile,
  b2DownloadFile
};
