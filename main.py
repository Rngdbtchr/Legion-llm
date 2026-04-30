import os
import secrets

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import openai
from dotenv import load_dotenv

# Required for OAuth2 over plain HTTP during local development
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

openai.api_key = os.getenv("OPENAI_API_KEY")

# In-memory CSRF state for the OAuth2 flow (single-user deployment)
_oauth_state: str | None = None


# ---------------------------------------------------------------------------
# Google OAuth2 routes
# ---------------------------------------------------------------------------


@app.get("/api/auth/google")
async def google_auth():
    """Return the Google OAuth2 authorization URL for the frontend to redirect to."""
    global _oauth_state
    from google_tasks import get_flow

    flow = get_flow()
    _oauth_state = secrets.token_urlsafe(16)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        state=_oauth_state,
        prompt="consent",
    )
    return {"auth_url": auth_url}


@app.get("/api/auth/callback")
async def google_callback(code: str, state: str = ""):
    """Handle the OAuth2 callback, store credentials, and redirect to the frontend."""
    global _oauth_state
    from google_tasks import get_flow, save_credentials

    if state != _oauth_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    flow = get_flow()
    flow.fetch_token(code=code)
    save_credentials(flow.credentials)

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(url=f"{frontend_url}?auth=success")


@app.get("/api/auth/status")
async def auth_status():
    from google_tasks import is_authenticated

    return {"authenticated": is_authenticated()}


@app.post("/api/auth/logout")
async def auth_logout():
    from google_tasks import revoke

    revoke()
    return {"success": True}


# ---------------------------------------------------------------------------
# Google Tasks routes
# ---------------------------------------------------------------------------


@app.get("/api/tasks/lists")
async def get_task_lists():
    from google_tasks import get_service, list_task_lists

    service = get_service()
    if not service:
        raise HTTPException(status_code=401, detail="Not authenticated with Google")
    return list_task_lists(service)


@app.get("/api/tasks")
async def get_tasks(tasklist_id: str = "@default"):
    from google_tasks import get_service, list_tasks

    service = get_service()
    if not service:
        raise HTTPException(status_code=401, detail="Not authenticated with Google")
    return list_tasks(service, tasklist_id)


@app.post("/api/tasks")
async def create_task(request: Request):
    from google_tasks import get_service

    service = get_service()
    if not service:
        raise HTTPException(status_code=401, detail="Not authenticated with Google")
    body = await request.json()
    task = (
        service.tasks()
        .insert(
            tasklist=body.get("tasklist_id", "@default"),
            body={"title": body.get("title", ""), "notes": body.get("notes", "")},
        )
        .execute()
    )
    return task


@app.patch("/api/tasks/{task_id}")
async def update_task(task_id: str, request: Request):
    from google_tasks import get_service

    service = get_service()
    if not service:
        raise HTTPException(status_code=401, detail="Not authenticated with Google")
    body = await request.json()
    tasklist_id = body.pop("tasklist_id", "@default")
    task = (
        service.tasks()
        .patch(tasklist=tasklist_id, task=task_id, body=body)
        .execute()
    )
    return task


@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str, tasklist_id: str = "@default"):
    from google_tasks import get_service

    service = get_service()
    if not service:
        raise HTTPException(status_code=401, detail="Not authenticated with Google")
    service.tasks().delete(tasklist=tasklist_id, task=task_id).execute()
    return {"success": True}


# ---------------------------------------------------------------------------
# Chat route
# ---------------------------------------------------------------------------


@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    user_prompt = body.get("prompt", "")

    # Inject pending task context when the user is connected to Google Tasks
    task_context = ""
    try:
        from google_tasks import get_pending_task_titles, get_service, is_authenticated

        if is_authenticated():
            service = get_service()
            if service:
                titles = get_pending_task_titles(service)
                if titles:
                    bullet_list = "\n".join(f"- {t}" for t in titles)
                    task_context = (
                        f"\n\nThe user's current pending Google Tasks:\n{bullet_list}"
                        "\n\nFeel free to reference these tasks if relevant to your response."
                    )
    except Exception:
        pass

    agents = {
        "gpt4": f"You are GPT-4o, a master of logic and synthesis.{task_context}",
        "gemini": f"You are Gemini, a creative lateral thinker.{task_context}",
        "claude": f"You are Claude, a wise ethical philosopher.{task_context}",
        "deepseek": f"You are DeepSeek, a data and research analyst.{task_context}",
        "mistral": f"You are Mistral, a tactical contrarian.{task_context}",
    }

    responses = {}
    for agent_id, system_prompt in agents.items():
        try:
            res = openai.ChatCompletion.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.8,
                max_tokens=300,
            )
            responses[agent_id] = res.choices[0].message["content"]
        except Exception as e:
            responses[agent_id] = f"[Error] {str(e)}"

    return responses
