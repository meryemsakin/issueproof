from datetime import datetime, timezone
import os
import sys


timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
print(f"[{timestamp}] RuntimeError: checkout total mismatch", file=sys.stderr)
print(f"pid={os.getpid()}", file=sys.stderr)
sys.exit(1)
