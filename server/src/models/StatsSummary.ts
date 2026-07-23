import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStatsSummary extends Document {
  salt: string;
  totalCompilations: number;
  successfulCompilations: number;
  failedCompilations: number;
  totalVisits: number;
  totalDeploys: number;
  totalInteractions: number;
}

const StatsSummarySchema = new Schema<IStatsSummary>(
  {
    salt: { type: String, required: true },
    totalCompilations: { type: Number, default: 0 },
    successfulCompilations: { type: Number, default: 0 },
    failedCompilations: { type: Number, default: 0 },
    totalVisits: { type: Number, default: 0 },
    totalDeploys: { type: Number, default: 0 },
    totalInteractions: { type: Number, default: 0 }
  },
  { collection: 'statssummaries', timestamps: true }
);

const StatsSummary: Model<IStatsSummary> =
  mongoose.models.StatsSummary || mongoose.model<IStatsSummary>('StatsSummary', StatsSummarySchema);

export default StatsSummary;
