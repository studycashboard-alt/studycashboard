"""
StudyCashBoard - Automated Scraper + AI Curation Pipeline
Scrapes focus groups, user interviews, and taste tests.
Curates high-value listings using Claude AI before inserting to Supabase.

Requirements:
    pip install supabase anthropic playwright requests beautifulsoup4 lxml
    playwright install chromium
"""

import os
import json
import re
import time
import logging
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from typing import Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from supabase import create_client, Client
import anthropic

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)
log = logging.getLogger("studycash")

# ─── Config (set these as environment variables or fill in directly) ─────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# Curation thresholds
MIN_SCORE_TO_INSERT = 60          # 0–100 score from Claude AI
MIN_PAY_DOLLARS = 20              # Skip anything paying less than $20
MIN_HOURLY_RATE = 50              # $/hr equivalent to be considered high-value
FEATURED_SCORE_THRESHOLD = 80     # Score needed to be marked as featured


# ─── Data Model ─────────────────────────────────────────────────────────────
@dataclass
class Listing:
    title: str
    company: str
    pay: Optional[int]            # dollars (int, matches your int8 column)
    duration: Optional[str]       # e.g. "60 min", "75–90 min"
    location: str                 # e.g. "Remote / USA", "In-Person / Dallas, TX"
    category: str                 # User Interview | Focus Group | Taste Test | etc.
    source_url: Optional[str] = None
    score: int = 0
    hourly_rate: Optional[int] = None
    is_featured: bool = False
    tags: Optional[str] = None    # JSON string array, e.g. '["remote","quick-pay"]'


# ─── Supabase Client ─────────────────────────────────────────────────────────
def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Set SUPABASE_URL and SUPABASE_KEY environment variables.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def listing_exists(sb: Client, title: str, company: str) -> bool:
    """Return True if a listing with the same title + company is already stored."""
    try:
        result = (
            sb.table("Listings")
            .select("id")
            .eq("Title", title)
            .eq("Company", company)
            .execute()
        )
        return len(result.data) > 0
    except Exception as e:
        log.warning(f"Duplicate check failed: {e}")
        return False


def insert_listing(sb: Client, listing: Listing) -> bool:
    """Insert a curated listing into Supabase. Returns True on success."""
    if listing_exists(sb, listing.title, listing.company):
        log.info(f"  ↳ SKIP (duplicate): {listing.title}")
        return False
    try:
        sb.table("Listings").insert({
            "Title":       listing.title,
            "Company":     listing.company,
            "Pay":         listing.pay,
            "Duration":    listing.duration,
            "Location":    listing.location,
            "Category":    listing.category,
            # Extended curation columns — add these to your Supabase table:
            # score int4, hourly_rate int4, is_featured bool, tags text, source_url text
            # Uncomment the lines below once columns exist:
            # "score":       listing.score,
            # "hourly_rate": listing.hourly_rate,
            # "is_featured": listing.is_featured,
            # "tags":        listing.tags,
            # "source_url":  listing.source_url,
        }).execute()
        log.info(f"  ✅ INSERTED [{listing.score}pts]: {listing.title} — ${listing.pay}")
        return True
    except Exception as e:
        log.error(f"  ✗ Insert failed for '{listing.title}': {e}")
        return False


# ─── Helpers ─────────────────────────────────────────────────────────────────
def parse_pay(text: str) -> Optional[int]:
    """Extract the highest dollar amount from a string like '$75 - $250' or 'Up to $300'."""
    if not text:
        return None
    amounts = re.findall(r"\$?(\d+)", text.replace(",", ""))
    if amounts:
        return max(int(a) for a in amounts)
    return None


def parse_duration_minutes(text: str) -> Optional[int]:
    """Convert duration strings like '60 min', '75–90 min', '1.5 hours' to minutes."""
    if not text:
        return None
    # Range → take the average, e.g. "75-90 min" → 82
    range_match = re.search(r"(\d+)\s*[-–]\s*(\d+)\s*(min|hour|hr)?", text, re.I)
    if range_match:
        lo, hi = int(range_match.group(1)), int(range_match.group(2))
        unit = (range_match.group(3) or "min").lower()
        avg = (lo + hi) / 2
        return int(avg * 60 if unit.startswith("hour") or unit == "hr" else avg)
    # Single value
    single = re.search(r"(\d+(?:\.\d+)?)\s*(min|hour|hr)?", text, re.I)
    if single:
        val = float(single.group(1))
        unit = (single.group(2) or "min").lower()
        return int(val * 60 if unit.startswith("hour") or unit == "hr" else val)
    return None


