import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Clock3,
  Database,
  Eye,
  FileText,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { date, mutate, request, useAction, useData } from "./api";
import {
  EmptyState,
  ErrorState,
  FormError,
  FormatBadge,
  Loading,
  Notice,
  PrivacyBadge,
  SignedIn,
} from "./components";
import { useSession } from "./session";
import type {
  Dataset,
  DataStoreInfo,
  Resource,
  ResourceView,
  UploadStatus,
  ViewType,
} from "./types";

function asError(value: unknown) {
  return value instanceof Error
    ? value
    : new Error("The request could not be completed.");
}
function errorMessage(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(errorMessage).join("\n");
  if (typeof value === "object" && "message" in value)
    return String(value.message);
  return JSON.stringify(value);
}

export function ResourceManagement() {
  return (
    <div className="page resource-manage-page">
      <SignedIn>
        <ManagementContent />
      </SignedIn>
    </div>
  );
}
function ManagementContent() {
  const { id = "", resourceId = "" } = useParams();
  const { session } = useSession();
  const { pathname } = useLocation();
  const dataset = useAction<Dataset>("package_show", { id });
  const permissions = useData<{ edit: boolean }>(
    "manage-resource-" + id + session?.user?.id,
    () => request(`dataset/${encodeURIComponent(id)}/permissions`),
  );
  const [notice, setNotice] = useState("");
  const resource = dataset.data?.resources.find(
    (resource) => resource.id === resourceId,
  );
  let tab = "metadata";
  if (pathname.includes("/resource_data/")) tab = "datastore";
  else if (pathname.includes("/resource_upload_log/")) tab = "log";
  else if (pathname.includes("/dictionary/")) tab = "dictionary";
  else if (pathname.endsWith("/views")) tab = "views";
  if (dataset.loading || permissions.loading)
    return <Loading label="Loading resource management" />;
  if (dataset.error || permissions.error)
    return <ErrorState error={(dataset.error || permissions.error)!} />;
  if (!permissions.data?.edit)
    return (
      <EmptyState
        title="Editor access is required"
        text="Only dataset editors and organization administrators can manage this resource."
      />
    );
  if (!dataset.data || !resource)
    return (
      <EmptyState
        title="Resource not found"
        text="This resource is not part of the selected dataset."
      />
    );
  const pkg = dataset.data;
  const paths = {
    metadata: `/dataset/${pkg.name}/resource/${resource.id}/edit`,
    datastore: `/dataset/${pkg.name}/resource_data/${resource.id}`,
    log: `/dataset/${pkg.name}/resource_upload_log/${resource.id}`,
    dictionary: `/dataset/${pkg.name}/dictionary/${resource.id}`,
    views: `/dataset/${pkg.name}/resource/${resource.id}/views`,
  };
  function saved(message: string) {
    setNotice(message);
    dataset.reload();
  }
  const tabs = [
    { key: "metadata", label: "Edit resource", icon: Pencil },
    { key: "datastore", label: "DataStore", icon: Database },
    { key: "log", label: "Upload log", icon: Clock3 },
    { key: "dictionary", label: "Data dictionary", icon: BookOpen },
    { key: "views", label: "Views", icon: Eye },
  ] as const;
  return (
    <>
      <Link
        className="back-link"
        to={`/dataset/${pkg.name}/resource/${resource.id}`}
      >
        <ArrowLeft size={14} />
        Back to resource
      </Link>
      <div className="resource-title">
        <div>
          <div className="resource-eyebrow">
            <FormatBadge format={resource.format} />
            <PrivacyBadge private={pkg.private} />
            <span>{pkg.title}</span>
          </div>
          <h1>{resource.name || "Manage resource"}</h1>
          <p>
            Manage this resource’s file, table, field definitions, and preview
            views.
          </p>
        </div>
        <Link
          className="button button-outline"
          to={`/dataset/${pkg.name}/resource/${resource.id}`}
        >
          <Eye size={16} />
          View resource
        </Link>
      </div>
      <nav
        className="tabbar resource-management-tabs"
        aria-label="Resource management"
      >
        {tabs.map(({ key, label, icon: Icon }) => (
          <NavLink
            key={key}
            to={paths[key]}
            className={() => (tab === key ? "active" : "")}
            onClick={() => setNotice("")}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      {notice && <Notice>{notice}</Notice>}
      {tab === "metadata" ? (
        <MetadataEditor resource={resource} onSave={saved} />
      ) : tab === "datastore" ? (
        <DataStoreManager
          resource={resource}
          onSave={saved}
          logPath={paths.log}
        />
      ) : tab === "log" ? (
        <UploadLog resourceId={resource.id} />
      ) : tab === "dictionary" ? (
        <DictionaryEditor resourceId={resource.id} />
      ) : (
        <ViewsManager dataset={pkg} resource={resource} />
      )}
    </>
  );
}

function MetadataEditor({
  resource,
  onSave,
}: {
  resource: Resource;
  onSave: (message: string) => void;
}) {
  const { session } = useSession();
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    form.set("id", resource.id);
    if (file) {
      form.set("upload", file);
      form.set("mimetype", file.type || "application/octet-stream");
    }
    setBusy(true);
    setError(undefined);
    try {
      await mutate("resource_patch", form, session.csrf_token);
      onSave("Resource details saved.");
    } catch (value) {
      setError(asError(value));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="editor-layout">
      <form className="panel editor-form" onSubmit={submit}>
        <h2>Resource details</h2>
        <FormError error={error} />
        <label>
          Name
          <input
            aria-label="Resource name"
            name="name"
            defaultValue={resource.name}
            required
          />
        </label>
        <label>
          Description
          <textarea
            aria-label="Resource description"
            name="description"
            rows={5}
            defaultValue={resource.description || ""}
          />
        </label>
        <label>
          Format
          <input
            aria-label="Resource format"
            name="format"
            defaultValue={resource.format}
            placeholder="CSV, XLSX, JSON, PDF..."
          />
          <small>
            The format describes the file. Changing it does not convert the
            file.
          </small>
        </label>
        <label>
          Resource URL
          <input aria-label="Resource URL" value={resource.url} readOnly />
          <small>
            Uploading a replacement file updates this URL automatically.
          </small>
        </label>
        <label>
          Replace source file <span className="muted">(optional)</span>
          <input
            aria-label="Replace source file"
            disabled={Boolean(resource.nis_import)}
            type="file"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
          <small>
            Leave empty to keep the existing file. Use DataStore to import a
            replacement into the searchable table.
          </small>
        </label>
        <div className="form-actions">
          <button className="button button-dark" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Save size={16} />
            )}{" "}
            {busy ? "Saving…" : "Save resource"}
          </button>
        </div>
      </form>
      <aside className="editor-help">
        <FileText size={25} />
        <h3>Keep the details useful.</h3>
        <p>
          Use a clear name and describe what the resource contains. Existing
          source references, extra metadata, file contents, and table rows are
          preserved when you only edit these details.
        </p>
        <hr />
        <Database size={23} />
        <h3>Files and tables are separate.</h3>
        <p>
          The source file is the downloadable resource. DataStore holds
          searchable rows. Use the DataStore tab to upload and import a new flat
          data file.
        </p>
      </aside>
    </div>
  );
}

function useUploadStatus(resourceId: string) {
  const result = useData<UploadStatus>("upload-status-" + resourceId, () =>
    request(`resource/${resourceId}/status`),
  );
  useEffect(() => {
    if (!["pending", "submitting"].includes(result.data?.status || "")) return;
    const timer = window.setTimeout(result.reload, 2500);
    return () => window.clearTimeout(timer);
  }, [result.data?.status, result.data?.last_updated]);
  return result;
}
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={"upload-state upload-state-" + status}>
      {status === "never"
        ? "No upload job recorded"
        : status.replace(/_/g, " ")}
    </span>
  );
}

