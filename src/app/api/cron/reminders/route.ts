import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendNotificationEmail } from "@/lib/actions/email";

export async function GET(request: Request) {
  // Optional: Verify Vercel Cron Secret
  // const authHeader = request.headers.get('authorization');
  // if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new NextResponse('Unauthorized', { status: 401 });
  // }

  try {
    const thesesSnapshot = await adminDb.collection("theses").get();

    const now = Date.now();
    const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

    let reminderCount = 0;

    for (const doc of thesesSnapshot.docs) {
      const thesis = doc.data();

      if (!thesis.status || !thesis.status.startsWith("Pending")) {
        continue;
      }

      const lastUpdate = thesis.statusUpdatedAt || thesis.createdAt || now;
      const timeSinceUpdate = now - lastUpdate;

      if (timeSinceUpdate > FOUR_DAYS_MS) {
        // Send email based on who it is pending on
        let emailsToNotify: string[] = [];
        let role = "";

        if (thesis.status === "Pending Advisor" && thesis.lecturerUids?.advisor) {
          emailsToNotify.push(thesis.lecturerUids.advisor);
          role = "Advisor";
        } else if (thesis.status === "Pending Committee" && thesis.lecturerUids?.committees) {
          // Exclude committees who have already approved
          const alreadyApproved = thesis.committeeApprovals || [];
          const remainingCommittees = thesis.lecturerUids.committees.filter((email: string) => !alreadyApproved.includes(email));
          emailsToNotify = remainingCommittees;
          role = "Committee Member";
        } else if (thesis.status === "Pending Chairperson" && thesis.lecturerUids?.chairperson) {
          emailsToNotify.push(thesis.lecturerUids.chairperson);
          role = "Chairperson";
        }

        for (const email of emailsToNotify) {
          await sendNotificationEmail({
            to: email,
            subject: `Action Required: Thesis pending over 4 days`,
            html: `<p>Dear ${role},</p>
            <p>The thesis <b>"${thesis.title}"</b> has been waiting for your review for more than 4 days.</p>
            <p>Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a> at your earliest convenience to review the submission.</p>`
          });
          reminderCount++;
        }
      }
    }

    return NextResponse.json({ success: true, remindersSent: reminderCount });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
