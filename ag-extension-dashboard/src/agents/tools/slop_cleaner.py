import re

SLOP_MAP = {
    r"\bleverage\b": "use",
    r"\bleverages\b": "uses",
    r"\bleveraged\b": "used",
    r"\bleveraging\b": "using",
    
    r"\bdelve\b": "explore",
    r"\bdelves\b": "explores",
    r"\bdelved\b": "explored",
    r"\bdelving\b": "exploring",
    
    r"\btestament\b": "proof",
    r"\btestaments\b": "proofs",
    
    r"\btapestry\b": "web",
    r"\btapestries\b": "webs",
    
    r"\bgame-changer\b": "significant shift",
    r"\bgame-changers\b": "significant shifts",
    
    r"\brevolutionize\b": "transform",
    r"\brevolutionizes\b": "transforms",
    r"\brevolutionized\b": "transformed",
    r"\brevolutionizing\b": "transforming",
    
    r"\bmultifaceted\b": "varied",
    
    r"\bmoreover\b": "also",
    r"\bfurthermore\b": "also",
    
    r"\brealm\b": "area",
    r"\brealms\b": "areas",
    
    r"\bdemystify\b": "explain",
    r"\bdemystifies\b": "explains",
    r"\bdemystified\b": "explained",
    r"\bdemystifying\b": "explaining",
    
    r"\bbeacon\b": "guide",
    r"\bbeacons\b": "guides",
    
    r"\btreasure trove\b": "rich collection",
    
    r"\bplethora\b": "abundance",
    
    r"\butmost\b": "greatest",
    
    r"\bbespoke\b": "custom",
    
    r"\bcutting-edge\b": "advanced",
    
    r"\brobust\b": "reliable",
    r"\brobustly\b": "reliably",
    r"\brobustness\b": "reliability",
}

def clean_slop(text: str) -> str:
    """Scan and replace AI slop terms with natural human-like alternatives."""
    if not text:
        return text
    
    for pattern, replacement in SLOP_MAP.items():
        def make_repl(match, rep=replacement):
            word = match.group(0)
            if word.isupper():
                return rep.upper()
            if word[0].isupper():
                return rep[0].upper() + rep[1:]
            return rep
            
        text = re.sub(pattern, make_repl, text, flags=re.IGNORECASE)
    return text