function DataStoreManager({
  resource,
  onSave,
  logPath,
}: {
  resource: Resource;
  onSave: (message: string) => void;
  logPath: string;
}) {
  const { session } = useSession();
  const result = useUploadStatus(resource.id);
  const [file, setFile] = useState<File>();
  const [error, setError] = useState<Error>();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function importCurrent() {
    if (!session) return;
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      const submitted = await mutate<boolean>(
        "datapusher_submit",
        { resource_id: resource.id, ignore_hash: true },
        session.csrf_token,
      );
      setNotice(
        submitted
          ? "Upload submitted. The table will update when the import completes."
          : "No new upload was submitted. Check the status and upload log.",
      );
      result.reload();
    } catch (value) {
      setError(asError(value));
    } finally {
      setBusy(false);
    }
  }
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || !session) return;
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      const form = new FormData();
      form.set("id", resource.id);
      form.set("upload", file);
      form.set("mimetype", file.type || "application/octet-stream");
      form.set("format", file.name.split(".").pop()?.toUpperCase() || "CSV");
      await mutate("resource_patch", form, session.csrf_token);
      const submitted = await mutate<boolean>(
        "datapusher_submit",
        { resource_id: resource.id, ignore_hash: true },
        session.csrf_token,
      );
      onSave(
        submitted
          ? "File uploaded and import submitted. Check the upload log for progress."
          : "File uploaded. An import may already be queued; check the upload log.",
      );
    } catch (value) {
      setError(asError(value));
      result.reload();
    } finally {
      setBusy(false);
    }
  }
  if (result.loading) return <Loading label="Checking DataStore" />;
  if (result.error)
    return <ErrorState error={result.error} retry={result.reload} />;
  if (resource.nis_import)
    return (
      <Notice>
        This is a versioned Excel import. Use Upload new version from the
        dataset’s version history to change its data.
      </Notice>
    );
  const status = result.data!;
  return (
    <>
      <FormError error={error} />
      {notice && <Notice>{notice}</Notice>}
      <div className="datastore-summary">
        <div>
          <Database size={22} />
          <strong>
            {status.datastore_active ? "Table available" : "No table yet"}
          </strong>
          <span>DataStore</span>
        </div>
        <div>
          <strong>{status.row_count?.toLocaleString() ?? "—"}</strong>
          <span>Stored records</span>
        </div>
        <div>
          <strong>{status.field_count}</strong>
          <span>Data fields</span>
        </div>
        <div>
          <StatusBadge status={status.status} />
          <span>Latest upload</span>
        </div>
      </div>
      <div className="editor-layout">
        <section className="panel">
          <h2>Import the current source file</h2>
          <p className="muted">
            Load this resource’s existing file into DataStore. Re-importing can
            replace the current table’s records.
          </p>
          {!status.can_import && (
            <div className="resource-info-note">
              This resource is {resource.format || "an unspecified format"}.
              DataPusher imports CSV, TSV, and supported spreadsheet files. A
              migrated JSON table remains available; upload a flat CSV below if
              you want to replace its data.
            </div>
          )}
          {!status.datapusher_enabled && (
            <FormError
              error={new Error("DataPusher is not configured on this server.")}
            />
          )}
          <div className="resource-tab-actions">
            <button
              className="button button-dark"
              disabled={
                busy ||
                !status.can_import ||
                !status.datapusher_enabled ||
                ["pending", "submitting"].includes(status.status)
              }
              onClick={importCurrent}
            >
              <Upload size={16} />
              {busy ? "Submitting…" : "Upload to DataStore"}
            </button>
            <button className="button button-outline" onClick={result.reload}>
              <RefreshCw size={15} />
              Refresh status
            </button>
          </div>
          <dl className="upload-details">
            <div>
              <dt>Last updated</dt>
              <dd>
                {status.last_updated ? date(status.last_updated) : "Never"}
              </dd>
            </div>
            <div>
              <dt>Source format</dt>
              <dd>
                <FormatBadge format={resource.format} />
              </dd>
            </div>
          </dl>
          {errorMessage(status.error) && (
            <FormError error={new Error(errorMessage(status.error))} />
          )}
          <Link className="text-link" to={logPath}>
            Read the upload log →
          </Link>
        </section>
        <form className="panel editor-form" onSubmit={upload}>
          <h2>Upload a new data file</h2>
          <p className="muted">
            This replaces the resource’s source file and imports its rows into
            the same DataStore resource.
          </p>
          <label>
            Data file
            <input
              aria-label="DataStore upload file"
              type="file"
              accept=".csv,.tsv,.xlsx,.xls,.ods"
              required
              onChange={(event) => setFile(event.target.files?.[0])}
            />
            <small>
              Use one table with a single header row. For formatted,
              multi-header workbooks, use the workbook importer to prepare the
              data first.
            </small>
          </label>
          <button
            className="button button-dark"
            disabled={
              busy ||
              !status.datapusher_enabled ||
              ["pending", "submitting"].includes(status.status)
            }
          >
            <Upload size={16} />
            {busy ? "Uploading…" : "Upload file and import"}
          </button>
        </form>
      </div>
    </>
  );
}

