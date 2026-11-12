import { fetch } from "../app.js";

/** Vercel Edge adapter; application behavior remains in ../app.ts. */
export const config = { runtime: "edge" };
export default function handler(request: Request): Promise<Response> {
  return fetch(request);
}
