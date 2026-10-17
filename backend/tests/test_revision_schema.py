import sqlite3

import pytest

from revision_schema import migrate_revision_schema


def test_legacy_upgrade_preserves_rows_indexes_backup_and_current_uniqueness(tmp_path):
    path = tmp_path / "legacy.db"
    with sqlite3.connect(path) as conn:
        conn.execute('''CREATE TABLE earthquake (
            id INTEGER PRIMARY KEY, date_time VARCHAR NOT NULL,
            latitude FLOAT NOT NULL, longitude FLOAT NOT NULL,
            depth FLOAT NOT NULL, mw_mean FLOAT NOT NULL,
            source_id VARCHAR, is_current BOOLEAN NOT NULL DEFAULT 1,
            CONSTRAINT unique_earthquake_entry UNIQUE (date_time, latitude, longitude)
        )''')
        conn.execute('CREATE UNIQUE INDEX uq_earthquake_current_source_id ON earthquake(source_id) WHERE is_current = 1 AND source_id IS NOT NULL')
        conn.execute("INSERT INTO earthquake VALUES (7, '2026-09-16 06:03:14.700', 63.568, -23.965, 0.9, 3.25, 'event', 1)")
        original = conn.execute('SELECT * FROM earthquake').fetchall()

    backup = migrate_revision_schema(path)
    assert backup
    with sqlite3.connect(backup) as conn:
        assert conn.execute('SELECT * FROM earthquake').fetchall() == original
    with sqlite3.connect(path) as conn:
        assert conn.execute('SELECT * FROM earthquake').fetchall() == original
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO earthquake VALUES (8, '2026-09-16 06:03:14.700', 63.568, -23.965, 0.9, 3.26, 'event', 1)")
        conn.execute('UPDATE earthquake SET is_current = 0 WHERE id = 7')
        conn.execute("INSERT INTO earthquake VALUES (8, '2026-09-16 06:03:14.700', 63.568, -23.965, 0.9, 3.26, 'event', 1)")
        assert conn.execute('SELECT COUNT(*) FROM earthquake').fetchone()[0] == 2
        assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    assert migrate_revision_schema(path) is None
