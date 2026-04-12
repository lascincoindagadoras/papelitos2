"""
scan_mxw01.py - Discover BLE services and characteristics of MXW01 printer.
Uses bleak (works great on Windows).
"""
import asyncio
from bleak import BleakScanner, BleakClient

TARGET_PREFIX = "MXW"

async def main():
    print("=== MXW01 BLE Scanner ===\n")

    # Step 1: Scan
    print("[1/3] Scanning for BLE devices (8 seconds)...")
    print("      Make sure MXW01 is ON.\n")

    devices = await BleakScanner.discover(timeout=8, return_adv=True)

    target = None
    for d, (dev, adv) in devices.items():
        name = dev.name or adv.local_name or ""
        print(f"  {dev.address:20s}  {name or '(no name)':20s}  RSSI={adv.rssi}")
        if TARGET_PREFIX.lower() in name.lower():
            target = dev
            print(f"  {'':20s}  ^^^ TARGET FOUND!")

    if not target:
        print("\n❌ MXW01 not found. Is it turned on?")
        print("   If it uses a different name, check the list above.")
        return

    # Step 2: Connect
    print(f"\n[2/3] Connecting to {target.name} ({target.address})...")

    async with BleakClient(target.address, timeout=15) as client:
        print(f"  ✅ Connected!\n")

        # Step 3: Discover services
        print("[3/3] Services and Characteristics:\n")

        for svc in client.services:
            print(f"  SERVICE: {svc.uuid}")
            print(f"           {svc.description or ''}")

            for ch in svc.characteristics:
                props = ", ".join(ch.properties)
                writable = "write" in props or "write-without-response" in props
                marker = "  <-- WRITABLE (print here!)" if writable else ""
                print(f"    CHAR: {ch.uuid}  [{props}]{marker}")
                if ch.descriptors:
                    for desc in ch.descriptors:
                        print(f"      DESC: {desc.uuid} ({desc.description})")

            print()

    print("=== Done ===")
    print("\nCopy the WRITABLE characteristic's service UUID and char UUID")
    print("to the test page to print!")

asyncio.run(main())
