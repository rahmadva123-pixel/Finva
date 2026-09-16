// Firebase integration removed for this project.
// Stubs are exported so existing imports do not fail at build time.

export const isFirebaseConfigured = () => false;
export const app = null;
export const auth = null;
export const db = null;

export async function sendVerificationEmailToUser() {
  // No-op since authentication is removed
  return false;
}

export async function sendPasswordResetEmailToUser() {
  // No-op since authentication is removed
  return false;
}