# Three Thousand Squirrels

An animated, NYT-style scrollytelling visualization of the 2018 Central Park
Squirrel Census — all 3,023 sightings, with fur colors, activities, calls,
human interactions, and verbatim field notes.

## How it works

- A scroll-driven map of Central Park (real geography from OpenStreetMap:
  the Lake, the Reservoir, Harlem Meer, lawns, woods, transverse roads).
- Eight chapters: the day-by-day count, AM/PM shifts, fur-color geography,
  activities (with darting runners), vocal calls (with playable recreations),
  reactions to humans, and a finale.
- Every dot is one squirrel. Dots cross-fade smoothly between chapters.

Tech: D3 + Canvas + Scrollama, no build step. Just static files.

## Files

- `index.html`, `styles.css`, `main.js` — the page
- `squirrels.json` — preprocessed sightings (compact array format, see `preprocess.py`)
- `park.json` — simplified park geometry, derived from OpenStreetMap
- `kuk.mp3`, `quaa.mp3`, `moan.mp3` — AI-recreated squirrel calls (not field recordings)
- `preprocess.py` — regenerates `squirrels.json` from the source CSV

## Running locally

```sh
python3 -m http.server 8766
open http://localhost:8766
```

## Data sources

- Sightings: [2018 Central Park Squirrel Census](https://data.cityofnewyork.us/Environment/2018-Central-Park-Squirrel-Census-Squirrel-Data/vfnx-vebw)
  via NYC OpenData, by [The Squirrel Census](https://www.thesquirrelcensus.com/).
  The CSV is gitignored; drop it in as `squirrels.csv` and run `preprocess.py`.
- Park geometry: © OpenStreetMap contributors, via the Overpass API.
