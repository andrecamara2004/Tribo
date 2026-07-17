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
import { Shell } from "../components/Shell";
import { Spinner } from "../components/Spinner";
import { Icon } from "../components/Icon";
import { LocationPicker } from "../components/MapView";

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
  // volunteer-event fields
  eventKind: "RUN",
  host: "",
  distanceKm: "",
  verifiedBy: "PEER",
  staffCapacity: "0",
  pointsParticipant: "0",
  pointsStaff: "0",
  tags: "",
  latitude: "",
  longitude: "",
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
          eventKind: a.eventKind ?? "RUN",
          host: a.host ?? "",
          distanceKm: a.distanceKm ? String(a.distanceKm) : "",
          verifiedBy: a.verifiedBy ?? "PEER",
          staffCapacity: String(a.staffCapacity ?? 0),
          pointsParticipant: String(a.pointsParticipant ?? 0),
          pointsStaff: String(a.pointsStaff ?? 0),
          tags: (a.tags ?? []).join(", "),
          latitude: a.latitude != null ? String(a.latitude) : "",
          longitude: a.longitude != null ? String(a.longitude) : "",
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

    const isVolunteer = form.eventKind === "VOLUNTEER";
    const input: ActivityInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      location: form.location.trim(),
      startsAt: localInputToIso(form.startsAt),
      endsAt: localInputToIso(form.endsAt),
      capacity,
      eventKind: form.eventKind as ActivityInput["eventKind"],
      ...(form.latitude && form.longitude && {
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      }),
      ...(isVolunteer && {
        host: form.host.trim(),
        distanceKm: Number(form.distanceKm) || 0,
        verifiedBy: form.verifiedBy as ActivityInput["verifiedBy"],
        staffCapacity: Number(form.staffCapacity) || 0,
        pointsParticipant: Number(form.pointsParticipant) || 0,
        pointsStaff: Number(form.pointsStaff) || 0,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
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

  if (loading)
    return (
      <Shell>
        <Spinner label="Loading…" />
      </Shell>
    );

  return (
    <Shell>
      <div className="page-narrow">
        <button className="back-link" onClick={() => navigate(-1)}>
          <Icon name="back" size={15} /> Back
        </button>

        <div className="topbar">
          <div>
            <h1>{editing ? "Edit activity" : "Host an event"}</h1>
            <div className="sub">
              {editing ? "Update the details below" : "Set up a new volunteer run or clean-up"}
            </div>
          </div>
        </div>

        <form className="card" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" value={form.title} onChange={(e) => update("title", e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="category">Category</label>
            <input id="category" placeholder="e.g. river, trail, beach" value={form.category}
              onChange={(e) => update("category", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="location">Location</label>
            <input id="location" value={form.location} onChange={(e) => update("location", e.target.value)} />
          </div>

          <div className="field">
            <label>Pin on map {form.latitude ? "" : "(optional — click to place)"}</label>
            <div className="map-box">
              <LocationPicker
                lat={form.latitude ? Number(form.latitude) : null}
                lng={form.longitude ? Number(form.longitude) : null}
                onPick={(la, lo) => setForm((f) => ({ ...f, latitude: la.toFixed(6), longitude: lo.toFixed(6) }))}
              />
            </div>
            {form.latitude && (
              <div className="hint">
                Pin: {Number(form.latitude).toFixed(4)}, {Number(form.longitude).toFixed(4)}
                <button type="button" onClick={() => setForm((f) => ({ ...f, latitude: "", longitude: "" }))}
                  style={{ marginLeft: 8, background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer" }}>
                  clear
                </button>
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="startsAt">Starts</label>
            <input id="startsAt" type="datetime-local" value={form.startsAt}
              onChange={(e) => update("startsAt", e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="endsAt">Ends</label>
            <input id="endsAt" type="datetime-local" value={form.endsAt}
              onChange={(e) => update("endsAt", e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="capacity">Capacity (participants)</label>
            <input id="capacity" type="number" min={1} value={form.capacity}
              onChange={(e) => update("capacity", e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="eventKind">Event type</label>
            <select id="eventKind" value={form.eventKind} onChange={(e) => update("eventKind", e.target.value)}>
              <option value="RUN">Run / activity</option>
              <option value="VOLUNTEER">Volunteer event (staff + participants)</option>
            </select>
          </div>

          {form.eventKind === "VOLUNTEER" && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginBottom: 8 }}>
              <div className="field">
                <label htmlFor="host">Hosted by</label>
                <input id="host" value={form.host} placeholder="Forest Runners / Quercus"
                  onChange={(e) => update("host", e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="distanceKm">Distance (km)</label>
                  <input id="distanceKm" type="number" step="0.1" min="0" value={form.distanceKm}
                    onChange={(e) => update("distanceKm", e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="verifiedBy">Verification</label>
                  <select id="verifiedBy" value={form.verifiedBy} onChange={(e) => update("verifiedBy", e.target.value)}>
                    <option value="PEER">Peer-verified</option>
                    <option value="PARTNER">Partner-verified</option>
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="staffCapacity">Staff spots</label>
                  <input id="staffCapacity" type="number" min="0" value={form.staffCapacity}
                    onChange={(e) => update("staffCapacity", e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="tags">Tags (comma-separated)</label>
                  <input id="tags" value={form.tags} placeholder="river, easy"
                    onChange={(e) => update("tags", e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="pointsParticipant">Participant points</label>
                  <input id="pointsParticipant" type="number" min="0" value={form.pointsParticipant}
                    onChange={(e) => update("pointsParticipant", e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="pointsStaff">Staff points</label>
                  <input id="pointsStaff" type="number" min="0" value={form.pointsStaff}
                    onChange={(e) => update("pointsStaff", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="action-row" style={{ marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create activity"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
