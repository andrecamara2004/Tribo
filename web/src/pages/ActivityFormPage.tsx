// src/pages/ActivityFormPage.tsx
//
// Shared create + edit form. With an :id route param it loads and edits;
// without one it creates. Role-gated by the route in App.tsx.
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createActivity,
  getActivity,
  updateActivity,
  type ActivityInput,
} from "../api/activities";
import { ApiError } from "../api/http";

/** ISO-8601 instant → value for <input type="datetime-local"> (local time). */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value (local) → ISO-8601 instant (UTC, with Z). */
function localInputToIso(local: string): string {
  return new Date(local).toISOString();
}

const empty = {
  title: "",
  description: "",
  category: "",
  location: "",
  startsAt: "",
  endsAt: "",
  capacity: "10",
};

export function ActivityFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState({ ...empty });
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        const a = await getActivity(id!);
        setForm({
          title: a.title,
          description: a.description,
          category: a.category,
          location: a.location,
          startsAt: isoToLocalInput(a.startsAt),
          endsAt: isoToLocalInput(a.endsAt),
          capacity: String(a.capacity),
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load activity.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const capacity = Number(form.capacity);
    if (!form.title.trim()) return setError("Title is required.");
    if (!form.startsAt || !form.endsAt) return setError("Start and end times are required.");
    if (new Date(form.endsAt) <= new Date(form.startsAt)) return setError("End must be after start.");
    if (!Number.isInteger(capacity) || capacity < 1) return setError("Capacity must be a whole number ≥ 1.");

    const input: ActivityInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      location: form.location.trim(),
      startsAt: localInputToIso(form.startsAt),
      endsAt: localInputToIso(form.endsAt),
      capacity,
    };

    setBusy(true);
    try {
      const saved = editing ? await updateActivity(id!, input) : await createActivity(input);
      navigate(`/activities/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p style={{ padding: 24, fontFamily: "system-ui" }}>Loading…</p>;

  const field = { display: "block", width: "100%", marginBottom: 8, padding: 8 } as const;

  return (
    <div style={{ maxWidth: 480, margin: "48px auto", fontFamily: "system-ui", padding: "0 16px" }}>
      <h1>{editing ? "Edit activity" : "Create activity"}</h1>
      <form onSubmit={onSubmit}>
        <input placeholder="Title" value={form.title} onChange={(e) => update("title", e.target.value)} required style={field} />
        <textarea placeholder="Description" value={form.description} onChange={(e) => update("description", e.target.value)} style={{ ...field, minHeight: 80 }} />
        <input placeholder="Category (e.g. sports)" value={form.category} onChange={(e) => update("category", e.target.value)} style={field} />
        <input placeholder="Location" value={form.location} onChange={(e) => update("location", e.target.value)} style={field} />
        <label style={{ fontSize: 13, color: "#555" }}>Starts</label>
        <input type="datetime-local" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} required style={field} />
        <label style={{ fontSize: 13, color: "#555" }}>Ends</label>
        <input type="datetime-local" value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} required style={field} />
        <input type="number" placeholder="Capacity" value={form.capacity} onChange={(e) => update("capacity", e.target.value)} required style={field} />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={busy} style={{ padding: 10 }}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create"}
          </button>
          <button type="button" onClick={() => navigate(-1)} style={{ padding: 10 }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
