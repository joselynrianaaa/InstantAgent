import React, { useState } from "react";

const Sidebar = ({ agents, activeAgent, onAgentSelect, onDeleteAgent }) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);

  const handleDelete = (e, agentId) => {
    e.stopPropagation();
    setShowConfirmDelete(agentId);
  };

  const confirmDelete = (e, agentId) => {
    e.stopPropagation();
    onDeleteAgent(agentId);
    setShowConfirmDelete(null);
  };

  const cancelDelete = (e) => {
    e.stopPropagation();
    setShowConfirmDelete(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: "300px",
        backgroundColor: "#1e1e1e",
        padding: "80px 0 1rem",
        overflowY: "auto",
      }}
    >
      <h5
        style={{
          color: "#fff",
          marginBottom: "1rem",
          padding: "0 1rem",
          fontSize: "1rem",
          fontWeight: "500",
        }}
      >
        Your Agents
      </h5>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => onAgentSelect(agent.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              handleDelete(e, agent.id);
            }}
            style={{
              padding: "0.75rem 1rem",
              backgroundColor:
                agent.id === activeAgent
                  ? "rgba(255, 255, 255, 0.1)"
                  : "transparent",
              cursor: "pointer",
              transition: "background-color 0.2s",
              position: "relative",
              borderRadius: "2px",
            }}
          >
            {showConfirmDelete === agent.id ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div style={{ color: "#ff4444" }}>Delete this agent?</div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={(e) => confirmDelete(e, agent.id)}
                    style={{
                      flex: 1,
                      backgroundColor: "#ff4444",
                      color: "#fff",
                      border: "none",
                      padding: "0.4rem",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={cancelDelete}
                    style={{
                      flex: 1,
                      backgroundColor: "#333",
                      color: "#fff",
                      border: "none",
                      padding: "0.4rem",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    color: "#fff",
                    fontSize: "0.9rem",
                    fontWeight: "500",
                    marginBottom: "0.25rem",
                  }}
                >
                  {agent.name}
                </div>
                <div
                  style={{
                    color: "#888",
                    fontSize: "0.8rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  {agent.modelName}
                </div>
                {agent.description && (
                  <div
                    style={{
                      color: "#666",
                      fontSize: "0.8rem",
                    }}
                  >
                    {agent.description}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {agents.length === 0 && (
          <div
            style={{
              color: "#666",
              textAlign: "center",
              padding: "1rem",
              fontSize: "0.9rem",
            }}
          >
            No agents created yet
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
