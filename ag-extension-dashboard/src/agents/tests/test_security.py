"""
Cybersecurity Test Suite for AI Agents Microservice
Validates CORS restrictions, authentication enforcement, sensitive data masking, and input validation.
"""

import pytest
import os
import jwt
from fastapi.testclient import TestClient
from fastapi.middleware.cors import CORSMiddleware

# Set test environment
os.environ["NODE_ENV"] = "test"
os.environ["JWT_SECRET"] = "test_jwt_secret_32_characters_minimum!!"
os.environ["CORS_ORIGINS"] = "https://www.gpexts.com,http://localhost:7503"

from main import app, ALLOWED_ORIGINS, JWT_SECRET


class TestAgentSecurity:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def auth_headers(self):
        token = jwt.encode(
            {"user_id": "test-admin", "role": "admin"},
            JWT_SECRET,
            algorithm="HS256"
        )
        return {"Authorization": f"Bearer {token}"}

    def test_cors_policy_not_wildcard_with_credentials(self):
        """Verify CORS does not use wildcard '*' with allow_credentials=True."""
        assert "*" not in ALLOWED_ORIGINS, "Wildcard '*' must never be permitted in CORS allowed origins"
        assert "https://www.gpexts.com" in ALLOWED_ORIGINS

        cors_middlewares = [
            m for m in app.user_middleware if m.cls == CORSMiddleware
        ]
        assert len(cors_middlewares) > 0
        middleware_kwargs = cors_middlewares[0].kwargs
        assert middleware_kwargs.get("allow_credentials") is True
        assert "*" not in middleware_kwargs.get("allow_origins", [])

    def test_health_endpoint_masks_credentials(self, client):
        """Verify health check endpoint returns status without leaking DB/API keys."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()

        assert "status" in data
        raw_text = response.text
        assert "postgresql://" not in raw_text
        assert "redis://" not in raw_text
        assert os.environ.get("JWT_SECRET") not in raw_text

    def test_unauthenticated_request_rejected(self, client):
        """Verify protected endpoints reject requests without a Bearer token with 401."""
        response = client.post("/api/execute", json={"prompt": "test"})
        assert response.status_code == 401
        assert "detail" in response.json()

    def test_invalid_token_rejected(self, client):
        """Verify endpoints reject forged/corrupted tokens with 401."""
        bad_headers = {"Authorization": "Bearer bad_forged_token_xyz"}
        response = client.post("/api/execute", json={"prompt": "test"}, headers=bad_headers)
        assert response.status_code == 401

    def test_invalid_task_payload_rejection_with_auth(self, client, auth_headers):
        """Verify malformed or invalid payloads are rejected with HTTP 422 Unprocessable Entity."""
        invalid_payload = {
            "invalid_key": "some_value"
        }
        response = client.post("/api/execute", json=invalid_payload, headers=auth_headers)
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
