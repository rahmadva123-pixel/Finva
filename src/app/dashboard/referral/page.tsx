"use client";

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';

const ReferralTree = dynamic(() => import('@/components/referral-tree/ReferralTree'), { ssr: false });

interface TeamUser {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    referredBy?: string;
    createdAt?: any;
    role?: string;
    balance?: number;
    directTeam: TeamUser[];
    directTeamSize: number;
    totalTeamSize: number;
}

export default function TeamPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [teamUser, setTeamUser] = useState<TeamUser | null>(null);
    const [totalCommission, setTotalCommission] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [depositStatusMap, setDepositStatusMap] = useState<Record<string, { firstDepositCompleted: boolean; firstDepositAt?: any }>>({});

    useEffect(() => {
        const fetchTeam = async () => {
            if (!db || !user) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const usersSnapshot = await getDocs(collection(db, "users"));
                const baseUsers = usersSnapshot.docs
                    .map((d) => ({ id: d.id, ...d.data(), directTeam: [], directTeamSize: 0, totalTeamSize: 0 } as TeamUser))
                    .filter((u) => u.role !== 'admin' && u.role !== 'sadmin');

                const userMap = new Map(baseUsers.map((u) => [u.id, u]));

                // Find users who have at least one completed/approved deposit — only these count toward referral/team size
                let eligibleSet = new Set<string>();
                try {
                    const depSnap = await getDocs(query(collection(db, 'deposits'), where('status', 'in', ['completed', 'approved'])));
                    depSnap.docs.forEach(d => {
                        const data: any = d.data();
                        if (data && data.userId) eligibleSet.add(String(data.userId));
                    });
                } catch (e) {
                    // if deposit fetch fails, fall back to counting everyone
                    eligibleSet = new Set(baseUsers.map(b => b.id));
                }

                baseUsers.forEach((u) => {
                    if (!u.referredBy) return;
                    // only include this referral if they have completed deposit
                    if (!eligibleSet.has(u.id)) return;
                    const ref = userMap.get(u.referredBy);
                    if (!ref) return;
                    ref.directTeam.push(u);
                    u.referredBy = u.referredBy;
                });

                const countTotalTeam = (userId: string, visited = new Set<string>()): number => {
                    if (visited.has(userId)) return 0;
                    visited.add(userId);
                    const u = userMap.get(userId);
                    if (!u) return 0;
                    return u.directTeam.reduce((sum, child) => sum + 1 + countTotalTeam(child.id, visited), 0);
                };

                const enriched = baseUsers.map((u) => ({ ...u, directTeamSize: u.directTeam.length, totalTeamSize: countTotalTeam(u.id) }));

                const current = enriched.find((u) => u.id === user.uid) || null;
                setTeamUser(current);

                // Fallback: if we couldn't find user or counts are zero, derive team from referralCommissions
                if ((!current || (current.directTeamSize === 0 && current.totalTeamSize === 0))) {
                    try {
                        const allCommsSnap = await getDocs(collection(db, 'referralCommissions'));
                        const edges = new Map<string, Set<string>>();
                        allCommsSnap.docs.forEach((d) => {
                            const data: any = d.data();
                            const referrer = data.referrerId;
                            const referred = data.referredUserId;
                            if (!referrer || !referred) return;
                            if (!edges.has(referrer)) edges.set(referrer, new Set());
                            edges.get(referrer)!.add(referred);
                        });

                        const directSet = edges.get(user.uid) || new Set();

                        // BFS to count total reachable team members
                        const visited = new Set<string>();
                        const stack: string[] = [user.uid];
                        visited.add(user.uid);
                        let total = 0;
                        while (stack.length) {
                            const cur = stack.pop()!;
                            const children = edges.get(cur);
                            if (!children) continue;
                            for (const c of children) {
                                if (visited.has(c)) continue;
                                visited.add(c);
                                total += 1;
                                stack.push(c);
                            }
                        }

                        // Fetch profile info for each direct referral (if readable)
                        const directIds = Array.from(directSet);
                        const directProfiles: TeamUser[] = [];
                        for (const rid of directIds) {
                            try {
                                const rDoc = await getDoc(doc(db, 'users', rid));
                                const rData: any = rDoc.exists() ? rDoc.data() : {};

                                // check deposits for first-deposit completion
                                let firstDepositCompleted = false;
                                let firstDepositAt: any = undefined;
                                try {
                                    const depSnap = await getDocs(query(collection(db, 'deposits'), where('userId', '==', rid)));
                                    for (const d of depSnap.docs) {
                                        const dd: any = d.data();
                                        const status = String(dd.status || '').toLowerCase();
                                        if (status === 'completed' || status === 'approved') {
                                            firstDepositCompleted = true;
                                            firstDepositAt = dd.createdAt || dd.date || dd.approvedAt || undefined;
                                            break;
                                        }
                                    }
                                } catch (e) {
                                    // ignore deposit read errors
                                }

                                directProfiles.push({
                                    id: rid,
                                    email: rData.email,
                                    firstName: rData.firstName,
                                    lastName: rData.lastName,
                                    username: rData.username || rData.displayName,
                                    referredBy: rData.referredBy,
                                    createdAt: rData.createdAt,
                                    role: rData.role,
                                    balance: Number(rData.balance || 0),
                                    directTeam: [],
                                    directTeamSize: 0,
                                    totalTeamSize: 0,
                                    // attach UI-only fields
                                    verificationStatus: rData.verificationStatus,
                                    // @ts-ignore
                                    verified: rData.verificationStatus === 'verified' || Boolean(rData.emailVerified || rData.verified),
                                    // @ts-ignore
                                    firstDepositCompleted,
                                    // @ts-ignore
                                    firstDepositAt,
                                } as unknown as TeamUser);
                            } catch (e) {
                                // ignore individual profile errors
                            }
                        }

                        const fallbackUser = {
                            id: user.uid,
                            email: user.email || undefined,
                            firstName: undefined,
                            lastName: undefined,
                            username: undefined,
                            referredBy: undefined,
                            createdAt: undefined,
                            role: undefined,
                            balance: 0,
                            directTeam: directProfiles,
                            directTeamSize: directSet.size,
                            totalTeamSize: total,
                        } as TeamUser;

                        setTeamUser(fallbackUser);
                    } catch (e) {
                        console.warn('Fallback team compute failed', e);
                    }
                }

                // Sum referral commissions where current user is the referrer
                try {
                    const commissionsQ = query(collection(db, 'referralCommissions'), where('referrerId', '==', user.uid));
                    const commissionsSnap = await getDocs(commissionsQ);
                    const sum = commissionsSnap.docs.reduce((s, d) => s + Number(d.data()?.amount || 0), 0);
                    setTotalCommission(Number(sum.toFixed(2)));
                } catch (e) {
                    console.warn('Failed to load referral commissions:', e);
                }
            } catch (e: any) {
                console.error('Failed to load team:', e);
                setError(String(e?.message || e));
            } finally {
                setLoading(false);
            }
        };

        if (!authLoading) fetchTeam();
    }, [user, authLoading]);

    const formatDate = (val: any) => {
        if (!val?.seconds) return 'N/A';
        return format(new Date(val.seconds * 1000), 'PPP');
    };

    useEffect(() => {
        const loadStatuses = async () => {
            if (!db || !teamUser) return;
            const map: Record<string, { firstDepositCompleted: boolean; firstDepositAt?: any }> = {};
            const ids = teamUser.directTeam.map((m) => m.id);
            for (const id of ids) {
                try {
                    const depSnap = await getDocs(query(collection(db, 'deposits'), where('userId', '==', id)));
                    let found = false;
                    let firstAt: any = undefined;
                    for (const d of depSnap.docs) {
                        const dd: any = d.data();
                        const status = String(dd.status || '').toLowerCase();
                        if (status === 'completed' || status === 'approved') {
                            found = true;
                            firstAt = dd.createdAt || dd.date || dd.approvedAt || undefined;
                            break;
                        }
                    }
                    map[id] = { firstDepositCompleted: found, firstDepositAt: firstAt };
                } catch (e) {
                    map[id] = { firstDepositCompleted: false };
                }
            }
            setDepositStatusMap(map);
        };
        loadStatuses();
    }, [teamUser]);

    if (loading || authLoading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </DashboardLayout>
        );
    }

    if (!user) {
        return (
            <DashboardLayout>
                <div className="p-8 text-center">Please sign in to view your team.</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                                <div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h1 className="text-3xl font-bold font-headline tracking-tight">Team</h1>
                                            </div>
                                            <div className="flex space-x-2">
                                                <a href="/dashboard/referral" className="px-3 py-1 rounded-md bg-muted text-sm">Team</a>
                                            </div>
                                        </div>

                                        {user && (
                                            <div className="mt-4">
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle>Your referral link</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                readOnly
                                                                value={`${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/signup?ref=${user.uid}`}
                                                                className="px-2 py-2 rounded border bg-muted/10 text-sm w-full"
                                                                aria-label="Your referral link"
                                                            />
                                                            <button
                                                                className="px-3 py-2 rounded bg-primary text-white text-sm"
                                                                onClick={async () => {
                                                                    try {
                                                                        const link = `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/signup?ref=${user.uid}`;
                                                                        await navigator.clipboard.writeText(link);
                                                                        toast({ title: 'Referral link copied' });
                                                                    } catch (e) {
                                                                        toast({ title: 'Copy failed', variant: 'destructive' });
                                                                    }
                                                                }}
                                                            >Copy</button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        )}
                                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Direct Referrals</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{teamUser ? teamUser.directTeamSize : 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Total Team Size</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{teamUser ? teamUser.totalTeamSize : 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Total Referral Commission</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${totalCommission.toFixed(2)}</div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Your Direct Referrals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {error && <div className="text-destructive mb-4">{error}</div>}
                        {!teamUser ? (
                            <div className="p-6 text-center text-muted-foreground">You have no direct referrals yet.</div>
                        ) : teamUser.directTeam.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">You have no direct referrals yet.</div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                                <TableHead>User</TableHead>
                                                <TableHead>Joined</TableHead>
                                                <TableHead>Verified</TableHead>
                                                <TableHead>1st Deposit</TableHead>
                                                <TableHead>Direct Team</TableHead>
                                                <TableHead>Total Team</TableHead>
                                            </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {teamUser.directTeam.map((member) => (
                                            <TableRow key={member.id}>
                                                <TableCell>
                                                    <div className="font-medium">{[member.firstName, member.lastName].filter(Boolean).join(' ') || member.username || member.email || member.id}</div>
                                                    <div className="text-xs text-muted-foreground">{member.email || member.id}</div>
                                                </TableCell>
                                                <TableCell>{formatDate(member.createdAt)}</TableCell>
                                                <TableCell>
                                                    {((member as any).verificationStatus === 'verified' || (member as any).verified || Boolean((member as any).emailVerified)) ? (
                                                        <Badge>Verified</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Unverified</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {depositStatusMap[member.id]?.firstDepositCompleted || (member as any).firstDepositCompleted ? (
                                                        depositStatusMap[member.id]?.firstDepositAt ? formatDate(depositStatusMap[member.id].firstDepositAt) : 'Yes'
                                                    ) : (
                                                        'No'
                                                    )}
                                                </TableCell>
                                                <TableCell><Badge>{member.directTeamSize}</Badge></TableCell>
                                                <TableCell><Badge variant="secondary">{member.totalTeamSize}</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Referral Tree</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {user ? <ReferralTree rootId={user.uid} maxDepth={4} /> : <div className="text-sm text-muted-foreground">Sign in to view tree.</div>}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
