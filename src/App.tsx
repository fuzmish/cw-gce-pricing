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
  const [gpuOnDemandFilter, setGpuOnDemandFilter] = useState<RangeFilterValue | null>(null)
  const [totalOnDemandFilter, setTotalOnDemandFilter] = useState<RangeFilterValue | null>(null)
  const [cpuSpotFilter, setCpuSpotFilter] = useState<RangeFilterValue | null>(null)
  const [memorySpotFilter, setMemorySpotFilter] = useState<RangeFilterValue | null>(null)
  const [gpuSpotFilter, setGpuSpotFilter] = useState<RangeFilterValue | null>(null)
  const [totalSpotFilter, setTotalSpotFilter] = useState<RangeFilterValue | null>(null)
  const [discountRateSpotFilter, setDiscountRateSpotFilter] = useState<RangeFilterValue | null>(
    null
  )
  const [cpuC1yFilter, setCpuC1yFilter] = useState<RangeFilterValue | null>(null)
  const [memoryC1yFilter, setMemoryC1yFilter] = useState<RangeFilterValue | null>(null)
  const [gpuC1yFilter, setGpuC1yFilter] = useState<RangeFilterValue | null>(null)
  const [totalC1yFilter, setTotalC1yFilter] = useState<RangeFilterValue | null>(null)
  const [discountRateC1yFilter, setDiscountRateC1yFilter] = useState<RangeFilterValue | null>(null)
  const [cpuC3yFilter, setCpuC3yFilter] = useState<RangeFilterValue | null>(null)
  const [memoryC3yFilter, setMemoryC3yFilter] = useState<RangeFilterValue | null>(null)
  const [gpuC3yFilter, setGpuC3yFilter] = useState<RangeFilterValue | null>(null)
  const [totalC3yFilter, setTotalC3yFilter] = useState<RangeFilterValue | null>(null)
  const [discountRateC3yFilter, setDiscountRateC3yFilter] = useState<RangeFilterValue | null>(null)
  const [sortStates, setSortStates] = useState<SortState[]>([])
  const [columnVisibility, setColumnVisibility] = useState({
    region: true,
    zone: true,
    family: true,
    name: true,
    guest_cpus: true,
    memory_mb: true,
    cpu_on_demand: false,
    memory_on_demand: false,
    gpu_on_demand: false,
    total_on_demand: true,
    cpu_spot: false,
    memory_spot: false,
    gpu_spot: false,
    total_spot: true,
    discount_rate_spot: true,
    cpu_c1y: false,
    memory_c1y: false,
    gpu_c1y: false,
    total_c1y: true,
    discount_rate_c1y: true,
    cpu_c3y: false,
    memory_c3y: false,
    gpu_c3y: false,
    total_c3y: true,
    discount_rate_c3y: true
  })

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
    setGpuOnDemandFilter(null)
    setTotalOnDemandFilter(null)
    setCpuSpotFilter(null)
    setMemorySpotFilter(null)
    setGpuSpotFilter(null)
    setTotalSpotFilter(null)
    setDiscountRateSpotFilter(null)
    setCpuC1yFilter(null)
    setMemoryC1yFilter(null)
    setGpuC1yFilter(null)
    setTotalC1yFilter(null)
    setDiscountRateC1yFilter(null)
    setCpuC3yFilter(null)
    setMemoryC3yFilter(null)
    setGpuC3yFilter(null)
    setTotalC3yFilter(null)
    setDiscountRateC3yFilter(null)
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
  const zones = [...new Set(prices?.prices.flatMap(price => price.zones))].sort()
  const families = [...new Set(prices?.prices.map(price => price.family))].sort()
  const names = [...new Set(prices?.prices.map(price => price.name))].sort()
  const cpus = [...new Set(prices?.prices.map(price => price.guest_cpus))]
    .filter(cpu => typeof cpu === "number")
    .sort((a, b) => a - b)
    .map(cpu => cpu.toString())
  const memories = [...new Set(prices?.prices.map(price => price.memory_mb))]
    .filter(memory => typeof memory === "number")
    .sort((a, b) => a - b)
    .map(memory => memory.toString())

  const filteredPrices = prices?.prices.filter(
    price =>
      (regionFilter.size === 0 || regionFilter.has(price.region)) &&
      (zoneFilter.size === 0 || [...zoneFilter].every(z => price.zones.indexOf(z) !== -1)) &&
      (familyFilter.size === 0 || familyFilter.has(price.family)) &&
      (nameFilter.size === 0 || nameFilter.has(price.name)) &&
      (cpuFilter.size === 0 || cpuFilter.has(price.guest_cpus?.toString() ?? "")) &&
      (memoryFilter.size === 0 || memoryFilter.has(price.memory_mb?.toString() ?? "")) &&
      inRange(price.cpu_on_demand, cpuOnDemandFilter) &&
      inRange(price.memory_on_demand, memoryOnDemandFilter) &&
      inRange(price.gpu_on_demand, gpuOnDemandFilter) &&
      inRange(price.total_on_demand, totalOnDemandFilter) &&
      inRange(price.cpu_spot, cpuSpotFilter) &&
      inRange(price.memory_spot, memorySpotFilter) &&
      inRange(price.gpu_spot, gpuSpotFilter) &&
      inRange(price.total_spot, totalSpotFilter) &&
      inRange(price.discount_rate_spot, discountRateSpotFilter) &&
      inRange(price.cpu_c1y, cpuC1yFilter) &&
      inRange(price.memory_c1y, memoryC1yFilter) &&
      inRange(price.gpu_c1y, gpuC1yFilter) &&
      inRange(price.total_c1y, totalC1yFilter) &&
      inRange(price.discount_rate_c1y, discountRateC1yFilter) &&
      inRange(price.cpu_c3y, cpuC3yFilter) &&
      inRange(price.memory_c3y, memoryC3yFilter) &&
      inRange(price.gpu_c3y, gpuC3yFilter) &&
      inRange(price.total_c3y, totalC3yFilter) &&
      inRange(price.discount_rate_c3y, discountRateC3yFilter)
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
        <details open>
          <summary>README</summary>
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
              <a href={`${import.meta.env.BASE_URL}data/prices.json`}>JSON</a>. The data generation
              process is open-source in{" "}
              <a href="https://github.com/fuzmish/cw-gce-pricing">our repository</a>.
            </li>
            <li>The pricing data was last updated on {prices?.generated_at.toISOString()}.</li>
            <li>All prices are shown in USD per instance per month (24*365/12 hours).</li>
            <li>
              Click column headers to sort in ascending or descending order. ⌘+click to sort by
              multiple columns.
            </li>
            <li>Multi-select filters: ⌘+click to select or unselect multiple options.</li>
          </ul>
        </details>
        <details open>
          <summary>Filter</summary>
          <label>
            <input
              checked={showFilters}
              onChange={() => setShowFilters(!showFilters)}
              type="checkbox"
            />{" "}
            Show Filters
          </label>
          <br />
          <button onClick={onResetFilters} type="button">
            Reset Filters
          </button>
          <br />
        </details>
        <details>
          <summary>Visibility</summary>
          <label>
            <input checked={showSkus} onChange={() => setShowSkus(!showSkus)} type="checkbox" /> SKU
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.region}
              onChange={e => setColumnVisibility(prev => ({ ...prev, region: e.target.checked }))}
              type="checkbox"
            />{" "}
            Region
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.zone}
              onChange={e => setColumnVisibility(prev => ({ ...prev, zone: e.target.checked }))}
              type="checkbox"
            />{" "}
            Zone
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.family}
              onChange={e => setColumnVisibility(prev => ({ ...prev, family: e.target.checked }))}
              type="checkbox"
            />{" "}
            Family
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.name}
              onChange={e => setColumnVisibility(prev => ({ ...prev, name: e.target.checked }))}
              type="checkbox"
            />{" "}
            Name
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.guest_cpus}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, guest_cpus: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Guest CPUs
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.memory_mb}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, memory_mb: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Memory MB
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.cpu_on_demand}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, cpu_on_demand: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            CPU On Demand
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.memory_on_demand}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, memory_on_demand: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Memory On Demand
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.gpu_on_demand}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, gpu_on_demand: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            GPU On Demand
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.total_on_demand}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, total_on_demand: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Total On Demand
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.cpu_spot}
              onChange={e => setColumnVisibility(prev => ({ ...prev, cpu_spot: e.target.checked }))}
              type="checkbox"
            />{" "}
            CPU Spot
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.memory_spot}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, memory_spot: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Memory Spot
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.gpu_spot}
              onChange={e => setColumnVisibility(prev => ({ ...prev, gpu_spot: e.target.checked }))}
              type="checkbox"
            />{" "}
            GPU Spot
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.total_spot}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, total_spot: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Total Spot
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.discount_rate_spot}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, discount_rate_spot: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Discount Rate Spot
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.cpu_c1y}
              onChange={e => setColumnVisibility(prev => ({ ...prev, cpu_c1y: e.target.checked }))}
              type="checkbox"
            />{" "}
            CPU Commit 1Y
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.memory_c1y}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, memory_c1y: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Memory Commit 1Y
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.gpu_c1y}
              onChange={e => setColumnVisibility(prev => ({ ...prev, gpu_c1y: e.target.checked }))}
              type="checkbox"
            />{" "}
            GPU Commit 1Y
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.total_c1y}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, total_c1y: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Total Commit 1Y
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.discount_rate_c1y}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, discount_rate_c1y: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Discount Rate 1Y
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.cpu_c3y}
              onChange={e => setColumnVisibility(prev => ({ ...prev, cpu_c3y: e.target.checked }))}
              type="checkbox"
            />{" "}
            CPU Commit 3Y
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.memory_c3y}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, memory_c3y: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Memory Commit 3Y
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.gpu_c3y}
              onChange={e => setColumnVisibility(prev => ({ ...prev, gpu_c3y: e.target.checked }))}
              type="checkbox"
            />{" "}
            GPU Commit 3Y
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.total_c3y}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, total_c3y: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Total Commit 3Y
          </label>{" "}
          <label>
            <input
              checked={columnVisibility.discount_rate_c3y}
              onChange={e =>
                setColumnVisibility(prev => ({ ...prev, discount_rate_c3y: e.target.checked }))
              }
              type="checkbox"
            />{" "}
            Discount Rate 3Y
          </label>
        </details>
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
      <TableVirtuoso
        data={sortedPrices}
        fixedHeaderContent={() => (
          <>
            <tr>
              {columnVisibility.region && (
                <SortableHeader
                  fieldName="region"
                  label="Region"
                  onSort={onSort}
                  state={sortStates}
                  style={{ minWidth: "150px" }}
                />
              )}
              {columnVisibility.zone && (
                <SortableHeader
                  fieldName="zone"
                  label="Zone"
                  onSort={onSort}
                  state={sortStates}
                  style={{ minWidth: "180px" }}
                />
              )}
              {columnVisibility.family && (
                <SortableHeader
                  fieldName="family"
                  label="Family"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.name && (
                <SortableHeader
                  fieldName="name"
                  label="Name"
                  onSort={onSort}
                  state={sortStates}
                  style={{ minWidth: "180px" }}
                />
              )}
              {columnVisibility.guest_cpus && (
                <SortableHeader
                  fieldName="guest_cpus"
                  label="Guest CPUs"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.memory_mb && (
                <SortableHeader
                  fieldName="memory_mb"
                  label="Memory MB"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.cpu_on_demand && (
                <SortableHeader
                  fieldName="cpu_on_demand"
                  label="CPU On Demand"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.memory_on_demand && (
                <SortableHeader
                  fieldName="memory_on_demand"
                  label="Memory On Demand"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.gpu_on_demand && (
                <SortableHeader
                  fieldName="gpu_on_demand"
                  label="GPU On Demand"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.total_on_demand && (
                <SortableHeader
                  fieldName="total_on_demand"
                  label="Total On Demand"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.cpu_spot && (
                <SortableHeader
                  fieldName="cpu_spot"
                  label="CPU Spot"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.memory_spot && (
                <SortableHeader
                  fieldName="memory_spot"
                  label="Memory Spot"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.gpu_spot && (
                <SortableHeader
                  fieldName="gpu_spot"
                  label="GPU Spot"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.total_spot && (
                <SortableHeader
                  fieldName="total_spot"
                  label="Total Spot"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.discount_rate_spot && (
                <SortableHeader
                  fieldName="discount_rate_spot"
                  label="Discount Rate Spot"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.cpu_c1y && (
                <SortableHeader
                  fieldName="cpu_c1y"
                  label="CPU Commit 1 Year"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.memory_c1y && (
                <SortableHeader
                  fieldName="memory_c1y"
                  label="Memory Commit 1 Year"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.gpu_c1y && (
                <SortableHeader
                  fieldName="gpu_c1y"
                  label="GPU Commit 1 Year"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.total_c1y && (
                <SortableHeader
                  fieldName="total_c1y"
                  label="Total Commit 1 Year"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.discount_rate_c1y && (
                <SortableHeader
                  fieldName="discount_rate_c1y"
                  label="Discount Rate Commit 1 Year"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.cpu_c3y && (
                <SortableHeader
                  fieldName="cpu_c3y"
                  label="CPU Commit 3 Year"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.memory_c3y && (
                <SortableHeader
                  fieldName="memory_c3y"
                  label="Memory Commit 3 Year"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.gpu_c3y && (
                <SortableHeader
                  fieldName="gpu_c3y"
                  label="GPU Commit 3 Year"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.total_c3y && (
                <SortableHeader
                  fieldName="total_c3y"
                  label="Total Commit 3 Year"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
              {columnVisibility.discount_rate_c3y && (
                <SortableHeader
                  fieldName="discount_rate_c3y"
                  label="Discount Rate Commit 3 Year"
                  onSort={onSort}
                  state={sortStates}
                />
              )}
            </tr>
            {showFilters && (
              <tr>
                {columnVisibility.region && (
                  <MultiSelectFilter
                    onValueChange={setRegionFilter}
                    options={regions}
                    value={regionFilter}
                  />
                )}
                {columnVisibility.zone && (
                  <MultiSelectFilter
                    onValueChange={setZoneFilter}
                    options={zones}
                    value={zoneFilter}
                  />
                )}
                {columnVisibility.family && (
                  <MultiSelectFilter
                    onValueChange={setFamilyFilter}
                    options={families}
                    value={familyFilter}
                  />
                )}
                {columnVisibility.name && (
                  <MultiSelectFilter
                    onValueChange={setNameFilter}
                    options={names}
                    value={nameFilter}
                  />
                )}
                {columnVisibility.guest_cpus && (
                  <MultiSelectFilter
                    onValueChange={setCpuFilter}
                    options={cpus}
                    value={cpuFilter}
                  />
                )}
                {columnVisibility.memory_mb && (
                  <MultiSelectFilter
                    onValueChange={setMemoryFilter}
                    options={memories}
                    value={memoryFilter}
                  />
                )}
                {columnVisibility.cpu_on_demand && (
                  <RangeFilter onValueChange={setCpuOnDemandFilter} value={cpuOnDemandFilter} />
                )}
                {columnVisibility.memory_on_demand && (
                  <RangeFilter
                    onValueChange={setMemoryOnDemandFilter}
                    value={memoryOnDemandFilter}
                  />
                )}
                {columnVisibility.gpu_on_demand && (
                  <RangeFilter onValueChange={setGpuOnDemandFilter} value={gpuOnDemandFilter} />
                )}
                {columnVisibility.total_on_demand && (
                  <RangeFilter onValueChange={setTotalOnDemandFilter} value={totalOnDemandFilter} />
                )}
                {columnVisibility.cpu_spot && (
                  <RangeFilter onValueChange={setCpuSpotFilter} value={cpuSpotFilter} />
                )}
                {columnVisibility.memory_spot && (
                  <RangeFilter onValueChange={setMemorySpotFilter} value={memorySpotFilter} />
                )}
                {columnVisibility.gpu_spot && (
                  <RangeFilter onValueChange={setGpuSpotFilter} value={gpuSpotFilter} />
                )}
                {columnVisibility.total_spot && (
                  <RangeFilter onValueChange={setTotalSpotFilter} value={totalSpotFilter} />
                )}
                {columnVisibility.discount_rate_spot && (
                  <RangeFilter
                    onValueChange={setDiscountRateSpotFilter}
                    value={discountRateSpotFilter}
                  />
                )}
                {columnVisibility.cpu_c1y && (
                  <RangeFilter onValueChange={setCpuC1yFilter} value={cpuC1yFilter} />
                )}
                {columnVisibility.memory_c1y && (
                  <RangeFilter onValueChange={setMemoryC1yFilter} value={memoryC1yFilter} />
                )}
                {columnVisibility.gpu_c1y && (
                  <RangeFilter onValueChange={setGpuC1yFilter} value={gpuC1yFilter} />
                )}
                {columnVisibility.total_c1y && (
                  <RangeFilter onValueChange={setTotalC1yFilter} value={totalC1yFilter} />
                )}
                {columnVisibility.discount_rate_c1y && (
                  <RangeFilter
                    onValueChange={setDiscountRateC1yFilter}
                    value={discountRateC1yFilter}
                  />
                )}
                {columnVisibility.cpu_c3y && (
                  <RangeFilter onValueChange={setCpuC3yFilter} value={cpuC3yFilter} />
                )}
                {columnVisibility.memory_c3y && (
                  <RangeFilter onValueChange={setMemoryC3yFilter} value={memoryC3yFilter} />
                )}
                {columnVisibility.gpu_c3y && (
                  <RangeFilter onValueChange={setGpuC3yFilter} value={gpuC3yFilter} />
                )}
                {columnVisibility.total_c3y && (
                  <RangeFilter onValueChange={setTotalC3yFilter} value={totalC3yFilter} />
                )}
                {columnVisibility.discount_rate_c3y && (
                  <RangeFilter
                    onValueChange={setDiscountRateC3yFilter}
                    value={discountRateC3yFilter}
                  />
                )}
              </tr>
            )}
          </>
        )}
        id="data"
        itemContent={(_, price) => (
          <>
            {columnVisibility.region && <td>{price.region}</td>}
            {columnVisibility.zone && (
              <td>{price.zones.map(zone => zone.slice(price.region.length + 1)).join(", ")}</td>
            )}
            {columnVisibility.family && <td>{price.family}</td>}
            {columnVisibility.name && <td>{price.name}</td>}
            {columnVisibility.guest_cpus && <td>{price.guest_cpus ?? "-"}</td>}
            {columnVisibility.memory_mb && <td>{price.memory_mb ?? "-"}</td>}
            {columnVisibility.cpu_on_demand && (
              <td>
                {price.cpu_on_demand?.toFixed(2) || "-"}
                {showSkus && <div className="sku">{getSku(price, "OnDemand", "CPU")}</div>}
              </td>
            )}
            {columnVisibility.memory_on_demand && (
              <td>
                {price.memory_on_demand?.toFixed(2) || "-"}
                {showSkus && <div className="sku">{getSku(price, "OnDemand", "RAM")}</div>}
              </td>
            )}
            {columnVisibility.gpu_on_demand && (
              <td>
                {price.gpu_on_demand?.toFixed(2) || "-"}
                {showSkus && <div className="sku">{getSku(price, "OnDemand", "GPU")}</div>}
              </td>
            )}
            {columnVisibility.total_on_demand && (
              <td>{price.total_on_demand?.toFixed(2) || "-"}</td>
            )}
            {columnVisibility.cpu_spot && (
              <td>
                {price.cpu_spot?.toFixed(2) || "-"}
                {showSkus && <div className="sku">{getSku(price, "Preemptible", "CPU")}</div>}
              </td>
            )}
            {columnVisibility.memory_spot && (
              <td>
                {price.memory_spot?.toFixed(2) || "-"}
                {showSkus && <div className="sku">{getSku(price, "Preemptible", "RAM")}</div>}
              </td>
            )}
            {columnVisibility.gpu_spot && (
              <td>
                {price.gpu_spot?.toFixed(2) || "-"}
                {showSkus && <div className="sku">{getSku(price, "Preemptible", "GPU")}</div>}
              </td>
            )}
            {columnVisibility.total_spot && <td>{price.total_spot?.toFixed(2) || "-"}</td>}
            {columnVisibility.discount_rate_spot && (
              <td>{price.discount_rate_spot ? `${price.discount_rate_spot.toFixed(2)}%` : "-"}</td>
            )}
            {columnVisibility.cpu_c1y && (
              <td>
                {price.cpu_c1y?.toFixed(2) || "-"}
                {showSkus && <div className="sku">{getSku(price, "Commit1Yr", "CPU")}</div>}
              </td>
            )}
            {columnVisibility.memory_c1y && (
              <td>
                {price.memory_c1y?.toFixed(2) || "-"}
                {showSkus && <div className="sku">{getSku(price, "Commit1Yr", "RAM")}</div>}
              </td>
            )}
            {columnVisibility.gpu_c1y && (
              <td>
                {price.gpu_c1y?.toFixed(2) || "-"}
                {showSkus && <div className="sku">{getSku(price, "Commit1Yr", "GPU")}</div>}
              </td>
            )}
            {columnVisibility.total_c1y && <td>{price.total_c1y?.toFixed(2) || "-"}</td>}
            {columnVisibility.discount_rate_c1y && (
              <td>{price.discount_rate_c1y ? `${price.discount_rate_c1y.toFixed(2)}%` : "-"}</td>
            )}
            {columnVisibility.cpu_c3y && (
              <td>
                {price.cpu_c3y?.toFixed(2) || "-"}
                {showSkus && <div className="sku">{getSku(price, "Commit3Yr", "CPU")}</div>}
              </td>
            )}
            {columnVisibility.memory_c3y && (
              <td>
                {price.memory_c3y?.toFixed(2) || "-"}
                {showSkus && <div className="sku">{getSku(price, "Commit3Yr", "RAM")}</div>}
              </td>
            )}
            {columnVisibility.gpu_c3y && (
              <td>
                {price.gpu_c3y?.toFixed(2) || "-"}
                {showSkus && <div className="sku">{getSku(price, "Commit3Yr", "GPU")}</div>}
              </td>
            )}
            {columnVisibility.total_c3y && <td>{price.total_c3y?.toFixed(2) || "-"}</td>}
            {columnVisibility.discount_rate_c3y && (
              <td>{price.discount_rate_c3y ? `${price.discount_rate_c3y.toFixed(2)}%` : "-"}</td>
            )}
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
