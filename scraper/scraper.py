"""
StudyCashBoard — Production Scraper (requests-only, no Playwright)
Runs daily via GitHub Actions. Scrapes sources, curates with Claude AI,
upserts to Supabase, and expires stale listings automatically.
"""

import os, re, json, time, logging
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from typing import Optional

import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
import anthropic

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("scb")

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL      = os.environ["SUPABASE_URL"]
SUPABASE_KEY      = os.environ["SUPABASE_KEY"]
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

MIN_SCORE         = 50
FEATURED_SCORE    = 75
MIN_PAY           = 15
EXPIRE_AFTER_DAYS = 4

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

# ── Data model ────────────────────────────────────────────────────────────────
@dataclass
class Listing:
    title:       str
    company:     str
    description: str = ""
    pay:         Optional[int] = None
    pay_max:     Optional[int] = None
    duration:    Optional[str] = None
    location:    str = "Remote / USA"
    category:    str = "Focus Group"
    source_url:  str = ""
    apply_url:   str = ""
    tags:        list = field(default_factory=list)
    score:       int = 0
    hourly_rate: Optional[int] = None
    is_featured: bool = False
    expires_at:  Optional[str] = None

# ── Supabase helpers ──────────────────────────────────────────────────────────
def get_sb() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def upsert_listing(sb: Client, l: Listing) -> str:
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "Title":       l.title,
        "Company":     l.company,
        "Description": l.description,
        "Pay":         l.pay,
        "Pay_Max":     l.pay_max,
        "Duration":    l.duration,
        "Location":    l.location,
        "Category":    l.category,
        "Source_URL":  l.source_url,
        "Apply_URL":   l.apply_url,
        "Score":       l.score,
        "Hourly_Rate": l.hourly_rate,
        "Is_Featured": l.is_featured,
        "Tags":        l.tags,
        "Status":      "active",
        "Last_Seen":   now,
        "Expires_At":  l.expires_at,
    }
    try:
        existing = sb.table("Listings").select("id")\
            .eq("Title", l.title).eq("Company", l.company).execute()
        if existing.data:
            sb.table("Listings").update({**row, "updated_at": now})\
                .eq("id", existing.data[0]["id"]).execute()
            return "updated"
        else:
            row["First_Seen"] = now
            sb.table("Listings").insert(row).execute()
            return "inserted"
    except Exception as e:
        log.error(f"  DB error for '{l.title}': {e}")
        return "skipped"

def expire_stale(sb: Client) -> int:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=EXPIRE_AFTER_DAYS)).isoformat()
    try:
        res = sb.table("Listings").update({"Status": "expired"})\
            .eq("Status", "active").lt("Last_Seen", cutoff).execute()
        count = len(res.data) if res.data else 0
        log.info(f"  Expired {count} stale listings")
        return count
    except Exception as e:
        log.error(f"  Expire error: {e}")
        return 0

# ── Parsing helpers ───────────────────────────────────────────────────────────
def parse_pay(text: str):
    if not text: return None, None
    nums = [int(n.replace(",","")) for n in re.findall(r"\d[\d,]*", text) if int(n.replace(",","")) < 10000]
    if not nums: return None, None
    return min(nums), max(nums) if len(nums) > 1 else None

def parse_minutes(text: str):
    if not text: return None
    rng = re.search(r"(\d+)\s*[-–]\s*(\d+)\s*(min|hour|hr)?", text, re.I)
    if rng:
        avg = (int(rng.group(1)) + int(rng.group(2))) / 2
        return int(avg * 60 if (rng.group(3) or "").startswith(("h","H")) else avg)
    single = re.search(r"(\d+(?:\.\d+)?)\s*(min|hour|hr)?", text, re.I)
    if single:
        val = float(single.group(1))
        return int(val * 60 if (single.group(2) or "").startswith(("h","H")) else val)
    return None

def hourly(pay, mins):
    if pay and mins and mins > 0: return int((pay / mins) * 60)
    return None

