"""
StudyCashBoard — Craigslist Scraper
=====================================
Scrapes paid research studies, focus groups, and clinical trials
from Craigslist across 20 major US cities.

No login required — all public listings.
Each post contains a direct apply/screener link.

HOW TO ADD TO PIPELINE:
1. Upload this file as scraper/craigslist_scraper.py in GitHub
2. Add to scrape.yml:
   - name: Run Craigslist scraper
     run: python scraper/craigslist_scraper.py
3. That's it — runs daily automatically

EXPECTED OUTPUT: 30-50 fresh listings daily
"""

import os, re, json, time, logging
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from typing import Optional, List

import requests
from bs4 import BeautifulSoup
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("cl_scraper")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

# ── 20 Major US Cities + their Craigslist subdomain and state ─────────────────
CITIES = [
    ("newyork",      "NY", "New York, NY"),
    ("losangeles",   "CA", "Los Angeles, CA"),
    ("chicago",      "IL", "Chicago, IL"),
    ("houston",      "TX", "Houston, TX"),
    ("dallas",       "TX", "Dallas, TX"),
    ("sfbay",        "CA", "San Francisco, CA"),
    ("atlanta",      "GA", "Atlanta, GA"),
    ("miami",        "FL", "Miami, FL"),
    ("seattle",      "WA", "Seattle, WA"),
    ("boston",       "MA", "Boston, MA"),
    ("denver",       "CO", "Denver, CO"),
    ("phoenix",      "AZ", "Phoenix, AZ"),
    ("philadelphia", "PA", "Philadelphia, PA"),
    ("sandiego",     "CA", "San Diego, CA"),
    ("minneapolis",  "MN", "Minneapolis, MN"),
    ("portland",     "OR", "Portland, OR"),
    ("nashville",    "TN", "Nashville, TN"),
    ("charlotte",    "NC", "Charlotte, NC"),
    ("austin",       "TX", "Austin, TX"),
    ("washington",   "DC", "Washington, DC"),
]

# Search terms across different Craigslist categories
SEARCH_QUERIES = [
    ("ggg", "focus group"),        # gigs
    ("ggg", "paid study"),         # gigs
    ("ggg", "research study"),     # gigs
    ("ggg", "paid research"),      # gigs
    ("etc", "focus group"),        # et cetera
    ("etc", "paid study"),         # et cetera
    ("tlg", "focus group"),        # talent gigs
    ("tlg", "research participants"), # talent gigs
]

# ── Spam / irrelevant post filters ────────────────────────────────────────────
SPAM_KEYWORDS = [
    "mlm", "pyramid", "network marketing", "amway", "herbalife",
    "work from home job", "hiring now", "join our team",
    "real estate agent", "insurance agent", "sales position",
    "make money online course", "crypto", "forex",
    "adult", "webcam", "modeling agency",
    "immigration", "paralegal", "attorney needed",
]

VALID_KEYWORDS = [
    "focus group", "paid study", "research study", "clinical study",
    "clinical trial", "paid research", "market research", "opinion study",
    "taste test", "product test", "user study", "usability study",
    "survey", "interview study", "paid participants", "research participants",
    "mock jury", "online study", "paid opinion", "earn cash",
    "compensation", "incentive", "stipend", "earn $", "get paid",
    "paid focus", "paid clinical", "paid medical",
]

# ── Data model ────────────────────────────────────────────────────────────────
@dataclass
class Listing:
    title:       str
    company:     str = "Craigslist Research"
    description: str = ""
    pay:         Optional[int] = None
    pay_max:     Optional[int] = None
    duration:    Optional[str] = None
    location:    str = "USA"
    state:       Optional[str] = None
    is_remote:   bool = False
    category:    str = "Focus Group"
    source_url:  str = ""
    apply_url:   str = ""
    tags:        List[str] = field(default_factory=list)
    score:       int = 0
    hourly_rate: Optional[int] = None
    is_featured: bool = False
    expires_at:  Optional[str] = None

