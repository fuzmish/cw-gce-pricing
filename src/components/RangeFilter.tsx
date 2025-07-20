export interface RangeFilterValue {
  max?: number | null
  min?: number | null
}

export interface RangeFilterProps
  extends React.DetailedHTMLProps<
    React.TdHTMLAttributes<HTMLTableCellElement>,
    HTMLTableCellElement
  > {
  onValueChange: (value: RangeFilterValue) => void
  value: RangeFilterValue | null
}

export function RangeFilter({ onValueChange, value, width = "80px", ...props }: RangeFilterProps) {
  return (
    <td {...props}>
      <div className="vstack" style={{ width }}>
        <input
          onChange={e =>
            onValueChange({ ...value, min: e.target.value ? Number(e.target.value) : null })
          }
          placeholder="Min"
          style={{ flex: 1 }}
          type="number"
          value={value?.min ?? ""}
        />
        <input
          onChange={e =>
            onValueChange({ ...value, max: e.target.value ? Number(e.target.value) : null })
          }
          placeholder="Max"
          style={{ flex: 1 }}
          type="number"
          value={value?.max ?? ""}
        />
      </div>
    </td>
  )
}
