import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const fallbackListings = [
  {
    id: 1,
    title: "AI Productivity Tools Study",
    company: "Respondent",
    pay: 350,
    duration: "60–75 min",
    location: "Remote / USA",
    category: "AI & Tech",
    type: "User Interview",
    posted: "Today",
    match: "Best for professionals who use AI, apps, dashboards, or workflow tools.",
    link: "https://app.respondent.io/respondents",
    featured: true,
  },
  {
    id: 2,
    title: "Banking & Credit Card Habits Study",
    company: "User Interviews",
    pay: 300,
    duration: "75–90 min",
    location: "Remote / USA",
    category: "Finance",
    type: "Focus Group",
    posted: "Today",
    match: "Good fit for people who use mobile banking, rewards cards, or budgeting apps.",
    link: "https://www.userinterviews.com/studies",
    featured: true,
  },
  {
    id: 3,
    title: "Travel Planning & Booking Study",
    company: "Respondent",
    pay: 250,
    duration: "60 min",
    location: "Remote",
    category: "Travel",
    type: "User Interview",
    posted: "This week",
    match: "Best for frequent travelers, cruisers, and users of travel booking apps.",
    link: "https://app.respondent.io/respondents",
    featured: false,
  },
];

const categories = ["All", "AI & Tech", "Finance", "Work Tools", "Travel", "Shopping", "Entertainment"];

const styles = {
  page: { minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "Inter, Arial, sans-serif" },
  header: { position: "sticky", top: 0, zIndex: 10, background: "rgba(255,255,255,.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e2e8f0" },
  container: { width: "min(1120px, calc(100% - 32px))", margin: "0 auto" },
  nav: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "16px 0" },
  brand: { display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 24 },
  logo: { width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#059669,#f59e0b)", display: "grid", placeItems: "center", color: "white", fontWeight: 900 },
  navLinks: { display: "flex", gap: 18, alignItems: "center", fontSize: 14 },
  link: { color: "#334155", textDecoration: "none", fontWeight: 700 },
  button: { border: 0, borderRadius: 14, padding: "12px 16px", background: "#059669", color: "white", fontWeight: 800, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  hero: { background: "radial-gradient(circle at top left,#10b981 0,#064e3b 35%,#0f172a 75%)", color: "white", padding: "64px 0" },
  heroGrid: { display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 28, alignItems: "center" },
  eyebrow: { color: "#a7f3d0", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 13, fontWeight: 900 },
  h1: { fontSize: "clamp(38px, 6vw, 68px)", lineHeight: 1, margin: "14px 0", letterSpacing: -2, fontWeight: 950 },
  heroText: { color: "#d1fae5", fontSize: 18, lineHeight: 1.6, maxWidth: 680 },
  heroCard: { background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 28, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,.25)" },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 26 },
  stat: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, padding: 20 },
  filterBox: { background: "white", border: "1px solid #e2e8f0", borderRadius: 28, padding: 20, margin: "28px 0" },
  filters: { display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 16, padding: "14px 14px", fontSize: 15, background: "white" },
  mainGrid: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" },
  card: { background: "white", border: "1px solid #e2e8f0", borderRadius: 28, padding: 24, marginBottom: 16, boxShadow: "0 8px 24px rgba(15,23,42,.04)" },
  badge: { display: "inline-block", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900, marginRight: 8, marginBottom: 10 },
  pay: { color: "#047857", fontWeight: 950, fontSize: 18 },
  sidebar: { background: "white", border: "1px solid #e2e8f0", borderRadius: 28, padding: 24, marginBottom: 16 },
  footer: { borderTop: "1px solid #e2e8f0", background: "white", color: "#64748b", padding: "28px 0", marginTop: 48, fontSize: 13 },
};

