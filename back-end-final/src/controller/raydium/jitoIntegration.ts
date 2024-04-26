import fetch from 'node-fetch'; // or any other HTTP client you prefer
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config();

const BLOCK_ENGINE_URL = process.env.BLOCK_ENGINE_URL;
const SHRED_RECEIVER_ADDR = process.env.SHRED_RECEIVER_ADDR;
const RELAYER_URL = process.env.RELAYER_URL;

/**
 * Sends a tip to the Jito payment wallet.
 * @param {Keypair} sender - The sender's wallet.
 * @param {string} receiverAddress - The Jito payment wallet address.
 * @param {number} amount - The amount to send in SOL.
 * @param {Connection} connection - The Solana connection.
 */
export const sendTipToJito = async (sender, receiverAddress, amount, connection) => {
    // Convert SOL to lamports
    const lamports = amount * LAMPORTS_PER_SOL;

    // Construct the transaction details
    const transactionDetails = {
        // Add necessary transaction fields, this is just a placeholder
        from: sender.publicKey.toString(),
        to: receiverAddress,
        amount: lamports,
    };

    // Use the RELAYER_URL to send the transaction to Jito
    const response = await fetch(`${RELAYER_URL}/sendTip`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionDetails),
    });

    if (!response.ok) {
        throw new Error(`Failed to send tip: ${response.statusText}`);
    }

    return response.json();
};
