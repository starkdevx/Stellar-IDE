import crypto from 'crypto';
import { dbConnect } from './db';
import StatsSummary from './models/StatsSummary';
import UserStats from './models/UserStats';

interface UserStatsData {
  visits: number;
  compilations: {
    success: number;
    failed: number;
  };
  deploys: number;
  interactions: number;
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
    totalDeploys: number;
    totalInteractions: number;
    uniqueUsers: number;
  };
  users: Record<string, UserStatsData>;
}

class StatsTracker {
  private stats: StatsSchema = {
    salt: '',
    summary: {
      totalCompilations: 0,
      successfulCompilations: 0,
      failedCompilations: 0,
      totalVisits: 0,
      totalDeploys: 0,
      totalInteractions: 0,
      uniqueUsers: 0
    },
    users: {}
  };

  constructor() {
    this.loadStats();
  }

  private async loadStats() {
    try {
      await dbConnect();

      // Load or create StatsSummary
      let summaryDoc = await StatsSummary.findOne();
      if (!summaryDoc) {
        const salt = crypto.randomBytes(32).toString('hex');
        summaryDoc = await StatsSummary.create({
          salt,
          totalCompilations: 0,
          successfulCompilations: 0,
          failedCompilations: 0,
          totalVisits: 0,
          totalDeploys: 0,
          totalInteractions: 0
        });
      }

      this.stats.salt = summaryDoc.salt;
      this.stats.summary = {
        totalCompilations: summaryDoc.totalCompilations,
        successfulCompilations: summaryDoc.successfulCompilations,
        failedCompilations: summaryDoc.failedCompilations,
        totalVisits: summaryDoc.totalVisits,
        totalDeploys: summaryDoc.totalDeploys,
        totalInteractions: summaryDoc.totalInteractions,
        uniqueUsers: 0
      };

      // Load all UserStats
      const userDocs = await UserStats.find();
      const usersMap: Record<string, UserStatsData> = {};
      for (const u of userDocs) {
        usersMap[u.ipHash] = {
          visits: u.visits,
          compilations: {
            success: u.compilations.success,
            failed: u.compilations.failed
          },
          deploys: u.deploys,
          interactions: u.interactions,
          firstSeen: u.firstSeen.toISOString(),
          lastActive: u.lastActive.toISOString()
        };
      }

      this.stats.users = usersMap;
      this.stats.summary.uniqueUsers = userDocs.length;

      console.log(`[STATS] Loaded stats from MongoDB. Users count: ${userDocs.length}`);
    } catch (err) {
      console.error('[STATS] Error loading stats from MongoDB:', err);
      // Generate a fallback salt in memory if DB fails, to prevent crash
      if (!this.stats.salt) {
        this.stats.salt = crypto.randomBytes(32).toString('hex');
      }
    }
  }

  private getHash(ip: string): string {
    return crypto
      .createHash('sha256')
      .update(ip + this.stats.salt)
      .digest('hex');
  }

