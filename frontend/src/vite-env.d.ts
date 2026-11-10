/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API origin + prefix, e.g. https://api.example.com/api. Defaults to same-origin /api. */
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
