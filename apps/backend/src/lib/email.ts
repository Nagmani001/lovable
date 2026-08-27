import { initEmail as initEmailClient } from "@repo/email/email";

let initialized = false;

export function initEmail(): void {
  if (initialized) return;

  if (process.env.RESEND_API_KEY) {
    initEmailClient({
      resendApiKey: process.env.RESEND_API_KEY,
    });
  } else {
    initEmailClient({
      smtp: {
        host: process.env.SMTP_HOST!,
        port: Number(process.env.SMTP_PORT!),
        user: process.env.SMTP_USER!,
        password: process.env.SMTP_PASSWORD!,
      },
    });
  }

  initialized = true;
}
