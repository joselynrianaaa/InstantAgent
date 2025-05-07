from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import httpx
import os
from dotenv import load_dotenv
import logging
from fastapi.middleware.cors import CORSMiddleware
import uuid
from datetime import datetime
from fastapi import Request

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS - this MUST be added before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://localhost:3001", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"],  # Allow frontend origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*", "Content-Type", "Authorization", "X-Requested-With"],
)

# Add a route to handle OPTIONS preflight requests
@app.options("/{path:path}")
async def options_handler(request: Request, path: str):
    logger.info(f"Handling OPTIONS request for path: /{path}")
    return JSONResponse(
        content={},
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        }
    )

# Storage for agent conversations
# In a production app, this would be a database
conversations: Dict[str, Dict] = {}

class AgentRequest(BaseModel):
    goal: str
    model: str
    tools: Optional[List[str]] = []

class ChatRequest(BaseModel):
    agent_id: str
    message: str

class AgentResponse(BaseModel):
    agent_id: str
    response: Dict
    created_at: str

@app.get("/")
async def root():
    return {"message": "Welcome to the Agent Creation API. Use POST /create-agent to create a new agent."}

@app.post("/create-agent")
async def create_agent(request: AgentRequest):
    try:
        logger.info(f"Received request to create agent with goal: {request.goal}")
        
        # Validate required fields
        if not request.goal:
            raise HTTPException(status_code=400, detail="Agent goal is required")
        if not request.model:
            raise HTTPException(status_code=400, detail="Model name is required")
            
        together_api_key = os.getenv("TOGETHER_API_KEY")
        if not together_api_key:
            logger.error("Together API key not found in environment variables")
            raise HTTPException(status_code=500, detail="Together API key not found in environment variables")

        # Check if this is an image generation model
        if "stable-diffusion" in request.model.lower():
            return await handle_image_generation_model(request, together_api_key)
        
        system_prompt = f"You are an agent with the goal: {request.goal}"
        user_message = "Hello agent, tell me what you can do."
        
        logger.info(f"Calling Together API with model: {request.model}")
        
        # Prepare standard request body
        request_body = {
            "model": request.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
        }
        
        # Define default API endpoint for chat API
        api_endpoint = "https://api.together.xyz/v1/chat/completions"
        
        # Add model-specific parameters if needed
        if "mixtral" in request.model.lower():
            # Mixtral models - updated configuration
            logger.info("Using updated configuration for Mixtral model")
            request_body.update({
                "temperature": 0.75,  # Slightly higher temperature for more creative responses
                "max_tokens": 600,    # Limiting token length to encourage conciseness
                "top_p": 0.9,
                "stop": ["USER:", "ASSISTANT:"],  # Add stop tokens to prevent model confusion
                "frequency_penalty": 0.2,  # Increased to reduce repetition
                "presence_penalty": 0.4    # Increased to encourage varied language
            })
            
            # Add friendly, emoji-using instructions to the system prompt
            if request_body["messages"] and request_body["messages"][0]["role"] == "system":
                original_goal = request_body["messages"][0]["content"]
                if "You are" not in original_goal:
                    request_body["messages"][0]["content"] = f"""You are a friendly and helpful AI assistant with the following goal: {original_goal}
                    
Important guidelines for your responses:
1. Be friendly and conversational 
2. Use at most 1-2 emojis per message (not more)
3. Keep your responses concise and to the point (under 3 sentences when possible)
4. Focus on providing direct answers first, then elaborating only if necessary
5. Be helpful and informative while maintaining a positive tone"""
        
        logger.info(f"Create agent API request body: {request_body}")
        logger.info(f"Using API endpoint: {api_endpoint}")
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    api_endpoint,
                    headers={
                        "Authorization": f"Bearer {together_api_key}",
                        "Content-Type": "application/json"
                    },
                    json=request_body
                )
                
                logger.info(f"Together API response status: {response.status_code}")
                
                if response.status_code != 200:
                    error_text = response.text
                    logger.error(f"Error with model {request.model}: {error_text}")
                    
                    # Try to parse the error response to provide more helpful messages
                    try:
                        error_json = response.json()
                        if "error" in error_json:
                            error_detail = error_json["error"].get("message", "Unknown error")
                            if "quota" in error_detail.lower() or "rate" in error_detail.lower():
                                detail = f"API rate limit or quota exceeded for {request.model}. Please try again later."
                            elif "not found" in error_detail.lower() or "unavailable" in error_detail.lower():
                                detail = f"The model {request.model} appears to be unavailable. Please try a different model."
                            else:
                                detail = f"Error with model {request.model}: {error_detail}"
                        else:
                            detail = f"Error calling Together API with model {request.model}: {error_text}"
                    except:
                        detail = f"Error calling Together API with model {request.model}: {error_text}"
                    
                    raise HTTPException(status_code=response.status_code, detail=detail)
                
                # Generate a unique ID for this agent
                agent_id = str(uuid.uuid4())
                
                # Store conversation history and agent metadata
                conversations[agent_id] = {
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    "model": request.model,  # Store the model information
                    "goal": request.goal,    # Store the goal for reference
                    "tools": request.tools   # Store the tools for reference
                }
                
                # Get the assistant's response
                api_response = response.json()
                logger.info(f"API response structure: {list(api_response.keys())}")
                
                # Handle different response formats based on API endpoint
                if "choices" in api_response and len(api_response["choices"]) > 0:
                    assistant_message = api_response["choices"][0]["message"]
                    conversations[agent_id]["messages"].append(assistant_message)
                
                # Include agent_id in response
                result = {
                    "agent_id": agent_id,
                    **api_response
                }
                
                return result
                
        except httpx.RequestError as exc:
            error_detail = f"HTTP Request error: {str(exc)}"
            logger.error(error_detail)
            
            # Create a fallback response instead of failing completely
            fallback_message = {
                "role": "assistant",
                "content": "🔄 Connection hiccup! The server seems busy right now. Let's try again in a moment - I'm eager to help you!"
            }
            
            # Add the fallback message to conversation history
            conversations[agent_id]["messages"].append(fallback_message)
            
            # Return a proper response structure with the fallback message
            fallback_response = {
                "choices": [{"message": fallback_message, "index": 0, "finish_reason": "error"}],
                "model": request.model,
                "error": error_detail
            }
            
            return fallback_response
        except Exception as e:
            error_detail = f"Unexpected error: {str(e)}"
            logger.error(error_detail)
            
            # Create a fallback response for general errors
            fallback_message = {
                "role": "assistant", 
                "content": "⚡ Something unexpected happened! Could you try a shorter message or different wording? I'm here and ready to help! 👍"
            }
            
            # Add the fallback message to conversation history
            conversations[agent_id]["messages"].append(fallback_message)
            
            # Return a proper response structure with the fallback message
            fallback_response = {
                "choices": [{"message": fallback_message, "index": 0, "finish_reason": "error"}],
                "model": request.model,
                "error": error_detail
            }
            
            return fallback_response

    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}"
        logger.error(error_detail)
        raise HTTPException(status_code=500, detail=error_detail)

