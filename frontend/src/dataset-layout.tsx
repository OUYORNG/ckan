import { LayoutGrid, List, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { date, plain } from "./api";
import { FormatBadge, PrivacyBadge } from "./components";
import type { Dataset } from "./types";

export type DatasetLayout = "rows" | "cards";
export function DatasetLayoutToggle({
  value,
  onChange,
}: {
  value: DatasetLayout;
  onChange: (value: DatasetLayout) => void;
}) {
  return (
    <div
      className="dataset-layout-toggle"
      role="group"
      aria-label="Dataset layout"
    >
      <button
        type="button"
        aria-label="Row view"
        aria-pressed={value === "rows"}
        onClick={() => onChange("rows")}
      >
        <List size={16} />
        Rows
      </button>
      <button
        type="button"
        aria-label="Card view"
        aria-pressed={value === "cards"}
        onClick={() => onChange("cards")}
      >
        <LayoutGrid size={16} />
        Cards
      </button>
    </div>
  );
}
export function DatasetRows({
  datasets,
  selected,
  onSelect,
  edit = false,
  disabled = false,
}: {
  datasets: Dataset[];
  selected?: Set<string>;
  onSelect?: (id: string, checked: boolean) => void;
  edit?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="dataset-rows-scroll">
      <table className="dataset-rows">
        <thead>
          <tr>
            {onSelect && (
              <th scope="col">
                <span className="sr-only">Selection</span>
              </th>
            )}
            <th scope="col">Dataset</th>
            <th scope="col">Visibility</th>
            <th scope="col">Resources</th>
            <th scope="col">Updated</th>
            {edit && (
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {datasets.map((dataset) => (
            <tr className="dataset-entry" key={dataset.id}>
              {onSelect && (
                <td>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    aria-label={`Select ${dataset.title || dataset.name}`}
                    checked={selected?.has(dataset.id) || false}
                    onChange={(event) =>
                      onSelect(dataset.id, event.target.checked)
                    }
                  />
                </td>
              )}
              <td className="dataset-row-title">
                <h3>
                  <Link to={"/dataset/" + dataset.name}>
                    {dataset.title || dataset.name}
                  </Link>
                </h3>
                <p>
                  {plain(dataset.notes) ||
                    dataset.organization?.title ||
                    dataset.name}
                </p>
                <div className="card-formats">
                  {[
                    ...new Set(
                      dataset.resources
                        .map((resource) => resource.format.toUpperCase())
                        .filter(Boolean),
                    ),
                  ]
                    .slice(0, 3)
                    .map((format) => (
                      <FormatBadge key={format} format={format} />
                    ))}
                </div>
              </td>
              <td>
                <PrivacyBadge private={dataset.private} />
              </td>
              <td>{dataset.resources.length}</td>
              <td>{date(dataset.metadata_modified)}</td>
              {edit && (
                <td>
                  <Link
                    className="text-link"
                    to={"/dataset/edit/" + dataset.name}
                    aria-label={`Edit ${dataset.title || dataset.name}`}
                  >
                    <Pencil size={14} />
                    Edit
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
