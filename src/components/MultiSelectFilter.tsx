export interface MultiSelectProps
  extends React.DetailedHTMLProps<
    React.TdHTMLAttributes<HTMLTableCellElement>,
    HTMLTableCellElement
  > {
  onValueChange: (value: Set<string>) => void
  options: Iterable<string>
  value: Iterable<string>
}

export function MultiSelectFilter({
  height = "100px",
  onValueChange,
  options,
  value,
  ...props
}: MultiSelectProps) {
  return (
    <td {...props}>
      <select
        multiple
        onChange={e => onValueChange(new Set([...e.target.selectedOptions].map(o => o.value)))}
        style={{ height }}
        value={[...value]}
      >
        {[...options].map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </td>
  )
}
