"""
GLS Inventory - Upload to Google Sheets via rclone
Reads INVENTORY.xls, cleans data, uploads to Google Drive as a Google Sheet.
"""

import pandas as pd
import subprocess
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_FILE = os.path.join(SCRIPT_DIR, "INVENTORY.xls")
CLEAN_FILE = os.path.join(SCRIPT_DIR, "GLS_INVENTORY_CLEAN.xlsx")
GDRIVE_FOLDER = "gdrive:GLS-INVENTORY"

def clean_inventory(filepath):
    """Read and clean the inventory Excel file."""
    print(f"Reading {filepath}...")
    df = pd.read_excel(filepath)

    print(f"  Raw data: {len(df)} rows, {len(df.columns)} columns")
    print(f"  Columns: {list(df.columns)}")

    # Drop the empty 'Unnamed: 0' column
    if 'Unnamed: 0' in df.columns:
        df = df.drop(columns=['Unnamed: 0'])

    # Clean column names (strip trailing spaces)
    df.columns = df.columns.str.strip()

    # Skip row 0 if it's a summary row (check if Item Name is NaN)
    if pd.isna(df.iloc[0]['Item Name']):
        df = df.iloc[1:].reset_index(drop=True)
        print("  Skipped summary row 0")

    # Clean string columns
    str_cols = ['Item Name', 'KIND OF MEDICINE', 'Batch No', 'Company Name', 'Manufacturer Name', 'Location']
    for col in str_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()
            df[col] = df[col].replace('nan', '')

    # Also check for 'COMPANY' column (might have different name)
    if 'COMPANY' in df.columns and 'Company Name' not in df.columns:
        df['COMPANY'] = df['COMPANY'].astype(str).str.strip()
        df['COMPANY'] = df['COMPANY'].replace('nan', '')

    # Format Expiry Date
    df['Expiry Date'] = pd.to_datetime(df['Expiry Date'], errors='coerce').dt.strftime('%Y-%m-%d')
    df['Expiry Date'] = df['Expiry Date'].replace('NaT', '')

    # Ensure numeric columns
    for col in ['MRP', 'Landing Cost', 'Current Stock']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    # Convert Current Stock to integer
    if 'Current Stock' in df.columns:
        df['Current Stock'] = df['Current Stock'].astype(int)

    # Remove completely empty rows
    df = df.dropna(subset=['Item Name'], how='all')
    df = df[df['Item Name'] != '']

    # Add Sales Person, Sale Qty, and Sale Rate columns (empty for sales team to fill)
    df['Sales Person'] = ''
    df['Sale Qty'] = ''
    df['Sale Rate'] = ''

    print(f"  Cleaned data: {len(df)} rows")
    print(f"  Unique products: {df['Item Name'].nunique()}")
    print(f"  In-stock items: {(df['Current Stock'] > 0).sum()}")
    print(f"  Added columns: Sales Person, Sale Qty, Sale Rate")

    return df

def export_xlsx(df, filepath):
    """Export cleaned DataFrame to XLSX."""
    print(f"\nExporting to {filepath}...")
    df.to_excel(filepath, index=False, engine='openpyxl')
    size_kb = os.path.getsize(filepath) / 1024
    print(f"  File size: {size_kb:.1f} KB")

def upload_to_gdrive(filepath, gdrive_folder):
    """Upload XLSX to Google Drive, converting to Google Sheet format."""
    print(f"\nUploading to {gdrive_folder}...")

    cmd = [
        'rclone', 'copy',
        filepath,
        gdrive_folder,
        '--drive-import-formats', 'xlsx',
        '--drive-allow-import-name-change',
        '-v'
    ]

    print(f"  Command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode == 0:
        print("  Upload SUCCESS!")
        if result.stderr:
            # rclone prints progress to stderr
            for line in result.stderr.strip().split('\n'):
                if 'Transferred' in line or 'Copied' in line:
                    print(f"  {line.strip()}")
    else:
        print(f"  Upload FAILED! Return code: {result.returncode}")
        print(f"  Error: {result.stderr}")
        sys.exit(1)

def main():
    print("=" * 60)
    print("GLS INVENTORY - Upload to Google Sheets")
    print("=" * 60)

    # Step 1: Clean data
    df = clean_inventory(SOURCE_FILE)

    # Step 2: Export to XLSX
    export_xlsx(df, CLEAN_FILE)

    # Step 3: Upload to Google Drive
    upload_to_gdrive(CLEAN_FILE, GDRIVE_FOLDER)

    # Done!
    print("\n" + "=" * 60)
    print("DONE! Next steps:")
    print("=" * 60)
    print("""
1. Open Google Drive -> GLS-INVENTORY folder
2. Open the uploaded Google Sheet
3. Go to: File -> Share -> Publish to web
4. Select: Entire Document -> Comma-separated values (.csv)
5. Click 'Publish'
6. Copy the URL (looks like: https://docs.google.com/spreadsheets/d/e/XXXXX/pub?output=csv)
7. Paste that URL into index.html (SHEET_CSV_URL variable)
""")

if __name__ == '__main__':
    main()
