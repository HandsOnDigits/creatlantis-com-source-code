# 1. Create the CORS XML
$xml = @'
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>http://localhost:5173</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
'@

$xmlPath = Join-Path $env:TEMP 'creatlantis-staging-cors.xml'
$configPath = Join-Path $env:TEMP 'creatlantis-staging-cors.curl'

[System.IO.File]::WriteAllText(
    $xmlPath,
    $xml,
    [System.Text.UTF8Encoding]::new($false)
)

# 2. Calculate Content-MD5
$xmlBytes = [System.IO.File]::ReadAllBytes($xmlPath)
$md5 = [System.Security.Cryptography.MD5]::Create()

try {
    $contentMd5 = [Convert]::ToBase64String(
        $md5.ComputeHash($xmlBytes)
    )
}
finally {
    $md5.Dispose()
}

# 3. Read temporary Backblaze credentials
$keyId = Read-Host 'Backblaze application key ID'
$secureSecret = Read-Host 'Backblaze application key' -AsSecureString

$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)

try {
    $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)

    # 4. Prepare signed S3 request
    $xmlPathCurl = $xmlPath.Replace('\', '/')

    $config = @"
user = "$keyId`:$secret"
aws-sigv4 = "aws:amz:us-east-005:s3"
request = "PUT"
url = "https://s3.us-east-005.backblazeb2.com/creatlantis-staging/?cors=null"
header = "Content-Type: application/xml"
header = "Content-MD5: $contentMd5"
data-binary = "@$xmlPathCurl"
"@

    [System.IO.File]::WriteAllText(
        $configPath,
        $config,
        [System.Text.UTF8Encoding]::new($false)
    )

    # 5. Execute request
    curl.exe --config $configPath --include --silent --show-error

    Write-Host "Curl exit code: $LASTEXITCODE"
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)

    Remove-Item $configPath, $xmlPath -Force -ErrorAction SilentlyContinue

    $secret = $null
    $keyId = $null
    $secureSecret = $null
}