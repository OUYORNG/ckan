import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Code2,
  Columns3,
  Database,
  FileSpreadsheet,
  Pencil,
  Search,
  Table2,
} from "lucide-react";
import { request, useAction, useData } from "./api";
import { useSession } from "./session";
import {
  DownloadLink,
  EmptyState,
  ErrorState,
  FormatBadge,
  Loading,
  Pagination,
  PrivacyBadge,
} from "./components";
import type { Dataset, DataTable, Resource } from "./types";

export function ResourcePage() {
  const { id = "", resourceId = "" } = useParams();
  const result = useAction<Dataset>("package_show", { id });
  if (result.loading)
    return (
      <div className="page">
        <Loading />
      </div>
    );
  if (result.error)
    return (
      <div className="page">
        <ErrorState error={result.error} retry={result.reload} />
      </div>
    );
  if (!result.data) return null;
  const resource = result.data.resources.find(
    (resource) => resource.id === resourceId,
  );
  if (!resource)
    return (
      <div className="page">
        <EmptyState
          title="Resource not found"
          text="This resource may have been moved or removed."
        >
          <Link className="button button-outline" to={"/dataset/" + id}>
            Back to dataset
          </Link>
        </EmptyState>
      </div>
    );
  return (
    <ResourceDetail
      dataset={result.data}
      resource={resource}
      onRefresh={result.reload}
      key={resource.id}
    />
  );
}

