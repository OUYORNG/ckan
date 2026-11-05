import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { request, useAction, useData } from "./api";
import {
  DatasetCard,
  EmptyState,
  ErrorState,
  FormError,
  Loading,
  Notice,
  PageTitle,
  Pagination,
  SignedIn,
} from "./components";
import { DatasetLayoutToggle, DatasetRows } from "./dataset-layout";
import { useSession } from "./session";
import type { Organization, SearchResult } from "./types";

type Operation = "private" | "public" | "delete";
const operationLabels = {
  private: "Make private",
  public: "Make public",
  delete: "Delete datasets",
};
export function OrganizationDatasets() {
  return (
    <div className="page">
      <SignedIn>
        <OrganizationDatasetsContent />
      </SignedIn>
    </div>
  );
}
function OrganizationDatasetsContent() {
  const { id = "" } = useParams();
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const layout = params.get("layout") === "cards" ? "cards" : "rows";
  const q = params.get("q") || "";
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const sort = params.get("sort") || "title_string asc";
  const [draft, setDraft] = useState(q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Operation>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [notice, setNotice] = useState("");
  const org = useAction<Organization>("organization_show", {
    id,
    include_datasets: false,
    include_users: false,
  });
  const permissions = useData<{ manage: boolean }>(
    "organization-dataset-permissions-" + id + session?.user?.id,
    () =>
      request(`organizations/${encodeURIComponent(id)}/dataset-permissions`),
  );
  const result = useAction<SearchResult>(
    "package_search",
    {
      q,
      fq: `owner_org:${JSON.stringify(org.data?.id || "")}`,
      include_private: true,
      rows: 20,
      start: (page - 1) * 20,
      sort,
    },
    Boolean(org.data && permissions.data?.manage),
  );
  useEffect(() => {
    setSelected(new Set());
    setPending(undefined);
    setError(undefined);
  }, [id, q, page, sort, layout]);
  useEffect(() => setDraft(q), [q]);
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }
  function search(event: FormEvent) {
    event.preventDefault();
    filter("q", draft.trim());
  }
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
    setNotice("");
    try {
      const response = await request<{ count: number; operation: Operation }>(
        `organizations/${encodeURIComponent(id)}/datasets/bulk`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": session.csrf_token,
          },
          body: JSON.stringify({ operation: pending, datasets: [...selected] }),
        },
      );
      setNotice(
        `${response.count} dataset${response.count === 1 ? "" : "s"} ${response.operation === "delete" ? "deleted" : "made " + response.operation}.`,
      );
      setSelected(new Set());
      setPending(undefined);
      if (response.operation === "delete" && page > 1) filter("page", "1");
      result.reload();
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
  if (org.loading || permissions.loading) return <Loading />;
  if (org.error || permissions.error)
    return <ErrorState error={(org.error || permissions.error)!} />;
  if (!permissions.data?.manage)
    return (
      <EmptyState
        title="Organization administrator access is required"
        text="An organization administrator can manage dataset visibility and delete datasets in bulk."
      />
    );
  const datasets = result.data?.results || [];
  const selectedDatasets = datasets.filter((dataset) =>
    selected.has(dataset.id),
  );
  return (
    <>
      <Link className="back-link" to={"/organization/" + id}>
        <ArrowLeft size={14} />
        Back to organization
      </Link>
      <PageTitle
        eyebrow="ORGANIZATION MANAGEMENT"
        title="Manage datasets"
        description={org.data?.title || org.data?.name}
      >
        <Link
          className="button button-dark"
          to={
            "/dataset/new?organization=" +
            encodeURIComponent(org.data?.id || "")
          }
        >
          <Plus size={16} />
          Add dataset
        </Link>
      </PageTitle>
      <nav className="tabbar" aria-label="Organization management">
        <Link to={"/organization/" + id}>Browse datasets</Link>
        <Link className="active" to={"/organization/bulk_process/" + id}>
          Manage datasets
        </Link>
        <Link to={"/organization/members/" + id}>Members</Link>
        <Link to={"/organization/edit/" + id}>Settings</Link>
      </nav>
      <form className="catalog-search" onSubmit={search}>
        <Search size={20} />
        <input
          aria-label="Search organization datasets"
          placeholder="Search this organization’s datasets…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={busy}
        />
        <button className="button button-dark" disabled={busy}>
          Search
        </button>
      </form>
      <div className="results-toolbar organization-dataset-toolbar">
        <strong>{result.data?.count || 0} datasets</strong>
        <DatasetLayoutToggle
          value={layout}
          onChange={(value) => {
            if (!busy) filter("layout", value);
          }}
        />
        <label className="sort-control">
          Sort by
          <select
            aria-label="Sort organization datasets"
            value={sort}
            disabled={busy}
            onChange={(event) => filter("sort", event.target.value)}
          >
            <option value="title_string asc">Title A–Z</option>
            <option value="title_string desc">Title Z–A</option>
            <option value="metadata_modified desc">Recently updated</option>
            <option value="metadata_created desc">Newest first</option>
          </select>
        </label>
      </div>
      {notice && <Notice>{notice}</Notice>}
      <FormError error={error} />
      {layout === "rows" && (
        <div className="bulk-toolbar">
          <label>
            <input
              type="checkbox"
              aria-label="Select all datasets on this page"
              disabled={busy || result.loading || !datasets.length}
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
              disabled={!selected.size || busy || result.loading}
              onClick={() => setPending("private")}
            >
              <EyeOff size={15} />
              Make private
            </button>
            <button
              className="button button-outline"
              disabled={!selected.size || busy || result.loading}
              onClick={() => setPending("public")}
            >
              <Eye size={15} />
              Make public
            </button>
            <button
              className="button button-danger"
              disabled={!selected.size || busy || result.loading}
              onClick={() => setPending("delete")}
            >
              <Trash2 size={15} />
              Delete datasets
            </button>
          </div>
        </div>
      )}
      {layout === "rows" && pending && (
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
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState error={result.error} retry={result.reload} />
      ) : datasets.length ? (
        <>
          {layout === "cards" ? (
            <div className="dataset-grid">
              {datasets.map((dataset) => (
                <DatasetCard key={dataset.id} dataset={dataset} />
              ))}
            </div>
          ) : (
            <DatasetRows
              datasets={datasets}
              selected={selected}
              onSelect={select}
              edit
              disabled={busy}
            />
          )}
          <Pagination
            count={result.data?.count || 0}
            page={page}
            size={20}
            onPage={(value) => {
              if (!busy) filter("page", String(value));
            }}
          />
        </>
      ) : (
        <EmptyState
          title="No datasets found"
          text={
            q
              ? "Try another search in this organization."
              : "Add a dataset to start publishing data from this organization."
          }
        />
      )}
    </>
  );
}
