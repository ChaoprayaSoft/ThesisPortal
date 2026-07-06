import { useEffect, useState } from "react";
import { X } from "lucide-react";
import styles from "./ImportantNoteModal.module.css";
import { getImportantNote } from "@/lib/db/settings";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fieldOfStudy?: string;
}

export default function ImportantNoteModal({ isOpen, onClose, fieldOfStudy }: Props) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getImportantNote(fieldOfStudy || "").then((note) => {
        setContent(note);
        setLoading(false);
      });
    }
  }, [isOpen, fieldOfStudy]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Important Note</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className={styles.content}>
          {loading ? (
            <div className={styles.emptyState}>Loading note...</div>
          ) : content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <div className={styles.emptyState}>No important notes at this time.</div>
          )}
        </div>
      </div>
    </div>
  );
}
