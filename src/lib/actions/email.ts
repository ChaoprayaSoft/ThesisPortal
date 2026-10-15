"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendNotificationEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  try {
    const gasUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const gasSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

    // 1. Google Apps Script Web App (Gmail API / GmailApp)
    if (gasUrl && gasUrl.trim() !== "") {
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          secret: gasSecret || "",
          to,
          subject,
          html,
        }),
        redirect: "follow",
      });

      const rawText = await response.text();
      let result: any;
      try {
        result = JSON.parse(rawText);
      } catch {
        result = { success: response.ok, raw: rawText };
      }

      if (result.success === false) {
        console.error("Google Apps Script Mailer Error:", result.error || result);
        return { success: false, error: result.error || "Google Apps Script Error" };
      }

      return { success: true, provider: "google_apps_script", data: result };
    }

    // 2. Resend API Fallback
    if (process.env.RESEND_API_KEY) {
      const fromName = process.env.EMAIL_FROM || "ThesisPortal Admin";
      const fromAddress = `${fromName} <admin@taradmoobann.com>`;

      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: [to],
        subject: subject,
        html: html,
      });

      if (error) {
        console.error("Resend API Error:", error);
        return { success: false, error: error.message };
      }

      return { success: true, provider: "resend", data };
    }

    // 3. Fallback mock logger if neither service configured
    console.log("[Mock Email] Sent to:", to);
    console.log("[Mock Email] Subject:", subject);
    return { success: true, mocked: true };
  } catch (error: any) {
    console.error("Failed to send notification email:", error);
    return { success: false, error: error.message };
  }
}

