"use server";

import nodemailer from "nodemailer";

export async function sendNotificationEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("Mock Email Sent to:", to);
      console.log("Subject:", subject);
      return { success: true, mocked: true };
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"Thesis Portal Admin" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
    });

    return { success: true, data: info };
  } catch (error: any) {
    console.error("Failed to send email via Nodemailer:", error);
    return { success: false, error: error.message };
  }
}

