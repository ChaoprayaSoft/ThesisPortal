import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import styles from "./ImportantNoteModal.module.css";
import { getImportantNote } from "@/lib/db/settings";

export const DEFAULT_FIELDS_OF_STUDY = [
  "แขนงวิชาโทรคมนาคม",
  "แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์",
  "แขนงวิชาเครื่องมือวัดและควบคุม",
  "แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย",
  "ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์",
  "สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์"
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fieldOfStudy?: string;
}

export default function ImportantNoteModal({ isOpen, onClose, fieldOfStudy }: Props) {
  const [selectedField, setSelectedField] = useState<string>(fieldOfStudy || DEFAULT_FIELDS_OF_STUDY[0]);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Sync selectedField whenever fieldOfStudy prop changes
  useEffect(() => {
    if (fieldOfStudy) {
      setSelectedField(fieldOfStudy);
    }
  }, [fieldOfStudy]);

  useEffect(() => {
    if (isOpen && selectedField) {
      setLoading(true);
      getImportantNote(selectedField).then((note) => {
        setContent(note);
        setLoading(false);
      });
    }
  }, [isOpen, selectedField]);

  if (!isOpen) return null;

  const fieldOptions = Array.from(
    new Set([...DEFAULT_FIELDS_OF_STUDY, ...(fieldOfStudy ? [fieldOfStudy] : [])])
  ).filter(Boolean);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Bell size={20} />
            <h2>Important Note</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.fieldBar}>
          <label htmlFor="important-note-field-select">Field of Study:</label>
          <select
            id="important-note-field-select"
            className={styles.fieldSelect}
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
          >
            {fieldOptions.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.emptyState}>Loading note...</div>
          ) : content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <div className={styles.emptyState}>No important notes for this field of study at this time.</div>
          )}
        </div>
      </div>
    </div>
  );
}
