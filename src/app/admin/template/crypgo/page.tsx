
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';

interface SubMenuItem {
    id: string;
    label: string;
    href: string;
    icon?: string;
}

interface HeaderMenuItem {
    id:string;
    label: string;
    href: string;
    icon?: string;
    subItems?: SubMenuItem[];
}

interface TemplateData {
  headerLogoText: string;
  showLogoTextWithImage: boolean;
  logoWidth?: number;
  logoHeight?: number;
  headerMenuItems: HeaderMenuItem[];
  loginTitle: string;
  loginSubtitle: string;
  signupTitle: string;
  signupSubtitle: string;
  logoUrl: string;
  showProfilePage: boolean;
  profilePictures: string[];
  assignRandomProfilePicture: boolean;
  tawkToScript: string;
}

const initialData: Omit<TemplateData, 'heroTitle' | 'heroSubtitle' | 'heroImageUrls' | 'heroBackgroundImageUrl' | 'heroOverlayColor' | 'heroShowCarouselArrows' | 'heroCarouselSpeed' | 'heroSliderWidth' | 'heroSliderHeight' | 'partnersTitle' | 'partnersLogoUrls' | 'featuredPlansSubtitle' | 'featuredPlansTitle' | 'featuresSectionSubtitle' | 'featuresSectionTitle' | 'featuresList' | 'featuresImageUrl' | 'stats' | 'multiOptionSubtitle' | 'multiOptionTitle' | 'multiOptionImageUrl' | 'planningTitle' | 'planningDescription' | 'refinementTitle' | 'refinementDescription' | 'prototypeTitle' | 'prototypeDescription' | 'scaleTitle' | 'scaleDescription' | 'benefitsSubtitle' | 'benefitsTitle' | 'benefitsDescription' | 'benefits' | 'upgradeSubtitle' | 'upgradeTitle' | 'upgradeDescription' | 'upgradeFeatures' | 'upgradeImageUrl' | 'portfolioSectionSubtitle' | 'portfolioSectionTitle' | 'portfolioSectionDescription' | 'portfolioImageUrl' | 'portfolioFeatures' | 'faqSubtitle' | 'faqTitle' | 'faqDescription' | 'faqs' | 'ctaTitle' | 'ctaSubtitle' | 'blogTitle' | 'blogSubtitle' | 'cryptoSectionSubtitle' | 'cryptoSectionTitle' | 'cryptoCoins' | 'showHero' | 'showPartners' | 'showFeaturedPlans' | 'showFeatures' | 'showStats' | 'showMultiOption' | 'showPortfolio' | 'showUpgrade' | 'showBenefits' | 'showFaqs' | 'showCta' | 'showBlog' | 'showCryptoCoins'> = {
  headerLogoText: 'Finva',
  showLogoTextWithImage: true,
  headerMenuItems: [],
  loginTitle: 'Welcome Back',
  loginSubtitle: 'Enter your credentials to access your account.',
  signupTitle: 'Create an Account',
  signupSubtitle: 'Start your journey to financial wisdom today.',
  logoUrl: '',
  showProfilePage: true,
  profilePictures: [],
  assignRandomProfilePicture: true,
  tawkToScript: '',
};

