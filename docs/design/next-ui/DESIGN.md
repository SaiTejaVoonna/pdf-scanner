# Design direction: Notebook

Made with the frontend-design skill (`.claude/skills/frontend-design`). Mocks only; nothing here is built yet.

**Who it is for:** students and people filling in upload forms, on a phone, often in a hurry.
**Its one job:** a photo of paper becomes a clean, small PDF.

## Where the look comes from
The subject is paper, so the look comes from a student's notebook, not from other apps: white ruled pages, a red margin line,
blue ballpoint ink, and a yellow highlighter over the thing that matters. On upload forms the thing that matters is the
file size, so the highlighter is kept for file sizes and nothing else.

## Tokens
| Name | Value | Used for |
|---|---|---|
| Page | `#FFFFFF` | Every screen background (true white, not cream) |
| Ballpoint | `#1B2A8F` | All text, icons and the main button: the app is "written in pen" |
| Pencil | `#6C7080` | Secondary text |
| Rule | `#C9D6F2` | The ruled lines that divide rows |
| Margin | `#E58A93` | The single vertical margin line |
| Highlighter | `#FFE83D` | File sizes only |

**Type:** Bricolage Grotesque (SIL OFL), one family. Narrow width and heavy weight for titles and big numbers, normal width
for everything else. No capitals-only labels.

## Layout
Left-aligned, like writing on a page. Rows sit on ruled lines; there are no cards, no glass, no shadows and no coloured
icon tiles. The margin line runs down the left of every screen and thumbnails sit in the margin.

```
Home                     Tools                    Result
| PDFs                   | Tools                  | < Compress PDF
|------------------      |------------------      |
| For forms              | Scan                   |  [147 KB]   <- highlighter
|  PDF under 200 KB      |  Document | ID card    |  was 1.2 MB, limit 200 KB
|  Photo under 50 KB     |------------------      |------------------
|------------------      | Make smaller           |  Physics notes.pdf
| [] Physics notes       |  Compress | Resize     |  5 pages, no watermark
| [] Rent receipt        |------------------      |
|------------------      | Organise  ...          |  [ Share ]
| PDFs Scan Tools Set.   | PDFs Scan Tools Set.   |  Save to phone   Do another
```

## What I changed after checking the plan against the usual AI defaults
- My first idea was warm cream paper with a serif and a clay accent. That is the most common generated look, so the page is
  true white with blue ink and a grotesque typeface.
- The previous mock was the "rounded cards with soft shadows" kit. This one has no cards: rules do the dividing.
- Dropped the NEW tags, the coloured icon squares and the middle dots between details.
- One bold element only: the highlighter. Everything else stays quiet.
