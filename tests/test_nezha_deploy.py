"""功能：驗證 aurora-entrypoint.sh 在 exec 官方入口前推導 NEZHA_GRPC_BACKEND 並 export。"""
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

DOCKER_DIR = Path(__file__).resolve().parents[1] / 'docker'


def run_entrypoint(td: str, env: dict) -> str:
    stub = Path(td, 'official-stub.sh')
    stub.write_text('#!/bin/sh\nprintf "STUB:%s" "${NEZHA_GRPC_BACKEND-}"\n')
    stub.chmod(0o755)
    entry = Path(td, 'aurora-entrypoint.sh')
    # 只替換 exec 目標為 stub，推導與 export 邏輯保持原樣
    src = (DOCKER_DIR / 'aurora-entrypoint.sh').read_text()
    entry.write_text(src.replace('exec /docker-entrypoint.sh', f'exec {stub}'))
    entry.chmod(0o755)
    result = subprocess.run([str(entry)], env=env, text=True, capture_output=True, timeout=5, check=True)
    return result.stdout


class DeploymentContract(unittest.TestCase):
    def test_derived_grpc_backend_reaches_official_entrypoint(self):
        env = {**os.environ, 'NEZHA_BACKEND': 'http://nezha:8008'}
        env.pop('NEZHA_GRPC_BACKEND', None)
        with tempfile.TemporaryDirectory() as td:
            out = run_entrypoint(td, env)
        self.assertEqual(out, 'STUB:nezha:8008')

    def test_explicit_grpc_backend_not_overridden(self):
        env = {**os.environ, 'NEZHA_BACKEND': 'http://ignored:1', 'NEZHA_GRPC_BACKEND': 'custom:9000'}
        with tempfile.TemporaryDirectory() as td:
            out = run_entrypoint(td, env)
        self.assertEqual(out, 'STUB:custom:9000')


if __name__ == '__main__':
    unittest.main()
