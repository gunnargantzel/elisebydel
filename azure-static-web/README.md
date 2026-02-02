# Azure Static Web App - Elise Institusjon

Samme autentiseringsløsning som React Native mobilappen, uten bruk av Azure Static Web Apps innebygde autentisering.

## Fremgangsmåte (identisk med mobilappen)

1. **`prompt=login`** – Tvinger Microsoft Azure AD-pålogging hver gang (ingen lagret sesjon)
2. **`login_hint=`** – Tom for å unngå forhåndsutfylt brukernavn
3. **`sessionStorage.clear()`** – Fjerner lagrede legitimasjoner ved lasting
4. **Cache-Control headers** – Hindrer caching av legitimasjoner
5. **Umiddelbar redirect** – Bruker sendes til Power Apps-URL med OAuth-parametre

## Filer

| Fil | Beskrivelse |
|-----|-------------|
| `index.html` | Hovedside som tømmer sessionStorage og redirecter til Power Apps med `prompt=login` |
| `config.js` | Power Apps URL og `getAuthUrl()` – samme logikk som mobilappen |
| `staticwebapp.config.json` | Azure-konfigurasjon (ingen auth-providers, Cache-Control på rutene) |

## Deploy til Azure Static Web Apps

### Viktig: Build-konfigurasjon i Azure Portal

Gå til Azure Portal → din Static Web App → **Configuration** → **Build Details** og sett:

| Innstilling | Verdi |
|-------------|-------|
| **App location** | `/` (repo root) |
| **Output location** | `build` |
| **Api location** | *(tom)* |
| **App build command** | `npm run build` |

`package.json` i repo root har `build`- og `build:azure`-scripts som kopierer `azure-static-web/` til `build/`.

### Via Azure Portal (ny Static Web App)

1. Gå til [Azure Portal](https://portal.azure.com) → Create Resource → Static Web App
2. Velg **Custom** som deployment source (ikke GitHub Actions)
3. Velg subscription og resource group
4. **Build Presets**: `Custom`
5. **App location**: `azure-static-web`
6. **Output location**: `.`
7. **App build command**: `npm run build`

### Via GitHub Actions

En workflow-fil er lagt til: `.github/workflows/azure-static-web-app.yml`

**Viktig:** Du må legge til deployment token som GitHub secret:
1. Gå til Azure Portal → din Static Web App → **Manage deployment token** → Kopier token
2. Gå til GitHub → repo → **Settings** → **Secrets and variables** → **Actions**
3. Opprett secret `AZURE_STATIC_WEB_APPS_API_TOKEN` med token-verdien

Hvis Azure opprettet en egen workflow ved tilkobling, kan du i stedet oppdatere den med:
- **app_location**: `azure-static-web`
- **output_location**: `.`
- **app_build_command**: `npm run build`

### Via SWA CLI (lokalt test)

```bash
npm i -g @azure/static-web-apps-cli
cd azure-static-web
swa start .
```

Åpne http://localhost:4280 – du blir redirectet til Power Apps med pålogging.

## Viktig

- **Bruk ikke** Azure Static Web Apps innebygde authentication (Microsoft, GitHub, etc.)
- Autentisering skjer via Power Apps / Microsoft OAuth med `prompt=login`
- Bruker må logge inn på nytt ved hvert besøk – samme oppførsel som mobilappen
