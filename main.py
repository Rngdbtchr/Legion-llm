
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import openai
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

openai.api_key = os.getenv("OPENAI_API_KEY")

@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    user_prompt = body.get("prompt", "")

    agents = {
        "gpt4": "You are GPT-4o, a master of logic and synthesis.",
        "gemini": "You are Gemini, a creative lateral thinker.",
        "claude": "You are Claude, a wise ethical philosopher.",
        "deepseek": "You are DeepSeek, a data and research analyst.",
        "mistral": "You are Mistral, a tactical contrarian."
    }

    responses = {}

    for agent_id, system_prompt in agents.items():
        try:
            res = openai.ChatCompletion.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.8,
                max_tokens=300
            )
            responses[agent_id] = res.choices[0].message['content']
        except Exception as e:
            responses[agent_id] = f"[Error] {str(e)}"

    return responses
