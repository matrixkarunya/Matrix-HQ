import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Firestore does not delete subcollections when a parent document is removed.
// Keep any future related event data here so deletions happen in one place.
const RELATED_SUBCOLLECTIONS = ["tasks", "attendance"];

async function deleteInChunks(documents) {
  for (let index = 0; index < documents.length; index += 400) {
    const batch = writeBatch(db);
    documents.slice(index, index + 400).forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

export async function deleteEventAndRelatedData(eventId) {
  if (!eventId || !db) {
    throw new Error("Invalid event id");
  }

  for (const subcollectionName of RELATED_SUBCOLLECTIONS) {
    const subcollectionRef = collection(db, "events", eventId, subcollectionName);
    const snapshot = await getDocs(subcollectionRef);

    if (snapshot.empty) {
      continue;
    }

    await deleteInChunks(snapshot.docs);
  }

  for (const [collectionName, fieldName] of [["completionRequests", "eventId"], ["workLogs", "eventId"]]) {
    const snapshot = await getDocs(query(collection(db, collectionName), where(fieldName, "==", eventId)));
    await deleteInChunks(snapshot.docs);
  }

  await deleteDoc(doc(db, "events", eventId));
}
