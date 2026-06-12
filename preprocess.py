"""Convert the squirrel census CSV into a slim JSON for the browser.

Reads `squirrels.csv` (gitignored) and writes `squirrels.json` (committed).

Output: list of [x, y, shift, day, fur, mask] where
  shift: 0=AM 1=PM
  day:   day of month (October 2018), 0 if unknown
  fur:   "G"|"C"|"B"|"" (gray / cinnamon / black / unrecorded)
  mask:  bitmask -- 1 running, 2 chasing, 4 climbing, 8 eating, 16 foraging,
         32 kuks, 64 quaas, 128 moans, 256 tail flags, 512 tail twitches,
         1024 approaches, 2048 indifferent, 4096 runs from
"""
import csv
import json
from pathlib import Path

SRC = Path(__file__).parent / "squirrels.csv"
OUT = Path(__file__).parent / "squirrels.json"

FLAGS = [
    "Running", "Chasing", "Climbing", "Eating", "Foraging",
    "Kuks", "Quaas", "Moans", "Tail flags", "Tail twitches",
    "Approaches", "Indifferent", "Runs from",
]

FUR = {"Gray": "G", "Cinnamon": "C", "Black": "B"}

records = []
with SRC.open(newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        try:
            x = float(row["X"])
            y = float(row["Y"])
        except (ValueError, KeyError):
            continue
        mask = 0
        for i, col in enumerate(FLAGS):
            if (row.get(col) or "").strip().lower() == "true":
                mask |= 1 << i
        date = row.get("Date", "")
        day = int(date[2:4]) if len(date) == 8 else 0
        records.append([
            round(x, 5),
            round(y, 5),
            1 if row.get("Shift") == "PM" else 0,
            day,
            FUR.get(row.get("Primary Fur Color", ""), ""),
            mask,
        ])

with OUT.open("w", encoding="utf-8") as f:
    json.dump(records, f, separators=(",", ":"))

print(f"Wrote {len(records)} records to {OUT.name}")