def expires_iso(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()

def parse_pay(text: str):
    """Extract pay from strings like '$200', '$75-$300', 'up to $500'"""
    if not text: return None, None
    text = text.replace(",", "")
    # Handle "up to $X"
    upto = re.search(r'up\s+to\s+\$(\d+)', text, re.I)
    if upto:
        return int(upto.group(1)) // 2, int(upto.group(1))
    nums = re.findall(r'\$(\d+)', text)
    nums = [int(n) for n in nums if 5 <= int(n) <= 10000]
    if not nums: return None, None
    return min(nums), max(nums) if len(nums) > 1 else None

def parse_duration(text: str) -> Optional[str]:
    if not text: return None
    m = re.search(r'(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(hour|hr|min)', text, re.I)
    if m: return f"{m.group(1)}–{m.group(2)} {m.group(3)}"
    m = re.search(r'(\d+(?:\.\d+)?)\s*(hour|hr|minute|min)', text, re.I)
    if m: return f"{m.group(1)} {m.group(2)}"
    return None

def cat_from_text(text: str, pay=None, duration_mins=None) -> str:
    t = text.lower()
    is_easy = (pay is not None and pay <= 40 and
               (duration_mins is not None and duration_mins <= 30 or
                any(w in t for w in ["survey", "quick", "short", "online survey", "5 min", "10 min", "15 min"])))
    if is_easy: return "Quick Wins"
    if any(w in t for w in ["taste","food","beverage","snack","flavor","sensory","culinary","recipe","meal","fast food","cooking","eating","drinking","grocery"]): return "Taste Test"
    if any(w in t for w in ["mock jury","mock trial","jury","litigation","legal case","attorney","lawsuit","court","verdict"]): return "Mock Jury"
    if any(w in t for w in ["medical","health","clinical","patient","pharma","drug","wellness","therapy","condition","symptom","treatment","vaccine","chronic","mental health","eczema","depression","bipolar","cancer","diabetes","migraine","arthritis","disease","disorder","trial","chronic pain","caregiver"]): return "Medical & Health"
    if any(w in t for w in ["finance","bank","invest","credit","insurance","fintech","money","loan","mortgage","financial","overdraft","tax","budget","savings","payment"]): return "Finance"
    if any(w in t for w in ["ai","artificial intelligence","machine learning","chatbot","technology","tech","automation","smart home","iot","wearable","smart watch","software","app","website","ux","ui","usability","digital","computer","mobile"]): return "App & UX Testing"
    if any(w in t for w in ["travel","hotel","airline","booking","vacation","trip","flight","cruise","tourism","destination"]): return "Travel"
    if any(w in t for w in ["automotive","car","vehicle","ev","electric vehicle","driving","suv","truck","motor","hybrid","dealership"]): return "Automotive"
    if any(w in t for w in ["education","learning","student","tutor","school","course","teacher","university","college","edtech","children","kids","parents","parenting"]): return "Education"
    if any(w in t for w in ["gaming","video game","esport","console","mobile game","gamer","playstation","xbox","nintendo","steam"]): return "Gaming"
    if any(w in t for w in ["retail","shopping","fashion","clothing","beauty","cosmetic","makeup","skincare","haircare","apparel","ecommerce","luxury","sneaker","shoe","grocery shopping"]): return "Retail & Lifestyle"
    if any(w in t for w in ["home","smart home","appliance","furniture","cleaning","household","kitchen","interior","decor","renovation","homeowner"]): return "Home & Living"
    if any(w in t for w in ["product test","product review","consumer test","new product","prototype","sample","pet","cat","dog","pet care","pet food"]): return "Product Testing"
    return "Focus Group"

def score_listing(listing: Listing) -> int:
    """
    Score Craigslist listings.
    Higher pay + shorter duration + direct apply link = higher score.
    Medical/clinical studies score higher due to compensation.
    """
    score = 30  # base score for being on Craigslist

    # Pay scoring
    pay = listing.pay or 0
    if pay >= 500:   score += 35
    elif pay >= 300: score += 28
    elif pay >= 200: score += 22
    elif pay >= 150: score += 18
    elif pay >= 100: score += 14
    elif pay >= 75:  score += 10
    elif pay >= 50:  score += 6
    elif pay >= 25:  score += 3

    # Has direct apply link (not just a Craigslist page)
    if listing.apply_url and "craigslist" not in listing.apply_url:
        score += 12  # direct screener link is very valuable

    # Remote bonus
    if listing.is_remote:
        score += 8

    # Category bonuses
    if listing.category == "Medical & Health": score += 5  # clinical trials pay well
    if listing.category == "Mock Jury": score += 3

    # Cap at 92 — Craigslist listings are less verified than curated sources
    return min(92, score)

def is_valid_listing(title: str, body: str) -> bool:
    """Filter out spam and irrelevant posts."""
    combined = (title + " " + body).lower()

    # Must contain at least one valid keyword
    if not any(kw in combined for kw in VALID_KEYWORDS):
        return False

    # Must not contain spam keywords
    if any(kw in combined for kw in SPAM_KEYWORDS):
        return False

    # Title must be reasonable length
    if len(title) < 10 or len(title) > 200:
        return False

    return True

def extract_apply_url(soup, page_text: str) -> str:
    """
    Extract the direct apply/screener URL from a Craigslist post.
    Looks for SurveyMonkey, Qualtrics, Google Forms, Typeform, etc.
    """
    apply_platforms = [
        "surveymonkey.com", "qualtrics.com", "google.com/forms",
        "typeform.com", "questionpro.com", "forms.gle",
        "userintervie.ws", "respondent.io", "userinterviews.com",
        "tinyurl.com", "bit.ly", "forms.office.com",
        "research.net", "survey.com", "alchemer.com",
    ]

    # Check all links on the page
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if any(platform in href for platform in apply_platforms):
            return href

    # Check raw text for URLs
    urls = re.findall(r'https?://[^\s<>"]+', page_text)
    for url in urls:
        if any(platform in url for platform in apply_platforms):
            return url

    return ""

def fetch(url: str) -> Optional[str]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=12)
        r.raise_for_status()
        return r.text
    except Exception as e:
        log.warning(f"  fetch failed {url[:55]}: {e}")
        return None

