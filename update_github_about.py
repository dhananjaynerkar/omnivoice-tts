"""
Automated GitHub Repository "About" Section Updater
Updates the repository description, homepage/website, and topics/tags via the GitHub REST API.
"""

import os
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

# Repository Target
OWNER = "dhananjaynerkar"
REPO = "omnivoice-tts"

# Metadata to update
DESCRIPTION = (
    "Production-grade Universal Text-to-Speech (TTS) ecosystem bridging Chrome (MV3, TypeScript) "
    "and Windows desktop apps (VS Code, Word, Terminal) via a Python FastAPI companion. "
    "Features offline SAPI5 synthesis, mathematical/code normalization, and Gemini AI."
)

HOMEPAGE = f"https://github.com/{OWNER}/{REPO}#readme"

TOPICS = [
    "text-to-speech",
    "tts",
    "chrome-extension",
    "manifest-v3",
    "typescript",
    "python",
    "fastapi",
    "accessibility",
    "a11y",
    "assistive-technology",
    "gemini-api",
    "speech-synthesis",
    "vs-code-extension",
    "screen-reader",
    "websockets",
    "sapi5",
    "windows"
]

TOKEN_FILE = Path(__file__).parent / "github_token.txt"

def get_token() -> str:
    """Reads the token from github_token.txt, or environment variable, or prompts user."""
    # 1. Check environment variable
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if token:
        return token

    # 2. Check github_token.txt file
    if TOKEN_FILE.exists():
        content = TOKEN_FILE.read_text(encoding="utf-8").strip()
        # Ignore placeholder text
        if content and not content.startswith("#") and "PASTE_YOUR_TOKEN" not in content:
            return content

    # 3. Prompt user in console
    print("=" * 68)
    print("   AUTOMATED GITHUB REPOSITORY 'ABOUT' UPDATER")
    print("=" * 68)
    print("GitHub API requires a Personal Access Token (PAT) with 'repo' permission.")
    print("\nTo generate a token instantly (already configured for you):")
    print("👉 https://github.com/settings/tokens/new?scopes=repo&description=UpdateAboutSection\n")
    print("Paste your token into 'github_token.txt' OR enter it below:")
    print("-" * 68)
    
    try:
        user_input = input("Enter your GitHub Token (ghp_...): ").strip()
        if user_input:
            # Save for convenience (already gitignored)
            TOKEN_FILE.write_text(user_input, encoding="utf-8")
            return user_input
    except (EOFError, KeyboardInterrupt):
        pass

    return ""

def update_repo_metadata(token: str):
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ReadingX-Updater"
    }

    # 1. Update Description and Homepage
    repo_url = f"https://api.github.com/repos/{OWNER}/{REPO}"
    repo_payload = {
        "description": DESCRIPTION,
        "homepage": HOMEPAGE
    }
    
    print(f"\n[1/2] Updating Description & Website for {OWNER}/{REPO}...")
    req = urllib.request.Request(
        repo_url,
        data=json.dumps(repo_payload).encode("utf-8"),
        headers=headers,
        method="PATCH"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status in (200, 204):
                print("  ✓ Successfully updated Description and Website!")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"  ✗ Failed to update repo details: HTTP {e.code} - {e.reason}")
        print(f"    Details: {body}")
        if e.code == 401:
            print("\n[!] Invalid or expired token. Please verify your token has 'repo' scope.")
        return False
    except Exception as e:
        print(f"  ✗ Connection error: {e}")
        return False

    # 2. Update Topics
    topics_url = f"https://api.github.com/repos/{OWNER}/{REPO}/topics"
    topics_payload = {"names": TOPICS}

    print(f"\n[2/2] Updating Topics/Tags ({len(TOPICS)} tags)...")
    req_topics = urllib.request.Request(
        topics_url,
        data=json.dumps(topics_payload).encode("utf-8"),
        headers=headers,
        method="PUT"
    )

    try:
        with urllib.request.urlopen(req_topics) as resp:
            if resp.status in (200, 204):
                print("  ✓ Successfully updated Topics/Tags!")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"  ✗ Failed to update topics: HTTP {e.code} - {e.reason}")
        print(f"    Details: {body}")
        return False
    except Exception as e:
        print(f"  ✗ Connection error: {e}")
        return False

    print("\n" + "=" * 68)
    print("🎉 ALL DONE! Your GitHub About section is now live and updated!")
    print(f"👉 Check it here: https://github.com/{OWNER}/{REPO}")
    print("=" * 68)
    return True

if __name__ == "__main__":
    token = get_token()
    if not token:
        print("\n[ERROR] No token provided. Exiting.")
        sys.exit(1)

    success = update_repo_metadata(token)
    if not success:
        sys.exit(1)
