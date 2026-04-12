"""
scan_mxw01_v3.py - Find MXW01 using both BLE and Classic Bluetooth discovery.
Also tries to use the Windows DeviceInformation API which is what Chrome uses.
"""
import asyncio
import subprocess
import sys

async def scan_ble():
    """Scan via bleak (BLE)"""
    from bleak import BleakScanner
    print("[BLE] Scanning 8 seconds...")
    devices = await BleakScanner.discover(timeout=8, return_adv=True)
    found = False
    for _, (dev, adv) in devices.items():
        name = dev.name or adv.local_name or ""
        if "mxw" in name.lower():
            print(f"  [BLE] FOUND: {dev.address} {name} RSSI={adv.rssi}")
            found = True
    if not found:
        print(f"  [BLE] MXW01 not found among {len(devices)} BLE devices")
    return found

async def scan_winrt():
    """Use Windows DeviceInformation API - same method Chrome uses"""
    try:
        import winrt.windows.devices.enumeration as wde
        import winrt.windows.devices.bluetooth as wdb
    except ImportError:
        print("  [WinRT] winrt packages not available, skipping")
        return

    print("[WinRT] Querying paired Bluetooth devices...")
    # Query for Bluetooth devices (paired)
    selector = wdb.BluetoothDevice.get_device_selector()
    devices = await wde.DeviceInformation.find_all_async(selector)
    print(f"  [WinRT] Found {devices.size} paired classic BT device(s):")
    for i in range(devices.size):
        d = devices.get_at(i)
        print(f"    {d.name:30s}  {d.id}")
        if "mxw" in d.name.lower():
            print(f"    ^^^ FOUND MXW01!")

    print()
    print("[WinRT] Querying paired BLE devices...")
    selector_le = wdb.BluetoothLEDevice.get_device_selector()
    devices_le = await wde.DeviceInformation.find_all_async(selector_le)
    print(f"  [WinRT] Found {devices_le.size} paired BLE device(s):")
    for i in range(devices_le.size):
        d = devices_le.get_at(i)
        print(f"    {d.name:30s}  {d.id}")
        if "mxw" in d.name.lower():
            print(f"    ^^^ FOUND MXW01!")

    # Also try unpaired/all
    print()
    print("[WinRT] Querying ALL Bluetooth devices (including unpaired)...")
    # Use AssociationEndpoint protocol for discovering unpaired devices  
    aqs = '(System.Devices.Aep.ProtocolId:="{bb7bb05e-5972-42b5-94fc-76eaa7084d49}" OR System.Devices.Aep.ProtocolId:="{e0cbf06c-cd8b-4647-bb8a-263b43f0f974}")'
    extra_props = wde.DeviceInformation.create_watcher(
        aqs,
        ["System.Devices.Aep.DeviceAddress", "System.Devices.Aep.IsConnected", "System.Devices.Aep.Bluetooth.Le.IsConnectable"],
        wde.DeviceInformationKind.ASSOCIATION_ENDPOINT
    )
    
    found_devices = []
    event = asyncio.Event()
    
    def on_added(sender, args):
        name = args.name or "(no name)"
        found_devices.append((name, args.id))
        if "mxw" in name.lower():
            print(f"  [WinRT] 🎉 FOUND: {name} - {args.id}")
    
    def on_stopped(sender, args):
        event.set()

    def on_complete(sender, args):
        event.set()

    extra_props.add_added(on_added)
    extra_props.add_stopped(on_stopped)
    extra_props.add_enumeration_completed(on_complete)
    
    extra_props.start()
    try:
        await asyncio.wait_for(event.wait(), timeout=15)
    except asyncio.TimeoutError:
        pass
    extra_props.stop()
    
    print(f"  [WinRT] Found {len(found_devices)} total device(s)")
    mxw_found = False
    for name, did in found_devices:
        marker = ""
        if "mxw" in name.lower():
            marker = "  <== MXW01!"
            mxw_found = True
        # Only show named devices to reduce noise
        if name != "(no name)" or marker:
            print(f"    {name:30s}  {did[:60]}...{marker}")
    
    if not mxw_found:
        print("  [WinRT] MXW01 not found in device enumeration either.")
        print("          Showing all unnamed devices too:")
        for name, did in found_devices:
            if name == "(no name)":
                print(f"    {name:30s}  {did[:80]}")

async def main():
    print("=== MXW01 Multi-Protocol Scanner ===\n")
    
    await scan_ble()
    print()
    await scan_winrt()
    
    print("\n=== Done ===")

asyncio.run(main())
