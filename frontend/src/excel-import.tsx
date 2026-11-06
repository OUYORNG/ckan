import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { request, useData } from "./api";
import { useSession } from "./session";
import {
  EmptyState,
  Pagination,
  ErrorState,
  FormError,
  Loading,
  Notice,
  SignedIn,
} from "./components";
import { DatasetTable } from "./dataset-layout";
import type { Dataset } from "./types";
type Column = {
  column: number;
  id: string;
  label: string;
  expected?: string;
  type: string;
  cell?: string;
  notes?: string;
};
type Config = {
  auto?: boolean;
  id?: string;
  sheet: string;
  name: string;
  description: string;
  name_cell?: string;
  description_cell?: string;
  header: number;
  start: number;
  end?: number;
  columns: Column[];
  enabled: boolean;
  preset?: string;
  revision?: number;
  match_key?: string;
};
type Sheet = {
  sheet: string;
  state: string;
  warnings: string[];
  source_preview?: unknown[][];
  preview: Record<string, unknown>[];
  count: number;
  config?: Config;
};
type Job = {
  org: string;
  package: string;
  id: string;
  state: string;
  resource: string;
  series: string;
  created: string;
  manifest?: Sheet[];
  error?: string;
  updated?: string;
  outputs: string[];
  logs: string[];
};
type History = {
  series: { id: string; name: string; current?: string }[];
  jobs: Job[];
};
const blank = (): Config => ({
  auto: true,
  sheet: "",
  name: "",
  description: "",
  header: 1,
  start: 2,
  columns: [],
  enabled: true,
});
const message = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));
function Configuration({
  value,
  change,
}: {
  value: Config;
  change: (v: Config) => void;
}) {
  return (
    <div className="excel-config">
      <h3>Sheet matching</h3>
      <div className="form-row">
        <label>
          Sheet name
          <input
            value={value.sheet}
            onChange={(e) => change({ ...value, sheet: e.target.value })}
          />
        </label>
      </div>
      <h3>Resource information</h3>
      <div className="form-row">
        <label>
          Resource name
          <input
            value={value.name}
            onChange={(e) => change({ ...value, name: e.target.value })}
          />
        </label>
      </div>
      <label>
        Resource description
        <textarea
          value={value.description}
          onChange={(e) => change({ ...value, description: e.target.value })}
        />
      </label>
      <div className="form-row">
        {(["name_cell", "description_cell"] as const).map((key) => (
          <label key={key}>
            {key === "name_cell"
              ? "Resource name from cell (optional)"
              : "Description from cell (optional)"}
            <input
              value={value[key] || ""}
              onChange={(e) => change({ ...value, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <h3>Table extraction and column matching</h3>
      <label>
        Extraction preset
        <select
          aria-label="Extraction preset"
          value={value.preset || ""}
          onChange={(e) => change({ ...value, preset: e.target.value })}
        >
          <option value="">Configured columns</option>
          {["11A1", "11A2", "11A3"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <div className="form-row">
        {(["header", "start", "end"] as const).map((key) => (
          <label key={key}>
            {key === "header"
              ? "Header row"
              : key === "start"
                ? "First data row"
                : "Last data row (optional)"}
            <input
              type="number"
              min="1"
              value={value[key] || ""}
              onChange={(e) =>
                change({ ...value, [key]: Number(e.target.value) || undefined })
              }
            />
          </label>
        ))}
      </div>
      {value.columns.map((column, index) => (
        <fieldset key={index}>
          <legend>Column {index + 1}</legend>
          <div className="form-row">
            {(
              ["column", "id", "label", "expected", "cell", "notes"] as const
            ).map((key) => (
              <label key={key}>
                {
                  {
                    column: "Excel column number",
                    id: "Field code",
                    label: "Display label",
                    expected: "Expected header",
                    cell: "Constant value from cell (optional)",
                    notes: "Field description",
                  }[key]
                }
                <input
                  value={column[key] || ""}
                  onChange={(e) =>
                    change({
                      ...value,
                      columns: value.columns.map((c, i) =>
                        i === index
                          ? {
                              ...c,
                              [key]:
                                key === "column"
                                  ? Number(e.target.value)
                                  : e.target.value,
                            }
                          : c,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label>
            Data type
            <select
              value={column.type}
              onChange={(e) =>
                change({
                  ...value,
                  columns: value.columns.map((c, i) =>
                    i === index ? { ...c, type: e.target.value } : c,
                  ),
                })
              }
            >
              {["text", "int", "numeric", "timestamp"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button button-outline"
            onClick={() =>
              change({
                ...value,
                columns: value.columns.filter((_, i) => i !== index),
              })
            }
          >
            Remove column
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="button button-outline"
        onClick={() =>
          change({
            ...value,
            columns: [
              ...value.columns,
              {
                column: value.columns.length + 1,
                id: "column_" + (value.columns.length + 1),
                label: "",
                type: "text",
              },
            ],
          })
        }
      >
        Add column
      </button>
    </div>
  );
}
export function ImportTemplates({
  organization,
  organizationTitle,
}: {
  organization: string;
  organizationTitle: string;
}) {
  const { session } = useSession();
  const [error, setError] = useState<Error>();
  const [form, setForm] = useState<Config>(blank);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("asc");
  const [page, setPage] = useState(1);
  const result = useData<Config[]>("templates-" + organization, () =>
    request("excel/templates/" + organization),
  );
  const rows = (result.data || [])
    .filter((t) =>
      [t.sheet, t.name, t.description]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => a.sheet.localeCompare(b.sheet) * (sort === "asc" ? 1 : -1));
  async function save() {
    if (!session) return;
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      await request("excel/templates/" + organization, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": session.csrf_token,
        },
        body: JSON.stringify({
          id: form.id,
          sheet: form.sheet,
          name: form.name,
          enabled: form.enabled,
          auto: true,
        }),
      });
      setEditing(false);
      setForm(blank());
      setPage(1);
      setNotice("Template saved for " + organizationTitle + ".");
      result.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Excel import templates</h2>
          <p>
            Templates for {organizationTitle} only. Other organizations keep
            their own templates and matching rules.
          </p>
        </div>
        <button
          type="button"
          className="button button-dark"
          onClick={() => {
            setForm(blank());
            setEditing(true);
            setError(undefined);
          }}
        >
          New template
        </button>
      </div>
      {notice && <Notice>{notice}</Notice>}
      <div className="results-toolbar">
        <label className="inline-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search sheet codes or resource names…"
            aria-label="Search templates"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <strong>
          {rows.length} template{rows.length === 1 ? "" : "s"}
        </strong>
        <label className="sort-control">
          Sort by
          <select
            aria-label="Sort templates"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="asc">Sheet A–Z</option>
            <option value="desc">Sheet Z–A</option>
          </select>
        </label>
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState error={result.error} retry={result.reload} />
      ) : rows.length ? (
        <>
          <DatasetTable label="Organization import templates">
            <thead>
              <tr>
                <th scope="col">Sheet matching</th>
                <th scope="col">Resource information</th>
                <th scope="col">Extraction</th>
                <th scope="col">Status</th>
                <th scope="col">Revision</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 10, page * 10).map((template) => (
                <tr key={template.id}>
                  <td className="dataset-row-title">
                    <h3>{template.sheet}</h3>
                    <p>
                      Matching key:{" "}
                      <code>{template.match_key || template.sheet}</code>
                    </p>
                  </td>
                  <td className="dataset-row-title">
                    <h3>{template.name || template.sheet}</h3>
                    <p>{template.description || "No description"}</p>
                  </td>
                  <td>
                    {template.auto ||
                    (!template.columns.length && !template.preset)
                      ? "Automatic column detection"
                      : "Automatic on next save"}
                  </td>
                  <td>{template.enabled ? "Enabled" : "Disabled"}</td>
                  <td>v{template.revision}</td>
                  <td>
                    <button
                      type="button"
                      className="button button-outline"
                      aria-label={"Edit template " + template.sheet}
                      onClick={() => {
                        setForm(template);
                        setEditing(true);
                        setError(undefined);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DatasetTable>
          <Pagination
            count={rows.length}
            page={page}
            size={10}
            onPage={setPage}
          />
        </>
      ) : (
        <EmptyState
          title="No templates found"
          text={
            query
              ? "Try another sheet code or resource name."
              : "Add a template to configure sheet matching for this organization."
          }
        />
      )}
      {editing && (
        <section className="panel editor-form" aria-label="Template editor">
          <h2>{form.id ? "Edit template " + form.sheet : "New template"}</h2>
          <p>
            Organization: {organizationTitle}. Saving creates a new revision for
            future imports.
          </p>
          <FormError error={error} />
          <label>
            Sheet name
            <input
              required
              value={form.sheet}
              onChange={(e) => setForm({ ...form, sheet: e.target.value })}
              placeholder="7A1"
            />
          </label>
          <label>
            Resource name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name displayed for the searchable table"
            />
          </label>
          <p>
            Columns, headings and data types are detected from the uploaded
            worksheet. Ambiguous layouts pause for review.
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Enabled
          </label>
          <div className="form-actions">
            <button
              type="button"
              disabled={busy}
              className="button button-outline"
              onClick={() => {
                setEditing(false);
                setError(undefined);
              }}
            >
              Cancel template edit
            </button>
            <button
              type="button"
              disabled={busy}
              className="button button-dark"
              onClick={save}
            >
              Save template revision
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
export function ExcelImportPage() {
  return (
    <div className="page">
      <SignedIn>
        <ImportContent />
      </SignedIn>
    </div>
  );
}
function ImportContent() {
  const { id = "", jobId = "" } = useParams();
  const { session } = useSession();
  const [error, setError] = useState<Error>();
  const [decisions, setDecisions] = useState<
    Record<string, { exclude?: boolean; confirm?: boolean; config?: Config }>
  >({});
  const [busy, setBusy] = useState(false);
  const result = useData<Job>("excel-job-" + jobId, () =>
    request("excel/job/" + jobId),
  );
  const templates = useData<Config[]>(
    "review-templates-" + jobId,
    () =>
      request(
        "excel/templates/" +
          result.data?.org +
          "?dataset=" +
          result.data?.package,
      ),
    Boolean(result.data),
  );
  useEffect(() => {
    if (
      !result.data ||
      !["queued", "extracting", "importing"].includes(result.data.state)
    )
      return;
    const timer = setInterval(result.reload, 2500);
    return () => clearInterval(timer);
  }, [result.data?.state]);
  if (result.loading && !result.data) return <Loading />;
  if (result.error) return <ErrorState error={result.error} />;
  const job = result.data;
  if (!job) return null;
  async function submit() {
    if (!session) return;
    setBusy(true);
    setError(undefined);
    try {
      await request("excel/job/" + jobId, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": session.csrf_token,
        },
        body: JSON.stringify({ decisions }),
      });
      result.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to={"/dataset/" + id}>
        ← Back to dataset
      </Link>
      <h1>Excel import</h1>
      <Notice>Status: {job.state}</Notice>
      <FormError error={error} />
      {job.error && <div role="alert">{job.error}</div>}
      <p>Original file preserved. Every sheet is accounted for below.</p>
      {job.manifest?.map((sheet) => (
        <section className="panel editor-form" key={sheet.sheet}>
          <h2>
            {sheet.sheet} · {sheet.state}
          </h2>
          <p>{sheet.count} rows</p>
          <details>
            <summary>Original source cells (first 15 rows)</summary>
            <div className="dataset-rows-scroll">
              <table className="data-table">
                <tbody>
                  {sheet.source_preview?.map((row, i) => (
                    <tr key={i}>
                      <th>{i + 1}</th>
                      {row.map((cell, j) => (
                        <td key={j}>{cell == null ? "" : String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {sheet.warnings.map((w, i) => (
            <p key={i} role="status">
              {w}
            </p>
          ))}
          <div className="dataset-rows-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(sheet.preview[0] || {}).map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.preview.map((r, i) => (
                  <tr key={i}>
                    {Object.entries(r).map(([k, v]) => (
                      <td key={k}>{v == null ? "" : String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {job.state === "needs_review" && sheet.state !== "empty" && (
            <>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={decisions[sheet.sheet]?.exclude || false}
                  onChange={(e) =>
                    setDecisions({
                      ...decisions,
                      [sheet.sheet]: {
                        ...decisions[sheet.sheet],
                        exclude: e.target.checked,
                      },
                    })
                  }
                />
                Explicitly exclude this sheet
              </label>
              {sheet.config && !decisions[sheet.sheet]?.exclude && (
                <>
                  <label>
                    Assign configured template
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const template = templates.data?.find(
                          (t) => t.id === e.target.value,
                        );
                        if (template)
                          setDecisions({
                            ...decisions,
                            [sheet.sheet]: { config: template, confirm: false },
                          });
                      }}
                    >
                      <option value="">Choose template</option>
                      {templates.data
                        ?.filter((t) => t.enabled)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.sheet} · {t.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Configuration
                    value={decisions[sheet.sheet]?.config || sheet.config}
                    change={(v) =>
                      setDecisions({
                        ...decisions,
                        [sheet.sheet]: {
                          ...decisions[sheet.sheet],
                          config: { ...v, auto: false },
                        },
                      })
                    }
                  />
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={decisions[sheet.sheet]?.confirm || false}
                      onChange={(e) =>
                        setDecisions({
                          ...decisions,
                          [sheet.sheet]: {
                            ...decisions[sheet.sheet],
                            confirm: e.target.checked,
                          },
                        })
                      }
                    />
                    I reviewed this sheet and its extraction settings
                  </label>
                </>
              )}
            </>
          )}
        </section>
      ))}
      {(["needs_review", "failed"].includes(job.state) ||
        (job.state !== "completed" &&
          Date.now() - Date.parse(job.updated || job.created) > 660000)) && (
        <button className="button button-dark" disabled={busy} onClick={submit}>
          {job.state === "failed"
            ? "Retry import"
            : "Validate and import reviewed sheets"}
        </button>
      )}
      {job.logs.map((log, i) => (
        <p key={i}>{log}</p>
      ))}
      {job.state === "completed" && (
        <Link className="button button-dark" to={"/dataset/" + id}>
          View searchable resources
        </Link>
      )}
    </>
  );
}
export function ExcelHistory({ dataset }: { dataset: Dataset }) {
  const result = useData<History>("excel-history-" + dataset.id, () =>
    request("excel/dataset/" + dataset.id),
  );
  if (!result.data?.jobs.length) return null;
  return (
    <section className="panel">
      <h2>Excel imports and version history</h2>
      {result.data.series.map((series) => (
        <div key={series.id}>
          <h3>{series.name}</h3>
          <Link
            className="text-link"
            to={
              "/dataset/" + dataset.name + "/resource/new?series=" + series.id
            }
          >
            Upload new version
          </Link>
          {result.data?.jobs
            .filter((job) => job.series === series.id)
            .sort((a, b) => b.created.localeCompare(a.created))
            .map((job) => (
              <p key={job.id}>
                <Link to={"/dataset/" + dataset.name + "/import/" + job.id}>
                  {job.created} · {job.state}
                  {series.current === job.id ? " · current" : ""}
                </Link>
                {job.outputs.map((resourceId) => (
                  <span key={resourceId}>
                    {" "}
                    ·{" "}
                    <Link
                      to={
                        "/dataset/" + dataset.name + "/resource/" + resourceId
                      }
                    >
                      {dataset.resources.find((r) => r.id === resourceId)
                        ?.name || "Resource"}
                    </Link>
                  </span>
                ))}
              </p>
            ))}
        </div>
      ))}
    </section>
  );
}
export function GenerateExcel({
  resource,
  dataset,
}: {
  resource: string;
  dataset: string;
}) {
  const { session } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <FormError error={error} />
      <button
        className="button button-outline"
        disabled={busy}
        onClick={async () => {
          if (!session) return;
          setBusy(true);
          try {
            const job = await request<Job>("excel/start", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": session.csrf_token,
              },
              body: JSON.stringify({ resource }),
            });
            navigate("/dataset/" + dataset + "/import/" + job.id);
          } catch (e) {
            setError(message(e));
            setBusy(false);
          }
        }}
      >
        Generate searchable data
      </button>
    </>
  );
}
