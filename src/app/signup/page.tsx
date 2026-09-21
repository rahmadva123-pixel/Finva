
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/layout/auth-layout";
import { auth, db, sendVerificationEmailToUser } from "@/lib/firebase";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, writeBatch } from "firebase/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, EyeOff } from "lucide-react";


// Replaced math-based human check with simple checkbox debounce flow

const countries = [
    { value: "AF", label: "Afghanistan" },
    { value: "AX", label: "Åland Islands" },
    { value: "AL", label: "Albania" },
    { value: "DZ", label: "Algeria" },
    { value: "AS", label: "American Samoa" },
    { value: "AD", label: "Andorra" },
    { value: "AO", label: "Angola" },
    { value: "AI", label: "Anguilla" },
    { value: "AQ", label: "Antarctica" },
    { value: "AG", label: "Antigua and Barbuda" },
    { value: "AR", label: "Argentina" },
    { value: "AM", label: "Armenia" },
    { value: "AW", label: "Aruba" },
    { value: "AU", label: "Australia" },
    { value: "AT", label: "Austria" },
    { value: "AZ", label: "Azerbaijan" },
    { value: "BS", label: "Bahamas" },
    { value: "BH", label: "Bahrain" },
    { value: "BD", label: "Bangladesh" },
    { value: "BB", label: "Barbados" },
    { value: "BY", label: "Belarus" },
    { value: "BE", label: "Belgium" },
    { value: "BZ", label: "Belize" },
    { value: "BJ", label: "Benin" },
    { value: "BM", label: "Bermuda" },
    { value: "BT", label: "Bhutan" },
    { value: "BO", label: "Bolivia" },
    { value: "BA", label: "Bosnia and Herzegovina" },
    { value: "BW", label: "Botswana" },
    { value: "BV", label: "Bouvet Island" },
    { value: "BR", label: "Brazil" },
    { value: "IO", label: "British Indian Ocean Territory" },
    { value: "BN", label: "Brunei Darussalam" },
    { value: "BG", label: "Bulgaria" },
    { value: "BF", label: "Burkina Faso" },
    { value: "BI", label: "Burundi" },
    { value: "KH", label: "Cambodia" },
    { value: "CM", label: "Cameroon" },
    { value: "CA", label: "Canada" },
    { value: "CV", label: "Cape Verde" },
    { value: "KY", label: "Cayman Islands" },
    { value: "CF", label: "Central African Republic" },
    { value: "TD", label: "Chad" },
    { value: "CL", label: "Chile" },
    { value: "CN", label: "China" },
    { value: "CX", label: "Christmas Island" },
    { value: "CC", label: "Cocos (Keeling) Islands" },
    { value: "CO", label: "Colombia" },
    { value: "KM", label: "Comoros" },
    { value: "CG", label: "Congo" },
    { value: "CD", label: "Congo, The Democratic Republic of the" },
    { value: "CK", label: "Cook Islands" },
    { value: "CR", label: "Costa Rica" },
    { value: "CI", label: "Cote D'Ivoire" },
    { value: "HR", label: "Croatia" },
    { value: "CU", label: "Cuba" },
    { value: "CY", label: "Cyprus" },
    { value: "CZ", label: "Czech Republic" },
    { value: "DK", label: "Denmark" },
    { value: "DJ", label: "Djibouti" },
    { value: "DM", label: "Dominica" },
    { value: "DO", label: "Dominican Republic" },
    { value: "EC", label: "Ecuador" },
    { value: "EG", label: "Egypt" },
    { value: "SV", label: "El Salvador" },
    { value: "GQ", label: "Equatorial Guinea" },
    { value: "ER", label: "Eritrea" },
    { value: "EE", label: "Estonia" },
    { value: "ET", label: "Ethiopia" },
    { value: "FK", label: "Falkland Islands (Malvinas)" },
    { value: "FO", label: "Faroe Islands" },
    { value: "FJ", label: "Fiji" },
    { value: "FI", label: "Finland" },
    { value: "FR", label: "France" },
    { value: "GF", label: "French Guiana" },
    { value: "PF", label: "French Polynesia" },
    { value: "TF", label: "French Southern Territories" },
    { value: "GA", label: "Gabon" },
    { value: "GM", label: "Gambia" },
    { value: "GE", label: "Georgia" },
    { value: "DE", label: "Germany" },
    { value: "GH", label: "Ghana" },
    { value: "GI", label: "Gibraltar" },
    { value: "GR", label: "Greece" },
    { value: "GL", label: "Greenland" },
    { value: "GD", label: "Grenada" },
    { value: "GP", label: "Guadeloupe" },
    { value: "GU", label: "Guam" },
    { value: "GT", label: "Guatemala" },
    { value: "GG", label: "Guernsey" },
    { value: "GN", label: "Guinea" },
    { value: "GW", label: "Guinea-Bissau" },
    { value: "GY", label: "Guyana" },
    { value: "HT", label: "Haiti" },
    { value: "HM", label: "Heard Island and Mcdonald Islands" },
    { value: "VA", label: "Holy See (Vatican City State)" },
    { value: "HN", label: "Honduras" },
    { value: "HK", label: "Hong Kong" },
    { value: "HU", label: "Hungary" },
    { value: "IS", label: "Iceland" },
    { value: "IN", label: "India" },
    { value: "ID", label: "Indonesia" },
    { value: "IR", label: "Iran, Islamic Republic Of" },
    { value: "IQ", label: "Iraq" },
    { value: "IE", label: "Ireland" },
    { value: "IM", label: "Isle of Man" },
    { value: "IL", label: "Israel" },
    { value: "IT", label: "Italy" },
    { value: "JM", label: "Jamaica" },
    { value: "JP", label: "Japan" },
    { value: "JE", label: "Jersey" },
    { value: "JO", label: "Jordan" },
    { value: "KZ", label: "Kazakhstan" },
    { value: "KE", label: "Kenya" },
    { value: "KI", label: "Kiribati" },
    { value: "KP", label: "Korea, Democratic People'S Republic of" },
    { value: "KR", label: "Korea, Republic of" },
    { value: "KW", label: "Kuwait" },
    { value: "KG", label: "Kyrgyzstan" },
    { value: "LA", label: "Lao People'S Democratic Republic" },
    { value: "LV", label: "Latvia" },
    { value: "LB", label: "Lebanon" },
    { value: "LS", label: "Lesotho" },
    { value: "LR", label: "Liberia" },
    { value: "LY", label: "Libyan Arab Jamahiriya" },
    { value: "LI", label: "Liechtenstein" },
    { value: "LT", label: "Lithuania" },
    { value: "LU", label: "Luxembourg" },
    { value: "MO", label: "Macao" },
    { value: "MK", label: "Macedonia, The Former Yugoslav Republic of" },
    { value: "MG", label: "Madagascar" },
    { value: "MW", label: "Malawi" },
    { value: "MY", label: "Malaysia" },
    { value: "MV", label: "Maldives" },
    { value: "ML", label: "Mali" },
    { value: "MT", label: "Malta" },
    { value: "MH", label: "Marshall Islands" },
    { value: "MQ", label: "Martinique" },
    { value: "MR", label: "Mauritania" },
    { value: "MU", label: "Mauritius" },
    { value: "YT", label: "Mayotte" },
    { value: "MX", label: "Mexico" },
    { value: "FM", label: "Micronesia, Federated States of" },
    { value: "MD", label: "Moldova, Republic of" },
    { value: "MC", label: "Monaco" },
    { value: "MN", label: "Mongolia" },
    { value: "MS", label: "Montserrat" },
    { value: "MA", label: "Morocco" },
    { value: "MZ", label: "Mozambique" },
    { value: "MM", label: "Myanmar" },
    { value: "NA", label: "Namibia" },
    { value: "NR", label: "Nauru" },
    { value: "NP", label: "Nepal" },
    { value: "NL", label: "Netherlands" },
    { value: "AN", label: "Netherlands Antilles" },
    { value: "NC", label: "New Caledonia" },
    { value: "NZ", label: "New Zealand" },
    { value: "NI", label: "Nicaragua" },
    { value: "NE", label: "Niger" },
    { value: "NG", label: "Nigeria" },
    { value: "NU", label: "Niue" },
    { value: "NF", label: "Norfolk Island" },
    { value: "MP", label: "Northern Mariana Islands" },
    { value: "NO", label: "Norway" },
    { value: "OM", label: "Oman" },
    { value: "PK", label: "Pakistan" },
    { value: "PW", label: "Palau" },
    { value: "PS", label: "Palestinian Territory, Occupied" },
    { value: "PA", label: "Panama" },
    { value: "PG", label: "Papua New Guinea" },
    { value: "PY", label: "Paraguay" },
    { value: "PE", label: "Peru" },
    { value: "PH", label: "Philippines" },
    { value: "PN", label: "Pitcairn" },
    { value: "PL", label: "Poland" },
    { value: "PT", label: "Portugal" },
    { value: "PR", label: "Puerto Rico" },
    { value: "QA", label: "Qatar" },
    { value: "RE", label: "Reunion" },
    { value: "RO", label: "Romania" },
    { value: "RU", label: "Russian Federation" },
    { value: "RW", label: "Rwanda" },
    { value: "SH", label: "Saint Helena" },
    { value: "KN", label: "Saint Kitts and Nevis" },
    { value: "LC", label: "Saint Lucia" },
    { value: "PM", label: "Saint Pierre and Miquelon" },
    { value: "VC", label: "Saint Vincent and the Grenadines" },
    { value: "WS", label: "Samoa" },
    { value: "SM", label: "San Marino" },
    { value: "ST", label: "Sao Tome and Principe" },
    { value: "SA", label: "Saudi Arabia" },
    { value: "SN", label: "Senegal" },
    { value: "CS", label: "Serbia and Montenegro" },
    { value: "SC", label: "Seychelles" },
    { value: "SL", label: "Sierra Leone" },
    { value: "SG", label: "Singapore" },
    { value: "SK", label: "Slovakia" },
    { value: "SI", label: "Slovenia" },
    { value: "SB", label: "Solomon Islands" },
    { value: "SO", label: "Somalia" },
    { value: "ZA", label: "South Africa" },
    { value: "GS", label: "South Georgia and the South Sandwich Islands" },
    { value: "ES", label: "Spain" },
    { value: "LK", label: "Sri Lanka" },
    { value: "SD", label: "Sudan" },
    { value: "SR", label: "Suriname" },
    { value: "SJ", label: "Svalbard and Jan Mayen" },
    { value: "SZ", label: "Swaziland" },
    { value: "SE", label: "Sweden" },
    { value: "CH", label: "Switzerland" },
    { value: "SY", label: "Syrian Arab Republic" },
    { value: "TW", label: "Taiwan, Province of China" },
    { value: "TJ", label: "Tajikistan" },
    { value: "TZ", label: "Tanzania, United Republic of" },
    { value: "TH", label: "Thailand" },
    { value: "TL", label: "Timor-Leste" },
    { value: "TG", label: "Togo" },
    { value: "TK", label: "Tokelau" },
    { value: "TO", label: "Tonga" },
    { value: "TT", label: "Trinidad and Tobago" },
    { value: "TN", label: "Tunisia" },
    { value: "TR", label: "Turkey" },
    { value: "TM", label: "Turkmenistan" },
    { value: "TC", label: "Turks and Caicos Islands" },
    { value: "TV", label: "Tuvalu" },
    { value: "UG", label: "Uganda" },
    { value: "UA", label: "Ukraine" },
    { value: "AE", label: "United Arab Emirates" },
    { value: "GB", label: "United Kingdom" },
    { value: "US", label: "United States" },
    { value: "UM", label: "United States Minor Outlying Islands" },
    { value: "UY", label: "Uruguay" },
    { value: "UZ", label: "Uzbekistan" },
    { value: "VU", label: "Vanuatu" },
    { value: "VE", label: "Venezuela" },
    { value: "VN", label: "Viet Nam" },
    { value: "VG", label: "Virgin Islands, British" },
    { value: "VI", label: "Virgin Islands, U.S." },
    { value: "WF", label: "Wallis and Futuna" },
    { value: "EH", label: "Western Sahara" },
    { value: "YE", label: "Yemen" },
    { value: "ZM", label: "Zambia" },
    { value: "ZW", label: "Zimbabwe" }
];


