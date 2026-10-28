# Design

- **Final iPhone screens (v2):** Claude Design canvas: https://claude.ai/artifact/2VocQPWmQ79DrkFyS3NWB3
  (top bar options, 11 screens with notes, mascot board with all 8 poses)
- **User flow v2:** Figma, personal team, "Leitner App - User Flow v2"
- **Wireframes v1 (superseded):** https://www.figma.com/design/ygJ6Z5KvZcLt3unBvblHsf
- **Tokens:** [tokens.md](tokens.md) ↔ `src/styles/tokens.css`
- **UI kit (code):** `src/ui/`. See every component on one page with `npm run dev`, then open http://localhost:5173/leitner-app/?kit (add `&open=bottom` or `&open=dialog` to start with a sheet open). Dev only; never on the live site.

## UI kit (roadmap 7.7)

| Component     | Variants                                                                           |
| ------------- | ---------------------------------------------------------------------------------- |
| `Button`      | `primary` (ink), `secondary` (cream, "Not yet"), `text` (underlined)               |
| `IconButton`  | `ink` 52px (top bar +), `cream` 44px (pencil); always has a spoken label           |
| `Pill`        | `stat` (top bar), `tag` (similar words), `label` (cream / aqua); `AddPill` dashed  |
| `Card`        | White word card; `CardStack` adds the tilted aqua + peach cards behind             |
| `BottomPanel` | `orange` / `aqua`, `compact` / `tall`, optional peeking mascot                     |
| `Sheet`       | `bottom` (add / edit, handle closes it) / `dialog` (duplicate word, mascot circle) |
| `TopBar`      | Option A: words-learned pill, streak pill, + button                                |

Sheet is hand-built (decided 2026-10-28): page behind is `inert`, Tab stays inside, Esc / overlay / handle close it, focus returns to the opener.

## Screen rules (v2)

- Very round: cards 40px, bottom panels 52–56px top radius, inputs 22px, every button/tag a full pill.
- Chunky 2.5px ink outlines on cards, pills, buttons.
- Squishy buttons: hard shadow `0 5px 0`; on press, drop 5px and lose the shadow.
- Tilted card stack: aqua + peach cards peek behind the current card.
- Big rounded colour panel at the bottom holds actions: orange (review, session complete), aqua (practice, all done). Review panels ~124–160px tall.
- Session complete & All done share a layout: mascot circle 150px from top, bottom panel 330px.
- Memphis confetti (sparkles, triangles, dots) on loading, session complete, all done; only a touch on review.
- Copy: "Knew it!" / "Not yet"; stamps KNEW IT! / NOT YET while swiping.
- "Not yet" is neutral, never red. Never small white text on terracotta.

## Mascot

A rounded card box (aqua front #BFE7EA, darker back wall #8FD0D6), three index cards inside (terracotta, orange, cream), cream label slot. Dot eyes, ^ ^ happy eyes, orange blush, stick arms/legs (2.5–3.5px ink). Small mascots have no legs. Built from separate shapes so parts animate independently.

| #   | Pose                | App moment                               |
| --- | ------------------- | ---------------------------------------- |
| 1   | wave                | Loading                                  |
| 2   | idle                | Card showing, practice, duplicate dialog |
| 3   | happy               | Knew it                                  |
| 4   | cheer (holds heart) | Not yet                                  |
| 5   | celebrate           | Session complete                         |
| 6   | flame               | Streak                                   |
| 7   | sleep               | All done for today                       |
| 8   | write               | Add / edit word                          |

On the practice screen the mascot body is white. Mascot SVGs still need exporting from the canvas into `src/assets/mascot/`.