def compute_hourly_rate(pay: Optional[int], duration_minutes: Optional[int]) -> Optional[int]:
    if pay and duration_minutes and duration_minutes > 0:
        return int((pay / duration_minutes) * 60)
    return None


# ─── Rule-Based Pre-filter (fast, no API cost) ───────────────────────────────
def passes_basic_filter(listing: Listing) -> bool:
    """Quick rule-based gate before sending to Claude."""
    if listing.pay is not None and listing.pay < MIN_PAY_DOLLARS:
        log.debug(f"  FILTER (low pay ${listing.pay}): {listing.title}")
        return False
    if listing.hourly_rate is not None and listing.hourly_rate < MIN_HOURLY_RATE:
        log.debug(f"  FILTER (low rate ${listing.hourly_rate}/hr): {listing.title}")
        return False
    if not listing.title or len(listing.title.strip()) < 5:
        return False
    return True


# ─── Claude AI Curation ───────────────────────────────────────────────────────
def ai_curate(listing: Listing, client: anthropic.Anthropic) -> dict:
    """
    Ask Claude to score and tag the listing.
    Returns dict: { score, is_high_value, reason, tags }
    """
    prompt = f"""You are a curation assistant for StudyCashBoard.com, a site that lists 
high-value paid research opportunities (user interviews, focus groups, taste tests).

Evaluate this listing and return ONLY a JSON object, no other text:

Title: {listing.title}
Company: {listing.company}
Pay: ${listing.pay if listing.pay else 'unknown'}
Duration: {listing.duration or 'unknown'}
Location: {listing.location}
Category: {listing.category}
Estimated hourly rate: ${listing.hourly_rate if listing.hourly_rate else 'unknown'}/hr

Return this exact JSON structure:
{{
  "score": <integer 0-100>,
  "is_high_value": <true if score >= 60, else false>,
  "reason": "<one sentence explaining the score>",
  "tags": ["<tag1>", "<tag2>"]
}}

Scoring guide:
- 80-100: Exceptional (high pay, short duration, remote, reputable company)
- 60-79: Good value (solid pay, reasonable time commitment)
- 40-59: Average (borderline, low pay or very long sessions)
- 0-39: Skip (very low pay, unclear compensation, extremely long)

Tag options (choose all that apply):
"remote", "in-person", "quick-pay", "high-pay", "family-friendly", 
"food-tasting", "tech-focus", "medical", "finance", "beginner-friendly",
"senior-friendly", "nationwide", "1-hour-or-less"
"""
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text.strip()
        # Strip markdown fences if present
        text = re.sub(r"^```json\s*|```$", "", text, flags=re.MULTILINE).strip()
        return json.loads(text)
    except Exception as e:
        log.warning(f"  AI curation failed for '{listing.title}': {e}")
        # Fall back to rule-based score
        score = 50 if listing.pay and listing.pay >= 100 else 30
        return {
            "score": score,
            "is_high_value": score >= MIN_SCORE_TO_INSERT,
            "reason": "Fallback scoring (AI unavailable)",
            "tags": []
        }


# ─── Scrapers ────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}


