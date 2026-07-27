export type EmailDelivery = {
  status: "sent" | "not_configured" | "failed";
  providerStatus?: number;
};

export function emailIsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(input: { to: string; subject: string; text: string }): Promise<EmailDelivery> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { status: "not_configured" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text }),
    });
    if (!response.ok) {
      console.error("transactional_email_rejected", { status: response.status });
      return { status: "failed", providerStatus: response.status };
    }
    return { status: "sent", providerStatus: response.status };
  } catch (error) {
    console.error("transactional_email_failed", error instanceof Error ? error.name : "unknown");
    return { status: "failed" };
  }
}
