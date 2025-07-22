// Config
const GEMINI_API_KEY = '<APIKEY-GEMINI>';
const GEMINI_MODEL = 'gemini-2.0-flash';
const SPREADSHEET_ID = '<SPREADSHEET-ID';
const LOG_SHEET_NAME = 'log';
const METADATA_SHEET_NAME = 'metadata';
const TRANSACTIONS_SHEET_NAME = 'transactions';
const FOLDER_ID = '<FOLDER-ID>';

// Prompt template for transaction receipt analysis
const PROMPT_TEMPLATE = `<prompt bisa dicheckout https://lynk.id/classyid>`;

/**
 * Handle GET requests - Return API status
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    message: 'Asisten Transaksi AI API is running. Use POST method to analyze transaction receipts.',
    documentation: 'Send "action=docs" parameter to get documentation'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
function doOptions(e) {
  return ContentService.createTextOutput('');
}

/**
 * Handle POST requests - Process image and return JSON response
 */
function doPost(e) {
  try {
    // Get parameters from form data or JSON
    let data;
    
    if (e.postData && e.postData.contents) {
      try {
        // Try parsing as JSON first
        data = JSON.parse(e.postData.contents);
      } catch (error) {
        // If not JSON, fall back to form parameters
        data = e.parameter;
      }
    } else {
      // Use form parameters directly
      data = e.parameter;
    }
    
    // Check if action is provided
    if (!data.action) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Missing required parameter: action',
        code: 400
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Handle different API actions
    let result;
    
    switch(data.action) {
      case 'process-receipt':
        result = processReceiptAPI(data);
        break;
      case 'docs':
        result = getApiDocumentation();
        break;
      default:
        result = {
          status: 'error',
          message: `Unknown action: ${data.action}`,
          code: 400
        };
    }
    
    // Return result
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    logAction('API Error', `Error in API endpoint: ${error.toString()}`, 'ERROR');
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString(),
      code: 500
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * API endpoint to process transaction receipts
 */
function processReceiptAPI(data) {
  try {
    // Validate required parameters
    if (!data.fileData || !data.fileName || !data.mimeType) {
      return {
        status: 'error',
        message: 'Missing required parameters: fileData, fileName, and mimeType must be provided',
        code: 400
      };
    }
    
    // Log the request 
    logAction('Request', 'Receipt processing request received', 'INFO');
    
    // Process the receipt image
    const result = processReceipt(data.fileData, data.fileName, data.mimeType);
    
    // If successful, parse the description to structure the response
    if (result.success) {
      // Check if the image was not a receipt
      if (result.description.includes('**Status:** Bukan Nota') || 
          result.description.includes('tidak dapat memenuhi permintaan') ||
          result.description.includes('bukan nota/kuitansi/faktur')) {
        
        return {
          status: 'success',
          code: 200,
          data: {
            original: {
              fileUrl: result.fileUrl,
              fileName: data.fileName,
              mimeType: data.mimeType
            },
            analysis: {
              raw: result.description,
              parsed: {
                status: 'not_receipt',
                message: 'Gambar yang diberikan bukan merupakan nota/kuitansi/faktur',
                transaction_summary: '',
                details: [],
                total_amount: 0,
                store_name: '',
                transaction_date: ''
              }
            }
          }
        };
      } else {
        const parsedReceipt = parseReceiptDetails(result.description);
        
        return {
          status: 'success',
          code: 200,
          data: {
            original: {
              fileUrl: result.fileUrl,
              fileName: data.fileName,
              mimeType: data.mimeType
            },
            analysis: {
              raw: result.description,
              parsed: parsedReceipt
            }
          }
        };
      }
    } else {
      return {
        status: 'error',
        message: result.error,
        code: 500
      };
    }
  } catch (error) {
    logAction('API Error', `Error in processReceiptAPI: ${error.toString()}`, 'ERROR');
    return {
      status: 'error',
      message: error.toString(),
      code: 500
    };
  }
}

/**
 * Parse the raw receipt description into a structured format
 */
function parseReceiptDetails(rawDescription) {
  try {
    // Extract transaction details using regex
    const transactionMatch = rawDescription.match(/\*\*Transaksi:\*\* (.*?)(?=\n|$)/);
    const detailsMatch = rawDescription.match(/\*\*Detail:\*\*(.*?)(?=\*\*Total|$)/s);
    const totalMatch = rawDescription.match(/\*\*Total:\*\* (.*?)(?=\n|$)/);
    const storeMatch = rawDescription.match(/\*\*Toko:\*\* (.*?)(?=\n|$)/);
    const dateMatch = rawDescription.match(/\*\*Tanggal:\*\* (.*?)(?=\n|$)/);

    // Parse details
    let parsedDetails = [];
    if (detailsMatch && detailsMatch[1]) {
      const detailLines = detailsMatch[1].trim().split('\n');
      parsedDetails = detailLines.map(line => {
        // Improved regex to handle various formats of item details
        const itemMatch = line.match(/(\d+)x\s(.+?)\s-\s(?:Rp[\s.]*)?([\d.,]+)/i);
        if (itemMatch) {
          // Process price correctly by handling Indonesian number format
          let priceStr = itemMatch[3].trim();
          // Replace dots with nothing (for thousands separator) and commas with dots (for decimal)
          priceStr = priceStr.replace(/\./g, '').replace(/,/g, '.');
          // Make sure we interpret string as an integer if it has no decimal places
          const price = priceStr.includes('.') ? parseFloat(priceStr) : parseInt(priceStr, 10);
          
          return {
            quantity: parseInt(itemMatch[1], 10),
            name: itemMatch[2].trim(),
            price: price
          };
        }
        return null;
      }).filter(Boolean);
    }

    // Process total amount
    let totalAmount = 0;
    if (totalMatch && totalMatch[1]) {
      const totalStr = totalMatch[1].replace(/Rp\s*/i, '').trim();
      // Replace dots with nothing (for thousands separator) and commas with dots (for decimal)
      const processedTotal = totalStr.replace(/\./g, '').replace(/,/g, '.');
      totalAmount = processedTotal.includes('.') ? parseFloat(processedTotal) : parseInt(processedTotal, 10);
    }

    return {
      status: 'success',
      transaction_summary: transactionMatch ? transactionMatch[1].trim() : '',
      details: parsedDetails,
      total_amount: totalAmount,
      store_name: storeMatch ? storeMatch[1].trim() : '',
      transaction_date: dateMatch ? dateMatch[1].trim() : ''
    };
  } catch (error) {
    logAction('Parse Error', `Error parsing receipt details: ${error.toString()}`, 'ERROR');
    return {
      status: 'error',
      transaction_summary: rawDescription,
      details: [],
      total_amount: 0,
      store_name: '',
      transaction_date: ''
    };
  }
}

/**
 * Return API documentation in JSON format
 */
function getApiDocumentation() {
  const docs = {
    api_name: "Asisten Transaksi AI API",
    version: "1.0.0",
    description: "API for analyzing transaction receipts using Gemini AI",
    base_url: ScriptApp.getService().getUrl(),
    endpoints: [
      {
        path: "/",
        method: "GET",
        description: "API status check",
        parameters: {}
      },
      {
        path: "/",
        method: "POST",
        description: "Process a receipt image and extract transaction details",
        parameters: {
          action: {
            type: "string",
            required: true,
            description: "API action to perform",
            value: "process-receipt"
          }
        },
        body: {
          type: "application/x-www-form-urlencoded or application/json",
          required: true,
          schema: {
            fileData: {
              type: "string (base64)",
              required: true,
              description: "Base64 encoded receipt image data"
            },
            fileName: {
              type: "string",
              required: true,
              description: "Name of the file"
            },
            mimeType: {
              type: "string",
              required: true,
              description: "MIME type of the image (e.g., image/jpeg, image/png)"
            }
          }
        },
        responses: {
          "200": {
            description: "Successful operation",
            schema: {
              status: "success",
              code: 200,
              data: {
                original: {
                  fileUrl: "URL to the saved file in Google Drive",
                  fileName: "Name of the uploaded file"
                },
                analysis: {
                  raw: "Raw description from Gemini AI",
                  parsed: {
                    status: "success or not_receipt",
                    transaction_summary: "Summary of transaction",
                    details: [
                      {
                        quantity: "Number of items",
                        name: "Item name",
                        price: "Item price"
                      }
                    ],
                    total_amount: "Total transaction amount",
                    store_name: "Name of the store",
                    transaction_date: "Date of transaction"
                  }
                }
              }
            }
          },
          "400": {
            description: "Bad request",
            schema: {
              status: "error",
              message: "Error details",
              code: 400
            }
          },
          "500": {
            description: "Server error",
            schema: {
              status: "error",
              message: "Error details",
              code: 500
            }
          }
        }
      },
      {
        path: "/",
        method: "POST",
        description: "Get API documentation",
        parameters: {
          action: {
            type: "string",
            required: true,
            description: "API action to perform",
            value: "docs"
          }
        },
        responses: {
          "200": {
            description: "API documentation",
            schema: "This documentation object"
          }
        }
      }
    ],
    examples: {
      "process-receipt": {
        request: {
          method: "POST",
          url: ScriptApp.getService().getUrl(),
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: "action=process-receipt&fileData=base64_encoded_receipt_image&fileName=receipt.jpg&mimeType=image/jpeg"
        },
        response: {
          status: "success",
          code: 200,
          data: {
            original: {
              fileUrl: "https://drive.google.com/file/d/xxx/view",
              fileName: "receipt.jpg"
            },
            analysis: {
              raw: "**Transaksi:** Transaksi dengan 3 item\n\n**Detail:**\n1x Springbed - Rp 180.000\n1x Kursi kantor - Rp 30.000\n1x Trampor - Rp 20.000\n\n**Total:** Rp 230.000\n\n**Toko:** Jogja Clean\n\n**Tanggal:** 15 November 2024",
              parsed: {
                status: "success",
                transaction_summary: "Transaksi dengan 3 item",
                details: [
                  {
                    quantity: 1,
                    name: "Springbed",
                    price: 180000
                  },
                  {
                    quantity: 1,
                    name: "Kursi kantor",
                    price: 30000
                  },
                  {
                    quantity: 1,
                    name: "Trampor",
                    price: 20000
                  }
                ],
                total_amount: 230000,
                store_name: "Jogja Clean",
                transaction_date: "15 November 2024"
              }
            }
          }
        }
      }
    }
  };

  return docs;
}

/**
 * Process the uploaded receipt image and get description from Gemini AI
 */
function processReceipt(fileData, fileName, mimeType) {
  try {
    // Log the request
    logAction('Request', 'Receipt processing request received', 'INFO');
    
    // Save image to Drive
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
    const file = folder.createFile(blob);
    const fileId = file.getId();
    const fileUrl = file.getUrl();
    
    logAction('File Upload', `File saved to Drive: ${fileName}, ID: ${fileId}`, 'INFO');
    
    // Create request to Gemini API
    const requestBody = {
      contents: [
        {
          parts: [
            { text: PROMPT_TEMPLATE },
            { 
              inline_data: { 
                mime_type: mimeType, 
                data: fileData  // fileData sudah dalam bentuk base64
              } 
            }
          ]
        }
      ]
    };
    
    // Call Gemini API
    const response = callGeminiAPI(requestBody);
    
    // Check if the image is not a receipt
    if (response.includes('**Status:** Bukan Nota') || 
        response.includes('tidak dapat memenuhi permintaan') ||
        response.includes('bukan nota/kuitansi/faktur')) {
      
      logAction('Not Receipt', 'The uploaded image is not a receipt', 'INFO');
      
      // Save metadata to spreadsheet but mark as not a receipt
      const metadata = {
        timestamp: new Date().toISOString(),
        fileName: fileName,
        fileId: fileId,
        fileUrl: fileUrl,
        description: response,
        isReceipt: false
      };
      
      saveMetadata(metadata);
    } else {
      // Save transaction data to sheet
      const transactionData = parseReceiptDetails(response);
      saveTransactionToSheet(transactionData, fileName);
      
      // Save metadata to spreadsheet
      const metadata = {
        timestamp: new Date().toISOString(),
        fileName: fileName,
        fileId: fileId,
        fileUrl: fileUrl,
        description: response,
        isReceipt: true
      };
      
      saveMetadata(metadata);
    }
    
    logAction('Success', 'Image processed successfully', 'SUCCESS');
    
    return {
      success: true,
      description: response,
      fileUrl: fileUrl
    };
  } catch (error) {
    logAction('Error', `Error processing receipt: ${error.toString()}`, 'ERROR');
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Call Gemini API
 */
function callGeminiAPI(requestBody) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload:JSON.stringify(requestBody),
    muteHttpExceptions: true
  };
  
  logAction('API Call', 'Calling Gemini API', 'INFO');
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      const errorText = response.getContentText();
      logAction('API Error', `Error from Gemini API: ${errorText}`, 'ERROR');
      throw new Error(`API error: ${responseCode} - ${errorText}`);
    }
    
    const responseJson = JSON.parse(response.getContentText());
    
    if (!responseJson.candidates || responseJson.candidates.length === 0) {
      throw new Error('No response from Gemini AI');
    }
    
    // Extract text from response
    const text = responseJson.candidates[0].content.parts[0].text;
    return text;
  } catch (error) {
    logAction('API Error', `Error calling Gemini API: ${error.toString()}`, 'ERROR');
    throw error;
  }
}

