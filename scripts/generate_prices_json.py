import json
import logging
import os
import re
from datetime import datetime

from google.cloud.billing_v1 import CloudCatalogClient
from google.cloud.billing_v1.types.cloud_catalog import Sku
from google.cloud.compute_v1 import AcceleratorTypesClient, MachineTypesClient
from proto import Message

logging.basicConfig(level=getattr(logging, os.environ.get("LOG_LEVEL", "INFO")))
logger = logging.getLogger(__name__)

COMPUTE_ENGINE_SERVICE_NAME = "services/6F81-5844-456A"


def get_machine_types(project: str) -> dict:
    client = MachineTypesClient()
    result = {}
    for _, entry in client.aggregated_list(project=project):
        for machine_type in entry.machine_types:
            # ignore deprecated
            if machine_type.deprecated.state == "DEPRECATED":
                continue
            # skip TPUs
            name = machine_type.name
            if name.startswith("ct"):
                continue
            region = "-".join(machine_type.zone.split("-")[0:-1])
            if region not in result:
                result[region] = {}
            if name not in result[region]:
                family = name.split("-")[0]
                result[region][name] = {
                    "region": region,
                    "family": family,
                    "name": name,
                    "guest_cpus": machine_type.guest_cpus,
                    "memory_mb": machine_type.memory_mb,
                    "zones": set(),
                }
            result[region][name]["zones"].add(machine_type.zone)

    for region in result:
        for machine_type in result[region]:
            result[region][machine_type]["zones"] = list(
                sorted(result[region][machine_type]["zones"])
            )
    return result


def get_accelerator_types(project: str) -> dict:
    client = AcceleratorTypesClient()
    result = {}
    for _, entry in client.aggregated_list(project=project):
        for at in entry.accelerator_types:
            # ignore deprecated
            if at.deprecated.state == "DEPRECATED":
                continue
            # skip TPUs
            if at.name.startswith("ct"):
                continue
            # skip virtual workstations
            if at.name.endswith("-vws"):
                continue
            # get zone and region
            zone = at.zone.split("/")[-1]
            region = "-".join(zone.split("-")[0:-1])
            name = at.name
            if region not in result:
                result[region] = {}
            if name not in result[region]:
                result[region][name] = {
                    "region": region,
                    "name": name,
                    "description": at.description,
                    "zones": set(),
                }
            result[region][name]["zones"].add(zone)

    for region in result:
        for name in result[region]:
            result[region][name]["zones"] = list(sorted(result[region][name]["zones"]))
    return result


def get_family_from_sku(resource_group: str, description: str) -> str:
    # special resource groups
    if resource_group == "N1Standard":
        return "N1"
    if resource_group == "F1Micro":
        return "F1"
    if resource_group == "G1Small":
        return "G1"
    # A4
    if "A4 Nvidia" in description:
        return "A4"
    # GPUs
    m = re.match(r"^(?:Commitment\s+v1:\s+)?(?:Nvidia\s+)?(.*?)\s+GPU", description)
    if m is not None:
        return m.group(1)
    # C2
    m = re.match(r"^(?:Spot\s+Preemptible\s+)?Compute\s+optimized", description)
    if m is not None:
        return "C2"
    m = re.match(r"^Commitment(?:\s+v1)?:\s+Compute\s+optimized", description)
    if m is not None:
        return "C2"
    # N1
    m = re.match(
        r"^(?:Spot\s+Preemptible\s+)?Custom\s+(?:Extended\s+)?Instance", description
    )
    if m is not None:
        return "N1"
    m = re.match(r"Commitment\s+v1:\s+(?:Cpu|Ram)\s+in", description)
    if m is not None:
        return "N1"  # https://cloud.google.com/skus/sku-groups/n1-vms-1-year-cud
    # M1
    m = re.match(r"^(?:Spot\s+Preemptible\s+)?Memory-optimized", description)
    if m is not None:
        return "M1"
    m = re.match(r"^Commitment(?:\s+v1)?:\s+Memory-optimized", description)
    if m is not None:
        return "M1"
    # generic format
    m = re.match(
        r"^(?:Spot\s+Preemptible\s+)?([^\s]+?)\s+(?:AMD\s+)?(?:Memory-optimized\s+)?(?:Arm\s+)?(?:Custom\s+)?(?:Extended\s+)?(?:Instance|Ram).*",
        description,
    )
    if m is not None:
        family = m.group(1).upper()
        return family
    m = re.match(r"^Commitment\s+[^:]+:\s+([^\s]+)\s*", description)
    if m is not None:
        return m.group(1).upper()
    # unknown format
    return None


