# Real iRig validation

Automated tests use synthetic browser audio where needed. They do not establish how a physical guitar, pickup, cable, Windows driver, or iRig interface behaves. No physical iRig results are claimed yet.

Before changing pitch or onset recognition, run these checks on Windows with the iRig connected. Record the Windows version, browser, interface model and driver, sample rate, selected channel, guitar and pickups, effects, noise-gate value, and input offset with each run.

| Check | Procedure | Record |
| --- | --- | --- |
| Open strings | Tune and pluck all six strings separately, low to high, several times | Detected note, stability, confidence, missed or false attacks |
| Fretted notes | Test frets 1, 5, 12, and 17 on each string | Note accuracy and string/fret weak spots |
| Chords | Hold Em, G, C, D, Am, and one barre chord cleanly | Chord identity, settling time, false matches |
| Repeated notes | Pick the same fret 20 times at slow and medium tempos | Attack separation, missed and duplicate triggers |
| Palm-muted notes | Repeat a short muted riff at two tempos | Attack capture and false detections |
| Noisy input | Increase gain/noise and test with unused strings ringing | Noise-gate behavior, false attacks, clipping |
| Pickup/gain changes | Compare pickup positions and low/medium/high interface gain | Note stability and confidence |
| Guitar comparison | Repeat open-note, repeated-note, and chord checks on an inexpensive and a higher-quality guitar | Instrument-specific differences |
| Latency | Calibrate eight beats at 80 BPM, then repeat the practice timing check | Reported offset and observed early/late grading |
| Long run | Play a two-minute lesson without changing devices | Disconnects, drift, browser errors |

Use Input & Tuner diagnostics to capture sample rate, detected frequency/note, confidence, stability, attack count, and timing offset. Save observations here or in a dated companion log before adjusting recognition code.

Also test real .gp, .gp5, .gpx, and MusicXML files from more than one source. Check tempo changes, tuning, multiple tracks, measures, rests, chords, and techniques against the source score. Keep test files and notes local unless their licenses allow redistribution.