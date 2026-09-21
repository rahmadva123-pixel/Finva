"use client";

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface TreeNode {
  id: string;
  name?: string;
  email?: string;
  children: TreeNode[];
}

export default function ReferralTree({ rootId, maxDepth = 5 }: { rootId: string; maxDepth?: number }) {
  const [nodesMap, setNodesMap] = useState<Record<string, any>>({});
  const [root, setRoot] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rootId) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        if (!db) {
          setNodesMap({});
          setRoot(null);
          setLoading(false);
          return;
        }

        const snap = await getDocs(collection(db, 'users'));
        const map: Record<string, any> = {};
        snap.docs.forEach(d => map[d.id] = { id: d.id, ...(d.data() || {}) });

        // build children lists
        const childrenMap: Record<string, string[]> = {};
        Object.keys(map).forEach(id => {
          const u = map[id];
          const ref = u.referredBy;
          if (ref) {
            if (!childrenMap[ref]) childrenMap[ref] = [];
            childrenMap[ref].push(id);
          }
        });

        const build = (id: string, depth: number): TreeNode => {
          const u = map[id] || { email: id };
          const children = (childrenMap[id] || []).slice(0, 200).map(cid => depth + 1 < maxDepth ? build(cid, depth + 1) : ({ id: cid, name: map[cid]?.firstName || map[cid]?.username || map[cid]?.email, email: map[cid]?.email, children: [] }));
          return { id, name: u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : (u.username || u.email), email: u.email, children };
        };

        const rootNode = build(rootId, 0);
        if (!mounted) return;
        setNodesMap(map);
        setRoot(rootNode);
      } catch (e) {
        console.warn('ReferralTree load failed', e);
        setNodesMap({});
        setRoot(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [rootId, maxDepth]);

  if (!rootId) return <div className="text-sm text-muted-foreground">No user selected.</div>;
  if (loading) return <div className="text-sm text-muted-foreground">Loading referral tree...</div>;
  if (!root) return <div className="text-sm text-muted-foreground">No referral data available.</div>;

  const renderNode = (node: TreeNode, level = 0) => (
    <li key={node.id} className="py-1">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-muted/30 flex items-center justify-center text-xs font-semibold">{(node.name || node.email || node.id)[0] || '?'}</div>
        <div className="text-sm">
          <div className="font-medium">{node.name || node.email || node.id}</div>
          {node.email && <div className="text-xs text-muted-foreground">{node.email}</div>}
        </div>
      </div>
      {node.children && node.children.length > 0 && (
        <ul className="ml-6 mt-2 border-l border-muted/20 pl-4">
          {node.children.map(c => renderNode(c, level + 1))}
        </ul>
      )}
    </li>
  );

  return (
    <div>
      <ul className="space-y-2">
        {renderNode(root)}
      </ul>
    </div>
  );
}
