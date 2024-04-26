import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import bs58 from "bs58";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as dotenv from "dotenv";
dotenv.config();

import { Pnl, Backup } from "./models";
import { swap } from "./controller/raydium";
import WALLET_SECRET_KEY from "./config/wallet.json";
import { getTokenAccounts } from "./controller/getTokenAccounts";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

const app = express();
app.use(bodyParser.json());

const TRANSFER_GAS_FEE = 5000;
const TRADE_GAS_FEE = 5000;

const corsOpts = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "HEAD", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type"],
  exposedHeaders: ["Content-Type"],
};
app.use(cors(corsOpts));

// ==================global variable=========================
const WrapSOL = "So11111111111111111111111111111111111111112";
const durationTime = (time: number) => {
  // console.log(`waiting ${time} second.....`);
  return new Promise((resolve) => {
    setTimeout(resolve, time == 4 ? 15 * 1000 : time * 1000);
  });
};

// web3 connect
const connection = new Connection(
  String(process.env.QUICKNODE_URL),
  {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 10000
  }
);

app.get("/generate", async (req, res) => {
  const { wallet_amount } = req.query;
  console.log(wallet_amount);

  const insertWallet = async () => {
    var wallet = Keypair.generate();
    var private_key = bs58.encode(wallet.secretKey);
    var wallet_address = wallet.publicKey.toString();
    console.log("private_key=======>", private_key);
    console.log("wallet_address=======>", wallet_address);
    console.log("PNL=======>", Pnl);
    const wallets = await Pnl.create({
      wallet_address: wallet_address,
      private_key: private_key,
    });
    const backup_wallets = await Backup.create({
      wallet_address: wallet_address,
      private_key: private_key,
    });
  };

  for (let index = 0; index < Number(wallet_amount); index++) {
    await insertWallet();
  }
  await durationTime(Number(wallet_amount) >= 1000 ? 6 : 2);
  res.send("Generated done!");
});

async function lazySendAndConfirmTransaction(connection: Connection, from: PublicKey, to: PublicKey, amount: number, index: number, signer: Keypair, intervalSeconds: number, retry: number): Promise<boolean> {
  let confirmed = false;
  let totalCount = intervalSeconds * retry;
  let listener: number | undefined = undefined;

  await durationTime(index * 0.3)

  for(let count = 0; count < totalCount && !confirmed; count++){
    if(count % intervalSeconds == 0) {
      try{
        if(listener !== undefined) await connection.removeSignatureListener(listener);
        const tx = new Transaction();
        tx.add(
          SystemProgram.transfer({
            fromPubkey: from,
            toPubkey: to,
            lamports: amount,
          })
        );
        const signature = await connection.sendTransaction(tx, [signer]);
        const startTime = Date.now() / 1000;
        console.log(signature, count);
        listener = connection.onSignature(signature, async (signatureResult, context) => {
          if(signatureResult.err === null) {
            console.log(from.toBase58(), to.toBase58(), amount, signature, Date.now() / 1000 - startTime);
            confirmed = true;
          }
        })
      } catch(err) {
        console.log(err)
      }
    }

    await durationTime(1);
  }

  if(listener !== undefined && !confirmed) await connection.removeSignatureListener(listener);
  return confirmed;
}

async function lazyTradeAndConfirmTransaction(connection: Connection, token: string, minAmount: number, maxAmount: number, index: number, wallet: Keypair, isBuy: boolean, intervalSeconds: number, retry: number): Promise<boolean> {
  let confirmed = false;
  let totalCount = intervalSeconds * retry;
  let listener: number | undefined = undefined;

  await durationTime(index * 0.3)


  for(let count = 0; count < totalCount && !confirmed; count++){
    if(count % intervalSeconds == 0) {
      try{
        if(listener !== undefined) await connection.removeSignatureListener(listener);

        let signature: string | undefined = undefined;
        let amount: number;

        if(isBuy) {
          const balanceInLamports = await connection.getBalance(wallet.publicKey);
          const randomAmount = Math.random() * (maxAmount - minAmount) + Number(minAmount);
          const inAmount = Number(randomAmount.toFixed(3));
    
          console.log("input value========>", inAmount);
          console.log("Wallet SOL=========>", balanceInLamports);
    
          if(inAmount + 2 * TRADE_GAS_FEE <= balanceInLamports) {
            signature = await swap(WrapSOL, token, inAmount, index);
            amount = inAmount;
          } else {
            return false;
          }
        } else {
          const balanceInLamports = await connection.getBalance(wallet.publicKey);
          const tokenAmount = await getTokenAccounts(
            wallet.publicKey.toBase58(),
            connection,
            token
          );
          console.log(tokenAmount, balanceInLamports)

          if(tokenAmount > 0 && balanceInLamports >= TRADE_GAS_FEE) {
            amount = tokenAmount;
            signature = await swap(token, WrapSOL, tokenAmount, index);
          }else {
            return false;
          }
        }
        
        const startTime = Date.now() / 1000;
        console.log(signature, count);
        if(signature) {
          listener = connection.onSignature(signature, async (signatureResult, context) => {
            if(signatureResult.err === null) {
              console.log(wallet.publicKey.toBase58(), amount, isBuy ? "buy": "sell", signature, Date.now() / 1000 - startTime);
              confirmed = true;
            }
          })
        }
      } catch(err) {
        console.log(err)
      }
    }

    await durationTime(1);
  }

  if(listener !== undefined && !confirmed) await connection.removeSignatureListener(listener);
  return confirmed;
}

