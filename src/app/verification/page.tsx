
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, FileImage, LogOut, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type FieldType = 'text' | 'image' | 'phone';

interface VerificationField {
    id: string;
    label: string;
    type: FieldType;
    required: boolean;
}

interface VerificationMethod {
    id: string;
    name: string;
    status: 'active' | 'inactive';
    fields: VerificationField[];
}

async function resizeAndCompressImage(file: File, maxWidth: number = 800, quality: number = 0.6): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

function normalizeFieldName(label: string) {
    return label.replace(/\s+/g, '_').toLowerCase();
}

function isIdentityNumberField(label: string) {
    return /(id|passport|document|license|cnic|nid|national)/i.test(label);
}

function normalizeUniqueValue(value: string, isPhone: boolean) {
    return isPhone
        ? value.replace(/\D/g, '')
        : value.trim().replace(/\s+/g, '').toUpperCase();
}

export default function VerificationPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const [methods, setMethods] = useState<VerificationMethod[]>([]);
    const [selectedMethod, setSelectedMethod] = useState<VerificationMethod | null>(null);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [uploadingField, setUploadingField] = useState<string | null>(null);


    useEffect(() => {
        const fetchMethods = async () => {
            if(!db) return;
            try {
                const q = query(collection(db, "verificationMethods"), where("status", "==", "active"));
                const querySnapshot = await getDocs(q);
                const methodsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VerificationMethod));
                setMethods(methodsData);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch verification methods.' });
            } finally {
                setLoading(false);
            }
        };
        fetchMethods();
    }, [toast]);
    
    const handleFileChange = async (fieldName: string, file: File) => {
        if (!file) return;
        setUploadingField(fieldName);
        try {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast({ variant: 'destructive', title: 'File too large', description: 'Please upload an image smaller than 5MB.' });
                return;
            }
            const compressedImage = await resizeAndCompressImage(file);
            setFormData(prev => ({ ...prev, [fieldName]: compressedImage }));
        } catch (error) {
             toast({ variant: 'destructive', title: 'File processing error', description: 'Could not process the selected file.' });
        } finally {
            setUploadingField(null);
            // Clear the file input
            if (fileInputRefs.current[fieldName]) {
                fileInputRefs.current[fieldName]!.value = "";
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedMethod || !db) return;

        setSubmitting(true);
        try {
            const dataToSubmit: Record<string, string> = {};
            const normalizedUniqueFields: Record<string, string> = {};

            for (const field of selectedMethod.fields) {
                const fieldName = normalizeFieldName(field.label);
                const value = formData[fieldName];

                if(field.required && !value) {
                     throw new Error(`Field "${field.label}" is required.`);
                }
                if (value) {
                    dataToSubmit[fieldName] = value;

                    if (field.type === 'phone' || isIdentityNumberField(field.label)) {
                        normalizedUniqueFields[fieldName] = normalizeUniqueValue(value, field.type === 'phone');
                    }
                }
            }

            const existingSubmissions = await getDocs(collection(db, 'userVerifications'));

            for (const [fieldName, normalizedValue] of Object.entries(normalizedUniqueFields)) {
                const isPhoneField = fieldName.includes('phone');

                const duplicateSubmission = existingSubmissions.docs.some((verificationDoc) => {
                    if (verificationDoc.id === user.uid) return false;

                    const verificationData = verificationDoc.data();
                    if (verificationData.status === 'rejected') return false;

                    const sourceFields = Object.keys(verificationData.normalizedUniqueFields || {}).length > 0
                        ? verificationData.normalizedUniqueFields
                        : verificationData.formData || {};

                    return Object.entries(sourceFields).some(([existingKey, existingValue]) => {
                        if (typeof existingValue !== 'string' || !existingValue) return false;

                        const existingIsPhone = existingKey.includes('phone');
                        const existingIsIdentity = isIdentityNumberField(existingKey);

                        if (isPhoneField && !existingIsPhone) return false;
                        if (!isPhoneField && !existingIsIdentity) return false;

                        return normalizeUniqueValue(existingValue, existingIsPhone) === normalizedValue;
                    });
                });

                if (duplicateSubmission) {
                    throw new Error(
                        isPhoneField
                            ? 'This phone number is already linked to another account.'
                            : 'This ID number is already linked to another account.'
                    );
                }
            }
            
            await setDoc(doc(db, 'userVerifications', user.uid), {
                userId: user.uid,
                userEmail: user.email,
                methodId: selectedMethod.id,
                methodName: selectedMethod.name,
                formData: dataToSubmit,
                normalizedUniqueFields,
                status: 'pending',
                submittedAt: new Date(),
            });

            await setDoc(doc(db, 'users', user.uid), { verificationStatus: 'pending', devForceUnverified: false }, { merge: true });

            toast({ title: 'Success', description: 'Your verification details have been submitted for review.' });
            router.push('/verification/pending');

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogout = async () => {
        if (auth) {
            await auth.signOut();
            router.push('/login');
        }
    }

    const handleDevReturnToDashboard = async () => {
        if (!user || !db || process.env.NODE_ENV === 'production') return;
        await setDoc(doc(db, 'users', user.uid), { verificationStatus: 'verified', devForceUnverified: false }, { merge: true });
        router.push('/dashboard');
    };
    
    if (loading) {
        return <AuthLayout><div className="flex items-center justify-center p-8"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div></AuthLayout>
    }

    return (
        <AuthLayout wide>
                      <div className="min-h-[min(720px,calc(100vh-2rem))] w-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lg sm:rounded-3xl">
                        <div className="border-b bg-[var(--topbar-background)] px-5 py-5 text-white sm:px-8">
                            <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Finva verification</p><h1 className="mt-1 text-xl font-bold font-headline">Verify your identity</h1></div></div>
                        </div>

                                                        <div className="p-5 text-slate-900 sm:p-8 dark:text-slate-100">
                                                                <div className="mb-6"><h2 className="text-xl font-bold font-headline tracking-tight text-slate-900 dark:text-white">Verification form</h2></div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Document type</Label>
                                        <Select onValueChange={(id) => setSelectedMethod(methods.find(m => m.id === id) || null)}><SelectTrigger className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><SelectValue placeholder="Select a document to submit" /></SelectTrigger><SelectContent>{methods.map(method => <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>)}</SelectContent></Select>
                  </div>
                                    {selectedMethod && (
                                        <div className="space-y-5 border-t border-border/70 pt-5">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedMethod.name}</p>
                                            {selectedMethod.fields.map((field) => {
                                                const fieldName = field.label.replace(/\s+/g, '_').toLowerCase();
                                                return (
                                                    <div key={field.id} className="space-y-2">
                                                        <Label htmlFor={fieldName} className="text-slate-700 dark:text-slate-200">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
                                                        {field.type === 'text' && <Input id={fieldName} className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500" placeholder={`Enter ${field.label.toLowerCase()}`} onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })} required={field.required} />}
                                                        {field.type === 'phone' && <Input id={fieldName} type="tel" className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500" placeholder="Enter phone number" onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })} required={field.required} />}
                                                        {field.type === 'image' && (
                                                            <div className="flex items-center gap-3">
                                                                <Input id={fieldName} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && handleFileChange(fieldName, e.target.files[0])} ref={(el) => { if (el) fileInputRefs.current[fieldName] = el; }} />
                                                                <Label htmlFor={fieldName} className="flex-1 cursor-pointer">
                                                                    <div className="flex min-h-20 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-3 text-sm text-primary hover:bg-primary/10">
                                                                        {uploadingField === fieldName ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileImage className="h-5 w-5" />}
                                                                        <span>{formData[fieldName] ? 'Image selected' : 'Upload image'}</span>
                                                                    </div>
                                                                </Label>
                                                                {formData[fieldName] && <Image src={formData[fieldName] as string} alt="preview" width={56} height={56} className="rounded-xl border object-cover" />}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                  <Button type="submit" className="h-12 w-full rounded-xl bg-[var(--topbar-background)] text-white hover:bg-primary dark:bg-secondary dark:text-secondary-foreground" disabled={!selectedMethod || submitting || !!uploadingField}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit for verification</Button>
                </form>
                                <div className="mt-6 space-y-2 border-t border-border/70 pt-4">
                                    {process.env.NODE_ENV !== 'production' && <Button type="button" variant="outline" className="w-full rounded-xl" onClick={handleDevReturnToDashboard}>Return to dashboard (dev)</Button>}
                                    <Button variant="ghost" className="w-full text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Log out</Button>
                                </div>
              </div>
            </div>
        </AuthLayout>
    );
}
