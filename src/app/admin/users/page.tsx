
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, runTransaction, query, where, orderBy } from 'firebase/firestore';
import { Loader2, ShieldCheck, ShieldOff, UserCog, Trash2, Slash, UserCheck, Search, MailWarning, BadgeDollarSign, ShieldAlert, Shield, Mail, Edit } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { countries } from '@/lib/countries';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    country?: string;
    phone?: string;
    city?: string;
    state?: string;
    address?: string;
    createdAt?: any;
    role: 'user' | 'admin' | 'sadmin';
    disabled: boolean;
    isMarkedUnverified?: boolean;
    balance?: number;
    verificationStatus?: 'verified' | 'pending' | 'rejected' | 'unverified';
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface MailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
  const [isMailDialogOpen, setIsMailDialogOpen] = useState(false);
  const [mailTemplates, setMailTemplates] = useState<MailTemplate[]>([]);

  // State for edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchUsers = useCallback(async () => {
    if(!db || !currentUser) return;
    setLoading(true);
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const isSAdmin = userDoc.exists() && userDoc.data().role === 'sadmin';
        setIsSuperAdmin(isSAdmin);

        const currencyDoc = await getDoc(doc(db, "settings", "currency"));
        if (currencyDoc.exists()) {
          setCurrency(currencyDoc.data() as CurrencySettings);
        }

        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersList = usersSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as User));
        
        usersList.forEach(user => {
            if (user.disabled === undefined) user.disabled = false;
        });
        
        if(isSAdmin) {
            setAdmins(usersList.filter(u => u.role === 'admin' || u.role === 'sadmin'));
        } else {
            // A normal admin should only see other normal admins.
            setAdmins(usersList.filter(u => u.role === 'admin'));
        }
        
        setUsers(usersList.filter(u => u.role !== 'admin' && u.role !== 'sadmin'));

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch users: ${error.message}`});
    } finally {
        setLoading(false);
    }
  }, [toast, currentUser]);
  
  useEffect(() => {
    if(currentUser) {
      fetchUsers();
    }
  }, [currentUser, fetchUsers]);

  const fetchMailTemplates = useCallback(async () => {
      if(!db) return;
      try {
          const querySnapshot = await getDocs(collection(db, 'mailTemplates'));
          const templatesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MailTemplate));
          setMailTemplates(templatesData);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch mail templates: ${error.message}`});
      }
  }, [toast])

  useEffect(() => {
    fetchMailTemplates();
  }, [fetchMailTemplates]);

  const handleManageUser = (user: User) => {
    setSelectedUser(user);
    setBalanceAmount('');
    setIsManageOpen(true);
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsEditOpen(true);
  };
  
  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingUser(prev => ({...prev, [name]: value}));
  }

  const handleCountryChange = (value: string) => {
    setEditingUser(prev => ({...prev, country: value}));
  }

  const handleSaveUserChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editingUser.id) return;

    setIsSavingEdit(true);
    try {
        const { id, email, role, createdAt, balance, disabled, ...dataToUpdate } = editingUser;
        const userRef = doc(db, 'users', editingUser.id);
        await updateDoc(userRef, dataToUpdate);

        toast({ title: 'Success', description: 'User details have been updated.' });
        fetchUsers();
        setIsEditOpen(false);
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to save changes: ${error.message}` });
    } finally {
        setIsSavingEdit(false);
    }
  }


  const handleUpdateBalance = async (operation: 'add' | 'remove') => {
      if (!selectedUser || !balanceAmount) return;
      const amount = parseFloat(balanceAmount);
      if (isNaN(amount) || amount <= 0) {
        toast({ variant: 'destructive', title: 'Invalid Amount'});
        return;
      }

      const userRef = doc(db, 'users', selectedUser.id);
      try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                throw "User not found";
            }
            const currentBalance = userDoc.data().balance || 0;
            const newBalance = operation === 'add' ? currentBalance + amount : currentBalance - amount;

            if (newBalance < 0) {
                throw "User balance cannot be negative.";
            }

            transaction.update(userRef, { balance: newBalance });
        });
        
        toast({ title: 'Success', description: 'User balance updated.'});
        fetchUsers();
        setIsManageOpen(false);

      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to update balance: ${error.message || error}`});
      }
  }

  const handleRoleChange = async () => {
      if (!selectedUser) return;
      const newRole = selectedUser.role === 'admin' ? 'user' : 'admin';
      const userRef = doc(db, 'users', selectedUser.id);
      try {
        await updateDoc(userRef, { role: newRole });
        toast({ title: 'Success', description: `User role updated to ${newRole}.`});
        fetchUsers();
        setIsManageOpen(false);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to update role: ${error.message}`});
      }
  }

  const handleDisableAccount = async () => {
      if (!selectedUser) return;
      const isDisabled = !selectedUser.disabled;
      const userRef = doc(db, 'users', selectedUser.id);
      try {
        await updateDoc(userRef, { disabled: isDisabled });
        toast({ title: 'Success', description: `User account has been ${isDisabled ? 'banned' : 'unbanned'}.`});
        fetchUsers();
        setIsManageOpen(false);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to update account status: ${error.message}`});
      }
  }
  
  const handleDeleteAccount = async () => {
      if(!selectedUser) return;
      try {
        await deleteDoc(doc(db, "users", selectedUser.id));
        toast({ title: 'Success', description: `User data for ${selectedUser.email} has been deleted.`});
        fetchUsers();
        setIsManageOpen(false);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to delete user: ${error.message}`});
      }
  }
  
  const handleMarkUnverified = async () => {
      if(!selectedUser) return;
      const userRef = doc(db, 'users', selectedUser.id);
      try {
        await updateDoc(userRef, { emailVerified: false, isMarkedUnverified: true });
        toast({ title: 'Success', description: 'User has been marked as unverified. They will be prompted to verify their email on next login.'});
        setIsManageOpen(false);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to mark as unverified: ${error.message}`});
      }
  }

  const formatCurrency = (amount: number) => {
    const value = (amount || 0).toFixed(2);
    return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
  }
  
  const handleVerificationStatus = async (newStatus: 'verified' | 'rejected') => {
      if(!selectedUser) return;
      const userRef = doc(db, 'users', selectedUser.id);
      try {
        await updateDoc(userRef, { verificationStatus: newStatus });
        toast({ title: 'Success', description: `Verification status set to ${newStatus}.`});
        fetchUsers();
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to update status: ${error.message}`});
      }
  }

  const handleOpenMailDialog = (user: User) => {
      setSelectedUser(user);
      setIsMailDialogOpen(true);
  }
  
  const processPlaceholders = (text: string, user: User) => {
      return text
        .replace(/{{firstName}}/g, user.firstName || '')
        .replace(/{{lastName}}/g, user.lastName || '')
        .replace(/{{username}}/g, user.username || '')
        .replace(/{{email}}/g, user.email || '');
  };

  const handleTemplateClick = (template: MailTemplate) => {
    if (!selectedUser) return;

    const subject = encodeURIComponent(processPlaceholders(template.subject, selectedUser));
    const body = encodeURIComponent(processPlaceholders(template.body, selectedUser));
    
    // Construct a Gmail compose URL
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${selectedUser.email}&su=${subject}&body=${body}`;

    window.open(gmailUrl, '_blank');
    setIsMailDialogOpen(false);
  };
  
    const getVerificationBadge = (status?: User['verificationStatus']) => {
    switch (status) {
        case 'verified':
            return <Badge variant="default" className="bg-green-500/20 text-green-500 border-none">Verified</Badge>
        case 'pending':
            return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-500 border-none">Pending</Badge>
        case 'rejected':
            return <Badge variant="destructive">Rejected</Badge>
        default:
            return <Badge variant="secondary">Unverified</Badge>
    }
  }
  
  const renderUserTable = (userList: User[]) => {
      const filteredUsers = userList.filter(user => 
         (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
         (user.username || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>ID Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredUsers.map(user => (
                    <TableRow key={user.id}>
                        <TableCell>
                            <Link href={`/admin/users/${user.id}`} className="hover:underline">
                                <div className="font-medium">{user.username || `${user.firstName} ${user.lastName}`}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                            </Link>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(user.balance || 0)}</TableCell>
                        <TableCell>
                            <Badge variant={user.disabled ? 'destructive' : 'default'}>
                                {user.disabled ? 'Banned' : 'Active'}
                            </Badge>
                        </TableCell>
                        <TableCell>
                           {getVerificationBadge(user.verificationStatus)}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                             <Button variant="ghost" size="icon" onClick={() => handleOpenMailDialog(user)}>
                                <Mail className="h-4 w-4" />
                            </Button>
                             <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleManageUser(user)}>Manage</Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
      )
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage and view your application's users.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>User Lists</CardTitle>
                <CardDescription>
                    View all registered users and administrators.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by username or email..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                {loading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Tabs defaultValue="users">
                      <TabsList className={cn("grid w-full grid-cols-2")}>
                          <TabsTrigger value="users">All Users ({users.length})</TabsTrigger>
                          <TabsTrigger value="admins">Admins ({admins.length})</TabsTrigger>
                      </TabsList>
                      <TabsContent value="users">
                          {renderUserTable(users)}
                      </TabsContent>
                      <TabsContent value="admins">
                          {renderUserTable(admins)}
                      </TabsContent>
                  </Tabs>
                )}
            </CardContent>
        </Card>
      </div>
      
      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Manage User</DialogTitle>
                  <DialogDescription>{selectedUser?.email}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                   <div className="space-y-2 p-4 border rounded-lg">
                        <Label htmlFor="balance-amount">Update Balance</Label>
                        <div className="flex gap-2">
                            <Input id="balance-amount" type="number" placeholder="Amount" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} />
                            <Button variant="outline" onClick={() => handleUpdateBalance('add')}>Add</Button>
                            <Button variant="destructive" onClick={() => handleUpdateBalance('remove')}>Remove</Button>
                        </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                      Use the actions below to manage the user's account status and role.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {isSuperAdmin && (
                          <Button variant="outline" onClick={handleRoleChange} disabled={selectedUser?.role === 'sadmin'}>
                              {selectedUser?.role === 'admin' ? <ShieldOff className="mr-2"/> : <ShieldCheck className="mr-2"/>}
                              {selectedUser?.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                          </Button>
                       )}
                       <Button variant="outline" onClick={handleDisableAccount}>
                          {selectedUser?.disabled ? <UserCheck className="mr-2"/> : <Slash className="mr-2"/>}
                          {selectedUser?.disabled ? 'Unban User' : 'Ban User'}
                      </Button>
                       <Button variant="outline" onClick={handleMarkUnverified}>
                          <MailWarning className="mr-2" /> Mark as Unverified
                      </Button>
                  </div>
                   <div className="space-y-2 p-4 border rounded-lg">
                        <h4 className="font-semibold">ID Verification Status</h4>
                        <div className="flex justify-between items-center">
                            {getVerificationBadge(selectedUser?.verificationStatus)}
                            <div className="flex gap-2">
                                <Button variant="destructive" size="sm" onClick={() => handleVerificationStatus('rejected')} disabled={selectedUser?.verificationStatus === 'rejected'}>Reject</Button>
                                <Button size="sm" onClick={() => handleVerificationStatus('verified')} disabled={selectedUser?.verificationStatus === 'verified'}>Approve</Button>
                            </div>
                        </div>
                   </div>
              </div>
              <DialogFooter className="border-t pt-4">
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive"><Trash2 className="mr-2" /> Delete Account</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                               This action will permanently delete the user's data from Firestore. It cannot be undone. To fully delete the user, you must also remove them from the Firebase Authentication console.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                           <AlertDialogCancel>Cancel</AlertDialogCancel>
                           <AlertDialogAction onClick={handleDeleteAccount}>Yes, delete user data</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                 </AlertDialog>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
       <Dialog open={isMailDialogOpen} onOpenChange={setIsMailDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Send Mail to {selectedUser?.username || selectedUser?.email}</DialogTitle>
                  <DialogDescription>Select an email template to send. The content will be pre-filled in your mail client.</DialogDescription>
              </DialogHeader>
               <div className="py-4 space-y-2">
                {mailTemplates.length > 0 ? (
                  mailTemplates.map((template) => (
                    <Button
                        key={template.id}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleTemplateClick(template)}
                    >
                        {template.name}
                    </Button>
                  ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center">No mail templates found. Please create one in the Mail Templates page.</p>
                )}
              </div>
          </DialogContent>
      </Dialog>

       <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit User Profile</DialogTitle>
                    <DialogDescription>
                        Modify the details for {editingUser.email}.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveUserChanges} className="max-h-[70vh] overflow-y-auto pr-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">First Name</Label>
                            <Input name="firstName" value={editingUser.firstName || ''} onChange={handleEditInputChange} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input name="lastName" value={editingUser.lastName || ''} onChange={handleEditInputChange} />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input name="username" value={editingUser.username || ''} onChange={handleEditInputChange} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input name="phone" value={editingUser.phone || ''} onChange={handleEditInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="country">Country</Label>
                            <Select name="country" value={editingUser.country} onValueChange={handleCountryChange}>
                                <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
                                <SelectContent>
                                    <ScrollArea className="h-72">
                                        {countries.map((c) => (
                                            <SelectItem key={c.value} value={c.label}>
                                                {c.label}
                                            </SelectItem>
                                        ))}
                                    </ScrollArea>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input name="address" value={editingUser.address || ''} onChange={handleEditInputChange} />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input name="city" value={editingUser.city || ''} onChange={handleEditInputChange} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="state">State / Province</Label>
                            <Input name="state" value={editingUser.state || ''} onChange={handleEditInputChange} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSavingEdit}>
                            {isSavingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
       </Dialog>

    </AdminLayout>
  );
}
