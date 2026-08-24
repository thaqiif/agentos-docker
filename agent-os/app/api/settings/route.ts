import { NextRequest, NextResponse } from "next/server";
import { getDb, queries } from "@/lib/db";
import { statusStream } from "@/lib/status-stream";

export async function GET() {
  try {
    const db = getDb();
    const rows = queries.getAllSettings(db).all() as {
      key: string;
      value: string;
    }[];
    const settings: Record<string, string> = {};
    for (const { key, value } of rows) {
      settings[key] = value;
    }
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error getting settings:", error);
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Missing key or value" },
        { status: 400 }
      );
    }

    const db = getDb();
    queries.setSetting(db).run(key, String(value));

    // Turning on "keep watching with no browser open" needs the ticker
    // running right away, not whenever the next tab happens to subscribe.
    if (key === "notifyKeepServerAlive" && String(value) === "true") {
      statusStream.ensureRunning();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting:", error);
    return NextResponse.json(
      { error: "Failed to save setting" },
      { status: 500 }
    );
  }
}
