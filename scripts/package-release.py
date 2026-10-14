"""Create a reviewed source archive using an explicit project allowlist, never git add ."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = {
    '.dockerignore', '.gitignore', '.env.example', '.env.railway.example',
    'Dockerfile', 'railway.json', 'compose.yaml', 'README.md',
}
DIRECTORIES = {'backend', 'frontend', 'docs', 'scripts', '.github'}
PRIVATE_MARKERS = [
    re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    re.compile(rb'gh[pousr]_[A-Za-z0-9]{30,}'),
    re.compile(rb'github_pat_[A-Za-z0-9_]{30,}'),
]


def package():
    result = subprocess.run(
        ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--',
         *sorted(ROOT_FILES | DIRECTORIES)], cwd=ROOT, check=True, capture_output=True,
    )
    names = sorted(set(result.stdout.decode('utf-8').split('\0')) - {''})
    entries = []
    for name in names:
        relative = Path(name)
        if name not in ROOT_FILES and relative.parts[0] not in DIRECTORIES:
            raise RuntimeError(f'File outside allowlist: {name}')
        if relative.name.startswith('.env') and name not in {'.env.example', '.env.railway.example'}:
            raise RuntimeError(f'Environment file excluded: {name}')
        if any(part in {'.git', '.venv', '.local', 'node_modules', 'dist', '__pycache__', 'test-results', '.npm-cache'} for part in relative.parts):
            raise RuntimeError(f'Runtime directory in source inventory: {name}')
        path = ROOT / relative
        if path.is_symlink() or not path.resolve().is_relative_to(ROOT.resolve()):
            raise RuntimeError(f'Unsafe source path: {name}')
        data = path.read_bytes()
        if any(pattern.search(data) for pattern in PRIVATE_MARKERS):
            raise RuntimeError(f'Potential credential marker in {name}; publication blocked')
        data.decode('utf-8')  # Publication uses GitHub UTF-8 contents; fail before any upload.
        entries.append((name, data))
    required = {'Dockerfile', 'railway.json', '.github/workflows/ci.yml', 'frontend/package-lock.json', 'backend/requirements-lock.txt'}
    if not required <= set(names):
        raise RuntimeError('Missing required deployment files')
    manifest = {'format': 1, 'files': [
        {'path': name, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in entries
    ]}
    output = ROOT / '.local' / 'releases'
    output.mkdir(parents=True, exist_ok=True)
    manifest_data = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    archive = output / 'dotarise-stage1-source.zip'
    staging = archive.with_suffix('.zip.tmp')
    with zipfile.ZipFile(staging, 'w', compression=zipfile.ZIP_DEFLATED) as package_file:
        for name, data in [*entries, ('release-manifest.json', manifest_data)]:
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            package_file.writestr(info, data)
    with zipfile.ZipFile(staging) as package_file:
        if package_file.testzip() is not None:
            raise RuntimeError('Archive CRC verification failed')
        for item in manifest['files']:
            if hashlib.sha256(package_file.read(item['path'])).hexdigest() != item['sha256']:
                raise RuntimeError('Archive content hash mismatch')
        if len(package_file.namelist()) != len(entries) + 1:
            raise RuntimeError('Unexpected files in source archive')
    staging.replace(archive)
    (output / 'release-manifest.json').write_bytes(manifest_data)
    print(json.dumps({'archive': str(archive), 'files': len(entries), 'bytes': archive.stat().st_size,
                      'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}, ensure_ascii=True))


if __name__ == '__main__':
    package()