app.get("/transfer", async (req, res) => {
  // let { walletAmount, sol_amount, wallet_unit, sleepTime } = req.query;
  const sol_amount = Number(req.query.sol_amount);
  const wallet_unit = Number(req.query.wallet_unit);
  const sleepTime = Number(req.query.sleepTime);

  let from = Keypair.fromSecretKey(
    bs58.decode(WALLET_SECRET_KEY[0].secret_key)
  );
  console.log(from.publicKey);
  const wallets = await Pnl.findAll({ attributes: ["wallet_address"] });
  const balanceInLamports = await connection.getBalance(from.publicKey);
  console.log("balanceInLamports", balanceInLamports);
  const lamports_amount = sol_amount * LAMPORTS_PER_SOL;
  

  if(wallet_unit > wallets.length) {
    res.status(400).send("please generate sufficient PNL wallets");
    return;
  }
  if(balanceInLamports < (lamports_amount + TRANSFER_GAS_FEE) * wallet_unit) {
    res.status(400).send(`Wallet ${balanceInLamports / LAMPORTS_PER_SOL} SOL is insufficient!`)
    return;
  }

  const lazyFuncs: Array<any> = []
  for(let i = 0; i < wallet_unit; i++) {
    const func = lazySendAndConfirmTransaction(connection, from.publicKey, new PublicKey(wallets[i].dataValues.wallet_address), LAMPORTS_PER_SOL * sol_amount, i, from, 60, 3) 
    lazyFuncs.push(func)
      // try {
      //   const tx = new Transaction();
      //   console.log("Start");
      //   // tx.add(
      //   //   ComputeBudgetProgram.setComputeUnitPrice({
      //   //     microLamports: 0.001 * LAMPORTS_PER_SOL,
      //   //   })
      //   // );
      //   tx.add(
      //     SystemProgram.transfer({
      //       fromPubkey: from.publicKey,
      //       toPubkey: new PublicKey(wallets[i].dataValues.wallet_address),
      //       lamports: LAMPORTS_PER_SOL * sol_amount,
      //     })
      //   );

      //   const signature = await connection.sendTransaction(tx, [from]);
      //   startTime[signature] = Date.now() / 1000;
      //   console.log(signature, startTime[signature])
      //   connection.onSignature(signature, (signatureResult, context) => {
      //     endTime[signature] = Date.now() / 1000;
      //     console.log(startTime[signature], endTime[signature] , endTime[signature] - startTime[signature])
      //     console.log(signature, signatureResult)
      //   }, "processed")

      //   setTimeout(async() => {
      //     if(endTime[signature] === undefined) {
      //       const tx = new Transaction();
      //       console.log("Resend");
      //       // tx.add(
      //       //   ComputeBudgetProgram.setComputeUnitPrice({
      //       //     microLamports: 0.001 * LAMPORTS_PER_SOL,
      //       //   })
      //       // );
      //       tx.add(
      //         SystemProgram.transfer({
      //           fromPubkey: from.publicKey,
      //           toPubkey: new PublicKey(wallets[i].dataValues.wallet_address),
      //           lamports: LAMPORTS_PER_SOL * sol_amount,
      //         })
      //       );

      //       const _signature = await connection.sendTransaction(tx, [from]);
      //       console.log(_signature)
      //     }
      //   }, 60000)
        
      //   // await durationTime(sleepTime);
      //   console.log("Trasnsfer is done", wallets[i].dataValues.wallet_address);
      // } catch (error) {
      //   console.log(error);
      //   console.log("here");
      // }
      // await durationTime(sleepTime);
  }
  await Promise.all(lazyFuncs)
  res.json("Transferred!")

});

