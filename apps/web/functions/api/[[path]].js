/* global URL, fetch, Request */

const API_ORIGIN = 'https://studio-cener-api.aaabawgte.workers.dev';

export async function onRequest({ request }) {
  const target = new URL(request.url);
  const apiOrigin = new URL(API_ORIGIN);
  target.protocol = apiOrigin.protocol;
  target.host = apiOrigin.host;
  return fetch(new Request(target, request));
}
