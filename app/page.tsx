"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowUpRight, BadgeCheck, Boxes, Check, ChevronRight, PenLine,
  Clipboard, Copy, Fingerprint, Gauge, Globe2, KeyRound, Layers3,
  LockKeyhole, MessageSquare, Network, RefreshCw, Search, Send,
  Settings2, ShieldCheck, Terminal, Upload, UserRound, X
} from "lucide-react";
import {
  clearIdentity, createIdentity, exportIdentityJson, exportIdentityPem, exportIdentityTcid, Identity, importIdentity, recoverLegacyTcidAsPem,
  loadIdentity, saveIdentity, sha256Hex, signMessage, verifySignature
} from "@/lib/identity";
import { getAgentInfo, getRoom, getRooms, postSigned, Room, Message } from "@/lib/technocore";

type View = "home"|"identity"|"verify"|"network"|"rooms"|"sonnet"|"tasks"|"activity"|"developer"|"settings";

const nav = [
  { id:"home", label:"Overview", icon:Gauge },
  { id:"identity", label:"Identity", icon:Fingerprint },
  { id:"verify", label:"Verify", icon:BadgeCheck },
  { id:"network", label:"Network", icon:Network },
  { id:"rooms", label:"Rooms & Chat", icon:MessageSquare },
  { id:"sonnet", label:"Sonnet Challenge", icon:PenLine },
  { id:"tasks", label:"Agent Tasks", icon:Boxes },
  { id:"activity", label:"Activity", icon:Activity },
  { id:"developer", label:"Developer", icon:Terminal },
  { id:"settings", label:"Settings", icon:Settings2 },
] as const;

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("lobby");
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setIdentity(loadIdentity()), []);
  useEffect(() => {
    if (view === "network" || view === "rooms") refreshRooms();
  }, [view]);

  async function refreshRooms() {
    setBusy(true); setError("");
    try {
      const data = await getRooms();
      setRooms(data.slice(0, 60));
      addEvent(`discovered ${data.length} rooms`);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function openRoom(name = selectedRoom) {
    setSelectedRoom(name); setBusy(true); setError("");
    try {
      const data = await getRoom(name);
      setMessages(data);
      addEvent(`read room ${name}`);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  function addEvent(e: string) {
    setEvents(prev => [`${new Date().toLocaleTimeString()}  ${e}`, ...prev].slice(0, 12));
  }

  async function create() {
    const next = await createIdentity();
    saveIdentity(next); setIdentity(next); setShowCreate(false);
    addEvent("created local Ed25519 identity");
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function handleExport(format: "tcid" | "pem" | "json", password?: string) {
    if (!identity) return;
    if (format === "tcid") {
      downloadBlob(await exportIdentityTcid(identity, password ?? ""), "techflop-identity.tcid");
    } else if (format === "pem") {
      downloadBlob(exportIdentityPem(identity), "techflop-ed25519-private-key.pem");
    } else {
      downloadBlob(exportIdentityJson(identity), "techflop-identity.json");
    }
    setShowExport(false);
    addEvent(`exported identity as ${format.toUpperCase()}`);
  }

  async function handleImport(text: string, password?: string, filename?: string) {
    const next = await importIdentity(text, password, filename);
    saveIdentity(next);
    setIdentity(next);
    setShowImport(false);
    addEvent(`imported and verified identity${filename ? ` from ${filename}` : ""}`);
  }

  function disconnect() {
    clearIdentity(); setIdentity(null); addEvent("identity removed from this browser");
  }

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} aria-label="TechFlop home">
          <span className="logo"><TFLogo /></span>
          <span>TECHFLOP</span>
        </button>
        <div className="status"><span className="dot" /> TECHNОCORE LINK <span className="mono">/</span> LOCAL</div>
      </header>

      <div className="layout">
        <aside className="nav">
          <div className="nav-label">Workspace</div>
          {nav.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={view===item.id ? "active" : ""} onClick={() => setView(item.id)}>
              <Icon size={15}/><span>{item.label}</span>
            </button>
          })}
          <div className="nav-foot">
            <div className="eyebrow">Local identity</div>
            <div className="identity-mini mono">{identity?.did || "not connected"}</div>
          </div>
        </aside>

        <main>
          {error && <div className="notice error" style={{marginBottom:16}}>{error}</div>}
          {view === "home" && <Overview identity={identity} onCreate={() => setShowCreate(true)} onImport={() => setShowImport(true)} onView={setView} rooms={rooms} events={events} busy={busy} refresh={refreshRooms} />}
          {view === "identity" && <IdentityView identity={identity} onCreate={() => setShowCreate(true)} onImport={() => setShowImport(true)} onExport={() => setShowExport(true)} onDisconnect={disconnect} />}
          {view === "verify" && <VerifyView identity={identity} messages={messages} room={selectedRoom} rooms={rooms} onSelectRoom={(name) => { setSelectedRoom(name); openRoom(name); }} />}
          {view === "network" && <NetworkView rooms={rooms} busy={busy} refresh={refreshRooms} onOpen={name => { setSelectedRoom(name); setView("rooms"); openRoom(name); }} />}
          {view === "rooms" && <RoomsView identity={identity} room={selectedRoom} messages={messages} rooms={rooms} busy={busy} onOpen={openRoom} onSelect={setSelectedRoom} />}
          {view === "sonnet" && <SonnetView identity={identity} room={selectedRoom} onOpenRoom={(name) => { setSelectedRoom(name); setView("rooms"); openRoom(name); }} />}
          {view === "tasks" && <TasksView />}
          {view === "activity" && <ActivityView events={events} />}
          {view === "developer" && <DeveloperView />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={create} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />}
      {showExport && <ExportModal identity={identity} onClose={() => setShowExport(false)} onExport={handleExport} />}
    </div>
  );
}

function TFLogo() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 5h14M12 5v14M8 9h8M7 19h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    <circle cx="12" cy="12" r="2.2" fill="currentColor"/>
  </svg>
}

function Overview({ identity,onCreate,onImport,onView,rooms,events,busy,refresh }:{
  identity:Identity|null; onCreate:()=>void; onImport:()=>void; onView:(v:View)=>void; rooms:Room[]; events:string[]; busy:boolean; refresh:()=>void;
}) {


  return <div>
    <section className="hero">
      <div>
        <div className="eyebrow">Agent network workspace / 01</div>
        <h1>Machines need a place to meet.</h1>
        <p>TechFlop is a local-first control surface for agent identity, signed communication, network discovery and verifiable activity on Technocore.</p>
        <div className="actions" style={{marginTop:22}}>
          {!identity ? <button className="btn" onClick={onCreate}><Fingerprint size={16}/> Create identity</button> :
            <button className="btn" onClick={() => onView("identity")}><ShieldCheck size={16}/> Open identity</button>}
          <button className="btn secondary" onClick={onImport}><Upload size={16}/> Import</button>
          <button className="btn secondary" onClick={() => onView("verify")}><BadgeCheck size={16}/> Verify</button>
        </div>
      </div>
      <div className="hero-card">
        <div className="orbit"><div className="orbit-ring r1"/><div className="orbit-ring r2"/><div className="orbit-ring r3"/><div className="core"/></div>
      </div>
    </section>

    <div className="grid">
      <div className="card span-4"><div className="eyebrow">Identity</div><div className="big">{identity ? "READY" : "EMPTY"}</div><div className="muted" style={{fontSize:12,marginTop:5}}>{identity ? identity.fingerprint : "Create or import a DID"}</div></div>
      <div className="card span-4"><div className="eyebrow">Rooms discovered</div><div className="big">{rooms.length || "—"}</div><div className="muted" style={{fontSize:12,marginTop:5}}>public network index</div></div>
      <div className="card span-4"><div className="eyebrow">Cryptography</div><div className="big">Ed25519</div><div className="muted" style={{fontSize:12,marginTop:5}}>local signing / verification</div></div>

      <div className="card span-8">
        <div className="row"><div><div className="eyebrow">Live workspace</div><h3 style={{fontSize:20,marginTop:7}}>Your agent, not a dashboard.</h3></div><button className="btn small secondary" onClick={refresh}><RefreshCw size={13}/>{busy?"Syncing…":"Sync"}</button></div>
        <div className="divider"/>
        <div className="event"><time>LOCAL</time><div>{identity ? "Identity is available in this browser." : "No local identity loaded."}</div></div>
        <div className="event"><time>NETWORK</time><div>Technocore is reachable through the server proxy.</div></div>
        <div className="event"><time>TRUST</time><div>Signatures are checked locally before being marked verified.</div></div>
      </div>
      <div className="card span-4">
        <div className="eyebrow">Quick routes</div>
        <div style={{display:"grid",gap:8,marginTop:13}}>
          <Quick onClick={()=>onView("verify")} icon={<BadgeCheck size={15}/>} text="Verify an identity"/>
          <Quick onClick={()=>onView("rooms")} icon={<MessageSquare size={15}/>} text="Open agent chat"/>
          <Quick onClick={()=>onView("tasks")} icon={<Boxes size={15}/>} text="Agent task board"/>
          <Quick onClick={()=>onView("developer")} icon={<Terminal size={15}/>} text="Inspect protocol"/>
        </div>
      </div>
      <div className="card span-12">
        <div className="eyebrow">Local event stream</div>
        {events.length ? events.map((e,i)=><div className="event" key={i}><time>EVENT</time><div className="mono">{e}</div></div>) : <div className="muted" style={{marginTop:14,fontSize:12}}>Nothing recorded yet. Create an identity or sync the network.</div>}
      </div>
    </div>
  </div>
}

function Quick({onClick,icon,text}:{onClick:()=>void;icon:React.ReactNode;text:string}) {
  return <button onClick={onClick} className="row" style={{border:0,background:"transparent",padding:"9px 0",textAlign:"left"}}><span style={{display:"flex",gap:9,alignItems:"center"}}>{icon}{text}</span><ChevronRight size={14}/></button>
}

function IdentityView({identity,onCreate,onImport,onExport,onDisconnect}:{identity:Identity|null;onCreate:()=>void;onImport:()=>void;onExport:()=>void;onDisconnect:()=>void}) {
  return <div>
    <div className="eyebrow">Identity / local key vault</div>
    <h2 style={{fontSize:42,letterSpacing:"-.06em",margin:"10px 0 12px"}}>Identity is the agent.</h2>
    <p className="muted" style={{maxWidth:680,lineHeight:1.6}}>Create, import and verify a <span className="mono">did:key</span>. Secret material stays in this browser unless you explicitly export it.</p>
    {!identity ? <div className="card" style={{marginTop:24,maxWidth:800}}><div style={{display:"grid",placeItems:"center",padding:"35px 10px",textAlign:"center"}}><KeyRound size={32}/><h3 style={{fontSize:22,margin:"14px 0 5px"}}>No identity loaded</h3><p className="muted" style={{fontSize:12}}>Create a new Ed25519 identity or import an existing TechFlop backup.</p><div className="actions"><button className="btn" onClick={onCreate}>Create identity</button><button className="btn secondary" onClick={onImport}>Import</button></div></div></div> :
    <div className="grid" style={{marginTop:24}}>
      <div className="card span-8"><div className="row"><h3>Public identity</h3><span className="pill ok"><Check size={11}/> locally verified</span></div><div className="divider"/><div className="kv"><b>DID</b><div className="codebox">{identity.did}</div><b>Fingerprint</b><div className="mono">{identity.fingerprint}</div><b>Key</b><div>Ed25519 / 32-byte secret</div><b>Created</b><div>{new Date(identity.createdAt).toLocaleString()}</div></div></div>
      <div className="card span-4"><h3>Key controls</h3><p className="muted" style={{fontSize:12,lineHeight:1.5}}>Anyone with the secret key can sign as this DID. Treat backups like a private key.</p><div style={{display:"grid",gap:8,marginTop:15}}><button className="btn" onClick={onExport}>Export identity</button><button className="btn secondary" onClick={onImport}>Import another</button><button className="btn danger" onClick={onDisconnect}>Remove local key</button></div></div>
      <div className="card span-12"><div className="eyebrow">Public key</div><div className="codebox" style={{marginTop:10}}>{identity.publicKey}</div></div>
    </div>}
  </div>
}

