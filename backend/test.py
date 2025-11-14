from reconcile import match_and_merge
start="2020-06-01 00:00:00"
from datetime import datetime, timezone
end=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
match_and_merge(start, end, min_mag=2.7)