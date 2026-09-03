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
  /**
   * URL de download pré-gerado pelo dono no momento do compartilhamento.
   * Armazenado no Firestore para que visitantes públicos possam acessar
   * o arquivo sem precisar de autenticação no Storage.
   */
  sharedFileUrl?: string;
}

export interface CategoryCount {
  category: string;
  count: number;
}
