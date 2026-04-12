"""
scan_mxw01_v2.py - Find MXW01 by connecting to nearby unnamed BLE devices.
Some printers don't broadcast their name in advertisements.
"""
import asyncio
from bleak import BleakScanner, BleakClient

async def main():
    print("=== MXW01 BLE Scanner v2 ===\n")
    print("[1/2] Scanning 10 seconds...")
    print("      Will then try connecting to nearby unnamed devices.\n")

    devices = await BleakScanner.discover(timeout=10, return_adv=True)

    # Sort by signal strength (closest first)
    sorted_devs = sorted(
        devices.items(),
        key=lambda x: x[1][1].rssi,
        reverse=True
    )

    print(f"  Found {len(sorted_devs)} device(s):\n")
    for addr, (dev, adv) in sorted_devs:
        name = dev.name or adv.local_name or "(no name)"
        print(f"    {dev.address:20s}  {name:20s}  RSSI={adv.rssi}")

    # Try unnamed devices with strong signal (likely nearby)
    candidates = [
        (dev, adv) for _, (dev, adv) in sorted_devs
        if (not dev.name and not adv.local_name) and adv.rssi > -70
    ]

    # Also include named devices matching MXW, just in case
    named = [
        (dev, adv) for _, (dev, adv) in sorted_devs
        if (dev.name or adv.local_name or "").lower().startswith("mxw")
    ]
    candidates = named + candidates

    if not candidates:
        print("\n  No nearby unnamed devices found. Try moving closer to the printer.")
        # Try weaker signal devices too
        candidates = [
            (dev, adv) for _, (dev, adv) in sorted_devs
            if (not dev.name and not adv.local_name) and adv.rssi > -90
        ]

    print(f"\n[2/2] Trying to connect to {len(candidates)} candidate(s)...\n")

    for dev, adv in candidates:
        name = dev.name or adv.local_name or "(unnamed)"
        print(f"  --- Trying {dev.address} ({name}, RSSI={adv.rssi}) ---")
        try:
            async with BleakClient(dev.address, timeout=8) as client:
                resolved_name = client.services.services
                # Get device name from Generic Access if possible
                dev_name = "(unknown)"
                try:
                    # 0x2a00 = Device Name characteristic
                    name_bytes = await client.read_gatt_char("00002a00-0000-1000-8000-00805f9b34fb")
                    dev_name = name_bytes.decode("utf-8", errors="replace")
                except:
                    pass

                svc_count = len(client.services.services)
                print(f"  ✅ Connected! Device Name: '{dev_name}', Services: {svc_count}")

                has_writable = False
                for svc in client.services:
                    print(f"\n    SERVICE: {svc.uuid}")
                    if svc.description:
                        print(f"             ({svc.description})")

                    for ch in svc.characteristics:
                        props = ", ".join(ch.properties)
                        writable = "write" in props or "write-without-response" in props
                        marker = "  <<<< PRINT HERE!" if writable else ""
                        if writable:
                            has_writable = True
                        print(f"      CHAR: {ch.uuid}  [{props}]{marker}")

                if "mxw" in dev_name.lower() or has_writable:
                    print(f"\n  🎉 This looks like the printer!")
                    print(f"     Address: {dev.address}")
                    print(f"     Name: {dev_name}")

                    # Try sending a quick ESC/POS init + text
                    if has_writable:
                        for svc in client.services:
                            for ch in svc.characteristics:
                                if "write" in ch.properties or "write-without-response" in ch.properties:
                                    print(f"\n  🖨️  Attempting test print via {ch.uuid}...")
                                    try:
                                        # ESC @ (init) + center align + text + feed
                                        data = (
                                            b'\x1b\x40'        # ESC @ init
                                            b'\x1b\x61\x01'    # center
                                            b'\x1b\x45\x01'    # bold on
                                            b'PAPELITOS\n'
                                            b'\x1b\x45\x00'    # bold off
                                            b'\n'
                                            b'Test de impresion OK!\n'
                                            b'\x1b\x64\x04'    # feed 4 lines
                                        )
                                        # Send in chunks
                                        chunk_size = 20
                                        for i in range(0, len(data), chunk_size):
                                            chunk = data[i:i+chunk_size]
                                            if "write-without-response" in ch.properties:
                                                await client.write_gatt_char(ch.uuid, chunk, response=False)
                                            else:
                                                await client.write_gatt_char(ch.uuid, chunk, response=True)
                                            await asyncio.sleep(0.05)
                                        print(f"  ✅ Data sent! Check the printer!")
                                    except Exception as e:
                                        print(f"  ❌ Write failed: {e}")
                                    break
                            else:
                                continue
                            break
                    return

                print()
        except Exception as e:
            print(f"  ❌ Failed: {e}\n")

    print("\n❌ Could not identify MXW01 among nearby devices.")
    print("   Try power-cycling the printer and run again.")

asyncio.run(main())
