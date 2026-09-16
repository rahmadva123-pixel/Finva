"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { format } from "date-fns";
import { Loader2, Search, Users, UserPlus, Network, Eye } from "lucide-react";

interface ReferralUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  referralCode?: string;
  referredBy?: string;
  createdAt?: any;
  role?: string;
  balance?: number;
  directTeam: ReferralUser[];
  directTeamSize: number;
  totalTeamSize: number;
  referrer?: ReferralUser | null;
}

export default function AdminReferralDetailsPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<ReferralUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReferralDetails = async () => {
      if (!db) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const baseUsers = usersSnapshot.docs
          .map((userDoc) => ({ id: userDoc.id, ...userDoc.data(), directTeam: [], directTeamSize: 0, totalTeamSize: 0, referrer: null }) as ReferralUser)
          .filter((user) => user.role !== "admin" && user.role !== "sadmin");

        const userMap = new Map(baseUsers.map((user) => [user.id, user]));

        baseUsers.forEach((user) => {
          if (!user.referredBy) return;
          const referrer = userMap.get(user.referredBy);
          if (!referrer) return;
          referrer.directTeam.push(user);
          user.referrer = referrer;
        });

        const countTotalTeam = (userId: string, visited = new Set<string>()): number => {
          if (visited.has(userId)) return 0;
          visited.add(userId);

          const user = userMap.get(userId);
          if (!user) return 0;

          return user.directTeam.reduce((sum, child) => sum + 1 + countTotalTeam(child.id, visited), 0);
        };

        const usersWithTeam = baseUsers.map((user) => ({
          ...user,
          directTeamSize: user.directTeam.length,
          totalTeamSize: countTotalTeam(user.id),
        }));

        setUsers(usersWithTeam.sort((a, b) => b.totalTeamSize - a.totalTeamSize));
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: `Failed to fetch referral details: ${error.message}` });
      } finally {
        setLoading(false);
      }
    };

    fetchReferralDetails();
  }, [toast]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return users;

    return users.filter((user) => {
      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase();
      const referrerName = `${user.referrer?.firstName || ""} ${user.referrer?.lastName || ""}`.toLowerCase();
      return (
        fullName.includes(term) ||
        String(user.email || "").toLowerCase().includes(term) ||
        String(user.username || "").toLowerCase().includes(term) ||
        String(user.referralCode || "").toLowerCase().includes(term) ||
        String(user.referrer?.email || "").toLowerCase().includes(term) ||
        String(user.referrer?.username || "").toLowerCase().includes(term) ||
        referrerName.includes(term)
      );
    });
  }, [searchTerm, users]);

  const referredUsersCount = users.filter((user) => Boolean(user.referredBy)).length;
  const totalDirectLinks = users.reduce((sum, user) => sum + user.directTeamSize, 0);
  const topTeamUser = users[0];

  const getDisplayName = (user?: ReferralUser | null) => {
    if (!user) return "N/A";
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    return fullName || user.username || user.email || user.id;
  };

  const getJoinedDate = (value: any) => {
    if (!value?.seconds) return "N/A";
    return format(new Date(value.seconds * 1000), "PPp");
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Referral Details</h1>
          <p className="text-muted-foreground">View who referred each user and inspect every user's direct and total team size.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{users.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Referred Users</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{referredUsersCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Direct Referral Links</CardTitle>
              <Network className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{totalDirectLinks}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Largest Team</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{topTeamUser?.totalTeamSize || 0}</div>
              <p className="text-xs text-muted-foreground truncate">{topTeamUser ? getDisplayName(topTeamUser) : "N/A"}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Referral & Team Details</CardTitle>
            <CardDescription>Search by user, referral code, or referrer details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search users or referrers..." className="pl-10" />
            </div>

            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : filteredUsers.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">No referral details found.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Referral Code</TableHead>
                      <TableHead>Added By / Referrer</TableHead>
                      <TableHead>Direct Team</TableHead>
                      <TableHead>Total Team</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <React.Fragment key={user.id}>
                        <TableRow>
                          <TableCell>
                            <div className="font-medium">{getDisplayName(user)}</div>
                            <div className="text-xs text-muted-foreground">{user.email || user.id}</div>
                          </TableCell>
                          <TableCell>{user.referralCode || "N/A"}</TableCell>
                          <TableCell>
                            {user.referrer ? (
                              <div>
                                <div className="font-medium">{getDisplayName(user.referrer)}</div>
                                <div className="text-xs text-muted-foreground">{user.referrer.email || user.referredBy}</div>
                              </div>
                            ) : (
                              <Badge variant="outline">No Referrer</Badge>
                            )}
                          </TableCell>
                          <TableCell><Badge>{user.directTeamSize}</Badge></TableCell>
                          <TableCell><Badge variant="secondary">{user.totalTeamSize}</Badge></TableCell>
                          <TableCell>{getJoinedDate(user.createdAt)}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm" onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}>
                              <Eye className="mr-2 h-4 w-4" /> Team
                            </Button>
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/admin/users/${user.id}`}>View User</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedUserId === user.id && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/30">
                              <div className="space-y-3 p-3">
                                <h4 className="font-semibold">Direct Team Members</h4>
                                {user.directTeam.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">This user has no direct team members.</p>
                                ) : (
                                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                    {user.directTeam.map((member) => (
                                      <div key={member.id} className="rounded-md border bg-background p-3 text-sm">
                                        <div className="font-medium">{getDisplayName(member)}</div>
                                        <div className="text-xs text-muted-foreground">{member.email || member.id}</div>
                                        <div className="mt-2 text-xs">Team Size: {member.totalTeamSize}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
