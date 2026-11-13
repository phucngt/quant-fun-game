#!/usr/bin/env python3
"""Compatibility entry point; the canonical build lives at the project root."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parents[1] / 'build.py'), run_name='__main__')