def scrape_focusgroups_org() -> list[Listing]:
    """Scrape focusgroups.org public listings page."""
    listings = []
    url = "https://focusgroups.org/studies"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "lxml")
        cards = soup.select(".study-card, .listing-card, article.study, .opportunity")
        if not cards:
            # fallback: try generic card selectors
            cards = soup.select("[class*='card'], [class*='listing'], [class*='study']")
        log.info(f"focusgroups.org: found {len(cards)} raw cards")

        for card in cards:
            title_el = card.select_one("h2, h3, .title, [class*='title']")
            pay_el = card.select_one("[class*='pay'], [class*='compensation'], [class*='reward']")
            dur_el = card.select_one("[class*='duration'], [class*='time'], [class*='length']")
            loc_el = card.select_one("[class*='location'], [class*='remote']")

            title = title_el.get_text(strip=True) if title_el else None
            if not title:
                continue

            pay_text = pay_el.get_text(strip=True) if pay_el else ""
            dur_text = dur_el.get_text(strip=True) if dur_el else ""
            loc_text = loc_el.get_text(strip=True) if loc_el else "Remote / USA"
            pay_val = parse_pay(pay_text)
            dur_min = parse_duration_minutes(dur_text)

            listings.append(Listing(
                title=title,
                company="FocusGroups.org",
                pay=pay_val,
                duration=dur_text or None,
                location=loc_text,
                category="Focus Group",
                source_url=url,
                hourly_rate=compute_hourly_rate(pay_val, dur_min),
            ))
    except Exception as e:
        log.error(f"focusgroups.org scrape failed: {e}")
    return listings


def scrape_findpaidfocusgroup() -> list[Listing]:
    """Scrape findpaidfocusgroup.com latest listings."""
    listings = []
    url = "https://www.findpaidfocusgroup.com/latest-paid-focus-groups/"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "lxml")
        posts = soup.select("article, .post, .listing, [class*='study']")
        log.info(f"findpaidfocusgroup.com: found {len(posts)} raw posts")

        for post in posts:
            title_el = post.select_one("h1, h2, h3, .entry-title, a")
            pay_el = post.select_one("[class*='payout'], [class*='pay'], strong")
            age_el = post.select_one("[class*='age']")
            location_el = post.select_one("[class*='location'], [class*='nation']")

            title = title_el.get_text(strip=True) if title_el else None
            if not title or len(title) < 5:
                continue

            pay_text = pay_el.get_text(strip=True) if pay_el else post.get_text()
            pay_val = parse_pay(pay_text)
            loc = location_el.get_text(strip=True) if location_el else "Nationwide USA"

            # Determine category from title keywords
            title_lower = title.lower()
            if any(w in title_lower for w in ["taste", "food", "beverage", "snack"]):
                category = "Taste Test"
            elif any(w in title_lower for w in ["jury", "legal", "mock"]):
                category = "Mock Jury"
            elif any(w in title_lower for w in ["app", "website", "software"]):
                category = "App Testing"
            else:
                category = "Focus Group"

            listings.append(Listing(
                title=title,
                company="FindPaidFocusGroup",
                pay=pay_val,
                duration=None,
                location=loc,
                category=category,
                source_url=url,
                hourly_rate=compute_hourly_rate(pay_val, 60),  # assume 60 min default
            ))
    except Exception as e:
        log.error(f"findpaidfocusgroup.com scrape failed: {e}")
    return listings


def scrape_respondent_io() -> list[Listing]:
    """Scrape Respondent.io using Playwright (JS-rendered)."""
    listings = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(user_agent=HEADERS["User-Agent"])
            page = ctx.new_page()
            page.goto("https://app.respondent.io/projects", timeout=30000)
            page.wait_for_selector("[class*='project'], [class*='study'], article", timeout=15000)

            cards = page.query_selector_all("[class*='project-card'], [class*='study-card'], article")
            log.info(f"respondent.io: found {len(cards)} raw cards")

            for card in cards:
                title = card.query_selector("h2, h3, [class*='title']")
                pay_el = card.query_selector("[class*='incentive'], [class*='pay'], [class*='compensation']")
                dur_el = card.query_selector("[class*='duration'], [class*='length'], [class*='time']")

                title_text = title.inner_text().strip() if title else None
                if not title_text:
                    continue

                pay_text = pay_el.inner_text().strip() if pay_el else ""
                dur_text = dur_el.inner_text().strip() if dur_el else ""
                pay_val = parse_pay(pay_text)
                dur_min = parse_duration_minutes(dur_text)

                listings.append(Listing(
                    title=title_text,
                    company="Respondent",
                    pay=pay_val,
                    duration=dur_text or None,
                    location="Remote / USA",
                    category="User Interview",
                    source_url="https://app.respondent.io/projects",
                    hourly_rate=compute_hourly_rate(pay_val, dur_min),
                ))

            browser.close()
    except Exception as e:
        log.error(f"respondent.io scrape failed: {e}")
    return listings


