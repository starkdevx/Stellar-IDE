import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserStats extends Document {
  ipHash: string;
  visits: number;
  compilations: {
    success: number;
    failed: number;
  };
  deploys: number;
  interactions: number;
  firstSeen: Date;
  lastActive: Date;
}

const UserStatsSchema = new Schema<IUserStats>(
  {
    ipHash: { type: String, required: true, unique: true },
    visits: { type: Number, default: 0 },
    compilations: {
      success: { type: Number, default: 0 },
      failed: { type: Number, default: 0 }
    },
    deploys: { type: Number, default: 0 },
    interactions: { type: Number, default: 0 },
    firstSeen: { type: Date, required: true },
    lastActive: { type: Date, required: true }
  },
  { collection: 'userstats', timestamps: true }
);

const UserStats: Model<IUserStats> =
  mongoose.models.UserStats || mongoose.model<IUserStats>('UserStats', UserStatsSchema);

export default UserStats;
