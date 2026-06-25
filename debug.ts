import { db } from "./src/lib/firebase";
import { getDocs, collection } from "firebase/firestore";

async function run() {
  const s = await getDocs(collection(db, "studentGroups"));
  console.log("Groups:", s.docs.length);
  s.docs.forEach(d => console.log(d.id, d.data().name));
}

run();
