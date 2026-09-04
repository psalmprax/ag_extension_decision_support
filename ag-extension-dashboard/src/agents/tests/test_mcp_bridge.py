"""
Contract tests for the CrewAI → backend MCP bridge and the CloakBrowser scanner
parser. These run without crewai installed (exercising the BaseTool shim) and
without a network (httpx transport is mocked).
"""
import os
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("NODE_ENV", "test")
os.environ.setdefault("JWT_SECRET", "test_jwt_secret_32_characters_minimum!!")
os.environ["MCP_API_TOKEN"] = "svc-token"
os.environ["BACKEND_URL"] = "http://backend.test"

import crew_main  # noqa: E402

# `crew_main.httpx` is the global httpx module; capture the real Client once so
# successive patches never wrap an earlier fake.
_REAL_CLIENT = httpx.Client


class _Transport(httpx.MockTransport):
    """Records the last request so tests can assert the wire contract."""

    def __init__(self, handler):
        self.last_request = None

        def wrapped(request: httpx.Request) -> httpx.Response:
            self.last_request = request
            return handler(request)

        super().__init__(wrapped)


@pytest.fixture
def patch_client(monkeypatch):
    """Route httpx.Client(...) through a MockTransport."""

    def _install(handler):
        transport = _Transport(handler)

        def fake_client(*args, **kwargs):
            kwargs["transport"] = transport
            return _REAL_CLIENT(*args, **kwargs)

        monkeypatch.setattr(crew_main.httpx, "Client", fake_client)
        return transport

    return _install


def test_call_mcp_tool_uses_tools_call_route_and_parses_content(patch_client):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/mcp/tools/call"
        assert request.method == "POST"
        assert request.headers["authorization"] == "Bearer svc-token"
        body = request.read().decode()
        assert '"name": "get_weather_forecast"' in body or '"name":"get_weather_forecast"' in body
        return httpx.Response(200, json={"success": True, "data": {"content": [{"type": "text", "text": "Sunny, 25C"}]}})

    transport = patch_client(handler)
    out = crew_main.call_mcp_tool("get_weather_forecast", {"location": "Nakuru", "days": 3})
    assert out == "Sunny, 25C"
    assert transport.last_request is not None


def test_call_mcp_tool_surfaces_auth_and_route_errors(patch_client):
    patch_client(lambda r: httpx.Response(401, json={"success": False}))
    with pytest.raises(crew_main.MCPToolError, match="401"):
        crew_main.call_mcp_tool("get_market_prices", {})

    patch_client(lambda r: httpx.Response(404, json={"success": False}))
    with pytest.raises(crew_main.MCPToolError, match="404"):
        crew_main.call_mcp_tool("get_market_prices", {})


def test_call_mcp_tool_treats_isError_as_failure(patch_client):
    patch_client(lambda r: httpx.Response(200, json={"success": True, "data": {"isError": True, "content": [{"type": "text", "text": "boom"}]}}))
    with pytest.raises(crew_main.MCPToolError, match="boom"):
        crew_main.call_mcp_tool("diagnose_plant_disease", {"symptoms": ["spots"]})


def test_tool_result_never_fabricates_on_failure(patch_client, monkeypatch):
    monkeypatch.setattr(crew_main, "MCP_API_TOKEN", "")
    text = crew_main._tool_result("get_weather_forecast", {"location": "X"})
    assert text.startswith("[TOOL UNAVAILABLE: get_weather_forecast]")
    assert "Do not guess" in text


def test_tool_classes_mirror_backend_names_and_arguments(patch_client):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json
        payload = json.loads(request.read().decode())
        seen["payload"] = payload
        return httpx.Response(200, json={"success": True, "data": {"content": [{"type": "text", "text": "ok"}]}})

    patch_client(handler)
    tool = crew_main.DiseaseDiagnosisTool()
    assert tool.name == "diagnose_plant_disease"
    assert tool._run("yellow leaves, spots", cropType="maize") == "ok"
    assert seen["payload"] == {"name": "diagnose_plant_disease", "arguments": {"symptoms": ["yellow leaves", "spots"], "cropType": "maize"}}

    yield_tool = crew_main.CropYieldForecastTool()
    assert yield_tool.name == "crop_yield_forecast"
    yield_tool._run("maize", "Nakuru", areaHectares=2)
    assert seen["payload"]["arguments"] == {"crop": "maize", "region": "Nakuru", "areaHectares": 2.0}


def test_cloak_scanner_generic_parser_reads_description():
    from tools.cloakbrowser.cloak_scanner import CloakBrowserScanner
    from tools.cloakbrowser.cloak_platform_config import get_platform_config

    scanner = CloakBrowserScanner(scraper_url="http://scraper.test", platform="cabi_plantwise")
    config = get_platform_config("cabi_plantwise")
    assert config is not None
    parser = scanner._get_parser("cabi_plantwise")
    items = [{"id": "1", "url": "https://x/1", "title": "Maize lethal necrosis", "description": "Symptoms and control", "author": "CABI"}]
    out = parser(items, config, "maize", "KE")
    assert len(out) == 1
    assert out[0].title == "Maize lethal necrosis"
    assert out[0].description == "Symptoms and control"
    assert out[0].source_uri == "https://x/1"
