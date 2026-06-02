import unicodedata
import sys

def analyze_unicode(text: str):
    print("\n" + "=" * 50)
    print("Unicode Breakdown:")
    print("=" * 50)
    for char in text:
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
        elif char == "\r":
            display_char = "[CR]"
        elif char == "\t":
            display_char = "[TAB]"
            
        print(f"  {display_char}  ->  {code_point}  ({name})")

def main():
    print("=" * 50)
    print("             UNICODE ANALYSER             ")
    print("=" * 50)
    print("Paste your text below. Press Enter then Ctrl+D to analyze:")
    
    try:
        # Read all input until EOF to support multi-line copy-pasting
        input_text = sys.stdin.read()
        
        # Strip trailing newlines added by the input process if it's just one line
        if input_text.endswith('\n'):
            input_text = input_text[:-1]
            
        if input_text:
            analyze_unicode(input_text)
        else:
            print("No input provided.")
            
    except KeyboardInterrupt:
        print("\nOperation cancelled.")
        sys.exit(0)
    except Exception as e:
        print(f"\nError occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