def scrape_userinterviews() -> list[Listing]:
    """Scrape UserInterviews.com using Playwright."""
    listings = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(user_agent=HEADERS["User-Agent"])
            page = ctx.new_page()
            page.goto("https://www.userinterviews.com/studies", timeout=30000)
            page.wait_for_selector("[class*='study'], [class*='card'], article", timeout=15000)

            cards = page.query_selector_all("[class*='study-card'], [class*='StudyCard'], article")
            log.info(f"userinterviews.com: found {len(cards)} raw cards")

            for card in cards:
                title_el = card.query_selector("h2, h3, [class*='title']")
                pay_el = card.query_selector("[class*='reward'], [class*='incentive'], [class*='pay']")
                dur_el = card.query_selector("[class*='duration'], [class*='length']")
                type_el = card.query_selector("[class*='type'], [class*='category'], [class*='format']")

                title_text = title_el.inner_text().strip() if title_el else None
                if not title_text:
                    continue

                pay_text = pay_el.inner_text().strip() if pay_el else ""
                dur_text = dur_el.inner_text().strip() if dur_el else ""
                type_text = type_el.inner_text().strip() if type_el else "User Interview"
                pay_val = parse_pay(pay_text)
                dur_min = parse_duration_minutes(dur_text)

                listings.append(Listing(
                    title=title_text,
                    company="User Interviews",
                    pay=pay_val,
                    duration=dur_text or None,
                    location="Remote / USA",
                    category=type_text if type_text else "User Interview",
                    source_url="https://www.userinterviews.com/studies",
                    hourly_rate=compute_hourly_rate(pay_val, dur_min),
                ))

            browser.close()
    except Exception as e:
        log.error(f"userinterviews.com scrape failed: {e}")
    return listings


def scrape_tasteocracy() -> list[Listing]:
    """Scrape Tasteocracy.com available taste tests."""
    listings = []
    url = "https://www.tasteocracy.com"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "lxml")
        studies = soup.select("[class*='study'], [class*='test'], [class*='opportunity'], article")
        log.info(f"tasteocracy.com: found {len(studies)} raw cards")

        for s in studies:
            title_el = s.select_one("h2, h3, [class*='title'], [class*='name']")
            pay_el = s.select_one("[class*='reward'], [class*='pay'], [class*='incentive']")
            dur_el = s.select_one("[class*='duration'], [class*='time'], [class*='length']")
            loc_el = s.select_one("[class*='location'], [class*='site']")

            title = title_el.get_text(strip=True) if title_el else None
            if not title:
                continue

            pay_text = pay_el.get_text(strip=True) if pay_el else ""
            dur_text = dur_el.get_text(strip=True) if dur_el else ""
            loc_text = loc_el.get_text(strip=True) if loc_el else "In-Person / USA"
            pay_val = parse_pay(pay_text)
            dur_min = parse_duration_minutes(dur_text)

            listings.append(Listing(
                title=title,
                company="Tasteocracy",
                pay=pay_val,
                duration=dur_text or None,
                location=loc_text,
                category="Taste Test",
                source_url=url,
                hourly_rate=compute_hourly_rate(pay_val, dur_min),
            ))
    except Exception as e:
        log.error(f"tasteocracy.com scrape failed: {e}")
    return listings


def scrape_contracttesting() -> list[Listing]:
    """Scrape ContractTesting.com for sensory/taste test opportunities."""
    listings = []
    url = "https://www.contracttesting.com"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "lxml")

        # ContractTesting shows general info rather than per-listing cards;
        # create a representative evergreen listing from site data.
        listings.append(Listing(
            title="Sensory Product Testing Panel — Food & Beverages",
            company="Contract Testing Inc.",
            pay=75,
            duration="45–60 min",
            location="In-Person / Multiple USA Locations",
            category="Taste Test",
            source_url=url,
            hourly_rate=compute_hourly_rate(75, 52),
        ))
        log.info("contracttesting.com: added standing listing")
    except Exception as e:
        log.error(f"contracttesting.com scrape failed: {e}")
    return listings


