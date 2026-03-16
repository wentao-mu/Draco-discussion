from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MOTION_DIR = ROOT / 'motion'
MEDIA_DIR = ROOT / 'demo' / 'media'
VIDEO_PATH = MEDIA_DIR / 'draco-operation-demo.mp4'
POSTER_PATH = MEDIA_DIR / 'draco-operation-demo-poster.png'
GIF_PATH = MEDIA_DIR / 'draco-operation-demo.gif'
PALETTE_PATH = Path('/tmp/draco-operation-demo-palette.png')
NODE20_BIN = Path('/opt/homebrew/opt/node@20/bin')


def ensure_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise SystemExit(f'{name} is required to generate the discussion demo media.')


def run(command: list[str], *, cwd: Path, env: dict[str, str]) -> None:
    print(f'==> {" ".join(command)}', flush=True)
    subprocess.run(command, cwd=cwd, env=env, check=True)


def build_env() -> dict[str, str]:
    env = os.environ.copy()
    if NODE20_BIN.exists():
        current_path = env.get('PATH', '')
        env['PATH'] = f'{NODE20_BIN}:{current_path}' if current_path else str(NODE20_BIN)
    return env


def render_gif(env: dict[str, str]) -> None:
    run(
        [
            'ffmpeg',
            '-y',
            '-i',
            str(VIDEO_PATH),
            '-vf',
            'fps=12,scale=960:-1:flags=lanczos,palettegen',
            '-update',
            '1',
            str(PALETTE_PATH),
        ],
        cwd=ROOT,
        env=env,
    )
    run(
        [
            'ffmpeg',
            '-y',
            '-i',
            str(VIDEO_PATH),
            '-i',
            str(PALETTE_PATH),
            '-lavfi',
            'fps=12,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5',
            str(GIF_PATH),
        ],
        cwd=ROOT,
        env=env,
    )


def main() -> None:
    ensure_tool('npm')
    ensure_tool('ffmpeg')
    if not MOTION_DIR.exists():
        raise SystemExit('The motion/ project is missing. Run this script from the repo root checkout.')

    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    env = build_env()

    run(['npm', 'run', 'render:video'], cwd=MOTION_DIR, env=env)
    run(['npm', 'run', 'render:poster'], cwd=MOTION_DIR, env=env)
    render_gif(env)

    print(f'Wrote {VIDEO_PATH}')
    print(f'Wrote {POSTER_PATH}')
    print(f'Wrote {GIF_PATH}')


if __name__ == '__main__':
    main()
