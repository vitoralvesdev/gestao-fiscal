export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type FileKind = 'pdf' | 'excel' | 'word' | 'text' | 'other';

export const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'xlsm'];

export function fileExtension(fileName: string): string {
  const match = fileName.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

export function fileKind(fileName: string): FileKind {
  const ext = fileExtension(fileName);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'txt') return 'text';
  if (['xls', 'xlsx', 'xlsm'].includes(ext)) return 'excel';
  if (['doc', 'docx'].includes(ext)) return 'word';
  return 'other';
}

export function mimeTypeFor(fileName: string): string {
  switch (fileKind(fileName)) {
    case 'pdf':
      return 'application/pdf';
    case 'text':
      return 'text/plain';
    case 'excel':
      return fileExtension(fileName) === 'xls'
        ? 'application/vnd.ms-excel'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'word':
      return fileExtension(fileName) === 'doc'
        ? 'application/msword'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
}
