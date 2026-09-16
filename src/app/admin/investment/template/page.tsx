
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Loader2, Plus, Trash2, GripVertical, Settings2, Edit, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

interface PlanFeature {
    id: string;
    label: string;
    key: 'interest' | 'capitalBack' | 'payout' | 'recurrence' | 'blockedDays' | 'claimNeeded' | 'minAmount' | 'maxAmount' | 'totalReturn';
}

interface InvestmentTemplate {
    id: string;
    name: string;
    active: boolean;
    cardBackgroundColor: string;
    cardBackgroundColor2?: string;
    cardBackgroundOverlayColor?: string;
    planNameColor: string;
    amountColor: string;
    featureTextColor: string;
    featureValueColor: string;
    separatorColor: string;
    buttonBackgroundColor: string;
    buttonTextColor: string;
    buttonText: string;
    featureBackgroundColor?: string;
    features: PlanFeature[];
}

const initialTemplates: InvestmentTemplate[] = [
    {
        id: 'default',
        name: 'Default Investment Template',
        active: true,
        cardBackgroundColor: '#1a1a2e',
        cardBackgroundOverlayColor: 'rgba(0,0,0,0)',
        planNameColor: '#ffffff',
        amountColor: '#69FAB4',
        featureTextColor: '#a0a0b0',
        featureValueColor: '#ffffff',
        separatorColor: '#2a2a4e',
        buttonBackgroundColor: '#69FAB4',
        buttonTextColor: '#1a1a2e',
        buttonText: 'Invest Now',
        features: [
            { id: '1', label: 'Interest', key: 'interest' },
            { id: '2', label: 'Capital will back', key: 'capitalBack' },
            { id: '3', label: 'Payout', key: 'payout' },
            { id: '4', label: 'Interest recurrence', key: 'recurrence' }
        ]
    },
    {
        id: 'green_pluss',
        name: 'Green Pluss Template',
        active: false,
        cardBackgroundColor: '#111111',
        cardBackgroundColor2: '#222222',
        cardBackgroundOverlayColor: 'rgba(0,0,0,0)',
        planNameColor: '#ffffff',
        amountColor: '#00ff00',
        featureTextColor: '#ffffff',
        featureValueColor: '#ffffff',
        separatorColor: '#2a2a4e',
        buttonBackgroundColor: '#00ff00',
        buttonTextColor: '#000000',
        buttonText: 'Invest Now',
        featureBackgroundColor: 'rgba(128, 128, 128, 0.2)',
        features: [
            { id: 'gp1', label: 'For', key: 'recurrence' },
            { id: 'gp2', label: 'Min', key: 'minAmount' },
            { id: 'gp3', label: 'Max', key: 'maxAmount' },
            { id: 'gp4', label: 'Capital Back', key: 'capitalBack' },
        ]
    }
];

const featureKeyOptions = [
    { value: 'interest', label: 'Interest' },
    { value: 'capitalBack', label: 'Capital Back' },
    { value: 'payout', label: 'Payout' },
    { value: 'recurrence', label: 'Recurrence' },
    { value: 'blockedDays', label: 'Blocked Days' },
    { value: 'claimNeeded', label: 'Claim Needed' },
    { value: 'minAmount', label: 'Min Amount' },
    { value: 'maxAmount', label: 'Max Amount' },
    { value: 'totalReturn', label: 'Total Return' },
];

