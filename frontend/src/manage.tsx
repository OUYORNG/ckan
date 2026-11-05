import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Database,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { date, mutate, request, slug, useAction, useData } from "./api";
import {
  DatasetCard,
  EmptyState,
  ErrorState,
  FormError,
  Loading,
  Notice,
  OrgAvatar,
  PageTitle,
  Pagination,
  SignedIn,
} from "./components";
import { useSession } from "./session";
import type {
  Dataset,
  License,
  Member,
  Organization,
  PortalSession,
  Resource,
  SearchResult,
  Token,
  User,
} from "./types";

function asError(error: unknown) {
  return error instanceof Error
    ? error
    : new Error("The request could not be completed.");
}

export function Login() {
  const { session, error: sessionError, update, refresh } = useSession();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      const result = await request<PortalSession>("login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": session.csrf_token,
        },
        body: JSON.stringify({
          login: form.get("login"),
          password: form.get("password"),
        }),
      });
      update(result);
      const next = params.get("next");
      navigate(
        next?.startsWith("/") && !next.startsWith("//") ? next : "/workspace",
      );
    } catch (error) {
      setError(asError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page login-page">
      <div className="login-story">
        <span className="eyebrow">YOUR DATA. YOUR WORKSPACE.</span>
        <h1>
          Good data starts
          <br />
          with <span>good people.</span>
        </h1>
        <p>
          Sign in to manage your organization’s datasets, explore private
          collections, and share knowledge.
        </p>
        <div className="login-benefits">
          <span>
            <CheckCircle2 size={17} />
            One account, your organization’s data
          </span>
          <span>
            <CheckCircle2 size={17} />
            Private datasets, protected access
          </span>
          <span>
            <CheckCircle2 size={17} />
            Original files and searchable tables
          </span>
        </div>
        <span className="login-caption">
          National Institute of Statistics · Cambodia
        </span>
      </div>
      <section className="login-panel">
        <span className="feature-icon">
          <KeyRound size={25} />
        </span>
        <h2>Welcome back.</h2>
        <p>Sign in with your CKAN account.</p>
        {sessionError ? (
          <ErrorState
            error={sessionError}
            retry={() => {
              void refresh();
            }}
          />
        ) : !session ? (
          <Loading label="Preparing sign in" />
        ) : session.user ? (
          <>
            <Notice>You’re signed in as {session.user.fullname}.</Notice>
            <Link className="button button-dark full-width" to="/workspace">
              Open my workspace <ArrowRight size={16} />
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <FormError error={error} />
            <label>
              Username or email
              <input
                name="login"
                autoComplete="username"
                required
                placeholder="Enter your username or email"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Enter your password"
              />
            </label>
            <button className="button button-dark full-width" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <KeyRound size={17} />
              )}{" "}
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="login-help">
              Need an account or a password reset? Contact your organization
              administrator.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}

export function Workspace() {
  return (
    <div className="page">
      <SignedIn>
        <WorkspaceContent />
      </SignedIn>
    </div>
  );
}
function WorkspaceContent() {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const organizations = session?.organizations || [];
  const fq =
    "organization:(" +
    organizations.map((org) => JSON.stringify(org.name)).join(" OR ") +
    ")";
  const result = useAction<SearchResult>(
    "package_search",
    {
      fq,
      include_private: true,
      rows: 6,
      start: (page - 1) * 6,
      sort: "metadata_modified desc",
    },
    organizations.length > 0,
  );
  const canCreate = organizations.some((org) =>
    ["admin", "editor"].includes(org.capacity || ""),
  );
  return (
    <>
      <PageTitle
        eyebrow="MY WORKSPACE"
        title={"Welcome back, " + (session?.user?.fullname || "there") + "."}
        description="Your organizations, shared datasets, and the tools to keep them up to date."
      >
        {canCreate && (
          <Link className="button button-dark" to="/dataset/new">
            <Plus size={16} />
            Add dataset
          </Link>
        )}
      </PageTitle>
      <section className="workspace-organizations">
        <div className="section-heading">
          <h2>Your organizations</h2>
          {session?.can_create_organizations && (
            <Link className="text-link" to="/organization/new">
              Create organization <Plus size={14} />
            </Link>
          )}
        </div>
        {organizations.length ? (
          <div className="org-strip">
            {organizations.map((org) => (
              <div className="workspace-org" key={org.id}>
                <OrgAvatar org={org} />
                <div>
                  <Link to={"/organization/" + org.name}>
                    <strong>{org.title || org.name}</strong>
                  </Link>
                  <span className="role-badge">{org.capacity || "member"}</span>
                </div>
                {org.capacity === "admin" && (
                  <Link
                    className="icon-button"
                    aria-label={"Manage " + org.title}
                    to={"/organization/members/" + org.name}
                  >
                    <Users size={17} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="You’re not in an organization yet"
            text="An organization administrator can add your account as a member, editor, or admin."
          />
        )}
      </section>
      <div className="section-heading">
        <h2>Datasets in your workspace</h2>
        <Link to="/dataset" className="text-link">
          Browse catalog <ArrowRight size={15} />
        </Link>
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState error={result.error} retry={result.reload} />
      ) : result.data?.results.length ? (
        <>
          <div className="dataset-grid">
            {result.data.results.map((dataset) => (
              <DatasetCard dataset={dataset} key={dataset.id} />
            ))}
          </div>
          <Pagination
            count={result.data.count}
            page={page}
            size={6}
            onPage={(page) => setParams({ page: String(page) })}
          />
        </>
      ) : (
        <EmptyState
          title="Ready for your first dataset?"
          text="Create a dataset, add its metadata, then upload files or link to existing data."
        >
          {canCreate && (
            <Link className="button button-dark" to="/dataset/new">
              <Plus size={16} />
              Create dataset
            </Link>
          )}
        </EmptyState>
      )}
    </>
  );
}

export function DatasetEditor() {
  return (
    <div className="page">
      <SignedIn>
        <DatasetEditorContent />
      </SignedIn>
    </div>
  );
}
function DatasetEditorContent() {
  const { id } = useParams();
  const { session } = useSession();
  const navigate = useNavigate();
  const existing = useAction<Dataset>("package_show", { id }, Boolean(id));
  const permissions = useData<{ edit: boolean }>(
    "edit-" + id,
    () => request(`dataset/${encodeURIComponent(id || "")}/permissions`),
    Boolean(id),
  );
  const licenses = useAction<License[]>("license_list");
  const organizations = (session?.organizations || []).filter((org) =>
    ["admin", "editor"].includes(org.capacity || ""),
  );
  const [form, setForm] = useState({
    title: "",
    name: "",
    notes: "",
    owner_org: organizations[0]?.id || "",
    visibility: "private",
    license_id: "notspecified",
    tags: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  useEffect(() => {
    if (existing.data) {
      const data = existing.data;
      setForm({
        title: data.title,
        name: data.name,
        notes: data.notes || "",
        owner_org: data.owner_org,
        visibility: data.private ? "private" : "public",
        license_id: data.license_id || "notspecified",
        tags: data.tags.map((tag) => tag.name).join(", "),
      });
    }
  }, [existing.data]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(undefined);
    try {
      const dataset = await mutate<Dataset>(
        id ? "package_patch" : "package_create",
        {
          ...(id ? { id } : {}),
          title: form.title,
          name: form.name,
          notes: form.notes,
          owner_org: form.owner_org,
          private: form.visibility === "private",
          license_id: form.license_id,
          tags: [
            ...new Set(
              form.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            ),
          ].map((name) => ({ name })),
        },
        session.csrf_token,
      );
      navigate("/dataset/" + dataset.name);
    } catch (error) {
      setError(asError(error));
    } finally {
      setBusy(false);
    }
  }
  if (id && (existing.loading || permissions.loading)) return <Loading />;
  if (existing.error || permissions.error)
    return <ErrorState error={(existing.error || permissions.error)!} />;
  if ((id && !permissions.data?.edit) || !organizations.length)
    return (
      <EmptyState
        title="Editor access is required"
        text="An organization admin can give your account permission to create and edit datasets."
      />
    );
  return (
    <>
      <Link className="back-link" to={id ? "/dataset/" + id : "/workspace"}>
        <ArrowLeft size={14} />
        Back
      </Link>
      <PageTitle
        eyebrow="DATASET MANAGEMENT"
        title={id ? "Make your data easier to use." : "Share a new dataset."}
        description="Add clear metadata so people can find, understand, and use your data."
      />
      <div className="editor-layout">
        <form className="panel editor-form" onSubmit={submit}>
          <FormError error={error} />
          <h2>Dataset details</h2>
          <label>
            Dataset title <span className="required">*</span>
            <input
              required
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                  ...(!id && (!form.name || form.name === slug(form.title))
                    ? { name: slug(e.target.value) }
                    : {}),
                })
              }
              placeholder="A clear, descriptive title"
            />
          </label>
          <label>
            URL identifier <span className="required">*</span>
            <input
              required
              pattern="[a-z0-9_-]+"
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="example-dataset-2025"
            />
            <small>
              Use lowercase English letters, numbers, hyphens, or underscores.
            </small>
          </label>
          <label>
            Description
            <textarea
              aria-label="Description"
              rows={7}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="What does this data describe? Include coverage, reporting periods, units, and source information."
            />
          </label>
          <div className="form-row">
            <label>
              Organization
              <select
                aria-label="Organization"
                required
                value={form.owner_org}
                onChange={(e) =>
                  setForm({ ...form, owner_org: e.target.value })
                }
              >
                {organizations.map((org) => (
                  <option value={org.id} key={org.id}>
                    {org.title || org.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Visibility
              <select
                aria-label="Visibility"
                value={form.visibility}
                onChange={(e) =>
                  setForm({ ...form, visibility: e.target.value })
                }
              >
                <option value="private">
                  Private — authorized members only
                </option>
                <option value="public">Public — everyone can access</option>
              </select>
            </label>
          </div>
          <label>
            License
            <select
              aria-label="License"
              value={form.license_id}
              onChange={(e) => setForm({ ...form, license_id: e.target.value })}
            >
              {licenses.data?.map((license) => (
                <option value={license.id} key={license.id}>
                  {license.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tags
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="education, statistics, 2025"
            />
            <small>Separate tags with commas.</small>
          </label>
          <div className="form-actions">
            <Link
              className="button button-outline"
              to={id ? "/dataset/" + id : "/workspace"}
            >
              Cancel
            </Link>
            <button className="button button-dark" disabled={busy}>
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Save size={16} />
              )}{" "}
              {busy ? "Saving…" : id ? "Save changes" : "Create dataset"}
            </button>
          </div>
        </form>
        <aside className="editor-help">
          <span className="feature-icon">
            <Database size={24} />
          </span>
          <h3>Good metadata makes a difference.</h3>
          <p>
            Use a title that describes the subject and period. Explain where the
            data comes from and what the values represent.
          </p>
          <hr />
          <LockKeyhole size={22} />
          <h3>Choose who can access it.</h3>
          <p>
            Private datasets are shared with authorized users. Public datasets
            can be viewed and downloaded by everyone.
          </p>
          <hr />
          <Upload size={22} />
          <h3>Add resources next.</h3>
          <p>
            After creating the dataset, upload a file or add a link from the
            dataset page.
          </p>
        </aside>
      </div>
    </>
  );
}

export function ResourceUpload() {
  return (
    <div className="page">
      <SignedIn>
        <ResourceUploadContent />
      </SignedIn>
    </div>
  );
}
function ResourceUploadContent() {
  const { id = "" } = useParams();
  const { session } = useSession();
  const dataset = useAction<Dataset>("package_show", { id });
  const [mode, setMode] = useState("file");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !dataset.data) return;
    setBusy(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    data.set("package_id", dataset.data.id);
    if (mode === "file" && file) data.set("upload", file);
    try {
      const resource = await mutate<Resource>(
        "resource_create",
        data,
        session.csrf_token,
      );
      navigate("/dataset/" + id + "/resource/" + resource.id);
    } catch (error) {
      setError(asError(error));
    } finally {
      setBusy(false);
    }
  }
  if (dataset.loading) return <Loading />;
  if (dataset.error) return <ErrorState error={dataset.error} />;
  return (
    <>
      <Link className="back-link" to={"/dataset/" + id}>
        <ArrowLeft size={14} />
        Back to dataset
      </Link>
      <PageTitle
        eyebrow="ADD A RESOURCE"
        title="Bring your data into the picture."
        description={dataset.data?.title}
      />
      <form className="panel editor-form narrow-panel" onSubmit={submit}>
        <FormError error={error} />
        <div className="segmented">
          <button
            type="button"
            className={mode === "file" ? "active" : ""}
            onClick={() => setMode("file")}
          >
            <Upload size={16} />
            Upload a file
          </button>
          <button
            type="button"
            className={mode === "link" ? "active" : ""}
            onClick={() => setMode("link")}
          >
            Link to data
          </button>
        </div>
        {mode === "file" ? (
          <label className="file-dropzone">
            <Upload size={32} />
            <strong>{file?.name || "Choose a file to upload"}</strong>
            <span>CSV, Excel, JSON, PDF, and other source files</span>
            <input
              aria-label="Choose resource file"
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </label>
        ) : (
          <label>
            Resource URL
            <input
              type="url"
              name="url"
              required
              placeholder="https://example.com/data.csv"
            />
          </label>
        )}
        <label>
          Resource name
          <input
            name="name"
            required
            placeholder="A descriptive name for this file or table"
          />
        </label>
        <label>
          File format
          <input
            name="format"
            placeholder={
              file?.name.split(".").pop()?.toUpperCase() ||
              "CSV, XLSX, JSON, PDF..."
            }
            defaultValue={file?.name.split(".").pop()?.toUpperCase() || ""}
            key={file?.name}
          />
        </label>
        <label>
          Description
          <textarea
            aria-label="Description"
            name="description"
            rows={4}
            placeholder="Describe the contents, coverage, or intended use of this resource."
          />
        </label>
        <div className="form-actions">
          <Link to={"/dataset/" + id} className="button button-outline">
            Cancel
          </Link>
          <button className="button button-dark" disabled={busy}>
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Upload size={16} />
            )}{" "}
            {busy ? "Uploading…" : "Add resource"}
          </button>
        </div>
      </form>
    </>
  );
}

export function OrganizationEditor() {
  return (
    <div className="page">
      <SignedIn>
        <OrganizationEditorContent />
      </SignedIn>
    </div>
  );
}
function OrganizationEditorContent() {
  const { id } = useParams();
  const { session, refresh } = useSession();
  const navigate = useNavigate();
  const existing = useAction<Organization>(
    "organization_show",
    { id, include_datasets: false, include_users: false },
    Boolean(id),
  );
  const [form, setForm] = useState({ name: "", title: "", description: "" });
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (existing.data)
      setForm({
        name: existing.data.name,
        title: existing.data.title,
        description: existing.data.description || "",
      });
  }, [existing.data]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(undefined);
    try {
      const organization = await mutate<Organization>(
        id ? "organization_patch" : "organization_create",
        { ...form, ...(id ? { id } : {}) },
        session.csrf_token,
      );
      await refresh();
      navigate("/organization/" + organization.name);
    } catch (error) {
      setError(asError(error));
    } finally {
      setBusy(false);
    }
  }
  if (existing.loading) return <Loading />;
  if (existing.error) return <ErrorState error={existing.error} />;
  return (
    <>
      <Link
        className="back-link"
        to={id ? "/organization/" + id : "/organization"}
      >
        ← Back to organizations
      </Link>
      <PageTitle
        eyebrow="ORGANIZATION MANAGEMENT"
        title={
          id
            ? "A clear identity for your data."
            : "Create a publishing organization."
        }
        description="Bring your team and its datasets together."
      />
      <form className="panel editor-form narrow-panel" onSubmit={submit}>
        <FormError error={error} />
        <label>
          Organization title
          <input
            required
            value={form.title}
            onChange={(e) =>
              setForm({
                ...form,
                title: e.target.value,
                ...(!id && (!form.name || form.name === slug(form.title))
                  ? { name: slug(e.target.value) }
                  : {}),
              })
            }
            placeholder="Full organization name"
          />
        </label>
        <label>
          URL identifier
          <input
            required
            minLength={2}
            pattern="[a-z0-9_-]+"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="organization-name"
          />
        </label>
        <label>
          Description
          <textarea
            aria-label="Description"
            rows={6}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe your organization and the data it publishes."
          />
        </label>
        <div className="form-actions">
          <Link className="button button-outline" to="/organization">
            Cancel
          </Link>
          <button className="button button-dark" disabled={busy}>
            <Save size={16} />
            {busy ? "Saving…" : id ? "Save changes" : "Create organization"}
          </button>
        </div>
      </form>
    </>
  );
}

export function MembersPage() {
  return (
    <div className="page">
      <SignedIn>
        <MembersContent />
      </SignedIn>
    </div>
  );
}
function MembersContent() {
  const { id = "" } = useParams();
  const { session, refresh } = useSession();
  const organization = useAction<Organization>("organization_show", {
    id,
    include_datasets: false,
    include_users: false,
  });
  const members = useData<Member[]>("members-" + id, () =>
    request(`organizations/${encodeURIComponent(id)}/members`),
  );
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(undefined);
    setSuccess("");
    try {
      await mutate(
        "organization_member_create",
        { id, username: data.get("username"), role: data.get("role") },
        session.csrf_token,
      );
      form.reset();
      members.reload();
      await refresh();
      setSuccess("Organization membership saved.");
    } catch (error) {
      setError(asError(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove(member: Member) {
    if (
      !session ||
      !window.confirm(`Remove ${member.fullname} from this organization?`)
    )
      return;
    setError(undefined);
    try {
      await mutate(
        "organization_member_delete",
        { id, username: member.name },
        session.csrf_token,
      );
      members.reload();
      await refresh();
    } catch (error) {
      setError(asError(error));
    }
  }
  if (members.error)
    return <ErrorState error={members.error} retry={members.reload} />;
  return (
    <>
      <Link className="back-link" to={"/organization/" + id}>
        ← Back to organization
      </Link>
      <PageTitle
        eyebrow="ORGANIZATION ACCESS"
        title="The right people. The right access."
        description={organization.data?.title}
      />
      <div className="editor-layout">
        <section className="panel">
          <h2>Organization members</h2>
          <p className="muted">
            Members can read private data. Editors can manage datasets. Admins
            can also manage people and settings.
          </p>
          <FormError error={error} />
          {success && <Notice>{success}</Notice>}
          {members.loading ? (
            <Loading />
          ) : (
            <div className="member-list">
              {members.data?.map((member) => (
                <div key={member.id}>
                  <span className="avatar">
                    {member.fullname.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{member.fullname}</strong>
                    <small>@{member.name}</small>
                  </span>
                  <span className="role-badge">{member.capacity}</span>
                  <button
                    className="icon-button danger"
                    aria-label={"Remove " + member.name}
                    onClick={() => remove(member)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        <form className="panel editor-form" onSubmit={submit}>
          <span className="feature-icon">
            <Users size={23} />
          </span>
          <h2>Add or update a member</h2>
          <p className="muted">
            Enter an existing username. Selecting a role also updates an
            existing member.
          </p>
          <label>
            Username
            <input required name="username" placeholder="username" />
          </label>
          <label>
            Organization role
            <select name="role" defaultValue="member">
              <option value="member">Member — view private datasets</option>
              <option value="editor">Editor — manage datasets</option>
              <option value="admin">Admin — manage organization</option>
            </select>
          </label>
          <button className="button button-dark" disabled={busy}>
            <Plus size={16} />
            {busy ? "Saving…" : "Save membership"}
          </button>
        </form>
      </div>
    </>
  );
}

export function Account() {
  return (
    <div className="page">
      <SignedIn>
        <AccountContent />
      </SignedIn>
    </div>
  );
}
function AccountContent() {
  const { session, refresh } = useSession();
  const [version, setVersion] = useState(0);
  const tokens = useAction<Token[]>("api_token_list", {
    user: session?.user?.name,
    version,
  });
  const [created, setCreated] = useState("");
  const [error, setError] = useState<Error>();
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user) return;
    const data = new FormData(event.currentTarget);
    setError(undefined);
    setBusy(true);
    try {
      await mutate(
        "user_update",
        {
          id: session.user.id,
          fullname: data.get("fullname"),
          email: data.get("email"),
        },
        session.csrf_token,
      );
      await refresh();
      setSuccess("Profile updated.");
    } catch (error) {
      setError(asError(error));
    } finally {
      setBusy(false);
    }
  }
  async function createToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user) return;
    const form = event.currentTarget;
    const name = new FormData(form).get("name");
    setError(undefined);
    setBusy(true);
    try {
      const token = await mutate<Token>(
        "api_token_create",
        { user: session.user.name, name },
        session.csrf_token,
      );
      setCreated(token.token || "");
      form.reset();
      setVersion((value) => value + 1);
    } catch (error) {
      setError(asError(error));
    } finally {
      setBusy(false);
    }
  }
  async function revoke(token: Token) {
    if (
      !session ||
      !window.confirm(
        "Revoke this API token? Applications using it will lose access.",
      )
    )
      return;
    setError(undefined);
    try {
      await mutate(
        "api_token_revoke",
        { jti: token.id || token.jti },
        session.csrf_token,
      );
      setVersion((value) => value + 1);
      setCreated("");
    } catch (error) {
      setError(asError(error));
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="MY ACCOUNT"
        title="Your profile and access."
        description="Manage your details and the API tokens connected to your account."
      />
      <FormError error={error} />
      {success && <Notice>{success}</Notice>}
      <div className="editor-layout">
        <form className="panel editor-form" onSubmit={saveProfile}>
          <h2>Profile information</h2>
          <label>
            Username
            <input value={session?.user?.name || ""} readOnly />
          </label>
          <label>
            Full name
            <input
              name="fullname"
              defaultValue={session?.user?.fullname}
              required
            />
          </label>
          <label>
            Email address
            <input
              name="email"
              type="email"
              defaultValue={session?.user?.email}
              required
            />
          </label>
          <button className="button button-dark" disabled={busy}>
            <Save size={16} />
            Save profile
          </button>
        </form>
        <section className="panel">
          <h2>API tokens</h2>
          <p className="muted">
            Tokens give applications your account’s access. Keep them private
            and revoke ones you no longer need.
          </p>
          <form className="token-create" onSubmit={createToken}>
            <input
              name="name"
              aria-label="New API token name"
              placeholder="Name this token"
              required
            />
            <button className="button button-dark" disabled={busy}>
              <Plus size={15} />
              Create token
            </button>
          </form>
          {created && (
            <div className="token-result">
              <strong>Copy this token now. It is only shown once.</strong>
              <code>{created}</code>
              <button
                className="button button-small button-outline"
                onClick={() => {
                  void navigator.clipboard.writeText(created);
                }}
              >
                <Copy size={14} />
                Copy token
              </button>
            </div>
          )}
          {tokens.loading ? (
            <Loading />
          ) : tokens.error ? (
            <ErrorState error={tokens.error} retry={tokens.reload} />
          ) : tokens.data?.length ? (
            <div className="token-list">
              {tokens.data.map((token) => (
                <div key={token.id || token.jti || token.name}>
                  <KeyRound size={17} />
                  <span>
                    <strong>{token.name}</strong>
                    <small>{date(token.created_at)}</small>
                  </span>
                  <button
                    className="icon-button danger"
                    aria-label={"Revoke " + token.name}
                    onClick={() => revoke(token)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No API tokens yet.</p>
          )}
        </section>
      </div>
    </>
  );
}

export function Administration() {
  return (
    <div className="page">
      <SignedIn>
        <AdministrationContent />
      </SignedIn>
    </div>
  );
}
function AdministrationContent() {
  const { session } = useSession();
  const [q, setQ] = useState("");
  const [version, setVersion] = useState(0);
  const users = useData<User[]>(
    "users-" + q + version,
    () => request("users?q=" + encodeURIComponent(q)),
    Boolean(session?.user?.sysadmin),
  );
  const [error, setError] = useState<Error>();
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(undefined);
    try {
      await mutate(
        "user_create",
        {
          name: data.get("name"),
          fullname: data.get("fullname"),
          email: data.get("email"),
          password: data.get("password"),
        },
        session.csrf_token,
      );
      form.reset();
      setVersion((value) => value + 1);
      setSuccess("User created. Add them to an organization to assign access.");
    } catch (error) {
      setError(asError(error));
    } finally {
      setBusy(false);
    }
  }
  if (!session?.user?.sysadmin)
    return (
      <EmptyState
        title="Administrator access required"
        text="Only system administrators can manage portal users."
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="SYSTEM ADMINISTRATION"
        title="People behind the portal."
        description="Create user accounts, then assign organization membership and roles."
      />
      <FormError error={error} />
      {success && <Notice>{success}</Notice>}
      <div className="editor-layout">
        <section className="panel">
          <h2>Portal users</h2>
          <div className="inline-search">
            <Users size={17} />
            <input
              aria-label="Find portal users"
              placeholder="Find a user..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {users.loading ? (
            <Loading />
          ) : users.error ? (
            <ErrorState error={users.error} retry={users.reload} />
          ) : (
            <div className="member-list">
              {users.data?.map((user) => (
                <div key={user.id}>
                  <span className="avatar">
                    {(user.fullname || user.name).slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{user.fullname || user.name}</strong>
                    <small>@{user.name}</small>
                  </span>
                  <span className="role-badge">
                    {user.sysadmin ? "System admin" : "User"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
        <form className="panel editor-form" onSubmit={submit}>
          <h2>Create a user</h2>
          <label>
            Username
            <input
              name="name"
              required
              minLength={2}
              pattern="[a-z0-9_-]+"
              placeholder="username"
            />
          </label>
          <label>
            Full name
            <input name="fullname" required placeholder="Full name" />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              required
              placeholder="name@example.com"
            />
          </label>
          <label>
            Initial password
            <input
              name="password"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
              placeholder="At least 12 characters"
            />
          </label>
          <button className="button button-dark" disabled={busy}>
            <Plus size={16} />
            {busy ? "Creating…" : "Create user"}
          </button>
        </form>
      </div>
    </>
  );
}