def get_skus(skus: list[Sku]) -> dict:
    result = {}
    for sku in skus:
        description = sku.description
        resource_group = sku.category.resource_group
        usage_type = sku.category.usage_type
        if sku.category.resource_family != "Compute":
            continue
        if resource_group not in (
            "CPU",
            "F1Micro",
            "G1Small",
            "N1Standard",
            "RAM",
            "GPU",
        ):
            continue
        if usage_type not in ("OnDemand", "Preemptible", "Commit1Yr", "Commit3Yr"):
            continue
        if "Sole Tenancy" in description:
            continue
        if "DWS" in description and "A4" not in sku.description:
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

        # find machine faimly
        family = get_family_from_sku(resource_group, description)
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
                "unit_price_units": unit_price.units,
                "unit_price_nanos": unit_price.nanos,
            }

    return result


def compute_price(sku, factor: float = 1, hours: float = 24 * 365 / 12) -> float:
    units = sku["unit_price_units"]
    nanos = sku["unit_price_nanos"]
    value = (units * factor * hours) + (nanos * factor * hours / 1e9)
    return value


def lookup_machine_type_price(skus: dict, region: str, machine_type: dict) -> dict:
    cpu_on_demand: float | None = None
    cpu_spot: float | None = None
    cpu_c1y: float | None = None
    cpu_c3y: float | None = None
    memory_on_demand: float | None = None
    memory_spot: float | None = None
    memory_c1y: float | None = None
    memory_c3y: float | None = None
    gpu_on_demand: float | None = None
    gpu_spot: float | None = None
    gpu_c1y: float | None = None
    gpu_c3y: float | None = None
    total_on_demand: float | None = None
    total_spot: float | None = None
    total_c1y: float | None = None
    total_c3y: float | None = None
    discount_rate_spot: float | None = None
    discount_rate_c1y: float | None = None
    discount_rate_c3y: float | None = None
    sku: dict | None = None

    guest_cpus = machine_type["guest_cpus"]
    memory_mb = machine_type["memory_mb"]
    family = machine_type["family"].upper()
    # use M1 as an alias of M2
    if family == "M2":
        family = "M1"
    # lookup sku
    if region in skus and family in skus[region]:
        sku = skus[region][family]
        on_demand = sku.get("OnDemand", {})
        if "CPU" in on_demand:
            cpu_on_demand = compute_price(on_demand["CPU"], guest_cpus)
            total_on_demand = (total_on_demand or 0) + cpu_on_demand
        if "RAM" in on_demand:
            memory_on_demand = compute_price(on_demand["RAM"], memory_mb / 1024)
            total_on_demand = (total_on_demand or 0) + memory_on_demand
        if "GPU" in on_demand:
            gpu_on_demand = compute_price(on_demand["GPU"])
            total_on_demand = (total_on_demand or 0) + gpu_on_demand
        preemptible = sku.get("Preemptible", {})
        if "CPU" in preemptible:
            cpu_spot = compute_price(preemptible["CPU"], guest_cpus)
            total_spot = (total_spot or 0) + cpu_spot
        if "RAM" in preemptible:
            memory_spot = compute_price(preemptible["RAM"], memory_mb / 1024)
            total_spot = (total_spot or 0) + memory_spot
        if "GPU" in preemptible:
            gpu_spot = compute_price(preemptible["GPU"])
            total_spot = (total_spot or 0) + gpu_spot
        commit1yr = sku.get("Commit1Yr", {})
        if "CPU" in commit1yr:
            cpu_c1y = compute_price(commit1yr["CPU"], guest_cpus)
            total_c1y = (total_c1y or 0) + cpu_c1y
        if "RAM" in commit1yr:
            memory_c1y = compute_price(commit1yr["RAM"], memory_mb / 1024)
            total_c1y = (total_c1y or 0) + memory_c1y
        if "GPU" in commit1yr:
            gpu_c1y = compute_price(commit1yr["GPU"])
            total_c1y = (total_c1y or 0) + gpu_c1y
        commit3yr = sku.get("Commit3Yr", {})
        if "CPU" in commit3yr:
            cpu_c3y = compute_price(commit3yr["CPU"], guest_cpus)
            total_c3y = (total_c3y or 0) + cpu_c3y
        if "RAM" in commit3yr:
            memory_c3y = compute_price(commit3yr["RAM"], memory_mb / 1024)
            total_c3y = (total_c3y or 0) + memory_c3y
        if "GPU" in commit3yr:
            gpu_c3y = compute_price(commit3yr["GPU"])
            total_c3y = (total_c3y or 0) + gpu_c3y
    else:
        logger.warning(
            f"warning: machine family {family} not found in {region} pricing data"
        )

    if total_on_demand is not None and total_spot is not None and total_on_demand > 0:
        discount_rate_spot = (total_on_demand - total_spot) / total_on_demand * 100
    if total_on_demand is not None and total_c1y is not None and total_on_demand > 0:
        discount_rate_c1y = (total_on_demand - total_c1y) / total_on_demand * 100
    if total_on_demand is not None and total_c3y is not None and total_on_demand > 0:
        discount_rate_c3y = (total_on_demand - total_c3y) / total_on_demand * 100

    return {
        "cpu_on_demand": cpu_on_demand,
        "cpu_spot": cpu_spot,
        "cpu_c1y": cpu_c1y,
        "cpu_c3y": cpu_c3y,
        "memory_on_demand": memory_on_demand,
        "memory_spot": memory_spot,
        "memory_c1y": memory_c1y,
        "memory_c3y": memory_c3y,
        "gpu_on_demand": gpu_on_demand,
        "gpu_spot": gpu_spot,
        "gpu_c1y": gpu_c1y,
        "gpu_c3y": gpu_c3y,
        "total_on_demand": total_on_demand,
        "total_spot": total_spot,
        "total_c1y": total_c1y,
        "total_c3y": total_c3y,
        "discount_rate_spot": discount_rate_spot,
        "discount_rate_c1y": discount_rate_c1y,
        "discount_rate_c3y": discount_rate_c3y,
        "sku": sku,
    }


