import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  "https://astgazboqpwhcuyemshx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzdGdhemJvcXB3aGN1eWVtc2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzUyMDAsImV4cCI6MjA5Mzg1MTIwMH0.9ZKI3MaZbJSWSm2QC2jOETrhGTiUETcvmZW4PCJWyk8"
);

// ── Category config ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: "All",            icon: "✦",  value: "" },
  { label: "User Interview", icon: "🎙️", value: "User Interview" },
  { label: "Focus Group",    icon: "👥", value: "Focus Group" },
  { label: "Taste Test",     icon: "🍽️", value: "Taste Test" },
  { label: "Mock Trial",     icon: "⚖️", value: "Mock Trial" },
  { label: "App Testing",    icon: "📱", value: "App Testing" },
  { label: "Online Survey",  icon: "📝", value: "Online Survey" },
  { label: "AI & Tech",      icon: "🤖", value: "AI & Tech" },
  { label: "Finance",        icon: "💳", value: "Finance" },
  { label: "Travel",         icon: "✈️", value: "Travel" },
];

const TAG_STYLES = {
  "User Interview": { bg: "#E6F0FF", color: "#1A56C4" },
  "Focus Group":    { bg: "#F0EAF8", color: "#6B3FA0" },
  "Taste Test":     { bg: "#FFF0E6", color: "#C05A10" },
  "Mock Trial":     { bg: "#E6FAF0", color: "#1A7A45" },
  "App Testing":    { bg: "#E6F0FF", color: "#1A56C4" },
  "Online Survey":  { bg: "#FFF5E6", color: "#B86B00" },
  "AI & Tech":      { bg: "#EEF2FF", color: "#4338CA" },
  "Finance":        { bg: "#F0FDF4", color: "#166534" },
  "Travel":         { bg: "#FFF7ED", color: "#C2410C" },
};

