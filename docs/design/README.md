# Design

- **Final iPhone screens (v2):** Claude Design canvas: https://claude.ai/artifact/2VocQPWmQ79DrkFyS3NWB3
  (top bar options, 11 screens with notes, mascot board with all 8 poses)
- **User flow v2:** Figma, personal team, "Leitner App - User Flow v2"
- **Wireframes v1 (superseded):** https://www.figma.com/design/ygJ6Z5KvZcLt3unBvblHsf
- **Tokens:** [tokens.md](tokens.md) ↔ `src/styles/tokens.css`
- **Motion:** [motion.md](motion.md): what moves, when and how fast (roadmap step 4)
- **UI kit (code):** `src/ui/`. See every component on one page with `npm run dev`, then open http://localhost:5173/leitner-app/?kit (add `&open=bottom` or `&open=dialog` to start with a sheet open). Dev only; never on the live site.

## UI kit (roadmap 7.7)

| Component     | Variants                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `Button`      | `primary` (orange), `aqua` ("Knew it!", orange panels), `secondary` (cream, "Not yet"), `text`                 |
| `IconButton`  | `primary` 52px orange (top bar +), `cream` 44px (pencil), `white` 44px (sheet ✕); spoken label                 |
| `Pill`        | `stat` (top bar), `tag` (similar words), `label` (cream / aqua); `AddPill` dashed                              |
| `Card`        | White word card; `CardStack` adds the tilted aqua + peach cards behind                                         |
| `BottomPanel` | `orange` / `aqua`, `compact` / `tall`, optional peeking mascot                                                 |
| `Sheet`       | `bottom` (add / edit; ✕, Esc or dragging the handle down closes it) / `dialog` (duplicate word, mascot circle) |
| `TopBar`      | Option A: words-learned pill, streak pill, + button                                                            |

Sheet is hand-built (decided 2026-10-28). The bottom sheet is only as tall as its content and grows as fields are added, up to 76px from the top, then scrolls (decided 2026-10-28; the canvas shows it full height): page behind is `inert`, Tab stays inside, Esc / overlay / ✕ / dragging the handle down (2026-10-29) close it, focus returns to the opener.

## Screen rules (v2)

- Very round: cards 40px, bottom panels 52–56px top radius, inputs 22px, every button/tag a full pill.
- Chunky 2.5px ink outlines on cards, pills, buttons.
- Squishy buttons: hard shadow `0 5px 0`; on press, drop 5px and lose the shadow.
- Button colours (Yali, 2026-10-29): every big button has the chunky ink outline and an ink shadow, so the outline stays visible. **Orange** on the cream page and forms; **cream** on aqua panels (like screen 08) and for "Not yet"; **aqua** on orange panels and for "Knew it!" (in the aqua practice round "Knew it!" stays orange so it differs from "Not yet"). The top-bar + is orange with an ink outline. No black-filled buttons.
- Session complete (2026-10-29): the mascot stays centred, "Session complete!" and the text sit under it, the orange panel holds only the buttons, and the streak is a speech bubble from the mascot (so nothing else looks like a button). More due: aqua "Next N words" + text link "I'm done for now". Nothing else due: one aqua "Done for today" button (no lone link in an empty panel).
- Tilted card stack: aqua + peach cards peek behind the current card.
- Big rounded colour panel at the bottom holds actions: orange (card front, session complete), **white on the card back** (answer buttons, canvas 03), aqua (practice, all done). Review panels ~124–160px tall.
- Card screens: the progress bar sits 48px under the top bar and the card stack 40px under it (canvas 03, 2026-10-29).
- Session complete & All done share a layout: mascot circle 150px from top, bottom panel 330px.
- Memphis confetti (sparkles, triangles, dots) on loading, session complete, all done; only a touch on review.
- Copy: "Knew it!" / "Not yet"; stamps KNEW IT! / NOT YET while swiping.
- "Not yet" is neutral, never red. Never small white text on terracotta.
- Keyboard focus ring (2026-10-29): 3px `--color-focus-ring`, terracotta on cream and white, ink on the orange and aqua panels (terracotta is too faint there). Only shows for keyboard use, never on tap or click.

## Laptop (roadmap 7.13)

- From 700px wide (laptop, tablet) the whole app is the phone layout in a centred 560px column (`--column-desktop`) on the cream page. Phones are unchanged.
- The add / edit sheet becomes a centred modal: full chunky outline, card shadow, no drag handle (✕, Esc and the overlay close it). Dialogs are the same as on the phone.
- With a mouse or trackpad the card front says "click or press space" and the panel "then flip the card…"; with touch it stays "tap to flip".
- Shortcuts: Space flips, ← Not yet, → Knew it!, E edits (back only), Esc closes a sheet. Canvas row "Laptop" (1440×900).

## Daily reminder (ADR-018)

- "Want a daily reminder?" is a dialog (waving mascot) shown once after **I'm done for now**: "At 19:00 I'll let you know when words are waiting, or when your streak needs a new word. Never more than once a day." · **Yes, remind me** / **Not now**. Results: "Reminders are on!" (happy), "Notifications are off" or "Couldn't turn it on" (cheer).
- Notifications: "Time for your words · 12 words are waiting for you." / "Keep your streak going · Add a word to keep your 5-day streak." Icon: the app icon. The app-icon number = words waiting today.

## Mascot

A rounded card box (aqua front #BFE7EA, darker back wall #8FD0D6), three index cards inside (terracotta, orange, cream), cream label slot. Dot eyes, ^ ^ happy eyes, orange blush, stick arms/legs (2.5–3.5px ink). Small mascots have no legs. Built from separate shapes so parts animate independently.

| #   | Pose                | App moment                               | Motion (final, 2026-10-29) |
| --- | ------------------- | ---------------------------------------- | -------------------------- |
| 1   | wave                | Loading                                  | Right arm waves (loops)    |
| 2   | idle                | Card showing, practice, duplicate dialog | Slow gentle bob (loops)    |
| 3   | happy               | Knew it                                  | One hop                    |
| 4   | cheer (holds heart) | Not yet                                  | One warm nod               |
| 5   | celebrate           | Session complete                         | Two hops                   |
| 6   | flame               | Streak                                   | Flame flickers (loops)     |
| 7   | sleep               | All done for today                       | z z z float up (loops)     |
| 8   | write               | Add / edit word                          | Pencil scribbles (loops)   |

In code: `<Mascot pose="wave" />` from `src/ui/Mascot/` (roadmap 7.8). Options: `size` large (190px, legs) or small (84px, no legs), `body` aqua or white (practice screen), `decorative`, `still`. All motion stops when the phone's "Reduce motion" is on.

The drawing lives only in `src/ui/Mascot/poses.tsx` (one entry per pose: arms, legs, card tilts, eyes, mouth, extras). To redraw the mascot later, change that file; no screen needs to change. For a brand-new character, draw it with each part on its own named layer (body, back wall, cards, eyes, mouth, left arm, right arm, legs, extras) and all 8 poses.
