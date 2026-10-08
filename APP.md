# 🎓 ThesisPortal - Complete Application Architecture & Documentation

> **ThesisPortal** is a full-stack, enterprise-grade web platform built to manage, track, review, and automate the academic thesis and capstone project lifecycle for universities and faculties.

---

## 📑 Table of Contents
1. [Overview & Core Value](#-overview--core-value)
2. [Technology Stack](#-technology-stack)
3. [Design System & UI Architecture](#-design-system--ui-architecture)
4. [System Architecture](#-system-architecture)
5. [User Roles & Access Control](#-user-roles--access-control)
6. [Complete Thesis Lifecycle & Stage Machine](#-complete-thesis-lifecycle--stage-machine)
7. [Data Models & Schema Reference](#-data-models--schema-reference)
8. [Core Modules & Features](#-core-modules--features)
   - [8.1 Authentication & Session Management](#81-authentication--session-management)
   - [8.2 Student Portal](#82-student-portal)
   - [8.3 Lecturer Review Portal](#83-lecturer-review-portal)
   - [8.4 Admin Management Suite](#84-admin-management-suite)
   - [8.5 Automated Reminder Engine (Cron)](#85-automated-reminder-engine-cron)
   - [8.6 Field-Specific Important Notes](#86-field-specific-important-notes)
   - [8.7 Excel Student Import Engine](#87-excel-student-import-engine)
9. [API & Server Endpoints](#-api--server-endpoints)
10. [Environment Configuration](#-environment-configuration)
11. [Local Development & Deployment](#-local-development--deployment)

---

## 🎨 Design System & UI Architecture

ThesisPortal features a modern, vibrant, and eye-friendly **Chromatic Solid Design System** built on curated solid color tokens, soft slate surfaces, and responsive CSS modules:

### 1. Curated Solid Color Palette
| Role / Semantic | Color Name | Hex Token | Light Tint Token | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Primary & Brand** | Royal Blue / Electric Indigo | `#2563eb` | `#eff6ff` | Primary brand accent, main CTAs (`.btnPrimary`), active nav highlights |
| **Success & Graduated** | Vibrant Mint & Emerald | `#10b981` | `#ecfdf5` | Approvals, Graduated status, completed milestones |
| **Warning & Deadlines** | Warm Amber & Honey | `#f59e0b` | `#fffbeb` | Pending reviews, countdown timers, deadline alerts |
| **Danger & Revise** | Soft Ruby Coral | `#ef4444` | `#fef2f2` | Revisions required, overdue alerts, deletions |
| **Info & Highlights** | Vibrant Sky Cyan | `#0284c7` | `#f0f9ff` | Stage progression, chairperson reviews, informational chips |
| **Committee & Faculty** | Royal Iris Violet | `#7c3aed` | `#f5f3ff` | Committee badges, faculty panels, secondary borders |

### 2. Typography & Surfaces
* **Font Family**: Google Fonts `Plus Jakarta Sans`, supplemented with `Sarabun` for bilingual Thai/English legibility.
* **Canvas Surface**: Gentle Slate (`#f8fafc`) to eliminate stark white glare and reduce eye fatigue.
* **Elevation**: Soft diffused drop shadows (`--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-modal`) avoiding harsh dark borders.
* **Component Styling**: Reusable CSS classes (`.card`, `.btnPrimary`, `.btnSecondary`, `.badge`, `.tableResponsive`, `.modalOverlay`, `.modalContent`, `.modalClose`).
* **Dedicated Modals**: Full-screen backdrop detail popups for both Lecturer (`/lecturer`) and Student (`/student`) workspaces for deep inspection of metadata, rosters, deadlines, and activity trails.

---

## 🌟 Overview & Core Value

Managing academic theses often suffers from fragmented communications, lost feedback in email threads, delayed committee sign-offs, and lack of administrative visibility. 

**ThesisPortal** centralizes the entire workflow:
* **For Students**: Real-time progress tracking, deadline countdowns, direct submission of manuscript links, equipment clearance requests, and immediate notification on revision requests.
* **For Lecturers & Advisors**: Role-adaptive workspaces with fast review capabilities, quick comment templates, external markup link integration, topic modification approval, and one-click stage sign-offs.
* **For Administrators**: Real-time KPI dashboards, workload distribution matrices across faculty members, batch student importing via Excel, custom deadline settings, and field-of-study tailored instructions.

---

## 🛠 Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | [Next.js](https://nextjs.org/) (App Router, Server Actions, Route Handlers) |
| **Frontend Library** | [React 19](https://react.dev/), TypeScript |
| **Styling** | Vanilla CSS Modules, CSS Custom Properties / Design Tokens, Glassmorphism, CSS Transitions |
| **Database** | [Google Cloud Firebase Firestore](https://firebase.google.com/docs/firestore) (Real-time snapshots & REST via Admin SDK) |
| **Authentication** | Firebase Authentication (Google OAuth 2.0) |
| **Backend & Admin SDK** | `firebase-admin` (Node.js runtime for Cron & batch operations) |
| **Email Service** | [Resend](https://resend.com/) API (Transactional emails & reminders) |
| **Rich Text Editor** | [TipTap](https://tiptap.dev/) (StarterKit, Link Extension) |
| **File / Spreadsheet Parsing** | [SheetJS (`xlsx`)](https://sheetjs.com/) for bulk student roster ingestion |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Hosting & Automation** | [Vercel](https://vercel.com/) & Vercel Cron Jobs |

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph Client["Client Tier (Next.js / React 19)"]
        A[Student Portal\n/student]
        B[Lecturer Portal\n/lecturer]
        C[Admin Portal\n/admin/*]
        Auth[AuthProvider / Google OAuth]
    end

    subgraph Backend["Next.js Server & APIs"]
        SA[Server Actions\nlib/actions/email.ts]
        CRON[Vercel Cron API\n/api/cron/reminders]
        IMPORT[Upload API\n/api/upload-group]
    end

    subgraph Firebase["Google Cloud Firebase Services"]
        FAuth[Firebase Auth\nGoogle Identity]
        Firestore[(Cloud Firestore\nReal-time DB)]
        FAdmin[Firebase Admin SDK]
    end

    subgraph External["External Integrations"]
        Resend[Resend Email API]
        GDrive[Google Drive / External Links]
    end

    Auth --> FAuth
    A <-->|Real-time Snapshot| Firestore
    B <-->|Real-time Snapshot| Firestore
    C <-->|Firestore Queries| Firestore
    
    CRON --> FAdmin
    IMPORT --> FAdmin
    FAdmin --> Firestore
    SA --> Resend
    CRON --> Resend
    A -.-> GDrive
    B -.-> GDrive
```

---

## 👥 User Roles & Access Control

The platform implements role-based access control (RBAC) enforced via Firestore user records:

1. **Student (`Student`)**:
   - Access: `/student`
   - Scope: View and interact only with their own thesis group.
   - Permissions: Propose topic/abstract edits, submit manuscript links, request equipment clearance, view timeline and feedback.

2. **Lecturer (`Lecturer`)**:
   - Access: `/lecturer`
   - Scope: Access theses where the lecturer's email is assigned as **Advisor**, **Committee Member**, **Chairperson**, or **Equipment Checker**.
   - Permissions: Review manuscripts, provide comments (free-text or quick templates), approve/reject stages, approve abstract revisions, approve equipment clearances, set stage deadlines.

3. **Administrator (`Admin`)**:
   - Access: `/admin`, `/admin/thesis`, `/admin/groups`, `/admin/lecturers`, `/admin/note`, `/admin/comments`, plus access to `/lecturer`.
   - Permissions: Full CRUD over theses, student groups, lecturers, fields of study, deadline overrides, force-graduation, rich-text note editor, comment templates, and executive workload analytics.

---

## 🔄 Complete Thesis Lifecycle & Stage Machine

```mermaid
stateDiagram-v2
    [*] --> Stage0_Preparing: Thesis Created by Admin
    
    state "Stage 0: Advisor Review" as Stage0 {
        Stage0_Preparing --> Stage0_PendingAdvisor: Student submits manuscript
        Stage0_PendingAdvisor --> Stage0_Revise: Advisor requests revision
        Stage0_Revise --> Stage0_PendingAdvisor: Student re-submits
        Stage0_PendingAdvisor --> Stage1_Preparing: Advisor Approves
    }

    state "Stage 1: Committee Review" as Stage1 {
        Stage1_Preparing --> Stage1_PendingCommittee: Student submits to Committee
        Stage1_PendingCommittee --> Stage1_Revise: Committee requests revision
        Stage1_Revise --> Stage1_PendingCommittee: Student re-submits
        Stage1_PendingCommittee --> Stage2_Preparing: All Committee Members Approve
    }

    state "Stage 2: Chairperson Review" as Stage2 {
        Stage2_Preparing --> Stage2_PendingChairperson: Student submits to Chairperson
        Stage2_PendingChairperson --> Stage2_Revise: Chairperson requests revision
        Stage2_Revise --> Stage2_PendingChairperson: Student re-submits
        Stage2_PendingChairperson --> Stage3_Preparing: Chairperson Approves
    }

    state "Stage 3: Sign. Advisor" as Stage3 {
        Stage3_Preparing --> Stage3_PendingSignAdvisor: Student submits final manuscript
        Stage3_PendingSignAdvisor --> Stage4_Preparing: Advisor Signs
    }

    state "Stage 4: Sign. Committee" as Stage4 {
        Stage4_Preparing --> Stage4_PendingSignCommittee: Student submits for Committee sign
        Stage4_PendingSignCommittee --> Stage5_Preparing: All Committee Members Sign
    }

    state "Stage 5: Sign. Chairperson" as Stage5 {
        Stage5_Preparing --> Stage5_PendingSignChairperson: Student submits for Chair sign
        Stage5_PendingSignChairperson --> Stage6_Graduate: Chairperson Signs
    }

    state "Stage 6: Graduated / Completed" as Stage6 {
        Stage6_Graduate --> [*]
    }
```

### Stage Summary Table

| Stage Index | Stage Display Name | Reviewer | Next Transition |
| :---: | :--- | :--- | :--- |
| **0** | `Advisor` | Primary Thesis Advisor | Moves to Stage 1 upon approval |
| **1** | `Committee` | 1 or more Committee Members | Moves to Stage 2 once **all** committee members approve |
| **2** | `Chairperson` | Defense Chairperson | Moves to Stage 3; triggers equipment clearance check |
| **3** | `Sign. Advisor` | Primary Thesis Advisor | Moves to Stage 4 upon signature |
| **4** | `Sign. Committee` | Committee Members | Moves to Stage 5 once **all** members sign |
| **5** | `Sign. Chairperson` | Defense Chairperson | Moves to Stage 6 (Graduate) upon signature |
| **6** | `Graduate` | *Finalized* | Academic requirements completed |

---

## 🗄 Data Models & Schema Reference

### 1. `theses` Collection
Represents a student group's thesis project.

```typescript
interface ThesisData {
  id?: string;
  title: string;
  abstract: string;
  scope: string;
  year?: string;                    // e.g. "2567" (Thai Buddhist Era)
  fieldOfStudy?: string;            // Field / Major branch
  groupId: string;                  // Reference to studentGroups.id
  studentUids: string[];            // Student email addresses
  lecturerUids: {
    advisor: string;                // Advisor email
    committees: string[];           // Array of Committee member emails
    chairperson: string;            // Chairperson email
  };
  committeeApprovals?: string[];    // Approved emails for Stage 1
  committeeSignApprovals?: string[];// Signed emails for Stage 4
  pendingAbstract?: string;         // Student proposed abstract awaiting advisor approval
  pendingScope?: string;            // Student proposed scope awaiting advisor approval
  equipmentCheckStatus?: "Pending Request" | "Requested" | "Approved";
  equipmentChecker?: string;        // Assigned Lecturer email for equipment check
  status: ThesisStatus;             // "Preparing" | "Pending Advisor" | "Pending Committee" | "Revise" | "Graduate" | etc.
  currentStage: number;             // 0 to 6
  createdAt: number;                // Epoch timestamp
  statusUpdatedAt?: number;         // Epoch timestamp
  deadlines?: {
    advisor?: number | null;
    committee?: number | null;
    chairperson?: number | null;
  };
  graduateComment?: string;         // Optional administrator graduation remark
}
```

### 2. `thesisActivities` Collection
Audit log of all actions, submissions, revisions, and approvals for every thesis.

```typescript
interface ThesisActivity {
  id?: string;
  thesisId: string;
  type: string;                     // "Manuscript Submitted", "Reviewed", "Topic Edit Proposed", etc.
  timestamp: number;
  actorEmail: string;
  actorName?: string;
  actorRole: string;                // "Student" | "Advisor" | "Committee" | "Chairperson" | "Equipment Checker" | "Admin"
  description: string;
  links?: {                         // Submitted links (Manuscript, PDF, Slide, Repo, etc.)
    type: string;
    url: string;
  }[];
}
```

### 3. `users` Collection
User accounts mapped by Google OAuth email.

```typescript
interface UserData {
  id?: string;
  uid?: string;
  email: string;
  name_th: string;                  // Thai Full Name
  name_en: string;                  // English Full Name
  role: "Admin" | "Lecturer" | "Student";
  fieldOfStudy?: string;
  profileImageUrl?: string;
  createdAt: number;
}
```

### 4. `studentGroups` Collection
Group profiles created directly or via Excel bulk upload.

```typescript
interface StudentGroup {
  id?: string;
  name: string;                     // e.g. "Group 12 - IoT Smart Greenhouse"
  fieldOfStudy?: string;
  students: {
    studentId: string;              // e.g. "64010123"
    name: string;
    name_en?: string;
    email: string;
  }[];
}
```

### 5. `settings` Collection
System configuration and global templates:
* **Doc `important_note`**: Keyed by field of study with TipTap HTML content.
* **Doc `comment_templates`**: Array of pre-defined feedback sentences for lecturers.

---

## 🚀 Core Modules & Features

### 7.1 Authentication & Session Management
* **Google OAuth**: Instant single sign-on matching institutional email accounts with pre-registered Firestore user records.
* **Automatic Inactivity Timeout**: A 3-hour inactivity timeout monitoring mouse, keyboard, and touch events to ensure security on shared lab computers (`src/components/AuthProvider.tsx`).
* **Real-time Role Routing**: Automatically directs students to `/student`, lecturers to `/lecturer`, and admins to `/admin`.

### 7.2 Student Portal (`/student`)
* **Live Progress Bar**: Visual stepper highlighting completed, active, and upcoming stages.
* **Deadline Countdown**: Real-time ticker displaying remaining days, hours, minutes, and seconds until the stage deadline, with dynamic overdue alerts.
* **Submission Module**: Support for multiple external artifacts per submission:
  * Google Drive documents / folders
  * Marked-up PDFs
  * GitHub repositories
  * Live project demos
* **Equipment Clearance**: Request equipment inspection with notes, tracking verification status independently.
* **Topic Modification System**: Submit requested updates to thesis title, abstract, or scope with automated notification sent to the Advisor.
* **Field-Specific Important Note**: Dynamic floating modal containing guidance and formatting templates tailored to the student's field of study.

### 7.3 Lecturer Review Portal (`/lecturer`)
* **Role-Adaptive Switcher**: Allows lecturers to switch perspectives seamlessly when they hold multiple roles across different theses (e.g., Advisor on Thesis A, Committee Member on Thesis B, Chairperson on Thesis C).
* **Review Workspace**:
  * Quick-access links to student submissions.
  * Comment templates dropdown for one-click insertion of common review notes.
  * Upload marked-up review links.
  * Direct action buttons: **Approve Stage** or **Request Revision**.
* **Topic Change Reviews**: Approve or reject student abstract/scope adjustments with automatic audit logging.
* **Equipment Verification**: One-click approval or rejection for lab/equipment clearances.
* **Deadline Adjustments**: Edit deadlines for Advisor, Committee, and Chairperson stages.

### 7.4 Admin Management Suite (`/admin`)
* **Executive Dashboard (`/admin`)**:
  * Total Theses, Active Student Groups, Faculty Lecturers, and Overdue Projects.
  * Interactive stage breakdown metrics.
  * Field of Study distribution chart.
  * **Lecturer Workload Matrix**: Comprehensive overview of Advisor, Committee, and Chairperson assignments per faculty member to prevent overload.
* **Thesis Manager (`/admin/thesis`)**:
  * Create new thesis records and assign student groups and faculty committees.
  * Search, filter by field, year, status, and title.
  * Pagination with configurable page size.
  * Manual status overrides and **Direct Graduation Modal** with administrative reason logging.
* **Group & Student Manager (`/admin/groups`)**:
  * Batch upload student rosters via Excel spreadsheets (`.xlsx`).
  * Add, edit, or remove individual students within a group.
  * Automatic student user account provisioning during roster import.
* **Lecturer Registry (`/admin/lecturers`)**:
  * Register faculty members with English/Thai names and field of study.
  * Search and edit faculty profiles.
* **Important Notes Manager (`/admin/note`)**:
  * Full TipTap WYSIWYG editor with headings, bold/italic, lists, and external link embedding.
  * Independent note storage per academic field of study.
* **Comment Template Editor (`/admin/comments`)**:
  * Configure standard feedback sentences available to lecturers during review.

### 7.5 Automated Reminder Engine (Cron)
Located at `/api/cron/reminders`, this automated route runs via Vercel Cron:
* Scans all active theses in non-graduated states.
* Determines if a thesis has been waiting in a specific approval state for **more than 4 days** (96 hours).
* Dispatches HTML reminder emails via **Resend** directly to the pending party:
  * Advisor when pending advisor review or signature.
  * Unapproved Committee members when pending committee review or signature.
  * Chairperson when pending chairperson review or signature.
  * Students when a thesis is placed in `Revise` or `Preparing` stage.
  * Equipment Checker when an equipment inspection is pending.

### 7.6 Field-Specific Important Notes
Different engineering and academic fields often have distinct submission guidelines, templates, and laboratory requirements. The system stores separate rich-text instructions for each field:
* แขนงวิชาโทรคมนาคม (Telecommunications)
* แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์ (Computer & AI)
* แขนงวิชาเครื่องมือวัดและควบคุม (Instrumentation & Control)
* แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย (Broadcast & Digital Media)
* ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์ (Embedded Systems & Electronic Design)
* สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์ (Applied Electronics Engineering)

---

## 📡 API & Server Endpoints

### 1. `GET /api/cron/reminders`
* **Purpose**: Automated cron worker for overdue reminders.
* **Authentication**: Optional Bearer token validation via `CRON_SECRET`.
* **Output**: `{ success: boolean, remindersSent: number }`.

### 2. `POST /api/upload-group`
* **Purpose**: Parses uploaded `.xlsx` file, creates `studentGroups` document, and provisions `users` records in batch.
* **Payload**: `FormData` (`file: File`, `groupName: string`, `fieldOfStudy: string`).
* **Output**: `{ success: true, groupId: string, studentCount: number }`.

### 3. Server Action: `sendNotificationEmail` (`src/lib/actions/email.ts`)
* **Purpose**: Dispatches transactional emails via Resend API.
* **Parameters**: `{ to: string, subject: string, html: string }`.

---

## 🔐 Environment Configuration

Create a `.env.local` file in the project root with the following variables:

```env
# Firebase Client SDK Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="your-firebase-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"

# Firebase Admin SDK Configuration (Server-side)
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Email Delivery (Resend)
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxx"
EMAIL_FROM="Thesis Portal System"

# Cron Security (Optional)
CRON_SECRET="your-cron-secret-token"
```

---

## 💻 Local Development & Deployment

### 1. Prerequisites
* Node.js 20.x or higher
* npm or yarn or pnpm

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm run start
```

### 5. Vercel Deployment & Cron Configuration
The project is configured with `vercel.json` for automatic cron schedule execution:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```
* Deploy directly with `vercel` or link your GitHub repository to Vercel.
* Set environment variables in Vercel Project Settings under **Environment Variables**.

---

## 📄 License & Attribution
Designed and built for university thesis management with modern web standards, real-time sync, and enterprise reliability.
