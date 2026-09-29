# Current task: visual and practice-flow polish

## Changes

- Consolidated the visual system into `public/style.css`, with navy/charcoal surfaces, cream text, teal/coral accents, restrained purple branch highlights, and distinct mastery colors. Removed the old `public/theme.css` override layer and aligned mobile nav rules with the tree's JavaScript geometry.
- Added the Downloads reference artwork as the sidebar wordmark and created scalable pick/fretboard marks, monochrome and favicon variants. Added a no-delay startup placeholder and a mobile swipe cue for the horizontal tree.
- Kept the six-branch skill-tree design. Nodes use one shared 180-by-92 geometry value, with 192-pixel lanes; responsive tests check node/title collisions and selected-node visibility.
- Imported songs start at 60/70/85/100 percent for Bronze/Silver/Gold/Diamond. BPM and percentage remain visible; users can lower speed, and faster steps require a clear suggestion and player action. Imported songs default to a two-bar count-in; normal drills retain one bar.
- Added first-run tuning/input guidance, scale previews, authored string-switching phrases, and XP feedback while retaining profile migration and mastery thresholds.

## Verification

- Fresh-profile browser flow: onboarding to Fundamentals, first lesson earns 35 XP, and the next tab skill becomes available. A clean-profile simulation reaches Bronze in four qualifying sessions over two days with the repeat cap; mastery thresholds remain 100/250/500/900 XP.
- Node tests: 38 passed. Full Playwright suite: 19 passed, including startup branding, onboarding-to-XP flow, imported-song count-in/speed suggestion, scales, and five responsive tree sizes.
- Manually inspected desktop and mobile tree screenshots. Automated viewports: 1920x1080, 1440x900, 1280x720, 768x1024, and 390x844.

## Remaining

- Validate input latency/noise and song timing with a physical Windows PC and iRig interface; browser automation uses synthesized input.
- Imported-song end-to-end tempo coverage uses a synthetic Guitar Pro-style library record. Test representative real `.gp`, `.gp5`, `.gpx`, and MusicXML files on-device.