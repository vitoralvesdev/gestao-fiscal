import { idbDelete, idbGet, idbSet } from './idb';
import type { CategoryCount, DocumentItem } from '../types';

const ROOT_KEY = 'root';

export const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'xlsm'];

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function getStoredRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await idbGet<FileSystemDirectoryHandle>(ROOT_KEY);
  return handle ?? null;
}

export async function pickRootDirectory(): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker({ id: 'gestao-fiscal', mode: 'readwrite' });
  await idbSet(ROOT_KEY, handle);
  return handle;
}

export async function forgetRootDirectory(): Promise<void> {
  await idbDelete(ROOT_KEY);
}

export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = 'readwrite'
): Promise<boolean> {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

async function getCategoryDir(
  root: FileSystemDirectoryHandle,
  category: string,
  create: boolean
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await root.getDirectoryHandle(category, { create });
  } catch {
    return null;
  }
}

async function getAvailableName(
  dir: FileSystemDirectoryHandle,
  desiredName: string,
  ignoreName?: string
): Promise<string> {
  const existing = new Set<string>();
  for await (const name of dir.keys()) {
    if (name !== ignoreName) existing.add(name);
  }
  if (!existing.has(desiredName)) return desiredName;
  const dotIndex = desiredName.lastIndexOf('.');
  const base = dotIndex > 0 ? desiredName.slice(0, dotIndex) : desiredName;
  const ext = dotIndex > 0 ? desiredName.slice(dotIndex) : '';
  let n = 1;
  while (existing.has(`${base} (${n})${ext}`)) n += 1;
  return `${base} (${n})${ext}`;
}

export async function listCategories(root: FileSystemDirectoryHandle): Promise<CategoryCount[]> {
  const result: CategoryCount[] = [];
  for await (const [name, handle] of root.entries()) {
    if (handle.kind !== 'directory') continue;
    let count = 0;
    for await (const [, entry] of (handle as FileSystemDirectoryHandle).entries()) {
      if (entry.kind === 'file') count += 1;
    }
    result.push({ category: name, count });
  }
  return result.sort((a, b) => a.category.localeCompare(b.category, 'pt-BR'));
}

export async function listDocuments(
  root: FileSystemDirectoryHandle,
  category?: string
): Promise<DocumentItem[]> {
  const docs: DocumentItem[] = [];
  const categories = category ? [category] : (await listCategories(root)).map((c) => c.category);
  for (const cat of categories) {
    const dir = await getCategoryDir(root, cat, false);
    if (!dir) continue;
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file') continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      docs.push({ name, category: cat, size: file.size, lastModified: file.lastModified });
    }
  }
  return docs.sort((a, b) => b.lastModified - a.lastModified);
}

export async function uploadFile(
  root: FileSystemDirectoryHandle,
  file: File,
  category: string
): Promise<void> {
  const dir = await getCategoryDir(root, category, true);
  if (!dir) throw new Error('Não foi possível criar a categoria');
  const name = await getAvailableName(dir, file.name);
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
}

export async function readFile(
  root: FileSystemDirectoryHandle,
  category: string,
  name: string
): Promise<File> {
  const dir = await getCategoryDir(root, category, false);
  if (!dir) throw new Error('Categoria não encontrada');
  const fileHandle = await dir.getFileHandle(name);
  return fileHandle.getFile();
}

export async function deleteFile(
  root: FileSystemDirectoryHandle,
  category: string,
  name: string
): Promise<void> {
  const dir = await getCategoryDir(root, category, false);
  if (!dir) return;
  await dir.removeEntry(name);
}

export async function renameOrMoveFile(
  root: FileSystemDirectoryHandle,
  doc: { category: string; name: string },
  changes: { category: string; name: string }
): Promise<void> {
  if (changes.category === doc.category && changes.name === doc.name) return;

  const sourceDir = await getCategoryDir(root, doc.category, false);
  if (!sourceDir) throw new Error('Arquivo de origem não encontrado');
  const sourceHandle = await sourceDir.getFileHandle(doc.name);
  const file = await sourceHandle.getFile();

  const targetDir = await getCategoryDir(root, changes.category, true);
  if (!targetDir) throw new Error('Não foi possível criar a categoria de destino');

  const sameDir = changes.category === doc.category;
  const targetName = await getAvailableName(targetDir, changes.name, sameDir ? doc.name : undefined);

  const targetHandle = await targetDir.getFileHandle(targetName, { create: true });
  const writable = await targetHandle.createWritable();
  await writable.write(file);
  await writable.close();

  if (!(sameDir && targetName === doc.name)) {
    await sourceDir.removeEntry(doc.name);
  }
}
