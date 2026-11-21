import React, { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } from "react";
import {
  Search, Heart, ShoppingBag, X, Sparkles, Camera, Upload, ChevronRight, ChevronLeft,
  Check, SlidersHorizontal, RotateCcw, Repeat, Trash2, Plus, Minus, User,
  Package, LayoutGrid, BarChart3, Settings, ArrowLeft, ScanFace, ImageUp, RefreshCw,
  Truck, CircleAlert, Info, Menu, Scale , LogOut, ShieldCheck
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import EarringArt, { COLOR_HEX } from "./EarringArt";
import {
  mapVideoToContainer,
  isStudEarring,
  getProductTryOnImage,
  getProductJewelleryType,
  getProductTryOnAssets,
  isChokerNecklace
} from "./services/earGeometry";
import { Button, Rating, Toast, Spinner, ErrorBanner, ProductImage, money } from "./ui";
import { api, setToken , setStoredUser, getStoredUser  } from "./api";
import { analyzeOutfitImage, OutfitAnalysisError, MANUAL_COLOR_OPTIONS } from "./services/outfitColorAnalysis";
import SuperAdminPortal from "./superadmin/SuperAdminPortal";
import SocialLinks from "./components/SocialLinks";
import { getTransparentJewelleryImage } from "./services/transparentJewelleryService";
import OrderTrackingModal from "./components/OrderTrackingModal";
import ProductReviewsSection from "./components/ProductReviewsSection";
import ServicesView from "./components/ServicesView";
import DeliveryBoyPortal from "./components/DeliveryBoyPortal";

const SERIF = { fontFamily: "'Cormorant Garamond', serif" };
const CATEGORIES_FALLBACK = ["stud","hoop","drop","jhumka","chandbali","huggie","statement","pearl","bridal","minimal"];
const FACE_SHAPES = ["Oval", "Round", "Square", "Heart", "Long", "Diamond"];
// User-facing copy for each FaceShapeErrorCode (see services/faceShapeDetection.js).
// Every case the spec asked to handle gracefully has a distinct, actionable
// message here — none of them are a generic "something went wrong."
const SELFIE_ERROR_MESSAGES = {
  NO_FACE_DETECTED: "We couldn't find a face in that photo. Try a clear, front-facing shot.",
  MULTIPLE_FACES_DETECTED: "That photo has more than one face — please use a solo photo.",
  LOW_CONFIDENCE: "The result was too close to call between two shapes. Try a different angle or better lighting, or select your shape manually below.",
  POOR_LIGHTING: "We couldn't get a clear read — try brighter, more even lighting.",
  UNSUPPORTED_IMAGE: "That file couldn't be processed. Try a different photo (JPG or PNG).",
  MODEL_LOAD_FAILED: "Face detection couldn't load — check your connection, or select your shape manually below.",
};

const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

/* ============================================================================
   HEADER
   ============================================================================ */
function Header() {
  const { nav, cartCount, wishlist, setSearchOpen, setCartOpen, page, user } = useApp();
  const [mobileNav, setMobileNav] = useState(false);
  const links = [
    { id: "home", label: "Home" },
    { id: "collection", label: "Shop" },
    { id: "stylist", label: "AI Stylist" },
    { id: "services", label: "Services" },
    { id: "wishlist", label: "Wishlist" }
  ];
  const isAdmin = user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN");
  const isDelivery = user && user.role === "DELIVERY_BOY";

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-border">
      <div className="max-w-[1300px] mx-auto px-5 md:px-8 h-[68px] flex items-center justify-between">
        <div className="flex items-center gap-3 md:hidden"><button onClick={() => setMobileNav(v => !v)}><Menu size={22} /></button></div>
        <button onClick={() => nav("home")} className="font-serif text-[26px] tracking-wide" style={SERIF}>Aurélie</button>
        <nav className="hidden md:flex items-center gap-9 text-[13.5px]">
          {links.map(l => (
            <button key={l.id} onClick={() => nav(l.id)} className={`pb-1 border-b ${page === l.id ? "border-primaryDark" : "border-transparent text-textSecondary hover:text-textPrimary"}`}>{l.label}</button>
          ))}
          {isAdmin && (
            <button
              onClick={() => nav("superadmin")}
              className="px-2.5 py-1 text-[12px] font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 rounded-full flex items-center gap-1.5 transition shadow-xs"
            >
              <ShieldCheck size={14} className="text-sky-600" />
              Super Admin
            </button>
          )}
          {isDelivery && (
            <button
              onClick={() => nav("delivery")}
              className="px-2.5 py-1 text-[12px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-full flex items-center gap-1.5 transition shadow-xs"
            >
              <Truck size={14} className="text-emerald-600" />
              Courier Portal
            </button>
          )}
        </nav>
        <div className="flex items-center gap-4 md:gap-5">
          {isAdmin && (
            <button
              onClick={() => nav("superadmin")}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition shadow-sm"
              title="Open Super Admin Portal"
            >
              <ShieldCheck size={14} />
              Portal
            </button>
          )}
          {isDelivery && (
            <button
              onClick={() => nav("delivery")}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-sm"
              title="Open Delivery App"
            >
              <Truck size={14} />
              Deliveries
            </button>
          )}
          <button onClick={() => setSearchOpen(true)}><Search size={19} strokeWidth={1.6} /></button>
          <button onClick={() => nav("wishlist")} className="relative hidden sm:inline-flex">
            <Heart size={19} strokeWidth={1.6} />
            {wishlist.length > 0 && <span className="absolute -top-2 -right-2 bg-primaryDark text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{wishlist.length}</span>}
          </button>
          <button onClick={() => nav("profile")} className="hidden sm:inline-flex"><User size={19} strokeWidth={1.6} /></button>
          <button onClick={() => setCartOpen(true)} className="relative">
            <ShoppingBag size={19} strokeWidth={1.6} />
            {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-primaryDark text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
          </button>
        </div>
      </div>
      {mobileNav && (
        <div className="md:hidden border-t border-border px-5 py-4 flex flex-col gap-4 text-[14px]">
          {links.map(l => <button key={l.id} className="text-left" onClick={() => { nav(l.id); setMobileNav(false); }}>{l.label}</button>)}
          <button className="text-left" onClick={() => { nav("profile"); setMobileNav(false); }}>Profile</button>
          {isAdmin && (
            <button className="text-left font-semibold text-sky-700 flex items-center gap-2" onClick={() => { nav("superadmin"); setMobileNav(false); }}>
              <ShieldCheck size={16} /> Super Admin
            </button>
          )}
          {isDelivery && (
            <button className="text-left font-semibold text-emerald-700 flex items-center gap-2" onClick={() => { nav("delivery"); setMobileNav(false); }}>
              <Truck size={16} /> Courier Portal
            </button>
          )}
        </div>
      )}
    </header>
  );
}

function SearchOverlay() {
  const { searchOpen, setSearchOpen, nav } = useApp();
  const [val, setVal] = useState("");
  if (!searchOpen) return null;
  const submit = () => { setSearchOpen(false); nav("collection", { q: val }); };
  return (
    <div className="fixed inset-0 z-[90] bg-[#0B1C2C]/40 flex items-start justify-center pt-24 px-5" onClick={() => setSearchOpen(false)}>
      <div className="bg-surface w-full max-w-[560px] p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-primaryDark pb-3">
          <Search size={18} />
          <input autoFocus value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Search style, material, colour, occasion…" className="flex-1 bg-transparent outline-none text-[15px]" />
          <button onClick={() => setSearchOpen(false)}><X size={18} /></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Gold", "Pearl", "Bridal", "Minimal", "Hoop"].map(s => (
            <button key={s} onClick={() => { setSearchOpen(false); nav("collection", { q: s }); }} className="text-[12px] px-3 py-1.5 border border-border hover:border-primaryDark">{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   PRODUCT CARD
   ============================================================================ */
function WishlistButton({ id, className = "" }) {
  const { wishlist, toggleWishlist } = useApp();
  const active = wishlist.includes(id);
  return (
    <button onClick={(e) => { e.stopPropagation(); toggleWishlist(id); }} className={className}>
      <Heart size={17} strokeWidth={1.6} className={active ? "fill-danger text-danger" : "text-textPrimary"} />
    </button>
  );
}

function EarringCard({ product, onOpen, onTryOn }) {
  const { addToCart, compare, toggleCompare } = useApp();
  const [hover, setHover] = useState(false);
  const onSale = product.originalPrice && product.originalPrice > product.price;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="relative bg-primaryLight aspect-[4/5] flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => onOpen(product)}>
        <ProductImage product={product} size={hover ? 108 : 96} className="transition-all duration-300" />
        {onSale && <span className="absolute top-3 left-3 bg-danger text-white text-[10px] tracking-wide px-2 py-1">SALE</span>}
        <WishlistButton id={product.id} className="absolute top-3 right-3 bg-surface/90 w-8 h-8 flex items-center justify-center rounded-full" />
        <div className={`absolute left-0 right-0 bottom-0 p-2.5 flex gap-2 transition-all duration-300 ${hover ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
          <Button size="sm" variant="gold" className="flex-1 !py-2" onClick={(e) => { e.stopPropagation(); onTryOn(product); }}><Sparkles size={13} /> Try On</Button>
          <button onClick={(e) => { e.stopPropagation(); onOpen(product); }} className="bg-surface w-9 flex items-center justify-center"><Info size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); toggleCompare(product.id); }} className={`w-9 flex items-center justify-center ${compare.includes(product.id) ? "bg-primaryDark text-white" : "bg-surface"}`}><Scale size={14} /></button>
        </div>
      </div>
      <div className="pt-3">
        <p className="text-[13.5px] leading-snug">{product.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[13.5px]">{money(product.price)}</span>
          {onSale && <span className="text-[12px] text-textSecondary line-through">{money(product.originalPrice)}</span>}
        </div>
        <div className="mt-1"><Rating value={product.rating} count={product.reviews} /></div>
      </div>
    </div>
  );
}

/* ============================================================================
   HOME
   ============================================================================ */
function Home() {
  const { nav, openTryOn, openProduct } = useApp();
  const [trending, setTrending] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    setStatus("loading");
    Promise.all([api.getProducts({ sort: "popular" }), api.getCategories()])
      .then(([p, c]) => { setTrending(p.results.slice(0, 8)); setCategories(c); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div>
      <section className="max-w-[1300px] mx-auto px-5 md:px-8 pt-10 md:pt-16 pb-16 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-[12px] tracking-[0.18em] text-primaryDark mb-5">EARRINGS, RECONSIDERED</p>
          <h1 className="text-[42px] sm:text-[54px] leading-[1.08] mb-6" style={SERIF}>Find the earrings that feel like you.</h1>
          <p className="text-[15px] text-textSecondary leading-relaxed max-w-[440px] mb-8">Discover your perfect pair with AI-powered styling and try them on virtually before you buy.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => nav("collection")}>Explore Earrings <ChevronRight size={15} /></Button>
            <Button variant="outline" onClick={() => trending[0] && openTryOn(trending[0])}><Camera size={15} /> Try Earrings Virtually</Button>
            <Button variant="gold" onClick={() => nav("stylist")}><Sparkles size={15} /> Find My Perfect Earrings</Button>
          </div>
        </div>
        <div className="relative bg-primaryLight aspect-[4/5] flex items-center justify-center">
          <div className="absolute inset-8 border border-primary/60" />
          <div className="flex gap-10">
            <EarringArt kind="chandbali" color="Gold" size={130} />
            <EarringArt kind="pearl-drop" color="Pearl" size={130} />
          </div>
        </div>
      </section>

      <section className="max-w-[1300px] mx-auto px-5 md:px-8 pb-16">
        <h2 className="text-[26px] mb-6" style={SERIF}>Shop by Category</h2>
        {status === "loading" && <Spinner label="Loading categories…" />}
        {status === "error" && <ErrorBanner message="Couldn't reach the backend. Is the API server running on :4000?" />}
        {status === "ready" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {categories.map(c => (
              <button key={c.id} onClick={() => nav("collection", { category: c.id })} className="group text-left">
                <div className="bg-primaryLight aspect-square flex items-center justify-center mb-2.5 group-hover:bg-primary/15 transition-colors">
                  <EarringArt kind="drop" color="Gold" size={64} />
                </div>
                <p className="text-[12.5px]">{c.name} <span className="text-textSecondary">({c.productCount})</span></p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="max-w-[1300px] mx-auto px-5 md:px-8 pb-16">
        <div className="flex items-end justify-between mb-6"><h2 className="text-[26px]" style={SERIF}>Trending Now</h2><button onClick={() => nav("collection")} className="text-[12.5px] underline underline-offset-4">View all</button></div>
        {status === "loading" && <Spinner />}
        {status === "ready" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-9">
            {trending.map(p => <EarringCard key={p.id} product={p} onOpen={openProduct} onTryOn={openTryOn} />)}
          </div>
        )}
      </section>

      <section className="bg-primaryDark text-white">
        <div className="max-w-[1300px] mx-auto px-5 md:px-8 py-16 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-[12px] tracking-[0.18em] text-primary mb-4">PERSONAL STYLING</p>
            <h2 className="text-[32px] leading-tight mb-4" style={SERIF}>Not sure what suits you?</h2>
            <p className="text-[14.5px] text-white/70 leading-relaxed max-w-[440px] mb-7">Let our AI stylist find earrings that complement your face shape, style, outfit and occasion.</p>
            <Button variant="gold" onClick={() => nav("stylist")}><Sparkles size={15} /> Ask AI Stylist</Button>
          </div>
          <div className="flex justify-center gap-6">
            {["chandbali","hoop","pearl-drop"].map((k,i) => (
              <div key={k} className="bg-inkSoft p-6 flex items-center justify-center" style={{ marginTop: i===1?24:0 }}><EarringArt kind={k} color={i===2?"Pearl":"Gold"} size={54} /></div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[1300px] mx-auto px-5 md:px-8 py-16 grid md:grid-cols-2 gap-10 items-center">
        <div className="relative bg-primaryLight aspect-[4/5] flex items-center justify-center order-2 md:order-1">
          <div className="absolute inset-8 border border-primary/40 rounded-full" />
          <Camera size={64} className="text-primaryDark" strokeWidth={1.2} />
        </div>
        <div className="order-1 md:order-2">
          <p className="text-[12px] tracking-[0.18em] text-primaryDark mb-4">SEE IT ON YOU FIRST</p>
          <h2 className="text-[32px] leading-tight mb-4" style={SERIF}>Try it on, right from your camera.</h2>
          <p className="text-[14.5px] text-textSecondary leading-relaxed max-w-[440px] mb-7">Point your camera at yourself and see any earring on you live — no app to install, nothing uploaded. We track your face in real time and place the earring where your ear actually is, so you can see how it moves and catches the light before you buy.</p>
          <Button variant="gold" onClick={() => trending[0] && openTryOn(trending[0])}><Camera size={15} /> Try It On Now</Button>
        </div>
      </section>

      {/* Social / Community Strip */}
      <section className="bg-gradient-to-r from-sky-50/80 via-white to-blue-50/80 border-t border-border py-12">
        <div className="max-w-[1300px] mx-auto px-5 md:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-[11.5px] font-semibold tracking-[0.16em] text-sky-700 uppercase mb-1">Stay Inspired</p>
            <h3 className="text-[24px] text-slate-900" style={SERIF}>Follow Aurélie on Social Media</h3>
            <p className="text-[13px] text-textSecondary mt-1">Discover new earrings, daily styling inspiration, and behind-the-scenes artistry.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://www.instagram.com/theearringbar3/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Aurélie on Instagram @THEEARRINGBAR3 (opens in a new tab)"
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white text-slate-800 hover:text-slate-950 border border-slate-200 hover:border-pink-300 shadow-xs hover:shadow-sm text-[13px] font-medium transition-all group"
            >
              <span className="w-5 h-5 rounded-md bg-gradient-to-tr from-pink-500 to-amber-400 text-white flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </span>
              <span>Instagram <strong className="font-semibold text-slate-900 font-mono text-[12px]">@THEEARRINGBAR3</strong></span>
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61559333347423"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Aurélie on Facebook The Earring Bar (opens in a new tab)"
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white text-slate-800 hover:text-slate-950 border border-slate-200 hover:border-sky-300 shadow-xs hover:shadow-sm text-[13px] font-medium transition-all group"
            >
              <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </span>
              <span>Facebook <strong className="font-semibold text-slate-900">The Earring Bar</strong></span>
            </a>
            <a
              href="https://www.tiktok.com/@theearringbar3?lang=en"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Aurélie on TikTok @theearringbar3 (opens in a new tab)"
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white text-slate-800 hover:text-slate-950 border border-slate-200 hover:border-cyan-400 shadow-xs hover:shadow-sm text-[13px] font-medium transition-all group"
            >
              <span className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3" aria-hidden="true">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.27 6.27 0 0 0 1.86-4.49V8.71a8.17 8.17 0 0 0 4.91 1.62v-3.43a4.85 4.85 0 0 1-1-.21z"/>
                </svg>
              </span>
              <span>TikTok <strong className="font-semibold text-slate-900 font-mono text-[12px]">@theearringbar3</strong></span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================================================================
   COLLECTION
   ============================================================================ */
function FilterSidebar({ filters, setFilters, materials, colors, styles, occasions, mobileOpen, setMobileOpen }) {
  const Group = ({ title, children }) => <div className="py-5 border-b border-border"><p className="text-[11.5px] tracking-[0.12em] text-textSecondary mb-3">{title.toUpperCase()}</p>{children}</div>;
  const Radio_ = ({ label, checked, onClick }) => (
    <button onClick={onClick} className="flex items-center gap-2.5 text-[13px] py-1 w-full text-left">
      <span className={`w-[15px] h-[15px] border flex items-center justify-center ${checked ? "bg-primaryDark border-primaryDark" : "border-border"}`}>{checked && <Check size={11} className="text-white" />}</span>{label}
    </button>
  );
  const content = (
    <div>
      <Group title="Category">{CATEGORIES_FALLBACK.map(c => <Radio_ key={c} label={c} checked={filters.category === c} onClick={() => setFilters(f => ({ ...f, category: f.category === c ? "" : c }))} />)}</Group>
      <Group title="Price">
        {[[0,50,"Under $50"],[50,100,"$50–$100"],[100,200,"$100–$200"],[200,9999,"$200+"]].map(([lo,hi,label]) => (
          <Radio_ key={label} label={label} checked={filters.minPrice === lo} onClick={() => setFilters(f => ({ ...f, minPrice: f.minPrice === lo ? "" : lo, maxPrice: f.minPrice === lo ? "" : hi }))} />
        ))}
      </Group>
      <Group title="Material">{materials.map(m => <Radio_ key={m} label={m} checked={filters.material === m} onClick={() => setFilters(f => ({ ...f, material: f.material === m ? "" : m }))} />)}</Group>
      <Group title="Colour">{colors.map(c => <Radio_ key={c} label={c} checked={filters.color === c} onClick={() => setFilters(f => ({ ...f, color: f.color === c ? "" : c }))} />)}</Group>
      <Group title="Style">{styles.map(s => <Radio_ key={s} label={s} checked={filters.style === s} onClick={() => setFilters(f => ({ ...f, style: f.style === s ? "" : s }))} />)}</Group>
      <Group title="Occasion">{occasions.map(o => <Radio_ key={o} label={o} checked={filters.occasion === o} onClick={() => setFilters(f => ({ ...f, occasion: f.occasion === o ? "" : o }))} />)}</Group>
      <Group title="Rating">{[4.5,4,3].map(r => <Radio_ key={r} label={`${r}+ stars`} checked={filters.rating === r} onClick={() => setFilters(f => ({ ...f, rating: f.rating === r ? "" : r }))} />)}</Group>
      <div className="py-5"><Radio_ label="AI Recommended for me" checked={filters.aiOnly} onClick={() => setFilters(f => ({ ...f, aiOnly: !f.aiOnly }))} /></div>
      <button onClick={() => setFilters({ category: "", minPrice: "", maxPrice: "", material: "", color: "", style: "", occasion: "", rating: "", aiOnly: false })} className="text-[12px] underline text-textSecondary">Clear all filters</button>
    </div>
  );
  return (
    <>
      <aside className="hidden md:block w-[240px] shrink-0 pr-4">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[80] bg-[#0B1C2C]/40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-[86%] max-w-[340px] bg-surface p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2"><p className="text-[15px]">Filters</p><button onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
            {content}
            <Button className="w-full mt-4" onClick={() => setMobileOpen(false)}>Show results</Button>
          </div>
        </div>
      )}
    </>
  );
}

function Collection({ initial }) {
  const { openTryOn, openProduct, userPrefs, wishlist, viewed } = useApp();
  const [filters, setFilters] = useState({ category: initial?.category || "", minPrice: "", maxPrice: "", material: "", color: "", style: "", occasion: "", rating: "", aiOnly: false });
  const [sort, setSort] = useState("recommended");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [results, setResults] = useState([]);
  const [aiScored, setAiScored] = useState({});
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    setStatus("loading");
    const params = { ...filters, q: initial?.q || "", sort: sort === "recommended" ? "" : sort };
    delete params.aiOnly;
    api.getProducts(params)
      .then(async (r) => {
        setResults(r.results);
        // Ask the backend to score these results against the shopper's stored preferences.
        const rec = await api.getRecommendations(userPrefs || {}, 50).catch(() => []);
        const map = {}; rec.forEach(x => { map[x.product.id] = x; });
        setAiScored(map);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [filters, sort, initial?.q, initial?.category]);

  const finalResults = filters.aiOnly
    ? results.filter(p => (aiScored[p.id]?.score || 0) >= 60).sort((a,b) => (aiScored[b.id]?.score||0) - (aiScored[a.id]?.score||0))
    : results;

  const materials = [...new Set(results.map(p => p.material))];
  const colors = [...new Set(results.map(p => p.color))];
  const styles = [...new Set(results.map(p => p.style))];
  const occasions = [...new Set(results.flatMap(p => p.occasion || []))];

  return (
    <div className="max-w-[1300px] mx-auto px-5 md:px-8 py-10">
      <h1 className="text-[30px] mb-2" style={SERIF}>All Earrings</h1>
      {initial?.q && <p className="text-[13px] text-textSecondary mb-6">Showing results for "{initial.q}"</p>}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
        <button onClick={() => setMobileFilters(true)} className="md:hidden flex items-center gap-2 text-[13px]"><SlidersHorizontal size={15}/> Filters</button>
        <p className="text-[12.5px] text-textSecondary hidden md:block">{finalResults.length} results</p>
        <select value={sort} onChange={e => setSort(e.target.value)} className="bg-transparent text-[13px] outline-none">
          <option value="recommended">Recommended</option><option value="newest">Newest</option><option value="popular">Popular</option>
          <option value="priceLow">Price: Low to High</option><option value="priceHigh">Price: High to Low</option><option value="rating">Highest Rated</option>
        </select>
      </div>
      <div className="flex">
        <FilterSidebar filters={filters} setFilters={setFilters} materials={materials} colors={colors} styles={styles} occasions={occasions} mobileOpen={mobileFilters} setMobileOpen={setMobileFilters} />
        <div className="flex-1">
          {status === "loading" && <Spinner label="Fetching earrings from the API…" />}
          {status === "error" && <ErrorBanner message="Couldn't load products from the backend." />}
          {status === "ready" && finalResults.length === 0 && <div className="py-20 text-center text-textSecondary"><p className="text-[15px] mb-2">No earrings match these filters.</p></div>}
          {status === "ready" && finalResults.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-10">
              {finalResults.map(product => (
                <div key={product.id} className="relative">
                  {filters.aiOnly && aiScored[product.id] && <span className="absolute -top-2 left-0 z-10 text-[10px] bg-primaryDark text-white px-2 py-0.5">{aiScored[product.id].score}% match</span>}
                  <EarringCard product={product} onOpen={openProduct} onTryOn={openTryOn} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   PRODUCT DETAIL
   ============================================================================ */
function ProductDetails({ id }) {
  const { addToCart, wishlist, toggleWishlist, openTryOn, userPrefs, nav, viewed, user } = useApp();
  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState("loading");
  const [tab, setTab] = useState("details");
  const [match, setMatch] = useState(null);
  const [related, setRelated] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    setStatus("loading");
    setGalleryIndex(0);
    api.getProduct(id).then(async (p) => {
      setProduct(p);
      const [rec, sameCategory] = await Promise.all([
        api.getRecommendations(userPrefs || {}, 1).catch(() => []),
        api.getProducts({ category: p.category }).catch(() => ({ results: [] })),
      ]);
      const own = await api.getRecommendations(userPrefs || {}, 50).catch(() => []);
      setMatch(own.find(x => x.product.id === p.id) || null);
      setRelated(sameCategory.results.filter(r => r.id !== p.id).slice(0, 4));
      setStatus("ready");
    }).catch(() => setStatus("error"));
  }, [id]);

  if (status === "loading") return <Spinner label="Loading product…" />;
  if (status === "error" || !product) return <ErrorBanner message="Couldn't load this product." onRetry={() => nav("collection")} />;

  return (
    <div className="max-w-[1300px] mx-auto px-5 md:px-8 py-10">
      <button onClick={() => nav("collection")} className="flex items-center gap-1.5 text-[12.5px] text-textSecondary mb-6"><ArrowLeft size={14}/> Back to shop</button>
      <div className="grid md:grid-cols-2 gap-12">
        <div>
          <div className="relative bg-primaryLight aspect-square flex items-center justify-center mb-3 overflow-hidden">
            <ProductImage product={product} size={220} imageIndex={galleryIndex} />
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-3">
              {product.images.map((_, i) => (
                <button key={i} onClick={() => setGalleryIndex(i)} className={`relative w-20 h-20 flex items-center justify-center border overflow-hidden bg-primaryLight ${galleryIndex === i ? "border-primaryDark" : "border-border"}`}>
                  <ProductImage product={product} size={42} imageIndex={i} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-[12px] tracking-[0.14em] text-primaryDark mb-2">{product.material?.toUpperCase()}</p>
          <h1 className="text-[32px] leading-tight mb-3" style={SERIF}>{product.name}</h1>
          <Rating value={product.rating} count={product.reviews} size={15} />
          <div className="flex items-center gap-3 mt-4 mb-6">
            <span className="text-[22px]">{money(product.price)}</span>
            {product.originalPrice && <span className="text-[15px] text-textSecondary line-through">{money(product.originalPrice)}</span>}
            {product.originalPrice && <span className="text-[11px] bg-dangerLight text-danger px-2 py-1">Save {Math.round((1-product.price/product.originalPrice)*100)}%</span>}
          </div>
          <p className="text-[14px] text-textSecondary leading-relaxed mb-6 max-w-[440px]">{product.description}</p>
          <div className={`text-[12.5px] mb-6 ${product.stock > 5 ? "text-success" : "text-danger"}`}>{product.stock > 5 ? <span className="flex items-center gap-1.5"><Check size={13}/> In stock</span> : <span>Only {product.stock} left</span>}</div>
          <div className="flex flex-wrap gap-3 mb-4">
            <Button size="lg" onClick={() => addToCart(product)}>Add to Cart</Button>
            <Button variant="outline" size="lg" onClick={async () => { await addToCart(product); nav("checkout"); }}>Buy Now</Button>
          </div>
          <div className="flex flex-wrap gap-3 mb-8">
            <Button variant="ghost" onClick={() => toggleWishlist(product.id)}><Heart size={15} className={wishlist.includes(product.id) ? "fill-danger text-danger" : ""}/> {wishlist.includes(product.id) ? "Saved" : "Wishlist"}</Button>
            <Button variant="gold" onClick={() => openTryOn(product)}><Sparkles size={15}/> Try This Earring On</Button>
          </div>

          {match && (
            <div className="bg-primaryLight p-5 mb-8">
              <div className="flex items-center gap-2 mb-2"><Sparkles size={15} className="text-primaryDark" /><p className="text-[13px]">AI Styling Recommendation — {match.score}% match for you</p></div>
              <p className="text-[13px] text-textSecondary leading-relaxed mb-3">This earring may complement your features because of its {product.category === "hoop" ? "rounded, close silhouette" : "elongated, lightweight silhouette"}.</p>
              <details><summary className="text-[12px] cursor-pointer text-primaryDark">Why AI recommends this</summary>
                <ul className="mt-2 space-y-1.5">{match.reasons.map((r,i) => <li key={i} className="text-[12.5px] text-textSecondary flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-primaryDark"/>{r}</li>)}</ul>
              </details>
            </div>
          )}

          <div className="border-t border-border">
            {["details","shipping","reviews"].map(t => <button key={t} onClick={() => setTab(t)} className={`mr-6 py-3 text-[13px] border-b -mb-px ${tab===t?"border-primaryDark":"border-transparent text-textSecondary"}`}>{t === "details" ? "Details" : t === "shipping" ? "Shipping & Returns" : "Reviews"}</button>)}
          </div>
          <div className="py-5 text-[13.5px] text-textSecondary leading-relaxed">
            {tab === "details" && <table className="w-full"><tbody>{[["Material", product.material], ["Colour", product.color], ["Stone", product.stone], ["Dimensions", product.dimensions], ["Weight", product.weight], ["Style", product.style]].map(([k,v]) => <tr key={k} className="border-b border-border"><td className="py-2 text-textSecondary w-1/3">{k}</td><td className="py-2">{v}</td></tr>)}</tbody></table>}
            {tab === "shipping" && <div className="space-y-3"><p className="flex gap-2"><Truck size={16} className="shrink-0 mt-0.5"/> Free standard shipping, arrives in 3–5 business days.</p></div>}
            {tab === "reviews" && (
              <ProductReviewsSection
                product={product}
                user={user}
                onReviewAdded={() => {
                  api.getProduct(id).then(setProduct).catch(() => {});
                }}
              />
            )}
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="text-[24px] mb-6" style={SERIF}>You may also like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">{related.map(p => <EarringCard key={p.id} product={p} onOpen={(pp)=>nav("product",{id:pp.id})} onTryOn={openTryOn} />)}</div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   AI STYLIST
   ============================================================================ */
function RecommendationCard({ item, onOpen, onTryOn }) {
  const { addToCart } = useApp();
  const { product, score, reasons } = item;
  return (
    <div className="border border-border p-4 flex gap-4">
      <div className="relative bg-primaryLight w-24 h-24 shrink-0 flex items-center justify-center cursor-pointer" onClick={() => onOpen(product)}><ProductImage product={product} size={54} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2"><p className="text-[13.5px] cursor-pointer" onClick={() => onOpen(product)}>{product.name}</p><span className="shrink-0 text-[11px] bg-primaryDark text-white px-2 py-0.5">{score}% Match</span></div>
        <p className="text-[13px] text-textSecondary mt-0.5">{money(product.price)}</p>
        <p className="text-[12px] text-textSecondary mt-1.5 leading-snug">{reasons[0]}</p>
        <div className="flex gap-2 mt-3"><Button size="sm" variant="gold" onClick={() => onTryOn(product)}><Sparkles size={12}/> Try On</Button><Button size="sm" variant="subtle" onClick={() => addToCart(product)}>Add to Cart</Button></div>
      </div>
    </div>
  );
}

function StepGrid({ title, options, value, onSelect, onNext, onBack }) {
  return (
    <div>
      <h2 className="text-[16px] text-center mb-6">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-8">{options.map(o => <button key={o} onClick={() => onSelect(o)} className={`py-4 text-[13px] border ${value===o ? "border-primaryDark bg-primaryDark text-white" : "border-border hover:border-primaryDark"}`}>{o}</button>)}</div>
      <div className="flex justify-between">{onBack ? <Button variant="ghost" onClick={onBack}><ChevronLeft size={14}/> Back</Button> : <span/>}<Button disabled={!value} onClick={onNext}>Continue <ChevronRight size={14}/></Button></div>
    </div>
  );
}

function AIStylist() {
  const { openTryOn, openProduct, setUserPrefs, nav } = useApp();
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState({ occasion: "", style: "", color: "", faceShape: "" });
  const [selfieBusy, setSelfieBusy] = useState(false);
  const [selfieError, setSelfieError] = useState(null); // { code, message } from FaceShapeError, or null
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const fileRef = useRef(null);
  const options = { occasion: ["Everyday","Office","Party","Wedding","Date","Traditional","Casual","Festive"], style: ["Minimal","Elegant","Traditional","Bold","Modern","Luxury","Cute","Vintage"], color: ["Gold","Silver","Rose Gold","Pearl","Diamond","Mixed"] };
  const select = (key, val) => setAns(a => ({ ...a, [key]: val }));

  const handleSelfie = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieBusy(true);
    setSelfieError(null);

    // Dynamic import: MediaPipe's JS wrapper (~800KB before its WASM/model,
    // which load separately anyway) has no reason to be in the main bundle
    // for the ~everyone who never opens the AI Stylist's face-shape step.
    // This keeps it out of the initial page load entirely.
    const { detectFaceShape, FaceShapeError, FaceShapeErrorCode } = await import("./services/faceShapeDetection.js");

    // Load the uploaded file into an <img> — MediaPipe's detect() accepts
    // an HTMLImageElement directly; this avoids a canvas round-trip for the
    // common upload case.
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new FaceShapeError(FaceShapeErrorCode.UNSUPPORTED_IMAGE, "This file couldn't be read as an image."));
        el.src = objectUrl;
      });

      const result = await detectFaceShape(img);
      select("faceShape", result.faceShape);

      // Log the real result server-side (Phase 7 — see routes/stylist.js).
      // Awaited so a logging failure surfaces during development, but never
      // allowed to block the UX the user already got — the face shape is
      // already selected above regardless of whether this succeeds.
      api.detectFaceShape({ faceShape: result.faceShape, confidence: result.confidence, source: "mediapipe-client" }).catch(() => {});
    } catch (err) {
      const code = err instanceof FaceShapeError ? err.code : FaceShapeErrorCode.MODEL_LOAD_FAILED;
      setSelfieError({ code, message: SELFIE_ERROR_MESSAGES[code] || err.message });
    } finally {
      URL.revokeObjectURL(objectUrl);
      setSelfieBusy(false);
      e.target.value = ""; // allow re-selecting the same file after an error
    }
  };

  const finish = async () => {
    setUserPrefs(ans);
    setLoadingResults(true);
    try { const r = await api.quiz(ans); setResults(r.matches); } catch { setResults([]); }
    setLoadingResults(false);
    setStep(4);
  };

  return (
    <div className="max-w-[820px] mx-auto px-5 md:px-8 py-12">
      <div className="text-center mb-10"><Sparkles size={22} className="mx-auto mb-3 text-primaryDark" /><h1 className="text-[30px]" style={SERIF}>AI Earring Stylist</h1><p className="text-[13.5px] text-textSecondary mt-2">Answer a few questions — matches come straight from the recommendation API.</p></div>
      {step < 4 && <div className="flex items-center gap-2 mb-10 justify-center">{[0,1,2,3].map(i => <div key={i} className={`h-[2px] w-14 ${i<=step ? "bg-primaryDark" : "bg-border"}`} />)}</div>}
      {step === 0 && <StepGrid title="What are you shopping for?" options={options.occasion} value={ans.occasion} onSelect={v => select("occasion", v)} onNext={() => setStep(1)} />}
      {step === 1 && <StepGrid title="What style do you prefer?" options={options.style} value={ans.style} onSelect={v => select("style", v)} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
      {step === 2 && <StepGrid title="What colour or material?" options={options.color} value={ans.color} onSelect={v => select("color", v)} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && (
        <div>
          <h2 className="text-[16px] text-center mb-6">What's your face shape?</h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={() => fileRef.current?.click()} className="border border-dashed border-border p-6 flex flex-col items-center gap-2 hover:border-primaryDark">
              {selfieBusy ? <RefreshCw size={20} className="animate-spin text-primaryDark" /> : <ScanFace size={20} />}
              <span className="text-[12.5px]">{selfieBusy ? "Analyzing your photo…" : "Upload a selfie"}</span>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleSelfie} />
            </button>
            <div className="border border-border p-6 flex flex-col items-center justify-center gap-1"><span className="text-[12.5px] text-textSecondary">or select manually below</span></div>
          </div>
          {selfieError && (
            <div className="mb-6 -mt-2 flex items-start gap-2 border border-dangerLight bg-dangerLight p-3.5">
              <CircleAlert size={15} className="text-danger mt-0.5 shrink-0" />
              <p className="text-[12.5px] text-danger leading-relaxed">{selfieError.message}</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2.5 mb-8">{FACE_SHAPES.map(f => <button key={f} onClick={() => select("faceShape", f)} className={`py-3 text-[13px] border ${ans.faceShape===f ? "border-primaryDark bg-primaryDark text-white" : "border-border"}`}>{f}</button>)}</div>
          <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(2)}><ChevronLeft size={14}/> Back</Button><Button disabled={!ans.faceShape} onClick={finish}>See My Matches <ChevronRight size={14}/></Button></div>
        </div>
      )}
      {step === 4 && (
        <div>
          <div className="text-center mb-8"><h2 className="text-[24px]" style={SERIF}>Your AI Earring Match</h2><p className="text-[13px] text-textSecondary mt-1">Based on {ans.occasion || "your style"}, {ans.style || "your taste"}, and a {ans.faceShape || "balanced"} face shape.</p></div>
          {loadingResults ? <Spinner /> : (
            <div className="space-y-4 mb-8">{results.map(r => <RecommendationCard key={r.product.id} item={r} onOpen={openProduct} onTryOn={openTryOn} />)}</div>
          )}
          <div className="flex justify-center gap-3"><Button variant="outline" onClick={() => { setStep(0); setAns({occasion:"",style:"",color:"",faceShape:""}); }}>Start Over</Button><Button onClick={() => nav("collection")}>Browse All Earrings</Button></div>
        </div>
      )}
    </div>
  );
}

const OUTFIT_MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone photo, small enough to analyze instantly

function OutfitMatch() {
  const { openTryOn, openProduct } = useApp();
  const [photo, setPhoto] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | analyzing | done | needs-manual | error
  const [analysis, setAnalysis] = useState(null);
  const [matches, setMatches] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const [resultError, setResultError] = useState(null);
  const [showManualPicker, setShowManualPicker] = useState(false);
  const fileRef = useRef(null);

  const fetchMatches = async (result) => {
    setResultError(null);
    try {
      const r = await api.outfitMatch(result);
      setAnalysis(r.analysis);
      setMatches(r.matches);
      setStatus("done");
    } catch (err) {
      setResultError(err.message || "Couldn't fetch matching earrings.");
      setStatus("error");
    }
  };

  const runAutoAnalysis = (dataUrl) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const result = analyzeOutfitImage(img);
        await fetchMatches({ ...result, source: "color-extraction" });
      } catch (err) {
        const message = err instanceof OutfitAnalysisError
          ? err.message
          : "Couldn't analyze this photo.";
        setResultError(message);
        setStatus("needs-manual");
        setShowManualPicker(true);
      }
    };
    img.onerror = () => { setResultError("This file couldn't be read as an image."); setStatus("needs-manual"); setShowManualPicker(true); };
    img.src = dataUrl;
  };

  const onUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith("image/")) { setUploadError("Please upload an image file (JPG or PNG)."); return; }
    if (file.size > OUTFIT_MAX_FILE_BYTES) { setUploadError("That image is too large — please upload one under 8MB."); return; }

    setAnalysis(null); setMatches([]); setResultError(null); setShowManualPicker(false);
    setStatus("analyzing");
    const reader = new FileReader();
    reader.onload = () => { setPhoto(reader.result); runAutoAnalysis(reader.result); };
    reader.onerror = () => { setUploadError("Couldn't read that file."); setStatus("idle"); };
    reader.readAsDataURL(file);
  };

  const pickManualColor = (option) => {
    setStatus("analyzing");
    fetchMatches({
      desc: `a ${option.label.toLowerCase()} outfit`,
      color: option.recommendedColor,
      style: option.recommendedStyle,
      source: "manual",
    });
  };

  const startOver = () => { setPhoto(null); setAnalysis(null); setMatches([]); setStatus("idle"); setUploadError(null); setResultError(null); setShowManualPicker(false); };

  return (
    <div className="max-w-[820px] mx-auto px-5 md:px-8 py-12">
      <div className="text-center mb-8">
        <h1 className="text-[28px]" style={SERIF}>Match Earrings With My Outfit</h1>
        <p className="text-[13.5px] text-textSecondary mt-2">Upload a photo — we analyze its real colors (right in your browser, nothing is uploaded for this step beyond the match request) and suggest earrings that pair well.</p>
      </div>
      {!photo && (
        <>
          <button onClick={() => fileRef.current?.click()} className="w-full border border-dashed border-border py-14 flex flex-col items-center gap-2 hover:border-primary transition-colors">
            <ImageUp size={22} /><span className="text-[13px]">Upload outfit photo</span>
            <span className="text-[11.5px] text-textSecondary">JPG or PNG, up to 8MB</span>
          </button>
          {uploadError && <div className="mt-4 flex items-start gap-2 border border-dangerLight bg-dangerLight p-3.5"><CircleAlert size={15} className="text-danger mt-0.5 shrink-0" /><p className="text-[12.5px] text-danger leading-relaxed">{uploadError}</p></div>}
        </>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
      {photo && (
        <div className="grid sm:grid-cols-[220px_1fr] gap-8 items-start">
          <div>
            <img src={photo} className="w-full aspect-[3/4] object-cover border border-border" alt="Your uploaded outfit" />
            <Button variant="ghost" size="sm" className="w-full mt-3" onClick={startOver}><RefreshCw size={13}/> Try another photo</Button>
          </div>
          <div>
            {status === "analyzing" && <div className="flex items-center gap-2 text-[13px] text-textSecondary"><RefreshCw size={14} className="animate-spin"/> Analyzing…</div>}

            {status === "done" && analysis && (
              <>
                <p className="text-[13.5px] text-textSecondary mb-2">Your {analysis.desc} pairs well with these {analysis.color.toLowerCase()} {analysis.style.toLowerCase()} earrings.</p>
                {analysis.reason && <p className="text-[12px] text-textSecondary mb-4 italic">{analysis.reason} — a styling suggestion, not a hard rule.</p>}
                <div className="space-y-4 mb-5">{matches.map(r => <RecommendationCard key={r.product.id} item={r} onOpen={openProduct} onTryOn={openTryOn} />)}</div>
                <button onClick={() => setShowManualPicker(v => !v)} className="text-[12px] underline text-textSecondary">Not quite right? Choose the color yourself</button>
              </>
            )}

            {status === "error" && (
              <div className="mb-4 flex items-start gap-2 border border-dangerLight bg-dangerLight p-3.5">
                <CircleAlert size={15} className="text-danger mt-0.5 shrink-0" />
                <p className="text-[12.5px] text-danger leading-relaxed">{resultError}</p>
              </div>
            )}

            {status === "needs-manual" && resultError && (
              <div className="mb-4 flex items-start gap-2 border border-primaryLight bg-primaryLight p-3.5">
                <Info size={15} className="text-primaryDark mt-0.5 shrink-0" />
                <p className="text-[12.5px] text-primaryDark leading-relaxed">{resultError}</p>
              </div>
            )}

            {(showManualPicker || status === "needs-manual") && (
              <div>
                <p className="text-[11.5px] tracking-wide text-textSecondary mb-2">{status === "needs-manual" ? "PICK THE CLOSEST COLOR" : "PICK A DIFFERENT COLOR"}</p>
                <div className="grid grid-cols-2 gap-2">
                  {MANUAL_COLOR_OPTIONS.map(opt => (
                    <button key={opt.label} onClick={() => pickManualColor(opt)} className="text-left text-[12.5px] px-3 py-2.5 border border-border hover:border-primary transition-colors">{opt.label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   WISHLIST
   ============================================================================ */
function Wishlist() {
  const { wishlistItems, openProduct, openTryOn } = useApp();
  return (
    <div className="max-w-[1300px] mx-auto px-5 md:px-8 py-10">
      <h1 className="text-[28px] mb-8" style={SERIF}>Your Wishlist</h1>
      {wishlistItems.length === 0 ? (
        <div className="py-16 text-center text-textSecondary"><Heart size={26} className="mx-auto mb-3" /><p className="text-[14px]">Nothing saved yet — synced live from the API.</p></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-9">{wishlistItems.map(p => <EarringCard key={p.id} product={p} onOpen={openProduct} onTryOn={openTryOn} />)}</div>
      )}
    </div>
  );
}

/* ============================================================================
   CART / CHECKOUT
   ============================================================================ */
function CartDrawer() {
  const { cart, cartOpen, setCartOpen, updateQty, removeFromCart, nav } = useApp();
  const subtotal = cart.reduce((s,c) => s + c.product.price * c.qty, 0);
  if (!cartOpen) return null;
  return (
    <div className="fixed inset-0 z-[85] bg-[#0B1C2C]/40" onClick={() => setCartOpen(false)}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-[420px] bg-surface flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-[68px] border-b border-border"><p className="text-[15px]">Your Bag ({cart.reduce((a,c)=>a+c.qty,0)})</p><button onClick={() => setCartOpen(false)}><X size={19}/></button></div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {cart.length === 0 ? <p className="text-[13px] text-textSecondary text-center mt-10">Your bag is empty.</p> : cart.map(item => (
            <div key={item.productId} className="flex gap-4 mb-6">
              <div className="relative bg-primaryLight w-20 h-20 shrink-0 flex items-center justify-center"><ProductImage product={item.product} size={44} /></div>
              <div className="flex-1">
                <p className="text-[13px]">{item.product.name}</p>
                <p className="text-[12.5px] text-textSecondary mb-2">{money(item.product.price)}</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-border">
                    <button className="w-6 h-6 flex items-center justify-center" onClick={() => updateQty(item.productId, item.qty - 1)}><Minus size={11}/></button>
                    <span className="w-7 text-center text-[12px]">{item.qty}</span>
                    <button className="w-6 h-6 flex items-center justify-center" onClick={() => updateQty(item.productId, item.qty + 1)}><Plus size={11}/></button>
                  </div>
                  <button onClick={() => removeFromCart(item.productId)} className="text-danger"><Trash2 size={14}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="border-t border-border p-5">
            <div className="flex items-center gap-2 text-[12px] text-textSecondary mb-3"><Truck size={14}/> Estimated delivery: 3–5 business days</div>
            <div className="flex justify-between text-[14px] mb-4"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <Button className="w-full" onClick={() => { setCartOpen(false); nav("checkout"); }}>Checkout</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Input(props) { return <input {...props} className="bg-white border border-border px-3.5 py-2.5 text-[13.5px] outline-none focus:border-primaryDark w-full" />; }
function Section({ title, children }) { return <div className="mb-7"><p className="text-[12px] tracking-wide text-textSecondary mb-3">{title.toUpperCase()}</p>{children}</div>; }
function Radio({ label, name, checked, onChange }) { return <label className="flex items-center gap-2 border border-border px-3.5 py-2.5 text-[13px] cursor-pointer has-[:checked]:border-primaryDark"><input type="radio" name={name} checked={checked} onChange={onChange} />{label}</label>; }

function Checkout() {
  const { cart, nav, refreshCart, openTracking } = useApp();
  const [coupon, setCoupon] = useState("");
  const [placed, setPlaced] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [contact, setContact] = useState({ name: "", email: "" });
  const [address, setAddress] = useState({ street: "", city: "", state: "", zip: "" });
  const [paymentMethod, setPaymentMethod] = useState("Card");
  const subtotal = cart.reduce((s,c) => s + c.product.price * c.qty, 0);

  const submit = async () => {
    if (!contact.name.trim() || !contact.email.trim() || !address.street.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim()) {
      setError("Please fill in all contact and shipping address fields.");
      return;
    }
    setError("");
    setPlacing(true);
    try {
      const order = await api.createOrder({
        items: cart.map(c => ({ productId: c.productId, qty: c.qty })),
        paymentMethod,
        coupon,
        shippingAddress: {
          name: contact.name.trim(),
          email: contact.email.trim(),
          address: address.street.trim(),
          city: address.city.trim(),
          state: address.state.trim(),
          zip: address.zip.trim(),
        },
      });
      setPlaced(order);
      refreshCart();
    } catch (e) { setError(e.message); }
    setPlacing(false);
  };

  if (placed) {
    return (
      <div className="max-w-[560px] mx-auto px-5 py-20 text-center">
        <Check size={36} className="mx-auto mb-4 text-emerald-600 bg-emerald-50 p-2 rounded-full border border-emerald-200" />
        <h1 className="text-[28px] mb-2" style={SERIF}>Order Placed & Confirmed</h1>
        <p className="text-sm font-mono font-semibold text-sky-800 mb-2">#{placed.orderNumber || placed.id.slice(0,8)}</p>
        <p className="text-[13.5px] text-textSecondary mb-4">Total charged: <span className="font-semibold text-slate-900">{money(placed.total)}</span> &bull; Status: <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 text-xs font-semibold">{placed.status}</span></p>

        {placed.deliveryOtp && (
          <div className="my-6 p-5 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 inline-block text-center max-w-sm shadow-xs">
            <p className="text-xs font-bold text-sky-900 uppercase tracking-wider">Your Secure Handover OTP</p>
            <p className="text-3xl font-mono font-black text-sky-900 tracking-widest my-2 bg-white py-1.5 px-4 rounded-xl border border-sky-300 shadow-xs inline-block">
              {placed.deliveryOtp}
            </p>
            <p className="text-[11.5px] text-sky-700 leading-relaxed">
              Please share this 4-digit code with your delivery courier when receiving your package.
            </p>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3 mt-4">
          <Button onClick={() => openTracking && openTracking(placed.id)} variant="gold">
            <Truck size={15} className="mr-1.5" /> Track Live Shipment
          </Button>
          <Button onClick={() => nav("collection")} variant="outline">Continue Shopping</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-8 py-10 grid md:grid-cols-[1fr_380px] gap-12">
      <div>
        <h1 className="text-[26px] mb-8" style={SERIF}>Checkout</h1>
        <Section title="Contact"><div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="Full name" value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))} />
          <Input placeholder="Email" type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} />
        </div></Section>
        <Section title="Shipping Address"><div className="grid gap-3">
          <Input placeholder="Street address" value={address.street} onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} />
          <div className="grid sm:grid-cols-3 gap-3">
            <Input placeholder="City" value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} />
            <Input placeholder="State" value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))} />
            <Input placeholder="ZIP" value={address.zip} onChange={e => setAddress(a => ({ ...a, zip: e.target.value }))} />
          </div>
        </div></Section>
        <Section title="Payment Method"><div className="grid sm:grid-cols-3 gap-3">{["Card","PayPal","Apple Pay"].map(m => <Radio key={m} label={m} name="pay" checked={paymentMethod===m} onChange={() => setPaymentMethod(m)} />)}</div></Section>
        {error && <p className="text-[13px] text-danger mb-4">{error}</p>}
      </div>
      <div>
        <div className="bg-primaryLight p-5">
          <p className="text-[14px] mb-4">Order Summary</p>
          {cart.map(item => <div key={item.productId} className="flex justify-between text-[13px] mb-2"><span>{item.product.name} × {item.qty}</span><span>{money(item.product.price*item.qty)}</span></div>)}
          <div className="flex gap-2 my-4"><input value={coupon} onChange={e=>setCoupon(e.target.value)} placeholder="Coupon code" className="flex-1 bg-white border border-border px-3 py-2 text-[13px] outline-none" /></div>
          <div className="border-t border-border pt-3 space-y-1.5 text-[13px]"><div className="flex justify-between text-[15px]"><span>Subtotal</span><span>{money(subtotal)}</span></div></div>
          <Button className="w-full mt-5" disabled={cart.length===0 || placing} onClick={submit}>{placing ? "Placing order…" : "Place Order"}</Button>
        </div>
      </div>
    </div>
  );
}


/* ============================================================================
   AUTH — email/password (existing backend routes) + "Continue with Google"
   ============================================================================
   There was no login/register UI in the frontend before this — /api/auth/
   register and /api/auth/login existed on the backend but nothing called
   them. This adds both, plus Google, as one panel reused for login and
   register, since neither existed to keep separate. */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
let googleScriptPromise = null;

// Loads https://accounts.google.com/gsi/client once, however many components
// ask for it. Deliberately not a <script> tag in index.html: this way the
// project has zero new markup/config to keep in sync when the client id
// isn't set (see GoogleAuthButton below), and every other file in this app
// stays untouched.
function loadGoogleScript() {
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load Google Sign-In"));
    document.head.appendChild(s);
  });
  return googleScriptPromise;
}

// Renders Google's own official button (Google Identity Services'
// `renderButton`) — not a custom lookalike — into a div it owns. On a real
// credential, hands the raw ID token up to onCredential and lets the parent
// do the network call, so this component stays UI-only.
function GoogleAuthButton({ onCredential, onError, text = "continue_with" }) {
  const boxRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return; // nothing to render without a configured client id
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !boxRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          // response.credential is the signed Google ID token — the only
          // thing this button ever hands back. Name/email/picture are never
          // read out of the client-side Google object and sent to the
          // backend separately; only this token is, and the backend
          // verifies it before trusting anything inside it.
          callback: (response) => onCredential(response.credential),
        });
        window.google.accounts.id.renderButton(boxRef.current, {
          type: "standard", theme: "outline", size: "large", shape: "pill",
          text, logo_alignment: "left", width: 320,
        });
      })
      .catch((e) => onError?.(e.message));
    return () => { cancelled = true; };
  }, [text]);

  if (!GOOGLE_CLIENT_ID) {
    // Fails visibly in dev rather than rendering nothing with no
    // explanation — see frontend/.env.example for VITE_GOOGLE_CLIENT_ID.
    // Styled as a quiet disabled-state line rather than a dashed warning
    // box — this is a normal (if incomplete) local-dev state, not an error.
    return <p className="text-[12px] text-white/60 text-center py-3">Google sign-in isn't configured yet</p>;
  }
  return <div ref={boxRef} className="flex justify-center" />;
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-border" /><span className="text-[11px] tracking-[0.15em] text-textSecondary">or</span><div className="flex-1 h-px bg-border" />
    </div>
  );
}

// A quiet, one-time decorative moment for the sign-in hero: three of the
// app's own earring illustrations (EarringArt — same component product
// cards use), composed at different sizes/rotations rather than scattered
// per-element motion. Grounds the page in what Aurélie actually sells
// instead of generic gradient/shape decoration.
function AuthHeroArt() {
  return (
    <div className="relative w-[220px] h-[220px] mx-auto opacity-90" aria-hidden="true">
      <EarringArt kind="chandelier" color="Pearl" size={108} className="absolute top-0 left-6 rotate-[-6deg]" />
      <EarringArt kind="jhumka" color="Gold" size={132} className="absolute bottom-0 right-0 rotate-[4deg]" />
      <EarringArt kind="hoop-large" color="Gold" size={64} className="absolute top-4 right-6 opacity-70" />
    </div>
  );
}

function AuthPanel() {
  const { login: loginCtx, nav } = useApp();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Shared by the email/password submit and the Google callback — same
  // { token, user } response shape from every /api/auth/* endpoint, same
  // client-side handling of it either way.
  const succeed = (result) => { loginCtx(result); };

  const submitPassword = async (e) => {
    e.preventDefault();
    setError(null);
    if (mode === "register" && password !== confirm) { setError("Passwords don't match"); return; }
    setBusy(true);
    try {
      const result = mode === "register"
        ? await api.register({ name, email, password })
        : await api.login({ email, password });
      succeed(result);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setError(null); setBusy(true);
    try {
      succeed(await api.googleLogin(credential));
    } catch (err) {
      setError(err.message || "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 min-h-[600px] border border-border">
      {/* Brand side — hidden on small screens so the form stays the whole
          story on mobile, rather than shrinking a two-column layout down. */}
      <div className="hidden md:flex flex-col justify-between bg-ink text-white px-12 py-12">
        <button onClick={() => nav("home")} className="flex items-center gap-2 text-[12.5px] text-white/70 hover:text-white transition-colors w-fit"><ArrowLeft size={14} /> Back to shop</button>
        <div>
          <AuthHeroArt />
          <h2 className="text-[32px] leading-[1.15] mt-8 mb-4" style={SERIF}>An account as considered as the earrings.</h2>
          <p className="text-[13.5px] text-white/60 leading-relaxed max-w-[320px]">Save what catches your eye, pick up a try-on where you left it, and check out faster next time.</p>
        </div>
        <div className="pt-8 border-t border-white/10 text-[11px] tracking-[0.15em] text-textSecondary">EARRINGS, RECONSIDERED</div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center bg-surface px-6 py-14 sm:px-12">
        <div className="w-full max-w-[340px]">
          <div className="flex gap-7 mb-8 border-b border-border">
            {[["login","Log in"],["register","Create account"]].map(([id,label]) => (
              <button key={id} onClick={() => { setMode(id); setError(null); }} className={`pb-3 text-[13.5px] border-b transition-colors ${mode===id ? "border-primaryDark text-textPrimary" : "border-transparent text-textSecondary hover:text-textPrimary"}`}>{label}</button>
            ))}
          </div>

          {error && <div className="mb-5 text-[12.5px] text-danger bg-dangerLight px-3.5 py-3">{error}</div>}

          <form onSubmit={submitPassword} className="space-y-3">
            {mode === "register" && <Input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />}
            <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 8 : undefined} />
            {mode === "register" && <Input type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />}
            <Button type="submit" disabled={busy} className="w-full !py-3 mt-1">{busy ? "Please wait…" : mode === "register" ? "Create Account" : "Log In"}</Button>
          </form>

          <OrDivider />

          <GoogleAuthButton onCredential={handleGoogleCredential} onError={setError} text={mode === "register" ? "signup_with" : "continue_with"} />
        </div>
      </div>
    </div>
  );
}






/* ============================================================================
   PROFILE
   ============================================================================ */
function Profile() {
  const { wishlistItems, viewed, userPrefs, setUserPrefs, openProduct, user, logout, nav, openTracking } = useApp();
  const [tab, setTab] = useState("profile");
  const [orders, setOrders] = useState([]);
  const [recs, setRecs] = useState([]);
  const tabs = [["profile","Profile"],["orders","Orders"],["wishlist","Wishlist"],["ai","AI Recommendations"],["prefs","Preferences"]];

  useEffect(() => { if (tab === "orders") api.getOrders().then(setOrders).catch(() => {}); }, [tab]);
  useEffect(() => { if (tab === "ai") api.getRecommendations(userPrefs || {}, 4).then(setRecs).catch(() => {}); }, [tab, userPrefs]);

  if (!user) {
    return (
      <div className="max-w-[1100px] mx-auto px-5 md:px-8 py-16">
        <AuthPanel />
      </div>
    );
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
  const isDelivery = user.role === "DELIVERY_BOY";

  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-8 py-10 grid md:grid-cols-[200px_1fr] gap-10">
      <div className="flex md:flex-col gap-1 overflow-x-auto">
        {tabs.map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`text-left text-[13px] px-3 py-2.5 whitespace-nowrap ${tab===id ? "bg-primaryDark text-white" : "hover:bg-primaryLight"}`}>{label}</button>)}
        {isSuperAdmin && (
          <button onClick={() => nav("superadmin")} className="text-left text-[13px] px-3 py-2.5 whitespace-nowrap text-sky-700 font-semibold flex items-center gap-1.5 mt-1 bg-sky-50 border border-sky-200 hover:bg-sky-100">
            <ShieldCheck size={14} /> Super Admin
          </button>
        )}
        {isDelivery && (
          <button onClick={() => nav("delivery")} className="text-left text-[13px] px-3 py-2.5 whitespace-nowrap text-emerald-700 font-semibold flex items-center gap-1.5 mt-1 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100">
            <Truck size={14} /> Courier App
          </button>
        )}
        <button onClick={logout} className="text-left text-[13px] px-3 py-2.5 whitespace-nowrap text-danger flex items-center gap-1.5 mt-2"><LogOut size={14} /> Log out</button>
      </div>
      <div>
        {tab === "profile" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[24px]" style={SERIF}>Hello, {user.name}</h2>
              {isSuperAdmin && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
                  <ShieldCheck size={14} /> Verified Super Admin
                </span>
              )}
              {isDelivery && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <Truck size={14} /> Verified Courier
                </span>
              )}
            </div>
            {isSuperAdmin && (
              <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                    <ShieldCheck size={16} className="text-sky-600" />
                    Super Administrator Privileges Active
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Manage ornaments, photo uploads, inventory, marketplace sellers, orders, and system settings.
                  </p>
                </div>
                <button
                  onClick={() => nav("superadmin")}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-sm transition whitespace-nowrap"
                >
                  Launch Super Admin Portal &rarr;
                </button>
              </div>
            )}
            {isDelivery && (
              <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                    <Truck size={16} className="text-emerald-600" />
                    Delivery Personnel Account Active
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Access your assigned packages, navigation routes, and customer handover OTP verifications.
                  </p>
                </div>
                <button
                  onClick={() => nav("delivery")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition whitespace-nowrap"
                >
                  Open Delivery App &rarr;
                </button>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3 max-w-[480px]"><Input placeholder="Full name" defaultValue={user.name} disabled /><Input placeholder="Email" defaultValue={user.email} disabled /></div>

            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap gap-3">
              <button
                onClick={() => nav("delivery")}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5"
              >
                <Truck size={13} />
                Courier Portal / Sign-up
              </button>
              <button
                onClick={() => nav("services")}
                className="px-3.5 py-2 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl transition flex items-center gap-1.5 border border-sky-200"
              >
                <ShieldCheck size={13} />
                Explore Verified Jewelry Services
              </button>
            </div>
          </div>
        )}
        {tab === "orders" && (
          <div className="space-y-3">
            {orders.length === 0 && <p className="text-[13px] text-textSecondary">No orders yet — place one at Checkout and it'll show up here.</p>}
            {orders.map(o => (
              <div key={o.id} className="border border-border p-4 rounded-xl bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">#{o.orderNumber || o.id.slice(0,8)}</span>
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-sky-50 text-sky-800 border border-sky-200">{o.status}</span>
                  </div>
                  <p className="text-xs text-textSecondary mt-1">
                    {new Date(o.createdAt).toLocaleDateString()} &bull; Total: <span className="font-semibold text-slate-900">{money(o.total)}</span> &bull; {o.paymentMethod || "Card"} ({o.paymentStatus})
                  </p>
                </div>
                <button
                  onClick={() => openTracking && openTracking(o.id)}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs self-start sm:self-center"
                >
                  <Truck size={13} />
                  Track Live Order
                </button>
              </div>
            ))}
          </div>
        )}
        {tab === "wishlist" && <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">{wishlistItems.map(p => <EarringCard key={p.id} product={p} onOpen={openProduct} onTryOn={()=>{}} />)}{wishlistItems.length===0 && <p className="text-[13px] text-textSecondary">No saved earrings yet.</p>}</div>}
        {tab === "ai" && <div className="space-y-4 max-w-[520px]">{recs.map(r => <RecommendationCard key={r.product.id} item={r} onOpen={openProduct} onTryOn={()=>{}} />)}</div>}
        {tab === "prefs" && (
          <div className="max-w-[520px] space-y-6">
            <PrefGroup label="Preferred style" options={["Minimal","Elegant","Traditional","Bold","Modern","Luxury"]} value={userPrefs.style} onChange={v=>setUserPrefs(p=>({...p,style:v}))} />
            <PrefGroup label="Favourite material" options={["Gold","Silver","Rose Gold","Pearl","Diamond"]} value={userPrefs.color} onChange={v=>setUserPrefs(p=>({...p,color:v}))} />
            <PrefGroup label="Face shape" options={FACE_SHAPES} value={userPrefs.faceShape} onChange={v=>setUserPrefs(p=>({...p,faceShape:v}))} />
            <PrefGroup label="Preferred occasion" options={["Everyday","Office","Party","Wedding"]} value={userPrefs.occasion} onChange={v=>setUserPrefs(p=>({...p,occasion:v}))} />
          </div>
        )}
      </div>
    </div>
  );
}




function PrefGroup({ label, options, value, onChange }) {
  return <div><p className="text-[12px] tracking-wide text-textSecondary mb-2">{label.toUpperCase()}</p><div className="flex flex-wrap gap-2">{options.map(o => <button key={o} onClick={() => onChange(o)} className={`px-3 py-1.5 text-[12.5px] border ${value===o?"border-primaryDark bg-primaryDark text-white":"border-border"}`}>{o}</button>)}</div></div>;
}

/* ============================================================================
   VIRTUAL TRY-ON (client-side camera/canvas, session logged via API)
   ============================================================================ */
function EarringOverlay({
  anchor,
  config,
  product,
  side,
  onDrag,
  svgRef,
  imgRef,
  autoRotateDeg = 0,
  faceHeightPx = 200,
  onImageStatusChange,
}) {
  const start = useRef(null);
  const [imgError, setImgError] = useState(false);
  const [transparentSrc, setTransparentSrc] = useState(null);
  const isStud = isStudEarring(product);
  const assets = getProductTryOnAssets(product);
  const imageUrl = assets.earringAsset;

  useEffect(() => {
    let cancelled = false;
    setImgError(false);
    if (!imageUrl) {
      setTransparentSrc(null);
      onImageStatusChange?.(side, "ready");
      return;
    }

    // Fast bypass if already confirmed transparent asset
    const isDirectTransparent = (
      imageUrl.includes("-tryon.png") ||
      imageUrl.includes("-transparent.png") ||
      imageUrl.includes("tryon-cutout-") ||
      imageUrl.includes("-clean-tryon") ||
      imageUrl.startsWith("data:image/")
    );

    if (isDirectTransparent) {
      setTransparentSrc(imageUrl);
      onImageStatusChange?.(side, "loaded");
      return;
    }

    onImageStatusChange?.(side, "loading");
    getTransparentJewelleryImage(imageUrl)
      .then((cleanUrl) => {
        if (!cancelled) {
          setTransparentSrc(cleanUrl || imageUrl);
          onImageStatusChange?.(side, "loaded");
        }
      })
      .catch((err) => {
        console.warn(`[EarringOverlay] Background removal fallback for ${side}:`, err);
        if (!cancelled) {
          setTransparentSrc(imageUrl);
          onImageStatusChange?.(side, "loaded");
        }
      });
    return () => { cancelled = true; };
  }, [imageUrl, product?.id, side]);

  const onPointerDown = (e) => {
    e.stopPropagation();
    start.current = { x: e.clientX, y: e.clientY, ox: config.offsetX, oy: config.offsetY };
    const move = (ev) => {
      const dx = ev.clientX - start.current.x;
      const dy = ev.clientY - start.current.y;
      onDrag(side, { offsetX: start.current.ox + dx, offsetY: start.current.oy + dy });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const x = (anchor?.x ?? 0) + config.offsetX;
  const y = (anchor?.y ?? 0) + config.offsetY;

  // Scale earring relative to face height for clarity and presence:
  // Stud: ~18% face height (~40px)
  // Statement chandeliers/jhumkas: ~44% face height (~95px)
  // Standard drops: ~34% face height (~75px)
  const isStatement = ["jhumka", "chandbali", "chandelier", "fan"].includes(product?.kind) ||
    /jhumka|chandbali|chandelier|royal|temple/i.test(product?.name || "");
  const baseSize = isStud ? Math.round(faceHeightPx * 0.16) :
                   isStatement ? Math.round(faceHeightPx * 0.35) :
                   Math.round(faceHeightPx * 0.28);
  const finalSize = Math.max(24, Math.min(240, Math.round(baseSize * config.scale)));

  // Studs rotate 1:1 with head roll; hanging earrings hang downward with gravity and sway gently (~35%)
  const rollComp = (anchor?.rollDeg || 0) * (isStud ? 1.0 : 0.35);
  const totalRotate = config.rotate + rollComp + autoRotateDeg;

  const transformOrigin = isStud ? "50% 50%" : "50% 12%";
  const translateTransform = isStud ? "translate(-50%, -50%)" : "translate(-50%, -12%)";
  const mirrorScale = side === "right" ? "scaleX(-1)" : "scaleX(1)";
  const isVisible = anchor?.visible !== false;

  const [retryWithPrimary, setRetryWithPrimary] = useState(false);
  const primaryFallback = product?.images?.[0] || null;

  useEffect(() => {
    setRetryWithPrimary(false);
  }, [product?.id, imageUrl]);

  const isDedicatedTryOn = imageUrl && (
    imageUrl.includes("-tryon.png") ||
    imageUrl.includes("-transparent.png") ||
    imageUrl.includes("tryon-cutout-") ||
    imageUrl.includes("-clean-tryon") ||
    imageUrl.startsWith("data:image/")
  );
  const candidateSrc = transparentSrc || (isDedicatedTryOn ? imageUrl : (imageUrl || null));
  const displaySrc = retryWithPrimary ? primaryFallback : (candidateSrc || primaryFallback);

  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute z-20 cursor-grab active:cursor-grabbing touch-none select-none transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${finalSize}px`,
        height: `${finalSize}px`,
        transformOrigin,
        transform: `${translateTransform} ${mirrorScale} rotate(${totalRotate}deg)`,
        filter: "drop-shadow(0 5px 14px rgba(0,0,0,0.48)) contrast(1.04) brightness(1.02)",
      }}
    >
      {displaySrc && !imgError ? (
        <img
          ref={imgRef}
          src={displaySrc}
          alt={product?.name || "Earring"}
          onLoad={() => onImageStatusChange?.(side, "loaded")}
          onError={(e) => {
            console.warn(`[VirtualTryOn] Failed to load earring image for ${product?.name}:`, displaySrc, e);
            if (!retryWithPrimary && primaryFallback && primaryFallback !== displaySrc) {
              setRetryWithPrimary(true);
            } else {
              setImgError(true);
              onImageStatusChange?.(side, "error");
            }
          }}
          className="w-full h-full object-contain pointer-events-none bg-transparent"
        />
      ) : (
        <EarringArt ref={svgRef} kind={product?.kind} color={product?.color} size={finalSize} />
      )}
    </div>
  );
}

function NecklaceOverlay({
  anchor,
  config,
  product,
  onDrag,
  svgRef,
  imgRef,
  autoRotateDeg = 0,
  faceHeightPx = 200,
  onImageStatusChange,
}) {
  const start = useRef(null);
  const [imgError, setImgError] = useState(false);
  const [transparentSrc, setTransparentSrc] = useState(null);
  const assets = getProductTryOnAssets(product);
  const imageUrl = assets.necklaceAsset;
  const isChoker = isChokerNecklace(product);

  useEffect(() => {
    let cancelled = false;
    setImgError(false);
    if (!imageUrl) {
      setTransparentSrc(null);
      onImageStatusChange?.("necklace", "ready");
      return;
    }
    const isDirectTransparent = (
      imageUrl.includes("-tryon.png") ||
      imageUrl.includes("-transparent.png") ||
      imageUrl.startsWith("data:image/")
    );
    if (isDirectTransparent) {
      setTransparentSrc(imageUrl);
      onImageStatusChange?.("necklace", "loaded");
      return;
    }
    onImageStatusChange?.("necklace", "loading");
    getTransparentJewelleryImage(imageUrl)
      .then((cleanUrl) => {
        if (!cancelled) {
          setTransparentSrc(cleanUrl || imageUrl);
          onImageStatusChange?.("necklace", "loaded");
        }
      })
      .catch((err) => {
        console.warn(`[NecklaceOverlay] Background removal fallback:`, err);
        if (!cancelled) {
          setTransparentSrc(imageUrl);
          onImageStatusChange?.("necklace", "loaded");
        }
      });
    return () => { cancelled = true; };
  }, [imageUrl, product?.id]);

  const onPointerDown = (e) => {
    e.stopPropagation();
    start.current = { x: e.clientX, y: e.clientY, ox: config.offsetX, oy: config.offsetY };
    const move = (ev) => {
      const dx = ev.clientX - start.current.x;
      const dy = ev.clientY - start.current.y;
      onDrag({ offsetX: start.current.ox + dx, offsetY: start.current.oy + dy });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const x = (anchor?.x ?? 0) + config.offsetX;
  const y = (anchor?.y ?? 0) + config.offsetY;

  // Neck width is anatomically ~1.55x cheekbone width or ~1.45x face height
  const baseWidth = Math.round(anchor?.widthPx || faceHeightPx * 1.55);
  const finalWidth = Math.max(140, Math.min(620, Math.round(baseWidth * config.scale)));

  // Necklaces drape with gravity: only slight tilt with head roll (~35%)
  const rollComp = (anchor?.rollDeg || 0) * 0.35;
  const totalRotate = config.rotate + rollComp + autoRotateDeg;

  // Suprasternal notch placement: top center of necklace sits at collarbone dip
  const transformOrigin = "50% 12%";
  const translateTransform = "translate(-50%, -12%)";
  const isVisible = anchor?.visible !== false;

  const isDedicatedTryOn = imageUrl && (imageUrl.includes("-tryon.png") || imageUrl.includes("-transparent.png") || imageUrl.startsWith("data:image/"));
  const displaySrc = transparentSrc || (isDedicatedTryOn ? imageUrl : null);

  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute z-20 cursor-grab active:cursor-grabbing touch-none select-none transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${finalWidth}px`,
        transformOrigin,
        transform: `${translateTransform} rotate(${totalRotate}deg)`,
        filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.52)) contrast(1.04) brightness(1.02)",
      }}
    >
      {displaySrc && !imgError ? (
        <img
          ref={imgRef}
          src={displaySrc}
          alt={product?.name || "Necklace"}
          onLoad={() => onImageStatusChange?.("necklace", "loaded")}
          onError={(e) => {
            console.warn(`[VirtualTryOn] Failed to load necklace image for ${product?.name}:`, imageUrl, e);
            setImgError(true);
            onImageStatusChange?.("necklace", "error");
          }}
          className="w-full h-auto object-contain pointer-events-none bg-transparent"
        />
      ) : (
        <EarringArt
          ref={svgRef}
          kind={isChoker ? "kundan-choker" : "pearl-cluster-necklace"}
          color={product?.color || "Gold"}
          size={finalWidth}
        />
      )}
    </div>
  );
}

function OrnamentOverlay({
  product,
  config,
  onDrag,
  svgRef,
  imgRef,
  autoRotateDeg = 0,
  onImageStatusChange,
  containerDims,
}) {
  const start = useRef(null);
  const [imgError, setImgError] = useState(false);
  const [transparentSrc, setTransparentSrc] = useState(null);
  const assets = getProductTryOnAssets(product);
  const imageUrl = assets.ornamentAsset || assets.earringAsset;
  const isRing = getProductJewelleryType(product) === "ring";

  useEffect(() => {
    let cancelled = false;
    setImgError(false);
    if (!imageUrl) {
      setTransparentSrc(null);
      onImageStatusChange?.("ornament", "ready");
      return;
    }
    const isDirectTransparent = (
      imageUrl.includes("-tryon.png") ||
      imageUrl.includes("-transparent.png") ||
      imageUrl.startsWith("data:image/")
    );
    if (isDirectTransparent) {
      setTransparentSrc(imageUrl);
      onImageStatusChange?.("ornament", "loaded");
      return;
    }
    onImageStatusChange?.("ornament", "loading");
    getTransparentJewelleryImage(imageUrl)
      .then((cleanUrl) => {
        if (!cancelled) {
          setTransparentSrc(cleanUrl || imageUrl);
          onImageStatusChange?.("ornament", "loaded");
        }
      })
      .catch((err) => {
        console.warn("[OrnamentOverlay] Background removal fallback:", err);
        if (!cancelled) {
          setTransparentSrc(imageUrl);
          onImageStatusChange?.("ornament", "loaded");
        }
      });
    return () => { cancelled = true; };
  }, [imageUrl, product?.id]);

  const onPointerDown = (e) => {
    e.stopPropagation();
    start.current = { x: e.clientX, y: e.clientY, ox: config.offsetX, oy: config.offsetY };
    const move = (ev) => {
      const dx = ev.clientX - start.current.x;
      const dy = ev.clientY - start.current.y;
      onDrag({ offsetX: start.current.ox + dx, offsetY: start.current.oy + dy });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const cw = containerDims?.cw || 360;
  const ch = containerDims?.ch || 480;
  const baseX = cw * 0.5;
  const baseY = ch * (isRing ? 0.72 : 0.78);

  const x = baseX + config.offsetX;
  const y = baseY + config.offsetY;

  const baseSize = isRing ? 110 : 160;
  const finalSize = Math.max(50, Math.min(340, Math.round(baseSize * config.scale)));
  const totalRotate = config.rotate + autoRotateDeg;

  const isDedicatedTryOn = imageUrl && (imageUrl.includes("-tryon.png") || imageUrl.includes("-transparent.png") || imageUrl.startsWith("data:image/"));
  const displaySrc = transparentSrc || (isDedicatedTryOn ? imageUrl : null);

  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute z-20 cursor-grab active:cursor-grabbing touch-none select-none transition-opacity duration-200 opacity-100"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${finalSize}px`,
        height: `${finalSize}px`,
        transformOrigin: "50% 50%",
        transform: `translate(-50%, -50%) rotate(${totalRotate}deg)`,
        filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.52)) contrast(1.04) brightness(1.02)",
      }}
    >
      {displaySrc && !imgError ? (
        <img
          ref={imgRef}
          src={displaySrc}
          alt={product?.name || (isRing ? "Ring" : "Bracelet")}
          onLoad={() => onImageStatusChange?.("ornament", "loaded")}
          onError={(e) => {
            console.warn(`[VirtualTryOn] Failed to load ornament image for ${product?.name}:`, imageUrl, e);
            setImgError(true);
            onImageStatusChange?.("ornament", "error");
          }}
          className="w-full h-full object-contain pointer-events-none bg-transparent"
        />
      ) : (
        <EarringArt
          ref={svgRef}
          kind={isRing ? "statement-ring" : "bangle"}
          color={product?.color || "Gold"}
          size={finalSize}
        />
      )}
    </div>
  );
}

