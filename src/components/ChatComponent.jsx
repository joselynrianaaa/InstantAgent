import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";

const ChatComponent = ({
  agentId,
  agentDetails,
  initialMessages,
  onUpdateMessages,
}) => {
  // Initialize with welcome message or existing chat
  const [messages, setMessages] = useState(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }
    return [
      {
        sender: "agent",
        text: "👋 Hello! Let me assist you.",
      },
    ];
  });

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isImageModel, setIsImageModel] = useState(false);
  const chatContainerRef = useRef(null);
  const previousAgentId = useRef(agentId);

  // Handle agent switching
  useEffect(() => {
    if (previousAgentId.current !== agentId) {
      if (initialMessages && initialMessages.length > 0) {
        setMessages(initialMessages);
      } else {
        setMessages([
          {
            sender: "agent",
            text: "👋 Hello! Let me assist you.",
          },
        ]);
      }
      previousAgentId.current = agentId;
    }
  }, [agentId, initialMessages]);

  // Update parent with new messages
  useEffect(() => {
    onUpdateMessages(messages);
  }, [messages, onUpdateMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Check if this is an image model
  useEffect(() => {
    const checkAgentType = async () => {
      if (!agentId) return;

      try {
        const res = await axios.post(
          "http://localhost:8000/chat-agent",
          { agent_id: agentId, message: "What kind of model are you?" },
          { timeout: 10000 }
        );

        if (res.data?.choices?.[0]?.message?.content) {
          const messageContent = res.data.choices[0].message.content;
          setIsImageModel(
            res.data.is_image_model ||
              messageContent.toLowerCase().includes("image generation") ||
              messageContent.toLowerCase().includes("stable diffusion")
          );
        }
      } catch (error) {
        console.error("Error checking agent type:", error);
      }
    };

    checkAgentType();
  }, [agentId]);

  const sendMessage = async (retryCount = 0) => {
    if (!input.trim() && retryCount === 0) return;

    // On first attempt, add user message and clear input
    if (retryCount === 0) {
      const userMessage = { sender: "user", text: input.trim() };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
    }

    setIsTyping(true);

    try {
      // Different endpoint for image models
      const endpoint = isImageModel
        ? "http://localhost:8000/generate-image"
        : "http://localhost:8000/chat-agent";

      // Use the original input for retries, but get it from the last user message
      const messageToSend =
        retryCount > 0
          ? messages[messages.length - 2].text // Get the last user message
          : input.trim();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, message: messageToSend }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Server responded with status: ${res.status}`);
      }

      const data = await res.json();

      let agentReply = null;
      let imageUrl = null;

      // Only process response if we have valid content
      if (data?.choices?.[0]?.message?.content?.trim()) {
        agentReply = data.choices[0].message.content;

        // Check for image URL
        if (data.choices[0].message.image_url) {
          imageUrl = data.choices[0].message.image_url;
        } else if (data.data?.[0]?.url) {
          imageUrl = data.data[0].url;
        }
      }

      // Only add message if we have content
      if (agentReply) {
        const botMessage = {
          sender: "agent",
          text: agentReply,
          ...(imageUrl && { imageUrl }),
        };
        setMessages((prev) => [...prev, botMessage]);
      } else if (retryCount < 2) {
        setTimeout(() => sendMessage(retryCount + 1), 2000);
        return;
      }
    } catch (error) {
      console.error("Error sending message:", error);

      if (
        (error.name === "AbortError" || error.name === "TypeError") &&
        retryCount < 2
      ) {
        setTimeout(() => sendMessage(retryCount + 1), 2000);
        return;
      }

      const errorMessage = {
        sender: "agent",
        text: `❓ Error: ${
          error.message || "Failed to communicate with agent."
        }`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div
      style={{
        background: "#343541",
        color: "white",
        fontFamily: "monospace",
        padding: "2rem",
        height: "90vh",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        ref={chatContainerRef}
        style={{
          flexGrow: 1,
          overflowY: "auto",
          marginBottom: "1rem",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
              marginBottom: "20px",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-20px",
                [msg.sender === "user" ? "right" : "left"]: "10px",
                fontSize: "0.8rem",
                color: "#888",
              }}
            >
              {msg.sender === "user" ? "You" : "Assistant"}
            </div>
            <div
              style={{
                background: msg.sender === "user" ? "#2563eb" : "#1e1e1e",
                padding: "15px 20px",
                borderRadius: "15px",
                maxWidth: "85%",
                whiteSpace: "pre-wrap",
                color: "#fff",
                boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                border: msg.sender === "user" ? "none" : "1px solid #333",
              }}
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p style={{ margin: "0", lineHeight: "1.5" }}>{children}</p>
                  ),
                }}
              >
                {msg.text}
              </ReactMarkdown>
              {msg.imageUrl && (
                <div style={{ marginTop: "10px" }}>
                  <img
                    src={msg.imageUrl}
                    alt="Generated image"
                    style={{
                      maxWidth: "100%",
                      borderRadius: "5px",
                      border: "1px solid #666",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div
            style={{
              color: "#888",
              fontStyle: "italic",
              padding: "10px",
              background: "#1e1e1e",
              borderRadius: "10px",
              display: "inline-block",
              marginTop: "10px",
            }}
          >
            {isImageModel ? "Generating image..." : "Assistant is typing..."}
          </div>
        )}
      </div>

      <div style={{ display: "flex", marginTop: "20px" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isImageModel
              ? "Describe the image you want..."
              : "Type your message..."
          }
          style={{
            flexGrow: 1,
            padding: "15px",
            borderRadius: "10px",
            border: "1px solid #333",
            outline: "none",
            fontSize: "1rem",
            background: "#1e1e1e",
            color: "#fff",
            marginRight: "10px",
          }}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: "15px 25px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: "500",
            transition: "background 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#1d4ed8")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#2563eb")}
        >
          {isImageModel ? "Generate" : "Send"}
        </button>
      </div>
    </div>
  );
};

export default ChatComponent;
