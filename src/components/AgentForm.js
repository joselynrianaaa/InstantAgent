import React, { useState } from "react";

const AgentForm = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    goal: "",
    model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
    tools: [],
  });

  const availableModels = [
    { id: "mistralai/Mixtral-8x7B-Instruct-v0.1", name: "Mixtral 8x7B" },
    { id: "meta-llama/Llama-2-70b-chat-hf", name: "Llama-2 70B" },
    { id: "togethercomputer/llama-2-7b-chat", name: "Llama-2 7B" },
    { id: "google/gemma-7b-it", name: "Gemma 7B" },
  ];

  const availableTools = [
    { id: "search", name: "Search" },
    { id: "code", name: "Code Generation" },
    { id: "math", name: "Math" },
    { id: "web", name: "Web Browsing" },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleToolChange = (e) => {
    const toolId = e.target.value;
    const isChecked = e.target.checked;

    setFormData((prev) => {
      if (isChecked) {
        return { ...prev, tools: [...prev.tools, toolId] };
      } else {
        return { ...prev, tools: prev.tools.filter((t) => t !== toolId) };
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const inputStyle = {
    backgroundColor: "#343541",
    color: "white",
    border: "1px solid #343541",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        backgroundColor: "#2c2d30",
        borderRadius: "12px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        padding: "24px",
      }}
    >
      <div className="mb-3">
        <label htmlFor="goal" className="form-label text-white">
          Goal:
        </label>
        <textarea
          id="goal"
          name="goal"
          className="form-control custom-textarea"
          style={inputStyle}
          value={formData.goal}
          onChange={handleChange}
          placeholder="Describe the agent's goal..."
          required
          rows="3"
        />
      </div>

      <div className="mb-3">
        <label htmlFor="model" className="form-label text-white">
          Model:
        </label>
        <div style={{ position: "relative" }}>
  <select
    id="model"
    name="model"
    className="form-select"
    style={{
      ...inputStyle,
      appearance: "none", // remove native arrow
      paddingRight: "2rem",
    }}
    value={formData.model}
    onChange={handleChange}
    required
  >
    {availableModels.map((model) => (
      <option key={model.id} value={model.id}>
        {model.name}
      </option>
    ))}
  </select>

  {/* Dropdown Arrow */}
  <div
    style={{
      position: "absolute",
      right: "20px",
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none",
      color: "white",
      fontSize: "1rem",
    }}
  >
    ▼
  </div>
</div>

      </div>

      <div className="mb-3">
        <label className="form-label text-white">Tools:</label>
        <div
          style={{
            backgroundColor: "#343541",
            padding: "1rem",
            borderRadius: "8px",
          }}
        >
          {availableTools.map((tool) => (
            <div className="form-check" key={tool.id}>
              <input
                className="form-check-input"
                type="checkbox"
                id={`tool-${tool.id}`}
                value={tool.id}
                checked={formData.tools.includes(tool.id)}
                onChange={handleToolChange}
              />
              <label
                className="form-check-label text-white"
                htmlFor={`tool-${tool.id}`}
              >
                {tool.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="d-grid">
        <button
          type="submit"
          className="btn"
          style={{
            backgroundColor: "#0d6efd",
            color: "white",
            border: "none",
          }}
          disabled={isLoading}
        >
          {isLoading ? "Creating Agent..." : "Create Agent"}
        </button>
      </div>
    </form>
  );
};

export default AgentForm;