function SignUpPageContent() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <AuthLayout>
      <div className="w-full max-w-[560px] mx-auto px-1 sm:px-3">
        <Card className="rounded-2xl border-0 bg-transparent shadow-none">
          {isClient ? <SignUpForm /> : <div className="h-[600px] animate-pulse rounded-[20px] bg-muted"></div>}
        </Card>
      </div>
    </AuthLayout>
  );
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [title, setTitle] = useState("Open your trading account");
  const [subtitle, setSubtitle] = useState("Fast signup — email or phone. Keep your details safe.");
  const [country, setCountry] = useState("");
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [humanConfirmed, setHumanConfirmed] = useState(false);
  const [humanPending, setHumanPending] = useState(false);
  const humanTimerRef = useRef<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const refId = searchParams.get('ref');
    if (refId) {
        setReferredBy(refId);
    }

    const fetchContent = async () => {
        if (!db) return;
        const docRef = doc(db, 'template', 'landingPage');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            setTitle(data.signupTitle || "Create an Account");
            setSubtitle(data.signupSubtitle || "Start your journey to financial wisdom today.");
        }
    };
    fetchContent();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;
    const firstName = (form.elements.namedItem("firstName") as HTMLInputElement).value;
    const lastName = (form.elements.namedItem("lastName") as HTMLInputElement).value;
    const userName = (form.elements.namedItem("userName") as HTMLInputElement).value;
    const phone = (form.elements.namedItem("phone") as HTMLInputElement).value;

    // Get referral parameter directly from URL
    const refId = searchParams.get('ref');
    const currentReferredBy = refId || referredBy;

    if (!humanConfirmed) {
      toast({
        variant: "destructive",
        title: "Human verification required",
        description: "Please confirm you're human before signing up.",
      });
      return;
    }

    if (password !== confirmPassword) {
        toast({
            variant: "destructive",
            title: "Signup Failed",
            description: "Passwords do not match.",
        });
        return;
    }

    try {
      if (!auth || !db) throw new Error("Firebase not initialized");
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const generalSettingsDoc = await getDoc(doc(db, 'settings', 'general'));
      const emailVerificationEnabled = generalSettingsDoc.exists() ? generalSettingsDoc.data().emailVerificationEnabled ?? true : true;
      
      const initialBalance = 0;

      const usernameQuery = query(collection(db, "users"), where("username", "==", userName));
      const usernameSnapshot = await getDocs(usernameQuery);
      if (!usernameSnapshot.empty) {
        await deleteUser(user);
        toast({ variant: "destructive", title: "Signup Failed", description: "This username is already taken. Please choose another one." });
        return;
      }
      
      const phoneQuery = query(collection(db, "users"), where("phone", "==", phone));
      const phoneSnapshot = await getDocs(phoneQuery);
      if (!phoneSnapshot.empty) {
        await deleteUser(user);
        toast({ variant: "destructive", title: "Signup Failed", description: "This phone number is already in use." });
        return;
      }

      if (emailVerificationEnabled) {
        try {
          await sendVerificationEmailToUser(user);
          console.log('Email verification sent successfully to:', email);
        } catch (verificationError: any) {
          console.error('Failed to send email verification:', verificationError);
          toast({
            variant: "destructive",
            title: "Verification email failed",
            description: "Your account was created, but the verification email could not be sent automatically. Please use the resend option on the next screen.",
          });
        }
      }
      
      const batch = writeBatch(db);

      const userData: any = {
          uid: user.uid,
          email: user.email,
          firstName: firstName,
          lastName: lastName,
          username: userName,
          country: country,
          phone: phone,
          balance: initialBalance,
          totalEarning: initialBalance, // Initialize totalEarning with bonus
          role: 'user',
          verificationStatus: 'unverified',
          createdAt: serverTimestamp(),
      };
      
      if (currentReferredBy) {
          userData.referredBy = currentReferredBy;
          userData.referredAt = serverTimestamp();
      }

      const userDocRef = doc(db, "users", user.uid);
      batch.set(userDocRef, userData);
      
      const welcomeNotificationRef = doc(collection(db, "notifications"));
      batch.set(welcomeNotificationRef, {
          userId: user.uid,
          title: "Welcome to the Platform!",
          description: "We're glad to have you. Explore our features and start your journey.",
          type: "welcome",
          isRead: false,
          createdAt: serverTimestamp(),
          link: "/dashboard"
      });

      if (initialBalance > 0) {
          const bonusTransactionRef = doc(collection(db, "bonusTransactions"));
          batch.set(bonusTransactionRef, {
              userId: user.uid,
              type: "signup",
              amount: initialBalance,
              date: serverTimestamp(),
              description: "Signup Bonus"
          });
          
          const bonusNotificationRef = doc(collection(db, "notifications"));
          batch.set(bonusNotificationRef, {
              userId: user.uid,
              title: "Signup Bonus Awarded!",
              description: `You've received a signup bonus of ${initialBalance}.`,
              type: "bonus_awarded",
              isRead: false,
              createdAt: serverTimestamp(),
              link: "/dashboard/bonus/history"
          });
      }

      await batch.commit();

      if (emailVerificationEnabled) {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
          router.push("/dashboard");
      }

    } catch (error: any) {
        let description = "An unexpected error occurred.";
        if (error.code === 'auth/email-already-in-use') {
            description = "This email address is already in use. Please use a different email.";
        } else {
            description = error.message;
        }
        toast({
            variant: "destructive",
            title: "Signup Failed",
            description: description,
        });
    }
  };

  return (
    <>
      <CardHeader className="space-y-2 px-4 pb-5 pt-5 text-center sm:px-6">
        <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-primary shadow-inner shadow-blue-500/10">
          <span className="text-lg font-bold">+</span>
        </div>
        <CardTitle className="font-headline text-lg sm:text-2xl">{title}</CardTitle>
        <CardDescription className="text-xs text-slate-400 sm:text-sm">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="name@example.com" className="min-h-[48px] rounded-xl text-sm" required />
          </div>
          <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+123456789" className="min-h-[48px] rounded-xl text-sm" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input id="firstName" name="firstName" placeholder="John" className="min-h-[48px] rounded-xl text-sm" required />
          </div>
           <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" name="lastName" placeholder="Doe" className="min-h-[48px] rounded-xl text-sm" required />
          </div>
        </div>
         <div className="space-y-2">
          <Label htmlFor="userName">User Name</Label>
          <Input id="userName" name="userName" placeholder="johndoe" className="min-h-[48px] rounded-xl text-sm" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Select name="country" required onValueChange={setCountry}>
            <SelectTrigger id="country" className="min-h-[48px] rounded-xl text-sm">
              <SelectValue placeholder="Select Country" />
            </SelectTrigger>
            <SelectContent>
              <ScrollArea className="h-56">
                {countries.map((country) => (
                  <SelectItem key={country.value} value={country.label}>
                    {country.label}
                  </SelectItem>
                ))}
              </ScrollArea>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
            <Label htmlFor="password">Create Password</Label>
            <div className="relative">
              <Input id="password" name="password" type={showPassword ? "text" : "password"} className="min-h-[48px] rounded-xl pr-12 text-sm" required />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 rounded-xl text-muted-foreground" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            </div>
            <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? "text" : "password"} className="min-h-[48px] rounded-xl pr-12 text-sm" required />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 rounded-xl text-muted-foreground" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            </div>
        </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={humanConfirmed || humanPending}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (checked) {
                      setHumanPending(true);
                      humanTimerRef.current = window.setTimeout(() => {
                        setHumanPending(false);
                        setHumanConfirmed(true);
                        humanTimerRef.current = null;
                      }, 1500);
                    } else {
                      if (humanTimerRef.current) {
                        clearTimeout(humanTimerRef.current);
                        humanTimerRef.current = null;
                      }
                      setHumanPending(false);
                      setHumanConfirmed(false);
                    }
                  }}
                  className="h-4 w-4 rounded border"
                />
                <span className="ml-2 text-sm text-slate-300">{humanPending ? 'Verifying...' : "I'm human"}</span>
              </label>
            </div>
          </div>
          <Button type="submit" className="min-h-[48px] w-full rounded-xl bg-primary py-3 text-primary-foreground shadow-lg shadow-blue-950/40 hover:bg-primary/90">
            Create Account
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex items-center justify-center px-4 pb-5 text-sm">
        <div>
          <Link href="/login" className="font-medium text-secondary underline-offset-4 hover:text-white hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
        <div>
          {/* Download App button intentionally removed per user request */}
        </div>
      </CardFooter>
    </>
  );
}

export default function SignupPage() {
  return <SignUpPageContent />;
}
