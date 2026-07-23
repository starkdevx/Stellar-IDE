import { NextResponse } from "next/server";
import dbConnect from "@/app/utils/db";
import Feedback from "@/app/models/Feedback";

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    const { title, description, type, rating, email } = body;

    // Strictly validate field types to prevent NoSQL Injection (CWE-89) and ensure data integrity.
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "Title is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    if (typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { success: false, error: "Description is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    if (!["issue", "feedback", "feature_request"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Type must be one of 'issue', 'feedback', or 'feature_request'." },
        { status: 400 }
      );
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json(
        { success: false, error: "Rating must be an integer between 1 and 5." },
        { status: 400 }
      );
    }

    if (email && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return NextResponse.json(
        { success: false, error: "Invalid email format." },
        { status: 400 }
      );
    }

    // Connect to database and create the feedback record
    const newFeedback = await Feedback.create({
      title: title.trim(),
      description: description.trim(),
      type,
      rating,
      email: email ? email.trim() : undefined,
    });

    return NextResponse.json({ success: true, data: newFeedback }, { status: 201 });
  } catch (err: any) {
    // Handle errors gracefully: return clean, generic messages to the client
    // and log detailed errors server-side (TODO(security) - no credentials printed in logs)
    console.error("API Error: feedback submission failed:", err.message);
    return NextResponse.json(
      { success: false, error: "Failed to submit feedback." },
      { status: 500 }
    );
  }
}