async def handle_image_generation_model(request: AgentRequest, api_key: str):
    """Handle image generation models like Stable Diffusion"""
    logger.info(f"Handling image generation model: {request.model}")
    
    # Generate a unique ID for this agent
    agent_id = str(uuid.uuid4())
    
    # Create a basic response that explains this is an image generation model
    image_generation_response = {
        "agent_id": agent_id,
        "choices": [{
            "message": {
                "role": "assistant",
                "content": f"🎨 Hi there! I'm an image generation assistant using {request.model}. I can create images based on your text descriptions. Just describe what you'd like to see, and I'll make it for you!"
            },
            "index": 0,
            "finish_reason": "stop"
        }],
        "model": request.model,
        "is_image_model": True
    }
    
    # Store conversation history and agent metadata
    conversations[agent_id] = {
        "messages": [
            {"role": "system", "content": f"You are an image generation assistant using {request.model}."},
            {"role": "user", "content": "Hello, what can you do?"},
            {"role": "assistant", "content": f"🎨 Hi there! I'm an image generation assistant using {request.model}. I can create images based on your text descriptions. Just describe what you'd like to see, and I'll make it for you!"}
        ],
        "model": request.model,
        "goal": request.goal,
        "tools": request.tools,
        "is_image_model": True
    }
    
    return image_generation_response

