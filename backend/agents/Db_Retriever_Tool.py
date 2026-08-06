# agents/Db_retriever.py
import os
import json
from langchain_core.tools import tool
from dotenv import load_dotenv
from config.database_config import get_supabase

load_dotenv()

def get_secure_database_tool(current_customer_id: str):
    """
    This is a Factory Function. It creates a tool specifically locked 
    to the current user's ID. The LLM takes 0 arguments for this tool.
    """
    @tool
    async def lookup_my_database(query: str, customer_id: str) -> str:
        """
        Use this tool ONLY to look up specific, personal database records for the logged-in customer.
        Use this to find their specific vehicle number, personal claim status, or personal policy ID.
        DO NOT use this tool to answer general questions about company rules, how to file a claim, or PDF summaries.
        """
        try:
            # 1. Fetch Customer Data (LOCKED to current_customer_id)
            supabase = get_supabase(role="anon")
            cust_res = supabase.table("customer").select("*").eq("customer_id", current_customer_id).execute()
            if not cust_res.data:
                return "Error: Customer not found."
            
            # 2. Fetch Vehicles
            veh_res = supabase.table("vehicles").select("*").eq("customer_id", current_customer_id).execute()
            vehicles = veh_res.data
            
            # 3. Fetch Policies
            car_numbers = [v["car_number"] for v in vehicles]
            print(car_numbers)
            policies = []
            if car_numbers:
                pol_res = supabase.table("policies").select("*").in_("car_number", car_numbers).execute()
                policies = pol_res.data
                
            # 4. Fetch Claims
            policy_ids = [p["policy_no"] for p in policies]
            claims = []
            if policy_ids:
                claim_res = supabase.table("claims").select("*").in_("policy_no", policy_ids).execute()
                claims = claim_res.data

            # 5. Compile into a safe, structured dictionary for the LLM to read
            full_profile = {
                "personal_info": cust_res.data[0],
                "vehicles": vehicles,
                "policies": policies,
                "claims": claims
            }
            
            # Return as a JSON string so the LLM can easily read and answer the user's question
            return json.dumps(full_profile, indent=2)

        except Exception as e:
            return f"Database error: {str(e)}"

    return lookup_my_database