function UploadLog({ resourceId }: { resourceId: string }) {
  const result = useUploadStatus(resourceId);
  if (result.loading) return <Loading label="Loading upload log" />;
  if (result.error)
    return <ErrorState error={result.error} retry={result.reload} />;
  const status = result.data!;
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Upload log</h2>
          <p className="muted small">
            Status and messages from the latest DataPusher job for this
            resource.
          </p>
        </div>
        <button
          className="button button-small button-outline"
          onClick={result.reload}
        >
          <RefreshCw size={15} />
          Refresh log
        </button>
      </div>
      <div className="upload-log-meta">
        <StatusBadge status={status.status} />
        <span>
          Updated {status.last_updated ? date(status.last_updated) : "never"}
        </span>
      </div>
      {errorMessage(status.error) && (
        <FormError error={new Error(errorMessage(status.error))} />
      )}{" "}
      {status.logs.length ? (
        <ol className="upload-log-list">
          {status.logs.map((log, index) => (
            <li key={index}>
              <span
                className={"log-level " + (log.level || "INFO").toLowerCase()}
              >
                {log.level || "INFO"}
              </span>
              <div>
                <p>{log.message}</p>
                <small>
                  {log.timestamp
                    ? new Date(log.timestamp).toLocaleString()
                    : ""}
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="No upload messages yet"
          text={
            status.status === "never"
              ? "This table may have been created by a migration or API import. No DataPusher job is recorded for it."
              : "Refresh while the upload runs to see the latest service messages."
          }
        />
      )}
    </section>
  );
}

interface DictionaryField {
  id: string;
  label: string;
  notes: string;
  type_override: string;
}
function DictionaryEditor({ resourceId }: { resourceId: string }) {
  const { session } = useSession();
  const result = useAction<DataStoreInfo>("datastore_info", { id: resourceId });
  const [fields, setFields] = useState<DictionaryField[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (result.data)
      setFields(
        result.data.fields
          .filter((field) => !field.id.startsWith("_"))
          .map((field) => ({
            id: field.id,
            label: field.info?.label || "",
            notes: field.info?.notes || "",
            type_override: field.info?.type_override || "",
          })),
      );
  }, [result.data]);
  function update(index: number, key: keyof DictionaryField, value: string) {
    setFields((current) =>
      current.map((field, position) =>
        position === index ? { ...field, [key]: value } : field,
      ),
    );
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      await request(`resource/${resourceId}/dictionary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": session.csrf_token,
        },
        body: JSON.stringify({ fields }),
      });
      setNotice(
        "Data dictionary saved. Labels and descriptions are updated. Type overrides apply on the next DataStore import.",
      );
      result.reload();
    } catch (value) {
      setError(asError(value));
    } finally {
      setBusy(false);
    }
  }
  if (result.loading) return <Loading label="Loading field definitions" />;
  if (result.error)
    return <ErrorState error={result.error} retry={result.reload} />;
  const definitions = result.data?.fields || [];
  return (
    <form onSubmit={save}>
      <div className="section-heading">
        <div>
          <h2>Data dictionary</h2>
          <p className="muted small">
            Edit labels and descriptions without changing field identifiers,
            stored types, or records.
          </p>
        </div>
        <button className="button button-dark" disabled={busy}>
          <Save size={16} />
          {busy ? "Saving…" : "Save dictionary"}
        </button>
      </div>
      <FormError error={error} />
      {notice && <Notice>{notice}</Notice>}
      <div className="dictionary-editor">
        {fields.map((field, index) => (
          <section className="panel editor-form" key={field.id}>
            <div className="dictionary-heading">
              <h3>
                {index + 1}. <code>{field.id}</code>
              </h3>
              <span className="field-type">
                {definitions.find((item) => item.id === field.id)?.type}
              </span>
            </div>
            <div className="form-row">
              <label>
                Label
                <input
                  aria-label={`Label for ${field.id}`}
                  value={field.label}
                  onChange={(event) =>
                    update(index, "label", event.target.value)
                  }
                />
              </label>
              <label>
                Type override
                <select
                  aria-label={`Type override for ${field.id}`}
                  value={field.type_override}
                  onChange={(event) =>
                    update(index, "type_override", event.target.value)
                  }
                >
                  <option value="">Keep source type</option>
                  <option value="text">Text</option>
                  <option value="numeric">Numeric</option>
                  <option value="timestamp">Timestamp</option>
                </select>
              </label>
            </div>
            <label>
              Description
              <textarea
                aria-label={`Description for ${field.id}`}
                rows={3}
                value={field.notes}
                onChange={(event) => update(index, "notes", event.target.value)}
              />
            </label>
          </section>
        ))}
      </div>
    </form>
  );
}

function ViewsManager({
  dataset,
  resource,
}: {
  dataset: Dataset;
  resource: Resource;
}) {
  const { session } = useSession();
  const views = useAction<ResourceView[]>("resource_view_list", {
    id: resource.id,
  });
  const available = useData<ViewType[]>("view-types-" + resource.id, () =>
    request(`resource/${resource.id}/view-types`),
  );
  const [editing, setEditing] = useState<ResourceView>();
  const [preview, setPreview] = useState<ResourceView>();
  const [form, setForm] = useState({
    title: "",
    description: "",
    view_type: "",
    responsive: false,
    ellipsis_length: 100,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [notice, setNotice] = useState("");
  function edit(view: ResourceView) {
    setEditing(view);
    setForm({
      title: view.title,
      description: view.description || "",
      view_type: view.view_type,
      responsive: Boolean(view.responsive),
      ellipsis_length: Number(view.ellipsis_length ?? 100),
    });
  }
  function reset() {
    setEditing(undefined);
    setForm({
      title: "",
      description: "",
      view_type: "",
      responsive: false,
      ellipsis_length: 100,
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(undefined);
    setNotice("");
    const type = form.view_type || available.data?.[0]?.name;
    try {
      await mutate(
        editing ? "resource_view_update" : "resource_view_create",
        {
          ...(editing || {}),
          resource_id: resource.id,
          ...(editing ? { id: editing.id } : {}),
          title: form.title,
          description: form.description,
          view_type: type,
          ...(type === "datatables_view"
            ? {
                responsive: form.responsive,
                ellipsis_length: form.ellipsis_length,
              }
            : {}),
        },
        session.csrf_token,
      );
      reset();
      views.reload();
      setNotice("Resource view saved.");
    } catch (value) {
      setError(asError(value));
    } finally {
      setBusy(false);
    }
  }
  async function remove(view: ResourceView) {
    if (
      !session ||
      !window.confirm(
        `Delete the “${view.title}” view? The resource and table data will be kept.`,
      )
    )
      return;
    setError(undefined);
    try {
      await mutate("resource_view_delete", { id: view.id }, session.csrf_token);
      if (preview?.id === view.id) setPreview(undefined);
      if (editing?.id === view.id) reset();
      views.reload();
      setNotice("View deleted. Resource data was kept.");
    } catch (value) {
      setError(asError(value));
    }
  }
  async function move(index: number, offset: number) {
    if (!session || !views.data) return;
    const order = views.data.map((view) => view.id);
    [order[index], order[index + offset]] = [
      order[index + offset],
      order[index],
    ];
    setError(undefined);
    try {
      await mutate(
        "resource_view_reorder",
        { id: resource.id, order },
        session.csrf_token,
      );
      views.reload();
    } catch (value) {
      setError(asError(value));
    }
  }
  if (views.loading || available.loading)
    return <Loading label="Loading resource views" />;
  if (views.error || available.error)
    return <ErrorState error={(views.error || available.error)!} />;
  return (
    <>
      <FormError error={error} />
      {notice && <Notice>{notice}</Notice>}
      <div className="editor-layout">
        <section className="panel">
          <h2>Resource views</h2>
          <p className="muted">
            Create, configure, preview, and order the views available for this
            resource.
          </p>
          {views.data?.length ? (
            <div className="resource-view-list">
              {views.data.map((view, index) => (
                <article key={view.id}>
                  <div>
                    <strong>{view.title}</strong>
                    <span className="mini-label">{view.view_type}</span>
                    {view.description && <p>{view.description}</p>}
                  </div>
                  <div className="view-actions">
                    <button
                      className="icon-button"
                      aria-label={`Move ${view.title} up`}
                      disabled={index === 0}
                      onClick={() => {
                        void move(index, -1);
                      }}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Move ${view.title} down`}
                      disabled={index === views.data!.length - 1}
                      onClick={() => {
                        void move(index, 1);
                      }}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="button button-small button-outline"
                      onClick={() => setPreview(view)}
                    >
                      <Eye size={14} />
                      Preview
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Edit ${view.title}`}
                      onClick={() => edit(view)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={`Delete ${view.title}`}
                      onClick={() => {
                        void remove(view);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No views configured"
              text="Add an available view type to help people explore this resource."
            />
          )}
        </section>
        <form className="panel editor-form" onSubmit={save}>
          <h2>{editing ? "Edit view" : "Add a view"}</h2>
          {available.data?.length || editing ? (
            <>
              <label>
                View type
                <select
                  aria-label="View type"
                  value={form.view_type || available.data?.[0]?.name || ""}
                  disabled={Boolean(editing)}
                  onChange={(event) =>
                    setForm({ ...form, view_type: event.target.value })
                  }
                >
                  {available.data?.map((type) => (
                    <option key={type.name} value={type.name}>
                      {type.title}
                    </option>
                  ))}
                  {editing &&
                    !available.data?.some(
                      (type) => type.name === editing.view_type,
                    ) && (
                      <option value={editing.view_type}>
                        {editing.view_type}
                      </option>
                    )}
                </select>
              </label>
              <label>
                Title
                <input
                  aria-label="View title"
                  value={form.title}
                  required
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  aria-label="View description"
                  value={form.description}
                  rows={3}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </label>
              {(form.view_type || available.data?.[0]?.name) ===
                "datatables_view" && (
                <>
                  <label>
                    Maximum cell text length
                    <input
                      aria-label="Maximum cell text length"
                      type="number"
                      min={0}
                      value={form.ellipsis_length}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          ellipsis_length: Number(event.target.value),
                        })
                      }
                    />
                    <small>Use 0 to show full cell contents.</small>
                  </label>
                  <label className="view-responsive">
                    <input
                      type="checkbox"
                      checked={form.responsive}
                      onChange={(event) =>
                        setForm({ ...form, responsive: event.target.checked })
                      }
                    />
                    Responsive table layout
                  </label>
                </>
              )}
              <div className="resource-tab-actions">
                {editing && (
                  <button
                    className="button button-outline"
                    type="button"
                    onClick={reset}
                  >
                    Cancel edit
                  </button>
                )}
                <button className="button button-dark" disabled={busy}>
                  <Save size={15} />
                  {busy ? "Saving…" : "Save view"}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">
              No enabled view plugins support this resource yet. Import tabular
              data into DataStore to enable a table view.
            </p>
          )}
        </form>
      </div>
      {preview && (
        <section className="panel resource-view-preview">
          <div className="section-heading">
            <h2>{preview.title}</h2>
            <button
              className="button button-small button-outline"
              onClick={() => setPreview(undefined)}
            >
              Close preview
            </button>
          </div>
          <iframe
            title={`Preview: ${preview.title}`}
            src={`/dataset/${dataset.name}/resource/${resource.id}/view/${preview.id}`}
          />
        </section>
      )}
    </>
  );
}
