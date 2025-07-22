# Receipt Analyzer API - Complete Documentation

## Script Analysis

This Google Apps Script creates a powerful REST API that analyzes transaction receipts using Google's Gemini AI. The script processes receipt images, extracts transaction details, and stores the data in Google Sheets.

### Core Features:
- **AI-powered receipt analysis** using Gemini 2.0 Flash
- **Image processing** with base64 encoding
- **Data extraction** (items, prices, quantities, totals, store info)
- **Storage integration** with Google Drive and Google Sheets
- **RESTful API** with JSON responses
- **Comprehensive logging** and error handling
- **CORS support** for web applications

---

## API Documentation

### Base Information
- **API Name:** Asisten Transaksi AI API
- **Version:** 1.0.0
- **Base URL:** Your deployed Google Apps Script web app URL

### Authentication
No authentication required (publicly accessible)

### Endpoints

#### 1. Health Check
```
GET /
```
**Description:** Check API status

**Response:**
```json
{
  "status": "success",
  "message": "Asisten Transaksi AI API is running. Use POST method to analyze transaction receipts.",
  "documentation": "Send \"action=docs\" parameter to get documentation"
}
```

#### 2. Process Receipt
```
POST /
```
**Description:** Analyze receipt image and extract transaction details

**Headers:**
```
Content-Type: application/x-www-form-urlencoded
# or
Content-Type: application/json
```

**Parameters:**
- `action` (string, required): "process-receipt"
- `fileData` (string, required): Base64 encoded image data
- `fileName` (string, required): Name of the file
- `mimeType` (string, required): MIME type (e.g., "image/jpeg", "image/png")

**Example Request (Form Data):**
```
action=process-receipt
fileData=iVBORw0KGgoAAAANSUhEUgAA...
fileName=receipt_001.jpg
mimeType=image/jpeg
```

**Example Request (JSON):**
```json
{
  "action": "process-receipt",
  "fileData": "iVBORw0KGgoAAAANSUhEUgAA...",
  "fileName": "receipt_001.jpg",
  "mimeType": "image/jpeg"
}
```

**Success Response (Valid Receipt):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "original": {
      "fileUrl": "https://drive.google.com/file/d/1ABC.../view",
      "fileName": "receipt_001.jpg",
      "mimeType": "image/jpeg"
    },
    "analysis": {
      "raw": "**Transaksi:** Transaksi dengan 3 item\n\n**Detail:**\n1x Springbed - Rp 180.000\n1x Kursi kantor - Rp 30.000\n1x Trampor - Rp 20.000\n\n**Total:** Rp 230.000\n\n**Toko:** Jogja Clean\n\n**Tanggal:** 15 November 2024",
      "parsed": {
        "status": "success",
        "transaction_summary": "Transaksi dengan 3 item",
        "details": [
          {
            "quantity": 1,
            "name": "Springbed",
            "price": 180000
          },
          {
            "quantity": 1,
            "name": "Kursi kantor",
            "price": 30000
          },
          {
            "quantity": 1,
            "name": "Trampor",
            "price": 20000
          }
        ],
        "total_amount": 230000,
        "store_name": "Jogja Clean",
        "transaction_date": "15 November 2024"
      }
    }
  }
}
```

**Success Response (Not a Receipt):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "original": {
      "fileUrl": "https://drive.google.com/file/d/1ABC.../view",
      "fileName": "not_receipt.jpg",
      "mimeType": "image/jpeg"
    },
    "analysis": {
      "raw": "**Status:** Bukan Nota",
      "parsed": {
        "status": "not_receipt",
        "message": "Gambar yang diberikan bukan merupakan nota/kuitansi/faktur",
        "transaction_summary": "",
        "details": [],
        "total_amount": 0,
        "store_name": "",
        "transaction_date": ""
      }
    }
  }
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Missing required parameters: fileData, fileName, and mimeType must be provided",
  "code": 400
}
```

#### 3. Get API Documentation
```
POST /
```
**Parameters:**
- `action` (string, required): "docs"

**Response:** Returns complete API documentation in JSON format

### Error Codes
- `200` - Success
- `400` - Bad Request (missing parameters)
- `500` - Internal Server Error

---

## Deployment Guide

### Prerequisites
1. Google account
2. Access to Google Apps Script
3. Gemini API key from Google AI Studio