def lookup_accelerator_type_price(
    skus: dict, region: str, accelerator_type: dict
) -> dict:
    cpu_on_demand: float | None = None
    cpu_spot: float | None = None
    cpu_c1y: float | None = None
    cpu_c3y: float | None = None
    memory_on_demand: float | None = None
    memory_spot: float | None = None
    memory_c1y: float | None = None
    memory_c3y: float | None = None
    gpu_on_demand: float | None = None
    gpu_spot: float | None = None
    gpu_c1y: float | None = None
    gpu_c3y: float | None = None
    total_on_demand: float | None = None
    total_spot: float | None = None
    total_c1y: float | None = None
    total_c3y: float | None = None
    discount_rate_spot: float | None = None
    discount_rate_c1y: float | None = None
    discount_rate_c3y: float | None = None
    sku: dict | None = None

    # lookup sku
    MAPPINGS = {
        "nvidia-a100-80gb": "Tesla A100 80GB",
        "nvidia-b200": "A4",
        "nvidia-h100-80gb": "H100 80GB",
        "nvidia-h100-mega-80gb": "H100 80GB Mega",
        "nvidia-h200-141gb": "H200 141GB",
        "nvidia-l4": "L4",
        "nvidia-tesla-a100": "Tesla A100 80GB",
        "nvidia-tesla-p100": "Tesla P100",
        "nvidia-tesla-p4": "Tesla P4",
        "nvidia-tesla-t4": "Tesla T4",
        "nvidia-tesla-v100": "Tesla V100",
    }
    family = MAPPINGS.get(accelerator_type["name"])
    if family and region in skus and family in skus[region]:
        sku = skus[region][family]
        on_demand = sku.get("OnDemand", {})
        if "GPU" in on_demand:
            gpu_on_demand = compute_price(on_demand["GPU"])
            total_on_demand = (total_on_demand or 0) + gpu_on_demand
        preemptible = sku.get("Preemptible", {})
        if "GPU" in preemptible:
            gpu_spot = compute_price(preemptible["GPU"])
            total_spot = (total_spot or 0) + gpu_spot
        commit1yr = sku.get("Commit1Yr", {})
        if "GPU" in commit1yr:
            gpu_c1y = compute_price(commit1yr["GPU"])
            total_c1y = (total_c1y or 0) + gpu_c1y
        commit3yr = sku.get("Commit3Yr", {})
        if "GPU" in commit3yr:
            gpu_c3y = compute_price(commit3yr["GPU"])
            total_c3y = (total_c3y or 0) + gpu_c3y
    else:
        logger.warning(
            f"warning: machine family {family} not found in {region} pricing data"
        )

    if total_on_demand is not None and total_spot is not None and total_on_demand > 0:
        discount_rate_spot = (total_on_demand - total_spot) / total_on_demand * 100
    if total_on_demand is not None and total_c1y is not None and total_on_demand > 0:
        discount_rate_c1y = (total_on_demand - total_c1y) / total_on_demand * 100
    if total_on_demand is not None and total_c3y is not None and total_on_demand > 0:
        discount_rate_c3y = (total_on_demand - total_c3y) / total_on_demand * 100

    return {
        "family": family,
        "cpu_on_demand": cpu_on_demand,
        "cpu_spot": cpu_spot,
        "cpu_c1y": cpu_c1y,
        "cpu_c3y": cpu_c3y,
        "memory_on_demand": memory_on_demand,
        "memory_spot": memory_spot,
        "memory_c1y": memory_c1y,
        "memory_c3y": memory_c3y,
        "gpu_on_demand": gpu_on_demand,
        "gpu_spot": gpu_spot,
        "gpu_c1y": gpu_c1y,
        "gpu_c3y": gpu_c3y,
        "total_on_demand": total_on_demand,
        "total_spot": total_spot,
        "total_c1y": total_c1y,
        "total_c3y": total_c3y,
        "discount_rate_spot": discount_rate_spot,
        "discount_rate_c1y": discount_rate_c1y,
        "discount_rate_c3y": discount_rate_c3y,
        "sku": sku,
    }


