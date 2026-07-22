import re
from urllib.parse import urlparse, urlunparse


def normalize_linkedin_url(url: str) -> str:
    """
    Normalize a LinkedIn URL for comparison and storage.
    
    This function:
    - Converts to lowercase
    - Removes trailing slashes
    - Removes www. prefix
    - Removes query parameters and fragments
    - Ensures consistent format
    
    Args:
        url: The LinkedIn URL to normalize
        
    Returns:
        Normalized LinkedIn URL
    """
    if not url:
        return ""
    
    # Parse the URL
    parsed = urlparse(url.strip())
    
    # Convert to lowercase
    netloc = parsed.netloc.lower()
    path = parsed.path.lower()
    
    # Remove www. prefix
    if netloc.startswith("www."):
        netloc = netloc[4:]
    
    # Remove trailing slash from path
    path = path.rstrip("/")
    
    # Reconstruct URL without query params or fragments
    normalized = urlunparse((
        parsed.scheme,  # Keep scheme (https)
        netloc,         # Normalized netloc
        path,           # Normalized path
        "",              # Remove params
        "",              # Remove query
        ""               # Remove fragment
    ))
    
    return normalized


def validate_linkedin_url(url: str) -> bool:
    """
    Validate that a URL is a LinkedIn profile URL.
    
    Args:
        url: The URL to validate
        
    Returns:
        True if valid LinkedIn URL, False otherwise
    """
    if not url:
        return False
    
    normalized = normalize_linkedin_url(url)
    
    # Check if it's a LinkedIn URL
    pattern = r'^https?://linkedin\.com/in/[\w-]+$'
    return bool(re.match(pattern, normalized))
