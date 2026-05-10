import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const categories = [
  "All",
  "AI & Tech",
  "Finance",
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
        fontFamily: "Arial, sans-serif",
        padding: "40px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: "42px", marginBottom: "10px" }}>
        StudyCashBoard
      </h1>

      <p style={{ color: "#666", marginBottom: "30px" }}>
        Discover paid focus groups, user interviews, and remote research gigs.
      </p>

      {loading && <p>Loading listings...</p>}

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "30px",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Search listings..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            padding: "12px",
            flex: "1",
            minWidth: "250px",
          }}
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: "12px" }}
        >
          {categories.map((cat) => (
            <option key={cat}>{cat}</option>
          ))}
        </select>

        <select
          value={minPay}
          onChange={(e) => setMinPay(Number(e.target.value))}
          style={{ padding: "12px" }}
        >
          <option value={0}>Any Pay</option>
          <option value={100}>$100+</option>
          <option value={200}>$200+</option>
          <option value={300}>$300+</option>
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gap: "20px",
        }}
      >
        {filteredListings.map((listing) => (
          <div
            key={listing.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "24px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>{listing.title}</h2>

            <p>
              <strong>Company:</strong> {listing.company}
            </p>

            <p>
              <strong>Pay:</strong> ${listing.pay}
            </p>

            <p>
              <strong>Duration:</strong> {listing.duration}
            </p>

            <p>
              <strong>Category:</strong> {listing.category}
            </p>

            <p>{listing.match}</p>

            <a
              href={listing.link}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                marginTop: "12px",
                padding: "12px 20px",
                background: "black",
                color: "white",
                textDecoration: "none",
                borderRadius: "8px",
              }}
            >
              Apply Now
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