@app.post("/chat-agent")
async def chat_with_agent(request: ChatRequest):
    logger.info(f"Received chat request for agent: {request.agent_id}")
    
    # Check if agent exists
    if request.agent_id not in conversations:
        raise HTTPException(status_code=404, detail="Agent not found. Create an agent first.")
    
    together_api_key = os.getenv("TOGETHER_API_KEY")
    if not together_api_key:
        raise HTTPException(status_code=500, detail="Together API key not found")
    
    # Add user message to conversation history
    conversations[request.agent_id]["messages"].append({"role": "user", "content": request.message})
    
    # Get conversation history for context
    messages = conversations[request.agent_id]["messages"]
    
    # Get model information
    model_id = conversations[request.agent_id]["model"]
    logger.info(f"Using model for chat: {model_id}")
    
    # Use standard chat completions API by default
    api_endpoint = "https://api.together.xyz/v1/chat/completions"
    
    # Standard chat API format
    request_body = {
        "model": model_id,
        "messages": messages
    }
    
    # Add model-specific parameters for other models
    if "mixtral" in model_id.lower():
        # Mixtral models - updated configuration
        logger.info("Using updated configuration for Mixtral model")
        request_body.update({
            "temperature": 0.75,  # Slightly higher temperature for more creative responses
            "max_tokens": 600,    # Limiting token length to encourage conciseness
            "top_p": 0.9,
            "stop": ["USER:", "ASSISTANT:"],  # Add stop tokens to prevent model confusion
            "frequency_penalty": 0.2,  # Increased to reduce repetition
            "presence_penalty": 0.4    # Increased to encourage varied language
        })
        
        # Ensure the system message is properly formatted for Mixtral
        if messages and messages[0]["role"] == "system":
            # Modify the system message to encourage friendly, concise responses with emojis
            original_goal = messages[0]["content"]
            if "You are an AI assistant" not in original_goal:
                messages[0]["content"] = f"""You are a friendly and helpful AI assistant with the following goal: {original_goal}
                
Important guidelines for your responses:
1. Be friendly and conversational 
2. Use at most 1-2 emojis per message (not more)
3. Keep your responses concise and to the point (under 3 sentences when possible)
4. Focus on providing direct answers first, then elaborating only if necessary
5. Be helpful and informative while maintaining a positive tone"""
        
        # If this is the first user message and it's a generic "what kind of model" question
        # Give a clear response that helps with agent identification
        if len(messages) == 2 and messages[1]["role"] == "user":
            user_msg = messages[1]["content"].lower()
            if ("what" in user_msg and "model" in user_msg) or "hello" in user_msg or "hi" in user_msg:
                # Add a meaningful first message to conversation history with emojis
                goal_text = conversations[request.agent_id].get('goal', '')
                goal_lower = goal_text.lower()
                
                # Craft a grammatically correct message based on the goal structure
                greeting_message = ""
                if not goal_text:
                    greeting_message = "👋 Hello! I'm your friendly AI assistant. How can I assist you today?"
                elif goal_lower.startswith("help") or goal_lower.startswith("assist"):
                    greeting_message = f"👋 Hello! I'm your friendly AI assistant ready to {goal_text}. How can I help you today?"
                elif goal_lower.startswith("create") or goal_lower.startswith("make") or goal_lower.startswith("build"):
                    greeting_message = f"👋 Hello! I'm your friendly AI assistant ready to help you {goal_text}. What would you like to know?"
                elif goal_lower.startswith("answer") or goal_lower.startswith("provide"):
                    greeting_message = f"👋 Hello! I'm your friendly AI assistant ready to {goal_text}. What questions do you have?"
                elif "plan" in goal_lower:
                    greeting_message = f"👋 Hello! I'm your friendly AI assistant for planning {goal_text.replace('plan', '').replace('planning', '').strip()}. How can I assist you today?"
                else:
                    greeting_message = f"👋 Hello! I'm your friendly AI assistant for {goal_text}. I'm here to help you. How can I assist you today?"
                
                messages.append({
                    "role": "assistant", 
                    "content": greeting_message
                })
                
                # Just return this message directly
                return {
                    "choices": [{
                        "message": messages[-1],  # Return the last message we just created
                        "index": 0,
                        "finish_reason": "stop"
                    }]
                }
    
    logger.info(f"Chat API request body: {request_body}")
    logger.info(f"Using API endpoint for chat: {api_endpoint}")
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:  # Increased timeout
            response = await client.post(
                api_endpoint,
                headers={
                    "Authorization": f"Bearer {together_api_key}",
                    "Content-Type": "application/json"
                },
                json=request_body
            )
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"Error with model {model_id}: {error_text}")
                
                # Try to parse the error response to provide more helpful messages
                try:
                    error_json = response.json()
                    if "error" in error_json:
                        error_detail = error_json["error"].get("message", "Unknown error")
                        if "quota" in error_detail.lower() or "rate" in error_detail.lower():
                            detail = f"API rate limit or quota exceeded for {model_id}. Please try again later."
                        elif "not found" in error_detail.lower() or "unavailable" in error_detail.lower():
                            detail = f"The model {model_id} appears to be unavailable. Please try a different model."
                        else:
                            detail = f"Error with model {model_id}: {error_detail}"
                    else:
                        detail = f"Error calling Together API with model {model_id}: {error_text}"
                except:
                    detail = f"Error calling Together API with model {model_id}: {error_text}"
                
                raise HTTPException(status_code=response.status_code, detail=detail)
            
            # Get the response
            api_response = response.json()
            logger.info(f"Chat response structure: {list(api_response.keys())}")
            
            # Standard chat completions API format
            if "choices" in api_response and len(api_response["choices"]) > 0:
                try:
                    assistant_message = api_response["choices"][0]["message"]
                    conversations[request.agent_id]["messages"].append(assistant_message)
                except (KeyError, TypeError, IndexError) as e:
                    # Handle corrupt or unexpected response format
                    logger.error(f"Error parsing response: {str(e)}")
                    # Create a fallback message
                    fallback_message = {
                        "role": "assistant",
                        "content": "😅 I had a small hiccup processing that. Could you try rephrasing your question? I'd love to help!"
                    }
                    conversations[request.agent_id]["messages"].append(fallback_message)
                    
                    # Modify the API response to include our fallback
                    if "choices" in api_response:
                        api_response["choices"][0]["message"] = fallback_message
                    else:
                        api_response["choices"] = [{"message": fallback_message, "index": 0, "finish_reason": "error"}]
            
            # Check for any other odd response formats and try to normalize them
            if "choices" not in api_response or not api_response["choices"]:
                logger.warning(f"No choices in response, creating fallback response")
                fallback_message = {
                    "role": "assistant",
                    "content": "🤔 I think I lost my train of thought there! Let's try again - what would you like to know?"
                }
                api_response["choices"] = [{"message": fallback_message, "index": 0, "finish_reason": "error"}]
                conversations[request.agent_id]["messages"].append(fallback_message)
            
            return api_response
            
    except httpx.RequestError as exc:
        error_detail = f"HTTP Request error: {str(exc)}"
        logger.error(error_detail)
        
        # Create a fallback response instead of failing completely
        fallback_message = {
            "role": "assistant",
            "content": "🔄 Connection hiccup! The server seems busy right now. Let's try again in a moment - I'm eager to help you!"
        }
        
        # Add the fallback message to conversation history
        conversations[request.agent_id]["messages"].append(fallback_message)
        
        # Return a proper response structure with the fallback message
        fallback_response = {
            "choices": [{"message": fallback_message, "index": 0, "finish_reason": "error"}],
            "model": model_id,
            "error": error_detail
        }
        
        return fallback_response
    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}"
        logger.error(error_detail)
        
        # Create a fallback response for general errors
        fallback_message = {
            "role": "assistant", 
            "content": "⚡ Something unexpected happened! Could you try a shorter message or different wording? I'm here and ready to help! 👍"
        }
        
        # Add the fallback message to conversation history
        conversations[request.agent_id]["messages"].append(fallback_message)
        
        # Return a proper response structure with the fallback message
        fallback_response = {
            "choices": [{"message": fallback_message, "index": 0, "finish_reason": "error"}],
            "model": model_id,
            "error": error_detail
        }
        
        return fallback_response
    
