"use server";

import { resend } from "../resend";

export async function sendNotificationEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log("Mock Email Sent to:", to);
      console.log("Subject:", subject);
      return { success: true, mocked: true };
    }

    const { data, error } = await resend.emails.send({
      from: "noreply@thesisportal.edu",
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error("Resend Error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to send email:", error);
    return { success: false, error: error.message };
  }
}