app.get("/gather", async (req, res) => {
  const { walletAmount, wallet_unit } = req.query;
  const wallets = await Pnl.findAll({ attributes: ["private_key"] });
  const to = Keypair.fromSecretKey(bs58.decode(WALLET_SECRET_KEY[0].secret_key));
  const units = Number(wallet_unit)

  const lazyFuncs: Array<any> = []

  for(let i = 0; i < units; i ++) {
    const from = Keypair.fromSecretKey(
      bs58.decode(wallets[i].dataValues.private_key)
    );
    const balanceInLamports = await connection.getBalance(from.publicKey);

    console.log("pnl wallet:", from.publicKey.toBase58());
    console.log("balanceInLamports: ", balanceInLamports);
    if(balanceInLamports > TRANSFER_GAS_FEE) {
      const amount = balanceInLamports - TRANSFER_GAS_FEE;
      const func = lazySendAndConfirmTransaction(connection, from.publicKey, to.publicKey, amount, i, from, 60, 3) 
      lazyFuncs.push(func)
    } 
  }

  await Promise.all(lazyFuncs)
  res.json("Gather is done");
});

app.get("/start", async (req, res) => {
  const { tokenaddress, maxVal, minVal, timestamp, walletUnit } = req.query;
  const units = Number(walletUnit);

  console.log(units)
  const wallets = await Pnl.findAll({ attributes: ["private_key"] });
  // console.log("loops: ", loops);
  const inputAmount = {
    max: maxVal,
    min: minVal,
  };

  // input address is SOL address
  const input = WrapSOL;
  const output = tokenaddress;
  const onebuy = async (idx: number, to: number) => {
    console.log("========================buy======================");
    const wallet_secret_key = wallets[idx].dataValues.private_key;
    const wallet = Keypair.fromSecretKey(bs58.decode(wallet_secret_key));
    let balanceInLamports: any;
    try {
      balanceInLamports = await connection.getBalance(wallet.publicKey);
    } catch (error) {
      console.log(error);
      await durationTime(3);
      if (idx + 1 <= Number(to)) await onebuy(idx + 1, to);
      else {
        console.log(
          `=================${units} count finished to buy=================`
        );
      }
    }

    const wallet_SOL = balanceInLamports / LAMPORTS_PER_SOL;

    const randomNumber =
      Math.random() * (Number(inputAmount.max) - Number(inputAmount.min)) +
      Number(inputAmount.min);
    const inAmount = Number(randomNumber.toFixed(3)) - 0.0015;
    console.log("input value========>", randomNumber.toFixed(3));
    console.log("Wallet SOL=========>", wallet_SOL);
    if (wallet_SOL < Number(inAmount)) {
      console.log("wallet's amount is lower than input amount");
      if (idx + 1 > Number(to)) {
        console.log(
          `=================${units} count finished to buy=================`
        );
        // return;
      } else {
        await durationTime(1);
        await onebuy(idx + 1, to);
      }
    } else {
      console.log(`${idx + 1} transaction`);
      try {
        await swap(input, String(output), Number(inAmount), idx);
      } catch (err) {
        console.log("Buy is failed");
      }
      // condition--
      if (idx + 1 > Number(to)) {
        console.log(
          `=================${units} count finished to buy=================`
        );
        // return;
      } else {
        await durationTime(1);
        await onebuy(idx + 1, to);
      }
    }
  };
  const onesell = async (idx: number, to: number) => {
    const { tokenaddress, timestamp, walletUnit, walletAmount } = req.query;
    console.log("========================sell======================");
    // output address is SOL address
    let input = tokenaddress;
    let output = WrapSOL;
    const wallets = await Pnl.findAll({ attributes: ["private_key"] });

    const wallet = Keypair.fromSecretKey(
      bs58.decode(wallets[idx].dataValues.private_key)
    );
    const wallet_address = wallet.publicKey.toString();
    const tokenAmount = await getTokenAccounts(
      wallet_address,
      connection,
      String(tokenaddress)
    );

    let InAmount = Number(tokenAmount).toFixed();
    console.log("InAmount===========>", Number(InAmount) - 1);
    if (tokenAmount < 0) {
      console.log("wallet's token amount is no");
      if (idx + 1 > Number(to)) {
        console.log(
          `=================${units} count finished to sell=================`
        );
      } else {
        await durationTime(2);
        await onesell(idx + 1, to);
      }
    } else {
      try {
        await swap(String(input), String(output), Number(InAmount) - 1, idx);
      } catch (err) {
        console.log("Sell is failed");
      }
      // condition--
      if (idx + 1 > Number(to)) {
        console.log(
          `=================${units} count finished to sell=================`
        );
      } else {
        await durationTime(2);
        await onesell(idx + 1, to);
      }
    }
  };
  const buy = async (wallets, walletUint, minAmount, maxAmount, token) => {
    const lazyFuncs: Array<any> = []

    for(let i = 0; i < walletUint; i ++) {
      const wallet = Keypair.fromSecretKey(
        bs58.decode(wallets[i].dataValues.private_key)
      );
      const func = lazyTradeAndConfirmTransaction(connection, token, minAmount, maxAmount, i, wallet, true, 60, 30) 
      lazyFuncs.push(func)
    }

    await Promise.all(lazyFuncs)
    // for(let i = 0; i < walletUint; i++) {
      // console.log("========================buy======================");
      // const wallet_secret_key = wallets[i].dataValues.private_key;
      // const wallet = Keypair.fromSecretKey(bs58.decode(wallet_secret_key));
      // const balanceInLamports = await connection.getBalance(wallet.publicKey);
      // const randomAmount = Math.random() * (maxAmount - minAmount) + Number(minAmount);
      // const inAmount = Number(randomAmount.toFixed(3));

      // console.log("input value========>", inAmount);
      // console.log("Wallet SOL=========>", balanceInLamports);

      // if(inAmount + 2 * TRADE_GAS_FEE <= balanceInLamports) {
      //   const signature = await swap(WrapSOL, token, inAmount, i);
      // }else {
      //   console.log("error")
      // }
    // }
  };
  const sell = async (wallets, walletUint, token) => {
    const lazyFuncs: Array<any> = []

    for(let i = 0; i < walletUint; i ++) {
      const wallet = Keypair.fromSecretKey(
        bs58.decode(wallets[i].dataValues.private_key)
      );
      const func = lazyTradeAndConfirmTransaction(connection, token, 0, 0, i, wallet, false, 60, 30) 
      lazyFuncs.push(func)
    }

    await Promise.all(lazyFuncs)
    // for(let i = 0; i < walletUint; i++) {
    //   console.log("========================sell======================");
    //   const wallet_secret_key = wallets[i].dataValues.private_key;
    //   const wallet = Keypair.fromSecretKey(bs58.decode(wallet_secret_key));
    //   const balanceInLamports = await connection.getBalance(wallet.publicKey);
    //   const tokenAmount = await getTokenAccounts(
    //     wallet.publicKey.toBase58(),
    //     connection,
    //     token
    //   );

      
    //   if(tokenAmount > 0 && balanceInLamports >= TRADE_GAS_FEE) {
    //     await swap(token, WrapSOL, tokenAmount, i);
    //     await durationTime(20);
    //   }else {
    //     console.log("error")
    //   }
    // }
  };
  // const gatherSOL = async (index: any) => {
  //   console.log("index===", index);
  //   let balanceInLamports: any;
  //   let from: any;
  //   let to: any;
  //   let fee = 0.001;
  //   try {
  //     from = Keypair.fromSecretKey(
  //       bs58.decode(wallets[index].dataValues.private_key)
  //     );

  //     to = Keypair.fromSecretKey(bs58.decode(WALLET_SECRET_KEY[0].secret_key));
  //     balanceInLamports = await connection.getBalance(from.publicKey);
  //   } catch (error) {
  //     console.log(error);
  //     await durationTime(3);
  //     if (index + 1 < Number(wallets.length)) await gatherSOL(index + 1);
  //     else {
  //       console.log("========finished===========");
  //     }
  //   }

  //   console.log("balanceInLamports: ", balanceInLamports);
  //   const wallet_SOL = balanceInLamports / LAMPORTS_PER_SOL;
  //   const amount = wallet_SOL - fee - 0.001;
  //   console.log("wallet_SOL: ", wallet_SOL);
  //   if (fee > wallet_SOL) {
  //     console.log(`${index + 1} of wallet_SOL is small`);
  //     if (index + 1 == Number(wallets.length)) {
  //       console.log("========finished===========");
  //     } else {
  //       await gatherSOL(index + 1);
  //     }
  //   } else {
  //     try {
  //       var tx = new Transaction();
  //       tx.add(
  //         ComputeBudgetProgram.setComputeUnitPrice({
  //           microLamports: 0.001 * LAMPORTS_PER_SOL,
  //         })
  //       );
  //       tx.add(
  //         SystemProgram.transfer({
  //           fromPubkey: from.publicKey,
  //           toPubkey: to.publicKey,
  //           lamports: LAMPORTS_PER_SOL * Number(amount.toFixed(3)),
  //         })
  //       );
  //       await connection.sendTransaction(tx, [from]);
  //       console.log("Trasnsfer is done");
  //     } catch (error) {
  //       console.log(error);
  //     }

  //     // condition--
  //     if (index + 1 == Number(wallets.length)) {
  //       console.log("========finished===========");
  //     } else {
  //       await gatherSOL(index + 1);
  //     }
  //   }
  // };
  // const start = async (index: any) => {
  //   await buy(index);
  //   await durationTime(4);
  //   await sell(index);
  //   if (index + 1 == loops) {
  //     console.log("==================finished=======================");
  //     console.log("Start gathering after a few sec...");
  //     await durationTime(2);
  //     await gatherSOL(0);
  //   } else {
  //     await start(index + 1);
  //   }
  // };
  // await start(0);
  const minAmount = Number(minVal);
  const maxAmount = Number(maxVal);

  console.log("=========== buy =============")
  await buy(wallets, units, minAmount, maxAmount, tokenaddress);
  // await durationTime(10000);
  console.log("=========== sell =============")
  await sell(wallets, units, tokenaddress)
  
  res.json("buy/sell is done");
});

