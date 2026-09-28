# iRig Trainer

A playable guitar-training prototype with Tabs and Chords progression trees, live USB audio, guided lessons, scrolling practice, and an AI mastery challenge.

## Run

Install Node.js 22 or newer, then run in this folder:

```sh
npm start
```

Open **http://localhost:3210** in a current Chrome or Edge browser. Guitar Pro and MusicXML scores are parsed on your computer. The server binds only to your computer. Set `PORT` to change the port.

## Play

- Start in **Demo mode**. In a lesson, press **Space** (correct target) or **X** (wrong note); mobile players can use the onscreen buttons. Wait for the three-second count-in. Keyboard auto-repeat is ignored.
- Choose **Input & tuner** for real guitar practice. Plug the iRig into USB, connect the guitar, grant browser microphone permission, then select the iRig and reconnect. Some interfaces use channel 2; select the appropriate channel and reconnect.
- Choose from 20 tuner presets, including Standard, Drop D, DADGAD, open tunings, 7- and 8-string tunings, or enter a custom tuning of 4–8 open strings. Select a string to focus the tuner or use Auto. The reference pitch is A4 = 440 Hz.
- A clean, dry signal works best. Turn off distortion, chorus, delay, and amp effects. Mute unused strings. Set input gain so notes are comfortably above the noise gate without clipping.
- Select **Use live guitar for lessons**. Audio is processed in memory on your device and is never uploaded or recorded. This app does not route audio to speakers; use interface direct monitoring.
- If the meter stays flat, check the chosen device/channel, OS permissions, hardware gain, and cabling. This build has not yet been validated with physical iRig hardware.
- Use the tuner before lessons. Positive timing compensation moves detections earlier by the chosen number of milliseconds. This is a manual adjustment, not automatic latency calibration.

## Progression and scoring

32 skills: 14 Tabs skills (including two scale studies) and 18 Chords skills. Bronze in a skill unlocks the next skill in that track. You can inspect locked skills, but cannot start them.

| Rank | Exercise | Pass requirement | Arena bonus |
|---|---|---|---|
| Bronze | Guided; waits for the correct note | 75% accuracy | +1% |
| Silver | Scrolling, 70 BPM, ±350 ms | 80% accuracy | +2% |
| Gold | Scrolling, 90 BPM, ±270 ms | 90% accuracy | +3% |
| Diamond | Echo challenge, 100 BPM, ±230 ms | 90% accuracy **and** beat 940 points | +5% |

Guided accuracy = hits / max(target count, attempts). Wrong attempts count even though the exercise waits. Scrolling accuracy = hits / target count; a wrong note consumes that target, and late targets become misses. Accuracy is rounded to a whole percent. Each attack has equal weight. Skill-tree drills use one note per beat; imported songs retain their source note timing, durations, rests and ties. Rests and tied continuations are not scored as attacks.

The three strongest skills automatically form your loadout; bonuses add to a maximum of 15%. A skill's new rank replaces its earlier bonus. Battle points = round(10 × accuracy × (1 + bonus / 100)). Bonuses never bypass accuracy requirements. Echo is a deterministic simulated opponent with a 940-point target, not a neural network or a live player. Ties do not win. Ranks must be earned in order, and replaying an earned rank does not farm XP.

Demo and live profiles are stored separately in browser local storage. There are no accounts, cloud sync, multiplayer, or anti-cheat. Clearing browser data removes progress. Hiding the tab aborts an active attempt without awarding progress.

## Audio recognition and honest limits

Single-note detection uses a YIN-style cumulative mean normalized difference estimator over Web Audio samples. Chord recognition compares FFT magnitudes with harmonic templates for the supported voicings. It is **experimental**, especially for distorted signals, inversions, alternate voicings, soft attacks, and dense chords. Low-confidence or ambiguous chords are left unclassified. Synthetic tests do not establish real-instrument recognition accuracy.

Supported chord labels: Em, E, Am, A, D, C, G, F, Bm, E5, A5, G5, D5, E7, A7, D7. The app checks pitch/chord identity, not physical fingering or string choice. Repeated notes need separate attacks; mute briefly between repeats if necessary. There is no reliable automated grading of hammer-on articulation, pull-offs, slides, bends, palm-muting, strum direction, or barre fingering yet. Technique lessons explicitly describe what is checked; their ranks currently reflect pitch/timing exercises only. Power-chord tab riffs grade root notes; the Chords track includes full power-chord recognition.