function ListingCard({ study }) {
  return (
    <article style={styles.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px" }}>
          <div>
            {study.featured && <span style={{ ...styles.badge, background: "#059669", color: "white" }}>Featured</span>}
            <span style={{ ...styles.badge, background: "#f1f5f9", color: "#475569" }}>{study.type}</span>
            <span style={{ ...styles.badge, background: "#fef3c7", color: "#92400e" }}>{study.posted}</span>
          </div>
          <h3 style={{ fontSize: 24, lineHeight: 1.2, margin: "4px 0 6px" }}>{study.title}</h3>
          <p style={{ color: "#64748b", margin: 0 }}>{study.company} · {study.category}</p>
          <p style={{ color: "#334155", lineHeight: 1.6 }}>{study.match}</p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", color: "#475569", fontSize: 14 }}>
            <span style={styles.pay}>${study.pay}</span>
            <span>⏱ {study.duration}</span>
            <span>📍 {study.location}</span>
          </div>
        </div>
        <a href={study.link} target="_blank" rel="noreferrer sponsored" style={{ ...styles.button, minWidth: 130 }}>
          Apply Now ↗
        </a>
      </div>
    </article>
  );
}

export default function PaidStudyBoard() {
  const [listings, setListings] = useState(fallbackListings);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [minPay, setMinPay] = useState(0);

  useEffect(() => {
    async function loadListings() {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .order("featured", { ascending: false })
        .order("pay", { ascending: false });

      if (error) {
        console.error("Supabase error:", error.message);
      } else if (data && data.length > 0) {
        setListings(data);
      }

      setLoading(false);
    }

    loadListings();
  }, []);

  const filtered = useMemo(() => {
    return listings
      .filter((study) => category === "All" || study.category === category)
      .filter((study) => study.pay >= minPay)
      .filter((study) => {
        const text = `${study.title} ${study.company} ${study.category} ${study.match}`.toLowerCase();
        return text.includes(query.toLowerCase());
      })
      .sort((a, b) => b.pay - a.pay);
  }, [query, category, minPay]);

  const topPay = Math.max(...listings.map((item) => item.pay));

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.container}>
          <nav style={styles.nav}>
            <div style={styles.brand}><span style={styles.logo}>$</span> StudyCashBoard</div>
            <div style={styles.navLinks}>
              <a style={styles.link} href="#listings">Listings</a>
              <a style={styles.link} href="#newsletter">Daily Alerts</a>
              <a style={styles.link} href="#partners">Partners</a>
            </div>
          </nav>
        </div>
      </header>

      <section style={styles.hero}>
        <div style={{ ...styles.container, ...styles.heroGrid }}>
          <div>
            <p style={styles.eyebrow}>Paid opportunities updated daily</p>
            <h1 style={styles.h1}>Find legit paid studies, focus groups & remote gigs.</h1>
            <p style={styles.heroText}>Curated high-paying user interviews, focus groups, research studies, testing gigs, and online opportunities — all in one simple board.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
              <a href="#listings" style={styles.button}>Browse Paid Studies</a>
              <a href="#newsletter" style={{ ...styles.button, background: "white", color: "#064e3b" }}>Get Daily Alerts</a>
            </div>
            <p style={{ color: "#a7f3d0", fontSize: 12, marginTop: 16 }}>Disclosure: Some links may be referral or affiliate links. Always verify each opportunity before applying.</p>
          </div>
          <div style={styles.heroCard}>
            <h2 style={{ marginTop: 0 }}>Today’s best categories</h2>
            {["AI & Tech", "Finance", "Work Tools", "Travel", "Shopping"].map((item, index) => (
              <div key={item} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,.15)" }}>
                <span>✅ {item}</span><strong>${[350, 300, 275, 250, 175][index]}+</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main style={styles.container}>
        <section style={styles.statGrid}>
          <div style={styles.stat}><div style={{ color: "#64748b" }}>Top payout</div><strong style={{ fontSize: 30 }}>${topPay}+</strong></div>
          <div style={styles.stat}><div style={{ color: "#64748b" }}>Listings</div><strong style={{ fontSize: 30 }}>{listings.length}</strong></div>
          <div style={styles.stat}><div style={{ color: "#64748b" }}>Cost to join</div><strong style={{ fontSize: 30 }}>Free</strong></div>
          <div style={styles.stat}><div style={{ color: "#64748b" }}>Best format</div><strong style={{ fontSize: 30 }}>Remote</strong></div>
        </section>

        <section id="newsletter" style={{ ...styles.filterBox, background: "#ecfdf5", borderColor: "#a7f3d0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: "0 0 6px" }}>Get daily paid study alerts</h2>
              <p style={{ margin: 0, color: "#334155" }}>Newsletter signup coming next. For now, follow StudyCashBoard on social media for daily updates.</p>
            </div>
            <a href="#listings" style={styles.button}>See Today’s Listings</a>
          </div>
        </section>

        <section id="listings">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontSize: 38, margin: "10px 0 6px" }}>Latest paid opportunities</h2>
              <p style={{ color: "#64748b", margin: 0 }}>{loading ? "Loading live listings..." : "Search, filter, and sort by highest payout."}</p>
            </div>
          </div>

          <div style={styles.filterBox}>
            <div style={styles.filters}>
              <input style={styles.input} placeholder="Search AI, finance, travel..." value={query} onChange={(e) => setQuery(e.target.value)} />
              <select style={styles.input} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((cat) => <option key={cat}>{cat}</option>)}
              </select>
              <select style={styles.input} value={minPay} onChange={(e) => setMinPay(Number(e.target.value))}>
                <option value={0}>Any payout</option>
                <option value={150}>$150+</option>
                <option value={250}>$250+</option>
                <option value={300}>$300+</option>
              </select>
            </div>
          </div>

          <div style={styles.mainGrid}>
            <div>
              {filtered.map((study) => <ListingCard key={study.id} study={study} />)}
            </div>
            <aside>
              <div style={styles.sidebar}>
                <h3>How we curate</h3>
                <p style={{ color: "#475569", lineHeight: 1.6 }}>We prioritize higher payouts, remote availability, trusted platforms, clear eligibility, and fresh opportunities.</p>
              </div>
              <div style={styles.sidebar}>
                <h3>Best screener tip</h3>
                <p style={{ color: "#475569", lineHeight: 1.6 }}>Be specific and honest. Mention apps you use, decisions you make, and recent experiences.</p>
              </div>
              <div id="partners" style={{ ...styles.sidebar, background: "#0f172a", color: "white" }}>
                <h3>Advertise or partner</h3>
                <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>Research recruiters and paid study platforms can sponsor featured listings or newsletter placements.</p>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <footer style={styles.footer}>
        <div style={styles.container}>© 2026 StudyCashBoard. We are not the hiring company or research sponsor. Some links may be affiliate or referral links.</div>
      </footer>

      <style>{`
        @media (max-width: 850px) {
          .hide-mobile { display: none; }
        }
        @media (max-width: 850px) {
          body { overflow-x: hidden; }
        }
        @media (max-width: 900px) {
          section > div, main { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 760px) {
          div[style*="grid-template-columns: repeat(4"] { grid-template-columns: 1fr 1fr !important; }
          div[style*="grid-template-columns: 1.4fr"] { grid-template-columns: 1fr !important; }
          div[style*="grid-template-columns: 2fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
