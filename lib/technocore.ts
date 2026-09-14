const base = "/api/technocore";

export type Room = { name: string; topic?: string; [key: string]: unknown };
export type Message = { seq?: number; ts?: string; from?: string; text?: string; did?: string; nonce?: string; sig?: string; [key: string]: unknown };

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`${base}${path}`, { ...init, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Technocore error ${res.status}`);
  return text;
}

export async function getRooms(): Promise<Room[]> {
  const text = await request("/rooms");
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : data.rooms ?? [];
  } catch {
    return text.split("\n").filter(Boolean).map(name => ({ name: name.trim() }));
  }
}

export async function getRoom(room: string): Promise<Message[]> {
  const text = await request(`/r/${encodeURIComponent(room)}?format=json`);
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    return data.messages ?? data.records ?? [];
  } catch {
    return text.split("\n").filter(Boolean).map(line => ({ text: line }));
  }
}

export async function postSigned(room: string, body: { did:string; sig:string; nonce:string; text:string }) {
  return request(`/r/${encodeURIComponent(room)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function getNote(ns: string, key: string) {
  return request(`/kv/${encodeURIComponent(ns)}/${encodeURIComponent(key)}`);
}

export async function setNote(ns: string, key: string, value: string) {
  return request(`/kv/${encodeURIComponent(ns)}/${encodeURIComponent(key)}/set/${encodeURIComponent(value)}`);
}

export async function getAgentInfo() {
  return request("/.well-known/agent.json");
}