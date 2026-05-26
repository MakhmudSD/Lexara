#!/usr/bin/env python3
"""
PostgreSQL backup script.
Usage: python scripts/backup_db.py
Env:   DATABASE_URL must be set
Output: backup_YYYYMMDD_HHMMSS.sql.gz in backups/ directory
"""

import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def backup() -> None:
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print('ERROR: DATABASE_URL not set')
        sys.exit(1)

    backup_dir = Path(__file__).parent.parent / 'backups'
    backup_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = backup_dir / f'backup_{timestamp}.sql.gz'

    print(f'Starting backup → {filename}')
    try:
        result = subprocess.run(
            f'pg_dump "{db_url}" | gzip > "{filename}"',
            shell=True,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f'ERROR: {result.stderr}')
            sys.exit(1)

        size_mb = filename.stat().st_size / 1024 / 1024
        print(f'✅ Backup complete: {filename} ({size_mb:.2f} MB)')

        for old_file in backup_dir.glob('backup_*.sql.gz'):
            age_days = (datetime.now().timestamp() - old_file.stat().st_mtime) / 86400
            if age_days > 30:
                old_file.unlink()
                print(f'Deleted old backup: {old_file.name}')

    except Exception as e:
        print(f'ERROR: {e}')
        sys.exit(1)


if __name__ == '__main__':
    backup()
