import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, MapPin, Clock, Star, Check, AlertTriangle, Plus, Filter, X, ExternalLink, Instagram, Settings, Calendar, ChevronDown, ChevronUp, MapPinIcon, TrendingUp, User, Phone, Mail, Facebook, Twitter, Youtube, Globe, Link as LinkIcon, Menu } from 'lucide-react';
import { supabase } from './src/lib/supabaseClient';
import mapboxgl from 'mapbox-gl';
import './src/styles/home.css';

 
// Types
// Include all app views used throughout the app (no separate 'detail' view; details use a modal)
type View = 'home' | 'results' | 'admin' | 'about' | 'contact' | 'suggest';

type VerificationMethod = 'Crunch Team Called' | 'Owner Submitted' | 'Crunch Team Visited' | null;

interface Restaurant {
  id: number;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  oilsUsed: string[];
  oilsAvoided: string[];
  dietaryTags: string[];
  verified: boolean;
  verificationDate: string | null;
  verificationMethod: VerificationMethod;
  website: string;
  instagram: string;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  orderType: string;
  sourcingNotes: string;
  imageUrl: string;
  imageUrls?: string[];
  menuLink?: string;
  rating: number;
  reviewCount: number;
  hours: string;
  cuisine: string;
  lastUpdated: string; // ISO date
  phone: string;
  email: string;
  latitude?: number;
  longitude?: number;
  outdoorSeating?: boolean;
  delivery?: boolean;
  familyFriendly?: boolean;
  celiacSafe?: boolean;
  recommendedDishes?: any;
  socialLinks?: any;
}

// DB row types (snake_case) to ensure type safety with Supabase
interface RestaurantRow {
  id: number;
  name: string;
  address: string;
  neighborhood: string;
  city?: string | null;
  location?: string | number | null;
  oils_used: string | string[] | null;
  oils_avoided: string | string[] | null;
  // dietary tags are modeled via M2M join tables now
  restaurant_dietary_tags?: Array<{ dietary_tags: { name: string } }> | null;
  // joined city relation (aliased in select)
  city_rel?: { name: string } | null;
  verified: boolean;
  verification_date: string | null;
  verification_method: VerificationMethod;
  website: string | null;
  instagram: string | null;
  menu_link?: string | null;
  price_range: '$' | '$$' | '$$$' | '$$$$' | null;
  order_type: string | null;
  sourcing_notes: string | null;
  image_url: string | null;
  image_urls?: any | null;
  rating: number | null;
  review_count: number | null;
  hours: string | null;
  cuisine: string | null;
  last_updated: string | null;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  outdoor_seating?: boolean | null;
  delivery?: boolean | null;
  family_friendly?: boolean | null;
  celiac_safe?: boolean | null;
  recommended_dishes?: any | null;
  social_links?: any | null;
}

