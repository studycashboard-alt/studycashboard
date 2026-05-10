import React, { useEffect, useMemo, useState } from "react";
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
