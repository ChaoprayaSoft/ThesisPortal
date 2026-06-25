import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      {/* Decorative Blobs */}
      <div className={styles.blob1}></div>
      <div className={styles.blob2}></div>

      <main className={styles.main}>
        <div className={styles.hero}>

          <h1 className={styles.title}>
            <span className={styles.gradientText}>Thesis Portal</span> 🎓
          </h1>
          <p className={styles.subtitle}>
            A next-gen platform for students and lecturers to track, review, and crush thesis goals seamlessly
          </p>
          <div className={styles.actions}>
            <Link href="/login" className={styles.primaryButton}>
              Login to Dashboard <span className={styles.arrow}>→</span>
            </Link>
          </div>


        </div>
      </main>
    </div>
  );
}
