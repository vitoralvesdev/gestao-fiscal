export interface DocumentItem {
  id: string;
  name: string;
  category: string;
  size: number;
  mimeType: string;
  storagePath: string;
  uploadedAt: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}
