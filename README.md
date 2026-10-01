# RiffTree

A playable guitar-training app with six connected skill branches, live USB audio, guided lessons, scrolling practice, and a deterministic virtual rival.

RiffTree is the public product name. The GitHub repository remains `Darkhelmet23/irig-trainer`. Legacy localStorage keys, IndexedDB names, practice-bundle format identifiers, Supabase function/migration names, and auth storage keys retain their `irig` prefixes so existing local data and deployed integrations continue to work. Apple login remains deferred.

The transparent source logo is preserved at `assets/rifftree-original.png`; run `scripts/build-rifftree-assets.ps1` on Windows to regenerate the optimized wordmark, emblem, favicon, and PWA icons. The palette pairs a cream sidebar and neutral charcoal practice surfaces with forest-green actions and warm-gold mastery accents.

## Run

Install Node.js 22 or newer, then run in this folder:

```sh
npm ci
npm start
```

Open **http://localhost:3210** in a current Chrome or Edge browser. Guitar Pro and MusicXML scores are parsed on your computer. The server binds only to your computer. Set `PORT` to change the port.

## Optional account sign-in

After `npm ci`, start the app with `npm start`. Open **Account** in the top bar to choose Google, Facebook, email/password, or **Continue without an account**. Guests can use lessons, live input, the tuner, imported songs, Song Studio, progression, and offline practice. Signed-in live practice saves locally first and syncs structured progress online; another device restores it after sign-in. Offline changes remain local and retry when the connection returns. Demo progress stays local. Existing guest progress is kept separate until the player explicitly chooses **Sync local progress to my account** in Account. **Keep local progress separate** leaves it in the guest cache. Account shows Saved online, Syncing, Offline, or Sync needs attention without interrupting practice.

Account sign-in is optional and requires developer configuration. Copy `.env.example` to an untracked `.env` and fill `SUPABASE_URL` and `SUPABASE_ANON_KEY` with the project's public URL and publishable/anon key. Never use a service-role key in the browser. Configure Google and Facebook in their provider dashboards and Supabase Auth, and enable **Allow manual linking** in Supabase Auth settings before using Connect. Apple authentication is deferred. Signed-in sync covers live skill XP, completed practice history, portable practice preferences, and Song Studio project JSON. Recordings, imported Guitar Pro/MusicXML files, audio device selection, and latency calibration remain local. **Merge another account** still combines cloud rows with MAX XP per skill and restores missing sign-in methods afterward; syncing then downloads the merged cloud result. Email confirmation, password recovery, redirect URLs, the root `supabase/` migrations, and future Tauri considerations are described in [SUPABASE-SETUP.md](SUPABASE-SETUP.md). For this repository's Supabase GitHub integration, the working directory is `.`. Missing configuration or internet never blocks local practice.

## Play

- Start in **Demo mode**. In a lesson, press **Space** (correct target) or **X** (wrong note); mobile players can use the onscreen buttons. Count-in length is customizable. Keyboard auto-repeat is ignored.
- Choose **Input & tuner** for real guitar practice. Plug the iRig into USB, connect the guitar, grant browser microphone permission, then select the iRig and reconnect. Some interfaces use channel 2; select the appropriate channel and reconnect.
- Choose from 20 tuner presets, including Standard, Drop D, DADGAD, open tunings, 7- and 8-string tunings, or enter a custom tuning of 4–8 open strings. Select a string to focus the tuner or use Auto. The reference pitch is A4 = 440 Hz.
- A clean, dry signal works best. Turn off distortion, chorus, delay, and amp effects. Mute unused strings. Set input gain so notes are comfortably above the noise gate without clipping.
- Select **Use live guitar for lessons**. Input analysis stays on your device. Optional practice recording is local to the browser and is never uploaded. This app does not route guitar audio to speakers; use interface direct monitoring.
- If the meter stays flat, check the chosen device/channel, OS permissions, hardware gain, and cabling. This build has not yet been validated with physical iRig hardware.
- Use the tuner before lessons. Latency calibration plays eight metronome beats and estimates input alignment; it includes your response timing, so adjust the compensation slider if needed.

## Practice dashboard and coaching

