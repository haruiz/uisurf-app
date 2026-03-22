from google import genai
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

client = genai.Client()

print("List of models that support generateContent:\n")
for m in client.models.list():
    # for action in m.supported_actions:
    #     if action == "generateContent":
    print(m.name)

print("\n\n List of models that support bidiGenerateContent:\n")
for m in client.models.list():
    #print(m.name, m.supported_actions)
    if "bidiGenerateContent" in m.supported_actions:
        print(m.name)

