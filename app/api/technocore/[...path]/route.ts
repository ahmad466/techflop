import { NextRequest } from "next/server";

const ORIGIN = process.env.TECHNOCORE_URL || "https://technocore.chat";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path, "GET");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path, "POST");
}

async function proxy(req: NextRequest, path: string[], method: string) {
  const upstream = `${ORIGIN}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const init: RequestInit = { method, cache: "no-store", headers: {} };
  if (method === "POST") {
    init.headers = { "content-type": req.headers.get("content-type") || "application/json" };
    init.body = await req.text();
  }
  const response = await fetch(upstream, init);
  const headers = new Headers();
  const ct = response.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  return new Response(response.body, { status: response.status, headers });
}