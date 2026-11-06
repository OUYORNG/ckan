import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FolderOpen,
  Globe2,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { ApiError, date, plain, request, safeUrl } from "./api";
import { useSession } from "./session";
import type { Dataset, Organization, PortalSession } from "./types";

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="NIS Data Portal home">
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-text">
        <strong>
          NIS<span className="brand-light"> DATA</span>
        </strong>
        <small>Cambodia data portal</small>
      </span>
    </Link>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const { session, update, refresh } = useSession();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("nis-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("nis-sidebar-collapsed", String(collapsed));
    } catch {
      /* Navigation remains usable when browser storage is unavailable. */
    }
  }, [collapsed]);
  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  const [query, setQuery] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const section = location.pathname.startsWith("/dataset")
    ? "Data catalog"
    : location.pathname.startsWith("/organization")
      ? "Organizations"
      : location.pathname.startsWith("/group")
        ? "Topics"
        : location.pathname.startsWith("/workspace")
          ? "My workspace"
          : location.pathname === "/account"
            ? "My account"
            : location.pathname.includes("admin")
              ? "Administration"
              : "Overview";
  function search(event: FormEvent) {
    event.preventDefault();
    navigate(
      "/dataset" +
        (query.trim() ? "?q=" + encodeURIComponent(query.trim()) : ""),
    );
    setQuery("");
  }
  async function logout() {
    if (!session) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const next = await request<PortalSession>("logout", {
        method: "POST",
        headers: { "X-CSRFToken": session.csrf_token },
      });
      update(next);
      navigate("/");
      await refresh();
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Unable to sign out.",
      );
    } finally {
      setLoggingOut(false);
    }
  }
  const links = [
    { to: "/", label: "Overview", icon: LayoutDashboard },
    { to: "/dataset", label: "Data catalog", icon: Database },
    { to: "/organization", label: "Organizations", icon: Building2 },
    { to: "/group", label: "Topics", icon: FolderOpen },
  ];
  return (
    <div className={"app-shell" + (collapsed ? " sidebar-collapsed" : "")}>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside id="portal-sidebar" className={"sidebar" + (open ? " open" : "")}>
        <Brand />
        <div className="sidebar-section-label">EXPLORE</div>
        <nav aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              title={label}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                "nav-item" + (isActive ? " active" : "")
              }
            >
              <Icon size={19} />
              <span className="nav-label">{label}</span>
              {to === "/dataset" && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-section-label workspace-label">WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          <NavLink
            to="/workspace"
            aria-label="My workspace"
            title="My workspace"
            onClick={() => setOpen(false)}
            className="nav-item"
          >
            <Users size={19} />
            <span className="nav-label">My workspace</span>
            {!session?.user && <LockKeyhole size={13} className="muted" />}
          </NavLink>
          {session?.user?.sysadmin && (
            <NavLink
              to="/ckan-admin"
              aria-label="Administration"
              title="Administration"
              className="nav-item"
              onClick={() => setOpen(false)}
            >
              <ShieldCheck size={19} />
              <span className="nav-label">Administration</span>
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <Link
            className="sidebar-api-icon nav-item"
            to="/api-guide"
            aria-label="API guide"
            title="API guide"
            onClick={() => setOpen(false)}
          >
            <BookOpen size={19} />
          </Link>
          <div className="sidebar-help">
            <div className="help-icon">
              <BookOpen size={19} />
            </div>
            <strong>Make data work for you</strong>
            <p>Explore the API and connect data to your own tools.</p>
            <Link to="/api-guide" onClick={() => setOpen(false)}>
              View API guide <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="sidebar-footer">
            <Globe2 size={14} />
            <span>National Institute of Statistics</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button sidebar-toggle"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              aria-controls="portal-sidebar"
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? (
                <PanelLeftOpen size={21} />
              ) : (
                <PanelLeftClose size={21} />
              )}
            </button>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-controls="portal-sidebar"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-muted">Portal</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{section}</strong>
          </div>
          <form className="topbar-search" onSubmit={search}>
            <Search size={17} />
            <input
              aria-label="Search datasets"
              placeholder="Search datasets..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="topbar-right">
            <Link to="/api-guide" className="topbar-api">
              API <ArrowUpRight size={13} />
            </Link>
            {session?.user ? (
              <>
                <Link className="account-chip" to="/account">
                  <span className="avatar">
                    {session.user.fullname.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="account-text">
                    <strong>{session.user.fullname}</strong>
                    <small>
                      {session.user.sysadmin
                        ? "System administrator"
                        : "Organization member"}
                    </small>
                  </span>
                </Link>
                <button
                  className="icon-button logout-button"
                  onClick={logout}
                  disabled={loggingOut}
                  aria-label="Sign out"
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <Link className="button button-small button-dark" to="/login">
                <KeyRound size={15} />
                Sign in
              </Link>
            )}
          </div>
        </header>
        {logoutError && (
          <div className="top-error" role="alert">
            {logoutError}
          </div>
        )}
        <main id="main-content" key={session?.user?.id || "anonymous"}>
          {children}
        </main>
        <footer className="page-footer">
          <span>
            National Institute of Statistics{" "}
            <span className="footer-divider">/</span> Cambodia
          </span>
          <div>
            <Link to="/about">About this portal</Link>
            <Link to="/api-guide">
              API documentation <ArrowUpRight size={12} />
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="title-actions">{children}</div>}
    </div>
  );
}
export function Loading({ label = "Loading data" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{label}…</span>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <ShieldCheck size={23} />
      <div>
        <strong>
          {error instanceof ApiError && [403, 404].includes(error.status)
            ? "This content is not available"
            : "We couldn’t load this information"}
        </strong>
        <p>{error.message}</p>
        {error instanceof ApiError && [403, 404].includes(error.status) && (
          <Link to="/login">
            Sign in with an authorized account <ArrowRight size={14} />
          </Link>
        )}
        {retry && (
          <button
            className="button button-small button-outline"
            onClick={retry}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function EmptyState({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Database size={29} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function FormatBadge({ format }: { format: string }) {
  const normalized = format.toUpperCase() || "FILE";
  return (
    <span
      className={
        "format-badge format-" + normalized.toLowerCase().replace(/[^a-z]/g, "")
      }
    >
      {normalized}
    </span>
  );
}
export function PrivacyBadge({ private: isPrivate }: { private: boolean }) {
  return (
    <span className={"privacy-badge" + (isPrivate ? " is-private" : "")}>
      {isPrivate ? <LockKeyhole size={11} /> : <Globe2 size={11} />}{" "}
      {isPrivate ? "Private" : "Public"}
    </span>
  );
}
export function DatasetCard({
  dataset,
  compact = false,
}: {
  dataset: Dataset;
  compact?: boolean;
}) {
  const formats = [
    ...new Set(
      dataset.resources.map((r) => r.format.toUpperCase()).filter(Boolean),
    ),
  ];
  return (
    <article
      className={"dataset-card dataset-entry" + (compact ? " compact" : "")}
    >
      <div className="card-topline">
        <span className="dataset-icon">
          <Database size={20} />
        </span>
        <PrivacyBadge private={dataset.private} />
      </div>
      <div className="card-organization">
        {dataset.organization?.title ||
          dataset.organization?.name ||
          "Data collection"}
      </div>
      <h3>
        <Link to={"/dataset/" + dataset.name}>
          {dataset.title || dataset.name}
        </Link>
      </h3>
      <p className="card-description">
        {plain(dataset.notes) ||
          "Explore the resources and metadata in this dataset."}
      </p>
      <div className="card-formats">
        {formats.slice(0, 3).map((format) => (
          <FormatBadge key={format} format={format} />
        ))}
        <span className="resource-count">
          {dataset.resources.length} resource
          {dataset.resources.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="card-footer">
        <span>Updated {date(dataset.metadata_modified)}</span>
        <Link
          to={"/dataset/" + dataset.name}
          aria-label={"Explore " + dataset.title}
        >
          <ArrowUpRight size={19} />
        </Link>
      </div>
    </article>
  );
}
export function OrgAvatar({
  org,
  large = false,
}: {
  org: Organization;
  large?: boolean;
}) {
  const image = safeUrl(org.image_display_url);
  return (
    <div className={"org-avatar" + (large ? " large" : "")}>
      {image ? (
        <img src={image} alt="" />
      ) : (
        <Building2 size={large ? 33 : 23} />
      )}
    </div>
  );
}
export function Pagination({
  count,
  page,
  size,
  onPage,
}: {
  count: number;
  page: number;
  size: number;
  onPage: (page: number) => void;
}) {
  if (!count) return null;
  const pages = Math.max(1, Math.ceil(count / size));
  return (
    <div className="pagination">
      <span>
        Showing{" "}
        <strong>
          {Math.min((page - 1) * size + 1, count)}–
          {Math.min(page * size, count)}
        </strong>{" "}
        of <strong>{count.toLocaleString()}</strong>
      </span>
      <div>
        <button
          className="icon-button"
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="page-number">{page}</span>
        <span className="page-total">of {pages}</span>
        <button
          className="icon-button"
          disabled={page >= pages}
          aria-label="Next page"
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
export function FormError({ error }: { error?: Error }) {
  if (!error) return null;
  const details = error instanceof ApiError ? error.details : undefined;
  return (
    <div className="form-error" role="alert">
      <strong>{error.message}</strong>
      {details && (
        <ul>
          {Object.entries(details)
            .filter(([key]) => !key.startsWith("__"))
            .map(([key, value]) => (
              <li key={key}>
                {key}:{" "}
                {typeof value === "string" ? value : JSON.stringify(value)}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice" role="status">
      <Check size={17} />
      {children}
    </div>
  );
}
export function DownloadLink({
  url,
  children = "Download",
  className = "button button-dark",
}: {
  url?: string;
  children?: ReactNode;
  className?: string;
}) {
  const target = safeUrl(url);
  if (!target) return <span className="muted">No download available</span>;
  return (
    <a className={className} href={target} target="_blank" rel="noreferrer">
      <ArrowDownToLine size={16} />
      {children}
    </a>
  );
}
export function SignedIn({ children }: { children: ReactNode }) {
  const { session, error, refresh } = useSession();
  if (error)
    return (
      <ErrorState
        error={error}
        retry={() => {
          void refresh();
        }}
      />
    );
  if (!session) return <Loading label="Checking your session" />;
  if (!session.user)
    return (
      <EmptyState
        title="Your workspace starts here"
        text="Sign in to access private datasets, manage your organization, and share new data."
      >
        <Link className="button button-dark" to="/login">
          <KeyRound size={16} />
          Sign in to your account
        </Link>
      </EmptyState>
    );
  return children;
}
export {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  Database,
  FileSpreadsheet,
  FolderOpen,
  Globe2,
  KeyRound,
  LockKeyhole,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
};
