// ============================================================
// GLS INVENTORY - Google Apps Script (Web API)
// ============================================================
// HOW TO SET UP:
// 1. Open your Google Sheet (GLS_INVENTORY_CLEAN) in Google Drive
// 2. Go to: Extensions -> Apps Script
// 3. Delete any existing code in Code.gs
// 4. Paste THIS ENTIRE FILE into Code.gs
// 5. Click Save (Ctrl+S)
// 6. Click "Deploy" -> "New Deployment"
// 7. Select Type: "Web app"
// 8. Set "Execute as": Me
// 9. Set "Who has access": Anyone
// 10. Click "Deploy"
// 11. Copy the Web App URL
// 12. Paste that URL in index.html (APPS_SCRIPT_URL variable)
//
// NOTE: A "Sales" sheet tab will be auto-created on first use.
// All individual sale records are stored there (one row per sale).
// ============================================================

// Handle GET requests
function doGet(e) {
  return handleRequest(e);
}

// Handle POST requests
function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var params = e.parameter;
  var action = params.action;

  try {
    if (action === 'recordSale') {
      return recordSale(params);
    } else if (action === 'getSales') {
      return getSales();
    } else if (action === 'getProducts') {
      return getProducts();
    } else {
      return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
//  SALES SHEET HELPER
// ============================================================
function getSalesSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Sales');
  if (!sheet) {
    sheet = ss.insertSheet('Sales');
    sheet.appendRow(['Timestamp', 'Item Name', 'Batch No', 'Sales Person', 'Sale Qty', 'Sale Rate', 'Remark']);
    sheet.setFrozenRows(1);
    // Bold header
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  }
  return sheet;
}

// ============================================================
//  RECORD SALE — appends a new row to the "Sales" sheet
// ============================================================
function recordSale(params) {
  var itemName = params.itemName;
  var batchNo = params.batchNo || '';
  var salesPerson = params.salesPerson;
  var saleQty = parseInt(params.saleQty) || 0;
  var saleRate = parseFloat(params.saleRate) || 0;
  var remark = params.remark || '';
  var timestamp = params.timestamp || new Date().toISOString();

  if (!itemName || !salesPerson || saleQty <= 0) {
    return jsonResponse({ success: false, error: 'Missing required fields: itemName, salesPerson, saleQty' });
  }

  var sheet = getSalesSheet();
  sheet.appendRow([timestamp, itemName, batchNo, salesPerson, saleQty, saleRate, remark]);

  return jsonResponse({
    success: true,
    message: 'Sale recorded: ' + saleQty + ' units of ' + itemName + ' (Batch: ' + batchNo + ') by ' + salesPerson,
    timestamp: timestamp
  });
}

// ============================================================
//  GET ALL SALES — returns all rows from the "Sales" sheet
// ============================================================
function getSales() {
  var sheet = getSalesSheet();
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return jsonResponse({ success: true, sales: [] });
  }

  var sales = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var qty = parseInt(row[4]) || 0;
    if (qty <= 0) continue; // skip invalid rows
    sales.push({
      timestamp: String(row[0] || ''),
      itemName: String(row[1] || '').trim(),
      batchNo: String(row[2] || '').trim(),
      salesPerson: String(row[3] || '').trim(),
      saleQty: qty,
      saleRate: parseFloat(row[5]) || 0,
      remark: String(row[6] || '').trim()
    });
  }

  return jsonResponse({ success: true, sales: sales });
}

// ============================================================
//  GET PRODUCTS — from the inventory sheet (for reference)
// ============================================================
function getProducts() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var colItemName = headers.indexOf('Item Name');
  var colBatchNo = headers.indexOf('Batch No');
  var colCurrentStock = headers.indexOf('Current Stock');

  var products = {};

  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][colItemName]).trim();
    var batch = String(data[i][colBatchNo]).trim();
    var stock = parseInt(data[i][colCurrentStock]) || 0;

    if (name && stock > 0) {
      if (!products[name]) {
        products[name] = [];
      }
      products[name].push({ batch: batch, stock: stock });
    }
  }

  return jsonResponse({ success: true, products: products });
}

// ============================================================
//  UTILITY
// ============================================================
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
