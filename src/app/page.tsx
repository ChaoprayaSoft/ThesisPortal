import Link from "next/link";
import styles from "./page.module.css";
import { ArrowRight, BookOpen, Clock, Users, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <div className={styles.container}>
      {/* Soft Pastel Aurora Ambient Backgrounds */}
      <div className={styles.aurora1}></div>
      <div className={styles.aurora2}></div>
      <div className={styles.aurora3}></div>

      <main className={styles.main}>
        <div className={styles.badge}>
          <span className={styles.badgeDot}></span>
          Next-Gen Academic Thesis Management
        </div>

        <h1 className={styles.title}>
          Elevate Your <span className={styles.gradientText}>Thesis Journey</span>
        </h1>

        <p className={styles.subtitle}>
          A minimal, unified workspace for students, advisors, and committee members to collaborate, review manuscripts, and track academic milestones in real time.
        </p>

        <div className={styles.actions}>
          <Link href="/login" className={styles.primaryButton}>
            Access Dashboard
            <ArrowRight size={18} className={styles.arrow} />
          </Link>
        </div>

        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={`${styles.iconWrap} ${styles.iconPeriwinkle}`}>
              <BookOpen size={20} />
            </div>
            <h3>Structured Milestones</h3>
            <p>Step-by-step progression from initial advisor submission to final committee approval and graduation.</p>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.iconWrap} ${styles.iconMint}`}>
              <Users size={20} />
            </div>
            <h3>Role-Adaptive Reviews</h3>
            <p>Seamlessly toggle review workspaces as an Advisor, Committee Member, or Chairperson.</p>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.iconWrap} ${styles.iconPeach}`}>
              <Clock size={20} />
            </div>
            <h3>Smart Reminders</h3>
            <p>Automated stage deadline countdowns and scheduled alerts keep projects on track without friction.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
