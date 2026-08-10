# agents/Db_retriever.py
import json
from langchain_core.tools import tool
from dotenv import load_dotenv
from config.database_config import get_supabase
from config.logger import logger

load_dotenv()

supabase_safe = get_supabase(role="anon")


def get_secure_database_tool(customer_id: str):
    """
    Factory Function: Returns a list of specific, secure tools locked to the current user.
    Instead of writing raw SQL, the AI will choose which tool to call based on the user's question.
    """
    @tool
    async def get_my_personal_profile() -> str:
        """Use this to get the customer's personal details like name, vehicle number and policy number."""
        logger.info(f"Fetching profile for customer: {customer_id}")
        try:
            res = supabase_safe.table("customer").select("*").eq("customer_id", customer_id).execute()
            return json.dumps(res.data) if res.data else "No profile found."
        except Exception as e:
            logger.exception(f"Error fetching personal profile for {customer_id}: {e}")
            return f"Error: {e}"

    @tool
    async def get_my_vehicles() -> str:
        """Use this to get the vehicle model and car number registered to the customer."""
        logger.info(f"Fetching vehicles details for customer: {customer_id}")
        try:
            # Step 1: Get the car_number from the customer table
            cust_res = supabase_safe.table("customer").select("car_number").eq("customer_id", customer_id).execute()
            if not cust_res.data or not cust_res.data[0].get("car_number"):
                return "No vehicles registered to this customer."
            
            car_number = cust_res.data[0]["car_number"]
            
            # Step 2: Fetch the actual vehicle details using the car_number
            veh_res = supabase_safe.table("vehicles").select("*").eq("car_number", car_number).execute()
            return json.dumps(veh_res.data) if veh_res.data else "No vehicle details found."
        except Exception as e:
            logger.exception(f"Error fetching vehicles for {customer_id}: {e}")
            return f"Error: {e}"

    @tool
    async def get_my_active_policies() -> str:
        """Use this to get the customer's insurance policies details, coverage details, and policy numbers."""
        logger.info(f"Fetching policy details for customer: {customer_id}")
        try:
            # Step 1: Get the policy_no from the customer table
            cust_res = supabase_safe.table("customer").select("policy_no").eq("customer_id", customer_id).execute()
            if not cust_res.data or not cust_res.data[0].get("policy_no"):
                return "No active policies found."
            
            policy_no = cust_res.data[0]["policy_no"]
            
            # Step 2: Fetch the actual policy details using the policy_no
            pol_res = supabase_safe.table("policies").select("*").eq("policy_no", policy_no).execute()
            return json.dumps(pol_res.data) if pol_res.data else "No policies found."
        except Exception as e:
            logger.exception(f"Error fetching policies for {customer_id}: {e}")
            return f"Error: {e}"

    @tool
    async def get_my_claims() -> str:
        """Use this to get the status, dates, and details of any insurance claims the customer has filed."""
        logger.info(f"Fetching claims for customer: {customer_id}")
        try:
            # The claims table has a direct customer_id column, so we can query it directly
            res = supabase_safe.table("claims").select(
                "claim_id, claim_date_time, incident_date, incident_type, claim_status, claim_amount, description, rejection_reason, action_by, policy_references"
            ).eq("customer_id", customer_id).execute()
            
            return json.dumps(res.data) if res.data else "No claims found for this customer."
        except Exception as e:
            logger.exception(f"Error fetching claims for {customer_id}: {e}")
            return f"Error: {e}"

    # Return the LIST of tools to the agent
    return [get_my_personal_profile, get_my_vehicles, get_my_active_policies, get_my_claims]
        