app.get("/buy", async (req, res) => {
  const { tokenaddress, maxVal, minVal, timestamp, walletUnit, walletAmount } =
    req.query;

  const inputAmount = {
    max: maxVal,
    min: minVal,
  };

  // input address is SOL address
  const input = WrapSOL;
  const output = tokenaddress;
  const wallets = await Pnl.findAll({ attributes: ["private_key"] });

  const Buy = async (index: any) => {
    const wallet_secret_key = wallets[index].dataValues.private_key;
    const wallet = Keypair.fromSecretKey(bs58.decode(wallet_secret_key));
    const balanceInLamports = await connection.getBalance(wallet.publicKey);
    const wallet_SOL = balanceInLamports / LAMPORTS_PER_SOL;

    const randomNumber =
      Math.random() * (Number(inputAmount.max) - Number(inputAmount.min)) +
      Number(inputAmount.min);
    const inAmount = randomNumber.toFixed(3);
    console.log("input value========>", randomNumber.toFixed(3));
    console.log("Wallet SOL=========>", wallet_SOL);
    if (wallet_SOL < Number(inAmount)) {
      console.log("wallet's amount is low than input amount");
      Buy(index + 1);
      return;
    } else {
      console.log(`${index + 1} transaction`);
      try {
        await swap(input, String(output), Number(inAmount), index);
      } catch (err) {
        console.log("Buy is failed");
      }
      // condition--
      if (index + 1 == Number(wallets.length)) {
        console.log("=================finished=================");
        return;
      } else {
        if ((index + 1) % Number(walletUnit) == 0) {
          await durationTime(Number(timestamp));
          console.log("=================unit finished=================");
        }
        await Buy(index + 1);
      }
    }
  };

  await Buy(wallets.length - Number(walletAmount));

  res.json("Buy is done");
});