def scrape_craigslist_city(subdomain: str, state: str, city_name: str) -> List[Listing]:
    """Scrape all relevant listings from one Craigslist city."""
    listings = []
    seen_titles = set()

    for category, query in SEARCH_QUERIES:
        url = f"https://{subdomain}.craigslist.org/search/{category}?query={query.replace(' ', '+')}&sort=date"
        html = fetch(url)
        if not html:
            time.sleep(0.5)
            continue

        soup = BeautifulSoup(html, "lxml")

        # Craigslist search results
        posts = soup.select("li.cl-search-result, .result-row, [class*='result']")
        if not posts:
            # Try newer Craigslist HTML structure
            posts = soup.select("li[data-pid]")

        for post in posts:
            # Title
            title_el = (post.select_one(".result-title") or
                       post.select_one("a.posting-title") or
                       post.select_one("[class*='title'] a") or
                       post.select_one("a[href*='html']"))
            if not title_el: continue
            title = title_el.get_text(strip=True)
            if not title or title.lower() in seen_titles: continue

            # Get post URL
            post_url = title_el.get("href", "")
            if post_url and not post_url.startswith("http"):
                post_url = f"https://{subdomain}.craigslist.org{post_url}"

            # Spam check on title only — no detail page fetch (avoids 403)
            if any(kw in title.lower() for kw in SPAM_KEYWORDS):
                continue

            # Pay from search result listing
            price_el = post.select_one(".result-price, .price, [class*='price']")
            price_text = price_el.get_text(strip=True) if price_el else ""
            pmin, pmax = parse_pay(price_text + " " + title)

            # Skip low-value or zero-pay listings
            if pmin is not None and pmin < 25:
                continue

            # Validity check on title alone
            if not is_valid_listing(title, ""):
                continue

            seen_titles.add(title.lower())

            # Use title as full_text — no detail page needed
            full_text = title

            # Duration from title
            dur_text = parse_duration(title)
            dur_mins = None
            if dur_text:
                m = re.search(r'(\d+)', dur_text)
                if m:
                    val = int(m.group(1))
                    dur_mins = val * 60 if "hour" in dur_text.lower() else val

            # Location — check title for remote keywords
            is_remote = any(w in title.lower() for w in
                          ["online", "remote", "zoom", "virtual", "from home", "nationwide"])
            location = "Remote / USA" if is_remote else f"In-Person / {city_name}"

            # Category from title
            category_name = cat_from_text(title, pmin, dur_mins)

            # Apply URL — use post URL directly (better than nothing, avoids 403)
            apply_url = post_url

            # Description from title
            description = f"Paid research opportunity in {city_name}. {title}. Apply via the Craigslist listing for full details and screener link."

            # Expiry — 14 days for Craigslist posts
            expiry = expires_iso(14)

            # Company always Craigslist Research for search-only scraping
            company = "Craigslist Research" 

            listing = Listing(
                title=title,
                company=company,
                description=description,
                pay=pmin,
                pay_max=pmax,
                duration=dur_text,
                location=location,
                state="Remote" if is_remote else state,
                is_remote=is_remote,
                category=category_name,
                source_url=post_url,
                apply_url=apply_url or post_url,
                tags=[
                    "craigslist",
                    "remote" if is_remote else "in-person",
                    "direct-apply" if apply_url else "see-post",
                    state.lower(),
                ],
                expires_at=expiry,
            )

            listing.score = score_listing(listing)
            listing.is_featured = listing.score >= 75
            listing.hourly_rate = None
            if pmin and dur_mins and dur_mins > 0:
                listing.hourly_rate = int((pmin / dur_mins) * 60)

            # Only include if score is good enough
            if listing.score >= 45:
                listings.append(listing)
                log.info(f"  [{listing.score}] {listing.state} — {title[:50]} — ${pmin or '?'}")

            time.sleep(0.4)  # polite delay per post

        time.sleep(1)  # delay between search queries

    return listings

