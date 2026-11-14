"""Exercise staging, failure boundaries, and real Compose resolution without production data."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import deploy
from test_release import MANIFEST as RELEASE, SHA
SOURCE_ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((SOURCE_ROOT / 'scripts/deployment.json').read_text())
REPOSITORY = 'pior-labs/' + SOURCE_ROOT.name
BASE_URL = CONFIG.get('base_url') or 'https://fixture.example'

class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.workspace = Path(self.temp.name)
        self.old_cwd = Path.cwd()
        os.chdir(self.workspace)
        self.addCleanup(os.chdir, self.old_cwd)
        Path("candidate").mkdir()
        Path("candidate/scripts").mkdir()
        shutil.copyfile(SOURCE_ROOT / "scripts/deployment.json", "candidate/scripts/deployment.json")
        for name in ("docker-compose.yml", "docker-compose.production.yml", "docker-compose.production.yml"):
            Path("candidate", name).write_text("services: {}\n")
        Path("release.json").write_text(json.dumps(RELEASE))
        self.root = self.workspace / "cookbook"
        self.history = self.root / ".deployments"
        self.history.mkdir(parents=True)
        self.previous = {"sha": "d" * 40, "run_id": 100, "status": "healthy"}
        (self.history / "current.json").write_text(json.dumps(self.previous))
        self.environment = patch.dict(os.environ, {"DEPLOY_DIR": str(self.root), "APP_ENV": "SECRET=private", "COMPOSE_PROJECT_NAME": "cookbook", "GITHUB_REPOSITORY": REPOSITORY, "GITHUB_RUN_ID": "456", "GITHUB_STEP_SUMMARY": str(self.workspace / "summary"), "DEPLOY_BASE_URL": "https://fixture.example", "EXPECTED_SHA": SHA, "EXPECTED_RUN_ID": "123", "EXPECTED_ATTEMPT": "2"})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.old_umask = os.umask(0o022)
        self.addCleanup(os.umask, self.old_umask)
        self.calls = []

    def run_command(self, *args, **kwargs):
        self.calls.append(args)
        if "config" in args:
            rendered = {"services": {service: {"image": image, "build": {"context": "."}} for service, image in RELEASE["images"].items()}, "secrets": {name: {"environment": "GITHUB_TOKEN"} for name in CONFIG['build_secrets']}}
            for service, mounts in CONFIG.get('host_data_mounts', {}).items():
                rendered['services'][service]['volumes'] = [{'type':'bind','target':target,'source':'/fixture/candidate/data'} for target in mounts]
            return subprocess.CompletedProcess(args, 0, stdout=json.dumps(rendered))
        return subprocess.CompletedProcess(args, 0, stdout="{}")

    def test_success_uses_only_digests_and_records_after_readiness(self):
        with patch.object(deploy, "command", side_effect=self.run_command):
            deploy.deploy()
        current = json.loads((self.history / "current.json").read_text())
        self.assertEqual(current["sha"], SHA)
        self.assertEqual(current["status"], "healthy")
        self.assertEqual(json.loads((self.history / "previous.json").read_text()), self.previous)
        runtime = Path(current["runtime_dir"])
        rendered = json.loads((runtime / "compose.json").read_text())
        self.assertTrue(all("build" not in service for service in rendered["services"].values()))
        self.assertTrue(all(name not in rendered['secrets'] for name in CONFIG['build_secrets']))
        self.assertEqual((runtime / ".env").stat().st_mode & 0o777, 0o600)
        self.assertEqual((self.root / "current").resolve(), runtime)
        self.assertTrue((runtime / CONFIG["compose_files"][0]).exists())
        commands = [list(args) for args in self.calls]
        migration = next(args for args in commands if "run" in args)
        startup = next(args for args in commands if "up" in args)
        self.assertNotIn("--build", migration)
        self.assertTrue(all(service["pull_policy"] == "never" for service in rendered["services"].values()))
        self.assertIn("--no-deps", migration)
        self.assertIn("--no-build", startup)
        self.assertIn("--wait", startup)
        self.assertEqual([args[-1] for args in commands if args[0] == "curl"], [BASE_URL.rstrip("/") + path for path in CONFIG["health_paths"]] + ([CONFIG["discovery"]["url"]] if CONFIG.get("discovery") else []))

    def test_failures_preserve_successful_release_and_do_not_auto_rollback(self):
        for failing_phase in ("pull", "run", "up", "curl"):
            self.calls = []
            def fail(*args, **kwargs):
                if failing_phase in args:
                    raise subprocess.CalledProcessError(1, args)
                return self.run_command(*args, **kwargs)
            with self.subTest(phase=failing_phase), patch.object(deploy, "command", side_effect=fail), self.assertRaises(subprocess.CalledProcessError):
                deploy.deploy()
            self.assertEqual(json.loads((self.history / "current.json").read_text()), self.previous)
            self.assertEqual(json.loads((self.history / "attempt.json").read_text())["status"], "failed")
            self.assertFalse((self.history / "previous.json").exists())
            self.assertFalse((self.root / "current").exists())

    @unittest.skipUnless(shutil.which("docker"), "Docker Compose CLI is required for rendering")
    def test_real_compose_reads_candidate_environment_and_preserves_project(self):
        for name in CONFIG["compose_files"]:
            shutil.copyfile(SOURCE_ROOT / name, Path("candidate") / name)
        # Deliberately different from the staged environment: the old deployment
        # must not silently supply env_file values to the new containers.
        (self.root / ".env").write_text("SECRET=stale\n")
        app_env = "COMPOSE_PROJECT_NAME=legacy\n export COMPOSE_PROJECT_NAME=other\nSECRET=candidate\nBETTER_AUTH_SECRET=fixture-session\nAUTH_DATABASE_URL_FILE=/tmp/fixture-database-url\nPLATFORM_DATABASE_URL_FILE=/tmp/fixture-database-url\nPLATFORM_IMAGE_STORAGE_DIR=/tmp/fixture-images\nPLATFORM_MCP_HTTP_TOKEN_FILE=/tmp/fixture-token"
        real_command = deploy.command
        def render_only(*args, **kwargs):
            if "config" in args:
                return real_command(*args, **kwargs)
            return self.run_command(*args, **kwargs)
        with patch.dict(os.environ, {"APP_ENV": app_env}), patch.object(deploy, "command", side_effect=render_only):
            deploy.deploy()
        runtime = (self.root / "current").resolve()
        config = json.loads((runtime / "compose.json").read_text())
        self.assertEqual(config["name"], "cookbook")
        self.assertEqual(config["services"]["api"]["environment"]["COMPOSE_PROJECT_NAME"], "cookbook")
        self.assertEqual((runtime / ".env").read_text().count("COMPOSE_PROJECT_NAME="), 1)
        self.assertEqual(config["services"]["api"]["environment"]["SECRET"], "candidate")
        self.assertTrue(all("build" not in service for service in config["services"].values()))
        for service, mounts in CONFIG.get("host_data_mounts", {}).items():
            for target, relative in mounts.items():
                mount = next(v for v in config['services'][service]['volumes'] if v['target'] == target)
                self.assertEqual(mount['source'], str(self.root / relative))
        real_command("docker", "compose", "-f", str(runtime / "compose.json"), "config", "--quiet", capture_output=True)

    def test_staging_failure_is_recorded_without_touching_production(self):
        Path("candidate", CONFIG["compose_files"][0]).unlink()
        with patch.object(deploy, "command") as command, self.assertRaises(FileNotFoundError):
            deploy.deploy()
        command.assert_not_called()
        self.assertEqual(json.loads((self.history / "attempt.json").read_text())["status"], "failed")
        self.assertEqual(json.loads((self.history / "current.json").read_text()), self.previous)

    def test_project_secret_is_required_and_validated_before_writing(self):
        for value in ("", "Bad Name", "cookbook\nOTHER=value", "../cookbook"):
            with self.subTest(value=value), patch.dict(os.environ, {"COMPOSE_PROJECT_NAME": value}), patch.object(deploy, "command") as command, self.assertRaises(ValueError):
                deploy.deploy()
            command.assert_not_called()
        self.assertFalse((self.root / "releases").exists())

    def test_rejects_broad_directory_before_writing(self):
        with patch.dict(os.environ, {"DEPLOY_DIR": "/opt/docker"}), self.assertRaises(ValueError):
            deploy.deploy()


if __name__ == "__main__":
    unittest.main()
