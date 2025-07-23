import { type ReactNode, useEffect, useState } from "react"
import { TableVirtuoso } from "react-virtuoso"
import { MultiSelectFilter } from "./components/MultiSelectFilter"
import { RangeFilter, type RangeFilterValue } from "./components/RangeFilter"
import { SortableHeader, type SortDirection } from "./components/SortableHeader"
import {
  getLocations,
  getMachineFamilies,
  getPrices,
  type Location,
  type MachineFamily,
  type Price,
  type Prices,
  type ResourceSkus
} from "./data"

function inRange(value: number | null, range: RangeFilterValue | null): boolean {
  if (range === null) {
    return true
  }
  if (typeof range.min !== "number" && typeof range.max !== "number") {
    return true
  }
  if (value === null) {
    return false
  }
  if (typeof range.min === "number" && value < range.min) {
    return false
  }
  if (typeof range.max === "number" && value > range.max) {
    return false
  }
  return true
}

function getSku(
  price: Price,
  usage_type: keyof Exclude<Price["sku"], null>,
  resource_group: keyof ResourceSkus
): ReactNode {
  const sku = price.sku?.[usage_type]?.[resource_group]
  if (!sku) {
    return null
  }
  const url = `https://cloud.google.com/skus?filter=${sku.sku_id}`
  return (
    <a href={url} rel="noopener noreferrer" target="_blank" title={sku.description}>
      {sku.sku_id}
    </a>
  )
}

interface SortState {
  field: string
  direction: SortDirection
}

