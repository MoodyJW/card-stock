import { Workbook } from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.join(__dirname);

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function createValidImport() {
  const wb = new Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.columns = [
    { header: 'Card Name', key: 'cardName' },
    { header: 'Set Name', key: 'setName' },
    { header: 'Condition', key: 'condition' },
    { header: 'Foil', key: 'foil' },
    { header: 'Purchase Price', key: 'purchasePrice' },
    { header: 'Selling Price', key: 'sellingPrice' },
  ];

  ws.addRows([
    { cardName: 'Pikachu', setName: 'Base Set', condition: 'Near Mint', foil: 'No', purchasePrice: 5.0, sellingPrice: 20.0 },
    { cardName: 'Charizard', setName: 'Base Set', condition: 'Moderately Played', foil: 'Yes', purchasePrice: 50.0, sellingPrice: 150.0 },
    { cardName: 'Mewtwo', setName: 'Jungle', condition: 'Lightly Played', foil: 'No', purchasePrice: 10.0, sellingPrice: 25.0 },
    { cardName: 'Alakazam', setName: 'Base Set', condition: 'Damaged', foil: 'Yes', purchasePrice: 2.0, sellingPrice: 5.0 },
    { cardName: 'Gengar', setName: 'Fossil', condition: 'Near Mint', foil: 'No', purchasePrice: 8.0, sellingPrice: 30.0 },
  ]);

  await wb.xlsx.writeFile(path.join(outDir, 'valid-import.xlsx'));
  console.log('Created valid-import.xlsx');
}

async function createMixedImport() {
  const wb = new Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.columns = [
    { header: 'Card Name', key: 'cardName' },
    { header: 'Set Name', key: 'setName' },
    { header: 'Condition', key: 'condition' },
    { header: 'Foil', key: 'foil' },
    { header: 'Purchase Price', key: 'purchasePrice' },
    { header: 'Selling Price', key: 'sellingPrice' },
  ];

  ws.addRows([
    { cardName: 'Valid 1', setName: 'Promo', condition: 'Near Mint', foil: 'No', purchasePrice: 1, sellingPrice: 2 },
    { cardName: 'Valid 2', setName: 'Promo', condition: 'Near Mint', foil: 'No', purchasePrice: 1, sellingPrice: 2 },
    { cardName: 'Valid 3', setName: 'Promo', condition: 'Near Mint', foil: 'No', purchasePrice: 1, sellingPrice: 2 },
    { cardName: 'Valid 4', setName: 'Promo', condition: 'Near Mint', foil: 'No', purchasePrice: 1, sellingPrice: 2 },
    { cardName: 'Valid 5', setName: 'Promo', condition: 'Near Mint', foil: 'No', purchasePrice: 1, sellingPrice: 2 },
    { cardName: 'Valid 6', setName: 'Promo', condition: 'Near Mint', foil: 'No', purchasePrice: 1, sellingPrice: 2 },
    { cardName: 'Valid 7', setName: 'Promo', condition: 'Near Mint', foil: 'No', purchasePrice: 1, sellingPrice: 2 },
    // Error 1: Missing Card Name
    { cardName: '', setName: 'Promo', condition: 'Near Mint', foil: 'No', purchasePrice: 1, sellingPrice: 2 },
    // Error 2: Invalid Condition
    { cardName: 'Invalid Cond', setName: 'Promo', condition: 'Super Mint', foil: 'No', purchasePrice: 1, sellingPrice: 2 },
    // Edge case 1: String price with $ and foil as lowercase "yes"
    { cardName: 'Edge Case', setName: 'Promo', condition: 'Lightly Played', foil: 'yes', purchasePrice: '$1.50', sellingPrice: '$3.50' },
  ]);

  await wb.xlsx.writeFile(path.join(outDir, 'mixed-import.xlsx'));
  console.log('Created mixed-import.xlsx');
}

async function createSimpleCsv() {
  const wb = new Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.columns = [
    { header: 'Card Name', key: 'cardName' },
    { header: 'Set Name', key: 'setName' },
    { header: 'Condition', key: 'condition' },
  ];

  ws.addRows([
    { cardName: 'Bulbasaur', setName: 'Base Set', condition: 'Near Mint' },
    { cardName: 'Ivysaur', setName: 'Base Set', condition: 'Lightly Played' },
    { cardName: 'Venusaur', setName: 'Base Set', condition: 'Moderately Played' },
  ]);

  await wb.csv.writeFile(path.join(outDir, 'simple-import.csv'));
  console.log('Created simple-import.csv');
}

async function run() {
  await createValidImport();
  await createMixedImport();
  await createSimpleCsv();
}

run().catch(console.error);
