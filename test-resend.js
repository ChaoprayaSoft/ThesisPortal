require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

async function testResend() {
  console.log("Testing Resend API Key...");
  
  if (!process.env.RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY in .env.local");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromName = process.env.EMAIL_FROM || "ThesisPortal Admin";
  const fromAddress = `${fromName} <onboarding@resend.dev>`;
  
  // Resend sandbox only allows sending to the verified email address
  // We'll use the user's Gmail to test
  const toAddress = process.env.EMAIL_USER;

  console.log("Sending from:", fromAddress);
  console.log("Sending to:", toAddress);

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      subject: "Test Email from Resend via Thesis Portal",
      html: "<p>This is a test email to verify that the Resend integration is working perfectly!</p>",
    });

    if (error) {
      console.error("Resend API Error:", error);
    } else {
      console.log("Email sent successfully! Message ID:", data.id);
    }
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

testResend();
