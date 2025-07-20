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
  const url = `${import.meta.env.BASE_URL}data/prices.json`
  const res = await fetch(url)
  const data = await res.json()
  return {
    prices: data.prices,
    generated_at: new Date(data.generated_at)
  }
}
