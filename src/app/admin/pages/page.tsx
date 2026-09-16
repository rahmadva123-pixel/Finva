
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';


interface ContentPageSection {
    id: string;
    title: string;
    type: 'markdown' | 'html';
    description: string;
    htmlContent?: string;
    imageUrl?: string;
    imagePosition?: 'top' | 'left' | 'right';
    imageAlignment?: 'left' | 'center' | 'right';
    imageWidth?: number;
    imageHeight?: number;
    buttonText?: string;
    buttonLink?: string;
    // Styling options
    sectionBackgroundColor?: string;
    sectionBackgroundImageUrl?: string;
    sectionBackgroundOverlayColor?: string;
    titleColor?: string;
    titleSize?: string;
    contentColor?: string;
    contentSize?: string;
    contentAlignment?: 'left' | 'center' | 'right';
    buttonBackgroundColor?: string;
    buttonTextColor?: string;
    isolated?: boolean;
}

interface CustomPage extends StandardPageData {
    id: string;
    path: string; // e.g., "my-custom-page"
}

interface StandardPageData {
    title: string;
    sections: ContentPageSection[];
}

interface SupportPageData extends StandardPageData {
    description: string;
    phone?: string;
    supportEmail?: string;
    whatsappUrl?: string;
    telegramUrl?: string;
}

interface AllPagesData {
    about: StandardPageData;
    terms: StandardPageData;
    privacy: StandardPageData;
    support: SupportPageData;
    customPages: CustomPage[];
}

// Component to handle HTML with scripts for live preview
const HtmlRenderer: React.FC<{ htmlContent: string }> = ({ htmlContent }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            const container = ref.current;
            container.innerHTML = htmlContent;

            const scripts = Array.from(container.getElementsByTagName('script'));
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                
                // Use a timeout to ensure the DOM is ready for the script
                setTimeout(() => {
                    oldScript.parentNode?.replaceChild(newScript, oldScript);
                }, 0);
            });
        }
    }, [htmlContent]);

    return <div ref={ref} />;
};


