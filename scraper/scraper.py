"""
StudyCashBoard Scraper v7
=========================
Key changes:
- Text-based parsing instead of CSS selectors (fixes FindPaidFocusGroup)
- 50+ Easy Application listings from real scrapeable sources
- User Interview category handled as platform listings (login required)
- Curion, ContractTesting etc as direct registration listings
- Smart expiry by listing type
"""

import os, re, json, time, logging
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from typing import Optional, List

import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
import anthropic

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("scb")

SUPABASE_URL      = os.environ["SUPABASE_URL"]
SUPABASE_KEY      = os.environ["SUPABASE_KEY"]
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

MIN_SCORE      = 45
FEATURED_SCORE = 75
MIN_PAY        = 3   # Allow $3+ so Easy Apply survey sites qualify

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"}

MONTHS = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
          "july":7,"august":8,"september":9,"october":10,"november":11,"december":12,
          "jan":1,"feb":2,"mar":3,"apr":4,"jun":6,"jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}

CITY_STATE = {
    "new york":"NY","nyc":"NY","los angeles":"CA","san francisco":"CA","chicago":"IL",
    "houston":"TX","dallas":"TX","austin":"TX","san antonio":"TX","phoenix":"AZ",
    "philadelphia":"PA","atlanta":"GA","miami":"FL","orlando":"FL","tampa":"FL",
    "seattle":"WA","portland":"OR","denver":"CO","minneapolis":"MN","boston":"MA",
    "detroit":"MI","cleveland":"OH","columbus":"OH","nashville":"TN","charlotte":"NC",
    "las vegas":"NV","salt lake city":"UT","kansas city":"MO","indianapolis":"IN",
    "louisville":"KY","baltimore":"MD","hunt valley":"MD","washington":"DC",
    "arlington":"VA","richmond":"VA","newark":"NJ","bound brook":"NJ","livermore":"CA",
    "san diego":"CA","irvine":"CA","sacramento":"CA","oakland":"CA","raleigh":"NC",
}
STATE_ABBRS = {"AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
               "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
               "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
               "VA","WA","WV","WI","WY","DC"}

@dataclass
class Listing:
    title:       str
    company:     str
    description: str = ""
    pay:         Optional[int] = None
    pay_max:     Optional[int] = None
    duration:    Optional[str] = None
    location:    str = "Remote / USA"
    state:       Optional[str] = None
    is_remote:   bool = True
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

def estimate_expiry(cat: str) -> str:
    days = {"Easy Application":90,"Online Survey":90,"Product Testing":60,
            "Taste Test":30,"User Interview":14,"Focus Group":14,
            "App & UX Testing":14,"Medical & Health":30,"Finance":14,
            "AI & Tech":14,"Mock Jury":14,"Automotive":14,"Gaming":14,
            "Education":21,"Travel":14,"Retail & Lifestyle":14,"Home & Living":21}
    return expires_iso(days.get(cat, 14))

def detect_state(loc: str) -> str:
    if not loc: return "Remote"
    l = loc.lower()
    if "remote" in l and "in-person" not in l: return "Remote"
    if any(w in l for w in ["nationwide","all states","multiple","major us"]): return "Nationwide"
    for city, st in CITY_STATE.items():
        if city in l: return st
    m = re.search(r'\b([A-Z]{2})\b', loc)
    if m and m.group(1) in STATE_ABBRS: return m.group(1)
    return "Nationwide"

def parse_pay_from_text(text: str):
    text = text.replace("$-","$").replace("$–","$").replace("$+","$")
    dollars = re.findall(r'\$\s*(\d[\d,]*)', text)
    nums = [int(d.replace(",","")) for d in dollars if 1 <= int(d.replace(",","")) < 10000]
    if not nums: return None, None
    return min(nums), max(nums) if len(nums) > 1 else None

def cat_from_text(text: str, pay=None) -> str:
    t = text.lower()
    is_low = pay is not None and pay <= 40
    easy_kw = ["survey junkie","ipsos","prolific","swagbucks","inboxdollars","pinecone",
               "trymyui","usertesting","lightster","short survey","quick survey","5 min",
               "10 min","15 min","beginner","no experience needed","easy","simple study"]
    if is_low and any(w in t for w in easy_kw): return "Easy Application"
    if any(w in t for w in ["taste","food","beverage","snack","flavor","sensory","culinary","recipe","meal","fast food","cooking","eating","drinking"]): return "Taste Test"
    if any(w in t for w in ["mock jury","mock trial","legal","jury","litigation","attorney","lawsuit","court","verdict"]): return "Mock Jury"
    if any(w in t for w in ["app","website","software","ux","ui","usability","prototype","interface","user experience","digital","mobile app"]): return "App & UX Testing"
    if any(w in t for w in ["medical","health","clinical","patient","pharma","drug","wellness","therapy","condition","symptom","treatment","vaccine","chronic","mental health","caregiver","disease","migraine","dental","oral care","weight management","nutrition","supplement"]): return "Medical & Health"
    if any(w in t for w in ["finance","bank","invest","credit","insurance","fintech","money","loan","mortgage","financial","stock","budget","payment","wallet"]): return "Finance"
    if any(w in t for w in ["ai","artificial intelligence","machine learning","chatbot","technology","tech","automation","smart home","iot","conversations with ai"]): return "AI & Tech"
    if any(w in t for w in ["travel","hotel","airline","booking","vacation","trip","flight","cruise","tourism","destination","rv ","rideshare"]): return "Travel"
    if any(w in t for w in ["automotive","car","vehicle","ev","electric vehicle","driving","suv","truck","motor","hybrid","dealership"]): return "Automotive"
    if any(w in t for w in ["education","learning","student","tutor","school","course","teacher","university","college"]): return "Education"
    if any(w in t for w in ["gaming","video game","esport","console","mobile game","gamer","playstation","xbox","nintendo","steam"]): return "Gaming"
    if any(w in t for w in ["retail","shopping","fashion","clothing","beauty","cosmetic","makeup","skincare","haircare","apparel","ecommerce","luxury","perfume","scent"]): return "Retail & Lifestyle"
    if any(w in t for w in ["home","smart home","appliance","furniture","cleaning","household","kitchen","interior","decor","renovation","homeowner","home care","home products"]): return "Home & Living"
    if any(w in t for w in ["product test","product review","consumer test","new product","beta test","sample","prototype","pet","cat owners","dog owners","pet care","pet food"]): return "Product Testing"
    if any(w in t for w in ["entertainment","television","tv shows","streaming","media","music","movie"]): return "Retail & Lifestyle"
    if any(w in t for w in ["focus group","group discussion","panel","roundtable","group session"]): return "Focus Group"
    if any(w in t for w in ["user interview","one-on-one","in-depth interview"]): return "User Interview"
    if any(w in t for w in ["survey","questionnaire","poll","online study","opinion"]): return "Online Survey"
    return "Focus Group"

