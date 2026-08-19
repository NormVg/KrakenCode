export interface OpenFile {
  id: string;      // The absolute path acts as ID
  name: string;
  path: string;
  language: string;
  isModified: boolean;
  content: string; // Current unsaved content, or empty if not loaded yet
}