export default function ContentPagesAdmin() {
    const { toast } = useToast();
    const [data, setData] = useState<AllPagesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [converterInput, setConverterInput] = useState('');
    
    const setDefaultSectionType = (sections: any[]): ContentPageSection[] => {
        return sections.map(section => ({
            ...section,
            type: section.type || 'markdown',
            description: section.description || '',
        }));
    };

    const fetchContent = useCallback(async () => {
        if (!db) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const docRef = doc(db, 'settings', 'contentPages');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                 const existingData = docSnap.data();
                 const validatedData: AllPagesData = {
                     about: { title: existingData.about?.title || 'About Us', sections: setDefaultSectionType(Array.isArray(existingData.about?.sections) ? existingData.about.sections : []) },
                     terms: { title: existingData.terms?.title || 'Terms & Conditions', sections: setDefaultSectionType(Array.isArray(existingData.terms?.sections) ? existingData.terms.sections : []) },
                     privacy: { title: existingData.privacy?.title || 'Privacy Policy', sections: setDefaultSectionType(Array.isArray(existingData.privacy?.sections) ? existingData.privacy.sections : []) },
                     support: { 
                         title: existingData.support?.title || 'Support Center', 
                         description: existingData.support?.description || 'Find answers and get help.',
                         sections: setDefaultSectionType(Array.isArray(existingData.support?.sections) ? existingData.support.sections : []),
                         phone: existingData.support?.phone || '',
                         supportEmail: existingData.support?.supportEmail || '',
                         whatsappUrl: existingData.support?.whatsappUrl || '',
                         telegramUrl: existingData.support?.telegramUrl || '',
                     },
                     customPages: Array.isArray(existingData.customPages) ? existingData.customPages.map((p: any) => ({...p, sections: setDefaultSectionType(Array.isArray(p.sections) ? p.sections : [])})) : [],
                 }
                setData(validatedData);
            } else {
                const defaultData: AllPagesData = {
                    about: { title: 'About Us', sections: [{id: '1', title: 'Our Mission', type: 'markdown', description: 'Welcome to our about page.'}] },
                    terms: { title: 'Terms & Conditions', sections: [{id: '1', title: 'General Terms', type: 'markdown', description: 'Here are the terms and conditions.'}] },
                    privacy: { title: 'Privacy Policy', sections: [{id: '1', title: 'Data Collection', type: 'markdown', description: 'Your privacy is important to us.'}] },
                    support: { title: 'Support Center', description: 'Find answers and get help.', sections: [{id: '1', title: 'How to get started?', type: 'markdown', description: 'This is how you get started.'}], phone: '', supportEmail: '', whatsappUrl: '', telegramUrl: ''},
                    customPages: [],
                };
                await setDoc(docRef, defaultData);
                setData(defaultData);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch page content.' });
        } finally {
            setLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        fetchContent();
    }, [fetchContent]);
    
    const handleStandardPageChange = (pageKey: keyof Omit<AllPagesData, 'customPages'>, field: string, value: string) => {
        setData(prev => {
            if (!prev) return null;
            const pageData = prev[pageKey];
            return { 
                ...prev, 
                [pageKey]: { 
                    ...(pageData as any), 
                    sections: pageData?.sections || [], 
                    [field]: value 
                }
            } as AllPagesData;
        });
    };

    const handleSectionChange = (pageKey: 'about' | 'terms' | 'privacy' | 'support' | number, index: number, field: keyof ContentPageSection, value: string | number | boolean) => {
        setData(prev => {
            if (!prev) return null;
            if (typeof pageKey === 'string') {
                const newSections = [...prev[pageKey].sections];
                newSections[index] = { ...newSections[index], [field]: value };
                return { ...prev, [pageKey]: { ...prev[pageKey], sections: newSections }};
            } else {
                 const newCustomPages = [...prev.customPages];
                const newSections = [...newCustomPages[pageKey].sections];
                newSections[index] = {...newSections[index], [field]: value };
                newCustomPages[pageKey] = {...newCustomPages[pageKey], sections: newSections };
                return { ...prev, customPages: newCustomPages };
            }
        });
    }

    const addSection = (pageKey: 'about' | 'terms' | 'privacy' | 'support' | number, type: 'markdown' | 'html' = 'markdown') => {
        setData(prev => {
            if(!prev) return null;
            const newSection: ContentPageSection = { 
                id: Date.now().toString(), 
                title: type === 'html' ? 'HTML Widget' : 'New Section', 
                type: type, 
                description: type === 'markdown' ? 'New content here...' : '',
                htmlContent: type === 'html' ? '<!-- Paste your widget code here -->' : '',
                imagePosition: 'top',
                imageAlignment: 'center',
                contentAlignment: 'left',
                isolated: type === 'html', // Default to isolated for new HTML sections
            };
            if(typeof pageKey === 'string') {
                 return { ...prev, [pageKey]: { ...prev[pageKey], sections: [...(prev[pageKey].sections || []), newSection] }};
            } else {
                const newCustomPages = [...prev.customPages];
                newCustomPages[pageKey].sections.push(newSection);
                return { ...prev, customPages: newCustomPages };
            }
        })
    }

    const removeSection = (pageKey: 'about' | 'terms' | 'privacy' | 'support' | number, index: number) => {
        setData(prev => {
            if (!prev) return null;
            if(typeof pageKey === 'string') {
                const newSections = prev[pageKey].sections.filter((_, i) => i !== index);
                return { ...prev, [pageKey]: { ...prev[pageKey], sections: newSections } };
            } else {
                const newCustomPages = [...prev.customPages];
                newCustomPages[pageKey].sections = newCustomPages[pageKey].sections.filter((_, i) => i !== index);
                return { ...prev, customPages: newCustomPages };
            }
        });
    };

    const handleCustomPageChange = (index: number, field: keyof CustomPage, value: string) => {
        setData(prev => {
            if (!prev) return null;
            const newCustomPages = [...prev.customPages];
            const pageToUpdate = { ...newCustomPages[index], [field]: value };

            if(field === 'path') {
                pageToUpdate.path = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
            }
            
            newCustomPages[index] = pageToUpdate;
            return { ...prev, customPages: newCustomPages };
        });
    };

    const addCustomPage = () => {
        setData(prev => {
            if (!prev) return null;
            const newPage: CustomPage = {
                id: Date.now().toString(),
                path: `new-page-${prev.customPages.length + 1}`,
                title: 'New Page',
                sections: [{id: '1', title: 'Main Content', type: 'markdown', description: 'This is a new page.', imagePosition: 'top', imageAlignment: 'center', contentAlignment: 'left' }]
            };
            return { ...prev, customPages: [...prev.customPages, newPage] };
        });
    };

    const removeCustomPage = (index: number) => {
        setData(prev => {
            if (!prev) return null;
            const newCustomPages = prev.customPages.filter((_, i) => i !== index);
            return { ...prev, customPages: newCustomPages };
        });
    };

    const handleSave = async (section: keyof AllPagesData) => {
        if (!db || !data) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'contentPages'), data, { merge: true });
            toast({ title: 'Success', description: `${section.charAt(0).toUpperCase() + section.slice(1)} content saved.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save: ${error.message}` });
        } finally {
            setSaving(false);
        }
    };
    
    const handleConvertCode = (onSectionChange: Function, pageKey: 'about' | 'terms' | 'privacy' | 'support' | number, index: number) => {
        if (!converterInput) {
            toast({ variant: 'destructive', title: 'Input empty', description: 'Please paste code to convert.' });
            return;
        }

        // Heuristic to detect if it's a full HTML page
        const isFullHtmlPage = /<html/i.test(converterInput) || /<body/i.test(converterInput) || /<style/i.test(converterInput);

        // Heuristic to detect if it's a JS-based widget snippet (like TradingView's embeddable ones)
        const isJsWidget = /<script/i.test(converterInput) && /src=/i.test(converterInput);

        if (isFullHtmlPage) {
            onSectionChange(pageKey, index, 'htmlContent', converterInput);
            onSectionChange(pageKey, index, 'isolated', true); // Full HTML should always be isolated
            toast({ title: 'Success', description: 'HTML content added. Isolation has been enabled automatically.' });
            setConverterInput('');
        } else if (isJsWidget) {
            onSectionChange(pageKey, index, 'htmlContent', converterInput);
            onSectionChange(pageKey, index, 'isolated', true); // Widgets should be isolated for safety
            toast({ title: 'Success', description: 'Widget code has been embedded. Isolation has been enabled.' });
            setConverterInput('');
        } else {
            toast({
                variant: 'destructive',
                title: 'Unsupported Code',
                description: 'This does not look like a full HTML page or a standard widget embed code. Please paste valid content.',
            });
        }
    };

    const renderSectionEditor = (pageKey: 'about' | 'terms' | 'privacy' | 'support' | number, onRemoveSection: Function) => {
        if(!data) return null;
        
        let sections: ContentPageSection[];
        if (typeof pageKey === 'string') {
            sections = data[pageKey]?.sections || [];
        } else {
            sections = data.customPages[pageKey]?.sections || [];
        }

        const fontSizeOptions = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'];

        return (
            <div className="space-y-4">
                {(sections).map((section, index) => (
                    <Card key={`${section.id}-${index}`} className="bg-muted/50 p-4">
                        <div className="flex justify-between items-center mb-4">
                             <h4 className="font-semibold">Section {index + 1}</h4>
                             <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => onRemoveSection(pageKey, index)}><Trash2 className="h-4 w-4"/></Button>
                        </div>
                        <Accordion type="multiple" className="w-full" defaultValue={['content']}>
                            <AccordionItem value="content">
                                <AccordionTrigger>Content</AccordionTrigger>
                                <AccordionContent className="space-y-4">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Section Title</Label>
                                            <Input value={section.title} onChange={e => handleSectionChange(pageKey, index, 'title', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Content Type</Label>
                                            <Select value={section.type || 'markdown'} onValueChange={(value: 'markdown'|'html') => handleSectionChange(pageKey, index, 'type', value)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="markdown">Markdown</SelectItem>
                                                    <SelectItem value="html">HTML</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    {section.type === 'html' && (
                                        <div className="flex items-center space-x-2 pt-2">
                                            <Switch
                                                id={`isolated-${section.id}`}
                                                checked={section.isolated}
                                                onCheckedChange={(checked) => handleSectionChange(pageKey, index, 'isolated', checked)}
                                            />
                                            <Label htmlFor={`isolated-${section.id}`}>Isolate this section's styles</Label>
                                        </div>
                                    )}
                                    <div className="space-y-2 mt-4">
                                        <Label>Content</Label>
                                        {section.type === 'html' ? (
                                            <>
                                            <Textarea value={section.htmlContent || ''} onChange={e => handleSectionChange(pageKey, index, 'htmlContent', e.target.value)} rows={5} placeholder="<p>Your HTML code here</p>" />
                                            <Card className="bg-background mt-4">
                                                <CardHeader>
                                                    <CardTitle className="text-base">Widget Code Converter</CardTitle>
                                                    <CardDescription className="text-xs">Paste JS widget code (e.g., from TradingView's React examples) to convert it to embeddable HTML.</CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-2">
                                                    <Textarea placeholder="Paste JS widget code here..." value={converterInput} onChange={e => setConverterInput(e.target.value)} rows={4}/>
                                                    <Button type="button" onClick={() => handleConvertCode(handleSectionChange, pageKey, index)}>Convert & Use</Button>
                                                </CardContent>
                                            </Card>
                                            </>
                                        ) : (
                                            <Textarea value={section.description} onChange={e => handleSectionChange(pageKey, index, 'description', e.target.value)} rows={5} placeholder="Markdown supported content..." />
                                        )}
                                    </div>
                                    {section.type === 'html' && section.htmlContent && (
                                        <div className="mt-4 space-y-2">
                                            <Label>Live Preview</Label>
                                            <div className="p-4 border rounded-md min-h-[100px] bg-background">
                                                <HtmlRenderer htmlContent={section.htmlContent} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label>Image URL (Optional)</Label>
                                        <Input value={section.imageUrl || ''} onChange={e => handleSectionChange(pageKey, index, 'imageUrl', e.target.value)} placeholder="https://example.com/image.png"/>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>Image Position</Label>
                                            <Select
                                                value={section.imagePosition || 'top'}
                                                onValueChange={(value: 'top' | 'left' | 'right') => handleSectionChange(pageKey, index, 'imagePosition', value)}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="top">Top</SelectItem>
                                                    <SelectItem value="left">Left</SelectItem>
                                                    <SelectItem value="right">Right</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                         {section.imagePosition === 'top' && (
                                            <div className="space-y-2">
                                                <Label>Image Alignment</Label>
                                                <Select
                                                    value={section.imageAlignment || 'center'}
                                                    onValueChange={(value: 'left' | 'center' | 'right') => handleSectionChange(pageKey, index, 'imageAlignment', value)}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="left">Left</SelectItem>
                                                        <SelectItem value="center">Center</SelectItem>
                                                        <SelectItem value="right">Right</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                         <div className="space-y-2">
                                            <Label>Image Width (px)</Label>
                                            <Input type="number" value={section.imageWidth || ''} onChange={e => handleSectionChange(pageKey, index, 'imageWidth', e.target.valueAsNumber)} placeholder="e.g. 400" />
                                        </div>
                                         <div className="space-y-2">
                                            <Label>Image Height (px)</Label>
                                            <Input type="number" value={section.imageHeight || ''} onChange={e => handleSectionChange(pageKey, index, 'imageHeight', e.target.valueAsNumber)} placeholder="e.g. 300" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                       <div className="space-y-2">
                                            <Label>Button Text (Optional)</Label>
                                            <Input value={section.buttonText || ''} onChange={e => handleSectionChange(pageKey, index, 'buttonText', e.target.value)} placeholder="e.g. Learn More" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Button Link (Optional)</Label>
                                            <Input value={section.buttonLink || ''} onChange={e => handleSectionChange(pageKey, index, 'buttonLink', e.target.value)} placeholder="https://example.com" />
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="styling">
                                <AccordionTrigger>Styling</AccordionTrigger>
                                <AccordionContent className="space-y-6">
                                    <div className="p-4 border rounded-md space-y-4">
                                        <h5 className="font-semibold">Content Alignment</h5>
                                        <Select
                                            value={section.contentAlignment || 'left'}
                                            onValueChange={(value: 'left' | 'center' | 'right') => handleSectionChange(pageKey, index, 'contentAlignment', value)}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="left">Left</SelectItem>
                                                <SelectItem value="center">Center</SelectItem>
                                                <SelectItem value="right">Right</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                     <div className="p-4 border rounded-md space-y-4">
                                        <h5 className="font-semibold">Section Background</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Background Color</Label>
                                                <Input type="color" value={section.sectionBackgroundColor || '#000000'} onChange={e => handleSectionChange(pageKey, index, 'sectionBackgroundColor', e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Background Image URL</Label>
                                                <Input value={section.sectionBackgroundImageUrl || ''} onChange={e => handleSectionChange(pageKey, index, 'sectionBackgroundImageUrl', e.target.value)} />
                                            </div>
                                             <div className="space-y-2 col-span-2">
                                                <Label>Background Overlay Color</Label>
                                                <Input value={section.sectionBackgroundOverlayColor || ''} onChange={e => handleSectionChange(pageKey, index, 'sectionBackgroundOverlayColor', e.target.value)} placeholder="e.g., rgba(0,0,0,0.5)" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 border rounded-md space-y-4">
                                        <h5 className="font-semibold">Typography</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             <div className="space-y-2">
                                                <Label>Title Color</Label>
                                                <Input type="color" value={section.titleColor || '#ffffff'} onChange={e => handleSectionChange(pageKey, index, 'titleColor', e.target.value)} />
                                            </div>
                                             <div className="space-y-2">
                                                <Label>Title Size</Label>
                                                <Select value={section.titleSize || '2xl'} onValueChange={(val) => handleSectionChange(pageKey, index, 'titleSize', val)}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>{fontSizeOptions.map(s => <SelectItem key={s} value={s}>text-{s}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Content Color</Label>
                                                <Input type="color" value={section.contentColor || '#ffffff'} onChange={e => handleSectionChange(pageKey, index, 'contentColor', e.target.value)} />
                                            </div>
                                             <div className="space-y-2">
                                                <Label>Content Size</Label>
                                                <Select value={section.contentSize || 'base'} onValueChange={(val) => handleSectionChange(pageKey, index, 'contentSize', val)}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>{fontSizeOptions.map(s => <SelectItem key={s} value={s}>text-{s}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                     <div className="p-4 border rounded-md space-y-4">
                                        <h5 className="font-semibold">Button Styling</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             <div className="space-y-2">
                                                <Label>Button Background Color</Label>
                                                <Input type="color" value={section.buttonBackgroundColor || '#ffffff'} onChange={e => handleSectionChange(pageKey, index, 'buttonBackgroundColor', e.target.value)} />
                                            </div>
                                             <div className="space-y-2">
                                                <Label>Button Text Color</Label>
                                                <Input type="color" value={section.buttonTextColor || '#000000'} onChange={e => handleSectionChange(pageKey, index, 'buttonTextColor', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </Card>
                ))}
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <Button type="button" variant="outline"><Plus className="mr-2 h-4 w-4"/> Add Section</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => addSection(pageKey, 'markdown')}>
                            Content Section
                        </DropdownMenuItem>
                         <DropdownMenuItem onSelect={() => addSection(pageKey, 'html')}>
                            HTML Widget
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        )
    };

    if (loading) {
        return <AdminLayout><div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div></AdminLayout>;
    }
    
    if (!data) {
        return <AdminLayout><div className="flex justify-center p-8">Could not load content data.</div></AdminLayout>;
    }

    return (
        <AdminLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Content Pages</h1>
                    <p className="text-muted-foreground">Manage the content for your static pages.</p>
                </div>
                
                <Tabs defaultValue="about">
                    <TabsList className="grid w-full max-w-2xl grid-cols-5">
                        <TabsTrigger value="about">About Us</TabsTrigger>
                        <TabsTrigger value="terms">Terms</TabsTrigger>
                        <TabsTrigger value="privacy">Privacy</TabsTrigger>
                        <TabsTrigger value="support">Support</TabsTrigger>
                        <TabsTrigger value="custom">Custom</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="about" className="mt-6">
                        <Card>
                            <CardHeader><CardTitle>About Us Page (/about)</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="about-title">Page Title</Label>
                                    <Input id="about-title" value={data.about.title} onChange={e => handleStandardPageChange('about', 'title', e.target.value)} />
                                </div>
                                {renderSectionEditor('about', removeSection)}
                            </CardContent>
                            <CardFooter>
                                <Button onClick={() => handleSave('about')} disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save About Page
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    <TabsContent value="terms" className="mt-6">
                        <Card>
                             <CardHeader><CardTitle>Terms & Conditions Page (/terms)</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="terms-title">Page Title</Label>
                                    <Input id="terms-title" value={data.terms.title} onChange={e => handleStandardPageChange('terms', 'title', e.target.value)} />
                                </div>
                                {renderSectionEditor('terms', removeSection)}
                            </CardContent>
                             <CardFooter>
                                <Button onClick={() => handleSave('terms')} disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save Terms Page
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="privacy" className="mt-6">
                        <Card>
                            <CardHeader><CardTitle>Privacy Policy Page (/privacy)</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="privacy-title">Page Title</Label>
                                    <Input id="privacy-title" value={data.privacy.title} onChange={e => handleStandardPageChange('privacy', 'title', e.target.value)} />
                                </div>
                                {renderSectionEditor('privacy', removeSection)}
                            </CardContent>
                             <CardFooter>
                                <Button onClick={() => handleSave('privacy')} disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save Privacy Page
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    <TabsContent value="support" className="mt-6">
                        <Card>
                            <CardHeader><CardTitle>Support Page (/dashboard/support)</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="support-title">Page Title</Label>
                                    <Input id="support-title" value={data.support.title} onChange={e => handleStandardPageChange('support', 'title', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="support-description">Page Description</Label>
                                    <Input id="support-description" value={data.support.description} onChange={e => handleStandardPageChange('support', 'description', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="support-phone">Phone</Label>
                                        <Input id="support-phone" value={data.support.phone || ''} onChange={e => handleStandardPageChange('support', 'phone', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="support-email">Support Email</Label>
                                        <Input id="support-email" type="email" value={data.support.supportEmail || ''} onChange={e => handleStandardPageChange('support', 'supportEmail', e.target.value)} placeholder="support@yourdomain.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="support-whatsapp">Whatsapp URL</Label>
                                        <Input id="support-whatsapp" value={data.support.whatsappUrl || ''} onChange={e => handleStandardPageChange('support', 'whatsappUrl', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="support-telegram">Telegram URL</Label>
                                        <Input id="support-telegram" value={data.support.telegramUrl || ''} onChange={e => handleStandardPageChange('support', 'telegramUrl', e.target.value)} />
                                    </div>
                                </div>
                                {renderSectionEditor('support', removeSection)}
                            </CardContent>
                            <CardFooter>
                                <Button onClick={() => handleSave('support')} disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save Support Page
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="custom" className="mt-6">
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Custom Pages</CardTitle>
                                    <CardDescription>Create and manage additional content pages.</CardDescription>
                                </div>
                                <Button onClick={addCustomPage}><Plus className="mr-2 h-4 w-4"/> Add Custom Page</Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Accordion type="single" collapsible className="w-full space-y-4">
                                    {data.customPages.map((page, index) => (
                                        <AccordionItem value={page.id} key={page.id} className="border rounded-lg bg-card/50">
                                            <div className="flex items-center p-4">
                                                <AccordionTrigger className="text-lg font-semibold hover:no-underline flex-1">{page.title}</AccordionTrigger>
                                                <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => removeCustomPage(index)}><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                            <AccordionContent className="px-6 pb-6 border-t">
                                                <div className="pt-6 space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Page Title</Label>
                                                            <Input value={page.title} onChange={e => handleCustomPageChange(index, 'title', e.target.value)} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>URL Path</Label>
                                                            <div className="flex items-center">
                                                                <span className="text-sm text-muted-foreground p-2 bg-muted rounded-l-md border border-r-0">/page/</span>
                                                                <Input 
                                                                    value={page.path} 
                                                                    onChange={e => handleCustomPageChange(index, 'path', e.target.value)} 
                                                                    className="rounded-l-none"
                                                                    placeholder="my-custom-page"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {renderSectionEditor(index, removeSection)}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                                {data.customPages.length === 0 && (
                                    <p className="text-center text-muted-foreground py-8">No custom pages created yet.</p>
                                )}
                            </CardContent>
                             <CardFooter>
                                <Button onClick={() => handleSave('customPages')} disabled={saving || data.customPages.length === 0}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save Custom Pages
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AdminLayout>
    );
}
