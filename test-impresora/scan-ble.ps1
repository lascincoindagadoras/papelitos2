# scan-ble.ps1 - Discover BLE services/characteristics of MXW01 printer
# Uses Windows.Devices.Bluetooth WinRT APIs from PowerShell

Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Helper to await WinRT async operations from PowerShell
function Await-Task {
    param([object]$Task)
    $asTask = $Task.AsTask()
    $asTask.Wait()
    return $asTask.Result
}

function Get-WinRTType {
    param([string]$TypeName)
    [Type]::GetType("$TypeName, Windows.Foundation.UniversalApiContract, ContentType=WindowsRuntime")
}

Write-Host "=== MXW01 BLE Scanner ===" -ForegroundColor Cyan
Write-Host ""

# Load WinRT Bluetooth types
$null = [Windows.Devices.Bluetooth.BluetoothLEDevice, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
$null = [Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceService, Windows.Devices.Bluetooth.GenericAttributeProfile, ContentType=WindowsRuntime]
$null = [Windows.Devices.Bluetooth.Advertisement.BluetoothLEAdvertisementWatcher, Windows.Devices.Bluetooth.Advertisement, ContentType=WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType=WindowsRuntime]

Write-Host "[1/4] Scanning for BLE advertisements (10 seconds)..." -ForegroundColor Yellow
Write-Host "       Make sure MXW01 is ON and in range." -ForegroundColor Gray

$watcher = New-Object Windows.Devices.Bluetooth.Advertisement.BluetoothLEAdvertisementWatcher
$watcher.ScanningMode = [Windows.Devices.Bluetooth.Advertisement.BluetoothLEScanningMode]::Active

$devices = [System.Collections.Concurrent.ConcurrentDictionary[uint64, string]]::new()

$handler = {
    param($sender, $args)
    $addr = $args.BluetoothAddress
    $name = $args.Advertisement.LocalName
    if ($name) {
        $null = $devices.TryAdd($addr, $name)
    }
}

$eventToken = Register-ObjectEvent -InputObject $watcher -EventName Received -Action $handler

$watcher.Start()
$seconds = 10
for ($i = $seconds; $i -gt 0; $i--) {
    Write-Host "`r       Scanning... $i seconds remaining. Found $($devices.Count) device(s)." -NoNewline
    Start-Sleep -Seconds 1
}
Write-Host ""
$watcher.Stop()
Unregister-Event -SourceIdentifier $eventToken.Name

Write-Host ""
Write-Host "[2/4] Devices found:" -ForegroundColor Yellow

$targetAddr = $null
foreach ($kv in $devices.GetEnumerator()) {
    $mac = '{0:X12}' -f $kv.Key
    $macFmt = ($mac -replace '(.{2})', '$1:').TrimEnd(':')
    $marker = ""
    if ($kv.Value -match 'MXW') {
        $marker = " <-- TARGET"
        $targetAddr = $kv.Key
    }
    Write-Host "       $macFmt  $($kv.Value)$marker" -ForegroundColor $(if ($marker) { 'Green' } else { 'Gray' })
}

if (-not $targetAddr) {
    Write-Host ""
    Write-Host "ERROR: MXW01 not found! Is it turned on?" -ForegroundColor Red
    Write-Host "       Listing all found devices above. Check if it uses a different name." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[3/4] Connecting to MXW01..." -ForegroundColor Yellow

$asyncOp = [Windows.Devices.Bluetooth.BluetoothLEDevice]::FromBluetoothAddressAsync($targetAddr)
$bleDevice = Await-Task $asyncOp

if (-not $bleDevice) {
    Write-Host "ERROR: Could not connect to device." -ForegroundColor Red
    exit 1
}

Write-Host "       Connected! Name: $($bleDevice.Name)" -ForegroundColor Green
Write-Host ""
Write-Host "[4/4] Discovering GATT services and characteristics..." -ForegroundColor Yellow

$gattResult = Await-Task ($bleDevice.GetGattServicesAsync())

if ($gattResult.Status -ne 0) {
    Write-Host "ERROR: GetGattServicesAsync failed with status $($gattResult.Status)" -ForegroundColor Red
    exit 1
}

$svcCount = $gattResult.Services.Count
Write-Host "       Found $svcCount service(s):" -ForegroundColor Green
Write-Host ""

foreach ($svc in $gattResult.Services) {
    $svcUuid = $svc.Uuid.ToString()
    Write-Host "  SERVICE: $svcUuid" -ForegroundColor Cyan

    $charResult = Await-Task ($svc.GetCharacteristicsAsync())
    if ($charResult.Status -eq 0) {
        foreach ($ch in $charResult.Characteristics) {
            $chUuid = $ch.Uuid.ToString()
            $props = $ch.CharacteristicProperties.ToString()
            $isWrite = $props -match 'Write'
            $color = if ($isWrite) { 'Green' } else { 'Gray' }
            Write-Host "    CHAR: $chUuid  [$props]" -ForegroundColor $color
            if ($isWrite) {
                Write-Host "          ^^^ WRITABLE - likely the print characteristic!" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "    (could not read characteristics)" -ForegroundColor Red
    }
    Write-Host ""
}

# Cleanup
$bleDevice.Dispose()

Write-Host "=== Scan complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Copy the SERVICE UUID and CHAR UUID with 'Write' to the test page." -ForegroundColor Yellow
