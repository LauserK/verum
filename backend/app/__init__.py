from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.transfers.router import router as transfers_router
from app.catering.router import router as catering_router
from app.superadmin.router import router as superadmin_router
from app.inventory.router import router as inventory_router
from app.production.router import router as production_router
from app.attendance.router import router as attendance_router
from app.admin.router import router as admin_router
from app.checklists.router import router as checklists_router
from app.auth.router import router as auth_router

def create_app() -> FastAPI:
    app = FastAPI(title="VERUM API")

    # CORS for frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:3001", "https://verum-eta.vercel.app"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    app.include_router(transfers_router)
    app.include_router(catering_router)
    app.include_router(superadmin_router)
    app.include_router(inventory_router)
    app.include_router(production_router)
    app.include_router(attendance_router)
    app.include_router(admin_router)
    app.include_router(checklists_router)
    app.include_router(auth_router)

    return app
