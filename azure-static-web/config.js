/**
 * Power Apps URL - samme som React Native appen
 * Konfigureres her for enkel vedlikehold
 */
const POWER_APPS_BASE_URL = 'https://apps.powerapps.com/play/e/51da13ed-bad2-4891-acdf-06d3184e6af1/a/f9c26727-72ed-468b-89c2-4e06ee09c3d8?tenantId=fb7e0b12-d8fc-4f14-bd1a-ad9c8667a7e6&hint=052fe12c-09c4-4ebe-8a83-abe82ae742cc&sourcetime=1770037641252&skipMobileRedirect=1&hidenavbar=true';

function getAuthUrl() {
  const url = new URL(POWER_APPS_BASE_URL);
  url.searchParams.set('prompt', 'login');      // Tvinger Microsoft-pålogging hver gang
  url.searchParams.set('login_hint', '');       // Ingen forhåndsutfylt bruker
  url.searchParams.set('hideNavBar', 'true');
  url.searchParams.set('skipMobileRedirect', '1');
  url.searchParams.set('source', 'iframe');
  return url.toString();
}
