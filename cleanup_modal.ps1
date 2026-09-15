$file = 'D:\Web\Nextjs\Prime Projects\myorbit-smart\app\components\goals\templates\ExpensesTemplate.tsx'
$lines = Get-Content $file -Encoding UTF8
# Keep lines 1-1794 (0-indexed: 0..1793) and lines 2107+ (0-indexed: 2106..)
$kept = @($lines[0..1793]) + @($lines[2106..($lines.Length - 1)])
$content = $kept -join "`r`n"
[System.IO.File]::WriteAllText($file, $content + "`r`n", [System.Text.UTF8Encoding]::new($false))
Write-Host "Done. Lines removed: $(2106 - 1794)"
