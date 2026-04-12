"""
connect_mxw01.py - Connect to MXW01 by address, discover services, and try to print.
"""
import asyncio
from bleak import BleakClient

MXW01_ADDRESS = "48:0F:57:15:D4:18"

async def main():
    print(f"=== Connecting to MXW01 ({MXW01_ADDRESS}) ===\n")

    async with BleakClient(MXW01_ADDRESS, timeout=15) as client:
        print(f"✅ Connected!\n")

        # Read device name
        try:
            name_bytes = await client.read_gatt_char("00002a00-0000-1000-8000-00805f9b34fb")
            print(f"Device Name: {name_bytes.decode('utf-8', errors='replace')}")
        except:
            print("Device Name: (could not read)")

        print(f"\n=== Services & Characteristics ===\n")

        writable_chars = []
        for svc in client.services:
            print(f"SERVICE: {svc.uuid}")
            if svc.description:
                print(f"         ({svc.description})")

            for ch in svc.characteristics:
                props = ", ".join(ch.properties)
                writable = "write" in props or "write-without-response" in props
                marker = "  <<<< WRITABLE" if writable else ""
                print(f"  CHAR: {ch.uuid}  [{props}]{marker}")
                if writable:
                    writable_chars.append(ch)
            print()

        print(f"=== Found {len(writable_chars)} writable characteristic(s) ===\n")

        if not writable_chars:
            print("❌ No writable characteristics found!")
            return

        # Try each writable characteristic
        test_data = (
            b'\x1b\x40'        # ESC @ initialize
            b'\x1b\x61\x01'    # center align
            b'\x1b\x45\x01'    # bold on
            b'PAPELITOS\n'
            b'\x1b\x45\x00'    # bold off
            b'\n'
            b'Test de impresion\n'
            b'Si ves esto, funciona!\n'
            b'\x1b\x64\x04'    # feed 4 lines
        )

        for ch in writable_chars:
            props = ", ".join(ch.properties)
            print(f"Trying to write to {ch.uuid} [{props}]...")
            try:
                use_response = "write" in ch.properties
                chunk_size = 20
                for i in range(0, len(test_data), chunk_size):
                    chunk = test_data[i:i+chunk_size]
                    await client.write_gatt_char(ch.uuid, chunk, response=use_response)
                    await asyncio.sleep(0.05)
                print(f"  ✅ SUCCESS! Data written to {ch.uuid}")
                print(f"  Check the printer for output!")
                print(f"\n  >>> Use this UUID in the web app:")
                print(f"      Service: {ch.service_uuid}")
                print(f"      Characteristic: {ch.uuid}")
                return
            except Exception as e:
                print(f"  ❌ Failed: {e}")
                continue

        print("\n❌ None of the writable characteristics accepted the data.")

asyncio.run(main())
