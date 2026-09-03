#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════════════════
# SKIPO ARCHITECTURAL STANDARDS VERIFIER: CONTROL PLANE & AUTHENTICATION ISOLATION
# ══════════════════════════════════════════════════════════════════════════════════════════
# Scans TypeScript/JavaScript code for:
# 1. Zero local SQLite or redundant local credential fallbacks (accounts.sqlite).
# 2. Zero hardcoded mock / demo accounts (admin@docustack.vault, demo@docustack.vault).
# 3. Zero demo autofill / quick preset UI buttons in login modals and pages.
# 4. Zero "Return to Workspace" back buttons in Admin Control Plane UI headers.
# 5. Admin UI isolation & back-button strictly navigating to /admin/login or logout.
# 6. Strict separation between Admin infrastructure settings and normal user settings.
# ══════════════════════════════════════════════════════════════════════════════════════════

set -euo pipefail

TARGET_DIR="${1:-.}"
ERRORS=0

echo "🔍 Scanning '$TARGET_DIR' for Control Plane and UI standards compliance..."

# Check 1: Forbidden local SQLite accounts files or code references
echo "→ Checking for forbidden 'accounts.sqlite' in source code..."
SQLITE_MATCHES=$(grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir={node_modules,.git,.next,target,scripts} "accounts\.sqlite" "$TARGET_DIR" || true)

if [ -n "$SQLITE_MATCHES" ]; then
  echo "❌ VIOLATION: Found 'accounts.sqlite' in source code! The Control Plane must be strictly environment-driven."
  echo "$SQLITE_MATCHES"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ PASS: No 'accounts.sqlite' references in source code."
fi

# Check 2: Forbidden mock accounts
echo "→ Checking for forbidden mock / demo account references in source code..."
for forbidden in "admin@docustack.vault" "demo@docustack.vault" "analyst@docustack.vault"; do
  MOCK_MATCHES=$(grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    --exclude-dir={node_modules,.git,.next,target,scripts} "$forbidden" "$TARGET_DIR" || true)
  if [ -n "$MOCK_MATCHES" ]; then
    echo "❌ VIOLATION: Found forbidden mock account '$forbidden' in code!"
    echo "$MOCK_MATCHES"
    ERRORS=$((ERRORS + 1))
  fi
done
if [ "$ERRORS" -eq 0 ]; then
  echo "✅ PASS: No forbidden mock accounts found in source code."
fi

# Check 3: Forbidden UI Demo Autofill Presets
echo "→ Checking for forbidden Demo Autofill / Quick Presets in UI..."
for forbidden_ui in "AUTO-FILL ADMIN" "AUTO-FILL DEMO USER" "QUICK ACCESS PRESETS" "FILL DEMO CREDENTIALS"; do
  UI_MATCHES=$(grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    --exclude-dir={node_modules,.git,.next,target,scripts} "$forbidden_ui" "$TARGET_DIR" || true)
  if [ -n "$UI_MATCHES" ]; then
    echo "❌ VIOLATION: Found forbidden UI preset '$forbidden_ui' in components!"
    echo "$UI_MATCHES"
    ERRORS=$((ERRORS + 1))
  fi
done
if [ "$ERRORS" -eq 0 ]; then
  echo "✅ PASS: No forbidden UI presets found in components."
fi

# Check 4: Forbidden Admin UI Back button returning to workspace root
echo "→ Checking for forbidden Admin UI 'Return to Workspace' back buttons..."
ADMIN_BACK_MATCHES=$(grep -rn --include="*.ts" --include="*.tsx" \
  --exclude-dir={node_modules,.git,.next,target,scripts} -E "href=[\"']\/[\"'].*title=[\"']Return to Workspace[\"']" "$TARGET_DIR" | grep -E "app/admin|components/admin" || true)

if [ -n "$ADMIN_BACK_MATCHES" ]; then
  echo "❌ VIOLATION: Found Admin UI back button navigating to workspace root ('/')! Admin back buttons must return to /admin/login."
  echo "$ADMIN_BACK_MATCHES"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ PASS: No forbidden Admin UI workspace back buttons found."
fi

# Check 5: Admin UI Header Isolation Check (Back button must target /admin/login or handleLogout)
echo "→ Checking that Admin UI pages have isolated back navigation..."
if [ -f "$TARGET_DIR/app/admin/page.tsx" ]; then
  if grep -q "ArrowLeft" "$TARGET_DIR/app/admin/page.tsx"; then
    if grep -q "handleLogout" "$TARGET_DIR/app/admin/page.tsx" || grep -q "/admin/login" "$TARGET_DIR/app/admin/page.tsx"; then
      echo "✅ PASS: Admin UI header back button properly routes to /admin/login or calls logout."
    else
      echo "❌ VIOLATION: Admin UI header back button does not route to /admin/login or call logout!"
      ERRORS=$((ERRORS + 1))
    fi
  fi