/**
 * Save transaction data to transactions sheet
 */
function saveTransactionToSheet(transactionData, fileName) {
  try {
    // Skip saving if this is not a valid receipt transaction
    if (transactionData.status === 'not_receipt' || transactionData.status === 'error') {
      return false;
    }
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const transactionsSheet = spreadsheet.getSheetByName(TRANSACTIONS_SHEET_NAME) || spreadsheet.insertSheet(TRANSACTIONS_SHEET_NAME);
    
    // Create headers if the sheet is empty
    if (transactionsSheet.getLastRow() === 0) {
      transactionsSheet.appendRow([
        'Timestamp', 
        'File Name', 
        'Transaction Summary', 
        'Total Amount', 
        'Store Name', 
        'Transaction Date', 
        'Item Names', 
        'Item Quantities', 
        'Item Prices'
      ]);
    }
    
    // Prepare item details for consolidated storage
    const itemNames = transactionData.details.map(item => item.name).join(', ');
    const itemQuantities = transactionData.details.map(item => item.quantity).join(', ');
    const itemPrices = transactionData.details.map(item => item.price).join(', ');
    
    // Append transaction data
    transactionsSheet.appendRow([
      new Date().toISOString(),
      fileName,
      transactionData.transaction_summary || 'N/A',
      transactionData.total_amount || 0,
      transactionData.store_name || 'N/A',
      transactionData.transaction_date || 'N/A',
      itemNames,
      itemQuantities,
      itemPrices
    ]);
    
    return true;
  } catch (error) {
    logAction('Transactions Error', `Error saving transaction: ${error.toString()}`, 'ERROR');
    return false;
  }
}

