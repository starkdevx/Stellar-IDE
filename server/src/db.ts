import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/StellarIDE';

export async function dbConnect() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: process.env.MONGODB_DB || 'StellarIDE'
    });
    console.log('[DB] Connected to MongoDB');
  } catch (err) {
    console.error('[DB] Connection error:', err);
  }
}
