param(
  [string]$Pmtiles = 'pmtiles',
  [string]$Source = 'https://data.source.coop/protomaps/openstreetmap/v4.pmtiles'
)
$ErrorActionPreference = 'Stop'
$destination = Join-Path $PSScriptRoot '../public/packs'
New-Item -ItemType Directory -Force $destination | Out-Null
$regions = @{
  makkah = '39.785,21.390,39.865,21.465'
  madinah = '39.565,24.425,39.664,24.520'
}
foreach ($region in $regions.Keys) {
  $archive = Join-Path $destination "$region-v1.pmtiles"
  & $Pmtiles extract $Source $archive "--bbox=$($regions[$region])" --maxzoom=15 --download-threads=3
  if ($LASTEXITCODE -ne 0) { throw "Could not create map extract for $region." }
  & $Pmtiles verify $archive
  if ($LASTEXITCODE -ne 0) { throw "Map extract for $region did not pass verification." }
}
