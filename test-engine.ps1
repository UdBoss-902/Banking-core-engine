$baseUrl = "http://localhost:3000/api/v1"
$runId = Get-Date -Format "HHmmss"

$senderAccNum = "ACC-SENDER-$runId"
$recipientAccNum = "ACC-RECIPIENT-$runId"
$clearingAccNum = "ACC-CLEARING-$runId"

Write-Host "1. Checking System Health..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get | ConvertTo-Json

Write-Host "`n2. Creating Sender Account ($senderAccNum)..." -ForegroundColor Cyan
$senderBody = @{ accountNumber = $senderAccNum; currency = "USD"; type = "LIABILITY" } | ConvertTo-Json
$sender = Invoke-RestMethod -Uri "$baseUrl/accounts" -Method Post -ContentType "application/json" -Body $senderBody
$senderId = $sender.account.id
Write-Host "Sender Created: $senderId" -ForegroundColor Green

Write-Host "`n3. Creating Recipient Account ($recipientAccNum)..." -ForegroundColor Cyan
$recipientBody = @{ accountNumber = $recipientAccNum; currency = "USD"; type = "LIABILITY" } | ConvertTo-Json
$recipient = Invoke-RestMethod -Uri "$baseUrl/accounts" -Method Post -ContentType "application/json" -Body $recipientBody
$recipientId = $recipient.account.id
Write-Host "Recipient Created: $recipientId" -ForegroundColor Green

Write-Host "`n4. Creating System Clearing Account ($clearingAccNum)..." -ForegroundColor Cyan
$clearingBody = @{ accountNumber = $clearingAccNum; currency = "USD"; type = "ASSET" } | ConvertTo-Json
$clearing = Invoke-RestMethod -Uri "$baseUrl/accounts" -Method Post -ContentType "application/json" -Body $clearingBody
$clearingId = $clearing.account.id
Write-Host "Clearing Created: $clearingId" -ForegroundColor Green

Write-Host "`n5. Funding Sender Account (`$1,000 from System Clearing)..." -ForegroundColor Cyan
$fundHeaders = @{ "Idempotency-Key" = "FUND-KEY-$runId" }
$fundBody = @{
    reference = "REF-FUND-$runId"
    sourceAccountId = $clearingId
    destinationAccountId = $senderId
    amount = 1000.00
    currency = "USD"
    description = "Initial Deposit"
} | ConvertTo-Json
Invoke-RestMethod -Uri "$baseUrl/transfers" -Method Post -Headers $fundHeaders -ContentType "application/json" -Body $fundBody | ConvertTo-Json

Write-Host "`n6. Checking Sender Balance..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$baseUrl/accounts/$senderId/balance" -Method Get | ConvertTo-Json

Write-Host "`n7. Executing P2P Transfer (`$250 Sender -> Recipient)..." -ForegroundColor Cyan
$p2pHeaders = @{ "Idempotency-Key" = "P2P-KEY-$runId" }
$p2pBody = @{
    reference = "REF-P2P-$runId"
    sourceAccountId = $senderId
    destinationAccountId = $recipientId
    amount = 250.00
    currency = "USD"
    description = "Peer to Peer Payment"
} | ConvertTo-Json
Invoke-RestMethod -Uri "$baseUrl/transfers" -Method Post -Headers $p2pHeaders -ContentType "application/json" -Body $p2pBody | ConvertTo-Json

Write-Host "`n8. Final Balance Verification..." -ForegroundColor Cyan
Write-Host "Sender Balance:" -ForegroundColor Yellow
Invoke-RestMethod -Uri "$baseUrl/accounts/$senderId/balance" -Method Get | ConvertTo-Json
Write-Host "Recipient Balance:" -ForegroundColor Yellow
Invoke-RestMethod -Uri "$baseUrl/accounts/$recipientId/balance" -Method Get | ConvertTo-Json
