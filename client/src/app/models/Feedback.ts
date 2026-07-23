import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFeedback extends Document {
  title: string;
  description: string;
  type: "issue" | "feedback" | "feature_request";
  rating: number;
  email?: string;
  createdAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ["issue", "feedback", "feature_request"],
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    email: { type: String, required: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const Feedback: Model<IFeedback> = mongoose.models.Feedback || mongoose.model<IFeedback>("Feedback", FeedbackSchema);

export default Feedback;
