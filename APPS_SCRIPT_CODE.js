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
// ============================================================

// Handle GET requests (for reading data)
function doGet(e) {
  return handleRequest(e);
}

// Handle POST requests (for writing data)
function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var params = e.parameter;
  var action = params.action;

  try {
    if (action === 'recordSale') {
      return recordSale(params);
    } else if (action === 'getProducts') {
      return getProducts();
    } else {
      return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// Record a sale - updates Sales Person, Sale Qty & Sale Rate for a specific row
function recordSale(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  // Find column indexes
  var colItemName = headers.indexOf('Item Name');
  var colBatchNo = headers.indexOf('Batch No');
  var colSalesPerson = headers.indexOf('Sales Person');
  var colSaleQty = headers.indexOf('Sale Qty');
  var colSaleRate = headers.indexOf('Sale Rate');

  if (colSalesPerson === -1 || colSaleQty === -1) {
    return jsonResponse({ success: false, error: 'Sales Person or Sale Qty column not found in sheet' });
  }

  var itemName = params.itemName;
  var batchNo = params.batchNo;
  var salesPerson = params.salesPerson;
  var saleQty = parseInt(params.saleQty) || 0;
  var saleRate = parseFloat(params.saleRate) || 0;

  if (!itemName || !salesPerson || saleQty <= 0) {
    return jsonResponse({ success: false, error: 'Missing required fields: itemName, salesPerson, saleQty' });
  }

  // Find the matching row
  var updated = false;
  for (var i = 1; i < data.length; i++) {
    var rowItemName = String(data[i][colItemName]).trim();
    var rowBatchNo = String(data[i][colBatchNo]).trim();

    if (rowItemName === itemName && rowBatchNo === batchNo) {
      // Get existing sale qty and add new sale
      var existingQty = parseInt(data[i][colSaleQty]) || 0;
      var existingSP = String(data[i][colSalesPerson] || '').trim();
      var existingRate = parseFloat(data[i][colSaleRate]) || 0;

      var newQty = existingQty + saleQty;

      // Calculate weighted average sale rate
      var newRate;
      if (existingQty > 0 && existingRate > 0) {
        // Weighted average: (oldQty*oldRate + newQty*newRate) / totalQty
        newRate = ((existingQty * existingRate) + (saleQty * saleRate)) / newQty;
        newRate = Math.round(newRate * 100) / 100; // Round to 2 decimals
      } else {
        newRate = saleRate;
      }

      // Append sales person name if different
      var newSP;
      if (!existingSP || existingSP === '') {
        newSP = salesPerson;
      } else if (existingSP.toUpperCase().indexOf(salesPerson.toUpperCase()) >= 0) {
        newSP = existingSP; // already there
      } else {
        newSP = existingSP + ', ' + salesPerson;
      }

      // Update the cells (row i+1 because sheet is 1-indexed)
      sheet.getRange(i + 1, colSalesPerson + 1).setValue(newSP);
      sheet.getRange(i + 1, colSaleQty + 1).setValue(newQty);
      if (colSaleRate !== -1) {
        sheet.getRange(i + 1, colSaleRate + 1).setValue(newRate);
      }
      updated = true;
      break;
    }
  }

  if (updated) {
    return jsonResponse({
      success: true,
      message: 'Sale recorded: ' + saleQty + ' units of ' + itemName + ' (Batch: ' + batchNo + ') @ ₹' + saleRate + ' by ' + salesPerson
    });
  } else {
    return jsonResponse({
      success: false,
      error: 'Product not found: ' + itemName + ' (Batch: ' + batchNo + ')'
    });
  }
}

// Get unique product list with batches (for the form dropdown)
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

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
