import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendNotificationEmail } from "@/lib/actions/email";
import { ThesisData } from "@/lib/db/theses";

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

    const sendReminder = async (toEmail: string, role: string, actionRequiredText: string, thesisTitle: string) => {
      await sendNotificationEmail({
        to: toEmail,
        subject: `Action Required: Thesis Reminder (${role})`,
        html: `<p>Dear ${role},</p>
        <p>${actionRequiredText}</p>
        <p>This action has been pending for more than 4 days. Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a> at your earliest convenience to take action.</p>
        <p>Best regards,<br/>Thesis Portal System</p>`
      });
      reminderCount++;
    };

    for (const doc of thesesSnapshot.docs) {
      const thesis = doc.data() as ThesisData;

      // Skip if student has not first submitted to the advisor yet (still in Preparing state at Stage 0)
      const hasFirstSubmitted = !(thesis.currentStage === 0 && thesis.status === "Preparing");
      if (!hasFirstSubmitted) {
        continue;
      }

      const lastUpdate = thesis.statusUpdatedAt || thesis.createdAt || now;
      const timeSinceUpdate = now - lastUpdate;

      if (timeSinceUpdate > FOUR_DAYS_MS) {
        // 1. Check thesis status-based actions
        if (thesis.status === "Pending Advisor" && thesis.lecturerUids?.advisor) {
          await sendReminder(
            thesis.lecturerUids.advisor,
            "Advisor",
            `The thesis <b>"${thesis.title}"</b> is pending your review and approval.`,
            thesis.title
          );
        } else if (thesis.status === "Pending Sign. Advisor" && thesis.lecturerUids?.advisor) {
          await sendReminder(
            thesis.lecturerUids.advisor,
            "Advisor",
            `The thesis <b>"${thesis.title}"</b> is pending your signature.`,
            thesis.title
          );
        } else if (thesis.status === "Pending Committee" && thesis.lecturerUids?.committees) {
          const alreadyApproved = thesis.committeeApprovals || [];
          const remainingCommittees = thesis.lecturerUids.committees.filter(
            (email: string) => !alreadyApproved.includes(email)
          );
          for (const email of remainingCommittees) {
            await sendReminder(
              email,
              "Committee Member",
              `The thesis <b>"${thesis.title}"</b> is pending your review and approval.`,
              thesis.title
            );
          }
        } else if (thesis.status === "Pending Sign. Committee" && thesis.lecturerUids?.committees) {
          const alreadySigned = thesis.committeeSignApprovals || [];
          const remainingCommittees = thesis.lecturerUids.committees.filter(
            (email: string) => !alreadySigned.includes(email)
          );
          for (const email of remainingCommittees) {
            await sendReminder(
              email,
              "Committee Member",
              `The thesis <b>"${thesis.title}"</b> is pending your signature.`,
              thesis.title
            );
          }
        } else if (thesis.status === "Pending Chairperson" && thesis.lecturerUids?.chairperson) {
          await sendReminder(
            thesis.lecturerUids.chairperson,
            "Chairperson",
            `The thesis <b>"${thesis.title}"</b> is pending your review and approval.`,
            thesis.title
          );
        } else if (thesis.status === "Pending Sign. Chairperson" && thesis.lecturerUids?.chairperson) {
          await sendReminder(
            thesis.lecturerUids.chairperson,
            "Chairperson",
            `The thesis <b>"${thesis.title}"</b> is pending your signature.`,
            thesis.title
          );
        } else if (thesis.status === "Revise" && thesis.studentUids) {
          for (const email of thesis.studentUids) {
            await sendReminder(
              email,
              "Student",
              `Your thesis <b>"${thesis.title}"</b> requires revision. Please check the feedback and upload revised materials.`,
              thesis.title
            );
          }
        } else if (thesis.status === "Preparing" && thesis.studentUids) {
          for (const email of thesis.studentUids) {
            await sendReminder(
              email,
              "Student",
              `Your thesis <b>"${thesis.title}"</b> is waiting for you to submit your manuscript/materials for the next stage of approval.`,
              thesis.title
            );
          }
        }

        // 2. Check independent equipment check request status
        if (thesis.equipmentCheckStatus === "Requested" && thesis.equipmentChecker) {
          await sendReminder(
            thesis.equipmentChecker,
            "Equipment Checker",
            `An equipment check has been requested for the thesis <b>"${thesis.title}"</b> and is pending your review.`,
            thesis.title
          );
        }

        // 3. Check independent proposed topic edits
        if ((thesis.pendingAbstract || thesis.pendingScope) && thesis.lecturerUids?.advisor) {
          await sendReminder(
            thesis.lecturerUids.advisor,
            "Advisor",
            `The thesis <b>"${thesis.title}"</b> has proposed topic (abstract/scope) edits pending your review and approval.`,
            thesis.title
          );
        }
      }
    }

    return NextResponse.json({ success: true, remindersSent: reminderCount });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

