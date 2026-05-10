# Restore Your StudyCashBoard Design

Replace the ENTIRE contents of `src/App.jsx` with the code below.

```jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const categories = [
  "All",
  "AI & Tech",
  "Finance",
  "Work Tools",
  "Travel",
  "Shopping",
  "Healthcare",
  "Focus Groups",
  "Remote Gigs",
];

export default function PaidStudyBoard() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [minPay, setMinPay] = useState(0);

  useEffect(() => {
    async function loadListings() {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "active")
        .order("featured", { ascending: false })
        .order("pay", { ascending: false });

      if (error) {
        console.error(error);
      } else {
        setListings(data || []);
      }

      setLoading(false);
    }

    loadListings();
  }, []);

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      const matchesSearch =
        listing.title?.toLowerCase().includes(query.toLowerCase()) ||
        listing.company?.toLowerCase().includes(query.toLowerCase());

      const matchesCategory =
        category === "All" || listing.category === category;

      const matchesPay = listing.pay >= minPay;

      return matchesSearch && matchesCategory && matchesPay;
    });
  }, [listings, query, category, minPay]);

  return (
    <div
      style={{
        fontFamily: "Inter, Arial, sans-serif",
        background: "#f5f7fb",
        minHeight: "100vh",
        color: "#111827",
      }}
    >
      <section
        style={{
          background:
            "linear-gradient(135deg, #10b981 0%, #0f172a 100%)",
          color: "white",
          padding: "80px 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "40px",
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                letterSpacing: "2px",
                fontWeight: "700",
                opacity: 0.8,
              }}
            >
              PAID OPPORTUNITIES UPDATED DAILY
            </p>

            <h1
              style={{
                fontSize: "72px",
                lineHeight: 1,
                marginTop: "16px",
                marginBottom: "24px",
                fontWeight: "800",
              }}
            >
              Find legit paid studies, focus groups & remote gigs.
            </h1>

            <p
              style={{
                fontSize: "22px",
                lineHeight: 1.6,
                opacity: 0.9,
                maxWidth: "800px",
              }}
            >
              Curated high-paying user interviews, focus groups, research
              studies, testing gigs, and online opportunities — all in one
              simple board.
            </p>

            <div
              style={{
                display: "flex",
                gap: "16px",
                marginTop: "32px",
                flexWrap: "wrap",
              }}
            >
              <button
                style={{
                  background: "#10b981",
                  border: "none",
                  color: "white",
                  padding: "16px 28px",
                  borderRadius: "14px",
                  fontWeight: "700",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              >
                Browse Paid Studies
              </button>

              <button
                style={{
                  background: "white",
                  border: "none",
                  color: "#111827",
                  padding: "16px 28px",
                  borderRadius: "14px",
                  fontWeight: "700",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              >
                Get Daily Alerts
              </button>
            </div>

            <p
              style={{
                marginTop: "24px",
                fontSize: "14px",
                opacity: 0.75,
              }}
            >
              Disclosure: Some links may be referral or affiliate links.
              Always verify each opportunity before applying.
            </p>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "28px",
              padding: "32px",
              backdropFilter: "blur(12px)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "36px" }}>
              Today’s best categories
            </h2>

            {[
              ["AI & Tech", "$350+"],
              ["Finance", "$300+"],
              ["Work Tools", "$275+"],
              ["Travel", "$250+"],
              ["Shopping", "$175+"],
            ].map(([name, value]) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "18px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.15)",
                  fontSize: "22px",
                }}
              >
                <span>✅ {name}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          maxWidth: "1200px",
          margin: "-40px auto 0",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "20px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "28px",
              borderRadius: "20px",
            }}
          >
            <p style={{ color: "#6b7280" }}>Top payout</p>
            <h2>$350+</h2>
          </div>

          <div
            style={{
              background: "white",
              padding: "28px",
              borderRadius: "20px",
            }}
          >
            <p style={{ color: "#6b7280" }}>Listings</p>
            <h2>{filteredListings.length}</h2>
          </div>

          <div
            style={{
              background: "white",
              padding: "28px",
              borderRadius: "20px",
            }}
          >
            <p style={{ color: "#6b7280" }}>Cost to join</p>
            <h2>Free</h2>
          </div>

          <div
            style={{
              background: "white",
              padding: "28px",
              borderRadius: "20px",
            }}
          >
            <p style={{ color: "#6b7280" }}>Best format</p>
            <h2>Remote</h2>
          </div>
        </div>

        <div
          style={{
            background: "white",
            padding: "32px",
            borderRadius: "24px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              placeholder="Search studies..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: 1,
                minWidth: "250px",
                padding: "16px",
                borderRadius: "14px",
                border: "1px solid #d1d5db",
              }}
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                padding: "16px",
                borderRadius: "14px",
                border: "1px solid #d1d5db",
              }}
            >
              {categories.map((cat) => (
                <option key={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={minPay}
              onChange={(e) => setMinPay(Number(e.target.value))}
              style={{
                padding: "16px",
                borderRadius: "14px",
                border: "1px solid #d1d5db",
              }}
            >
              <option value={0}>Any Pay</option>
              <option value={100}>$100+</option>
              <option value={200}>$200+</option>
              <option value={300}>$300+</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p>Loading listings...</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "24px",
              paddingBottom: "60px",
            }}
          >
            {filteredListings.map((listing) => (
              <div
                key={listing.id}
                style={{
                  background: "white",
                  borderRadius: "24px",
                  padding: "32px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <h2 style={{ marginTop: 0 }}>{listing.title}</h2>
                    <p style={{ color: "#6b7280" }}>
                      {listing.company} • {listing.category}
                    </p>
                  </div>

                  <div
                    style={{
                      background: "#ecfdf5",
                      color: "#047857",
                      padding: "12px 18px",
                      borderRadius: "14px",
                      fontWeight: "700",
                    }}
                  >
                    ${listing.pay}
                  </div>
                </div>

                <p style={{ marginTop: "18px", lineHeight: 1.7 }}>
                  {listing.match}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: "14px",
                    marginTop: "24px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      background: "#f3f4f6",
                      padding: "10px 14px",
                      borderRadius: "12px",
                    }}
                  >
                    ⏱ {listing.duration}
                  </span>

                  <span
                    style={{
                      background: "#f3f4f6",
                      padding: "10px 14px",
                      borderRadius: "12px",
                    }}
                  >
                    📍 {listing.location}
                  </span>
                </div>

                <a
                  href={listing.link}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-block",
                    marginTop: "28px",
                    background: "#10b981",
                    color: "white",
                    padding: "16px 24px",
                    borderRadius: "14px",
                    textDecoration: "none",
                    fontWeight: "700",
                  }}
                >
                  Apply Now
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

Then:

1. Commit changes
2. Wait for Vercel deployment to say READY
3. Refresh StudyCashBoard.com

Your beautiful homepage design will return, while still using live Supabase listings.
