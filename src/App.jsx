import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function App() {
const [listings, setListings] = useState([]);
useEffect(() => {
  async function fetchListings() {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .limit(10);

    console.log(data, error);

   console.log("DATA:", data);
console.log("ERROR:", error);

if (!error) {
  setListings(data || []);
}
  }

  fetchListings();
}, []);
  
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        background: "#f3f4f6",
        minHeight: "100vh",
      }}
    >
      <section
        style={{
          background:
            "linear-gradient(135deg, #10b981 0%, #0f172a 100%)",
          color: "white",
          padding: "80px 20px",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          <p
            style={{
              letterSpacing: "2px",
              fontWeight: "bold",
            }}
          >
            PAID OPPORTUNITIES UPDATED DAILY
          </p>

          <h1
            style={{
              fontSize: "72px",
              lineHeight: 1,
              maxWidth: "800px",
              marginTop: "20px",
            }}
          >
            Find legit paid studies, focus groups & remote gigs.
          </h1>

          <p
            style={{
              fontSize: "22px",
              maxWidth: "800px",
              marginTop: "24px",
              lineHeight: 1.6,
            }}
          >
            Curated high-paying user interviews, focus groups,
            testing gigs, and online opportunities.
          </p>
        </div>
      </section>

      <div
        style={{
          maxWidth: "1200px",
          margin: "40px auto",
          padding: "0 20px",
        }}
      >
        <h2
          style={{
            marginBottom: "24px",
          }}
        >
          Active Listings
        </h2>

        <div
          style={{
            display: "grid",
            gap: "20px",
          }}
        >
          {listings.map((listing) => (
            <div
              key={listing.id}
              style={{
                background: "white",
                padding: "24px",
                borderRadius: "20px",
                boxShadow: "0 5px 15px rgba(0,0,0,0.08)",
              }}
            >
              <h3>{listing.title}</h3>

              <p>
                <strong>Company:</strong> {listing.company}
              </p>

              <p>
                <strong>Pay:</strong> ${listing.pay}
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
                  marginTop: "16px",
                  background: "#10b981",
                  color: "white",
                  padding: "12px 20px",
                  borderRadius: "12px",
                  textDecoration: "none",
                  fontWeight: "bold",
                }}
              >
                Apply Now
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
