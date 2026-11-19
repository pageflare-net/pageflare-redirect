import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
  const [editing, setEditing] = useState<Redirect | null>(null);
  const [deleting, setDeleting] = useState<Redirect | null>(null);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (deleting) dialog.current?.showModal();
    else dialog.current?.close();
  }, [deleting]);
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
        setMessage("Redirect created");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network unavailable");
    } finally {
      setBusy(false);
    }
  }
  async function changeConfig(
    item: Redirect,
    method: "PATCH" | "DELETE",
    values?: Record<string, FormDataEntryValue>,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${base}/api/configs/${item.uuid}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        ...(values ? { body: JSON.stringify(values) } : {}),
      });
      if (!response.ok) {
        const value = await response.json();
        throw new Error(value.message ?? "Unable to save redirect");
      }
      if (method === "DELETE") {
        setData((current) =>
          current.filter((value) => value.uuid !== item.uuid),
        );
        setDeleting(null);
        setMessage("Redirect deleted");
      } else {
        const value = await response.json();
        setData((current) =>
          current.map((row) =>
            row.uuid === item.uuid ? { ...row, ...value.config } : row,
          ),
        );
        setEditing(null);
        setMessage("Redirect updated");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save redirect",
      );
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
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  return (
    <main>
      <header>
        <p className="brand">Pageflare / Redirect</p>
        <button
          onClick={() => {
            sessionStorage.removeItem("pageflare-token");
            setToken("");
            setData([]);
            setEditing(null);
            setDeleting(null);
            setError("");
            setMessage("");
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
      {error && !deleting && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
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
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {!filtered.length && (
        <p className="muted">
          {data.length
            ? "No redirects match this view"
            : "No redirects configured. Add a source hostname and destination above."}
        </p>
      )}
      {visible.map((r) =>
        editing?.uuid === r.uuid ? (
          <form
            className="panel"
            key={r.uuid}
            onSubmit={(event) => {
              event.preventDefault();
              void changeConfig(
                r,
                "PATCH",
                Object.fromEntries(new FormData(event.currentTarget)),
              );
            }}
          >
            <h2>Edit redirect</h2>
            <div className="grid">
              <label>
                Source hostname
                <input name="source" required defaultValue={r.source} />
              </label>
              <label>
                Destination URL
                <input
                  name="target"
                  type="url"
                  required
                  defaultValue={r.target}
                />
              </label>
              <button disabled={busy}>Save redirect</button>
            </div>
            <div className="actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setError("");
                }}
              >
                Cancel edit
              </button>
              <span className="muted">
                Existing analytics are retained when you edit a redirect.
              </span>
            </div>
          </form>
        ) : (
          <article className="row" key={r.uuid}>
            <div>
              <strong>{r.source}</strong>
              <p>
                <a href={r.target} rel="noreferrer" target="_blank">
                  {r.target}
                </a>
              </p>
            </div>
            <div className="redirect-controls">
              <span>{count(r).toLocaleString()} requests</span>
              <button
                disabled={busy}
                aria-label={`Edit ${r.source}`}
                onClick={() => {
                  setEditing(r);
                  setError("");
                  setMessage("");
                }}
              >
                Edit
              </button>
              <button
                disabled={busy}
                aria-label={`Delete ${r.source}`}
                onClick={() => {
                  setDeleting(r);
                  setError("");
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ),
      )}
      {filtered.length > 0 && (
        <nav className="pagination" aria-label="Redirect pagination">
          <button
            disabled={currentPage === 1 || busy}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {pageCount} · {filtered.length} redirects
          </span>
          <button
            disabled={currentPage === pageCount || busy}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </nav>
      )}
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setDeleting(null);
        }}
        aria-labelledby="delete-redirect-title"
      >
        <h2 id="delete-redirect-title">Delete this redirect?</h2>
        <p>{deleting?.source}</p>
        <p>
          This removes the redirect and its recorded analytics. It does not
          change DNS.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          <button disabled={busy} onClick={() => setDeleting(null)}>
            Keep redirect
          </button>
          <button
            disabled={busy}
            className="danger"
            onClick={() => deleting && void changeConfig(deleting, "DELETE")}
          >
            {busy ? "Deleting…" : "Delete redirect"}
          </button>
        </div>
      </dialog>
    </main>
  );
}
