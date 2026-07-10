import unittest
from fastapi.testclient import TestClient
import jwt
import sys
import os

# Import our FastAPI app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import app, get_session, User, Tool, GlobalApiKey, ActivityLog, Session, engine, on_start, make_token

class TestNewFeatures(unittest.TestCase):
    def setUp(self):
        # Manually invoke startup database migration & seeding
        on_start()
        
        self.client = TestClient(app)
        self.session = Session(engine)
        
        # Ensure we have an admin user in the database
        self.admin = self.session.query(User).filter(User.role == "admin").first()
        if not self.admin:
            self.admin = User(
                name="Test Admin",
                email="admin_test@cnx.com",
                password_hash="pbkdf2_sha256$mocked_hash",
                role="admin"
            )
            self.session.add(self.admin)
            self.session.commit()
            self.session.refresh(self.admin)
            
        self.admin_token = make_token(self.admin)
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}

        # Ensure we have at least one tool in the database for tracking tests
        self.tool = self.session.query(Tool).first()
        if not self.tool:
            self.tool = Tool(
                name="Test Tool",
                owner="Test Owner",
                category="IX Suite",
                status="pilot",
                roi=0,
                problem="test problem",
                capabilities=["Cap"],
                review_status="approved",
                owner_id=self.admin.id
            )
            self.session.add(self.tool)
            self.session.commit()
            self.session.refresh(self.tool)

    def tearDown(self):
        self.session.close()

    def test_user_credits_update(self):
        # Update credits for our admin user
        response = self.client.put(
            f"/admin/users/{self.admin.id}/credits",
            json={"credits": 20},
            headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["ai_credits"], 20)

    def test_global_api_keys_pool(self):
        # Add a global key
        response = self.client.post(
            "/admin/keys",
            json={"key_value": "AIzaSyTestMockKey123", "description": "Mock Key Description", "provider": "gemini"},
            headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        key_id = data["id"]
        self.assertEqual(data["description"], "Mock Key Description")
        self.assertEqual(data["is_active"], True)

        # Get all keys
        response = self.client.get("/admin/keys", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.json()) >= 1)

        # Toggle key
        response = self.client.put(f"/admin/keys/{key_id}/toggle", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["is_active"], False)

        # Delete key
        response = self.client.delete(f"/admin/keys/{key_id}", headers=self.headers)
        self.assertEqual(response.status_code, 200)

    def test_telemetry_and_heartbeat(self):
        # Track activity
        response = self.client.post(
            "/me/track-activity",
            json={"page": "AI Chat", "seconds": 30},
            headers=self.headers
        )
        self.assertEqual(response.status_code, 200)

        # Track search
        response = self.client.post(
            "/catalog/track-search",
            json={"query": "test query"},
            headers=self.headers
        )
        self.assertEqual(response.status_code, 200)

        # Track tool view using our verified tool ID
        response = self.client.post(
            f"/tools/{self.tool.id}/track-view",
            headers=self.headers
        )
        self.assertEqual(response.status_code, 200)

        # Track tool action using our verified tool ID
        response = self.client.post(
            f"/tools/{self.tool.id}/track-action",
            json={"action_type": "demo_launch"},
            headers=self.headers
        )
        self.assertEqual(response.status_code, 200)

        # Track funnel
        response = self.client.post(
            "/funnel/track-submission",
            json={"action": "start_draft", "draft_id": "draft_abc"},
            headers=self.headers
        )
        self.assertEqual(response.status_code, 200)

        # Fetch analytics time-spent
        response = self.client.get("/admin/analytics", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertTrue("time_spent" in response.json())
        self.assertTrue(len(response.json()["time_spent"]) >= 1)

    def test_tool_submission_fields(self):
        # Test tool creation payload with success_stories and time_to_deploy
        payload = {
            "name": "Telemetry Tool Unique Name",
            "owner": "Admin Test",
            "category": "Tech Infusion",
            "status": "pilot",
            "implementation_status": "implemented",
            "impact": "High impact",
            "roi": 15000,
            "problem": "Manual tracking is inefficient.",
            "capabilities": ["Auto tracking", "Credits management"],
            "delivers": "Standard report",
            "benefits": "Time saving",
            "tags": ["telemetry", "ai"],
            "time_to_deploy": "3 days",
            "success_stories": [{"title": "Success Case 1", "file_url": "data:text/plain;base64,VGVzdA=="}]
        }
        response = self.client.post(
            "/tools",
            json=payload,
            headers=self.headers
        )
        self.assertEqual(response.status_code, 200) # backend returns 200 on create
        tool_data = response.json()
        
        # Verify the created tool has our custom fields by fetching it
        response = self.client.get(f"/tools/{tool_data['id']}", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        fetched_tool = response.json()
        self.assertEqual(fetched_tool["time_to_deploy"], "3 days")
        self.assertEqual(len(fetched_tool["success_stories"]), 1)
        self.assertEqual(fetched_tool["success_stories"][0]["title"], "Success Case 1")

if __name__ == "__main__":
    unittest.main()
