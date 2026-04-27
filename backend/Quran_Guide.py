import os
import json
import re
from ollama import Client
from dotenv import load_dotenv

# Load environment variables (e.g., OLLAMA_API_KEY)
load_dotenv()

def generate_quran_guidance(user_input: str):
    api_key = os.environ.get('OLLAMA_API_KEY')
    if not api_key:
        raise ValueError("Please set the environment variable.")

    client = Client(
        host="https://ollama.com",
        headers={'Authorization': f'Bearer {api_key}'}
    )
    
    system_instruction = (
        "You are a life guide who answers back verse (only one) from quran (the clear quran) "
        "related to what the user is telling/asking. eg. if user is sad , then return the quranic "
        "verse to make him feel better, also include concise description of the verse with respect to the user's query. Return response "
        "in raw JSON format without any markdown blocks. Use these exact fields: "
        "chapter_number (integer), verse_number (integer), description (string - concise explanation of the verse)"
    )
    
    schema = {
        "type": "object",
        "required": ["chapter_number", "verse_number", "description"],
        "properties": {
            "chapter_number": {"type": "integer"},
            "verse_number": {"type": "integer"},
            "description": {"type": "string"}
        }
    }

    messages = [
        {'role': 'system', 'content': system_instruction},
        {'role': 'user', 'content': user_input}
    ]

    try:
        # 5. Call the model with stream=False
        response = client.chat(
            model='gemini-3-flash-preview:cloud', 
            messages=messages,
            format=schema,
            stream=False, # Changed to False
            options={'thinkingLevel': 'medium'}
        )
        
        # 6. Grab the full response directly
        full_response = response['message']['content']
            
        # 7. Clean up any accidental Markdown backticks
        clean_response = re.sub(r"^```json\s*", "", full_response.strip(), flags=re.IGNORECASE)
        clean_response = re.sub(r"^```\s*", "", clean_response)
        clean_response = re.sub(r"\s*```$", "", clean_response)
        
        # 8. Parse and RETURN the raw JSON dict
        json_output = json.loads(clean_response)
        return json_output

    except json.JSONDecodeError as e:
        error_msg = f"Failed to parse JSON. Model output was: {full_response}"
        print(f"\n{error_msg}\nError details: {e}")
        raise ValueError(error_msg)
    except Exception as e:
        print(f"\nAn error occurred: {e}")
        raise e

if __name__ == "__main__":
    result = generate_quran_guidance("I am feeling anxious about my job.")
    print(json.dumps(result, indent=2))