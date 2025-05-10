const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const SOL_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOLANA_WALLET = 'SOL_WALLET';

const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

const CMC_API_KEY = 'CMCAPIKEY';
const ETHERSCAN_API_KEY = 'ETHERSCANAPIKEY';
const USDC_CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WALLET_ADDRESS = 'YOUR_WALLET';

// File path for storing net worth history
const NET_WORTH_DATA_FILE = path.join(__dirname, 'net_worth_history.json');

// Initialize net worth history file if it doesn't exist
if (!fs.existsSync(NET_WORTH_DATA_FILE)) {
  fs.writeFileSync(NET_WORTH_DATA_FILE, JSON.stringify([]));
}

// Parse JSON body
app.use(express.json());

// Function to save net worth data
function saveNetWorthData(netWorth) {
  try {
    // Read existing data
    const existingData = JSON.parse(fs.readFileSync(NET_WORTH_DATA_FILE, 'utf8'));
    
    // Add new entry
    const newEntry = {
      timestamp: new Date().toISOString(),
      netWorth: netWorth
    };
    
    existingData.push(newEntry);
    
    // Keep only last 365 days of data
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const filteredData = existingData.filter(entry => 
      new Date(entry.timestamp) > oneYearAgo
    );
    
    // Save to file
    fs.writeFileSync(NET_WORTH_DATA_FILE, JSON.stringify(filteredData));
    return filteredData;
  } catch (error) {
    console.error('Error saving net worth data:', error);
    return [];
  }
}

// CoinMarketCap Prices
app.get('/api/prices', async (req, res) => {
  try {
    const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
      params: {
        symbol: 'ETH,BTC,SOL',
      },
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('CMC fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// Etherscan USDC Balance
app.get('/api/usdc-balance', async (req, res) => {
  try {
    const url = `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${USDC_CONTRACT}&address=${WALLET_ADDRESS}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;

    const response = await axios.get(url);
    const rawBalance = response.data.result;
    const usdcBalance = Number(rawBalance) / 1e6;

    res.json({ balance: usdcBalance });
  } catch (error) {
    console.error('USDC fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch USDC balance' });
  }
});

// GET USDC ON SOL
app.get('/api/solana-usdc-balance', async (req, res) => {
  try {
    const connection = new Connection(SOLANA_RPC);
    const walletAddress = new PublicKey(SOLANA_WALLET);
    const mintAddress = new PublicKey(SOL_USDC_MINT);

    const ata = await getAssociatedTokenAddress(mintAddress, walletAddress);

    const accountInfo = await getAccount(connection, ata);
    const balance = Number(accountInfo.amount) / 1e6;

    res.json({ usdc_balance: balance });
  } catch (error) {
    console.error('Solana USDC fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch Solana USDC balance' });
  }
});

// Save net worth snapshot
app.post('/api/save-networth', (req, res) => {
  try {
    const { netWorth } = req.body;
    
    if (typeof netWorth !== 'number') {
      return res.status(400).json({ error: 'Invalid net worth value' });
    }
    
    const data = saveNetWorthData(netWorth);
    res.json({ message: 'Net worth saved successfully', data });
  } catch (error) {
    console.error('Error saving net worth:', error);
    res.status(500).json({ error: 'Failed to save net worth' });
  }
});

// Get net worth history
app.get('/api/networth-history', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(NET_WORTH_DATA_FILE, 'utf8'));
    res.json(data);
  } catch (error) {
    console.error('Error reading net worth history:', error);
    res.status(500).json({ error: 'Failed to fetch net worth history' });
  }
});

app.use(express.static(__dirname));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/main.html`);
});