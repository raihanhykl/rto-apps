// Static user seed data
// Password TIDAK disimpan di file ini — diambil dari environment variable.
// Setiap user punya field `passwordEnv` yang merujuk ke nama env var.
// Jika env var tidak ditemukan, fallback ke SEED_DEFAULT_PASSWORD.

export interface UserSeed {
  username: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
  passwordEnv: string;
}

export const users: UserSeed[] = [
  {
    username: 'superadmin',
    fullName: 'Super Administrator',
    role: 'SUPER_ADMIN',
    passwordEnv: 'SEED_SUPERADMIN_PASSWORD',
  },
  {
    username: 'admin',
    fullName: 'Administrator',
    role: 'ADMIN',
    passwordEnv: 'SEED_ADMIN_PASSWORD',
  },
  {
    username: 'viewer',
    fullName: 'Viewer',
    role: 'VIEWER',
    passwordEnv: 'SEED_VIEWER_PASSWORD',
  },
];