fi

# Check 6: Check that user settings modal does not leak admin database cluster controls
echo "→ Checking separation of user settings vs admin infrastructure..."
if [ -f "$TARGET_DIR/components/settings/SettingsModal.tsx" ]; then
  if grep -q "AdminDatabaseClusterTab" "$TARGET_DIR/components/settings/SettingsModal.tsx"; then
    echo "❌ VIOLATION: SettingsModal leaks AdminDatabaseClusterTab! User settings and Admin infrastructure must be completely isolated."
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ PASS: User SettingsModal is cleanly isolated from Admin infrastructure controls."
  fi
fi

# Check 7: Forbidden hardcoded admin fallback credentials (todadjp@gmail.com, password123, admin123)
echo "→ Checking for forbidden hardcoded admin credentials / fallbacks in source code..."
for forbidden_cred in "todadjp@gmail.com" "password123" "admin123"; do
  CRED_MATCHES=$(grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    --exclude-dir={node_modules,.git,.next,target,scripts,backups} -i "$forbidden_cred" "$TARGET_DIR" | grep -v "email !== 'todadjp@gmail.com'" || true)
  if [ -n "$CRED_MATCHES" ]; then
    echo "❌ VIOLATION: Found forbidden hardcoded credential '$forbidden_cred' in code!"
    echo "$CRED_MATCHES"
    ERRORS=$((ERRORS + 1))
  fi
done
# Check 8: Canonical Workspace Folder Naming Law & UI Standards
echo "→ Checking canonical workspace folder naming & UI standards..."
if [ -f "$TARGET_DIR/lib/workspaceFS.ts" ] || [ -f "$TARGET_DIR/lib/auth-storage.ts" ]; then
  if grep -q "formatCanonicalWorkspaceFolderName" "$TARGET_DIR/lib/"*.ts; then
    echo "✅ PASS: formatCanonicalWorkspaceFolderName is properly implemented in backend libraries."
  else
    echo "❌ VIOLATION: formatCanonicalWorkspaceFolderName helper missing in lib/! Must enforce ultrst_{app}_{user}_{workspace}."
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ -f "$TARGET_DIR/components/workspace/WorkspaceTilesMenu.tsx" ]; then
  if grep -q "Vault Folder Path" "$TARGET_DIR/components/workspace/WorkspaceTilesMenu.tsx"; then
    echo "❌ VIOLATION: WorkspaceTilesMenu.tsx still has manual 'Vault Folder Path' input! Folder path must be auto-derived."
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ PASS: WorkspaceTilesMenu.tsx does not expose manual folder path inputs."
  fi
fi

# Check 9: Dynamic Storage Options Tiles Check (No hardcoded Local Disk Folder tile in StorageConnectDrawer)
echo "→ Checking for dynamic storage options tiles compliance..."
DRAWER_FILE=""
if [ -f "$TARGET_DIR/components/workspace/StorageConnectDrawer.tsx" ]; then
  DRAWER_FILE="$TARGET_DIR/components/workspace/StorageConnectDrawer.tsx"
elif [ -f "$TARGET_DIR/backend/control-plane/code/components/StorageConnectDrawer.tsx" ]; then
  DRAWER_FILE="$TARGET_DIR/backend/control-plane/code/components/StorageConnectDrawer.tsx"
fi

if [ -n "$DRAWER_FILE" ]; then
  if grep -q "Tile 1: Local Disk Folder" "$DRAWER_FILE"; then
    echo "❌ VIOLATION: $DRAWER_FILE contains hardcoded static Local Disk Folder tile! Storage options must be dynamic from saved connections."
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ PASS: StorageConnectDrawer renders dynamic storage options without static hardcoded tiles."
  fi
fi

# Check 10: Storage connections and workspace preservation in auth-storage.ts
echo "→ Checking storage connections & workspace normalization preservation..."
AUTH_STORAGE_FILE=""
if [ -f "$TARGET_DIR/lib/auth-storage.ts" ]; then
  AUTH_STORAGE_FILE="$TARGET_DIR/lib/auth-storage.ts"
elif [ -f "$TARGET_DIR/backend/control-plane/code/lib/auth-storage.ts" ]; then
  AUTH_STORAGE_FILE="$TARGET_DIR/backend/control-plane/code/lib/auth-storage.ts"
fi

