// lib/api.js
import { fetchJson } from "./auth";

function okOrThrow(r) {
  if (!r.ok) throw new Error(r.json?.error || `${r.status}`);
  return r.json || {};
}

export const api = {
  get:   async (path)       => okOrThrow(await fetchJson(path)),
  post:  async (path, body) => okOrThrow(await fetchJson(path, { method: "POST",  body })),
  patch: async (path, body) => okOrThrow(await fetchJson(path, { method: "PATCH", body })),
  del:   async (path)       => okOrThrow(await fetchJson(path, { method: "DELETE" })),
};
