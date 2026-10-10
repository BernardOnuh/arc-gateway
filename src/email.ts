import { config } from "./config.js";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Emails "sent" during tests, for assertions. */
export const testOutbox: Email[] = [];

/**
 * Sends through Resend when RESEND_API_KEY is set. Without it, the email is
 * written to the log (development) so links can still be followed. Never
 * throws: callers respond the same way whether or not delivery worked.
 */
export async function sendEmail(email: Email, log: { info: (o: object, m: string) => void; error: (o: object, m: string) => void }): Promise<boolean> {
  if (config.isTest) {
    testOutbox.push(email);
    return true;
  }
  if (!config.resendApiKey) {
    log.info({ to: email.to, subject: email.subject, text: email.text }, "email (not sent: RESEND_API_KEY unset)");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${config.resendApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: config.emailFrom, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    });
    if (!res.ok) {
      log.error({ status: res.status, body: (await res.text()).slice(0, 300) }, "email send failed");
      return false;
    }
    return true;
  } catch (e) {
    log.error({ err: String(e) }, "email send failed");
    return false;
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Plain, client-safe HTML around a single call to action. */
export function actionEmail({ heading, body, action, url, footer }: { heading: string; body: string; action: string; url: string; footer: string }): Pick<Email, "text" | "html"> {
  return {
    text: `${heading}\n\n${body}\n\n${action}: ${url}\n\n${footer}`,
    html: `<!doctype html><html><body style="margin:0;background:#eef0fa;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1f3f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:20px;padding:32px">
<tr><td style="font-size:20px;font-weight:600;padding-bottom:12px">${escape(heading)}</td></tr>
<tr><td style="font-size:15px;line-height:1.55;color:#555b88;padding-bottom:24px">${escape(body)}</td></tr>
<tr><td><a href="${escape(url)}" style="display:inline-block;background:#1c1f3f;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${escape(action)}</a></td></tr>
<tr><td style="font-size:12px;line-height:1.5;color:#8a8fb3;padding-top:24px">${escape(footer)}</td></tr>
</table></td></tr></table></body></html>`,
  };
}
