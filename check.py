import requests

url = "https://apis-prelive.quran.foundation/quran-reflect/v1/users/profile"

payload={}
headers = {
  'Accept': 'application/json',
  'x-auth-token': 'qwerty',
  'x-client-id': 'qwerty'
}

response = requests.request("GET", url, headers=headers, data=payload)

print(response.text)