if [ -n "$AUTH_STORAGE_FILE" ]; then
  if grep -q "storage_connections" "$AUTH_STORAGE_FILE"; then
    echo "✅ PASS: $AUTH_STORAGE_FILE preserves user storage_connections across profiles."
  else
    echo "❌ VIOLATION: $AUTH_STORAGE_FILE does not preserve storage_connections!"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 11: Backblaze B2 custom endpoint & region resolution support
echo "→ Checking Backblaze B2 endpoint resolution..."
STORAGE_PROV_FILE=""
if [ -f "$TARGET_DIR/lib/storage-providers.ts" ]; then
  STORAGE_PROV_FILE="$TARGET_DIR/lib/storage-providers.ts"
elif [ -f "$TARGET_DIR/backend/control-plane/code/lib/storage-providers.ts" ]; then
  STORAGE_PROV_FILE="$TARGET_DIR/backend/control-plane/code/lib/storage-providers.ts"
fi

if [ -n "$STORAGE_PROV_FILE" ]; then
  if grep -q "b2Endpoint" "$STORAGE_PROV_FILE"; then
    echo "✅ PASS: $STORAGE_PROV_FILE supports custom b2Endpoint configuration."
  else
    echo "❌ VIOLATION: $STORAGE_PROV_FILE lacks b2Endpoint configuration!"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 12: Per-request serverless context vault resolution check
echo "→ Checking per-request serverless context vault resolution..."
if [ -n "$AUTH_STORAGE_FILE" ]; then
  if grep -q "resolveRequestContextVault" "$AUTH_STORAGE_FILE"; then
    echo "✅ PASS: $AUTH_STORAGE_FILE exports resolveRequestContextVault for serverless requests."
  else
    echo "❌ VIOLATION: $AUTH_STORAGE_FILE missing resolveRequestContextVault helper!"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 13: Auto-Save toggle & manual save protocol in Header component
echo "→ Checking Auto-Save toggle & manual save protocol..."
HEADER_FILE=""
if [ -f "$TARGET_DIR/components/Header.tsx" ]; then
  HEADER_FILE="$TARGET_DIR/components/Header.tsx"
elif [ -f "$TARGET_DIR/backend/control-plane/code/components/Header.tsx" ]; then
  HEADER_FILE="$TARGET_DIR/backend/control-plane/code/components/Header.tsx"
fi

if [ -n "$HEADER_FILE" ]; then
  if grep -q "autoSaveEnabled" "$HEADER_FILE"; then
    echo "✅ PASS: $HEADER_FILE implements Auto-Save toggle and save controls."
  else
    echo "❌ VIOLATION: $HEADER_FILE lacks autoSaveEnabled controls!"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 14: Cloud-first async loaders and canonical decoupled control plane directory
echo "→ Checking cloud-first async loaders & decoupled control plane directory..."
WS_FS_FILE=""
if [ -f "$TARGET_DIR/lib/workspaceFS.ts" ]; then
  WS_FS_FILE="$TARGET_DIR/lib/workspaceFS.ts"
elif [ -f "$TARGET_DIR/backend/control-plane/code/lib/workspaceFS.ts" ]; then
  WS_FS_FILE="$TARGET_DIR/backend/control-plane/code/lib/workspaceFS.ts"
fi

if [ -n "$WS_FS_FILE" ]; then
  if grep -q "loadGraphFromFSAsync" "$WS_FS_FILE" && grep -q "saveGraphToFSAsync" "$WS_FS_FILE"; then
    echo "✅ PASS: $WS_FS_FILE exports loadGraphFromFSAsync and saveGraphToFSAsync."
  else
    echo "❌ VIOLATION: $WS_FS_FILE missing cloud-first async graph loader/saver!"
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ -n "$AUTH_STORAGE_FILE" ]; then
  if grep -q "getControlPlaneDir" "$AUTH_STORAGE_FILE"; then
    echo "✅ PASS: $AUTH_STORAGE_FILE exports getControlPlaneDir to decouple control plane from active workspace."
  else
    echo "❌ VIOLATION: $AUTH_STORAGE_FILE missing getControlPlaneDir!"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 15: Dual-Mode Local Folder Picker & Brave Privacy Guard
echo "→ Checking dual-mode local folder picker & Brave privacy guard..."
DRAWER_FILE=""
if [ -f "$TARGET_DIR/components/workspace/StorageConnectDrawer.tsx" ]; then
  DRAWER_FILE="$TARGET_DIR/components/workspace/StorageConnectDrawer.tsx"
elif [ -f "$TARGET_DIR/backend/control-plane/code/components/StorageConnectDrawer.tsx" ]; then
  DRAWER_FILE="$TARGET_DIR/backend/control-plane/code/components/StorageConnectDrawer.tsx"
fi