export default function App() {
  const [locations, setLocations] = useState<Location[] | null>(null)
  const [machineFamilies, setMachineFamilies] = useState<MachineFamily[] | null>(null)
  const [prices, setPrices] = useState<Prices | null>(null)
  const [showSkus, setShowSkus] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [regionFilter, setRegionFilter] = useState(new Set<string>())
  const [zoneFilter, setZoneFilter] = useState(new Set<string>())
  const [familyFilter, setFamilyFilter] = useState(new Set<string>())
  const [nameFilter, setNameFilter] = useState(new Set<string>())
  const [cpuFilter, setCpuFilter] = useState(new Set<string>())
  const [memoryFilter, setMemoryFilter] = useState(new Set<string>())
  const [cpuOnDemandFilter, setCpuOnDemandFilter] = useState<RangeFilterValue | null>(null)
  const [memoryOnDemandFilter, setMemoryOnDemandFilter] = useState<RangeFilterValue | null>(null)
  const [totalOnDemandFilter, setTotalOnDemandFilter] = useState<RangeFilterValue | null>(null)
  const [cpuSpotFilter, setCpuSpotFilter] = useState<RangeFilterValue | null>(null)
  const [memorySpotFilter, setMemorySpotFilter] = useState<RangeFilterValue | null>(null)
  const [totalSpotFilter, setTotalSpotFilter] = useState<RangeFilterValue | null>(null)
  const [discountRateFilter, setDiscountRateFilter] = useState<RangeFilterValue | null>(null)
  const [sortStates, setSortStates] = useState<SortState[]>([])

  useEffect(() => {
    getLocations().then(res => setLocations(res))
    getMachineFamilies().then(res => setMachineFamilies(res))
    getPrices().then(res => setPrices(res))
  }, [])

  function onResetFilters() {
    setRegionFilter(new Set<string>())
    setZoneFilter(new Set<string>())
    setFamilyFilter(new Set<string>())
    setNameFilter(new Set<string>())
    setCpuFilter(new Set<string>())
    setMemoryFilter(new Set<string>())
    setCpuOnDemandFilter(null)
    setMemoryOnDemandFilter(null)
    setTotalOnDemandFilter(null)
    setCpuSpotFilter(null)
    setMemorySpotFilter(null)
    setTotalSpotFilter(null)
    setDiscountRateFilter(null)
  }

  function onSort(enableMultiSort: boolean, field: string) {
    if (!enableMultiSort) {
      const direction =
        sortStates.find(s => s.field === field)?.direction === "asc" ? "desc" : "asc"
      setSortStates([{ field, direction }])
      return
    }
    const newStates: SortState[] = [...sortStates]
    const idx = sortStates.findIndex(s => s.field === field)
    if (idx === -1) {
      newStates.push({ field, direction: "asc" })
    } else {
      newStates[idx].direction = newStates[idx].direction === "asc" ? "desc" : "asc"
    }
    setSortStates(newStates)
  }

  const regions = [...new Set(prices?.prices.map(p => p.region))].sort()
  const zones = [...new Set(prices?.prices.map(price => price.zone))].sort()
  const families = [...new Set(prices?.prices.map(price => price.family))].sort()
  const names = [...new Set(prices?.prices.map(price => price.name))].sort()
  const cpus = [...new Set(prices?.prices.map(price => price.guest_cpus))]
    .sort((a, b) => a - b)
    .map(cpu => cpu.toString())
  const memories = [...new Set(prices?.prices.map(price => price.memory_mb))]
    .sort((a, b) => a - b)
    .map(memory => memory.toString())

  const filteredPrices = prices?.prices.filter(
    price =>
      (regionFilter.size === 0 || regionFilter.has(price.region)) &&
      (zoneFilter.size === 0 || zoneFilter.has(price.zone)) &&
      (familyFilter.size === 0 || familyFilter.has(price.family)) &&
      (nameFilter.size === 0 || nameFilter.has(price.name)) &&
      (cpuFilter.size === 0 || cpuFilter.has(price.guest_cpus.toString())) &&
      (memoryFilter.size === 0 || memoryFilter.has(price.memory_mb.toString())) &&
      inRange(price.cpu_on_demand, cpuOnDemandFilter) &&
      inRange(price.memory_on_demand, memoryOnDemandFilter) &&
      inRange(price.total_on_demand, totalOnDemandFilter) &&
      inRange(price.cpu_spot, cpuSpotFilter) &&
      inRange(price.memory_spot, memorySpotFilter) &&
      inRange(price.total_spot, totalSpotFilter) &&
      inRange(price.discount_rate, discountRateFilter)
  )
  const sortedPrices =
    sortStates.length === 0
      ? filteredPrices
      : filteredPrices?.sort((a, b) => {
          for (const sortState of sortStates) {
            const aVal = a[sortState.field as Exclude<keyof Price, "sku">]
            const bVal = b[sortState.field as Exclude<keyof Price, "sku">]

            if (aVal === null && bVal === null) {
              continue
            }
            if (aVal === null) {
              return 1
            }
            if (bVal === null) {
              return -1
            }

            let comparison = 0
            if (aVal < bVal) {
              comparison = -1
            }
            if (aVal > bVal) {
              comparison = 1
            }

            if (comparison !== 0) {
              return sortState.direction === "asc" ? comparison : -comparison
            }
          }
          return 0
        })

  return (
    <div className="vstack">
      <div id="header">
        <div className="hstack">
          <div>
            <button
              className={showFilters ? "on" : ""}
              onClick={() => setShowFilters(!showFilters)}
              type="button"
            >
              {showFilters ? "Hide" : "Show"} Filters
            </button>
            <button onClick={onResetFilters} type="button">
              Reset Filters
            </button>
            <button
              className={showSkus ? "on" : ""}
              onClick={() => setShowSkus(!showSkus)}
              type="button"
            >
              {showSkus ? "Hide" : "Show"} SKUs
            </button>
            <details>
              <summary>Regions</summary>
              <table>
                <thead>
                  <tr>
                    <th>Region</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {locations?.map(({ region, location }) => (
                    <tr key={region}>
                      <td>{region}</td>
                      <td>{location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
            <details>
              <summary>Machine Families</summary>
              <table>
                <thead>
                  <tr>
                    <th>Machine Family</th>
                    <th>Category</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {machineFamilies?.map(({ name, category, description }) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{category}</td>
                      <td>{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
          <div style={{ flex: 1, minWidth: "25%" }}>
            <ul>
              <li>
                No guarantee for data accuracy. Use at your own risk and verify the official pricing
                information:{" "}
                <a
                  href="https://cloud.google.com/compute/vm-instance-pricing"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  VM instance pricing | Google Cloud
                </a>
              </li>
              <li>
                You can get the raw pricing data in{" "}
                <a href={`${import.meta.env.BASE_URL}data/prices.json`}>JSON</a>. The data
                generation process is open-source in{" "}
                <a href="https://github.com/fuzmish/cw-gce-pricing">our repository</a>.
              </li>
              <li>The pricing data was last updated on {prices?.generated_at.toISOString()}.</li>
              <li>
                Click column headers to sort in ascending or descending order. ⌘+click to sort by
                multiple columns.
              </li>
              <li>Multi-select filters: ⌘+click to select or deselect multiple options.</li>
            </ul>
          </div>
        </div>
      </div>
      <TableVirtuoso
        data={sortedPrices}
        fixedHeaderContent={() => (
          <>
            <tr>
              <SortableHeader
                fieldName="region"
                label="Region"
                onSort={onSort}
                state={sortStates}
                style={{ minWidth: "150px" }}
              />
              <SortableHeader
                fieldName="zone"
                label="Zone"
                onSort={onSort}
                state={sortStates}
                style={{ minWidth: "180px" }}
              />
              <SortableHeader
                fieldName="family"
                label="Family"
                onSort={onSort}
                state={sortStates}
              />
              <SortableHeader
                fieldName="name"
                label="Name"
                onSort={onSort}
                state={sortStates}
                style={{ minWidth: "180px" }}
              />
              <SortableHeader
                fieldName="guest_cpus"
                label="Guest CPUs"
                onSort={onSort}
                state={sortStates}
              />
              <SortableHeader
                fieldName="memory_mb"
                label="Memory MB"
                onSort={onSort}
                state={sortStates}
              />
              <SortableHeader
                fieldName="cpu_on_demand"
                label="CPU On Demand"
                onSort={onSort}
                state={sortStates}
              />
              <SortableHeader
                fieldName="memory_on_demand"
                label="Memory On Demand"
                onSort={onSort}
                state={sortStates}
              />
              <SortableHeader
                fieldName="total_on_demand"
                label="Total On Demand"
                onSort={onSort}
                state={sortStates}
              />
              <SortableHeader
                fieldName="cpu_spot"
                label="CPU Spot"
                onSort={onSort}
                state={sortStates}
              />
              <SortableHeader
                fieldName="memory_spot"
                label="Memory Spot"
                onSort={onSort}
                state={sortStates}
              />
              <SortableHeader
                fieldName="total_spot"
                label="Total Spot"
                onSort={onSort}
                state={sortStates}
              />
              <SortableHeader
                fieldName="discount_rate"
                label="Discount Rate"
                onSort={onSort}
                state={sortStates}
              />
            </tr>
            {showFilters && (
              <tr>
                <MultiSelectFilter
                  onValueChange={setRegionFilter}
                  options={regions}
                  value={regionFilter}
                />
                <MultiSelectFilter
                  onValueChange={setZoneFilter}
                  options={zones}
                  value={zoneFilter}
                />
                <MultiSelectFilter
                  onValueChange={setFamilyFilter}
                  options={families}
                  value={familyFilter}
                />
                <MultiSelectFilter
                  onValueChange={setNameFilter}
                  options={names}
                  value={nameFilter}
                />
                <MultiSelectFilter onValueChange={setCpuFilter} options={cpus} value={cpuFilter} />
                <MultiSelectFilter
                  onValueChange={setMemoryFilter}
                  options={memories}
                  value={memoryFilter}
                />
                <RangeFilter onValueChange={setCpuOnDemandFilter} value={cpuOnDemandFilter} />
                <RangeFilter onValueChange={setMemoryOnDemandFilter} value={memoryOnDemandFilter} />
                <RangeFilter onValueChange={setTotalOnDemandFilter} value={totalOnDemandFilter} />
                <RangeFilter onValueChange={setCpuSpotFilter} value={cpuSpotFilter} />
                <RangeFilter onValueChange={setMemorySpotFilter} value={memorySpotFilter} />
                <RangeFilter onValueChange={setTotalSpotFilter} value={totalSpotFilter} />
                <RangeFilter onValueChange={setDiscountRateFilter} value={discountRateFilter} />
              </tr>
            )}
          </>
        )}
        id="data"
        itemContent={(_, price) => (
          <>
            <td>{price.region}</td>
            <td>{price.zone}</td>
            <td>{price.family}</td>
            <td>{price.name}</td>
            <td>{price.guest_cpus}</td>
            <td>{price.memory_mb}</td>
            <td>
              {price.cpu_on_demand?.toFixed(2) || "-"}
              {showSkus && <div className="sku">{getSku(price, "OnDemand", "CPU")}</div>}
            </td>
            <td>
              {price.memory_on_demand?.toFixed(2) || "-"}
              {showSkus && <div className="sku">{getSku(price, "OnDemand", "RAM")}</div>}
            </td>
            <td>{price.total_on_demand?.toFixed(2) || "-"}</td>
            <td>
              {price.cpu_spot?.toFixed(2) || "-"}
              {showSkus && <div className="sku">{getSku(price, "Preemptible", "CPU")}</div>}
            </td>
            <td>
              {price.memory_spot?.toFixed(2) || "-"}
              {showSkus && <div className="sku">{getSku(price, "Preemptible", "RAM")}</div>}
            </td>
            <td>{price.total_spot?.toFixed(2) || "-"}</td>
            <td>{price.discount_rate ? `${price.discount_rate.toFixed(2)}%` : "-"}</td>
          </>
        )}
      />
      <div id="footer">
        Showing {filteredPrices?.length.toLocaleString("en-US")} of{" "}
        {prices?.prices.length.toLocaleString("en-US")} records.
      </div>
    </div>
  )
}
