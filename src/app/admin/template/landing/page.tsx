

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import TradingViewWidget from '@/components/ui/trading-view-widget';

interface FeatureListData {
    title: string;
}

interface StatData {
    value: string;
    label: string;
}

interface PortfolioFeatureData {
    title: string;
}

interface BenefitData {
    title: string;
    description: string;
}

interface UpgradeFeatureData {
    title: string;
}

interface FaqData {
    question: string;
    answer: string;
}

interface CryptoCoin {
    name: string;
    price: string;
    category: string;
    icon: string;
}

// New interface for custom HTML sections
interface CustomHtmlSection {
    id: string;
    name: string;
    html: string;
}

interface TemplateData {
  sectionOrder: string[];
  showHero: boolean;
  showPartners: boolean;
  showFeaturedPlans: boolean;
  showFeatures: boolean;
  showStats: boolean;
  showMultiOption: boolean;
  showPortfolio: boolean;
  showUpgrade: boolean;
  showBenefits: boolean;
  showFaqs: boolean;
  showCta: boolean;
  showBlog: boolean;
  showCryptoCoins: boolean;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrls: string[];
  heroBackgroundImageUrl: string;
  heroOverlayColor: string;
  heroShowCarouselArrows: boolean;
  heroCarouselSpeed: number;
  heroSliderWidth?: number;
  heroSliderHeight?: number;
  partnersTitle: string;
  partnersLogoUrls: string[];
  featuredPlansSubtitle: string;
  featuredPlansTitle: string;
  featuresSectionSubtitle: string;
  featuresSectionTitle: string;
  featuresList: FeatureListData[];
  featuresImageUrl: string;
  stats: StatData[];
  multiOptionSubtitle: string;
  multiOptionTitle: string;
  multiOptionImageUrl: string;
  planningTitle: string;
  planningDescription: string;
  refinementTitle: string;
  refinementDescription: string;
  prototypeTitle: string;
  prototypeDescription: string;
  scaleTitle: string;
  scaleDescription: string;
  benefitsSubtitle: string;
  benefitsTitle: string;
  benefitsDescription: string;
  benefits: BenefitData[];
  upgradeSubtitle: string;
  upgradeTitle: string;
  upgradeDescription: string;
  upgradeFeatures: UpgradeFeatureData[];
  upgradeImageUrl: string;
  portfolioSectionSubtitle: string;
  portfolioSectionTitle: string;
  portfolioSectionDescription: string;
  portfolioImageUrl: string;
  portfolioFeatures: PortfolioFeatureData[];
  faqSubtitle: string;
  faqTitle: string;
  faqDescription: string;
  faqs: FaqData[];
  ctaTitle: string;
  ctaSubtitle: string;
  blogTitle: string;
  blogSubtitle: string;
  blogPageTitle: string;
  blogPageDescription: string;
  cryptoSectionSubtitle: string;
  cryptoSectionTitle: string;
  cryptoCoins: CryptoCoin[];
  customHtmlSections?: CustomHtmlSection[]; // Added this
}