**Progress & tools** keeps up to 200 recent sessions in each local profile. It shows average accuracy, practice streak, daily plan, goals with due dates, achievements, note/chord accuracy, tempo history, weak string/fret positions, hardest repeated songs, and personal bests. The fretboard heatmap colors positions red, yellow, or green as attempts accumulate. A session coach highlights the hardest and strongest measures, compares a run with a personal best, summarizes early/late timing, recommends a next step, and generates a warm-up from recent weak string/fret positions.

Lessons include pitch-plus-timing, pitch-only, and rhythm-only scoring. Adaptive repeats are on by default and can be turned off before a lesson: repeated misses focus on the weak note/chord or imported-song measure, then replay it more slowly without awarding a rank for that partial retry. Imported songs support measure A-B loops, four-measure checkpoints, separate checkpoint ranks, and a 60–100% speed ladder that advances after 90% accuracy. A personal-best timing ghost is shown when a saved trace is available.

The practice tools also include a configurable metronome (quarter, eighth, or sixteenth-note subdivisions, beat-one accent, visual pulse), one- or two-bar count-in, noise gate, input meter, detected frequency/note, signal-quality readout, sample-rate and latency details, and optional local run recording for playback. Input & tuner adds a hardware diagnostic panel for pitch confidence, note stability, timing offset, detected attacks, and player-marked false detections or missed attacks. The tuner supports alternate presets and custom 4–8 string tunings.

Fretboard, ear, chord-transition, scale, and technique-guidance drills can be started from the dashboard. The ear trainer plays a reference note; chord changes report clean transitions per minute. Technique guidance can teach picking, muting, bends, slides, and legato, but ranks grade only the pitch/timing signals described above.

## Custom lessons, sharing, and offline use

The library's **Custom lesson builder** accepts fret positions such as `6:0 6:3 5:0 5:2` or supported chord names. Import and export a single JSON bundle containing lesson packs and tuner/practice preferences; bundles exclude recordings and device identifiers. Packs remain subject to the 30-pack browser limit and the stated license/source metadata.

The app is a PWA and caches its trainer shell for offline practice after the first online load. Install it from the Chrome or Edge app/install menu. Progress, plans, goals, tuner preferences, and imported songs remain in that browser profile. Score-file parsing still depends on the local Node server; already imported songs can be practiced from the browser's offline cache and IndexedDB.

## Progression and scoring

The Skill Tree connects 32 skills across Fundamentals & Fretboard, Tabs & Melodies, Chords & Rhythm, Scales & Lead, Technique, and Songs & Performance. Select a node to see its mastery, prerequisites, and related lessons; start practice from the Lessons page. Branches unlock gradually from prerequisite skill XP and, for some paths, a minimum mastery rank.

Bronze, Silver, Gold, and Diamond are mastery milestones inside each skill, reached at 100, 250, 500, and 900 skill XP. Eligible completed lessons award XP to their related unlocked skills. Awards account for accuracy, attack count, tempo/difficulty, and improvement; a run needs at least 12 scored attacks and 60% accuracy, and the same activity can award XP up to three times per day with diminishing returns. Repeated short failures cannot be used to farm mastery.

Scale & Lead lessons cover major, natural minor, pentatonic, blues, and modes across roots, fretboard positions, ascending/descending paths, 2–4-note sequences, position shifts, and an accuracy-gated tempo ladder. Built-in practice grows with mastery: Bronze targets 32 attacks, Silver 48, Gold 72, and Diamond 96, using phrase variations. Endless mode is available for supported built-in lessons.

| Mastery | Practice format | Pass requirement | Arena bonus |
|---|---|---|---|
| Bronze | Guided; waits for the correct note | 75% accuracy | +1% |
| Silver | Scrolling, 70 BPM, ±350 ms | 80% accuracy | +2% |
| Gold | Scrolling, 90 BPM, ±270 ms | 90% accuracy | +3% |
| Diamond | Echo challenge, 100 BPM, ±230 ms | 90% accuracy **and** beat 940 points | +5% |

Guided accuracy = hits / max(target count, attempts). Wrong attempts count even though the exercise waits. Scrolling accuracy = hits / target count; a wrong note consumes that target, and late targets become misses. Accuracy is rounded to a whole percent. Each attack has equal weight. Skill-tree drills use one note per beat; imported songs retain their source note timing, durations, rests and ties. Rests and tied continuations are not scored as attacks.

