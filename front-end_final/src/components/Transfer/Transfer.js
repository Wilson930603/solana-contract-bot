import React, { useState } from "react";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Button from "react-bootstrap/Button";
import { toast } from "react-toastify";
import "./Transfer.css";
import axios from "axios";
import { API_URL } from "../config";

const Transfer = (props) => {
  const [isGathering, setIsGathering] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const handleTransfer = async () => {
    setIsTransferring(true);
    try {
      const res = await axios.get(`${API_URL}transfer`, {
        params: {
          walletAmount: props.walletAmount,
          sol_amount: props.solAmount,
          wallet_unit: props.walletUnit,
          sleepTime: props.sleepTime,
        },
      });

      if (res.data) {
        setIsTransferring(false);
        props.setIsRootTransfer(true);
        toast.success(`Success`);
      }
    } catch (error) {
      setIsTransferring(false);
      toast.error(error.response.data)
    }
  };

  const handleGather = async () => {
    setIsGathering(true);
    try {
      const res = await axios.get(`${API_URL}gather`, {
        params: {
          walletAmount: props.walletAmount,
          wallet_unit: props.walletUnit,
        },
      });
      if (res.data) {
        
        setIsGathering(false);
        toast.success(`Success`);
      }
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="sol_transfer">
      <div className="_solamount">
        <InputGroup size="lg" className="sol_amount">
          <InputGroup.Text id="inputGroup-sizing-lg">
            SOL Transfer
          </InputGroup.Text>
          <Form.Control
            aria-label="Large"
            aria-describedby="inputGroup-sizing-sm"
            type="number"
            placeholder="0"
            value={props.solAmount}
            onChange={(e) => props.setSolAmount(e.target.value)}
          />
          <InputGroup.Text>SOL</InputGroup.Text>
        </InputGroup>
      </div>
      <div className="_perwallets">
        <InputGroup>
          <InputGroup.Text id="inputGroup-sizing-lg">Unit</InputGroup.Text>
          <Form.Control
            aria-label="Large"
            aria-describedby="inputGroup-sizing-sm"
            type="number"
            placeholder="0"
            value={props.walletUnit}
            onChange={(e) => props.setWalletUnit(e.target.value)}
          />
          <InputGroup.Text>Wallets</InputGroup.Text>
        </InputGroup>
      </div>
      <div className="sleeptime">
        <InputGroup>
          <InputGroup.Text id="inputGroup-sizing-lg">SleepTime</InputGroup.Text>
          <Form.Control
            aria-label="Large"
            aria-describedby="inputGroup-sizing-sm"
            type="number"
            placeholder="0"
            value={props.sleepTime}
            onChange={(e) => props.setSleepTime(e.target.value)}
          />
          <InputGroup.Text>Seconds</InputGroup.Text>
        </InputGroup>
      </div>
      <div className="transfer_btn">
        <Button onClick={handleTransfer}>
          {isTransferring ? "Transferring" : "Transfer"}
        </Button>
      </div>
      <div className="transfer_btn">
        <Button onClick={handleGather}>
          {isGathering ? "Gathering" : "Gather"}
        </Button>
      </div>
    </div>
  );
};

export default Transfer;
