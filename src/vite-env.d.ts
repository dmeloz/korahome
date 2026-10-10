/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __VERSION__: string;

interface ImportMetaEnv {
  /** Adresse du projet Supabase (Project URL), dans .env.local sur le Mac. */
  readonly VITE_SUPABASE_URL?: string;
  /** Clé publique du projet (anon / publishable) : protégée par la sécurité au niveau des lignes. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
