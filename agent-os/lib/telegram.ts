/**
 * Minimal Telegram Bot API client for sending completion notifications.
 *
 * Bot creation and chat ID lookup happen entirely on Telegram's side (via
 * @BotFather and @userinfobot), so this is just the `sendMessage` call.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  if (!botToken || !chatId) return false;
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("Telegram send failed:", error);
    return false;
  }
}
