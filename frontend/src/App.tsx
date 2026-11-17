import { useCallback, useEffect, useState, type FormEvent } from "react";
type Redirect = {
  uuid: string;
  source: string;
  target: string;
  stats: {
    totalRedirects: number;
    redirectCounts: Record<string, number>;
  } | null;
};
export default function App() {
  const [range, setRange] = useState(7);
  const [token, setToken] = useState(
      () => sessionStorage.getItem("pageflare-token") ?? "",
    ),
    [data, setData] = useState<Redirect[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  const load = useCallback(async () => {
    if (!token) return;
    const response = await fetch(`${base}/api/ui-data`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) {
      sessionStorage.removeItem("pageflare-token");
      setToken("");
      throw new Error("Session expired; sign in again");
    }
    if (!response.ok) throw new Error("Unable to load redirects");
    setData((await response.json()).stats);
  }, [base, token]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  async function submit(e: FormEvent<HTMLFormElement>, login: boolean) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${base}/api/${login ? "login" : "configs"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(values),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Request failed");
      if (login) {
        sessionStorage.setItem("pageflare-token", result.token);
        setToken(result.token);
      } else {
        form.reset();
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network unavailable");
    } finally {
      setBusy(false);
    }
  }
  if (!token)
    return (
      <main className="login">
        <p className="brand">Pageflare / Redirect</p>
        <h1>Manage your redirects</h1>
        <p className="muted">Sign in to review destinations and traffic</p>
        <form onSubmit={(e) => submit(e, true)}>
          <label>
            Username
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </main>
    );
  const count = (r: Redirect) => {
    if (!range) return r.stats?.totalRedirects ?? 0;
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - range + 1);
    start.setUTCHours(0, 0, 0, 0);
    return Object.entries(r.stats?.redirectCounts ?? {}).reduce(
      (sum, [day, total]) => {
        const at = Date.parse(day);
        return at >= start.getTime() && at <= end.getTime() ? sum + total : sum;
      },
      0,
    );
  };
  const filtered = data.filter((r) =>
    `${r.source} ${r.target}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <main>
      <header>
        <p className="brand">Pageflare / Redirect</p>
        <button
          onClick={() => {
            sessionStorage.removeItem("pageflare-token");
            setToken("");
            setData([]);
          }}
        >
          Sign out
        </button>
      </header>
      <h1>Redirects</h1>
      <p className="muted">
        {data.length} destinations ·{" "}
        {data
          .reduce((sum, r) => sum + (r.stats?.totalRedirects ?? 0), 0)
          .toLocaleString()}{" "}
        total requests
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <form className="panel" onSubmit={(e) => submit(e, false)}>
        <h2>Add redirect</h2>
        <div className="grid">
          <label>
            Source hostname
            <input name="source" placeholder="status.example.com" required />
          </label>
          <label>
            Destination URL
            <input
              name="target"
              type="url"
              placeholder="https://example.com/status"
              required
            />
          </label>
          <button disabled={busy}>{busy ? "Saving…" : "Add redirect"}</button>
        </div>
      </form>
      <label>
        Time range
        <select
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={365}>Last 365 days</option>
          <option value={0}>All time</option>
        </select>
      </label>
      <label>
        Search
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {!filtered.length && (
        <p className="muted">No redirects match this view</p>
      )}
      {filtered.map((r) => (
        <article className="row" key={r.uuid}>
          <div>
            <strong>{r.source}</strong>
            <p>
              <a href={r.target} rel="noreferrer" target="_blank">
                {r.target}
              </a>
            </p>
          </div>
          <span>{count(r).toLocaleString()} requests</span>
        </article>
      ))}
    </main>
  );
}
