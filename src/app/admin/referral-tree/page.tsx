"use client";

import React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const ReferralTree = dynamic(() => import('@/components/referral-tree/ReferralTree'), { ssr: false });

export default function AdminReferralTreePage() {
  const [uid, setUid] = useState('');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('uid');
      if (q) setUid(q);
    } catch (e) {
      // ignore
    }
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Referral Tree</h1>
          <p className="text-sm text-muted-foreground">View referral tree for any user (pass ?uid=USER_ID).</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Tree Viewer</CardTitle>
          </CardHeader>
          <CardContent>
            {uid ? <ReferralTree rootId={uid} maxDepth={6} /> : <div className="text-sm text-muted-foreground">Provide a user id via query param ?uid=</div>}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
