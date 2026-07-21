import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let targetBackend = process.env.COMPILER_BACKEND_URL || process.env.NEXT_PUBLIC_COMPILER_URL || "http://localhost:5000";

    // Ensure protocol scheme formatting
    if (!targetBackend.startsWith("http://") && !targetBackend.startsWith("https://")) {
      targetBackend = `http://${targetBackend}`;
    }
    targetBackend = targetBackend.replace(/\/+$/, "");

    const backendEndpoint = targetBackend.endsWith("/api/compile")
      ? targetBackend
      : `${targetBackend}/api/compile`;

    const res = await fetch(backendEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Compiler Proxy Connection Error: ${err.message}` },
      { status: 500 }
    );
  }
}
