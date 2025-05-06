import React from "react";
import ChatComponent from "./ChatComponent";

const ChatInterface = ({ agentId }) => {
  return (
    <div style={{
      backgroundColor: "#202123",
      minHeight: "100vh",
      padding: "2rem",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }}>
      <div style={{ width: "100%", maxWidth: "900px" }}>
        <ChatComponent agentId={agentId} />
      </div>
    </div>
  );
};

export default ChatInterface;
