import React, { useState, useEffect } from "react";
import axios from "axios";
import AgentForm from "./components/AgentForm";
import ResponseDisplay from "./components/ResponseDisplay";
import ChatComponent from "./components/ChatComponent";
import Sidebar from "./components/Sidebar";
import "./App.css";

function App() {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState(null);
  const [activeAgent, setActiveAgent] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [agents, setAgents] = useState([]);

  const [name, setName] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Check API connectivity when component mounts
  useEffect(() => {
    const checkApiConnectivity = async () => {
      try {
        await axios.get("http://127.0.0.1:8000/", { timeout: 5000 });
        console.log("Backend API is reachable");
      } catch (err) {
        console.error("Cannot connect to backend API:", err);
        setError(
          "Cannot connect to backend API. Please make sure it's running at http://127.0.0.1:8000"
        );
      }
    };

    checkApiConnectivity();
  }, []);

  const handleSubmit = async (formData) => {
    setLoading(true);
    setLoadingStage("Initializing agent creation...");
    setError(null);
    setShowChat(false);

    // Create a timeout promise that rejects after 90 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            "Request timed out after 90 seconds. The server may be overloaded. Try a smaller model like Mistral 7B."
          )
        );
      }, 90000);
    });

    try {
      setLoadingStage(
        "Creating agent with " + formData.model.split("/").pop() + "..."
      );

      // Set a request timeout of 90 seconds
      const result = await Promise.race([
        axios.post("http://127.0.0.1:8000/create-agent", formData, {
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          onUploadProgress: () => {
            setLoadingStage("Sending request to create agent...");
          },
          onDownloadProgress: () => {
            setLoadingStage("Receiving response from server...");
          },
        }),
        timeoutPromise,
      ]);

      console.log("Agent creation response:", result.data);

      setResponse(result.data);
      if (result.data && result.data.agent_id) {
        setActiveAgent(result.data.agent_id);

        // Simple fallback name in case the API call for naming fails
        let fallbackName = "Custom Assistant";
        if (formData.goal) {
          const words = formData.goal.split(/\s+/).filter(Boolean);
          if (words.length > 0) {
            fallbackName =
              words[0].charAt(0).toUpperCase() +
              words[0].slice(1) +
              " Assistant";
          }
        }

        // Generate agent name using LLM
        let agentName;
        try {
          setLoadingStage("Generating a name for your agent...");
          // Set a timeout for name generation as well
          const namePromise = generateAgentNameWithLLM(formData.goal);
          agentName = await Promise.race([
            namePromise,
            new Promise((_, reject) => {
              setTimeout(
                () => reject(new Error("Name generation timed out")),
                15000
              );
            }),
          ]);
          setLoadingStage("Name generated: " + agentName);
        } catch (nameError) {
          console.warn("Error generating name:", nameError);
          agentName = fallbackName; // Use the fallback name
          setLoadingStage("Using fallback name: " + agentName);
        }

        // Find the model name from the model ID
        const modelName = formData.model.includes("/")
          ? formData.model.split("/").pop().replace(/-/g, " ")
          : formData.model;

        // Add the new agent to the list
        setAgents((prevAgents) => [
          ...prevAgents,
          {
            id: result.data.agent_id,
            name: agentName,
            description: formData.goal,
            model: formData.model, // Store model ID
            modelName: modelName, // Store friendly model name
          },
        ]);
      }
    } catch (err) {
      console.error("Error creating agent:", err);

      let errorMessage;
      if (err.message && err.message.includes("timeout")) {
        // Handle timeout errors specifically
        errorMessage =
          "The request timed out. The server might be busy or the model might be too large. Try again or choose a smaller model.";
      } else if (err.response) {
        // Server responded with an error code
        if (err.response.status === 500) {
          errorMessage =
            "Server error: The model might be unavailable or the API key might be invalid.";
        } else {
          errorMessage =
            err.response.data.detail ||
            (typeof err.response.data === "object"
              ? JSON.stringify(err.response.data)
              : err.response.data) ||
            `Server error: ${err.response.status}`;
        }
      } else if (err.request) {
        // No response received
        errorMessage =
          "No response from server. Please check if the backend is running at http://127.0.0.1:8000";
      } else {
        // Something else went wrong
        errorMessage = err.message || "An unknown error occurred";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  const handleStartChat = () => {
    // Find the current agent's details to pass to ChatComponent
    const currentAgent = agents.find((agent) => agent.id === activeAgent);
    setShowChat(true);
  };

  const handleAgentSelect = (agentId) => {
    setActiveAgent(agentId);
    // Find the selected agent's details to pass to ChatComponent
    const selectedAgent = agents.find((agent) => agent.id === agentId);
    setShowChat(true);
  };

  // Function to generate agent name using the Together API
  async function generateAgentNameWithLLM(goal) {
    if (!goal) return "Custom Assistant";

    try {
      // This uses the same API endpoint format that your backend likely uses
      const response = await fetch("http://localhost:8000/agent-name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          goal: goal,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate agent name");
      }

      const data = await response.json();
      return data.name || "Custom Assistant";
    } catch (error) {
      console.error("Error generating agent name:", error);

      // Fallback to simple algorithm if API call fails
      const words = goal.split(/\s+/).filter(Boolean);
      const firstTwoWords = words
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");

      return firstTwoWords ? `${firstTwoWords} Assistant` : "Custom Assistant";
    }
  }

  return (
    <div
      style={{ backgroundColor: "#1e1e1e", minHeight: "100vh", color: "#fff" }}
    >
      {/* Top Navigation */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: "#0d6efd",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "2rem",
            fontWeight: 1000,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          InstantAgent
        </h1>

        {/* Name Dropdown Badge */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              background: "#fff",
              color: "#0d6efd",
              padding: "0.5rem 1rem",
              borderRadius: "15px",
              fontWeight: "bold",
              fontSize: "1.1rem",
              fontFamily: "'Poppins', sans-serif",
              cursor: "pointer",
              userSelect: "none",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              minWidth: "120px",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <span>{name || "Your Name"}</span>
            <span style={{ fontSize: "1rem" }}>▼</span>
          </div>

          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: "60px",
                right: 0,
                backgroundColor: "#fff",
                color: "#000",
                borderRadius: "12px",
                padding: "1rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                zIndex: 1001,
                width: "200px",
              }}
            >
              <label
                htmlFor="nameInput"
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: 500,
                }}
              >
                Enter your name:
              </label>
              <input
                id="nameInput"
                type="text"
                className="form-control"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="e.g. Thikkaloude"
              />
              <button
                className="btn btn-primary mt-2"
                style={{ width: "100%" }}
                onClick={() => {
                  const trimmed = inputValue.trim();
                  if (trimmed) {
                    setName(trimmed);
                    setShowDropdown(false);
                  }
                }}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar
        agents={agents}
        activeAgent={activeAgent}
        onAgentSelect={handleAgentSelect}
      />

      {/* Main Content */}
      <div
        className="main-content"
        style={{ marginLeft: "300px", padding: "80px 2rem 2rem" }}
      >
        {!showChat ? (
          <>
            {/* Create Agent Section */}
            <div className="mb-4">
              <div
                style={{
                  backgroundColor: "#2c2c2c",
                  borderRadius: "16px",
                  padding: "24px",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                }}
              >
                <h4
                  style={{
                    color: "#fff",
                    marginBottom: "1.2rem",
                    backgroundColor: "#3a3a3a",
                    padding: "0.75rem 1rem",
                    borderRadius: "12px",
                  }}
                >
                  Create a New Agent
                </h4>
                <AgentForm onSubmit={handleSubmit} isLoading={loading} />
              </div>
            </div>

            {/* Agent Response Section */}
            <div className="mb-4">
              <div
                style={{
                  backgroundColor: "#2c2c2c",
                  borderRadius: "16px",
                  padding: "24px",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                }}
              >
                <h4
                  style={{
                    color: "#fff",
                    marginBottom: "1.2rem",
                    backgroundColor: "#3a3a3a",
                    padding: "0.75rem 1rem",
                    borderRadius: "12px",
                  }}
                >
                  What your Agent can do
                </h4>
                {loading ? (
                  <div className="d-flex justify-content-center flex-column align-items-center">
                    <div
                      className="spinner-border text-light mb-3"
                      role="status"
                    >
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <div className="text-light text-center">
                      <p>{loadingStage || "Loading..."}</p>
                      <small className="text-muted">
                        This might take a minute or two depending on the
                        selected model.
                      </small>
                    </div>
                  </div>
                ) : error ? (
                  <div className="alert alert-danger bg-danger text-white border-0">
                    {error}
                  </div>
                ) : (
                  <>
                    <ResponseDisplay response={response} />
                    {activeAgent && !showChat && (
                      <div className="d-grid mt-3">
                        <button
                          className="btn"
                          style={{
                            backgroundColor: "#0d6efd",
                            color: "#fff",
                            border: "none",
                          }}
                          onClick={handleStartChat}
                        >
                          Start Chatting with Agent
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="chat-container">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <button
                className="btn btn-secondary"
                onClick={() => setShowChat(false)}
                style={{
                  backgroundColor: "#3a3a3a",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              >
                ← Back to Create Agent
              </button>
              <h4 style={{ margin: 0, color: "#fff" }}>
                {agents.find((agent) => agent.id === activeAgent)?.name ||
                  "Chat"}
              </h4>
              <div style={{ width: "120px" }}></div>{" "}
              {/* Spacer for alignment */}
            </div>
            <ChatComponent
              agentId={activeAgent}
              agentDetails={agents.find((agent) => agent.id === activeAgent)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