def expires_iso(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()

def category_from_text(text: str) -> str:
    t = text.lower()
    if any(w in t for w in ["taste","food","beverage","snack","flavor","sensory","culinary"]): return "Taste Test"
    if any(w in t for w in ["mock jury","mock trial","legal","jury","litigation"]): return "Mock Jury"
    if any(w in t for w in ["app","website","software","ux","ui","usability","prototype"]): return "App & UX Testing"
    if any(w in t for w in ["medical","health","clinical","patient","pharma","drug","wellness"]): return "Medical & Health"
    if any(w in t for w in ["finance","bank","invest","credit","insurance","fintech"]): return "Finance"
    if any(w in t for w in ["ai","machine learning","chatbot","artificial intelligence"]): return "AI & Tech"
    if any(w in t for w in ["travel","hotel","airline","booking","vacation"]): return "Travel"
    if any(w in t for w in ["automotive","car","vehicle","ev","electric vehicle","driving"]): return "Automotive"
    if any(w in t for w in ["education","learning","student","tutor","school"]): return "Education"
    if any(w in t for w in ["gaming","video game","esport","console","mobile game"]): return "Gaming"
    if any(w in t for w in ["retail","shopping","fashion","clothing","beauty","cosmetic"]): return "Retail & Lifestyle"
    if any(w in t for w in ["home","real estate","smart home","appliance","furniture"]): return "Home & Living"
    if any(w in t for w in ["user interview","one-on-one","interview","in-depth"]): return "User Interview"
    if any(w in t for w in ["focus group","group discussion","panel","roundtable"]): return "Focus Group"
    if any(w in t for w in ["survey","questionnaire","poll","online study"]): return "Online Survey"
    return "Focus Group"

def fetch(url: str) -> Optional[BeautifulSoup]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        return BeautifulSoup(r.text, "lxml")
    except Exception as e:
        log.error(f"  Fetch failed ({url}): {e}")
        return None

# ── AI Curation ───────────────────────────────────────────────────────────────
def ai_curate(listings: list, client) -> list:
    curated = []
    for l in listings:
        prompt = f"""You are a curation assistant for StudyCashBoard.com.

Evaluate this paid research listing and return ONLY valid JSON, no markdown:

Title: {l.title}
Company: {l.company}
Pay: ${l.pay}{"–$"+str(l.pay_max) if l.pay_max else ""}
Duration: {l.duration or "unknown"}
Location: {l.location}
Category: {l.category}

Return exactly:
{{
  "score": <0-100>,
  "is_featured": <true if score>=75>,
  "description": "<2-3 engaging sentences about what this study involves, who qualifies, and why it's worth doing. Friendly tone, general audience.>",
  "tags": ["<tag1>","<tag2>"],
  "category": "<best fit from: User Interview|Focus Group|Taste Test|Mock Jury|App & UX Testing|Medical & Health|Finance|AI & Tech|Travel|Automotive|Education|Gaming|Retail & Lifestyle|Home & Living|Online Survey|Product Testing>",
  "expires_days": <3-14>
}}

Score guide: 80-100=exceptional pay+short time+remote, 60-79=good value, 40-59=average, 0-39=poor
Tags: remote, in-person, quick-win, high-pay, family-friendly, beginner-friendly, food-lover, tech-savvy, nationwide, no-experience-needed, 1-hour-or-less, same-week-pay"""

        try:
            resp = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}]
            )
            text = resp.content[0].text.strip()
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
            data = json.loads(text)
            l.score       = int(data.get("score", 40))
            l.is_featured = l.score >= FEATURED_SCORE
            l.description = data.get("description", "")
            l.tags        = data.get("tags", [])
            l.category    = data.get("category", l.category)
            l.expires_at  = expires_iso(int(data.get("expires_days", 7)))
            if l.score >= MIN_SCORE:
                curated.append(l)
                log.info(f"  ✓ [{l.score}] {l.title[:60]}")
            else:
                log.info(f"  ✗ [{l.score}] SKIP: {l.title[:60]}")
            time.sleep(0.4)
        except Exception as e:
            log.warning(f"  AI error for '{l.title}': {e}")
            l.score = min(65, (l.pay or 0) // 3)
            l.description = f"A paid {l.category.lower()} opportunity with {l.company}. Participants share opinions and get compensated for their time."
            l.expires_at = expires_iso(7)
            if l.score >= MIN_SCORE:
                curated.append(l)
    return curated

# ── Scrapers ──────────────────────────────────────────────────────────────────

def scrape_focusgroups_org() -> list:
    listings = []
    soup = fetch("https://focusgroups.org/studies")
    if not soup: return listings
    for card in soup.select("article, .study-card, [class*='listing'], [class*='study']"):
        title_el = card.select_one("h2,h3,[class*='title']")
        pay_el   = card.select_one("[class*='pay'],[class*='reward'],[class*='incentive']")
        dur_el   = card.select_one("[class*='duration'],[class*='time']")
        title = title_el.get_text(strip=True) if title_el else None
        if not title or len(title) < 8: continue
        pmin, pmax = parse_pay(pay_el.get_text(strip=True) if pay_el else "")
        dur_text = dur_el.get_text(strip=True) if dur_el else None
        listings.append(Listing(
            title=title, company="FocusGroups.org",
            pay=pmin, pay_max=pmax, duration=dur_text,
            location="Remote / USA", category=category_from_text(title),
            source_url="https://focusgroups.org",
            hourly_rate=hourly(pmin, parse_minutes(dur_text)),
        ))
    log.info(f"  focusgroups.org → {len(listings)}")
    return listings

def scrape_findpaidfocusgroup() -> list:
    listings = []
    soup = fetch("https://www.findpaidfocusgroup.com/latest-paid-focus-groups/")
    if not soup: return listings
    for post in soup.select("article, .post, [class*='listing']"):
        title_el = post.select_one("h1,h2,h3,.entry-title")
        title = title_el.get_text(strip=True) if title_el else None
        if not title or len(title) < 8: continue
        pmin, pmax = parse_pay(post.get_text())
        link = post.select_one("a")
        listings.append(Listing(
            title=title, company="FindPaidFocusGroup",
            pay=pmin, pay_max=pmax,
            location="Nationwide USA",
            category=category_from_text(title),
            source_url="https://www.findpaidfocusgroup.com",
            apply_url=link["href"] if link and link.get("href") else "",
            hourly_rate=hourly(pmin, 60),
        ))
    log.info(f"  findpaidfocusgroup → {len(listings)}")
    return listings

def scrape_findfocusgroups() -> list:
    listings = []
    soup = fetch("https://www.findfocusgroups.com")
    if not soup: return listings
    for card in soup.select("article, .listing, [class*='study'], [class*='focus']"):
        title_el = card.select_one("h2,h3,[class*='title']")
        pay_el   = card.select_one("[class*='pay'],[class*='reward']")
        title = title_el.get_text(strip=True) if title_el else None
        if not title or len(title) < 8: continue
        pmin, pmax = parse_pay(pay_el.get_text(strip=True) if pay_el else post.get_text() if (post := card) else "")
        listings.append(Listing(
            title=title, company="FindFocusGroups",
            pay=pmin, pay_max=pmax,
            location="Remote / USA",
            category=category_from_text(title),
            source_url="https://www.findfocusgroups.com",
            hourly_rate=hourly(pmin, 60),
        ))
    log.info(f"  findfocusgroups → {len(listings)}")
    return listings

def get_evergreen_listings() -> list:
    """High-quality standing listings from known panels and companies."""
    return [
        Listing(
            title="AI Productivity & Workflow User Interview",
            company="Respondent",
            pay=200, pay_max=400, duration="60 min",
            location="Remote / USA", category="AI & Tech",
            source_url="https://app.respondent.io",
            apply_url="https://app.respondent.io",
            hourly_rate=300,
        ),
        Listing(
            title="Banking & Fintech Consumer Focus Group",
            company="User Interviews",
            pay=150, pay_max=300, duration="75–90 min",
            location="Remote / USA", category="Finance",
            source_url="https://www.userinterviews.com",
            apply_url="https://www.userinterviews.com/studies",
            hourly_rate=150,
        ),
        Listing(
            title="Sensory & Taste Testing Panel — Food & Beverages",
            company="Contract Testing Inc.",
            pay=35, pay_max=100, duration="45–90 min",
            location="In-Person / 19 USA & Canada Locations",
            category="Taste Test",
            source_url="https://www.contracttesting.com",
            apply_url="https://www.contracttesting.com/register",
            hourly_rate=55,
        ),
        Listing(
            title="McCormick Spice & Flavor Consumer Taste Panel",
            company="McCormick & Company",
            pay=50, pay_max=100, duration="30–60 min",
            location="In-Person / Hunt Valley MD + Remote",
            category="Taste Test",
            source_url="https://www.mccormickcorporation.com/en/consumer-testing",
            apply_url="https://www.mccormickcorporation.com/en/consumer-testing",
            hourly_rate=75,
        ),
        Listing(
            title="Mock Jury Research Study — Civil & Criminal Cases",
            company="DecisionQuest",
            pay=100, pay_max=300, duration="2–4 hours",
            location="In-Person / Major US Cities + Remote",
            category="Mock Jury",
            source_url="https://www.decisionquest.com",
            apply_url="https://www.decisionquest.com",
            hourly_rate=75,
        ),
        Listing(
            title="Healthcare App UX Research Study",
            company="User Interviews",
            pay=150, pay_max=250, duration="45–60 min",
            location="Remote / USA", category="Medical & Health",
            source_url="https://www.userinterviews.com",
            apply_url="https://www.userinterviews.com/studies",
            hourly_rate=180,
        ),
        Listing(
            title="Automotive Feature Testing — New Vehicle UX",
            company="Respondent",
            pay=150, pay_max=300, duration="60–90 min",
            location="Remote / USA", category="Automotive",
            source_url="https://app.respondent.io",
            apply_url="https://app.respondent.io",
            hourly_rate=150,
        ),
        Listing(
            title="Video Game Playtesting — Unreleased Titles",
            company="Electronic Arts",
            pay=50, pay_max=150, duration="2–3 hours",
            location="Remote / USA", category="Gaming",
            source_url="https://playtest.ea.com",
            apply_url="https://playtest.ea.com",
            hourly_rate=50,
        ),
        Listing(
            title="Education Technology — Parent & Student Research Panel",
            company="User Interviews",
            pay=75, pay_max=200, duration="45–60 min",
            location="Remote / USA", category="Education",
            source_url="https://www.userinterviews.com",
            apply_url="https://www.userinterviews.com/studies",
            hourly_rate=100,
        ),
        Listing(
            title="Travel Booking & Planning Consumer Study",
            company="Respondent",
            pay=125, pay_max=250, duration="60 min",
            location="Remote / USA", category="Travel",
            source_url="https://app.respondent.io",
            apply_url="https://app.respondent.io",
            hourly_rate=150,
        ),
        Listing(
            title="Fashion & Retail Shopping Habits Focus Group",
            company="FindPaidFocusGroup",
            pay=100, pay_max=200, duration="90 min",
            location="Remote / USA", category="Retail & Lifestyle",
            source_url="https://www.findpaidfocusgroup.com",
            apply_url="https://www.findpaidfocusgroup.com",
            hourly_rate=100,
        ),
        Listing(
            title="Smart Home Device Usability Study",
            company="User Interviews",
            pay=100, pay_max=200, duration="60 min",
            location="Remote / USA", category="Home & Living",
            source_url="https://www.userinterviews.com",
            apply_url="https://www.userinterviews.com/studies",
            hourly_rate=120,
        ),
        Listing(
            title="Nielsen Consumer Household Purchase Panel",
            company="Nielsen",
            pay=50, pay_max=200, duration="Ongoing — scan at home",
            location="Remote / USA", category="Product Testing",
            source_url="https://www.nielsen.com/us/en/nielsen-consumer-panel/",
            apply_url="https://www.nielsen.com/us/en/nielsen-consumer-panel/",
        ),
        Listing(
            title="Ipsos iSay — Online Consumer Survey Panel",
            company="Ipsos",
            pay=5, pay_max=50, duration="10–30 min per survey",
            location="Remote / Global", category="Online Survey",
            source_url="https://www.ipsosisay.com",
            apply_url="https://www.ipsosisay.com",
            hourly_rate=15,
        ),
        Listing(
            title="In-Person Focus Group Studies — Multiple Topics",
            company="Fieldwork",
            pay=75, pay_max=250, duration="60–120 min",
            location="In-Person / Atlanta, Chicago, Dallas, NYC, LA",
            category="Focus Group",
            source_url="https://www.fieldwork.com/participate/",
            apply_url="https://www.fieldwork.com/participate/",
            hourly_rate=100,
        ),
        Listing(
            title="Medical & Pharmaceutical Clinical Research Studies",
            company="ICON Clinical Research",
            pay=100, pay_max=1500, duration="Varies",
            location="In-Person / USA", category="Medical & Health",
            source_url="https://www.iconplc.com",
            apply_url="https://www.iconplc.com",
            hourly_rate=80,
        ),
        Listing(
            title="Tasteocracy Consumer Taste Testing Panel",
            company="Tasteocracy",
            pay=40, pay_max=120, duration="30–90 min",
            location="In-Person / Minneapolis MN, Livermore CA, Bound Brook NJ",
            category="Taste Test",
            source_url="https://www.tasteocracy.com",
            apply_url="https://www.tasteocracy.com",
            hourly_rate=60,
        ),
        Listing(
            title="Software & App Beta Testing Diary Study",
            company="UserTesting",
            pay=10, pay_max=60, duration="15–30 min",
            location="Remote / USA", category="App & UX Testing",
            source_url="https://www.usertesting.com",
            apply_url="https://www.usertesting.com/be-a-user-tester",
            hourly_rate=30,
        ),
    ]

# ── Main pipeline ─────────────────────────────────────────────────────────────
def run():
    log.info("=" * 60)
    log.info("StudyCashBoard Scraper — Starting")
    log.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    log.info("=" * 60)

    sb = get_sb()
    ai = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY and ANTHROPIC_API_KEY != "skip" else None
    if not ai:
        log.warning("No AI client — using rule-based scoring")

    # Step 1: Scrape
    log.info("\n📡 SCRAPING...")
    raw = []
    for name, fn in [
        ("FocusGroups.org",     scrape_focusgroups_org),
        ("FindPaidFocusGroup",  scrape_findpaidfocusgroup),
        ("FindFocusGroups",     scrape_findfocusgroups),
        ("Evergreen Listings",  get_evergreen_listings),
    ]:
        log.info(f"\n  → {name}")
        try:
            results = fn()
            raw.extend(results)
        except Exception as e:
            log.error(f"    Error: {e}")
        time.sleep(1)

    log.info(f"\n📊 Raw: {len(raw)}")

    # Step 2: Filter
    filtered = [l for l in raw if l.title and len(l.title) >= 8 and (l.pay is None or l.pay >= MIN_PAY)]
    log.info(f"🔍 Filtered: {len(filtered)}")

    # Step 3: Curate
    log.info("\n🤖 CURATING...")
    if ai:
        curated = ai_curate(filtered, ai)
    else:
        for l in filtered:
            l.score = min(70, ((l.pay or 0) + (l.pay_max or 0)) // 4)
            l.is_featured = l.score >= FEATURED_SCORE
            l.description = f"A paid {l.category.lower()} opportunity with {l.company}. Participants share opinions and are compensated for their time and feedback."
            l.expires_at = expires_iso(7)
        curated = [l for l in filtered if l.score >= MIN_SCORE]

    log.info(f"⭐ Curated: {len(curated)}")

    # Step 4: Upsert
    log.info("\n📥 UPSERTING...")
    inserted = updated = skipped = 0
    for l in curated:
        result = upsert_listing(sb, l)
        if result == "inserted": inserted += 1
        elif result == "updated": updated += 1
        else: skipped += 1

    # Step 5: Expire stale
    log.info("\n🗑  EXPIRING STALE...")
    expired = expire_stale(sb)

    log.info("\n" + "=" * 60)
    log.info(f"✅ DONE — inserted={inserted} updated={updated} skipped={skipped} expired={expired}")
    log.info("=" * 60)

if __name__ == "__main__":
    run()
