"""Upgrade the legacy MPGV uniqueness rule without losing source revisions."""
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def migrate_revision_schema(database_path):
    """Back up and atomically replace only the obsolete three-column constraint."""
    path = Path(database_path)
    with sqlite3.connect(path, timeout=30) as conn:
        legacy = False
        for index in conn.execute('PRAGMA index_list("earthquake")').fetchall():
            if index[2]:
                name = index[1].replace('"', '""')
                columns = [row[2] for row in conn.execute(f'PRAGMA index_info("{name}")')]
                if columns == ["date_time", "latitude", "longitude"]:
                    legacy = True
        if not legacy:
            return None

        schema = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='earthquake'"
        ).fetchone()[0]
        schema, replacements = re.subn(
            r"UNIQUE\s*\(\s*date_time\s*,\s*latitude\s*,\s*longitude\s*\)",
            "UNIQUE (date_time, latitude, longitude, depth, mw_mean)",
            schema, flags=re.IGNORECASE,
        )
        if replacements != 1:
            raise RuntimeError("Unrecognized earthquake schema; migration refused")
        schema, replacements = re.subn(
            r'^CREATE TABLE\s+(?:"earthquake"|earthquake)\s*\(',
            'CREATE TABLE earthquake_revision_upgrade (', schema, flags=re.IGNORECASE,
        )
        if replacements != 1:
            raise RuntimeError("Unrecognized earthquake table declaration")

        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup = path.with_name(f"{path.name}.before-revisions-{stamp}-{uuid4().hex[:8]}.bak")
        with sqlite3.connect(backup) as target:
            conn.backup(target)

        conn.execute("BEGIN IMMEDIATE")
        objects = conn.execute(
            "SELECT sql FROM sqlite_master WHERE tbl_name='earthquake' "
            "AND type IN ('index', 'trigger') AND sql IS NOT NULL"
        ).fetchall()
        columns = [row[1] for row in conn.execute('PRAGMA table_info("earthquake")')]
        names = ', '.join('"' + name.replace('"', '""') + '"' for name in columns)
        before = conn.execute('SELECT COUNT(*) FROM earthquake').fetchone()[0]
        conn.execute(schema)
        conn.execute(f'INSERT INTO earthquake_revision_upgrade ({names}) SELECT {names} FROM earthquake')
        after = conn.execute('SELECT COUNT(*) FROM earthquake_revision_upgrade').fetchone()[0]
        if before != after:
            raise RuntimeError("Revision migration row count mismatch")
        conn.execute('DROP TABLE earthquake')
        conn.execute('ALTER TABLE earthquake_revision_upgrade RENAME TO earthquake')
        for (sql,) in objects:
            conn.execute(sql)
        if conn.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError("Revision migration integrity check failed")
        if conn.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError("Revision migration foreign key check failed")
        conn.commit()
        return str(backup)
