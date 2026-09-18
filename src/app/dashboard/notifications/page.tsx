
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, writeBatch, doc, updateDoc } from "firebase/firestore";
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEffect, useState } from "react";
import { Loader2, Bell, CheckCircle, Clock, XCircle, Gift, TrendingUp, CircleDollarSign, TicketPercent } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Notification {
    id: string;
    title: string;
    description: string;
    isRead: boolean;
    createdAt: any;
    link?: string;
    type: string;
}

export default function NotificationsPage() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        if (!user || !db) {
            setLoading(false);
            return;
        }

        const fetchNotifications = async () => {
            const q = query(collection(db, "notifications"), where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            const notifs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification))
                .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds); // Manual sort
            setNotifications(notifs);
            setLoading(false);
            // If there's a notifId param (read from window in client), open that notification
            const notifId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('notifId') : null;
            if (notifId) {
                const found = notifs.find(n => n.id === notifId);
                if (found) {
                    setSelectedNotification(found);
                    setDialogOpen(true);
                    // mark as read in DB
                    try {
                        const ref = doc(db, 'notifications', found.id);
                        await updateDoc(ref, { isRead: true });
                        setNotifications(prev => prev.map(n => n.id === found.id ? { ...n, isRead: true } : n));
                    } catch (e) {
                        // ignore
                    }
                    // remove query param from URL
                    try { router.replace('/dashboard/notifications'); } catch (e) {}
                }
            }
        };

        fetchNotifications();
    }, [user]);

    const handleMarkAllAsRead = async () => {
        if (!user || !db || notifications.every(n => n.isRead)) return;
        const batch = writeBatch(db);
        const unreadIds: string[] = [];
        notifications.forEach(n => {
            if (!n.isRead) {
                batch.update(doc(db, "notifications", n.id), { isRead: true });
                unreadIds.push(n.id);
            }
        });
        await batch.commit();
        setNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, isRead: true } : n));
    };
    
    const getNotificationIcon = (type: string) => {
        if (type.includes('approved') || type.includes('completed')) return <CheckCircle className="h-5 w-5 text-green-500" />;
        if (type.includes('rejected')) return <XCircle className="h-5 w-5 text-red-500" />;
        if (type.includes('pending')) return <Clock className="h-5 w-5 text-yellow-500" />;
        if (type.includes('bonus') || type.includes('promo')) return <Gift className="h-5 w-5 text-yellow-500" />;
        if (type.includes('invest')) return <TrendingUp className="h-5 w-5 text-blue-500" />;
        return <CircleDollarSign className="h-5 w-5 text-muted-foreground" />;
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Notifications</h1>
                        <p className="text-muted-foreground">A history of all your account notifications.</p>
                    </div>
                    <Button onClick={handleMarkAllAsRead} disabled={notifications.every(n => n.isRead)}>
                        Mark all as read
                    </Button>
                </div>
                {/* Promo system removed for this deployment */}
                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex justify-center items-center p-16"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">You have no notifications.</div>
                        ) : (
                            <ul className="divide-y">
                                {notifications.map(notif => (
                                    <li key={notif.id}>
                                        <Link href={notif.link || '#'} className={cn(
                                            "flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors",
                                            !notif.isRead && "bg-primary/5"
                                        )}>
                                            <div className="mt-1">{getNotificationIcon(notif.type)}</div>
                                            <div className="flex-1">
                                                <p className="font-semibold">{notif.title}</p>
                                                <p className="text-sm text-muted-foreground">{notif.description}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatDistanceToNow(new Date(notif.createdAt.seconds * 1000), { addSuffix: true })}
                                                </p>
                                            </div>
                                            {!notif.isRead && <div className="h-2.5 w-2.5 rounded-full bg-primary mt-2"></div>}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{selectedNotification?.title}</DialogTitle>
                            <DialogDescription>
                                <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedNotification?.description}</p>
                            </DialogDescription>
                        </DialogHeader>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
