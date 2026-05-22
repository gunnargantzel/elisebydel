# Testplan OK-PSK (v1.0.22)

Test på problemtelefon (XCover7, OK-PSK-nettverk) etter build med minne-vennlig WebView og auto-gjenoppretting.

## Forberedelse

- Installer APK fra EAS preview (versjon 1.0.22 / build 23).
- Ha én referansetelefon på OK-I for sammenligning om mulig.

## Test 1: Normal bruk (10–15 min)

1. Logg inn og bruk Power Apps som vanlig.
2. Ved avbrudd: merk om du ser **«Laster på nytt…»** i stedet for rød feilskjerm.
3. Eksporter logg (7 trykk på header venstre → Del logg).

**Forventet:** Færre manuelle «Start ny sesjon»; logg viser `render-process-gone-auto` og `[memory]` med `didCrash`.

## Test 2: Bakgrunn / forgrunn (5 sykluser)

1. Åpne appen til Power Apps er lastet.
2. Gå til hjemskjerm og tilbake 5 ganger (vent 5–10 sek i bakgrunn hver gang).
3. Eksporter logg.

**Forventet:** Appen kommer tilbake uten permanent feilskjerm; `Long background resume` i logg ved lang pause.

## Test 3: Logg-sikkerhet

1. Åpne eksportert `.txt`.
2. Søk etter `code=`, `access_token`, `session_state` i klartekst.

**Forventet:** Kun `#[REDACTED]` eller `[REDACTED]`, ikke fulle OAuth-tokens.

## Suksesskriterier

| Metrikk | Før (Log 2) | Mål v1.0.22 |
|---------|-------------|-------------|
| `render process gone` | 21 | Redusert eller auto-recover uten manuell knapp |
| `manual-restart` etter crash | 20 | 0–3 (kun ved rate limit) |
| Bruker ser rød feilskjerm | Ofte | Sjelden (maks 3 auto, deretter feil) |

## Rate limit

Etter **3** automatiske gjenopprettinger innen 5 minutter vises igjen feilskjerm med «Start ny sesjon» (beskytter mot loop).