// ── Styles ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --gold: #C9A84C;
    --gold-light: #F0D48A;
    --gold-pale: #FDF8EE;
    --dark: #0D0D0D;
    --dark2: #1A1A1A;
    --muted: #888;
    --border: #E8E0CC;
    --ff: 'Playfair Display', serif;
    --fs: 'DM Sans', sans-serif;
  }

  body {
    font-family: var(--fs);
    background: var(--gold-pale);
    color: var(--dark);
    min-height: 100vh;
  }

  /* NAV */
  .nav {
    background: var(--dark);
    padding: 0 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 62px;
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 1px solid #222;
  }
  .nav-logo {
    font-family: var(--ff);
    color: var(--gold);
    font-size: 1.2rem;
    letter-spacing: 0.02em;
    cursor: pointer;
    text-decoration: none;
  }
  .nav-logo span { color: #fff; }
  .nav-links {
    display: flex;
    gap: 2rem;
    align-items: center;
  }
  .nav-link {
    color: #999;
    font-size: 12px;
    text-decoration: none;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: color 0.2s;
    background: none;
    border: none;
    font-family: var(--fs);
  }
  .nav-link:hover { color: var(--gold); }
  .nav-link.active { color: var(--gold); }
  .nav-cta {
    background: var(--gold);
    color: var(--dark);
    border: none;
    padding: 9px 22px;
    font-family: var(--fs);
    font-size: 12px;
    font-weight: 500;
    border-radius: 2px;
    cursor: pointer;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: opacity 0.2s;
  }
  .nav-cta:hover { opacity: 0.85; }

  /* HERO */
  .hero {
    padding: 80px 2rem 60px;
    max-width: 820px;
    margin: 0 auto;
    text-align: center;
  }
  .hero-eyebrow {
    font-size: 11px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 1.5rem;
    font-weight: 500;
  }
  .hero h1 {
    font-family: var(--ff);
    font-size: clamp(2.2rem, 5vw, 3.5rem);
    line-height: 1.15;
    color: var(--dark);
    margin-bottom: 1.5rem;
    font-weight: 400;
  }
  .hero h1 em { color: var(--gold); font-style: normal; }
  .hero p {
    font-size: 1.05rem;
    color: var(--muted);
    line-height: 1.75;
    max-width: 520px;
    margin: 0 auto 2.5rem;
    font-weight: 300;
  }
  .hero-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  .btn-primary {
    background: var(--dark);
    color: #fff;
    border: none;
    padding: 14px 32px;
    font-family: var(--fs);
    font-size: 13px;
    font-weight: 500;
    border-radius: 2px;
    cursor: pointer;
    letter-spacing: 0.06em;
    transition: background 0.2s;
  }
  .btn-primary:hover { background: #2a2a2a; }
  .btn-outline {
    background: transparent;
    color: var(--dark);
    border: 1.5px solid var(--dark);
    padding: 14px 32px;
    font-family: var(--fs);
    font-size: 13px;
    font-weight: 500;
    border-radius: 2px;
    cursor: pointer;
    letter-spacing: 0.06em;
    transition: all 0.2s;
  }
  .btn-outline:hover { background: var(--dark); color: #fff; }

  /* STATS */
  .stats-bar {
    background: var(--dark);
    padding: 28px 2rem;
    display: flex;
    justify-content: center;
    gap: 5rem;
    flex-wrap: wrap;
    border-top: 1px solid #222;
  }
  .stat { text-align: center; }
  .stat-num {
    font-family: var(--ff);
    font-size: 2.2rem;
    color: var(--gold);
    display: block;
  }
  .stat-label {
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #666;
    margin-top: 4px;
    display: block;
  }

  /* SECTIONS */
  .section {
    padding: 60px 2rem;
    max-width: 1100px;
    margin: 0 auto;
  }
  .section-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 2rem;
  }
  .section-title {
    font-family: var(--ff);
    font-size: 1.9rem;
    font-weight: 400;
    color: var(--dark);
  }
  .section-action {
    font-size: 12px;
    color: var(--gold);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    background: none;
    border: none;
    font-family: var(--fs);
  }
  .section-action:hover { text-decoration: underline; }

  /* CATEGORY PILLS */
  .cat-grid {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 2rem;
  }
  .cat-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 100px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--muted);
    transition: all 0.2s;
    font-family: var(--fs);
  }
  .cat-pill:hover { border-color: var(--gold); color: var(--dark); }
  .cat-pill.active {
    background: var(--dark);
    color: var(--gold);
    border-color: var(--dark);
  }

  /* CATEGORY HOME CARDS */
  .cat-home-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .cat-home-card {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 22px 16px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
  }
  .cat-home-card:hover {
    border-color: var(--gold);
    background: var(--gold-pale);
    transform: translateY(-2px);
  }
  .cat-home-icon { font-size: 24px; margin-bottom: 10px; display: block; }
  .cat-home-name {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--dark);
  }
  .cat-home-count { font-size: 11px; color: var(--muted); margin-top: 5px; }

  /* FILTERS */
  .filters {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    align-items: center;
  }
  .search-box {
    flex: 1;
    min-width: 220px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 10px 16px;
    font-family: var(--fs);
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }
  .search-box:focus { border-color: var(--gold); }
  .filter-select {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 10px 14px;
    font-family: var(--fs);
    font-size: 13px;
    color: var(--dark);
    cursor: pointer;
    outline: none;
    transition: border-color 0.2s;
  }
  .filter-select:focus { border-color: var(--gold); }

  /* LISTING CARDS */
  .listing-card {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 22px 26px;
    margin-bottom: 10px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 20px;
    align-items: center;
    transition: all 0.25s;
    cursor: pointer;
    position: relative;
    overflow: hidden;
  }
  .listing-card:hover {
    border-color: var(--gold);
    box-shadow: 0 6px 24px rgba(201,168,76,0.1);
    transform: translateY(-1px);
  }
  .listing-card.featured {
    border-left: 3px solid var(--gold);
  }
  .listing-card.locked {
    opacity: 0.7;
  }
  .listing-card.locked:hover {
    border-color: var(--dark);
    box-shadow: none;
    transform: none;
  }

  .listing-badges {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .badge {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 2px;
    font-weight: 500;
  }
  .badge-hot { background: var(--gold); color: var(--dark); }
  .badge-new { background: #fff; color: var(--dark); border: 1px solid var(--border); }
  .badge-pro { background: var(--dark); color: var(--gold); }
  .badge-cat {
    border-radius: 2px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 3px 10px;
    font-weight: 500;
  }
  .badge-remote {
    background: #F4F4F4;
    color: #555;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 2px;
    font-weight: 500;
  }

  .listing-title {
    font-family: var(--ff);
    font-size: 1.05rem;
    color: var(--dark);
    margin-bottom: 8px;
    font-weight: 400;
    line-height: 1.4;
  }
  .listing-meta {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    font-size: 12px;
    color: var(--muted);
    margin-top: 6px;
  }
  .listing-meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pay-col { text-align: right; min-width: 110px; }
  .pay-amount {
    font-family: var(--ff);
    font-size: 1.8rem;
    color: var(--dark);
    line-height: 1;
  }
  .pay-label {
    font-size: 11px;
    color: var(--muted);
    margin-top: 3px;
    letter-spacing: 0.03em;
  }
  .apply-btn {
    display: block;
    margin-top: 10px;
    background: var(--dark);
    color: #fff;
    border: none;
    padding: 9px 18px;
    font-size: 11px;
    border-radius: 2px;
    cursor: pointer;
    font-family: var(--fs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    text-decoration: none;
    transition: background 0.2s;
    width: 100%;
  }
  .apply-btn:hover { background: var(--gold); color: var(--dark); }
  .unlock-btn {
    display: block;
    margin-top: 10px;
    background: transparent;
    color: var(--dark);
    border: 1px solid var(--border);
    padding: 9px 18px;
    font-size: 11px;
    border-radius: 2px;
    cursor: pointer;
    font-family: var(--fs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    transition: all 0.2s;
    width: 100%;
  }
  .unlock-btn:hover { background: var(--dark); color: var(--gold); border-color: var(--dark); }

  /* LOADING / EMPTY */
  .loading-wrap {
    text-align: center;
    padding: 60px 20px;
    color: var(--muted);
  }
  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 2px solid var(--border);
    border-top-color: var(--gold);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  .empty-state h3 {
    font-family: var(--ff);
    font-size: 1.4rem;
    font-weight: 400;
    margin-bottom: 8px;
  }
  .empty-state p { font-size: 13px; color: var(--muted); }

  /* UNLOCK CTA */
  .unlock-cta {
    text-align: center;
    padding: 48px 32px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 4px;
    margin-top: 12px;
  }
  .unlock-cta h3 {
    font-family: var(--ff);
    font-size: 1.6rem;
    font-weight: 400;
    margin-bottom: 10px;
  }
  .unlock-cta p {
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 24px;
    font-weight: 300;
    line-height: 1.7;
  }

  /* PRICING */
  .pricing-hero {
    text-align: center;
    padding: 64px 2rem 48px;
    max-width: 640px;
    margin: 0 auto;
  }
  .pricing-hero h2 {
    font-family: var(--ff);
    font-size: 2.6rem;
    font-weight: 400;
    margin-bottom: 1rem;
  }
  .pricing-hero p {
    color: var(--muted);
    font-size: 1rem;
    line-height: 1.7;
    font-weight: 300;
  }
  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
    max-width: 920px;
    margin: 0 auto 64px;
    padding: 0 2rem;
  }
  .plan-card {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 36px 28px;
    position: relative;
  }
  .plan-card.popular {
    border: 2px solid var(--gold);
    background: var(--gold-pale);
  }
  .popular-badge {
    position: absolute;
    top: -13px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--gold);
    color: var(--dark);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 5px 16px;
    border-radius: 2px;
    font-weight: 500;
    white-space: nowrap;
  }
  .plan-tier {
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 14px;
    font-weight: 500;
  }
  .plan-price {
    font-family: var(--ff);
    font-size: 3rem;
    color: var(--dark);
    margin-bottom: 4px;
    line-height: 1;
  }
  .plan-price sup { font-size: 1.3rem; vertical-align: super; }
  .plan-price .per { font-size: 1rem; color: var(--muted); font-family: var(--fs); font-weight: 300; }
  .plan-desc {
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 28px;
    line-height: 1.65;
    font-weight: 300;
    margin-top: 10px;
  }
  .plan-features { list-style: none; margin-bottom: 28px; }
  .plan-features li {
    font-size: 13px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--dark);
    line-height: 1.4;
  }
  .plan-features li:last-child { border-bottom: none; }
  .feat-check { color: var(--gold); font-size: 13px; flex-shrink: 0; }
  .feat-cross { color: #ccc; font-size: 13px; flex-shrink: 0; }
  .feat-off { color: #bbb; }
  .plan-btn {
    width: 100%;
    padding: 14px;
    border-radius: 2px;
    font-family: var(--fs);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
  }
  .plan-btn-dark { background: var(--dark); color: #fff; border: none; }
  .plan-btn-dark:hover { background: #2a2a2a; }
  .plan-btn-outline { background: transparent; color: var(--dark); border: 1.5px solid var(--dark); }
  .plan-btn-outline:hover { background: var(--dark); color: #fff; }

  /* GUARANTEE */
  .guarantee {
    text-align: center;
    padding: 48px 2rem;
    background: var(--dark);
    color: #fff;
  }
  .guarantee h3 {
    font-family: var(--ff);
    font-size: 1.5rem;
    font-weight: 400;
    color: var(--gold);
    margin-bottom: 10px;
  }
  .guarantee p { font-size: 13px; color: #666; font-weight: 300; }

  /* FOOTER */
  footer {
    background: #111;
    padding: 24px 2rem;
    text-align: center;
    border-top: 1px solid #1f1f1f;
  }
  footer p { font-size: 11px; color: #444; letter-spacing: 0.08em; text-transform: uppercase; }

  .divider { height: 1px; background: var(--border); max-width: 1100px; margin: 0 auto; }

  @media (max-width: 640px) {
    .listing-card { grid-template-columns: 1fr; }
    .pay-col { text-align: left; }
    .stats-bar { gap: 2rem; }
    .nav-links { gap: 1rem; }
  }
`;

// ── Components ───────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="loading-wrap">
      <div className="loading-spinner" />
      <p style={{ fontSize: 13, letterSpacing: "0.05em" }}>Loading listings...</p>
    </div>
  );
}

function ListingCard({ listing, onUpgrade, limit, index }) {
  const isLocked = limit && index >= limit;
  const isRemote = listing.Location?.toLowerCase().includes("remote");
  const isNew = new Date() - new Date(listing.created_at) < 86400000 * 2;
  const catStyle = TAG_STYLES[listing.Category] || { bg: "#F4F4F4", color: "#555" };

  if (isLocked) {
    return (
      <div className="listing-card locked" onClick={onUpgrade}>
        <div>
          <div className="listing-badges">
            <span className="badge badge-pro">Pro</span>
            <span className="badge-cat badge" style={{ background: catStyle.bg, color: catStyle.color }}>
              {listing.Category}
            </span>
          </div>
          <div className="listing-title" style={{ filter: "blur(5px)", userSelect: "none" }}>
            {listing.Title}
          </div>
          <div className="listing-meta" style={{ filter: "blur(4px)", userSelect: "none" }}>
            <span className="listing-meta-item">🏢 {listing.Company}</span>
            <span className="listing-meta-item">⏱ {listing.Duration}</span>
          </div>
        </div>
        <div className="pay-col">
          <div className="pay-amount" style={{ filter: "blur(6px)", userSelect: "none" }}>
            ${listing.Pay}
          </div>
          <button className="unlock-btn" onClick={onUpgrade}>
            🔒 Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`listing-card ${index < 3 ? "featured" : ""}`}>
      <div>
        <div className="listing-badges">
          {index < 3 && <span className="badge badge-hot">Top Pick</span>}
          {isNew && index >= 3 && <span className="badge badge-new">New</span>}
          <span className="badge-cat badge" style={{ background: catStyle.bg, color: catStyle.color }}>
            {listing.Category}
          </span>
          {isRemote && <span className="badge-remote">Remote</span>}
        </div>
        <div className="listing-title">{listing.Title}</div>
        <div className="listing-meta">
          {listing.Company && (
            <span className="listing-meta-item">🏢 {listing.Company}</span>
          )}
          {listing.Duration && (
            <span className="listing-meta-item">⏱ {listing.Duration}</span>
          )}
          {listing.Location && (
            <span className="listing-meta-item">📍 {listing.Location}</span>
          )}
        </div>
      </div>
      <div className="pay-col">
        {listing.Pay && (
          <>
            <div className="pay-amount">${listing.Pay}</div>
            <div className="pay-label">per session</div>
          </>
        )}
        <button className="apply-btn">Apply Now</button>
      </div>
    </div>
  );
}

// ── Pages ────────────────────────────────────────────────────────────────────

function HomePage({ listings, loading, onNavigate }) {
  const topPicks = listings.slice(0, 4);
  const counts = {};
  listings.forEach((l) => { counts[l.Category] = (counts[l.Category] || 0) + 1; });

  return (
    <>
      <div className="hero">
        <div className="hero-eyebrow">The #1 Paid Research Directory</div>
        <h1>
          Get Paid to<br />
          <em>Share Your Opinion</em>
        </h1>
        <p>
          Curated daily listings for user interviews, focus groups, taste tests,
          mock trials, and more. The highest-paying opportunities — all in one place.
        </p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={() => onNavigate("listings")}>
            Browse Today's Listings
          </button>
          <button className="btn-outline" onClick={() => onNavigate("pricing")}>
            View Membership Plans
          </button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat">
          <span className="stat-num">{listings.length}+</span>
          <span className="stat-label">Active Listings</span>
        </div>
        <div className="stat">
          <span className="stat-num">
            ${listings.length > 0
              ? Math.round(listings.reduce((s, l) => s + (l.Pay || 0), 0) / listings.filter(l => l.Pay).length)
              : 0}
          </span>
          <span className="stat-label">Avg. Payout</span>
        </div>
        <div className="stat">
          <span className="stat-num">Daily</span>
          <span className="stat-label">Updated</span>
        </div>
        <div className="stat">
          <span className="stat-num">7</span>
          <span className="stat-label">Sources Scraped</span>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title">Browse by Category</div>
          <button className="section-action" onClick={() => onNavigate("listings")}>
            See all →
          </button>
        </div>
        <div className="cat-home-grid">
          {CATEGORIES.filter((c) => c.value).map((cat) => (
            <div
              key={cat.value}
              className="cat-home-card"
              onClick={() => onNavigate("listings", cat.value)}
            >
              <span className="cat-home-icon">{cat.icon}</span>
              <div className="cat-home-name">{cat.label}</div>
              <div className="cat-home-count">{counts[cat.value] || 0} active</div>
            </div>
          ))}
        </div>
      </div>

      <div className="divider" />

      <div className="section">
        <div className="section-header">
          <div className="section-title">🔥 Top Picks Today</div>
          <button className="section-action" onClick={() => onNavigate("listings")}>
            View all →
          </button>
        </div>
        {loading ? (
          <LoadingSpinner />
        ) : topPicks.length === 0 ? (
          <div className="empty-state">
            <h3>No listings yet</h3>
            <p>The scraper runs daily at 8 AM. Check back soon!</p>
          </div>
        ) : (
          topPicks.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} />
          ))
        )}
      </div>

      <div className="guarantee">
        <h3>New listings added every morning</h3>
        <p>
          Our scraper runs daily at 8 AM and AI curates only the highest-value
          opportunities so you never waste time on low-paying gigs.
        </p>
      </div>
    </>
  );
}

function ListingsPage({ listings, loading, onNavigate, initialCategory }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory || "");
  const [location, setLocation] = useState("");
  const [minPay, setMinPay] = useState("");
  const FREE_LIMIT = 5;

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  const filtered = listings.filter((l) => {
    const q = search.toLowerCase();
    if (q && !l.Title?.toLowerCase().includes(q) && !l.Company?.toLowerCase().includes(q)) return false;
    if (category && l.Category !== category) return false;
    if (location === "Remote" && !l.Location?.toLowerCase().includes("remote")) return false;
    if (location === "In-Person" && l.Location?.toLowerCase().includes("remote")) return false;
    if (minPay && (l.Pay || 0) < parseInt(minPay)) return false;
    return true;
  });

  const visible = filtered.slice(0, FREE_LIMIT);
  const locked = filtered.slice(FREE_LIMIT, FREE_LIMIT + 5);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 2rem 60px" }}>
      <div style={{ marginBottom: 32 }}>
        <div className="section-title" style={{ marginBottom: 6 }}>Browse All Listings</div>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Updated daily · AI-curated for quality · {listings.length} total listings
        </p>
      </div>

      <div className="cat-grid">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            className={`cat-pill ${category === cat.value ? "active" : ""}`}
            onClick={() => setCategory(cat.value)}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      <div className="filters">
        <input
          className="search-box"
          type="text"
          placeholder="Search by title or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="filter-select" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">All Locations</option>
          <option value="Remote">Remote</option>
          <option value="In-Person">In-Person</option>
        </select>
        <select className="filter-select" value={minPay} onChange={(e) => setMinPay(e.target.value)}>
          <option value="">Any Pay</option>
          <option value="50">$50+</option>
          <option value="100">$100+</option>
          <option value="200">$200+</option>
          <option value="300">$300+</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No listings found</h3>
          <p>Try adjusting your filters or check back after the next scrape (8 AM daily).</p>
        </div>
      ) : (
        <>
          {visible.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} />
          ))}
          {locked.map((l, i) => (
            <ListingCard
              key={l.id}
              listing={l}
              index={FREE_LIMIT + i}
              limit={FREE_LIMIT}
              onUpgrade={() => onNavigate("pricing")}
            />
          ))}
          {filtered.length > FREE_LIMIT && (
            <div className="unlock-cta">
              <h3>Unlock {filtered.length - FREE_LIMIT} More Listings</h3>
              <p>
                Pro members see every listing, get daily email digests,
                and advanced filters — starting at just $9/mo.
              </p>
              <button className="btn-primary" onClick={() => onNavigate("pricing")}>
                View Membership Plans
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PricingPage() {
  const plans = [
    {
      tier: "Free",
      price: 0,
      desc: "A taste of what's available. Great for getting started with no commitment.",
      features: [
        { text: "5 listings per day", included: true },
        { text: "Browse all categories", included: true },
        { text: "AI-curated Top Picks", included: false },
        { text: "Advanced filters", included: false },
        { text: "Daily email digest", included: false },
        { text: "Taste test listings", included: false },
        { text: "Priority new listings", included: false },
      ],
      btn: "Get Started Free",
      btnStyle: "plan-btn-outline",
      popular: false,
    },
    {
      tier: "Pro",
      price: 9,
      desc: "Full access. Everything you need to find the best-paying gigs every single day.",
      features: [
        { text: "Unlimited listings", included: true },
        { text: "AI Top Picks — daily", included: true },
        { text: "All categories incl. taste tests", included: true },
        { text: "Advanced pay & location filters", included: true },
        { text: "Daily email digest (8 AM)", included: true },
        { text: "Priority new listings", included: true },
        { text: "Concierge matching", included: false },
      ],
      btn: "Start 7-Day Free Trial",
      btnStyle: "plan-btn-dark",
      popular: true,
    },
    {
      tier: "Elite",
      price: 19,
      desc: "For serious earners who want every advantage and zero missed opportunities.",
      features: [
        { text: "Everything in Pro", included: true },
        { text: "Concierge profile matching", included: true },
        { text: "SMS alerts for $200+ gigs", included: true },
        { text: "Earnings tracker dashboard", included: true },
        { text: "Early access — 6 AM feed", included: true },
        { text: "Members-only Slack community", included: true },
        { text: "Monthly earning reports", included: true },
      ],
      btn: "Start 7-Day Free Trial",
      btnStyle: "plan-btn-outline",
      popular: false,
    },
  ];

  return (
    <>
      <div className="pricing-hero">
        <h2>Simple, Honest Pricing</h2>
        <p>
          Start free. Upgrade when you're ready to access the full board
          and start earning more consistently.
        </p>
      </div>
      <div className="pricing-grid">
        {plans.map((plan) => (
          <div key={plan.tier} className={`plan-card ${plan.popular ? "popular" : ""}`}>
            {plan.popular && <div className="popular-badge">Most Popular</div>}
            <div className="plan-tier">{plan.tier}</div>
            <div className="plan-price">
              <sup>$</sup>{plan.price}
              <span className="per">/mo</span>
            </div>
            <div className="plan-desc">{plan.desc}</div>
            <ul className="plan-features">
              {plan.features.map((f, i) => (
                <li key={i}>
                  <span className={f.included ? "feat-check" : "feat-cross"}>✦</span>
                  <span className={f.included ? "" : "feat-off"}>{f.text}</span>
                </li>
              ))}
            </ul>
            <button
              className={`plan-btn ${plan.btnStyle}`}
              onClick={() => alert("Stripe checkout coming soon!")}
            >
              {plan.btn}
            </button>
          </div>
        ))}
      </div>
      <div className="guarantee">
        <h3>30-Day Money-Back Guarantee</h3>
        <p>
          Not earning more within 30 days? We'll refund every penny. No questions asked.
        </p>
      </div>
    </>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("home");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialCategory, setInitialCategory] = useState("");

  useEffect(() => {
    async function fetchListings() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("Listings")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setListings(data || []);
      } catch (err) {
        console.error("Supabase fetch error:", err.message);
        setListings([]);
      } finally {
        setLoading(false);
      }
    }
    fetchListings();
  }, []);

  function navigate(dest, category = "") {
    setPage(dest);
    setInitialCategory(category);
    window.scrollTo(0, 0);
  }

  return (
    <>
      <style>{css}</style>

      <nav className="nav">
        <button className="nav-logo" onClick={() => navigate("home")}>
          Study<span>CashBoard</span>
        </button>
        <div className="nav-links">
          <button className={`nav-link ${page === "home" ? "active" : ""}`} onClick={() => navigate("home")}>
            Home
          </button>
          <button className={`nav-link ${page === "listings" ? "active" : ""}`} onClick={() => navigate("listings")}>
            Browse Gigs
          </button>
          <button className={`nav-link ${page === "pricing" ? "active" : ""}`} onClick={() => navigate("pricing")}>
            Pricing
          </button>
          <button className="nav-cta" onClick={() => navigate("pricing")}>
            Get Pro Access
          </button>
        </div>
      </nav>

      {page === "home" && (
        <HomePage listings={listings} loading={loading} onNavigate={navigate} />
      )}
      {page === "listings" && (
        <ListingsPage
          listings={listings}
          loading={loading}
          onNavigate={navigate}
          initialCategory={initialCategory}
        />
      )}
      {page === "pricing" && <PricingPage />}

      <footer>
        <p>© 2026 StudyCashBoard · Built for earners, by earners</p>
      </footer>
    </>
  );
}
