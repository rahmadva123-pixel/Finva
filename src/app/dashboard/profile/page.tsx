"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Copy, User, Mail, Phone, Calendar, Globe, ShieldCheck, CheckCircle, Info, History, KeyRound, Lock, UserCog, Edit, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Image from 'next/image';

interface UserProfile {
    uid: string;
    email: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    country?: string;
    phone?: string;
    createdAt?: any;
    role?: 'user' | 'admin';
    disabled?: boolean;
    photoURL?: string;
    address?: string;
    city?: string;
    state?: string;
    verificationStatus?: 'verified' | 'pending' | 'rejected' | 'unverified';
}

interface Notification {
    id: string;
    title: string;
    description: string;
    createdAt: any;
}

interface TemplateData {
    profilePictures?: string[];
    showProfilePage?: boolean;
}

export default function ProfilePage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [templateData, setTemplateData] = useState<TemplateData>({});
    
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        country: '',
        city: '',
        state: '',
        address: '',
    });

    const referralLink = typeof window !== 'undefined' && user ? `${window.location.origin}/signup?ref=${user.uid}` : '';

    const fetchProfileData = useCallback(async () => {
      if (!user) return;
      setLoading(true);
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let userData: UserProfile;

        if (userDocSnap.exists()) {
          userData = { uid: user.uid, ...userDocSnap.data() } as UserProfile;
        } else {
          // If no doc, create a basic one.
          userData = { uid: user.uid, email: user.email || '' };
          await setDoc(userDocRef, { email: user.email, uid: user.uid });
        }
        
        setProfile(userData);
        setFormData({
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            email: userData.email || '',
            phone: userData.phone || '',
            country: userData.country || '',
            city: userData.city || '',
            state: userData.state || '',
            address: userData.address || '',
        });
        
        const templateDocRef = doc(db, 'template', 'landingPage');
        const templateDocSnap = await getDoc(templateDocRef);
        if (templateDocSnap.exists()) {
            setTemplateData(templateDocSnap.data() as TemplateData);
        }
        
        const notificationsQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        const notifs = notificationsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
        setNotifications(notifs);

      } catch (error) {
        console.error("Error fetching profile data:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch profile data.' });
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }, [user, toast]);

    useEffect(() => {
        if (user) {
            fetchProfileData();
        } else if (!authLoading) {
            setLoading(false);
        }
    }, [user, authLoading, fetchProfileData]);
    
    const copyToClipboard = (textToCopy: string) => {
        navigator.clipboard.writeText(textToCopy);
        toast({title: "Copied!", description: "Copied to clipboard."})
    }
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    }
    
    const handleSaveChanges = async () => {
        if (!db || !profile) return;
        setSaving(true);
        try {
            const userDocRef = doc(db, 'users', profile.uid);

            // If email changed, request a secure confirmation flow
            if (formData.email && formData.email !== profile.email) {
                // Create token server-side
                const res = await fetch('/api/email-change/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: profile.uid, newEmail: formData.email }) });
                const body = await res.json();
                if (!res.ok) {
                    throw new Error(body?.error || 'Failed to request email change');
                }

                // In production, the server should email the confirmation link to the new address.
                // For now, we'll show the token and instruct the user to check their email.
                toast({ title: 'Confirmation Required', description: 'A confirmation link was sent to your new email. Complete confirmation to finalize email change.' });
            }

            // Always update other profile fields immediately
            const { email, ...otherFields } = formData as any;
            await updateDoc(userDocRef, otherFields);
            await fetchProfileData();
            toast({ title: "Success", description: "Profile updated. Email change pending confirmation if applicable." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: `Failed to update profile: ${error.message}` });
        } finally {
            setSaving(false);
        }
    };
    
    const handleImageSelect = async (url: string) => {
        if (!db || !profile) return;
        try {
            const userDocRef = doc(db, 'users', profile.uid);
            await updateDoc(userDocRef, { photoURL: url });
            setProfile(p => p ? {...p, photoURL: url} : null);
            toast({ title: "Success", description: "Profile picture updated." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: `Failed to update picture: ${error.message}` });
        }
    };

    if (loading || authLoading) {
        return <DashboardLayout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>;
    }
    
    if (!profile) {
        return <DashboardLayout><div className="flex h-full items-center justify-center"><p>Could not load user profile.</p></div></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <h1 className="text-3xl font-bold font-headline">My Profile</h1>
                
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-1 space-y-8">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex flex-col items-center gap-4 text-center">
                                    <div className="relative">
                                        <Avatar className="h-24 w-24 border-2 border-primary">
                                            <AvatarImage src={profile.photoURL} alt={profile.username} />
                                            <AvatarFallback>{profile.username?.charAt(0).toUpperCase() || profile.email?.charAt(0).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button size="icon" variant="outline" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full">
                                                    <Edit className="h-4 w-4"/>
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Choose your Avatar</DialogTitle>
                                                    <DialogDescription>Select a new profile picture from the options below.</DialogDescription>
                                                </DialogHeader>
                                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-4 py-4 max-h-[50vh] overflow-y-auto">
                                                    {templateData.profilePictures?.map((pic, index) => (
                                                        <Avatar key={index} className="h-16 w-16 cursor-pointer hover:ring-2 hover:ring-primary" onClick={() => handleImageSelect(pic)}>
                                                            <AvatarImage src={pic} />
                                                            <AvatarFallback>{index}</AvatarFallback>
                                                        </Avatar>
                                                    ))}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 justify-center">
                                            <h3 className="text-xl font-bold">{profile.firstName} {profile.lastName}</h3>
                                            {profile.verificationStatus === 'verified' && (
                                                <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/50 flex items-center gap-1">
                                                    <ShieldCheck className="h-3 w-3" /> Verified
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">@{profile.username}</p>
                                    </div>
                                </div>
                                <div className="mt-6 space-y-3 text-sm">
                                    <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4"/> Email:</span> <span className="font-semibold">{profile.email}</span></div>
                                    <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4"/> Contact:</span> <span className="font-semibold">{profile.phone}</span></div>
                                    <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-muted-foreground"><Globe className="h-4 w-4"/> Country:</span> <span className="font-semibold">{profile.country}</span></div>
                                    <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4"/> Joined:</span> <span className="font-semibold">{profile.createdAt ? format(profile.createdAt.toDate(), 'dd-MM-yyyy') : 'N/A'}</span></div>
                                </div>
                            </CardContent>
                        </Card>
                        
                         <Card>
                           <CardHeader>
                                <CardTitle className="text-lg">Recent Notifications</CardTitle>
                           </CardHeader>
                           <CardContent>
                            {notifications.length > 0 ? (
                                <ul className="space-y-4">
                                    {notifications.map(n => (
                                        <li key={n.id} className="flex gap-3">
                                            <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center shrink-0"><CheckCircle className="h-5 w-5 text-primary"/></div>
                                            <div>
                                                <p className="font-semibold text-sm">{n.title}</p>
                                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(n.createdAt.toDate(), {addSuffix: true})}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No recent notifications.</p>
                            )}
                           </CardContent>
                        </Card>
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-2 space-y-8">
                        <Card>
                             <CardHeader>
                                <CardTitle>Affiliate URL</CardTitle>
                             </CardHeader>
                             <CardContent>
                                <div className="flex items-center gap-2">
                                    <Input value={referralLink} readOnly />
                                    <Button size="icon" variant="outline" onClick={() => copyToClipboard(referralLink)}>
                                        <Copy className="h-4 w-4"/>
                                    </Button>
                                </div>
                             </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Update Account Details</CardTitle>
                                <CardDescription>Edit your personal information and profile picture.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                <div className="grid md:grid-cols-2 gap-6 text-sm">
                                    <div className="space-y-2">
                                        <Label>First Name</Label>
                                        <Input name="firstName" value={formData.firstName} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Last Name</Label>
                                        <Input name="lastName" value={formData.lastName} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Username</Label>
                                        <Input value={profile.username || ''} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email</Label>
                                        <Input name="email" value={formData.email} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone Number</Label>
                                        <Input name="phone" value={formData.phone} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Country</Label>
                                        <Input name="country" value={formData.country} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground">Changing email requires confirmation — a link will be sent to the new address.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Address</Label>
                                        <Input name="address" value={formData.address} onChange={handleInputChange} placeholder="Street, house number"/>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>City</Label>
                                        <Input name="city" value={formData.city} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>State</Label>
                                        <Input name="state" value={formData.state} onChange={handleInputChange} />
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={handleSaveChanges} disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Update Profile
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>Security</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 border rounded-md">
                                    <h4 className="font-semibold">Change Password</h4>
                                    <p className="text-sm text-muted-foreground mb-4">Update your password for better security.</p>
                                    <Button variant="outline" asChild>
                                        <Link href="/forgot-password">
                                            <KeyRound className="mr-2 h-4 w-4" />
                                            Request Password Change
                                        </Link>
                                    </Button>
                                </div>
                                 <div className="p-4 border rounded-md">
                                    <h4 className="font-semibold">Two Factor Authentication</h4>
                                    <p className="text-sm text-muted-foreground mb-4">Enhance your account security.</p>
                                    <Button variant="outline" disabled>
                                        <Lock className="mr-2 h-4 w-4" />
                                        Enable 2FA (Coming Soon)
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
