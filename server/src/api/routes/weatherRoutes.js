import { Router } from "express";
import { bongabongWeather, currentLocationWeather, myLandWeather, weatherForLand } from "../controllers/weatherController.js";
import { authenticate, allowRoles } from "../middleware/auth.js";
const router = Router();
router.get("/bongabong", authenticate, allowRoles("farmer", "staff", "technician", "admin"), bongabongWeather);
router.get("/my-location", authenticate, allowRoles("farmer"), myLandWeather);
router.get("/current-location", authenticate, allowRoles("farmer"), currentLocationWeather);
router.get("/lands/:landId", authenticate, allowRoles("staff", "technician", "admin"), weatherForLand);
export default router;
