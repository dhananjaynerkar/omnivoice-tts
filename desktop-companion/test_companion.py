import asyncio
import json
import pytest
from fastapi.testclient import TestClient
from server import app, clean_markdown_for_speech
from config import AUTH_TOKEN

def test_health_check():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data

def test_clean_markdown():
    md = "# Heading Title\n\nThis is **bold** text and [my website](https://example.com).\n\n- First point\n- Second point"
    cleaned = clean_markdown_for_speech(md)
    assert "#" not in cleaned
    assert "**" not in cleaned
    assert "https://example.com" not in cleaned
    assert "Heading Title" in cleaned
    assert "bold text" in cleaned
    assert "my website" in cleaned
    assert "Item: First point" in cleaned

def test_http_speak_endpoint():
    client = TestClient(app)
    resp = client.post("/speak", json={"text": "# Hello world in Markdown"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

def test_websocket_auth_handshake():
    client = TestClient(app)
    with client.websocket_connect("/ws") as websocket:
        auth_req = {
            "type": "AUTH_REQUEST",
            "token": AUTH_TOKEN,
            "payload": {"token": AUTH_TOKEN},
            "timestamp": 123456
        }
        websocket.send_text(json.dumps(auth_req))
        resp = json.loads(websocket.receive_text())
        assert resp["type"] == "AUTH_RESPONSE"
        assert resp["payload"]["authenticated"] is True

def test_websocket_invalid_auth():
    client = TestClient(app)
    with client.websocket_connect("/ws") as websocket:
        auth_req = {
            "type": "AUTH_REQUEST",
            "token": "invalid_wrong_token",
            "payload": {"token": "invalid_wrong_token"},
            "timestamp": 123456
        }
        websocket.send_text(json.dumps(auth_req))
        resp = json.loads(websocket.receive_text())
        assert resp["type"] == "AUTH_RESPONSE"
        assert resp["payload"]["authenticated"] is False

if __name__ == "__main__":
    test_health_check()
    test_clean_markdown()
    test_http_speak_endpoint()
    test_websocket_auth_handshake()
    test_websocket_invalid_auth()
    print("✓ All Desktop Companion and Markdown Reading tests passed successfully!")