const TemplateEditor = ({ template: initialTmpl, onSave }: { template: InvestmentTemplate, onSave: (template: InvestmentTemplate) => Promise<void> }) => {
    const [template, setTemplate] = useState(initialTmpl);
    const [saving, setSaving] = useState(false);

    const handleColorChange = (field: keyof Omit<InvestmentTemplate, 'features' | 'buttonText' | 'id' | 'name' | 'active'>, value: string) => {
        setTemplate(prev => ({ ...prev, [field]: value }));
    };
    
    const handleFeatureChange = (id: string, field: 'label' | 'key', value: string) => {
        setTemplate(prev => ({
            ...prev,
            features: prev.features.map(f => f.id === id ? { ...f, [field]: value as PlanFeature['key'] } : f)
        }));
    };

    const handleAddFeature = () => {
        const newFeature: PlanFeature = {
            id: Date.now().toString(),
            label: 'New Feature',
            key: 'interest'
        };
        setTemplate(prev => ({
            ...prev,
            features: [...prev.features, newFeature]
        }));
    };

    const handleRemoveFeature = (id: string) => {
        setTemplate(prev => ({
            ...prev,
            features: prev.features.filter(f => f.id !== id)
        }));
    };
    
    const handleSaveChanges = async () => {
        setSaving(true);
        await onSave(template);
        setSaving(false);
    }
    
    const getPreviewValue = (key: PlanFeature['key']) => {
        switch(key) {
            case 'interest': return '10% Daily';
            case 'capitalBack': return <Badge variant="outline" className="text-green-500 border-green-500/50 bg-green-500/10">Yes</Badge>;
            case 'payout': return 'Automatic';
            case 'recurrence': return 'Lifetime';
            case 'blockedDays': return 'Sat, Sun';
            case 'claimNeeded': return 'Manual';
            case 'minAmount': return '$100';
            case 'maxAmount': return '$1000';
            case 'totalReturn': return '30% + Capital';
            default: return 'N/A';
        }
    }
    
    const renderDefaultPreview = () => (
         <div 
            style={{ backgroundColor: template.cardBackgroundColor, position: 'relative' }}
            className="p-6 rounded-2xl border flex flex-col"
         >
            <div style={{ position: 'absolute', inset: 0, backgroundColor: template.cardBackgroundOverlayColor || 'transparent', borderRadius: 'inherit' }}></div>
            <div className="relative z-10 flex flex-col h-full">
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold font-headline mb-2" style={{ color: template.planNameColor }}>Starter Plan</h3>
                    <p className="text-2xl font-bold" style={{ color: template.amountColor }}>
                        $100 - $1,000
                    </p>
                </div>
                
                <div className="space-y-4 flex-grow">
                    {template.features.map((feature, index) => (
                        <React.Fragment key={feature.id}>
                            <div className="flex justify-between items-center text-sm">
                                <span style={{ color: template.featureTextColor }}>{feature.label}</span>
                                <span className="font-medium" style={{ color: template.featureValueColor }}>
                                    {getPreviewValue(feature.key)}
                                </span>
                            </div>
                            {index < template.features.length - 1 && <div style={{height: '1px', width: '100%', backgroundColor: template.separatorColor}}></div>}
                        </React.Fragment>
                    ))}
                </div>

                <Button 
                    className="w-full mt-6"
                    style={{
                        backgroundColor: template.buttonBackgroundColor,
                        color: template.buttonTextColor
                    }}
                >{template.buttonText}</Button>
            </div>
        </div>
    );
    
    const renderGreenPlussPreview = () => {
        const backgroundStyle = template.cardBackgroundColor2 
            ? { background: `linear-gradient(to bottom right, ${template.cardBackgroundColor}, ${template.cardBackgroundColor2})`, color: template.featureTextColor }
            : { backgroundColor: template.cardBackgroundColor, color: template.featureTextColor };

        return (
         <div 
            style={{...backgroundStyle, position: 'relative'}}
            className={`p-4 rounded-2xl border-2 border-gray-800 flex flex-col w-full max-w-sm mx-auto`}
        >
             <div style={{ position: 'absolute', inset: 0, backgroundColor: template.cardBackgroundOverlayColor || 'transparent', borderRadius: 'inherit' }}></div>
             <div className="relative z-10 flex flex-col h-full">
                <div className="text-center font-bold py-2 rounded-t-lg -mx-4 -mt-4 mb-4" style={{ backgroundColor: template.buttonBackgroundColor, color: template.buttonTextColor }}>
                    Starter Plan
                </div>
                
                <div className="text-center my-4">
                    <div className="inline-block font-bold text-4xl px-4 py-2 rounded-lg" style={{ backgroundColor: template.buttonBackgroundColor, color: template.buttonTextColor }}>
                       10%
                    </div>
                    <p className="text-lg mt-2 capitalize">Daily</p>
                </div>
                
                <div className="space-y-3 flex-grow mb-6">
                    {template.features.map((feature, index) => (
                        <div key={feature.id} className="flex items-center gap-3 p-3 rounded-lg text-sm" style={{ backgroundColor: template.featureBackgroundColor || 'rgba(128,128,128,0.2)' }}>
                            <CheckCircle className="h-5 w-5" style={{ color: template.buttonBackgroundColor }}/>
                            <span>{feature.label}</span>
                            <div className="font-bold ml-auto">{getPreviewValue(feature.key)}</div>
                        </div>
                    ))}
                </div>

                <Button 
                    className="w-full mt-auto font-bold" 
                    style={{ backgroundColor: template.buttonBackgroundColor, color: template.buttonTextColor }}
                >
                   {template.buttonText}
                </Button>
            </div>
        </div>
    )};

     return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-center">
                 <CardTitle>Plan Card Styles</CardTitle>
                 <Button onClick={handleSaveChanges} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8">
                {/* Style Editor */}
                <div className="space-y-6">
                    <h3 className="font-semibold text-lg">Color Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label className="capitalize">BG Overlay Color</Label>
                           <div className="flex items-center gap-2">
                              <Input type="text" value={template.cardBackgroundOverlayColor || ''} onChange={(e) => handleColorChange('cardBackgroundOverlayColor', e.target.value)} placeholder="rgba(0,0,0,0.5)" />
                           </div>
                           <p className="text-xs text-muted-foreground">Use RGBA format for transparency. e.g. rgba(0, 0, 0, 0.5)</p>
                        </div>
                        {Object.entries(template).filter(([key]) => (key.endsWith('Color') || key.endsWith('Color2')) && !key.includes('Overlay')).map(([key, value]) => (
                            <div key={key} className="space-y-2">
                                <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').replace('Color', ' Color')}</Label>
                                <div className="flex items-center gap-2">
                                    <Input type="color" value={value as string} onChange={(e) => handleColorChange(key as any, e.target.value)} className="w-12 h-10 p-1" />
                                    <Input value={value as string} onChange={(e) => handleColorChange(key as any, e.target.value)} />
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <h3 className="font-semibold text-lg mt-8">Content Settings</h3>
                     <div className="space-y-2">
                        <Label>Button Text</Label>
                        <Input value={template.buttonText} onChange={e => setTemplate(p => ({...p, buttonText: e.target.value}))} />
                    </div>

                    <h3 className="font-semibold text-lg mt-8">Card Features</h3>
                    <div className="space-y-4">
                        {template.features.map(feature => (
                            <div key={feature.id} className="flex items-center gap-2 p-2 border rounded-md">
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                                <div className="flex-grow grid grid-cols-2 gap-2">
                                    <Input placeholder="Label" value={feature.label} onChange={(e) => handleFeatureChange(feature.id, 'label', e.target.value)} />
                                    <Select value={feature.key} onValueChange={(value) => handleFeatureChange(feature.id, 'key', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select key" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {featureKeyOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveFeature(feature.id)} className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </div>
                        ))}
                        <Button variant="outline" onClick={handleAddFeature}>
                            <Plus className="mr-2 h-4 w-4" /> Add Feature
                        </Button>
                    </div>
                </div>

                {/* Live Preview */}
                <div>
                     <h3 className="font-semibold text-lg mb-4">Live Preview</h3>
                     {template.id === 'default' ? renderDefaultPreview() : renderGreenPlussPreview()}
                </div>
            </CardContent>
        </Card>
     );
}


export default function AdminInvestmentTemplatePage() {
    const { toast } = useToast();
    const [templates, setTemplates] = useState<InvestmentTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTemplates = async () => {
            if (!db) { setLoading(false); return; }
            try {
                const docRef = doc(db, 'settings', 'investmentTemplates');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().templates) {
                    const savedTemplates = docSnap.data().templates as InvestmentTemplate[];
                    const templateMap = new Map(savedTemplates.map(t => [t.id, t]));
                    const mergedTemplates = initialTemplates.map(it => templateMap.has(it.id) ? { ...it, ...templateMap.get(it.id)! } : it);
                    setTemplates(mergedTemplates);
                } else {
                    await setDoc(docRef, { templates: initialTemplates });
                    setTemplates(initialTemplates);
                }
            } catch (error) {
                console.error("Error fetching templates: ", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch templates.' });
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, [toast]);

    const handleSaveTemplate = async (updatedTemplate: InvestmentTemplate) => {
        if (!db) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore is not initialized.' });
            return;
        }
        try {
            const updatedTemplates = templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t);
            await setDoc(doc(db, 'settings', 'investmentTemplates'), { templates: updatedTemplates });
            setTemplates(updatedTemplates);
            toast({ title: 'Success', description: `Template '${updatedTemplate.name}' saved successfully.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save template: ${error.message}` });
        }
    };

    const handleSetActive = async (templateId: string) => {
         if (!db) return;
        try {
            const updatedTemplates = templates.map(t => ({ ...t, active: t.id === templateId }));
            await setDoc(doc(db, 'settings', 'investmentTemplates'), { templates: updatedTemplates });
            setTemplates(updatedTemplates);
            toast({ title: 'Success', description: `Template set as active.` });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to set active template: ${error.message}` });
        }
    };
    
    const handleAddNewTemplate = () => {
        toast({ title: 'Coming Soon', description: 'Adding new templates will be enabled in a future update.' });
    }

    if (loading) {
        return <AdminLayout><div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div></AdminLayout>;
    }

    return (
        <AdminLayout>
            <div className="flex flex-col gap-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Investment Plan Templates</h1>
                        <p className="text-muted-foreground">Customize the appearance of the investment plan cards.</p>
                    </div>
                     <Button onClick={handleAddNewTemplate}>
                        <Plus className="mr-2 h-4 w-4" /> Add New Template
                    </Button>
                </div>
                
                 <Accordion type="single" collapsible className="w-full space-y-2">
                    {templates.map(template => (
                         <AccordionItem value={template.id} key={template.id} className="border-none rounded-lg bg-card/50">
                            <div className="flex items-center pr-4">
                                <AccordionTrigger className="p-4 hover:no-underline flex-1">
                                    <div className="flex items-center gap-4 flex-1">
                                        <Settings2 className="h-5 w-5 text-primary shrink-0"/>
                                        <span className="text-lg font-semibold">{template.name}</span>
                                    </div>
                                </AccordionTrigger>
                                <div className="flex items-center gap-4 ml-auto pl-4">
                                    {template.active ? (
                                        <div className="flex items-center gap-2 text-green-500 font-medium">
                                            <CheckCircle className="h-5 w-5" /> Active
                                        </div>
                                    ) : (
                                        <Button variant="outline" size="sm" onClick={() => handleSetActive(template.id)}>
                                            Set as Active
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <AccordionContent className="p-6 bg-card rounded-b-lg border-t border-border">
                                <TemplateEditor template={template} onSave={handleSaveTemplate} />
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </AdminLayout>
    );
}
