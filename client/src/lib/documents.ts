import {
  addDoc,
  collection,
  deleteDoc as deleteFirestoreDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore';
import { deleteObject, getBytes, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import { mimeTypeFor } from './format';
import type { DocumentItem } from '../types';

function userDocsCollection(uid: string) {
  return collection(db, 'users', uid, 'documents');
}

function userDocRef(uid: string, id: string) {
  return doc(db, 'users', uid, 'documents', id);
}

function toDocumentItem(id: string, data: DocumentData): DocumentItem {
  const uploadedAt = data.uploadedAt as Timestamp | null;
  return {
    id,
    name: data.name,
    category: data.category,
    size: data.size,
    mimeType: data.mimeType,
    storagePath: data.storagePath,
    uploadedAt: uploadedAt ? uploadedAt.toMillis() : Date.now(),
  };
}

export function subscribeToDocuments(
  uid: string,
  onChange: (docs: DocumentItem[]) => void,
  onError: (error: FirestoreError) => void
): () => void {
  const q = query(userDocsCollection(uid), orderBy('uploadedAt', 'desc'));
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map((d) => toDocumentItem(d.id, d.data()))), onError);
}

function getAvailableName(existingNames: string[], desiredName: string): string {
  const existing = new Set(existingNames);
  if (!existing.has(desiredName)) return desiredName;
  const dotIndex = desiredName.lastIndexOf('.');
  const base = dotIndex > 0 ? desiredName.slice(0, dotIndex) : desiredName;
  const ext = dotIndex > 0 ? desiredName.slice(dotIndex) : '';
  let n = 1;
  while (existing.has(`${base} (${n})${ext}`)) n += 1;
  return `${base} (${n})${ext}`;
}

export async function uploadDocument(
  uid: string,
  file: File,
  category: string,
  existingNamesInCategory: string[]
): Promise<void> {
  const name = getAvailableName(existingNamesInCategory, file.name);
  const contentType = file.type || mimeTypeFor(name);
  const storagePath = `users/${uid}/${category}/${name}`;
  await uploadBytes(ref(storage, storagePath), file, { contentType });
  await addDoc(userDocsCollection(uid), {
    name,
    category,
    size: file.size,
    mimeType: contentType,
    storagePath,
    uploadedAt: serverTimestamp(),
  });
}

export async function updateDocument(
  uid: string,
  target: DocumentItem,
  changes: { name: string; category: string },
  existingNamesInTargetCategory: string[]
): Promise<void> {
  if (changes.category === target.category && changes.name === target.name) return;

  const name = getAvailableName(existingNamesInTargetCategory, changes.name);
  const newPath = `users/${uid}/${changes.category}/${name}`;

  if (newPath !== target.storagePath) {
    const bytes = await getBytes(ref(storage, target.storagePath));
    await uploadBytes(ref(storage, newPath), bytes, { contentType: target.mimeType });
    await deleteObject(ref(storage, target.storagePath));
  }

  await updateDoc(userDocRef(uid, target.id), {
    name,
    category: changes.category,
    storagePath: newPath,
  });
}

export async function deleteDocument(uid: string, target: DocumentItem): Promise<void> {
  await deleteObject(ref(storage, target.storagePath)).catch(() => {});
  await deleteFirestoreDoc(userDocRef(uid, target.id));
}

export async function getDocumentUrl(target: DocumentItem): Promise<string> {
  return getDownloadURL(ref(storage, target.storagePath));
}

export async function downloadDocument(target: DocumentItem): Promise<void> {
  const url = await getDocumentUrl(target);
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = target.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
