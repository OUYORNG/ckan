"""Check importer target selection without contacting a CKAN server."""

import importlib.util
import os
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests


class StopBeforeImport(Exception):
    pass


def load_importer(url=None, token=None):
    environment = {}
    if url is not None:
        environment["CKAN_URL"] = url
    if token is not None:
        environment["CKAN_API_TOKEN"] = token
    with patch.dict(os.environ, environment, clear=True):
        spec = importlib.util.spec_from_file_location("import_11a_test", Path(__file__).with_name("import_11a.py"))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module, environment


class ConnectionTests(unittest.TestCase):
    def test_supplied_token_uses_target_without_docker(self):
        module, environment = load_importer("https://data.example.com/ckan/", "example-test-token")
        session = Mock()
        session.headers = {}
        session.get.return_value.json.return_value = {"success": True}
        with patch.dict(os.environ, environment, clear=True), patch.object(module.requests, "Session", return_value=session), \
                patch.object(module.subprocess, "run") as docker, patch.object(module, "summary", side_effect=StopBeforeImport):
            with self.assertRaises(StopBeforeImport):
                module.main()
        docker.assert_not_called()
        session.get.assert_called_once_with("https://data.example.com/ckan/api/3/action/status_show", timeout=20)
        self.assertEqual(session.headers["Authorization"], "example-test-token")
        self.assertIn("targets", module.OUT.parts)

    def test_unreachable_target_stops_before_token_and_import(self):
        module, environment = load_importer("http://localhost:5199")
        session = Mock()
        session.get.side_effect = requests.ConnectionError()
        with patch.dict(os.environ, environment, clear=True), patch.object(module.requests, "Session", return_value=session), \
                patch.object(module.subprocess, "run") as docker, patch.object(module, "summary") as source:
            with self.assertRaisesRegex(SystemExit, "Cannot reach the CKAN API"):
                module.main()
        docker.assert_not_called()
        source.assert_not_called()

    def test_external_target_requires_token(self):
        module, environment = load_importer("https://data.example.com")
        session = Mock()
        session.get.return_value.json.return_value = {"success": True}
        with patch.dict(os.environ, environment, clear=True), patch.object(module.requests, "Session", return_value=session), \
                patch.object(module.subprocess, "run") as docker:
            with self.assertRaisesRegex(SystemExit, "Set CKAN_API_TOKEN"):
                module.main()
        docker.assert_not_called()

    def test_default_local_target_retains_docker_token_generation(self):
        module, environment = load_importer()
        session = Mock()
        session.headers = {}
        session.get.return_value.json.return_value = {"success": True}
        with patch.dict(os.environ, environment, clear=True), patch.object(module.requests, "Session", return_value=session), \
                patch.object(module.subprocess, "run", return_value=Mock(stdout="eyJ-local-test-token\n")) as docker, \
                patch.object(module, "summary", side_effect=StopBeforeImport):
            with self.assertRaises(StopBeforeImport):
                module.main()
        docker.assert_called_once()
        self.assertEqual(session.headers["Authorization"], "eyJ-local-test-token")
        self.assertEqual(module.OUT, Path(__file__).resolve().parent)

    def test_invalid_url_is_rejected_before_network_access(self):
        module, _ = load_importer("https://user:password@data.example.com")
        with patch.object(module.requests, "Session") as session:
            with self.assertRaisesRegex(SystemExit, "without credentials"):
                module.main()
        session.assert_not_called()

    def test_non_ckan_endpoint_is_rejected(self):
        module, environment = load_importer("https://data.example.com")
        session = Mock()
        session.get.return_value.json.side_effect = ValueError("Not JSON")
        with patch.dict(os.environ, environment, clear=True), patch.object(module.requests, "Session", return_value=session):
            with self.assertRaisesRegex(SystemExit, "Cannot reach the CKAN API"):
                module.main()


if __name__ == "__main__":
    unittest.main()
