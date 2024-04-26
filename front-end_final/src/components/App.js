import "./App.css";
import Nav from "./Nav/Nav";
import Auto from "./Auto/Auto";
import Token from "./Token/Token";
import WalletAmounts from "./WalletAmounts/WalletAmounts";
import Transfer from "./Transfer/Transfer";
import "bootstrap/dist/css/bootstrap.min.css";
import { Alert } from "./Toast/Toast";
import { useState } from "react";

function App() {
  const [tokenaddress, setTokenAddress] = useState(
    "HLptm5e6rTgh4EKgDpYFrnRHbjpkMyVdEeREEa2G7rf9"
  );
  const [walletAmount, setWalletAmount] = useState(100);
  const [solAmount, setSolAmount] = useState(3);
  const [walletUnit, setWalletUnit] = useState(10);
  const [sleepTime, setSleepTime] = useState(10);
  const [isRootTransfer, setIsRootTransfer] = useState(false);
  const [isRootSwap, setIsRootSwap] = useState(false);

  return (
    <div className="App">
      <Nav />
      <div className="main">
        <WalletAmounts
          walletAmount={walletAmount}
          setWalletAmount={setWalletAmount}
          isRootTransfer={isRootTransfer}
          setIsRootTransfer={setIsRootTransfer}
          isRootSwap={isRootSwap}
          setIsRootSwap={setIsRootSwap}
        />
        <Transfer
          solAmount={solAmount}
          setSolAmount={setSolAmount}
          walletUnit={walletUnit}
          setWalletUnit={setWalletUnit}
          sleepTime={sleepTime}
          setSleepTime={setSleepTime}
          walletAmount={walletAmount}
          setIsRootTransfer={setIsRootTransfer}
        />
      </div>
      <div className="event">
        <Token tokenaddress={tokenaddress} setTokenAddress={setTokenAddress} />
        <div
          style={{
            display: "flex",
            justifyCcontent: "left",
            marginTop: "1em",
            marginBottom: "1em",
          }}
        >
          <Auto
            tokenaddress={tokenaddress}
            walletUnit={walletUnit}
            walletAmount={walletAmount}
            setIsRootSwap={setIsRootSwap}
          />
        </div>
      </div>
      <Alert />
    </div>
  );
}

export default App;
