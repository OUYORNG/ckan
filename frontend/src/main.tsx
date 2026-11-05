import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import "@fontsource-variable/inter";
import "@fontsource/noto-sans-khmer/400.css";
import "@fontsource/noto-sans-khmer/600.css";
import "./styles.css";
import { SessionProvider } from "./session";
import { Shell, EmptyState } from "./components";
import {
  About,
  ApiGuide,
  Catalog,
  DatasetDetail,
  Home,
  OrganizationDetail,
  Organizations,
} from "./catalog";
import { ResourcePage } from "./resource";
import { ResourceManagement } from "./resource-manage";
import { OrganizationDatasets } from "./organization-datasets";
import {
  Account,
  Administration,
  DatasetEditor,
  Login,
  MembersPage,
  OrganizationEditor,
  ResourceUpload,
  Workspace,
} from "./manage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <ScrollToTop />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Shell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dataset" element={<Catalog />} />
            <Route path="/dataset/new" element={<DatasetEditor />} />
            <Route path="/dataset/edit/:id" element={<DatasetEditor />} />
            <Route path="/dataset/:id" element={<DatasetDetail />} />
            <Route
              path="/dataset/:id/resource/new"
              element={<ResourceUpload />}
            />
            <Route
              path="/dataset/:id/resource/:resourceId"
              element={<ResourcePage />}
            />
            <Route
              path="/dataset/:id/resource/:resourceId/edit"
              element={<ResourceManagement />}
            />
            <Route
              path="/dataset/:id/resource_edit/:resourceId"
              element={<ResourceManagement />}
            />
            <Route
              path="/dataset/:id/resource_data/:resourceId"
              element={<ResourceManagement />}
            />
            <Route
              path="/dataset/:id/resource_upload_log/:resourceId"
              element={<ResourceManagement />}
            />
            <Route
              path="/dataset/:id/dictionary/:resourceId"
              element={<ResourceManagement />}
            />
            <Route
              path="/dataset/:id/resource/:resourceId/views"
              element={<ResourceManagement />}
            />
            <Route path="/organization" element={<Organizations />} />
            <Route path="/organization/new" element={<OrganizationEditor />} />
            <Route
              path="/organization/edit/:id"
              element={<OrganizationEditor />}
            />
            <Route path="/organization/members/:id" element={<MembersPage />} />
            <Route
              path="/organization/manage_members/:id"
              element={<MembersPage />}
            />
            <Route
              path="/organization/bulk_process/:id"
              element={<OrganizationDatasets />}
            />
            <Route path="/organization/:id" element={<OrganizationDetail />} />
            <Route path="/group" element={<Organizations topics />} />
            <Route path="/group/:id" element={<OrganizationDetail topic />} />
            <Route path="/login" element={<Login />} />
            <Route path="/user/login" element={<Login />} />
            <Route path="/user/me" element={<Account />} />
            <Route path="/user/edit" element={<Account />} />
            <Route path="/user/edit/:id" element={<Account />} />
            <Route path="/user/:id/api-tokens" element={<Account />} />
            <Route
              path="/user/logged_in"
              element={<Navigate to="/workspace" replace />}
            />
            <Route
              path="/user/logged_out"
              element={<Navigate to="/login" replace />}
            />
            <Route
              path="/user/logged_out_redirect"
              element={<Navigate to="/login" replace />}
            />
            <Route path="/user/register" element={<Administration />} />
            <Route path="/account" element={<Account />} />
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/dashboard/*" element={<Workspace />} />
            <Route path="/ckan-admin/*" element={<Administration />} />
            <Route path="/about" element={<About />} />
            <Route path="/api-guide" element={<ApiGuide />} />
            <Route
              path="*"
              element={
                <div className="page">
                  <EmptyState
                    title="This page isn’t here."
                    text="The page may have moved, or the address might be incorrect."
                  >
                    <Link className="button button-dark" to="/">
                      Back to overview
                    </Link>
                  </EmptyState>
                </div>
              }
            />
          </Routes>
        </Shell>
      </BrowserRouter>
    </SessionProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
