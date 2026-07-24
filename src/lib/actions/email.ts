"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendNotificationEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log("Mock Email Sent to:", to);
      console.log("Subject:", subject);
      return { success: true, mocked: true };
    }

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

    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to send email via Resend:", error);
    return { success: false, error: error.message };
  }
}

