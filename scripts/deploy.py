"""Deploy verified images while preserving application identity and persistent data."""
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import urllib.parse

from release import validate_release


def command(*args, **kwargs):
    return subprocess.run(args, check=True, text=True, **kwargs)


def write_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(path)


def deploy():
    os.umask(0o077)
    root = Path(os.environ['DEPLOY_DIR'])
    if not root.is_absolute() or len(root.parts) < 4 or root.resolve() != root:
        raise ValueError('DEPLOY_DIR must be an absolute dedicated app directory without symlinks')
    app_env = os.environ.get('APP_ENV', '')
    if not app_env.strip():
        raise ValueError('APP_ENV is required')
    project = os.environ.get('COMPOSE_PROJECT_NAME', '').strip()
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', project):
        raise ValueError('Set COMPOSE_PROJECT_NAME to the existing production project identity')
    app_env = '\n'.join(line for line in app_env.splitlines()
                        if not re.match(r'^[ \t]*(?:export[ \t]+)?COMPOSE_PROJECT_NAME[ \t]*=', line))
    app_env += f'\nCOMPOSE_PROJECT_NAME={project}\n'
    release = json.loads(Path('release.json').read_text())
    validate_release(release, os.environ['GITHUB_REPOSITORY'], os.environ['EXPECTED_RUN_ID'],
                     os.environ['EXPECTED_ATTEMPT'], os.environ['EXPECTED_SHA'])
    candidate = Path('candidate')
    config = json.loads((candidate / 'scripts/deployment.json').read_text())
    if set(config['services']) != set(release['images']):
        raise ValueError('Candidate configuration does not match release services')
    operation = os.environ.get('DEPLOY_OPERATION', 'deploy')
    if operation not in ('deploy', 'bootstrap'):
        raise ValueError('Unknown production operation')
    if operation == 'bootstrap' and (not config.get('seed') or os.environ.get('BOOTSTRAP_CONFIRMATION') != 'bootstrap-auth'):
        raise ValueError('Bootstrap requires bootstrap-auth confirmation and a seed command')
    base_url = config.get('base_url') or os.environ.get('DEPLOY_BASE_URL', '')
    url = urllib.parse.urlsplit(base_url)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError('Configure a canonical HTTPS DEPLOY_BASE_URL')
    root.mkdir(parents=True, exist_ok=True)
    history = root / '.deployments'
    history.mkdir(exist_ok=True)
    releases = root / 'releases'
    releases.mkdir(exist_ok=True)
    runtime = Path(tempfile.mkdtemp(prefix=f"{release['run_id']}-{release['run_attempt']}-", dir=releases))
    record = {**release, 'runtime_dir': str(runtime), 'operation': operation,
              'started_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'deployment_run_id': os.environ['GITHUB_RUN_ID']}
    write_json(history / 'attempt.json', {**record, 'status': 'deploying'})
    try:
        for name in config['compose_files']:
            shutil.copyfile(candidate / name, runtime / name)
        (runtime / '.env').write_text(app_env)
        script = config.get('environment_script')
        if script:
            # Keep Auth's separately validated client secret and platform-owned
            # database mount contract while APP_ENV is incrementally split.
            command('bash', str(Path(__file__).with_name(script).resolve()), cwd=runtime,
                    env={**os.environ, 'AUTH_ENV': app_env,
                         'COMPOSE_FILE': ':'.join(config['compose_files'])})
        write_json(runtime / 'release.json', release)
        write_json(runtime / 'images.json', {'services': {s: {'image': image} for s, image in release['images'].items()}})
        base = ['docker', 'compose', '--project-directory', str(runtime), '--project-name', project,
                '--env-file', str(runtime / '.env')]
        for name in config['compose_files'] + ['images.json']:
            base.extend(['-f', str(runtime / name)])
        rendered = json.loads(command(*base, 'config', '--format', 'json', capture_output=True).stdout)
        if set(rendered['services']) != set(release['images']):
            raise ValueError('Every runtime service must have a verified image')
        for service, image in release['images'].items():
            definition = rendered['services'][service]
            definition.pop('build', None)
            definition['pull_policy'] = 'never'
            if definition['image'] != image:
                raise ValueError('Compose image differs from release manifest')
        # Finance's ./data must continue pointing at the legacy upload directory,
        # not a new empty data directory under this release's configuration.
        for service, mounts in config.get('host_data_mounts', {}).items():
            for target, relative in mounts.items():
                location = root / relative
                if location.resolve().parent != root:
                    raise ValueError('Persistent data must stay directly under DEPLOY_DIR')
                matches = [v for v in rendered['services'][service].get('volumes', []) if v['target'] == target and v['type'] == 'bind']
                if len(matches) != 1:
                    raise ValueError('Missing or ambiguous persistent data mount')
                location.mkdir(exist_ok=True)
                matches[0]['source'] = str(location)
        # Only remove build-only credentials; Auth's runtime database secret is
        # deliberately retained in the resolved configuration.
        for name in config.get('build_secrets', ['github_token']):
            rendered.get('secrets', {}).pop(name, None)
        write_json(runtime / 'compose.json', rendered)
        compose = ['docker', 'compose', '--project-directory', str(runtime), '--project-name', project,
                   '-f', str(runtime / 'compose.json')]
        for network in rendered.get('networks', {}).values():
            if network.get('external'):
                command('docker', 'network', 'inspect', network['name'], stdout=subprocess.DEVNULL)
        command(*compose, 'pull', '--policy', 'always', *config['services'])
        if config.get('preflight_script'):
            command('bash', str(Path(__file__).with_name(config['preflight_script']).resolve()), cwd=runtime)
        for arguments in config.get('pre_migration', []):
            command(*compose, *arguments)
        command(*compose, 'run', '--rm', '--no-deps', 'api', *config['migration'])
        if operation == 'bootstrap':
            command(*compose, 'run', '--rm', '--no-deps', 'api', *config['seed'])
            record['completed_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            record['status'] = 'bootstrapped'
            write_json(history / 'bootstrap.json', record)
        else:
            command(*compose, 'up', '-d', '--no-build', '--pull', 'never', '--remove-orphans', '--wait', '--wait-timeout', '180')
            for path in config['health_paths']:
                command('curl', '--fail', '--silent', '--show-error', '--max-time', '15', '--retry', '10',
                        '--retry-delay', '3', '--retry-all-errors', '--output', '/dev/null', base_url.rstrip('/') + path)
            if config.get('discovery'):
                discovery = config['discovery']
                response = command('curl', '--fail', '--silent', '--show-error', '--max-time', '30', discovery['url'], capture_output=True)
                command(*compose, *discovery['command'], input=response.stdout)
            command(*compose, 'ps')
            current = history / 'current.json'
            if current.exists():
                write_json(history / 'previous.json', json.loads(current.read_text()))
            link = root / '.current-next'
            link.unlink(missing_ok=True)
            link.symlink_to(runtime, target_is_directory=True)
            link.replace(root / 'current')
            record['completed_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            record['status'] = 'healthy'
            write_json(current, record)
        record['completed_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        write_json(history / 'attempt.json', record)
    except Exception:
        write_json(history / 'attempt.json', {**record, 'status': 'failed'})
        # Migrations and seeds are not reversed automatically on failure.
        raise
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
        summary.write(f"{operation}: `{release['sha']}`, CI run {release['run_id']}, attempt {release['run_attempt']}.\n\nRecord directory: `{history}`\n")


if __name__ == '__main__':
    deploy()
