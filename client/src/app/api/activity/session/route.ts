import { NextResponse } from "next/server";

export async function POST() {
  try {
    let targetBackend = process.env.COMPILER_BACKEND_URL || process.env.NEXT_PUBLIC_COMPILER_URL || "http://localhost:5000";

    // Format protocol scheme if missing
    if (!targetBackend.startsWith("http://") && !targetBackend.startsWith("https://")) {
      targetBackend = `http://${targetBackend}`;
    }
    targetBackend = targetBackend.replace(/\/+$/, "");

    const backendEndpoint = `${targetBackend}/api/activity/session`;

    const res = await fetch(backendEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      }
    });

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Session Proxy Connection Error: ${err.message}` },
      { status: 200 }
    );
  }
}
