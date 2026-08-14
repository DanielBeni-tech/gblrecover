"""Tests smoke — vérifient que l'application démarre et que les routes de base répondent.

Ces tests ne nécessitent pas de base de données active (sauf test_db_health qui
est skip si la DB est injoignable).
"""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_status():
    """Route /status — healthcheck de l'app."""
    r = client.get("/status")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "version" in body


def test_openapi_spec():
    """Le spec OpenAPI est servi et contient tous les nouveaux modules."""
    r = client.get("/openapi.json")
    assert r.status_code == 200
    spec = r.json()
    paths = spec["paths"]
    # Vérifie que les nouveaux modules sont enregistrés
    assert "/api/v1/collection-actions" in paths
    assert "/api/v1/promises" in paths
    assert "/api/v1/imports" in paths
    assert "/api/v1/dashboards/summary" in paths
    assert "/api/v1/reports/zombies" in paths
    assert "/api/v1/admin/audit" in paths
    assert "/api/v1/services" in paths
    assert "/api/v1/accounts/{account_id}/receivable-summary" in paths


def test_users_me_ordering():
    """L'endpoint /users/me doit être routé AVANT /users/{user_id}."""
    r = client.get("/api/v1/users/me")
    # 401 attendu : pas de token, mais on NE DOIT PAS avoir un crash UUID.
    assert r.status_code == 401
    body = r.json()
    # Avant le fix, on avait ValueError "badly formed hexadecimal UUID string"
    assert "UUID" not in str(body)


def test_health_db():
    """Route /health/db — renvoie 200 si DB up, 503 sinon."""
    r = client.get("/health/db")
    assert r.status_code in (200, 503)


def test_demo_seed_credentials():
    """Le script de chargement doit exposer les identifiants de démonstration attendus."""
    import ast
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    source = (root / "database" / "load_data.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    module_names = {node.targets[0].id for node in tree.body if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name)}

    assert "DEMO_EMAIL" in module_names
    assert "DEMO_PASSWORD" in module_names
    assert "hash_password" in source
    assert "verify_password" in source
    assert "agent@camtel.cm" in source
    assert "demo1234" in source