import json
import logging
import os
import re
from datetime import datetime

from google.cloud import bigquery
from google.cloud.billing_v1 import CloudCatalogClient
from google.cloud.compute_v1 import MachineTypesClient, ZonesClient

logging.basicConfig(level=getattr(logging, os.environ.get("LOG_LEVEL", "INFO")))
logger = logging.getLogger(__name__)

COMPUTE_ENGINE_SERVICE_NAME = "services/6F81-5844-456A"


def get_zones(project: str, only_up: bool = True) -> dict[str, list[str]]:
    client = ZonesClient()
    zones = client.list(project=project)
    regions: dict[str, set[str]] = {}
    for zone in zones:
        if only_up and zone.status != "UP":
            continue
        region = zone.region.split("/")[-1]
        if region not in regions:
            regions[region] = set()
        regions[region].add(zone.name)
    result = {r: list(z) for r, z in regions.items()}
    return result


def get_machine_types(project: str, zone: str) -> list[dict]:
    client = MachineTypesClient()
    machine_types: dict[str, dict] = {}
    for m in client.list(project=project, zone=zone):
        if m.deprecated.state == "DEPRECATED":
            continue
        machine_types[m.name] = {
            "family": m.name.split("-")[0],
            "name": m.name,
            "guest_cpus": m.guest_cpus,
            "memory_mb": m.memory_mb,
        }
    result = list(machine_types.values())
    return result


def get_machine_type_from_sku(resource_group: str, description: str) -> str:
    if resource_group == "N1Standard":
        return "N1"
    if resource_group == "F1Micro":
        return "F1"
    if resource_group == "G1Small":
        return "G1"
    m = re.match(r"^(?:Spot Preemptible\s+)?Compute\s+optimized", description)
    if m is not None:
        return r"C2"
    m = re.match(
        r"^(?:Spot Preemptible\s+)?Custom\s+(?:Extended\s+)?Instance", description
    )
    if m is not None:
        return "N1"
    m = re.match(r"^(?:Spot Preemptible\s+)?Memory-optimized", description)
    if m is not None:
        return "M1"
    m = re.match(
        r"^(?:Spot Preemptible\s+)?([^\s]+?)\s+(?:AMD\s+)?(?:Memory-optimized\s+)?(?:Arm\s+)?(?:Custom\s+)?(?:Extended\s+)?(?:Instance|Ram).*",
        description,
    )
    if m is not None:
        family = m.group(1).upper()
        return family
    # unknown format
    return None


def get_skus() -> dict:
    client = CloudCatalogClient()
    skus = client.list_skus(parent=COMPUTE_ENGINE_SERVICE_NAME)
    result = {}
    for sku in skus:
        description = sku.description
        resource_group = sku.category.resource_group
        usage_type = sku.category.usage_type
        if sku.category.resource_family != "Compute":
            continue
        if resource_group not in ("CPU", "F1Micro", "G1Small", "N1Standard", "RAM"):
            continue
        if usage_type not in ("OnDemand", "Preemptible"):
            continue
        if "Sole Tenancy" in description:
            continue
        if "DWS" in description:
            continue
        if "Reserved" in description:
            continue
        if "Premium" in description:
            continue

        # extract pricing fields
        pricing_info = sku.pricing_info
        if len(pricing_info) > 1:
            raise ValueError("unexpected pricing_info length")
        pricing_expression = pricing_info[0].pricing_expression
        usage_unit = pricing_expression.usage_unit
        assert usage_unit in ("h", "GiBy.h", "GBy.h")
        tiered_rates = pricing_expression.tiered_rates
        if len(tiered_rates) > 1:
            raise ValueError("unexpected tiered_rates length")
        unit_price = tiered_rates[0].unit_price
        assert unit_price.currency_code == "USD"
        assert unit_price.units == 0

        # find machine faimly
        family = get_machine_type_from_sku(resource_group, description)
        if family is None:
            logger.warning(
                f"warning: machine family not found: {sku.sku_id} {sku.description}"
            )
            continue

        for region in sku.service_regions:
            if region not in result:
                result[region] = {}
            if family not in result[region]:
                result[region][family] = {}
            if usage_type not in result[region][family]:
                result[region][family][usage_type] = {}
            if resource_group in ("F1Micro", "G1Small", "N1Standard"):
                if "Core" in description or "CPU" in description:
                    resource_group = "CPU"
                else:
                    resource_group = "RAM"
            if resource_group in result[region][family][usage_type]:
                prev_item = result[region][family][usage_type][resource_group]
                prev_value = prev_item["unit_price_nanos"]
                new_value = unit_price.nanos
                # prefer to use non custom instance price
                if "Custom" not in description:
                    continue
                # skip duplicated custom instance prices
                if "Custom" in description:
                    continue
                # use the higher price
                if prev_value < new_value:
                    logger.warning(
                        f"warning: duplicate key {region},{family},{usage_type},{resource_group}: {sku.sku_id} {sku.description}"
                    )
                    continue

            result[region][family][usage_type][resource_group] = {
                "sku_id": sku.sku_id,
                "description": description,
                "unit_price_nanos": unit_price.nanos,
            }

    return result