Relevant platform documentation: [getUserMedia and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [audio input constraints](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints), and [FFT frequency data](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatFrequencyData). Localhost is supported; remote hosting requires HTTPS for microphone access.

## Guitar Pro and MusicXML songs

Select **Import song** in the lesson library. alphaTab reads Guitar Pro `.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`, MusicXML `.xml` and `.musicxml`, and compressed MusicXML `.mxl`. MuseScore can import Guitar Pro scores; export them from MuseScore as MusicXML to practice them here. This app does not sign into or scrape mySongBook; import a score file you are authorized to use.

Parsing runs in a memory-limited worker on this PC with an 8 MB file limit, a 20-second parsing limit, and caps on score size, repeats, tracks and lesson events. Score files are sent only to the local practice server and are not saved there. Parsed songs are stored in this browser's IndexedDB and can be removed from the library. Select an instrument track and section, then choose guided or scrolling practice at 25–125% speed. The importer preserves separate tracks, tempo changes, timing, repeats, simultaneous notes, rests, ties, tunings, capo, source string/fret positions and techniques recognized by alphaTab. You can apply a track's tuning directly to the tuner. Choose full voicings or focus on the highest melody note at each attack.

MusicXML without tablature lacks source string/fret positions; the trainer labels its fingering suggestions. MusicXML is complex, and unsupported score markings may be omitted. The trainer displays but does not grade hammer-ons, slides, bends, palm muting or note sustain. Chord recognition for imported voicings is experimental. It does not generate backing audio or connect to mySongBook.

MusicXML is a useful interchange format: [MuseScore calls it a universal score-sharing format](https://handbook.musescore.org/file-management/working-with-musicxml-files). alphaTab documents [Guitar Pro 3–8, GPX, MusicXML and compressed MXL support](https://www.alphatab.net/docs/category/formats/) and [partial MusicXML feature coverage](https://alphatab.net/docs/formats/musicxml/). [Guitar Pro's file-management guide](https://www.guitar-pro.com/docs/gp8/basics/first-steps/file-management) covers opening native files and importing/exporting MusicXML.
## Open lesson packs

The bundled short exercises and arrangements were authored for this project and dedicated under **CC0-1.0**; see `CONTENT-LICENSE.md`. No copyrighted commercial song tabs are bundled or scraped.

In **Lesson library**, download the example JSON, adapt it, and import it. Required fields:

```json
{
  "version": 1,
  "title": "My original study",
  "author": "Your name",
  "source": "https://example.com/my-study",
  "license": "CC0-1.0",
  "sequence": [
    {"string": 6, "fret": 0},
    {"string": 6, "fret": 3},
    {"string": 5, "fret": 0},
    {"string": 5, "fret": 2}
  ]
}
```

Strings are 1 (high E) through 6 (low E), standard tuning. Frets are 0–24. Use `{"chord":"Em"}` for chord events. A pack must use all notes or all chords, contain 4–256 events, and be under 200 KB. Up to 30 packs are saved locally. Supported license declarations: `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `Public-Domain`. JSON-pack metadata validation does not verify the truth of copyright claims. Attribution and source links remain visible. JSON practice does not grant skill ranks.

[Mutopia](https://www.mutopiaproject.org/) is a source of public-domain and Creative Commons music, with licenses listed per work. This app links to it but does not download or convert scores.

## Verification

```sh
npm test
npm ci
npx playwright test
```

Node tests cover progression, buffs, scoring, timing, pack validation, synthetic pitch/chord estimation, and HTTP boundaries. Browser tests use installed Microsoft Edge and cover demo lessons, profile isolation, navigation, imports, responsive rendering, audio permission failure, and an actual Web Audio stream carrying synthesized notes through the live detector. Physical USB audio, recognition with real guitars, and latency need hardware testing.

## Next development steps

Collect licensed real-guitar validation recordings; measure recognition precision and latency across iRig devices; improve voicing-invariant chord detection and onset detection; add rhythm durations/rests and metronome; expand Guitar Pro and MusicXML import coverage; implement technique-specific grading; add profile export/sync and richer AI difficulty.