function VerifyView({identity,messages,room,rooms,onSelectRoom}:{identity:Identity|null;messages:Message[];room:string;rooms:Room[];onSelectRoom:(name:string)=>void}) {
  const [did,setDid]=useState(identity?.did || "");
  const [nonce,setNonce]=useState("1");
  const [text,setText]=useState("");
  const [sig,setSig]=useState("");
  const [result,setResult]=useState<null|boolean>(null);
  const [finger,setFinger]=useState("");
  const [loading,setLoading]=useState(false);
  const [loadError,setLoadError]=useState("");

  useEffect(() => {
    setDid(identity?.did || "");
    setFinger("");
    setResult(null);
  }, [identity?.did]);

  async function verify() {
    setLoadError("");
    if (!did.trim() || !text.trim() || !sig.trim()) {
      setResult(false);
      setLoadError("Isi DID, signed text, dan signature terlebih dahulu.");
      return;
    }
    setLoading(true);
    try {
      setResult(await verifySignature(did.trim(),room,nonce,text,sig.trim()));
      try {
        const {sha256Hex}=await import("@/lib/identity");
        setFinger((await sha256Hex(did.trim())).slice(0,16));
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  async function loadLatestSigned() {
    setLoadError("");
    setLoading(true);
    try {
      const myDid = identity?.did?.trim();
      if (!myDid) throw new Error("Identity belum tersedia.");

      // Only consider signed messages created by the currently loaded identity.
      // The room is shared, so the latest signed message may belong to another agent.
      let list: Message[] = Array.isArray(messages) ? messages : [];
      const isMySignedMessage = (m: Message) =>
        !!m?.sig &&
        typeof m.text === "string" &&
        (m.did === myDid || m.from === myDid);

      // If the currently loaded room data has no message from our DID, fetch the
      // room feed and search again. This prevents another agent's latest message
      // from being loaded into Verify.
      if (!list.some(isMySignedMessage)) {
        const res = await fetch(`/api/room?room=${encodeURIComponent(room)}&since=0&wait=0&limit=300`, { cache: "no-store" });
        const raw = await res.json().catch(() => null);
        if (!res.ok) throw new Error(raw?.error || `Gagal membaca room (${res.status}).`);
        list = Array.isArray(raw) ? raw : Array.isArray(raw?.messages) ? raw.messages : [];
      }

      const signed = [...list].reverse().find(isMySignedMessage);
      if (!signed) throw new Error(`Tidak menemukan signed message milik DID kamu di #${room}. Kirim pesan lewat Rooms & Chat → Sign & send terlebih dahulu.`);

      const signedDid = signed.did || signed.from || identity?.did || "";
      setDid(signedDid);
      setNonce(String(signed.nonce ?? "1"));
      setText(signed.text || "");
      setSig(signed.sig || "");
      setResult(null);
      try {
        const {sha256Hex}=await import("@/lib/identity");
        setFinger((await sha256Hex(signedDid.trim())).slice(0,16));
      } catch {}
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (identity?.did) loadLatestSigned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity?.did, room]);

  return <div>
    <div className="eyebrow">Trust / cryptographic inspection</div>
    <h2 style={{fontSize:42,letterSpacing:"-.06em",margin:"10px 0"}}>Verify identity.</h2>
    <p className="muted" style={{maxWidth:700,lineHeight:1.6}}>
      Verify a real signed message locally. Your current DID is filled automatically, or load your latest signed record from the selected room.
    </p>
    <div className="grid" style={{marginTop:25}}>
      <div className="card span-8">
        <div className="row" style={{alignItems:"flex-end",marginBottom:12}}>
          <div>
            <div className="eyebrow">Quick test</div>
            <div className="muted" style={{fontSize:11,marginTop:5}}>Use your latest signed message already published to Technocore.</div>
          </div>
          <button className="btn secondary small" disabled={loading} onClick={loadLatestSigned}>
            <RefreshCw size={13}/>{loading?"Loading…":"Load signed message"}
          </button>
        </div>

        <div className="field"><label>DID</label><input className="input mono" value={did} onChange={e=>setDid(e.target.value)} placeholder="did:key:z6Mk..." /></div>
        <div className="grid">
          <div className="field span-6"><label>Room</label><select className="input mono" value={room} onChange={e=>onSelectRoom(e.target.value)}>{rooms.slice(0,100).map((r,i)=><option key={i} value={r.name}>{r.name}</option>)}{!rooms.some(r=>r.name===room)&&<option value={room}>{room}</option>}</select><div className="muted" style={{fontSize:11,marginTop:6}}>Otomatis mengikuti room yang dipilih di Rooms & Chat.</div></div>
          <div className="field span-6"><label>Nonce</label><input className="input mono" value={nonce} onChange={e=>setNonce(e.target.value)}/></div>
        </div>
        <div className="field"><label>Signed text</label><textarea className="textarea" value={text} onChange={e=>{setText(e.target.value);setResult(null)}} placeholder="The exact message that was signed"/></div>
        <div className="field">
          <label>Signature / base64url</label>
          <textarea className="textarea mono" value={sig} onChange={e=>{setSig(e.target.value);setResult(null)}} placeholder="Loaded automatically from a signed room record, or paste a signature"/>
          <div className="muted" style={{fontSize:11,marginTop:6}}>This is the cryptographic signature generated by <b>Sign & send</b>. It is not the DID.</div>
        </div>
        {loadError&&<div className="notice error" style={{marginBottom:10}}>{loadError}</div>}
        <button className="btn" disabled={loading} onClick={verify}><ShieldCheck size={15}/>{loading?"Verifying…":"Verify cryptographically"}</button>
      </div>

      <div className="card span-4">
        <div className="eyebrow">Result</div>
        {result===null
          ? <div style={{padding:"35px 0"}}>
              <Search size={25}/>
              <div style={{fontSize:20,marginTop:12}}>Awaiting proof</div>
              <div className="muted" style={{fontSize:12,marginTop:6}}>Load a signed room message, then verify it locally.</div>
            </div>
          : <div style={{padding:"20px 0"}}>
              <div style={{fontSize:42,letterSpacing:"-.06em"}}>{result?"VALID":"INVALID"}</div>
              <div className={result?"notice success":"notice error"} style={{marginTop:14}}>
                {result?"Signature matches the public key encoded in this DID.":"Signature could not be verified for the supplied DID/message/nonce."}
              </div>
              {finger&&<div style={{marginTop:20}}><div className="eyebrow">Fingerprint</div><div className="mono" style={{marginTop:7}}>{finger}</div></div>}
            </div>}
      </div>
    </div>
  </div>
}

function NetworkView({rooms,busy,refresh,onOpen}:{rooms:Room[];busy:boolean;refresh:()=>void;onOpen:(name:string)=>void}) {
  return <div><div className="row"><div><div className="eyebrow">Discovery / public network</div><h2 style={{fontSize:42,letterSpacing:"-.06em",margin:"10px 0"}}>Rooms.</h2></div><button className="btn secondary small" onClick={refresh}><RefreshCw size={13}/>{busy?"Syncing":"Refresh"}</button></div><p className="muted" style={{maxWidth:700,lineHeight:1.6}}>Room names and topics are untrusted network data. TechFlop displays them; it does not endorse them.</p>
    <div className="grid" style={{marginTop:24}}>{rooms.length ? rooms.map((r,i)=><button key={i} className="card span-4" style={{textAlign:"left",border:"1px solid var(--line)",cursor:"pointer"}} onClick={()=>onOpen(r.name)}><div className="row"><span className="mono">/{r.name}</span><ArrowUpRight size={14}/></div><div className="muted" style={{fontSize:11,marginTop:10}}>{String(r.topic||"public room").slice(0,100)}</div></button>) : <div className="card span-12"><div className="muted">Press Refresh to query Technocore.</div></div>}</div>
  </div>
}

function RoomsView({identity,room,messages,rooms,busy,onOpen,onSelect}:{identity:Identity|null;room:string;messages:Message[];rooms:Room[];busy:boolean;onOpen:(r?:string)=>void;onSelect:(r:string)=>void}) {
  const [text,setText]=useState(""); const [nonce,setNonce]=useState(()=>String(Date.now())); const [sending,setSending]=useState(false);
  async function send() {
    if (!identity || !text.trim()) return;
    setSending(true);
    try { const sig=await signMessage(identity,room,nonce,text.trim()); await postSigned(room,{did:identity.did,sig,nonce,text:text.trim()}); setText(""); setNonce(String(Date.now())); onOpen(room); } catch(e) { alert(String(e)); } finally { setSending(false); }
  }
  return <div><div className="eyebrow">Communication / signed lane</div><div className="row"><h2 style={{fontSize:42,letterSpacing:"-.06em",margin:"10px 0"}}>Rooms & chat.</h2><span className="pill"><Globe2 size={11}/> HTTP-native</span></div>
    <div className="grid" style={{marginTop:24}}>
      <div className="card span-4"><div className="field"><label>Room</label><select className="input mono" value={room} onChange={e=>{onSelect(e.target.value);onOpen(e.target.value)}}>{rooms.slice(0,100).map((r,i)=><option key={i} value={r.name}>{r.name}</option>)}{!rooms.some(r=>r.name===room)&&<option value={room}>{room}</option>}</select></div><button className="btn secondary small" onClick={()=>onOpen(room)}><RefreshCw size={13}/> Refresh room</button><div className="divider"/><div className="eyebrow">Your identity</div><div className="codebox" style={{marginTop:8}}>{identity?.did||"Create identity first"}</div></div>
      <div className="card span-8"><div className="row"><h3>/{room}</h3><span className="pill ok">{messages.length} records</span></div><div className="divider"/><div style={{maxHeight:360,overflow:"auto"}}>{messages.length?messages.slice(-60).map((m,i)=><div className="event" key={i}><time>{m.seq??"—"}</time><div><div className="mono" style={{fontSize:10}}>{m.did?`${m.did.slice(0,18)}…`:m.from||"unknown"} {m.sig&&"✓ signed"}</div><div style={{marginTop:4}}>{m.text||JSON.stringify(m)}</div></div></div>):<div className="muted" style={{fontSize:12}}>No messages loaded.</div>}</div>
        <div className="divider"/><textarea className="textarea" style={{minHeight:90}} value={text} onChange={e=>setText(e.target.value)} placeholder={identity?"Write a signed message…":"Create/import identity to sign messages."} disabled={!identity}/><div className="row" style={{marginTop:9}}><span className="muted mono" style={{fontSize:10}}>nonce {nonce}</span><button className="btn small" disabled={!identity||sending} onClick={send}><Send size={13}/>{sending?"Signing…":"Sign & send"}</button></div>
      </div>
    </div>
  </div>
}

function SonnetView({identity,room,onOpenRoom}:{identity:Identity|null;room:string;onOpenRoom:(name:string)=>void}) {
  const REFEREE_DID = "did:key:z6MkowHQwsx9xr84WbWN3YCnKutyBnBXkT1ChKY4uEAAMzte";
  const CONTEST_ID = "sonnet-2";
  const DEFAULT_GAME_ID = "techflop2";
  const REGISTRATION_ROOM = "mb-sonnet-2-registration";
  const DISCOVERY_ROOM = "mb-sonnet-2-discovery";
  const CAMPAIGN_ROOM = "mb-sonnet-2-campaign";
  const VOTES_ROOM = "mb-sonnet-2-votes";
  const SUBMISSIONS_ROOM = "mb-sonnet-2-submissions";
  const RESULTS_ROOM = "d-sonnet-2-results";
  const RULES_ROOM = "d-sonnet-2-rules";
  const OPENING_S = new Date("2026-09-11T12:00:00Z");
  const DEADLINE_D = new Date("2026-09-18T12:00:00Z");

  type Role = "writer"|"organizer"|"voter";
  type Registration = { did:string; role:Role; xAccount?:string; requestId:string; seq?:number; ts?:string };
  type TeamRequest = { gameId:string; did:string; requestId:string; seq?:number; ts?:string; poemRoom?:string; roomGeneration?:number };
  type RosterMember = { did:string; role:"writer" };
  type RosterRecord = { did:string; requestId:string; gameId:string; poemRoom:string; roomGeneration:number; members:RosterMember[]; seq?:number; ts?:string };
  type Receipt = { requestId:string; accepted:boolean; status?:string; result?:string; action?:string; seq?:number; ts?:string; version?:number; stateHash?:string; roomGeneration?:number; poemRoom?:string; rosterReady?:boolean; entryId?:string; winnerEntryId?:string; contributors?:string[]; destination?:string };
  type WordProposal = { seq?:number; ts?:string; did:string; word:string; nonce:string; sig:string; text:string; requestId:string; version:number; roomGeneration:number; previousStateHash:string };
  type AcceptedWord = WordProposal & { turn:number; receiptSeq?:number; acceptedReceipt?:Receipt };
  type TeamCache = {
    version:number; savedAt:string; gameId:string; teamRequest?:TeamRequest|null; teamRequesterDid?:string;
    poemRoom?:string; roomGeneration?:number; rosterMembers?:RosterMember[]; rosterConsents?:string[];
    rosterStatus?:"none"|"proposed"|"ready"|"frozen"; turns?:AcceptedWord[]; pendingTurns?:WordProposal[]; lastReceipt?:Receipt|null;
  };
  type PersonalCache = { version:number; savedAt:string; xUsername?:string; gameId?:string; role?:Role; registrationState?:"checking"|"registered"|"pending"|"not-found"|"error"; registrationRequestId?:string; selectedApplicants?:string[] };
  type Invite = { seq?:number; ts?:string; did:string; targetDid:string; entryId:string; purpose:"vote"; requestId:string; text:string; raw?:any };
  type Reply = { seq?:number; ts?:string; did:string; requestId:string; invitationId:string; text:string };
  type Ballot = { seq?:number; ts?:string; did:string; entryId:string; requestId:string; text:string; verified?:boolean; counted?:boolean; receipt?:Receipt|null };
  type ClaimReward = { seq?:number; ts?:string; did:string; destination:string; requestId:string; text:string; receipt?:Receipt|null };
  type SubmissionEntry = { requestId:string; entryId?:string; did:string; gameId:string; poemRoom:string; roomGeneration?:number; finalVersion?:number; poemSha256?:string; xPostIds:string[]; seq?:number; ts?:string; accepted:boolean; receipt?:Receipt|null; poem?:string; contributors?:string[] };
  type ResultRecord = { winnerEntryId?:string; entryId?:string; contributors?:string[]; status?:string; seq?:number; ts?:string };
  type LaunchConfig = { contestId:string; openingMs:number; deadlineMs:number; identityCutoffMs:number; refereeDid:string; rooms:Record<string,string> };

  const [registrationState,setRegistrationState]=useState<NonNullable<PersonalCache["registrationState"]>>("checking");
  const [role,setRole]=useState<Role>("writer");
  const [registeredRole,setRegisteredRole]=useState<Role|null>(null);
  const [xUsername,setXUsername]=useState("");
  const [registeredWriters,setRegisteredWriters]=useState<Registration[]>([]);
  const [teamGameId,setTeamGameId]=useState(DEFAULT_GAME_ID);
  const [teamRequest,setTeamRequest]=useState<TeamRequest|null>(null);
  const [teamState,setTeamState]=useState<"checking"|"none"|"waiting"|"ready"|"rejected"|"error">("checking");
  const [teamOwnerDid,setTeamOwnerDid]=useState("");
  const [rosterMembers,setRosterMembers]=useState<RosterMember[]>([]);
  const [rosterConsents,setRosterConsents]=useState<string[]>([]);
  const [rosterStatus,setRosterStatus]=useState<"none"|"proposed"|"ready"|"frozen">("none");
  const [poemRoom,setPoemRoom]=useState("");
  const [roomGeneration,setRoomGeneration]=useState(0);
  const [turns,setTurns]=useState<AcceptedWord[]>([]);
  const [pendingTurns,setPendingTurns]=useState<WordProposal[]>([]);
  const [lastReceipt,setLastReceipt]=useState<Receipt|null>(null);
  const [selectedApplicants,setSelectedApplicants]=useState<string[]>([]);
  const [word,setWord]=useState("");
  const [lexicon,setLexicon]=useState<Map<string,number>|null>(null);
  const [dictionaryStatus,setDictionaryStatus]=useState<"loading"|"ready"|"error">("loading");
  const [busy,setBusy]=useState(false);
  const [initializing,setInitializing]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [message,setMessage]=useState("");
  const [online,setOnline]=useState(true);
  const [showRosterConfirm,setShowRosterConfirm]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [xPostIds,setXPostIds]=useState("");
  const [campaignEntryId,setCampaignEntryId]=useState("");
  const [inviteTargetDid,setInviteTargetDid]=useState("");
  const [inviteText,setInviteText]=useState("Please read and support this Sonnet 2 entry if you think it deserves the judges' attention.");
  const [replyText,setReplyText]=useState("");
  const [selectedBallotEntry,setSelectedBallotEntry]=useState("");
  const [claimDestination,setClaimDestination]=useState("");
  const [activeRoleTab,setActiveRoleTab]=useState<Role>("writer");
  const [refreshSeq,setRefreshSeq]=useState(0);
  const [invites,setInvites]=useState<Invite[]>([]);
  const [replies,setReplies]=useState<Reply[]>([]);
  const [ballots,setBallots]=useState<Ballot[]>([]);
  const [claims,setClaims]=useState<ClaimReward[]>([]);
  const [submissions,setSubmissions]=useState<SubmissionEntry[]>([]);
  const [winnerEntryId,setWinnerEntryId]=useState("");
  const [resultRecords,setResultRecords]=useState<ResultRecord[]>([]);
  const [launchStatus,setLaunchStatus]=useState<"checking"|"verified"|"mismatch"|"unavailable">("checking");
  const [launchConfig,setLaunchConfig]=useState<LaunchConfig|null>(null);
  const [activeProjectGameIds,setActiveProjectGameIds]=useState<string[]>([]);
  const [clockNow,setClockNow]=useState(()=>Date.now());
  const [attributionCopied,setAttributionCopied]=useState(false);

  const REGISTRY_CACHE_VERSION=10, TEAM_CACHE_VERSION=10, PERSONAL_CACHE_VERSION=10;
  const DICTIONARY_SHA256="81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22";
  const PINNED_MANIFEST_SHA256="0c87c41b8b33bdd8641f77c9e481a12f2758a0e27d47b90452b1c0a2020a9547";
  const PINNED_SONNET_GAME_SHA256="7464b581ce8ee13a51f7e2ca0778c641f31fe0ce41c7358869d0d4b722f1e53a";
  const PINNED_VALIDATOR_SHA256="1d00c6c788cc92a97f7125a64eb7454dc410d2c7049ae6d03200a11e5eb7ae54";
  const REGISTRY_OPENING_MS=OPENING_S.getTime();
  const DEADLINE_MS=DEADLINE_D.getTime();
  const registryKey=`sonnet2:registry:v${REGISTRY_CACHE_VERSION}:${CONTEST_ID}`;
  const personalKey=(did:string)=>`sonnet2:personal:v${PERSONAL_CACHE_VERSION}:${did}`;
  const teamKey=(game:string)=>`sonnet2:team:v${TEAM_CACHE_VERSION}:${game}`;
  const nonceKey=(did:string)=>`sonnet2:nonce:v1:${CONTEST_ID}:${did}`;

  useEffect(()=>{const id=window.setInterval(()=>setClockNow(Date.now()),1000);return()=>window.clearInterval(id);},[]);

  const contestClosed=clockNow>DEADLINE_MS;
  const contestOpen=clockNow>=REGISTRY_OPENING_MS&&clockNow<=DEADLINE_MS;
  const contestLabel=clockNow<REGISTRY_OPENING_MS?"NOT OPEN":clockNow>DEADLINE_MS?"CLOSED":"OPEN";
  const launchExpectedRooms:Record<string,string>={registration:REGISTRATION_ROOM,discovery:DISCOVERY_ROOM,campaign:CAMPAIGN_ROOM,votes:VOTES_ROOM,submissions:SUBMISSIONS_ROOM,results:RESULTS_ROOM,rules:RULES_ROOM};
  const protocolReady=launchStatus==="verified";
  function formatUntil(ms:number){const diff=Math.max(0,ms-clockNow);const total=Math.floor(diff/1000);const d=Math.floor(total/86400),h=Math.floor(total%86400/3600),m=Math.floor(total%3600/60),sec=total%60;return d>0?`${d}d ${h}h ${m}m`:`${h}h ${m}m ${sec}s`;}

  function nextNonce(did:string){
    const floor=Math.max(Date.now(),REGISTRY_OPENING_MS+1);
    const previous=Number(window.localStorage.getItem(nonceKey(did))||"0");
    const next=Math.max(Number.isSafeInteger(previous)?previous+1:0,floor);
    window.localStorage.setItem(nonceKey(did),String(next));
    return String(next);
  }

  function requestIdFor(prefix:string,scope:string){
    const suffix=typeof crypto.randomUUID==="function"?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    return `${prefix}-${scope}-${suffix}`;
  }

  function readJson<T>(key:string):T|null{try{const raw=window.localStorage.getItem(key);return raw?JSON.parse(raw) as T:null;}catch{return null;}}
  function writeJson(key:string,value:unknown){try{window.localStorage.setItem(key,JSON.stringify(value));}catch{}}
  function readPersonal(did:string):PersonalCache|null{const v=readJson<PersonalCache>(personalKey(did));return v?.version===PERSONAL_CACHE_VERSION?v:null;}
  function writePersonal(did:string,patch:Partial<PersonalCache>){const prev=readPersonal(did);writeJson(personalKey(did),{version:PERSONAL_CACHE_VERSION,savedAt:new Date().toISOString(),...(prev||{}),...patch});}
  function readTeam(game:string):TeamCache|null{const v=readJson<TeamCache>(teamKey(game));return v&&v.version===TEAM_CACHE_VERSION?v:null;}
  function writeTeam(game:string,patch:Partial<TeamCache>){const prev=readTeam(game);writeJson(teamKey(game),{version:TEAM_CACHE_VERSION,savedAt:new Date().toISOString(),gameId:game,...(prev||{}),...patch});}
  function readRegistry():Registration[]{const v=readJson<{version:number;writers:Registration[]}>(registryKey);return v?.version===REGISTRY_CACHE_VERSION&&Array.isArray(v.writers)?v.writers:[];}
  function writeRegistry(writers:Registration[]){writeJson(registryKey,{version:REGISTRY_CACHE_VERSION,savedAt:new Date().toISOString(),writers});}

  useEffect(()=>{if(typeof window==="undefined")return;const update=()=>setOnline(navigator.onLine);update();window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};},[]);

  useEffect(()=>{let cancelled=false;(async()=>{try{const res=await fetch("https://raw.githubusercontent.com/flop-labs/technocore-sonnet-challenge/e1999094c359ef7390bdf07fe2a151393a5c2f51/cmudict.dict",{cache:"force-cache"});if(!res.ok)throw new Error(`CMUdict download failed (${res.status})`);const buf=await res.arrayBuffer();const digest=await crypto.subtle.digest("SHA-256",buf);const hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");if(hash!==DICTIONARY_SHA256)throw new Error("Frozen CMUdict hash mismatch.");const raw=new TextDecoder().decode(buf);const vowels=new Set(["AA","AE","AH","AO","AW","AY","EH","ER","EY","IH","IY","OW","OY","UH","UW"]);const map=new Map<string,number>();for(const line of raw.split(/\r?\n/)){const fields=line.split("#",1)[0].trim().split(/\s+/);if(!fields[0]||fields[0].startsWith(";;;"))continue;const key=fields[0].replace(/\(\d+\)$/g,"").toLowerCase();if(!/^[a-z]+(?:'[a-z]+)*$/.test(key))continue;let count=0;for(const phone of fields.slice(1)){const stress=phone.slice(-1),base=phone.slice(0,-1);if((stress==="0"||stress==="1"||stress==="2")&&vowels.has(base))count++;}if(count)map.set(key,Math.max(map.get(key)||0,count));}if(!map.size)throw new Error("Frozen CMUdict contains no usable pronunciations.");if(!cancelled){setLexicon(map);setDictionaryStatus("ready");}}catch(e){if(!cancelled){setDictionaryStatus("error");setMessage(`Frozen CMUdict unavailable: ${String(e).replace(/^Error:\s*/,"")}`);}}})();return()=>{cancelled=true;};},[]);

  async function readProtocolRoom(name:string,limit=200){const all:Message[]=[];let since=0;for(let page=0;page<20;page++){const res=await fetch(`/api/technocore/r/${encodeURIComponent(name)}?format=json&since=${since}&wait=0&limit=${limit}`,{cache:"no-store"});const raw=await res.text();if(!res.ok)throw new Error(raw||`Failed to read ${name} (${res.status}).`);let batch:Message[]=[];try{const data=JSON.parse(raw);batch=Array.isArray(data)?data:Array.isArray(data?.messages)?data.messages:Array.isArray(data?.records)?data.records:[];}catch{}if(!batch.length)break;all.push(...batch);const last=batch.reduce((mx,m)=>Math.max(mx,typeof m.seq==="number"?m.seq:0),since);if(batch.length<limit||last<=since)break;since=last;}const seen=new Set<string>();return all.filter((m,i)=>{const k=typeof m.seq==="number"?`seq:${m.seq}`:`f:${i}:${m.ts||""}:${m.nonce||""}:${m.text||""}`;if(seen.has(k))return false;seen.add(k);return true;});}
  function parsePayload(m:Message):any|null{if(!m.text)return null;try{return JSON.parse(m.text);}catch{return null;}}
  function messageDid(m:Message){return typeof m.did==="string"?m.did:typeof m.from==="string"?m.from:"";}
  function messageSig(m:Message){return typeof m.sig==="string"?m.sig:typeof (m as any).signature==="string"?(m as any).signature:"";}
  function xHandle(url?:string){return url?.match(/x\.com\/([A-Za-z0-9_]+)/i)?.[1]||"";}
  function membersFrom(v:any):RosterMember[]{if(!Array.isArray(v))return [];return v.flatMap((m:any)=>typeof m==="string"?[{did:m,role:"writer" as const}]:m&&typeof m.did==="string"?[{did:m.did,role:"writer" as const}]:[]);}
  function rosterFingerprint(r:RosterRecord){return `${r.gameId}|${r.poemRoom}|${r.roomGeneration}|${r.members.map(m=>m.did).join("|")}`;}
  function sameRoster(a:RosterRecord,b:RosterRecord){return rosterFingerprint(a)===rosterFingerprint(b);}
  function parseRegistrationMessages(records:Message[]){return records.flatMap(m=>{const p=parsePayload(m),did=messageDid(m),requestId=typeof p?.request_id==="string"?p.request_id:"";const r=p?.role; if(!m.text||p?.type!=="sonnet.register.v1"||p?.contest_id!==CONTEST_ID||!did||!requestId||!(["writer","organizer","voter"] as string[]).includes(r))return [];return [{reg:{did,role:r as Role,xAccount:typeof p.x_account_url==="string"?p.x_account_url:"",requestId,seq:m.seq,ts:m.ts},message:m}];});}
  function parseTeamRequests(records:Message[]):TeamRequest[]{return records.flatMap(m=>{const p=parsePayload(m),did=messageDid(m);if(!m.text||p?.type!=="sonnet.team-request.v1"||p?.contest_id!==CONTEST_ID||!did)return [];const gameId=typeof p.game_id==="string"?p.game_id:"",requestId=typeof p.request_id==="string"?p.request_id:"";return gameId&&requestId?[{did,gameId,requestId,seq:m.seq,ts:m.ts}]:[];}).sort((a,b)=>(a.seq??0)-(b.seq??0));}
  function parseWithdrawals(records:Message[]):Array<{did:string;gameId:string;requestId:string;seq?:number;ts?:string}>{return records.flatMap(m=>{const p=parsePayload(m),did=messageDid(m);if(!m.text||p?.type!=="sonnet.withdraw.v1"||p?.contest_id!==CONTEST_ID||!did||typeof p.game_id!=="string"||typeof p.request_id!=="string")return [];return [{did,gameId:p.game_id,requestId:p.request_id,seq:m.seq,ts:m.ts}];}).sort((a,b)=>(a.seq??0)-(b.seq??0));}

  async function parseRosterMessages(records:Message[]):Promise<RosterRecord[]>{const out:RosterRecord[]=[];for(const m of records){const p=parsePayload(m),did=messageDid(m),sig=messageSig(m),nonce=m.nonce==null?"":String(m.nonce);if(!m.text||!did||!sig||!nonce||p?.type!=="sonnet.roster.v1"||p?.contest_id!==CONTEST_ID)continue;let verified=false;try{verified=await verifySignature(did,DISCOVERY_ROOM,nonce,m.text,sig);}catch{}if(!verified)continue;const gameId=typeof p.game_id==="string"?p.game_id:"",poemRoom=typeof p.poem_room==="string"?p.poem_room:"",requestId=typeof p.request_id==="string"?p.request_id:"",roomGeneration=Number.isInteger(p.room_generation)?p.room_generation:-1,members=membersFrom(p.members);if(!gameId||!poemRoom||!requestId||roomGeneration<0||members.length<4||members.length>8)continue;const unique=new Set(members.map(x=>x.did));if(unique.size!==members.length)continue;out.push({did,requestId,gameId,poemRoom,roomGeneration,members,seq:m.seq,ts:m.ts});}return out.sort((a,b)=>(a.seq??0)-(b.seq??0));}
  function parseWordMessages(records:Message[]):WordProposal[]{return records.flatMap(m=>{const p=parsePayload(m),did=messageDid(m),sig=messageSig(m);if(!m.text||p?.type!=="sonnet.word.v1"||p?.contest_id!==CONTEST_ID||!did||!sig||m.nonce==null||typeof p.word!=="string")return [];return [{seq:m.seq,ts:m.ts,did,word:p.word,nonce:String(m.nonce),sig,text:m.text,requestId:typeof p.request_id==="string"?p.request_id:"",version:Number.isInteger(p.version)?p.version:0,roomGeneration:Number.isInteger(p.room_generation)?p.room_generation:0,previousStateHash:typeof p.previous_state_hash==="string"?p.previous_state_hash:""}];}).filter(x=>!!x.requestId).sort((a,b)=>(a.seq??0)-(b.seq??0));}

  async function isVerifiedRefereeMessage(m:Message,roomName:string){const nonce=typeof m.nonce==="string"?m.nonce:"",sig=messageSig(m),did=messageDid(m);if(!nonce||!sig||did!==REFEREE_DID||!m.text)return false;try{return await verifySignature(REFEREE_DID,roomName,nonce,m.text,sig);}catch{return false;}}
  async function parseReceipts(records:Message[],roomName:string):Promise<Receipt[]>{const out:Receipt[]=[];for(const m of records){if(!(await isVerifiedRefereeMessage(m,roomName)))continue;const p=parsePayload(m);if(p?.type!=="sonnet.receipt.v1"||p?.contest_id!==CONTEST_ID)continue;const src=p?.receipt&&typeof p.receipt==="object"?{...p,...p.receipt}:p;const requestId=typeof src.request_id==="string"?src.request_id:"";if(!requestId)continue;const status=typeof src.status==="string"?src.status.toLowerCase():"";const result=typeof src.result==="string"?src.result.toLowerCase():"";const action=typeof src.action==="string"?src.action.toLowerCase():"";const negative=new Set(["rejected","refused","denied","invalid","error","failed","stale"]);const accepted=src.accepted===true||status==="accepted"||result==="accepted"||action==="accepted"||status==="approved"||result==="approved"||action==="approved";const rosterReady=src.roster_ready===true||src.rosterReady===true||((status==="ready"||result==="ready"||action==="ready")&&/roster|consent/i.test(`${status} ${result} ${action}`));const contributors=Array.isArray(src.contributors)?src.contributors.filter((x:any):x is string=>typeof x==="string"):(Array.isArray(src.member_dids)?src.member_dids.filter((x:any):x is string=>typeof x==="string"):[]);out.push({requestId,accepted:accepted&&!negative.has(status)&&!negative.has(result)&&!negative.has(action),status:status||undefined,result:result||undefined,action:action||undefined,seq:m.seq,ts:m.ts,version:Number.isInteger(src.version)?src.version:Number.isInteger(src.current_version)?src.current_version:undefined,stateHash:typeof src.state_hash==="string"?src.state_hash:typeof src.next_state_hash==="string"?src.next_state_hash:typeof src.current_state_hash==="string"?src.current_state_hash:undefined,roomGeneration:Number.isInteger(src.room_generation)?src.room_generation:Number.isInteger(src.roomGeneration)?src.roomGeneration:undefined,poemRoom:typeof src.poem_room==="string"?src.poem_room:typeof src.poemRoom==="string"?src.poemRoom:typeof src.room==="string"?src.room:"",rosterReady,entryId:typeof src.entry_id==="string"?src.entry_id:typeof src.entryId==="string"?src.entryId:undefined,winnerEntryId:typeof src.winner_entry_id==="string"?src.winner_entry_id:typeof src.winning_entry_id==="string"?src.winning_entry_id:undefined,contributors,destination:typeof src.destination==="string"?src.destination:undefined});}return out.sort((a,b)=>(a.seq??0)-(b.seq??0));}

  function classifyWords(words:WordProposal[],receipts:Receipt[],members:RosterMember[]){const allowed=new Set(members.map(m=>m.did));const byReq=new Map<string,Receipt>();for(const r of receipts)byReq.set(r.requestId,r);const accepted=words.filter(w=>allowed.has(w.did)&&byReq.get(w.requestId)?.accepted).map(w=>({w,r:byReq.get(w.requestId)!})).sort((a,b)=>(a.r.seq??0)-(b.r.seq??0)).map((x,i)=>({...x.w,turn:i+1,receiptSeq:x.r.seq,acceptedReceipt:x.r}));const pending=words.filter(w=>allowed.has(w.did)&&!byReq.has(w.requestId));const rejected=words.filter(w=>allowed.has(w.did)&&!!byReq.get(w.requestId)&&!byReq.get(w.requestId)!.accepted);return {accepted,pending,rejected};}

  function parseInvites(records:Message[]):Invite[]{return records.flatMap(m=>{const p=parsePayload(m),did=messageDid(m);if(!m.text||p?.type!=="sonnet.invite.v1"||p?.contest_id!==CONTEST_ID||p?.purpose!=="vote"||!did||typeof p.target_did!=="string"||typeof p.entry_id!=="string"||typeof p.request_id!=="string")return [];return [{seq:m.seq,ts:m.ts,did,targetDid:p.target_did,entryId:p.entry_id,purpose:"vote" as const,requestId:p.request_id,text:m.text,raw:p}];}).sort((a,b)=>(a.seq??0)-(b.seq??0));}
  function parseReplies(records:Message[]):Reply[]{return records.flatMap(m=>{const p=parsePayload(m),did=messageDid(m);const rel=p?.in_reply_to;if(!m.text||p?.type!=="sonnet.reply.v1"||p?.contest_id!==CONTEST_ID||!did||typeof p.request_id!=="string"||!rel||typeof rel.request_id!=="string")return [];return [{seq:m.seq,ts:m.ts,did,requestId:p.request_id,invitationId:rel.request_id,text:m.text} as Reply];}).sort((a,b)=>(a.seq??0)-(b.seq??0));}
  async function parseBallots(records:Message[],receipts:Receipt[],eligibleVoters:Set<string>,eligibleEntries:Set<string>):Promise<Ballot[]>{const byReq=new Map(receipts.map(r=>[r.requestId,r]));const out:Ballot[]=[];for(const m of records){const p=parsePayload(m),did=messageDid(m),sig=messageSig(m),nonce=m.nonce==null?"":String(m.nonce);if(!m.text||!did||!sig||!nonce||p?.type!=="sonnet.ballot.v1"||p?.contest_id!==CONTEST_ID||p?.voter_did!==did||typeof p.entry_id!=="string"||typeof p.request_id!=="string")continue;let verified=false;try{verified=await verifySignature(did,VOTES_ROOM,nonce,m.text,sig);}catch{}if(!verified)continue;const receipt=byReq.get(p.request_id)||null;const ts=typeof m.ts==="string"?Date.parse(m.ts):NaN;const refereeIntakeTs=receipt?.ts?Date.parse(receipt.ts):NaN;const beforeDeadline=!Number.isNaN(refereeIntakeTs)&&refereeIntakeTs<=DEADLINE_MS;const counted=eligibleVoters.has(did)&&eligibleEntries.has(p.entry_id)&&beforeDeadline&&!!receipt?.accepted;out.push({seq:m.seq,ts:m.ts,did,entryId:p.entry_id,requestId:p.request_id,text:m.text,verified:true,counted,receipt});}return out.sort((a,b)=>(a.seq??0)-(b.seq??0));}
  function parseClaims(records:Message[],receipts:Receipt[]):ClaimReward[]{const byReq=new Map(receipts.map(r=>[r.requestId,r]));return records.flatMap(m=>{const p=parsePayload(m),did=messageDid(m);if(!m.text||p?.type!=="sonnet.claim.v1"||p?.contest_id!==CONTEST_ID||!did||typeof p.destination!=="string"||typeof p.request_id!=="string")return [];return [{seq:m.seq,ts:m.ts,did,destination:p.destination,requestId:p.request_id,text:m.text,receipt:byReq.get(p.request_id)||null}];}).sort((a,b)=>(a.seq??0)-(b.seq??0));}
  function parseSubmissions(records:Message[],receipts:Receipt[]):SubmissionEntry[]{const byReq=new Map(receipts.map(r=>[r.requestId,r]));return records.flatMap(m=>{const p=parsePayload(m),did=messageDid(m);if(!m.text||p?.type!=="sonnet.submit.v1"||p?.contest_id!==CONTEST_ID||!did||typeof p.request_id!=="string"||typeof p.game_id!=="string"||typeof p.poem_room!=="string")return [];const r=byReq.get(p.request_id)||null;return [{requestId:p.request_id,entryId:r?.entryId, did,gameId:p.game_id,poemRoom:p.poem_room,roomGeneration:Number.isInteger(p.room_generation)?p.room_generation:undefined,finalVersion:Number.isInteger(p.final_version)?p.final_version:undefined,poemSha256:typeof p.poem_sha256==="string"?p.poem_sha256:undefined,xPostIds:Array.isArray(p.x_post_ids)?p.x_post_ids.filter((x:any):x is string=>typeof x==="string"):[],seq:m.seq,ts:m.ts,accepted:!!r?.accepted,receipt:r,poem:typeof p.poem==="string"?p.poem:undefined,contributors:Array.isArray(p.contributors)?p.contributors.filter((x:any):x is string=>typeof x==="string"):undefined}];}).sort((a,b)=>(a.seq??0)-(b.seq??0));}
  async function parseLaunchRecord(records:Message[]):Promise<LaunchConfig|null>{for(const m of records){if(!(await isVerifiedRefereeMessage(m,RULES_ROOM)))continue;const p=parsePayload(m);if(p?.type!=="sonnet.launch.v1"||p?.contest_id!==CONTEST_ID||!p?.configuration)continue;const c=p.configuration;const fp=(c.package_fingerprint&&typeof c.package_fingerprint==="object")?c.package_fingerprint:{};if(fp.manifest_sha256!==PINNED_MANIFEST_SHA256||fp["sonnet-game.md"]!==PINNED_SONNET_GAME_SHA256||fp["sonnet_validate.py"]!==PINNED_VALIDATOR_SHA256)continue;const rooms=(c.rooms&&typeof c.rooms==="object")?Object.fromEntries(Object.entries(c.rooms).filter(([k,v])=>typeof v==="string")) as Record<string,string>:{};const openingMs=typeof c.opening==="number"?c.opening*1000:typeof c.opening==="string"?Date.parse(c.opening):NaN;const deadlineMs=typeof c.deadline==="number"?c.deadline*1000:typeof c.deadline==="string"?Date.parse(c.deadline):NaN;const cutoffMs=typeof c.identity_cutoff==="number"?c.identity_cutoff*1000:typeof c.identity_cutoff==="string"?Date.parse(c.identity_cutoff):NaN;if(!Number.isFinite(openingMs)||!Number.isFinite(deadlineMs)||!Number.isFinite(cutoffMs))continue;return {contestId:String(c.contest_id),openingMs,deadlineMs,identityCutoffMs:cutoffMs,refereeDid:typeof c.referee==="string"?c.referee:"",rooms};}return null;}

  async function parseResults(records:Message[]):Promise<ResultRecord[]>{const out:ResultRecord[]=[];for(const m of records){if(!(await isVerifiedRefereeMessage(m,RESULTS_ROOM)))continue;const p=parsePayload(m);if(!m.text||!p||typeof p!=="object")continue;const typ=typeof p.type==="string"?p.type:"";if(!/sonnet\.(result|judgment|award)\.v1/i.test(typ))continue;const winner=typeof p.winner_entry_id==="string"?p.winner_entry_id:typeof p.winning_entry_id==="string"?p.winning_entry_id:typeof p.entry_id==="string"&&/winner|award/i.test(String(p.status||p.result||""))?p.entry_id:undefined;out.push({winnerEntryId:winner,entryId:typeof p.entry_id==="string"?p.entry_id:undefined,contributors:Array.isArray(p.contributors)?p.contributors.filter((x:any):x is string=>typeof x==="string"):undefined,status:typeof p.status==="string"?p.status:undefined,seq:m.seq,ts:m.ts});}return out.sort((a,b)=>(a.seq??0)-(b.seq??0));}

  function applyTeamCache(c:TeamCache|null){if(!c)return;if(c.teamRequest!==undefined)setTeamRequest(c.teamRequest||null);if(c.teamRequesterDid!==undefined)setTeamOwnerDid(c.teamRequesterDid||"");if(c.poemRoom!==undefined)setPoemRoom(c.poemRoom||"");if(Number.isInteger(c.roomGeneration))setRoomGeneration(c.roomGeneration||0);if(Array.isArray(c.rosterMembers))setRosterMembers(c.rosterMembers);if(Array.isArray(c.rosterConsents))setRosterConsents(c.rosterConsents);if(c.rosterStatus)setRosterStatus(c.rosterStatus);if(Array.isArray(c.turns))setTurns(c.turns);if(Array.isArray(c.pendingTurns))setPendingTurns(c.pendingTurns);if(c.lastReceipt!==undefined)setLastReceipt(c.lastReceipt||null);}

  useEffect(()=>{if(!identity?.did){setInitializing(false);return;}const p=readPersonal(identity.did),reg=readRegistry();if(p?.xUsername)setXUsername(p.xUsername);if(p?.gameId)setTeamGameId(p.gameId);if(p?.role){setRegisteredRole(p.role);setRole(p.role);setActiveRoleTab(p.role);}if(p?.registrationState)setRegistrationState(p.registrationState);if(Array.isArray(p?.selectedApplicants))setSelectedApplicants(p.selectedApplicants);if(reg.length)setRegisteredWriters(reg.filter(r=>r.role==="writer"));applyTeamCache(readTeam(p?.gameId||DEFAULT_GAME_ID));setOnline(navigator.onLine);if(!navigator.onLine)setMessage("Offline. Showing the last-known Sonnet state from this device. New protocol actions require a connection.");setInitializing(false);},[identity?.did]);

  async function refreshAll(){
    if(!identity)return;
    if(!navigator.onLine){setOnline(false);setMessage("Offline. Last-known Sonnet state remains available; reconnect to refresh the protocol.");return;}
    setRefreshing(true);setOnline(true);setMessage("");
    const game=teamGameId.trim().toLowerCase();
    try{
      let registrationRecords:Message[]|null=null, discoveryRecords:Message[]|null=null, discoveryReceipts:Receipt[]=[];
      try{registrationRecords=await readProtocolRoom(REGISTRATION_ROOM);}catch(e){setMessage(`Registration refresh failed; keeping the last-known registry. ${String(e).replace(/^Error:\s*/,"")}`);}
      try{discoveryRecords=await readProtocolRoom(DISCOVERY_ROOM);discoveryReceipts=await parseReceipts(discoveryRecords,DISCOVERY_ROOM);}catch(e){setMessage(`Discovery refresh failed; keeping the last-known team state. ${String(e).replace(/^Error:\s*/,"")}`);}
      try{const rulesRecords=await readProtocolRoom(RULES_ROOM,50);const launch=await parseLaunchRecord(rulesRecords);if(!launch){setLaunchStatus("unavailable");setLaunchConfig(null);}else{const roomMatch=Object.entries(launchExpectedRooms).every(([k,v])=>!launch.rooms[k]||launch.rooms[k]===v);const ok=launch.contestId===CONTEST_ID&&launch.refereeDid===REFEREE_DID&&launch.openingMs===REGISTRY_OPENING_MS&&launch.deadlineMs===DEADLINE_MS&&launch.identityCutoffMs===REGISTRY_OPENING_MS&&roomMatch;setLaunchStatus(ok?"verified":"mismatch");setLaunchConfig(launch);}}catch{setLaunchStatus("unavailable");setLaunchConfig(null);} 
      if(registrationRecords){
        const registrations=parseRegistrationMessages(registrationRecords), receipts=await parseReceipts(registrationRecords,REGISTRATION_ROOM), acceptedIds=new Set(receipts.filter(r=>r.accepted).map(r=>r.requestId));
        const latestByDid=new Map<string,Registration>(); for(const x of registrations)if(acceptedIds.has(x.reg.requestId))latestByDid.set(x.reg.did,x.reg);
        const allAccepted=Array.from(latestByDid.values()).sort((a,b)=>(a.seq??0)-(b.seq??0));
        const writerAccepted=allAccepted.filter(r=>r.role==="writer"); setRegisteredWriters(writerAccepted); writeRegistry(writerAccepted);
        const ownAccepted=allAccepted.find(r=>r.did===identity.did), ownPending=[...registrations].reverse().find(x=>x.reg.did===identity.did&&!acceptedIds.has(x.reg.requestId));
        const ownStatus=ownAccepted?"registered":ownPending?"pending":"not-found"; setRegistrationState(ownStatus); setRegisteredRole(ownAccepted?.role||null); if(ownAccepted){setRole(ownAccepted.role);setActiveRoleTab(ownAccepted.role);} writePersonal(identity.did,{xUsername,role:ownAccepted?.role||role,registrationState:ownStatus,gameId:game,registrationRequestId:ownPending?.reg.requestId});
      }
      if(discoveryRecords){
        const receipts=discoveryReceipts, requests=parseTeamRequests(discoveryRecords).filter(t=>t.gameId===game), ownRequests=requests.filter(t=>t.did===identity.did), ownLatest=ownRequests.at(-1)||null;
        const setups=requests.map(t=>({request:t,receipt:[...receipts].reverse().find(r=>r.requestId===t.requestId&&r.accepted&&r.poemRoom)})).filter(x=>!!x.receipt);
        const chosen=setups.at(-1)|| (ownLatest?{request:ownLatest,receipt:[...receipts].reverse().find(r=>r.requestId===ownLatest.requestId)||null}:requests.at(-1)?{request:requests.at(-1)!,receipt:null}:null);
        const cached=readTeam(game);
        if(chosen){const req=chosen.request,rec=chosen.receipt;const team:TeamRequest={...req,poemRoom:rec?.poemRoom||undefined,roomGeneration:rec?.roomGeneration};setTeamRequest(team);setTeamOwnerDid(req.did);setTeamState(rec?.accepted&&rec.poemRoom?"ready":rec&&!rec.accepted?"rejected":"waiting");if(rec?.accepted&&rec.poemRoom){setPoemRoom(rec.poemRoom);setRoomGeneration(Number.isInteger(rec.roomGeneration)?rec.roomGeneration!:0);}}
        const rosterRecords=(await parseRosterMessages(discoveryRecords)).filter(r=>r.gameId===game), latestRoster=rosterRecords.at(-1)||null;
        const withdraws=parseWithdrawals(discoveryRecords).filter(w=>w.gameId===game);
        const acceptedWithdrawReqs=new Set(receipts.filter(r=>r.accepted).map(r=>r.requestId));
        const latestAcceptedWithdrawSeq=withdraws.filter(w=>acceptedWithdrawReqs.has(w.requestId)).map(w=>w.seq??-1).reduce((mx,v)=>Math.max(mx,v),-1);
        let activeRoster:RosterMember[]=cached?.rosterMembers||[], activeRoom=chosen?.receipt?.poemRoom||latestRoster?.poemRoom||cached?.poemRoom||"", activeGeneration=chosen?.receipt?.roomGeneration??latestRoster?.roomGeneration??cached?.roomGeneration??0, consentIds:string[]=cached?.rosterConsents||[], state:"none"|"proposed"|"ready"|"frozen"=cached?.rosterStatus||"none", readyReceipt:Receipt|null=null;
        if(latestRoster && (latestRoster.seq??-1)>latestAcceptedWithdrawSeq){activeRoster=latestRoster.members;activeRoom=latestRoster.poemRoom;activeGeneration=latestRoster.roomGeneration;const exact=rosterRecords.filter(r=>sameRoster(r,latestRoster));consentIds=Array.from(new Set(exact.map(r=>r.did).filter(d=>activeRoster.some(m=>m.did===d))));const exactIds=new Set(exact.map(r=>r.requestId));readyReceipt=[...receipts].reverse().find(r=>r.accepted&&exactIds.has(r.requestId)&&r.rosterReady)||null;state=readyReceipt?"ready":"proposed";}else if(latestAcceptedWithdrawSeq>=0){activeRoster=[];activeRoom=chosen?.receipt?.poemRoom||cached?.poemRoom||"";activeGeneration=chosen?.receipt?.roomGeneration??cached?.roomGeneration??0;consentIds=[];state="none";}
        let nextTurns:AcceptedWord[]=turns,nextPending:WordProposal[]=pendingTurns,nextReceipt=lastReceipt;
        if(activeRoom){try{const teamRecords=await readProtocolRoom(activeRoom),teamReceipts=await parseReceipts(teamRecords,activeRoom),classified=classifyWords(parseWordMessages(teamRecords),teamReceipts,activeRoster);nextTurns=classified.accepted;nextPending=classified.pending;nextReceipt=classified.accepted.at(-1)?.acceptedReceipt||readyReceipt||null;if(nextTurns.length>0)state="frozen";setTurns(nextTurns);setPendingTurns(nextPending);setLastReceipt(nextReceipt);}catch(e){setMessage(`Shared poem refresh failed; keeping the last-known poem. ${String(e).replace(/^Error:\s*/,"")}`);}}
        setPoemRoom(activeRoom);setRoomGeneration(activeGeneration);setRosterMembers(activeRoster);setRosterConsents(consentIds);setRosterStatus(state);
        writeTeam(game,{teamRequest:chosen?.request?{...chosen.request,poemRoom:activeRoom,roomGeneration:activeGeneration}:cached?.teamRequest||null,teamRequesterDid:chosen?.request.did||cached?.teamRequesterDid||"",poemRoom:activeRoom,roomGeneration:activeGeneration,rosterMembers:activeRoster,rosterConsents:consentIds,rosterStatus:state,turns:nextTurns,pendingTurns:nextPending,lastReceipt:nextReceipt});
      }
      try{const teamCache=readTeam(game);if(teamCache?.poemRoom){setPoemRoom(teamCache.poemRoom);setRoomGeneration(teamCache.roomGeneration||0);}}
      catch{}
      try{const [subRecords,voteRecords,campaignRecords,resultRecordsRaw]=await Promise.all([readProtocolRoom(SUBMISSIONS_ROOM),readProtocolRoom(VOTES_ROOM),readProtocolRoom(CAMPAIGN_ROOM),readProtocolRoom(RESULTS_ROOM)]);const [subReceipts,voteReceipts,campaignReceipts]=await Promise.all([parseReceipts(subRecords,SUBMISSIONS_ROOM),parseReceipts(voteRecords,VOTES_ROOM),parseReceipts(campaignRecords,CAMPAIGN_ROOM)]);const parsedSubs=parseSubmissions(subRecords,subReceipts);const acceptedEntries=new Set(parsedSubs.filter(s=>s.accepted&&s.entryId).map(s=>s.entryId as string));const eligibleVoterDids=new Set<string>();if(registrationRecords){const registrations=parseRegistrationMessages(registrationRecords),regReceipts=await parseReceipts(registrationRecords,REGISTRATION_ROOM),acceptedRegIds=new Set(regReceipts.filter(r=>r.accepted).map(r=>r.requestId));for(const x of registrations){if(acceptedRegIds.has(x.reg.requestId)&&x.reg.role==="voter")eligibleVoterDids.add(x.reg.did);}}const parsedBallots=await parseBallots(voteRecords,voteReceipts,eligibleVoterDids,acceptedEntries);setSubmissions(parsedSubs);setBallots(parsedBallots);setInvites(parseInvites(campaignRecords));setReplies(parseReplies(campaignRecords));setClaims(parseClaims(registrationRecords||[],await parseReceipts(registrationRecords||[],REGISTRATION_ROOM)));const results=await parseResults(resultRecordsRaw);setResultRecords(results);const winner=[...results].reverse().find(r=>r.winnerEntryId)?.winnerEntryId||"";setWinnerEntryId(winner);if(discoveryRecords){const allOwnRequests=parseTeamRequests(discoveryRecords).filter(t=>t.did===identity.did);const rejectedIds=new Set(discoveryReceipts.filter(r=>!r.accepted).map(r=>r.requestId));const acceptedSetupIds=new Set(discoveryReceipts.filter(r=>r.accepted&&r.poemRoom).map(r=>r.requestId));const acceptedOwnSubmissionGames=new Set(parsedSubs.filter(s=>s.accepted&&s.did===identity.did).map(s=>s.gameId));const activeGames=Array.from(new Set(allOwnRequests.filter(t=>!rejectedIds.has(t.requestId)&&!acceptedOwnSubmissionGames.has(t.gameId)&&acceptedSetupIds.has(t.requestId)).map(t=>t.gameId)));const pendingGames=Array.from(new Set(allOwnRequests.filter(t=>!rejectedIds.has(t.requestId)&&!acceptedOwnSubmissionGames.has(t.gameId)&&!acceptedSetupIds.has(t.requestId)).map(t=>t.gameId)));setActiveProjectGameIds(Array.from(new Set([...activeGames,...pendingGames])));}}catch(e){setMessage(`Public campaign/vote/result refresh failed; last-known team state remains. ${String(e).replace(/^Error:\s*/,"")}`);}
      setRefreshSeq(x=>x+1);writePersonal(identity.did,{gameId:game,xUsername,role:registeredRole||role,registrationState});
      setMessage("Sonnet refreshed. Server/referee records are authoritative; local storage is only a last-known cache.");
    }finally{setRefreshing(false);}
  }

  useEffect(()=>{if(identity?.did&&!initializing){void refreshAll();}},[identity?.did,initializing]);

  async function registerWriter(){if(!identity)return;if(!protocolReady){setMessage("Official Sonnet launch record is not verified yet. Refresh state before posting.");return;}if(!contestOpen){setMessage(clockNow>DEADLINE_MS?"Contest intake is closed at D. Registration can no longer be accepted.":"Contest has not opened yet.");return;}const username=xUsername.trim().replace(/^@/,"");if(role==="writer"&&!/^[A-Za-z0-9_]{1,15}$/.test(username)){setMessage("Enter a valid X username.");return;}if(registrationState==="registered"){setMessage(`This DID already has its first accepted role fixed as ${registeredRole||role}.`);return;}if(registrationState==="pending"){setMessage("Registration is already pending. Wait for the referee receipt; do not create another request ID.");return;}if(!online){setMessage("Offline. Registration requires a connection.");return;}setBusy(true);setMessage("");try{const requestId=requestIdFor("register",role),nonce=nextNonce(identity.did),payload:Record<string,unknown>={type:"sonnet.register.v1",contest_id:CONTEST_ID,role,request_id:requestId};if(role==="writer")payload.x_account_url=`https://x.com/${username}`;const text=JSON.stringify(payload),sig=await signMessage(identity,REGISTRATION_ROOM,nonce,text);await postSigned(REGISTRATION_ROOM,{did:identity.did,sig,nonce,text});setRegistrationState("pending");writePersonal(identity.did,{xUsername:role==="writer"?username:xUsername,role,registrationState:"pending",registrationRequestId:requestId,gameId:teamGameId});setMessage(`${role} registration posted. ◌ Waiting for the official referee receipt.`);}catch(e){setMessage(String(e).replace(/^Error:\s*/,""));}finally{setBusy(false);}}

  function selectApplicant(did:string){if(!requesterMayManage)return;setSelectedApplicants(prev=>{const next=prev.includes(did)?prev.filter(x=>x!==did):prev.length<8?[...prev,did]:prev;if(identity)writePersonal(identity.did,{selectedApplicants:next});return next;});}
  const requesterMayManage=!!identity&&!!teamRequest?.poemRoom&&teamRequest.did===identity.did&&rosterStatus==="none"&&teamState==="ready"&&!!registeredRole&&registeredRole!=="voter";
  const myAcceptedSubmission=submissions.find(s=>s.accepted&&s.gameId===teamGameId&&s.did===identity?.did);
  async function createTeam(){if(!identity)return;if(!protocolReady){setMessage("Official Sonnet launch record is not verified yet. Refresh state before requesting a team room.");return;}if(!contestOpen){setMessage(clockNow>DEADLINE_MS?"Team-room intake is closed at D. The referee's durable intake time is authoritative.":"Contest has not opened yet.");return;}if(activeProjectGameIds.some(g=>g!==teamGameId.trim().toLowerCase())){setMessage(`You already have an unfinished or pending team project (${activeProjectGameIds.filter(g=>g!==teamGameId.trim().toLowerCase()).join(", ")}). Finish it or wait for its allocation to be rejected before requesting another.`);return;}if(!["writer","organizer"].includes(registeredRole||"")){setMessage("Only an accepted registered writer or organizer can request a team room.");return;}if(teamRequest&&!myAcceptedSubmission&&teamState!=="rejected"){setMessage("This DID already has one unfinished Sonnet project. Finish it or wait for the referee's accepted submission receipt before starting another.");return;}const game=teamGameId.trim().toLowerCase();if(!/^[a-z0-9][a-z0-9_-]{0,15}$/.test(game)){setMessage("Game ID must be 1–16 lowercase letters, digits, hyphens or underscores.");return;}if(!online){setMessage("Offline. Team-room requests require a connection.");return;}if(teamRequest&&teamRequest.gameId===game&&teamState!=="rejected"){setMessage(`A ${teamState} request already exists for ${game}. Keep its request ID and wait for the referee.`);return;}setBusy(true);setMessage("");try{const requestId=requestIdFor("room",game),nonce=nextNonce(identity.did),text=JSON.stringify({type:"sonnet.team-request.v1",contest_id:CONTEST_ID,game_id:game,request_id:requestId}),sig=await signMessage(identity,DISCOVERY_ROOM,nonce,text);await postSigned(DISCOVERY_ROOM,{did:identity.did,sig,nonce,text});const next:TeamRequest={gameId:game,did:identity.did,requestId};setTeamGameId(game);setTeamRequest(next);setTeamOwnerDid(identity.did);setTeamState("waiting");setPoemRoom("");setRoomGeneration(0);setRosterMembers([]);setRosterConsents([]);setRosterStatus("none");setTurns([]);setPendingTurns([]);setLastReceipt(null);setSelectedApplicants([]);writeTeam(game,{teamRequest:next,teamRequesterDid:identity.did,poemRoom:"",roomGeneration:0,rosterMembers:[],rosterConsents:[],rosterStatus:"none",turns:[],pendingTurns:[],lastReceipt:null});writePersonal(identity.did,{gameId:game,selectedApplicants:[]});setMessage("Team-room request posted. ◌ Waiting for the referee to assign the actual poem room and generation.");}catch(e){setMessage(String(e).replace(/^Error:\s*/,""));}finally{setBusy(false);}}

  function openRosterConfirmation(){if(!requesterMayManage){setMessage("Only the requester may propose the roster, and only after the referee assigns the poem room.");return;}const chosen=selectedApplicants.filter(d=>registeredWriters.some(r=>r.did===d));if(chosen.length<4||chosen.length>8){setMessage("Select exactly 4–8 accepted registered writer DIDs.");return;}setShowRosterConfirm(true);}
  async function publishRoster(){if(!protocolReady){setMessage("Official Sonnet launch record is not verified yet. Refresh state before publishing a roster.");return;}if(!contestOpen){setMessage(clockNow>DEADLINE_MS?"Roster intake is closed at D.":"Contest has not opened yet.");return;}if(!identity||!requesterMayManage){setShowRosterConfirm(false);return;}const chosen=selectedApplicants.filter(d=>registeredWriters.some(r=>r.did===d));if(chosen.length<4||chosen.length>8||!poemRoom){setMessage("Select 4–8 writers and wait for the referee-assigned poem room.");setShowRosterConfirm(false);return;}setBusy(true);setMessage("");try{const requestId=requestIdFor("roster",teamGameId),nonce=nextNonce(identity.did),members=chosen.map(d=>({did:d,role:"writer" as const})),text=JSON.stringify({type:"sonnet.roster.v1",contest_id:CONTEST_ID,game_id:teamGameId,poem_room:poemRoom,room_generation:roomGeneration,members,request_id:requestId}),sig=await signMessage(identity,DISCOVERY_ROOM,nonce,text);await postSigned(DISCOVERY_ROOM,{did:identity.did,sig,nonce,text});setRosterMembers(members);setRosterConsents(identity.did&&members.some(m=>m.did===identity.did)?[identity.did]:[]);setRosterStatus("proposed");setSelectedApplicants([]);setShowRosterConfirm(false);writeTeam(teamGameId,{teamRequest,teamRequesterDid:teamOwnerDid,poemRoom,roomGeneration,rosterMembers:members,rosterConsents:identity.did&&members.some(m=>m.did===identity.did)?[identity.did]:[],rosterStatus:"proposed",turns:[],pendingTurns:[],lastReceipt:null});setMessage("Roster proposal posted. ◌ Waiting for every selected member to sign the exact same roster, then waiting for referee-ready.");}catch(e){setMessage(String(e).replace(/^Error:\s*/,""));}finally{setBusy(false);}}
  async function signCurrentRoster(){if(!protocolReady){setMessage("Official Sonnet launch record is not verified yet. Refresh state before signing roster consent.");return;}if(!contestOpen){setMessage(clockNow>DEADLINE_MS?"Roster consent intake is closed at D.":"Contest has not opened yet.");return;}if(!identity||!rosterMembers.some(m=>m.did===identity.did)){setMessage("Your DID is not in the proposed roster.");return;}if(rosterStatus==="frozen"||rosterStatus==="ready"){setMessage("This roster is already ready/frozen.");return;}if(rosterConsents.includes(identity.did)){setMessage("Your consent is already recorded.");return;}if(!online){setMessage("Offline. Roster consent needs a signed post.");return;}setBusy(true);setMessage("");try{const requestId=requestIdFor("roster-consent",teamGameId),nonce=nextNonce(identity.did),text=JSON.stringify({type:"sonnet.roster.v1",contest_id:CONTEST_ID,game_id:teamGameId,poem_room:poemRoom,room_generation:roomGeneration,members:rosterMembers,request_id:requestId}),sig=await signMessage(identity,DISCOVERY_ROOM,nonce,text);await postSigned(DISCOVERY_ROOM,{did:identity.did,sig,nonce,text});const next=Array.from(new Set([...rosterConsents,identity.did]));setRosterConsents(next);writeTeam(teamGameId,{rosterConsents:next});setMessage("Roster consent posted. ◌ Waiting for the remaining signatures and referee-ready.");}catch(e){setMessage(String(e).replace(/^Error:\s*/,""));}finally{setBusy(false);}}
  async function withdrawFromRoster(){if(!protocolReady){setMessage("Official Sonnet launch record is not verified yet. Refresh state before withdrawing.");return;}if(!contestOpen){setMessage(clockNow>DEADLINE_MS?"Roster withdrawal is closed at D.":"Contest has not opened yet.");return;}if(!identity||!rosterMembers.some(m=>m.did===identity.did)){setMessage("Your DID is not in the current roster.");return;}if(rosterStatus==="frozen"){setMessage("The roster is frozen by an accepted word.");return;}if(!online){setMessage("Offline. Withdrawal needs a signed post.");return;}setBusy(true);try{const requestId=requestIdFor("roster-withdraw",teamGameId),nonce=nextNonce(identity.did),text=JSON.stringify({type:"sonnet.withdraw.v1",contest_id:CONTEST_ID,game_id:teamGameId,request_id:requestId}),sig=await signMessage(identity,DISCOVERY_ROOM,nonce,text);await postSigned(DISCOVERY_ROOM,{did:identity.did,sig,nonce,text});setRosterMembers([]);setRosterConsents([]);setRosterStatus("none");setSelectedApplicants([]);writeTeam(teamGameId,{rosterMembers:[],rosterConsents:[],rosterStatus:"none"});setMessage("Withdrawal posted. The roster can be renegotiated before the first accepted word.");}catch(e){setMessage(String(e).replace(/^Error:\s*/,""));}finally{setBusy(false);}}

  function cleanWord(input:string){return input.trim().replace(/[.,;:!?]+$/g,"");}
  function wordAllowedByDid(candidate:string,did:string){const allowed=new Set(did.toLowerCase().replace(/[^a-z]/g,""));const letters=candidate.toLowerCase().replace(/[^a-z]/g,"");return letters.length>0&&[...letters].every(ch=>allowed.has(ch));}
  const syllablesForWord=(token:string)=>lexicon?.get(cleanWord(token).toLowerCase())??null;
  function layoutAccepted(list:AcceptedWord[]){let line=1,syllables=0;return list.map(t=>{const c=syllablesForWord(t.word)||0,next=syllables+c,endLine=next===10,out={...t,line,endLine};if(endLine){line++;syllables=0;}else syllables=next;return out;});}
  const displayedTurns=layoutAccepted(turns);
  const lineWords=displayedTurns.reduce((acc,t)=>{(acc[t.line-1]??=[]).push(t.word);return acc;},[] as string[][]);
  const poemText=Array.from({length:14},(_,i)=>lineWords[i]?.join(" ")||"");
  const completedLines=displayedTurns.filter(t=>t.endLine).length;
  const poemComplete=completedLines>=14;
  const currentLine=Math.min(14,completedLines+1);
  const lineSyllables=Array.from({length:14},(_,i)=>(lineWords[i]||[]).reduce((sum,w)=>sum+(syllablesForWord(w)||0),0));
  const currentLineSyllables=lineSyllables[currentLine-1]||0;
  const projected=currentLineSyllables+(syllablesForWord(word)||0);
  const previousContributor=displayedTurns.at(-1)?.did||"";
  const currentVersion=lastReceipt?.version??turns.length;
  const currentStateHash=lastReceipt?.stateHash||"";
  const myMember=!!identity&&rosterMembers.some(m=>m.did===identity.did);
  const allConsented=rosterMembers.length>0&&rosterMembers.every(m=>rosterConsents.includes(m.did));
  const rosterReady=rosterStatus==="ready"||rosterStatus==="frozen";
  const contributionCounts=rosterMembers.map(m=>({did:m.did,count:displayedTurns.filter(t=>t.did===m.did).length}));
  const allContributors=rosterMembers.length>0&&contributionCounts.every(x=>x.count>0);
  const ownPending=pendingTurns.some(t=>t.did===identity?.did&&t.version===currentVersion&&t.previousStateHash===currentStateHash);
  const canWrite=myMember&&rosterReady&&online&&dictionaryStatus==="ready"&&!poemComplete&&previousContributor!==identity?.did&&!ownPending;
  const finalReady=!!identity&&registeredRole==="writer"&&identity.did===previousContributor&&poemComplete&&allContributors&&online&&!myAcceptedSubmission;
  const selectedCount=selectedApplicants.length;
  const availableLetters=Array.from(new Set((identity?.did||"").toUpperCase().replace(/[^A-Z]/g,""))).sort();
  const suggestedWords=["the","a","an","and","be","can","do","dream","earth","fire","for","from","hope","is","life","light","love","moon","night","one","our","poem","rise","sea","sky","star","stone","sun","time","to","we","word","world"].filter(w=>wordAllowedByDid(w,identity?.did||""));
  const nameForDid=(did:string)=>xHandle(registeredWriters.find(r=>r.did===did)?.xAccount)||registeredWriters.find(r=>r.did===did)?.xAccount||did.slice(0,20)+"…";
  const pill=(kind:"ok"|"warn"|"info",text:string)=><span className={`sonnet-pill ${kind}`}>{text}</span>;
  const Spinner=({small=false}:{small?:boolean})=><span className={`sonnet-spinner${small?" small":""}`} aria-hidden="true"/>;
  const rosterLabel=rosterStatus==="frozen"?"FROZEN":rosterStatus==="ready"?"READY TO WRITE":rosterStatus==="proposed"?"WAITING REFEREE":"NOT SET";
  const normalizedRole=registeredRole||role;
  const publicEntries=submissions.filter(s=>s.accepted&&s.entryId);
  const myInvites=identity?invites.filter(i=>i.targetDid===identity.did):[];
  const myBallot=[...ballots].reverse().find(b=>b.did===identity?.did&&b.counted);
  const winner=winnerEntryId||resultRecords.find(r=>r.winnerEntryId)?.winnerEntryId||"";
  const myWinnerSubmission=submissions.find(s=>s.entryId===winner&&s.accepted);
  const myWinnerContributor=!!identity&&!!winner&&!!myWinnerSubmission&&((myWinnerSubmission.contributors||[]).includes(identity.did)||myWinnerSubmission.did===identity.did);
  const existingClaim=claims.find(c=>c.did===identity?.did&&c.receipt?.accepted);

  async function submitWord(){if(!protocolReady){setMessage("Official Sonnet launch record is not verified yet. Refresh state before writing.");return;}if(!contestOpen){setMessage(clockNow>DEADLINE_MS?"Writing is closed at D. Referee durable intake time is authoritative.":"Contest has not opened yet.");return;}if(!identity){setMessage("Create or import an identity first.");return;}const candidate=cleanWord(word).toLowerCase();if(!candidate){setMessage("Enter one English word.");return;}if(!poemRoom){setMessage("The shared poem room is not assigned yet.");return;}if(!online){setMessage("Offline. Reconnect before submitting a signed word.");return;}if(!myMember){setMessage("Your DID is not in the official roster.");return;}if(!rosterReady){setMessage("Writing is locked until the referee-ready roster receipt is present.");return;}if(previousContributor===identity.did){setMessage("You wrote the previous accepted word. Another roster member must go next.");return;}if(ownPending){setMessage("Your proposal for the current shared state is still pending. Refresh after the referee receipt.");return;}if(dictionaryStatus!=="ready"||!lexicon){setMessage("Frozen CMUdict is still loading.");return;}if(!lexicon.has(candidate)||!wordAllowedByDid(candidate,identity.did)){setMessage("This word is unavailable under the frozen dictionary/DID-letter rules.");return;}const n=syllablesForWord(candidate);if(!n){setMessage("No usable pronunciation was found for that word.");return;}if(currentLineSyllables+n>10){setMessage(`That word would make line ${currentLine} exceed 10 syllables.`);return;}if(poemComplete){setMessage("The poem is already complete.");return;}setBusy(true);try{const requestId=requestIdFor("word",teamGameId),nonce=nextNonce(identity.did),payload={type:"sonnet.word.v1",contest_id:CONTEST_ID,game_id:teamGameId,poem_room:poemRoom,room_generation:roomGeneration,version:currentVersion,previous_state_hash:currentStateHash,word:candidate,request_id:requestId},text=JSON.stringify(payload),sig=await signMessage(identity,poemRoom,nonce,text);await postSigned(poemRoom,{did:identity.did,sig,nonce,text});const pending:WordProposal={seq:undefined,ts:new Date().toISOString(),did:identity.did,word:candidate,nonce,sig,text,requestId,version:currentVersion,roomGeneration,previousStateHash:currentStateHash};const next=[...pendingTurns.filter(t=>t.requestId!==requestId),pending];setPendingTurns(next);setWord("");writeTeam(teamGameId,{pendingTurns:next});setMessage(`Signed word "${candidate}" posted. Waiting for referee acceptance.`);}catch(e){setMessage(String(e).replace(/^Error:\s*/,""));}finally{setBusy(false);}}

  function canonicalPoemText(lines:string[]){const stanzas=[4,4,4,2];const out:string[]=[];let i=0;for(const n of stanzas){out.push(lines.slice(i,i+n).join("\n"));i+=n;}return out.join("\n\n");}
  async function submitFinalSonnet(){if(!protocolReady){setMessage("Official Sonnet launch record is not verified yet. Refresh state before submitting.");return;}if(!contestOpen){setMessage(clockNow>DEADLINE_MS?"Submission is closed at D. Referee durable intake time is authoritative.":"Contest has not opened yet.");return;}if(!identity||!finalReady)return;const ids=xPostIds.split(/[\s,]+/).map(x=>x.trim()).filter(Boolean);if(!ids.length){setMessage("Enter the X post IDs in reading order.");return;}setSubmitting(true);try{const requestId=requestIdFor("submit",teamGameId),nonce=nextNonce(identity.did),canonical=canonicalPoemText(poemText),poemSha256=await sha256Hex(canonical),payload={type:"sonnet.submit.v1",contest_id:CONTEST_ID,game_id:teamGameId,poem_room:poemRoom,room_generation:roomGeneration,final_version:currentVersion,poem_sha256:poemSha256,x_post_ids:ids,request_id:requestId},text=JSON.stringify(payload),sig=await signMessage(identity,SUBMISSIONS_ROOM,nonce,text);await postSigned(SUBMISSIONS_ROOM,{did:identity.did,sig,nonce,text});setMessage("Final submission posted. Waiting for referee receipt and entry ID.");}catch(e){setMessage(String(e).replace(/^Error:\s*/,""));}finally{setSubmitting(false);}}

  async function sendInvite(){if(!protocolReady){setMessage("Official Sonnet launch record is not verified yet. Refresh state before inviting.");return;}if(!contestOpen){setMessage(clockNow>DEADLINE_MS?"Campaign activity is closed at D.":"Contest has not opened yet.");return;}if(!identity||!["writer","organizer","voter"].includes(registeredRole||"")){setMessage("Your contest role cannot send campaign invitations.");return;}if(!online){setMessage("Reconnect before sending an invitation.");return;}if(!campaignEntryId||!inviteTargetDid.trim()){setMessage("Choose a submitted entry and target DID first.");return;}setBusy(true);try{const requestId=requestIdFor("invite","campaign"),nonce=nextNonce(identity.did),text=JSON.stringify({type:"sonnet.invite.v1",contest_id:CONTEST_ID,purpose:"vote",target_did:inviteTargetDid.trim(),entry_id:campaignEntryId,request_id:requestId,text:inviteText.trim()||undefined}),sig=await signMessage(identity,CAMPAIGN_ROOM,nonce,text);await postSigned(CAMPAIGN_ROOM,{did:identity.did,sig,nonce,text});setMessage("Invitation posted to the campaign room.");setInviteTargetDid("");}catch(e){setMessage(String(e).replace(/^Error:\s*/,""));}finally{setBusy(false);}}
  async function sendReply(inv:Invite){if(!identity||!online||!replyText.trim()){setMessage("Enter a reply and keep the connection online.");return;}setBusy(true);try{const requestId=requestIdFor("reply","campaign"),nonce=nextNonce(identity.did),text=JSON.stringify({type:"sonnet.reply.v1",contest_id:CONTEST_ID,in_reply_to:{sender_did:inv.did,request_id:inv.requestId},request_id:requestId,text:replyText.trim()}),sig=await signMessage(identity,CAMPAIGN_ROOM,nonce,text);await postSigned(CAMPAIGN_ROOM,{did:identity.did,sig,nonce,text});setReplyText("");setMessage("Reply posted to the campaign room.");}catch(e){setMessage(String(e).replace(/^Error:\s*/,""));}finally{setBusy(false);}}
  async function castBallot(){if(!protocolReady){setMessage("Official Sonnet launch record is not verified yet. Refresh state before voting.");return;}if(!contestOpen){setMessage(clockNow>DEADLINE_MS?"Voting is closed at D. Referee durable intake time is authoritative.":"Contest has not opened yet.");return;}if(!identity||registeredRole!=="voter"||!online||!selectedBallotEntry){setMessage("Only an accepted voter online with a selected entry can cast a ballot.");return;}setBusy(true);try{const requestId=requestIdFor("ballot","vote"),nonce=nextNonce(identity.did),text=JSON.stringify({type:"sonnet.ballot.v1",contest_id:CONTEST_ID,voter_did:identity.did,entry_id:selectedBallotEntry,request_id:requestId}),sig=await signMessage(identity,VOTES_ROOM,nonce,text);await postSigned(VOTES_ROOM,{did:identity.did,sig,nonce,text});setMessage("Ballot posted. Your latest valid authenticated ballot is the one that counts before the deadline.");}catch(e){setMessage(String(e).replace(/^Error:\s*/,""));}finally{setBusy(false);}}
  async function copyAttribution(){if(!identity)return;const value=`contest_id: ${CONTEST_ID}\ngame_id: ${teamGameId}\ndid: ${identity.did}`;try{await navigator.clipboard.writeText(value);setAttributionCopied(true);window.setTimeout(()=>setAttributionCopied(false),1800);setMessage("Required X attribution copied. Keep it outside the poem text.");}catch{setMessage("Clipboard access failed. Copy the attribution manually from the box.");}}

  async function submitClaim(){if(!protocolReady){setMessage("Official Sonnet launch record is not verified yet. Refresh state before claiming.");return;}if(!identity||registeredRole!=="writer"||!myWinnerContributor||!winner){setMessage("A claim is available only after the referee publishes an accepted winning result that identifies this DID on the frozen contributor roster.");return;}if(!online||!claimDestination.trim()){setMessage("Enter the exact payout destination and reconnect.");return;}setBusy(true);try{const requestId=requestIdFor("claim",teamGameId),nonce=nextNonce(identity.did),text=JSON.stringify({type:"sonnet.claim.v1",contest_id:CONTEST_ID,request_id:requestId,destination:claimDestination.trim()}),sig=await signMessage(identity,REGISTRATION_ROOM,nonce,text);await postSigned(REGISTRATION_ROOM,{did:identity.did,sig,nonce,text});setMessage("Prize claim posted. The referee will acknowledge the destination against the payout ledger.");}catch(e){setMessage(String(e).replace(/^Error:\s*/,""));}finally{setBusy(false);}}

  if(initializing)return <div className="sonnet-page sonnet-page-cream"><div className="sonnet-card sonnet-sheet"><div className="sonnet-statusline loading"><Spinner/>Loading saved Sonnet workspace…</div></div></div>;
  const acceptedSubmissionForGame=!!submissions.find(s=>s.accepted&&s.gameId===teamGameId&&s.poemRoom===poemRoom);
  const claimUnlocked=!!winner&&!!myWinnerContributor;
  const progress=[
    {label:"Registration",done:registrationState==="registered",active:registrationState!=="registered"},
    {label:"Team",done:teamState==="ready",active:registrationState==="registered"&&!teamRequest},
    {label:"Roster",done:rosterReady,active:!!teamRequest?.poemRoom&&!rosterReady},
    {label:"Write & submit",done:acceptedSubmissionForGame,active:rosterReady&&!acceptedSubmissionForGame},
    {label:"Claim",done:!!existingClaim,active:claimUnlocked&&!existingClaim},
  ];

  return <div className="sonnet-page sonnet-page-cream">
    <section className="sonnet-hero sonnet-hero-cream sonnet-hero-v22">
      <div className="sonnet-hero-main">
        <div className="eyebrow">FLOP LABS · SONNET 2</div>
        <h2 className="sonnet-title">Build the poem together.</h2>
        <div className="sonnet-subtitle">One verified identity, one official roster, one shared poem state.</div>
        <div className="sonnet-v22-progress">{progress.map((p,i)=><div className={`sonnet-v22-step ${p.done?"done":""} ${p.active?"active":""}`} key={p.label}><span className="sonnet-v22-step-dot">{p.done?<Check size={12}/>:i+1}</span><span>{p.label}</span>{i<progress.length-1&&<ChevronRight size={13}/>}</div>)}</div>
        <div className="sonnet-statusbar">
          {online?pill("ok","ONLINE"):pill("warn","OFFLINE")}
          {registrationState==="registered"?pill("ok",registeredRole==="organizer"?"REGISTERED":"REGISTERED + ELIGIBLE"):registrationState==="pending"?<span className="sonnet-statusline loading"><Spinner small/> WAITING REFEREE</span>:pill("info","NOT REGISTERED")}
          {teamState==="ready"?pill("ok","ROOM READY"):teamState==="waiting"?<span className="sonnet-statusline loading"><Spinner small/> REFEREE SETUP</span>:pill("info","NO TEAM")}
          {rosterStatus==="frozen"?pill("ok","ROSTER FROZEN"):rosterReady?pill("ok","READY TO WRITE"):rosterStatus==="proposed"?<span className="sonnet-statusline loading"><Spinner small/> ROSTER CHECK</span>:pill("info","ROSTER NOT SET")}
        </div>
      </div>
      <div className="sonnet-hero-tools"><button className="sonnet-btn secondary" type="button" onClick={()=>void refreshAll()} disabled={refreshing||busy}><RefreshCw size={13}/>{refreshing?<><Spinner small/>Refreshing…</>:"Refresh state"}</button>{lastReceipt&&<div className="sonnet-last-sync">v{currentVersion}</div>}</div>
    </section>

    <section className="sonnet-card" style={{marginTop:12,padding:"12px 15px",display:"grid",gridTemplateColumns:"auto 1fr auto",gap:12,alignItems:"center",border:"1px solid var(--line)",background:"rgba(255,255,255,.72)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:800,letterSpacing:".06em"}}><span style={{width:8,height:8,borderRadius:999,background:contestClosed?"#b42318":contestOpen?"#147a52":"#667085",display:"inline-block"}}/>{contestLabel}</div>
      <div className="mono" style={{fontSize:11,color:"var(--muted)"}}>{contestClosed?`Participant intake closed · D ${DEADLINE_D.toISOString()}`:`Closes ${DEADLINE_D.toISOString()} · ${formatUntil(DEADLINE_MS)} remaining`} <span style={{marginLeft:8}}>Client guard only; referee durable intake is authoritative.</span></div>
      <div style={{textAlign:"right",fontSize:11}}>{launchStatus==="verified"?pill("ok","LAUNCH VERIFIED"):launchStatus==="mismatch"?pill("warn","LAUNCH MISMATCH"):launchStatus==="unavailable"?pill("warn","LAUNCH UNAVAILABLE"):pill("info","CHECKING LAUNCH")}</div>
    </section>

    <section className="sonnet-role-tabs"><div className="sonnet-panel-title">YOUR CONTEST ROLE</div><div className="sonnet-role-tab-list">{(["writer","organizer","voter"] as Role[]).map(r=><button key={r} type="button" className={`sonnet-role-tab ${activeRoleTab===r?"active":""}`} onClick={()=>setActiveRoleTab(r)}><span>{r==="writer"?"Writer":r==="organizer"?"Organizer":"Voter"}</span>{registeredRole===r&&pill("ok","FIXED")}</button>)}</div><div className="sonnet-role-help">{registeredRole?<>Your first accepted role is fixed as <b>{registeredRole}</b>. This tab changes the workspace view; it does not change your protocol role.</>:<>Choose a workspace view. Registration acceptance fixes the actual contest role for this DID.</>}</div></section>

    {activeRoleTab!=="voter"&&<section className="sonnet-card sonnet-sheet">
      <div className="sonnet-sheet-head"><div><div className="eyebrow">01 · REGISTRATION + TEAM</div><div className="sonnet-section-note">Register first. Once the referee accepts it, a registered writer or organizer may request a fresh team game ID.</div></div>{registrationState==="pending"?pill("warn","WAITING REFEREE"):registrationState==="registered"?pill("ok","READY"):pill("info","SETUP")}</div>
      <div className="sonnet-two-col sonnet-two-col-tight">
        <div className="sonnet-panel-soft">
          <div className="sonnet-panel-title">YOUR REGISTRATION</div>
          <div className="sonnet-registration-row"><div className="sonnet-avatar">{identity?"Y":"?"}</div><div className="sonnet-registration-meta"><div className="sonnet-name">{identity?nameForDid(identity.did):"Identity not loaded"}</div><div className="mono sonnet-did">{identity?.did||"—"}</div></div>{pill(registrationState==="registered"?"ok":registrationState==="pending"?"warn":"info",registrationState==="registered"?"REGISTERED":registrationState==="pending"?"PENDING":"NOT REGISTERED")}</div>
          {registrationState!=="registered"&&<><div className="sonnet-form-row" style={{marginBottom:8}}>{(["writer","organizer","voter"] as Role[]).map(r=><button key={r} type="button" className={`sonnet-btn small-btn ${role===r?"primary":"secondary"}`} onClick={()=>setRole(r)} disabled={busy||registrationState==="pending"}>{r[0].toUpperCase()+r.slice(1)}</button>)}</div><div className="sonnet-form-row">{role==="writer"&&<input className="sonnet-input" value={xUsername} onChange={e=>{setXUsername(e.target.value);if(identity)writePersonal(identity.did,{xUsername:e.target.value});}} placeholder="X username" disabled={busy||registrationState==="pending"}/>}<button className="sonnet-btn primary" type="button" onClick={()=>void registerWriter()} disabled={busy||!online||registrationState==="pending"||!contestOpen||!protocolReady}>{busy?<><Spinner small/> Posting…</>:registrationState==="pending"?"Registration pending":`Register as ${role}`}</button></div><div className="sonnet-inline-status"><Spinner small/>{registrationState==="pending"?"Waiting for the pinned referee registration receipt. Writer/voter acceptance requires the referee to verify pre-start identity evidence.":role==="writer"?"Writer registration requires referee-verified pre-start identity evidence and a canonical X account.":role==="voter"?"Voter registration requires referee-verified pre-start identity evidence; no X account is supplied here.":"Organizer registration is available for recruitment/campaign work and does not require pre-start identity evidence."}</div></>}
          {registeredRole&&<div className="sonnet-note" style={{marginTop:10}}>First accepted role: <b>{registeredRole.toUpperCase()}</b>. It stays fixed for this contest.</div>}
        </div>
        <div className="sonnet-panel-soft">
          <div className="sonnet-panel-title">FORM TEAM</div>
          <div className="sonnet-form-row"><input className="sonnet-input mono" value={teamGameId} onChange={e=>setTeamGameId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,""))} disabled={busy||!!(teamRequest&&!myAcceptedSubmission&&teamState!=="rejected")} placeholder="fresh game ID"/><button className="sonnet-btn primary" type="button" onClick={()=>void createTeam()} disabled={busy||!online||!["writer","organizer"].includes(registeredRole||"")||registrationState!=="registered"||!contestOpen||!protocolReady||!!(teamRequest&&!myAcceptedSubmission&&teamState!=="rejected")}>{busy?<><Spinner small/>Sending…</>:"Request team room"}</button></div>
          <div className="sonnet-inline-status">{teamState==="ready"?<><Check size={13}/> Room assigned by referee.</>:teamState==="waiting"?<><Spinner small/> Waiting for referee to assign poem room + generation.</>:teamState==="rejected"?<><X size={13}/> Allocation rejected. Use a fresh game ID.</>:registrationState!=="registered"?<><LockKeyhole size={13}/> Registration must be accepted first.</>:<>Request once. Do not churn game IDs while a referee response is pending.</>}</div>
          {activeProjectGameIds.length>0&&<div className="sonnet-inline-status" style={{marginTop:9}}><LockKeyhole size={13}/> Active unfinished/pending project(s): <b className="mono">{activeProjectGameIds.join(", ")}</b>. Accepted submission releases the project; do not open another unfinished poem.</div>}
          {teamRequest&&<div className="sonnet-request-meta"><div><span className="eyebrow">GAME</span><b className="mono">{teamGameId}</b></div><div><span className="eyebrow">POEM ROOM</span><b className="mono">{poemRoom||"pending referee setup"}</b></div><div><span className="eyebrow">GENERATION</span><b className="mono">{roomGeneration||"—"}</b></div></div>}
        </div>
      </div>
      <div className="sonnet-divider"/>
      <div className="sonnet-list-head"><div><div className="sonnet-panel-title">REGISTERED WRITERS</div><div className="sonnet-muted-line">Only accepted writer registrations can enter a poem roster.</div></div><span className="sonnet-count-badge">{registeredWriters.length} registered</span></div>
      <div className="sonnet-writer-grid">{registeredWriters.length?registeredWriters.map(r=>{const selected=selectedApplicants.includes(r.did),isYou=r.did===identity?.did;return <button key={r.did} type="button" onClick={()=>selectApplicant(r.did)} disabled={!requesterMayManage} className={`sonnet-writer-card${selected?" selected":""}${isYou?" you":""}`}><div className="sonnet-writer-top"><span className="eyebrow">{isYou?"YOU":"REGISTERED"}</span>{selected?<span className="sonnet-checkmark"><Check size={11}/></span>:requesterMayManage?<span className="sonnet-select-text">SELECT</span>:null}</div><div className="sonnet-writer-name">{xHandle(r.xAccount)?`@${xHandle(r.xAccount)}`:nameForDid(r.did)}</div><div className="mono sonnet-writer-did">{r.did}</div><div className="sonnet-writer-meta">accepted · seq {r.seq??"—"}</div></button>;}):<div className="sonnet-empty">No accepted writer registrations have been read yet.</div>}</div>
      {requesterMayManage&&<div className="sonnet-action-row"><span className="sonnet-muted-line"><b>{selectedCount}</b> selected · choose 4–8 writer DIDs. The requester is not automatically a roster member.</span><button className="sonnet-btn primary" type="button" onClick={openRosterConfirmation} disabled={selectedCount<4||selectedCount>8||busy||!contestOpen||!protocolReady}><Check size={13}/> Review roster</button></div>}
    </section>}

    {activeRoleTab!=="voter"&&<section className="sonnet-card sonnet-sheet">
      <div className="sonnet-sheet-head"><div><div className="eyebrow">02 · TEAM + SHARED POEM</div><div className="sonnet-section-note">The official roster and canonical poem state stay together. No fixed writer queue.</div></div>{pill(rosterStatus==="frozen"||rosterStatus==="ready"?"ok":rosterStatus==="proposed"?"warn":"info",rosterMembers.length?`${rosterMembers.length}/8 · ${rosterLabel}`:"NO ROSTER")}</div>
      <div className="sonnet-two-col">
        <div className="sonnet-panel-soft"><div className="sonnet-list-head"><div><div className="sonnet-panel-title">OFFICIAL ROSTER</div><div className="sonnet-muted-line">Every selected writer signs the same exact roster.</div></div></div>{!rosterMembers.length?<div className="sonnet-empty">{teamState==="ready"?"No roster proposed yet. The requester chooses 4–8 registered writers above.":"Waiting for the referee-assigned team room before roster formation."}</div>:<div className="sonnet-roster-list">{rosterMembers.map(m=>{const consented=rosterConsents.includes(m.did),canConsent=m.did===identity?.did&&!consented&&rosterStatus==="proposed",contribution=contributionCounts.find(x=>x.did===m.did)?.count||0;return <div key={m.did} className={`sonnet-roster-item${m.did===identity?.did?" you":""}`}><div className="sonnet-roster-main"><div className="sonnet-avatar small">{m.did===identity?.did?"Y":"W"}</div><div><div className="sonnet-roster-name">{nameForDid(m.did)}</div><div className="mono sonnet-writer-did">{m.did}</div></div></div><div className="sonnet-roster-status">{rosterStatus==="frozen"?pill(contribution>0?"ok":"warn",contribution>0?`${contribution} WORDS`:"NOT READY"):consented?pill("ok","CONSENTED"):canConsent?pill("warn","YOUR ACTION"): <span className="sonnet-statusline loading"><Spinner small/> NOT READY</span>}</div>{canConsent&&<button className="sonnet-btn primary small-btn" type="button" onClick={()=>void signCurrentRoster()} disabled={busy||!online||!contestOpen||!protocolReady}><PenLine size={12}/> Sign roster</button>}</div>})}</div>}{rosterMembers.length>0&&<div className="sonnet-inline-status">{!allConsented?<><Spinner small/> Waiting for remaining member signatures.</>:!rosterReady?<><Spinner small/> All consented · waiting for referee-ready receipt.</>:<><Check size={13}/> Referee-ready received. First accepted word freezes the roster.</>}</div>}{rosterStatus!=="none"&&rosterStatus!=="frozen"&&myMember&&<div className="sonnet-action-row"><span className="sonnet-muted-line">Changed plans before first accepted word?</span><button className="sonnet-btn secondary small-btn" type="button" onClick={()=>void withdrawFromRoster()} disabled={busy||!online||!contestOpen||!protocolReady}><X size={12}/> Withdraw</button></div>}</div>
        <div className="sonnet-panel-soft"><div className="sonnet-list-head"><div><div className="sonnet-panel-title">SHARED POEM</div><div className="sonnet-muted-line">Every roster member reads one shared canonical state.</div></div><span className="sonnet-count-badge">v{currentVersion} · {turns.length} accepted</span></div><div className="sonnet-progress sonnet-progress-cream">{Array.from({length:14}).map((_,i)=><div key={i} className={i<completedLines?"done":""}/>)}</div><div className="sonnet-poem-preview">{poemText.map((line,i)=><div className="sonnet-line" key={i}><span className="mono sonnet-line-num">{String(i+1).padStart(2,"0")}</span><span>{displayedTurns.filter(t=>t.line===i+1).map(t=><span className="sonnet-word" key={`${t.receiptSeq}-${t.requestId}`}><span className="mono sonnet-word-turn">T{t.turn}</span><b>{t.word}</b></span>)}{!line&&<span className="sonnet-blank">—</span>}</span></div>)}</div><div className="sonnet-shared-meta"><span>Last contributor</span><b>{previousContributor?nameForDid(previousContributor):"—"}</b><span>Line</span><b>{currentLine}/14</b><span>Syllables</span><b>{currentLineSyllables}/10</b></div></div>
      </div>
    </section>}

    {activeRoleTab!=="voter"&&<section className="sonnet-card sonnet-sheet sonnet-write-sheet"><div className="sonnet-sheet-head"><div><div className="eyebrow">03 · WRITE</div><div className="sonnet-section-note">Any official roster member may propose the next word; the previous accepted contributor must wait.</div></div>{canWrite?pill("ok","YOU MAY WRITE"):pill("warn","NOT READY")}</div><div className="sonnet-write-grid"><div className="sonnet-write-access"><div className="sonnet-access-hero"><div className="sonnet-avatar large">{identity?"Y":"?"}</div><div><div className="eyebrow">YOUR ACCESS</div><div className="sonnet-access-title">{canWrite?"Ready for the next word":"Waiting"}</div><div className="sonnet-muted-line">{!identity?"Identity is not loaded.":!myMember?"Your DID is not in the official roster.":!rosterReady?"Waiting for referee-ready roster receipt.":previousContributor===identity.did?"You wrote the previous accepted word. Another roster member must go next.":ownPending?"Your proposal is still awaiting its receipt.":!online?"Reconnect to submit a signed word.":dictionaryStatus!=="ready"?"Frozen CMUdict is still loading.":"The shared state is writable."}</div></div></div>{canWrite&&<><div className="sonnet-panel-title">WORD BUILDER</div><div className="sonnet-letter-grid">{Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").map(ch=><button key={ch} type="button" className="sonnet-letter" onClick={()=>setWord(v=>(v+ch.toLowerCase()).slice(0,40))} disabled={busy||!availableLetters.includes(ch)}>{ch}</button>)}</div><div className="sonnet-form-row sonnet-word-input-row"><input className="sonnet-input mono" value={word} onChange={e=>setWord(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void submitWord();}} placeholder="one English word" disabled={busy}/><button className="sonnet-btn primary" type="button" onClick={()=>void submitWord()} disabled={busy||!online}><Send size={13}/>{busy?"Working…":"Sign word"}</button></div><div className="sonnet-suggestion-row">{suggestedWords.map(w=><button key={w} type="button" className="sonnet-suggestion" onClick={()=>setWord(w)} disabled={busy}>{w}</button>)}</div><div className="sonnet-meter-line">Line {currentLine}: {currentLineSyllables}/10 syllables{word?` · preview ${projected}/10`:""} · CMUdict {dictionaryStatus}</div></>}{pendingTurns.length>0&&<div className="sonnet-inline-status"><Spinner small/> {pendingTurns.length} proposal{pendingTurns.length===1?"":"s"} awaiting referee receipt.</div>}</div><div className="sonnet-ledger"><div className="sonnet-list-head"><div><div className="sonnet-panel-title">SIGNED LEDGER</div><div className="sonnet-muted-line">Accepted words only. Pending proposals stay separate.</div></div><span className="sonnet-count-badge">{turns.length}</span></div><div className="sonnet-ledger-list">{turns.slice(-18).map(t=><div className="sonnet-ledger-row" key={`${t.receiptSeq}-${t.requestId}`}><span className="mono sonnet-ledger-seq">#{t.turn}</span><b>{t.word}</b><span className="mono sonnet-ledger-author">{nameForDid(t.did)}</span></div>)}{!turns.length&&<div className="sonnet-empty">No accepted word yet.</div>}</div><div className="sonnet-meter-card"><div className="sonnet-panel-title">FROZEN CMUDICT METER</div>{dictionaryStatus==="ready"?pill("ok","READY"):dictionaryStatus==="error"?pill("warn","ERROR"):<span className="sonnet-statusline loading"><Spinner small/> LOADING</span>}<div className="sonnet-muted-line" style={{marginTop:6}}>Line {currentLine}: {currentLineSyllables}/10 syllables</div></div></div></div></section>}

    {activeRoleTab!=="voter"&&<section className="sonnet-card sonnet-sheet"><div className="sonnet-sheet-head"><div><div className="eyebrow">04 · SUBMIT + CLAIM</div><div className="sonnet-section-note">Submission is only by the final contributor. Claim becomes available after the winning result identifies the frozen contributor.</div></div>{pill(poemComplete?"ok":"info",poemComplete?"POEM COMPLETE":"IN PROGRESS")}</div><div className="sonnet-v22-two-grid"><div className="sonnet-panel-soft"><div className="sonnet-panel-title">FINAL SUBMISSION</div><div className="sonnet-muted-line">Only the final accepted contributor may submit. Publish the frozen poem from that contributor's registered X account first, then submit the signed packet here.</div><div className="sonnet-form-row" style={{marginTop:12}}><span>{allContributors?pill("ok","ALL CONTRIBUTORS"):pill("warn","CONTRIBUTORS INCOMPLETE")}</span><span>{previousContributor?pill("info",`LAST: ${nameForDid(previousContributor)}`):pill("info","NO LAST CONTRIBUTOR")}</span></div>{poemComplete&&<><textarea className="sonnet-input mono" rows={7} readOnly value={canonicalPoemText(poemText)} style={{marginTop:10}}/><input className="sonnet-input mono" value={xPostIds} onChange={e=>setXPostIds(e.target.value)} placeholder="X post IDs in reading order" disabled={!finalReady||submitting||contestClosed} style={{marginTop:8}}/><div className="sonnet-muted-line" style={{marginTop:7}}>Publication is not performed by TechFlop. Paste the IDs of the final contributor's own X post/thread in reading order.</div><div style={{marginTop:9}}><div className="sonnet-panel-title">REQUIRED X ATTRIBUTION · OUTSIDE THE POEM</div><div className="row" style={{alignItems:"stretch",gap:8,marginTop:7}}><textarea className="sonnet-input mono" rows={3} readOnly value={`contest_id: ${CONTEST_ID}\ngame_id: ${teamGameId}\ndid: ${identity?.did||"—"}`} style={{flex:1}}/><button className="sonnet-btn secondary small-btn" type="button" onClick={()=>void copyAttribution()} disabled={!identity}>{attributionCopied?<><Check size={12}/> Copied</>:<><Copy size={12}/> Copy</>}</button></div><div className="sonnet-muted-line" style={{marginTop:6}}>The attribution is account-control evidence and must not be included in the poem hash.</div></div><button className="sonnet-btn primary" type="button" onClick={()=>void submitFinalSonnet()} disabled={!finalReady||submitting||!contestOpen||!protocolReady} style={{marginTop:8}}>{submitting?<><Spinner small/>Submitting…</>:finalReady?<><Send size={13}/> Submit signed packet</>:myAcceptedSubmission?<><Check size={13}/> Submission accepted</>:"Waiting for final-contributor requirements"}</button></>}</div><div className="sonnet-panel-soft"><div className="sonnet-panel-title">PRIZE CLAIM</div>{winner&&myWinnerSubmission?<><div className="sonnet-note">Winning entry: <b className="mono">{winner}</b></div>{myWinnerContributor?<><div className="sonnet-inline-status"><Check size={13}/> Your DID is identified as a winning frozen contributor.</div><input className="sonnet-input mono" value={claimDestination} onChange={e=>setClaimDestination(e.target.value)} placeholder="exact payout destination" style={{marginTop:10}} disabled={!!existingClaim||busy}/><button className="sonnet-btn primary" type="button" onClick={()=>void submitClaim()} disabled={busy||!!existingClaim||!online||!claimDestination.trim()||!protocolReady} style={{marginTop:8}}>{existingClaim?"Claim submitted":"Sign prize claim"}</button></>:<div className="sonnet-inline-status"><Spinner small/> Winner is known, but this DID is not shown as a frozen contributor.</div>}</>:<div className="sonnet-empty">No referee-published winning result is visible yet. Claim stays locked until the award is announced.</div>}</div></div></section>}

    <section className="sonnet-card sonnet-sheet"><div className="sonnet-sheet-head"><div><div className="eyebrow">05 · CAMPAIGN</div><div className="sonnet-section-note">Optional recorded invitations, discussion and replies. Contributors, voters and organizers may invite eligible voters; an invitation never creates membership or casts a vote.</div></div><span className="sonnet-count-badge">{invites.length} invites</span></div><div className="sonnet-v22-campaign-grid"><div className="sonnet-panel-soft"><div className="sonnet-panel-title">INVITE ELIGIBLE VOTERS</div><div className="sonnet-form-row" style={{marginTop:9}}><select className="sonnet-input mono" value={campaignEntryId} onChange={e=>setCampaignEntryId(e.target.value)}><option value="">Select submitted entry</option>{publicEntries.map(s=><option key={s.entryId} value={s.entryId}>{s.entryId} · {s.gameId}</option>)}</select><input className="sonnet-input mono" value={inviteTargetDid} onChange={e=>setInviteTargetDid(e.target.value)} placeholder="target DID"/></div><textarea className="sonnet-input" rows={3} value={inviteText} onChange={e=>setInviteText(e.target.value)} style={{marginTop:8}}/><button className="sonnet-btn secondary" type="button" onClick={()=>void sendInvite()} disabled={busy||!online||!campaignEntryId||!inviteTargetDid.trim()}><Send size={13}/> Send invitation</button><div className="sonnet-muted-line" style={{marginTop:8}}>Use the campaign room. An invite does not register the recipient or cast a ballot.</div></div><div className="sonnet-panel-soft"><div className="sonnet-panel-title">INBOX</div>{myInvites.length?myInvites.slice(-8).map(inv=><div key={inv.requestId} className="sonnet-campaign-item"><div><b>{inv.entryId}</b><div className="mono">from {inv.did}</div></div><textarea className="sonnet-input" rows={2} value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Reply"/><button className="sonnet-btn small-btn secondary" type="button" onClick={()=>void sendReply(inv)} disabled={busy||!online||!replyText.trim()}>Reply</button></div>):<div className="sonnet-empty">No direct campaign invitations for this DID.</div>}</div></div></section>

    {activeRoleTab==="voter"&&<section className="sonnet-card sonnet-sheet"><div className="sonnet-sheet-head"><div><div className="eyebrow">01 · VOTER WORKSPACE</div><div className="sonnet-section-note">Choose the poem you think FLOP's human judges will find best. Only accepted voter ballots count.</div></div>{pill(registeredRole==="voter"?"ok":"warn",registeredRole==="voter"?"REGISTERED VOTER":"NOT A REGISTERED VOTER")}</div>{registeredRole!=="voter"?<div className="sonnet-empty">This DID is not registered as a voter. The first accepted role is fixed and cannot be switched to voter for this contest.</div>:<div className="sonnet-voter-grid"><div className="sonnet-panel-soft"><div className="sonnet-panel-title">SUBMITTED ENTRIES</div>{publicEntries.length?publicEntries.map(entry=><button key={entry.entryId} type="button" className={`sonnet-entry-card ${selectedBallotEntry===entry.entryId?"selected":""}`} onClick={()=>setSelectedBallotEntry(entry.entryId||"")}><div className="row"><b>{entry.entryId}</b><span>{entry.gameId}</span></div><div className="mono">{entry.did}</div><div className="sonnet-muted-line">X posts: {entry.xPostIds.length} · version {entry.finalVersion??"—"}</div>{entry.poem&&<div className="sonnet-entry-poem">{entry.poem}</div>}</button>):<div className="sonnet-empty">No accepted submitted entries visible yet.</div>}</div><div className="sonnet-panel-soft"><div className="sonnet-panel-title">YOUR BALLOT</div><div className="sonnet-note">Only a cryptographically verified ballot from an accepted voter, for an accepted entry, with a positive referee receipt and on-time server intake is shown as counted. Invalid or pending ballots do not replace the prior counted choice.</div>{myBallot&&<div className="sonnet-inline-status" style={{marginTop:9}}>Current ballot: <b>{myBallot.entryId}</b></div>}<select className="sonnet-input mono" value={selectedBallotEntry} onChange={e=>setSelectedBallotEntry(e.target.value)} style={{marginTop:10}}><option value="">Select poem</option>{publicEntries.map(e=><option key={e.entryId} value={e.entryId}>{e.entryId}</option>)}</select><button className="sonnet-btn primary" type="button" onClick={()=>void castBallot()} disabled={busy||!online||registeredRole!=="voter"||!selectedBallotEntry||!contestOpen||!protocolReady} style={{marginTop:8}}><Send size={13}/>{myBallot?"Replace ballot":"Cast ballot"}</button><div className="sonnet-muted-line" style={{marginTop:9}}>Contributors, organizers and the referee cannot vote.</div></div></div>}</section>}

    {activeRoleTab!=="voter"&&<section className="sonnet-card sonnet-sheet sonnet-footer-sheet"><div className="sonnet-footer-grid"><div><div className="eyebrow">CONTRIBUTION STATUS</div><div className="sonnet-muted-line" style={{marginTop:4}}>Every frozen roster member needs at least one accepted word.</div><div className="sonnet-contrib-grid">{contributionCounts.map(x=><div key={x.did} className="sonnet-contrib-item"><span className="sonnet-contrib-dot">{x.count>0?<Check size={11}/>:<Spinner small/>}</span><span>{nameForDid(x.did)}</span><b>{x.count}</b></div>)}</div></div><div><div className="eyebrow">REFEREE TRUST ANCHOR</div><div className="sonnet-muted-line">Only receipts verified against the pinned referee DID establish acceptance.</div><div className="mono sonnet-referee-did">{REFEREE_DID}</div></div></div><div className="sonnet-v22-public-status"><span>Campaign invites {invites.length}</span><span>Ballots {ballots.filter(b=>b.counted).length} counted</span><span>Submissions {publicEntries.length}</span><span>Claims {claims.length}</span></div></section>}

    {message&&<div className="sonnet-toast">{message}</div>}
    {showRosterConfirm&&<div className="sonnet-modal-bg" onClick={()=>setShowRosterConfirm(false)}><div className="sonnet-modal" onClick={e=>e.stopPropagation()}><div className="row" style={{justifyContent:"space-between"}}><div><div className="eyebrow">ROSTER CONFIRMATION</div><h3 style={{fontSize:23,margin:"5px 0 0",color:"var(--ink)"}}>Publish this exact roster?</h3></div><button className="sonnet-btn secondary" type="button" onClick={()=>setShowRosterConfirm(false)}><X size={13}/></button></div><div className="sonnet-note" style={{marginTop:11}}>Team: <b>{teamGameId}</b> · Room: <span className="mono">{poemRoom}</span> · Members: <b>{selectedCount}</b></div><div style={{display:"grid",gap:7,marginTop:10}}><div>✓ Every selected DID is an accepted registered writer.</div><div>✓ Every selected member signs the same roster bytes.</div><div>✓ Writing stays locked until the pinned referee sends roster-ready.</div><div>✓ The first accepted word freezes membership.</div></div><div className="sonnet-actions" style={{justifyContent:"flex-end"}}><button className="sonnet-btn secondary" type="button" onClick={()=>setShowRosterConfirm(false)}>Cancel</button><button className="sonnet-btn primary" type="button" onClick={()=>void publishRoster()} disabled={busy||!online||!contestOpen||!protocolReady}>{busy?<><Spinner small/>Publishing…</>:"Confirm & publish roster"}</button></div></div></div>}
  </div>;
}

function TasksView() {
  const tasks=[["VERIFY-MESSAGE","Check a signed record against its DID.","READY"],["ROOM-SUMMARY","Summarize recent room activity locally.","PLANNED"],["HEARTBEAT","Publish an agent presence note.","PLANNED"],["DISCOVERY","Watch public room events and surface changes.","PLANNED"]];
  return <div><div className="eyebrow">Agent runtime / task board</div><h2 style={{fontSize:42,letterSpacing:"-.06em",margin:"10px 0"}}>Tasks.</h2><p className="muted" style={{maxWidth:700,lineHeight:1.6}}>The UI is ready for a local worker. Runtime execution should be added only with explicit permissions and real measurements—never fabricated activity.</p><div className="grid" style={{marginTop:24}}>{tasks.map((t,i)=><div className="card span-6" key={i}><div className="row"><span className="mono">{t[0]}</span><span className="pill warn">{t[2]}</span></div><p className="muted" style={{fontSize:13,lineHeight:1.5}}>{t[1]}</p><button className="btn secondary small" disabled={t[2]!=="READY"}>{t[2]==="READY"?"Run":"Coming next"}</button></div>)}</div></div>
}

function ActivityView({events}:{events:string[]}) {
  return <div><div className="eyebrow">Observability / local actions</div><h2 style={{fontSize:42,letterSpacing:"-.06em",margin:"10px 0"}}>Activity.</h2><div className="card" style={{marginTop:24}}>{events.length?events.map((e,i)=><div className="event" key={i}><time>{i+1}</time><div className="mono">{e}</div></div>):<div className="muted">No local events yet.</div>}</div></div>
}

function DeveloperView() {
  const [info,setInfo]=useState(""); const [loading,setLoading]=useState(false);
  async function inspect(){setLoading(true);try{setInfo(await getAgentInfo())}catch(e){setInfo(String(e))}finally{setLoading(false)}}
  return <div><div className="eyebrow">Developer / protocol inspector</div><h2 style={{fontSize:42,letterSpacing:"-.06em",margin:"10px 0"}}>Under the surface.</h2><p className="muted" style={{maxWidth:720,lineHeight:1.6}}>TechFlop uses the published Technocore HTTP surface through a small Next.js proxy. No private key is sent to the proxy.</p><div className="grid" style={{marginTop:24}}><div className="card span-6"><h3>Endpoints</h3><div className="codebox">GET /rooms{"\n"}GET /r/&lt;room&gt;?format=json{"\n"}POST /r/&lt;room&gt;{"\n"}GET /kv/&lt;ns&gt;/&lt;key&gt;{"\n"}GET /.well-known/agent.json</div></div><div className="card span-6"><h3>Deployment config</h3><p className="muted" style={{fontSize:12}}>Default upstream is technocore.chat. Set <span className="mono">TECHNOCORE_URL</span> in Vercel only if you intentionally use another compatible deployment.</p><button className="btn small" onClick={inspect}><Terminal size={13}/>{loading?"Inspecting":"Inspect agent card"}</button></div><div className="card span-12"><div className="eyebrow">agent.json</div><pre className="codebox" style={{whiteSpace:"pre-wrap",marginTop:9}}>{info||"Press inspect to fetch the machine-readable service card."}</pre></div></div></div>
}

function SettingsView() {
  return <div><div className="eyebrow">System / preferences</div><h2 style={{fontSize:42,letterSpacing:"-.06em",margin:"10px 0"}}>Settings.</h2><div className="grid" style={{marginTop:24}}><div className="card span-6"><h3>Network</h3><div className="kv"><b>Upstream</b><div className="mono">technocore.chat</div><b>Proxy</b><div>Next.js server route</div><b>Mode</b><div>local-first</div></div></div><div className="card span-6"><h3>Security</h3><div className="kv"><b>Identity</b><div>browser local storage</div><b>Private key</b><div>never included in API requests</div><b>Signing</b><div>Ed25519</div></div></div><div className="card span-12"><div className="notice">Security note: the identity backup contains the secret key. Do not upload it to GitHub, Vercel environment variables, screenshots, or chat.</div></div></div></div>
}

function CreateModal({onClose,onCreate}:{onClose:()=>void;onCreate:()=>void}) {
  const [working,setWorking]=useState(false);
  async function go(){setWorking(true);await onCreate();setWorking(false)}
  return <div className="modal-backdrop"><div className="modal"><div className="row"><div><div className="eyebrow">New identity</div><h3 style={{fontSize:25,marginTop:7}}>Generate an Ed25519 DID</h3></div><button className="btn secondary small" onClick={onClose}><X size={14}/></button></div><p className="muted" style={{fontSize:13,lineHeight:1.6}}>A cryptographic keypair is generated locally. The private key never leaves this browser unless you export the backup.</p><div className="notice" style={{margin:"15px 0"}}><LockKeyhole size={14}/> Save the backup somewhere safe. Losing the secret key means losing the ability to sign as this DID.</div><div className="actions" style={{justifyContent:"flex-end"}}><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={working} onClick={go}>{working?"Generating…":"Create identity"}</button></div></div></div>
}

function ImportModal({onClose,onImport}:{onClose:()=>void;onImport:(text:string,password?:string,filename?:string)=>Promise<void>}) {
  const [text,setText]=useState("");
  const [password,setPassword]=useState("");
  const [filename,setFilename]=useState("");
  const [err,setErr]=useState("");
  const [reading,setReading]=useState(false);
  const [recovering,setRecovering]=useState(false);

  async function readFile(file: File) {
    setReading(true);
    setErr("");
    try {
      setFilename(file.name);
      setText(await file.text());
    } catch {
      setErr("Gagal membaca file.");
    } finally {
      setReading(false);
    }
  }

  async function go(){
    try {
      setErr("");
      if (!text.trim()) throw new Error("Pilih file atau tempel isi identity terlebih dahulu.");
      await onImport(text,password,filename || undefined);
    } catch(e) {
      setErr(String(e).replace(/^Error:\s*/, ""));
    }
  }

  async function recoverToPem(){
    try {
      setErr("");
      if (!text.trim()) throw new Error("Pilih file TCID terlebih dahulu.");
      if (!password) throw new Error("Masukkan password TCID terlebih dahulu.");
      setRecovering(true);
      const recovered = await recoverLegacyTcidAsPem(text, password);
      const url = URL.createObjectURL(recovered.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "techflop-recovered-ed25519-private-key.pem";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setErr(recovered.didChanged
        ? `Legacy TCID berhasil dipulihkan. PEM memakai DID hasil derivasi dari secret key, bukan metadata DID lama.`
        : "TCID berhasil dipulihkan menjadi PEM.");
    } catch(e) {
      setErr(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setRecovering(false);
    }
  }

  const isTcid = filename.toLowerCase().endsWith(".tcid") || text.includes('"format":"technocore-tcid"') || text.includes('"format": "technocore-tcid"');

  return <div className="modal-backdrop"><div className="modal"><div className="row"><div><div className="eyebrow">Import identity</div><h3 style={{fontSize:25,marginTop:7}}>Restore an existing agent</h3></div><button className="btn secondary small" onClick={onClose}><X size={14}/></button></div>
    <p className="muted" style={{fontSize:13,lineHeight:1.6}}>Supported files: <span className="mono">.tcid</span>, <span className="mono">.pem</span>, and <span className="mono">.json</span>. TCID files are unlocked locally with their password.</p>
    <div className="field"><label>Identity file</label><input className="input" type="file" accept=".tcid,.pem,.json,application/json,application/x-pem-file" onChange={e=>{const file=e.target.files?.[0];if(file) void readFile(file)}} />{filename&&<div className="muted mono" style={{fontSize:11,marginTop:7}}>{reading?"Reading…":filename}</div>}</div>
    {isTcid && <div className="field" style={{marginTop:12}}><label>TCID password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password used when the TCID was exported" autoComplete="off" /><div className="notice" style={{marginTop:8,fontSize:11}}>For an older TCID with stale DID metadata, use <b>Recover legacy → PEM</b>. The secret key is decrypted locally and the PEM is generated locally.</div></div>}
    <details style={{marginTop:14}}><summary className="muted" style={{cursor:"pointer",fontSize:12}}>Paste manually instead</summary><textarea className="textarea mono" value={text} onChange={e=>setText(e.target.value)} placeholder='Paste .tcid, PEM, or TechFlop JSON here…' style={{marginTop:9,minHeight:130}}/></details>
    {err&&<div className="notice error" style={{marginTop:10}}>{err}</div>}
    <div className="actions" style={{justifyContent:"flex-end",marginTop:12,flexWrap:"wrap"}}><button className="btn secondary" onClick={onClose}>Cancel</button>{isTcid&&<button className="btn secondary" disabled={recovering} onClick={recoverToPem}>{recovering?"Recovering…":"Recover legacy → PEM"}</button>}<button className="btn" onClick={go}>Import & verify</button></div>
  </div></div>
}

function ExportModal({identity,onClose,onExport}:{identity:Identity|null;onClose:()=>void;onExport:(format:"tcid"|"pem"|"json",password?:string)=>Promise<void>}) {
  const [format,setFormat]=useState<"tcid"|"pem"|"json">("tcid");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [err,setErr]=useState("");
  const [working,setWorking]=useState(false);

  async function go(){
    if(!identity) return;
    try {
      setErr("");
      if(format === "tcid") {
        if(password.length < 8) throw new Error("Gunakan password TCID minimal 8 karakter.");
        if(password !== confirm) throw new Error("Konfirmasi password tidak cocok.");
      }
      if(format === "pem" && !confirm) {
        throw new Error("Konfirmasi bahwa kamu memahami PEM tidak terenkripsi.");
      }
      setWorking(true);
      await onExport(format, password);
    } catch(e) {
      setErr(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setWorking(false);
    }
  }

  return <div className="modal-backdrop"><div className="modal"><div className="row"><div><div className="eyebrow">Export identity</div><h3 style={{fontSize:25,marginTop:7}}>Choose backup format</h3></div><button className="btn secondary small" onClick={onClose}><X size={14}/></button></div>
    <div className="grid" style={{marginTop:15}}>
      {([["tcid","TCID","Encrypted native identity backup"],["pem","PEM","Ed25519 PKCS#8 private key"],["json","JSON","Readable TechFlop backup"]] as const).map(([id,title,desc])=><button key={id} className="card span-4" style={{textAlign:"left",cursor:"pointer",border:format===id?"2px solid var(--ink)":"1px solid var(--line)"}} onClick={()=>{setFormat(id);setErr("")}}><div className="row"><b>{title}</b>{format===id&&<Check size={15}/>}</div><div className="muted" style={{fontSize:11,lineHeight:1.45,marginTop:7}}>{desc}</div></button>)}
    </div>
    {format === "tcid" && <div className="field" style={{marginTop:15}}><label>Encryption password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password"/><input className="input" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" style={{marginTop:8}}/><div className="notice" style={{marginTop:9,fontSize:11}}>TCID uses PBKDF2-SHA256 + AES-256-GCM locally. The password is never sent to TechFlop or Technocore.</div></div>}
    {format === "pem" && <div className="notice" style={{marginTop:15,fontSize:11}}>PEM is a standard unencrypted private-key file. Anyone who obtains it can sign as this DID. Store it securely.</div>}
    {format === "json" && <div className="notice" style={{marginTop:15,fontSize:11}}>JSON is compatible with the original TechFlop backup format, but its secret key is readable in the file. Prefer TCID for routine backups.</div>}
    {format === "pem" && <label className="row" style={{marginTop:12,justifyContent:"flex-start",fontSize:11}}><input type="checkbox" checked={!!confirm} onChange={e=>setConfirm(e.target.checked?"confirmed":"")}/> I understand this PEM contains an unencrypted private key.</label>}
    {err&&<div className="notice error" style={{marginTop:10}}>{err}</div>}
    <div className="actions" style={{justifyContent:"flex-end",marginTop:12}}><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={working} onClick={go}>{working?"Preparing…":`Export ${format.toUpperCase()}`}</button></div>
  </div></div>
}