### Step 1: Setup Google Services

#### Get Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create new API key
3. Copy the API key

#### Create Google Sheets
1. Create new Google Sheet
2. Copy the Spreadsheet ID from URL
3. Note: Script will auto-create required sheets (log, metadata, transactions)

#### Create Google Drive Folder
1. Create folder for storing receipt images
2. Copy folder ID from URL
3. Set folder permissions if needed

### Step 2: Deploy the Script

#### Create Apps Script Project
1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Delete default code
4. Paste the provided script

#### Configure Constants
Update these variables in the script:
```javascript
const GEMINI_API_KEY = 'your_gemini_api_key_here';
const SPREADSHEET_ID = 'your_spreadsheet_id_here'; 
const FOLDER_ID = 'your_drive_folder_id_here';
```

#### Set Permissions
1. Save the script (Ctrl+S)
2. Click "Run" to authorize permissions
3. Review and accept required permissions:
   - Google Drive access
   - Google Sheets access
   - External URL access

#### Deploy as Web App
1. Click "Deploy" → "New Deployment"
2. Choose type: "Web app"
3. Description: "Receipt Analyzer API v1.0"
4. Execute as: "Me"
5. Who has access: "Anyone" (for public API)
6. Click "Deploy"
7. Copy the web app URL

### Step 3: Test the Deployment

#### Test with cURL
```bash
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "action=docs"
```

#### Test with JavaScript
```javascript
const testAPI = async () => {
  const response = await fetch('YOUR_WEB_APP_URL', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'docs'
    })
  });
  
  const data = await response.json();
  console.log(data);
};
```

### Step 4: Monitor and Maintain

#### View Logs
1. Check Google Sheets for execution logs
2. Monitor Apps Script execution transcript
3. Check Google Drive for uploaded files

#### Update Script
1. Modify code in Apps Script editor
2. Save changes
3. Deploy new version if needed

---

## Usage Examples

### JavaScript/Web Application
```javascript
const analyzeReceipt = async (imageFile) => {
  // Convert image to base64
  const base64 = await convertToBase64(imageFile);
  
  const response = await fetch('YOUR_WEB_APP_URL', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'process-receipt',
      fileData: base64,
      fileName: imageFile.name,
      mimeType: imageFile.type
    })
  });
  
  return await response.json();
};

const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};
```

### Python Application
```python
import requests
import base64

def analyze_receipt(image_path):
    # Read and encode image
    with open(image_path, 'rb') as image_file:
        encoded_image = base64.b64encode(image_file.read()).decode('utf-8')
    
    # Prepare request
    data = {
        'action': 'process-receipt',
        'fileData': encoded_image,
        'fileName': 'receipt.jpg',
        'mimeType': 'image/jpeg'
    }
    
    # Send request
    response = requests.post('YOUR_WEB_APP_URL', json=data)
    return response.json()

# Usage
result = analyze_receipt('path/to/receipt.jpg')
print(result)
```

---

## Troubleshooting

### Common Issues

#### 1. "Script function not found"
- **Cause:** Deployment not completed properly
- **Solution:** Redeploy as web app

#### 2. "Permission denied"
- **Cause:** Missing Google services permissions
- **Solution:** Re-run script and accept all permissions

#### 3. "API key invalid"
- **Cause:** Incorrect or expired Gemini API key
- **Solution:** Generate new API key from Google AI Studio

#### 4. "Spreadsheet not found"
- **Cause:** Incorrect Spreadsheet ID
- **Solution:** Verify and update SPREADSHEET_ID

#### 5. "Image not processed"
- **Cause:** Invalid base64 encoding or unsupported format
- **Solution:** Ensure proper base64 encoding and use supported formats (JPEG, PNG)

### Performance Tips

1. **Image Size:** Keep images under 4MB for best performance
2. **Batch Processing:** Process images individually for reliability
3. **Error Handling:** Always handle API errors gracefully
4. **Rate Limiting:** Implement delays between requests if processing many images

---

## Security Considerations

1. **API Key Protection:** Keep Gemini API key secure
2. **Access Control:** Consider implementing authentication for production use
3. **Data Privacy:** Review what data is stored and shared
4. **File Permissions:** Set appropriate Drive folder permissions
5. **CORS:** Configure CORS settings as needed

---

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

---

## License

MIT License - feel free to use and modify as needed.
