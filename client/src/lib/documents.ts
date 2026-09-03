import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc as deleteFirestoreDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
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
    sharedToken: data.sharedToken ?? undefined,
    sharedAllowDownload: data.sharedAllowDownload ?? undefined,
    sharedFileUrl: data.sharedFileUrl ?? undefined,
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

/** Gera um token UUID v4 simples sem dependência externa. */
function generateToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Gera (ou reutiliza) um sharedToken no documento do Firestore.
 * Também obtém (ou reutiliza) o URL de download do Storage e salva no Firestore,
 * para que visitantes públicos possam acessar o arquivo sem autenticação.
 * Retorna token e fileUrl para que o chamador possa montar o link e atualizar o estado local.
 */
export async function shareDocument(
  uid: string,
  target: DocumentItem,
  allowDownload: boolean
): Promise<{ token: string; fileUrl: string }> {
  const token = target.sharedToken ?? generateToken();
  // Só gera novo URL se ainda não existir (evita chamada extra ao Storage)
  const fileUrl = target.sharedFileUrl ?? await getDownloadURL(ref(storage, target.storagePath));
  await updateDoc(userDocRef(uid, target.id), {
    sharedToken: token,
    sharedAllowDownload: allowDownload,
    sharedFileUrl: fileUrl,
  });
  return { token, fileUrl };
}

/** Altera só a permissão de download sem revogar/trocar o link. */
export async function updateSharePermission(
  uid: string,
  target: DocumentItem,
  allowDownload: boolean
): Promise<void> {
  await updateDoc(userDocRef(uid, target.id), { sharedAllowDownload: allowDownload });
}

/** Remove o sharedToken e o URL salvo, tornando o link anterior inválido imediatamente. */
export async function unshareDocument(uid: string, target: DocumentItem): Promise<void> {
  await updateDoc(userDocRef(uid, target.id), {
    sharedToken: deleteField(),
    sharedAllowDownload: deleteField(),
    sharedFileUrl: deleteField(),
  });
}

/**
 * Busca um documento pelo sharedToken (leitura pública — sem autenticação).
 * Usado pela página de visualização pública (/share/:token).
 */
export async function getDocumentByToken(token: string): Promise<DocumentItem | null> {
  // A query varre todos os grupos de coleção "documents" — requer índice de grupo
  // de coleção no Firestore para `sharedToken` (criado automaticamente na 1ª execução).
  const q = query(collectionGroup(db, 'documents'), where('sharedToken', '==', token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return toDocumentItem(d.id, d.data());
}

export interface UploadItem {
  file: File;
  category: string;
}

export interface UploadProgress {
  total: number;
  done: number;
  current: string | null; // nome do arquivo sendo enviado agora
  errors: Array<{ name: string; message: string }>;
}

/**
 * Faz upload de vários arquivos em sequência, reportando progresso via callback.
 * Continua mesmo se um arquivo falhar — erros são acumulados no progress.
 */
export async function uploadManyDocuments(
  uid: string,
  items: UploadItem[],
  onProgress: (p: UploadProgress) => void
): Promise<UploadProgress> {
  const progress: UploadProgress = {
    total: items.length,
    done: 0,
    current: null,
    errors: [],
  };

  // Cache de nomes por categoria para evitar colisões entre arquivos do mesmo lote
  const nameCache = new Map<string, Set<string>>();

  for (const item of items) {
    progress.current = item.file.name;
    onProgress({ ...progress });

    try {
      if (!nameCache.has(item.category)) {
        nameCache.set(item.category, new Set());
      }
      const usedNames = nameCache.get(item.category)!;
      const name = getAvailableName([...usedNames], item.file.name);
      usedNames.add(name);

      const contentType = item.file.type || mimeTypeFor(name);
      const storagePath = `users/${uid}/${item.category}/${name}`;
      await uploadBytes(ref(storage, storagePath), item.file, { contentType });
      await addDoc(userDocsCollection(uid), {
        name,
        category: item.category,
        size: item.file.size,
        mimeType: contentType,
        storagePath,
        uploadedAt: serverTimestamp(),
      });
    } catch (err) {
      progress.errors.push({
        name: item.file.name,
        message: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }

    progress.done += 1;
    onProgress({ ...progress });
  }

  progress.current = null;
  onProgress({ ...progress });
  return progress;
}