const initialData: Omit<TemplateData, 'themeColors' | 'loginTitle' | 'loginSubtitle' | 'signupTitle' | 'signupSubtitle' | 'logoUrl' | 'showProfilePage' | 'profilePictures' | 'assignRandomProfilePicture' | 'mobileFooterNav' | 'aboutPage' | 'supportPage' | 'tawkToScript'> = {
  sectionOrder: ['hero', 'partners', 'cryptoCoins', 'featuredPlans', 'features', 'stats', 'multiOption', 'portfolio', 'upgrade', 'benefits', 'faqs', 'cta'],
  showHero: true,
  showPartners: true,
  showFeaturedPlans: true,
  showFeatures: true,
  showStats: true,
  showMultiOption: true,
  showPortfolio: true,
  showUpgrade: true,
  showBenefits: true,
  showFaqs: true,
  showCta: true,
  showBlog: false,
  showCryptoCoins: true,
  cryptoSectionSubtitle: "Featured crypto coins",
  cryptoSectionTitle: "Top crypto coins updates",
  cryptoCoins: [],
  blogTitle: 'From Our Blog',
  blogSubtitle: 'Latest news and insights from our team.',
  blogPageTitle: 'Our Blog',
  blogPageDescription: 'Stay up-to-date with the latest news, guides, and insights from our team of experts.',
  heroTitle: 'Build Your Future with Smart Investments',
  heroSubtitle: 'A modern trading platform to grow your wealth securely and confidently.',
  heroImageUrls: [],
  heroBackgroundImageUrl: '',
  heroOverlayColor: 'rgba(0, 0, 0, 0.5)',
  heroShowCarouselArrows: true,
  heroCarouselSpeed: 5000,
  partnersTitle: 'Trusted by top financial platforms',
  partnersLogoUrls: [],
  featuredPlansSubtitle: 'Our Top Plans',
  featuredPlansTitle: 'Explore Our Featured Investment Plans',
  featuresSectionSubtitle: 'Why Choose Us',
  featuresSectionTitle: 'Unlock Your Financial Potential with Our Tools',
  featuresList: [],
  featuresImageUrl: '',
  stats: [],
  multiOptionSubtitle: 'Our Process',
  multiOptionTitle: 'A Streamlined Journey to Your Financial Goals',
  multiOptionImageUrl: '',
  planningTitle: 'Discovery',
  planningDescription: 'Understand your financial goals and risk tolerance.',
  refinementTitle: 'Strategy',
  refinementDescription: 'Develop a personalized investment strategy for you.',
  prototypeTitle: 'Execution',
  prototypeDescription: 'Implement your strategy with our powerful tools.',
  scaleTitle: 'Monitoring',
  scaleDescription: 'Continuously monitor and adjust your portfolio for success.',
  benefitsSubtitle: 'Always by your side',
  benefitsTitle: 'The Benefits of Investing With Us',
  benefitsDescription: 'Get expert guidance and powerful tools to achieve your financial dreams.',
  benefits: [],
  upgradeSubtitle: 'Our Commitment',
  upgradeTitle: 'A Secure & Reliable Investment Platform',
  upgradeDescription: 'We are committed to providing a secure, reliable, and user-friendly platform for all your investment needs.',
  upgradeFeatures: [],
  upgradeImageUrl: '',
  portfolioSectionSubtitle: 'Your Portfolio',
  portfolioSectionTitle: 'Take Control of Your Financial Future',
  portfolioSectionDescription: 'Our platform gives you the tools to manage your portfolio effectively.',
  portfolioImageUrl: '',
  portfolioFeatures: [],
  faqSubtitle: 'Popular questions',
  faqTitle: 'Frequently Asked Questions',
  faqDescription: 'Find answers to common questions about our platform and services.',
  faqs: [],
  ctaTitle: 'Ready to Start Your Investment Journey?',
  ctaSubtitle: 'Create an account today and take the first step towards a brighter financial future.',
  customHtmlSections: [], // Added this
};

