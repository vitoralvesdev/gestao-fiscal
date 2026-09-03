export interface DocumentItem {
  id: string;
  name: string;
  category: string;
  size: number;
  mimeType: string;
  storagePath: string;
  uploadedAt: number;
  /** UUID gerado ao compartilhar. Ausente (undefined) quando não compartilhado. */
  sharedToken?: string;
  /**
   * Quando true, visitantes do link público podem baixar o arquivo.
   * Quando false (ou ausente), só podem visualizar inline.
   */
  sharedAllowDownload?: boolean;
}

export interface CategoryCount {
  category: string;
  count: number;
}