The three strongest mastered skills automatically form your loadout; bonuses add to a maximum of 15%. Battle points = round(10 × accuracy × (1 + bonus / 100)). Bonuses never bypass accuracy requirements. Echo follows a fixed 940-point score target. Echo does not learn or adapt and is not a live player. Gold mastery opens Echo challenges for eligible skills; challenge wins are recorded per skill. Ties do not win.

Demo and live profiles are stored separately in browser local storage. Accounts are optional; cloud sync, multiplayer, and anti-cheat are not implemented. Clearing browser data removes progress. Hiding the tab aborts an active attempt without awarding progress.

## Audio recognition and honest limits

Single-note detection uses a YIN-style cumulative mean normalized difference estimator over Web Audio samples. Chord recognition compares FFT magnitudes with harmonic templates for the supported voicings. It is **experimental**, especially for distorted signals, inversions, alternate voicings, soft attacks, and dense chords. Low-confidence or ambiguous chords are left unclassified. Synthetic tests do not establish real-instrument recognition accuracy.

Supported chord labels: Em, E, Am, A, D, C, G, F, Bm, E5, A5, G5, D5, E7, A7, D7. The app checks pitch/chord identity, not physical fingering or string choice. Repeated notes need separate attacks; mute briefly between repeats if necessary. There is no reliable automated grading of hammer-on articulation, pull-offs, slides, bends, palm-muting, strum direction, or barre fingering yet. Technique lessons explicitly describe what is checked; their ranks currently reflect pitch/timing exercises only. Power-chord tab riffs grade root notes; the Chords track includes full power-chord recognition.

Relevant platform documentation: [getUserMedia and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [audio input constraints](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints), and [FFT frequency data](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatFrequencyData). Localhost is supported; remote hosting requires HTTPS for microphone access.

## Guitar Pro and MusicXML songs

Select **Import song** in the lesson library. alphaTab reads Guitar Pro `.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`, MusicXML `.xml` and `.musicxml`, and compressed MusicXML `.mxl`. MuseScore can import Guitar Pro scores; export them from MuseScore as MusicXML to practice them here. This app does not sign into or scrape mySongBook; import a score file you are authorized to use.

Parsing runs in a memory-limited worker on this PC with an 8 MB file limit, a 20-second parsing limit, and caps on score size, repeats, tracks and lesson events. Score files are sent only to the local practice server and are not saved there. Parsed songs are stored in this browser's IndexedDB and can be removed from the library. Select an instrument track and section, then choose guided or scrolling practice at 25–125% speed. The importer preserves separate tracks, tempo changes, timing, repeats, simultaneous notes, rests, ties, tunings, capo, source string/fret positions and techniques recognized by alphaTab. Each selected section shows a Beginner–Expert estimate based on tempo, attack density, fret movement, chord rate, fret range, and techniques; it is a transparent practice guide, not an official score rating. You can apply a track's tuning directly to the tuner. Choose full voicings or focus on the highest melody note at each attack.

MusicXML without tablature lacks source string/fret positions; the trainer labels its fingering suggestions. MusicXML is complex, and unsupported score markings may be omitted. The trainer displays but does not grade hammer-ons, slides, bends, palm muting or note sustain. Chord recognition for imported voicings is experimental. It does not generate backing audio or connect to mySongBook.

MusicXML is a useful interchange format: [MuseScore calls it a universal score-sharing format](https://handbook.musescore.org/file-management/working-with-musicxml-files). alphaTab documents [Guitar Pro 3–8, GPX, MusicXML and compressed MXL support](https://www.alphatab.net/docs/category/formats/) and [partial MusicXML feature coverage](https://alphatab.net/docs/formats/musicxml/). [Guitar Pro's file-management guide](https://www.guitar-pro.com/docs/gp8/basics/first-steps/file-management) covers opening native files and importing/exporting MusicXML.
## Riff arcade

The lesson library includes **24 original charts** across four sets, from starter riffs to expert-speed lead and chord runs. Choose guided practice to learn the notes, then scrolling practice to follow the note highway and earn an accuracy percentage. These short charts were created for this project and are CC0-1.0; they are not commercial Guitar Hero songs and do not include backing recordings. Physical string/fret accuracy and chord detection depend on the connected guitar and audio input.

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

Collect licensed real-guitar validation recordings; measure recognition precision and latency across iRig devices; improve voicing-invariant chord detection and onset detection; expand Guitar Pro and MusicXML import coverage; implement technique-specific grading; add profile sync and more adaptive difficulty.