def lookup_price(machine_type: dict, skus: dict) -> dict:
    cpu_on_demand: float | None = None
    cpu_spot: float | None = None
    memory_on_demand: float | None = None
    memory_spot: float | None = None
    total_on_demand: float | None = None
    total_spot: float | None = None
    discount_rate: float | None = None
    sku: dict | None = None

    guest_cpus = machine_type["guest_cpus"]
    memory_mb = machine_type["memory_mb"]
    family = machine_type["family"].upper()
    # use M1 as an alias of M2
    if family == "M2":
        family = "M1"
    # lookup sku
    if family in skus:
        sku = skus[family]
        on_demand = sku["OnDemand"]
        if "CPU" in on_demand:
            unit_price = on_demand["CPU"]["unit_price_nanos"]
            cpu_on_demand = unit_price * guest_cpus * 24 * 365 / 12 / 1e9
        if "RAM" in on_demand:
            unit_price = on_demand["RAM"]["unit_price_nanos"]
            memory_on_demand = unit_price * memory_mb * 24 * 365 / 12 / 1e9 / 1024
        spot = sku["Preemptible"]
        if "CPU" in spot:
            unit_price = spot["CPU"]["unit_price_nanos"]
            cpu_spot = unit_price * guest_cpus * 24 * 365 / 12 / 1e9
        if "RAM" in spot:
            unit_price = spot["RAM"]["unit_price_nanos"]
            memory_spot = unit_price * memory_mb * 24 * 365 / 12 / 1e9 / 1024
    else:
        logger.warning(f"warning: machine family {family} not found in pricing data")

    if cpu_on_demand is not None or memory_on_demand is not None:
        total_on_demand = 0
        if cpu_on_demand is not None:
            total_on_demand += cpu_on_demand
        if memory_on_demand is not None:
            total_on_demand += memory_on_demand
    if cpu_spot is not None or memory_spot is not None:
        total_spot = 0
        if cpu_spot is not None:
            total_spot += cpu_spot
        if memory_spot is not None:
            total_spot += memory_spot

    if total_on_demand is not None and total_spot is not None and total_on_demand > 0:
        discount_rate = (total_on_demand - total_spot) / total_on_demand * 100

    return {
        "cpu_on_demand": cpu_on_demand,
        "cpu_spot": cpu_spot,
        "memory_on_demand": memory_on_demand,
        "memory_spot": memory_spot,
        "total_on_demand": total_on_demand,
        "total_spot": total_spot,
        "discount_rate": discount_rate,
        "sku": sku,
    }


def generate_pricing_table(machine_types: dict, skus: dict) -> list[dict]:
    result = []
    for region in machine_types:
        for zone in machine_types[region]:
            for machine_type in machine_types[region][zone]:
                price = lookup_price(machine_type, skus[region])
                result.append(
                    {
                        "region": region,
                        "zone": zone,
                        **machine_type,
                        **price,
                    }
                )
    return result


