import React from "react";

const ResponseDisplay = ({ response }) => {
  return (
    <div
      style={{
        backgroundColor: "#2c2d30",
        borderRadius: "12px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        padding: "24px",
      }}
    >
      {!response ? (
        <p style={{ color: "rgba(255, 255, 255, 0.7)" }}>
          No response yet. Create an agent to see the response here.
        </p>
      ) : (
        <div>
          <pre
            style={{
              backgroundColor: "#343541",
              color: "#fff",
              padding: "1rem",
              borderRadius: "8px",
              overflow: "auto",
              maxHeight: "400px",
              fontSize: "0.9rem",
              border: "none",
              boxShadow: "none",
            }}
          >
            {JSON.stringify(response, null, 2)}
          </pre>

          {response.choices && response.choices.length > 0 && (
            <div className="mt-3">
              <h4 style={{ color: "#fff" }}>Suggested prompts</h4>
              <div
                style={{
                  backgroundColor: "#343541",
                  color: "#fff",
                  padding: "1rem",
                  borderRadius: "8px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {response.choices[0].message?.content || "No message content"}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResponseDisplay;
