"""
print_test_mxw01.py - Try multiple approaches to print on MXW01.
Tests different characteristics, encodings, and command sequences.
"""
import asyncio
from bleak import BleakScanner, BleakClient

MXW01_ADDRESS = "48:0F:57:15:D4:18"

WRITABLE_CHARS = [
    "0000ae01-0000-1000-8000-00805f9b34fb",  # write-without-response
    "0000ae03-0000-1000-8000-00805f9b34fb",  # write-without-response
    "0000ae10-0000-1000-8000-00805f9b34fb",  # write + read
]

async def send_chunks(client, char_uuid, data, chunk_size=20, use_response=False):
    for i in range(0, len(data), chunk_size):
        chunk = data[i:i+chunk_size]
        await client.write_gatt_char(char_uuid, chunk, response=use_response)
        await asyncio.sleep(0.05)

async def main():
    print(f"=== MXW01 Print Tests ===\n")
    
    # Scan first to make device known to Windows BLE stack
    print("Scanning for MXW01...")
    devices = await BleakScanner.discover(timeout=5, return_adv=True)
    target = None
    for _, (dev, adv) in devices.items():
        name = dev.name or adv.local_name or ""
        if "mxw" in name.lower():
            target = dev
            print(f"  Found: {dev.address} ({name}) RSSI={adv.rssi}")
    
    if not target:
        print("❌ MXW01 not found. Is it on and not connected elsewhere?")
        return
    
    addr = target.address
    print(f"\nConnecting to {addr}...")

    async with BleakClient(addr, timeout=15) as client:
        print(f"✅ Connected!\n")

        # Enable notifications on ae02 and ae04 to see if printer responds
        for notify_char in ["0000ae02-0000-1000-8000-00805f9b34fb", "0000ae04-0000-1000-8000-00805f9b34fb"]:
            try:
                def notification_handler(sender, data):
                    print(f"  📩 Notification from {sender}: {data.hex()} ({data})")
                await client.start_notify(notify_char, notification_handler)
                print(f"  Listening on {notify_char}")
            except Exception as e:
                print(f"  Could not subscribe to {notify_char}: {e}")

        await asyncio.sleep(0.5)

        tests = [
            # Test 1: Raw text only, no ESC/POS
            ("Raw text (ae01)", "0000ae01-0000-1000-8000-00805f9b34fb", False,
             b'Hello MXW01!\n\n\n\n'),

            # Test 2: ESC/POS init + raw text
            ("ESC/POS init + text (ae01)", "0000ae01-0000-1000-8000-00805f9b34fb", False,
             b'\x1b\x40Hello MXW01!\n\n\n\n'),

            # Test 3: Just newlines (some printers need this to flush)
            ("Just newlines (ae01)", "0000ae01-0000-1000-8000-00805f9b34fb", False,
             b'\n\n\n\n\n\n\n\n\n\n'),

            # Test 4: Raw text on ae03
            ("Raw text (ae03)", "0000ae03-0000-1000-8000-00805f9b34fb", False,
             b'Hello MXW01!\n\n\n\n'),

            # Test 5: ESC/POS on ae03
            ("ESC/POS init + text (ae03)", "0000ae03-0000-1000-8000-00805f9b34fb", False,
             b'\x1b\x40Hello MXW01!\n\n\n\n'),

            # Test 6: ae10 with response
            ("Raw text (ae10, response)", "0000ae10-0000-1000-8000-00805f9b34fb", True,
             b'Hello MXW01!\n\n\n\n'),

            # Test 7: GBK encoding (Chinese printers often use this)
            ("GBK encoded (ae01)", "0000ae01-0000-1000-8000-00805f9b34fb", False,
             b'\x1b\x40' + 'Hello MXW01!\n\n\n\n'.encode('gbk')),

            # Test 8: Larger chunk size on ae01
            ("Large chunks (ae01)", "0000ae01-0000-1000-8000-00805f9b34fb", False,
             b'\x1b\x40Hello MXW01!\nTest impresora\n\n\n\n'),

            # Test 9: CPCL protocol (some portable printers use this instead of ESC/POS)
            ("CPCL protocol (ae01)", "0000ae01-0000-1000-8000-00805f9b34fb", False,
             b'! 0 200 200 200 1\r\nTEXT 4 0 0 50 Hello MXW01!\r\nFORM\r\nPRINT\r\n'),

            # Test 10: TSC protocol
            ("TSC protocol (ae01)", "0000ae01-0000-1000-8000-00805f9b34fb", False,
             b'SIZE 48 mm,20 mm\r\nCLS\r\nTEXT 10,10,"3",0,1,1,"Hello MXW01"\r\nPRINT 1\r\n'),
        ]

        for i, (name, char_uuid, use_resp, data) in enumerate(tests):
            print(f"\n--- Test {i+1}: {name} ---")
            print(f"    Char: {char_uuid}")
            print(f"    Data ({len(data)} bytes): {data[:40]}{'...' if len(data)>40 else ''}")
            try:
                chunk_size = 100 if "Large" in name else 20
                await send_chunks(client, char_uuid, data, chunk_size=chunk_size, use_response=use_resp)
                print(f"    ✅ Sent OK!")
                # Wait to see if printer prints
                await asyncio.sleep(3)
            except Exception as e:
                print(f"    ❌ Error: {e}")

        print("\n=== All tests done ===")

asyncio.run(main())
