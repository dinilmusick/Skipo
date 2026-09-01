import fs from 'fs';
import path from 'path';
import { getVaultAbsolutePath, ensureWorkspaceExists } from './workspaceFS';

export interface AdminAuditLog {
  id: string;
  actor_user_id: string;
  action: string;
  timestamp: string;
  target_type?: string;
  target_id?: string;
  ip_address?: string;
  details?: string;
}

let inMemoryLogs: AdminAuditLog[] = [];

function getAuditLogsFilePath(): string {
  try {
    ensureWorkspaceExists();
    const dir = path.join(getVaultAbsolutePath(), '.docustack', 'control_plane');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'audit_logs.json');
  } catch {
    return '/tmp/audit_logs.json';
  }
}

export function getAdminAuditLogs(limit: number = 100): AdminAuditLog[] {
  const filePath = getAuditLogsFilePath();
  let logs: AdminAuditLog[] = [];

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      logs = JSON.parse(raw);
    } else if (inMemoryLogs.length > 0) {
      logs = [...inMemoryLogs];
    }
  } catch {
    logs = [...inMemoryLogs];
  }

  return logs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function logAdminEvent(event: {
  actor_user_id: string;
  action: string;
  target_type?: string;
  target_id?: string;
  ip_address?: string;
  details?: string;
}): AdminAuditLog {
  const newLog: AdminAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actor_user_id: event.actor_user_id,
    action: event.action,
    timestamp: new Date().toISOString(),
    target_type: event.target_type,
    target_id: event.target_id,
    ip_address: event.ip_address || '127.0.0.1',
    details: event.details,
  };

  inMemoryLogs.push(newLog);
  if (inMemoryLogs.length > 1000) {
    inMemoryLogs = inMemoryLogs.slice(inMemoryLogs.length - 1000);
  }

  try {
    const filePath = getAuditLogsFilePath();
    let logs: AdminAuditLog[] = [];
    if (fs.existsSync(filePath)) {
      try {
        logs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        logs = [];
      }
    }
    logs.push(newLog);
    if (logs.length > 1000) {
      logs = logs.slice(logs.length - 1000);
    }
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf-8');
  } catch {
    // Read-only filesystem is safely handled in memory
  }

  return newLog;
}