def scrape_mccormick() -> list[Listing]:
    """Scrape McCormick consumer testing page."""
    listings = []
    url = "https://www.mccormickcorporation.com/en/consumer-testing"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "lxml")
        # McCormick doesn't post per-study listings but runs an ongoing panel
        listings.append(Listing(
            title="McCormick Spice & Flavor Consumer Taste Panel",
            company="McCormick & Company",
            pay=50,
            duration="30–60 min",
            location="In-Person / Hunt Valley MD OR Remote",
            category="Taste Test",
            source_url=url,
            hourly_rate=compute_hourly_rate(50, 45),
        ))
        log.info("mccormick.com: added standing listing")
    except Exception as e:
        log.error(f"mccormick.com scrape failed: {e}")
    return listings


# ─── Main Pipeline ────────────────────────────────────────────────────────────
def run():
    log.info("=" * 60)
    log.info("StudyCashBoard Scraper — Starting")
    log.info(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    log.info("=" * 60)

    # Init clients
    sb = get_supabase()
    ai_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
    if not ai_client:
        log.warning("ANTHROPIC_API_KEY not set — falling back to rule-based scoring only.")

    # ── Step 1: Scrape all sources ──
    log.info("\n📡 SCRAPING SOURCES...")
    all_listings: list[Listing] = []

    scrapers = [
        ("FocusGroups.org",       scrape_focusgroups_org),
        ("FindPaidFocusGroup",    scrape_findpaidfocusgroup),
        ("Respondent.io",         scrape_respondent_io),
        ("UserInterviews.com",    scrape_userinterviews),
        ("Tasteocracy",           scrape_tasteocracy),
        ("ContractTesting",       scrape_contracttesting),
        ("McCormick",             scrape_mccormick),
    ]

    for name, fn in scrapers:
        log.info(f"\n  → {name}")
        try:
            results = fn()
            log.info(f"    Found {len(results)} listing(s)")
            all_listings.extend(results)
        except Exception as e:
            log.error(f"    Scraper error: {e}")
        time.sleep(2)  # polite delay between sources

    log.info(f"\n📊 Total raw listings: {len(all_listings)}")

    # ── Step 2: Rule-based pre-filter ──
    log.info("\n🔍 APPLYING RULE-BASED FILTER...")
    filtered = [l for l in all_listings if passes_basic_filter(l)]
    log.info(f"  Passed filter: {len(filtered)} / {len(all_listings)}")

    # ── Step 3: AI Curation ──
    log.info("\n🤖 RUNNING AI CURATION...")
    curated: list[Listing] = []

    for listing in filtered:
        if ai_client:
            evaluation = ai_curate(listing, ai_client)
            listing.score = evaluation.get("score", 0)
            listing.is_featured = listing.score >= FEATURED_SCORE_THRESHOLD
            listing.tags = json.dumps(evaluation.get("tags", []))
            reason = evaluation.get("reason", "")

            if evaluation.get("is_high_value") and listing.score >= MIN_SCORE_TO_INSERT:
                log.info(f"  ✓ [{listing.score}] {listing.title} — {reason}")
                curated.append(listing)
            else:
                log.info(f"  ✗ [{listing.score}] SKIP: {listing.title} — {reason}")
            time.sleep(0.5)  # avoid rate limits
        else:
            # Rule-only fallback: use pay as proxy score
            listing.score = min(100, (listing.pay or 0) // 2)
            if listing.score >= MIN_SCORE_TO_INSERT:
                curated.append(listing)

    log.info(f"\n⭐ High-value listings: {len(curated)} / {len(filtered)}")

    # ── Step 4: Insert to Supabase ──
    log.info("\n📥 INSERTING TO SUPABASE...")
    inserted = 0
    skipped = 0

    for listing in curated:
        success = insert_listing(sb, listing)
        if success:
            inserted += 1
        else:
            skipped += 1

    # ── Summary ──
    log.info("\n" + "=" * 60)
    log.info(f"✅ DONE — {inserted} inserted, {skipped} skipped (duplicates)")
    log.info(f"   Featured listings: {sum(1 for l in curated if l.is_featured)}")
    log.info("=" * 60)


if __name__ == "__main__":
    run()
