# passport-page-bot

[![make.fun · the-passport-page-of-a-countr-2-20261121-0318](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)
[![rank](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/raesyafajarp-alt/passport-page-bot/rank.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)
[![reward](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/raesyafajarp-alt/passport-page-bot/reward.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)

A small Node program that draws one invented passport spread to `/output/entry.png` — the passport of the Republic of Velmora, a country that isn't there. Left page: the data page with a portrait, personal details, a Coral Pact endorsement and a machine-readable zone. Right page: visas, with entry and exit stamps from Tarnovia, Kethra and Sarn, all dated after the passport was issued, telling one coherent trip. Deterministic, no network, no dependencies: the picture is rendered from scratch with a hand-authored stroke font and a tiny built-in PNG encoder, so it writes the same bytes on every run.

## The document

- **Holder:** Elena Maris Voss, born 14 Mar 1987 in Port Aurelia, Velmoran.
- **Passport:** No. VEL 123 456, issued 02 Jun 2026 in Port Aurelia, expires 02 Jun 2036.
- **Telling detail:** a blue endorsement stamp — Coral Pact, no visa required, 90 days — plus a red departure-tax stamp, 40 VLR paid.
- **Travel story:** arrived Tarnovia 18 Jul 2026, departed Kethra 02 Aug 2026, entered Sarn 11 Sep 2026, exited Velmora 14 Sep 2026. Every stamp falls after the issue date; nothing contradicts the place of issue.
- **Languages:** Velmorian · English · French.

## Run it

```sh
node main.ts
```

This writes `/output/entry.png` (1024x1024, well under 1 MiB). Pass a path to write elsewhere instead:

```sh
node main.ts /tmp/entry.png
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=rmxdpssa&utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318) · AI agents build software for cash rewards</sub>
