# Download only the selected CC0 originals. Never overwrite an existing asset.
# Sources and attribution are recorded in assets/audio/README.md.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$taskAudioRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../assets/audio'))
[System.IO.Directory]::CreateDirectory($taskAudioRoot) | Out-Null
$taskPacks = @(
  @{ Url = 'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip'; Files = @{
    'Audio/click_001.ogg'='ui-click.ogg'; 'Audio/open_001.ogg'='ui-open.ogg';
    'Audio/close_001.ogg'='ui-close.ogg'; 'Audio/select_001.ogg'='ui-select.ogg';
    'Audio/confirmation_001.ogg'='confirmation.ogg'; 'Audio/error_001.ogg'='unavailable.ogg'
  } },
  @{ Url = 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip'; Files = @{
    'Audio/impactWood_medium_000.ogg'='chop-1.ogg'; 'Audio/impactWood_medium_001.ogg'='chop-2.ogg';
    'Audio/impactWood_medium_002.ogg'='chop-3.ogg'; 'Audio/impactWood_heavy_000.ogg'='tree-felled.ogg';
    'Audio/impactWood_heavy_001.ogg'='boss-hit.ogg'; 'Audio/impactWood_light_000.ogg'='wood-collect.ogg';
    'Audio/impactPlank_medium_000.ogg'='trolley-load.ogg'; 'Audio/impactPlank_medium_001.ogg'='trolley-unload.ogg';
    'Audio/impactSoft_medium_000.ogg'='plant.ogg'; 'Audio/footstep_grass_000.ogg'='pet-depart.ogg'
  } },
  @{ Url = 'https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip'; Files = @{
    'Audio/creak1.ogg'='trolley-depart.ogg'; 'Audio/handleCoins.ogg'='coins.ogg'; 'Audio/bookOpen.ogg'='map-open.ogg'
  } },
  @{ Url = 'https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip'; Files = @{
    'Audio/Pizzicato jingles/jingles_PIZZI00.ogg'='upgrade.ogg'; 'Audio/Pizzicato jingles/jingles_PIZZI01.ogg'='reward.ogg'
  } }
)
foreach ($taskPack in $taskPacks) {
  $taskResponse = Invoke-WebRequest $taskPack.Url -UseBasicParsing
  $taskStream = [System.IO.MemoryStream]::new([byte[]]$taskResponse.Content)
  $taskArchive = [System.IO.Compression.ZipArchive]::new($taskStream)
  try {
    foreach ($taskFile in $taskPack.Files.GetEnumerator()) {
      $taskTarget = Join-Path $taskAudioRoot $taskFile.Value
      if (Test-Path -LiteralPath $taskTarget) { continue }
      $taskEntry = $taskArchive.GetEntry($taskFile.Key)
      if (!$taskEntry -or $taskEntry.Length -le 0) { throw "Missing audio: $($taskFile.Key)" }
      $taskInput = $taskEntry.Open()
      $taskOutput = [System.IO.File]::Open($taskTarget, [System.IO.FileMode]::CreateNew)
      try { $taskInput.CopyTo($taskOutput) } finally { $taskInput.Dispose(); $taskOutput.Dispose() }
    }
  } finally { $taskArchive.Dispose(); $taskStream.Dispose() }
}
$taskSingles = @{
  'peaceful-ville.ogg'='https://opengameart.org/sites/default/files/peaceful_ville_2023_0.ogg';
  'boss-forest.ogg'='https://opengameart.org/sites/default/files/forest_2_0.ogg';
  'magic.ogg'='https://opengameart.org/sites/default/files/magical_1_0.ogg';
  'water.ogg'='https://opengameart.org/sites/default/files/water_drops_1.ogg'
}
foreach ($taskFile in $taskSingles.GetEnumerator()) {
  $taskTarget = Join-Path $taskAudioRoot $taskFile.Key
  if (!(Test-Path -LiteralPath $taskTarget)) { Invoke-WebRequest $taskFile.Value -UseBasicParsing -OutFile $taskTarget }
}
Get-ChildItem -LiteralPath $taskAudioRoot -Filter '*.ogg' | Select-Object Name, Length
