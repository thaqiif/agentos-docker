import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { botToken, chatId, message } = body;

    if (!botToken || !chatId || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const success = await sendTelegramMessage(botToken, chatId, message);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to send Telegram message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
