import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// Vercel Analytics — tracks visits invisibly, only visible in your Vercel dashboard
// Install once: npm install @vercel/analytics
// Then enable in Vercel dashboard → Analytics tab
let Analytics = null;
try {
  // Will work once @vercel/analytics is installed
  Analytics = require("@vercel/analytics/react").Analytics;
} catch(e) {
  // Not installed yet — no-op
}

const supabase = createClient(
  "https://astgazboqpwhcuyemshx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzdGdhemJvcXB3aGN1eWVtc2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzUyMDAsImV4cCI6MjA5Mzg1MTIwMH0.9ZKI3MaZbJSWSm2QC2jOETrhGTiUETcvmZW4PCJWyk8"
);

const FREE_LIMIT = 5;
const EASY_CAT = "Easy Application";
const EASY_LABEL = "Quick Wins";
const QUICK_WINS_MAX_PAY = 30;  // Free tier cap — listings above this are Pro only

const CATEGORIES = [
  { label: "All Listings",       icon: "✦",  value: "",                   color: "#B8860B" },
  { label: "Quick Wins",         icon: "⚡",  value: "Easy Application",   color: "#16A34A" },
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

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --gold:        #B8860B;
    --gold-bright: #D4A017;
    --gold-pale:   #FBF5E6;
    --gold-border: #E8D5A0;
    --cream:       #FDFAF4;
    --cream2:      #F5EFE0;
    --dark:        #1A1A1A;
    --dark2:       #2C2C2C;
    --mid:         #555555;
    --muted:       #888888;
    --muted2:      #AAAAAA;
    --border:      #E0D8C8;
    --border2:     #CEC5B0;
    --white:       #FFFFFF;
    --green:       #16A34A;
    --green-pale:  #F0FDF4;
    --green-border:#BBF7D0;
    --ff: 'Playfair Display', Georgia, serif;
    --fs: 'DM Sans', system-ui, sans-serif;
  }

  html { scroll-behavior: smooth; }
  body {
    font-family: var(--fs);
    background: var(--cream);
    color: var(--dark);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  /* ── NAV ── */
  .nav {
    background: var(--dark);
    padding: 0 2.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 62px;
    position: sticky;
    top: 0;
    z-index: 200;
  }
  .logo {
    display: flex;
    align-items: baseline;
    gap: 0;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
  }
  .logo-s { font-family: var(--ff); font-size: 1.7rem; font-weight: 600; color: #FFFFFF; letter-spacing: -0.01em; text-shadow: 0 0 24px rgba(255,255,255,0.2); }
  .logo-c { font-family: var(--ff); font-size: 1.7rem; font-weight: 600; color: #F0C040; letter-spacing: -0.01em; text-shadow: 0 0 24px rgba(240,192,64,0.5); }
  .logo-b { font-family: var(--ff); font-size: 1.7rem; font-weight: 400; color: #BBBBBB; letter-spacing: -0.01em; }
  .logo-sep { width: 1px; height: 20px; background: #444; margin: 0 14px; align-self: center; }
  .logo-tag { font-size: 10px; color: #D4A017; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600; }
  .nav-links { display: flex; gap: 2rem; align-items: center; }
  .nav-link {
    color: #EEEEEE;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: color 0.2s;
    background: none;
    border: none;
    font-family: var(--fs);
    font-weight: 700;
    padding: 0;
  }
  .nav-link:hover, .nav-link.active { color: #F0C040; }
  .nav-right { display: flex; gap: 10px; align-items: center; }
  .nav-signin {
    background: transparent;
    color: #EEEEEE;
    border: 1.5px solid #666;
    padding: 7px 16px;
    font-family: var(--fs);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.06em;
    transition: all 0.2s;
  }
  .nav-signin:hover { color: #fff; border-color: #F0C040; background: rgba(240,192,64,0.12); }
  .nav-cta {
    background: #D4A017;
    color: #1A1A1A;
    border: none;
    padding: 8px 20px;
    font-family: var(--fs);
    font-size: 11px;
    font-weight: 600;
    border-radius: 3px;
    cursor: pointer;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: all 0.2s;
  }
  .nav-cta:hover { background: #E8B820; }

  /* ── EASY BANNER ── */
  .easy-banner {
    background: #ECFDF5;
    border-bottom: 1px solid #A7F3D0;
    padding: 11px 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }
  .easy-banner-text { font-size: 13px; color: #065F46; font-weight: 500; }
  .easy-banner-btn {
    background: var(--green);
    color: #fff;
    border: none;
    padding: 6px 16px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 3px;
    cursor: pointer;
    font-family: var(--fs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    transition: background 0.2s;
  }
  .easy-banner-btn:hover { background: #15803D; }

  /* ── HERO ── */
  .hero {
    background: var(--cream);
    padding: 36px 2rem 32px;
    text-align: center;
    border-bottom: 1px solid var(--border);
    position: relative;
  }
  .hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(184,134,11,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  .hero-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--gold);
    font-weight: 600;
    margin-bottom: 1rem;
    padding: 6px 16px;
    border: 1px solid var(--gold-border);
    border-radius: 100px;
    background: var(--gold-pale);
  }
  .hero-dot { width: 5px; height: 5px; background: var(--gold-bright); border-radius: 50%; animation: blink 2s infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
  .hero h1 {
    font-family: var(--ff);
    font-size: clamp(1.8rem, 3.5vw, 2.6rem);
    line-height: 1.15;
    color: var(--dark);
    margin-bottom: 0.8rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .hero h1 em {
    color: var(--gold);
    font-style: italic;
    font-weight: 400;
  }
  .hero-sub {
    font-size: 0.92rem;
    color: var(--mid);
    line-height: 1.7;
    max-width: 540px;
    margin: 0 auto 1.4rem;
    font-weight: 300;
  }
  .hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .btn-dark {
    background: var(--dark);
    color: #fff;
    border: none;
    padding: 14px 30px;
    font-family: var(--fs);
    font-size: 13px;
    font-weight: 600;
    border-radius: 3px;
    cursor: pointer;
    letter-spacing: 0.04em;
    transition: all 0.2s;
  }
  .btn-dark:hover { background: var(--dark2); transform: translateY(-1px); }
  .btn-outline-dark {
    background: transparent;
    color: var(--dark);
    border: 1.5px solid var(--dark);
    padding: 14px 30px;
    font-family: var(--fs);
    font-size: 13px;
    font-weight: 500;
    border-radius: 3px;
    cursor: pointer;
    letter-spacing: 0.04em;
    transition: all 0.2s;
  }
  .btn-outline-dark:hover { background: var(--dark); color: #fff; }

  /* ── STATS BAR ── */
  .stats-bar {
    background: var(--dark);
    padding: 24px 2rem;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0;
  }
  .stat { text-align: center; padding: 12px 8px; border-right: 1px solid #333; }
  .stat:last-child { border-right: none; }
  .stat-num { font-family: var(--ff); font-size: 2.2rem; color: #F0C040; display: block; line-height: 1; font-weight: 600; text-shadow: 0 0 20px rgba(240,192,64,0.25); }
  .stat-label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #CCCCCC; margin-top: 6px; display: block; font-weight: 600; }

  /* ── EASY SECTION ── */
  .easy-section { background: #F0FDF4; border-top: 1px solid #BBF7D0; border-bottom: 1px solid #BBF7D0; padding: 52px 2.5rem; }
  .easy-inner { max-width: 1140px; margin: 0 auto; }
  .easy-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
  .easy-title { font-family: var(--ff); font-size: 1.9rem; font-weight: 600; color: #14532D; }
  .easy-sub-text { font-size: 13px; color: #166534; margin-bottom: 24px; line-height: 1.65; font-weight: 400; }
  .sec-link { font-size: 11px; color: var(--green); letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; background: none; border: none; font-family: var(--fs); font-weight: 600; }
  .sec-link:hover { text-decoration: underline; }

  /* ── SECTION ── */
  .section { padding: 60px 2.5rem; max-width: 1140px; margin: 0 auto; }
  .sec-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 1.8rem; }
  .sec-title { font-family: var(--ff); font-size: 1.9rem; font-weight: 600; color: var(--dark); }
  .sec-action { font-size: 11px; color: var(--gold); letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; background: none; border: none; font-family: var(--fs); font-weight: 600; }
  .sec-action:hover { text-decoration: underline; }

  /* ── CATEGORY GRID ── */
  .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .cat-card {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 28px 16px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
  }
  .cat-card:hover { border-color: var(--gold-border); background: var(--gold-pale); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(184,134,11,0.08); }
  .cat-card.easy-cat { border-color: #BBF7D0; background: #F0FDF4; }
  .cat-card.easy-cat:hover { border-color: var(--green); background: #DCFCE7; }
  .cat-icon { font-size: 36px; margin-bottom: 12px; display: block; }
  .cat-name { font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--dark); line-height: 1.4; }
  .cat-count { font-size: 11px; color: var(--muted); margin-top: 5px; }
  .cat-free { font-size: 9px; color: var(--green); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 4px; }

  /* ── CATEGORY PILLS ── */
  .pills { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 1.4rem; }
  .pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: 100px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--mid);
    transition: all 0.18s;
    font-family: var(--fs);
    text-transform: uppercase;
  }
  .pill:hover { border-color: var(--gold-border); color: var(--dark); }
  .pill.active { background: var(--dark); color: #D4A017; border-color: var(--dark); }
  .pill.easy-pill { border-color: #BBF7D0; color: var(--green); background: #F0FDF4; }
  .pill.easy-pill:hover { background: #DCFCE7; }
  .pill.easy-pill.active { background: var(--green); color: #fff; border-color: var(--green); }

  /* ── FILTERS ── */
  .filter-row { display: flex; gap: 10px; margin-bottom: 1.2rem; flex-wrap: wrap; }
  .search-wrap { flex: 1; min-width: 240px; position: relative; }
  .search-ico { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--muted2); font-size: 13px; pointer-events: none; }
  .search-input {
    width: 100%;
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 10px 14px 10px 36px;
    font-family: var(--fs);
    font-size: 13px;
    outline: none;
    color: var(--dark);
    transition: border-color 0.2s;
  }
  .search-input:focus { border-color: var(--gold-bright); }
  .search-input::placeholder { color: var(--muted2); }
  .fselect {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 10px 14px;
    font-family: var(--fs);
    font-size: 13px;
    color: var(--dark);
    cursor: pointer;
    outline: none;
    transition: border-color 0.2s;
  }
  .fselect:focus { border-color: var(--gold-bright); }
  .results-count { font-size: 12px; color: var(--muted); margin-bottom: 1rem; }

  /* ── LISTING CARD ── */
  .card {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 22px 26px;
    margin-bottom: 10px;
    display: grid;
    grid-template-columns: 1fr 140px;
    gap: 20px;
    align-items: start;
    transition: all 0.2s;
    position: relative;
  }
  .card:hover { border-color: var(--gold-border); box-shadow: 0 4px 20px rgba(184,134,11,0.08); transform: translateY(-1px); }
  .card.top { border-left: 3px solid var(--gold-bright); }
  .card.easy { border-left: 3px solid var(--green); }
  .card.easy:hover { border-color: #86EFAC; box-shadow: 0 4px 20px rgba(22,163,74,0.07); }
  .card.locked { cursor: pointer; }
  .card.locked:hover { border-color: var(--border2); box-shadow: 0 2px 8px rgba(0,0,0,0.05); transform: none; }

  .badges { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 9px; }
  .bdg {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 3px;
  }
  .bdg-hot  { background: var(--gold-pale); color: var(--gold); border: 1px solid var(--gold-border); }
  .bdg-easy { background: var(--green); color: #fff; }
  .bdg-free { background: #F0FDF4; color: var(--green); border: 1px solid #BBF7D0; }
  .bdg-new  { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
  .bdg-pro  { background: var(--dark); color: #D4A017; }
  .bdg-cat  { padding: 3px 9px; border-radius: 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  .bdg-tag  { background: #F5F5F2; color: var(--mid); padding: 3px 8px; border-radius: 3px; font-size: 9px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }

  .card-title { font-family: var(--ff); font-size: 1.1rem; color: var(--dark); margin-bottom: 6px; font-weight: 600; line-height: 1.3; }
  .card-desc { font-size: 12.5px; color: var(--mid); line-height: 1.65; margin-bottom: 11px; max-width: 580px; font-weight: 300; }
  .card-meta { display: flex; gap: 14px; flex-wrap: wrap; }
  .meta-item { font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 4px; font-weight: 500; }

  .pay-col { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
  .pay-amt { font-family: var(--ff); font-size: 1.7rem; color: var(--dark); line-height: 1; font-weight: 600; }
  .pay-max { font-size: 1rem; color: var(--muted2); }
  .pay-lbl { font-size: 10px; color: var(--muted2); letter-spacing: 0.05em; text-transform: uppercase; }
  .pay-rate { font-size: 10px; color: var(--gold); font-weight: 600; }
  .pay-rate-g { font-size: 10px; color: var(--green); font-weight: 600; }

  .apply-btn {
    display: block;
    width: 100%;
    margin-top: 6px;
    background: var(--dark);
    color: #fff;
    border: none;
    padding: 9px 16px;
    font-size: 10px;
    border-radius: 3px;
    cursor: pointer;
    font-family: var(--fs);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-align: center;
    transition: all 0.2s;
  }
  .apply-btn:hover { background: var(--gold); color: var(--dark); }
  .apply-btn-g { background: var(--green); }
  .apply-btn-g:hover { background: #15803D; color: #fff; }
  .unlock-btn {
    display: block;
    width: 100%;
    margin-top: 6px;
    background: transparent;
    color: var(--muted);
    border: 1px solid var(--border);
    padding: 9px 16px;
    font-size: 10px;
    border-radius: 3px;
    cursor: pointer;
    font-family: var(--fs);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transition: all 0.2s;
  }
  .unlock-btn:hover { background: var(--dark); color: #D4A017; border-color: var(--dark); }
  .blurred { filter: blur(5px); user-select: none; pointer-events: none; }

  /* ── LOADING / EMPTY ── */
  .loading { text-align: center; padding: 80px 20px; }
  .spinner { width: 34px; height: 34px; border: 2px solid var(--border); border-top-color: var(--gold-bright); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-txt { font-size: 13px; color: var(--muted); font-weight: 500; }
  .empty { text-align: center; padding: 64px 20px; background: var(--white); border: 1px solid var(--border); border-radius: 8px; }
  .empty h3 { font-family: var(--ff); font-size: 1.4rem; font-weight: 600; margin-bottom: 10px; color: var(--dark); }
  .empty p { font-size: 13px; color: var(--muted); line-height: 1.7; }

  /* ── UNLOCK CTA ── */
  .unlock-cta {
    background: var(--dark);
    border-radius: 8px;
    padding: 48px 40px;
    text-align: center;
    margin-top: 12px;
  }
  .unlock-cta h3 { font-family: var(--ff); font-size: 2rem; font-weight: 600; color: #fff; margin-bottom: 10px; }
  .unlock-cta p { font-size: 13px; color: #888; margin-bottom: 28px; line-height: 1.7; max-width: 400px; margin-left: auto; margin-right: auto; }

  /* ── HOW IT WORKS ── */
  .dark-section { background: var(--dark); padding: 64px 2.5rem; border-top: 1px solid #222; border-bottom: 1px solid #222; }
  .dark-inner { max-width: 1140px; margin: 0 auto; }
  .dark-title { font-family: var(--ff); font-size: 1.9rem; font-weight: 600; color: #fff; margin-bottom: 2rem; }
  .how-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
  .how-card { background: #222; border: 1px solid #333; border-radius: 8px; padding: 28px 22px; }
  .how-n { font-family: var(--ff); font-size: 2.8rem; color: #444; font-weight: 600; line-height: 1; margin-bottom: 12px; }
  .how-t { font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #fff; }
  .how-d { font-size: 13px; color: #888; line-height: 1.65; font-weight: 300; }

  /* ── TESTIMONIALS ── */
  .testi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
  .testi-card { background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 26px 22px; }
  .testi-stars { color: var(--gold-bright); font-size: 13px; margin-bottom: 12px; letter-spacing: 2px; }
  .testi-text { font-family: var(--ff); font-size: 1rem; line-height: 1.65; color: var(--dark); margin-bottom: 14px; font-style: italic; }
  .testi-author { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .testi-earned { font-size: 11px; color: var(--gold); font-weight: 600; margin-top: 3px; }

  /* ── PRICING ── */
  .pricing-wrap { padding: 72px 2rem 80px; }
  .pricing-head { text-align: center; max-width: 640px; margin: 0 auto 56px; }
  .pricing-head h2 { font-family: var(--ff); font-size: 2.6rem; font-weight: 600; color: var(--dark); margin-bottom: 1rem; }
  .pricing-head p { color: var(--mid); font-size: 1rem; line-height: 1.8; font-weight: 300; }
  .plan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 16px; max-width: 920px; margin: 0 auto 72px; }
  .plan { background: var(--white); border: 1px solid var(--border); border-radius: 8px; padding: 36px 28px; position: relative; display: flex; flex-direction: column; }
  .plan.popular { border: 2px solid var(--gold-bright); background: var(--gold-pale); }
  .plan-badge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); background: var(--gold-bright); color: var(--dark); font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; padding: 5px 18px; border-radius: 100px; white-space: nowrap; }
  .plan-tier { font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; font-weight: 600; }
  .plan-price { display: flex; align-items: baseline; gap: 2px; margin-bottom: 6px; }
  .plan-cur { font-family: var(--ff); font-size: 1.3rem; color: var(--dark); }
  .plan-amt { font-family: var(--ff); font-size: 3rem; color: var(--dark); line-height: 1; }
  .plan-per { font-size: 13px; color: var(--muted); margin-left: 4px; font-weight: 300; }
  .plan-desc { font-size: 12.5px; color: var(--mid); margin: 10px 0 26px; line-height: 1.7; font-weight: 300; }
  .plan-feats { list-style: none; margin-bottom: 26px; flex: 1; }
  .plan-feats li { font-size: 12.5px; padding: 8px 0; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 9px; color: var(--dark); line-height: 1.45; }
  .plan-feats li:last-child { border-bottom: none; }
  .fy { color: var(--gold-bright); flex-shrink: 0; font-weight: 700; margin-top: 1px; }
  .fn { color: #D0C8B8; flex-shrink: 0; font-weight: 700; margin-top: 1px; }
  .fd { color: #C0B8A8; }
  .plan-btn { width: 100%; padding: 13px; border-radius: 4px; font-family: var(--fs); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; margin-top: auto; }
  .plan-btn-dark { background: var(--dark); color: #fff; border: none; }
  .plan-btn-dark:hover { background: var(--dark2); }
  .plan-btn-out { background: transparent; color: var(--dark); border: 1.5px solid var(--dark); }
  .plan-btn-out:hover { background: var(--dark); color: #fff; }

  /* ── GUARANTEE ── */
  .guarantee { background: var(--dark); padding: 56px 2rem; text-align: center; }
  .guarantee h3 { font-family: var(--ff); font-size: 1.8rem; font-weight: 600; color: #D4A017; margin-bottom: 10px; }
  .guarantee p { font-size: 13px; color: #666; font-weight: 300; line-height: 1.7; max-width: 480px; margin: 0 auto; }

  /* ── FOOTER ── */
  .footer { background: #111; padding: 28px 2.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; border-top: 1px solid #1a1a1a; }
  .footer-logo { font-family: var(--ff); font-size: 1.1rem; }
  .fl-s { color: #fff; } .fl-c { color: #D4A017; } .fl-b { color: #555; }
  .footer-links { display: flex; gap: 2rem; }
  .footer-link { font-size: 11px; color: #555; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: color 0.2s; background: none; border: none; font-family: var(--fs); font-weight: 500; }
  .footer-link:hover { color: #D4A017; }
  .footer-copy { font-size: 11px; color: #444; letter-spacing: 0.06em; text-transform: uppercase; }
  /* Social sidebar on hero */
  .hero-social-bar {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 10;
  }
  .social-link {
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 50%;
    border: 1.5px solid var(--gold-border);
    color: var(--gold);
    font-size: 13px; font-weight: 700;
    cursor: pointer; transition: all 0.2s; text-decoration: none;
    background: var(--gold-pale);
    font-family: var(--fs);
  }
  .social-link:hover {
    border-color: var(--gold-bright);
    color: var(--dark);
    background: var(--gold-bright);
    transform: scale(1.12);
  }
  .social-link-label {
    font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--muted2); text-align: center; margin-top: 2px;
    font-family: var(--fs); display: block;
  }
  .social-item { display: flex; flex-direction: column; align-items: center; }
  /* Footer social (smaller, horizontal) */
  .footer-social-links { display: flex; gap: 10px; align-items: center; }
  .footer-social-link {
    display: flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: 50%;
    border: 1px solid #333; color: #555; font-size: 12px; font-weight: 700;
    cursor: pointer; transition: all 0.2s; text-decoration: none;
    background: none; font-family: var(--fs);
  }
  .footer-social-link:hover { border-color: #D4A017; color: #D4A017; }
  .divider { height: 1px; background: var(--border); max-width: 1140px; margin: 0 auto; }

  /* ── TWO PANEL LAYOUT ── */
  .two-panel-wrap {
    background: var(--cream2);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 48px 2.5rem;
  }
  .two-panel-inner {
    max-width: 1140px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  @media (max-width: 860px) {
    .two-panel-inner { grid-template-columns: 1fr; }
  }

  .panel-left, .panel-right {
    background: var(--white);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }
  .panel-left { border: 2px solid #BBF7D0; }
  .panel-right { border: 2px solid var(--gold-border); }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid var(--border);
  }
  .panel-left .panel-header { background: #F0FDF4; }
  .panel-right .panel-header { background: var(--gold-pale); }

  .panel-title-wrap { display: flex; align-items: center; gap: 10px; }
  .panel-icon-qw { font-size: 24px; }
  .panel-icon-tp { font-size: 24px; }
  .panel-title { font-family: var(--ff); font-size: 1.2rem; font-weight: 600; color: var(--dark); }
  .panel-sub { font-size: 11px; color: var(--muted); font-weight: 400; margin-top: 2px; letter-spacing: 0.02em; }

  .panel-see-all {
    font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; cursor: pointer;
    background: none; border: none; font-family: var(--fs);
    transition: opacity 0.2s;
  }
  .panel-see-all:hover { opacity: 0.7; }
  .panel-see-all.green { color: var(--green); }
  .panel-see-all.gold  { color: var(--gold); }

  .panel-list { flex: 1; padding: 8px 0; }
  .panel-empty { text-align: center; padding: 32px; font-size: 13px; color: var(--muted2); }

  /* Panel cards */
  .panel-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    cursor: pointer;
    transition: background 0.15s;
    border-bottom: 1px solid #F5F5F0;
  }
  .panel-card:last-child { border-bottom: none; }
  .panel-card:hover { background: #FAFAF8; }

  .qw-card:hover { background: #F0FDF4; }
  .tp-card:hover { background: var(--gold-pale); }
  .tp-featured { background: #FFFBF0; }

  .panel-card-body { flex: 1; min-width: 0; }
  .tp-badge {
    display: inline-block;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    background: var(--gold-pale); color: var(--gold);
    border: 1px solid var(--gold-border);
    padding: 2px 7px; border-radius: 2px;
    margin-bottom: 5px;
  }
  .panel-card-title {
    font-family: var(--ff);
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--dark);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 260px;
  }
  .panel-card-company { font-size: 11px; color: var(--muted2); margin-top: 2px; font-weight: 500; }
  .panel-card-meta { display: flex; gap: 10px; margin-top: 4px; }
  .panel-card-meta span { font-size: 10px; color: var(--muted2); }

  .panel-card-right { text-align: right; flex-shrink: 0; margin-left: 12px; }
  .panel-card-pay {
    font-family: var(--ff);
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--dark);
    line-height: 1;
  }
  .tp-pay { color: var(--gold); }

  .panel-card-btn {
    display: inline-block;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 2px;
    margin-top: 5px; cursor: pointer;
    transition: all 0.2s;
  }
  .qw-btn { background: var(--green); color: #fff; }
  .tp-btn { background: var(--dark); color: #fff; }
  .tp-btn:hover { background: var(--gold); color: var(--dark); }
  .qw-btn:hover { background: #15803D; }

  /* View all buttons */
  .panel-view-all {
    display: block;
    width: 100%;
    padding: 14px 20px;
    font-family: var(--fs);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-align: center;
    cursor: pointer;
    border: none;
    border-top: 1px solid var(--border);
    transition: all 0.2s;
  }
  .qw-view-all { background: #F0FDF4; color: var(--green); }
  .qw-view-all:hover { background: var(--green); color: #fff; }
  .tp-view-all { background: var(--gold-pale); color: var(--gold); }
  .tp-view-all:hover { background: var(--gold); color: var(--dark); }

  /* ── MOBILE ── */
  @media (max-width: 860px) {
    .two-panel-inner { grid-template-columns: 1fr; }
  }
  @media (max-width: 700px) {
    /* Nav */
    .nav { padding: 0 1rem; height: 56px; }
    .nav-links { gap: 0.8rem; }
    .nav-link { font-size: 10px; letter-spacing: 0.04em; }
    .nav-signin { display: none; }
    .logo-sep, .logo-tag { display: none; }
    .logo-s, .logo-c, .logo-b { font-size: 1.3rem; }
    .nav-cta { padding: 7px 14px; font-size: 10px; }

    /* Hero */
    .hero { padding: 28px 1.2rem 24px; }
    .hero h1 { font-size: 1.8rem; margin-bottom: 0.6rem; }
    .hero-sub { font-size: 0.85rem; margin-bottom: 1.2rem; }
    .hero-btns { flex-direction: column; align-items: center; gap: 8px; }
    .btn-dark, .btn-outline-dark { width: 100%; max-width: 300px; padding: 12px 24px; font-size: 13px; }

    /* Stats — 2x2 + 1 centered on mobile */
    .stats-bar { grid-template-columns: repeat(2, 1fr); }
    .stat { border-right: 1px solid #333; border-bottom: 1px solid #333; padding: 14px 8px; }
    .stat:nth-child(2) { border-right: none; }
    .stat:nth-child(4) { border-right: none; }
    .stat:nth-child(5) { border-bottom: none; grid-column: 1 / -1; border-right: none; }
    .stat-num { font-size: 1.8rem; }
    .stat-label { font-size: 9px; }

    /* Sections */
    .section { padding: 36px 1.2rem; }
    .sec-title { font-size: 1.5rem; }

    /* Category grid — 2 columns on mobile */
    .cat-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .cat-icon { font-size: 28px; margin-bottom: 8px; }
    .cat-name { font-size: 10px; }
    .cat-card { padding: 18px 10px; }

    /* Two panels stacked */
    .two-panel-wrap { padding: 24px 1.2rem; }

    /* Listing cards */
    .card { grid-template-columns: 1fr; padding: 16px; }
    .pay-col { text-align: left; align-items: flex-start; flex-direction: row; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .panel-card-title { max-width: 200px; font-size: 0.85rem; }

    /* How It Works */
    .dark-section { padding: 36px 1.2rem; }
    .how-grid { grid-template-columns: 1fr; gap: 12px; }

    /* Testimonials */
    .testi-grid { grid-template-columns: 1fr; }

    /* Pricing */
    .plan-grid { grid-template-columns: 1fr; padding: 0 1.2rem; }
    .pricing-head { padding: 40px 1.2rem 32px; }
    .pricing-head h2 { font-size: 1.8rem; }

    /* Footer */
    .footer { flex-direction: column; text-align: center; padding: 24px 1.2rem; gap: 16px; }
    .footer-links { justify-content: center; flex-wrap: wrap; gap: 1rem; }
    .hero-social-bar { display: none; }
    .footer-social-links { justify-content: center; }

    /* FAQ */
    .faq-page { padding: 36px 1.2rem 60px; }

    /* Contact form grid */
    .contact-grid { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 400px) {
    .nav-links { gap: 0.5rem; }
    .nav-link { font-size: 9px; }
    .hero h1 { font-size: 1.5rem; }
    .cat-grid { grid-template-columns: repeat(2, 1fr); }
  }`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function isEasy(l) {
  return l.Category === EASY_CAT ||
    (l.Category === "Online Survey" && (l.Pay || 0) >= 10 && (l.Pay || 0) <= 40);
}

// Quick Wins where pay_max > $30 are Pro-only — too valuable to give away free
// Lightster ($60/hr), Mindswarms ($50), dscout ($200), Validately ($100) all move to Pro
function isProQuickWin(l) {
  if (!isEasy(l)) return false;
  const payMax = l.Pay_Max || l.pay_max || l.Pay || l.pay || 0;
  return payMax > QUICK_WINS_MAX_PAY;
}

// ── Components ────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="loading">
      <div className="spinner" />
      <div className="loading-txt">Loading fresh listings...</div>
    </div>
  );
}

function ListingCard({ listing, index, isLocked, onUpgrade }) {
  const cat = CAT_MAP[listing.Category] || { color: "#888" };
  const easy = isEasy(listing);
  const isFeatured = !easy && (listing.Is_Featured || listing.Score >= 75 || index < 3);
  const isNew = !isFeatured && !easy && (new Date() - new Date(listing.created_at) < 86400000 * 2);
  const isRemote = listing.Location?.toLowerCase().includes("remote");

  if (isLocked) {
    return (
      <div className="card locked" onClick={onUpgrade}>
        <div className="blurred">
          <div className="badges">
            <span className="bdg bdg-pro">Pro</span>
            <span className="bdg-cat bdg" style={{ background: cat.color + "18", color: cat.color }}>{listing.Category}</span>
          </div>
          <div className="card-title">{listing.Title}</div>
          <div className="card-desc">{listing.Description || "Pro members only. Upgrade to view and apply."}</div>
          <div className="card-meta">
            <span className="meta-item">🏢 {listing.Company}</span>
            <span className="meta-item">⏱ {listing.Duration}</span>
          </div>
        </div>
        <div className="pay-col">
          <div className="pay-amt" style={{ filter: "blur(6px)", userSelect: "none" }}>${listing.Pay || "???"}</div>
          <button className="unlock-btn">🔒 Unlock</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${easy ? "easy" : isFeatured ? "top" : ""}`}>
      <div>
        <div className="badges">
          {easy && <span className="bdg bdg-easy">⚡ Easy Apply</span>}
          {easy && <span className="bdg bdg-free">Free to All</span>}
          {isFeatured && <span className="bdg bdg-hot">⭐ Top Pick</span>}
          {isNew && <span className="bdg bdg-new">New</span>}
          <span className="bdg-cat bdg" style={{ background: cat.color + "15", color: cat.color }}>{listing.Category}</span>
          {isRemote && <span className="bdg-tag">Remote</span>}
          {listing.Tags?.slice(0, 2).map(t => <span key={t} className="bdg-tag">{t}</span>)}
        </div>
        <div className="card-title">{listing.Title}</div>
        {listing.Description && <div className="card-desc">{listing.Description}</div>}
        <div className="card-meta">
          {listing.Company && <span className="meta-item">🏢 {listing.Company}</span>}
          {listing.Duration && <span className="meta-item">⏱ {listing.Duration}</span>}
          {listing.Location && <span className="meta-item">📍 {listing.Location}</span>}
        </div>
      </div>
      <div className="pay-col">
        <div>
          {listing.Pay
            ? <div className="pay-amt">${listing.Pay}{listing.Pay_Max && listing.Pay_Max !== listing.Pay && <span className="pay-max">–${listing.Pay_Max}</span>}</div>
            : <div className="pay-amt" style={{ fontSize: "1rem", color: "var(--muted)" }}>Varies</div>
          }
          <div className="pay-lbl">per session</div>
          {listing.Hourly_Rate && <div className={easy ? "pay-rate-g" : "pay-rate"}>~${listing.Hourly_Rate}/hr</div>}
        </div>
        <button
          className={`apply-btn ${easy ? "apply-btn-g" : ""}`}
          onClick={() => {
            const u = listing.Apply_URL || listing.apply_url ||
                      listing.Source_URL || listing.source_url;
            if (u) window.open(u, "_blank");
            else alert("Apply link not available — visit the company website directly.");
          }}
        >
          {listing.Tags?.includes("login-required") ? "Sign Up to Apply →" : "Apply Now →"}
        </button>
      </div>
    </div>
  );
}

// ── Pages ─────────────────────────────────────────────────────────────────────
function Home({ listings, loading, go, adminMode }) {
  const counts = {};
  listings.forEach(l => { const c = isEasy(l) ? EASY_CAT : l.Category; counts[c] = (counts[c] || 0) + 1; });
  const easyList = listings.filter(l => isEasy(l) && !isProQuickWin(l)).slice(0, 6);
  const topList  = listings.filter(l => !isEasy(l)).sort((a,b) => (b.Score||0)-(a.Score||0)).slice(0, 8);
  const withPay  = listings.filter(l => l.Pay);
  const avgPay   = withPay.length ? Math.round(withPay.reduce((s,l) => s+l.Pay,0)/withPay.length) : 127;

  return (
    <>
      <div className="hero">
        {/* Social sidebar — left side of hero */}
        <div className="hero-social-bar">
          <div className="social-item"><a className="social-link" href="https://facebook.com/StudyCashBoard" target="_blank" rel="noreferrer" title="Facebook">f</a><span className="social-link-label">FB</span></div>
          <div className="social-item"><a className="social-link" href="https://instagram.com/StudyCashBoard" target="_blank" rel="noreferrer" title="Instagram">◉</a><span className="social-link-label">IG</span></div>
          <div className="social-item"><a className="social-link" href="https://x.com/StudyCashBoard" target="_blank" rel="noreferrer" title="X">𝕏</a><span className="social-link-label">X</span></div>
          <div className="social-item"><a className="social-link" href="https://tiktok.com/@StudyCashBoard" target="_blank" rel="noreferrer" title="TikTok">♪</a><span className="social-link-label">TT</span></div>
          <div className="social-item"><a className="social-link" href="https://youtube.com/@StudyCashBoard" target="_blank" rel="noreferrer" title="YouTube">▶</a><span className="social-link-label">YT</span></div>
        </div>
        <div className="hero-eyebrow"><div className="hero-dot" /> Reviewed daily by our team</div>
        <h1>Get Paid to<br /><em>Share Your Opinion</em></h1>
        <p className="hero-sub">The most comprehensive directory of paid research opportunities — user interviews, focus groups, taste tests, mock trials, medical studies, and more.</p>
        <div className="hero-btns">
          <button className="btn-dark" onClick={() => go("listings")}>Browse All Listings</button>
          <button className="btn-outline-dark" onClick={() => go("pricing")}>View Membership Plans</button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat"><span className="stat-num">{listings.length}+</span><span className="stat-label">Active Listings</span></div>
        <div className="stat"><span className="stat-num">$30</span><span className="stat-label">Quick Wins Max</span></div>
        <div className="stat"><span className="stat-num">$500</span><span className="stat-label">Pro Top Payout</span></div>
        <div className="stat"><span className="stat-num">🇺🇸</span><span className="stat-label">USA Only</span></div>
        <div className="stat"><span className="stat-num">8AM</span><span className="stat-label">Daily Refresh</span></div>
      </div>

      {/* ── BROWSE BY CATEGORY ── */}
      <div className="section">
        <div className="sec-header">
          <div className="sec-title">Browse by Category</div>
          <button className="sec-action" onClick={() => go("listings")}>See all →</button>
        </div>
        <div className="cat-grid">
          {CATEGORIES.filter(c => c.value && counts[c.value] > 0).map(cat => (
            <div key={cat.value} className={`cat-card ${cat.value === EASY_CAT ? "easy-cat" : ""}`} onClick={() => go("listings", cat.value)}>
              <span className="cat-icon">{cat.icon}</span>
              <div className="cat-name">{cat.label}</div>
              <div className="cat-count">{counts[cat.value]} active</div>
              {cat.value === EASY_CAT && <div className="cat-free">Free to All</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── TWO PANEL SECTION ── */}
      <div className="two-panel-wrap">
        <div className="two-panel-inner">

          {/* LEFT: Quick Wins */}
          <div className="panel-left">
            <div className="panel-header">
              <div className="panel-title-wrap">
                <span className="panel-icon-qw">⚡</span>
                <div>
                  <div className="panel-title">Quick Wins</div>
                  <div className="panel-sub">Free for everyone · No experience needed</div>
                </div>
              </div>
              <button className="panel-see-all green" onClick={() => go("listings", EASY_CAT)}>See all →</button>
            </div>
            <div className="panel-list">
              {loading ? <Spinner /> : easyList.length === 0 ? (
                <div className="panel-empty">Quick Win listings coming soon!</div>
              ) : easyList.map((l, i) => (
                <div key={l.id} className="panel-card qw-card" onClick={() => {
                  const u = l.Apply_URL || l.apply_url || l.Source_URL || l.source_url;
                  if (u) window.open(u, "_blank");
                }}>
                  <div className="panel-card-body">
                    <div className="panel-card-title">{l.Title}</div>
                    <div className="panel-card-company">{l.Company}</div>
                    <div className="panel-card-meta">
                      {l.Duration && <span>⏱ {l.Duration}</span>}
                      <span>📍 Remote</span>
                    </div>
                  </div>
                  <div className="panel-card-right">
                    <div className="panel-card-pay">
                      {l.Pay ? `$${l.Pay}${l.Pay_Max && l.Pay_Max !== l.Pay ? `–$${l.Pay_Max}` : ""}` : "Free"}
                    </div>
                    <div className="panel-card-btn qw-btn">
                      {l.Tags?.includes("login-required") ? "Sign Up →" : "Apply →"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="panel-view-all qw-view-all" onClick={() => go("listings", EASY_CAT)}>
              View All {counts[EASY_CAT] || 0} Quick Win Listings →
            </button>
          </div>

          {/* RIGHT: Top Picks */}
          <div className="panel-right">
            <div className="panel-header">
              <div className="panel-title-wrap">
                <span className="panel-icon-tp">⭐</span>
                <div>
                  <div className="panel-title">Top Picks</div>
                  <div className="panel-sub">Highest paying · Expert-reviewed · Pro members</div>
                </div>
              </div>
              <button className="panel-see-all gold" onClick={() => go("listings")}>See all →</button>
            </div>
            <div className="panel-list">
              {loading ? <Spinner /> : topList.length === 0 ? (
                <div className="panel-empty">Top picks coming soon!</div>
              ) : topList.map((l, i) => (
                <div key={l.id} className={`panel-card tp-card ${i < 3 ? "tp-featured" : ""}`} onClick={() => go("listings")}>
                  <div className="panel-card-body">
                    {i < 3 && <span className="tp-badge">⭐ Top Pick</span>}
                    <div className="panel-card-title">{l.Title}</div>
                    <div className="panel-card-company">{l.Company}</div>
                    <div className="panel-card-meta">
                      {l.Duration && <span>⏱ {l.Duration}</span>}
                      <span>📍 {l.Location?.includes("Remote") ? "Remote" : l.State || "USA"}</span>
                    </div>
                  </div>
                  <div className="panel-card-right">
                    <div className="panel-card-pay tp-pay">
                      {l.Pay ? `$${l.Pay}${l.Pay_Max && l.Pay_Max !== l.Pay ? `–$${l.Pay_Max}` : ""}` : "Varies"}
                    </div>
                    <div className="panel-card-btn tp-btn">
                      {i < 5 ? "View →" : "🔒 Pro"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="panel-view-all tp-view-all" onClick={() => go("listings")}>
              Unlock All Listings with Pro →
            </button>
          </div>

        </div>
      </div>

      <div className="dark-section">
        <div className="dark-inner">
          <div className="dark-title">How It Works</div>
          <div className="how-grid">
            {[
              { n:"01", t:"We Scrape Daily", d:"We search 12+ sources every morning — Respondent, User Interviews, FocusGroups.org, taste test panels, mock jury firms, and more — so you never miss an opportunity." },
              { n:"02", t:"We Review Every Listing", d:"Our team reviews every listing for pay, legitimacy, and time commitment. Only the best opportunities make it to your feed — we do the research so you do not have to." },
              { n:"03", t:"Expired Listings Auto-Removed", d:"Listings that disappear from their source are automatically marked expired. You only ever see what's currently live and accepting applicants." },
              { n:"04", t:"Choose Your Level", d:"⚡ Quick Wins are free for everyone. Pro ($9/mo) unlocks all listings + daily email digest. Elite ($19/mo) adds SMS alerts for $200+ gigs, 6 AM early access, concierge matching, and an earnings tracker." },
            ].map(h => (
              <div key={h.n} className="how-card">
                <div className="how-n">{h.n}</div>
                <div className="how-t">{h.t}</div>
                <div className="how-d">{h.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ FRONT & CENTER: START EARNING NOW — REFERRAL PLATFORMS ══ */}
      <div style={{ background: "#0A1A0A", borderBottom: "1px solid #1A3A1A", padding: "52px 1.5rem" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.3)", borderRadius: 100, padding: "6px 16px", marginBottom: 14 }}>
              <span style={{ width: 6, height: 6, background: "#4ADE80", borderRadius: "50%", display: "inline-block", animation: "blink 2s infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#4ADE80" }}>No Subscription Needed — Start Today</span>
            </div>
            <div style={{ fontFamily: "var(--ff)", fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 600, color: "#FFFFFF", marginBottom: 8 }}>
              ⚡ Join These Platforms & Start Getting Paid Now
            </div>
            <p style={{ fontSize: 13, color: "#999", lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>
              The fastest ways to earn — free to join, no experience needed. We've verified every single one.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { name: "Survey Junkie", pay: "Up to $40/survey", badge: "🔥 Most Popular", badgeColor: "#EF4444", url: "https://www.surveyjunkie.com/register", desc: "Share opinions, cash via PayPal" },
              { name: "Swagbucks", pay: "$10 Signup Bonus", badge: "💰 Free Bonus", badgeColor: "#F59E0B", url: "https://www.swagbucks.com/p/register", desc: "Surveys, videos & shopping rewards" },
              { name: "InboxDollars", pay: "$5 Signup Bonus", badge: "💵 Free $5", badgeColor: "#16A34A", url: "https://www.inboxdollars.com/register", desc: "Get paid for surveys & emails" },
              { name: "Prolific", pay: "$6–$35/study", badge: "🎓 Academic Studies", badgeColor: "#6B3FA0", url: "https://app.prolific.com/register/participant", desc: "Short studies, avg $8–$12/hr" },
              { name: "UserTesting", pay: "$10 per test", badge: "⚡ Instant Tests", badgeColor: "#C05A10", url: "https://www.usertesting.com/be-a-user-tester", desc: "Test websites & apps from home" },
              { name: "Pinecone Research", pay: "Flat $3–$5 each", badge: "🔒 Limited Spots", badgeColor: "#0F6E8E", url: "https://www.pineconeresearch.com/register", desc: "Highly rated, apply while open" },
            ].map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noreferrer"
                style={{ display: "block", background: "#111", border: "1px solid #1F3A1F", borderRadius: 10, padding: "18px 16px", textDecoration: "none", transition: "all 0.2s" }}
                onMouseOver={e => { e.currentTarget.style.borderColor="#4ADE80"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.background="#0D2A0D"; }}
                onMouseOut={e => { e.currentTarget.style.borderColor="#1F3A1F"; e.currentTarget.style.transform="none"; e.currentTarget.style.background="#111"; }}
              >
                <div style={{ display:"inline-block", fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", padding:"3px 7px", borderRadius:3, background:p.badgeColor+"22", color:p.badgeColor, border:`1px solid ${p.badgeColor}44`, marginBottom:8 }}>{p.badge}</div>
                <div style={{ fontFamily:"var(--ff)", fontSize:"1rem", fontWeight:600, color:"#FFF", marginBottom:3 }}>{p.name}</div>
                <div style={{ fontSize:11, color:"#4ADE80", fontWeight:700, marginBottom:5 }}>{p.pay}</div>
                <div style={{ fontSize:11, color:"#777", lineHeight:1.5 }}>{p.desc}</div>
                <div style={{ marginTop:12, fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#4ADE80" }}>Join Free →</div>
              </a>
            ))}
          </div>
          <p style={{ textAlign:"center", fontSize:11, color:"#444", marginTop:16 }}>
            * Some links are referral links — costs you nothing extra and helps keep StudyCashBoard free 💚
          </p>
        </div>
      </div>

      {/* ══ FRONT & CENTER: FREE RESOURCES & DIGITAL DOWNLOADS ══ */}
      <div style={{ background: "var(--gold-pale)", borderBottom: "1px solid var(--gold-border)", padding: "52px 1.5rem" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(184,134,11,0.1)", border:"1px solid var(--gold-border)", borderRadius:100, padding:"6px 16px", marginBottom:14 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.18em", textTransform:"uppercase", color:"var(--gold)" }}>🎁 100% Free — No Credit Card Required</span>
            </div>
            <div style={{ fontFamily:"var(--ff)", fontSize:"clamp(1.5rem, 3vw, 2rem)", fontWeight:600, color:"var(--dark)", marginBottom:8 }}>
              Free Resources to Maximize Your Earnings
            </div>
            <p style={{ fontSize:13, color:"var(--mid)", lineHeight:1.7, maxWidth:500, margin:"0 auto" }}>
              Guides, checklists and tools to help you earn more — completely free. Join the waitlist below.
            </p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:16 }}>
            {[
              { icon:"📋", title:"Top 50 Paid Research Platforms", sub:"Free PDF Download", desc:"Every verified platform with direct links, average pay rates, and pro tips. Updated monthly.", tag:"Coming Soon", action:() => window.open("mailto:studycashboard@gmail.com?subject=Free PDF Waitlist","_blank") },
              { icon:"⚡", title:"Quick Wins Starter Guide", sub:"Free 5-Day Email Course", desc:"Earn your first $100 from paid research in 5 days. Exact platforms and screener tips included.", tag:"Coming Soon", action:() => window.open("mailto:studycashboard@gmail.com?subject=Quick Wins Course Waitlist","_blank") },
              { icon:"🎯", title:"High-Value Study Checklist", sub:"Free Printable", desc:"Know a good study when you see one. Pay-per-hour math, red flags, and how to get invited back.", tag:"Coming Soon", action:() => window.open("mailto:studycashboard@gmail.com?subject=Checklist Waitlist","_blank") },
              { icon:"🚀", title:"Your Product Here", sub:"Placeholder", desc:"Add your own digital product, course, or service. This card is yours to customize.", tag:"Add Yours", action:() => {} },
            ].map((p, i) => (
              <div key={i} style={{ background:"#fff", border:"1px solid var(--gold-border)", borderRadius:12, padding:"24px 20px", display:"flex", flexDirection:"column", boxShadow:"0 4px 16px rgba(184,134,11,0.06)" }}>
                <div style={{ fontSize:"2rem", marginBottom:10 }}>{p.icon}</div>
                <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", padding:"3px 8px", borderRadius:2, background:p.tag==="Coming Soon"?"rgba(184,134,11,0.1)":"#F5F5F0", color:p.tag==="Coming Soon"?"var(--gold)":"#888", border:`1px solid ${p.tag==="Coming Soon"?"var(--gold-border)":"#E0E0E0"}`, display:"inline-block", marginBottom:8 }}>{p.tag}</div>
                <div style={{ fontFamily:"var(--ff)", fontSize:"1.05rem", fontWeight:600, color:"var(--dark)", marginBottom:3, lineHeight:1.3 }}>{p.title}</div>
                <div style={{ fontSize:11, color:"var(--muted2)", fontWeight:500, marginBottom:8 }}>{p.sub}</div>
                <p style={{ fontSize:12.5, color:"var(--mid)", lineHeight:1.65, marginBottom:16, flex:1, fontWeight:300 }}>{p.desc}</p>
                <button onClick={p.action}
                  style={{ background:"var(--dark)", color:"#fff", border:"none", padding:"11px", borderRadius:4, fontFamily:"var(--fs)", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", width:"100%", transition:"background 0.2s" }}
                  onMouseOver={e=>e.currentTarget.style.background="var(--gold)"}
                  onMouseOut={e=>e.currentTarget.style.background="var(--dark)"}
                >{p.tag==="Coming Soon"?"Join Waitlist →":"Learn More →"}</button>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center", marginTop:24 }}>
            <button onClick={() => go("products")}
              style={{ background:"transparent", border:"1.5px solid var(--gold)", color:"var(--gold)", padding:"12px 28px", borderRadius:4, fontFamily:"var(--fs)", fontSize:12, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", transition:"all 0.2s" }}
              onMouseOver={e=>{e.currentTarget.style.background="var(--gold)";e.currentTarget.style.color="var(--dark)";}}
              onMouseOut={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="var(--gold)";}}
            >View All Free Resources →</button>
          </div>
        </div>
      </div>


      <div className="section">
        <div className="sec-header"><div className="sec-title">What Members Are Saying</div></div>
        <div className="testi-grid">
          {[
            { stars:"★★★★★", text:"I made $847 in my first month just from focus groups and user interviews I found here. The curation saves me so much time.", author:"Tanya M., Dallas TX", earned:"Earned $847 in Month 1" },
            { stars:"★★★★★", text:"The taste test listings alone paid for my subscription 10x over. I had no idea these opportunities existed near me.", author:"Marcus R., Houston TX", earned:"Earned $320 from taste tests" },
            { stars:"★★★★★", text:"I started with Quick Wins and made $60 my first week with zero experience. Now I do the bigger studies too.", author:"Priya K., Chicago IL", earned:"Earned $1,100+ total" },
          ].map((t,i) => (
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
        <h3>New listings reviewed every morning at 8 AM</h3>
        <p>Our team works every day to bring you fresh, verified opportunities. Outdated listings are removed so your time is never wasted.</p>
      </div>
    </>
  );
}

function Listings({ listings, loading, go, initCat, adminMode }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState(initCat || "");
  const [loc, setLoc] = useState("");
  const [state, setState] = useState("");
  const [minPay, setMinPay] = useState("");
  const [sort, setSort] = useState("score");

  useEffect(() => { setCat(initCat || ""); }, [initCat]);

  const counts = {};
  listings.forEach(l => { const c = isEasy(l) ? EASY_CAT : l.Category; counts[c] = (counts[c]||0)+1; });
  counts[""] = listings.length;

  const filtered = listings.filter(l => {
    const q = search.toLowerCase();
    const ec = isEasy(l) ? EASY_CAT : l.Category;
    if (q && !l.Title?.toLowerCase().includes(q) && !l.Company?.toLowerCase().includes(q) && !l.Description?.toLowerCase().includes(q)) return false;
    if (cat && ec !== cat) return false;
    if (loc === "Remote" && !l.Location?.toLowerCase().includes("remote")) return false;
    if (loc === "In-Person" && l.Location?.toLowerCase().includes("remote")) return false;
    if (state === "Remote" && !l.Location?.toLowerCase().includes("remote")) return false;
    if (state === "Nationwide") { /* show all */ }
    else if (state && state !== "" && l.State !== state && l.State !== "Nationwide" && l.State !== "Remote") return false;
    if (minPay && (l.Pay||0) < parseInt(minPay)) return false;
    return true;
  }).sort((a,b) => {
    if (sort === "score") return (b.Score||0)-(a.Score||0);
    if (sort === "pay")   return (b.Pay||0)-(a.Pay||0);
    if (sort === "new")   return new Date(b.created_at)-new Date(a.created_at);
    return 0;
  });

  // Free Quick Wins (≤$30) — always fully visible, unlimited
  // Pro Quick Wins ($30+) merged into fReg — they need Pro
  const fEasy        = filtered.filter(l => isEasy(l) && !isProQuickWin(l));
  const fProQW       = [];  // unused — merged into fReg below
  const fReg         = filtered.filter(l => !isEasy(l) || isProQuickWin(l));

  // FREE_LIMIT only applies to non-Quick-Wins listings
  // Quick Wins are ALWAYS fully shown — they're the free tier value prop
  const vis    = adminMode ? fReg : fReg.slice(0, FREE_LIMIT);
  const locked = adminMode ? [] : fReg.slice(FREE_LIMIT);  // show all locked, not just 6
  const more   = adminMode ? 0 : Math.max(0, fReg.length - FREE_LIMIT);

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "48px 2.5rem 72px" }}>
      <div style={{ marginBottom: 32 }}>
        <div className="sec-title" style={{ marginBottom: 6 }}>All Listings</div>
        <p style={{ color: "var(--muted)", fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}>
          {listings.length} total · Reviewed daily by our team · Outdated listings removed
        </p>
      </div>

      <div className="pills">
        {CATEGORIES.filter(c => (counts[c.value]||0) > 0).map(c => (
          <button
            key={c.value}
            className={`pill ${c.value === EASY_CAT ? "easy-pill" : ""} ${cat === c.value ? "active" : ""}`}
            onClick={() => setCat(c.value)}
          >
            {c.icon} {c.label}{counts[c.value] ? ` (${counts[c.value]})` : ""}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <div className="search-wrap">
          <span className="search-ico">🔍</span>
          <input className="search-input" type="text" placeholder="Search by title, company, or keyword..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="fselect" value={loc} onChange={e => setLoc(e.target.value)}>
          <option value="">All Locations</option>
          <option value="Remote">Remote Only</option>
          <option value="In-Person">In-Person Only</option>
        </select>
        <select className="fselect" value={state} onChange={e => setState(e.target.value)}>
          <option value="">All States</option>
          <option value="Remote">Remote / Online</option>
          <option value="Nationwide">Nationwide</option>
          <optgroup label="─────────────">
            <option value="AL">Alabama</option>
            <option value="AK">Alaska</option>
            <option value="AZ">Arizona</option>
            <option value="AR">Arkansas</option>
            <option value="CA">California</option>
            <option value="CO">Colorado</option>
            <option value="CT">Connecticut</option>
            <option value="DE">Delaware</option>
            <option value="FL">Florida</option>
            <option value="GA">Georgia</option>
            <option value="HI">Hawaii</option>
            <option value="ID">Idaho</option>
            <option value="IL">Illinois</option>
            <option value="IN">Indiana</option>
            <option value="IA">Iowa</option>
            <option value="KS">Kansas</option>
            <option value="KY">Kentucky</option>
            <option value="LA">Louisiana</option>
            <option value="ME">Maine</option>
            <option value="MD">Maryland</option>
            <option value="MA">Massachusetts</option>
            <option value="MI">Michigan</option>
            <option value="MN">Minnesota</option>
            <option value="MS">Mississippi</option>
            <option value="MO">Missouri</option>
            <option value="MT">Montana</option>
            <option value="NE">Nebraska</option>
            <option value="NV">Nevada</option>
            <option value="NH">New Hampshire</option>
            <option value="NJ">New Jersey</option>
            <option value="NM">New Mexico</option>
            <option value="NY">New York</option>
            <option value="NC">North Carolina</option>
            <option value="ND">North Dakota</option>
            <option value="OH">Ohio</option>
            <option value="OK">Oklahoma</option>
            <option value="OR">Oregon</option>
            <option value="PA">Pennsylvania</option>
            <option value="RI">Rhode Island</option>
            <option value="SC">South Carolina</option>
            <option value="SD">South Dakota</option>
            <option value="TN">Tennessee</option>
            <option value="TX">Texas</option>
            <option value="UT">Utah</option>
            <option value="VT">Vermont</option>
            <option value="VA">Virginia</option>
            <option value="WA">Washington</option>
            <option value="WV">West Virginia</option>
            <option value="WI">Wisconsin</option>
            <option value="WY">Wyoming</option>
            <option value="DC">Washington DC</option>
          </optgroup>
        </select>
        <select className="fselect" value={minPay} onChange={e => setMinPay(e.target.value)}>
          <option value="">Any Pay</option>
          <option value="10">$10+</option>
          <option value="25">$25+</option>
          <option value="50">$50+</option>
          <option value="100">$100+</option>
          <option value="200">$200+</option>
        </select>
        <select className="fselect" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="score">Best Value</option>
          <option value="pay">Highest Pay</option>
          <option value="new">Newest First</option>
        </select>
      </div>

      <div className="results-count">
        Showing {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
        {fEasy.length > 0 && ` · ${fEasy.length} free Quick Wins`}
      </div>

      {loading ? <Spinner /> : filtered.length === 0
        ? <div className="empty"><h3>No listings match your filters</h3><p>Try adjusting your search or clearing filters.</p></div>
        : (
          <>
            {/* Admin mode banner */}
            {adminMode && (
              <div style={{ background:"#1A1A2E", border:"1px solid #F0C040", borderRadius:6, padding:"10px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:16 }}>🔓</span>
                <span style={{ fontSize:13, color:"#F0C040", fontWeight:700 }}>ADMIN MODE — All listings unlocked for testing</span>
                <span style={{ fontSize:11, color:"#888", marginLeft:"auto" }}>Remove ?admin=true from URL to test user view</span>
              </div>
            )}

            {/* Free Quick Wins — always visible */}
            {fEasy.length > 0 && (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:10, margin:"0 0 12px", padding:"10px 16px", background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:6 }}>
                  <span style={{ fontSize:13, color:"#065F46", fontWeight:600 }}>⚡ Quick Wins — Free to All Users</span>
                  <span style={{ fontSize:11, color:"#16A34A" }}>No Pro membership needed · Max $30</span>
                </div>
                {fEasy.map((l,i) => <ListingCard key={l.id} listing={l} index={i} />)}
              </>
            )}

            {fEasy.length > 0 && fReg.length > 0 && (
              <div style={{ height:1, background:"var(--border)", margin:"24px 0" }} />
            )}

            {vis.map((l,i) => <ListingCard key={l.id} listing={l} index={i} />)}
            {locked.map((l,i) => <ListingCard key={l.id} listing={l} index={FREE_LIMIT+i} isLocked onUpgrade={() => go("pricing")} />)}
            {more > 0 && (
              <div className="unlock-cta">
                <h3>🔒 {more} More Listings Available</h3>
                <p>You're seeing {FREE_LIMIT} of {fReg.length} premium listings. Pro members get unlimited access to all focus groups, taste tests, medical studies, user interviews, and more — plus daily email digests and early access every morning.</p>
                <button className="btn-dark" style={{ marginTop:0 }} onClick={() => go("pricing")}>Unlock All {fReg.length} Listings — $9/mo</button>
              </div>
            )}
          </>
        )
      }
    </div>
  );
}

function Pricing() {
  const plans = [
    {
      tier:"Free", amt:0, popular:false,
      desc:"Get started immediately. Quick Wins are always free for everyone.",
      btn:"Get Started Free", btnCls:"plan-btn-out",
      feats:[
        {y:true,  t:"All Quick Wins (⚡ always free)"},
        {y:true,  t:"5 standard listings per day"},
        {y:true,  t:"Browse all categories"},
        {y:false, t:"AI Top Picks feed", d:true},
        {y:false, t:"Advanced filters", d:true},
        {y:false, t:"Daily 8 AM email digest", d:true},
        {y:false, t:"Taste test & medical listings", d:true},
      ],
    },
    {
      tier:"Pro", amt:9, popular:true,
      desc:"Full access to every listing. The best way to find high-paying gigs consistently.",
      btn:"Start 7-Day Free Trial", btnCls:"plan-btn-dark",
      feats:[
        {y:true, t:"Everything in Free"},
        {y:true, t:"Unlimited listings — all categories"},
        {y:true, t:"Expert-reviewed Top Picks daily"},
        {y:true, t:"Full descriptions + direct apply links"},
        {y:true, t:"Advanced pay & location filters"},
        {y:true, t:"Daily email digest at 8 AM"},
        {y:true, t:"Taste test, medical & specialty listings"},
      ],
    },
    {
      tier:"Elite", amt:19, popular:false,
      desc:"For serious earners who want every edge — SMS alerts, early access, and personal matching.",
      btn:"Start 7-Day Free Trial", btnCls:"plan-btn-out",
      feats:[
        {y:true, t:"Everything in Pro"},
        {y:true, t:"Concierge profile matching"},
        {y:true, t:"SMS alerts for $200+ opportunities"},
        {y:true, t:"Early access — 6 AM feed (2hrs early)"},
        {y:true, t:"Earnings tracker dashboard"},
        {y:true, t:"Members-only Slack community"},
        {y:true, t:"Monthly personalized earning report"},
      ],
    },
  ];

  return (
    <div className="pricing-wrap">
      <div className="pricing-head">
        <h2>Simple, Transparent Pricing</h2>
        <p>Quick Wins are always free. Upgrade to Pro to unlock everything and maximize your earnings.</p>
      </div>
      <div className="plan-grid">
        {plans.map(plan => (
          <div key={plan.tier} className={`plan ${plan.popular ? "popular" : ""}`}>
            {plan.popular && <div className="plan-badge">Most Popular</div>}
            <div className="plan-tier">{plan.tier}</div>
            <div className="plan-price">
              <span className="plan-cur">$</span>
              <span className="plan-amt">{plan.amt}</span>
              <span className="plan-per">/mo</span>
            </div>
            <div className="plan-desc">{plan.desc}</div>
            <ul className="plan-feats">
              {plan.feats.map((f,i) => (
                <li key={i}>
                  <span className={f.y ? "fy" : "fn"}>✦</span>
                  <span className={f.d ? "fd" : ""}>{f.t}</span>
                </li>
              ))}
            </ul>
            <button className={`plan-btn ${plan.btnCls}`} onClick={() => alert("Stripe checkout — coming soon!")}>
              {plan.btn}
            </button>
          </div>
        ))}
      </div>
      <div className="guarantee">
        <h3>30-Day Money-Back Guarantee</h3>
        <p>If you don't earn more than your subscription cost within 30 days, we'll refund every penny — no questions asked.</p>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
// ── FAQ Page ──────────────────────────────────────────────────────────────────
function FAQ({ go }) {
  const [open, setOpen] = useState(null);
  const faqs = [
    { q: "What is StudyCashBoard?", a: "StudyCashBoard is the most comprehensive directory of paid research opportunities in the USA. We scrape 12+ sources daily and curate the best user interviews, focus groups, taste tests, mock jury studies, medical research, and more — all in one place." },
    { q: "Is it really free to browse?", a: "Yes! Browsing is always free. Free members can see 5 standard listings per day plus all Quick Wins listings. Upgrade to Pro ($9/mo) to unlock everything including unlimited listings, daily email digests, and advanced filters." },
    { q: "What are Quick Wins?", a: "Quick Wins are short, beginner-friendly paid studies paying $1–$50 that require no experience. Think survey platforms like Survey Junkie, app testing with UserTesting, or mock jury panels like eJury. These are always free for all users — no Pro membership required." },
    { q: "How do I get paid?", a: "Payment is handled directly by the research company — not by StudyCashBoard. We connect you with the opportunity. Each listing shows how and when you get paid (PayPal, gift cards, bank transfer, etc.)." },
    { q: "How often are listings updated?", a: "Our team reviews and updates listings every morning at 8 AM CT from 12+ sources. Expired listings are automatically removed so you only see what's currently accepting applicants." },
    { q: "What's the difference between Pro and Elite?", a: "Pro ($9/mo) gives you unlimited listings, all categories, daily email digests, and advanced filters. Elite ($19/mo) adds SMS alerts for $200+ opportunities, 6 AM early access (2 hours before everyone else), concierge profile matching, an earnings tracker dashboard, and a members-only Slack community." },
    { q: "Are these opportunities legit?", a: "Yes. We only list opportunities from established research companies like Respondent, User Interviews, L&E Research, Fieldwork, Curion, and similar reputable firms. We never list opportunities that ask you to pay money, buy products, or provide sensitive personal information upfront." },
    { q: "Do I need experience to participate?", a: "No experience is needed for most listings — especially Quick Wins. For higher-paying studies ($100+), companies look for specific demographics or professional backgrounds, but no research experience is required." },
    { q: "Can I cancel my subscription anytime?", a: "Yes — cancel anytime with no penalty. You keep access until the end of your billing period. We also offer a 30-day money-back guarantee if you're not satisfied." },
    { q: "I have a question not listed here. How do I contact you?", a: "Reach us anytime at studycashboard@gmail.com. We typically respond within 24 hours." },
  ];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 2rem 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontFamily: "var(--ff)", fontSize: "2.4rem", fontWeight: 600, color: "var(--dark)", marginBottom: 12 }}>Frequently Asked Questions</div>
        <p style={{ color: "var(--mid)", fontSize: "1rem", lineHeight: 1.7 }}>Everything you need to know about StudyCashBoard.</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {faqs.map((f, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--fs)", fontSize: 14, fontWeight: 600, color: "var(--dark)", textAlign: "left", gap: 12 }}
            >
              {f.q}
              <span style={{ fontSize: 18, color: "var(--gold)", flexShrink: 0, fontWeight: 400 }}>{open === i ? "−" : "+"}</span>
            </button>
            {open === i && (
              <div style={{ padding: "0 22px 18px", fontSize: 13.5, color: "var(--mid)", lineHeight: 1.75, fontWeight: 300 }}>
                {f.a}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 48, padding: "32px", background: "var(--gold-pale)", border: "1px solid var(--gold-border)", borderRadius: 8 }}>
        <div style={{ fontFamily: "var(--ff)", fontSize: "1.3rem", fontWeight: 600, marginBottom: 8 }}>Still have questions?</div>
        <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 20 }}>We're happy to help. Reach out anytime.</p>
        <button className="btn-dark" onClick={() => go("contact")}>Contact Us →</button>
      </div>
    </div>
  );
}

// ── Contact Page ──────────────────────────────────────────────────────────────
function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "General Question", message: "" });

  function handleSubmit() {
    if (!form.name || !form.email || !form.message) {
      alert("Please fill in all fields.");
      return;
    }
    const mailto = `mailto:studycashboard@gmail.com?subject=${encodeURIComponent("[StudyCashBoard] " + form.subject + " — from " + form.name)}&body=${encodeURIComponent("Name: " + form.name + "\nEmail: " + form.email + "\n\n" + form.message)}`;
    window.open(mailto, "_blank");
    setSent(true);
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "56px 2rem 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontFamily: "var(--ff)", fontSize: "2.4rem", fontWeight: 600, color: "var(--dark)", marginBottom: 12 }}>Contact Us</div>
        <p style={{ color: "var(--mid)", fontSize: "1rem", lineHeight: 1.7 }}>We'd love to hear from you. We typically respond within 24 hours.</p>
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "36px 32px" }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>✅</div>
            <div style={{ fontFamily: "var(--ff)", fontSize: "1.5rem", fontWeight: 600, marginBottom: 8 }}>Message Ready to Send!</div>
            <p style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.7 }}>Your email client should have opened. If not, email us directly at <strong>studycashboard@gmail.com</strong></p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mid)", marginBottom: 6 }}>Your Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 4, fontFamily: "var(--fs)", fontSize: 13, outline: "none", color: "var(--dark)" }}
                  placeholder="Jane Smith" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mid)", marginBottom: 6 }}>Email Address</label>
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  type="email"
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 4, fontFamily: "var(--fs)", fontSize: 13, outline: "none", color: "var(--dark)" }}
                  placeholder="jane@email.com" />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mid)", marginBottom: 6 }}>Subject</label>
              <select value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 4, fontFamily: "var(--fs)", fontSize: 13, outline: "none", color: "var(--dark)", background: "#fff" }}>
                <option>General Question</option>
                <option>Partnership / Collaboration</option>
                <option>Report a Broken Link</option>
                <option>Suggest a Listing</option>
                <option>Billing / Subscription</option>
                <option>Press / Media Inquiry</option>
                <option>Other</option>
              </select>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mid)", marginBottom: 6 }}>Message</label>
              <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                rows={5}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 4, fontFamily: "var(--fs)", fontSize: 13, outline: "none", color: "var(--dark)", resize: "vertical" }}
                placeholder="How can we help you?" />
            </div>
            <button className="btn-dark" style={{ width: "100%", padding: 14, fontSize: 13 }} onClick={handleSubmit}>
              Send Message →
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted2)", marginTop: 14 }}>
              Or email us directly: <a href="mailto:studycashboard@gmail.com" style={{ color: "var(--gold)", textDecoration: "none", fontWeight: 600 }}>studycashboard@gmail.com</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Products / Free Resources Page ────────────────────────────────────────────
function Products({ go }) {
  const products = [
    {
      icon: "📋",
      title: "The Ultimate Paid Research Platform List",
      subtitle: "Free PDF Download",
      description: "A curated list of 50+ verified platforms where you can earn money sharing your opinions. Includes direct signup links, average pay rates, and tips for getting accepted.",
      tag: "Coming Soon",
      tagColor: "#B8860B",
      cta: "Join Waitlist",
      action: () => window.open("mailto:studycashboard@gmail.com?subject=Free Resource Waitlist", "_blank"),
    },
    {
      icon: "⚡",
      title: "Quick Wins Starter Guide",
      subtitle: "Free Email Course",
      description: "A 5-day email course showing you exactly how to earn your first $100 from paid research. Covers the fastest-paying platforms, how to write great screener answers, and how to qualify for more studies.",
      tag: "Coming Soon",
      tagColor: "#16A34A",
      cta: "Join Waitlist",
      action: () => window.open("mailto:studycashboard@gmail.com?subject=Quick Wins Course Waitlist", "_blank"),
    },
    {
      icon: "🎯",
      title: "High-Value Study Checklist",
      subtitle: "Free Printable",
      description: "Know exactly what to look for in a paid study before you apply. Covers pay-per-hour calculation, red flags to avoid, screener tips, and how to get invited back for more.",
      tag: "Coming Soon",
      tagColor: "#4338CA",
      cta: "Join Waitlist",
      action: () => window.open("mailto:studycashboard@gmail.com?subject=Checklist Waitlist", "_blank"),
    },
    {
      icon: "🚀",
      title: "[Your Digital Product Here]",
      subtitle: "Placeholder — Add Your Own",
      description: "This is a placeholder for your digital product — an ebook, course, template, or service. Update this card with your own offering and link.",
      tag: "Add Yours",
      tagColor: "#888",
      cta: "Learn More",
      action: () => {},
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 2rem 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontFamily: "var(--ff)", fontSize: "2.4rem", fontWeight: 600, color: "var(--dark)", marginBottom: 12 }}>Free Resources</div>
        <p style={{ color: "var(--mid)", fontSize: "1rem", lineHeight: 1.7, maxWidth: 540, margin: "0 auto" }}>
          Tools, guides, and resources to help you maximize your earnings from paid research. All free.
        </p>
      </div>

      {/* Referral Platforms Section */}
      <div style={{ background: "var(--gold-pale)", border: "1px solid var(--gold-border)", borderRadius: 12, padding: "32px", marginBottom: 40 }}>
        <div style={{ fontFamily: "var(--ff)", fontSize: "1.5rem", fontWeight: 600, color: "var(--dark)", marginBottom: 8 }}>
          ⚡ Start Earning Today — Join These Platforms Free
        </div>
        <p style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.7, marginBottom: 24 }}>
          These are the fastest ways to start earning. Sign up through our links below — it costs you nothing extra and helps support StudyCashBoard.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {[
            { name: "Survey Junkie", pay: "$3–$40/survey", url: "https://www.surveyjunkie.com/register", color: "#1A56C4" },
            { name: "Swagbucks", pay: "$10 signup bonus", url: "https://www.swagbucks.com/p/register", color: "#F59E0B" },
            { name: "InboxDollars", pay: "$5 signup bonus", url: "https://www.inboxdollars.com/register", color: "#16A34A" },
            { name: "Prolific", pay: "$6–$35/study", url: "https://app.prolific.com/register/participant", color: "#6B3FA0" },
            { name: "UserTesting", pay: "$10/test", url: "https://www.usertesting.com/be-a-user-tester", color: "#C05A10" },
            { name: "Pinecone Research", pay: "$3–$5/survey", url: "https://www.pineconeresearch.com/register", color: "#0F6E8E" },
          ].map((p, i) => (
            <a key={i} href={p.url} target="_blank" rel="noreferrer"
              style={{ display: "block", background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "16px", textDecoration: "none", transition: "all 0.2s", cursor: "pointer" }}
              onMouseOver={e => e.currentTarget.style.borderColor = "var(--gold)"}
              onMouseOut={e => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--dark)", marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: p.color, fontWeight: 600 }}>{p.pay}</div>
              <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Join Free →</div>
            </a>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--muted2)", marginTop: 16, textAlign: "center" }}>
          * Some links may be referral links. This helps keep StudyCashBoard free to browse.
        </p>
      </div>

      {/* Digital Products Grid */}
      <div style={{ fontFamily: "var(--ff)", fontSize: "1.5rem", fontWeight: 600, color: "var(--dark)", marginBottom: 20 }}>
        Guides & Resources
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
        {products.map((p, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "28px 24px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>{p.icon}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 2, background: p.tagColor + "18", color: p.tagColor, border: `1px solid ${p.tagColor}40` }}>{p.tag}</span>
              <span style={{ fontSize: 11, color: "var(--muted2)", fontWeight: 500 }}>{p.subtitle}</span>
            </div>
            <div style={{ fontFamily: "var(--ff)", fontSize: "1.1rem", fontWeight: 600, color: "var(--dark)", marginBottom: 10, lineHeight: 1.3 }}>{p.title}</div>
            <p style={{ fontSize: 12.5, color: "var(--mid)", lineHeight: 1.65, marginBottom: 20, flex: 1, fontWeight: 300 }}>{p.description}</p>
            <button onClick={p.action}
              style={{ background: "var(--dark)", color: "#fff", border: "none", padding: "11px", borderRadius: 4, fontFamily: "var(--fs)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", transition: "background 0.2s" }}
              onMouseOver={e => e.currentTarget.style.background = "var(--gold)"}
              onMouseOut={e => e.currentTarget.style.background = "var(--dark)"}
            >{p.cta} →</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Privacy Policy Page ───────────────────────────────────────────────────────
function PrivacyPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 2rem 80px" }}>
      <div style={{ fontFamily: "var(--ff)", fontSize: "2.2rem", fontWeight: 600, color: "var(--dark)", marginBottom: 8 }}>Privacy Policy</div>
      <p style={{ fontSize: 12, color: "var(--muted2)", marginBottom: 32 }}>Last updated: May 2026</p>
      {[
        { h: "Information We Collect", b: "We collect information you provide when you sign up or contact us, including your name and email address. We also collect anonymous usage data (page views, clicks) through Vercel Analytics to improve our service." },
        { h: "How We Use Your Information", b: "We use your information to provide and improve StudyCashBoard, send you email digests (if subscribed), respond to your inquiries, and process subscription payments. We never sell your personal information to third parties." },
        { h: "Third-Party Links", b: "StudyCashBoard links to third-party research platforms. We are not responsible for the privacy practices of these external sites. We recommend reviewing their privacy policies before registering." },
        { h: "Referral Links", b: "Some links on StudyCashBoard may be affiliate or referral links. Clicking these links and signing up may earn StudyCashBoard a commission at no extra cost to you." },
        { h: "Cookies", b: "We use minimal cookies necessary for site functionality. We do not use advertising cookies or tracking pixels." },
        { h: "Data Security", b: "We use industry-standard security measures to protect your information. Your data is stored securely via Supabase." },
        { h: "Contact", b: "For privacy questions, email us at studycashboard@gmail.com." },
      ].map((s, i) => (
        <div key={i} style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--dark)", marginBottom: 8 }}>{s.h}</div>
          <p style={{ fontSize: 13.5, color: "var(--mid)", lineHeight: 1.75, fontWeight: 300 }}>{s.b}</p>
        </div>
      ))}
    </div>
  );
}

// ── Terms of Service Page ─────────────────────────────────────────────────────
function TermsPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 2rem 80px" }}>
      <div style={{ fontFamily: "var(--ff)", fontSize: "2.2rem", fontWeight: 600, color: "var(--dark)", marginBottom: 8 }}>Terms of Service</div>
      <p style={{ fontSize: 12, color: "var(--muted2)", marginBottom: 32 }}>Last updated: May 2026</p>
      {[
        { h: "Acceptance of Terms", b: "By using StudyCashBoard, you agree to these terms. If you do not agree, please do not use our service." },
        { h: "What We Provide", b: "StudyCashBoard is a directory of paid research opportunities. We curate and display listings from third-party research companies. We do not guarantee the availability, accuracy, or legitimacy of individual listings." },
        { h: "Not a Research Company", b: "StudyCashBoard is not a market research company. We do not pay participants directly. Payment is handled by the individual research companies listed on our platform." },
        { h: "Subscriptions", b: "Pro and Elite subscriptions are billed monthly. You may cancel at any time. We offer a 30-day money-back guarantee for first-time subscribers. Cancellations take effect at the end of the current billing period." },
        { h: "Referral Links", b: "Some links on StudyCashBoard are affiliate or referral links. By clicking these links, you acknowledge that StudyCashBoard may earn a commission. This does not affect the price you pay." },
        { h: "Prohibited Use", b: "You may not use StudyCashBoard to scrape listings, resell our content, or misrepresent your identity when applying to research studies." },
        { h: "Limitation of Liability", b: "StudyCashBoard is provided 'as is'. We are not liable for any earnings (or lack thereof) resulting from applying to listings on our platform." },
        { h: "Contact", b: "For questions about these terms, email studycashboard@gmail.com." },
      ].map((s, i) => (
        <div key={i} style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--dark)", marginBottom: 8 }}>{s.h}</div>
          <p style={{ fontSize: 13.5, color: "var(--mid)", lineHeight: 1.75, fontWeight: 300 }}>{s.b}</p>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [initCat, setInitCat] = useState("");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin bypass — visit ?admin=true to unlock everything for testing
  // Keep this URL secret — don't share with users
  const [adminMode] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const isAdmin = params.get("admin") === "true";
      // Persist in sessionStorage so it survives page navigation
      if (isAdmin) sessionStorage.setItem("scb_admin", "true");
      return isAdmin || sessionStorage.getItem("scb_admin") === "true";
    } catch { return false; }
  });

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

  function go(dest, cat = "") {
    setPage(dest);
    setInitCat(cat);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <style>{CSS}</style>

      <nav className="nav">
        <button className="logo" onClick={() => go("home")}>
          <span className="logo-s">Study</span>
          <span className="logo-c">Cash</span>
          <span className="logo-b">Board</span>
          <span className="logo-sep" />
          <span className="logo-tag">Paid Research Directory</span>
        </button>
        <div className="nav-links">
          <button className={`nav-link ${page==="home"?"active":""}`} onClick={() => go("home")}>Home</button>
          <button className={`nav-link ${page==="listings"?"active":""}`} onClick={() => go("listings")}>Browse Gigs</button>
          <button className={`nav-link ${page==="pricing"?"active":""}`} onClick={() => go("pricing")}>Pricing</button>
          <button className={`nav-link ${page==="products"?"active":""}`} onClick={() => go("products")}>Free Resources</button>
          <button className={`nav-link ${page==="faq"?"active":""}`} onClick={() => go("faq")}>FAQ</button>
          <button className={`nav-link ${page==="contact"?"active":""}`} onClick={() => go("contact")}>Contact</button>
        </div>
        <div className="nav-right">
          <button className="nav-signin" onClick={() => alert("Auth coming soon!")}>Sign In</button>
          <button className="nav-cta" onClick={() => go("pricing")}>Get Pro Access</button>
        </div>
      </nav>

      {page === "home"     && <Home     listings={listings} loading={loading} go={go} adminMode={adminMode} />}
      {page === "listings" && <Listings listings={listings} loading={loading} go={go} initCat={initCat} adminMode={adminMode} />}
      {page === "pricing"  && <Pricing />}
      {page === "faq"      && <FAQ go={go} />}
      {page === "contact"  && <Contact />}
      {page === "products" && <Products go={go} />}
      {page === "privacy"  && <PrivacyPage />}
      {page === "terms"    && <TermsPage />}

      <footer className="footer">
        <div className="footer-logo">
          <span className="fl-s">Study</span><span className="fl-c">Cash</span><span className="fl-b">Board</span>
        </div>
        <div className="footer-links">
          <button className="footer-link" onClick={() => go("home")}>Home</button>
          <button className="footer-link" onClick={() => go("listings")}>Listings</button>
          <button className="footer-link" onClick={() => go("pricing")}>Pricing</button>
          <button className="footer-link" onClick={() => go("faq")}>FAQ</button>
          <button className="footer-link" onClick={() => go("contact")}>Contact</button>
          <button className="footer-link" onClick={() => go("products")}>Free Resources</button>
          <button className="footer-link" onClick={() => go("privacy")}>Privacy</button>
          <button className="footer-link" onClick={() => go("terms")}>Terms</button>
        </div>
        <div className="footer-social-links">
          <a className="footer-social-link" href="https://facebook.com/StudyCashBoard" target="_blank" rel="noreferrer" title="Facebook">f</a> <a className="footer-social-link" href="https://instagram.com/StudyCashBoard" target="_blank" rel="noreferrer" title="Instagram">◉</a> <a className="footer-social-link" href="https://x.com/StudyCashBoard" target="_blank" rel="noreferrer" title="X">𝕏</a> <a className="footer-social-link" href="https://tiktok.com/@StudyCashBoard" target="_blank" rel="noreferrer" title="TikTok">♪</a> <a className="footer-social-link" href="https://youtube.com/@StudyCashBoard" target="_blank" rel="noreferrer" title="YouTube">▶</a>
        </div>
        <div className="footer-copy">© 2026 StudyCashBoard · All rights reserved</div>
      </footer>

      {/* Vercel Analytics — invisible to users, visible only in your Vercel dashboard */}
      {Analytics && <Analytics />}
    </>
  );
}
