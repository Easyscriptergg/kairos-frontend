/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the Kairos REST API, e.g. http://localhost:8080/api. Leave unset to run without a backend. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
