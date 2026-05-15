"""
StudyCashBoard — Production Scraper v8
=======================================
Fixes in v8:
- Correct FindPaidFocusGroup URLs (removed dead /latest-paid-focus-groups/)
- Fixed scoring: MIN_SCORE lowered, rule-based scoring improved
- All evergreen listings now pass scoring (score assigned by category)
- Text-based parsing for FindPaidFocusGroup
- Added more FPFG pages that actually work
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

MIN_SCORE      = 40   # Lowered from 45 — don't reject valid listings
FEATURED_SCORE = 72
MIN_PAY        = 3    # Allow $3+ so survey sites qualify

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"}

MONTHS = {
    "january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
    "july":7,"august":8,"september":9,"october":10,"november":11,"december":12,
    "jan":1,"feb":2,"mar":3,"apr":4,"jun":6,"jul":7,"aug":8,
    "sep":9,"oct":10,"nov":11,"dec":12
}

CITY_STATE = {
    "new york":"NY","nyc":"NY","los angeles":"CA","san francisco":"CA","chicago":"IL",
    "houston":"TX","dallas":"TX","austin":"TX","phoenix":"AZ","philadelphia":"PA",
    "atlanta":"GA","miami":"FL","seattle":"WA","portland":"OR","denver":"CO",
    "minneapolis":"MN","boston":"MA","detroit":"MI","cleveland":"OH","nashville":"TN",
    "charlotte":"NC","las vegas":"NV","salt lake city":"UT","kansas city":"MO",
    "indianapolis":"IN","baltimore":"MD","hunt valley":"MD","washington":"DC",
    "arlington":"VA","newark":"NJ","bound brook":"NJ","livermore":"CA",
    "san diego":"CA","irvine":"CA","richmond":"VA","san antonio":"TX",
}
STATE_ABBRS = {"AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
               "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
               "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
               "VA","WA","WV","WI","WY","DC"}

FACILITY_URLS = {
    "user interviews":      "https://app.userinterviews.com/studies",
    "respondent":           "https://app.respondent.io/projects",
    "respondent inc":       "https://app.respondent.io/projects",
    "fieldwork":            "https://www.fieldwork.com/participate/",
    "l&e research":         "https://leresearch.com/participants/",
    "prc corp":             "https://www.prc-corp.com/participate",
    "opinions by sync":     "https://www.opinionsbysync.com/join-our-community",
    "intact qualitative":   "https://www.intactqualitative.com/apply",
    "opinions link":        "https://www.opinionslink.com/join",
    "elliott benson":       "https://www.elliottbenson.com/participate",
    "ff focus group":       "https://www.fffocusgroup.com/join",
    "cypher research":      "https://cypherresearch.com/participate",
    "probe research":       "https://www.probemr.com/participate",
    "recruit & field":      "https://www.recruitandfield.com/participate",
    "recruit and field":    "https://www.recruitandfield.com/participate",
    "hagen sinclair":       "https://hagensinclair.com/apply",
    "honest recruiting":    "https://www.findpaidfocusgroup.com/facility/honest-recruiting-services/",
    "f'inn":                "https://www.finnresearch.com/participate",
    "finn research":        "https://www.finnresearch.com/participate",
    "schlesinger":          "https://www.schlesingergroup.com/en/participants/",
    "20|20":                "https://www.2020research.com/participants/",
    "curion":               "https://curionpanelist.com/register",
    "tasteocracy":          "https://www.tasteocracy.com",
    "contract testing":     "https://www.contracttesting.com/register",
    "mccormick":            "https://www.mccormickcorporation.com/en/consumer-testing",
    "merieux":              "https://www.merieuxnutrisciences.com/us/participate",
    "decisionquest":        "https://www.decisionquest.com/mock-jury/",
    "ejury":                "https://www.ejury.com/p/register.html",
    "icon clinical":        "https://www.iconplc.com/clinical-research/volunteers/",
    "rare patient voice":   "https://rarepatientvoice.com/sign-up/",
}

LOGIN_REQUIRED = {"respondent","respondent inc","user interviews","prolific","usertesting"}

@dataclass
class Listing:
    title:       str
    company:     str
    description: str = ""
    pay:         Optional[int] = None
    pay_max:     Optional[int] = None
    duration:    Optional[str] = None
    location:    str = "Nationwide USA"
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

def expires_iso(days): return (datetime.now(timezone.utc)+timedelta(days=days)).isoformat()

def estimate_expiry(cat):
    m = {"Easy Application":90,"Online Survey":90,"Product Testing":60,"Taste Test":30,
         "User Interview":14,"Focus Group":14,"App & UX Testing":14,"Medical & Health":30,
         "Finance":14,"AI & Tech":14,"Mock Jury":14,"Automotive":14,"Gaming":14,
         "Education":21,"Travel":14,"Retail & Lifestyle":14,"Home & Living":21}
    return expires_iso(m.get(cat, 14))

def detect_state(loc):
    if not loc: return "Remote"
    l = loc.lower()
    if "remote" in l and "in-person" not in l: return "Remote"
    if any(w in l for w in ["nationwide","all states","multiple","major us","usa"]): return "Nationwide"
    for city, st in CITY_STATE.items():
        if city in l: return st
    m = re.search(r'\b([A-Z]{2})\b', loc)
    if m and m.group(1) in STATE_ABBRS: return m.group(1)
    return "Nationwide"

def parse_pay(text):
    if not text: return None, None
    text = text.replace("$-","$").replace("$–","$").replace(",","")
    nums = re.findall(r'\$(\d+)', text)
    nums = [int(n) for n in nums if 0 < int(n) < 10000]
    if not nums: return None, None
    return min(nums), max(nums) if len(nums) > 1 else None

def cat_from_text(text, pay=None):
    t = text.lower()
    if any(w in t for w in ["taste","food","beverage","snack","flavor","sensory","culinary","recipe","meal","fast food","cooking","eating","drinking","grocery","scalp care","scalp"]): return "Taste Test"
    if any(w in t for w in ["mock jury","mock trial","jury","legal case","attorney","lawsuit","court","verdict"]): return "Mock Jury"
    if any(w in t for w in ["medical","health","clinical","patient","pharma","drug","wellness","therapy","condition","symptom","treatment","vaccine","chronic","mental health","eczema","depression","bipolar","cancer","diabetes","migraine","arthritis","disease","disorder","oral care","dental","weight management","caregiver","healthcare"]): return "Medical & Health"
    if any(w in t for w in ["finance","bank","invest","credit","insurance","fintech","money","loan","mortgage","financial","stock","budget","payment","overdraft","investing"]): return "Finance"
    if any(w in t for w in ["ai","artificial intelligence","machine learning","chatbot","conversations with ai","technology trends","tech","automation","smart home","iot","wearable","smart watch","rechargeable","digital camera","camera buying","parking app","messaging app"]): return "AI & Tech"
    if any(w in t for w in ["app","website","software","ux","ui","usability","prototype","interface","user experience","digital product","mobile app","online study"]): return "App & UX Testing"
    if any(w in t for w in ["travel","hotel","airline","booking","vacation","trip","flight","cruise","tourism","destination","rv owners","rideshare","vacation attraction"]): return "Travel"
    if any(w in t for w in ["automotive","car","vehicle","ev","electric vehicle","driving","suv","truck","motor","hybrid","dealership"]): return "Automotive"
    if any(w in t for w in ["education","learning","student","tutor","school","course","teacher","university","college","edtech","parenting","children","kids"]): return "Education"
    if any(w in t for w in ["gaming","video game","esport","console","mobile game","gamer","playstation","xbox","nintendo","steam","online games","gamers"]): return "Gaming"
    if any(w in t for w in ["retail","shopping","fashion","clothing","beauty","cosmetic","makeup","skincare","haircare","apparel","ecommerce","luxury","perfume","scent","sneaker","online shopping","grocery shopping","club store"]): return "Retail & Lifestyle"
    if any(w in t for w in ["home","smart home","appliance","furniture","cleaning","household","kitchen","interior","decor","renovation","homeowner","home care","home products","home appliance"]): return "Home & Living"
    if any(w in t for w in ["product test","product review","consumer test","new product","beta test","sample","prototype","pet","cat owners","dog owners","pet care","pet food","cat care","snack lovers"]): return "Product Testing"
    if any(w in t for w in ["entertainment","television","tv shows","streaming","media","music","movie"]): return "Retail & Lifestyle"
    return "Focus Group"

def score_by_category(cat, pay, pay_max, is_remote):
    """
    Rule-based scoring when AI is not available.
    Much more generous than before — we want 90%+ of listings to pass.
    """
    base = {
        "Easy Application": 55, "Online Survey": 52, "Focus Group": 58,
        "User Interview": 65, "Taste Test": 62, "Mock Jury": 60,
        "Medical & Health": 65, "Finance": 62, "AI & Tech": 65,
        "Travel": 60, "Automotive": 60, "Gaming": 58, "Education": 58,
        "Retail & Lifestyle": 58, "Home & Living": 58, "App & UX Testing": 62,
        "Product Testing": 55, "Diary Study": 55,
    }.get(cat, 55)

    # Pay bonus
    p = pay or 0
    if p >= 400:   base += 18
    elif p >= 300: base += 14
    elif p >= 200: base += 10
    elif p >= 150: base += 7
    elif p >= 100: base += 5
    elif p >= 50:  base += 3

    # Remote bonus
    if is_remote: base += 3

    return min(88, base)

def get_apply_url(company):
    key = company.lower().strip()
    url = FACILITY_URLS.get(key, "")
    if not url:
        for k, v in FACILITY_URLS.items():
            if k in key or key in k:
                url = v
                break
    return url

def fetch(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        return r.text
    except Exception as e:
        log.warning(f"  fetch failed {url[:55]}: {e}")
        return None

# ── SCRAPER 1: FindPaidFocusGroup ─────────────────────────────────────────────
def parse_fpfg_html(html, source_url):
    """
    Parse FindPaidFocusGroup using confirmed site format:
    - Title in h2/h3 tags
    - "Payout : $-125" format in text
    - "Facility : Company Name" in text
    - "Posted: April 24, 2026" in text
    Dual method: HTML article tags first, then raw text fallback.
    """
    listings = []
    if not html: return listings

    soup = BeautifulSoup(html, "lxml")
    full_page_text = soup.get_text(" ", strip=True)

    # Method 1: Try article/post HTML selectors
    articles = soup.select("article, .post, div[class*='post'], div[id^='post-'], .entry, [class*='listing']")

    # Method 2: If no articles found, split by "Posted:" markers
    if not articles:
        log.debug(f"    No article tags — using text parsing on {source_url[-40:]}")
        chunks = re.split(r'Posted\s*:', full_page_text)
        for chunk in chunks[1:]:
            date_m = re.match(r'\s*(\w+)\s+(\d{1,2}),?\s*(\d{4})', chunk)
            if not date_m: continue
            pay_m = re.search(r'[Pp]ayout\s*:?\s*\$?-?\s*(\d[\d,]*)', chunk)
            if not pay_m: continue
            pmin = int(pay_m.group(1).replace(",",""))
            if pmin < 50: continue  # skip low pay

            company = "FindPaidFocusGroup"
            fac_m = re.search(r'[Ff]acility\s*:?\s*([A-Z][^\n·]{3,50}?)(?:\s*·|\s*A leading)', chunk)
            if fac_m:
                raw = re.sub(r'\s+(Inc\.?|LLC\.?|Corp\.?|Research Inc|Group Inc|Inc|LLC)$', '', fac_m.group(1).strip()).strip()
                if 2 < len(raw) < 60: company = raw

            try:
                month_num = MONTHS.get(date_m.group(1).lower(), 0)
                if not month_num: continue
                posted_dt = datetime(int(date_m.group(3)), month_num, int(date_m.group(2)), tzinfo=timezone.utc)
                if (datetime.now(timezone.utc) - posted_dt).days > 60: continue
                expiry = (posted_dt + timedelta(days=21)).isoformat()
            except:
                expiry = estimate_expiry("Focus Group")

            # Find nearest title before this chunk
            title = f"Paid Research Study — ${pmin}"
            all_titles = [h.get_text(strip=True) for h in soup.select("h2,h3") if len(h.get_text(strip=True)) > 10]
            chunk_pos = full_page_text.find(chunk[:30])
            for t in all_titles:
                if full_page_text.find(t) < chunk_pos:
                    title = re.sub(r'\s*[-–]\s*\$[\d,]+\s*$', '', t).strip()

            apply_url = get_apply_url(company) or source_url
            cat = cat_from_text(title, pmin)
            tags = ["login-required" if company.lower() in LOGIN_REQUIRED else "direct-apply", "remote"]
            listings.append(Listing(
                title=title, company=company, pay=pmin,
                location="Nationwide USA", state="Nationwide", is_remote=True,
                category=cat, source_url=source_url, apply_url=apply_url,
                tags=tags, expires_at=expiry,
            ))
        return listings

    # Method 1: Parse article tags
    for article in articles:
        title_el = article.select_one("h2, h3, h1, .entry-title")
        if not title_el: continue
        title = re.sub(r'\s*[-–]\s*\$[\d,]+\s*$', '', title_el.get_text(strip=True)).strip()
        if not title or len(title) < 8: continue
        if title.lower() in ["home","about","contact","focus groups","surveys","read more"]: continue

        full_text = article.get_text(" ", strip=True)

        # Pay
        payout_m = re.search(r'[Pp]ayout\s*:?\s*\$?-?\s*(\d[\d,]*)', full_text)
        dollar_m  = re.search(r'\$\s*(\d[\d,]+)', title)
        pmin = None
        if payout_m:   pmin = int(payout_m.group(1).replace(",",""))
        elif dollar_m: pmin = int(dollar_m.group(1).replace(",",""))
        if pmin and pmin < 50: continue

        # Age check
        posted_m = re.search(r'[Pp]osted\s*:?\s*(\w+)\s+(\d{1,2}),?\s*(\d{4})', full_text)
        expiry = estimate_expiry("Focus Group")
        if posted_m:
            try:
                month_num = MONTHS.get(posted_m.group(1).lower(), 0)
                if month_num:
                    posted_dt = datetime(int(posted_m.group(3)), month_num, int(posted_m.group(2)), tzinfo=timezone.utc)
                    if (datetime.now(timezone.utc) - posted_dt).days > 60: continue
                    expiry = (posted_dt + timedelta(days=21)).isoformat()
            except: pass

        # Company
        company = "FindPaidFocusGroup"
        fac_m = re.search(r'[Ff]acility\s*:?\s*([A-Z][^\n\r·]{2,60}?)(?:\s*·|\s*A leading|\n|\r)', full_text)
        if fac_m:
            raw = re.sub(r'\s+(Inc\.?|LLC\.?|Corp\.?|Research Inc|Group Inc|Inc|LLC)$', '', fac_m.group(1).strip()).strip()
            if 2 < len(raw) < 60: company = raw

        # Apply URL
        title_link = title_el.find("a") or article.select_one("a.more-link, a[rel='bookmark'], h2 a, h3 a")
        detail_url = ""
        if title_link and title_link.get("href"):
            href = title_link["href"]
            if not href.startswith("http"):
                href = "https://www.findpaidfocusgroup.com" + href
            detail_url = href

        apply_url = get_apply_url(company) or detail_url or source_url
        cat = cat_from_text(title + " " + full_text[:200], pmin)
        is_rem = "in-person" not in full_text.lower()
        tags = ["login-required" if company.lower() in LOGIN_REQUIRED else "direct-apply",
                "remote" if is_rem else "in-person"]

        listings.append(Listing(
            title=title, company=company, pay=pmin,
            location="Nationwide USA", state="Nationwide", is_remote=is_rem,
            category=cat, source_url=detail_url or source_url, apply_url=apply_url,
            tags=tags, expires_at=expiry,
        ))

    return listings


def scrape_findpaidfocusgroup():
    all_listings, seen = [], set()

    # CORRECT URLs — verified working as of May 2026
    urls = [
        "https://www.findpaidfocusgroup.com/focus-groups/",
        "https://www.findpaidfocusgroup.com/nationwide/",
        "https://www.findpaidfocusgroup.com/online-focus-group/",
        "https://www.findpaidfocusgroup.com/",
        # Facility pages
        "https://www.findpaidfocusgroup.com/facility/user-interviews/",
        "https://www.findpaidfocusgroup.com/facility/respondent-inc/",
        "https://www.findpaidfocusgroup.com/facility/fieldwork/",
        "https://www.findpaidfocusgroup.com/facility/prc-corp/",
        "https://www.findpaidfocusgroup.com/facility/opinions-by-sync/",
        "https://www.findpaidfocusgroup.com/facility/l-e-research/",
        "https://www.findpaidfocusgroup.com/facility/recruit-field/",
        "https://www.findpaidfocusgroup.com/facility/intact-qualitative-research/",
        "https://www.findpaidfocusgroup.com/facility/cypher-research/",
        "https://www.findpaidfocusgroup.com/facility/opinions-link/",
        "https://www.findpaidfocusgroup.com/facility/hagen-sinclair-research-recruiting/",
        "https://www.findpaidfocusgroup.com/facility/honest-recruiting-services/",
        "https://www.findpaidfocusgroup.com/facility/ff-focus-group/",
    ]

    for url in urls:
        log.info(f"    Fetching: .../{url.split('/')[-2] or 'home'}")
        html = fetch(url)
        if not html:
            time.sleep(1.5)
            continue
        page_listings = parse_fpfg_html(html, url)
        for l in page_listings:
            key = l.title.lower().strip()[:60]
            if key not in seen:
                seen.add(key)
                all_listings.append(l)
        time.sleep(1.5)

    log.info(f"  findpaidfocusgroup → {len(all_listings)}")
    return all_listings

# ── SCRAPER 2: FocusGroups.org ────────────────────────────────────────────────
def scrape_focusgroups_org():
    listings, seen = [], set()
    # Try multiple URL patterns since their structure may have changed
    urls = [
        "https://focusgroups.org/studies",
        "https://focusgroups.org/",
        "https://focusgroups.org/studies/",
    ]
    for url in urls:
        html = fetch(url)
        if not html: continue
        soup = BeautifulSoup(html, "lxml")
        # Try every possible card selector
        cards = (soup.select("article") or soup.select(".study") or
                 soup.select("[class*='listing']") or soup.select("[class*='card']") or
                 soup.select("[class*='opportunity']") or soup.select("li[class*='study']"))
        if not cards:
            log.warning(f"  focusgroups.org: no cards found on {url}")
            continue
        for card in cards:
            title_el = card.select_one("h2,h3,h4,[class*='title'],[class*='name']")
            if not title_el: continue
            title = title_el.get_text(strip=True)
            if not title or len(title) < 8 or title.lower() in seen: continue
            seen.add(title.lower())
            text = card.get_text(" ", strip=True)
            pmin, pmax = parse_pay(text)
            loc_el = card.select_one("[class*='location'],[class*='city']")
            loc = loc_el.get_text(strip=True) if loc_el else "USA"
            link = card.select_one("a[href]")
            href = link["href"] if link else ""
            if href and href.startswith("/"): href = "https://focusgroups.org" + href
            cat = cat_from_text(title, pmin)
            is_rem = "remote" in loc.lower()
            listings.append(Listing(
                title=title, company="FocusGroups.org",
                pay=pmin, pay_max=pmax,
                location=loc, state=detect_state(loc), is_remote=is_rem,
                category=cat, source_url=url,
                apply_url=href or "https://focusgroups.org/studies",
                tags=["direct-apply", "remote" if is_rem else "in-person"],
                expires_at=estimate_expiry(cat),
            ))
        time.sleep(1)
    log.info(f"  focusgroups.org → {len(listings)}")
    return listings

# ── DATABASE: All evergreen listings ─────────────────────────────────────────
def get_all_listings():
    """Complete evergreen listings. All pass scoring — scores set directly."""
    return [
        # EASY APPLICATION (score 52-65)
        Listing(title="Survey Junkie — Earn Up to $40 Per Survey", company="Survey Junkie",
            description="Share your opinions on products and services with Survey Junkie, one of the most trusted survey platforms. Surveys take 5–25 minutes and pay $3–$40 each. Cash out via PayPal or gift cards with a $5 minimum. Free to join.",
            pay=3, pay_max=40, duration="5–25 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://www.surveyjunkie.com",
            apply_url="https://www.surveyjunkie.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"],
            score=62, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Ipsos iSay — Quick Opinion Surveys ($5–$25)", company="Ipsos",
            description="Ipsos iSay is a trusted research panel from one of the world's largest market research companies. Complete quick surveys in 10–20 minutes and earn points redeemable for cash or gift cards.",
            pay=5, pay_max=25, duration="10–20 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://www.ipsosisay.com",
            apply_url="https://www.ipsosisay.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"],
            score=60, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Pinecone Research — Earn $3–$5 Per Survey (Invite-Only)", company="Pinecone Research",
            description="Pinecone Research is one of the highest-rated survey panels — each survey pays a flat $3–$5 and takes 15–20 minutes. As an invite-only panel, spots are limited. Apply now while registration is open.",
            pay=3, pay_max=5, duration="15–20 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://www.pineconeresearch.com",
            apply_url="https://www.pineconeresearch.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"],
            score=62, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Prolific — Short Academic Research Studies ($6–$35)", company="Prolific",
            description="Prolific connects you with short academic and commercial research studies that pay fairly. Studies take 10–30 minutes and average $8–$12/hr. Create a free account to browse studies immediately.",
            pay=6, pay_max=35, duration="10–30 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://app.prolific.com",
            apply_url="https://app.prolific.com/register/participant",
            tags=["login-required","remote","beginner-friendly","easy-apply","quick-win"],
            score=63, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="UserTesting — Get Paid $10–$30 to Test Websites & Apps", company="UserTesting",
            description="UserTesting pays you to test websites, apps, and prototypes. Share your screen, speak your thoughts, complete tasks. Each test takes 15–20 minutes and pays $10. Apply to become a tester and start earning immediately.",
            pay=10, pay_max=30, duration="15–20 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://www.usertesting.com",
            apply_url="https://www.usertesting.com/be-a-user-tester",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","quick-win"],
            score=65, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="TryMyUI — Get Paid $10 Per Website Test (15 min)", company="TryMyUI",
            description="TryMyUI pays $10 for each 15-minute website usability test. Record your screen and speak your thoughts as you navigate websites. No experience needed — just browse naturally and share feedback.",
            pay=10, pay_max=10, duration="15 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://www.trymyui.com",
            apply_url="https://www.trymyui.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","quick-win"],
            score=62, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Swagbucks — Earn Gift Cards for Surveys & Tasks", company="Swagbucks",
            description="Swagbucks is one of the most popular rewards platforms with 20+ million members. Earn SB points for surveys, watching videos, and online shopping. Redeem for PayPal cash or gift cards.",
            pay=1, pay_max=20, duration="5–20 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://www.swagbucks.com",
            apply_url="https://www.swagbucks.com/p/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"],
            score=55, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="InboxDollars — Get Paid for Surveys (+ $5 Signup Bonus)", company="InboxDollars",
            description="InboxDollars pays cash for taking surveys, reading emails, and watching videos. Get a $5 bonus on signup. Surveys pay $1–$30 and take 5–25 minutes. Over $80 million paid out to members.",
            pay=1, pay_max=30, duration="5–25 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://www.inboxdollars.com",
            apply_url="https://www.inboxdollars.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"],
            score=55, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Lightster — Earn $1 Per Minute in Research Conversations", company="Lightster",
            description="Lightster instantly matches you with companies looking for quick conversations. Earn $1 per minute ($60/hr) discussing products and experiences. Download the app and start earning within hours of signing up.",
            pay=15, pay_max=60, duration="15–60 min", location="Remote / USA", state="Remote", is_remote=True,
            category="User Interview", source_url="https://www.lightster.co",
            apply_url="https://www.lightster.co/download",
            tags=["direct-apply","remote","easy-apply","quick-win","same-week-pay"],
            score=68, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Mindswarms — Video Survey Studies ($50 for 7 Questions)", company="Mindswarms",
            description="Mindswarms pays $50 for answering 7 short video questions on your phone or computer. Studies take about 20 minutes and cover consumer products, tech, and lifestyle topics. No special skills needed.",
            pay=50, pay_max=50, duration="20 min", location="Remote / USA", state="Remote", is_remote=True,
            category="User Interview", source_url="https://www.mindswarms.com",
            apply_url="https://www.mindswarms.com/join/",
            tags=["direct-apply","remote","easy-apply","video-study"],
            score=68, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="dscout — Paid Remote Research Missions ($30–$200)", company="dscout",
            description="dscout pays for diary-style research missions — share photos, videos, and thoughts about your daily life via mobile app. Missions pay $30–$200 and run over several days. Join the scout community.",
            pay=30, pay_max=200, duration="Multi-day diary", location="Remote / USA", state="Remote", is_remote=True,
            category="User Interview", source_url="https://dscout.com",
            apply_url="https://dscout.com/scouts",
            tags=["direct-apply","remote","easy-apply","recurring","mobile-friendly"],
            score=65, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Toluna — Community Surveys & Product Testing ($2–$30)", company="Toluna",
            description="Toluna is a global survey community where you earn points for sharing opinions on products and trends. Redeem for PayPal, Amazon gift cards, or sweepstakes entries. Surveys take 10–20 minutes.",
            pay=2, pay_max=30, duration="10–20 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://us.toluna.com",
            apply_url="https://us.toluna.com/register",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"],
            score=55, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="YouGov — Get Paid for Political & Consumer Opinions", company="YouGov",
            description="YouGov is a globally recognized polling and research firm. Share your opinions on politics, brands, and current events. Earn points redeemable for cash or gift cards. New surveys available daily.",
            pay=1, pay_max=20, duration="5–15 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://today.yougov.com",
            apply_url="https://today.yougov.com/about/panel",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"],
            score=57, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Branded Surveys — Earn $1–$5 Per Survey", company="Branded Surveys",
            description="Branded Surveys pays cash for sharing consumer opinions. New surveys available daily covering topics from food to technology. Earn $1–$5 per survey and cash out via PayPal with a $5 minimum.",
            pay=1, pay_max=5, duration="10–20 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://www.brandedsurveys.com",
            apply_url="https://www.brandedsurveys.com/join/",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","recurring"],
            score=52, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Validately — Remote UX Research Studies ($25–$100)", company="Validately",
            description="Validately connects you with brands for paid remote usability studies. Test websites, apps, and prototypes from your home. Studies pay $25–$100 and take 30–60 minutes. Register free.",
            pay=25, pay_max=100, duration="30–60 min", location="Remote / USA", state="Remote", is_remote=True,
            category="App & UX Testing", source_url="https://validately.com",
            apply_url="https://validately.com/participants",
            tags=["direct-apply","remote","easy-apply","tech-savvy"],
            score=65, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Testbirds — Get Paid to Test Apps & Websites ($10–$25)", company="Testbirds",
            description="Testbirds is a crowdtesting platform that pays you to find bugs and give feedback on websites and mobile apps. Tests take 30–60 minutes and pay $10–$25 each. Join the tester community for free.",
            pay=10, pay_max=25, duration="30–60 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://www.testbirds.com",
            apply_url="https://www.testbirds.com/be-a-tester/",
            tags=["direct-apply","remote","beginner-friendly","easy-apply","tech-savvy"],
            score=62, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Online Verdict — Get Paid $20–$60 as a Mock Juror (30 min)", company="Online Verdict",
            description="Online Verdict pays $20–$60 per case for serving as a mock juror online. Review real legal cases and share your verdict — no legal knowledge required. Cases take 30–60 minutes.",
            pay=20, pay_max=60, duration="30–60 min", location="Remote / USA", state="Remote", is_remote=True,
            category="Easy Application", source_url="https://www.onlineverdict.com",
            apply_url="https://www.onlineverdict.com/juror-registration/",
            tags=["direct-apply","remote","easy-apply","quick-win"],
            score=63, is_featured=False, expires_at=expires_iso(90)),

        # USER INTERVIEW PLATFORMS
        Listing(title="Respondent.io — High-Paying User Research Studies ($75–$750/hr)", company="Respondent",
            description="Respondent is one of the highest-paying research platforms — average incentive is $140 per study. Sign up free, complete your profile, and browse studies immediately. Topics cover tech, finance, healthcare, and more.",
            pay=75, pay_max=500, duration="30–90 min", location="Remote / USA", state="Remote", is_remote=True,
            category="User Interview", source_url="https://app.respondent.io",
            apply_url="https://app.respondent.io/next/participants/signup",
            tags=["login-required","remote","high-pay"],
            score=75, is_featured=True, expires_at=expires_iso(90)),
        Listing(title="User Interviews — Browse Hundreds of Remote Research Studies", company="User Interviews",
            description="User Interviews is the largest marketplace for paid research — thousands of studies posted monthly. Topics include tech, finance, healthcare, and lifestyle. Create a free account to see studies matched to you. Average pay: $50–$150/hr.",
            pay=50, pay_max=300, duration="30–90 min", location="Remote / USA", state="Remote", is_remote=True,
            category="User Interview", source_url="https://www.userinterviews.com",
            apply_url="https://app.userinterviews.com/studies",
            tags=["login-required","remote","high-pay"],
            score=75, is_featured=True, expires_at=expires_iso(90)),

        # TASTE TEST
        Listing(title="Curion Consumer Taste Testing Panel ($40–$250 per session)", company="Curion",
            description="Curion is the largest consumer sensory research firm in North America. Register as a panelist and get invited to in-person taste tests for food, beverages, and personal care products in 6 major US cities.",
            pay=40, pay_max=250, duration="30–60 min",
            location="In-Person / Atlanta GA, Boston MA, Chicago IL, Dallas TX, New York NY, San Francisco CA",
            state="Nationwide", is_remote=False, category="Taste Test",
            source_url="https://curionpanelist.com", apply_url="https://curionpanelist.com/register",
            tags=["direct-apply","in-person","food-lover","nationwide","same-week-pay"],
            score=74, is_featured=False, expires_at=expires_iso(60)),
        Listing(title="Contract Testing — Sensory & Taste Panel ($35–$100)", company="Contract Testing Inc.",
            description="Contract Testing Inc. runs sensory evaluation panels for food, beverage, and household products across 19 US and Canada locations. Register as a panelist and get paid $35–$100 per 45–90 minute session.",
            pay=35, pay_max=100, duration="45–90 min",
            location="In-Person / 19 USA & Canada Locations",
            state="Nationwide", is_remote=False, category="Taste Test",
            source_url="https://www.contracttesting.com", apply_url="https://www.contracttesting.com/register",
            tags=["direct-apply","in-person","food-lover","nationwide"],
            score=68, is_featured=False, expires_at=expires_iso(60)),
        Listing(title="McCormick Spice Consumer Taste Panel ($50–$100)", company="McCormick & Company",
            description="McCormick invites consumers to taste and evaluate new spice blends, sauces, and flavor products at their Hunt Valley MD facility or via home-use tests. Register to be invited to upcoming sessions.",
            pay=50, pay_max=100, duration="30–60 min",
            location="In-Person / Hunt Valley MD + Remote Home Tests",
            state="MD", is_remote=False, category="Taste Test",
            source_url="https://www.mccormickcorporation.com/en/consumer-testing",
            apply_url="https://www.mccormickcorporation.com/en/consumer-testing",
            tags=["direct-apply","food-lover","keep-the-product"],
            score=70, is_featured=False, expires_at=expires_iso(60)),
        Listing(title="Tasteocracy Consumer Taste Testing Panel ($40–$120)", company="Tasteocracy",
            description="Tasteocracy runs consumer taste tests 7 days a week in Minneapolis MN, Livermore CA, and Bound Brook NJ. Kids as young as 5 can participate with a parent. Pays $40–$120 per session.",
            pay=40, pay_max=120, duration="30–90 min",
            location="In-Person / Minneapolis MN, Livermore CA, Bound Brook NJ",
            state="Nationwide", is_remote=False, category="Taste Test",
            source_url="https://www.tasteocracy.com", apply_url="https://www.tasteocracy.com",
            tags=["direct-apply","in-person","food-lover","family-friendly"],
            score=68, is_featured=False, expires_at=expires_iso(60)),

        # FOCUS GROUPS
        Listing(title="Fieldwork Focus Group Studies — Multiple Topics & Cities ($75–$250)", company="Fieldwork",
            description="Fieldwork is one of the nation's largest focus group facility networks with locations in Atlanta, Chicago, Dallas, New York, and Los Angeles. Join their participant database to get invited to paid focus groups.",
            pay=75, pay_max=250, duration="60–120 min",
            location="In-Person / Atlanta GA, Chicago IL, Dallas TX, New York NY, Los Angeles CA",
            state="Nationwide", is_remote=False, category="Focus Group",
            source_url="https://www.fieldwork.com", apply_url="https://www.fieldwork.com/participate/",
            tags=["direct-apply","in-person","high-pay","nationwide"],
            score=72, is_featured=False, expires_at=expires_iso(30)),
        Listing(title="Schlesinger Group — Focus Groups & In-Depth Interviews ($75–$300)", company="Schlesinger Group",
            description="The Schlesinger Group is America's largest research facility network with 20+ locations nationwide. Sign up to participate in paid focus groups, IDIs, and online studies on virtually every topic.",
            pay=75, pay_max=300, duration="60–90 min",
            location="In-Person / 20+ USA Locations + Remote",
            state="Nationwide", is_remote=False, category="Focus Group",
            source_url="https://www.schlesingergroup.com", apply_url="https://www.schlesingergroup.com/en/participants/",
            tags=["direct-apply","in-person","high-pay","nationwide"],
            score=73, is_featured=False, expires_at=expires_iso(30)),
        Listing(title="L&E Research — Focus Groups & Market Research Studies ($100–$300)", company="L&E Research",
            description="L&E Research hosts focus groups and in-depth interviews across the USA on topics ranging from consumer products to healthcare. Join their participant panel and get invited to local and online studies.",
            pay=100, pay_max=300, duration="60–90 min",
            location="In-Person + Remote / USA", state="Nationwide", is_remote=False, category="Focus Group",
            source_url="https://leresearch.com", apply_url="https://leresearch.com/participants_signup.htm",
            tags=["direct-apply","in-person","high-pay","nationwide"],
            score=74, is_featured=False, expires_at=expires_iso(30)),
        Listing(title="20|20 Research — Consumer Research Studies ($50–$150)", company="20|20 Research",
            description="20|20 Research runs focus groups, online communities, and consumer interviews nationwide. Join their participant panel to get matched with local and remote studies on consumer products, tech, and more.",
            pay=50, pay_max=150, duration="60–90 min",
            location="Remote + In-Person / USA", state="Nationwide", is_remote=False, category="Focus Group",
            source_url="https://www.2020research.com", apply_url="https://www.2020research.com/participants/",
            tags=["direct-apply","nationwide"],
            score=65, is_featured=False, expires_at=expires_iso(30)),

        # MOCK JURY
        Listing(title="DecisionQuest — Mock Jury Studies ($100–$550)", company="DecisionQuest",
            description="DecisionQuest pays everyday people to serve as mock jurors for real legal cases. Sessions pay $100–$550 and run 2–4 hours. No legal knowledge required — just your honest verdict. Remote and in-person available.",
            pay=100, pay_max=550, duration="2–4 hours",
            location="Remote + In-Person / USA", state="Nationwide", is_remote=True, category="Mock Jury",
            source_url="https://www.decisionquest.com", apply_url="https://www.decisionquest.com/mock-jury/",
            tags=["direct-apply","high-pay","nationwide"],
            score=74, is_featured=False, expires_at=expires_iso(30)),
        Listing(title="eJury — Online Mock Jury Cases ($5–$10 per case, 20 min)", company="eJury",
            description="eJury pays you to serve as a mock juror for real legal cases. Read a brief case summary and share your verdict. Each case takes 20–30 minutes and pays $5–$10. New cases available regularly.",
            pay=5, pay_max=10, duration="20–30 min",
            location="Remote / USA", state="Remote", is_remote=True, category="Easy Application",
            source_url="https://www.ejury.com", apply_url="https://www.ejury.com/p/register.html",
            tags=["direct-apply","remote","beginner-friendly","easy-apply"],
            score=55, is_featured=False, expires_at=expires_iso(90)),

        # MEDICAL & HEALTH
        Listing(title="ICON Clinical Research — Medical & Pharmaceutical Studies ($100–$1,500)", company="ICON Clinical Research",
            description="ICON plc runs paid medical and pharmaceutical studies. Participants share health information and may try new treatments. Studies pay $100–$1,500 depending on type and duration. Register as a volunteer.",
            pay=100, pay_max=1500, duration="Varies",
            location="In-Person / USA", state="Nationwide", is_remote=False, category="Medical & Health",
            source_url="https://www.iconplc.com", apply_url="https://www.iconplc.com/clinical-research/volunteers/",
            tags=["direct-apply","in-person","high-pay","nationwide"],
            score=75, is_featured=True, expires_at=expires_iso(30)),
        Listing(title="Rare Patient Voice — Patient & Caregiver Research Studies ($100–$250/hr)", company="Rare Patient Voice",
            description="Rare Patient Voice connects patients and caregivers with paid medical research studies. Browse available studies by condition and earn $100–$250/hr for sharing your health experiences.",
            pay=100, pay_max=250, duration="60 min",
            location="Remote / USA", state="Remote", is_remote=True, category="Medical & Health",
            source_url="https://rarepatientvoice.com", apply_url="https://rarepatientvoice.com/sign-up/",
            tags=["direct-apply","remote","high-pay"],
            score=74, is_featured=False, expires_at=expires_iso(30)),

        # PRODUCT TESTING
        Listing(title="Nielsen Consumer Household Purchase Tracking Panel ($50–$200/yr)", company="Nielsen",
            description="The Nielsen Consumer Panel pays households to scan their purchases at home. Track what you buy and earn points redeemable for merchandise and gift cards worth $50–$200/year.",
            pay=50, pay_max=200, duration="Ongoing",
            location="Remote / USA", state="Remote", is_remote=True, category="Product Testing",
            source_url="https://www.nielsen.com", apply_url="https://www.nielsen.com/us/en/nielsen-consumer-panel/",
            tags=["direct-apply","remote","keep-the-product","recurring"],
            score=62, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Influenster — Review Free Products Sent to Your Door", company="Influenster",
            description="Influenster sends free products to members for review. From skincare to food to tech gadgets — you keep everything you try. Sign up free, build your profile, and get matched with product campaigns.",
            pay=0, pay_max=50, duration="Ongoing",
            location="Remote / USA", state="Remote", is_remote=True, category="Product Testing",
            source_url="https://www.influenster.com", apply_url="https://www.influenster.com/sign-up",
            tags=["direct-apply","remote","keep-the-product","beginner-friendly","easy-apply"],
            score=58, is_featured=False, expires_at=expires_iso(90)),
        Listing(title="Home Tester Club — Test & Review New Products at Home", company="Home Tester Club",
            description="Home Tester Club sends free household and personal care products to members for testing and review. Apply for campaigns that interest you, receive products, share honest feedback. Keep everything you test.",
            pay=0, pay_max=40, duration="Ongoing",
            location="Remote / USA", state="Remote", is_remote=True, category="Product Testing",
            source_url="https://www.hometesterclub.com", apply_url="https://www.hometesterclub.com/us/en",
            tags=["direct-apply","remote","keep-the-product","beginner-friendly","family-friendly"],
            score=56, is_featured=False, expires_at=expires_iso(90)),

        # GAMING & TECH
        Listing(title="EA Playtest — Test Unreleased Video Games ($50–$150)", company="Electronic Arts",
            description="EA Playtest invites gamers to test unreleased video games before launch. Share feedback on gameplay, graphics, and experience. Studies run 2–3 hours and pay $50–$150. Register and get invited.",
            pay=50, pay_max=150, duration="2–3 hours",
            location="Remote / USA", state="Remote", is_remote=True, category="Gaming",
            source_url="https://playtest.ea.com", apply_url="https://playtest.ea.com",
            tags=["direct-apply","remote","tech-savvy"],
            score=65, is_featured=False, expires_at=expires_iso(30)),
    ]

# ── Supabase ──────────────────────────────────────────────────────────────────
def get_sb(): return create_client(SUPABASE_URL, SUPABASE_KEY)

def upsert_listing(sb, l):
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "Title":l.title, "Company":l.company, "Description":l.description,
        "Pay":l.pay, "Pay_Max":l.pay_max, "Duration":l.duration,
        "Location":l.location, "State":l.state, "Is_Remote":l.is_remote,
        "Category":l.category, "Source_URL":l.source_url, "Apply_URL":l.apply_url,
        "Score":l.score, "Hourly_Rate":l.hourly_rate, "Is_Featured":l.is_featured,
        "Tags":l.tags, "Status":"active", "Last_Seen":now, "Expires_At":l.expires_at,
    }
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
        res = sb.table("Listings").update({"Status":"expired"})\
            .eq("Status","active").lt("Expires_At",now)\
            .not_.is_("Expires_At","null").execute()
        n = len(res.data) if res.data else 0
        log.info(f"  Expired {n} by date"); return n
    except Exception as e:
        log.error(f"  {e}"); return 0

def expire_stale(sb, days=30):
    cutoff = (datetime.now(timezone.utc)-timedelta(days=days)).isoformat()
    try:
        res = sb.table("Listings").update({"Status":"expired"})\
            .eq("Status","active").is_("Expires_At","null")\
            .lt("Last_Seen",cutoff).execute()
        n = len(res.data) if res.data else 0
        log.info(f"  Expired {n} stale"); return n
    except Exception as e:
        log.error(f"  {e}"); return 0

def curate(listings):
    """
    Rule-based curation — all evergreen listings have scores set directly.
    For scraped listings, score by category + pay.
    """
    curated = []
    for l in listings:
        # Evergreen listings already have scores set
        if l.score == 0:
            l.score = score_by_category(l.category, l.pay, l.pay_max, l.is_remote)
        l.is_featured = l.score >= FEATURED_SCORE
        if not l.description:
            l.description = (
                f"A paid {l.category.lower()} opportunity with {l.company}. "
                f"Share your opinions to help shape future products and services. "
                f"{'Login required to see full details and apply.' if any(t in (l.tags or []) for t in ['login-required']) else 'Apply directly on their website.'}"
            )
        if l.score >= MIN_SCORE:
            curated.append(l)
        else:
            log.debug(f"  SKIP [{l.score}] {l.title[:50]}")
    return curated

def daily_cleanup(sb):
    """
    Automated daily cleanup — runs after scraping.
    Replaces the need to manually run SQL queries every day.
    """
    log.info("\n🧹 DAILY CLEANUP...")
    total_fixed = 0

    # 1. Strip $0CityName suffixes from titles
    try:
        res = sb.table("Listings").select("id,Title").eq("Status","active").like("Title","%$0%").execute()
        for row in (res.data or []):
            clean = row["Title"].split("$0")[0].strip()
            if clean and len(clean) > 5:
                sb.table("Listings").update({"Title": clean}).eq("id", row["id"]).execute()
                total_fixed += 1
        log.info(f"  Cleaned {total_fixed} titles with $0CityName suffix")
    except Exception as e:
        log.error(f"  Title cleanup error: {e}")

    # 2. Fix categories — move misclassified listings
    category_fixes = [
        # Medical conditions shouldn't be in App & UX
        {"filter": {"Category": "App & UX Testing"}, "keywords": ["dental","clinical","patient","medical","health","drug","trial","disease","disorder","cancer","diabetes","migraine"], "new_cat": "Medical & Health"},
        # Focus groups shouldn't be in App & UX
        {"filter": {"Category": "App & UX Testing"}, "keywords": ["focus group","market research","give your opinion","share your opinion","paid session","paid interview","online diary","online community"], "new_cat": "Focus Group"},
        # Gaming shouldn't be in App & UX
        {"filter": {"Category": "App & UX Testing"}, "keywords": ["gamer","gaming","video game","hoops","basketball","esport"], "new_cat": "Gaming"},
        # Tech studies in App & UX should be AI & Tech
        {"filter": {"Category": "App & UX Testing"}, "keywords": ["voice assistant","tech wearable","digital ads","wearable tech","smart device"], "new_cat": "AI & Tech"},
        # Skincare in App & UX should be Retail & Lifestyle
        {"filter": {"Category": "App & UX Testing"}, "keywords": ["skincare","beauty","cosmetic","makeup","haircare","fashion"], "new_cat": "Retail & Lifestyle"},
        # Finance spam cleanup
        {"filter": {"Category": "Finance"}, "keywords": ["crypto","bitcoin","forex","investment opportunity","passive income"], "new_cat": None},  # None = delete
    ]

    for fix in category_fixes:
        try:
            query = sb.table("Listings").select("id,Title").eq("Status","active").eq("Category", fix["filter"]["Category"])
            res = query.execute()
            for row in (res.data or []):
                title_lower = row["Title"].lower()
                if any(kw in title_lower for kw in fix["keywords"]):
                    if fix["new_cat"]:
                        sb.table("Listings").update({"Category": fix["new_cat"]}).eq("id", row["id"]).execute()
                    else:
                        sb.table("Listings").update({"Status": "expired"}).eq("id", row["id"]).execute()
                    total_fixed += 1
        except Exception as e:
            log.error(f"  Category fix error: {e}")

    # 3. Remove duplicate Craigslist listings (same study posted across cities)
    try:
        res = sb.table("Listings").select("id,Title,Apply_URL").eq("Status","active").eq("Company","Craigslist Research").execute()
        seen_urls = {}
        seen_titles = {}
        to_delete = []

        for row in (res.data or []):
            # Dedup by Apply_URL
            url = row.get("Apply_URL","")
            if url and url not in ("","None"):
                if url in seen_urls:
                    to_delete.append(row["id"])
                    continue
                seen_urls[url] = row["id"]

            # Dedup by clean title (strip city/price suffixes)
            import re
            clean = re.sub(r'\s*[-–|]\s*\$[\d,]+.*$', '', row["Title"]).strip().lower()[:50]
            clean = re.sub(r'\$\d+.*$', '', clean).strip()
            if len(clean) > 10:
                if clean in seen_titles:
                    to_delete.append(row["id"])
                    continue
                seen_titles[clean] = row["id"]

        for id_ in to_delete:
            sb.table("Listings").update({"Status":"expired"}).eq("id", id_).execute()

        log.info(f"  Removed {len(to_delete)} duplicate Craigslist listings")
        total_fixed += len(to_delete)
    except Exception as e:
        log.error(f"  Dedup error: {e}")

    # 4. Remove spam by title keywords
    spam_titles = [
        "vocalist","cover band","musician wanted","side hustle - high paying",
        "fast cash opportunity","quick cash gig","make money fast",
        "get rich","financial freedom","passive income","sugar daddy",
        "telus digital","qr code link to this post"
    ]
    try:
        res = sb.table("Listings").select("id,Title,Company").eq("Status","active").execute()
        spam_count = 0
        for row in (res.data or []):
            combined = (row["Title"] + " " + (row["Company"] or "")).lower()
            if any(s in combined for s in spam_titles):
                sb.table("Listings").update({"Status":"expired"}).eq("id", row["id"]).execute()
                spam_count += 1
        log.info(f"  Removed {spam_count} spam listings")
        total_fixed += spam_count
    except Exception as e:
        log.error(f"  Spam removal error: {e}")

    # 5. Fix pay anomalies — Craigslist listings with pay > 3000 or pay < 30
    try:
        res = sb.table("Listings").select("id,Title,Pay").eq("Status","active").eq("Company","Craigslist Research").execute()
        pay_fixed = 0
        for row in (res.data or []):
            pay = row.get("Pay") or 0
            if pay > 3000 or (pay > 0 and pay < 30):
                sb.table("Listings").update({"Status":"expired"}).eq("id", row["id"]).execute()
                pay_fixed += 1
        log.info(f"  Expired {pay_fixed} Craigslist listings with bad pay")
        total_fixed += pay_fixed
    except Exception as e:
        log.error(f"  Pay fix error: {e}")

    log.info(f"  ✅ Daily cleanup complete — {total_fixed} total fixes")
    return total_fixed

def run():
    log.info("="*60)
    log.info("StudyCashBoard Scraper v8")
    log.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    log.info("="*60)

    sb = get_sb()

    log.info("\n📡 SCRAPING...")
    raw = []
    for name, fn in [
        ("FindPaidFocusGroup", scrape_findpaidfocusgroup),
        ("FocusGroups.org",    scrape_focusgroups_org),
        ("Evergreen DB",       get_all_listings),
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

    # Dedup
    seen = set()
    deduped = []
    for l in raw:
        if not l.title or len(l.title.strip()) < 8: continue
        key = l.title.lower().strip()[:60]
        if key not in seen:
            seen.add(key)
            deduped.append(l)
    log.info(f"🔍 After dedup: {len(deduped)}")

    log.info("\n🤖 CURATING...")
    curated = curate(deduped)

    cats = {}
    for l in curated: cats[l.category] = cats.get(l.category, 0)+1
    log.info(f"\n⭐ Curated: {len(curated)} listings")
    for cat, cnt in sorted(cats.items(), key=lambda x:-x[1]):
        log.info(f"   {cat}: {cnt}")

    log.info("\n📥 UPSERTING...")
    ins=upd=skp=0
    for l in curated:
        r = upsert_listing(sb, l)
        if r=="inserted": ins+=1
        elif r=="updated": upd+=1
        else: skp+=1

    log.info("\n🗑  EXPIRING...")
    e1 = expire_by_date(sb)
    e2 = expire_stale(sb, days=30)

    log.info("\n🧹 CLEANING UP...")
    daily_cleanup(sb)

    log.info("\n"+"="*60)
    log.info(f"✅ DONE — inserted={ins} updated={upd} skipped={skp} expired={e1+e2}")
    log.info("="*60)

if __name__ == "__main__":
    run()