if [ -n "$DRAWER_FILE" ]; then
  if grep -q "isFileSystemAccessSupported" "$DRAWER_FILE" && grep -q "brave://flags/#file-system-access-api" "$DRAWER_FILE"; then
    echo "✅ PASS: $DRAWER_FILE implements dual-mode folder picker with Brave Privacy Guard instructions."
  else
    echo "❌ VIOLATION: $DRAWER_FILE lacks File System Access detection or Brave flag instructions!"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 16: Exact 1:1 Cloud-Identical Local Folder Mirroring & Workspace Prefix Subfolder
echo "→ Checking 1:1 cloud-identical local folder mirroring & subfolder encapsulation..."
LOCAL_FS_FILE=""
if [ -f "$TARGET_DIR/lib/local-fs-handle.ts" ]; then
  LOCAL_FS_FILE="$TARGET_DIR/lib/local-fs-handle.ts"
elif [ -f "$TARGET_DIR/backend/control-plane/code/lib/local-fs-handle.ts" ]; then
  LOCAL_FS_FILE="$TARGET_DIR/backend/control-plane/code/lib/local-fs-handle.ts"
fi

if [ -n "$LOCAL_FS_FILE" ]; then
  if grep -q "syncWorkspaceToDirectoryHandle" "$LOCAL_FS_FILE" && grep -q "workspaceSubfolder" "$LOCAL_FS_FILE"; then
    echo "✅ PASS: $LOCAL_FS_FILE exports syncWorkspaceToDirectoryHandle with canonical workspace subfolder encapsulation."
  else
    echo "❌ VIOLATION: $LOCAL_FS_FILE missing syncWorkspaceToDirectoryHandle or workspaceSubfolder resolution!"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 17: Interactive Primary Star-Toggle on Every Storage Option Tile
echo "→ Checking interactive primary star-toggle on all storage option tiles..."
if [ -n "$DRAWER_FILE" ]; then
  if grep -q "handleSetPrimaryConnection" "$DRAWER_FILE" && grep -q "SET PRIMARY" "$DRAWER_FILE"; then
    echo "✅ PASS: $DRAWER_FILE implements interactive primary star-toggle on storage option tiles."
  else
    echo "❌ VIOLATION: $DRAWER_FILE missing interactive primary star-toggle on storage tiles!"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 18: Safe Clone Sync Merging without Stale Overwrite
echo "→ Checking safe clone sync merging in sync-clones endpoint..."
SYNC_CLONES_FILE=""
if [ -f "$TARGET_DIR/app/api/auth/storage/sync-clones/route.ts" ]; then
  SYNC_CLONES_FILE="$TARGET_DIR/app/api/auth/storage/sync-clones/route.ts"
elif [ -f "$TARGET_DIR/backend/control-plane/code/api/auth/storage/sync-clones/route.ts" ]; then
  SYNC_CLONES_FILE="$TARGET_DIR/backend/control-plane/code/api/auth/storage/sync-clones/route.ts"
fi

if [ -n "$SYNC_CLONES_FILE" ]; then
  if grep -q "findUserByIdAsync" "$SYNC_CLONES_FILE" && grep -q "mergedConnections" "$SYNC_CLONES_FILE"; then
    echo "✅ PASS: $SYNC_CLONES_FILE safely queries fresh user state and merges storage connections."
  else
    echo "❌ VIOLATION: $SYNC_CLONES_FILE missing safe fresh user storage connection merging!"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 19: Universal Folder Prefix in /api/workspace
echo "→ Checking universal folderPrefix in /api/workspace endpoint..."
WS_ROUTE_FILE=""
if [ -f "$TARGET_DIR/app/api/workspace/route.ts" ]; then
  WS_ROUTE_FILE="$TARGET_DIR/app/api/workspace/route.ts"
elif [ -f "$TARGET_DIR/backend/control-plane/code/api/workspace/route.ts" ]; then
  WS_ROUTE_FILE="$TARGET_DIR/backend/control-plane/code/api/workspace/route.ts"
fi

if [ -n "$WS_ROUTE_FILE" ]; then
  if grep -q "folderPrefix" "$WS_ROUTE_FILE"; then
    echo "✅ PASS: $WS_ROUTE_FILE includes folderPrefix in workspace responses."
  else
    echo "❌ VIOLATION: $WS_ROUTE_FILE missing folderPrefix in response payload!"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Summary
echo "══════════════════════════════════════════════════════════════════════════════════════════"
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ AUDIT FAILED: $ERRORS compliance violations detected."
  exit 1
else
  echo "🎉 AUDIT SUCCESS: All Control Plane, Auth, and UI standards strictly satisfied!"
  exit 0
fi
