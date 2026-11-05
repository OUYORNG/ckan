import { useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, LoaderCircle, Trash2 } from "lucide-react";
import { request } from "./api";
import { FormError } from "./components";
import { DatasetRows } from "./dataset-layout";
import { useSession } from "./session";
import type { Dataset } from "./types";

type Operation = "private" | "public" | "delete";
const operationLabels = {
  private: "Make private",
  public: "Make public",
  delete: "Delete datasets",
};
// Keep native CKAN URLs working while using the single organization Datasets tab.
export function OrganizationDatasets() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set("edit", "true");
  next.set("layout", "rows");
  return (
    <Navigate
      replace
      to={"/organization/" + encodeURIComponent(id) + "?" + next.toString()}
    />
  );
}
export function DatasetBulkEditor({
  organizationId,
  datasets,
  onApplied,
}: {
  organizationId: string;
  datasets: Dataset[];
  onApplied: (message: string, operation: Operation) => void;
}) {
  const { session } = useSession();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Operation>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  function select(id: string, checked: boolean) {
    setPending(undefined);
    setSelected((current) => {
      const next = new Set(current);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }
  async function apply() {
    if (!session || !pending || !selected.size || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const response = await request<{ count: number; operation: Operation }>(
        `organizations/${encodeURIComponent(organizationId)}/datasets/bulk`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": session.csrf_token,
          },
          body: JSON.stringify({ operation: pending, datasets: [...selected] }),
        },
      );
      onApplied(
        `${response.count} dataset${response.count === 1 ? "" : "s"} ${response.operation === "delete" ? "deleted" : "made " + response.operation}.`,
        response.operation,
      );
      setSelected(new Set());
      setPending(undefined);
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception
          : new Error("The datasets could not be updated."),
      );
    } finally {
      setBusy(false);
    }
  }
  const selectedDatasets = datasets.filter((dataset) =>
    selected.has(dataset.id),
  );
  return (
    <>
      <FormError error={error} />
      {
        <div className="bulk-toolbar">
          <label>
            <input
              type="checkbox"
              aria-label="Select all datasets on this page"
              disabled={busy || !datasets.length}
              checked={
                datasets.length > 0 &&
                datasets.every((dataset) => selected.has(dataset.id))
              }
              onChange={(event) => {
                setPending(undefined);
                setSelected(
                  event.target.checked
                    ? new Set(datasets.map((dataset) => dataset.id))
                    : new Set(),
                );
              }}
            />
            Select this page
          </label>
          <span role="status">{selected.size} selected</span>
          <div className="bulk-actions">
            <button
              className="button button-outline"
              disabled={!selected.size || busy}
              onClick={() => setPending("private")}
            >
              <EyeOff size={15} />
              Make private
            </button>
            <button
              className="button button-outline"
              disabled={!selected.size || busy}
              onClick={() => setPending("public")}
            >
              <Eye size={15} />
              Make public
            </button>
            <button
              className="button button-danger"
              disabled={!selected.size || busy}
              onClick={() => setPending("delete")}
            >
              <Trash2 size={15} />
              Delete datasets
            </button>
          </div>
        </div>
      }
      {pending && (
        <section
          className="bulk-confirmation panel"
          role="region"
          aria-label="Confirm bulk action"
        >
          <h2>
            {operationLabels[pending]}: {selected.size} selected
          </h2>
          <p>
            {pending === "public"
              ? "These datasets and their resources will be accessible to everyone."
              : pending === "private"
                ? "These datasets will be visible only to authorized users."
                : "These datasets will be removed from the active catalog. This does not permanently purge their stored files."}
          </p>
          <ul>
            {selectedDatasets.map((dataset) => (
              <li key={dataset.id}>{dataset.title || dataset.name}</li>
            ))}
          </ul>
          <div className="form-actions">
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => setPending(undefined)}
            >
              Cancel action
            </button>
            <button
              className={
                "button " +
                (pending === "delete" ? "button-danger" : "button-dark")
              }
              disabled={busy}
              onClick={apply}
            >
              {busy ? <LoaderCircle size={16} className="spin" /> : null}
              {busy
                ? "Applying…"
                : "Confirm " + operationLabels[pending].toLowerCase()}
            </button>
          </div>
        </section>
      )}
      <DatasetRows
        datasets={datasets}
        selected={selected}
        onSelect={select}
        edit
        disabled={busy}
      />
    </>
  );
}
