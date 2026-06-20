import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tempScript = join(root, 'scripts', '.create-store-assets.ps1');

await mkdir(join(root, 'docs', 'store', 'assets', 'screenshots'), { recursive: true });
await mkdir(join(root, 'docs', 'store', 'assets', 'promo'), { recursive: true });
await mkdir(join(root, 'docs', 'store', 'assets', 'logo'), { recursive: true });

await writeFile(tempScript, powershellScript(root), 'utf8');
try {
  await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tempScript]);
} finally {
  await rm(tempScript, { force: true });
}

console.log('Created store logo and 24-bit promotional PNG assets.');

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', cwd: root });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

function powershellScript(projectRoot) {
  const escapedRoot = projectRoot.replaceAll("'", "''");
  return `
Add-Type -AssemblyName System.Drawing

$Root = '${escapedRoot}'
$IconPath = Join-Path $Root 'public/icons/icon128.png'
$LogoDir = Join-Path $Root 'docs/store/assets/logo'
$PromoDir = Join-Path $Root 'docs/store/assets/promo'

Copy-Item -LiteralPath $IconPath -Destination (Join-Path $LogoDir 'logo-128.png') -Force

function New-Bitmap([int]$Width, [int]$Height) {
  return New-BitmapWithPixelFormat $Width $Height ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}

function New-RgbBitmap([int]$Width, [int]$Height) {
  return New-BitmapWithPixelFormat $Width $Height ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
}

function New-BitmapWithPixelFormat([int]$Width, [int]$Height, [System.Drawing.Imaging.PixelFormat]$PixelFormat) {
  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height, $PixelFormat
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function New-RoundedRect([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  if ($Radius -le 0) {
    $path.AddRectangle((New-Object System.Drawing.RectangleF $X, $Y, $Width, $Height))
    return $path
  }
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundedRect($Graphics, [string]$Color, [float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius) {
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($Color))
  $path = New-RoundedRect $X $Y $Width $Height $Radius
  $Graphics.FillPath($brush, $path)
  $brush.Dispose()
  $path.Dispose()
}

function Stroke-RoundedRect($Graphics, [string]$Color, [float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius, [float]$StrokeWidth) {
  $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($Color)), $StrokeWidth
  $path = New-RoundedRect $X $Y $Width $Height $Radius
  $Graphics.DrawPath($pen, $path)
  $pen.Dispose()
  $path.Dispose()
}

function Draw-Text($Graphics, [string]$Text, [float]$X, [float]$Y, [float]$Size, [string]$Color, [string]$Weight) {
  $style = [System.Drawing.FontStyle]::Regular
  if ($Weight -eq 'Bold') { $style = [System.Drawing.FontStyle]::Bold }
  $font = New-Object System.Drawing.Font 'Segoe UI', $Size, $style, ([System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($Color))
  $Graphics.DrawString($Text, $font, $brush, $X, $Y)
  $font.Dispose()
  $brush.Dispose()
}

function Draw-Card($Graphics, [float]$X, [float]$Y, [float]$Width, [float]$Height, [string]$Accent) {
  Fill-RoundedRect $Graphics '#FFFFFF' $X $Y $Width $Height 8
  Stroke-RoundedRect $Graphics '#D9E2EF' $X $Y $Width $Height 8 1.5
  Fill-RoundedRect $Graphics $Accent ($X + 18) ($Y + 18) 34 34 8
  Fill-RoundedRect $Graphics '#CBD5E1' ($X + 68) ($Y + 20) ($Width - 96) 10 5
  Fill-RoundedRect $Graphics '#E2E8F0' ($X + 68) ($Y + 42) ($Width - 150) 9 5
}

function Save-Logo300 {
  $icon = [System.Drawing.Image]::FromFile($IconPath)
  $surface = New-Bitmap 300 300
  $surface.Graphics.Clear([System.Drawing.Color]::Transparent)
  $surface.Graphics.DrawImage($icon, 22, 22, 256, 256)
  $surface.Bitmap.Save((Join-Path $LogoDir 'logo-300.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  $surface.Graphics.Dispose()
  $surface.Bitmap.Dispose()
  $icon.Dispose()
}

function Save-SmallPromo {
  $icon = [System.Drawing.Image]::FromFile($IconPath)
  $surface = New-RgbBitmap 440 280
  $g = $surface.Graphics
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#F8FAFC'))
  Fill-RoundedRect $g '#EEF2FF' 24 34 128 128 18
  $g.DrawImage($icon, 40, 50, 96, 96)
  Draw-Card $g 196 50 196 64 '#4F46E5'
  Draw-Card $g 174 124 220 64 '#14B8A6'
  Draw-Text $g 'Collections-style' 50 185 22 '#111827' 'Bold'
  Draw-Text $g 'bookmarks' 50 213 22 '#111827' 'Bold'
  $surface.Bitmap.Save((Join-Path $PromoDir 'small-promo-440x280.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $surface.Bitmap.Dispose()
  $icon.Dispose()
}

function Save-Marquee {
  $icon = [System.Drawing.Image]::FromFile($IconPath)
  $surface = New-RgbBitmap 1400 560
  $g = $surface.Graphics
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#F8FAFC'))
  Fill-RoundedRect $g '#EEF2FF' 80 72 168 168 24
  $g.DrawImage($icon, 104, 96, 120, 120)
  Draw-Text $g 'Collections Reborn' 82 280 42 '#111827' 'Bold'
  Draw-Text $g 'Collections-style bookmarks in a focused side panel' 86 338 25 '#475569' 'Regular'

  Fill-RoundedRect $g '#FFFFFF' 720 56 440 448 10
  Stroke-RoundedRect $g '#D9E2EF' 720 56 440 448 10 2
  Fill-RoundedRect $g '#F8FAFC' 740 80 400 42 8
  Fill-RoundedRect $g '#4F46E5' 1092 87 28 28 5
  Fill-RoundedRect $g '#F1F5F9' 740 140 400 40 0
  Draw-Text $g 'Product Research' 784 151 18 '#111827' 'Bold'
  Draw-Card $g 760 206 360 62 '#4F46E5'
  Draw-Card $g 760 282 360 62 '#14B8A6'
  Draw-Card $g 760 358 360 62 '#0EA5E9'
  Fill-RoundedRect $g '#FFFFFF' 1110 180 190 74 8
  Stroke-RoundedRect $g '#D9E2EF' 1110 180 190 74 8 1.5
  Draw-Text $g 'Move to...' 1130 204 20 '#111827' 'Bold'
  Fill-RoundedRect $g '#E0E7FF' 1130 232 120 8 4

  $surface.Bitmap.Save((Join-Path $PromoDir 'marquee-1400x560.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $surface.Bitmap.Dispose()
  $icon.Dispose()
}

Save-Logo300
Save-SmallPromo
Save-Marquee
`;
}