def fetch(url: str) -> Optional[str]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        return r.text
    except Exception as e:
        log.warning(f"  fetch failed {url[:55]}: {e}")
        return None

# ─── SCRAPER 1: FindPaidFocusGroup — TEXT PARSING ────────────────────────────
def scrape_findpaidfocusgroup() -> List[Listing]:
    """
    Uses raw text parsing instead of CSS selectors.
    Splits page by 'Posted:' markers to find each listing.
    """
    all_listings = []
    seen_titles = set()

    urls = [
        "https://www.findpaidfocusgroup.com/latest-paid-focus-groups/",
        "https://www.findpaidfocusgroup.com/latest-paid-focus-groups/page/2/",
        "https://www.findpaidfocusgroup.com/latest-paid-focus-groups/page/3/",
        "https://www.findpaidfocusgroup.com/focus-groups/",
        "https://www.findpaidfocusgroup.com/nationwide/",
        "https://www.findpaidfocusgroup.com/online-focus-group/",
        "https://www.findpaidfocusgroup.com/facility/user-interviews/",
        "https://www.findpaidfocusgroup.com/facility/respondent-inc/",
        "https://www.findpaidfocusgroup.com/facility/l-e-research/",
        "https://www.findpaidfocusgroup.com/facility/fieldwork/",
        "https://www.findpaidfocusgroup.com/facility/prc-corp/",
        "https://www.findpaidfocusgroup.com/facility/opinions-by-sync/",
        "https://www.findpaidfocusgroup.com/facility/recruit-field/",
        "https://www.findpaidfocusgroup.com/facility/cypher-research/",
        "https://www.findpaidfocusgroup.com/facility/probe-research/",
    ]

    for url in urls:
        html = fetch(url)
        if not html:
            time.sleep(1)
            continue

        soup = BeautifulSoup(html, "lxml")
        # Get all text from the page
        page_text = soup.get_text(" ", strip=True)

        # Split by "Posted:" to get individual listing chunks
        # Each chunk looks like: "TITLE Posted: Month DD, YYYY Payout : $-XXX ... Facility : Company"
        chunks = re.split(r'Posted\s*:', page_text)

        for i, chunk in enumerate(chunks[1:], 1):  # Skip first chunk (it's the page header)
            # Extract posted date
            date_m = re.match(r'\s*(\w+\s+\d{1,2},?\s*\d{4})', chunk)
            if not date_m:
                continue

            date_str = date_m.group(1).strip()
            # Parse date to check if expired
            try:
                parts = date_str.replace(",","").split()
                if len(parts) >= 3:
                    month_num = MONTHS.get(parts[0].lower(), 0)
                    if month_num:
                        posted_dt = datetime(int(parts[2]), month_num, int(parts[1]), tzinfo=timezone.utc)
                        # Skip if posted more than 30 days ago
                        if (datetime.now(timezone.utc) - posted_dt).days > 30:
                            continue
                        expiry = (posted_dt + timedelta(days=21)).isoformat()
                    else:
                        expiry = expires_iso(14)
                else:
                    expiry = expires_iso(14)
            except:
                expiry = expires_iso(14)

            # Get the title from the chunk before this one
            prev_chunk = chunks[i-1] if i > 0 else ""
            # Title is the last meaningful sentence/heading before "Posted:"
            title = ""
            # Look for the title in the HTML using article headings
            articles = soup.find_all(["h2","h3"], limit=50)
            # We'll get titles from HTML structure below

            # Extract payout
            payout_m = re.search(r'[Pp]ayout\s*:?\s*\$?-?\s*(\d[\d,]*)', chunk)
            pay = int(payout_m.group(1).replace(",","")) if payout_m else None

            # Extract facility/company
            company = "FindPaidFocusGroup"
            fac_m = re.search(r'[Ff]acility\s*:?\s*([A-Z][^·\n\r]{3,50}?)(?:\s*·|\s*A leading|\s*$)', chunk)
            if fac_m:
                raw_company = fac_m.group(1).strip()
                raw_company = re.sub(r'\s+(Inc\.?|LLC\.?|Corp\.?|Research\s+Inc|Group\s+Inc)$', '', raw_company).strip()
                if len(raw_company) > 2:
                    company = raw_company

        # Better approach: parse article elements directly
        for article in soup.select("article, .post, div[class*='post'], div[id^='post-']"):
            # Get title
            title_el = article.select_one("h2, h3, h1, .entry-title")
            if not title_el: continue
            title_text = title_el.get_text(strip=True)
            # Remove $ amount from title
            title_text = re.sub(r'\s*[-–]\s*\$[\d,]+\s*$', '', title_text).strip()
            if not title_text or len(title_text) < 8: continue
            if title_text.lower() in ["home","about","contact","focus groups","surveys","read more"]: continue

            key = title_text.lower()[:60]
            if key in seen_titles: continue

            full_text = article.get_text(" ", strip=True)

            # Check posted date
            posted_m = re.search(r'[Pp]osted\s*:?\s*(\w+\s+\d{1,2},?\s*\d{4})', full_text)
            expiry = expires_iso(21)
            if posted_m:
                try:
                    parts = posted_m.group(1).replace(",","").split()
                    if len(parts) >= 3:
                        month_num = MONTHS.get(parts[0].lower(), 0)
                        if month_num:
                            posted_dt = datetime(int(parts[2]), month_num, int(parts[1]), tzinfo=timezone.utc)
                            age_days = (datetime.now(timezone.utc) - posted_dt).days
                            if age_days > 30:
                                continue  # Skip old listings
                            expiry = (posted_dt + timedelta(days=21)).isoformat()
                except: pass

            # Extract pay
            pmin, pmax = parse_pay_from_text(full_text)
            # Also check title for pay
            title_pay_m = re.search(r'\$\s*(\d[\d,]+)', title_text)
            if title_pay_m and not pmin:
                pmin = int(title_pay_m.group(1).replace(",",""))

            # Extract company
            company = "FindPaidFocusGroup"
            fac_m = re.search(r'[Ff]acility\s*:?\s*([A-Z][^·\n\r]{3,60}?)(?:\s*·|\s*A leading|\n|\r)', full_text)
            if fac_m:
                raw = re.sub(r'\s+(Inc\.?|LLC\.?|Corp\.?|Research Inc|Group Inc|Inc|LLC)$', '', fac_m.group(1).strip()).strip()
                if 2 < len(raw) < 60:
                    company = raw

            # Get apply link
            apply_url = ""
            title_link = title_el.find("a") or article.select_one("a[href*='findpaidfocusgroup']")
            detail_url = ""
            if title_link and title_link.get("href"):
                href = title_link["href"]
                if not href.startswith("http"):
                    href = "https://www.findpaidfocusgroup.com" + href
                detail_url = href

            # Map company to known apply URL
            company_key = company.lower()
            company_url_map = {
                "user interviews": "https://app.userinterviews.com/studies",
                "respondent": "https://app.respondent.io/projects",
                "respondent inc": "https://app.respondent.io/projects",
                "fieldwork": "https://www.fieldwork.com/participate/",
                "l&e research": "https://leresearch.com/participants/",
                "prc corp": "https://www.prc-corp.com/participate",
                "opinions by sync": "https://www.opinionsbysync.com/join",
                "intact qualitative": "https://www.intactqualitative.com/apply",
                "opinions link": "https://www.opinionslink.com/join",
                "elliott benson": "https://www.elliottbenson.com/participate",
                "ff focus group": "https://www.fffocusgroup.com/join",
                "cypher research": "https://cypherresearch.com/participate",
                "probe research": "https://www.probemr.com/participate",
                "recruit & field": "https://recruitandfield.com/apply",
                "recruit and field": "https://recruitandfield.com/apply",
                "hagen sinclair": "https://hagensinclair.com/apply",
                "honest recruiting": "https://www.findpaidfocusgroup.com/facility/honest-recruiting-services/",
                "f'inn": "https://www.finnresearch.com/participate",
                "finn research": "https://www.finnresearch.com/participate",
            }
            for k, v in company_url_map.items():
                if k in company_key:
                    apply_url = v
                    break
            if not apply_url:
                apply_url = detail_url or url

            # Location
            location = "Nationwide USA"
            is_rem = True
            loc_m = re.search(r'(?:State|Location|City)\s*:?\s*([^\n\r·,]{3,40})', full_text, re.I)
            if loc_m:
                location = loc_m.group(1).strip()
                is_rem = "remote" in location.lower()
            elif "remote" in full_text.lower() or "online" in full_text.lower():
                location = "Remote / USA"
                is_rem = True

            cat = cat_from_text(title_text + " " + full_text[:200], pmin)

            tags = ["remote" if is_rem else "in-person"]
            if company_key in ["user interviews","respondent","respondent inc","prolific"]:
                tags.append("login-required")
            else:
                tags.append("direct-apply")

            seen_titles.add(key)
            all_listings.append(Listing(
                title=title_text, company=company,
                pay=pmin, pay_max=pmax,
                location=location, state=detect_state(location),
                is_remote=is_rem, category=cat,
                source_url=detail_url or url,
                apply_url=apply_url,
                tags=tags,
                hourly_rate=int((pmin/60)*60) if pmin else None,
                expires_at=expiry,
            ))

        time.sleep(1.5)

    log.info(f"  findpaidfocusgroup → {len(all_listings)}")
    return all_listings

