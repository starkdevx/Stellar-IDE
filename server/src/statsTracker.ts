import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface UserStats {
  visits: number;
  compilations: {
    success: number;
    failed: number;
  };
  firstSeen: string;
  lastActive: string;
}

interface StatsSchema {
  salt: string;
  summary: {
    totalCompilations: number;
    successfulCompilations: number;
    failedCompilations: number;
    totalVisits: number;
    uniqueUsers: number;
  };
  users: Record<string, UserStats>;
}

// Store stats.json inside test-build / workspace directory
const STATS_FILE = path.resolve(process.env.WORKSPACE_DIR || path.resolve(process.cwd(), '../test-build'), 'stats.json');

class StatsTracker {
  private stats: StatsSchema = {
    salt: '',
    summary: {
      totalCompilations: 0,
      successfulCompilations: 0,
      failedCompilations: 0,
      totalVisits: 0,
      uniqueUsers: 0
    },
    users: {}
  };

  constructor() {
    this.loadStats();
  }

  private loadStats() {
    try {
      if (fs.existsSync(STATS_FILE)) {
        const fileContent = fs.readFileSync(STATS_FILE, 'utf8');
        const parsed = JSON.parse(fileContent);
        if (parsed.salt) {
          this.stats = parsed;
          return;
        }
      }
    } catch (err) {
      console.error('[STATS] Error reading stats file, resetting:', err);
    }

    // Generate a secure persistent hashing salt to keep IP anonymization stable across server restarts
    this.stats.salt = crypto.randomBytes(32).toString('hex');
    this.saveStatsSync();
  }

  private saveStatsSync() {
    try {
      const dir = path.dirname(STATS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STATS_FILE, JSON.stringify(this.stats, null, 2), 'utf8');
    } catch (err) {
      console.error('[STATS] Error writing stats file:', err);
    }
  }

  private async saveStatsAsync() {
    try {
      const dir = path.dirname(STATS_FILE);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(STATS_FILE, JSON.stringify(this.stats, null, 2), 'utf8');
    } catch (err) {
      console.error('[STATS] Async save error:', err);
    }
  }

  /**
   * Generates a stable anonymized hash for a client IP address (GDPR/CCPA compliant)
   */
  private getHash(ip: string): string {
    return crypto
      .createHash('sha256')
      .update(ip + this.stats.salt)
      .digest('hex');
  }

  /**
   * Records a user session visit (called on page load)
   */
  public recordVisit(ip: string) {
    const hashed = this.getHash(ip);
    const now = new Date().toISOString();

    this.stats.summary.totalVisits += 1;

    if (!this.stats.users[hashed]) {
      this.stats.users[hashed] = {
        visits: 1,
        compilations: { success: 0, failed: 0 },
        firstSeen: now,
        lastActive: now
      };
      this.stats.summary.uniqueUsers = Object.keys(this.stats.users).length;
      console.log(`[STATS] New unique user detected. Total: ${this.stats.summary.uniqueUsers}`);
    } else {
      this.stats.users[hashed].visits += 1;
      this.stats.users[hashed].lastActive = now;
    }

    this.saveStatsAsync();
  }

  /**
   * Records a contract compilation compile event
   */
  public recordCompilation(ip: string, success: boolean) {
    const hashed = this.getHash(ip);
    const now = new Date().toISOString();

    this.stats.summary.totalCompilations += 1;
    if (success) {
      this.stats.summary.successfulCompilations += 1;
    } else {
      this.stats.summary.failedCompilations += 1;
    }

    if (!this.stats.users[hashed]) {
      this.stats.users[hashed] = {
        visits: 1,
        compilations: { success: success ? 1 : 0, failed: success ? 0 : 1 },
        firstSeen: now,
        lastActive: now
      };
      this.stats.summary.uniqueUsers = Object.keys(this.stats.users).length;
    } else {
      if (success) {
        this.stats.users[hashed].compilations.success += 1;
      } else {
        this.stats.users[hashed].compilations.failed += 1;
      }
      this.stats.users[hashed].lastActive = now;
    }

    console.log(`[STATS] Compile recorded. Success: ${success} | Total Compiles: ${this.stats.summary.totalCompilations}`);
    this.saveStatsAsync();
  }

  /**
   * Returns copy of stats data without exposing internal hashing salt (CWE-200 prevention)
   */
  public getStats() {
    const { salt, ...safeStats } = this.stats;
    return safeStats;
  }
}

export const statsTracker = new StatsTracker();
