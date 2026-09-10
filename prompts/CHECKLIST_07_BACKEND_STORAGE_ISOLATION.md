# TASK CHECKLIST 07: UNIVERSAL BACKEND & STORAGE DECOUPLING

$$\text{ControlPlane} \cap \text{DataPlane} = \emptyset \quad \wedge \quad \text{BufferDisk}(\text{Serverless}) = \emptyset$$

## 1. Prescriptive Backend Invariants (Blocking)

1. **Strict Control Plane vs Data Plane Isolation**:
   - `Control Plane` (`/api/auth`, user management, session validation, workspace directory) must NEVER handle raw binary uploads or file streaming directly.
   - `Data Plane` (`/api/storage`, presigned URL generators) must handle all file object transfers without touching user accounts.
2. **Zero Serverless Disk Proxying Law**:
   - **BANNED**: Buffering file uploads into ephemeral local disk `/tmp` in serverless route handlers (`fs.writeFile('/tmp/...')`).
   - **MANDATORY**: Generate direct presigned S3/B2 transfer URLs (`/api/storage/upload-url`, `@aws-sdk/s3-request-presigner`) and upload directly from client.
3. **External Credential Link Law**:
   - Every input asking for external credentials (OpenAI, Anthropic, Gemini, B2, S3, Supabase) MUST use `@skipo/ui` `CredentialField` and provide a direct link navigating the user to the vendor's API key console.

---

## 2. Dynamic Execution Gate

### Google AI Studio (Python Code Execution):
```python
import subprocess
result = subprocess.run(["python3", "checklists/07_backend_storage_isolation.py", "."], capture_output=True, text=True)
print(result.stdout)
assert result.returncode == 0, "Backend & storage decoupling validation failed!"
```

### Local CLI / Terminal:
```bash
python3 checklists/07_backend_storage_isolation.py .
```
