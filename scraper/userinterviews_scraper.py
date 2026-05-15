"""
StudyCashBoard — User Interviews Scraper
=========================================
Uses saved browser cookies to scrape real studies from
app.userinterviews.com after authentication.

HOW TO USE:
1. Run: python save_cookies.py  (one time setup)
2. Upload cookies to GitHub Secret: UI_COOKIES
3. This scraper runs automatically as part of the daily pipeline

REQUIREMENTS:
pip install playwright requests beautifulsoup4 supabase anthropic
playwright install chromium
"""

import os, re, json, time, logging
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from typing import Optional, List

from playwright.sync_api import sync_playwright
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ui_scraper")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

# Cookies saved from your browser session (stored as GitHub Secret)
# Format: JSON array of cookie objects from Playwright
UI_COOKIES = os.environ.get("UI_COOKIES", "")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

def expires_iso(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()

def get_sb():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def upsert_listing(sb, listing: dict) -> str:
    now = datetime.now(timezone.utc).isoformat()
    try:
        existing = sb.table("Listings").select("id")\
            .eq("Title", listing["Title"])\
            .eq("Company", listing["Company"]).execute()
        if existing.data:
            sb.table("Listings").update({**listing, "updated_at": now, "Last_Seen": now})\
                .eq("id", existing.data[0]["id"]).execute()
            return "updated"
        else:
            listing["First_Seen"] = now
            listing["Last_Seen"] = now
            sb.table("Listings").insert(listing).execute()
            return "inserted"
    except Exception as e:
        log.error(f"DB error: {e}")
        return "skipped"

def parse_pay(text: str):
    """Extract pay from strings like '$150', '$75–$200', 'Up to $300'"""
    if not text: return None, None
    text = text.replace(",", "")
    nums = re.findall(r'\$(\d+)', text)
    if not nums: return None, None
    nums = [int(n) for n in nums if int(n) < 10000]
    if not nums: return None, None
    return min(nums), max(nums) if len(nums) > 1 else None

def parse_duration(text: str) -> Optional[str]:
    if not text: return None
    m = re.search(r'(\d+)\s*[-–]\s*(\d+)\s*(min|hour|hr|minute)', text, re.I)
    if m: return f"{m.group(1)}–{m.group(2)} {m.group(3)}"
    m = re.search(r'(\d+)\s*(min|hour|hr|minute)', text, re.I)
    if m: return f"{m.group(1)} {m.group(2)}"
    return text[:40] if text else None

def cat_from_text(text: str, pay=None) -> str:
    t = text.lower()
    if any(w in t for w in ["taste","food","beverage","snack","flavor","sensory","culinary","eating"]): return "Taste Test"
    if any(w in t for w in ["medical","health","clinical","patient","pharma","drug","wellness","therapy","condition","symptom","mental health","caregiver","disease"]): return "Medical & Health"
    if any(w in t for w in ["finance","bank","invest","credit","insurance","fintech","money","loan","mortgage","financial"]): return "Finance"
    if any(w in t for w in ["ai","artificial intelligence","machine learning","chatbot","technology","tech","automation"]): return "AI & Tech"
    if any(w in t for w in ["travel","hotel","airline","booking","vacation","trip","flight","cruise"]): return "Travel"
    if any(w in t for w in ["automotive","car","vehicle","ev","electric vehicle","driving","suv","truck"]): return "Automotive"
    if any(w in t for w in ["education","learning","student","tutor","school","course","teacher","university"]): return "Education"
    if any(w in t for w in ["gaming","video game","esport","console","mobile game","gamer"]): return "Gaming"
    if any(w in t for w in ["retail","shopping","fashion","clothing","beauty","cosmetic","makeup","skincare"]): return "Retail & Lifestyle"
    if any(w in t for w in ["home","smart home","appliance","furniture","cleaning","household","kitchen"]): return "Home & Living"
    if any(w in t for w in ["app","website","software","ux","ui","usability","prototype","interface"]): return "App & UX Testing"
    if any(w in t for w in ["focus group","group discussion","panel","roundtable"]): return "Focus Group"
    return "User Interview"

def scrape_userinterviews() -> List[dict]:
    """
    Scrape User Interviews using saved browser cookies.
    Navigates to the studies page and extracts all visible listings.
    """
    if not UI_COOKIES:
        log.error("UI_COOKIES not set — skipping User Interviews scraper")
        return []

    listings = []

    try:
        cookies = json.loads(UI_COOKIES)
    except json.JSONDecodeError as e:
        log.error(f"Invalid UI_COOKIES format: {e}")
        return []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent=HEADERS["User-Agent"])

            # Load saved cookies into browser
            context.add_cookies(cookies)
            log.info(f"  Loaded {len(cookies)} cookies")

            page = context.new_page()

            # Navigate to studies page
            log.info("  Navigating to User Interviews studies page...")
            page.goto("https://app.userinterviews.com/studies", timeout=30000)
            page.wait_for_load_state("networkidle", timeout=20000)

            # Check if we're logged in
            if "sign_in" in page.url or "login" in page.url:
                log.error("  NOT LOGGED IN — cookies may be expired. Re-run save_cookies.py")
                browser.close()
                return []

            log.info(f"  Logged in successfully. URL: {page.url}")

            # Wait for studies to load
            try:
                page.wait_for_selector(
                    "[data-testid='study-card'], [class*='StudyCard'], [class*='study-card'], article",
                    timeout=15000
                )
            except Exception:
                log.warning("  Study cards not found with primary selector, trying fallback...")

            # Scroll to load all studies
            for _ in range(5):
                page.evaluate("window.scrollBy(0, 800)")
                time.sleep(0.8)

            # Get page HTML and parse
            html = page.content()
            browser.close()

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")

        # Try multiple selectors for study cards
        cards = (
            soup.select("[data-testid*='study-card']") or
            soup.select("[class*='StudyCard']") or
            soup.select("[class*='study-card']") or
            soup.select("article[class*='study']") or
            soup.select(".study-listing") or
            soup.select("[class*='ProjectCard']")
        )

        log.info(f"  Found {len(cards)} study cards")

        for card in cards:
            # Title
            title_el = (
                card.select_one("[class*='title']") or
                card.select_one("h2") or
                card.select_one("h3") or
                card.select_one("[class*='name']")
            )
            title = title_el.get_text(strip=True) if title_el else None
            if not title or len(title) < 5:
                continue

            # Pay/incentive
            pay_el = (
                card.select_one("[class*='incentive']") or
                card.select_one("[class*='reward']") or
                card.select_one("[class*='compensation']") or
                card.select_one("[class*='pay']")
            )
            pay_text = pay_el.get_text(strip=True) if pay_el else ""
            pmin, pmax = parse_pay(pay_text)

            # Duration
            dur_el = (
                card.select_one("[class*='duration']") or
                card.select_one("[class*='length']") or
                card.select_one("[class*='time']")
            )
            dur_text = dur_el.get_text(strip=True) if dur_el else None
            duration = parse_duration(dur_text)

            # Location/format
            loc_el = (
                card.select_one("[class*='location']") or
                card.select_one("[class*='format']") or
                card.select_one("[class*='remote']")
            )
            loc_text = loc_el.get_text(strip=True) if loc_el else "Remote / USA"
            is_remote = "remote" in loc_text.lower() or "online" in loc_text.lower()

            # Apply link
            link_el = card.select_one("a[href*='/studies/']") or card.select_one("a[href]")
            href = link_el["href"] if link_el else ""
            if href and not href.startswith("http"):
                href = "https://app.userinterviews.com" + href
            apply_url = href or "https://app.userinterviews.com/studies"

            # Category and scoring
            category = cat_from_text(title, pmin)
            score = min(85, ((pmin or 0) + (pmax or 0)) // 3 + 20)

            # Description
            desc_el = card.select_one("[class*='description']") or card.select_one("p")
            description = desc_el.get_text(strip=True)[:300] if desc_el else (
                f"A paid {category.lower()} study from User Interviews. "
                f"Share your opinions and experiences — create a free account to apply and see full details."
            )

            now = datetime.now(timezone.utc).isoformat()
            listing = {
                "Title":       title,
                "Company":     "User Interviews",
                "Description": description,
                "Pay":         pmin,
                "Pay_Max":     pmax,
                "Duration":    duration,
                "Location":    loc_text if loc_text else "Remote / USA",
                "State":       "Remote" if is_remote else "Nationwide",
                "Is_Remote":   is_remote,
                "Category":    category,
                "Source_URL":  apply_url,
                "Apply_URL":   apply_url,
                "Score":       score,
                "Is_Featured": score >= 75,
                "Tags":        ["login-required", "remote" if is_remote else "in-person", "high-pay"],
                "Status":      "active",
                "Expires_At":  expires_iso(14),
            }
            listings.append(listing)
            log.info(f"  ✓ {title[:55]} — ${pmin or '?'}")

    except Exception as e:
        log.error(f"  User Interviews scraper failed: {e}")

    log.info(f"  User Interviews → {len(listings)} listings")
    return listings

def run():
    log.info("=" * 60)
    log.info("User Interviews Scraper")
    log.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    log.info("=" * 60)

    if not UI_COOKIES:
        log.error("UI_COOKIES secret not set. Run save_cookies.py first.")
        return

    sb = get_sb()
    listings = scrape_userinterviews()

    if not listings:
        log.warning("No listings found. Cookies may be expired.")
        return

    ins = upd = skp = 0
    for l in listings:
        r = upsert_listing(sb, l)
        if r == "inserted":   ins += 1
        elif r == "updated":  upd += 1
        else:                 skp += 1

    log.info(f"\n✅ DONE — inserted={ins} updated={upd} skipped={skp}")

if __name__ == "__main__":
    run()
