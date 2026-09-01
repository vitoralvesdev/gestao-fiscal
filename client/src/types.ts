export interface DocumentItem {
  name: string;
  category: string;
  size: number;
  lastModified: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}
