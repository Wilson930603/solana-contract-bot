import React, { useState } from "react";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Button from "react-bootstrap/Button";
import { toast } from "react-toastify";
import { API_URL } from "../config";
import "./WalletAmounts.css";
import axios from "axios";

const WalletAmounts = (props) => {
  const [isRemove, setIsRemove] = useState(false);

  const handleGenerate = async () => {
    try {
      const res = await axios.get(`${API_URL}generate`, {
        params: {
          wallet_amount: props.walletAmount,
        },
      });
      if (res) {
        toast.success(`${props.walletAmount} Wallets are generated now`);
      }
    } catch (err) {
      console.log("err", err);
    }
  };

  const handleRemove = async () => {
    try {
      const res = await axios.get(`${API_URL}remove`).then((res) => {
        if (res) {
          console.log("Success Removed");
          toast.success(`Wallets are Removed now`);
          props.setIsRootTransfer(false);
          props.setIsRootSwap(false);
        }
      });
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <div className="wallet_amount">
      <InputGroup size="lg" className="walletamount">
        <InputGroup.Text id="inputGroup-sizing-lg">
          Wallet Amounts
        </InputGroup.Text>
        <Form.Control
          aria-label="Large"
          aria-describedby="inputGroup-sizing-sm"
          type="number"
          placeholder="0"
          value={props.walletAmount}
          onChange={(e) => props.setWalletAmount(e.target.value)}
        />
      </InputGroup>
      <Button className="generate" onClick={handleGenerate}>
        Generate
      </Button>
      {props.isRootSwap && (
        <Button variant="danger" className="remove" onClick={handleRemove}>
          Remove wallets
        </Button>
      )}
    </div>
  );
};

export default WalletAmounts;
