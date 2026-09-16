
"use client";

import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, List, PlusCircle, Edit, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const timeSettings = [
    { name: "Hour", time: "1 Hours", status: "Active" },
    { name: "Day", time: "24 Hours", status: "Active" },
    { name: "Week", time: "168 Hours", status: "Active" },
    { name: "Month", time: "720 Hours", status: "Active" },
    { name: "Year", time: "8760 Hours", status: "Active" },
]

export default function CreateInvestmentPlanPage() {
  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <Tabs defaultValue="time-setting">
            <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="time-setting"><Clock className="mr-2" />Time Setting</TabsTrigger>
                <TabsTrigger value="manage-plan"><List className="mr-2" />Manage Plan</TabsTrigger>
            </TabsList>
            <TabsContent value="time-setting">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Manage Time Settings</CardTitle>
                            <CardDescription>
                               Define the time intervals for your investment plans.
                            </CardDescription>
                        </div>
                         <Button>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add New
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-primary/90 hover:bg-primary/90">
                                    <TableHead className="text-primary-foreground">Name</TableHead>
                                    <TableHead className="text-primary-foreground">Time</TableHead>
                                    <TableHead className="text-primary-foreground">Status</TableHead>
                                    <TableHead className="text-primary-foreground text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {timeSettings.map((setting) => (
                                    <TableRow key={setting.name}>
                                        <TableCell className="font-medium">{setting.name}</TableCell>
                                        <TableCell>{setting.time}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-green-500 border-green-500/50 bg-green-500/10">{setting.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="outline" size="sm">
                                                <Edit className="mr-1 h-3 w-3" /> Edit
                                            </Button>
                                            <Button variant="destructive" size="sm">
                                                <Trash2 className="mr-1 h-3 w-3" /> Disable
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="manage-plan">
                 <Card>
                    <CardHeader>
                        <CardTitle>Manage Investment Plans</CardTitle>
                        <CardDescription>
                           Create, edit, and manage investment plans for users.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <p className="text-center text-muted-foreground p-8">Investment plan creation form will be here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
