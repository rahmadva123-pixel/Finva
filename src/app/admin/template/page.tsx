
"use client";

import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Newspaper, Palette } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const templates = [
    {
        name: 'General & Template Settings',
        description: 'Edit logos, header menus, auth page content, and other general template options.',
        imageUrl: 'https://i.postimg.cc/jd89rfnx/OZ6z-HXvn7-E1e-ADi0-PU1-Lp-WQe-JDA.avif',
        editUrl: '/admin/template/crypgo'
    },
    {
        name: 'Landing Page Content',
        description: 'Edit the content of the sections on your landing page.',
        imageUrl: 'https://i.postimg.cc/nrCjB1jX/landing-page.avif',
        editUrl: '/admin/template/landing'
    },
    {
        name: 'Theme Settings',
        description: 'Customize the main colors of your website.',
        imageUrl: 'https://i.postimg.cc/pXWd4Qx9/theme-settings.avif',
        editUrl: '/admin/template/theme'
    },
    {
        name: 'Footer Settings',
        description: 'Manage the content, links, and mobile navigation bar for your site\'s footer.',
        imageUrl: 'https://i.postimg.cc/tJk2b9qP/footer-settings.avif',
        editUrl: '/admin/template/footer'
    }
]

export default function TemplatesListPage() {

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Manage Templates</h1>
          <p className="text-muted-foreground">Select a template to edit its content and appearance.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {templates.map(template => (
                <Card key={template.name}>
                    <CardHeader>
                        <div className="aspect-video relative mb-4">
                            <Image src={template.imageUrl} alt={template.name} layout="fill" objectFit="cover" className="rounded-md" />
                        </div>
                        <CardTitle>{template.name}</CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full">
                            <Link href={template.editUrl}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>

      </div>
    </AdminLayout>
  );
}
