import os
import re
import sys
import json
import urllib.request
import urllib.parse
import urllib.error
import unicodedata
from dotenv import load_dotenv

# Load environment variables
# Check current directory and backend directory for .env
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Configurations matching frontend/src/utils/api.js
SCRIPT_TYPE = "text_uthmani"

def clean_arabic_text(text: str) -> str:
    """Fix Arabic Script diacritics according to project rules."""
    # Replace standard sukun (0652) with quranic sukun (06e1)
    text = text.replace("\u0652", "\u06e1")
    # Replace small high rounded zero (06df) with standard sukun (0652)
    text = text.replace("\u06df", "\u0652")
    return text



def fetch_verse_local(chapter: int, verse: int, host="http://localhost:8000"):
    """Fetch verse via local backend proxy server."""
    url = f"{host}/content/api/v4/verses/by_key/{chapter}:{verse}"
    params = {
        "words": "false",
        "fields": SCRIPT_TYPE
    }
    query_string = urllib.parse.urlencode(params)
    full_url = f"{url}?{query_string}"
    
    print(f"[Fetch] Accessing local backend proxy at {full_url}...")
    req = urllib.request.Request(full_url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f"Request failed ({e.code}): {error_body}")

def main():
    print("=" * 50)
    print("             QURAN VERSE RETRIEVER             ")
    print("=" * 50)
    
    # Get user inputs
    try:
        chapter_str = input("Enter Surah (Chapter) Number (1-114): ").strip()
        chapter = int(chapter_str)
        if not (1 <= chapter <= 114):
            print("Error: Surah number must be between 1 and 114.")
            sys.exit(1)
            
        verse_str = input("Enter Ayah (Verse) Number: ").strip()
        verse = int(verse_str)
        if verse <= 0:
            print("Error: Ayah number must be positive.")
            sys.exit(1)
    except ValueError:
        print("Error: Invalid inputs. Please enter numbers.")
        sys.exit(1)
        
    try:
        data = fetch_verse_local(chapter, verse)
            
        # Parse and display verse data
        verse_data = data.get("verse", {})
        if not verse_data:
            print("\nError: No verse data found in response.")
            sys.exit(1)
            
        # Extract Arabic text
        arabic_raw = verse_data.get(SCRIPT_TYPE, "")
        arabic_clean = clean_arabic_text(arabic_raw)
        
        # Display Results
        print("\n" + "=" * 50)
        print(f"SURAH {chapter}, AYAH {verse}")
        print("=" * 50)
        print(f"\nArabic (Uthmani):\n{arabic_clean}")
        
        # Unicode breakdown
        print("\nArabic Unicode Breakdown:")
        for char in arabic_clean:
            code_point = f"U+{ord(char):04X}"
            try:
                name = unicodedata.name(char)
            except ValueError:
                name = "UNKNOWN CHARACTER"
            
            display_char = char
            if char == " ":
                display_char = "[SPACE]"
            elif char == "\n":
                display_char = "[NEWLINE]"
            print(f"  {display_char}  ->  {code_point}  ({name})")
            
        print("=" * 50 + "\n")
        
    except Exception as e:
        print(f"\nError occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
