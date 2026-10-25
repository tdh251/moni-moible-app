# Deterministic, code-generated monogram assets; no external images or fonts to ship.
Add-Type -AssemblyName System.Drawing
$brandDirectory = Join-Path $PSScriptRoot '../assets/brand'
[System.IO.Directory]::CreateDirectory($brandDirectory) | Out-Null
function Write-Monogram([string]$name, [string]$background, [string]$foreground) {
    $bitmap = New-Object System.Drawing.Bitmap 1024, 1024
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($background))
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($foreground))
    $font = New-Object System.Drawing.Font 'Segoe UI', 450, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rectangle = New-Object System.Drawing.RectangleF 0, -20, 1024, 1024
    $graphics.DrawString('M', $font, $brush, $rectangle, $format)
    $bitmap.Save((Join-Path $brandDirectory $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $format.Dispose()
    $font.Dispose()
    $brush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
Write-Monogram 'icon.png' '#193D30' '#DCECE3'
Write-Monogram 'foreground.png' 'Transparent' '#287D68'
Write-Monogram 'monochrome.png' 'Transparent' '#FFFFFF'
