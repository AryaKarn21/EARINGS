import { useState } from "react";
import { Star } from "lucide-react";
import EarringArt from "./EarringArt";

export function money(n) { return `$${Number(n).toFixed(2)}`; }

/**
 * Renders a product's real photo when one exists, and falls back to the
 * existing EarringArt illustration when it doesn't — never a fabricated
 * stock photo (see schema.prisma's comment on Product.images). Used
 * everywhere a product is shown as a catalog image: cards, galleries, cart/
 * wishlist line items, admin tables. NOT used for the live camera try-on
 * overlay (App.jsx's EarringOverlay) — that stays raw EarringArt, which is
 * the actual lightweight 2D graphic being tracked onto the face, and needs
 * the ref EarringArt forwards for the screenshot compositor.
 *
 * Must be placed inside a `relative` ancestor with a defined size (every
 * current call site already is, via an aspect-ratio or fixed-size wrapper)
 * — the real-photo path fills that box edge-to-edge via `absolute inset-0`;
 * the placeholder path renders inline exactly as EarringArt always has.
 */
export function ProductImage({ product, size = 64, className = "", imageIndex }) {
  const [broken, setBroken] = useState(false);
  const images = product?.images || [];
  const index = imageIndex != null
    ? imageIndex
    : Math.min(Math.max(product?.primaryImageIndex || 0, 0), Math.max(images.length - 1, 0));
  const url = !broken && images.length ? images[index] : null;

  if (!url) {
    return <EarringArt kind={product?.kind} color={product?.color} size={size} className={className} />;
  }
  return (
    <img
      src={url}
      alt={product?.name ? `${product.name}${product.material ? ` — ${product.material}` : ""}` : "Product photo"}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`absolute inset-0 w-full h-full object-cover ${className}`}
    />
  );
}

// Variant names stay the same ones used across App.jsx (primary/gold/outline/
// ghost/subtle) to avoid a mechanical rename at every call site — only the
// colors behind them changed, moving the whole app off the old cream/gold
// palette onto the sky-blue token system (index.css + tailwind.config.js).
// `gold` keeps its name but is now the deeper-blue "extra emphasis" variant
// (AI Stylist, Try On, camera CTAs) sitting next to `primary`'s standard
// blue — two emphasis levels within one hue, not two competing brand colors.
export function Button({ variant = "primary", size = "md", className = "", children, ...rest }) {
  const base = "inline-flex items-center justify-center gap-2 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = { sm: "px-4 py-2 text-[13px]", md: "px-6 py-3 text-sm", lg: "px-8 py-4 text-[15px]" };
  const variants = {
    primary: "bg-primary text-white hover:bg-primaryDark",
    gold: "bg-primaryDark text-white hover:bg-ink",
    outline: "border border-primaryDark text-primaryDark hover:bg-primaryDark hover:text-white",
    ghost: "text-textPrimary hover:bg-primaryLight",
    subtle: "bg-primaryLight text-primaryDark hover:bg-border",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>{children}</button>;
}

export function Rating({ value = 0, count, size = 13 }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-[1px]">
        {[1,2,3,4,5].map(i => (
          <Star key={i} size={size} strokeWidth={1.5} className={i <= Math.round(value) ? "fill-primary text-primary" : "text-border"} />
        ))}
      </div>
      <span className="text-[12px] text-textSecondary">{Number(value).toFixed(1)}{count != null && ` (${count})`}</span>
    </div>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-primaryDark text-white px-5 py-3 text-[13px] tracking-wide shadow-lg animate-[fadeUp_.25s_ease]">
      {toast}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-textSecondary text-[13px]">
      <span className="w-3.5 h-3.5 border-2 border-border border-t-primary rounded-full animate-spin" />
      {label || "Loading…"}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="py-16 text-center text-textSecondary">
      <p className="text-[13.5px] mb-3">{message || "Something went wrong talking to the server."}</p>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
