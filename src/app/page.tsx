import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.badge}>
            🎓 Academic Workflow Platform
          </div>

          <h1 className={styles.title}>
            <span className={styles.gradientText}>Thesis Portal</span>
          </h1>

          <p className={styles.subtitle}>
            A next-gen platform for students and lecturers to track, review, and crush thesis goals seamlessly.
          </p>

          <div className={styles.actions}>
            <Link href="/login" className={styles.primaryButton}>
              <span>Login to Dashboard</span>
              <span className={styles.arrow}>&rarr;</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