class AgentNameRequest(BaseModel):
    goal: str

@app.post("/agent-name")
async def generate_agent_name(request: AgentNameRequest):
    logger.info(f"Received request to generate agent name for goal: {request.goal}")
    
    together_api_key = os.getenv("TOGETHER_API_KEY")
    if not together_api_key:
        logger.error("Together API key not found in environment variables")
        raise HTTPException(status_code=500, detail="Together API key not found")
    
    prompt = f"""Create a short, catchy and HIGHLY RELEVANT name (2-3 words) for an AI assistant with this goal: '{request.goal}'
For example:
- If the goal is about math or algebra, name it something like 'Math Wizard' or 'Algebra Pro'
- If about budgeting or finance, name it something like 'Budget Buddy' or 'Finance Coach'
- If about travel, name it something like 'Travel Guide' or 'Journey Planner'

The name MUST directly relate to the primary purpose in the goal.
Return ONLY the name, no explanations or quotation marks."""
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.together.xyz/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {together_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "mistralai/Mistral-7B-Instruct-v0.2",
                    "messages": [
                        {"role": "system", "content": "You create short, catchy names for AI assistants."},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": 20,
                    "temperature": 0.7
                }
            )
            
            logger.info(f"Together API response status for name generation: {response.status_code}")
            
            if response.status_code != 200:
                error_detail = f"Error calling Together API: {response.text}"
                logger.error(error_detail)
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            api_response = response.json()
            
            if "choices" in api_response and len(api_response["choices"]) > 0:
                name = api_response["choices"][0]["message"]["content"].strip()
                # Clean up the name - remove quotes, periods, etc.
                name = name.replace('"', '').replace("'", "").replace(".", "").strip()
                
                # If name is too long, truncate it
                if len(name.split()) > 3:
                    name_parts = name.split()[:3]
                    name = " ".join(name_parts)
                
                return {"name": name}
            else:
                return {"name": "Custom Assistant"}
            
    except httpx.RequestError as exc:
        error_detail = f"HTTP Request error: {str(exc)}"
        logger.error(error_detail)
        raise HTTPException(status_code=500, detail=error_detail)
    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}"
        logger.error(error_detail)
        raise HTTPException(status_code=500, detail=error_detail)
    