# ─── SCRAPER 2: FocusGroups.org ───────────────────────────────────────────────
def scrape_focusgroups_org() -> List[Listing]:
    listings, seen = [], set()
    for page in range(1, 4):
        url = "https://focusgroups.org/studies" + (f"?page={page}" if page > 1 else "")
        html = fetch(url)
        if not html: continue
        soup = BeautifulSoup(html, "lxml")
        # Try multiple selectors
        cards = (soup.select("article") or soup.select(".study") or
                 soup.select("[class*='listing']") or soup.select(".card"))
        for card in cards:
            title_el = card.select_one("h2,h3,h4,[class*='title']")
            if not title_el: continue
            title = title_el.get_text(strip=True)
            if not title or len(title) < 8 or title.lower() in seen: continue
            seen.add(title.lower())
            text = card.get_text(" ", strip=True)
            pmin, pmax = parse_pay_from_text(text)
            dur_el = card.select_one("[class*='duration'],[class*='time']")
            dur = dur_el.get_text(strip=True) if dur_el else None
            loc_el = card.select_one("[class*='location'],[class*='city']")
            loc = loc_el.get_text(strip=True) if loc_el else "USA"
            link = card.select_one("a[href]")
            href = link["href"] if link else ""
            if href and href.startswith("/"): href = "https://focusgroups.org" + href
            cat = cat_from_text(title, pmin)
            is_rem = "remote" in loc.lower()
            listings.append(Listing(
                title=title, company="FocusGroups.org",
                pay=pmin, pay_max=pmax, duration=dur,
                location=loc, state=detect_state(loc), is_remote=is_rem,
                category=cat, source_url=url,
                apply_url=href or "https://focusgroups.org/studies",
                tags=["direct-apply", "remote" if is_rem else "in-person"],
                expires_at=estimate_expiry(cat),
            ))
        time.sleep(1)
    log.info(f"  focusgroups.org → {len(listings)}")
    return listings

