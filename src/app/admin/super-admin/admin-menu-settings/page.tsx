"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

export interface AdminNavItem {
  key: string;
  enabled: boolean;
  label: string;
}

const initialAdminNavItems: Omit<AdminNavItem, 'enabled'>[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
  { key: 'ico', label: 'ICO & Token' },
  { key: 'swap', label: 'Swap Settings' },
  { key: 'payments', label: 'Payments' },
  { key: 'shareAndEarn', label: 'Share & Earn' },
  { key: 'bonus', label: 'Bonus Settings' },
  { key: 'template', label: 'Templates' },
  { key: 'notificationSettings', label: 'Notification Settings' },
  { key: 'generalSettings', label: 'General Settings' },
  { key: 'languageSettings', label: 'Language Settings' },
];

export default function AdminMenuSettingsPage() {
  const { toast } = useToast();
  const [navItems, setNavItems] = useState<AdminNavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const navRef = doc(db, 'settings', 'adminNavigation');
        const navSnap = await getDoc(navRef);
        
        let finalNavItems: AdminNavItem[];

        if (navSnap.exists() && navSnap.data().items) {
          const savedItems = navSnap.data().items as AdminNavItem[];
          const savedItemsMap = new Map(savedItems.map(i => [i.key, i]));
          
          finalNavItems = initialAdminNavItems.map(initialItem => {
              const savedItem = savedItemsMap.get(initialItem.key);
              return {
                  ...initialItem,
                  enabled: savedItem ? savedItem.enabled : true, // Default to true if not in DB
              };
          });

        } else {
            finalNavItems = initialAdminNavItems.map(item => ({...item, enabled: true}));
        }
        setNavItems(finalNavItems);

      } catch (error) {
        console.error('Error fetching admin nav settings:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch settings.',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [toast]);

  const handleToggleChange = (key: AdminNavItem['key'], checked: boolean) => {
    setNavItems(prev =>
      prev.map(item => (item.key === key ? { ...item, enabled: checked } : item))
    );
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not initialized.',
      });
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'adminNavigation'), { items: navItems }, { merge: true });
      toast({
        title: 'Success',
        description: 'Admin menu settings have been saved.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error saving settings',
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Admin Menu Settings</h1>
            <p className="text-muted-foreground">Control which menu items are visible to regular admins.</p>
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Admin Sidebar Menu Items</CardTitle>
            <CardDescription>Enable or disable the main navigation items for the regular admin panel.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                {navItems.map((item) => (
                    <div
                        key={item.key}
                        className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                    >
                        <Label htmlFor={`switch-${item.key}`} className="text-lg font-semibold capitalize">{item.label}</Label>
                        <Switch
                            checked={item.enabled}
                            onCheckedChange={(checked) => handleToggleChange(item.key, checked)}
                            id={`switch-${item.key}`}
                        />
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </form>
    </AdminLayout>
  );
}