# Add a new endpoint for image generation
@app.post("/generate-image")
async def generate_image(request: ChatRequest):
    logger.info(f"Received image generation request for agent: {request.agent_id}")
    
    # Check if agent exists
    if request.agent_id not in conversations:
        raise HTTPException(status_code=404, detail="Agent not found. Create an agent first.")
    
    # Check if agent is an image model
    if not conversations[request.agent_id].get("is_image_model", False):
        raise HTTPException(status_code=400, detail="This agent is not an image generation model")
    
    together_api_key = os.getenv("TOGETHER_API_KEY")
    if not together_api_key:
        raise HTTPException(status_code=500, detail="Together API key not found")
    
    # Add user message to conversation history
    conversations[request.agent_id]["messages"].append({"role": "user", "content": request.message})
    
    # Get model information
    model_id = conversations[request.agent_id]["model"]
    logger.info(f"Using image model for generation: {model_id}")
    
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            # Call the Together API image generation endpoint
            response = await client.post(
                "https://api.together.xyz/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {together_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model_id,
                    "prompt": request.message,
                    "n": 1,
                    "size": "1024x1024"
                }
            )
            
            logger.info(f"Together API response status for image generation: {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"Error with image model {model_id}: {error_text}")
                
                # Try to parse the error response
                try:
                    error_json = response.json()
                    if "error" in error_json:
                        error_detail = error_json["error"].get("message", "Unknown error")
                        detail = f"Error with image model {model_id}: {error_detail}"
                    else:
                        detail = f"Error calling Together API with image model {model_id}: {error_text}"
                except:
                    detail = f"Error calling Together API with image model {model_id}: {error_text}"
                
                raise HTTPException(status_code=response.status_code, detail=detail)
            
            # Get the response
            api_response = response.json()
            
            # Add a simulated assistant message to conversation history
            assistant_message = {
                "role": "assistant", 
                "content": f"🎨 Here's the image I created based on '{request.message}'! What do you think?",
                "image_url": api_response.get("data", [{}])[0].get("url", "")
            }
            
            conversations[request.agent_id]["messages"].append(assistant_message)
            
            # Create a response similar to chat completions for consistency
            result = {
                "choices": [{
                    "message": assistant_message,
                    "index": 0,
                    "finish_reason": "stop"
                }],
                "model": model_id,
                "data": api_response.get("data", [])
            }
            
            return result
            
    except httpx.RequestError as exc:
        error_detail = f"HTTP Request error: {str(exc)}"
        logger.error(error_detail)
        
        # Create a fallback response instead of failing completely
        fallback_message = {
            "role": "assistant",
            "content": "🖼️ I hit a small bump while creating your image. The server might be busy right now. Let's try again in a moment!"
        }
        
        # Add the fallback message to conversation history
        conversations[request.agent_id]["messages"].append(fallback_message)
        
        # Return a proper response structure with the fallback message
        fallback_response = {
            "choices": [{
                "message": fallback_message,
                "index": 0, 
                "finish_reason": "error"
            }],
            "model": model_id,
            "error": error_detail
        }
        
        return fallback_response
    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}"
        logger.error(error_detail)
        
        # Create a fallback response for general errors
        fallback_message = {
            "role": "assistant", 
            "content": "🎨 I couldn't create that image. This might be due to content filters or a technical glitch. Try a different description?"
        }
        
        # Add the fallback message to conversation history
        conversations[request.agent_id]["messages"].append(fallback_message)
        
        # Return a proper response structure with the fallback message
        fallback_response = {
            "choices": [{
                "message": fallback_message,
                "index": 0, 
                "finish_reason": "error"
            }],
            "model": model_id,
            "error": error_detail
        }
        
        return fallback_response
    
 

