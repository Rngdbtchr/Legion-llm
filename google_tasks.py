import os
import json
from pathlib import Path

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/tasks"]
TOKEN_FILE = "google_token.json"


def _client_config():
    return {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [_redirect_uri()],
        }
    }


def _redirect_uri():
    return os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/callback")


def get_flow():
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES)
    flow.redirect_uri = _redirect_uri()
    return flow


def save_credentials(creds: Credentials):
    data = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes) if creds.scopes else SCOPES,
    }
    with open(TOKEN_FILE, "w") as f:
        json.dump(data, f)


def load_credentials() -> Credentials | None:
    if not Path(TOKEN_FILE).exists():
        return None
    with open(TOKEN_FILE) as f:
        data = json.load(f)
    return Credentials(
        token=data.get("token"),
        refresh_token=data.get("refresh_token"),
        token_uri=data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=data.get("client_id", os.getenv("GOOGLE_CLIENT_ID")),
        client_secret=data.get("client_secret", os.getenv("GOOGLE_CLIENT_SECRET")),
        scopes=data.get("scopes", SCOPES),
    )


def is_authenticated() -> bool:
    return Path(TOKEN_FILE).exists()


def revoke():
    path = Path(TOKEN_FILE)
    if path.exists():
        path.unlink()


def get_service():
    creds = load_credentials()
    if not creds:
        return None
    return build("tasks", "v1", credentials=creds)


def list_task_lists(service) -> list:
    result = service.tasklists().list(maxResults=20).execute()
    return result.get("items", [])


def list_tasks(service, tasklist_id: str = "@default") -> list:
    result = (
        service.tasks()
        .list(tasklist=tasklist_id, showCompleted=True, maxResults=100)
        .execute()
    )
    return result.get("items", [])


def get_pending_task_titles(service, tasklist_id: str = "@default") -> list[str]:
    result = (
        service.tasks()
        .list(tasklist=tasklist_id, showCompleted=False, maxResults=20)
        .execute()
    )
    return [t.get("title", "Untitled") for t in result.get("items", [])]
