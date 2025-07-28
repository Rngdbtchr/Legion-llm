
# LEGION – Multi-Agent LLM Chat Framework

Chat with multiple AI agents at once. GPT-4o simulates a council of minds including Gemini, Claude, DeepSeek, and Mistral.

## 📦 Installation

### Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Env
Create a `.env` file in `/backend` with your OpenAI API key:
```
OPENAI_API_KEY=sk-...
```