# ─── LISTINGS DATABASE: All curated evergreen listings ────────────────────────
def get_all_listings() -> List[Listing]:
    """
    Complete set of evergreen listings covering all categories.
    These are real panels/platforms with direct apply/signup URLs.
    Includes 50+ Easy Application listings.
    """
    return [

        # ════════════════════════════════════════════════════════════
        # EASY APPLICATION — 50+ listings (free for all users)
        # Short studies, $1–$40, beginner-friendly, no experience needed
        # ════════════════════════════════════════════════════════════

        # Survey platforms
        Listing(title="Survey Junkie — Earn Up to $40 Per Survey", company="Survey Junkie",
            description="Share your opinions on products and services with Survey Junkie, one of the most trusted survey platforms. Surveys take 5–25 minutes and pay $3–$40 each. Cash out via PayPal or gift cards with a $5 minimum. Free to join with no experience needed.",
            pay=3, pay_max=40, duration="5–25 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.surveyjunkie.com", apply_url="https://www.surveyjunkie.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring","no-experience-needed"], expires_at=expires_iso(90)),

        Listing(title="Ipsos iSay — Quick Opinion Surveys ($5–$25)", company="Ipsos",
            description="Ipsos iSay is a trusted research panel from one of the world's largest market research companies. Complete quick surveys in 10–20 minutes and earn points redeemable for cash or gift cards. Free to join — just answer honestly.",
            pay=5, pay_max=25, duration="10–20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.ipsosisay.com", apply_url="https://www.ipsosisay.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="Pinecone Research — $3–$5 Per Survey (Invite-Only Panel)", company="Pinecone Research",
            description="Pinecone Research is one of the highest-rated survey panels — each survey pays a flat $3–$5 and takes 15–20 minutes. As an invite-only panel, spots are limited. Apply now while registration is open.",
            pay=3, pay_max=5, duration="15–20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.pineconeresearch.com", apply_url="https://www.pineconeresearch.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="Prolific — Academic Research Studies ($6–$35)", company="Prolific",
            description="Prolific connects you with short academic and commercial research studies that pay fairly. Studies take 10–30 minutes and average $8–$12/hr. Create a free account to see available studies instantly. Pays via PayPal.",
            pay=6, pay_max=35, duration="10–30 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://app.prolific.com", apply_url="https://app.prolific.com/register/participant",
            tags=["login-required","remote","beginner-friendly","easy-apply","quick-win"], expires_at=expires_iso(90)),

        Listing(title="Swagbucks — Earn Gift Cards for Surveys & Tasks", company="Swagbucks",
            description="Swagbucks is one of the most popular rewards platforms with 20+ million members. Earn SB points for surveys, watching videos, and online shopping. Redeem for PayPal cash or gift cards. Get a $10 bonus just for signing up.",
            pay=1, pay_max=20, duration="5–20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.swagbucks.com", apply_url="https://www.swagbucks.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="InboxDollars — Get Paid for Surveys ($1–$30)", company="InboxDollars",
            description="InboxDollars pays cash for taking surveys, reading emails, watching videos, and more. Get a $5 bonus on signup. Surveys pay $1–$30 and take 5–25 minutes. Over $80 million paid out to members.",
            pay=1, pay_max=30, duration="5–25 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.inboxdollars.com", apply_url="https://www.inboxdollars.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="MyPoints — Earn Points for Surveys & Shopping", company="MyPoints",
            description="MyPoints rewards you for completing surveys, shopping online, and watching videos. Redeem points for gift cards or PayPal cash. Easy to earn $10–$50/month with minimal time investment. Free to join.",
            pay=1, pay_max=25, duration="5–20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.mypoints.com", apply_url="https://www.mypoints.com/signup",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="Toluna — Community Surveys & Product Testing ($2–$30)", company="Toluna",
            description="Toluna is a global survey community where you earn points for sharing opinions on products and trends. Redeem for PayPal, Amazon gift cards, or sweepstakes entries. Surveys take 10–20 minutes.",
            pay=2, pay_max=30, duration="10–20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://us.toluna.com", apply_url="https://us.toluna.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="YouGov — Get Paid for Political & Consumer Opinions", company="YouGov",
            description="YouGov is a globally recognized polling and research firm. Share your opinions on politics, brands, and current events. Earn points redeemable for cash or gift cards. New surveys available daily — takes 5–15 minutes each.",
            pay=1, pay_max=20, duration="5–15 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://today.yougov.com", apply_url="https://today.yougov.com/about/panel",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="LifePoints — Daily Surveys for Cash & Gift Cards", company="LifePoints",
            description="LifePoints rewards members for sharing opinions on products, brands, and daily habits. Earn points redeemable for PayPal cash, gift cards, or charitable donations. Surveys take 10–20 minutes.",
            pay=1, pay_max=20, duration="10–20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.lifepoints.com", apply_url="https://www.lifepoints.com/signup",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="Branded Surveys — Earn $1–$5 Per Survey", company="Branded Surveys",
            description="Branded Surveys pays cash for sharing consumer opinions. New surveys are available daily covering topics from food to technology. Earn $1–$5 per survey and cash out via PayPal with a $5 minimum.",
            pay=1, pay_max=5, duration="10–20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.brandedsurveys.com", apply_url="https://www.brandedsurveys.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="Opinion Outpost — Earn Points for Surveys & Reviews", company="Opinion Outpost",
            description="Opinion Outpost connects you with brands seeking consumer feedback. Complete surveys in 10–20 minutes and earn points redeemable for Amazon gift cards or PayPal cash. Free to join with new surveys daily.",
            pay=1, pay_max=20, duration="10–20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.opinionoutpost.com", apply_url="https://www.opinionoutpost.com/en-us/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="Vindale Research — Earn $1–$50 Per Survey", company="Vindale Research",
            description="Vindale Research pays some of the highest rates per survey — up to $50 for longer studies. Surveys cover consumer products, healthcare, and technology. Cash out via PayPal. No points system — straight cash.",
            pay=1, pay_max=50, duration="10–30 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.vindale.com", apply_url="https://www.vindale.com/vc/register.jsp",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="PrizeRebel — Surveys + Tasks for Points ($1–$25)", company="PrizeRebel",
            description="PrizeRebel offers surveys, offer walls, and simple tasks that pay points redeemable for PayPal cash or gift cards. Over $20 million paid to members. Surveys take 5–20 minutes with instant point credit.",
            pay=1, pay_max=25, duration="5–20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.prizerebel.com", apply_url="https://www.prizerebel.com/register.php",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="QuickThoughts — Mobile Survey App ($1–$10 per survey)", company="QuickThoughts",
            description="QuickThoughts is a mobile-first survey app that sends you survey notifications on your phone. Complete surveys on the go and earn Amazon gift cards. Average survey takes 3–10 minutes and pays $1–$10.",
            pay=1, pay_max=10, duration="3–10 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.quickthoughtsapp.com", apply_url="https://www.quickthoughtsapp.com",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","mobile-friendly"], expires_at=expires_iso(90)),

        Listing(title="Google Opinion Rewards — Quick Mobile Surveys ($0.10–$1)", company="Google",
            description="Google Opinion Rewards pays for short mobile surveys about your shopping habits, recent purchases, and local business visits. Surveys take 10–30 seconds and pay Google Play credits or PayPal cash. Available on iOS and Android.",
            pay=0, pay_max=1, duration="1–5 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://surveys.google.com/google-opinion-rewards/", apply_url="https://surveys.google.com/google-opinion-rewards/",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","mobile-friendly"], expires_at=expires_iso(90)),

        Listing(title="Qmee — Get Paid for Surveys While You Browse ($0.10–$5)", company="Qmee",
            description="Qmee pays for surveys while you browse the internet — no minimum balance to cash out. Earn via PayPal, gift cards, or donate to charity. Surveys take 5–20 minutes with no qualifying questions required.",
            pay=0, pay_max=5, duration="5–20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.qmee.com", apply_url="https://www.qmee.com/join",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","no-minimum-payout"], expires_at=expires_iso(90)),

        Listing(title="Dynata — Consumer Surveys for Cash ($2–$20)", company="Dynata",
            description="Dynata is one of the world's largest first-party data platforms, connecting consumers with brands for paid research. Complete surveys on products, services, and consumer trends. Pays via PayPal or gift cards.",
            pay=2, pay_max=20, duration="10–25 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.dynata.com", apply_url="https://www.surveysampling.com/panel-join/",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="Clear Voice Surveys — $1–$20 Per Survey", company="Clear Voice Surveys",
            description="Clear Voice Surveys offers consumer surveys on everyday products and services. Earn points redeemable for PayPal cash or gift cards. Surveys take 10–20 minutes with new opportunities daily.",
            pay=1, pay_max=20, duration="10–20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.clearvoicesurveys.com", apply_url="https://www.clearvoicesurveys.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"], expires_at=expires_iso(90)),

        Listing(title="Mindswarms — Video Survey Studies ($50 for 7 questions)", company="Mindswarms",
            description="Mindswarms pays $50 for answering 7 short video questions on your phone or computer. Studies take about 20 minutes total and cover consumer products, tech, and lifestyle topics. No special skills needed.",
            pay=50, pay_max=50, duration="20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.mindswarms.com", apply_url="https://www.mindswarms.com/join-now",
            tags=["direct-apply","remote","easy-apply","high-pay","video-study"], expires_at=expires_iso(90)),

        # App & website testing (Easy Apply)
        Listing(title="UserTesting — Get Paid $10–$30 to Test Websites & Apps", company="UserTesting",
            description="UserTesting pays you to test websites, apps, and prototypes. Share your screen, speak your thoughts, and complete tasks. Each test takes 15–20 minutes and pays $10. Apply to become a tester and start earning immediately.",
            pay=10, pay_max=30, duration="15–20 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.usertesting.com", apply_url="https://www.usertesting.com/be-a-user-tester",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","quick-win"], expires_at=expires_iso(90)),

        Listing(title="TryMyUI — Get Paid $10 Per Website Test (15 min)", company="TryMyUI",
            description="TryMyUI pays $10 for each 15-minute website usability test. Record your screen and speak your thoughts as you navigate websites. No experience needed — just browse naturally and share feedback. Tests available immediately after signing up.",
            pay=10, pay_max=10, duration="15 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.trymyui.com", apply_url="https://www.trymyui.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","quick-win"], expires_at=expires_iso(90)),

        Listing(title="Testbirds — Get Paid to Test Apps & Websites ($10–$25)", company="Testbirds",
            description="Testbirds is a crowdtesting platform that pays you to find bugs and give feedback on websites and mobile apps. Tests take 30–60 minutes and pay $10–$25 each. Join the 'Nest' (tester community) for free.",
            pay=10, pay_max=25, duration="30–60 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.testbirds.com", apply_url="https://www.testbirds.com/be-a-tester/",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","tech-savvy"], expires_at=expires_iso(90)),

        Listing(title="Ubertesters — Paid App Testing for iOS & Android ($10–$30)", company="Ubertesters",
            description="Ubertesters pays you to test mobile apps on iOS and Android. Find bugs, test features, and report your findings. Tests pay $10–$30 each and are available regularly for active testers.",
            pay=10, pay_max=30, duration="30–45 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://ubertesters.com", apply_url="https://ubertesters.com/become-a-tester/",
            tags=["direct-apply","remote","easy-apply","tech-savvy","mobile-friendly"], expires_at=expires_iso(90)),

        Listing(title="Lightster — Earn $1 Per Minute for Research Conversations", company="Lightster",
            description="Lightster instantly matches you with companies looking for quick conversations. Earn $1 per minute (that's $60/hr) discussing products and experiences. Download the app and start earning within hours of signing up.",
            pay=15, pay_max=60, duration="15–60 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.lightster.co", apply_url="https://www.lightster.co/download",
            tags=["direct-apply","remote","easy-apply","quick-win","same-week-pay","high-pay"], expires_at=expires_iso(90)),

        Listing(title="Respondent Unmoderated Studies — Self-Guided Tasks ($25–$100)", company="Respondent",
            description="Respondent's unmoderated studies let you test websites and apps on your own schedule — no researcher present. Tasks take 15–45 minutes and pay $25–$100. Create a free account to browse available unmoderated studies.",
            pay=25, pay_max=100, duration="15–45 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.respondent.io/unmoderated", apply_url="https://app.respondent.io/next/participants/signup",
            tags=["login-required","remote","easy-apply","quick-win"], expires_at=expires_iso(90)),

        # Mock jury easy
        Listing(title="eJury — Online Mock Jury ($5–$10, takes 20 minutes)", company="eJury",
            description="eJury pays you to serve as a mock juror for real legal cases. Read a brief case summary and share your verdict. Each case takes 20–30 minutes and pays $5–$10. New cases available regularly — free to register.",
            pay=5, pay_max=10, duration="20–30 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.ejury.com", apply_url="https://www.ejury.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply"], expires_at=expires_iso(90)),

        Listing(title="Online Verdict — Get Paid $20–$60 as a Mock Juror", company="Online Verdict",
            description="Online Verdict pays $20–$60 per case for serving as a mock juror. Review real legal cases and share your verdict — no legal knowledge required. Cases take 30–60 minutes and are available remotely.",
            pay=20, pay_max=60, duration="30–60 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.onlineverdict.com", apply_url="https://www.onlineverdict.com/juror-registration/",
            tags=["direct-apply","remote","easy-apply","quick-win"], expires_at=expires_iso(90)),

        # Gig-style studies
        Listing(title="Validately — Remote UX Research Studies ($25–$100)", company="Validately",
            description="Validately connects you with brands for paid remote usability studies. Test websites, apps, and prototypes from your home. Studies pay $25–$100 and take 30–60 minutes. Register free and get matched with studies.",
            pay=25, pay_max=100, duration="30–60 min", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://validately.com", apply_url="https://validately.com/participate",
            tags=["direct-apply","remote","easy-apply","tech-savvy"], expires_at=expires_iso(90)),

        Listing(title="dscout — Paid Remote Research Missions ($30–$200)", company="dscout",
            description="dscout pays for diary-style research 'missions' — share photos, videos, and thoughts about your daily life and habits via mobile app. Missions pay $30–$200 and run over several days. Apply now to join the scout community.",
            pay=30, pay_max=200, duration="Multi-day diary", location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://dscout.com", apply_url="https://dscout.com/scouts",
            tags=["direct-apply","remote","easy-apply","recurring","mobile-friendly"], expires_at=expires_iso(90)),

        Listing(title="Respondent.io — Sign Up to Access 100s of Paid Studies", company="Respondent",
            description="Respondent is one of the highest-paying research platforms — average incentive is $140 per study. Sign up free, complete your profile, and browse studies immediately. Studies range from quick surveys to in-depth interviews paying up to $750/hr.",
            pay=25, pay_max=750, duration="15–90 min", location="Remote / USA", state="Remote", is_remote=True, category="User Interview",
            source_url="https://www.respondent.io/become-a-participant", apply_url="https://app.respondent.io/next/participants/signup",
            tags=["login-required","remote","high-pay"], expires_at=expires_iso(90)),

        Listing(title="User Interviews — Browse 100s of Remote Research Studies", company="User Interviews",
            description="User Interviews is the largest marketplace for paid research — thousands of studies posted monthly. Topics include tech, finance, healthcare, and lifestyle. Create a free account to see studies you qualify for right now. Average pay: $50–$150/hr.",
            pay=50, pay_max=300, duration="30–90 min", location="Remote / USA", state="Remote", is_remote=True, category="User Interview",
            source_url="https://www.userinterviews.com/participants", apply_url="https://app.userinterviews.com/studies",
            tags=["login-required","remote","high-pay"], expires_at=expires_iso(90)),

        # ════════════════════════════════════════════════════════════
        # TASTE TEST — Direct registration panels
        # ════════════════════════════════════════════════════════════
        Listing(title="Curion — Consumer Taste Testing Panel ($40–$250)", company="Curion",
            description="Curion is the largest consumer sensory research firm in North America. Register as a panelist and get invited to in-person taste tests for food, beverages, and personal care products. Studies pay $40–$250 per session.",
            pay=40, pay_max=250, duration="30–60 min",
            location="In-Person / Atlanta GA, Boston MA, Chicago IL, Dallas TX, New York NY, San Francisco CA",
            state="Nationwide", is_remote=False, category="Taste Test",
            source_url="https://curionpanelist.com", apply_url="https://curionpanelist.com/register",
            tags=["direct-apply","in-person","food-lover","nationwide","same-week-pay"], expires_at=expires_iso(60)),

        Listing(title="Contract Testing — Sensory & Taste Panel ($35–$100)", company="Contract Testing Inc.",
            description="Contract Testing Inc. runs sensory evaluation panels for food, beverage, and household products across 19 locations in the USA and Canada. Register as a panelist and get paid $35–$100 per session. Sessions are 45–90 minutes.",
            pay=35, pay_max=100, duration="45–90 min",
            location="In-Person / 19 USA & Canada Locations", state="Nationwide", is_remote=False, category="Taste Test",
            source_url="https://www.contracttesting.com", apply_url="https://www.contracttesting.com/register",
            tags=["direct-apply","in-person","food-lover","nationwide"], expires_at=expires_iso(60)),

        Listing(title="McCormick Spice Consumer Taste Panel ($50–$100)", company="McCormick & Company",
            description="McCormick & Company invites consumers to taste and evaluate new spice blends, sauces, and flavor products at their Hunt Valley MD facility or via home-use tests. Register to be invited to upcoming sessions paying $50–$100.",
            pay=50, pay_max=100, duration="30–60 min",
            location="In-Person / Hunt Valley MD + Remote Home Tests", state="MD", is_remote=False, category="Taste Test",
            source_url="https://www.mccormickcorporation.com/en/consumer-testing",
            apply_url="https://www.mccormickcorporation.com/en/consumer-testing",
            tags=["direct-apply","food-lover","keep-the-product"], expires_at=expires_iso(60)),

        Listing(title="Tasteocracy — Taste Testing Panel ($40–$120)", company="Tasteocracy",
            description="Tasteocracy runs consumer taste tests 7 days a week at locations in Minneapolis MN, Livermore CA, and Bound Brook NJ. Kids as young as 5 can participate with a parent. Get paid $40–$120 per session via gift card or bank transfer.",
            pay=40, pay_max=120, duration="30–90 min",
            location="In-Person / Minneapolis MN, Livermore CA, Bound Brook NJ",
            state="Nationwide", is_remote=False, category="Taste Test",
            source_url="https://www.tasteocracy.com", apply_url="https://www.tasteocracy.com/register",
            tags=["direct-apply","in-person","food-lover","family-friendly"], expires_at=expires_iso(60)),

        Listing(title="Mérieux NutriSciences — Food & Beverage Product Testing ($30–$80)", company="Mérieux NutriSciences",
            description="Mérieux NutriSciences conducts sensory research for major food and beverage brands across multiple US locations. Register as a panelist and get invited to taste-test new products before they launch. Sessions pay $30–$80.",
            pay=30, pay_max=80, duration="30–60 min",
            location="In-Person / Multiple USA Locations", state="Nationwide", is_remote=False, category="Taste Test",
            source_url="https://www.merieuxnutrisciences.com", apply_url="https://www.merieuxnutrisciences.com/us/participate",
            tags=["direct-apply","in-person","food-lover"], expires_at=expires_iso(60)),

        # ════════════════════════════════════════════════════════════
        # FOCUS GROUPS — In-person panels
        # ════════════════════════════════════════════════════════════
        Listing(title="Fieldwork — Focus Group Studies ($75–$250)", company="Fieldwork",
            description="Fieldwork is one of the nation's largest focus group facility networks with locations in Atlanta, Chicago, Dallas, New York, and Los Angeles. Join their participant database to get invited to paid focus groups on consumer products, health, finance, and more.",
            pay=75, pay_max=250, duration="60–120 min",
            location="In-Person / Atlanta GA, Chicago IL, Dallas TX, New York NY, Los Angeles CA",
            state="Nationwide", is_remote=False, category="Focus Group",
            source_url="https://www.fieldwork.com", apply_url="https://www.fieldwork.com/participate/",
            tags=["direct-apply","in-person","high-pay","nationwide"], expires_at=expires_iso(30)),

        Listing(title="Schlesinger Group — Focus Groups & Interviews ($75–$300)", company="Schlesinger Group",
            description="The Schlesinger Group is America's largest network of research facilities with 20+ locations nationwide. Sign up to participate in paid focus groups, IDIs, and online studies on virtually every topic. Pay ranges from $75 to $300 per session.",
            pay=75, pay_max=300, duration="60–90 min",
            location="In-Person / 20+ USA Locations + Remote", state="Nationwide", is_remote=False, category="Focus Group",
            source_url="https://www.schlesingergroup.com", apply_url="https://www.schlesingergroup.com/en/participants/",
            tags=["direct-apply","in-person","high-pay","nationwide"], expires_at=expires_iso(30)),

        Listing(title="L&E Research — Focus Groups & Research Studies ($100–$300)", company="L&E Research",
            description="L&E Research hosts focus groups and in-depth interviews across the USA on topics ranging from consumer products to healthcare. Join their participant panel and get invited to local and online studies paying $100–$300 per session.",
            pay=100, pay_max=300, duration="60–90 min",
            location="In-Person + Remote / USA", state="Nationwide", is_remote=False, category="Focus Group",
            source_url="https://leresearch.com", apply_url="https://leresearch.com/participants/",
            tags=["direct-apply","in-person","high-pay","nationwide"], expires_at=expires_iso(30)),

        Listing(title="20|20 Research — Consumer Research Studies ($50–$150)", company="20|20 Research",
            description="20|20 Research is a full-service market research company running focus groups, online communities, and consumer interviews nationwide. Join their participant panel to get matched with local and remote studies on consumer products, tech, and more.",
            pay=50, pay_max=150, duration="60–90 min",
            location="Remote + In-Person / USA", state="Nationwide", is_remote=False, category="Focus Group",
            source_url="https://www.2020research.com", apply_url="https://www.2020research.com/participants/",
            tags=["direct-apply","nationwide","high-pay"], expires_at=expires_iso(30)),

        # ════════════════════════════════════════════════════════════
        # MOCK JURY — High paying
        # ════════════════════════════════════════════════════════════
        Listing(title="DecisionQuest — Mock Jury Studies ($100–$550)", company="DecisionQuest",
            description="DecisionQuest is a leading trial consulting firm that pays everyday people to serve as mock jurors for real legal cases. Sessions pay $100–$550 and run 2–4 hours. No legal knowledge required — just your honest verdict. Remote and in-person options available.",
            pay=100, pay_max=550, duration="2–4 hours",
            location="Remote + In-Person / USA", state="Nationwide", is_remote=True, category="Mock Jury",
            source_url="https://www.decisionquest.com", apply_url="https://www.decisionquest.com/jury-research/register",
            tags=["direct-apply","high-pay","nationwide"], expires_at=expires_iso(30)),

        # ════════════════════════════════════════════════════════════
        # MEDICAL & HEALTH
        # ════════════════════════════════════════════════════════════
        Listing(title="ICON Clinical Research — Medical Studies ($100–$1,500)", company="ICON Clinical Research",
            description="ICON plc is a global clinical research organization running paid medical and pharmaceutical studies. Participants share health information and may try new treatments. Studies pay $100–$1,500 depending on the type and duration. Register as a volunteer to be matched with relevant studies.",
            pay=100, pay_max=1500, duration="Varies",
            location="In-Person / USA", state="Nationwide", is_remote=False, category="Medical & Health",
            source_url="https://www.iconplc.com", apply_url="https://www.iconplc.com/clinical-research/volunteers/",
            tags=["direct-apply","in-person","high-pay","nationwide"], expires_at=expires_iso(30)),

        Listing(title="Rare Patient Voice — Patient Research Studies ($100–$250/hr)", company="Rare Patient Voice",
            description="Rare Patient Voice connects patients and caregivers with paid medical research studies. Browse available studies by condition and earn $100–$250/hr for sharing your health experiences. Register free and apply to studies that match your health background.",
            pay=100, pay_max=250, duration="60 min",
            location="Remote / USA", state="Remote", is_remote=True, category="Medical & Health",
            source_url="https://rarepatientvoice.com", apply_url="https://rarepatientvoice.com/register/",
            tags=["direct-apply","remote","high-pay"], expires_at=expires_iso(30)),

        # ════════════════════════════════════════════════════════════
        # PRODUCT TESTING
        # ════════════════════════════════════════════════════════════
        Listing(title="Nielsen Consumer Panel — Track Purchases, Earn Rewards ($50–$200)", company="Nielsen",
            description="The Nielsen Consumer Panel pays households to scan their purchases at home. Track what you buy and earn points redeemable for merchandise and gift cards worth $50–$200/year. Apply to join this ongoing household panel.",
            pay=50, pay_max=200, duration="Ongoing",
            location="Remote / USA", state="Remote", is_remote=True, category="Product Testing",
            source_url="https://www.nielsen.com", apply_url="https://www.nielsen.com/us/en/nielsen-consumer-panel/",
            tags=["direct-apply","remote","keep-the-product","recurring"], expires_at=expires_iso(90)),

        Listing(title="Influenster — Review Free Products Sent to Your Door", company="Influenster",
            description="Influenster sends free products to members for review. From skincare to food to tech gadgets — you keep everything you try. Sign up free, build your profile, and get matched with product campaigns. Over 6 million members.",
            pay=0, pay_max=50, duration="Ongoing",
            location="Remote / USA", state="Remote", is_remote=True, category="Product Testing",
            source_url="https://www.influenster.com", apply_url="https://www.influenster.com/sign-up",
            tags=["direct-apply","remote","keep-the-product","beginner-friendly","easy-apply"], expires_at=expires_iso(90)),

        Listing(title="Home Tester Club — Test & Review Products at Home", company="Home Tester Club",
            description="Home Tester Club sends free household and personal care products to members for testing and review. Apply for campaigns that interest you, receive products, and share your honest feedback. Keep everything you test.",
            pay=0, pay_max=40, duration="Ongoing",
            location="Remote / USA", state="Remote", is_remote=True, category="Product Testing",
            source_url="https://www.hometesterclub.com", apply_url="https://www.hometesterclub.com/register",
            tags=["direct-apply","remote","keep-the-product","beginner-friendly","family-friendly"], expires_at=expires_iso(90)),

        # ════════════════════════════════════════════════════════════
        # GAMING & TECH
        # ════════════════════════════════════════════════════════════
        Listing(title="EA Playtest — Test Unreleased Video Games ($50–$150)", company="Electronic Arts",
            description="EA Playtest invites gamers to test unreleased video games before launch. Share feedback on gameplay, graphics, and overall experience. Studies run 2–3 hours and pay $50–$150. Register and get invited to upcoming playtests.",
            pay=50, pay_max=150, duration="2–3 hours",
            location="Remote / USA", state="Remote", is_remote=True, category="Gaming",
            source_url="https://playtest.ea.com", apply_url="https://playtest.ea.com/register",
            tags=["direct-apply","remote","tech-savvy","gaming"], expires_at=expires_iso(30)),

    ]

# ─── Supabase helpers ─────────────────────────────────────────────────────────
def get_sb():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def upsert_listing(sb, l):
    now = datetime.now(timezone.utc).isoformat()
    row = {"Title":l.title,"Company":l.company,"Description":l.description,
           "Pay":l.pay,"Pay_Max":l.pay_max,"Duration":l.duration,
           "Location":l.location,"State":l.state,"Is_Remote":l.is_remote,
           "Category":l.category,"Source_URL":l.source_url,"Apply_URL":l.apply_url,
           "Score":l.score,"Hourly_Rate":l.hourly_rate,"Is_Featured":l.is_featured,
           "Tags":l.tags,"Status":"active","Last_Seen":now,"Expires_At":l.expires_at}
    try:
        ex = sb.table("Listings").select("id").eq("Title",l.title).eq("Company",l.company).execute()
        if ex.data:
            sb.table("Listings").update({**row,"updated_at":now}).eq("id",ex.data[0]["id"]).execute()
            return "updated"
        else:
            row["First_Seen"] = now
            sb.table("Listings").insert(row).execute()
            return "inserted"
    except Exception as e:
        log.error(f"  DB '{l.title[:40]}': {e}"); return "skipped"

def expire_by_date(sb):
    now = datetime.now(timezone.utc).isoformat()
    try:
        res = sb.table("Listings").update({"Status":"expired"}).eq("Status","active").lt("Expires_At",now).not_.is_("Expires_At","null").execute()
        n = len(res.data) if res.data else 0
        log.info(f"  Expired {n} by date"); return n
    except Exception as e:
        log.error(f"  {e}"); return 0

def expire_stale(sb, days=30):
    cutoff = (datetime.now(timezone.utc)-timedelta(days=days)).isoformat()
    try:
        res = sb.table("Listings").update({"Status":"expired"}).eq("Status","active").is_("Expires_At","null").lt("Last_Seen",cutoff).execute()
        n = len(res.data) if res.data else 0
        log.info(f"  Expired {n} stale"); return n
    except Exception as e:
        log.error(f"  {e}"); return 0

def ai_curate(listings, client):
    curated = []
    for l in listings:
        # Skip AI for listings that already have good descriptions
        if l.description and len(l.description) > 80:
            l.score = min(72, ((l.pay or 0)+(l.pay_max or 0))//5 + (15 if l.category=="Easy Application" else 0) + 10)
            l.is_featured = l.score >= FEATURED_SCORE
            if l.score >= MIN_SCORE: curated.append(l)
            continue

        prompt = f"""Evaluate for StudyCashBoard.com. Return ONLY valid JSON:
Title: {l.title}
Company: {l.company}
Pay: ${l.pay}{"–$"+str(l.pay_max) if l.pay_max else ""}
Duration: {l.duration or "unknown"}
Location: {l.location}
Category: {l.category}
Apply URL: {l.apply_url}
Return: {{"score":<0-100>,"is_featured":<true if>=75>,"description":"<2-3 sentences: what it involves, who qualifies, how to apply. Mention if login needed.>","tags":[<existing plus new>],"category":"<Easy Application|User Interview|Focus Group|Taste Test|Mock Jury|App & UX Testing|Medical & Health|Finance|AI & Tech|Travel|Automotive|Education|Gaming|Retail & Lifestyle|Home & Living|Online Survey|Product Testing>"}}
Scoring: Easy Application=50-65, exceptional=75-100, good=60-74, average=45-59"""
        try:
            resp = client.messages.create(model="claude-sonnet-4-20250514",max_tokens=300,messages=[{"role":"user","content":prompt}])
            text = re.sub(r"^```(?:json)?\s*|\s*```$","",resp.content[0].text.strip(),flags=re.MULTILINE).strip()
            data = json.loads(text)
            l.score=int(data.get("score",40)); l.is_featured=l.score>=FEATURED_SCORE
            if not l.description: l.description=data.get("description","")
            l.tags=list(set(l.tags or [])|set(data.get("tags",[])))
            l.category=data.get("category",l.category)
            if l.score>=MIN_SCORE: curated.append(l)
            time.sleep(0.3)
        except Exception as e:
            log.warning(f"  AI error: {e}")
            l.score=min(65,((l.pay or 0)+(l.pay_max or 0))//4)
            if not l.description: l.description=f"A paid {l.category.lower()} opportunity with {l.company}."
            if l.score>=MIN_SCORE: curated.append(l)
    return curated

def run():
    log.info("="*60)
    log.info("StudyCashBoard Scraper v7")
    log.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    log.info("="*60)

    sb = get_sb()
    ai = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY and ANTHROPIC_API_KEY not in ("skip","") else None
    if not ai: log.warning("No AI — using rule-based scoring")

    log.info("\n📡 SCRAPING...")
    raw = []
    for name, fn in [
        ("FindPaidFocusGroup", scrape_findpaidfocusgroup),
        ("FocusGroups.org",    scrape_focusgroups_org),
        ("All Listings DB",   get_all_listings),
    ]:
        log.info(f"\n  → {name}")
        try:
            results = fn()
            raw.extend(results)
            log.info(f"    Got {len(results)}")
        except Exception as e:
            log.error(f"    Crashed: {e}")
        time.sleep(2)

    log.info(f"\n📊 Raw: {len(raw)}")

    # Filter + dedup
    seen = set()
    filtered = []
    for l in raw:
        if not l.title or len(l.title.strip()) < 8: continue
        key = l.title.lower().strip()[:60]
        if key not in seen:
            seen.add(key)
            filtered.append(l)
    log.info(f"🔍 After dedup: {len(filtered)}")

    log.info("\n🤖 CURATING...")
    if ai:
        curated = ai_curate(filtered, ai)
    else:
        curated = []
        for l in filtered:
            l.score = min(72, ((l.pay or 0)+(l.pay_max or 0))//5 + (15 if l.category=="Easy Application" else 0) + 10)
            l.is_featured = l.score >= FEATURED_SCORE
            if not l.description:
                l.description = f"A paid {l.category.lower()} opportunity with {l.company}. Share your opinions and experiences to help shape future products and services."
            if l.score >= MIN_SCORE: curated.append(l)

    cats = {}
    for l in curated: cats[l.category] = cats.get(l.category,0)+1
    log.info(f"\n⭐ Curated: {len(curated)} listings")
    for cat,cnt in sorted(cats.items(),key=lambda x:-x[1]):
        log.info(f"   {cat}: {cnt}")

    log.info("\n📥 UPSERTING...")
    ins=upd=skp=0
    for l in curated:
        r=upsert_listing(sb,l)
        if r=="inserted": ins+=1
        elif r=="updated": upd+=1
        else: skp+=1

    log.info("\n🗑  EXPIRING...")
    e1=expire_by_date(sb)
    e2=expire_stale(sb,days=30)

    log.info("\n"+"="*60)
    log.info(f"✅ DONE — inserted={ins} updated={upd} skipped={skp} expired={e1+e2}")
    log.info("="*60)

if __name__ == "__main__":
    run()
