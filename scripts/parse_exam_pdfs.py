from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


PHASE_MAP = {
    "115-1-03": "phase1",
    "phase1": "phase1",
    "115-1-all": "phase2",
    "phase2": "phase2",
    "110-115-all": "phase3",
    "phase3": "phase3",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Build parsed exam question database for a selected phase.")
    parser.add_argument("--input", default=r"C:\Users\t1600\Desktop\醫檢師國考題", help="PDF source folder, kept for workflow compatibility.")
    parser.add_argument("--phase", default="115-1-03")
    parser.add_argument("--output", default="data/questions_master.json")
    args = parser.parse_args()

    phase = PHASE_MAP.get(args.phase)
    if not phase:
        raise SystemExit(f"Unknown phase: {args.phase}")

    source_dir = Path("data/full_questions")
    if not source_dir.exists():
        source_dir = Path("data/questions")

    command = [
        sys.executable,
        "scripts/build_phase_dataset.py",
        "--phase",
        phase,
        "--source-dir",
        str(source_dir),
    ]
    result = subprocess.run(command, check=False)
    if result.returncode != 0:
        return result.returncode
    print(f"PDF source folder recorded: {args.input}")
    print(f"questions_master.json -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
