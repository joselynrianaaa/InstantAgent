import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";

const ChatComponent = ({ agentId, agentDetails }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isImageModel, setIsImageModel] = useState(false);
  const chatContainerRef = useRef(null);
  const isFirstMount = useRef(true);

  // Function to generate welcome message with emojis based on agent goal
  const generateWelcomeMessage = (goal, isImageModel) => {
    if (!goal) return "👋 Hello! How can I help you today?";

    // Default emoji based on goal content
    let emoji = "👋";

    // Determine emoji based on goal keywords
    const goalLower = goal.toLowerCase();
    if (
      goalLower.includes("travel") ||
      goalLower.includes("vacation") ||
      goalLower.includes("trip")
    ) {
      emoji = "✈️";
    } else if (
      goalLower.includes("food") ||
      goalLower.includes("recipe") ||
      goalLower.includes("cook")
    ) {
      emoji = "🍳";
    } else if (
      goalLower.includes("code") ||
      goalLower.includes("program") ||
      goalLower.includes("develop")
    ) {
      emoji = "💻";
    } else if (
      goalLower.includes("math") ||
      goalLower.includes("calculate") ||
      goalLower.includes("equation")
    ) {
      emoji = "🧮";
    } else if (
      goalLower.includes("write") ||
      goalLower.includes("story") ||
      goalLower.includes("blog")
    ) {
      emoji = "✍️";
    } else if (
      goalLower.includes("health") ||
      goalLower.includes("fitness") ||
      goalLower.includes("exercise")
    ) {
      emoji = "💪";
    } else if (
      goalLower.includes("music") ||
      goalLower.includes("song") ||
      goalLower.includes("playlist")
    ) {
      emoji = "🎵";
    } else if (
      goalLower.includes("art") ||
      goalLower.includes("design") ||
      goalLower.includes("creative")
    ) {
      emoji = "🎨";
    }

    if (isImageModel) {
      return `${emoji} Welcome! I'm ready to generate images for you based on your descriptions. What would you like me to create today?`;
    }

    // Create a grammatically correct welcome message based on goal
    // Format the goal into a proper sentence
    let formattedMessage = "";

    // Handle different phrasing based on how the goal is structured
    if (goalLower.startsWith("help") || goalLower.startsWith("assist")) {
      formattedMessage = `${emoji} Hello! I'm your assistant ready to ${goal}. How can I help you today?`;
    } else if (
      goalLower.startsWith("create") ||
      goalLower.startsWith("make") ||
      goalLower.startsWith("build")
    ) {
      formattedMessage = `${emoji} Hello! I'm your assistant ready to help you ${goal}. What would you like to know?`;
    } else if (
      goalLower.startsWith("answer") ||
      goalLower.startsWith("provide")
    ) {
      formattedMessage = `${emoji} Hello! I'm your assistant ready to ${goal}. What questions do you have?`;
    } else if (goalLower.includes("plan") || goalLower.includes("planning")) {
      formattedMessage = `${emoji} Hello! I'm your assistant for planning ${goal.replace(
        /^plan\s|planning\s/i,
        ""
      )}. How can I assist you today?`;
    } else {
      // Default format that works with most goals
      formattedMessage = `${emoji} Hello! I'm your assistant for ${goal}. I'm here to help you. How can I assist you today?`;
    }

    return formattedMessage;
  };

  // Create welcome message when component mounts or when agentDetails change
  useEffect(() => {
    if (agentDetails && isFirstMount.current) {
      // Display a welcome message with emoji based on agent goal
      const welcomeMessage = {
        sender: "agent",
        text: generateWelcomeMessage(agentDetails.description, isImageModel),
      };

      // Only set this on first mount
      if (isFirstMount.current) {
        isFirstMount.current = false;
        // This will be replaced by the checkAgentType response if it's successful
        setMessages([welcomeMessage]);
      }
    }
  }, [agentDetails, isImageModel]);

  // Check if this is an image model when component mounts
  useEffect(() => {
    const checkAgentType = async (retryAttempt = 0) => {
      try {
        console.log(`Checking agent type (attempt ${retryAttempt + 1})...`);

        // Use a simple query that doesn't affect the agent's state
        const message =
          retryAttempt > 0
            ? "Hello, are you an image generation model?"
            : "What kind of model are you?";

        // Add a timeout to the fetch to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        // Make a request to get the first message which contains the agent type
        const res = await axios.post(
          "http://localhost:8000/chat-agent",
          { agent_id: agentId, message },
          {
            timeout: 10000,
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        const data = res.data;
        console.log("Agent type check response:", data);

        // Check if response has valid data
        if (
          data &&
          data.choices &&
          data.choices.length > 0 &&
          data.choices[0].message
        ) {
          const messageContent = data.choices[0].message.content || "";

          // Check if this is an image model from the response
          if (
            data.is_image_model ||
            messageContent.toLowerCase().includes("image generation") ||
            messageContent.toLowerCase().includes("stable diffusion")
          ) {
            setIsImageModel(true);

            // Add initial welcome message for image model with the goal
            const initialMessage = {
              sender: "agent",
              text: agentDetails
                ? generateWelcomeMessage(agentDetails.description, true)
                : messageContent,
            };
            setMessages([initialMessage]);
          } else {
            // For non-image models, show goal-based welcome message
            const initialMessage = {
              sender: "agent",
              text: agentDetails
                ? generateWelcomeMessage(agentDetails.description, false)
                : messageContent ||
                  "Hello! I'm your AI assistant. How can I help you today?",
            };
            setMessages([initialMessage]);
          }
        } else if (retryAttempt < 2) {
          // If no valid response and we haven't exceeded retries, try again
          console.log("No valid response from agent, retrying...");
          setTimeout(() => checkAgentType(retryAttempt + 1), 2000);
          return;
        } else {
          // Final fallback message after retries with goal-based customization
          const errorMessage = {
            sender: "agent",
            text: agentDetails
              ? generateWelcomeMessage(agentDetails.description, false)
              : "👋 Hello! I'm your AI assistant. There was a small issue connecting, but I'm ready to help now.",
          };
          setMessages([errorMessage]);
        }
      } catch (error) {
        console.error("Error checking agent type:", error);

        if (retryAttempt < 2) {
          // If error and we haven't exceeded retries, try again
          console.log(
            `Error checking agent type, retrying (${retryAttempt + 1}/2)...`
          );
          setTimeout(() => checkAgentType(retryAttempt + 1), 2000);
          return;
        }

        // Final fallback after retries
        const errorMessage = {
          sender: "agent",
          text: agentDetails
            ? generateWelcomeMessage(agentDetails.description, false)
            : "👋 Hello! I'm ready to assist you. There was a connection issue, but we can still chat.",
        };
        setMessages([errorMessage]);
      }
    };

    checkAgentType();
  }, [agentId, agentDetails]);

  const sendMessage = async (retryCount = 0) => {
    if (!input.trim() && retryCount === 0) return;

    // On first attempt, add user message and clear input
    if (retryCount === 0) {
      const userMessage = { sender: "user", text: input };
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
          : input;

      // Create a timeout for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, message: messageToSend }),
        signal: controller.signal,
      });

      // Clear the timeout since request completed
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Server responded with status: ${res.status}`);
      }

      const data = await res.json();
      console.log("Server response:", data);

      // Check if we got a valid response with content
      let agentReply =
        "Sorry, I couldn't generate a response. Please try again.";
      let imageUrl = null;

      let validResponse = false;

      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        if (
          data.choices[0].message.content &&
          data.choices[0].message.content !== "No response" &&
          data.choices[0].message.content.trim() !== ""
        ) {
          agentReply = data.choices[0].message.content;
          validResponse = true;

          // Check if there's an image URL in the response
          if (data.choices[0].message.image_url) {
            imageUrl = data.choices[0].message.image_url;
          } else if (data.data && data.data.length > 0 && data.data[0].url) {
            imageUrl = data.data[0].url;
          }
        }
      }

      const botMessage = {
        sender: "agent",
        text: agentReply,
        imageUrl: imageUrl,
      };

      setMessages((prev) => [...prev, botMessage]);

      // If we didn't get a valid response and haven't exceeded retries, try again
      if (!validResponse && retryCount < 2) {
        console.log(
          `No valid response received, retrying (${retryCount + 1}/2)...`
        );
        setTimeout(() => sendMessage(retryCount + 1), 2000); // Wait 2 seconds before retry
        return;
      }
    } catch (error) {
      console.error("Error sending message:", error);

      // If timeout or network error and we haven't exceeded retries, try again
      if (
        (error.name === "AbortError" || error.name === "TypeError") &&
        retryCount < 2
      ) {
        console.log(`Request failed, retrying (${retryCount + 1}/2)...`);
        setTimeout(() => sendMessage(retryCount + 1), 2000); // Wait 2 seconds before retry
        return;
      }

      const botMessage = {
        sender: "agent",
        text: `❓ Error: ${
          error.message || "Failed to communicate with agent."
        }`,
      };
      setMessages((prev) => [...prev, botMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

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
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                background: msg.sender === "user" ? "#0d6efd" : "#444654",
                padding: "10px 14px",
                borderRadius: "10px",
                maxWidth: "80%",
                whiteSpace: "pre-wrap",
                color: "#fff",
                boxShadow: "0 1px 5px rgba(0,0,0,0.2)",
              }}
            >
              <ReactMarkdown>{msg.text}</ReactMarkdown>
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
          <div style={{ color: "#aaa", fontStyle: "italic" }}>
            {isImageModel ? "Generating image..." : "Agent is typing..."}
          </div>
        )}
      </div>

      <div style={{ display: "flex" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isImageModel ? "Describe the image you want..." : "Say something..."
          }
          style={{
            flexGrow: 1,
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            outline: "none",
            fontSize: "1rem",
            background: "#202123",
            color: "#fff",
          }}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          style={{
            marginLeft: "10px",
            padding: "12px 18px",
            background: "#0d6efd",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          {isImageModel ? "Generate" : "Send"}
        </button>
      </div>
    </div>
  );
};

export default ChatComponent;