def generate_pricing_table(
    machine_types: dict, accelerator_types: dict, skus: dict
) -> list[dict]:
    result = []
    for region in machine_types:
        # skip undocumented regions
        if region in ("us-east7", "us-central2"):
            continue
        for name in machine_types[region]:
            mt = machine_types[region][name]
            price = lookup_machine_type_price(skus, region, mt)
            result.append({**mt, **price})

    for region in accelerator_types:
        # skip undocumented regions
        if region in ("us-east7", "us-central2"):
            continue
        for name in accelerator_types[region]:
            if name in (
                "nvidia-b200",  # A4
                "nvidia-h200-141gb",  # A3 Ultra
                "nvidia-h100-mega-80gb",  # A3 Mega
                "nvidia-h100-80gb",  # A3 High
                "nvidia-tesla-a100",  # A2
                "nvidia-a100-80gb",  # A2
            ):
                continue
            at = accelerator_types[region][name]
            price = lookup_accelerator_type_price(skus, region, at)
            result.append({**at, **price})

    return result


def main():
    project = os.environ["GOOGLE_PROJECT_ID"]

    out_dir = os.path.join(os.path.dirname(__file__), "..", "out")
    os.makedirs(out_dir, exist_ok=True)

    machine_types_json = os.path.join(out_dir, "machine_types.json")
    if not os.path.exists(machine_types_json):
        machine_types = get_machine_types(project)
        with open(machine_types_json, "w") as f:
            json.dump(machine_types, f)

    accelerator_types_json = os.path.join(out_dir, "accelerator_types.json")
    if not os.path.exists(accelerator_types_json):
        accelerator_types = get_accelerator_types(project)
        with open(accelerator_types_json, "w") as f:
            json.dump(accelerator_types, f)

    raw_skus_json = os.path.join(out_dir, "raw_skus.jsonl")
    if not os.path.exists(raw_skus_json):
        client = CloudCatalogClient()
        skus = client.list_skus(parent=COMPUTE_ENGINE_SERVICE_NAME)
        with open(raw_skus_json, "w") as f:
            for sku in skus:
                sku_dict = Message.to_dict(sku)
                f.write(json.dumps(sku_dict) + "\n")

    raw_skus: list[Sku] = []
    with open(raw_skus_json, "r") as f:
        for line in f.readlines():
            sku = Sku.from_json(line)
            raw_skus.append(sku)

    skus_json = os.path.join(out_dir, "skus.json")
    if not os.path.exists(skus_json):
        skus = get_skus(raw_skus)
        with open(skus_json, "w") as f:
            json.dump(skus, f)

    data_dir = os.path.join(os.path.dirname(__file__), "..", "public", "data")
    os.makedirs(data_dir, exist_ok=True)

    prices_json = os.path.join(data_dir, "prices.json")
    if not os.path.exists(prices_json):
        with open(machine_types_json, "r") as f:
            machine_types = json.load(f)
        with open(accelerator_types_json, "r") as f:
            accelerator_types = json.load(f)
        with open(skus_json, "r") as f:
            skus = json.load(f)
        prices = generate_pricing_table(machine_types, accelerator_types, skus)
        result = {
            "prices": prices,
            "generated_at": int(datetime.now().timestamp() * 1000),
        }
        with open(prices_json, "w") as f:
            json.dump(result, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
