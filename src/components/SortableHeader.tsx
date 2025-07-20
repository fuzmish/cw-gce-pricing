export type SortDirection = "asc" | "desc"

export interface SortState {
  field: string
  direction: SortDirection
}

export interface SortableHeaderProps
  extends React.DetailedHTMLProps<
    React.TdHTMLAttributes<HTMLTableCellElement>,
    HTMLTableCellElement
  > {
  fieldName: string
  label: string
  onSort?: (enableMultiSort: boolean, fieldName: string) => void
  state: SortState[]
}

export function SortableHeader({ fieldName, label, onSort, state, ...props }: SortableHeaderProps) {
  const currentSort = state.find(s => s.field === fieldName)
  const sortIndex = currentSort ? state.findIndex(s => s.field === fieldName) : -1
  return (
    <th {...props}>
      <button
        className="sort-button"
        onClick={e => onSort?.(e.metaKey || e.ctrlKey, fieldName)}
        type="button"
      >
        {label}
        {currentSort && (
          <span className="sort-button-icon">
            {currentSort.direction === "asc" ? "↑" : "↓"}
            {state.length > 1 && <span className="sort-index">{sortIndex + 1}</span>}
          </span>
        )}
      </button>
    </th>
  )
}
