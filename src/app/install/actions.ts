
'use server';

import { z } from 'zod';

const FirebaseConfigSchema = z.object({
  apiKey: z.string().min(1, { message: 'API Key is required.' }),
  authDomain: z.string().min(1, { message: 'Auth Domain is required.' }),
  projectId: z.string().min(1, { message: 'Project ID is required.' }),
  storageBucket: z.string().min(1, { message: 'Storage Bucket is required.' }),
  messagingSenderId: z.string().min(1, { message: 'Messaging Sender ID is required.' }),
  appId: z.string().min(1, { message: 'App ID is required.' }),
});

export async function saveFirebaseConfig(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const validatedFields = FirebaseConfigSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Invalid configuration. All fields are required.',
    };
  }
  
  return { success: true };
}