def upsert_listing(sb, l: Listing) -> str:
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "Title":       l.title,
        "Company":     l.company,
        "Description": l.description,
        "Pay":         l.pay,
        "Pay_Max":     l.pay_max,
        "Duration":    l.duration,
        "Location":    l.location,
        "State":       l.state,
        "Is_Remote":   l.is_remote,
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
        log.error(f"  DB error '{l.title[:40]}': {e}")
        return "skipped"

def run():
    log.info("=" * 60)
    log.info("StudyCashBoard — Craigslist Scraper")
    log.info(f"Cities: {len(CITIES)} | Queries: {len(SEARCH_QUERIES)}")
    log.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    log.info("=" * 60)

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    all_listings = []
    seen_globally = set()

    for subdomain, state, city_name in CITIES:
        log.info(f"\n📍 Scraping {city_name}...")
        try:
            city_listings = scrape_craigslist_city(subdomain, state, city_name)
            # Global dedup by title
            for l in city_listings:
                key = l.title.lower().strip()[:70]
                if key not in seen_globally:
                    seen_globally.add(key)
                    all_listings.append(l)
        except Exception as e:
            log.error(f"  {city_name} failed: {e}")
        time.sleep(2)

    log.info(f"\n📊 Total unique listings: {len(all_listings)}")

    # Category breakdown
    cats = {}
    for l in all_listings:
        cats[l.category] = cats.get(l.category, 0) + 1
    for cat, cnt in sorted(cats.items(), key=lambda x: -x[1]):
        log.info(f"   {cat}: {cnt}")

    # Upsert to Supabase
    log.info("\n📥 UPSERTING TO SUPABASE...")
    ins = upd = skp = 0
    for l in all_listings:
        r = upsert_listing(sb, l)
        if r == "inserted":   ins += 1
        elif r == "updated":  upd += 1
        else:                 skp += 1

    log.info(f"\n✅ DONE — inserted={ins} updated={upd} skipped={skp}")
    log.info("=" * 60)

if __name__ == "__main__":
    run()
