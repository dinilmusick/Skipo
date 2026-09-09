/**
 * @fileoverview API Governance Abuse Detector Template
 */

export const governanceAbuseDetectorTemplate = () => `import { AbuseAnomalyType } from './types';

const BLOCKLIST_BAN_DURATION_MS = 15 * 60 * 1000; // 15 minutes

class AbuseAnomalyDetector {
  private blockedIps = new Map<string, number>();
  private anomalyCounters = new Map<string, { count: number; windowStart: number }>();

  public isIpBlocked(ip: string): boolean {
    const banExpiresAt = this.blockedIps.get(ip);
    if (!banExpiresAt) return false;
    if (Date.now() > banExpiresAt) {
      this.blockedIps.delete(ip);
      return false;
    }
    return true;
  }

  public blockIp(ip: string, durationMs = BLOCKLIST_BAN_DURATION_MS): void {
    this.blockedIps.set(ip, Date.now() + durationMs);
  }

  public recordStatus(ip: string, statusCode: number): void {
    if (statusCode === 401) this.incrementAnomaly(ip, '401_SPIKE', 10, 60000);
    else if (statusCode === 403) this.incrementAnomaly(ip, '403_SPIKE', 10, 60000);
    else if (statusCode === 429) this.incrementAnomaly(ip, '429_SPIKE', 15, 60000);
    else if (statusCode >= 500) this.incrementAnomaly(ip, '5xx_SPIKE', 20, 60000);
  }

  private incrementAnomaly(ip: string, type: AbuseAnomalyType, threshold: number, windowMs: number): void {
    const key = \`\${ip}:\${type}\`;
    const now = Date.now();
    let record = this.anomalyCounters.get(key);
    if (!record || now - record.windowStart > windowMs) {
      record = { count: 0, windowStart: now };
      this.anomalyCounters.set(key, record);
    }
    record.count++;
    if (record.count >= threshold) {
      this.blockIp(ip);
    }
  }
}

export const abuseDetector = new AbuseAnomalyDetector();
export const isIpBlocked = (ip: string) => abuseDetector.isIpBlocked(ip);
export const recordRequestOutcome = (ip: string, statusCode: number) => abuseDetector.recordStatus(ip, statusCode);
`;
