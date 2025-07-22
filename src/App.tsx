import { type ReactNode, useEffect, useState } from "react"
import { TableVirtuoso } from "react-virtuoso"
import { MultiSelectFilter } from "./components/MultiSelectFilter"
import { RangeFilter, type RangeFilterValue } from "./components/RangeFilter"
import { SortableHeader, type SortDirection } from "./components/SortableHeader"
import { getPrices, type Price, type Prices, type ResourceSkus } from "./data"

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
                  {[
                    ["africa-south1", "Johannesburg, South Africa"],
                    ["asia-east1", "Changhua County, Taiwan, APAC"],
                    ["asia-east2", "Hong Kong, APAC"],
                    ["asia-northeast1", "Tokyo, Japan, APAC"],
                    ["asia-northeast2", "Osaka, Japan, APAC"],
                    ["asia-northeast3", "Seoul, South Korea, APAC"],
                    ["asia-south1", "Mumbai, India, APAC"],
                    ["asia-south2", "Delhi, India, APAC"],
                    ["asia-southeast1", "Jurong West, Singapore, APAC"],
                    ["asia-southeast2", "Jakarta, Indonesia, APAC"],
                    ["australia-southeast1", "Sydney, Australia, APAC"],
                    ["australia-southeast2", "Melbourne, Australia, APAC"],
                    ["europe-central2", "Warsaw, Poland, Europe"],
                    ["europe-north1", "Hamina, Finland, Europe"],
                    ["europe-north2", "Stockholm, Sweden, Europe"],
                    ["europe-southwest1", "Madrid, Spain, Europe"],
                    ["europe-west1", "St. Ghislain, Belgium, Europe"],
                    ["europe-west2", "London, England, Europe"],
                    ["europe-west3", "Frankfurt, Germany, Europe"],
                    ["europe-west4", "Eemshaven, Netherlands, Europe"],
                    ["europe-west6", "Zurich, Switzerland, Europe"],
                    ["europe-west8", "Milan, Italy, Europe"],
                    ["europe-west9", "Paris, France, Europe"],
                    ["europe-west10", "Berlin, Germany, Europe"],
                    ["europe-west12", "Turin, Italy, Europe"],
                    ["me-central1", "Doha, Qatar, Middle East"],
                    ["me-central2", "Dammam, Saudi Arabia, Middle East"],
                    ["me-west1", "Tel Aviv, Israel, Middle East"],
                    ["northamerica-northeast1", "Montréal, Québec, North America"],
                    ["northamerica-northeast2", "Toronto, Ontario, North America"],
                    ["northamerica-south1", "Queretaro, Mexico, North America"],
                    ["southamerica-east1", "Osasco, São Paulo, Brazil, South America"],
                    ["southamerica-west1", "Santiago, Chile, South America"],
                    ["us-central1", "Council Bluffs, Iowa, North America"],
                    ["us-east1", "Moncks Corner, South Carolina, North America"],
                    ["us-east4", "Ashburn, Virginia, North America"],
                    ["us-east5", "Columbus, Ohio, North America"],
                    ["us-south1", "Dallas, Texas, North America"],
                    ["us-west1", "The Dalles, Oregon, North America	"],
                    ["us-west2", "Los Angeles, California, North America"],
                    ["us-west3", "Salt Lake City, Utah, North America"],
                    ["us-west4", "Las Vegas, Nevada, North America"]
                  ].map(([region, description]) => (
                    <tr key={region}>
                      <td>{region}</td>
                      <td>{description}</td>
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
                  {[
                    ["A2", "Accelerator-optimized", "Intel Cascade Lake	+ NVIDIA A100 GPUs"],
                    [
                      "A3 Ultra",
                      "Accelerator-optimized",
                      "5th Generation Intel Xeon Scalable processor (Emerald Rapids) + NVIDIA H200 SXM GPUs"
                    ],
                    [
                      "A3 Mega, High, Edge",
                      "Accelerator-optimized",
                      "4th Generation Intel Xeon Scalable processor (Sapphire Rapids) + NVIDIA H100 SXM GPUs"
                    ],
                    [
                      "A4",
                      "Accelerator-optimized",
                      "5th Generation Intel Xeon Scalable Processor (Emerald Rapids) + NVIDIA B200 GPUs"
                    ],
                    ["C2", "Compute-optimized", "Intel 3.9 GHz Cascade Lake processors"],
                    ["C2D", "Compute-optimized", "3rd generation AMD EPYC Milan platform"],
                    [
                      "C3",
                      "General-purpose",
                      "4th generation Intel Xeon Scalable processors (code-named Sapphire Rapids), DDR5 memory, and Titanium"
                    ],
                    ["C3D", "General-purpose", "4th generation AMD EPYC™ (Genoa) processor"],
                    [
                      "C4",
                      "General-purpose",
                      "5th generation (code-named Emerald Rapids) or 6th generation (code-named Granite Rapids) (Preview) Intel Xeon Scalable processors and Titanium"
                    ],
                    ["C4A", "General-purpose", "Google's first Arm-based Axion™ processor"],
                    [
                      "C4D",
                      "General-purpose",
                      "5th generation AMD EPYC Turin processor and Titanium"
                    ],
                    ["ct3", "TPU", "v3"],
                    ["ct3p", "TPU", "v3"],
                    ["ct4p", "TPU", "v4"],
                    ["ct5l", "TPU", "v5"],
                    ["ct5lp", "TPU", "v5e"],
                    ["ct5p", "TPU", "v5p"],
                    ["ct6e", "TPU", "v6e (Trillium)"],
                    ["E2", "General-purpose", "Intel and AMD EPYC processors"],
                    ["F1, G1", "General-purpose", "Same as N1, shared core machine types"],
                    ["G2", "Accelerator-optimized", "Intel Cascade Lake + NVIDIA L4 GPUs"],
                    [
                      "H3",
                      "Compute-optimized",
                      "4th generation Intel Xeon Scalable processors (code-named Sapphire Rapids), DDR5 memory, and Titanium offload processors"
                    ],
                    ["M1", "Memory-optimized", "Intel Skylake or Broadwell"],
                    ["M2", "Memory-optimized", "Intel Cascade Lake"],
                    ["M3", "Memory-optimized", "Intel Ice Lake"],
                    ["M4", "Memory-optimized", "Intel Xeon Scalable Sapphire Rapids processors"],
                    [
                      "N1",
                      "General-purpose",
                      "Intel Skylake, Broadwell, Haswell, Sandy Bridge, and Ivy Bridge CPU platforms"
                    ],
                    ["N2", "General-purpose", "Ice Lake or Cascade Lake"],
                    ["N2D", "General-purpose", "AMD EPYC Milan or AMD EPYC Rome processors"],
                    [
                      "N4",
                      "General-purpose",
                      "5th generation Intel Xeon Scalable processors (code-named Emerald Rapids) and Titanium"
                    ],
                    ["T2A", "General-purpose", "Ampere Altra Arm processor"],
                    ["T2D", "General-purpose", "3rd generation AMD EPYC Milan processor"],
                    [
                      "X4",
                      "Memory-optimized",
                      "4th generation Intel Xeon Scalable processors (code-named Sapphire Rapids) and Titanium"
                    ],
                    [
                      "Z3",
                      "Storage-optimized",
                      "4th generation Intel Xeon Scalable processor (code-named Sapphire Rapids), DDR5 memory, and Titanium offload processors"
                    ]
                  ].map(([key, category, description]) => (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>{category}</td>
                      <td>{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
          <div style={{ flex: 1 }}>
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
