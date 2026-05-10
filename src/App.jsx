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
}