interface PendingRow {
  id: number;
  name: string;
  address: string;
  neighborhood: string | null;
  city: string;
  website: string | null;
  notes: string | null;
  submitted_date: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface UserRow {
  id: number;
  user_id: string; // UUID string from auth
  role: 'admin' | 'user';
  email: string | null;
}

// Newsletter subscriptions table row (RLS enabled)
// Schema: id uuid PK, email text UNIQUE NOT NULL, subscribed_date timestamptz DEFAULT now()
interface NewsletterSubscriptionRow {
  id: string; // uuid
  email: string;
  subscribed_date: string; // ISO timestamp
}

// Cities table
interface CityRow {
  id: number;
  name: string;
}

// Contact messages table row
// Schema: name text, email text, subject text, message text, submitted_date timestamptz
interface ContactMessageRow {
  name: string;
  email: string;
  subject: string;
  message: string;
  submitted_date: string; // ISO timestamp
}

interface Filters {
  diet: string[];
  oils: string[];
  neighborhood: string;
  priceRange: '' | '$' | '$$' | '$$$' | '$$$$';
  verified: boolean;
}

interface Submission {
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  website: string;
  notes: string;
}

interface PendingSubmission extends Submission {
  id: number;
  submittedDate: string; // ISO date
  status: 'pending' | 'approved' | 'rejected';
}

type ToastType = 'success' | 'error' | 'info';
interface ToastNotice {
  id: string;
  message: string;
  type: ToastType;
}

// Mapbox token (optional). Add VITE_MAPBOX_TOKEN to .env.local to enable map.
const mapboxToken = (import.meta as any).env?.VITE_MAPBOX_TOKEN as string | undefined;

// Mapping helpers between DB (snake_case) and UI (camelCase)
const splitToArray = (v: string | string[] | null | undefined): string[] => {
  if (Array.isArray(v)) return v.filter(Boolean) as string[];
  if (typeof v === 'string') return v.split(/[;,]|\n/).map(s => s.trim()).filter(Boolean);
  return [];
};
const cityAliases = (canon: string): string[] => {
  switch (canon) {
    case 'New York':
      return ['New York', 'NYC', 'New York City'];
    case 'Los Angeles':
      return ['Los Angeles', 'LA'];
    case 'San Francisco':
      return ['San Francisco', 'SF', 'San Fran'];
    case 'Houston':
      return ['Houston'];
    case 'Austin':
      return ['Austin'];
    default:
      return [canon].filter(Boolean) as string[];
  }
};

// City helpers: canonicalize and derive city names
const canonicalCity = (value: string | null | undefined): string => {
  const v = (value || '').trim().toLowerCase();
  const map: Record<string, string> = {
    'nyc': 'New York',
    'new york': 'New York',
    'new york city': 'New York',
    'los angeles': 'Los Angeles',
    'la': 'Los Angeles',
    'san francisco': 'San Francisco',
    'sf': 'San Francisco',
    'san fran': 'San Francisco',
    'houston': 'Houston',
    'austin': 'Austin',
  };
  return map[v] || (value?.trim() || '');
};
const knownCities = ['New York', 'Los Angeles', 'San Francisco', 'Houston', 'Austin'];
const getCity = (r: Restaurant): string => {
  if (r.city && r.city.trim()) return canonicalCity(r.city);
  const src = `${r.address} ${r.neighborhood}`.toLowerCase();
  // Check synonyms first
  const syns: Array<[string, string]> = [
    ['nyc', 'New York'],
    ['new york city', 'New York'],
    ['new york', 'New York'],
    ['los angeles', 'Los Angeles'],
    ['la', 'Los Angeles'],
    ['san francisco', 'San Francisco'],
    ['san fran', 'San Francisco'],
    ['sf', 'San Francisco'],
    ['houston', 'Houston'],
    ['austin', 'Austin'],
  ];
  for (const [needle, name] of syns) {
    if (src.includes(needle)) return name;
  }
  for (const c of knownCities) {
    if (src.includes(c.toLowerCase())) return c;
  }
  return '';
};

const mapRestaurantRow = (rowAny: any): Restaurant => {
  const row = rowAny as RestaurantRow;
  const tagsFromJoin = (row.restaurant_dietary_tags || [])
    ?.map((j) => j?.dietary_tags?.name)
    .filter(Boolean) as string[];
  const fallbackImage = 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=1600&auto=format&fit=crop';
  const resolvePrimaryImage = (): string => {
    const primary = (row.image_url || '').trim();
    if (primary && /^https?:\/\//i.test(primary)) return primary;
    const iuRaw: any = (row as any).image_urls;
    const iu: any = typeof iuRaw === 'string' ? iuRaw.trim() : iuRaw;
    if (!iu) return fallbackImage;
    // If it's a JSON string, try parsing
    try {
      const parsed = typeof iu === 'string' ? JSON.parse(iu) : iu;
      if (Array.isArray(parsed)) {
        // Support arrays of strings or objects with url/src
        const fromString = parsed.find((x) => typeof x === 'string' && /^https?:\/\//i.test(x));
        if (fromString) return fromString as string;
        const fromObj = parsed.find((x) => x && typeof x === 'object' && (typeof (x as any).url === 'string' || typeof (x as any).src === 'string')) as any;
        if (fromObj) {
          const cand = (fromObj.url || fromObj.src) as string;
          if (/^https?:\/\//i.test(cand)) return cand;
        }
      } else if (typeof parsed === 'object' && parsed) {
        const direct = (parsed as any).url || (parsed as any).src;
        if (typeof direct === 'string' && /^https?:\/\//i.test(direct)) return direct;
        const images = (parsed as any).images;
        if (Array.isArray(images)) {
          const cand: any = images.find((x: any) => (typeof x === 'string' && /^https?:\/\//i.test(x)) || (x && typeof x === 'object' && typeof (x.url || x.src) === 'string' && /^https?:\/\//i.test(x.url || x.src)));
          if (cand) {
            if (typeof cand === 'string') return cand;
            const c = (cand.url || cand.src) as string;
            if (/^https?:\/\//i.test(c)) return c;
          }
        }
      } else if (typeof parsed === 'string' && /^https?:\/\//i.test(parsed)) {
        return parsed;
      }
    } catch {}
    // If it's just a string URL
    if (typeof iu === 'string') {
      const trimmed = iu.trim();
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
    }
    return fallbackImage;
  };
  // Parse image_urls into array for gallery
  const resolveImageArray = (): string[] => {
    const out: string[] = [];
    // include primary
    const primary = (row.image_url || '').trim();
    if (primary && /^https?:\/\//i.test(primary)) out.push(primary);
    const iuRaw: any = (row as any).image_urls;
    if (iuRaw) {
      try {
        const parsed = typeof iuRaw === 'string' ? JSON.parse(iuRaw) : iuRaw;
        if (Array.isArray(parsed)) {
          for (const x of parsed) {
            const url = typeof x === 'string' ? x : (x?.url || x?.src);
            if (typeof url === 'string' && /^https?:\/\//i.test(url)) out.push(url);
          }
        } else if (typeof parsed === 'object') {
          const images = (parsed as any).images;
          if (Array.isArray(images)) {
            for (const x of images) {
              const url = typeof x === 'string' ? x : (x?.url || x?.src);
              if (typeof url === 'string' && /^https?:\/\//i.test(url)) out.push(url);
            }
          }
        }
      } catch {}
    }
    // de-duplicate
    return Array.from(new Set(out));
  };

  return {
    id: row.id,
    name: row.name ?? '',
    address: row.address ?? '',
    neighborhood: row.neighborhood ?? '',
    city: (row as any)?.city_rel?.name ?? ((typeof row.city === 'string' ? row.city : '') || (typeof row.location === 'string' ? row.location : '')),
    oilsUsed: splitToArray(row.oils_used),
    oilsAvoided: splitToArray(row.oils_avoided),
    dietaryTags: tagsFromJoin || [],
    verified: Boolean(row.verified),
    verificationDate: row.verification_date ?? null,
    verificationMethod: (() => {
      const raw = (row as any).verification_method ?? null;
      if (!raw) return null;
      const m = String(raw).trim().toLowerCase();
      if (['crunch team visited', 'visited', 'visit', 'site visit', 'in person', 'in-person', 'team visited'].some(t => m.includes(t))) {
        return 'Crunch Team Visited' as VerificationMethod;
      }
      if (['crunch team called', 'called', 'call', 'phone', 'phone call', 'phone-call', 'phone verified', 'phone-verified', 'called by crunch', 'team called'].some(t => m.includes(t))) {
        return 'Crunch Team Called' as VerificationMethod;
      }
      return 'Owner Submitted' as VerificationMethod;
    })(),
    website: row.website ?? '',
    instagram: row.instagram ?? '',
    menuLink: (row as any)?.menu_link ?? '',
    priceRange: (row.price_range ?? '$$') as any,
    orderType: row.order_type ?? 'Dine-in',
    sourcingNotes: row.sourcing_notes ?? '',
    imageUrl: resolvePrimaryImage(),
    imageUrls: resolveImageArray(),
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    hours: row.hours ?? '',
    cuisine: row.cuisine ?? '',
    lastUpdated: row.last_updated ?? new Date().toISOString().split('T')[0],
    phone: row.phone ?? '',
    email: row.email ?? '',
    latitude: typeof row.latitude === 'number' ? row.latitude : undefined,
    longitude: typeof row.longitude === 'number' ? row.longitude : undefined,
    outdoorSeating: (row as any)?.outdoor_seating ?? undefined,
    delivery: (row as any)?.delivery ?? undefined,
    familyFriendly: (row as any)?.family_friendly ?? undefined,
    celiacSafe: (row as any)?.celiac_safe ?? undefined,
    recommendedDishes: ((): any => {
      const v = (row as any)?.recommended_dishes;
      if (!v) return undefined;
      try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return v; }
    })(),
    socialLinks: ((): any => {
      const v = (row as any)?.social_links;
      if (!v) return undefined;
      try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return v; }
    })(),
  };
};

const mapPendingRow = (row: PendingRow): PendingSubmission => ({
  id: row.id,
  name: row.name ?? '',
  address: row.address ?? '',
  neighborhood: row.neighborhood ?? '',
  city: row.city ?? '',
  website: row.website ?? '',
  notes: row.notes ?? '',
  submittedDate: row.submitted_date ?? new Date().toISOString().split('T')[0],
  status: row.status ?? 'pending',
});

const toRestaurantInsertFromPending = (submission: PendingSubmission) => ({
  name: submission.name,
  address: submission.address,
  neighborhood: submission.neighborhood || 'TBD',
  city: submission.city,
  oils_used: ['To Be Verified'],
  oils_avoided: ['To Be Verified'],
  dietary_tags: ['Pending Review'],
  verified: false,
  verification_date: null,
  verification_method: null,
  website: submission.website,
  instagram: '',
  price_range: '$$',
  order_type: 'Dine-in',
  sourcing_notes: submission.notes,
  image_url: 'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=400&h=300&fit=crop',
  rating: 0,
  review_count: 0,
  hours: 'TBD',
  cuisine: 'TBD',
  last_updated: new Date().toISOString().split('T')[0],
  phone: '',
  email: '',
});

// Duplicate Header removed (keep the later Header definition below)

// Duplicate Footer removed (keep the earlier Footer definition above)

// Duplicate Header removed above to avoid redeclare errors

// Footer Component (unified, styled via home.css)
const Footer = ({ onNavigate, onSuggest, cities = [], restaurantsCount = 0, verifiedCount = 0 }: { onNavigate: (view: 'home' | 'results' | 'about' | 'contact' | 'suggest' | 'admin') => void; onSuggest: () => void; cities?: string[]; restaurantsCount?: number; verifiedCount?: number; }) => (
  <footer className="footer">
    <div className="container-safe footer-grid">
      <div>
        <div className="brand-line"><span className="brand-mark">🥗</span><span className="brand-name">Crunch</span></div>
        <p className="muted">Helping you find restaurants that prioritize your health by avoiding industrial seed oils.</p>
        {cities.length > 0 && (
          <>
            <div className="muted small">Currently serving:</div>
            <div className="chips">
              {cities.map((c) => (
                <span key={c} className="chip">{c}</span>
              ))}
            </div>
          </>
        )}
      </div>
      <div>
        <div className="footer-title">Quick Links</div>
        <ul className="footer-links">
          <li><button className="link" onClick={() => onNavigate('home')}>Home</button></li>
          <li><button className="link" onClick={() => onNavigate('results')}>Browse Restaurants</button></li>
          <li><button className="link" onClick={() => onSuggest()}>Submit Restaurant</button></li>
          <li><button className="link" onClick={() => onNavigate('about')}>About</button></li>
          <li><button className="link" onClick={() => onNavigate('contact')}>Contact</button></li>
        </ul>
      </div>
      <div>
        <div className="footer-title">Stats</div>
        <ul className="footer-links">
          <li>{restaurantsCount} Total Restaurants</li>
          <li>{verifiedCount} Verified Listings</li>
          <li>{cities.length} Cities Covered</li>
          <li className="muted small">Last updated: {new Date().toLocaleDateString()}</li>
        </ul>
      </div>
  </div>
  <div className="footer-bottom">  &copy; 2025 Crunch. All rights reserved.</div>
</footer>
);

// Header Component (single source of truth)
const Header = ({ 
  searchQuery, 
  onSearchChange, 
  onSearchSubmit, 
  selectedCity, 
  onCityChange,
  cityNames,
  onAddRestaurant,
  isAdmin,
  onAdminClick,
  onNavigate,
  currentView,
  onOpenFilters
}: {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  selectedCity: string;
  onCityChange: (city: string) => void;
  cityNames: string[];
  onAddRestaurant: () => void;
  isAdmin: boolean;
  onAdminClick: () => void;
  onNavigate: (view: 'home' | 'results' | 'about' | 'contact' | 'suggest' | 'admin') => void;
  currentView: 'home' | 'results' | 'about' | 'contact' | 'suggest' | 'admin';
  onOpenFilters: () => void;
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevRootOverflow;
    };
  }, [mobileOpen]);
  return (
  <header className="nav-bar">
    <div className="container-safe nav-row">
      <div
        className="brand-left"
        role="button"
        aria-label="Go to Home"
        tabIndex={0}
        onClick={() => onNavigate('home')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('home'); } }}
        style={{ cursor: 'pointer' }}
      >
        <div className="brand-mark" aria-label="Crunch">🥗</div>
        <div className="brand-name">Crunch</div>
      </div>

      <div className="nav-center" style={{ flex: 1, maxWidth: 1200, padding: '0 .75rem', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
        <form onSubmit={onSearchSubmit} style={{ flex: 1, minWidth: 0 }}>
          <div className="field" style={{ width: '100%' }}>
            <Search className="icon-left" width={18} height={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={onSearchChange}
              className="input with-icon"
              placeholder="search"
              style={{ width: '100%' }}
            />
          </div>
        </form>
        <select
          value={selectedCity}
          onChange={(e) => onCityChange(e.target.value)}
          className="select"
          aria-label="City"
          style={{ height: '3rem', width: 'auto', minWidth: '9.5rem' }}
        >
          {cityNames.map((c: string) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button className="btn light" onClick={onOpenFilters} aria-label="Open filters"><Filter width={16} height={16} /> Filter</button>
      </div>

      <div className="brand-actions">
        <button className={`btn link nav-link ${currentView === 'home' ? 'nav-active' : ''}`} onClick={() => onNavigate('home')}>Home</button>
        <button className={`btn link nav-link ${currentView === 'results' ? 'nav-active' : ''}`} onClick={() => onNavigate('results')}>Browse</button>
        <button className={`btn link nav-link ${currentView === 'about' ? 'nav-active' : ''}`} onClick={() => onNavigate('about')}>About</button>
        <button className={`btn link nav-link ${currentView === 'contact' ? 'nav-active' : ''}`} onClick={() => onNavigate('contact')}>Contact</button>
        <button className="btn primary" onClick={onAddRestaurant}><Plus width={16} height={16} /> Suggest</button>
        {isAdmin && (
          <button className={`btn link nav-link ${currentView === 'admin' ? 'nav-active' : ''}`} onClick={onAdminClick}><Settings width={16} height={16} /> Admin</button>
        )}
      </div>

      <button
        className="btn light nav-toggle"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <Menu width={18} height={18} />
      </button>
    </div>
    {mobileOpen && createPortal(
      (
        <div className="mobile-menu-root" onClick={() => setMobileOpen(false)}>
          <div className="mobile-menu-overlay" />
          <div className="mobile-menu" role="dialog" aria-label="Mobile menu" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn light nav-toggle"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + .5rem)', right: '.5rem', zIndex: 3 }}
            >
              <X width={18} height={18} />
            </button>
            <div className="menu-grid" style={{ gap: 0 }}>
              <div className="stack-tight">
                <form onSubmit={(e) => { onSearchSubmit(e); setMobileOpen(false); }} style={{ margin: 0 }}>
                  <div className="field">
                    <Search className="icon-left" width={18} height={18} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={onSearchChange}
                      className="input with-icon"
                      placeholder="Search"
                    />
                  </div>
                </form>
                <select
                  value={selectedCity}
                  onChange={(e) => { onCityChange(e.target.value); }}
                  className="select"
                  aria-label="City"
                  style={{ margin: 0 }}
                >
                  {cityNames.map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button className="btn primary" style={{ margin: 0 }} onClick={() => { onOpenFilters(); setMobileOpen(false); }}><Filter width={16} height={16} /> Filters</button>
              </div>
              <div className="menu-actions">
                <button className="btn light" onClick={() => { onNavigate('results'); setMobileOpen(false); }}>Browse</button>
                <button className="btn light" onClick={() => { onNavigate('home'); setMobileOpen(false); }}>Home</button>
                <button className="btn light" onClick={() => { onNavigate('about'); setMobileOpen(false); }}>About</button>
                <button className="btn light" onClick={() => { onNavigate('contact'); setMobileOpen(false); }}>Contact</button>
                <button className="btn secondary" onClick={() => { onAddRestaurant(); setMobileOpen(false); }}><Plus width={16} height={16} /> Suggest</button>
                {isAdmin && (
                  <button className="btn light" onClick={() => { onAdminClick(); setMobileOpen(false); }}><Settings width={16} height={16} /> Admin</button>
                )}
              </div>
            </div>
          </div>
        </div>
      ),
      document.body
    )}
  </header>
  );
};

// Contact Form Component
const ContactForm: React.FC<{ onNotify?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void }> = ({ onNotify }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Basic validation
    if (!name.trim() || !email.trim() || !message.trim()) {
      const msg = 'All required fields must be filled';
      setError(msg);
      onNotify?.(msg, 'error');
      return;
    }
    if (!isValidEmail(email)) {
      const msg = 'Please enter a valid email address';
      setError(msg);
      onNotify?.(msg, 'error');
      return;
    }

    setLoading(true);
    try {
      // Insert only permitted columns; let DB default fill submitted_date and id
      const insertPayload = [{
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || null,
        message: message.trim(),
      }];

      const { error: insertErr } = await supabase
        .from('contact_messages')
        .insert(insertPayload);

      if (insertErr) {
        const msg = insertErr.message || 'Failed to send your message';
        setError(msg);
        onNotify?.(msg, 'error');
        return;
      }

      // Success
      setSuccess(true);
      onNotify?.('Message sent successfully!', 'success');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (e: any) {
      const msg = e?.message || 'Unexpected error';
      setError(msg);
      onNotify?.(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby="contact-heading" className="card" style={{ padding: '1.25rem' }}>
      <h3 id="contact-heading" className="h2">Contact Us</h3>
      <p className="muted" style={{ marginBottom: '1rem' }}>Have a question, suggestion, or partnership idea? Send us a message.</p>
      <form onSubmit={handleSubmit} className="form-grid" noValidate>
        <div>
          <label htmlFor="contact-name" className="label">Name</label>
          <input
            id="contact-name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Your name"
            required
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="label">Email</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <label htmlFor="contact-subject" className="label">Subject</label>
          <input
            id="contact-subject"
            name="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="input"
            placeholder="How can we help?"
            required
          />
        </div>
        <div>
          <label htmlFor="contact-message" className="label">Message</label>
          <textarea
            id="contact-message"
            name="message"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="input"
            placeholder="Your message"
            required
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '.25rem' }}>
          <div className="small" aria-live="polite">
            {error && <span className="error">{error}</span>}
            {success && !error && <span className="accent-green">Thanks! Your message has been sent.</span>}
          </div>
          <button type="submit" disabled={loading} className="btn primary">
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </form>
    </section>
  );
};

const CrunchApp = () => {
  // State management
  const getInitialView = (): View => {
    try {
      const saved = localStorage.getItem('crunch.currentView') as View | null;
      const allowed: View[] = ['home','results','about','contact','suggest','admin'];
      if (saved && allowed.includes(saved)) return saved;
    } catch {}
    return 'home';
  };
  const [currentView, setCurrentView] = useState<View>(getInitialView);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('New York');
  const [cityOptions, setCityOptions] = useState<CityRow[]>([]);
  const [coverageCities, setCoverageCities] = useState<string[]>([]);
  const [siteWideVerifiedCount, setSiteWideVerifiedCount] = useState<number>(0);
  const [verifiedInSelectedCity, setVerifiedInSelectedCity] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSubmissionForm, setShowSubmissionForm] = useState<boolean>(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [hoveredRestaurant, setHoveredRestaurant] = useState<Restaurant | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [newSubmission, setNewSubmission] = useState<Submission>({
    name: '',
    address: '',
    neighborhood: '',
    city: 'New York',
    website: '',
    notes: ''
  });
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [cities] = useState<string[]>(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami']);
  const [sortBy, setSortBy] = useState<'rating' | 'name' | 'recent' | 'price' | 'verified' | 'updated'>('rating');
  const [filters, setFilters] = useState<Filters>({
    diet: [],
    oils: [],
    neighborhood: '',
    priceRange: '',
    verified: false
  });
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [suggestNameTouched, setSuggestNameTouched] = useState<boolean>(false);
  const [suggestAddressTouched, setSuggestAddressTouched] = useState<boolean>(false);
  const [suggestSuccess, setSuggestSuccess] = useState<boolean>(false);
  const [newsletterEmail, setNewsletterEmail] = useState<string>('');
  const [newsletterLoading, setNewsletterLoading] = useState<boolean>(false);
  const [newsletterError, setNewsletterError] = useState<string | null>(null);
  const [newsletterSuccess, setNewsletterSuccess] = useState<boolean>(false);
  const [selectedFilters, setSelectedFilters] = useState<Filters>({
    diet: [],
    oils: [],
    neighborhood: '',
    priceRange: '',
    verified: false
  });
  
  // Other state variables
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const allOils: string[] = ['Avocado Oil', 'Olive Oil', 'Coconut Oil', 'Grass-fed Butter', 'Tallow', 'Duck Fat'];

  // Load cities once for dropdowns and filtering by city id
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name')
        .order('name');
      if (!error && data) {
        setCityOptions(data as CityRow[]);
      }
    })();
  }, []);

  // Fetch verified count for the currently selected city
  const refreshVerifiedInCity = useCallback(async () => {
    const targetCity = canonicalCity(selectedCity);
    const match = cityOptions.find((c) => canonicalCity(c.name) === targetCity);
    if (match) {
      // Fetch verification_method values for the city by id and count with helper
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, verification_method')
        .eq('location', match.id);
      if (!error && Array.isArray(data)) {
        const cnt = (data as any[]).reduce((acc, r) => acc + (getVerifyLabel((r as any)?.verification_method ?? null) ? 1 : 0), 0);
        setVerifiedInSelectedCity(cnt);
      }
    } else {
      // Join by city name and count with helper
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, verification_method, cities!inner(name)')
        .eq('cities.name', targetCity);
      if (!error && Array.isArray(data)) {
        const cnt = (data as any[]).reduce((acc, r) => acc + (getVerifyLabel((r as any)?.verification_method ?? null) ? 1 : 0), 0);
        setVerifiedInSelectedCity(cnt);
      }
    }
  }, [selectedCity, cityOptions]);

  // Fetch distinct cities that have restaurant data site-wide
  const refreshCoverageCities = useCallback(async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('location, cities!inner(name)');
    if (!error && Array.isArray(data)) {
      const set = new Set<string>();
      for (const row of data as any[]) {
        const n = (row as any)?.cities?.name as string | undefined;
        if (n) set.add(n);
      }
      setCoverageCities(Array.from(set).sort());
    }
  }, []);

  // Fetch site-wide verified count (any phone call or in-person visit)
  const refreshSiteVerified = useCallback(async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, verification_method');
    if (!error && Array.isArray(data)) {
      let count = 0;
      for (const row of data as any[]) {
        const label = getVerifyLabel((row as any)?.verification_method ?? null);
        if (label) count += 1;
      }
      setSiteWideVerifiedCount(count);
    }
  }, []);

  // Load coverage and verified once at startup
  useEffect(() => {
    refreshCoverageCities();
    refreshSiteVerified();
    refreshVerifiedInCity();
  }, [refreshCoverageCities, refreshSiteVerified, refreshVerifiedInCity]);

  // If cities load after first fetch, refetch to use cityId filtering
  useEffect(() => {
    if (cityOptions.length > 0) {
      fetchData(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityOptions.length]);

  // Refresh verified-in-city whenever selected city changes or cityOptions update
  useEffect(() => {
    refreshVerifiedInCity();
  }, [refreshVerifiedInCity]);
  
  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState(false);

  // Simple hash-based navigation helpers
  const viewFromHash = (hash: string): View => {
    const h = (hash || '').replace(/^#\/?/, '').toLowerCase();
    switch (h) {
      case 'home':
        return 'home'
      case 'results':
        return 'results'
      case 'about':
        return 'about'
      case 'contact':
        return 'contact'
      case 'suggest':
        return 'suggest'
      case 'admin':
        return 'admin'
      default:
        return 'home'
    }
  };

  const navigate = (view: View) => {
    setCurrentView(view);
    const target = `#/${view}`;
    if (window.location.hash !== target) {
      window.location.hash = target;
    }
  };

  // Initialize view from hash on mount and listen for hash changes
  useEffect(() => {
    // Set initial view
    const initial = viewFromHash(window.location.hash);
    if (initial !== currentView) setCurrentView(initial);

    const onHashChange = () => {
      const next = viewFromHash(window.location.hash);
      setCurrentView(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep hash in sync when currentView changes
  useEffect(() => {
    const target = `#/${currentView}`;
    if (window.location.hash !== target) {
      window.location.hash = target;
    }
  }, [currentView]);

  // Normalize website to include scheme if missing
  const normalizeUrl = (value: string) => {
    const v = (value || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v}`;
  };

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setCurrentView('results');
      // Add search logic here
    }
  };

  // Persist currentView across reloads
  useEffect(() => {
    try { localStorage.setItem('crunch.currentView', currentView); } catch {}
  }, [currentView]);

  // Handle city change
  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    // Refresh data when city changes
    if (currentView === 'results') {
      // Add refresh logic here
    }
  };

  // Validate email format
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Newsletter subscribe handler using Supabase
  const handleSubscribe = async () => {
    setNewsletterError(null);
    setNewsletterSuccess(false);
    const email = newsletterEmail.trim();
    if (!email) {
      setNewsletterError('Email is required');
      return;
    }
    if (!isValidEmail(email)) {
      setNewsletterError('Please enter a valid email address');
      return;
    }
    setNewsletterLoading(true);
    try {
      // Check uniqueness in UI before submit
      const { count, error: countErr } = await supabase
        .from('newsletter_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('email', email);
      if (countErr) {
        // Non-fatal; proceed to insert and rely on DB constraint
        console.warn('Newsletter uniqueness check error:', countErr.message);
      }
      if (typeof count === 'number' && count > 0) {
        setNewsletterError('This email is already subscribed');
        setNewsletterLoading(false);
        return;
      }

      // Insert with only email so subscribed_date defaults to now()
      const { error: insertErr } = await supabase
        .from('newsletter_subscriptions')
        .insert<Partial<NewsletterSubscriptionRow>>({ email });

      if (insertErr) {
        // Handle unique violation gracefully
        if (insertErr.code === '23505') {
          setNewsletterError('This email is already subscribed');
        } else {
          setNewsletterError(insertErr.message || 'Failed to subscribe');
        }
        setNewsletterLoading(false);
        return;
      }

      setNewsletterSuccess(true);
      setNewsletterEmail('');
      showToastMessage('Subscribed! Check your inbox for updates.', 'success');
    } catch (e: any) {
      setNewsletterError(e?.message || 'Unexpected error');
    } finally {
      setNewsletterLoading(false);
    }
  };

  // Add a new toast message
  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Toast component
  const Toast = ({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) => {
    const bgColor = {
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800'
    }[type];

    return (
      <div className={`${bgColor} rounded-lg shadow-lg p-4 mb-2 flex justify-between items-center`}>
        <span>{message}</span>
        <button onClick={onClose} className="ml-4 text-gray-500 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // Removed stray JSX fragment that broke the component structure

  // Remove duplicate minimal ResultsPage; a full Results view is rendered in the main return

  // Restaurants loaded from Supabase
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // Data fetcher with pagination
  const fetchData = async (reset = false) => {
    setLoading(true);
    setLoadError(null);
    const nextPage = reset ? 0 : page;
    const from = nextPage * pageSize;
    const to = from + pageSize - 1;

    // Resolve city id from loaded cities using the selected city name
    const targetCity = canonicalCity(selectedCity);
    const match = cityOptions.find((c) => canonicalCity(c.name) === targetCity);
    const cityId: number | null = match ? match.id : null;

    // Build restaurants query, joining cities for display and enabling join-based filtering when needed
    let query = supabase
      .from('restaurants')
      .select(`
        *,
        city_rel:cities!inner(name),
        restaurant_dietary_tags:restaurant_dietary_tags(
          dietary_tags:dietary_tags(name)
        )
      `, { count: 'exact' })
      .range(from, to)
      .order('last_updated', { ascending: false });

    if (cityId !== null) {
      // Filter by foreign key id (safe for integer column)
      query = query.eq('location', cityId);
    } else {
      // Filter by joined city name when id isn't resolved yet
      query = query.eq('cities.name', targetCity);
    }

    const { data: restaurantsData, error: restaurantsError, count } = await query;

    if (restaurantsError) {
      setLoadError(`Failed to load restaurants: ${restaurantsError.message}`);
    } else if (restaurantsData) {
      const mapped = (restaurantsData as RestaurantRow[]).map(mapRestaurantRow);
      setRestaurants(prev => (reset ? mapped : [...prev, ...mapped]));
      if (typeof count === 'number') {
        setHasMore(to + 1 < count);
      } else {
        setHasMore(restaurantsData.length === pageSize);
      }
      if (reset) setPage(1); else setPage(p => p + 1);
    }

    const { data: pendingData, error: pendingError } = await supabase
      .from('pending')
      .select('*')
      .order('submitted_date', { ascending: false });
    if (pendingError) {
      setLoadError(prev => prev ?? `Failed to load pending submissions: ${pendingError.message}`);
    } else if (pendingData) {
      setPendingSubmissions((pendingData as PendingRow[]).map(mapPendingRow));
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when city changes to ensure data freshness (in case backend is scoped by city)
  useEffect(() => {
    fetchData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity]);

  // Enhanced filter logic with oil and city filtering
  // Normalize helper for dietary tags (case-insensitive, hyphen/space-insensitive)
  const canonicalDiet = (value: string): string => {
    if (!value) return '';
    const v = value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[-–—]/g, '-');
    // Basic synonym map to align UI labels with DB data
    const map: Record<string, string> = {
      'seed oil free': 'seed-oil free',
      'seed-oil-free': 'seed-oil free',
      // Treat "No Seed Oils" and variants as the same as Seed-Oil Free
      'no seed oils': 'seed-oil free',
      'no seed oil': 'seed-oil free',
      'no seed-oils': 'seed-oil free',
      'no seed-oil': 'seed-oil free',
      'no-industrial-seed-oils': 'seed-oil free',
      'no-industrial-seed-oil': 'seed-oil free',
      'seed oil-free': 'seed-oil free',
      'seed-oil- free': 'seed-oil free',
      'plant based': 'plant-based',
      'low fodmap': 'low fodmap',
      'diabetic friendly': 'diabetic-friendly',
      'heart healthy': 'heart-healthy',
      'gluten free': 'gluten-free',
      'dairy free': 'dairy-free',
      'nut free': 'nut-free',
      'soy free': 'soy-free',
      'egg free': 'egg-free',
      'shellfish free': 'shellfish-free',
      'sesame free': 'sesame-free',
      'no added sugar': 'no added sugar',
      'no artificial sweeteners': 'no artificial sweeteners',
      'organic ingredients': 'organic ingredients',
      'locally sourced': 'locally sourced',
    };
    return map[v] || v;
  };

  // Standardize display label for known canonical tags
  const displayDiet = (value: string): string => {
    const canon = canonicalDiet(value);
    if (canon === 'seed-oil free') return 'Seed-Oil Free';
    return value;
  };

  // Normalize recommended dishes into a uniform list
  type RecDish = { title: string; note?: string; tags?: string[] };
  const normalizeRecommendedDishes = (val: any): RecDish[] => {
    if (!val) return [];
    let data: any = val;
    try { if (typeof val === 'string') data = JSON.parse(val); } catch { /* ignore */ }
    const out: RecDish[] = [];
    const pushObj = (o: any) => {
      if (!o) return;
      const title = o.title || o.name || o.dish || (typeof o === 'string' ? o : '');
      if (!title) return;
      const note = o.note || o.description || o.desc || undefined;
      const rawTags = o.tags || o.labels || o.categories || undefined;
      let tags: string[] | undefined = undefined;
      if (Array.isArray(rawTags)) tags = rawTags.filter(Boolean).map((x) => String(x));
      else if (typeof rawTags === 'string') tags = rawTags.split(',').map((s) => s.trim()).filter(Boolean);
      out.push({ title: String(title), note: note ? String(note) : undefined, tags });
    };
    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'string') out.push({ title: item }); else pushObj(item);
      }
    } else if (typeof data === 'object') {
      const arr = data.items || data.dishes || data.recommendations || data.list || data.menu || [];
      if (Array.isArray(arr)) {
        for (const item of arr) { if (typeof item === 'string') out.push({ title: item }); else pushObj(item); }
      } else {
        pushObj(data);
      }
    }
    // de-dupe by title
    const seen = new Set<string>();
    return out.filter((d) => (d.title && !seen.has(d.title) && seen.add(d.title)) || false || true);
  };

  // Normalize social links into label+url pairs
  type SocialLink = { label: string; url: string };
  const normalizeSocialLinks = (val: any): SocialLink[] => {
    if (!val) return [];
    let data: any = val;
    try { if (typeof val === 'string') data = JSON.parse(val); } catch { /* ignore */ }
    const out: SocialLink[] = [];
    const add = (label: string, v: any) => {
      if (!v) return;
      let s = String(v).trim();
      if (!s) return;
      if (!/^https?:\/\//i.test(s)) {
        // handle common handles
        if (label.toLowerCase().includes('instagram')) s = `https://instagram.com/${s.replace('@','')}`;
        else if (label.toLowerCase().includes('facebook')) s = `https://facebook.com/${s}`;
        else if (label.toLowerCase().includes('twitter') || label.toLowerCase() === 'x') s = `https://twitter.com/${s.replace('@','')}`;
        else if (label.toLowerCase().includes('tiktok')) s = `https://tiktok.com/@${s.replace('@','')}`;
        else if (label.toLowerCase().includes('youtube')) s = `https://youtube.com/${s}`;
        else if (label.toLowerCase().includes('yelp')) s = `https://yelp.com/biz/${s}`;
        else if (label.toLowerCase().includes('opentable')) s = `https://www.opentable.com/r/${s}`;
        else s = `https://${s}`;
      }
      out.push({ label, url: s });
    };
    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'string') add('Link', item);
        else if (typeof item === 'object' && item) {
          for (const [k, v] of Object.entries(item)) add(k, v);
        }
      }
    } else if (typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) add(k, v);
    } else if (typeof data === 'string') {
      add('Link', data);
    }
    // Prefer stable order (some common first)
    const order = ['Website','Instagram','Facebook','Twitter','X','TikTok','YouTube','Yelp','OpenTable','Linktree'];
    out.sort((a,b) => (order.indexOf(a.label) === -1 ? 999 : order.indexOf(a.label)) - (order.indexOf(b.label) === -1 ? 999 : order.indexOf(b.label)) || a.label.localeCompare(b.label));
    return out;
  };

  // Icon picker for social labels
  const socialIconFor = (label: string) => {
    const l = (label || '').toLowerCase();
    const commonProps = { width: 14, height: 14 } as const;
    if (l.includes('instagram')) return <Instagram {...commonProps} />;
    if (l.includes('facebook')) return <Facebook {...commonProps} />;
    if (l === 'x' || l.includes('twitter')) return <Twitter {...commonProps} />;
    if (l.includes('youtube')) return <Youtube {...commonProps} />;
    if (l.includes('tiktok') || l.includes('yelp') || l.includes('opentable') || l.includes('linktree')) return <Globe {...commonProps} />;
    if (l.includes('website')) return <Globe {...commonProps} />;
    return <LinkIcon {...commonProps} />;
  };

  // Verification badge label helper: show when method implies call or visit
  const getVerifyLabel = (method?: VerificationMethod | string | null): string => {
    const m = (method ?? '').toString().trim().toLowerCase();
    if (!m) return '';
    const visitMatch = [
      'crunch team visited',
      'visited',
      'visit',
      'site visit',
      'in person',
      'in-person',
      'team visited'
    ].some((t) => m.includes(t));
    const callMatch = [
      'crunch team called',
      'called',
      'call',
      'phone',
      'phone call',
      'phone-call',
      'phone verified',
      'phone-verified',
      'called by crunch',
      'team called'
    ].some((t) => m.includes(t));
    if (visitMatch || callMatch) return 'Verified By Crunch';
    return '';
  };

  const filteredRestaurants = useMemo<Restaurant[]>(() => {
    if (!restaurants) return [];
    let filtered = restaurants.filter(restaurant => {
      const city = getCity(restaurant);
      const matchesCity = city === canonicalCity(selectedCity);
      const matchesSearch = restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           restaurant.cuisine.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           restaurant.neighborhood.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Normalize dietary tags from DB and selection, then intersect
      const dbDietSet = new Set((restaurant.dietaryTags || []).map(canonicalDiet));
      const selectedDiet = (selectedFilters.diet || []).map(canonicalDiet);
      const matchesDiet = selectedDiet.length === 0 || selectedDiet.some(d => dbDietSet.has(d));
      
      const matchesOils = selectedFilters.oils.length === 0 ||
                         selectedFilters.oils.some(oil => restaurant.oilsUsed.includes(oil));
      
      const matchesNeighborhood = !selectedFilters.neighborhood || 
                                 restaurant.neighborhood === selectedFilters.neighborhood;
      
      const matchesPrice = !selectedFilters.priceRange || 
                          restaurant.priceRange === selectedFilters.priceRange;
      
      const matchesVerified = !selectedFilters.verified || restaurant.verified;

      return matchesCity && matchesSearch && matchesDiet && matchesOils && matchesNeighborhood && matchesPrice && matchesVerified;
    });

    // Sort results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'price':
          return a.priceRange.length - b.priceRange.length;
        case 'verified':
          return (b.verified ? 1 : 0) - (a.verified ? 1 : 0);
        case 'updated':
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [restaurants, searchQuery, selectedFilters, selectedCity, sortBy]);

  // Featured list for homepage (top 3 by rating for selected city)
  const homeFeatured = useMemo<Restaurant[]>(() => {
    const inCity = restaurants.filter(r => getCity(r) === canonicalCity(selectedCity));
    const sorted = [...inCity].sort((a, b) => b.rating - a.rating);
    return sorted.slice(0, 3);
  }, [restaurants, selectedCity]);

  // Derive cities from DB data and compute homepage stats from data
  const dbCities = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const r of restaurants) {
      const c = getCity(r);
      if (c) set.add(c);
    }
    return Array.from(set);
  }, [restaurants]);

  const homeStats = useMemo(() => {
    const inCity = restaurants.filter(r => getCity(r) === canonicalCity(selectedCity));
    const totalInCity = inCity.length;
    const verifiedInCity = verifiedInSelectedCity; // city-specific per request
    const avg = totalInCity > 0 ? (inCity.reduce((acc, r) => acc + (r.rating || 0), 0) / totalInCity) : 0;
    return {
      totalInCity,
      verifiedInCity,
      citiesCovered: coverageCities.length || dbCities.length,
      avgRating: avg,
    };
  }, [restaurants, selectedCity, dbCities, coverageCities.length, verifiedInSelectedCity]);

  const handleFilterChange = (type: keyof Filters, value: string | boolean) => {
    setSelectedFilters(prev => {
      if (type === 'diet' || type === 'oils') {
        const arr = [...(prev[type] as string[])];
        const strVal = value as string;
        const exists = arr.includes(strVal);
        const nextArr = exists ? arr.filter(item => item !== strVal) : [...arr, strVal];
        return { ...prev, [type]: nextArr } as Filters;
      }
      if (type === 'verified') {
        return { ...prev, verified: Boolean(value) };
      }
      if (type === 'priceRange' || type === 'neighborhood') {
        return { ...prev, [type]: value as string } as Filters;
      }
      return prev;
    });
  };

  const clearAllDietFilters = () => setSelectedFilters(prev => ({ ...prev, diet: [] }));

  const clearFilters = () => {
    setSelectedFilters({
      diet: [],
      oils: [],
      neighborhood: '',
      priceRange: '',
      verified: false
    });
    setSearchQuery('');
  };

  const showToastMessage = (message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const notice: ToastNotice = { id, message, type };
    setToasts(prev => [...prev, notice]);
    // auto-dismiss after 3.5s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  // Scroll-to-top visibility (show after minimal scroll)
  useEffect(() => {
    const threshold = 120; // px
    const onScroll = () => setShowScrollTop(window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSubmission = async (): Promise<boolean> => {
    if (!newSubmission.name.trim() || !newSubmission.address.trim()) {
      showToastMessage('Please fill in the restaurant name and address.', 'error');
      return false;
    }

    const payload = {
      name: newSubmission.name,
      address: newSubmission.address,
      neighborhood: newSubmission.neighborhood,
      city: newSubmission.city,
      website: normalizeUrl(newSubmission.website) || null,
      notes: newSubmission.notes,
    };

    const { error } = await supabase
      .from('restaurant_suggestions')
      .insert([payload]);

    if (error) {
      console.error('restaurant_suggestions insert error', { code: (error as any).code, details: (error as any).details, hint: (error as any).hint, message: error.message });
      showToastMessage(`Failed to submit: ${error.message}`, 'error');
      return false;
    }

    // Successfully inserted; no local list to update for suggestions
    setNewSubmission({ name: '', address: '', neighborhood: '', city: 'NYC', website: '', notes: '' });
    setShowSubmissionForm(false);
    showToastMessage('Thank you for your submission! We will review it and add it to our directory.');
    return true;
  };

  // Auth: Magic link and GitHub OAuth (requires provider configured in Supabase)
  const handleAdminLogin = async () => {
    try {
      if (authEmail.trim()) {
        const { error } = await supabase.auth.signInWithOtp({ email: authEmail });
        if (error) throw error;
        showToastMessage('Magic link sent! Check your email.');
        return;
      }
      const { error: ghError } = await supabase.auth.signInWithOAuth({ provider: 'github' });
      if (ghError) throw ghError;
    } catch (e: any) {
      showToastMessage(`Auth error: ${e.message ?? String(e)}`, 'error');
    }
  };

  // After auth, check user role in users table
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user;
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (!error && data) {
        const row = data as UserRow;
        setIsAdmin(row.role === 'admin');
      }
    });
    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, []);

  // Quick connectivity check to Supabase. Tries to query a sample table 'restaurants'.
  // If your table does not exist yet, this will still confirm connectivity by returning an error from Supabase.
  const testSupabase = async () => {
    try {
      const { data, error } = await supabase.from('restaurants').select('*').limit(1);
      if (error) {
        // If we get an error, it still proves we reached Supabase; surface message to help setup.
        showToastMessage(`Supabase reachable. Query error: ${error.message}`, 'info');
      } else {
        const count = Array.isArray(data) ? data.length : 0;
        showToastMessage(`Supabase OK. Sample query returned ${count} row(s).`);
      }
    } catch (e: any) {
      showToastMessage(`Supabase connection failed: ${e.message ?? String(e)}`, 'error');
    }
  };

  const approveSubmission = async (submissionId: number) => {
    const submission = pendingSubmissions.find(s => s.id === submissionId);
    if (!submission) return;

    const newRestaurantInsert = toRestaurantInsertFromPending(submission);

    const { data: inserted, error: insertErr } = await supabase
      .from('restaurants')
      .insert(newRestaurantInsert)
      .select('*')
      .single();
    if (insertErr) {
      showToastMessage(`Approve failed: ${insertErr.message}`, 'error');
      return;
    }

    const { error: deleteErr } = await supabase
      .from('pending')
      .delete()
      .eq('id', submissionId);
    if (deleteErr) {
      showToastMessage(`Warning: added to restaurants but failed to remove pending: ${deleteErr.message}`, 'error');
    }

    if (inserted) {
      // Optimistic update
      setRestaurants(prev => [...prev, mapRestaurantRow(inserted as unknown as RestaurantRow)]);
    }
    setPendingSubmissions(prev => prev.filter(s => s.id !== submissionId));
    showToastMessage('Submission approved and added to listings!');
    // Re-fetch to ensure consistency
    fetchData(true);
  };

  const rejectSubmission = async (submissionId: number) => {
    const { error } = await supabase
      .from('pending')
      .delete()
      .eq('id', submissionId);
    if (error) {
      showToastMessage(`Failed to reject: ${error.message}`, 'error');
      return;
    }
    setPendingSubmissions(prev => prev.filter(s => s.id !== submissionId));
    showToastMessage('Submission rejected and removed.');
    fetchData(true);
  };

  const RestaurantCard: React.FC<{ restaurant: Restaurant; detailed?: boolean }> = ({ restaurant, detailed = false }) => (
    <div
      className="card featured"
      onClick={() => { setSelectedRestaurant(restaurant); setShowDetailModal(true); }}
      onMouseEnter={() => setHoveredRestaurant(restaurant)}
    >
      <div className="featured-media">
        <img
          src={restaurant.imageUrl}
          alt={restaurant.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=1600&auto=format&fit=crop'; }}
        />
        <div className="badge price">{restaurant.priceRange}</div>
        {getVerifyLabel(restaurant.verificationMethod) && (
          <div className="badge verify"><Check width={14} height={14} /> {getVerifyLabel(restaurant.verificationMethod)}</div>
        )}
      </div>
      <div className="featured-body">
        <div className="featured-top">
          <h3 className="featured-name">{restaurant.name}</h3>
          <div className="rating" style={{ color: '#fbbf24' }} aria-label={`Rating ${restaurant.rating || 0} out of 5`}>
            <Star width={16} height={16} fill="currentColor" stroke="none" /> {restaurant.rating ? restaurant.rating.toFixed(1) : '-'}
          </div>
        </div>
        <div className="meta-row">
          <span>{restaurant.neighborhood}</span>
          <span className="dot" />
          <span>{restaurant.cuisine}</span>
        </div>
        {/* Address and Maps link (shown above tags) */}
        {(restaurant.address || getCity(restaurant)) && (
          <div className="muted small address-row" style={{ display: 'flex', alignItems: 'center', gap: '.35rem', marginTop: '.12rem', flexWrap: 'wrap' }}>
            <MapPinIcon width={14} height={14} />
            <span>{restaurant.address}{getCity(restaurant) ? `, ${getCity(restaurant)}` : ''}</span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.address || ''}${getCity(restaurant) ? `, ${getCity(restaurant)}` : ''}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
              aria-label={`View ${restaurant.name} on Google Maps`}
            >
              View on Google Maps <ExternalLink width={12} height={12} />
            </a>
          </div>
        )}
        {restaurant.dietaryTags && restaurant.dietaryTags.length > 0 && (
          <div className="chips" style={{ marginTop: '.5rem' }}>
            {restaurant.dietaryTags.slice(0, 3).map((t) => (
              <span className="chip" key={canonicalDiet(t) || t}>{displayDiet(t)}</span>
            ))}
            {restaurant.dietaryTags.length > 3 && (
              <span className="chip">+{restaurant.dietaryTags.length - 3}</span>
            )}
          </div>
        )}
        {detailed && (
          <>
            <div className="muted small" style={{ marginTop: '.6rem' }}>
              Uses: {restaurant.oilsUsed && restaurant.oilsUsed.length > 0 ? restaurant.oilsUsed.join(', ') : '-'}
            </div>
            <div className="muted small">
              Avoids: {restaurant.oilsAvoided && restaurant.oilsAvoided.length > 0 ? restaurant.oilsAvoided.join(', ') : '-'}
            </div>
            <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: '.35rem', marginTop: '.35rem' }}>
              <Calendar width={12} height={12} /> Updated {new Date(restaurant.lastUpdated).toLocaleDateString()}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="app">
      {/* Header */}
      <Header 
        searchQuery={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        onSearchSubmit={handleSearchSubmit}
        selectedCity={selectedCity}
        onCityChange={setSelectedCity}
        cityNames={(cityOptions.length ? cityOptions.map(c => c.name) : knownCities)}
        onAddRestaurant={() => navigate('suggest')}
        isAdmin={isAdmin}
        onAdminClick={() => navigate('admin')}
        onNavigate={navigate}
        currentView={currentView}
        onOpenFilters={() => setShowFilterModal(true)}
      />

      <main className="app-main">
        {currentView === 'home' && (
          <>
            {/* Hero Section */}
            <section className="hero hero-gradient">
              <div className="container-safe hero-inner">
                <h1 className="hero-title">
                  Discover Restaurants That <span className="accent-green">Crunch</span> Clean
                </h1>
                <p className="hero-sub">
                  Find restaurants in {selectedCity} that avoid industrial seed oils and prioritize your health
                </p>

                <div className="hero-controls">
                  <div className="city-select">
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="select"
                      aria-label="Select city"
                    >
                      {(cityOptions.length ? cityOptions.map(c => c.name) : knownCities).map((c: string) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field" style={{ flex: 1 }}>
                    <Search className="icon-left" width={20} height={20} />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search restaurants or cities"
                      className="input with-icon"
                      onKeyDown={(e) => { if (e.key === 'Enter') setCurrentView('results'); }}
                    />
                  </div>

                  <button className="btn primary" onClick={() => setCurrentView('results')}>Find Restaurants</button>
                </div>
              </div>
            </section>

            {/* Stats (live from database) */}
            <section className="container-safe section">
              <div className="stats-grid">
                <div className="card stat">
                  <div className="stat-value accent-green">{homeStats.totalInCity}</div>
                  <div className="stat-label">Restaurants in {selectedCity}</div>
                </div>
                <div className="card stat">
                  <div className="stat-value accent-blue">{homeStats.verifiedInCity}</div>
                  <div className="stat-label">Verified in {selectedCity}</div>
                </div>
                <div className="card stat">
                  <div className="stat-value">{homeStats.citiesCovered}</div>
                  <div className="stat-label">Cities Covered</div>
                </div>
                <div className="card stat">
                  <div className="stat-value">{homeStats.totalInCity > 0 ? (<span className="rating">{homeStats.avgRating.toFixed(1)}/5</span>) : '-' }
                  </div>
                  <div className="stat-label">Avg Rating in {selectedCity}</div>
                </div>
              </div>
            </section>

            {/* Featured */}
            <section className="container-safe section">
              <div className="section-head" style={{ marginBottom: '1.25rem' }}>
                <div>
                  <h2 className="section-title">Featured in {selectedCity}</h2>
                  <p className="section-sub">Handpicked restaurants our editors love right now.</p>
                </div>
                <button className="btn light" onClick={() => setCurrentView('results')}>View all</button>
              </div>
              <div className="featured-grid">
                {loading && homeFeatured.length === 0 ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={`fs-${i}`} className="card skeleton-card">
                      <div className="skeleton skeleton-media" />
                      <div className="featured-body">
                        <div className="skeleton-line lg" style={{ width: '60%' }} />
                        <div style={{ height: '.6rem' }} />
                        <div className="skeleton-line" style={{ width: '70%' }} />
                        <div style={{ height: '.6rem' }} />
                        <div className="skeleton-line sm" style={{ width: '35%' }} />
                      </div>
                    </div>
                  ))
                ) : (
                  homeFeatured.map((restaurant) => (
                    <div key={restaurant.id} className="card featured" onClick={() => { setSelectedRestaurant(restaurant); setShowDetailModal(true); }}>
                      <div className="featured-media">
                        <img
                          src={restaurant.imageUrl}
                          alt={restaurant.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=1600&auto=format&fit=crop'; }}
                        />
                        <div className="badge price">{restaurant.priceRange}</div>
                        {getVerifyLabel(restaurant.verificationMethod) && (
                          <div className="badge verify"><Check width={14} height={14} /> {getVerifyLabel(restaurant.verificationMethod)}</div>
                        )}
                      </div>
                      <div className="featured-body">
                        <div className="featured-top">
                          <h3 className="featured-name">{restaurant.name}</h3>
                          <div className="rating"><Star width={16} height={16} fill="currentColor" stroke="none" /> {restaurant.rating ? restaurant.rating.toFixed(1) : '-'}</div>
                        </div>
                        <div className="meta-row">
                          <span>{restaurant.neighborhood}</span>
                          <span className="dot" />
                          <span>{restaurant.cuisine}</span>
                        </div>
                        <div className="taglist">
                          {restaurant.dietaryTags.slice(0,3).map((t) => (
                            <span key={canonicalDiet(t) || t} className="tag">{displayDiet(t)}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {homeFeatured.length === 0 && (
                <div className="empty">No featured restaurants yet in {selectedCity}.</div>
              )}
            </section>

            {/* Newsletter */}
            <section className="container-safe section">
              <div className="newsletter">
                <div className="newsletter-grid">
                  <div>
                    <h2 className="section-title">Stay Updated</h2>
                    <p className="muted">Get notified when we add new restaurants or expand to new cities</p>
                  </div>
                  <form className="newsletter-form" onSubmit={(e) => { e.preventDefault(); handleSubscribe(); }}>
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="input"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                    />
                    <button type="submit" className="btn light">Subscribe</button>
                  </form>
                </div>
              </div>
            </section>

            {/* Footer is rendered globally below */}
          </>
        )}
        {currentView === 'suggest' && (
        <div className="container-safe section narrow suggest-page">
            <h2 className="h1">Suggest a Restaurant</h2>
            <p className="muted" style={{ marginBottom: '1rem' }}>Help us expand Crunch by suggesting a place. The more details you provide, the faster we can review it.</p>

            {suggestSuccess ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <h3 className="h2">Thanks for your suggestion!</h3>
                <p className="muted" style={{ marginBottom: '1rem' }}>We’ll review the details and add it to our directory if it meets our criteria.</p>
                <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => { setSuggestSuccess(false); setNewSubmission({ name: '', address: '', neighborhood: '', city: 'NYC', website: '', notes: '' }); setSuggestNameTouched(false); setSuggestAddressTouched(false); }}
                    className="btn light"
                  >
                    Suggest Another
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('results')}
                    className="btn primary"
                  >
                    Back to Results
                  </button>
                </div>
              </div>
            ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                // touch fields to show errors if invalid
                if (!newSubmission.name.trim()) setSuggestNameTouched(true);
                if (!newSubmission.address.trim()) setSuggestAddressTouched(true);
                const valid = newSubmission.name.trim().length > 0 && newSubmission.address.trim().length > 0;
                if (!valid) return;
                const ok = await handleSubmission();
                if (ok) setSuggestSuccess(true);
              }}
              className="form-grid card"
              style={{ padding: '1.25rem' }}
            >
              <div>
                <label htmlFor="sug-name" className="label">Restaurant Name</label>
                <input
                  id="sug-name"
                  type="text"
                  value={newSubmission.name}
                  onChange={(e) => setNewSubmission({ ...newSubmission, name: e.target.value })}
                  onBlur={() => setSuggestNameTouched(true)}
                  className="input"
                  placeholder="e.g., The Good Kitchen"
                  required
                />
                {suggestNameTouched && !newSubmission.name.trim() && (
                  <p className="small error">Restaurant name is required.</p>
                )}
              </div>
              <div>
                <label htmlFor="sug-address" className="label">Address</label>
                <input
                  id="sug-address"
                  type="text"
                  value={newSubmission.address}
                  onChange={(e) => setNewSubmission({ ...newSubmission, address: e.target.value })}
                  onBlur={() => setSuggestAddressTouched(true)}
                  className="input"
                  placeholder="Street, City, State"
                  required
                />
                {suggestAddressTouched && !newSubmission.address.trim() && (
                  <p className="small error">Address is required.</p>
                )}
              </div>
              <div className="form-grid-2">
                <div>
                  <label htmlFor="sug-neighborhood" className="label">Neighborhood</label>
                  <input
                    id="sug-neighborhood"
                    type="text"
                    value={newSubmission.neighborhood}
                    onChange={(e) => setNewSubmission({ ...newSubmission, neighborhood: e.target.value })}
                    className="input"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label htmlFor="sug-city" className="label">City</label>
                  <select
                    id="sug-city"
                    value={newSubmission.city}
                    onChange={(e) => setNewSubmission({ ...newSubmission, city: e.target.value })}
                    className="select"
                  >
                    {(cityOptions.length ? cityOptions.map(c => c.name) : knownCities).map((c: string) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="sug-website" className="label">Website</label>
                <input
                  id="sug-website"
                  type="text"
                  value={newSubmission.website}
                  onChange={(e) => setNewSubmission({ ...newSubmission, website: e.target.value })}
                  onBlur={() => setNewSubmission({ ...newSubmission, website: normalizeUrl(newSubmission.website) })}
                  className="input"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label htmlFor="sug-notes" className="label">Notes</label>
                <textarea
                  id="sug-notes"
                  rows={4}
                  value={newSubmission.notes}
                  onChange={(e) => setNewSubmission({ ...newSubmission, notes: e.target.value })}
                  className="input"
                  placeholder="Any info about oils used, verification, or why it should be added"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem', marginTop: '.25rem' }}>
                <button type="button" onClick={() => navigate('home')} className="btn light">Cancel</button>
                <button type="submit" disabled={!newSubmission.name.trim() || !newSubmission.address.trim()} className="btn primary">Submit Suggestion</button>
              </div>
            </form>
            )}
          </div>
        )}

        {currentView === 'contact' && (
          <div className="container-safe section narrow contact-page">
            <h2 className="h1">Contact Us</h2>
            <p className="muted" style={{ marginBottom: '1rem' }}>We read every message. Share feedback, partnerships, or issues below.</p>
            <ContactForm onNotify={(message, type) => showToastMessage(message, type as ToastType)} />
          </div>
        )}

        {currentView === 'about' && (
          <div className="container-safe section narrow">
            <h2 className="h1">About Crunch</h2>
            <div className="about-hero" style={{ marginBottom: '1rem' }}>
              <img
                src="https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=1600&auto=format&fit=crop"
                alt="Fresh, healthy ingredients arranged on a table"
                loading="lazy"
              />
              <div className="about-hero-caption">Real ingredients. Better choices.</div>
            </div>
            <p className="p" style={{ marginBottom: '.75rem' }}>
              Crunch helps you find restaurants that actually fit your lifestyle—whether you're avoiding seed oils, cutting gluten, eating plant-based, or just trying to feel better after a meal out.
            </p>
            <p className="p" style={{ marginBottom: '.75rem' }}>
              We get it: dining out with dietary restrictions can feel like a guessing game. That's why we're building a growing list of restaurants sourced by real people and backed by real research. You'll see which spots use better oils, cater to specific diets, and actually care about what they serve.
            </p>
            <p className="p" style={{ marginBottom: '1rem' }}>
              We keep things transparent—each listing shows when it was last reviewed and whether it's been verified by our team.
            </p>

            <h3 className="h2">How It Works</h3>
            <ul style={{ paddingLeft: '1.1rem', marginBottom: '1rem' }}>
              <li className="p"><strong>Suggest a restaurant</strong> you love (or wish you could trust). The more details you give, the faster we can check it out.</li>
              <li className="p"><strong>Verify with us</strong>—we reach out to restaurants and confirm details like ingredients, oils, and prep methods.</li>
              <li className="p"><strong>Discover better options</strong> by filtering listings by city, neighborhood, dietary need, or price.</li>
            </ul>

            <h3 className="h2">Why Crunch Exists</h3>
            <p className="p" style={{ marginBottom: '.5rem' }}>Because you deserve better choices.</p>
            <p className="p">
              Whether you're managing a health condition or just care about what you put in your body, we're here to make eating out easier. Our goal is to take the stress out of the search—and help more restaurants adopt ingredient-conscious, user-friendly practices along the way.
            </p>
          </div>
        )}

        {currentView === 'results' && (
          <div className="container-safe section">
            <div className="section-head" style={{ marginBottom: '1rem' }}>
              <h2 className="section-title">Results in {selectedCity}</h2>
              <div className="muted">{filteredRestaurants.length} places</div>
            </div>
            {loadError && (
              <div className="error" style={{ marginBottom: '1rem' }}>{loadError}</div>
            )}
            {/* Active filters chips */}
            {selectedFilters.diet.length > 0 && (
              <div className="chips" style={{ marginBottom: '1rem' }}>
                {selectedFilters.diet.map(tag => (
                  <button key={tag} className="chip" onClick={() => handleFilterChange('diet', tag)} title="Remove filter">
                    <span>{tag}</span> <span className="chip-close" aria-hidden>×</span>
                  </button>
                ))}
                <button className="btn link" onClick={clearFilters}>Clear All Filters</button>
              </div>
            )}
            {loading && filteredRestaurants.length === 0 && (
              <div className="results-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`rs-${i}`} className="card skeleton-card">
                    <div className="skeleton skeleton-media" />
                    <div className="featured-body">
                      <div className="skeleton-line lg" style={{ width: '55%' }} />
                      <div style={{ height: '.6rem' }} />
                      <div className="skeleton-line" style={{ width: '70%' }} />
                      <div style={{ height: '.6rem' }} />
                      <div className="skeleton-line sm" style={{ width: '35%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="results-grid">
              {filteredRestaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} detailed />
              ))}
            </div>
            {!loading && filteredRestaurants.length === 0 && (
              <div className="empty" style={{ padding: '2rem 0' }}>
                <div style={{ marginBottom: '.35rem' }}>
                  {searchQuery.trim()
                    ? (<>
                        No results for "<strong>{searchQuery}</strong>" in {selectedCity}.
                      </>)
                    : (<>No restaurants match your current filters in {selectedCity}.</>)}
                </div>
                <div className="muted" style={{ marginBottom: '.75rem' }}>
                  Don't see it? Help the community by suggesting a restaurant.
                </div>
                <button className="btn primary" onClick={() => navigate('suggest')}>Suggest a Restaurant</button>
              </div>
            )}
          </div>
        )}

        {currentView === 'admin' && (
          <div className="container-safe section narrow">
            {isAdmin ? (
              <div className="card" style={{ padding: '1.25rem' }}>
                <h2 className="h1">Admin Dashboard</h2>
                <p className="muted">Admin features coming soon...</p>
              </div>
            ) : (
              <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <p className="muted">You must be an admin to access this page.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Filter Modal */}
      {showFilterModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter restaurants"
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}
          onClick={() => setShowFilterModal(false)}
        >
          <div 
            className="card narrow filter-panel" 
            style={{ 
              maxHeight: '95vh', 
              overflow: 'auto', 
              padding: '1rem', 
              width: '100%', 
              maxWidth: '48rem',
              margin: '0 auto',
              borderRadius: '1rem'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-head" style={{ marginTop: 0 }}>
              <h3 className="h2">Filter by Dietary Restrictions</h3>
              <div className="brand-actions">
                <button className="btn light" onClick={() => { clearFilters(); }}>Clear</button>
                <button className="btn primary" onClick={() => { setShowFilterModal(false); navigate('results'); }}>Apply</button>
              </div>
            </div>
            <div className="form-grid" style={{ marginTop: '.5rem' }}>
              {/* General */}
              <div className="card" style={{ padding: '1rem' }}>
                <div className="h2" style={{ marginBottom: '.5rem' }}>General</div>
                {['Vegetarian','Vegan','Pescatarian','Plant-Based','Flexitarian'].map(opt => (
                  <label key={opt} className="label" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 500 }}>
                    <input type="checkbox" checked={selectedFilters.diet.includes(opt)} onChange={() => handleFilterChange('diet', opt)} /> {opt}
                  </label>
                ))}
              </div>
              {/* Religious */}
              <div className="card" style={{ padding: '1rem' }}>
                <div className="h2" style={{ marginBottom: '.5rem' }}>Religious</div>
                {['Kosher','Halal'].map(opt => (
                  <label key={opt} className="label" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 500 }}>
                    <input type="checkbox" checked={selectedFilters.diet.includes(opt)} onChange={() => handleFilterChange('diet', opt)} /> {opt}
                  </label>
                ))}
              </div>
              {/* Allergies */}
              <div className="card" style={{ padding: '1rem' }}>
                <div className="h2" style={{ marginBottom: '.5rem' }}>Allergies</div>
                {['Gluten-Free','Dairy-Free','Nut-Free','Soy-Free','Egg-Free','Shellfish-Free','Sesame-Free'].map(opt => (
                  <label key={opt} className="label" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 500 }}>
                    <input type="checkbox" checked={selectedFilters.diet.includes(opt)} onChange={() => handleFilterChange('diet', opt)} /> {opt}
                  </label>
                ))}
              </div>
              {/* Medical/Health */}
              <div className="card" style={{ padding: '1rem' }}>
                <div className="h2" style={{ marginBottom: '.5rem' }}>Medical/Health</div>
                {['Low FODMAP','Low-Sodium','Low-Sugar','Diabetic-Friendly','Heart-Healthy','Keto','Paleo','Whole30','Autoimmune Protocol (AIP)'].map(opt => (
                  <label key={opt} className="label" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 500 }}>
                    <input type="checkbox" checked={selectedFilters.diet.includes(opt)} onChange={() => handleFilterChange('diet', opt)} /> {opt}
                  </label>
                ))}
              </div>
              {/* Ingredient Avoidance */}
              <div className="card" style={{ padding: '1rem' }}>
                <div className="h2" style={{ marginBottom: '.5rem' }}>Ingredient Avoidance</div>
                {['Seed-Oil Free','No Added Sugar','No Artificial Sweeteners','Organic Ingredients','Locally Sourced'].map(opt => (
                  <label key={opt} className="label" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 500 }}>
                    <input type="checkbox" checked={selectedFilters.diet.includes(opt)} onChange={() => handleFilterChange('diet', opt)} /> {opt}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restaurant Detail Modal */}
      {showDetailModal && selectedRestaurant && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-overlay"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
            display: 'grid', placeItems: 'center', zIndex: 40
          }}
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 720, width: '92%', maxHeight: '90vh', background: '#fff', borderRadius: '1rem', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="featured-media">
              <img
                src={selectedRestaurant.imageUrl}
                alt={selectedRestaurant.name}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=1600&auto=format&fit=crop'; }}
              />
              <div className="badge price">{selectedRestaurant.priceRange}</div>
              {getVerifyLabel(selectedRestaurant.verificationMethod) && (
                <div className="badge verify"><Check width={14} height={14} /> {getVerifyLabel(selectedRestaurant.verificationMethod)}</div>
              )}
            </div>
            <div className="featured-body" style={{ padding: '1.1rem', display: 'grid', gap: '.95rem', lineHeight: 1.6 }}>
              {/* Name header at top */}
              <div
                className="h1"
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 900,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '.5rem'
                }}
              >
                <span style={{ textDecoration: 'underline' }}>{selectedRestaurant.name}</span>
                <span className="rating" style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '.25rem' }}>
                  <Star width={16} height={16} fill="currentColor" stroke="none" /> {selectedRestaurant.rating ? selectedRestaurant.rating.toFixed(1) : '-'}
                </span>
              </div>
              {/* Primary tags at top */}
              {selectedRestaurant.dietaryTags && selectedRestaurant.dietaryTags.length > 0 && (
                <div className="chips" style={{ marginTop: '.2rem' }}>
                  {selectedRestaurant.dietaryTags.map((t) => (
                    <span className="chip" key={canonicalDiet(t) || t}>{displayDiet(t)}</span>
                  ))}
                </div>
              )}
              {/* Oils summary under tags */}
              <div className="muted" style={{ display: 'grid', gap: '.25rem', marginTop: '-.25rem' }}>
                <div><strong style={{ color: 'var(--brand-green)' }}>Oils Used:</strong> {selectedRestaurant.oilsUsed?.length ? selectedRestaurant.oilsUsed.join(', ') : '-'}</div>
                <div><strong style={{ color: '#ef4444' }}>Oils Avoided:</strong> {selectedRestaurant.oilsAvoided?.length ? selectedRestaurant.oilsAvoided.join(', ') : '-'}</div>
                <div><strong>Celiac Safe:</strong> {selectedRestaurant.celiacSafe ? 'Yes' : 'No'}</div>
              </div>
              {/* Overview */}
              <div>
                <div className="h2" style={{ margin: 0, fontSize: '1.1rem', textDecoration: 'underline' }}>Overview</div>
                <div className="muted" style={{ display: 'grid', gap: '.5rem', marginTop: '.5rem' }}>
                  <div><strong>Name:</strong> {selectedRestaurant.name}</div>
                  <div><strong>Location (City):</strong> {getCity(selectedRestaurant) || selectedRestaurant.city || '-'}</div>
                  <div><strong>Neighborhood:</strong> {selectedRestaurant.neighborhood || '-'}</div>
                  <div><strong>Address:</strong> {selectedRestaurant.address || '-'}</div>
                  <div><strong>Hours:</strong> {selectedRestaurant.hours || '-'}</div>
                  <div><strong>Website:</strong> {selectedRestaurant.website ? <a className="link" href={normalizeUrl(selectedRestaurant.website)} target="_blank" rel="noopener noreferrer">{normalizeUrl(selectedRestaurant.website)} <ExternalLink width={12} height={12} /></a> : '-'}</div>
                  <div><strong>Phone:</strong> {selectedRestaurant.phone || '-'}</div>
                </div>
                {/* Removed duplicate address/map block per request */}
              </div>

              {/* Photos & Menu */}
              <div>
                <div className="h2" style={{ margin: 0, fontSize: '1.1rem', textDecoration: 'underline' }}>Photos & Menu</div>
                <div className="gallery-scroll" style={{ marginTop: '.4rem' }}>
                  {selectedRestaurant.imageUrls && selectedRestaurant.imageUrls.length > 0 && (
                    <div className="gallery-track">
                      {selectedRestaurant.imageUrls.slice(0, 6).map((url, idx) => (
                        <a key={`${url}-${idx}`} href={url} target="_blank" rel="noopener noreferrer" className="gallery-thumb skeleton">
                          <img src={url} alt={`Photo ${idx+1}`} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.6rem' }}>
                  {selectedRestaurant.menuLink && (
                    <a
                      className="btn light green-outline"
                      href={normalizeUrl(selectedRestaurant.menuLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Menu <ExternalLink width={14} height={14} />
                    </a>
                  )}
                  {selectedRestaurant.website && (
                    <a
                      className="btn light green-outline"
                      href={normalizeUrl(selectedRestaurant.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Website <ExternalLink width={14} height={14} />
                    </a>
                  )}
                  {selectedRestaurant.instagram && (
                    <a className="btn light green-outline" href={selectedRestaurant.instagram.startsWith('http') ? selectedRestaurant.instagram : `https://instagram.com/${selectedRestaurant.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer">
                      <Instagram width={14} height={14} /> Instagram
                    </a>
                  )}
                </div>
              </div>

              {/* Price & Ratings */}
              <div>
                <div className="h2" style={{ margin: 0, fontSize: '1.1rem', textDecoration: 'underline' }}>Price & Ratings</div>
                <div className="muted" style={{ display: 'grid', gap: '.5rem', marginTop: '.5rem' }}>
                  <div><strong>Price Range:</strong> {selectedRestaurant.priceRange || '-'}</div>
                  <div><strong>Rating:</strong> {selectedRestaurant.rating ? selectedRestaurant.rating.toFixed(1) : '-'}</div>
                </div>
              </div>

              {/* Amenities */}
              <div>
                <div className="h2" style={{ margin: 0, fontSize: '1.1rem', textDecoration: 'underline' }}>Amenities</div>
                <div className="muted" style={{ display: 'grid', gap: '.5rem', marginTop: '.5rem' }}>
                  <div><strong>Verified:</strong> {getVerifyLabel(selectedRestaurant.verificationMethod) ? 'Yes' : 'No'}</div>
                  <div><strong>Outdoor Seating:</strong> {selectedRestaurant.outdoorSeating ? 'Yes' : 'No'}</div>
                  <div><strong>Delivery:</strong> {selectedRestaurant.delivery ? 'Yes' : 'No'}</div>
                  <div><strong>Family Friendly:</strong> {selectedRestaurant.familyFriendly ? 'Yes' : 'No'}</div>
                </div>
              </div>

              {/* House Favorites */}
              <div>
                <div className="h2" style={{ margin: 0, fontSize: '1.1rem', textDecoration: 'underline' }}>House Favorites</div>
                <div className="muted" style={{ display: 'grid', gap: '.5rem', marginTop: '.5rem' }}>
                  {/* Recommended dishes as cards */}
                  {(() => {
                    const dishes = normalizeRecommendedDishes(selectedRestaurant.recommendedDishes);
                    if (!dishes.length) {
                      return <div><strong>Recommended Dishes:</strong> -</div>;
                    }
                    return (
                      <div>
                        <div style={{ display: 'grid', gap: '.6rem' }}>
                          {dishes.map((d, idx) => (
                            <div key={`${d.title}-${idx}`} className="card" style={{ padding: '.8rem', borderRadius: '.75rem' }}>
                              <div style={{ fontWeight: 800, marginBottom: '.25rem' }}>{d.title}</div>
                              {d.note && (
                                <div className="muted" style={{ fontSize: '.9rem', marginBottom: '.35rem' }}>{d.note}</div>
                              )}
                              {d.tags && d.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                                  {d.tags.map((t) => (
                                    <span key={t} style={{
                                      display: 'inline-flex', alignItems: 'center',
                                      padding: '.25rem .5rem', borderRadius: '999px',
                                      background: 'var(--brand-green)', color: '#fff',
                                      fontSize: '.7rem', fontWeight: 700
                                    }}>{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Oils moved to top */}
                </div>
              </div>

              {/* Stay Connected */}
              <div>
                <div className="h2" style={{ margin: 0, fontSize: '1.1rem', textDecoration: 'underline' }}>Stay Connected</div>
                <div className="muted" style={{ display: 'grid', gap: '.5rem', marginTop: '.5rem' }}>
                  {(() => {
                    const links = normalizeSocialLinks(selectedRestaurant.socialLinks);
                    if (!links.length) return <div>-</div>;
                    return (
                      <div style={{ display: 'grid', gap: '.35rem' }}>
                        {links.map((l, idx) => (
                          <div key={`${l.label}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              {socialIconFor(l.label)}
                            </span>
                            <span><strong>{l.label}:</strong> <a className="link" href={l.url} target="_blank" rel="noopener noreferrer">{l.url} <ExternalLink width={12} height={12} /></a></span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Listing Details */}
              <div>
                <div className="h2" style={{ margin: 0, fontSize: '1.1rem', textDecoration: 'underline' }}>Listing Details</div>
                <div className="muted" style={{ display: 'grid', gap: '.5rem', marginTop: '.5rem' }}>
                  <div><strong>Last Updated:</strong> {selectedRestaurant.lastUpdated ? new Date(selectedRestaurant.lastUpdated).toLocaleString() : '-'}</div>
                  <div><strong>Verification Method:</strong> {selectedRestaurant.verificationMethod || '-'}</div>
                  <div><strong>Verification Date:</strong> {selectedRestaurant.verificationDate ? new Date(selectedRestaurant.verificationDate).toLocaleDateString() : '-'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '.3rem' }}>
                <button className="btn light" onClick={() => setShowDetailModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer (global, consistent across pages) */}
      <Footer 
        onNavigate={navigate}
        onSuggest={() => navigate('suggest')}
        cities={coverageCities.length ? coverageCities : (cityOptions.length ? cityOptions.map(c => c.name) : knownCities)}
        restaurantsCount={restaurants.length}
        verifiedCount={siteWideVerifiedCount}
      />

      {/* Toasts */}
      <div className="toasts">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${
              t.type === 'success' ? 'toast-success' :
              t.type === 'error' ? 'toast-error' :
              'toast-info'
            }`}
          >
            <span>{t.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="btn link"
              aria-label="Dismiss"
            >
              <X width={16} height={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Back to Top (results view) */}
      {currentView === 'results' && showScrollTop && (
        <button
          className="back-to-top"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed',
            right: 'calc(0.85rem + env(safe-area-inset-right))',
            bottom: 'calc(0.85rem + env(safe-area-inset-bottom))',
            height: '2.9rem',
            width: '2.9rem',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '999px',
            background: '#111827',
            color: '#fff',
            boxShadow: '0 10px 20px -12px rgba(0,0,0,.4)',
            zIndex: 70
          }}
        >
          <ChevronUp width={18} height={18} />
        </button>
      )}
    </div>
  );
}

export default CrunchApp;