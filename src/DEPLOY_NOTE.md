# Vercel deployment checklist

## Required environment variables
Add these in **Vercel → Project Settings → Environment Variables**:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `GEMINI_API_KEY` *(optional; only needed for AI recommendations)*

## Important notes
- Do **not** store secrets in `vercel.json`.
- Store the Firebase private key securely (e.g., Vercel UI or a secrets manager). Do NOT commit private keys or service-account JSON files to the repository.
- The app already normalizes wrapped quotes and `\\n` line breaks for Vercel.

## Firebase setup
In **Firebase Console → Authentication → Settings → Authorized domains**, add:

- your `*.vercel.app` domain
- your custom production domain (if you have one)

## Deploy
After saving the environment variables, trigger a fresh redeploy in Vercel.