function DebugOverlay({
  anchors,
  config,
  candidate,
  trackingStatus,
  imageStatuses,
  imageUrl,
  error,
  videoDims,
  containerDims,
  imgRefs,
  isMirrored = true,
}) {
  const isStud = isStudEarring(candidate);
  const faceHeightPx = anchors?.faceHeightPx || 200;
  const isStatement = ["jhumka", "chandbali", "chandelier", "fan"].includes(candidate?.kind) ||
    /jhumka|chandbali|chandelier|royal|temple/i.test(candidate?.name || "");
  const baseSize = isStud ? Math.round(faceHeightPx * 0.18) :
                   isStatement ? Math.round(faceHeightPx * 0.44) :
                   Math.round(faceHeightPx * 0.34);

  const leftScale = config?.left?.scale || 1;
  const rightScale = config?.right?.scale || 1;
  const leftSize = Math.max(26, Math.min(260, Math.round(baseSize * leftScale)));
  const rightSize = Math.max(26, Math.min(260, Math.round(baseSize * rightScale)));

  const lx = (anchors?.left?.x ?? 0) + (config?.left?.offsetX || 0);
  const ly = (anchors?.left?.y ?? 0) + (config?.left?.offsetY || 0);
  const rx = (anchors?.right?.x ?? 0) + (config?.right?.offsetX || 0);
  const ry = (anchors?.right?.y ?? 0) + (config?.right?.offsetY || 0);
  const nx = (anchors?.necklace?.x ?? 0);
  const ny = (anchors?.necklace?.y ?? 0);

  const leftStatus = imageStatuses?.left || "loading";
  const rightStatus = imageStatuses?.right || "loading";
  const neckStatus = imageStatuses?.necklace || "loading";

  const leftEl = imgRefs?.left?.current;
  const naturalDims = leftEl && leftEl.naturalWidth
    ? `${leftEl.naturalWidth}×${leftEl.naturalHeight}px`
    : "pending";
  const decodedStatus = leftEl && leftEl.complete ? "decoded" : "decoding";

  return (
    <div className="absolute inset-0 pointer-events-none z-30 font-mono text-[11px]">
      <svg className="w-full h-full absolute inset-0">
        {/* Key face landmarks (cyan dots) */}
        {anchors?.keyLandmarks && Object.entries(anchors.keyLandmarks).map(([k, pt]) => (
          <g key={k}>
            <circle cx={pt.x} cy={pt.y} r={2.5} fill="#00e5ff" opacity={0.8} />
            <text x={pt.x + 3} y={pt.y - 2} fill="#00e5ff" fontSize={8} opacity={0.7}>{k}</text>
          </g>
        ))}

        {/* Left Piercing Anchor Target */}
        {anchors?.left && (
          <g transform={`translate(${lx}, ${ly})`}>
            <circle r={9} fill="none" stroke="#ff3d00" strokeWidth={1.8} />
            <circle r={2.5} fill="#ff3d00" />
            <line x1={-14} y1={0} x2={14} y2={0} stroke="#ff3d00" strokeWidth={1.2} />
            <line x1={0} y1={-14} x2={0} y2={14} stroke="#ff3d00" strokeWidth={1.2} />
            <rect
              x={-leftSize / 2}
              y={isStud ? -leftSize / 2 : -leftSize * 0.12}
              width={leftSize}
              height={leftSize}
              fill="rgba(0, 230, 118, 0.08)"
              stroke="#00e676"
              strokeDasharray="3 3"
              strokeWidth={1.2}
            />
            <text x={14} y={-4} fill="#ff3d00" fontSize={10} fontWeight="bold">
              L Ear: ({Math.round(lx)}, {Math.round(ly)}) {anchors.left.visible ? "✓" : "OCCLUDED"}
            </text>
          </g>
        )}

        {/* Right Piercing Anchor Target */}
        {anchors?.right && (
          <g transform={`translate(${rx}, ${ry})`}>
            <circle r={9} fill="none" stroke="#00e5ff" strokeWidth={1.8} />
            <circle r={2.5} fill="#00e5ff" />
            <line x1={-14} y1={0} x2={14} y2={0} stroke="#00e5ff" strokeWidth={1.2} />
            <line x1={0} y1={-14} x2={0} y2={14} stroke="#00e5ff" strokeWidth={1.2} />
            <rect
              x={-rightSize / 2}
              y={isStud ? -rightSize / 2 : -rightSize * 0.12}
              width={rightSize}
              height={rightSize}
              fill="rgba(0, 230, 118, 0.08)"
              stroke="#00e676"
              strokeDasharray="3 3"
              strokeWidth={1.2}
            />
            <text x={14} y={-4} fill="#00e5ff" fontSize={10} fontWeight="bold">
              R Ear: ({Math.round(rx)}, {Math.round(ry)}) {anchors.right.visible ? "✓" : "OCCLUDED"}
            </text>
          </g>
        )}

        {/* Collarbone / Neck Anchor Target */}
        {anchors?.necklace && (
          <g transform={`translate(${nx}, ${ny})`}>
            <circle r={12} fill="none" stroke="#ffd700" strokeWidth={1.8} strokeDasharray="4 2" />
            <circle r={3} fill="#ffd700" />
            <text x={16} y={-4} fill="#ffd700" fontSize={10} fontWeight="bold">
              NECK: ({Math.round(nx)}, {Math.round(ny)})
            </text>
          </g>
        )}
      </svg>

      {/* Metrics HUD Box */}
      <div className="absolute top-2 left-2 max-w-[310px] bg-black/90 text-white/90 p-2.5 rounded border border-white/20 backdrop-blur-md shadow-xl space-y-1">
        <div className="flex items-center justify-between border-b border-white/20 pb-1">
          <span className="text-primary font-bold text-[11.5px]">Virtual Try-On Diagnostics</span>
          <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold ${
            trackingStatus === "TRACKING" ? "bg-emerald-500/30 text-emerald-300" :
            trackingStatus === "NO_FACE" ? "bg-rose-500/30 text-rose-300" :
            "bg-amber-500/30 text-amber-300"
          }`}>
            {trackingStatus || "STANDBY"}
          </span>
        </div>
        <div className="text-[10px] space-y-0.5 text-white/80">
          <div><strong className="text-white/60">Product ID:</strong> {candidate?.id || "None"}</div>
          <div><strong className="text-white/60">Name:</strong> {candidate?.name || "None"} ({candidate?.kind || "standard"})</div>
          <div><strong className="text-white/60">Asset URL:</strong> <span className="break-all text-[9px] text-primary">{imageUrl || "None"}</span></div>
          <div><strong className="text-white/60">Natural Dims:</strong> {naturalDims} | <strong className="text-white/60">Decode:</strong> <span className={decodedStatus === "decoded" ? "text-emerald-400" : "text-amber-400"}>{decodedStatus}</span></div>
          <div><strong className="text-white/60">Load Status:</strong> L: <span className={leftStatus === "loaded" ? "text-emerald-400" : leftStatus === "error" ? "text-rose-400" : "text-amber-400"}>{leftStatus}</span> | R: <span className={rightStatus === "loaded" ? "text-emerald-400" : rightStatus === "error" ? "text-rose-400" : "text-amber-400"}>{rightStatus}</span></div>
          <div><strong className="text-white/60">Overlay Size:</strong> L: {leftSize}×{leftSize}px | R: {rightSize}×{rightSize}px</div>
          <div><strong className="text-white/60">Video Dims:</strong> {videoDims?.vw || 640}×{videoDims?.vh || 480} | <strong className="text-white/60">Screen:</strong> {containerDims?.cw || 360}×{containerDims?.ch || 480}</div>
          <div><strong className="text-white/60">Mirroring:</strong> {isMirrored ? "scaleX(-1) Active" : "Unmirrored"}</div>
          <div><strong className="text-white/60">Head Pose:</strong> Yaw: {anchors?.yawDeg ? anchors.yawDeg.toFixed(1) : "0.0"}° | Roll: {anchors?.rollDeg ? anchors.rollDeg.toFixed(1) : "0.0"}°</div>
          <div><strong className="text-white/60">Face Height:</strong> {Math.round(faceHeightPx)}px</div>
          <div><strong className="text-white/60">Ear Anchors:</strong> L: ({Math.round(lx)}, {Math.round(ly)}) | R: ({Math.round(rx)}, {Math.round(ry)})</div>
          {error && <div className="text-rose-400 font-semibold"><strong className="text-white/60">Error:</strong> {error}</div>}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ icon, title, desc, action, extra }) {
  return <div className="text-center max-w-[300px]"><div className="text-primary mb-3 flex justify-center">{icon}</div><p className="text-white text-[14px] mb-1.5">{title}</p><p className="text-white/70 text-[12.5px] mb-5 leading-relaxed">{desc}</p>{action}{extra}</div>;
}

function VirtualTryOnModal() {
  const { tryOnProduct, closeTryOn, addToCart, wishlist, toggleWishlist } = useApp();
  const [mode, setMode] = useState(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [anchors, setAnchors] = useState(null);
  const [autoYaw, setAutoYaw] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [config, setConfig] = useState({ left: { offsetX: 0, offsetY: 0, scale: 1, rotate: 0 }, right: { offsetX: 0, offsetY: 0, scale: 1, rotate: 0 } });
  const [necklaceConfig, setNecklaceConfig] = useState({ offsetX: 0, offsetY: 0, scale: 1, rotate: 0 });
  const [ornamentConfig, setOrnamentConfig] = useState({ offsetX: 0, offsetY: 0, scale: 1, rotate: 0 });
  const [jewelrySetMode, setJewelrySetMode] = useState("full"); // "full" | "necklace" | "earrings"
  const [candidate, setCandidate] = useState(tryOnProduct);
  const [related, setRelated] = useState([]);
  const [noFace, setNoFace] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [imageStatuses, setImageStatuses] = useState({ left: "loading", right: "loading", necklace: "loading", ornament: "loading" });
  const [photoIsSelfie, setPhotoIsSelfie] = useState(false);

  const videoRef = useRef(null), containerRef = useRef(null), fileRef = useRef(null);
  const leftSvgRef = useRef(null), rightSvgRef = useRef(null), necklaceSvgRef = useRef(null), ornamentSvgRef = useRef(null);
  const leftImgRef = useRef(null), rightImgRef = useRef(null), necklaceImgRef = useRef(null), ornamentImgRef = useRef(null);
  const stopTrackingRef = useRef(null);
  const openedLoggedRef = useRef(false);
  const streamRef = useRef(null);
  const smoothedRef = useRef(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);

  const productType = getProductJewelleryType(candidate); // "earrings" | "necklace" | "set" | "bracelet" | "ring"
  const showEarrings = productType === "earrings" || (productType === "set" && jewelrySetMode !== "necklace");
  const showNecklace = productType === "necklace" || (productType === "set" && jewelrySetMode !== "earrings");
  const showOrnament = productType === "bracelet" || productType === "ring";

  const updateImageStatus = (side, st) => {
    setImageStatuses(prev => (prev[side] === st ? prev : { ...prev, [side]: st }));
  };

  // Keyboard shortcut: Press 'd' or 'D' to toggle Developer Diagnostics
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === "d" || e.key === "D") && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        setDebugMode(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setCandidate(tryOnProduct);
    setConfig({ left: { offsetX: 0, offsetY: 0, scale: 1, rotate: 0 }, right: { offsetX: 0, offsetY: 0, scale: 1, rotate: 0 } });
    setNecklaceConfig({ offsetX: 0, offsetY: 0, scale: 1, rotate: 0 });
    setOrnamentConfig({ offsetX: 0, offsetY: 0, scale: 1, rotate: 0 });
    setJewelrySetMode("full");
    if (tryOnProduct) {
      api.getProducts({ limit: 20 })
        .then(r => {
          const others = (r.results || []).filter(p => p.id !== tryOnProduct.id);
          setRelated(others.slice(0, 10));
        })
        .catch(() => {});
    }
  }, [tryOnProduct]);

  useEffect(() => {
    if (tryOnProduct && !openedLoggedRef.current) {
      openedLoggedRef.current = true;
      api.logTryOnEvent({ productId: tryOnProduct.id, eventType: "opened" }).catch(() => {});
    }
    if (!tryOnProduct) openedLoggedRef.current = false;
  }, [tryOnProduct]);

  const startSession = (m) => {
    if (!candidate) return;
    api.startTryOnSession(candidate.id, m).then(s => {
      setSession(s);
      api.logTryOnEvent({ sessionId: s.id, productId: candidate.id, eventType: "started" }).catch(() => {});
    }).catch(() => {});
  };

  const switchCandidate = (p) => {
    if (session) api.logTryOnEvent({ sessionId: session.id, productId: candidate.id, eventType: "product_changed", metadata: { toProductId: p.id } }).catch(() => {});
    setImageStatuses({ left: "loading", right: "loading", necklace: "loading", ornament: "loading" });
    setCandidate(p);
    setJewelrySetMode("full");
    setConfig({ left: { offsetX: 0, offsetY: 0, scale: 1, rotate: 0 }, right: { offsetX: 0, offsetY: 0, scale: 1, rotate: 0 } });
    setNecklaceConfig({ offsetX: 0, offsetY: 0, scale: 1, rotate: 0 });
    setOrnamentConfig({ offsetX: 0, offsetY: 0, scale: 1, rotate: 0 });
  };

  useEffect(() => {
    if (mode !== "camera") return;
    let active = true;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) { setError("UNSUPPORTED_BROWSER"); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(s => {
        if (!active) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        setStream(s);
        startSession("camera");
      })
      .catch(err => setError(
        err.name === "NotAllowedError" ? "PERMISSION_DENIED" :
        (err.name === "NotReadableError" || err.name === "TrackStartError") ? "DEVICE_IN_USE" :
        "UNSUPPORTED_BROWSER"
      ));
    return () => {
      active = false;
      streamRef.current?.getTracks()?.forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [mode, cameraAttempt]);

  useEffect(() => { if (stream && videoRef.current) videoRef.current.srcObject = stream; }, [stream]);

  // Real-time tracking against camera stream with precise coordinate mapping & EMA smoothing
  useEffect(() => {
    if (mode !== "camera" || !stream || error) return;
    let cancelled = false;
    const el = containerRef.current;
    const video = videoRef.current;
    if (!el || !video) return;

    import("./services/earTracking.js").then(({ startEarTracking, TrackingStatus }) => {
      if (cancelled) return;
      stopTrackingRef.current = startEarTracking(video, {
        onFrame: (frame) => {
          setTrackingStatus(frame.status);
          if (frame.status !== TrackingStatus.TRACKING) return;
          const rect = el.getBoundingClientRect();
          const cw = Math.round(rect.width || el.clientWidth || 360);
          const ch = Math.round(rect.height || el.clientHeight || 480);
          if (cw < 40 || ch < 40) return;
          const vw = video.videoWidth || frame.videoWidth || 640;
          const vh = video.videoHeight || frame.videoHeight || 480;

          // Mirrored selfie view (video has CSS scaleX(-1)):
          // Wearer's left ear (raw image right) is displayed on SCREEN LEFT.
          // Wearer's right ear (raw image left) is displayed on SCREEN RIGHT.
          const leftCoord = mapVideoToContainer({
            normX: frame.wearerLeft.x,
            normY: frame.wearerLeft.y,
            videoWidth: vw,
            videoHeight: vh,
            containerWidth: cw,
            containerHeight: ch,
            isMirrored: true,
          });

          const rightCoord = mapVideoToContainer({
            normX: frame.wearerRight.x,
            normY: frame.wearerRight.y,
            videoWidth: vw,
            videoHeight: vh,
            containerWidth: cw,
            containerHeight: ch,
            isMirrored: true,
          });

          // Anatomical collarbone / neck anchor for necklaces
          const neckCoord = frame.necklace ? mapVideoToContainer({
            normX: frame.necklace.x,
            normY: frame.necklace.y,
            videoWidth: vw,
            videoHeight: vh,
            containerWidth: cw,
            containerHeight: ch,
            isMirrored: true,
          }) : null;

          const faceHeightPx = (frame.faceHeight || 0.4) * leftCoord.renderHeight;
          const neckWidthPx = (frame.necklace?.widthNorm || 0.45) * leftCoord.renderWidth;
          const screenRollDeg = -(frame.rollDeg || 0);

          let mappedKeyLandmarks = null;
          if (frame.keyLandmarks) {
            mappedKeyLandmarks = {};
            for (const [key, pt] of Object.entries(frame.keyLandmarks)) {
              mappedKeyLandmarks[key] = mapVideoToContainer({
                normX: pt.x,
                normY: pt.y,
                videoWidth: vw,
                videoHeight: vh,
                containerWidth: cw,
                containerHeight: ch,
                isMirrored: true,
              });
            }
          }

          // EMA smoothing to eliminate camera landmark jitter
          const alpha = 0.42;
          let prev = smoothedRef.current;
          if (!prev) {
            prev = {
              leftX: leftCoord.x,
              leftY: leftCoord.y,
              rightX: rightCoord.x,
              rightY: rightCoord.y,
              neckX: neckCoord ? neckCoord.x : cw / 2,
              neckY: neckCoord ? neckCoord.y : ch * 0.72,
              neckWidthPx: neckWidthPx || faceHeightPx * 1.55,
              neckRollDeg: (frame.necklace?.rollDeg || 0),
              faceHeightPx,
              rollDeg: screenRollDeg,
            };
          } else {
            prev = {
              leftX: prev.leftX * (1 - alpha) + leftCoord.x * alpha,
              leftY: prev.leftY * (1 - alpha) + leftCoord.y * alpha,
              rightX: prev.rightX * (1 - alpha) + rightCoord.x * alpha,
              rightY: prev.rightY * (1 - alpha) + rightCoord.y * alpha,
              neckX: neckCoord ? prev.neckX * (1 - alpha) + neckCoord.x * alpha : prev.neckX,
              neckY: neckCoord ? prev.neckY * (1 - alpha) + neckCoord.y * alpha : prev.neckY,
              neckWidthPx: neckWidthPx ? prev.neckWidthPx * (1 - alpha) + neckWidthPx * alpha : prev.neckWidthPx,
              neckRollDeg: prev.neckRollDeg * (1 - alpha) + (frame.necklace?.rollDeg || 0) * alpha,
              faceHeightPx: prev.faceHeightPx * (1 - alpha) + faceHeightPx * alpha,
              rollDeg: prev.rollDeg * (1 - alpha) + screenRollDeg * alpha,
            };
          }
          smoothedRef.current = prev;

          setAnchors({
            left: {
              x: prev.leftX,
              y: prev.leftY,
              visible: frame.wearerLeft?.visible !== false,
              rollDeg: prev.rollDeg,
            },
            right: {
              x: prev.rightX,
              y: prev.rightY,
              visible: frame.wearerRight?.visible !== false,
              rollDeg: prev.rollDeg,
            },
            necklace: {
              x: prev.neckX,
              y: prev.neckY,
              widthPx: prev.neckWidthPx,
              rollDeg: prev.neckRollDeg,
              visible: frame.necklace?.visible !== false,
            },
            faceHeightPx: prev.faceHeightPx,
            rollDeg: prev.rollDeg,
            yawDeg: frame.yawDeg || 0,
            videoDimensions: { vw, vh, cw, ch },
            keyLandmarks: mappedKeyLandmarks,
          });

          setAutoYaw((frame.yawDeg || 0) * 0.25);
          setNoFace(false);
        },
        onError: () => setError("UNSUPPORTED_BROWSER"),
      });
    });

    return () => {
      cancelled = true;
      stopTrackingRef.current?.();
      stopTrackingRef.current = null;
      smoothedRef.current = null;
    };
  }, [mode, stream, error]);

  // Photo try-on path (supports both captured selfies and uploaded portraits)
  useEffect(() => {
    if (!photo) return;
    const el = containerRef.current;
    if (!el) return;
    const img = new Image();
    img.onload = () => {
      import("./services/earTracking.js").then(({ detectEarAnchorsFromImage, TrackingStatus }) => {
        detectEarAnchorsFromImage(img).then(frame => {
          if (frame.status === TrackingStatus.TRACKING) {
            const rect = el.getBoundingClientRect();
            const cw = Math.round(rect.width || el.clientWidth || 360);
            const ch = Math.round(rect.height || el.clientHeight || 480);
            const vw = frame.videoWidth || img.naturalWidth || 640;
            const vh = frame.videoHeight || img.naturalHeight || 480;

            // In a camera-captured selfie, the image is already mirrored -> wearerLeft is on image left.
            // In an uploaded photo, the image is unmirrored -> wearerRight is on image left.
            const leftAnchorSrc = photoIsSelfie ? frame.wearerLeft : frame.wearerRight;
            const rightAnchorSrc = photoIsSelfie ? frame.wearerRight : frame.wearerLeft;

            const leftCoord = mapVideoToContainer({
              normX: leftAnchorSrc.x,
              normY: leftAnchorSrc.y,
              videoWidth: vw,
              videoHeight: vh,
              containerWidth: cw,
              containerHeight: ch,
              isMirrored: false,
            });

            const rightCoord = mapVideoToContainer({
              normX: rightAnchorSrc.x,
              normY: rightAnchorSrc.y,
              videoWidth: vw,
              videoHeight: vh,
              containerWidth: cw,
              containerHeight: ch,
              isMirrored: false,
            });

            const neckCoord = frame.necklace ? mapVideoToContainer({
              normX: frame.necklace.x,
              normY: frame.necklace.y,
              videoWidth: vw,
              videoHeight: vh,
              containerWidth: cw,
              containerHeight: ch,
              isMirrored: false,
            }) : null;

            const faceHeightPx = (frame.faceHeight || 0.4) * leftCoord.renderHeight;
            const neckWidthPx = (frame.necklace?.widthNorm || 0.45) * leftCoord.renderWidth;

            let mappedKeyLandmarks = null;
            if (frame.keyLandmarks) {
              mappedKeyLandmarks = {};
              for (const [key, pt] of Object.entries(frame.keyLandmarks)) {
                mappedKeyLandmarks[key] = mapVideoToContainer({
                  normX: pt.x,
                  normY: pt.y,
                  videoWidth: vw,
                  videoHeight: vh,
                  containerWidth: cw,
                  containerHeight: ch,
                  isMirrored: false,
                });
              }
            }

            setAnchors({
              left: {
                x: leftCoord.x,
                y: leftCoord.y,
                visible: leftAnchorSrc?.visible !== false,
                rollDeg: frame.rollDeg || 0,
              },
              right: {
                x: rightCoord.x,
                y: rightCoord.y,
                visible: rightAnchorSrc?.visible !== false,
                rollDeg: frame.rollDeg || 0,
              },
              necklace: neckCoord ? {
                x: neckCoord.x,
                y: neckCoord.y,
                widthPx: neckWidthPx || faceHeightPx * 1.55,
                rollDeg: frame.necklace?.rollDeg || 0,
                visible: frame.necklace?.visible !== false,
              } : null,
              faceHeightPx,
              rollDeg: frame.rollDeg || 0,
              yawDeg: frame.yawDeg || 0,
              videoDimensions: { vw, vh, cw, ch },
              keyLandmarks: mappedKeyLandmarks,
            });
            setNoFace(false);
          } else {
            setNoFace(true);
          }
        }).catch(() => setNoFace(true));
      });
    };
    img.src = photo;
  }, [photo, photoIsSelfie]);

  const stopAll = () => {
    stream?.getTracks()?.forEach(t => t.stop());
    streamRef.current = null;
    setStream(null);
    stopTrackingRef.current?.();
    stopTrackingRef.current = null;
    smoothedRef.current = null;
    setTrackingStatus(null);
  };

  const capture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/png"));
    setPhotoIsSelfie(true);
    stopAll();
  };
  const retake = () => { setPhoto(null); setMode("camera"); };

  const onUpload = (e) => {
    if (!e.target.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result);
      setPhotoIsSelfie(false);
    };
    reader.readAsDataURL(e.target.files[0]);
    startSession("upload");
  };

  // Earring drag & adjustments
  const dragUpdate = (side, patch) => setConfig(c => ({ ...c, [side]: { ...c[side], ...patch } }));
  const adjustScale = (side, d) => setConfig(c => ({ ...c, [side]: { ...c[side], scale: Math.max(0.5, Math.min(2.4, c[side].scale + d)) } }));
  const adjustRotate = (side, d) => setConfig(c => ({ ...c, [side]: { ...c[side], rotate: c[side].rotate + d } }));

  // Necklace drag & adjustments
  const dragNecklaceUpdate = (patch) => setNecklaceConfig(c => ({ ...c, ...patch }));
  const adjustNecklaceScale = (d) => setNecklaceConfig(c => ({ ...c, scale: Math.max(0.6, Math.min(2.4, c.scale + d)) }));
  const adjustNecklaceOffsetY = (d) => setNecklaceConfig(c => ({ ...c, offsetY: c.offsetY + d }));
  const adjustNecklaceOffsetX = (d) => setNecklaceConfig(c => ({ ...c, offsetX: c.offsetX + d }));
  const adjustNecklaceRotate = (d) => setNecklaceConfig(c => ({ ...c, rotate: c.rotate + d }));

  // Ornament (bracelet/ring) drag & adjustments
  const dragOrnamentUpdate = (patch) => setOrnamentConfig(c => ({ ...c, ...patch }));
  const adjustOrnamentScale = (d) => setOrnamentConfig(c => ({ ...c, scale: Math.max(0.5, Math.min(2.5, c.scale + d)) }));
  const adjustOrnamentRotate = (d) => setOrnamentConfig(c => ({ ...c, rotate: c.rotate + d }));
  const adjustOrnamentOffsetY = (d) => setOrnamentConfig(c => ({ ...c, offsetY: c.offsetY + d }));
  const adjustOrnamentOffsetX = (d) => setOrnamentConfig(c => ({ ...c, offsetX: c.offsetX + d }));

  const close = () => { stopAll(); setPhoto(null); setMode(null); setSession(null); closeTryOn(); };

  const addFromTryOn = async () => {
    await addToCart(candidate);
    if (session) {
      api.convertTryOnSession(session.id).catch(() => {});
      api.logTryOnEvent({ sessionId: session.id, productId: candidate.id, eventType: "add_to_cart" }).catch(() => {});
    }
  };

  const wishlistFromTryOn = async () => {
    await toggleWishlist(candidate.id);
    if (session) api.logTryOnEvent({ sessionId: session.id, productId: candidate.id, eventType: "wishlist" }).catch(() => {});
  };

  // High-fidelity screenshot compositing with exact coordinate and transform parity for necklaces, earrings & ornaments
  const saveScreenshot = async () => {
    const el = containerRef.current;
    if (!el || (!anchors && !showOrnament)) return;
    const w = el.clientWidth, h = el.clientHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");

    // Base layer: mirrored video or photo
    const source = photo ? await loadImage(photo) : videoRef.current;
    const sw = photo ? source.width : source.videoWidth;
    const sh = photo ? source.height : source.videoHeight;
    const { sx, sy, sWidth, sHeight } = coverCrop(sw, sh, w, h);
    ctx.save();
    if (mode === "camera" && !photo) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, w, h);
    ctx.restore();

    const faceHeightPx = anchors?.faceHeightPx || 200;

    // 1. Draw Necklace if visible
    if (showNecklace && anchors?.necklace && anchors.necklace.visible !== false) {
      const neckAnchor = anchors.necklace;
      const cfg = necklaceConfig;
      const nx = neckAnchor.x + cfg.offsetX;
      const ny = neckAnchor.y + cfg.offsetY;
      const baseWidth = Math.round(neckAnchor.widthPx || faceHeightPx * 1.55);
      const finalWidth = Math.max(140, Math.min(620, Math.round(baseWidth * cfg.scale)));
      const rollComp = (neckAnchor.rollDeg || 0) * 0.35;
      const totalRotate = cfg.rotate + rollComp + autoYaw;

      let drawable = null;
      if (necklaceImgRef.current && necklaceImgRef.current.complete && necklaceImgRef.current.naturalWidth > 0) {
        drawable = necklaceImgRef.current;
      } else if (necklaceSvgRef.current) {
        drawable = await svgElementToImage(necklaceSvgRef.current);
      }

      if (drawable) {
        ctx.save();
        ctx.translate(nx, ny);
        ctx.rotate((totalRotate * Math.PI) / 180);
        ctx.shadowColor = "rgba(0,0,0,0.52)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 6;
        const dWidth = drawable.naturalWidth || drawable.width || finalWidth;
        const dHeight = drawable.naturalHeight || drawable.height || (finalWidth * 0.7);
        const finalHeight = (finalWidth / dWidth) * dHeight;
        ctx.drawImage(drawable, -finalWidth / 2, -finalHeight * 0.12, finalWidth, finalHeight);
        ctx.restore();
      }
    }

    // 2. Draw Earrings if visible
    if (showEarrings && anchors) {
      const isStud = isStudEarring(candidate);
      const isStatement = ["jhumka", "chandbali", "chandelier", "fan"].includes(candidate?.kind) ||
        /jhumka|chandbali|chandelier|royal|temple/i.test(candidate?.name || "");
      const baseSize = isStud ? Math.round(faceHeightPx * 0.18) :
                       isStatement ? Math.round(faceHeightPx * 0.44) :
                       Math.round(faceHeightPx * 0.34);

      const overlays = [
        { side: "left", ref: leftSvgRef, imgRef: leftImgRef },
        { side: "right", ref: rightSvgRef, imgRef: rightImgRef },
      ];

      for (const { side, ref, imgRef } of overlays) {
        const anchor = anchors[side];
        if (!anchor || anchor.visible === false) continue;
        const cfg = config[side];
        const x = anchor.x + cfg.offsetX;
        const y = anchor.y + cfg.offsetY;
        const size = Math.max(26, Math.min(260, Math.round(baseSize * cfg.scale)));
        const rollComp = (anchor.rollDeg || 0) * (isStud ? 1.0 : 0.35);
        const totalRotate = cfg.rotate + rollComp + autoYaw;

        let drawable = null;
        if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
          drawable = imgRef.current;
        } else if (ref.current) {
          drawable = await svgElementToImage(ref.current);
        }
        if (!drawable) continue;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((totalRotate * Math.PI) / 180);
        ctx.shadowColor = "rgba(0,0,0,0.48)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        if (isStud) {
          ctx.drawImage(drawable, -size / 2, -size / 2, size, size);
        } else {
          ctx.drawImage(drawable, -size / 2, -size * 0.12, size, size);
        }
        ctx.restore();
      }
    }

    // 3. Draw Ornament (Bracelet / Ring) if visible
    if (showOrnament) {
      const isRing = productType === "ring";
      const cfg = ornamentConfig;
      const ox = (w * 0.5) + cfg.offsetX;
      const oy = (h * (isRing ? 0.72 : 0.78)) + cfg.offsetY;
      const baseSize = isRing ? 110 : 160;
      const finalSize = Math.max(50, Math.min(340, Math.round(baseSize * cfg.scale)));
      const totalRotate = cfg.rotate + autoYaw;

      let drawable = null;
      if (ornamentImgRef.current && ornamentImgRef.current.complete && ornamentImgRef.current.naturalWidth > 0) {
        drawable = ornamentImgRef.current;
      } else if (ornamentSvgRef.current) {
        drawable = await svgElementToImage(ornamentSvgRef.current);
      }

      if (drawable) {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate((totalRotate * Math.PI) / 180);
        ctx.shadowColor = "rgba(0,0,0,0.52)";
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 6;
        ctx.drawImage(drawable, -finalSize / 2, -finalSize / 2, finalSize, finalSize);
        ctx.restore();
      }
    }

    const link = document.createElement("a");
    link.download = `aurelie-tryon-${candidate?.id || "look"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    if (session) api.logTryOnEvent({ sessionId: session.id, productId: candidate.id, eventType: "screenshot" }).catch(() => {});
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  if (!tryOnProduct) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-[#0B1C2C]/90 flex items-center justify-center p-3 md:p-8">
      <div className="bg-surface w-full max-w-[920px] max-h-[94vh] overflow-y-auto md:grid md:grid-cols-[1fr_320px]">
        <div className="relative bg-ink flex items-center justify-center min-h-[420px] md:min-h-[560px] h-full self-stretch overflow-hidden">
          <button onClick={close} className="absolute top-3 right-3 z-30 bg-black/40 text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/60 transition-colors"><X size={17}/></button>

          {!mode && (
            <div className="text-center px-8">
              <Sparkles size={26} className="mx-auto mb-4 text-primary" />
              <p className="text-white text-[15px] mb-1">Virtual Try-On</p>
              <p className="text-white/70 text-[13px] mb-7 max-w-[280px] mx-auto">See {candidate?.name} on you — tracked live as you move.</p>
              <div className="flex flex-col gap-2.5">
                <Button variant="gold" onClick={() => setMode("camera-intro")}><Camera size={15}/> Use Camera</Button>
                <Button variant="outline" className="!text-white !border-white/30" onClick={() => fileRef.current?.click()}><Upload size={15}/> Upload a Photo Instead</Button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { setMode("upload"); onUpload(e); }} />
              </div>
            </div>
          )}

          {mode === "camera-intro" && (
            <div className="text-center px-8 max-w-[320px] mx-auto">
              <Camera size={26} className="mx-auto mb-4 text-primary" />
              <p className="text-white text-[15px] mb-1">Allow camera access?</p>
              <p className="text-white/70 text-[13px] mb-7 leading-relaxed">We'll ask your browser for permission to use your camera so jewellery can be shown on you live. Nothing is recorded or uploaded — the video stays on this device, and stops the moment you close this window.</p>
              <div className="flex flex-col gap-2.5">
                <Button variant="gold" onClick={() => setMode("camera")}><Camera size={15}/> Allow Camera Access</Button>
                <Button variant="outline" className="!text-white !border-white/30" onClick={() => setMode(null)}>Back</Button>
              </div>
            </div>
          )}

          {mode === "camera" && !photo && (
            <>
              {error === "PERMISSION_DENIED" && <ErrorState icon={<CircleAlert size={22}/>} title="Camera access was denied" desc="Enable camera permissions in your browser, or upload a photo instead." action={<Button variant="outline" className="!text-white !border-white/30" onClick={() => fileRef.current?.click()}>Upload a Photo</Button>} extra={<input ref={fileRef} type="file" accept="image/*" hidden onChange={(e)=>{setMode("upload"); onUpload(e);}} />} />}
              {error === "DEVICE_IN_USE" && <ErrorState icon={<CircleAlert size={22}/>} title="Camera is already in use" desc="Another app or browser tab seems to be using your camera. Close it and try again, or upload a photo instead." action={<div className="flex flex-col gap-2"><Button variant="gold" onClick={() => { setError(null); setCameraAttempt(a => a + 1); }}><RefreshCw size={14}/> Retry</Button><Button variant="outline" className="!text-white !border-white/30" onClick={() => fileRef.current?.click()}>Upload a Photo</Button></div>} extra={<input ref={fileRef} type="file" accept="image/*" hidden onChange={(e)=>{setMode("upload"); onUpload(e);}} />} />}
              {error === "UNSUPPORTED_BROWSER" && <ErrorState icon={<CircleAlert size={22}/>} title="Camera isn't supported here" desc="Try uploading a photo instead." action={<Button variant="outline" className="!text-white !border-white/30" onClick={() => fileRef.current?.click()}>Upload a Photo</Button>} extra={<input ref={fileRef} type="file" accept="image/*" hidden onChange={(e)=>{setMode("upload"); onUpload(e);}} />} />}
              {!error && (
                <div ref={containerRef} className="relative w-full h-full min-h-[420px] md:min-h-[560px] self-stretch flex items-center justify-center overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)] pointer-events-none" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"><div className="w-[62%] aspect-[3/4] border-2 border-primary/70 rounded-[50%]" /></div>
                  <p className="absolute top-4 left-0 right-0 text-center text-[12px] text-white/90 tracking-wide z-10">
                    {trackingStatus === "NO_FACE" ? "We can't see your face — center it in the frame" :
                     trackingStatus === "LOW_VISIBILITY" ? "Try brighter, more even lighting" :
                     "Position your face inside the frame"}
                  </p>

                  {/* Live Rendered Jewellery Overlays */}
                  {candidate && (
                    <>
                      {showOrnament && (
                        <OrnamentOverlay
                          svgRef={ornamentSvgRef}
                          imgRef={ornamentImgRef}
                          product={candidate}
                          config={ornamentConfig}
                          onDrag={dragOrnamentUpdate}
                          autoRotateDeg={autoYaw}
                          onImageStatusChange={updateImageStatus}
                          containerDims={{
                            cw: containerRef.current?.clientWidth || 360,
                            ch: containerRef.current?.clientHeight || 480
                          }}
                        />
                      )}
                      {anchors && trackingStatus !== "NO_FACE" && (
                        <>
                          {showNecklace && anchors.necklace && (
                            <NecklaceOverlay
                              svgRef={necklaceSvgRef}
                              imgRef={necklaceImgRef}
                              anchor={anchors.necklace}
                              config={necklaceConfig}
                              product={candidate}
                              onDrag={dragNecklaceUpdate}
                              autoRotateDeg={autoYaw}
                              faceHeightPx={anchors.faceHeightPx}
                              onImageStatusChange={updateImageStatus}
                            />
                          )}
                          {showEarrings && anchors.left && anchors.right && (
                            <>
                              <EarringOverlay
                                svgRef={leftSvgRef}
                                imgRef={leftImgRef}
                                anchor={anchors.left}
                                config={config.left}
                                product={candidate}
                                side="left"
                                onDrag={dragUpdate}
                                autoRotateDeg={autoYaw}
                                faceHeightPx={anchors.faceHeightPx}
                                onImageStatusChange={updateImageStatus}
                              />
                              <EarringOverlay
                                svgRef={rightSvgRef}
                                imgRef={rightImgRef}
                                anchor={anchors.right}
                                config={config.right}
                                product={candidate}
                                side="right"
                                onDrag={dragUpdate}
                                autoRotateDeg={autoYaw}
                                faceHeightPx={anchors.faceHeightPx}
                                onImageStatusChange={updateImageStatus}
                              />
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Loading indicator when switching assets */}
                  {candidate && (imageStatuses.left === "loading" || imageStatuses.necklace === "loading") && (
                    <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 bg-black/60 text-white/90 px-2.5 py-1 rounded-full text-[11px] backdrop-blur-sm pointer-events-none">
                      <RefreshCw size={11} className="animate-spin text-primary" />
                      <span>Loading jewellery...</span>
                    </div>
                  )}

                  {debugMode && (
                    <DebugOverlay
                      anchors={anchors}
                      config={config}
                      candidate={candidate}
                      trackingStatus={trackingStatus}
                      imageStatuses={imageStatuses}
                      imageUrl={candidate ? getProductTryOnImage(candidate) : null}
                      error={error}
                      videoDims={{ vw: videoRef.current?.videoWidth || 640, vh: videoRef.current?.videoHeight || 480 }}
                      containerDims={{ cw: containerRef.current?.clientWidth || 360, ch: containerRef.current?.clientHeight || 480 }}
                      imgRefs={{ left: leftImgRef, right: rightImgRef, necklace: necklaceImgRef }}
                      isMirrored={true}
                    />
                  )}

                  {/* Development debug toggle button */}
                  <button
                    onClick={() => setDebugMode(d => !d)}
                    className="absolute bottom-3 left-3 z-40 px-2.5 py-1 text-[11px] font-mono rounded bg-black/75 text-white/90 border border-white/20 hover:bg-black/90 transition-colors shadow"
                  >
                    {debugMode ? "Debug HUD: ON (D)" : "Debug HUD: OFF (D)"}
                  </button>
                </div>
              )}
            </>
          )}

          {photo && (
            <div ref={containerRef} className="relative w-full h-full min-h-[420px] md:min-h-[560px] self-stretch flex items-center justify-center overflow-hidden">
              <img src={photo} alt="Your photo" className="absolute inset-0 w-full h-full object-cover" />
              {noFace && !showOrnament ? (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center px-8 z-30"><ErrorState icon={<ScanFace size={22}/>} title="We couldn't detect a face" desc="For the best result, upload a front-facing photo." action={<Button variant="gold" onClick={() => fileRef.current?.click()}>Try Another Photo</Button>} extra={<input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />} /></div>
              ) : candidate && (
                <>
                  {showOrnament && (
                    <OrnamentOverlay
                      svgRef={ornamentSvgRef}
                      imgRef={ornamentImgRef}
                      product={candidate}
                      config={ornamentConfig}
                      onDrag={dragOrnamentUpdate}
                      autoRotateDeg={autoYaw}
                      onImageStatusChange={updateImageStatus}
                      containerDims={{
                        cw: containerRef.current?.clientWidth || 360,
                        ch: containerRef.current?.clientHeight || 480
                      }}
                    />
                  )}
                  {anchors && (
                    <>
                      {showNecklace && anchors.necklace && (
                        <NecklaceOverlay
                          svgRef={necklaceSvgRef}
                          imgRef={necklaceImgRef}
                          anchor={anchors.necklace}
                          config={necklaceConfig}
                          product={candidate}
                          onDrag={dragNecklaceUpdate}
                          faceHeightPx={anchors.faceHeightPx}
                          onImageStatusChange={updateImageStatus}
                        />
                      )}
                      {showEarrings && anchors.left && anchors.right && (
                        <>
                          <EarringOverlay
                            svgRef={leftSvgRef}
                            imgRef={leftImgRef}
                            anchor={anchors.left}
                            config={config.left}
                            product={candidate}
                            side="left"
                            onDrag={dragUpdate}
                            faceHeightPx={anchors.faceHeightPx}
                            onImageStatusChange={updateImageStatus}
                          />
                          <EarringOverlay
                            svgRef={rightSvgRef}
                            imgRef={rightImgRef}
                            anchor={anchors.right}
                            config={config.right}
                            product={candidate}
                            side="right"
                            onDrag={dragUpdate}
                            faceHeightPx={anchors.faceHeightPx}
                            onImageStatusChange={updateImageStatus}
                          />
                        </>
                      )}
                    </>
                  )}
                </>
              )}
              {debugMode && (
                <DebugOverlay
                  anchors={anchors}
                  config={config}
                  candidate={candidate}
                  trackingStatus={trackingStatus}
                  imageStatuses={imageStatuses}
                  imageUrl={candidate ? getProductTryOnImage(candidate) : null}
                  error={error}
                  videoDims={{ vw: videoRef.current?.videoWidth || 640, vh: videoRef.current?.videoHeight || 480 }}
                  containerDims={{ cw: containerRef.current?.clientWidth || 360, ch: containerRef.current?.clientHeight || 480 }}
                  imgRefs={{ left: leftImgRef, right: rightImgRef, necklace: necklaceImgRef }}
                  isMirrored={photoIsSelfie}
                />
              )}
              <button
                onClick={() => setDebugMode(d => !d)}
                className="absolute bottom-3 left-3 z-40 px-2.5 py-1 text-[11px] font-mono rounded bg-black/75 text-white/90 border border-white/20 hover:bg-black/90 transition-colors shadow"
              >
                {debugMode ? "Debug HUD: ON (D)" : "Debug HUD: OFF (D)"}
              </button>
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col">
          <div className="flex items-start justify-between mb-1">
            <p className="text-[15px] font-medium leading-snug">{candidate?.name}</p>
            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded tracking-wide shrink-0 ml-2 ${
              productType === "set" ? "bg-amber-100 text-amber-900 border border-amber-300" :
              productType === "necklace" ? "bg-sky-100 text-sky-900 border border-sky-300" :
              productType === "bracelet" ? "bg-purple-100 text-purple-900 border border-purple-300" :
              productType === "ring" ? "bg-rose-100 text-rose-900 border border-rose-300" :
              "bg-emerald-100 text-emerald-900 border border-emerald-300"
            }`}>
              {productType}
            </span>
          </div>
          <p className="text-[13px] text-textSecondary mb-4">{candidate && money(candidate.price)}</p>

          {mode === "camera" && !photo && !error && (
            <div className="flex gap-2 mb-4">
              <Button className="flex-1" onClick={capture}><Camera size={15}/> Capture</Button>
              <Button variant="subtle" onClick={() => { stopAll(); setMode(null); }}>Cancel</Button>
            </div>
          )}

          {/* Jewellery Set Mode Toggle Pills */}
          {productType === "set" && (
            <div className="mb-4 p-2.5 bg-primaryLight/40 rounded border border-border">
              <p className="text-[11px] font-medium tracking-wide text-textSecondary uppercase mb-2">Jewellery Set Mode</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setJewelrySetMode("full")}
                  className={`flex-1 py-1.5 px-1.5 text-[11px] rounded transition-colors text-center ${
                    jewelrySetMode === "full" ? "bg-primaryDark text-white font-medium shadow-sm" : "bg-white text-textPrimary hover:bg-primaryLight border border-border"
                  }`}
                >
                  Full Set
                </button>
                <button
                  onClick={() => setJewelrySetMode("necklace")}
                  className={`flex-1 py-1.5 px-1.5 text-[11px] rounded transition-colors text-center ${
                    jewelrySetMode === "necklace" ? "bg-primaryDark text-white font-medium shadow-sm" : "bg-white text-textPrimary hover:bg-primaryLight border border-border"
                  }`}
                >
                  Necklace
                </button>
                <button
                  onClick={() => setJewelrySetMode("earrings")}
                  className={`flex-1 py-1.5 px-1.5 text-[11px] rounded transition-colors text-center ${
                    jewelrySetMode === "earrings" ? "bg-primaryDark text-white font-medium shadow-sm" : "bg-white text-textPrimary hover:bg-primaryLight border border-border"
                  }`}
                >
                  Earrings
                </button>
              </div>
            </div>
          )}

          {/* Fit Adjustments */}
          {((photo && !noFace) || (mode === "camera" && (anchors || showOrnament))) && (
            <div className="mb-4 space-y-2.5">
              {showNecklace && (
                <div className="p-2.5 bg-primaryLight/20 rounded border border-border">
                  <p className="text-[11px] font-medium tracking-wide text-textSecondary uppercase mb-1.5">Necklace Fit Adjust</p>
                  <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                    <div className="flex items-center justify-between">
                      <span className="text-textSecondary">Size</span>
                      <div className="flex gap-1">
                        <button onClick={() => adjustNecklaceScale(-0.08)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight"><Minus size={11}/></button>
                        <button onClick={() => adjustNecklaceScale(0.08)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight"><Plus size={11}/></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-textSecondary">Height</span>
                      <div className="flex gap-1">
                        <button onClick={() => adjustNecklaceOffsetY(-8)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight text-[10px] font-mono">▲</button>
                        <button onClick={() => adjustNecklaceOffsetY(8)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight text-[10px] font-mono">▼</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-textSecondary">Position</span>
                      <div className="flex gap-1">
                        <button onClick={() => adjustNecklaceOffsetX(-8)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight text-[10px] font-mono">◀</button>
                        <button onClick={() => adjustNecklaceOffsetX(8)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight text-[10px] font-mono">▶</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-textSecondary">Tilt</span>
                      <div className="flex gap-1">
                        <button onClick={() => adjustNecklaceRotate(-5)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight"><RotateCcw size={11}/></button>
                        <button onClick={() => adjustNecklaceRotate(5)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight [transform:scaleX(-1)]"><RotateCcw size={11}/></button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showEarrings && (
                <div className="p-2.5 bg-primaryLight/20 rounded border border-border">
                  <p className="text-[11px] font-medium tracking-wide text-textSecondary uppercase mb-1.5">Earrings Fit Adjust</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] w-12 text-textSecondary">Size</span>
                    <button onClick={() => { adjustScale("left",-0.1); adjustScale("right",-0.1);} } className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight"><Minus size={11}/></button>
                    <button onClick={() => { adjustScale("left",0.1); adjustScale("right",0.1);} } className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight"><Plus size={11}/></button>
                    <span className="text-[11.5px] w-12 text-textSecondary ml-3">Rotate</span>
                    <button onClick={() => { adjustRotate("left",-8); adjustRotate("right",8);} } className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight"><RotateCcw size={11}/></button>
                  </div>
                </div>
              )}

              {showOrnament && (
                <div className="p-2.5 bg-primaryLight/20 rounded border border-border">
                  <p className="text-[11px] font-medium tracking-wide text-textSecondary uppercase mb-1.5">{productType === "ring" ? "Ring" : "Bracelet"} Fit Adjust</p>
                  <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                    <div className="flex items-center justify-between">
                      <span className="text-textSecondary">Size</span>
                      <div className="flex gap-1">
                        <button onClick={() => adjustOrnamentScale(-0.1)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight"><Minus size={11}/></button>
                        <button onClick={() => adjustOrnamentScale(0.1)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight"><Plus size={11}/></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-textSecondary">Rotate</span>
                      <div className="flex gap-1">
                        <button onClick={() => adjustOrnamentRotate(-8)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight"><RotateCcw size={11}/></button>
                        <button onClick={() => adjustOrnamentRotate(8)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight [transform:scaleX(-1)]"><RotateCcw size={11}/></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-textSecondary">Height</span>
                      <div className="flex gap-1">
                        <button onClick={() => adjustOrnamentOffsetY(-10)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight text-[10px] font-mono">▲</button>
                        <button onClick={() => adjustOrnamentOffsetY(10)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight text-[10px] font-mono">▼</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-textSecondary">Position</span>
                      <div className="flex gap-1">
                        <button onClick={() => adjustOrnamentOffsetX(-10)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight text-[10px] font-mono">◀</button>
                        <button onClick={() => adjustOrnamentOffsetX(10)} className="w-6 h-6 border border-border rounded flex items-center justify-center hover:bg-primaryLight text-[10px] font-mono">▶</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {photo && <Button size="sm" variant="subtle" className="flex-1" onClick={retake}><RefreshCw size={12}/> Retake</Button>}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setConfig({ left: { offsetX: 0, offsetY: 0, scale: 1, rotate: 0 }, right: { offsetX: 0, offsetY: 0, scale: 1, rotate: 0 } });
                    setNecklaceConfig({ offsetX: 0, offsetY: 0, scale: 1, rotate: 0 });
                    setOrnamentConfig({ offsetX: 0, offsetY: 0, scale: 1, rotate: 0 });
                  }}
                >
                  Reset
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={saveScreenshot}><ImageUp size={12}/> {savedMsg ? "Saved!" : "Save Photo"}</Button>
              </div>
            </div>
          )}

          {/* Switch Jewellery Drawer */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11.5px] tracking-wide text-textSecondary uppercase font-medium">Switch Jewellery</p>
              <span className="text-[10px] text-textSecondary">Try on earrings, necklaces & sets</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1.5">
              {related.map(p => {
                const pType = getProductJewelleryType(p);
                const pAssets = getProductTryOnAssets(p);
                const isSelected = candidate?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => switchCandidate(p)}
                    className={`relative shrink-0 w-16 h-20 rounded-md bg-primaryLight/30 flex flex-col items-center justify-between p-1 border transition-all ${
                      isSelected ? "border-primaryDark ring-2 ring-primary/40 bg-white" : "border-border hover:border-primaryDark/60"
                    }`}
                  >
                    <div className="relative w-full h-11 flex items-center justify-center overflow-hidden">
                      <ProductImage product={p} size={32} />
                      {pAssets.isTransparentReady && (
                        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" title="Transparent Try-On Ready" />
                      )}
                    </div>
                    <div className="w-full text-center">
                      <span className={`block text-[9px] uppercase font-bold tracking-tight px-1 rounded truncate ${
                        pType === "set" ? "bg-amber-100 text-amber-900" :
                        pType === "necklace" ? "bg-sky-100 text-sky-900" :
                        pType === "bracelet" ? "bg-purple-100 text-purple-900" :
                        pType === "ring" ? "bg-rose-100 text-rose-900" :
                        "bg-emerald-100 text-emerald-900"
                      }`}>
                        {pType}
                      </span>
                      <span className="block text-[10px] text-textPrimary truncate mt-0.5" title={p.name}>
                        {p.name.split(" ")[0]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-border">
            <Button onClick={addFromTryOn}>Add to Cart</Button>
            <Button variant="outline" onClick={wishlistFromTryOn}><Heart size={14} className={candidate && wishlist.includes(candidate.id) ? "fill-current" : ""}/> {candidate && wishlist.includes(candidate.id) ? "In Wishlist" : "Add to Wishlist"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- screenshot compositing helpers -----------------------------------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Same math CSS `object-fit: cover` uses — the source rectangle to draw
 *  from so the destination is filled without distortion, cropping the
 *  overflow. Needed because canvas has no native "cover" draw mode. */
function coverCrop(sourceW, sourceH, destW, destH) {
  const sourceRatio = sourceW / sourceH, destRatio = destW / destH;
  if (sourceRatio > destRatio) {
    const sWidth = sourceH * destRatio;
    return { sx: (sourceW - sWidth) / 2, sy: 0, sWidth, sHeight: sourceH };
  }
  const sHeight = sourceW / destRatio;
  return { sx: 0, sy: (sourceH - sHeight) / 2, sWidth: sourceW, sHeight };
}

/** Serializes a live <svg> DOM node (as rendered by EarringArt) into a
 *  drawable Image via a data URL — the standard technique for rasterizing
 *  inline SVG onto a canvas. */
function svgElementToImage(svgEl) {
  const xml = new XMLSerializer().serializeToString(svgEl);
  const dataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  return loadImage(dataUrl);
}

/* ============================================================================
   ADMIN DASHBOARD
   ============================================================================ */
function AdminProductForm({ product, onCancel, onSave }) {
  const [form, setForm] = useState(product || { name: "", category: "stud", material: "", color: "Gold", style: "Minimal", price: 0, stock: 10, occasion: [], kind: "stud", description: "", images: [] });
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));
  const imagesText = (form.images || []).join("\n");
  const setImagesText = (text) => set("images", text.split(/[\n,]/).map(s => s.trim()).filter(Boolean));
  return (
    <div className="fixed inset-0 z-[95] bg-[#0B1C2C]/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-surface w-full max-w-[560px] max-h-[90vh] overflow-y-auto p-6" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between mb-5"><p className="text-[15px]">{product ? "Edit Earring" : "Add Earring"}</p><button onClick={onCancel}><X size={17}/></button></div>
        <div className="grid gap-3">
          <Input placeholder="Product name" value={form.name} onChange={e=>set("name",e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.category} onChange={e=>set("category",e.target.value)} className="border border-border px-3 py-2.5 text-[13.5px] bg-white">{CATEGORIES_FALLBACK.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select value={form.color} onChange={e=>set("color",e.target.value)} className="border border-border px-3 py-2.5 text-[13.5px] bg-white">{Object.keys(COLOR_HEX).map(c => <option key={c}>{c}</option>)}</select>
          </div>
          <Input placeholder="Material" value={form.material} onChange={e=>set("material",e.target.value)} />
          <div className="grid grid-cols-2 gap-3"><Input type="number" placeholder="Price" value={form.price} onChange={e=>set("price",Number(e.target.value))} /><Input type="number" placeholder="Inventory" value={form.stock} onChange={e=>set("stock",Number(e.target.value))} /></div>
          <textarea placeholder="Description" value={form.description} onChange={e=>set("description",e.target.value)} rows={3} className="border border-border px-3 py-2.5 text-[13.5px] bg-white" />
          <div>
            <textarea
              placeholder="Image URLs — one per line (or comma-separated). The first one becomes the main photo."
              value={imagesText}
              onChange={e => setImagesText(e.target.value)}
              rows={3}
              className="w-full border border-border px-3 py-2.5 text-[13.5px] bg-white"
            />
            {form.images?.length > 0 && (
              <div className="flex gap-2 mt-2">
                {form.images.map((_, i) => (
                  <div key={i} className="relative w-12 h-12 bg-primaryLight border border-border flex items-center justify-center overflow-hidden">
                    <ProductImage product={form} size={24} imageIndex={i} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button onClick={() => onSave(form)}>{product ? "Save Changes" : "Add Earring"}</Button></div>
      </div>
    </div>
  );
}
function Stat({ label, value }) { return <div><p className="text-[24px]" style={SERIF}>{value}</p><p className="text-[12px] text-textSecondary">{label}</p></div>; }

function AdminDashboard() {
  const [tab, setTab] = useState("products");
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [analytics, setAnalytics] = useState({ tryOn: [], conversion: null, faceShapes: {} });
  const tabs = [["products","Products",Package],["categories","Categories",LayoutGrid],["analytics","AI Analytics",BarChart3]];

  const loadProducts = () => api.getProducts({}).then(r => setProducts(r.results));
  useEffect(() => { loadProducts(); }, []);
  useEffect(() => {
    if (tab !== "analytics") return;
    Promise.all([api.getMostTriedOn(), api.getConversion(), api.getFaceShapePopularity()])
      .then(([tryOn, conversion, faceShapes]) => setAnalytics({ tryOn, conversion, faceShapes }));
  }, [tab]);

  const removeProduct = async (id) => { await api.deleteProduct(id); loadProducts(); };
  const upsertProduct = async (data) => {
    if (editing) await api.updateProduct(editing.id, data); else await api.createProduct(data);
    setShowForm(false); setEditing(null); loadProducts();
  };

  const PIE_COLORS = ["#38BDF8","#0284C7","#0EA5E9","#7DD3FC","#075985","#164E63"];
  const faceShapeData = Object.entries(analytics.faceShapes).map(([name,value]) => ({ name, value }));

  return (
    <div className="max-w-[1300px] mx-auto px-5 md:px-8 py-10">
      <div className="flex items-center justify-between mb-8"><h1 className="text-[26px]" style={SERIF}>Admin Dashboard</h1><div className="flex items-center gap-1.5 text-[12px] text-textSecondary"><Settings size={14}/> Live via REST API</div></div>
      <div className="flex gap-1 mb-8 border-b border-border overflow-x-auto">{tabs.map(([id,label,Icon]) => <button key={id} onClick={()=>setTab(id)} className={`flex items-center gap-1.5 px-4 py-3 text-[13px] border-b-2 whitespace-nowrap ${tab===id?"border-primaryDark":"border-transparent text-textSecondary"}`}><Icon size={14}/>{label}</button>)}</div>

      {tab === "products" && (
        <div>
          <div className="flex justify-between mb-4"><p className="text-[13px] text-textSecondary">{products.length} products (GET /api/products)</p><Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={13}/> Add Earring</Button></div>
          <div className="border border-border">
            <table className="w-full text-[13px]">
              <thead><tr className="bg-primaryLight text-left"><th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3">Price</th><th className="p-3">Stock</th><th className="p-3"></th></tr></thead>
              <tbody>{products.map(p => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3 flex items-center gap-3"><div className="relative bg-primaryLight w-10 h-10 flex items-center justify-center"><ProductImage product={p} size={22}/></div>{p.name}</td>
                  <td className="p-3 capitalize">{p.category}</td><td className="p-3">{money(p.price)}</td><td className="p-3">{p.stock}</td>
                  <td className="p-3 text-right"><button className="text-[12px] underline mr-3" onClick={() => { setEditing(p); setShowForm(true); }}>Edit</button><button className="text-danger" onClick={() => removeProduct(p.id)}><Trash2 size={14}/></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "categories" && (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">{CATEGORIES_FALLBACK.map(c => <div key={c} className="border border-border p-4 flex items-center justify-between text-[13px] capitalize"><span>{c}</span><span className="text-textSecondary">{products.filter(p=>p.category===c).length} items</span></div>)}</div>
      )}
      {tab === "analytics" && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="border border-border p-5">
            <p className="text-[13px] mb-4">Most Tried-On Earrings (GET /api/admin/analytics/most-tried-on)</p>
            <ResponsiveContainer width="100%" height={220}><BarChart data={analytics.tryOn.map(t => ({ name: t.product.name.split(" ").slice(0,2).join(" "), tryOns: t.tryOns }))} layout="vertical" margin={{ left: 10 }}><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="tryOns" fill="#0284C7" radius={[0,3,3,0]} /></BarChart></ResponsiveContainer>
          </div>
          <div className="border border-border p-5 flex flex-col justify-center gap-4">
            <Stat label="Try-On → Cart Conversion" value={`${analytics.conversion?.tryOnToCartRate ?? 0}%`} />
            <Stat label="Try-On → Purchase Conversion" value={`${analytics.conversion?.tryOnToPurchaseRate ?? 0}%`} />
            <Stat label="Total Try-On Sessions" value={analytics.conversion?.totalTryOns ?? 0} />
          </div>
          <div className="border border-border p-5 md:col-span-2">
            <p className="text-[13px] mb-4">Face-Shape Recommendation Popularity</p>
            {faceShapeData.length === 0 ? <p className="text-[12.5px] text-textSecondary">Run the AI Stylist quiz a few times to populate this chart.</p> : (
              <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={faceShapeData} dataKey="value" nameKey="name" outerRadius={80} label={{ fontSize: 11 }}>{faceShapeData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
            )}
          </div>
        </div>
      )}
      {showForm && <AdminProductForm product={editing} onCancel={() => { setShowForm(false); setEditing(null); }} onSave={upsertProduct} />}
    </div>
  );
}

/* ============================================================================
   FOOTER
   ============================================================================ */
function Footer() {
  const { nav } = useApp();
  return (
    <footer className="bg-ink text-white/70 mt-20">
      <div className="max-w-[1300px] mx-auto px-5 md:px-8 py-14 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
        <div className="sm:col-span-2 md:col-span-1 lg:col-span-1">
          <p className="text-[22px] text-white mb-3" style={SERIF}>Aurélie</p>
          <p className="text-[12.5px] leading-relaxed mb-3">
            Luxury artisanal jewellery & earrings crafted for modern elegance.
          </p>
          <p className="text-[11px] text-sky-400 font-medium">
            Personalized with AI styling & live virtual try-on.
          </p>
        </div>
        <FooterCol title="Shop" items={["All Earrings"]} onClick={() => nav("collection")} />
        <FooterCol title="Discover" items={["AI Stylist","Outfit Match"]} onClick={(i) => nav(i==="AI Stylist"?"stylist":"outfit")} />
        <FooterCol title="Account" items={["Profile","Wishlist","Super Admin"]} onClick={(i) => nav(i==="Profile"?"profile":i==="Wishlist"?"wishlist":"superadmin")} />
        <div>
          <p className="text-[12px] tracking-wide text-white mb-3 font-semibold">FOLLOW US</p>
          <SocialLinks variant="footer-column" />
        </div>
      </div>
      <div className="border-t border-white/10 py-5 px-5 md:px-8 max-w-[1300px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[11.5px]">
        <div>© 2026 Aurélie Jewellery Co. — All rights reserved.</div>
        <div className="flex items-center gap-3">
          <span className="text-white/40">Official Social Media:</span>
          <SocialLinks variant="compact" />
        </div>
      </div>
    </footer>
  );
}
function FooterCol({ title, items, onClick }) {
  return <div><p className="text-[12px] tracking-wide text-white mb-3 font-semibold">{title.toUpperCase()}</p><div className="flex flex-col gap-2">{items.map(i => <button key={i} onClick={() => onClick(i)} className="text-[12.5px] text-left hover:text-white transition-colors">{i}</button>)}</div></div>;
}

/* ============================================================================
   URL <-> page/params mapping, so Back/Forward and shareable links work for
   every page, not just /superadmin.
   ============================================================================ */
function pathForPage(p, params = {}) {
  switch (p) {
    case "superadmin":
    case "admin":
      return "/superadmin";
    case "delivery":
      return "/delivery";
    case "product":
      return params.id ? `/product/${params.id}` : "/product";
    case "collection": {
      const qs = new URLSearchParams();
      if (params.category) qs.set("category", params.category);
      if (params.q) qs.set("q", params.q);
      const s = qs.toString();
      return s ? `/collection?${s}` : "/collection";
    }
    case "stylist": return "/stylist";
    case "outfit": return "/outfit";
    case "wishlist": return "/wishlist";
    case "services": return "/services";
    case "checkout": return "/checkout";
    case "profile": return "/profile";
    case "home":
    default:
      return "/";
  }
}

function resolveFromLocation() {
  if (typeof window === "undefined") return { page: "home", params: {} };
  const path = window.location.pathname;
  if (path.startsWith("/superadmin")) return { page: "superadmin", params: {} };
  if (path.startsWith("/delivery")) return { page: "delivery", params: {} };
  if (path.startsWith("/product/")) return { page: "product", params: { id: path.slice("/product/".length) } };
  if (path.startsWith("/collection")) {
    const qs = new URLSearchParams(window.location.search);
    return { page: "collection", params: { category: qs.get("category") || "", q: qs.get("q") || "" } };
  }
  if (path.startsWith("/stylist")) return { page: "stylist", params: {} };
  if (path.startsWith("/outfit")) return { page: "outfit", params: {} };
  if (path.startsWith("/wishlist")) return { page: "wishlist", params: {} };
  if (path.startsWith("/services")) return { page: "services", params: {} };
  if (path.startsWith("/checkout")) return { page: "checkout", params: {} };
  if (path.startsWith("/profile")) return { page: "profile", params: {} };
  return { page: "home", params: {} };
}

/* ============================================================================
   ROOT APP — owns API-backed state: cart, wishlist, prefs
   ============================================================================ */
export default function App() {
  const [page, setPage] = useState(() => resolveFromLocation().page);
  const [pageParams, setPageParams] = useState(() => resolveFromLocation().params);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [viewed, setViewed] = useState([]);
  const [compare, setCompare] = useState([]);
  const [userPrefs, setUserPrefs] = useState({});
  const [tryOnProduct, setTryOnProduct] = useState(null);
  const [toast, setToast] = useState(null);
  const [apiUp, setApiUp] = useState(null);
  // Lazy initializer: reads the cached { id, name, email, role } written by
  // setStoredUser on a previous login, so a page refresh doesn't drop back
  // to "logged out" until the 7-day JWT itself actually expires.
  const [user, setUser] = useState(() => getStoredUser());
  const [trackingOrderId, setTrackingOrderId] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1800); };
  
  const nav = useCallback((p, params = {}) => {
    setPage(p);
    setPageParams(params);
    if (typeof window !== "undefined") {
      const target = pathForPage(p, params);
      if (window.location.pathname + window.location.search !== target) {
        window.history.pushState(null, "", target);
      }
    }
    window.scrollTo(0,0);
  }, []);

  const openProduct = useCallback((p) => nav("product", { id: p.id }), [nav]);
  const openTryOn = useCallback((p) => setTryOnProduct(p), []);
  const closeTryOn = useCallback(() => setTryOnProduct(null), []);
  const openTracking = useCallback((id) => setTrackingOrderId(id), []);

  const refreshCart = useCallback(() => { api.getCart().then(setCart).catch(() => {}); }, []);
  const refreshWishlist = useCallback(() => { api.getWishlist().then(items => { setWishlistItems(items); setWishlist(items.map(i => i.id)); }).catch(() => {}); }, []);

  // Listen to browser Back/Forward popstate
  useEffect(() => {
    const handlePopState = () => {
      const resolved = resolveFromLocation();
      setPage(resolved.page);
      setPageParams(resolved.params);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Verify DB live user role on app load
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, "") : "/api";
    fetch(`${apiBase}/health`).then(r => r.ok ? setApiUp(true) : setApiUp(false)).catch(() => setApiUp(false));
    refreshCart();
    refreshWishlist();

    if (api.getToken()) {
      api.getMe().then(res => {
        if (res && res.user) {
          setUser(res.user);
          setStoredUser(res.user);
        }
      }).catch(() => {});
    }
  }, [refreshCart, refreshWishlist]);

  const addToCart = useCallback(async (p) => { await api.addToCart(p.id, 1); await refreshCart(); showToast(`${p.name} added to cart`); }, [refreshCart]);
  const updateQty = useCallback(async (id, qty) => { if (qty < 1) return; await api.updateCartItem(id, qty); refreshCart(); }, [refreshCart]);
  const removeFromCart = useCallback(async (id) => { await api.removeCartItem(id); refreshCart(); }, [refreshCart]);

  const toggleWishlist = useCallback(async (id) => {
    if (wishlist.includes(id)) await api.removeWishlist(id); else await api.addWishlist(id);
    refreshWishlist();
  }, [wishlist, refreshWishlist]);
  const toggleCompare = (id) => setCompare(c => c.includes(id) ? c.filter(x=>x!==id) : c.length>=3 ? c : [...c, id]);

  const login = useCallback((result) => {
    setToken(result.token);
    setStoredUser(result.user);
    setUser(result.user);
    showToast(`Welcome, ${result.user.name}`);
    refreshCart(); refreshWishlist();
  }, [refreshCart, refreshWishlist]);

  const logout = useCallback(() => {
    setToken(null);
    setStoredUser(null);
    setUser(null);
    refreshCart(); refreshWishlist();
  }, [refreshCart, refreshWishlist]);

  const ctx = {
    page, nav, searchOpen, setSearchOpen,
    cart, cartCount: cart.reduce((a,c)=>a+c.qty,0), addToCart, updateQty, removeFromCart, cartOpen, setCartOpen, refreshCart,
    wishlist, wishlistItems, toggleWishlist, viewed, compare, toggleCompare,
    userPrefs, setUserPrefs,
    tryOnProduct, openTryOn, closeTryOn, openProduct,
    user, login, logout,
    openTracking,
  };

  return (
    <AppCtx.Provider value={ctx}>
      {page === "superadmin" || page === "admin" ? (
        <SuperAdminPortal
          onReturnToStore={() => nav("home")}
          user={user}
          onUserUpdate={(u) => {
            setUser(u);
            setStoredUser(u);
          }}
        />
      ) : page === "delivery" ? (
        <DeliveryBoyPortal
          user={user}
          onReturnToStore={() => nav("home")}
        />
      ) : (
        <div className="min-h-screen bg-background text-textPrimary">
          <Header />
          {apiUp === false && (
            <div className="bg-dangerLight text-danger text-[12.5px] text-center py-2 px-4">
              Can't reach the backend API at /api. Make sure the Express server is running (see backend/README.md) — the Vite dev server proxies /api to http://localhost:4000.
            </div>
          )}
          {page === "home" && <Home />}
          {page === "collection" && <Collection initial={pageParams} />}
          {page === "product" && pageParams.id && <ProductDetails id={pageParams.id} />}
          {page === "stylist" && <AIStylist />}
          {page === "outfit" && <OutfitMatch />}
          {page === "wishlist" && <Wishlist />}
          {page === "services" && <ServicesView user={user} />}
          {page === "checkout" && <Checkout />}
          {page === "profile" && <Profile />}
          <Footer />
          <SearchOverlay />
          <CartDrawer />
          <VirtualTryOnModal />
          {trackingOrderId && (
            <OrderTrackingModal
              orderId={trackingOrderId}
              onClose={() => setTrackingOrderId(null)}
              onRefreshList={() => {}}
            />
          )}
        </div>
      )}
      <Toast toast={toast} />
    </AppCtx.Provider>
  );
}
