"""Convert the squirrel census CSV into a slim JSON for the browser.

Reads `squirrels.csv` (gitignored) and writes `squirrels.json` (committed).
"""
import csv
import json
from pathlib import Path

SRC = Path(__file__).parent / "squirrels.csv"
OUT = Path(__file__).parent / "squirrels.json"


def b(s: str) -> int:
    return 1 if (s or "").strip().lower() == "true" else 0


def day(s: str):
    if not s or len(s) != 8:
        return None
    return int(s[2:4])


records = []
with SRC.open(newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        try:
            x = float(row["X"])
            y = float(row["Y"])
        except (ValueError, KeyError):
            continue
        records.append({
            "x": round(x, 5),
            "y": round(y, 5),
            "shift": row.get("Shift", ""),
            "day": day(row.get("Date", "")),
            "fur": row.get("Primary Fur Color", ""),
            "kuks": b(row.get("Kuks")),
            "quaas": b(row.get("Quaas")),
            "moans": b(row.get("Moans")),
            "tail_flags": b(row.get("Tail flags")),
            "tail_twitches": b(row.get("Tail twitches")),
            "approaches": b(row.get("Approaches")),
            "indifferent": b(row.get("Indifferent")),
            "runs_from": b(row.get("Runs from")),
        })

with OUT.open("w", encoding="utf-8") as f:
    json.dump(records, f, separators=(",", ":"))

print(f"Wrote {len(records)} records to {OUT.name}")