  private async syncUserToDb(ipHash: string, user: UserStatsData) {
    try {
      await dbConnect();
      await UserStats.findOneAndUpdate(
        { ipHash },
        {
          visits: user.visits,
          compilations: user.compilations,
          deploys: user.deploys,
          interactions: user.interactions,
          firstSeen: new Date(user.firstSeen),
          lastActive: new Date(user.lastActive)
        },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (err) {
      console.error(`[STATS] Failed to sync user ${ipHash} to MongoDB:`, err);
    }
  }

  private async syncSummaryToDb() {
    try {
      await dbConnect();
      const s = this.stats.summary;
      await StatsSummary.findOneAndUpdate(
        {},
        {
          totalCompilations: s.totalCompilations,
          successfulCompilations: s.successfulCompilations,
          failedCompilations: s.failedCompilations,
          totalVisits: s.totalVisits,
          totalDeploys: s.totalDeploys,
          totalInteractions: s.totalInteractions
        },
        { upsert: true }
      );
    } catch (err) {
      console.error('[STATS] Failed to sync summary to MongoDB:', err);
    }
  }

  public recordVisit(ip: string) {
    const hashed = this.getHash(ip);
    const now = new Date().toISOString();

    this.stats.summary.totalVisits += 1;

    let user = this.stats.users[hashed];
    if (!user) {
      user = {
        visits: 1,
        compilations: { success: 0, failed: 0 },
        deploys: 0,
        interactions: 0,
        firstSeen: now,
        lastActive: now
      };
      this.stats.users[hashed] = user;
      this.stats.summary.uniqueUsers = Object.keys(this.stats.users).length;
      console.log(`[STATS] New unique user detected. Total: ${this.stats.summary.uniqueUsers}`);
    } else {
      user.visits += 1;
      user.lastActive = now;
    }

    // Run DB sync in background
    this.syncUserToDb(hashed, user);
    this.syncSummaryToDb();
  }

  public recordCompilation(ip: string, success: boolean) {
    const hashed = this.getHash(ip);
    const now = new Date().toISOString();

    this.stats.summary.totalCompilations += 1;
    if (success) {
      this.stats.summary.successfulCompilations += 1;
    } else {
      this.stats.summary.failedCompilations += 1;
    }

    let user = this.stats.users[hashed];
    if (!user) {
      user = {
        visits: 1,
        compilations: { success: success ? 1 : 0, failed: success ? 0 : 1 },
        deploys: 0,
        interactions: 0,
        firstSeen: now,
        lastActive: now
      };
      this.stats.users[hashed] = user;
      this.stats.summary.uniqueUsers = Object.keys(this.stats.users).length;
    } else {
      if (success) {
        user.compilations.success += 1;
      } else {
        user.compilations.failed += 1;
      }
      user.lastActive = now;
    }

    console.log(`[STATS] Compile recorded. Success: ${success} | Total Compiles: ${this.stats.summary.totalCompilations}`);
    
    // Run DB sync in background
    this.syncUserToDb(hashed, user);
    this.syncSummaryToDb();
  }

  public recordDeploy(ip: string) {
    const hashed = this.getHash(ip);
    const now = new Date().toISOString();

    this.stats.summary.totalDeploys += 1;

    let user = this.stats.users[hashed];
    if (!user) {
      user = {
        visits: 1,
        compilations: { success: 0, failed: 0 },
        deploys: 1,
        interactions: 0,
        firstSeen: now,
        lastActive: now
      };
      this.stats.users[hashed] = user;
      this.stats.summary.uniqueUsers = Object.keys(this.stats.users).length;
    } else {
      user.deploys += 1;
      user.lastActive = now;
    }

    console.log(`[STATS] Deploy recorded. Total Deploys: ${this.stats.summary.totalDeploys}`);
    
    // Run DB sync in background
    this.syncUserToDb(hashed, user);
    this.syncSummaryToDb();
  }

  public recordInteraction(ip: string) {
    const hashed = this.getHash(ip);
    const now = new Date().toISOString();

    this.stats.summary.totalInteractions += 1;

    let user = this.stats.users[hashed];
    if (!user) {
      user = {
        visits: 1,
        compilations: { success: 0, failed: 0 },
        deploys: 0,
        interactions: 1,
        firstSeen: now,
        lastActive: now
      };
      this.stats.users[hashed] = user;
      this.stats.summary.uniqueUsers = Object.keys(this.stats.users).length;
    } else {
      user.interactions += 1;
      user.lastActive = now;
    }

    console.log(`[STATS] Interaction recorded. Total Interactions: ${this.stats.summary.totalInteractions}`);
    
    // Run DB sync in background
    this.syncUserToDb(hashed, user);
    this.syncSummaryToDb();
  }

  public getStats() {
    const { salt, ...safeStats } = this.stats;
    return safeStats;
  }
}

export const statsTracker = new StatsTracker();
