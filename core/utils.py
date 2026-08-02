import re
from urllib.parse import urlparse

def normalize_linkedin_url(url: str) -> str:
    if not url:
        return ""
    url = url.strip().split("?")[0].rstrip("/")
    parsed = urlparse(url)
    scheme = "https"
    netloc = parsed.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    path = parsed.path.lower()
    return f"{scheme}://{netloc}{path}"

def validate_linkedin_url(url: str) -> bool:
    if not url:
        return False
    norm = normalize_linkedin_url(url)
    return bool(re.match(r"^https://linkedin\.com/in/[a-z0-9_-]+$", norm))