export default function TemplateSettingsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<TemplateData>(initialData as TemplateData);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'template', 'landingPage');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fetchedData = docSnap.data() as Partial<TemplateData>;
          const mergedData = { ...initialData, ...fetchedData,
              profilePictures: fetchedData.profilePictures || initialData.profilePictures,
              headerMenuItems: fetchedData.headerMenuItems || initialData.headerMenuItems,
          };
          setData(mergedData as TemplateData);
        } else {
          await setDoc(docRef, initialData);
        }
      } catch (error) {
        console.error('Error fetching template settings:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch template settings.',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };
  
    const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setData(prev => ({
          ...prev,
          [name]: value === '' ? undefined : Number(value)
        }));
    };
    
    const handleHeaderMenuItemChange = (index: number, field: keyof Omit<HeaderMenuItem, 'id' | 'subItems'>, value: string) => {
        setData(prev => {
            const newItems = [...prev.headerMenuItems];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, headerMenuItems: newItems };
        });
    };

    const addHeaderMenuItem = () => {
        setData(prev => ({
            ...prev,
            headerMenuItems: [...(prev.headerMenuItems || []), { id: Date.now().toString(), label: '', href: '#', icon: '', subItems: [] }]
        }));
    };

    const removeHeaderMenuItem = (index: number) => {
        setData(prev => ({
            ...prev,
            headerMenuItems: (prev.headerMenuItems || []).filter((_, i) => i !== index)
        }));
    };
    
    const handleSubMenuItemChange = (mainIndex: number, subIndex: number, field: keyof Omit<SubMenuItem, 'id'>, value: string) => {
        setData(prev => {
            const newItems = [...prev.headerMenuItems];
            const newSubItems = [...(newItems[mainIndex].subItems || [])];
            newSubItems[subIndex] = { ...newSubItems[subIndex], [field]: value };
            newItems[mainIndex] = { ...newItems[mainIndex], subItems: newSubItems };
            return { ...prev, headerMenuItems: newItems };
        });
    };

    const addSubMenuItem = (mainIndex: number) => {
        setData(prev => {
            const newItems = [...prev.headerMenuItems];
            const newSubItems = [...(newItems[mainIndex].subItems || []), { id: Date.now().toString(), label: '', href: '', icon: '' }];
            newItems[mainIndex] = { ...newItems[mainIndex], subItems: newSubItems };
            return { ...prev, headerMenuItems: newItems };
        });
    };

    const removeSubMenuItem = (mainIndex: number, subIndex: number) => {
        setData(prev => {
            const newItems = [...prev.headerMenuItems];
            const newSubItems = (newItems[mainIndex].subItems || []).filter((_, i) => i !== subIndex);
            newItems[mainIndex] = { ...newItems[mainIndex], subItems: newSubItems };
            return { ...prev, headerMenuItems: newItems };
        });
    };

    const handleProfilePictureChange = (index: number, value: string) => {
        setData(prev => {
            const newPics = [...(prev.profilePictures || [])];
            newPics[index] = value;
            return { ...prev, profilePictures: newPics };
        });
    };

    const addProfilePicture = () => {
      setData(prev => ({ ...prev, profilePictures: [...(prev.profilePictures || []), '']}));
    };
  
    const removeProfilePicture = (index: number) => {
      setData(prev => ({ ...prev, profilePictures: (prev.profilePictures || []).filter((_, i) => i !== index)}));
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
      await setDoc(doc(db, 'template', 'landingPage'), data, { merge: true });
      toast({
        title: 'Success',
        description: 'Template settings have been saved.',
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
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Edit General Template</h1>
            <p className="text-muted-foreground">Customize the general content of your public-facing site.</p>
          </div>
           <Button type="submit" disabled={saving} size="lg">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
        </div>
        
        <div className="grid gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Template Settings</CardTitle>
                    <CardDescription>Global settings for your template.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="logoUrl">Image Logo URL</Label>
                            <Input id="logoUrl" name="logoUrl" value={data.logoUrl || ''} onChange={handleInputChange} />
                            <p className="text-sm text-muted-foreground">Paste a URL to your hosted logo image. This will override the text logo if enabled.</p>
                        </div>
                         <div className="flex items-center space-x-2 pt-8">
                            <Switch id="showLogoTextWithImage" name="showLogoTextWithImage" checked={data.showLogoTextWithImage} onCheckedChange={(checked) => setData(prev => ({...prev, showLogoTextWithImage: checked}))} />
                            <Label htmlFor="showLogoTextWithImage">Show Logo Text with Image</Label>
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="logoWidth">Logo Width (px)</Label>
                            <Input id="logoWidth" name="logoWidth" type="number" value={data.logoWidth || ''} onChange={handleNumberInputChange} placeholder="e.g. 32" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="logoHeight">Logo Height (px)</Label>
                            <Input id="logoHeight" name="logoHeight" type="number" value={data.logoHeight || ''} onChange={handleNumberInputChange} placeholder="e.g. 32" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Header Navigation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Accordion type="multiple" className="w-full space-y-4">
                        {data.headerMenuItems.map((item, index) => (
                             <AccordionItem value={item.id} key={item.id} className="border rounded-md">
                                <div className="flex items-center gap-2 pr-4">
                                    <AccordionTrigger className="flex-1 p-4 hover:no-underline">{item.label || 'New Menu Item'}</AccordionTrigger>
                                    <Button type="button" variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => removeHeaderMenuItem(index)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                                <AccordionContent className="px-4 pb-4 border-t pt-4">
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                            <Label>Label</Label>
                                            <Input value={item.label} onChange={(e) => handleHeaderMenuItemChange(index, 'label', e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Link</Label>
                                            <Input value={item.href} onChange={(e) => handleHeaderMenuItemChange(index, 'href', e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Icon (Lucide)</Label>
                                            <Input value={item.icon || ''} onChange={(e) => handleHeaderMenuItemChange(index, 'icon', e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t">
                                        <h4 className="font-semibold mb-2">Sub-menu Items</h4>
                                        <div className="space-y-2">
                                        {(item.subItems || []).map((sub, subIndex) => (
                                            <div key={sub.id} className="flex items-end gap-2">
                                                <div className="grid grid-cols-3 gap-2 flex-grow">
                                                     <div className="space-y-1">
                                                        <Label>Label</Label>
                                                        <Input value={sub.label} onChange={(e) => handleSubMenuItemChange(index, subIndex, 'label', e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Link</Label>
                                                        <Input value={sub.href} onChange={(e) => handleSubMenuItemChange(index, subIndex, 'href', e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Icon</Label>
                                                        <Input value={sub.icon || ''} onChange={(e) => handleSubMenuItemChange(index, subIndex, 'icon', e.target.value)} />
                                                    </div>
                                                </div>
                                                <Button type="button" variant="destructive" size="icon" onClick={() => removeSubMenuItem(index, subIndex)}><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                        ))}
                                        </div>
                                        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => addSubMenuItem(index)}><Plus className="mr-2 h-4 w-4"/>Add Sub Item</Button>
                                    </div>
                                </AccordionContent>
                             </AccordionItem>
                        ))}
                    </Accordion>
                    <Button type="button" variant="outline" onClick={addHeaderMenuItem}><Plus className="mr-2 h-4 w-4" /> Add Menu Item</Button>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Auth Page Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label htmlFor="loginTitle">Login Title</Label>
                           <Input id="loginTitle" name="loginTitle" value={data.loginTitle} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                           <Label htmlFor="loginSubtitle">Login Subtitle</Label>
                           <Input id="loginSubtitle" name="loginSubtitle" value={data.loginSubtitle} onChange={handleInputChange} />
                        </div>
                     </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label htmlFor="signupTitle">Sign Up Title</Label>
                           <Input id="signupTitle" name="signupTitle" value={data.signupTitle} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                           <Label htmlFor="signupSubtitle">Sign Up Subtitle</Label>
                           <Input id="signupSubtitle" name="signupSubtitle" value={data.signupSubtitle} onChange={handleInputChange} />
                        </div>
                     </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Profile Page Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex items-center justify-between p-4 border rounded-lg">
                        <Label>Show Profile Page to Users</Label>
                        <Switch checked={data.showProfilePage} onCheckedChange={(checked) => setData(prev => ({ ...prev, showProfilePage: checked }))} />
                    </div>
                     <div className="flex items-center justify-between p-4 border rounded-lg">
                        <Label>Assign Random Profile Picture on Signup</Label>
                        <Switch checked={data.assignRandomProfilePicture} onCheckedChange={(checked) => setData(prev => ({ ...prev, assignRandomProfilePicture: checked }))} />
                    </div>
                    <div className="space-y-4">
                        <Label>Available Profile Pictures</Label>
                        {data.profilePictures.map((pic, index) => (
                             <div key={index} className="flex items-center gap-2">
                                <Input value={pic} onChange={(e) => handleProfilePictureChange(index, e.target.value)} placeholder="Image URL" />
                                <Button type="button" variant="destructive" size="icon" onClick={() => removeProfilePicture(index)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addProfilePicture}><Plus className="mr-2 h-4 w-4"/> Add Picture</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Live Chat (Tawk.to)</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label htmlFor="tawkToScript">Tawk.to Live Chat Script</Label>
                        <Textarea
                            id="tawkToScript"
                            name="tawkToScript"
                            value={data.tawkToScript || ''}
                            onChange={handleInputChange}
                            rows={10}
                            placeholder="Paste your Tawk.to script here..."
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
      </form>
    </AdminLayout>
  );
}
