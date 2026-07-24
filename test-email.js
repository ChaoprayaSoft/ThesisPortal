const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

async function testMail() {
  console.log("Testing email with user:", process.env.EMAIL_USER);
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("Missing EMAIL_USER or EMAIL_PASS in .env.local");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"Thesis Portal Admin" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // send to self
      subject: "Test Email from Thesis Portal",
      html: "<p>This is a test email to verify credentials are working.</p>",
    });
    console.log("Email sent successfully! Message ID:", info.messageId);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

testMail();
