// scan-ble.csx - C# script to discover BLE services of MXW01
// Run with: dotnet-script scan-ble.csx  OR  compile and run

using System;
using System.Linq;
using System.Threading.Tasks;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Bluetooth.GenericAttributeProfile;

Console.WriteLine("=== MXW01 BLE Scanner ===\n");

var tcs = new TaskCompletionSource<ulong>();
var watcher = new BluetoothLEAdvertisementWatcher();
watcher.ScanningMode = BluetoothLEScanningMode.Active;

Console.WriteLine("[1/3] Scanning 10s for MXW01...");

watcher.Received += (s, e) => {
    var name = e.Advertisement.LocalName;
    if (!string.IsNullOrEmpty(name)) {
        var mac = string.Join(":", BitConverter.GetBytes(e.BluetoothAddress).Reverse().Select(b => b.ToString("X2")));
        Console.WriteLine($"  Found: {name} ({mac}) RSSI={e.RawSignalStrengthInDbm}");
        if (name.Contains("MXW", StringComparison.OrdinalIgnoreCase)) {
            tcs.TrySetResult(e.BluetoothAddress);
        }
    }
};

watcher.Start();
var found = await Task.WhenAny(tcs.Task, Task.Delay(10000)) == tcs.Task;
watcher.Stop();

if (!found) { Console.WriteLine("\nERROR: MXW01 not found!"); return; }

var addr = tcs.Task.Result;
Console.WriteLine($"\n[2/3] Connecting to MXW01...");

var device = await BluetoothLEDevice.FromBluetoothAddressAsync(addr);
Console.WriteLine($"  Connected: {device.Name}\n");

Console.WriteLine("[3/3] Discovering services...\n");
var gatt = await device.GetGattServicesAsync(BluetoothCacheMode.Uncached);

foreach (var svc in gatt.Services) {
    Console.WriteLine($"  SERVICE: {svc.Uuid}");
    var chars = await svc.GetCharacteristicsAsync(BluetoothCacheMode.Uncached);
    foreach (var ch in chars.Characteristics) {
        var p = ch.CharacteristicProperties;
        Console.Write($"    CHAR: {ch.Uuid}  [{p}]");
        if (p.HasFlag(GattCharacteristicProperties.Write) || p.HasFlag(GattCharacteristicProperties.WriteWithoutResponse))
            Console.Write("  <-- WRITABLE!");
        Console.WriteLine();
    }
    Console.WriteLine();
}

device.Dispose();
Console.WriteLine("=== Done ===");
