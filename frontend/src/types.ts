export interface User {
  id: string;
  name: string;
  fullname: string;
  email: string;
  sysadmin: boolean;
  state?: string;
}
export interface Organization {
  id: string;
  name: string;
  title: string;
  display_name?: string;
  description?: string;
  image_display_url?: string;
  image_url?: string;
  extras?: { key: string; value: string }[];
  package_count?: number;
  capacity?: string;
  users?: User[];
}
export interface PortalSession {
  user: User | null;
  csrf_token: string;
  organizations: Organization[];
  can_create_organizations: boolean;
  site_title: string;
}
export interface Tag {
  name: string;
  display_name?: string;
}
export interface Resource {
  nis_import?: string;
  nis_series?: string;
  nis_role?: string;
  id: string;
  name: string;
  description?: string;
  format: string;
  url: string;
  datastore_active?: boolean;
  size?: number;
  created?: string;
  last_modified?: string;
  mimetype?: string;
}
export interface Dataset {
  id: string;
  name: string;
  title: string;
  notes?: string;
  organization?: Organization;
  owner_org: string;
  private: boolean;
  resources: Resource[];
  tags: Tag[];
  metadata_modified: string;
  metadata_created?: string;
  license_title?: string;
  license_id?: string;
  url?: string;
  version?: string;
  author?: string;
  author_email?: string;
  maintainer_email?: string;
  maintainer?: string;
  extras?: { key: string; value: string }[];
}
export interface Facet {
  name: string;
  display_name: string;
  count: number;
}
export interface SearchResult {
  count: number;
  results: Dataset[];
  search_facets: Record<string, { title: string; items: Facet[] }>;
}
export interface DataField {
  id: string;
  type: string;
  info?: { label?: string; notes?: string; type_override?: string };
}
export interface DataTable {
  total: number;
  records: Record<string, unknown>[];
  fields: DataField[];
}
export interface Member {
  id: string;
  name: string;
  fullname: string;
  capacity: string;
}
export interface Token {
  id?: string;
  jti?: string;
  name: string;
  created_at?: string;
  token?: string;
}
export interface License {
  id: string;
  title: string;
}

export interface UploadStatus {
  status: string;
  last_updated?: string;
  error?: unknown;
  logs: { timestamp?: string; level?: string; message?: string }[];
  datastore_active: boolean;
  row_count: number | null;
  field_count: number;
  can_import: boolean;
  datapusher_enabled: boolean;
}
export interface ResourceView {
  id: string;
  resource_id: string;
  title: string;
  description?: string;
  view_type: string;
  responsive?: boolean;
  ellipsis_length?: number;
  [key: string]: unknown;
}
export interface ViewType {
  name: string;
  title: string;
}
export interface DataStoreInfo {
  fields: DataField[];
  meta: { count: number; id: string; size?: number };
}
