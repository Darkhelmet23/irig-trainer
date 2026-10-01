param(
  [string]$SourceLogo = (Join-Path $PSScriptRoot '..\assets\rifftree-original.png')
)

Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $SourceLogo))
$output = Join-Path $PSScriptRoot '..\public'

if ($source.Width -ne 1254 -or $source.Height -ne 1254 -or
    $source.GetPixel(0, 0).A -ne 0) {
  $source.Dispose()
  throw 'The source must be the transparent 1254x1254 RiffTree artwork.'
}

function Export-RiffTreeImage {
  param(
    [string]$Name,
    [System.Drawing.Rectangle]$Crop,
    [int]$Width,
    [int]$Height,
    [double]$Padding = 0,
    [string]$Background = ''
  )
  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    if ($Background) {
      $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($Background))
    }
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $availableWidth = $Width * (1 - 2 * $Padding)
    $availableHeight = $Height * (1 - 2 * $Padding)
    $scale = [Math]::Min($availableWidth / $Crop.Width, $availableHeight / $Crop.Height)
    $drawWidth = [int][Math]::Round($Crop.Width * $scale)
    $drawHeight = [int][Math]::Round($Crop.Height * $scale)
    $destination = [System.Drawing.Rectangle]::new(
      [int][Math]::Round(($Width - $drawWidth) / 2),
      [int][Math]::Round(($Height - $drawHeight) / 2),
      $drawWidth, $drawHeight)
    $graphics.DrawImage($source, $destination, $Crop,
      [System.Drawing.GraphicsUnit]::Pixel)
    $bitmap.Save((Join-Path $output $Name),
      [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

try {
  $full = [System.Drawing.Rectangle]::new(118, 68, 1030, 1096)
  $wordmark = [System.Drawing.Rectangle]::new(116, 904, 1040, 260)
  $emblem = [System.Drawing.Rectangle]::new(232, 68, 782, 840)
  Export-RiffTreeImage -Name 'rifftree-logo.png' -Crop $full -Width 640 -Height 680
  Export-RiffTreeImage -Name 'rifftree-wordmark.png' -Crop $wordmark -Width 640 -Height 160
  Export-RiffTreeImage -Name 'rifftree-emblem.png' -Crop $emblem -Width 512 -Height 512
  Export-RiffTreeImage -Name 'rifftree-icon-192.png' -Crop $emblem -Width 192 -Height 192 -Padding 0.08
  Export-RiffTreeImage -Name 'rifftree-icon-512.png' -Crop $emblem -Width 512 -Height 512 -Padding 0.08
  Export-RiffTreeImage -Name 'rifftree-maskable-512.png' -Crop $emblem -Width 512 -Height 512 -Padding 0.20 -Background '#f7f5ed'
  Export-RiffTreeImage -Name 'rifftree-touch-180.png' -Crop $emblem -Width 180 -Height 180 -Padding 0.16 -Background '#f7f5ed'
  Export-RiffTreeImage -Name 'rifftree-favicon-32.png' -Crop $emblem -Width 32 -Height 32 -Padding 0.02
} finally {
  $source.Dispose()
}
