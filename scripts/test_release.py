"""Exercise CI identity and immutable artifacts without contacting GitHub."""
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import release

ROOT = Path(__file__).resolve().parent.parent
REPOSITORY = 'pior-labs/' + ROOT.name
SHA = 'a' * 40
PAYLOAD = b'static fixture bytes'
MANIFEST = {'repository': REPOSITORY, 'run_id': 123, 'run_attempt': 2, 'sha': SHA,
            'images': {s: f'ghcr.io/{REPOSITORY}-{s}@sha256:' + 'b' * 64 for s in release.SERVICES}}
if release.CONFIG.get('kind') == 'static':
    MANIFEST['files'] = {'site.tar.gz': hashlib.sha256(PAYLOAD).hexdigest()}


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.old_cwd = Path.cwd()
        os.chdir(self.temp.name)
        self.addCleanup(os.chdir, self.old_cwd)
        self.environment = patch.dict(os.environ, {'GITHUB_REPOSITORY': REPOSITORY, 'CI_RUN_ID': '123',
                          'CI_RUN_ATTEMPT': '', 'GH_TOKEN': 'fixture', 'GITHUB_OUTPUT': 'output',
                          'GITHUB_STEP_SUMMARY': 'summary'})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.run = {'workflow_id': 42, 'event': 'push', 'head_branch': 'main', 'status': 'completed',
                    'conclusion': 'success', 'head_repository': {'full_name': REPOSITORY},
                    'head_sha': SHA, 'run_attempt': 2}
        self.expired = False
        self.comparison = 'ahead'
        self.manifest = MANIFEST
        self.payload = PAYLOAD

    def response(self, request, timeout):
        url = request.full_url
        if url.endswith('/actions/runs/123') or url.endswith('/actions/runs/123/attempts/2'):
            value = self.run
        elif '/actions/workflows/' in url:
            value = {'id': 42}
        elif '/compare/' in url:
            value = {'status': self.comparison}
        elif '/artifacts?' in url:
            value = {'artifacts': [{'id': 10, 'name': 'release-2', 'expired': self.expired}]}
        elif url.endswith('/artifacts/10/zip'):
            data = io.BytesIO()
            with zipfile.ZipFile(data, 'w') as archive:
                archive.writestr('release.json', json.dumps(self.manifest))
                if release.CONFIG.get('kind') == 'static':
                    archive.writestr('site.tar.gz', self.payload)
            return io.BytesIO(data.getvalue())
        else:
            raise AssertionError(url)
        return io.BytesIO(json.dumps(value).encode())

    def resolve(self):
        with patch('urllib.request.build_opener') as opener:
            opener.return_value.open.side_effect = self.response
            release.resolve()

    def test_success_resolves_exact_images_commit_and_attempt(self):
        self.resolve()
        self.assertEqual(json.loads(Path('release.json').read_text()), MANIFEST)
        self.assertEqual(Path('output').read_text(), f'sha={SHA}\nattempt=2\nrun_id=123\n')

    def test_exact_attempt_can_be_selected_for_rollback(self):
        with patch.dict(os.environ, {'CI_RUN_ATTEMPT': '2'}):
            self.resolve()
        self.assertEqual(json.loads(Path('release.json').read_text())['run_attempt'], 2)

    def test_failed_unfinished_pr_foreign_and_other_workflow_runs_are_rejected(self):
        original = dict(self.run)
        for key, value in (('workflow_id', 99), ('event', 'pull_request'), ('head_branch', 'feature'),
                           ('status', 'in_progress'), ('conclusion', 'failure'),
                           ('head_repository', {'full_name': 'someone/fork'})):
            self.run = {**original, key: value}
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.resolve()
        self.assertFalse(Path('release.json').exists())

    def test_expired_artifacts_and_commits_outside_main_are_rejected(self):
        self.expired = True
        with self.assertRaises(ValueError): self.resolve()
        self.expired = False
        self.comparison = 'diverged'
        with self.assertRaises(ValueError): self.resolve()

    def test_wrong_artifact_identity_is_rejected(self):
        for key, value in (('run_id', 124), ('run_attempt', 1), ('repository', 'someone/fork'), ('sha', 'c' * 40)):
            self.manifest = {**MANIFEST, key: value}
            with self.subTest(key=key), self.assertRaises(ValueError): self.resolve()

    def test_mutable_tags_foreign_images_and_partial_releases_are_rejected(self):
        if not release.SERVICES:
            with self.assertRaises(ValueError):
                release.validate_release({**MANIFEST, 'files': {}}, REPOSITORY, 123, 2, SHA)
            return
        service = release.SERVICES[0]
        for image in ('ghcr.io/owner/image:latest', 'ghcr.io/someone/image@sha256:' + 'b' * 64):
            with self.subTest(image=image), self.assertRaises(ValueError):
                release.validate_release({**MANIFEST, 'images': {**MANIFEST['images'], service: image}}, REPOSITORY, 123, 2, SHA)
        with self.assertRaises(ValueError):
            release.validate_release({**MANIFEST, 'images': {}}, REPOSITORY, 123, 2, SHA)

    def test_superseded_automatic_build_is_skipped_without_deploy_artifacts(self):
        with patch.dict(os.environ, {'AUTOMATIC_DEPLOY':'true'}):
            self.resolve()
        self.assertEqual(Path('output').read_text(), 'skip=true\n')
        self.assertFalse(Path('release.json').exists())

    def test_static_artifact_tampering_is_rejected(self):
        if release.CONFIG.get('kind') != 'static':
            return
        self.payload = b'tampered site'
        with self.assertRaises(ValueError): self.resolve()


if __name__ == '__main__':
    unittest.main()
