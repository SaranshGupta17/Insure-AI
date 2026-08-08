# agents/agent1.py
import os
from typing import Annotated, Optional, TypedDict
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver

# Note: We now import the factory function instead of the static tool
from agents.Db_Retriever_Tool import get_secure_database_tool
from agents.Policy_Retriever_Tool import search_company_policies

memory = MemorySaver()

# 1. Define the State
class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

# 2. Define the Graph Runner Function
# We wrap the entire graph compilation in this function so we can pass the customer_id in dynamically
    # Using the orchestrator graph runner for:
    # 1. answering queries from policy document  
    # 2. Matching file claim incident details from policy documents
async def orchestrator_graph_runner(customer_id: str, incident_details: Optional[str]=None, query: Optional[str]=None) -> str:
    """Dynamically builds and runs the graph for the specific logged-in user."""
    
    api_key = os.getenv("GOOGLE_API_KEY")
    
    # 1. Generate the secure DB tool locked specifically to this user's ID
    secure_db_tool = get_secure_database_tool(customer_id)
    
    # Bind our Agent 2 (Secure) and Agent 3 tools to the LLM
    tools = [secure_db_tool, search_company_policies]
    
    # Initialize the LLM
    llm = ChatGoogleGenerativeAI(
        model=os.getenv("GOOGLE_CHAT_MODEL", "models/gemini-2.5-flash"),
        google_api_key=api_key,
        max_retries=3
    )
    llm_with_tools = llm.bind_tools(tools)
    
    # 2. Define the Node Function
    def chatbot_node(state: State):
        content = ""
        
        if(query):
            content=(
                            "You are a helpful and polite insurance assistant. "
                            "If the user greets you, respond conversationally and naturally. "
                            "If they ask about their personal details, personal car information, personal insurance policy type, or personal claim information, call the `secure_db_tool` tool. "
                            "If they ask about general company policies or rules, use the `search_company_policies` tool. "
                            "If you use a tool, read the result and synthesize a friendly final clean answer for the user."
                            "Dont assume anything from your own knowledge. Only answer based on the tools and information provided."
                            "Provide answers in a concise and clear manner Dont use so many special characters. If you don't know the answer, say 'I don't know' or 'I am not sure'."
                        )
        elif(incident_details):
            content=(
                            "You are a insurance policy verifier. "
                            "You are strictly not allowed to use 'secure_db_tool' tool. "
                            "Use `search_company_policies` tool only if the incident_description matches with incident_type. "
                            "First Match the incident_description with incident_type if does not match respond with a clear, concise and polite message for rejection and keep the policy_references empty."
                            "If incident_description matches with incident_type then check if the user's incident_description matches any of the company policies using the `search_company_policies` tool. "
                            "If it does, respond with a clear and concise message confirming that the incident is covered by the policy. "
                            "If it does not match any policy, respond with a clear, concise and polite message for rejection with the clear references from the policy document. "
                            "Special Case: In case of incident_type = 'Burglary, Housebreaking, or Theft' no need to match with incident_desciption simply check if the user's incident_type matches any of the company policies using the `search_company_policies` tool. and give response directly with all the clear references from policy document"
                            "Dont assume anything from your own knowledge. Only answer based on the tools and information provided."
                            "Provide answers in a concise and clear manner Dont use so many special characters."
                            "Your answer should be in json format with the following keys: 'is_covered' (boolean), 'message' (string), and 'policy_references' list of (comma separated strings )."
                        )
        sys_msg = SystemMessage(
            content=content
        )
        
        # Combine system prompt with conversation history and invoke
        messages = [sys_msg] + state["messages"]
        response = llm_with_tools.invoke(messages)
        
        return {"messages": [response]}

    # 3. Build and Compile the Graph
    graph_builder = StateGraph(State)

    # Add our nodes
    graph_builder.add_node("agent", chatbot_node)
    graph_builder.add_node("tools", ToolNode(tools))

    # Define the flow
    graph_builder.add_edge(START, "agent")
    graph_builder.add_conditional_edges("agent", tools_condition) # Checks if the LLM decided to use a tool
    graph_builder.add_edge("tools", "agent") # Loops back to the agent after tool finishes

    # Compile the graph and attach the memory checkpointer
    graph = graph_builder.compile(checkpointer=memory)
    
    # Define the configuration using the customer_id as the thread_id
    config = {"configurable": {"thread_id": customer_id}}
    
    # 4. Run the graph with the user's initial query
    initial_state = {"messages": [HumanMessage(content= query if query else incident_details)]}
    final_state = await graph.ainvoke(initial_state, config=config)
    
    # Return the final message content
    return final_state["messages"][-1].content