/**
 * Log actions to spreadsheet
 */
function logAction(action, message, level) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = spreadsheet.getSheetByName(LOG_SHEET_NAME) || spreadsheet.insertSheet(LOG_SHEET_NAME);
    
    // Create headers if the sheet is empty
    if (logSheet.getLastRow() === 0) {
      logSheet.appendRow(['Timestamp', 'Action', 'Message', 'Level']);
    }
    
    logSheet.appendRow([new Date().toISOString(), action, message, level]);
  } catch (error) {
    console.error(`Error logging to spreadsheet: ${error.toString()}`);
  }
}

/**
 * Save metadata to spreadsheet
 */
function saveMetadata(metadata) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const metadataSheet = spreadsheet.getSheetByName(METADATA_SHEET_NAME) || spreadsheet.insertSheet(METADATA_SHEET_NAME);
    
    // Create headers if the sheet is empty
    if (metadataSheet.getLastRow() === 0) {
      metadataSheet.appendRow(['Timestamp', 'FileName', 'FileID', 'FileURL', 'Description', 'IsReceipt']);
    }
    
    metadataSheet.appendRow([
      metadata.timestamp,
      metadata.fileName,
      metadata.fileId,
      metadata.fileUrl,
      metadata.description,
      metadata.isReceipt ? 'Yes' : 'No'
    ]);
  } catch (error) {
    logAction('Metadata Error', `Error saving metadata: ${error.toString()}`, 'ERROR');
    throw error;
  }
}