function ResourceDetail({
  dataset,
  resource,
  onRefresh,
}: {
  dataset: Dataset;
  resource: Resource;
  onRefresh: () => void;
}) {
  const { session } = useSession();
  const permissions = useData<{ edit: boolean }>(
    "resource-edit-" + resource.id + session?.user?.id,
    () => request(`dataset/${encodeURIComponent(dataset.id)}/permissions`),
    Boolean(session?.user),
  );
  const [tab, setTab] = useState("table");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("_id asc");
  const [visible, setVisible] = useState<string[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const result = useAction<DataTable>(
    "datastore_search",
    { resource_id: resource.id, q, limit: 20, offset: (page - 1) * 20, sort },
    Boolean(resource.datastore_active),
  );
  const fields =
    result.data?.fields.filter((field) => !field.id.startsWith("_")) || [];
  const fieldKey = fields.map((field) => field.id).join("|");
  useEffect(() => {
    if (fieldKey) setVisible(fieldKey.split("|"));
  }, [fieldKey]);
  const displayFields = fields.filter((field) => visible.includes(field.id));
  function search(event: FormEvent) {
    event.preventDefault();
    setQ(draft.trim());
    setPage(1);
  }
  const prepared = dataset.resources.find((item) => item.datastore_active);
  return (
    <div className="page resource-page">
      <Link className="back-link" to={"/dataset/" + dataset.name}>
        <ArrowLeft size={14} />
        Back to dataset
      </Link>
      <div className="resource-title">
        <div>
          <div className="resource-eyebrow">
            <FormatBadge format={resource.format} />
            <PrivacyBadge private={dataset.private} />
            <span>{dataset.title}</span>
          </div>
          <h1>{resource.name || "Dataset resource"}</h1>
          <p>
            {resource.description ||
              "Explore this resource and its supporting information."}
          </p>
        </div>
        <div className="resource-header-actions">
          {permissions.data?.edit && (
            <Link
              className="button button-dark"
              to={`/dataset/${dataset.name}/resource/${resource.id}/edit`}
            >
              <Pencil size={15} />
              Edit resource
            </Link>
          )}
          <DownloadLink url={resource.url} className="button button-outline">
            Original file
          </DownloadLink>
        </div>
      </div>
      {resource.datastore_active ? (
        <>
          <div className="tabbar">
            <button
              onClick={() => setTab("table")}
              className={tab === "table" ? "active" : ""}
            >
              <Table2 size={16} />
              Data explorer
            </button>
            <button
              onClick={() => setTab("dictionary")}
              className={tab === "dictionary" ? "active" : ""}
            >
              <BookOpen size={16} />
              Data dictionary
            </button>
            <button
              onClick={() => setTab("api")}
              className={tab === "api" ? "active" : ""}
            >
              <Code2 size={16} />
              API
            </button>
          </div>
          {result.error ? (
            <ErrorState error={result.error} retry={result.reload} />
          ) : tab === "dictionary" ? (
            <section className="panel">
              <h2>Understand every field</h2>
              <p className="muted">
                Field labels, types, and source notes for this resource.
              </p>
              <div className="dictionary-list">
                {fields.map((field) => (
                  <div key={field.id}>
                    <span className="field-type">{field.type}</span>
                    <h3>{field.info?.label || field.id}</h3>
                    <code>{field.id}</code>
                    {field.info?.notes && <p>{field.info.notes}</p>}
                  </div>
                ))}
              </div>
            </section>
          ) : tab === "api" ? (
            <section className="panel">
              <h2>Query this table</h2>
              <p>
                Use this resource identifier to request records. Private tables
                require authorization.
              </p>
              <div className="code-block">
                <div>
                  <span>RESOURCE ID</span>
                </div>
                <code>{resource.id}</code>
              </div>
              <div className="code-block">
                <div>
                  <span>GET REQUEST</span>
                </div>
                <code>
                  {window.location.origin}
                  /api/3/action/datastore_search?resource_id={resource.id}
                  &limit=20
                </code>
              </div>
              <Link to="/api-guide" className="text-link">
                Read the API guide <ArrowRight size={15} />
              </Link>
            </section>
          ) : (
            <section className="data-explorer">
              <div className="table-toolbar">
                <form className="table-search" onSubmit={search}>
                  <Search size={17} />
                  <input
                    aria-label="Search table records"
                    placeholder="Search records, then press Enter..."
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="button button-small button-outline"
                  >
                    Search
                  </button>
                </form>
                <div className="table-actions">
                  <div className="column-dropdown">
                    <button
                      className="button button-small button-outline"
                      onClick={() => setColumnsOpen(!columnsOpen)}
                      aria-expanded={columnsOpen}
                    >
                      <Columns3 size={16} />
                      Columns
                      <ChevronDown size={13} />
                    </button>
                    {columnsOpen && (
                      <div className="column-menu">
                        <strong>Visible columns</strong>
                        {fields.map((field) => (
                          <label key={field.id}>
                            <input
                              type="checkbox"
                              checked={visible.includes(field.id)}
                              onChange={() =>
                                setVisible((current) =>
                                  current.includes(field.id)
                                    ? current.filter((id) => id !== field.id)
                                    : [...current, field.id],
                                )
                              }
                            />
                            <span>{field.info?.label || field.id}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <a
                    className="button button-small button-outline"
                    href={"/datastore/dump/" + resource.id + "?format=csv"}
                  >
                    <ArrowDownToLine size={16} />
                    Export CSV
                  </a>
                </div>
              </div>
              <div className="table-summary">
                <span className="mini-label">
                  <Database size={13} />
                  {result.data?.total.toLocaleString() ?? "—"}{" "}
                  {q ? "matching " : ""}records
                </span>
                <span>Click a column heading to sort</span>
              </div>
              {result.loading ? (
                <Loading label="Loading records" />
              ) : result.data?.records.length ? (
                <>
                  <div className="data-table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {displayFields.map((field) => (
                            <th key={field.id}>
                              <button
                                title={field.info?.notes || field.id}
                                onClick={() => {
                                  setSort(
                                    field.id +
                                      (sort === field.id + " asc"
                                        ? " desc"
                                        : " asc"),
                                  );
                                  setPage(1);
                                }}
                              >
                                {field.info?.label || field.id}
                                <span>
                                  {sort.startsWith(field.id + " ")
                                    ? sort.endsWith("asc")
                                      ? "↑"
                                      : "↓"
                                    : "↕"}
                                </span>
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.records.map((record, index) => (
                          <tr key={String(record._id || index)}>
                            {displayFields.map((field) => (
                              <td
                                key={field.id}
                                className={
                                  [
                                    "numeric",
                                    "int4",
                                    "int8",
                                    "float8",
                                  ].includes(field.type)
                                    ? "numeric-cell"
                                    : ""
                                }
                              >
                                {record[field.id] === null ||
                                record[field.id] === undefined ? (
                                  <span
                                    className="null-value"
                                    title="No value in the source"
                                  >
                                    —
                                  </span>
                                ) : typeof record[field.id] === "object" ? (
                                  JSON.stringify(record[field.id])
                                ) : (
                                  String(record[field.id])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    count={result.data.total}
                    page={page}
                    size={20}
                    onPage={setPage}
                  />
                </>
              ) : (
                <EmptyState
                  title="No matching records"
                  text="Try another keyword or clear your search."
                >
                  <button
                    className="button button-outline"
                    onClick={() => {
                      setDraft("");
                      setQ("");
                    }}
                  >
                    Clear search
                  </button>
                </EmptyState>
              )}
            </section>
          )}
        </>
      ) : (
        <section className="original-file-panel">
          <span className="large-file-icon">
            <FileSpreadsheet size={44} />
          </span>
          <FormatBadge format={resource.format} />
          <h2>The original source, preserved.</h2>
          <p>
            This file is available to download in its original format.
            {prepared
              ? " A searchable version of the data is also available in this dataset."
              : " Open the downloaded file in a compatible application to explore its contents."}
          </p>
          {resource.format.toUpperCase() === "CSV" && (
            <p>
              <button
                className="button button-small button-outline"
                onClick={onRefresh}
              >
                Check for table preview
              </button>
            </p>
          )}
          <div>
            <DownloadLink url={resource.url} />
            {prepared && (
              <Link
                className="button button-outline"
                to={"/dataset/" + dataset.name + "/resource/" + prepared.id}
              >
                <Table2 size={16} />
                Explore searchable table
              </Link>
            )}
          </div>
        </section>
      )}
      <div className="resource-bottom-note">
        <Check size={15} />
        <span>
          Access to this resource follows the dataset’s visibility and your
          organization permissions.
        </span>
      </div>
    </div>
  );
}