app.get("/sell", async (req, res) => {
  const { tokenaddress, timestamp, walletUnit, walletAmount } = req.query;

  // output address is SOL address
  let input = tokenaddress;
  let output = WrapSOL;
  const wallets = await Pnl.findAll({ attributes: ["private_key"] });

  const Sell = async (index: number) => {
    const wallet = Keypair.fromSecretKey(
      bs58.decode(wallets[index].dataValues.private_key)
    );
    const wallet_address = wallet.publicKey.toString();
    const tokenAmount = await getTokenAccounts(
      wallet_address,
      connection,
      String(tokenaddress)
    );

    console.log("tokenAmount", tokenAmount);

    let InAmount = Number(tokenAmount).toFixed();
    console.log("InAmount===========>", Number(InAmount) - 1);
    if (tokenAmount < 0) {
      console.log("wallet's token amount is no");
      Sell(index + 1);
    } else {
      try {
        await swap(String(input), String(output), Number(InAmount) - 1, index);
      } catch (err) {
        console.log("Sell is failed");
      }
      // condition--
      if (index + 1 == Number(wallets.length)) {
        console.log("=================finished=================");
        return;
      } else {
        if ((index + 1) % Number(walletUnit) == 0) {
          await durationTime(Number(timestamp));
          console.log("=================unit finished=================");
        }
        await Sell(index + 1);
      }
    }
  };
  await Sell(0);

  res.json("Sell clear is done");
});

app.get("/remove", async (req, res) => {
  await Pnl.truncate();
  res.json("removed");
});

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

module.exports = app;