export default function LandingPageSettingsPage() {
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
          
          const defaultOrder = initialData.sectionOrder;
          // Add keys from custom HTML sections to the default order if they exist
          const customHtmlKeys = (fetchedData.customHtmlSections || []).map(s => s.id);
          const extendedDefaultOrder = [...defaultOrder, ...customHtmlKeys];

          const savedOrder = (fetchedData.sectionOrder || []).filter(key => key !== 'blog');
          const combinedOrder = [ ...new Set([...savedOrder, ...extendedDefaultOrder])];

          // Filter out any keys that are no longer valid
          const finalOrder = combinedOrder.filter(key => extendedDefaultOrder.includes(key));
          
          const mergedData = { 
              ...initialData, 
              ...fetchedData,
              showBlog: false,
              sectionOrder: finalOrder,
              heroImageUrls: fetchedData.heroImageUrls || initialData.heroImageUrls,
              partnersLogoUrls: fetchedData.partnersLogoUrls || initialData.partnersLogoUrls,
              featuresList: fetchedData.featuresList || initialData.featuresList,
              stats: fetchedData.stats || initialData.stats,
              benefits: fetchedData.benefits || initialData.benefits,
              upgradeFeatures: fetchedData.upgradeFeatures || initialData.upgradeFeatures,
              portfolioFeatures: fetchedData.portfolioFeatures || initialData.portfolioFeatures,
              faqs: fetchedData.faqs || initialData.faqs,
              cryptoCoins: fetchedData.cryptoCoins || initialData.cryptoCoins,
              customHtmlSections: fetchedData.customHtmlSections || initialData.customHtmlSections,
          };
          setData(mergedData as TemplateData);
        } else {
          await setDoc(docRef, initialData);
          setData(initialData as TemplateData);
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

  const handleSectionOrderChange = (index: number, direction: 'up' | 'down') => {
      setData(prev => {
          const newOrder = [...prev.sectionOrder];
          const newIndex = direction === 'up' ? index - 1 : index + 1;
          if (newIndex >= 0 && newIndex < newOrder.length) {
              [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
          }
          return { ...prev, sectionOrder: newOrder };
      });
  };

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

  const handleHeroImageUrlChange = (index: number, value: string) => {
    setData(prev => {
        const newUrls = [...prev.heroImageUrls];
        newUrls[index] = value;
        return { ...prev, heroImageUrls: newUrls };
    });
  };

  const addHeroImageUrl = () => setData(prev => ({ ...prev, heroImageUrls: [...(prev.heroImageUrls || []), ''] }));
  
  const removeHeroImageUrl = (index: number) => setData(prev => ({ ...prev, heroImageUrls: (prev.heroImageUrls || []).filter((_, i) => i !== index) }));

  const handlePartnerLogoChange = (index: number, value: string) => {
    setData(prev => {
        const newLogoUrls = [...prev.partnersLogoUrls];
        newLogoUrls[index] = value;
        return { ...prev, partnersLogoUrls: newLogoUrls };
    });
  };

  const addPartnerLogo = () => setData(prev => ({ ...prev, partnersLogoUrls: [...(prev.partnersLogoUrls || []), ''] }));
  const removePartnerLogo = (index: number) => setData(prev => ({ ...prev, partnersLogoUrls: prev.partnersLogoUrls.filter((_, i) => i !== index) }));

  const handleFeatureListChange = (index: number, value: string) => {
        setData(prev => {
            const newFeaturesList = [...prev.featuresList];
            newFeaturesList[index] = { title: value };
            return { ...prev, featuresList: newFeaturesList };
        });
    }

    const addFeatureListItem = () => setData(prev => ({...prev, featuresList: [...(prev.featuresList || []), {title: ''}]}));
    const removeFeatureListItem = (index: number) => setData(prev => ({ ...prev, featuresList: prev.featuresList.filter((_, i) => i !== index) }));

    const handleStatChange = (index: number, field: keyof StatData, value: string) => {
        setData(prev => {
            const newStats = [...prev.stats];
            newStats[index] = { ...newStats[index], [field]: value };
            return { ...prev, stats: newStats };
        });
    }

    const addStat = () => setData(prev => ({...prev, stats: [...(prev.stats || []), {value: '', label: ''}]}));
    const removeStat = (index: number) => setData(prev => ({ ...prev, stats: prev.stats.filter((_, i) => i !== index) }));
    
    const handleBenefitChange = (index: number, field: keyof BenefitData, value: string) => {
        setData(prev => {
            const newBenefits = [...prev.benefits];
            newBenefits[index] = { ...newBenefits[index], [field]: value };
            return { ...prev, benefits: newBenefits };
        });
    }

    const addBenefit = () => setData(prev => ({...prev, benefits: [...(prev.benefits || []), {title: '', description: ''}]}));
    const removeBenefit = (index: number) => setData(prev => ({ ...prev, benefits: prev.benefits.filter((_, i) => i !== index) }));

    const handleUpgradeFeatureChange = (index: number, value: string) => {
        setData(prev => {
            const newUpgradeFeatures = [...prev.upgradeFeatures];
            newUpgradeFeatures[index] = { title: value };
            return { ...prev, upgradeFeatures: newUpgradeFeatures };
        });
    }

    const addUpgradeFeature = () => setData(prev => ({...prev, upgradeFeatures: [...(prev.upgradeFeatures || []), {title: ''}]}));
    const removeUpgradeFeature = (index: number) => setData(prev => ({ ...prev, upgradeFeatures: prev.upgradeFeatures.filter((_, i) => i !== index) }));
    
    const handlePortfolioFeatureChange = (index: number, value: string) => {
        setData(prev => {
            const newPortfolioFeatures = [...prev.portfolioFeatures];
            newPortfolioFeatures[index] = { title: value };
            return { ...prev, portfolioFeatures: newPortfolioFeatures };
        });
    }

    const addPortfolioFeature = () => setData(prev => ({...prev, portfolioFeatures: [...(prev.portfolioFeatures || []), {title: ''}]}));
    const removePortfolioFeature = (index: number) => setData(prev => ({...prev, portfolioFeatures: prev.portfolioFeatures.filter((_, i) => i !== index) }));
    
    const handleFaqChange = (index: number, field: keyof FaqData, value: string) => {
        setData(prev => {
            const newFaqs = [...prev.faqs];
            newFaqs[index] = { ...newFaqs[index], [field]: value };
            return { ...prev, faqs: newFaqs };
        });
    }
    
    const addFaq = () => setData(prev => ({...prev, faqs: [...(prev.faqs || []), {question: '', answer: ''}]}));
    const removeFaq = (index: number) => setData(prev => ({ ...prev, faqs: prev.faqs.filter((_, i) => i !== index) }));
    
    const handleCoinChange = (index: number, field: keyof CryptoCoin, value: string) => {
        setData(prev => {
            const newCoins = [...prev.cryptoCoins];
            newCoins[index] = { ...newCoins[index], [field]: value };
            return { ...prev, cryptoCoins: newCoins };
        });
    };

    const addCoin = () => setData(prev => ({...prev, cryptoCoins: [...(prev.cryptoCoins || []), {name: '', price: '', category: '', icon: ''}]}));
    const removeCoin = (index: number) => setData(prev => ({ ...prev, cryptoCoins: prev.cryptoCoins.filter((_, i) => i !== index) }));

  const addCustomHtmlSection = () => {
    setData(prev => {
        const newId = `html_${Date.now()}`;
        const newSection: CustomHtmlSection = {
            id: newId,
            name: 'New HTML Section',
            html: '<div>Your HTML code here</div>'
        };
        return {
            ...prev,
            customHtmlSections: [...(prev.customHtmlSections || []), newSection],
            sectionOrder: [...prev.sectionOrder, newId], // Add to order
        }
    });
  };

  const removeCustomHtmlSection = (id: string) => {
      setData(prev => ({
          ...prev,
          customHtmlSections: (prev.customHtmlSections || []).filter(s => s.id !== id),
          sectionOrder: prev.sectionOrder.filter(key => key !== id), // Remove from order
      }))
  };

  const handleCustomHtmlChange = (id: string, field: 'name' | 'html', value: string) => {
      setData(prev => ({
          ...prev,
          customHtmlSections: (prev.customHtmlSections || []).map(s => s.id === id ? {...s, [field]: value} : s)
      }));
  }

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
  
    const sectionComponents: Record<string, { title: string, content: React.ReactNode }> = {
    hero: {
      title: 'Hero Section',
      content: (
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="heroTitle">Title</Label>
            <Input id="heroTitle" name="heroTitle" value={data.heroTitle} onChange={handleInputChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heroSubtitle">Subtitle</Label>
            <Textarea id="heroSubtitle" name="heroSubtitle" value={data.heroSubtitle} onChange={handleInputChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heroBackgroundImageUrl">Background Image URL</Label>
            <Input id="heroBackgroundImageUrl" name="heroBackgroundImageUrl" value={data.heroBackgroundImageUrl} onChange={handleInputChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heroOverlayColor">Background Overlay Color</Label>
            <Input id="heroOverlayColor" name="heroOverlayColor" value={data.heroOverlayColor} onChange={handleInputChange} placeholder="e.g., rgba(0, 0, 0, 0.5)"/>
          </div>
          <div className="space-y-4">
            <Label>Hero Carousel Images</Label>
            {data.heroImageUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input value={url} onChange={(e) => handleHeroImageUrlChange(index, e.target.value)} placeholder="Image URL"/>
                <Button type="button" variant="destructive" size="icon" onClick={() => removeHeroImageUrl(index)}><Trash2 className="h-4 w-4"/></Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addHeroImageUrl}><Plus className="mr-2 h-4 w-4"/> Add Image</Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="heroSliderWidth">Slider Width (px)</Label>
              <Input id="heroSliderWidth" name="heroSliderWidth" type="number" value={data.heroSliderWidth || ''} onChange={handleNumberInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="heroSliderHeight">Slider Height (px)</Label>
              <Input id="heroSliderHeight" name="heroSliderHeight" type="number" value={data.heroSliderHeight || ''} onChange={handleNumberInputChange} />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="heroShowCarouselArrows" name="heroShowCarouselArrows" checked={data.heroShowCarouselArrows} onCheckedChange={(checked) => setData(prev => ({...prev, heroShowCarouselArrows: checked}))} />
            <Label htmlFor="heroShowCarouselArrows">Show Carousel Arrows</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="heroCarouselSpeed">Carousel Autoplay Speed (ms)</Label>
            <Input id="heroCarouselSpeed" name="heroCarouselSpeed" type="number" value={data.heroCarouselSpeed} onChange={handleNumberInputChange} />
          </div>
        </div>
      ),
    },
    partners: {
      title: 'Partners Section',
      content: (
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="partnersTitle">Title</Label>
            <Input id="partnersTitle" name="partnersTitle" value={data.partnersTitle} onChange={handleInputChange} />
          </div>
          <div className="space-y-4">
            <Label>Partner Logo URLs</Label>
            {data.partnersLogoUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input value={url} onChange={(e) => handlePartnerLogoChange(index, e.target.value)} placeholder="Logo URL"/>
                <Button type="button" variant="destructive" size="icon" onClick={() => removePartnerLogo(index)}><Trash2 className="h-4 w-4"/></Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addPartnerLogo}><Plus className="mr-2 h-4 w-4"/> Add Logo</Button>
          </div>
        </div>
      ),
    },
    featuredPlans: {
        title: 'Featured Plans Section',
        content: (
             <div className="p-6 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="featuredPlansSubtitle">Subtitle</Label>
                    <Input id="featuredPlansSubtitle" name="featuredPlansSubtitle" value={data.featuredPlansSubtitle} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="featuredPlansTitle">Title</Label>
                    <Input id="featuredPlansTitle" name="featuredPlansTitle" value={data.featuredPlansTitle} onChange={handleInputChange} />
                </div>
            </div>
        )
    },
    features: {
        title: "Features Section",
        content: (
             <div className="p-6 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="featuresSectionSubtitle">Subtitle</Label>
                    <Input id="featuresSectionSubtitle" name="featuresSectionSubtitle" value={data.featuresSectionSubtitle} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="featuresSectionTitle">Title</Label>
                    <Input id="featuresSectionTitle" name="featuresSectionTitle" value={data.featuresSectionTitle} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="featuresImageUrl">Image URL</Label>
                    <Input id="featuresImageUrl" name="featuresImageUrl" value={data.featuresImageUrl} onChange={handleInputChange} />
                </div>
                <div className="space-y-4">
                    <Label>Feature List</Label>
                    {data.featuresList.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Input value={item.title} onChange={(e) => handleFeatureListChange(index, e.target.value)} placeholder={`Feature ${index + 1}`}/>
                            <Button type="button" variant="destructive" size="icon" onClick={() => removeFeatureListItem(index)}><Trash2 className="h-4 w-4"/></Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addFeatureListItem}><Plus className="mr-2 h-4 w-4"/> Add Feature</Button>
                </div>
            </div>
        )
    },
    stats: {
        title: "Stats Section",
        content: (
            <div className="p-6 space-y-4">
                {data.stats.map((stat, index) => (
                    <div key={index} className="grid grid-cols-3 gap-2 items-center">
                        <Input value={stat.value} onChange={e => handleStatChange(index, 'value', e.target.value)} placeholder="e.g. 10K+"/>
                        <Input value={stat.label} onChange={e => handleStatChange(index, 'label', e.target.value)} placeholder="e.g. Active Investors" className="col-span-2"/>
                        <Button type="button" variant="destructive" size="icon" onClick={() => removeStat(index)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                ))}
                <Button type="button" variant="outline" onClick={addStat}><Plus className="mr-2 h-4 w-4"/> Add Stat</Button>
            </div>
        )
    },
    multiOption: {
        title: '"Our Process" Section',
        content: (
            <div className="p-6 space-y-4">
                <div className="space-y-2">
                    <Label>Subtitle</Label>
                    <Input name="multiOptionSubtitle" value={data.multiOptionSubtitle} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>Title</Label>
                    <Input name="multiOptionTitle" value={data.multiOptionTitle} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>Image URL</Label>
                    <Input name="multiOptionImageUrl" value={data.multiOptionImageUrl} onChange={handleInputChange} />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 p-2 border rounded-md">
                        <Label>Item 1 Title</Label>
                        <Input name="planningTitle" value={data.planningTitle} onChange={handleInputChange} />
                        <Label>Item 1 Description</Label>
                        <Textarea name="planningDescription" value={data.planningDescription} onChange={handleInputChange} />
                    </div>
                     <div className="space-y-2 p-2 border rounded-md">
                        <Label>Item 2 Title</Label>
                        <Input name="refinementTitle" value={data.refinementTitle} onChange={handleInputChange} />
                        <Label>Item 2 Description</Label>
                        <Textarea name="refinementDescription" value={data.refinementDescription} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2 p-2 border rounded-md">
                        <Label>Item 3 Title</Label>
                        <Input name="prototypeTitle" value={data.prototypeTitle} onChange={handleInputChange} />
                        <Label>Item 3 Description</Label>
                        <Textarea name="prototypeDescription" value={data.prototypeDescription} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2 p-2 border rounded-md">
                        <Label>Item 4 Title</Label>
                        <Input name="scaleTitle" value={data.scaleTitle} onChange={handleInputChange} />
                        <Label>Item 4 Description</Label>
                        <Textarea name="scaleDescription" value={data.scaleDescription} onChange={handleInputChange} />
                    </div>
                </div>
            </div>
        )
    },
    benefits: {
        title: "Benefits Section",
        content: (
            <div className="p-6 space-y-4">
                <Input name="benefitsSubtitle" value={data.benefitsSubtitle} onChange={handleInputChange} placeholder="Subtitle" />
                <Input name="benefitsTitle" value={data.benefitsTitle} onChange={handleInputChange} placeholder="Title" />
                <Textarea name="benefitsDescription" value={data.benefitsDescription} onChange={handleInputChange} placeholder="Description" />
                {data.benefits.map((benefit, index) => (
                    <div key={index} className="grid grid-cols-3 gap-2 items-center">
                        <Input value={benefit.title} onChange={e => handleBenefitChange(index, 'title', e.target.value)} placeholder="Title"/>
                        <Textarea value={benefit.description} onChange={e => handleBenefitChange(index, 'description', e.target.value)} placeholder="Description" className="col-span-2"/>
                        <Button type="button" variant="destructive" size="icon" onClick={() => removeBenefit(index)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                ))}
                <Button type="button" variant="outline" onClick={addBenefit}><Plus className="mr-2 h-4 w-4"/> Add Benefit</Button>
            </div>
        )
    },
    upgrade: {
        title: "Security/Upgrade Section",
        content: (
            <div className="p-6 space-y-4">
                <Input name="upgradeSubtitle" value={data.upgradeSubtitle} onChange={handleInputChange} placeholder="Subtitle" />
                <Input name="upgradeTitle" value={data.upgradeTitle} onChange={handleInputChange} placeholder="Title" />
                <Textarea name="upgradeDescription" value={data.upgradeDescription} onChange={handleInputChange} placeholder="Description" />
                <Input name="upgradeImageUrl" value={data.upgradeImageUrl} onChange={handleInputChange} placeholder="Image URL" />
                 {data.upgradeFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <Input value={feature.title} onChange={e => handleUpgradeFeatureChange(index, e.target.value)} placeholder={`Feature ${index + 1}`}/>
                        <Button type="button" variant="destructive" size="icon" onClick={() => removeUpgradeFeature(index)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                ))}
                <Button type="button" variant="outline" onClick={addUpgradeFeature}><Plus className="mr-2 h-4 w-4"/> Add Feature</Button>
           </div>
        )
    },
    portfolio: {
        title: "Portfolio Section",
        content: (
             <div className="p-6 space-y-4">
                <Input name="portfolioSectionSubtitle" value={data.portfolioSectionSubtitle} onChange={handleInputChange} placeholder="Subtitle" />
                <Input name="portfolioSectionTitle" value={data.portfolioSectionTitle} onChange={handleInputChange} placeholder="Title" />
                <Textarea name="portfolioSectionDescription" value={data.portfolioSectionDescription} onChange={handleInputChange} placeholder="Description" />
                <Input name="portfolioImageUrl" value={data.portfolioImageUrl} onChange={handleInputChange} placeholder="Image URL" />
                 {data.portfolioFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <Input value={feature.title} onChange={e => handlePortfolioFeatureChange(index, e.target.value)} placeholder={`Feature ${index + 1}`}/>
                        <Button type="button" variant="destructive" size="icon" onClick={() => removePortfolioFeature(index)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                ))}
                <Button type="button" variant="outline" onClick={addPortfolioFeature}><Plus className="mr-2 h-4 w-4"/> Add Feature</Button>
            </div>
        )
    },
    faqs: {
        title: "FAQs Section",
        content: (
            <div className="p-6 space-y-4">
                <Input name="faqSubtitle" value={data.faqSubtitle} onChange={handleInputChange} placeholder="Subtitle" />
                <Input name="faqTitle" value={data.faqTitle} onChange={handleInputChange} placeholder="Title" />
                <Textarea name="faqDescription" value={data.faqDescription} onChange={handleInputChange} placeholder="Description" />
                {data.faqs.map((faq, index) => (
                    <div key={index} className="grid grid-cols-1 gap-2 p-2 border rounded-md">
                        <Input value={faq.question} onChange={e => handleFaqChange(index, 'question', e.target.value)} placeholder="Question"/>
                        <Textarea value={faq.answer} onChange={e => handleFaqChange(index, 'answer', e.target.value)} placeholder="Answer"/>
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeFaq(index)}><Trash2 className="mr-2 h-4 w-4"/>Remove FAQ</Button>
                    </div>
                ))}
                <Button type="button" variant="outline" onClick={addFaq}><Plus className="mr-2 h-4 w-4"/> Add FAQ</Button>
            </div>
        )
    },
    cta: {
        title: "CTA Section",
        content: (
            <div className="p-6 space-y-4">
                <div className="space-y-2">
                    <Label>Title</Label>
                    <Input name="ctaTitle" value={data.ctaTitle} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>Subtitle</Label>
                    <Input name="ctaSubtitle" value={data.ctaSubtitle} onChange={handleInputChange} />
                </div>
            </div>
        )
    },
    blog: {
        title: "Blog Section",
        content: (
             <div className="p-6 space-y-4">
                <div className="space-y-2">
                    <Label>Title</Label>
                    <Input name="blogTitle" value={data.blogTitle} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>Subtitle</Label>
                    <Input name="blogSubtitle" value={data.blogSubtitle} onChange={handleInputChange} />
                </div>
            </div>
        )
    },
    cryptoCoins: {
        title: "Crypto Coins Section",
        content: (
             <div className="p-6 space-y-4">
                <div className="space-y-2">
                    <Label>Subtitle</Label>
                    <Input name="cryptoSectionSubtitle" value={data.cryptoSectionSubtitle} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>Title</Label>
                    <Input name="cryptoSectionTitle" value={data.cryptoSectionTitle} onChange={handleInputChange} />
                </div>
                 {data.cryptoCoins.map((coin, index) => (
                    <div key={index} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-center p-2 border rounded-md">
                        <Input value={coin.name} onChange={e => handleCoinChange(index, 'name', e.target.value)} placeholder="Name"/>
                        <Input value={coin.price} onChange={e => handleCoinChange(index, 'price', e.target.value)} placeholder="Price"/>
                        <Input value={coin.category} onChange={e => handleCoinChange(index, 'category', e.target.value)} placeholder="Category"/>
                        <Input value={coin.icon} onChange={e => handleCoinChange(index, 'icon', e.target.value)} placeholder="Icon URL"/>
                        <Button type="button" variant="destructive" size="icon" onClick={() => removeCoin(index)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                ))}
                <Button type="button" variant="outline" onClick={addCoin}><Plus className="mr-2 h-4 w-4"/> Add Coin</Button>
             </div>
        )
    }
  }


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
            <h1 className="text-3xl font-bold font-headline tracking-tight">Edit Landing Page</h1>
            <p className="text-muted-foreground">Customize the content of your public-facing landing page.</p>
          </div>
           <Button type="submit" disabled={saving} size="lg">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
        </div>
        
        <div className="grid gap-8">
            <Accordion type="single" collapsible className="w-full space-y-4" defaultValue="landing-sections">
                <AccordionItem value="landing-sections" className="border rounded-lg">
                    <AccordionTrigger className="px-6 py-4 text-lg font-semibold">Landing Page Sections</AccordionTrigger>
                    <AccordionContent className="px-6 pt-0 space-y-2 border-t">
                       {(data.sectionOrder || []).map((key, index) => {
                           let title = sectionComponents[key]?.title;
                           if (key.startsWith('html_')) {
                               title = data.customHtmlSections?.find(s => s.id === key)?.name || 'Custom HTML';
                           }

                           return (
                               <div key={key} className="flex items-center justify-between p-2 pr-4 border-b">
                                   <div className="flex items-center">
                                        <Switch id={`show-${key}`} name={`show${key.charAt(0).toUpperCase() + key.slice(1)}`} checked={(data as any)[`show${key.charAt(0).toUpperCase() + key.slice(1)}`]} onCheckedChange={(checked) => setData(prev => ({ ...prev, [`show${key.charAt(0).toUpperCase() + key.slice(1)}`]: checked }))}/>
                                        <Label htmlFor={`show-${key}`} className="ml-4 capitalize font-medium">
                                            {title}
                                        </Label>
                                   </div>
                                   <div className="flex items-center gap-1">
                                       <Button type="button" variant="ghost" size="icon" onClick={() => handleSectionOrderChange(index, 'up')} disabled={index === 0}>
                                            <ArrowUp className="h-4 w-4"/>
                                       </Button>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleSectionOrderChange(index, 'down')} disabled={index === data.sectionOrder.length - 1}>
                                            <ArrowDown className="h-4 w-4"/>
                                       </Button>
                                   </div>
                               </div>
                           )
                       })}
                    </AccordionContent>
                </AccordionItem>
                
                {data.sectionOrder.map(key => {
                    if (key.startsWith('html_')) return null; // These are handled in a separate card
                    return (
                        <AccordionItem value={key} key={key} className="border rounded-lg">
                            <AccordionTrigger className="px-6 py-4 text-lg font-semibold">{sectionComponents[key]?.title || 'Section'}</AccordionTrigger>
                            <AccordionContent className="px-6 pt-0 border-t">
                                {sectionComponents[key]?.content}
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}

                <Card>
                    <CardHeader>
                        <CardTitle>Custom HTML Sections</CardTitle>
                        <CardDescription>Add and manage custom HTML snippets or widgets (e.g. TradingView).</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(data.customHtmlSections || []).map(section => (
                            <Card key={section.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <Input value={section.name} onChange={(e) => handleCustomHtmlChange(section.id, 'name', e.target.value)} className="text-lg font-semibold" />
                                        <Button type="button" variant="destructive" size="icon" onClick={() => removeCustomHtmlSection(section.id)}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Textarea value={section.html} onChange={(e) => handleCustomHtmlChange(section.id, 'html', e.target.value)} rows={10} placeholder="Paste your HTML code here..." />
                                    <div>
                                        <Label>Live Preview</Label>
                                        <div className="p-4 border rounded-md min-h-[100px] bg-background">
                                           <TradingViewWidget htmlContent={section.html} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                         <Button type="button" variant="outline" onClick={addCustomHtmlSection}><Plus className="mr-2 h-4 w-4"/> Add Custom HTML Section</Button>
                    </CardContent>
                </Card>
            </Accordion>
        </div>
      </form>
    </AdminLayout>
  );
}
