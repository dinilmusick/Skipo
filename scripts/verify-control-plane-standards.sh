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

# Summary
echo "══════════════════════════════════════════════════════════════════════════════════════════"
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ AUDIT FAILED: $ERRORS compliance violations detected."
  exit 1
else
  echo "🎉 AUDIT SUCCESS: All Control Plane, Auth, and UI standards strictly satisfied!"
  exit 0
fi
