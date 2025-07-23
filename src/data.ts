export async function getData<T>(name: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}data/${name}.json`
  const res = await fetch(url)
  const data = await res.json()
  return data as T
}

export interface Sku {
  sku_id: string
  description: string
  unit_price_nanos: number
}

export interface ResourceSkus {
  CPU?: Sku
  RAM?: Sku
}

export interface Price {
  region: string
  family: string
  zone: string
  name: string
  guest_cpus: number
  memory_mb: number
  cpu_on_demand: number | null
  memory_on_demand: number | null
  total_on_demand: number | null
  cpu_spot: number | null
  memory_spot: number | null
  total_spot: number | null
  discount_rate: number | null
  sku: {
    OnDemand?: ResourceSkus
    Preemptible?: ResourceSkus
  } | null
}

export interface Prices {
  prices: Price[]
  generated_at: Date
}

export async function getPrices(): Promise<Prices> {
  const data = await getData<Prices>("prices")
  return {
    prices: data.prices,
    generated_at: new Date(data.generated_at)
  }
}

export interface Location {
  region: string
  location: string
}

export async function getLocations(): Promise<Location[]> {
  const { locations } = await getData<{ locations: Location[] }>("locations")
  return locations
}

export interface MachineFamily {
  name: string
  category: string
  description: string
}

export async function getMachineFamilies(): Promise<MachineFamily[]> {
  const { machine_families } = await getData<{ machine_families: MachineFamily[] }>(
    "machine_families"
  )
  return machine_families
}
