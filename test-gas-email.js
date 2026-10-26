const fs = require('fs');
const path = require('path');

// Read .env.local if present
try {
  const envPath = path.resolve(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
} catch (e) {
  // Ignore
}

async function testGoogleAppsScriptEmail() {
  const gasUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const gasSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  const targetEmail = process.argv[2] || process.env.EMAIL_USER || "tiawongsombat@gmail.com";

  console.log("--------------------------------------------------");
  console.log("  ThesisPortal - Google Apps Script Email Test    ");
  console.log("--------------------------------------------------");
  console.log("Target URL    :", gasUrl || "(Not set in .env.local)");
  console.log("Recipient     :", targetEmail);
  console.log("Secret Length :", gasSecret ? gasSecret.length : 0);

  if (!gasUrl) {
    console.error("\n❌ Error: GOOGLE_APPS_SCRIPT_URL is not set in .env.local.");
    console.error("Please deploy your Google Apps Script and add its Web App URL to .env.local.");
    process.exit(1);
  }

  try {
    console.log("\nSending test POST request...");
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        secret: gasSecret,
        to: targetEmail,
        subject: "[ThesisPortal] ทดสอบการแจ้งเตือนอีเมล 🎓",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2563eb; margin-top: 0;">ThesisPortal Email Verification 🎓🚀</h2>
            <p>ยินดีด้วยครับ! ระบบส่งอีเมลแจ้งเตือนผ่าน <b>Google Apps Script (MailApp)</b> ใช้งานได้สมบูรณ์แล้ว</p>
            <p>ขณะนี้ระบบสามารถส่งภาษาไทยและอิโมจิได้อย่างถูกต้อง ชัดเจน ทุกแพลตฟอร์ม</p>
            <ul>
              <li>ผู้ส่ง: <b>Google Apps Script Web App</b></li>
              <li>ผู้รับ: <b>${targetEmail}</b></li>
              <li>สถานะ: <b>พร้อมใช้งานสำหรับ ThesisPortal ✨</b></li>
            </ul>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">ส่งเมื่อ: ${new Date().toLocaleString()}</p>
          </div>
        `,
      }),
      redirect: "follow",
    });

    const raw = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }

    console.log("\nResponse Status:", response.status, response.statusText);
    console.log("Response Body  :", parsed);

    if (parsed && parsed.success) {
      console.log("\n✅ SUCCESS: Test email sent successfully to " + targetEmail + "!");
    } else {
      console.log("\n❌ FAILED: The Apps Script reported an issue. Check the response above.");
    }
  } catch (err) {
    console.error("\n❌ Request failed:", err.message);
  }
}

testGoogleAppsScriptEmail();
