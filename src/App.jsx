import React from "react";

export default function PaidStudyBoard() {
  const listings = [
    {
      title: "AI Productivity Tools Study",
      pay: "$350",
      company: "Respondent",
      location: "Remote",
      link: "https://app.respondent.io/respondents"
    },
    {
      title: "Banking & Credit Card Habits Study",
      pay: "$300",
      company: "User Interviews",
      location: "Remote",
      link: "https://www.userinterviews.com/studies"
    },
    {
      title: "Travel Planning Study",
      pay: "$250",
      company: "User Interviews",
      location: "Remote",
      link: "https://www.userinterviews.com/studies"
    }
  ];

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f8fafc", minHeight: "100vh", padding: "40px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "42px", marginBottom: "10px" }}>StudyCash Board</h1>
        <p style={{ fontSize: "20px", color: "#475569" }}>
          Daily paid focus groups, user interviews, and remote research studies.
        </p>

        <div style={{ background: "#0f172a", color: "white", padding: "30px", borderRadius: "20px", marginTop: "30px" }}>
          <h2>Find studies that pay $150–$500+</h2>
          <p>Curated opportunities updated daily.</p>
        </div>

        <h2 style={{ marginTop: "40px" }}>Latest Paid Studies</h2>

        {listings.map((study, index) => (
          <div key={index} style={{ background: "white", padding: "24px", borderRadius: "18px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
            <h3>{study.title}</h3>
            <p><strong>Pay:</strong> {study.pay}</p>
            <p><strong>Company:</strong> {study.company}</p>
            <p><strong>Location:</strong> {study.location}</p>
            <a href={study.link} target="_blank" rel="noreferrer">
              <button style={{ background: "#059669", color: "white", border: "none", padding: "12px 18px", borderRadius: "10px", fontWeight: "bold" }}>
                Apply Now
              </button>
            </a>
          </div>
        ))}

        <div style={{ marginTop: "40px", padding: "24px", background: "#ecfdf5", borderRadius: "18px" }}>
          <h2>Get Daily Alerts</h2>
          <p>Newsletter signup coming soon.</p>
        </div>

        <p style={{ marginTop: "40px", color: "#64748b", fontSize: "14px" }}>
          Disclosure: Some links may be referral or affiliate links. Always verify each study before applying.
        </p>
      </div>
    </div>
  );
}
