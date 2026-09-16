
"use client";

import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuperAdminDashboardPage() {

    return (
        <AdminLayout>
            <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Super Admin Dashboard</h1>
                    <p className="text-muted-foreground">Welcome to the control center.</p>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Overview</CardTitle>
                        <CardDescription>
                           This is the main dashboard for the super administrator.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <p className="text-center text-muted-foreground p-8">More widgets and stats will be available here.</p>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
