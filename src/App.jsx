import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://astgazboqpwhcuyemshx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzdGdhemJvcXB3aGN1eWVtc2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzUyMDAsImV4cCI6MjA5Mzg1MTIwMH0.9ZKI3MaZbJSWSm2QC2jOETrhGTiUETcvmZW4PCJWyk8"
);

const FREE_LIMIT = 5;
const EASY_APP_CATEGORY = "Easy Application";

const CATEGORIES = [
  { label: "All Listings",       icon: "✦",  value: "",                   color: "#C9A84C" },
  { label: "Easy Application",   icon: "⚡",  value: "Easy Application",   color: "#16A34A" },
  { label: "User Interview",     icon: "🎙️", value: "User Interview",     color: "#1A56C4" },
  { label: "Focus Group",        icon: "👥", value: "Focus Group",        color: "#6B3FA0" },
  { label: "Taste Test",         icon: "🍽️", value: "Taste Test",         color: "#C05A10" },
  { label: "Mock Jury",          icon: "⚖️", value: "Mock Jury",          color: "#1A7A45" },
  { label: "App & UX Testing",   icon: "📱", value: "App & UX Testing",   color: "#0F6E8E" },
  { label: "Medical & Health",   icon: "🏥", value: "Medical & Health",   color: "#A02020" },
  { label: "AI & Tech",          icon: "🤖", value: "AI & Tech",          color: "#4338CA" },
  { label: "Finance",            icon: "💳", value: "Finance",            color: "#166534" },
  { label: "Product Testing",    icon: "📦", value: "Product Testing",    color: "#854F0B" },
  { label: "Online Survey",      icon: "📝", value: "Online Survey",      color: "#B86B00" },
  { label: "Automotive",         icon: "🚗", value: "Automotive",         color: "#374151" },
  { label: "Gaming",             icon: "🎮", value: "Gaming",             color: "#5B21B6" },
  { label: "Education",          icon: "📚", value: "Education",          color: "#065F46" },
  { label: "Travel",             icon: "✈️", value: "Travel",             color: "#0C4A6E" },
  { label: "Retail & Lifestyle", icon: "🛍️", value: "Retail & Lifestyle", color: "#9D174D" },
  { label: "Home & Living",      icon: "🏠", value: "Home & Living",      color: "#44403C" },
  { label: "Diary Study",        icon: "📓", value: "Diary Study",        color: "#6B3FA0" },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --gold: #C9A84C; --gold-light: #E8C97A; --gold-pale: #FDF8EE;
    --gold-border: #E8D8AA; --dark: #0A0A0A; --dark2: #141414;
    --dark3: #1E1E1E; --dark4: #2A2A2A; --surface: #FAFAF8;
    --border: #E8E3D8; --muted: #7A7568; --muted2: #9E998E;
    --green: #16A34A; --green-pale: #F0FDF4; --green-border: #BBF7D0;
    --ff: 'Cormorant Garamond', Georgia, serif;
    --fs: 'Plus Jakarta Sans', system-ui, sans-serif;
  }
  html { scroll-behavior: smooth; }
  body { font-family: var(--fs); background: var(--surface); color: var(--dark); min-height: 100vh; -webkit-font-smoothing: antialiased; }

  .nav { background: var(--dark); padding: 0 2.5rem; display: flex; align-items: center; justify-content: space-between; height: 64px; position: sticky; top: 0; z-index: 200; border-bottom: 1px solid #222; }
  .logo { display: flex; align-items: center; gap: 0; cursor: pointer; background: none; border: none; padding: 0; }
  .logo-study { font-family: var(--ff); font-size: 1.6rem; font-weight: 600; color: #FFFFFF; }
  .logo-cash  { font-family: var(--ff); font-size: 1.6rem; font-weight: 600; color: var(--gold); }
  .logo-board { font-family: var(--ff); font-size: 1.6rem; font-weight: 400; color: #999; }
  .logo-tag   { font-size: 9px; color: #444; letter-spacing: 0.15em; text-transform: uppercase; margin-left: 12px; margin-top: 3px; font-weight: 500; }
  .nav-center { display: flex; gap: 2rem; align-items: center; }
  .nav-link { color: #777; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: color 0.2s; background: none; border: none; font-family: var(--fs); font-weight: 500; padding: 0; }
  .nav-link:hover, .nav-link.active { color: var(--gold); }
  .nav-right { display: flex; gap: 10px; align-items: center; }
  .nav-sign-in { background: transparent; color: #999; border: 1px solid #333; padding: 8px 18px; font-family: var(--fs); font-size: 12px; border-radius: 2px; cursor: pointer; letter-spacing: 0.06em; transition: all 0.2s; }
  .nav-sign-in:hover { border-color: #666; color: #fff; }
  .nav-cta { background: var(--gold); color: var(--dark); border: none; padding: 9px 22px; font-family: var(--fs); font-size: 12px; font-weight: 600; border-radius: 2px; cursor: pointer; letter-spacing: 0.06em; text-transform: uppercase; transition: all 0.2s; }
  .nav-cta:hover { background: var(--gold-light); }

  .easy-banner { background: var(--green-pale); border-bottom: 1px solid var(--green-border); padding: 12px 2.5rem; display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; }
  .easy-banner-text { font-size: 13px; color: #166534; font-weight: 500; }
  .easy-banner-btn { background: var(--green); color: #fff; border: none; padding: 7px 18px; font-size: 11px; font-weight: 600; border-radius: 2px; cursor: pointer; font-family: var(--fs); letter-spacing: 0.06em; text-transform: uppercase; transition: all 0.2s; }
  .easy-banner-btn:hover { background: #15803D; }

  .hero-wrap { background: var(--dark); padding: 90px 2rem 80px; text-align: center; position: relative; overflow: hidden; }
  .hero-wrap::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 80% 60% at 50% 100%, rgba(201,168,76,0.07) 0%, transparent 70%); pointer-events: none; }
  .hero-label { display: inline-flex; align-items: center; gap: 8px; background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.2); color: var(--gold); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; padding: 6px 16px; border-radius: 100px; margin-bottom: 2rem; font-weight: 500; }
  .hero-dot { width: 5px; height: 5px; background: var(--gold); border-radius: 50%; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .hero h1 { font-family: var(--ff); font-size: clamp(2.8rem, 6vw, 4.5rem); line-height: 1.1; color: #fff; margin-bottom: 1.5rem; font-weight: 500; }
  .hero h1 em { color: var(--gold); font-style: italic; }
  .hero-sub { font-size: 1.05rem; color: #888; line-height: 1.8; max-width: 560px; margin: 0 auto 2.5rem; font-weight: 300; }
  .hero-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .btn-gold { background: var(--gold); color: var(--dark); border: none; padding: 14px 32px; font-family: var(--fs); font-size: 13px; font-weight: 600; border-radius: 2px; cursor: pointer; letter-spacing: 0.05em; transition: all 0.2s; }
  .btn-gold:hover { background: var(--gold-light); transform: translateY(-1px); }
  .btn-ghost { background: transparent; color: #ccc; border: 1px solid #333; padding: 14px 32px; font-family: var(--fs); font-size: 13px; font-weight: 500; border-radius: 2px; cursor: pointer; letter-spacing: 0.05em; transition: all 0.2s; }
  .btn-ghost:hover { border-color: var(--gold); color: var(--gold); }

  .stats-bar { background: var(--dark2); border-top: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a; padding: 24px 2rem; display: flex; justify-content: center; flex-wrap: wrap; }
  .stat { text-align: center; padding: 0 3.5rem; border-right: 1px solid #222; }
  .stat:last-child { border-right: none; }
  .stat-num { font-family: var(--ff); font-size: 2.4rem; color: var(--gold); display: block; line-height: 1; font-weight: 500; }
  .stat-label { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #555; margin-top: 6px; display: block; font-weight: 500; }

  .easy-section { background: var(--green-pale); border-top: 1px solid var(--green-border); border-bottom: 1px solid var(--green-border); padding: 48px 2.5rem; }
  .easy-inner { max-width: 1160px; margin: 0 auto; }
  .easy-title { font-family: var(--ff); font-size: 1.8rem; font-weight: 500; color: #14532D; margin-bottom: 6px; }
  .easy-sub { font-size: 13px; color: #166534; margin-bottom: 24px; line-height: 1.6; }

  .section { padding: 64px 2.5rem; max-width: 1160px; margin: 0 auto; }
  .section-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 2rem; }
  .section-title { font-family: var(--ff); font-size: 2rem; font-weight: 500; color: var(--dark); }
  .section-action { font-size: 11px; color: var(--gold); letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; background: none; border: none; font-family: var(--fs); font-weight: 600; transition: opacity 0.2s; }
  .section-action:hover { opacity: 0.7; }

  .cat-home-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .cat-home-card { background: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 20px 14px; text-align: center; cursor: pointer; transition: all 0.22s; }
  .cat-home-card:hover { border-color: var(--gold-border); background: var(--gold-pale); transform: translateY(-2px); }
  .cat-home-card.easy { border-color: var(--green-border); background: var(--green-pale); }
  .cat-home-card.easy:hover { border-color: var(--green); background: #DCFCE7; }
  .cat-home-icon { font-size: 22px; margin-bottom: 10px; display: block; }
  .cat-home-name { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dark); line-height: 1.4; }
  .cat-home-count { font-size: 11px; color: var(--muted2); margin-top: 5px; }
  .cat-home-free { font-size: 9px; color: var(--green); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 4px; }

  .cat-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 1.5rem; }
  .cat-pill { display: flex; align-items: center; gap: 5px; padding: 7px 14px; background: #fff; border: 1px solid var(--border); border-radius: 100px; cursor: pointer; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; color: var(--muted); transition: all 0.18s; font-family: var(--fs); text-transform: uppercase; }
  .cat-pill:hover { border-color: var(--gold-border); color: var(--dark); }
  .cat-pill.active { background: var(--dark); color: var(--gold); border-color: var(--dark); }
  .cat-pill.easy-pill { border-color: var(--green-border); color: var(--green); background: var(--green-pale); }
  .cat-pill.easy-pill.active { background: var(--green); color: #fff; border-color: var(--green); }

  .filters-row { display: flex; gap: 10px; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .search-wrap { flex: 1; min-width: 240px; position: relative; }
  .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted2); pointer-events: none; }
  .search-box { width: 100%; background: #fff; border: 1px solid var(--border); border-radius: 4px; padding: 11px 14px 11px 38px; font-family: var(--fs); font-size: 13px; outline: none; transition: border-color 0.2s; color: var(--dark); }
  .search-box:focus { border-color: var(--gold); }
  .search-box::placeholder { color: var(--muted2); }
  .filter-select { background: #fff; border: 1px solid var(--border); border-radius: 4px; padding: 11px 14px; font-family: var(--fs); font-size: 13px; color: var(--dark); cursor: pointer; outline: none; }
  .filter-select:focus { border-color: var(--gold); }
  .results-count { font-size: 12px; color: var(--muted); margin-bottom: 1rem; }

  .listing-card { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 24px 28px; margin-bottom: 10px; display: grid; grid-template-columns: 1fr 140px; gap: 24px; align-items: start; transition: all 0.22s; position: relative; overflow: hidden; }
  .listing-card:hover { border-color: var(--gold-border); box-shadow: 0 6px 28px rgba(201,168,76,0.09); transform: translateY(-1px); }
  .listing-card.featured { border-left: 3px solid var(--gold); }
  .listing-card.easy-card { border-left: 3px solid var(--green); }
  .listing-card.easy-card:hover { border-color: var(--green-border); box-shadow: 0 6px 28px rgba(22,163,74,0.09); }
  .listing-card.locked { cursor: pointer; }
  .listing-card.locked:hover { border-color: var(--dark4); box-shadow: none; transform: none; }

  .listing-badges { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
  .badge { font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; padding: 4px 10px; border-radius: 2px; }
  .badge-hot  { background: var(--gold); color: var(--dark); }
  .badge-easy { background: var(--green); color: #fff; }
  .badge-free { background: var(--green-pale); color: var(--green); border: 1px solid var(--green-border); }
  .badge-new  { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
  .badge-pro  { background: var(--dark); color: var(--gold); }
  .badge-cat  { padding: 4px 10px; border-radius: 2px; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .badge-tag  { background: #F5F5F0; color: var(--muted); padding: 3px 8px; border-radius: 2px; font-size: 9px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }

  .listing-title { font-family: var(--ff); font-size: 1.15rem; color: var(--dark); margin-bottom: 6px; font-weight: 500; line-height: 1.35; }
  .listing-desc { font-size: 12.5px; color: var(--muted); line-height: 1.65; margin-bottom: 12px; max-width: 600px; }
  .listing-meta { display: flex; gap: 16px; flex-wrap: wrap; }
  .listing-meta-item { font-size: 11.5px; color: var(--muted2); display: flex; align-items: center; gap: 5px; font-weight: 500; }

  .pay-col { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .pay-range { font-family: var(--ff); font-size: 1.7rem; color: var(--dark); line-height: 1; font-weight: 500; }
  .pay-max { font-size: 1.1rem; color: var(--muted2); }
  .pay-label { font-size: 10px; color: var(--muted2); letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; }
  .pay-rate { font-size: 10.5px; color: var(--gold); font-weight: 600; }
  .pay-rate-green { font-size: 10.5px; color: var(--green); font-weight: 600; }

  .apply-btn { display: block; background: var(--dark); color: #fff; border: none; padding: 9px 18px; font-size: 10px; border-radius: 3px; cursor: pointer; font-family: var(--fs); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; text-align: center; text-decoration: none; transition: all 0.2s; width: 100%; margin-top: 4px; }
  .apply-btn:hover { background: var(--gold); color: var(--dark); }
  .apply-btn-green { background: var(--green); }
  .apply-btn-green:hover { background: #15803D; color: #fff; }
  .unlock-btn { display: block; background: transparent; color: var(--muted); border: 1px solid var(--border); padding: 9px 18px; font-size: 10px; border-radius: 3px; cursor: pointer; font-family: var(--fs); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; transition: all 0.2s; width: 100%; margin-top: 4px; }
  .unlock-btn:hover { background: var(--dark); color: var(--gold); border-color: var(--dark); }
  .listing-body-locked { filter: blur(5px); user-select: none; pointer-events: none; }

  .loading-wrap { text-align: center; padding: 80px 20px; }
  .spinner { width: 36px; height: 36px; border: 2px solid var(--border); border-top-color: var(--gold); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 20px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-text { font-size: 13px; color: var(--muted2); font-weight: 500; }
  .empty-state { text-align: center; padding: 70px 20px; background: #fff; border: 1px solid var(--border); border-radius: 8px; }
  .empty-state h3 { font-family: var(--ff); font-size: 1.5rem; font-weight: 500; margin-bottom: 10px; }
  .empty-state p { font-size: 13px; color: var(--muted); line-height: 1.7; }

  .unlock-cta { background: var(--dark); border-radius: 8px; padding: 48px 40px; text-align: center; margin-top: 12px; }
  .unlock-cta h3 { font-family: var(--ff); font-size: 2rem; font-weight: 500; color: #fff; margin-bottom: 10px; }
  .unlock-cta p { font-size: 13px; color: #888; margin-bottom: 28px; line-height: 1.7; max-width: 420px; margin-left: auto; margin-right: auto; }

  .how-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
  .how-card { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 28px 24px; }
  .how-num { font-family: var(--ff); font-size: 3rem; color: var(--gold-border); font-weight: 500; line-height: 1; margin-bottom: 12px; }
  .how-title { font-weight: 600; font-size: 14px; margin-bottom: 8px; }
  .how-desc { font-size: 13px; color: var(--muted); line-height: 1.65; font-weight: 300; }

  .testi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
  .testi-card { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 28px 24px; }
  .testi-stars { color: var(--gold); font-size: 13px; margin-bottom: 12px; }
  .testi-text { font-family: var(--ff); font-size: 1.05rem; line-height: 1.6; margin-bottom: 16px; font-style: italic; }
  .testi-author { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .testi-earned { font-size: 11px; color: var(--gold); font-weight: 600; margin-top: 2px; }

  .pricing-hero { text-align: center; padding: 72px 2rem 56px; max-width: 680px; margin: 0 auto; }
  .pricing-hero h2 { font-family: var(--ff); font-size: 2.8rem; font-weight: 500; margin-bottom: 1rem; }
  .pricing-hero p { color: var(--muted); font-size: 1rem; line-height: 1.8; font-weight: 300; }
  .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 16px; max-width: 950px; margin: 0 auto 72px; padding: 0 2rem; }
  .plan { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 36px 30px; position: relative; display: flex; flex-direction: column; }
  .plan.popular { border: 2px solid var(--gold); background: var(--gold-pale); }
  .popular-pill { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); background: var(--gold); color: var(--dark); font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; padding: 5px 18px; border-radius: 100px; white-space: nowrap; }
  .plan-tier { font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); margin-bottom: 16px; font-weight: 600; }
  .plan-price-wrap { display: flex; align-items: baseline; gap: 2px; margin-bottom: 6px; }
  .plan-dollar { font-family: var(--ff); font-size: 1.4rem; color: var(--dark); }
  .plan-amount { font-family: var(--ff); font-size: 3.2rem; color: var(--dark); line-height: 1; }
  .plan-period { font-size: 13px; color: var(--muted); font-weight: 300; margin-left: 4px; }
  .plan-desc { font-size: 12.5px; color: var(--muted); margin-bottom: 28px; line-height: 1.7; font-weight: 300; margin-top: 10px; }
  .plan-feats { list-style: none; margin-bottom: 28px; flex: 1; }
  .plan-feats li { font-size: 12.5px; padding: 9px 0; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 10px; line-height: 1.45; }
  .plan-feats li:last-child { border-bottom: none; }
  .feat-yes { color: var(--gold); flex-shrink: 0; font-weight: 700; }
  .feat-no  { color: #D0CBC0; flex-shrink: 0; font-weight: 700; }
  .feat-dim { color: #C0BAB0; }
  .plan-btn { width: 100%; padding: 14px; border-radius: 4px; font-family: var(--fs); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; margin-top: auto; }
  .plan-btn-dark { background: var(--dark); color: #fff; border: none; }
  .plan-btn-dark:hover { background: #222; }
  .plan-btn-outline { background: transparent; color: var(--dark); border: 1.5px solid var(--dark); }
  .plan-btn-outline:hover { background: var(--dark); color: #fff; }

  .guarantee { background: var(--dark2); border-top: 1px solid #1a1a1a; padding: 56px 2rem; text-align: center; }
  .guarantee h3 { font-family: var(--ff); font-size: 1.8rem; font-weight: 500; color: var(--gold); margin-bottom: 10px; }
  .guarantee p { font-size: 13px; color: #666; font-weight: 300; line-height: 1.7; max-width: 500px; margin: 0 auto; }

  .footer { background: var(--dark); padding: 32px 2.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; border-top: 1px solid #1a1a1a; }
  .footer-logo { font-family: var(--ff); font-size: 1.1rem; font-weight: 500; }
  .footer-logo span.s { color: #fff; } .footer-logo span.c { color: var(--gold); } .footer-logo span.b { color: #666; }
  .footer-links { display: flex; gap: 2rem; }
  .footer-link { font-size: 11px; color: #555; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: color 0.2s; background: none; border: none; font-family: var(--fs); font-weight: 500; }
  .footer-link:hover { color: var(--gold); }
  .footer-copy { font-size: 11px; color: #444; letter-spacing: 0.06em; text-transform: uppercase; }
  .divider { height: 1px; background: var(--border); max-width: 1160px; margin: 0 auto; }

  @media (max-width: 700px) {
    .listing-card { grid-template-columns: 1fr; }
    .pay-col { text-align: left; align-items: flex-start; flex-direction: row; flex-wrap: wrap; gap: 12px; }
    .stat { padding: 12px 1.5rem; border-right: none; border-bottom: 1px solid #222; }
    .stat:last-child { border-bottom: none; }
    .nav-right .nav-sign-in { display: none; }
    .footer { flex-direction: column; text-align: center; }
    .footer-links { justify-content: center; }
    .logo-tag { display: none; }
  }
`;

function Spinner() {
  return (
    <div className="loading-wrap">
      <div className="spinner" />
      <div className="loading-text">Loading fresh listings...</div>
    </div>
  );
}

function isEasy(listing) {
  return listing.Category === EASY_APP_CATEGORY ||
    ((listing.Pay || 0) >= 10 && (listing.Pay || 0) <= 40 &&
     listing.Category === "Online Survey");
}

function ListingCard({ listing, index, onUpgrade, isLocked }) {
  const cat = CAT_MAP[listing.Category] || { color: "#888" };
  const catColor = cat.color;
  const isRemote = listing.Location?.toLowerCase().includes("remote");
  const isNew = new Date() - new Date(listing.created_at) < 86400000 * 2;
  const isFeatured = listing.Is_Featured || listing.Score >= 78 || index < 3;
  const easy = isEasy(listing);
  const payMin = listing.Pay;
  const payMax = listing.Pay_Max;
  const rate = listing.Hourly_Rate;

  if (isLocked) {
    return (
      <div className="listing-card locked" onClick={onUpgrade}>
        <div className="listing-body-locked">
          <div className="listing-badges">
            <span className="badge badge-pro">Pro</span>
            <span className="badge-cat badge" style={{ background: catColor + "18", color: catColor }}>{listing.Category}</span>
          </div>
          <div className="listing-title">{listing.Title}</div>
          <div className="listing-desc">{listing.Description || "Members-only listing. Upgrade to view full details and apply."}</div>
          <div className="listing-meta">
            <span className="listing-meta-item">🏢 {listing.Company}</span>
            <span className="listing-meta-item">⏱ {listing.Duration}</span>
          </div>
        </div>
        <div className="pay-col">
          <div className="pay-range" style={{ filter: "blur(7px)", userSelect: "none" }}>${payMin || "???"}</div>
          <button className="unlock-btn">🔒 Unlock</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`listing-card ${easy ? "easy-card" : isFeatured ? "featured" : ""}`}>
      <div>
        <div className="listing-badges">
          {easy && <span className="badge badge-easy">⚡ Easy Apply</span>}
          {easy && <span className="badge badge-free">Free to All</span>}
          {!easy && isFeatured && <span className="badge badge-hot">⭐ Top Pick</span>}
          {!easy && isNew && !isFeatured && <span className="badge badge-new">New</span>}
          <span className="badge-cat badge" style={{ background: catColor + "18", color: catColor }}>{listing.Category}</span>
          {isRemote && <span className="badge-tag">Remote</span>}
          {listing.Tags?.slice(0, 2).map(t => <span key={t} className="badge-tag">{t}</span>)}
        </div>
        <div className="listing-title">{listing.Title}</div>
        {listing.Description && <div className="listing-desc">{listing.Description}</div>}
        <div className="listing-meta">
          {listing.Company && <span className="listing-meta-item">🏢 {listing.Company}</span>}
          {listing.Duration && <span className="listing-meta-item">⏱ {listing.Duration}</span>}
          {listing.Location && <span className="listing-meta-item">📍 {listing.Location}</span>}
        </div>
      </div>
      <div className="pay-col">
        <div>
          {payMin
            ? <div className="pay-range">${payMin}{payMax && payMax !== payMin && <span className="pay-max">–${payMax}</span>}</div>
            : <div className="pay-range" style={{ fontSize: "1rem", color: "var(--muted2)" }}>Varies</div>
          }
          <div className="pay-label">per session</div>
          {rate && <div className={easy ? "pay-rate-green" : "pay-rate"}>~${rate}/hr</div>}
        </div>
        <button
          className={`apply-btn ${easy ? "apply-btn-green" : ""}`}
          onClick={() => { const url = listing.Apply_URL || listing.Source_URL; if (url) window.open(url, "_blank"); }}
        >
          Apply Now →
        </button>
      </div>
    </div>
  );
}

function HomePage({ listings, loading, onNavigate }) {
  const counts = {};
  listings.forEach(l => {
    const cat = isEasy(l) ? EASY_APP_CATEGORY : l.Category;
    counts[cat] = (counts[cat] || 0) + 1;
  });

  const easyListings = listings.filter(l => isEasy(l));
  const topPicks = listings.filter(l => !isEasy(l)).sort((a, b) => (b.Score || 0) - (a.Score || 0)).slice(0, 5);
  const withPay = listings.filter(l => l.Pay);
  const avgPay = withPay.length > 0 ? Math.round(withPay.reduce((s, l) => s + l.Pay, 0) / withPay.length) : 127;

  return (
    <>
      {easyListings.length > 0 && (
        <div className="easy-banner">
          <span className="easy-banner-text">⚡ {easyListings.length} Easy Application studies available now — free to access, no Pro needed!</span>
          <button className="easy-banner-btn" onClick={() => onNavigate("listings", EASY_APP_CATEGORY)}>View Easy Listings</button>
        </div>
      )}

      <div className="hero-wrap">
        <div className="hero-label"><div className="hero-dot" /> Updated daily · AI-curated</div>
        <h1 className="hero">Get Paid to<br /><em>Share Your Opinion</em></h1>
        <p className="hero-sub">The most comprehensive directory of paid research opportunities — user interviews, focus groups, taste tests, mock trials, medical studies, and more.</p>
        <div className="hero-actions">
          <button className="btn-gold" onClick={() => onNavigate("listings")}>Browse Today's Listings</button>
          <button className="btn-ghost" onClick={() => onNavigate("pricing")}>View Membership Plans</button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat"><span className="stat-num">{listings.length}+</span><span className="stat-label">Active Listings</span></div>
        <div className="stat"><span className="stat-num">${avgPay}</span><span className="stat-label">Avg. Payout</span></div>
        <div className="stat"><span className="stat-num">Free</span><span className="stat-label">To Join</span></div>
        <div className="stat"><span className="stat-num">Daily</span><span className="stat-label">Updated</span></div>
      </div>

      {easyListings.length > 0 && (
        <div className="easy-section">
          <div className="easy-inner">
            <div className="section-header">
              <div>
                <div className="easy-title">⚡ Easy Application — Free for Everyone</div>
                <div className="easy-sub">Short, beginner-friendly studies paying $10–$40. No experience needed. All users can apply for free.</div>
              </div>
              <button className="section-action" style={{ color: "var(--green)" }} onClick={() => onNavigate("listings", EASY_APP_CATEGORY)}>See all →</button>
            </div>
            {easyListings.slice(0, 3).map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-header">
          <div className="section-title">Browse by Category</div>
          <button className="section-action" onClick={() => onNavigate("listings")}>See all →</button>
        </div>
        <div className="cat-home-grid">
          {CATEGORIES.filter(c => c.value && counts[c.value] > 0).map(cat => (
            <div key={cat.value} className={`cat-home-card ${cat.value === EASY_APP_CATEGORY ? "easy" : ""}`} onClick={() => onNavigate("listings", cat.value)}>
              <span className="cat-home-icon">{cat.icon}</span>
              <div className="cat-home-name">{cat.label}</div>
              <div className="cat-home-count">{counts[cat.value]} active</div>
              {cat.value === EASY_APP_CATEGORY && <div className="cat-home-free">Free to All</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="divider" />

      <div className="section">
        <div className="section-header">
          <div className="section-title">⭐ Top Picks Today</div>
          <button className="section-action" onClick={() => onNavigate("listings")}>View all →</button>
        </div>
        {loading ? <Spinner /> : topPicks.length === 0 ? (
          <div className="empty-state"><h3>Listings coming soon</h3><p>Our scraper runs daily at 8 AM CT.</p></div>
        ) : topPicks.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}
      </div>

      <div style={{ background: "var(--dark2)", padding: "64px 2.5rem", borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div className="section-header" style={{ marginBottom: "2rem" }}>
            <div className="section-title" style={{ color: "#fff" }}>How It Works</div>
          </div>
          <div className="how-grid">
            {[
              { n: "01", t: "We Scrape Daily", d: "Our system pulls from 12+ sources every morning — Respondent, UserInterviews, FocusGroups.org, taste test panels, mock jury firms, and more." },
              { n: "02", t: "AI Curates Quality", d: "Every listing is scored 0–100 for pay, time commitment, and legitimacy. Only quality opportunities make it to your feed." },
              { n: "03", t: "Expired Listings Auto-Removed", d: "Listings that disappear from their source are automatically marked expired within 4 days. You only see what's available." },
              { n: "04", t: "You Get Paid", d: "Easy Application listings are free to all. Pro members unlock everything else including taste tests, medical studies, and $200+ interviews." },
            ].map(h => (
              <div key={h.n} className="how-card">
                <div className="how-num">{h.n}</div>
                <div className="how-title">{h.t}</div>
                <div className="how-desc">{h.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header"><div className="section-title">What Members Are Saying</div></div>
        <div className="testi-grid">
          {[
            { stars: "★★★★★", text: "I made $847 in my first month just from focus groups and user interviews I found here. The AI curation is a game changer.", author: "Tanya M., Dallas TX", earned: "Earned $847 in Month 1" },
            { stars: "★★★★★", text: "The taste test listings alone paid for my subscription 10x over. I had no idea these opportunities existed near me.", author: "Marcus R., Houston TX", earned: "Earned $320 from taste tests" },
            { stars: "★★★★★", text: "I started with the Easy Application listings and made $60 my first week with zero experience. Now I do the bigger studies too.", author: "Priya K., Chicago IL", earned: "Earned $1,100+ total" },
          ].map((t, i) => (
            <div key={i} className="testi-card">
              <div className="testi-stars">{t.stars}</div>
              <div className="testi-text">"{t.text}"</div>
              <div className="testi-author">{t.author}</div>
              <div className="testi-earned">{t.earned}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="guarantee">
        <h3>New listings added every morning at 8 AM</h3>
        <p>Our scraper and AI run automatically overnight. Expired listings are removed. You only ever see fresh, verified opportunities.</p>
      </div>
    </>
  );
}

function ListingsPage({ listings, loading, onNavigate, initialCategory }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory || "");
  const [location, setLocation] = useState("");
  const [minPay, setMinPay] = useState("");
  const [sortBy, setSortBy] = useState("score");

  useEffect(() => { setCategory(initialCategory || ""); }, [initialCategory]);

  const counts = {};
  listings.forEach(l => {
    const cat = isEasy(l) ? EASY_APP_CATEGORY : l.Category;
    counts[cat] = (counts[cat] || 0) + 1;
  });
  counts[""] = listings.length;

  const filtered = listings.filter(l => {
    const q = search.toLowerCase();
    const effectiveCat = isEasy(l) ? EASY_APP_CATEGORY : l.Category;
    if (q && !l.Title?.toLowerCase().includes(q) && !l.Company?.toLowerCase().includes(q) && !l.Description?.toLowerCase().includes(q)) return false;
    if (category && effectiveCat !== category) return false;
    if (location === "Remote" && !l.Location?.toLowerCase().includes("remote")) return false;
    if (location === "In-Person" && l.Location?.toLowerCase().includes("remote")) return false;
    if (minPay && (l.Pay || 0) < parseInt(minPay)) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "score") return (b.Score || 0) - (a.Score || 0);
    if (sortBy === "pay") return (b.Pay || 0) - (a.Pay || 0);
    if (sortBy === "new") return new Date(b.created_at) - new Date(a.created_at);
    return 0;
  });

  const filteredEasy = filtered.filter(l => isEasy(l));
  const filteredRegular = filtered.filter(l => !isEasy(l));
  const visibleRegular = filteredRegular.slice(0, FREE_LIMIT);
  const lockedRegular = filteredRegular.slice(FREE_LIMIT, FREE_LIMIT + 6);
  const more = Math.max(0, filteredRegular.length - FREE_LIMIT);

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "48px 2.5rem 72px" }}>
      <div style={{ marginBottom: 36 }}>
        <div className="section-title" style={{ marginBottom: 6 }}>All Listings</div>
        <p style={{ color: "var(--muted2)", fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}>
          {listings.length} total · Updated daily · Expired listings auto-removed
        </p>
      </div>

      <div className="cat-pills">
        {CATEGORIES.filter(c => (counts[c.value] || 0) > 0).map(c => (
          <button
            key={c.value}
            className={`cat-pill ${c.value === EASY_APP_CATEGORY ? "easy-pill" : ""} ${category === c.value ? "active" : ""}`}
            onClick={() => setCategory(c.value)}
          >
            {c.icon} {c.label} {counts[c.value] ? `(${counts[c.value]})` : ""}
          </button>
        ))}
      </div>

      <div className="filters-row">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input className="search-box" type="text" placeholder="Search by title, company, or keyword..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={location} onChange={e => setLocation(e.target.value)}>
          <option value="">All Locations</option>
          <option value="Remote">Remote Only</option>
          <option value="In-Person">In-Person Only</option>
        </select>
        <select className="filter-select" value={minPay} onChange={e => setMinPay(e.target.value)}>
          <option value="">Any Pay</option>
          <option value="10">$10+</option>
          <option value="25">$25+</option>
          <option value="50">$50+</option>
          <option value="100">$100+</option>
          <option value="200">$200+</option>
        </select>
        <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="score">Best Value</option>
          <option value="pay">Highest Pay</option>
          <option value="new">Newest First</option>
        </select>
      </div>

      <div className="results-count">
        Showing {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
        {filteredEasy.length > 0 && ` · ${filteredEasy.length} free Easy Application`}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div className="empty-state"><h3>No listings match your filters</h3><p>Try adjusting your search or clearing filters.</p></div>
      ) : (
        <>
          {filteredEasy.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px", padding: "10px 16px", background: "var(--green-pale)", border: "1px solid var(--green-border)", borderRadius: 6 }}>
                <span style={{ fontSize: 13, color: "#166534", fontWeight: 600 }}>⚡ Easy Application — Free to All Users</span>
                <span style={{ fontSize: 11, color: "#16A34A" }}>No Pro membership needed</span>
              </div>
              {filteredEasy.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}
              {filteredRegular.length > 0 && <div style={{ height: 1, background: "var(--border)", margin: "24px 0" }} />}
            </>
          )}
          {visibleRegular.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}
          {lockedRegular.map((l, i) => <ListingCard key={l.id} listing={l} index={FREE_LIMIT + i} isLocked onUpgrade={() => onNavigate("pricing")} />)}
          {more > 0 && (
            <div className="unlock-cta">
              <h3>Unlock {more} More Listings</h3>
              <p>Pro members get unlimited access, daily email digests, advanced filters, and early access every morning.</p>
              <button className="btn-gold" onClick={() => onNavigate("pricing")}>Start 7-Day Free Trial — $9/mo</button>
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
      tier: "Free", amount: 0, popular: false,
      desc: "Get started immediately. Easy Application listings are always free for everyone.",
      btn: "Get Started Free", btnStyle: "plan-btn-outline",
      features: [
        { yes: true,  text: "All Easy Application listings (⚡ always free)" },
        { yes: true,  text: "5 standard listings per day" },
        { yes: true,  text: "Browse all categories" },
        { yes: false, text: "AI Top Picks feed", dim: true },
        { yes: false, text: "Advanced filters", dim: true },
        { yes: false, text: "Daily 8 AM email digest", dim: true },
        { yes: false, text: "Taste test & medical listings", dim: true },
      ],
    },
    {
      tier: "Pro", amount: 9, popular: true,
      desc: "Full access to every listing. The best way to find high-paying gigs consistently.",
      btn: "Start 7-Day Free Trial", btnStyle: "plan-btn-dark",
      features: [
        { yes: true, text: "Everything in Free" },
        { yes: true, text: "Unlimited listings — all categories" },
        { yes: true, text: "AI-curated Top Picks daily" },
        { yes: true, text: "Full descriptions + direct apply links" },
        { yes: true, text: "Advanced pay & location filters" },
        { yes: true, text: "Daily email digest at 8 AM" },
        { yes: true, text: "Taste test, medical & specialty listings" },
      ],
    },
    {
      tier: "Elite", amount: 19, popular: false,
      desc: "For serious earners who want every edge — SMS alerts, early access, and personal matching.",
      btn: "Start 7-Day Free Trial", btnStyle: "plan-btn-outline",
      features: [
        { yes: true, text: "Everything in Pro" },
        { yes: true, text: "Concierge profile matching" },
        { yes: true, text: "SMS alerts for $200+ opportunities" },
        { yes: true, text: "Early access — 6 AM feed (2hrs early)" },
        { yes: true, text: "Earnings tracker dashboard" },
        { yes: true, text: "Members-only Slack community" },
        { yes: true, text: "Monthly personalized opportunity report" },
      ],
    },
  ];

  return (
    <>
      <div className="pricing-hero">
        <h2>Simple, Transparent Pricing</h2>
        <p>Easy Application listings are always free. Upgrade to Pro to unlock everything and maximize your earnings.</p>
      </div>
      <div className="pricing-grid">
        {plans.map(plan => (
          <div key={plan.tier} className={`plan ${plan.popular ? "popular" : ""}`}>
            {plan.popular && <div className="popular-pill">Most Popular</div>}
            <div className="plan-tier">{plan.tier}</div>
            <div className="plan-price-wrap">
              <span className="plan-dollar">$</span>
              <span className="plan-amount">{plan.amount}</span>
              <span className="plan-period">/mo</span>
            </div>
            <div className="plan-desc">{plan.desc}</div>
            <ul className="plan-feats">
              {plan.features.map((f, i) => (
                <li key={i}>
                  <span className={f.yes ? "feat-yes" : "feat-no"}>✦</span>
                  <span className={f.dim ? "feat-dim" : ""}>{f.text}</span>
                </li>
              ))}
            </ul>
            <button className={`plan-btn ${plan.btnStyle}`} onClick={() => alert("Stripe checkout — coming soon!")}>
              {plan.btn}
            </button>
          </div>
        ))}
      </div>
      <div className="guarantee">
        <h3>30-Day Money-Back Guarantee</h3>
        <p>If you don't earn more than your subscription cost within 30 days, we'll refund every penny — no questions asked.</p>
      </div>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [initCat, setInitCat] = useState("");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("Listings")
        .select("*")
        .eq("Status", "active")
        .order("Score", { ascending: false });
      if (error) throw error;
      setListings(data || []);
    } catch (err) {
      console.error("Supabase error:", err.message);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  function navigate(dest, cat = "") {
    setPage(dest);
    setInitCat(cat);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <nav className="nav">
        <button className="logo" onClick={() => navigate("home")}>
          <span className="logo-study">Study</span>
          <span className="logo-cash">Cash</span>
          <span className="logo-board">Board</span>
          <span className="logo-tag">Paid Research Directory</span>
        </button>
        <div className="nav-center">
          <button className={`nav-link ${page === "home" ? "active" : ""}`} onClick={() => navigate("home")}>Home</button>
          <button className={`nav-link ${page === "listings" ? "active" : ""}`} onClick={() => navigate("listings")}>Browse Gigs</button>
          <button className={`nav-link ${page === "pricing" ? "active" : ""}`} onClick={() => navigate("pricing")}>Pricing</button>
        </div>
        <div className="nav-right">
          <button className="nav-sign-in" onClick={() => alert("Auth coming soon!")}>Sign In</button>
          <button className="nav-cta" onClick={() => navigate("pricing")}>Get Pro Access</button>
        </div>
      </nav>

      {page === "home"     && <HomePage     listings={listings} loading={loading} onNavigate={navigate} />}
      {page === "listings" && <ListingsPage listings={listings} loading={loading} onNavigate={navigate} initialCategory={initCat} />}
      {page === "pricing"  && <PricingPage />}

      <footer className="footer">
        <div className="footer-logo">
          <span className="s">Study</span><span className="c">Cash</span><span className="b">Board</span>
        </div>
        <div className="footer-links">
          <button className="footer-link" onClick={() => navigate("home")}>Home</button>
          <button className="footer-link" onClick={() => navigate("listings")}>Listings</button>
          <button className="footer-link" onClick={() => navigate("pricing")}>Pricing</button>
          <button className="footer-link">Privacy</button>
          <button className="footer-link">Terms</button>
        </div>
        <div className="footer-copy">© 2026 StudyCashBoard</div>
      </footer>
    </>
  );
}