def save_to_bigquery(
    prices: list[dict],
    client: bigquery.Client,
    destination: bigquery.TableReference,
) -> bigquery.LoadJob:
    partition_id = datetime.now().strftime("%Y%m%d")
    load_job = client.load_table_from_json(
        json_rows=prices,
        destination=bigquery.TableReference(
            dataset_ref=bigquery.DatasetReference(
                project=destination.project, dataset_id=destination.dataset_id
            ),
            table_id=f"{destination.table_id}${partition_id}",
        ),
        job_config=bigquery.LoadJobConfig(
            clustering_fields=["region", "name"],
            schema=[
                bigquery.SchemaField("region", "STRING"),
                bigquery.SchemaField("zone", "STRING"),
                bigquery.SchemaField("family", "STRING"),
                bigquery.SchemaField("name", "STRING"),
                bigquery.SchemaField("guest_cpus", "INTEGER"),
                bigquery.SchemaField("memory_mb", "INTEGER"),
                bigquery.SchemaField("cpu_on_demand", "FLOAT"),
                bigquery.SchemaField("cpu_spot", "FLOAT"),
                bigquery.SchemaField("memory_on_demand", "FLOAT"),
                bigquery.SchemaField("memory_spot", "FLOAT"),
                bigquery.SchemaField("total_on_demand", "FLOAT"),
                bigquery.SchemaField("total_spot", "FLOAT"),
                bigquery.SchemaField("discount_rate", "FLOAT"),
                bigquery.SchemaField("sku", "JSON"),
            ],
            time_partitioning=bigquery.TimePartitioning(
                type_=bigquery.TimePartitioningType.DAY
            ),
            write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        ),
    )
    result = load_job.result()
    logger.info(
        f"Successfully loaded {result.output_rows} rows into {result.destination}"
    )
    return result


def main():
    project = os.environ["GOOGLE_PROJECT_ID"]
    location = os.environ.get("BIGQUERY_LOCATION", "asia-northeast1")
    dataset = os.environ.get("BIGQUERY_DATASET", "gce_pricing")
    table = os.environ.get("BIGQUERY_TABLE", "prices")

    out_dir = os.path.join(os.path.dirname(__file__), "..", "out")
    os.makedirs(out_dir, exist_ok=True)

    machine_types_json = os.path.join(out_dir, "machine_types.json")
    if not os.path.exists(machine_types_json):
        regions = get_zones(project)
        logger.info(f"found {len(regions)} regions")
        machine_types = {}
        for region, zones in regions.items():
            logger.info(f"found {len(zones)} zones in {region}")
            machine_types[region] = {}
            for zone in zones:
                ret = get_machine_types(project, zone)
                logger.info(f"found {len(ret)} machine types in {zone}")
                machine_types[region][zone] = ret

        with open(machine_types_json, "w") as f:
            json.dump(machine_types, f)

    skus_json = os.path.join(out_dir, "skus.json")
    if not os.path.exists(skus_json):
        skus = get_skus()
        logger.info(f"found {len(skus)} skus")

        with open(skus_json, "w") as f:
            json.dump(skus, f)

    data_dir = os.path.join(os.path.dirname(__file__), "..", "public", "data")
    os.makedirs(data_dir, exist_ok=True)

    prices_json = os.path.join(data_dir, "prices.json")
    if not os.path.exists(prices_json):
        with open(machine_types_json, "r") as f:
            machine_types = json.load(f)
        with open(skus_json, "r") as f:
            skus = json.load(f)

        prices = generate_pricing_table(machine_types, skus)
        result = {
            "prices": prices,
            "generated_at": int(datetime.now().timestamp() * 1000),
        }

        with open(prices_json, "w") as f:
            json.dump(result, f)

    with open(prices_json, "r") as f:
        prices = json.load(f)["prices"]

    client = bigquery.Client(project=project, location=location)
    destination = bigquery.TableReference(
        dataset_ref=bigquery.DatasetReference(project=project, dataset_id=dataset),
        table_id=table,
    )
    save_to_bigquery(prices, client, destination)


if __name__ == "__main__":
    main()
