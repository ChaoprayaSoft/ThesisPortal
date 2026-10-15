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
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        secret: gasSecret,
        to: targetEmail,
        subject: "🎓 ThesisPortal - Test Notification Email",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #2563eb;">ThesisPortal Email Verification</h2>
            <p>Congratulations! Your Google Apps Script mail dispatcher on <b>tiawongsombat@gmail.com</b> is working properly.</p>
            <p>Emails from students, lecturers, and the automated reminder engine will now be delivered through your Google account.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">Sent at: ${new Date().toLocaleString()}</p>
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
