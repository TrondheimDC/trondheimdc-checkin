# Hent deltakerliste fra Checkin (med QR-id)

Innsjekk-appen trenger én rad per deltaker med **barcode** (= teksten i billettens QR-kode), pluss navn, firma og rolle. Den vanlige Excel-eksporten under **Deltakere** har *ikke* barcode. Bruk **totalrapporten** i stedet.

## Fremgangsmåte

1. Logg inn på [Checkin](https://app.checkin.no) som TrondheimDC.
2. Åpne arrangementet (f.eks. **TDC 2026**).
3. På oversiktssiden: klikk **⋯** til høyre for «Rediger arrangement».
4. Velg **Last ned totalrapport**.

![Hvor totalrapport lastes ned](./checkin-totalrapport.png)

Filen lastes ned som Excel. I Excel: **Lagre som → CSV UTF-8**. Kolonnen **Barcode** er QR-id-en.

## Importer i innsjekk

```bash
pnpm import:attendees ./totalrapport.csv
```

Kommandoen **erstatter** hele deltakerlisten. Kun barcode, navn, firma og stilling lagres. Avmeldte og venteliste hoppes over. E-post, telefon og adresse leses ikke inn.

## Ikke bruk dette

| Sted | Problem |
|---|---|
| Fanen **Deltakere** → Excel-ikon | Mangler barcode / QR-id |
| Fanen **Totalrapport** (merket «FLYTTET») | Nedlastingen ligger under **⋯**, ikke i fanen |

## Hva vi trenger fra rapporten

Map minst disse kolonnene inn i innsjekk-appen:

| Checkin (totalrapport) | Innsjekk |
|---|---|
| `Barcode` | `id` (QR-oppslag) |
| `Name` (ellers `First name` + `Last name`) | `name` |
| `Company` | `company` |
| `Job title` | `role` |

Én bestilling kan ha flere deltakere — derfor er barcode per person, ikke bestillingsnummer, det som gjelder.

## Oppdatering før arrangementet

Last ned ny totalrapport nær arrangementsdagen (og gjerne morgenen før), så siste påmeldinger og avmeldinger er med. Importer på nytt i innsjekk-appen.
