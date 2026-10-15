/**
 * Google Apps Script - ThesisPortal Email Dispatcher
 *
 * Instructions:
 * 1. Go to https://script.google.com/ and create a New Project using tiawongsombat@gmail.com
 * 2. Replace the contents of Code.gs with this file
 * 3. Change API_SECRET below to your own secret passphrase (matching GOOGLE_APPS_SCRIPT_SECRET in .env.local)
 * 4. Click "Deploy" > "New deployment"
 *    - Type: "Web app"
 *    - Description: "ThesisPortal Email Dispatcher"
 *    - Execute as: "Me (tiawongsombat@gmail.com)"
 *    - Who has access: "Anyone"
 * 5. Click "Deploy", authorize Google permissions.
 * 6. Copy the "Web app URL" (ends in /exec) and paste it into GOOGLE_APPS_SCRIPT_URL in your .env.local and Vercel.
 */

// Shared secret passphrase to prevent unauthorized usage
const API_SECRET = "thesisportal";

/**
 * Handle HTTP GET - Allows visiting the Web App URL in your browser to verify it's online
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "ThesisPortal Mailer Web App is running active on tiawongsombat@gmail.com!",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle HTTP POST - Dispatches the email via GmailApp
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing request payload"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const payload = JSON.parse(e.postData.contents);
    const { secret, to, subject, html } = payload;

    // Verify secret
    if (API_SECRET && secret !== API_SECRET) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Unauthorized: Invalid secret key"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!to || !subject || !html) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing required fields: to, subject, or html"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Send email via GmailApp
    GmailApp.sendEmail(to, subject, "", {
      htmlBody: html,
      name: "ThesisPortal System"
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      recipient: to,
      dispatchedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
