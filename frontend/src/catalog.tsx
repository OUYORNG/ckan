import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  ChartColumnIncreasing,
  Check,
  Clock3,
  Code2,
  Database,
  Download,
  FileText,
  Filter,
  Globe2,
  Layers3,
  LockKeyhole,
  Plus,
  Search,
  SlidersHorizontal,
  Pencil,
  X,
} from "lucide-react";
import { date, plain, request, useAction, useData } from "./api";
import {
  DatasetCard,
  DownloadLink,
  EmptyState,
  ErrorState,
  FormatBadge,
  Loading,
  Notice,
  OrgAvatar,
  PageTitle,
  Pagination,
  PrivacyBadge,
} from "./components";
import { useSession } from "./session";
import { DatasetLayoutToggle, DatasetRows } from "./dataset-layout";
import { DatasetBulkEditor } from "./organization-datasets";
import type { Dataset, Organization, SearchResult } from "./types";

export function Home() {
  const { session } = useSession();
  const [q, setQ] = useState("");
  const result = useAction<SearchResult>("package_search", {
    rows: 3,
    sort: "metadata_modified desc",
    include_private: Boolean(session?.user),
    "facet.field": ["res_format", "tags"],
  });
  const orgs = useAction<Organization[]>("organization_list", {
    all_fields: true,
    include_dataset_count: true,
  });
  const formats = result.data?.search_facets.res_format?.items || [];
  const tags = result.data?.search_facets.tags?.items.slice(0, 3) || [];
  return (
    <div className="page home-page">
      <div className="home-intro-line">
        <span className="eyebrow">
          <span className="live-dot" /> DISCOVER. UNDERSTAND. USE.
        </span>
        <span className="intro-location">
          <Globe2 size={13} /> Cambodia
        </span>
      </div>
      <section className="home-hero">
        <div className="hero-copy">
          <h1>
            Data that moves
            <br />
            Cambodia <span>forward.</span>
          </h1>
          <p>
            Find the data behind the bigger picture. Explore datasets from
            organizations across Cambodia, all in one place.
          </p>
          <form action="/dataset" className="hero-search">
            <Search size={21} />
            <input
              name="q"
              aria-label="Find a dataset"
              placeholder="What data are you looking for?"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="button button-dark">
              Explore data <ArrowRight size={17} />
            </button>
          </form>
          <div className="popular-searches">
            <span>EXPLORE</span>
            {tags.length ? (
              tags.map((tag) => (
                <Link
                  key={tag.name}
                  to={"/dataset?tag=" + encodeURIComponent(tag.name)}
                >
                  {tag.display_name}
                  <ArrowUpRight size={11} />
                </Link>
              ))
            ) : (
              <>
                <Link to="/dataset">
                  All datasets <ArrowUpRight size={11} />
                </Link>
                <Link to="/organization">
                  Organizations <ArrowUpRight size={11} />
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-heading">
            <span className="visual-icon">
              <ChartColumnIncreasing size={21} />
            </span>
            <span>KNOWLEDGE IN EVERY NUMBER</span>
            <ArrowUpRight size={17} />
          </div>
          <div className="visual-chart">
            <div className="chart-grid" />
            <div className="chart-bars">
              {[38, 54, 43, 66, 59, 79, 69, 91].map((h, i) => (
                <span key={i} style={{ height: h + "%" }} />
              ))}
            </div>
            <div className="chart-line" />
          </div>
          <div className="visual-caption">
            <div>
              <strong>A clearer view of Cambodia</strong>
              <span>Explore the story behind the data.</span>
            </div>
            <span className="visual-cambodia">KH</span>
          </div>
        </div>
      </section>
      <section className="stats-row" aria-label="Catalog summary">
        <div>
          <span className="stat-icon">
            <Database size={20} />
          </span>
          <div>
            <strong>{result.data?.count.toLocaleString() ?? "—"}</strong>
            <span>Accessible datasets</span>
          </div>
          <Link to="/dataset" aria-label="Browse all datasets">
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div>
          <span className="stat-icon blue">
            <Building2 size={20} />
          </span>
          <div>
            <strong>{orgs.data?.length.toLocaleString() ?? "—"}</strong>
            <span>Publishing organizations</span>
          </div>
          <Link to="/organization" aria-label="Browse organizations">
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div>
          <span className="stat-icon amber">
            <Layers3 size={20} />
          </span>
          <div>
            <strong>{result.data ? formats.length : "—"}</strong>
            <span>Available file formats</span>
          </div>
          <span className="stat-detail">Ready to explore</span>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">FRESH FROM THE CATALOG</div>
            <h2>Recently updated datasets</h2>
          </div>
          <Link className="text-link" to="/dataset">
            View all datasets <ArrowRight size={16} />
          </Link>
        </div>
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <ErrorState error={result.error} retry={result.reload} />
        ) : result.data?.results.length ? (
          <div className="dataset-grid home-grid">
            {result.data.results.map((dataset) => (
              <DatasetCard key={dataset.id} dataset={dataset} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="A place for your data"
            text="Published datasets will appear here. Sign in to see private datasets shared with your organization."
          >
            <Link to="/login" className="button button-outline">
              Sign in <ArrowRight size={16} />
            </Link>
          </EmptyState>
        )}
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">FROM THE SOURCE</div>
            <h2>Explore by organization</h2>
          </div>
          <Link className="text-link" to="/organization">
            All organizations <ArrowRight size={16} />
          </Link>
        </div>
        {orgs.loading ? (
          <Loading />
        ) : orgs.error ? (
          <ErrorState error={orgs.error} retry={orgs.reload} />
        ) : (
          <div className="org-strip">
            {orgs.data?.slice(0, 4).map((org) => (
              <Link
                to={"/organization/" + org.name}
                className="org-strip-card"
                key={org.id}
              >
                <OrgAvatar org={org} />
                <div>
                  <strong>{org.title || org.name}</strong>
                  <span>
                    {org.package_count || 0} dataset
                    {org.package_count !== 1 ? "s" : ""}
                  </span>
                </div>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="open-data-banner">
        <span className="banner-icon">
          <Code2 size={28} />
        </span>
        <div>
          <h3>Your next idea starts with data.</h3>
          <p>
            Connect your applications directly to the catalog with the CKAN API.
          </p>
        </div>
        <Link to="/api-guide" className="button button-outline">
          Explore the API <ArrowUpRight size={16} />
        </Link>
      </section>
    </div>
  );
}

export function Catalog({
  organization,
  group,
  manageOrganization,
}: {
  organization?: string;
  group?: string;
  manageOrganization?: string;
}) {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [draft, setDraft] = useState(q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => setDraft(q), [q]);
  const org = organization || params.get("organization") || "";
  const format = params.get("format") || "";
  const tag = params.get("tag") || "";
  const topic = group || params.get("group") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const sort = params.get("sort") || "metadata_modified desc";
  const layout = params.get("layout") === "cards" ? "cards" : "rows";
  const editing =
    Boolean(manageOrganization) &&
    layout === "rows" &&
    params.get("edit") === "true";
  const [bulkNotice, setBulkNotice] = useState("");
  const pageSize = organization ? 20 : 9;
  const clauses = [
    org && `organization:${JSON.stringify(org)}`,
    format && `res_format:${JSON.stringify(format)}`,
    tag && `tags:${JSON.stringify(tag)}`,
    topic && `groups:${JSON.stringify(topic)}`,
  ].filter(Boolean);
  const result = useAction<SearchResult>("package_search", {
    q,
    fq: clauses.join(" AND "),
    rows: pageSize,
    start: (page - 1) * pageSize,
    sort,
    include_private: Boolean(session?.user),
    "facet.field": ["organization", "res_format", "tags"],
  });
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== "page") next.delete("page");
    if (key === "layout" && value === "cards") next.delete("edit");
    setParams(next);
  }
  function search(event: FormEvent) {
    event.preventDefault();
    filter("q", draft.trim());
  }
  const activeCount = [
    !organization && org,
    format,
    tag,
    !group && topic,
  ].filter(Boolean).length;
  return (
    <div
      className={
        organization || group ? "embedded-catalog" : "page catalog-page"
      }
    >
      {!organization && !group && (
        <PageTitle
          eyebrow="EXPLORE THE CATALOG"
          title="Discover your next insight."
          description="Search, explore, and download data from across Cambodia."
        >
          {session?.organizations.some((o) =>
            ["admin", "editor"].includes(o.capacity || ""),
          ) && (
            <Link className="button button-dark" to="/dataset/new">
              <Plus size={16} />
              Add dataset
            </Link>
          )}
        </PageTitle>
      )}
      <form className="catalog-search" onSubmit={search}>
        <Search size={20} />
        <input
          aria-label="Search catalog"
          placeholder="Search by title, keyword, or subject..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        {draft && (
          <button
            type="button"
            className="icon-button"
            aria-label="Clear search"
            onClick={() => {
              setDraft("");
              filter("q", "");
            }}
          >
            <X size={16} />
          </button>
        )}
        <button className="button button-dark" type="submit">
          Search <ArrowRight size={16} />
        </button>
      </form>
      <div className="catalog-layout">
        <aside
          className={"filter-panel" + (filtersOpen ? " filters-open" : "")}
        >
          <div className="filter-title">
            <span>
              <SlidersHorizontal size={17} />
              Filters
            </span>
            {activeCount > 0 && (
              <button onClick={() => setParams(q ? { q } : {})}>Reset</button>
            )}
          </div>
          {[
            ["organization", "Organizations"],
            ["res_format", "File formats"],
            ["tags", "Topics & tags"],
          ]
            .filter(([key]) => !organization || key !== "organization")
            .map(([key, label]) => (
              <div className="filter-section" key={key}>
                <h3>{label}</h3>
                {result.data?.search_facets[key]?.items.length ? (
                  result.data.search_facets[key].items
                    .slice(0, 10)
                    .map((item) => {
                      const param =
                        key === "res_format"
                          ? "format"
                          : key === "tags"
                            ? "tag"
                            : key;
                      const active = params.get(param) === item.name;
                      return (
                        <button
                          className={
                            "filter-option" + (active ? " selected" : "")
                          }
                          onClick={() => filter(param, active ? "" : item.name)}
                          key={item.name}
                        >
                          <span className="checkbox">
                            {active && <Check size={11} />}
                          </span>
                          <span>{item.display_name || item.name}</span>
                          <small>{item.count}</small>
                        </button>
                      );
                    })
                ) : (
                  <p className="muted small">No matching categories</p>
                )}
              </div>
            ))}
          <div className="filter-tip">
            <ShieldNote />
            <p>Private datasets are visible only to authorized accounts.</p>
            {!session?.user && (
              <Link to="/login">
                Sign in <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </aside>
        <section className="catalog-results">
          <div className="results-toolbar">
            <div>
              <button
                className="button button-outline mobile-filter"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <Filter size={15} />
                Filters
              </button>
              <strong>
                {result.loading
                  ? "Finding datasets…"
                  : `${result.data?.count.toLocaleString() || 0} dataset${result.data?.count !== 1 ? "s" : ""}`}
              </strong>
              <span className="muted">{q ? ` for “${q}”` : " to explore"}</span>
            </div>
            {manageOrganization && (
              <button
                className="button button-outline"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("layout", "rows");
                  editing ? next.delete("edit") : next.set("edit", "true");
                  setParams(next);
                  setBulkNotice("");
                }}
              >
                <Pencil size={15} />
                {editing ? "Done editing" : "Edit datasets"}
              </button>
            )}
            {manageOrganization && (
              <Link
                className="button button-dark"
                to={
                  "/dataset/new?organization=" +
                  encodeURIComponent(manageOrganization)
                }
              >
                <Plus size={15} />
                Add dataset
              </Link>
            )}
            <DatasetLayoutToggle
              value={layout}
              onChange={(value) => filter("layout", value)}
            />
            <label className="sort-control">
              Sort by{" "}
              <select
                aria-label="Sort datasets"
                value={sort}
                onChange={(e) => filter("sort", e.target.value)}
              >
                <option value="metadata_modified desc">Recently updated</option>
                <option value="title_string asc">Title A–Z</option>
                <option value="title_string desc">Title Z–A</option>
                <option value="metadata_created desc">Newest first</option>
                <option value="score desc, metadata_modified desc">
                  Relevance
                </option>
              </select>
            </label>
          </div>
          {activeCount > 0 && (
            <div className="active-filters">
              {[
                ["organization", !organization && org],
                ["format", format],
                ["tag", tag],
                ["group", !group && topic],
              ]
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <button
                    key={String(key)}
                    onClick={() => filter(String(key), "")}
                  >
                    {value}
                    <X size={12} />
                  </button>
                ))}
            </div>
          )}
          {bulkNotice && <Notice>{bulkNotice}</Notice>}
          {result.loading ? (
            <Loading />
          ) : result.error ? (
            <ErrorState error={result.error} retry={result.reload} />
          ) : result.data?.results.length ? (
            <>
              {editing && manageOrganization ? (
                <DatasetBulkEditor
                  key={params.toString()}
                  organizationId={manageOrganization}
                  datasets={result.data.results}
                  onApplied={(message, operation) => {
                    setBulkNotice(message);
                    if (operation === "delete" && page > 1) filter("page", "1");
                    result.reload();
                  }}
                />
              ) : layout === "cards" ? (
                <div className="dataset-grid">
                  {result.data.results.map((dataset) => (
                    <DatasetCard key={dataset.id} dataset={dataset} />
                  ))}
                </div>
              ) : (
                <DatasetRows datasets={result.data.results} />
              )}
              <Pagination
                count={result.data.count}
                page={page}
                size={pageSize}
                onPage={(value) => filter("page", String(value))}
              />
            </>
          ) : (
            <EmptyState
              title="No datasets found"
              text={
                session?.user
                  ? "Try a different keyword or remove a filter to broaden your search."
                  : "Try another search, or sign in to view private datasets shared with your organization."
              }
            >
              <button
                className="button button-outline"
                onClick={() => {
                  setDraft("");
                  setParams({});
                }}
              >
                Clear search and filters
              </button>
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
function ShieldNote() {
  return <LockKeyhole size={17} />;
}

export function Organizations({ topics = false }: { topics?: boolean }) {
  const { session } = useSession();
  const [query, setQuery] = useState("");
  const result = useAction<Organization[]>(
    topics ? "group_list" : "organization_list",
    { all_fields: true, include_dataset_count: true },
  );
  const organizations =
    result.data?.filter((org) =>
      `${org.title} ${org.name} ${org.description || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) || [];
  return (
    <div className="page">
      <PageTitle
        eyebrow={topics ? "EXPLORE BY SUBJECT" : "MEET THE PUBLISHERS"}
        title={
          topics
            ? "Every topic. A new perspective."
            : "Data, directly from the source."
        }
        description={
          topics
            ? "Find datasets organized around the subjects that matter to you."
            : "Discover the organizations sharing data through the portal."
        }
      >
        {!topics && session?.can_create_organizations && (
          <Link className="button button-dark" to="/organization/new">
            <Plus size={16} />
            Add organization
          </Link>
        )}
      </PageTitle>
      <div className="directory-toolbar">
        <div className="inline-search">
          <Search size={18} />
          <input
            aria-label={topics ? "Find a topic" : "Find an organization"}
            placeholder={topics ? "Find a topic..." : "Find an organization..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="muted">
          {organizations.length} {topics ? "topics" : "organizations"}
        </span>
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState error={result.error} retry={result.reload} />
      ) : organizations.length ? (
        <div className="organization-grid">
          {organizations.map((org) => (
            <article className="organization-card" key={org.id}>
              <div className="organization-card-top">
                <OrgAvatar org={org} large />
                <span className="mini-label">
                  <Database size={12} />
                  {org.package_count || 0} datasets
                </span>
              </div>
              <h2>
                <Link to={`/${topics ? "group" : "organization"}/${org.name}`}>
                  {org.title || org.name}
                </Link>
              </h2>
              <p>
                {plain(org.description) ||
                  "Explore this organization’s data collections and published resources."}
              </p>
              <Link
                className="text-link"
                to={`/${topics ? "group" : "organization"}/${org.name}`}
              >
                Explore datasets <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={topics ? "Topics will appear here" : "No organizations found"}
          text={
            topics
              ? "Datasets can be grouped by subject as the catalog grows. You can explore all datasets now."
              : "Try a different name, or create your first publishing organization."
          }
        >
          <Link className="button button-outline" to="/dataset">
            Browse datasets <ArrowRight size={16} />
          </Link>
        </EmptyState>
      )}
    </div>
  );
}

export function OrganizationDetail({ topic = false }: { topic?: boolean }) {
  const { id = "" } = useParams();
  const { session } = useSession();
  const result = useAction<Organization>(
    topic ? "group_show" : "organization_show",
    { id, include_datasets: false, include_users: false },
  );
  const own = session?.organizations.find((org) => org.id === result.data?.id);
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
  const org = result.data;
  return (
    <div className="page">
      <Link className="back-link" to={topic ? "/group" : "/organization"}>
        ← All {topic ? "topics" : "organizations"}
      </Link>
      <div className="organization-hero">
        <OrgAvatar org={org} large />
        <div>
          <span className="eyebrow">
            {topic ? "TOPIC COLLECTION" : "PUBLISHING ORGANIZATION"}
          </span>
          <h1>{org.title || org.name}</h1>
          <p>
            {plain(org.description) ||
              "Explore datasets and resources from this organization."}
          </p>
        </div>
        {own?.capacity && <span className="role-badge">{own.capacity}</span>}
      </div>
      <div className="tabbar">
        <Link
          className="active"
          to={`/${topic ? "group" : "organization"}/${org.name}`}
        >
          <Database size={16} />
          Datasets
        </Link>
        {!topic && (own?.capacity === "admin" || session?.user?.sysadmin) && (
          <>
            <Link to={"/organization/members/" + org.name}>
              <UsersIcon />
              Members
            </Link>
            <Link to={"/organization/edit/" + org.name}>Settings</Link>
          </>
        )}
      </div>
      <Catalog
        organization={!topic ? org.name : undefined}
        group={topic ? org.name : undefined}
        manageOrganization={
          !topic && (own?.capacity === "admin" || session?.user?.sysadmin)
            ? org.id
            : undefined
        }
      />
    </div>
  );
}
function UsersIcon() {
  return <Building2 size={16} />;
}

export function DatasetDetail() {
  const { id = "" } = useParams();
  const { session } = useSession();
  const result = useAction<Dataset>("package_show", { id });
  const permissions = useData<{ edit: boolean }>(
    "permissions-" + id + session?.user?.id,
    () => request(`dataset/${encodeURIComponent(id)}/permissions`),
    Boolean(session?.user),
  );
  const [tab, setTab] = useState("resources");
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
  const dataset = result.data;
  return (
    <div className="page dataset-page">
      <Link className="back-link" to="/dataset">
        ← Back to data catalog
      </Link>
      <div className="dataset-heading">
        <div className="dataset-heading-meta">
          <span className="mini-label">
            <Database size={13} />
            DATASET
          </span>
          <PrivacyBadge private={dataset.private} />
        </div>
        <div className="dataset-title-row">
          <h1>{dataset.title || dataset.name}</h1>
          {permissions.data?.edit && (
            <Link
              className="button button-outline"
              to={"/dataset/edit/" + dataset.name}
            >
              Edit dataset <ArrowUpRight size={15} />
            </Link>
          )}
        </div>
        <div className="dataset-byline">
          {dataset.organization && (
            <Link to={"/organization/" + dataset.organization.name}>
              <Building2 size={15} />
              {dataset.organization.title}
            </Link>
          )}
          <span>
            <Clock3 size={14} />
            Updated {date(dataset.metadata_modified)}
          </span>
        </div>
      </div>
      <div className="dataset-detail-layout">
        <div>
          <div className="tabbar">
            <button
              className={tab === "resources" ? "active" : ""}
              onClick={() => setTab("resources")}
            >
              <Layers3 size={16} />
              Resources <span>{dataset.resources.length}</span>
            </button>
            <button
              className={tab === "metadata" ? "active" : ""}
              onClick={() => setTab("metadata")}
            >
              <FileText size={16} />
              Metadata
            </button>
          </div>
          {tab === "resources" ? (
            <>
              <section className="detail-section">
                <h2>About this dataset</h2>
                <p className="dataset-description">
                  {plain(dataset.notes) ||
                    "No description has been provided for this dataset."}
                </p>
              </section>
              <section className="detail-section">
                <div className="section-heading">
                  <h2>Data & resources</h2>
                  {permissions.data?.edit && (
                    <Link
                      className="text-link"
                      to={"/dataset/" + dataset.name + "/resource/new"}
                    >
                      <Plus size={15} />
                      Add resource
                    </Link>
                  )}
                </div>
                {dataset.resources.length ? (
                  <div className="resource-list">
                    {dataset.resources.map((resource) => (
                      <article className="resource-card" key={resource.id}>
                        <div className="file-icon">
                          <FileText size={22} />
                        </div>
                        <div className="resource-card-body">
                          <div>
                            <FormatBadge format={resource.format} />
                            {resource.datastore_active && (
                              <span className="preview-label">
                                <Check size={11} />
                                Table preview
                              </span>
                            )}
                          </div>
                          <h3>
                            <Link
                              to={
                                "/dataset/" +
                                dataset.name +
                                "/resource/" +
                                resource.id
                              }
                            >
                              {resource.name || resource.id}
                            </Link>
                          </h3>
                          <p>{plain(resource.description)}</p>
                          <div className="resource-card-actions">
                            <Link
                              to={
                                "/dataset/" +
                                dataset.name +
                                "/resource/" +
                                resource.id
                              }
                            >
                              {resource.datastore_active
                                ? "Explore table"
                                : "View resource"}{" "}
                              <ArrowRight size={14} />
                            </Link>
                            <DownloadLink
                              url={resource.url}
                              className="resource-download"
                            >
                              Download
                            </DownloadLink>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No resources yet"
                    text="Upload a file or add a data link to make this dataset useful."
                  />
                )}
              </section>
            </>
          ) : (
            <section className="detail-section metadata-panel">
              <h2>Dataset information</h2>
              <dl>
                {[
                  ["Title", dataset.title],
                  ["Identifier", dataset.id],
                  ["Organization", dataset.organization?.title],
                  ["Visibility", dataset.private ? "Private" : "Public"],
                  ["License", dataset.license_title || "Not specified"],
                  ["Created", date(dataset.metadata_created)],
                  ["Last updated", date(dataset.metadata_modified)],
                  ["Source", dataset.url || "Not specified"],
                  ["Version", dataset.version || "Not specified"],
                  ["Author", dataset.author || "Not specified"],
                  ["Author email", dataset.author_email || "Not specified"],
                  ["Maintainer", dataset.maintainer || "Not specified"],
                  [
                    "Maintainer email",
                    dataset.maintainer_email || "Not specified",
                  ],
                  ...(dataset.extras || []).map((item) => [
                    item.key,
                    item.value,
                  ]),
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
        <aside className="dataset-aside">
          <div className="info-card">
            <h3>Published by</h3>
            {dataset.organization ? (
              <>
                <OrgAvatar org={dataset.organization} />
                <h4>{dataset.organization.title}</h4>
                <Link
                  className="text-link"
                  to={"/organization/" + dataset.organization.name}
                >
                  View organization <ArrowUpRight size={14} />
                </Link>
              </>
            ) : (
              <p>Organization not specified</p>
            )}
          </div>
          <div className="info-card">
            <h3>Topics & tags</h3>
            <div className="tag-list">
              {dataset.tags.length ? (
                dataset.tags.map((tag) => (
                  <Link
                    key={tag.name}
                    to={"/dataset?tag=" + encodeURIComponent(tag.name)}
                  >
                    {tag.display_name || tag.name}
                  </Link>
                ))
              ) : (
                <span className="muted small">No tags provided</span>
              )}
            </div>
          </div>
          <div className="info-card api-info">
            <Code2 size={23} />
            <h3>Use this data in your tools</h3>
            <p>Access dataset metadata and table records through the API.</p>
            <Link
              className="text-link"
              to={"/api-guide?dataset=" + dataset.name}
            >
              View API guide <ArrowUpRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function About() {
  return (
    <div className="page">
      <PageTitle
        eyebrow="OPEN KNOWLEDGE, SHARED PROGRESS"
        title="A clearer picture of Cambodia."
        description="One place to discover, understand, and use statistical data."
      />
      <div className="about-panel">
        <div className="about-emblem">
          <ChartColumnIncreasing size={50} />
        </div>
        <h2>Data connects questions to answers.</h2>
        <p>
          The NIS Data Portal brings datasets and their supporting information
          together. Explore publishing organizations, preview available data
          tables, and download original files for your research and work.
        </p>
        <div className="about-features">
          {[
            {
              icon: Search,
              title: "Find what matters",
              text: "Search by keyword, organization, topic, or file format.",
            },
            {
              icon: Database,
              title: "Understand the data",
              text: "Review metadata, field definitions, and source references.",
            },
            {
              icon: Download,
              title: "Put it to use",
              text: "Download resources or query accessible tables through the API.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon size={24} />
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <Link className="button button-dark" to="/dataset">
          Explore the catalog <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

export function ApiGuide() {
  const [params] = useSearchParams();
  const dataset = params.get("dataset");
  const endpoint =
    window.location.origin +
    "/api/3/action/" +
    (dataset
      ? "package_show?id=" + encodeURIComponent(dataset)
      : "package_search?q=");
  const [copied, setCopied] = useState(false);
  return (
    <div className="page">
      <PageTitle
        eyebrow="BUILD WITH DATA"
        title="The catalog, at your fingertips."
        description="Use the CKAN API to find datasets, retrieve metadata, and query data tables."
      />
      <div className="api-guide-layout">
        <section className="panel">
          <span className="feature-icon">
            <Code2 size={26} />
          </span>
          <h2>Start with a simple request</h2>
          <p>
            Public datasets can be accessed without signing in. Private data
            requires an API token for a user with permission to access it.
          </p>
          <div className="code-block">
            <div>
              <span>HTTP REQUEST</span>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(endpoint);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy URL"}
              </button>
            </div>
            <code>GET {endpoint}</code>
          </div>
          <h3>Useful API actions</h3>
          <dl className="api-actions">
            {[
              ["package_search", "Search the dataset catalog."],
              ["package_show", "Read a dataset and its resources."],
              ["organization_list", "List publishing organizations."],
              [
                "datastore_search",
                "Query a table using its resource identifier.",
              ],
            ].map(([name, text]) => (
              <div key={name}>
                <dt>
                  <code>{name}</code>
                </dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </section>
        <aside className="panel api-guide-aside">
          <BookOpen size={26} />
          <h3>Keep exploring</h3>
          <p>
            The official API reference includes parameters, examples, and
            authentication details.
          </p>
          <a
            href="https://docs.ckan.org/en/2.11/api/"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            Read API documentation <ArrowUpRight size={14} />
          </a>
          <hr />
          <LockKeyhole size={22} />
          <h3>Working with private data?</h3>
          <p>
            Create and manage your own API tokens in your account. Never share a
            token publicly.
          </p>
          <Link className="text-link" to="/account">
            My account <ArrowRight size={14} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
