import React, { useState } from "react";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import "./Token.css";

const Token = (props) => {
  return (
    <div className="tokenaddr">
      <InputGroup size="lg" className="inputgroup">
        <InputGroup.Text id="inputGroup-sizing-lg">
          Token Address
        </InputGroup.Text>
        <Form.Control
          aria-label="Large"
          aria-describedby="inputGroup-sizing-sm"
          placeholder={props.tokenaddress}
          value={props.tokenaddress}
          onChange={(e) => props.setTokenAddress(e.target.value)}
        />
      </InputGroup>
    </div>
  );
};

export default Token;
